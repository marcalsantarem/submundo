import skillsJson from '../../data/skills.json';
import {
  applyDamageToHero,
  healHero,
  moveHero,
} from '../entities/Hero';
import type { HeroState, SpectralMinion } from '../entities/Hero';
import { applyDamageToMonster, stepDormantPatrol } from '../entities/Monster';
import type { MonsterInstance } from '../entities/Monster';
import type { LegendaryPowerId, SkillDef, SkillSlot, Vector2D } from '../index';

export type CombatEventType =
  | 'hero_basic_attack'
  | 'hero_skill_used'
  | 'hero_dash'
  | 'hero_healed'
  | 'monster_damaged'
  | 'monster_killed'
  | 'hero_damaged'
  | 'hero_killed'
  | 'ember_applied'
  | 'ember_explosion'
  | 'bleed_tick'
  | 'lifesteal_heal'
  | 'lightning_chain'
  | 'minion_spawned'
  | 'minion_attack'
  | 'status_stun';

export interface CombatEvent {
  type: CombatEventType;
  sourceId: string;
  targetId?: string;
  skillId?: string;
  value?: number;
  position: Vector2D;
  isCrit?: boolean;
  chainTargets?: Vector2D[];
}

export const DEFAULT_SKILLS: SkillDef[] = skillsJson as SkillDef[];

