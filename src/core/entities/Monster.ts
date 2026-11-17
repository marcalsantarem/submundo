import type { MonsterDef, MonsterType, Vector2D } from '../index';

export interface MonsterInstance {
  instanceId: string;
  defId: string;
  name: string;
  type: MonsterType;
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
