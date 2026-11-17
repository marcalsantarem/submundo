import type { HeroStats, LegendaryPowerId, Vector2D } from '../index';

export const DEFAULT_HERO_STATS: HeroStats = {
  maxHp: 120,
  hp: 120,
  attack: 18,
  defense: 4,
  moveSpeed: 140,
  attackRange: 52,
  attackCooldownMs: 650,
  critChance: 0.1,
  critMultiplier: 1.5,
};

export interface SpectralMinion {
  id: string;
  position: Vector2D;
  attack: number;
  attackRange: number;
  attackCooldownMs: number;
  nextAttackAtMs: number;
  expiresAtMs: number;
}

export interface HeroState {
  id: string;
  name: string;
  position: Vector2D;
  facing: Vector2D;
  baseStats: HeroStats;
  stats: HeroStats;
  souls: number;
  potionCharges: number;
  maxPotionCharges: number;
  invulnerableUntilMs: number;
  basicAttackReadyAtMs: number;
  skillReadyAtMs: Record<string, number>;
  lifeSteal: number;
  cooldownReduction: number;
  luck: number;
  equippedForces: Record<'inferno' | 'submundo' | 'empireo', number>;
  activeLegendaryPowers: LegendaryPowerId[];
  minions: SpectralMinion[];
  isAlive: boolean;
}

export function createHero(
  initialPos: Vector2D = { x: 400, y: 300 },
  overrides?: Partial<HeroStats>
): HeroState {
  const maxHp = overrides?.maxHp ?? DEFAULT_HERO_STATS.maxHp;
  const hp = overrides?.hp ?? maxHp;
  const stats: HeroStats = {
    ...DEFAULT_HERO_STATS,
    ...overrides,
    maxHp,
    hp,
  };

  return {
    id: 'hero',
    name: 'Guerreiro Espectral',
    position: { x: initialPos.x, y: initialPos.y },
    facing: { x: 1, y: 0 },
    baseStats: { ...stats },
    stats,
    souls: 0,
    potionCharges: 3,
    maxPotionCharges: 3,
    invulnerableUntilMs: 0,
    basicAttackReadyAtMs: 0,
    skillReadyAtMs: {},
    lifeSteal: 0,
    cooldownReduction: 0,
    luck: 0,
    equippedForces: {
      inferno: 0,
      submundo: 0,
      empireo: 0,
    },
    activeLegendaryPowers: [],
    minions: [],
    isAlive: stats.hp > 0,
  };
}

export function moveHero(
  hero: HeroState,
  dir: Vector2D,
  deltaMs: number,
  bounds: { width: number; height: number; padding?: number }
): void {
  if (!hero.isAlive || deltaMs <= 0) {
    return;
  }

  const length = Math.hypot(dir.x, dir.y);
  if (length === 0) {
    return;
  }

  const nx = dir.x / length;
  const ny = dir.y / length;
  hero.facing = { x: nx, y: ny };

  const distance = hero.stats.moveSpeed * (deltaMs / 1000);
  const pad = bounds.padding ?? 0;
  const minX = pad;
  const maxX = Math.max(pad, bounds.width - pad);
  const minY = pad;
  const maxY = Math.max(pad, bounds.height - pad);

  const nextX = hero.position.x + nx * distance;
  const nextY = hero.position.y + ny * distance;

  hero.position.x = Math.min(maxX, Math.max(minX, nextX));
  hero.position.y = Math.min(maxY, Math.max(minY, nextY));
}

export function healHero(hero: HeroState, percent: number): number {
  if (!hero.isAlive || percent <= 0) {
    return 0;
  }

  const amount = Math.round(hero.stats.maxHp * percent);
  const previousHp = hero.stats.hp;
  hero.stats.hp = Math.min(hero.stats.maxHp, hero.stats.hp + amount);
  return hero.stats.hp - previousHp;
}

export function applyDamageToHero(
  hero: HeroState,
  rawDamage: number,
  nowMs: number
): number {
  if (!hero.isAlive || rawDamage <= 0 || nowMs < hero.invulnerableUntilMs) {
    return 0;
  }

  const finalDamage = Math.max(1, Math.round(rawDamage - hero.stats.defense));
  hero.stats.hp = Math.max(0, hero.stats.hp - finalDamage);

  if (hero.stats.hp <= 0) {
    hero.stats.hp = 0;
    hero.isAlive = false;
  }

  return finalDamage;
}