export function distanceBetween(a: Vector2D, b: Vector2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function distancePointToSegment(p: Vector2D, a: Vector2D, b: Vector2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return distanceBetween(p, a);
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

function hasLegendaryPower(hero: HeroState, powerId: LegendaryPowerId): boolean {
  return hero.activeLegendaryPowers.includes(powerId);
}

function getEffectiveCooldownMs(hero: HeroState, baseCooldownMs: number): number {
  const cdr = Math.min(0.45, Math.max(0, hero.cooldownReduction));
  return Math.round(baseCooldownMs * (1 - cdr));
}

function handleMonsterKilled(
  hero: HeroState,
  monster: MonsterInstance,
  nowMs: number,
  rng: () => number,
  events: CombatEvent[],
  sourceId: string,
  skillId?: string,
  forceBleedActive = false
): void {
  hero.souls += monster.soulReward;
  events.push({
    type: 'monster_killed',
    sourceId,
    targetId: monster.instanceId,
    ...(skillId ? { skillId } : {}),
    value: monster.soulReward,
    position: { ...monster.position },
  });

  const isBleeding =
    forceBleedActive || (monster.bleedDps > 0 && monster.bleedUntilMs >= nowMs);
  if (hasLegendaryPower(hero, 'submundo_bleed_minion') && isBleeding && rng() < 0.25) {
    const minion: SpectralMinion = {
      id: `minion_${nowMs}_${hero.minions.length + 1}`,
      position: { x: monster.position.x, y: monster.position.y },
      attack: Math.max(6, Math.round(hero.stats.attack * 0.6)),
      attackRange: 48,
      attackCooldownMs: 800,
      nextAttackAtMs: nowMs,
      expiresAtMs: nowMs + 12000,
    };
    hero.minions.push(minion);
    events.push({
      type: 'minion_spawned',
      sourceId: hero.id,
      targetId: minion.id,
      position: { ...minion.position },
    });
  }
}

function applyBleed(hero: HeroState, monster: MonsterInstance, nowMs: number): void {
  const wasBleeding = monster.bleedDps > 0 && monster.bleedUntilMs > nowMs;
  const bleedDps = Math.max(4, Math.round(hero.stats.attack * 0.4));
  monster.bleedDps = wasBleeding ? Math.max(monster.bleedDps, bleedDps) : bleedDps;
  monster.bleedUntilMs = nowMs + 3000;
  if (!wasBleeding) {
    monster.lastBleedTickAtMs = nowMs;
  }
}

function applyLifeSteal(
  hero: HeroState,
  target: MonsterInstance,
  dealt: number,
  nowMs: number,
  events: CombatEvent[]
): void {
  if (hero.lifeSteal <= 0 || dealt <= 0 || !hero.isAlive) {
    return;
  }
  const isTargetBleeding = target.bleedDps > 0 && target.bleedUntilMs >= nowMs;
  const multiplier =
    hasLegendaryPower(hero, 'submundo_crimson_pact') && isTargetBleeding ? 2 : 1;
  const rawHeal = dealt * hero.lifeSteal * multiplier;
  if (rawHeal <= 0) {
    return;
  }
  const healAmount = Math.max(1, Math.round(rawHeal));
  const previousHp = hero.stats.hp;
  hero.stats.hp = Math.min(hero.stats.maxHp, hero.stats.hp + healAmount);
  const actualHeal = hero.stats.hp - previousHp;
  if (actualHeal > 0) {
    events.push({
      type: 'lifesteal_heal',
      sourceId: hero.id,
      targetId: target.instanceId,
      value: actualHeal,
      position: { ...hero.position },
    });
  }
}

function applyEmberStack(
  hero: HeroState,
  target: MonsterInstance,
  monsters: MonsterInstance[],
  nowMs: number,
  rng: () => number,
  events: CombatEvent[],
  skillId?: string
): void {
  target.emberStacks += 1;
  events.push({
    type: 'ember_applied',
    sourceId: hero.id,
    targetId: target.instanceId,
    ...(skillId ? { skillId } : {}),
    value: target.emberStacks,
    position: { ...target.position },
  });

  if (target.emberStacks >= 5) {
    target.emberStacks = 0;
    const hasNova = hasLegendaryPower(hero, 'inferno_ember_nova');
    const radius = hasNova ? 130 : 90;
    const rawExplosionDmg = Math.round(hero.stats.attack * (hasNova ? 2.6 : 1.8));
    const explosionCenter = { ...target.position };
    let totalDealt = 0;
    const killedTargets: MonsterInstance[] = [];

    for (const other of monsters) {
      if (!other.isAlive || other.hp <= 0) {
        continue;
      }
      if (distanceBetween(explosionCenter, other.position) <= radius) {
        const wasAlive = other.isAlive;
        const dealt = applyDamageToMonster(other, rawExplosionDmg);
        totalDealt += dealt;
        if (wasAlive && !other.isAlive) {
          killedTargets.push(other);
        }
      }
    }

    events.push({
      type: 'ember_explosion',
      sourceId: hero.id,
      targetId: target.instanceId,
      ...(skillId ? { skillId } : {}),
      value: totalDealt > 0 ? totalDealt : rawExplosionDmg,
      position: explosionCenter,
    });

    for (const killed of killedTargets) {
      handleMonsterKilled(hero, killed, nowMs, rng, events, hero.id, skillId);
    }
  }
}

function applyCritEmpireoSynergies(
  hero: HeroState,
  target: MonsterInstance,
  monsters: MonsterInstance[],
  nowMs: number,
  rng: () => number,
  events: CombatEvent[],
  skill?: SkillDef
): void {
  if (hasLegendaryPower(hero, 'empireo_judgment_haste')) {
    for (const key of Object.keys(hero.skillReadyAtMs)) {
      if (hero.skillReadyAtMs[key] > nowMs) {
        hero.skillReadyAtMs[key] = Math.max(nowMs, hero.skillReadyAtMs[key] - 500);
      }
    }
  }

  const shouldLightning =
    skill?.force === 'empireo' ||
    hero.equippedForces.empireo > 0 ||
    hasLegendaryPower(hero, 'empireo_crit_lightning');

  if (!shouldLightning) {
    return;
  }

  const chainRadius = 160;
  const candidates = monsters
    .filter(
      (m) =>
        m.isAlive &&
        m.hp > 0 &&
        m.instanceId !== target.instanceId &&
        distanceBetween(target.position, m.position) <= chainRadius
    )
    .sort(
      (a, b) =>
        distanceBetween(target.position, a.position) -
        distanceBetween(target.position, b.position)
    )
    .slice(0, 2);

  if (candidates.length === 0) {
    return;
  }

  const lightningDmg = Math.round(hero.stats.attack * 0.9);
  const chainTargets: Vector2D[] = [];
  let totalDealt = 0;
  const killedTargets: MonsterInstance[] = [];

  for (const chained of candidates) {
    chainTargets.push({ ...chained.position });
    const wasAlive = chained.isAlive;
    const dealt = applyDamageToMonster(chained, lightningDmg);
    totalDealt += dealt;
    chained.stunnedUntilMs = Math.max(chained.stunnedUntilMs, nowMs + 600);
    if (wasAlive && !chained.isAlive) {
      killedTargets.push(chained);
    }
  }

  events.push({
    type: 'lightning_chain',
    sourceId: hero.id,
    targetId: target.instanceId,
    ...(skill ? { skillId: skill.id } : {}),
    value: totalDealt,
    position: { ...target.position },
    chainTargets,
  });

  for (const stunned of candidates) {
    events.push({
      type: 'status_stun',
      sourceId: hero.id,
      targetId: stunned.instanceId,
      ...(skill ? { skillId: skill.id } : {}),
      value: 600,
      position: { ...stunned.position },
    });
  }

  for (const killed of killedTargets) {
    handleMonsterKilled(hero, killed, nowMs, rng, events, hero.id, skill?.id);
  }
}

function applyHeroHitSynergies(
  hero: HeroState,
  target: MonsterInstance,
  wasTargetAlive: boolean,
  dealt: number,
  isCrit: boolean,
  monsters: MonsterInstance[],
  nowMs: number,
  rng: () => number,
  events: CombatEvent[],
  skill?: SkillDef
): void {
  if (skill?.force === 'submundo' || hero.equippedForces.submundo > 0) {
    applyBleed(hero, target, nowMs);
  }

  applyLifeSteal(hero, target, dealt, nowMs, events);

  if (wasTargetAlive && !target.isAlive) {
    handleMonsterKilled(hero, target, nowMs, rng, events, hero.id, skill?.id);
  }

  if (skill?.force === 'inferno' || hero.equippedForces.inferno > 0) {
    applyEmberStack(hero, target, monsters, nowMs, rng, events, skill?.id);
  }

  if (isCrit) {
    applyCritEmpireoSynergies(hero, target, monsters, nowMs, rng, events, skill);
  }
}

export interface CalculateDamageOptions {
  critChance?: number;
  critMultiplier?: number;
  damageMultiplier?: number;
  rng?: () => number;
}

export interface DamageCalculationResult {
  damage: number;
  rawDamage: number;
  isCrit: boolean;
}

export function calculateDamage(
  attack: number,
  defense: number,
  optionsOrCritChance?: number | CalculateDamageOptions,
  critMultiplierArg = 1.5,
  rngArg: () => number = Math.random
): DamageCalculationResult {
  const isOptionsObj = typeof optionsOrCritChance === 'object' && optionsOrCritChance !== null;
  const critChance = isOptionsObj
    ? (optionsOrCritChance.critChance ?? 0)
    : (optionsOrCritChance ?? 0);
  const critMultiplier = isOptionsObj
    ? (optionsOrCritChance.critMultiplier ?? 1.5)
    : critMultiplierArg;
  const damageMultiplier = isOptionsObj
    ? (optionsOrCritChance.damageMultiplier ?? 1)
    : 1;
  const rng = isOptionsObj ? (optionsOrCritChance.rng ?? Math.random) : rngArg;

  const isCrit = critChance > 0 && rng() < critChance;
  const rawDamage = attack * damageMultiplier * (isCrit ? critMultiplier : 1);
  const damage = Math.max(1, Math.round(rawDamage - defense));

  return {
    damage,
    rawDamage,
    isCrit,
  };
}

export function findNearestLivingMonster(
  origin: Vector2D,
  monsters: MonsterInstance[],
  maxRange?: number
): MonsterInstance | null {
  let nearest: MonsterInstance | null = null;
  let nearestDistance = Infinity;

  for (const monster of monsters) {
    if (!monster.isAlive || monster.hp <= 0) {
      continue;
    }

    const dist = distanceBetween(origin, monster.position);
    if (maxRange !== undefined && dist > maxRange) {
      continue;
    }

    if (dist < nearestDistance) {
      nearestDistance = dist;
      nearest = monster;
    }
  }

  return nearest;
}

export interface TickCombatParams {
  hero: HeroState;
  monsters: MonsterInstance[];
  deltaMs: number;
  nowMs: number;
  moveDir?: Vector2D;
  bounds?: { width: number; height: number; padding?: number };
  rng?: () => number;
}

export function tickCombat(
  hero: HeroState,
  monsters: MonsterInstance[],
  deltaMs: number,
  nowMs: number,
  rng?: () => number
): CombatEvent[];
export function tickCombat(params: TickCombatParams): CombatEvent[];
export function tickCombat(
  heroOrParams: HeroState | TickCombatParams,
  monstersArg?: MonsterInstance[],
  deltaMsArg?: number,
  nowMsArg?: number,
  rngArg?: () => number
): CombatEvent[] {
  const isParams = 'hero' in heroOrParams && 'monsters' in heroOrParams;
  const hero = isParams ? heroOrParams.hero : heroOrParams;
  const monsters = isParams ? heroOrParams.monsters : (monstersArg ?? []);
  const deltaMs = isParams ? heroOrParams.deltaMs : (deltaMsArg ?? 0);
  const nowMs = isParams ? heroOrParams.nowMs : (nowMsArg ?? 0);
  const rng = isParams ? (heroOrParams.rng ?? Math.random) : (rngArg ?? Math.random);

  if (!hero.isAlive) {
    return [];
  }

  if (isParams && heroOrParams.moveDir) {
    moveHero(
      hero,
      heroOrParams.moveDir,
      deltaMs,
      heroOrParams.bounds ?? { width: 800, height: 600, padding: 24 }
    );
  }

  const events: CombatEvent[] = [];

  // 0. Process bleed ticks on monsters
  for (const monster of monsters) {
    if (!monster.isAlive || monster.bleedDps <= 0 || monster.bleedUntilMs <= 0) {
      continue;
    }

    const effectiveNow = Math.min(nowMs, monster.bleedUntilMs);
    while (
      monster.isAlive &&
      monster.lastBleedTickAtMs + 500 <= effectiveNow
    ) {
      monster.lastBleedTickAtMs += 500;
      const tickDmg = Math.max(1, Math.round(monster.bleedDps * 0.5));
      const wasAlive = monster.isAlive;
      const dealt = applyDamageToMonster(monster, tickDmg);

      events.push({
        type: 'bleed_tick',
        sourceId: hero.id,
        targetId: monster.instanceId,
        value: dealt,
        position: { ...monster.position },
      });

      if (wasAlive && !monster.isAlive) {
        handleMonsterKilled(
          hero,
          monster,
          monster.lastBleedTickAtMs,
          rng,
          events,
          hero.id,
          undefined,
          true
        );
      }
    }

    if (nowMs > monster.bleedUntilMs) {
      monster.bleedDps = 0;
    }
  }

  // 1. Hero automatic basic attack on nearest living monster within attackRange
  if (nowMs >= hero.basicAttackReadyAtMs) {
    const target = findNearestLivingMonster(
      hero.position,
      monsters,
      hero.stats.attackRange
    );

    if (target) {
      hero.basicAttackReadyAtMs = nowMs + hero.stats.attackCooldownMs;

      const dx = target.position.x - hero.position.x;
      const dy = target.position.y - hero.position.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        hero.facing = { x: dx / dist, y: dy / dist };
      }

      const calc = calculateDamage(hero.stats.attack, target.defense, {
        critChance: hero.stats.critChance,
        critMultiplier: hero.stats.critMultiplier,
        rng,
      });

      const wasAlive = target.isAlive;
      const dealt = applyDamageToMonster(target, calc.rawDamage);

      events.push({
        type: 'hero_basic_attack',
        sourceId: hero.id,
        targetId: target.instanceId,
        value: dealt,
        position: { ...target.position },
        isCrit: calc.isCrit,
      });

      events.push({
        type: 'monster_damaged',
        sourceId: hero.id,
        targetId: target.instanceId,
        value: dealt,
        position: { ...target.position },
        isCrit: calc.isCrit,
      });

      applyHeroHitSynergies(
        hero,
        target,
        wasAlive,
        dealt,
        calc.isCrit,
        monsters,
        nowMs,
        rng,
        events
      );
    }
  }

  // 2. Spectral Minions AI: expire after 12s, chase and attack nearest monster
  hero.minions = hero.minions.filter((m) => m.expiresAtMs > nowMs);
  const minionSpeed = Math.max(150, hero.stats.moveSpeed);
  for (const minion of hero.minions) {
    const target = findNearestLivingMonster(minion.position, monsters);
    if (!target) {
      continue;
    }

    let dist = distanceBetween(minion.position, target.position);
    if (dist > minion.attackRange && deltaMs > 0) {
      const dx = target.position.x - minion.position.x;
      const dy = target.position.y - minion.position.y;
      const step = Math.min(
        dist - minion.attackRange,
        minionSpeed * (deltaMs / 1000)
      );
      if (step > 0 && dist > 0) {
        minion.position.x += (dx / dist) * step;
        minion.position.y += (dy / dist) * step;
        dist = distanceBetween(minion.position, target.position);
      }
    }

    if (dist <= minion.attackRange && nowMs >= minion.nextAttackAtMs) {
      minion.nextAttackAtMs = nowMs + minion.attackCooldownMs;
      const wasAlive = target.isAlive;
      const dealt = applyDamageToMonster(target, minion.attack);

      events.push({
        type: 'minion_attack',
        sourceId: minion.id,
        targetId: target.instanceId,
        value: dealt,
        position: { ...target.position },
      });

      if (wasAlive && !target.isAlive) {
        handleMonsterKilled(hero, target, nowMs, rng, events, minion.id);
      }
    }
  }

  // 3. Monster AI: chase hero and attack when within monster.attackRange (unless stunned)
  for (const monster of monsters) {
    if (!monster.isAlive || !hero.isAlive) {
      continue;
    }

    if (nowMs < monster.stunnedUntilMs) {
      continue;
    }

    // T-151: adormecido não persegue nem ataca; só patrulha perto de casa (quem acorda é o chamador,
    // via updateMonsterAwareness, antes do tick).
    if (monster.dormant) {
      stepDormantPatrol(monster, deltaMs, nowMs);
      continue;
    }

    let dist = distanceBetween(monster.position, hero.position);

    if (dist > monster.attackRange && deltaMs > 0) {
      const dx = hero.position.x - monster.position.x;
      const dy = hero.position.y - monster.position.y;
      const step = Math.min(
        dist - monster.attackRange,
        monster.moveSpeed * (deltaMs / 1000)
      );
      if (step > 0 && dist > 0) {
        monster.position.x += (dx / dist) * step;
        monster.position.y += (dy / dist) * step;
        dist = distanceBetween(monster.position, hero.position);
      }
    }

    if (dist <= monster.attackRange && nowMs >= monster.nextAttackAtMs) {
      monster.nextAttackAtMs = nowMs + monster.attackCooldownMs;
      const dealtToHero = applyDamageToHero(hero, monster.attack, nowMs);

      if (dealtToHero > 0) {
        events.push({
          type: 'hero_damaged',
          sourceId: monster.instanceId,
          targetId: hero.id,
          value: dealtToHero,
          position: { ...hero.position },
        });

        if (!hero.isAlive) {
          events.push({
            type: 'hero_killed',
            sourceId: monster.instanceId,
            targetId: hero.id,
            position: { ...hero.position },
          });
        }
      }
    }
  }

  return events;
}

export interface TriggerSkillOptions {
  bounds?: { width: number; height: number; padding?: number };
  direction?: Vector2D;
  rng?: () => number;
  skillsCatalog?: SkillDef[];
}

export function triggerHeroSkill(
  hero: HeroState,
  slotOrSkill: SkillSlot | SkillDef | string,
  monsters: MonsterInstance[] = [],
  nowMs = 0,
  options?: TriggerSkillOptions
): CombatEvent[] {
  if (!hero.isAlive) {
    return [];
  }

  const catalog = options?.skillsCatalog ?? DEFAULT_SKILLS;
  const skill: SkillDef | undefined =
    typeof slotOrSkill === 'object'
      ? slotOrSkill
      : catalog.find((s) => s.slot === slotOrSkill || s.id === slotOrSkill);

  if (!skill) {
    return [];
  }

  const readyAtSlot = hero.skillReadyAtMs[skill.slot] ?? 0;
  const readyAtId = hero.skillReadyAtMs[skill.id] ?? 0;
  if (nowMs < Math.max(readyAtSlot, readyAtId)) {
    return [];
  }

  const events: CombatEvent[] = [];
  const rng = options?.rng ?? Math.random;
  const effectiveCooldownMs = getEffectiveCooldownMs(hero, skill.cooldownMs);

  if (skill.slot === 'dash') {
    const startPos = { ...hero.position };
    const rawDir =
      options?.direction &&
      (options.direction.x !== 0 || options.direction.y !== 0)
        ? options.direction
        : hero.facing.x !== 0 || hero.facing.y !== 0
          ? hero.facing
          : { x: 1, y: 0 };

    const len = Math.hypot(rawDir.x, rawDir.y) || 1;
    const nx = rawDir.x / len;
    const ny = rawDir.y / len;
    hero.facing = { x: nx, y: ny };

    const dashDist = skill.dashDistance ?? 120;
    let nextX = hero.position.x + nx * dashDist;
    let nextY = hero.position.y + ny * dashDist;

    if (options?.bounds) {
      const pad = options.bounds.padding ?? 0;
      const minX = pad;
      const maxX = Math.max(pad, options.bounds.width - pad);
      const minY = pad;
      const maxY = Math.max(pad, options.bounds.height - pad);
      nextX = Math.min(maxX, Math.max(minX, nextX));
      nextY = Math.min(maxY, Math.max(minY, nextY));
    }

    hero.position = { x: nextX, y: nextY };
    hero.invulnerableUntilMs = Math.max(
      hero.invulnerableUntilMs,
      nowMs + (skill.invulnerabilityMs ?? 350)
    );

    const nextReady = nowMs + effectiveCooldownMs;
    hero.skillReadyAtMs[skill.slot] = nextReady;
    hero.skillReadyAtMs[skill.id] = nextReady;

    events.push({
      type: 'hero_dash',
      sourceId: hero.id,
      skillId: skill.id,
      position: { ...hero.position },
    });

    events.push({
      type: 'hero_skill_used',
      sourceId: hero.id,
      skillId: skill.id,
      position: { ...hero.position },
    });

    if (hasLegendaryPower(hero, 'inferno_dash_trail')) {
      for (const monster of monsters) {
        if (!monster.isAlive || monster.hp <= 0) {
          continue;
        }
        if (distancePointToSegment(monster.position, startPos, hero.position) <= 90) {
          applyEmberStack(hero, monster, monsters, nowMs, rng, events, skill.id);
        }
      }
    }

    return events;
  }

  if (skill.slot === 'potion') {
    if (hero.potionCharges <= 0) {
      return [];
    }

    hero.potionCharges -= 1;
    const healed = healHero(hero, skill.healPercent ?? 0.4);

    const nextReady = nowMs + effectiveCooldownMs;
    hero.skillReadyAtMs[skill.slot] = nextReady;
    hero.skillReadyAtMs[skill.id] = nextReady;

    events.push({
      type: 'hero_skill_used',
      sourceId: hero.id,
      skillId: skill.id,
      value: healed,
      position: { ...hero.position },
    });

    events.push({
      type: 'hero_healed',
      sourceId: hero.id,
      skillId: skill.id,
      value: healed,
      position: { ...hero.position },
    });

    return events;
  }

  // Active AoE skills (active_1, active_2)
  const nextReady = nowMs + effectiveCooldownMs;
  hero.skillReadyAtMs[skill.slot] = nextReady;
  hero.skillReadyAtMs[skill.id] = nextReady;

  events.push({
    type: 'hero_skill_used',
    sourceId: hero.id,
    skillId: skill.id,
    position: { ...hero.position },
  });

  const radius = skill.radius ?? 80;
  const damageMultiplier = skill.damageMultiplier ?? 1;

  for (const monster of monsters) {
    if (!monster.isAlive || monster.hp <= 0) {
      continue;
    }

    const dist = distanceBetween(hero.position, monster.position);
    if (dist <= radius) {
      const calc = calculateDamage(hero.stats.attack, monster.defense, {
        critChance: hero.stats.critChance,
        critMultiplier: hero.stats.critMultiplier,
        damageMultiplier,
        rng,
      });

      const wasAlive = monster.isAlive;
      const dealt = applyDamageToMonster(monster, calc.rawDamage);

      events.push({
        type: 'monster_damaged',
        sourceId: hero.id,
        targetId: monster.instanceId,
        skillId: skill.id,
        value: dealt,
        position: { ...monster.position },
        isCrit: calc.isCrit,
      });

      applyHeroHitSynergies(
        hero,
        monster,
        wasAlive,
        dealt,
        calc.isCrit,
        monsters,
        nowMs,
        rng,
        events,
        skill
      );
    }
  }

  return events;
}
