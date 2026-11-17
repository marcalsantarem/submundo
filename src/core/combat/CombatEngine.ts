import skillsJson from '../../data/skills.json';
import {
  applyDamageToHero,
  healHero,
  moveHero,
} from '../entities/Hero';
import type { HeroState } from '../entities/Hero';
import { applyDamageToMonster } from '../entities/Monster';
import type { MonsterInstance } from '../entities/Monster';
import type { SkillDef, SkillSlot, Vector2D } from '../index';

export type CombatEventType =
  | 'hero_basic_attack'
  | 'hero_skill_used'
  | 'hero_dash'
  | 'hero_healed'
  | 'monster_damaged'
  | 'monster_killed'
  | 'hero_damaged'
  | 'hero_killed';

export interface CombatEvent {
  type: CombatEventType;
  sourceId: string;
  targetId?: string;
  skillId?: string;
  value?: number;
  position: Vector2D;
  isCrit?: boolean;
}

export const DEFAULT_SKILLS: SkillDef[] = skillsJson as SkillDef[];

export function distanceBetween(a: Vector2D, b: Vector2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
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

      if (!target.isAlive) {
        hero.souls += target.soulReward;
        events.push({
          type: 'monster_killed',
          sourceId: hero.id,
          targetId: target.instanceId,
          value: target.soulReward,
          position: { ...target.position },
        });
      }
    }
  }

  // 2. Monster AI: chase hero and attack when within monster.attackRange
  for (const monster of monsters) {
    if (!monster.isAlive || !hero.isAlive) {
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

  if (skill.slot === 'dash') {
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

    const nextReady = nowMs + skill.cooldownMs;
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

    return events;
  }

  if (skill.slot === 'potion') {
    if (hero.potionCharges <= 0) {
      return [];
    }

    hero.potionCharges -= 1;
    const healed = healHero(hero, skill.healPercent ?? 0.4);

    const nextReady = nowMs + skill.cooldownMs;
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
  const nextReady = nowMs + skill.cooldownMs;
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

      if (!monster.isAlive) {
        hero.souls += monster.soulReward;
        events.push({
          type: 'monster_killed',
          sourceId: hero.id,
          targetId: monster.instanceId,
          skillId: skill.id,
          value: monster.soulReward,
          position: { ...monster.position },
        });
      }
    }
  }

  return events;
}
