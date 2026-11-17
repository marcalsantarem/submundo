import { describe, expect, it } from 'vitest';
import monstersData from '../../src/data/monsters.json';
import {
  calculateDamage,
  findNearestLivingMonster,
  tickCombat,
  triggerHeroSkill,
} from '../../src/core/combat/CombatEngine';
import {
  applyDamageToHero,
  createHero,
  DEFAULT_HERO_STATS,
  healHero,
  moveHero,
} from '../../src/core/entities/Hero';
import {
  applyDamageToMonster,
  spawnMonster,
} from '../../src/core/entities/Monster';
import type { MonsterDef } from '../../src/core/index';

const MONSTER_DEFS = monstersData as MonsterDef[];
const SLIME_DEF = MONSTER_DEFS.find((m) => m.id === 'abyssal_slime')!;
const SENTINEL_DEF = MONSTER_DEFS.find((m) => m.id === 'bone_sentinel')!;
const WARDEN_DEF = MONSTER_DEFS.find((m) => m.id === 'infernal_warden')!;

describe('Entities & CombatEngine (T-006)', () => {
  it('creates hero with DEFAULT_HERO_STATS and moves within room bounds', () => {
    const hero = createHero({ x: 100, y: 100 });
    expect(hero.stats).toEqual(DEFAULT_HERO_STATS);
    expect(hero.isAlive).toBe(true);
    expect(hero.potionCharges).toBe(3);

    // Move right for 1000ms at 140 px/s -> x = 240
    moveHero(hero, { x: 1, y: 0 }, 1000, { width: 800, height: 600, padding: 20 });
    expect(hero.position.x).toBeCloseTo(240);
    expect(hero.position.y).toBeCloseTo(100);
    expect(hero.facing).toEqual({ x: 1, y: 0 });

    // Clamp against upper/left bounds with padding
    moveHero(hero, { x: -1, y: -1 }, 5000, { width: 800, height: 600, padding: 20 });
    expect(hero.position.x).toBe(20);
    expect(hero.position.y).toBe(20);
  });

  it('calculates damage with defense mitigation and critical strike multiplier', () => {
    const normalHit = calculateDamage(18, 4, 0.1, 1.5, () => 0.99);
    expect(normalHit.isCrit).toBe(false);
    expect(normalHit.damage).toBe(14);

    const critHit = calculateDamage(18, 4, 0.1, 1.5, () => 0.01);
    expect(critHit.isCrit).toBe(true);
    // 18 * 1.5 = 27; 27 - 4 = 23
    expect(critHit.damage).toBe(23);
  });

  it('automatically attacks nearest living monster in range and respects cooldown', () => {
    const hero = createHero({ x: 200, y: 200 });
    const farSlime = spawnMonster(SLIME_DEF, 'slime_far', { x: 245, y: 200 });
    const nearSlime = spawnMonster(SLIME_DEF, 'slime_near', { x: 220, y: 200 });

    expect(
      findNearestLivingMonster(hero.position, [farSlime, nearSlime], hero.stats.attackRange)
        ?.instanceId
    ).toBe('slime_near');

    const events1 = tickCombat(hero, [farSlime, nearSlime], 16, 1000, () => 0.5);
    expect(events1.some((e) => e.type === 'hero_basic_attack' && e.targetId === 'slime_near')).toBe(
      true
    );
    // Hero attack 18 - Slime defense 2 = 16 -> 45 - 16 = 29 HP
    expect(nearSlime.hp).toBe(29);
    expect(farSlime.hp).toBe(45);

    // Next tick before 650ms cooldown expires should not trigger basic attack
    const events2 = tickCombat(hero, [farSlime, nearSlime], 16, 1300, () => 0.5);
    expect(events2.some((e) => e.type === 'hero_basic_attack')).toBe(false);

    // After 650ms cooldown (at 1650ms), attacks again
    const events3 = tickCombat(hero, [farSlime, nearSlime], 16, 1650, () => 0.5);
    expect(events3.some((e) => e.type === 'hero_basic_attack')).toBe(true);
    expect(nearSlime.hp).toBe(13);
  });

  it('triggers Spectral Dash (dash) with displacement, invulnerability, and cooldown', () => {
    const hero = createHero({ x: 200, y: 200 });
    const sentinel = spawnMonster(SENTINEL_DEF, 'sentinel_1', { x: 210, y: 200 });

    const dashEvents = triggerHeroSkill(hero, 'dash', [sentinel], 1000, {
      direction: { x: 1, y: 0 },
    });

    expect(dashEvents.some((e) => e.type === 'hero_dash')).toBe(true);
    expect(hero.position.x).toBeCloseTo(320); // 200 + 120 dashDistance
    expect(hero.invulnerableUntilMs).toBe(1350); // 1000 + 350ms

    // Damage during invulnerability window is ignored
    const dmgDuringDash = applyDamageToHero(hero, 30, 1200);
    expect(dmgDuringDash).toBe(0);
    expect(hero.stats.hp).toBe(120);

    // Cannot dash again while on 3000ms cooldown
    const onCooldownEvents = triggerHeroSkill(hero, 'dash', [sentinel], 2000);
    expect(onCooldownEvents).toHaveLength(0);
  });

  it('executes both AoE active skills (active_1 Crimson Cleave & active_2 Infernal Eruption)', () => {
    const hero = createHero({ x: 300, y: 300 });
    const m1 = spawnMonster(SLIME_DEF, 's1', { x: 350, y: 300 }); // dist 50 (in active_1 radius 80 & active_2 radius 130)
    const m2 = spawnMonster(SENTINEL_DEF, 's2', { x: 410, y: 300 }); // dist 110 (outside active_1, inside active_2)
    const m3 = spawnMonster(WARDEN_DEF, 'boss', { x: 500, y: 300 }); // dist 200 (outside both)

    // active_1: radius 80, mult 2.2 -> hits only m1
    const cleaveEvents = triggerHeroSkill(hero, 'active_1', [m1, m2, m3], 1000, {
      rng: () => 0.99,
    });
    expect(cleaveEvents.filter((e) => e.type === 'monster_damaged')).toHaveLength(1);
    // 18 * 2.2 = 39.6; 39.6 - 2 = 37.6 -> 38 damage -> 45 - 38 = 7 HP
    expect(m1.hp).toBe(7);
    expect(m2.hp).toBe(85);
    expect(m3.hp).toBe(420);

    // active_2: radius 130, mult 3.8 -> hits m1 (killing it) and m2, misses m3
    const eruptionEvents = triggerHeroSkill(hero, 'active_2', [m1, m2, m3], 1000, {
      rng: () => 0.99,
    });
    expect(eruptionEvents.filter((e) => e.type === 'monster_damaged')).toHaveLength(2);
    expect(eruptionEvents.some((e) => e.type === 'monster_killed' && e.targetId === 's1')).toBe(
      true
    );
    expect(m1.isAlive).toBe(false);
    expect(hero.souls).toBe(SLIME_DEF.soulReward);
    expect(m2.hp).toBeLessThan(85);
    expect(m3.hp).toBe(420);
  });

  it('consumes Soul Potion (potion) charges, heals 40% maxHp, and enforces cooldown/charge limit', () => {
    const hero = createHero({ x: 100, y: 100 });
    applyDamageToHero(hero, 74, 500); // 74 - 4 = 70 dmg -> 50 HP left
    expect(hero.stats.hp).toBe(50);

    const potionEvents = triggerHeroSkill(hero, 'potion', [], 1000);
    expect(potionEvents.some((e) => e.type === 'hero_healed' && e.value === 48)).toBe(true);
    expect(hero.stats.hp).toBe(98);
    expect(hero.potionCharges).toBe(2);

    // Cooldown prevents immediate reuse at 1500ms (cooldownMs = 2000)
    expect(triggerHeroSkill(hero, 'potion', [], 1500)).toHaveLength(0);

    // Exhaust remaining 2 charges
    triggerHeroSkill(hero, 'potion', [], 3500);
    triggerHeroSkill(hero, 'potion', [], 6000);
    expect(hero.potionCharges).toBe(0);

    // 4th attempt fails with 0 charges
    expect(triggerHeroSkill(hero, 'potion', [], 9000)).toHaveLength(0);

    // Direct healHero helper caps at maxHp
    expect(healHero(hero, 0.5)).toBe(0);
  });

  it('runs monster AI chase, monster attacks, soul collection on kill, and hero death', () => {
    const hero = createHero({ x: 100, y: 100 }, { hp: 25, maxHp: 120 });
    const slime = spawnMonster(SLIME_DEF, 'slime_killer', { x: 200, y: 100 });

    // Slime is at dist 100 (attackRange 32); after 500ms at 85px/s it moves 42.5px closer -> x = 157.5
    tickCombat(hero, [slime], 500, 500, () => 0.99);
    expect(slime.position.x).toBeCloseTo(157.5);
    expect(hero.stats.hp).toBe(25);

    // Move slime into attack range (1000ms -> reaches attackRange 32 at x = 132) and attacks hero
    const eventsAttack1 = tickCombat(hero, [slime], 1000, 1500, () => 0.99);
    expect(slime.position.x).toBeCloseTo(132);
    expect(eventsAttack1.some((e) => e.type === 'hero_damaged')).toBe(true);
    // Slime attack 9 - hero defense 4 = 5 dmg -> 20 HP left
    expect(hero.stats.hp).toBe(20);

    // Deal lethal damage to slime via applyDamageToMonster / tickCombat to verify soul collection
    applyDamageToMonster(slime, 20);
    expect(slime.hp).toBeGreaterThan(0);

    // Boss hits hero for lethal damage (24 attack - 4 defense = 20 damage -> 0 HP)
    const boss = spawnMonster(WARDEN_DEF, 'warden_1', { x: 120, y: 100 });
    const deathEvents = tickCombat(hero, [boss], 16, 3000, () => 0.99);
    expect(hero.stats.hp).toBe(0);
    expect(hero.isAlive).toBe(false);
    expect(deathEvents.some((e) => e.type === 'hero_killed')).toBe(true);
  });
});
