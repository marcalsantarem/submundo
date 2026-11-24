import type { MonsterAttackType, MonsterDef, MonsterType, Vector2D } from '../index';

export interface MonsterInstance {
  instanceId: string;
  defId: string;
  name: string;
  type: MonsterType;
  attackType: MonsterAttackType;
  spriteKey: string;
  position: Vector2D;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  moveSpeed: number;
  attackRange: number;
  attackCooldownMs: number;
  soulReward: number;
  nextAttackAtMs: number;
  emberStacks: number;
  bleedUntilMs: number;
  bleedDps: number;
  lastBleedTickAtMs: number;
  stunnedUntilMs: number;
  isAlive: boolean;
  /**
   * T-151 (Decisão #26): monstro já posicionado no mapa, parado/patrulhando perto de `home` até
   * acordar (herói a `aggroRadius` px ou dano). Ausente/false = comportamento normal (persegue).
   */
  dormant?: boolean;
  aggroRadius?: number;
  home?: Vector2D;
}

export function spawnMonster(
  def: MonsterDef,
  instanceId: string,
  position: Vector2D
): MonsterInstance {
  return {
    instanceId,
    defId: def.id,
    name: def.name,
    type: def.type,
    attackType: def.attackType ?? 'melee',
    spriteKey: def.spriteKey,
    position: { x: position.x, y: position.y },
    hp: def.maxHp,
    maxHp: def.maxHp,
    attack: def.attack,
    defense: def.defense,
    moveSpeed: def.moveSpeed,
    attackRange: def.attackRange,
    attackCooldownMs: def.attackCooldownMs,
    soulReward: def.soulReward,
    nextAttackAtMs: 0,
    emberStacks: 0,
    bleedUntilMs: 0,
    bleedDps: 0,
    lastBleedTickAtMs: 0,
    stunnedUntilMs: 0,
    isAlive: def.maxHp > 0,
  };
}

export function applyDamageToMonster(
  monster: MonsterInstance,
  rawDamage: number
): number {
  if (!monster.isAlive || rawDamage <= 0) {
    return 0;
  }

  const finalDamage = Math.max(1, Math.round(rawDamage - monster.defense));
  monster.hp = Math.max(0, monster.hp - finalDamage);

  if (monster.hp <= 0) {
    monster.hp = 0;
    monster.isAlive = false;
  }

  return finalDamage;
}

// ---------------------------------------------------------------------------------------------
// T-151 — Monstros adormecidos (missões sem ondas)
// ---------------------------------------------------------------------------------------------

/** Raio padrão (px, centro a centro) em que um monstro adormecido percebe o herói. */
export const MONSTER_AGGRO_RADIUS = 190;
/** Ao acordar, os adormecidos a até este raio do que acordou também acordam (o grupo reage junto). */
export const MONSTER_GROUP_WAKE_RADIUS = 150;
/** Patrulha curta: raio (px) em torno de `home` e fração da velocidade normal. */
export const MONSTER_PATROL_RADIUS = 28;
export const MONSTER_PATROL_SPEED = 0.22;

/** Deixa o monstro adormecido no lugar atual (que vira o `home` da patrulha). */
export function makeMonsterDormant(monster: MonsterInstance, aggroRadius = MONSTER_AGGRO_RADIUS): void {
  monster.dormant = true;
  monster.aggroRadius = aggroRadius;
  monster.home = { x: monster.position.x, y: monster.position.y };
}

export function wakeMonster(monster: MonsterInstance): boolean {
  if (!monster.dormant) return false;
  monster.dormant = false;
  return true;
}

/**
 * Acorda os monstros adormecidos que perceberam o herói: herói a `aggroRadius` (e `canSense`, quando
 * dado, ex.: mesma sala) ou monstro ferido. Quem acorda acorda o grupo a MONSTER_GROUP_WAKE_RADIUS.
 * Retorna os monstros acordados nesta chamada.
 */
export function updateMonsterAwareness(
  monsters: MonsterInstance[],
  heroPos: Vector2D,
  canSense?: (monster: MonsterInstance) => boolean
): MonsterInstance[] {
  const woke: MonsterInstance[] = [];
  for (const m of monsters) {
    if (!m.dormant || !m.isAlive) continue;
    const near = Math.hypot(m.position.x - heroPos.x, m.position.y - heroPos.y) <= (m.aggroRadius ?? MONSTER_AGGRO_RADIUS);
    if (m.hp < m.maxHp || (near && (!canSense || canSense(m)))) {
      wakeMonster(m);
      woke.push(m);
    }
  }
  for (let i = 0; i < woke.length; i++) {
    const w = woke[i];
    for (const m of monsters) {
      if (!m.dormant || !m.isAlive) continue;
      if (Math.hypot(m.position.x - w.position.x, m.position.y - w.position.y) <= MONSTER_GROUP_WAKE_RADIUS) {
        wakeMonster(m);
        woke.push(m);
      }
    }
  }
  return woke;
}

/** Passo da patrulha de um adormecido: oscila devagar em torno de `home` (determinístico, sem RNG). */
export function stepDormantPatrol(monster: MonsterInstance, deltaMs: number, nowMs: number): void {
  const home = monster.home;
  if (!home || deltaMs <= 0) return;
  let h = 0;
  for (let i = 0; i < monster.instanceId.length; i++) h = (h * 31 + monster.instanceId.charCodeAt(i)) >>> 0;
  const phase = (h % 628) / 100;
  const t = nowMs / 1000;
  const tx = home.x + Math.cos(t * 0.45 + phase) * MONSTER_PATROL_RADIUS;
  const ty = home.y + Math.sin(t * 0.31 + phase * 1.3) * MONSTER_PATROL_RADIUS * 0.6;
  const dx = tx - monster.position.x;
  const dy = ty - monster.position.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.5) return;
  const step = Math.min(d, monster.moveSpeed * MONSTER_PATROL_SPEED * (deltaMs / 1000));
  monster.position.x += (dx / d) * step;
  monster.position.y += (dy / d) * step;
}
