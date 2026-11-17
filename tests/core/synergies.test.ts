import { describe, expect, it } from 'vitest';
import monstersData from '../../src/data/monsters.json';
import { tickCombat, triggerHeroSkill } from '../../src/core/combat/CombatEngine';
import { createHero } from '../../src/core/entities/Hero';
import { spawnMonster } from '../../src/core/entities/Monster';
import type { MonsterDef } from '../../src/core/index';

const MONSTER_DEFS = monstersData as MonsterDef[];
const SLIME_DEF = MONSTER_DEFS.find((m) => m.id === 'abyssal_slime')!;
const SENTINEL_DEF = MONSTER_DEFS.find((m) => m.id === 'bone_sentinel')!;
const WARDEN_DEF = MONSTER_DEFS.find((m) => m.id === 'infernal_warden')!;

describe('3 Forces Synergies & Legendary Powers (T-018)', () => {
  it('initializes new M2 hero and monster defaults safely', () => {
    const hero = createHero({ x: 100, y: 100 });
    expect(hero.baseStats).toEqual(hero.stats);
    expect(hero.lifeSteal).toBe(0);
    expect(hero.cooldownReduction).toBe(0);
    expect(hero.luck).toBe(0);
    expect(hero.equippedForces).toEqual({ inferno: 0, submundo: 0, empireo: 0 });
    expect(hero.activeLegendaryPowers).toEqual([]);
    expect(hero.minions).toEqual([]);

    const monster = spawnMonster(SLIME_DEF, 'm1', { x: 150, y: 100 });
    expect(monster.emberStacks).toBe(0);
    expect(monster.bleedUntilMs).toBe(0);
    expect(monster.bleedDps).toBe(0);
    expect(monster.lastBleedTickAtMs).toBe(0);
    expect(monster.stunnedUntilMs).toBe(0);
  });

  it('Inferno: builds 5 ember stacks and triggers ember_explosion within 90px (or 130px with inferno_ember_nova)', () => {
    const hero = createHero({ x: 200, y: 200 }, { attack: 20, critChance: 0 });
    hero.equippedForces.inferno = 1;

    // Tanky boss with 4 stacks already, plus nearby inside 90px, mid at 115px, far at 200px
    const boss = spawnMonster({ ...WARDEN_DEF, maxHp: 500, defense: 0 }, 'boss', { x: 220, y: 200 });
    const near = spawnMonster({ ...SENTINEL_DEF, maxHp: 200, defense: 0 }, 'near', { x: 290, y: 200 }); // 70px from boss
    const mid = spawnMonster({ ...SENTINEL_DEF, maxHp: 200, defense: 0 }, 'mid', { x: 335, y: 200 }); // 115px from boss
    const far = spawnMonster({ ...SENTINEL_DEF, maxHp: 200, defense: 0 }, 'far', { x: 420, y: 200 }); // 200px from boss

    // Apply 4 stacks via basic attacks
    for (let i = 0; i < 4; i++) {
      const ev = tickCombat(hero, [boss], 16, 1000 + i * 700, () => 0.99);
      expect(ev.some((e) => e.type === 'ember_applied')).toBe(true);
      expect(ev.some((e) => e.type === 'ember_explosion')).toBe(false);
    }
    expect(boss.emberStacks).toBe(4);

    // 5th stack triggers explosion: radius 90, dmg round(20 * 1.8) = 36
    const hpBossBefore5th = boss.hp;
    const ev5 = tickCombat(hero, [boss, near, mid, far], 16, 4000, () => 0.99);
    expect(ev5.some((e) => e.type === 'ember_explosion')).toBe(true);
    expect(boss.emberStacks).toBe(0);
    expect(boss.hp).toBe(hpBossBefore5th - 20 - 36);
    expect(near.hp).toBe(200 - 36);
    expect(mid.hp).toBe(200);
    expect(far.hp).toBe(200);

    // Now test inferno_ember_nova: radius 130, dmg round(20 * 2.6) = 52
    hero.activeLegendaryPowers.push('inferno_ember_nova');
    boss.emberStacks = 4;
    const nearHpBeforeNova = near.hp;
    const novaEvents = tickCombat(hero, [boss, near, mid, far], 16, 5000, () => 0.99);
    expect(novaEvents.some((e) => e.type === 'ember_explosion')).toBe(true);
    expect(near.hp).toBe(nearHpBeforeNova - 52);
    expect(mid.hp).toBe(200 - 52);
    expect(far.hp).toBe(200);
  });

  it('Inferno: inferno_dash_trail applies ember to monsters within 90px of the dash path', () => {
    const hero = createHero({ x: 100, y: 100 });
    hero.activeLegendaryPowers.push('inferno_dash_trail');

    const alongPath = spawnMonster(SLIME_DEF, 'along', { x: 160, y: 150 }); // 50px from segment
    const farAway = spawnMonster(SLIME_DEF, 'far', { x: 160, y: 260 }); // 160px from segment

    const dashEvents = triggerHeroSkill(hero, 'dash', [alongPath, farAway], 1000, {
      direction: { x: 1, y: 0 },
    });

    expect(dashEvents.some((e) => e.type === 'hero_dash')).toBe(true);
    expect(dashEvents.some((e) => e.type === 'ember_applied' && e.targetId === 'along')).toBe(true);
    expect(alongPath.emberStacks).toBe(1);
    expect(farAway.emberStacks).toBe(0);
  });

  it('Submundo: applies 3s bleed ticking every 500ms, heals via lifeSteal, and doubles lifeSteal with submundo_crimson_pact', () => {
    const hero = createHero({ x: 200, y: 200 }, { hp: 50, maxHp: 120, attack: 20, critChance: 0 });
    hero.lifeSteal = 0.1;

    const target = spawnMonster({ ...SENTINEL_DEF, maxHp: 200, defense: 0, attack: 0 }, 's1', { x: 230, y: 200 });

    // Non-bleeding target -> normal 10% lifeSteal on basic attack (20 dmg -> 2 heal)
    const hit1 = tickCombat(hero, [target], 16, 1000, () => 0.99);
    expect(hit1.some((e) => e.type === 'lifesteal_heal' && e.value === 2)).toBe(true);
    expect(hero.stats.hp).toBe(52);
    expect(target.bleedDps).toBe(0);

    // Use crimson_cleave (submundo) -> applies bleedDps = max(4, round(20 * 0.4)) = 8 for 3s
    hero.activeLegendaryPowers.push('submundo_crimson_pact');
    const skillEvents = triggerHeroSkill(hero, 'active_1', [target], 2000, { rng: () => 0.99 });
    expect(target.bleedDps).toBe(8);
    expect(target.bleedUntilMs).toBe(5000);
    // crimson_cleave deals 20 * 2.2 = 44 dmg; with crimson_pact on bleeding target -> 20% lifeSteal = 9 heal
    expect(skillEvents.some((e) => e.type === 'lifesteal_heal' && e.value === 9)).toBe(true);
    expect(hero.stats.hp).toBe(61);

    // Tick at 2500ms -> bleed_tick fires (8 * 0.5 = 4 dmg)
    hero.basicAttackReadyAtMs = 3000;
    const hpBeforeBleed = target.hp;
    const tick2500 = tickCombat(hero, [target], 16, 2500, () => 0.99);
    expect(tick2500.some((e) => e.type === 'bleed_tick' && e.value === 4)).toBe(true);
    expect(target.hp).toBe(hpBeforeBleed - 4);

    // Tick at 5500ms -> finishes remaining bleed ticks up to 5000ms and expires bleedDps
    tickCombat(hero, [target], 16, 5500, () => 0.99);
    expect(target.bleedDps).toBe(0);
  });

  it('Submundo: submundo_bleed_minion spawns SpectralMinion (25% chance) that chases, attacks, and expires after 12s', () => {
    const hero = createHero({ x: 100, y: 100 }, { attack: 25, critChance: 0 });
    hero.equippedForces.submundo = 1;
    hero.activeLegendaryPowers.push('submundo_bleed_minion');

    const dyingMonster = spawnMonster({ ...SLIME_DEF, maxHp: 15, defense: 0 }, 'm_die', { x: 130, y: 100 });
    const nextMonster = spawnMonster({ ...WARDEN_DEF, maxHp: 300, defense: 0 }, 'm_next', { x: 250, y: 100 });

    // rng = 0.1 (< 0.25) triggers minion spawn on bleeding monster kill
    const killEvents = tickCombat(hero, [dyingMonster, nextMonster], 16, 1000, () => 0.1);
    expect(killEvents.some((e) => e.type === 'monster_killed' && e.targetId === 'm_die')).toBe(true);
    expect(killEvents.some((e) => e.type === 'minion_spawned')).toBe(true);
    expect(hero.minions).toHaveLength(1);
    expect(hero.minions[0].expiresAtMs).toBe(13000);

    // Advance 1000ms -> minion moves from 130 toward 250 and reaches/attacks nextMonster
    const hpBeforeMinion = nextMonster.hp;
    const minionTick = tickCombat(hero, [dyingMonster, nextMonster], 1000, 2000, () => 0.99);
    expect(minionTick.some((e) => e.type === 'minion_attack')).toBe(true);
    expect(nextMonster.hp).toBeLessThan(hpBeforeMinion);

    // After 12s (at 13000ms), minion expires
    tickCombat(hero, [dyingMonster, nextMonster], 16, 13000, () => 0.99);
    expect(hero.minions).toHaveLength(0);
  });

  it('Empíreo: critical hits trigger lightning_chain up to 2 nearby monsters within 160px, stun for 600ms, and reduce cooldowns with empireo_judgment_haste', () => {
    const hero = createHero({ x: 200, y: 200 }, { attack: 20, critChance: 1.0, hp: 200, maxHp: 200 });
    hero.equippedForces.empireo = 1;
    hero.activeLegendaryPowers.push('empireo_judgment_haste');

    // Put active_1 on cooldown (ready at 7000)
    triggerHeroSkill(hero, 'active_1', [], 1000);
    expect(hero.skillReadyAtMs.active_1).toBe(7000);

    const primary = spawnMonster({ ...SENTINEL_DEF, maxHp: 200, defense: 0 }, 'p1', { x: 230, y: 200 });
    const near1 = spawnMonster({ ...SENTINEL_DEF, maxHp: 200, defense: 0, attackRange: 100 }, 'n1', { x: 280, y: 200 }); // 50px from primary
    const near2 = spawnMonster({ ...SENTINEL_DEF, maxHp: 200, defense: 0, attackRange: 100 }, 'n2', { x: 330, y: 200 }); // 100px from primary
    const third = spawnMonster({ ...SENTINEL_DEF, maxHp: 200, defense: 0 }, 'n3', { x: 370, y: 200 }); // 140px (3rd closest -> skipped)
    const outRange = spawnMonster({ ...SENTINEL_DEF, maxHp: 200, defense: 0 }, 'out', { x: 450, y: 200 }); // 220px (> 160px)

    const critEvents = tickCombat(
      hero,
      [primary, near1, near2, third, outRange],
      16,
      1000,
      () => 0.01
    );

    const chainEvent = critEvents.find((e) => e.type === 'lightning_chain');
    expect(chainEvent).toBeDefined();
    expect(chainEvent?.chainTargets).toHaveLength(2);
    expect(critEvents.filter((e) => e.type === 'status_stun')).toHaveLength(2);

    // lightning dmg = round(20 * 0.9) = 18
    expect(near1.hp).toBe(200 - 18);
    expect(near2.hp).toBe(200 - 18);
    expect(third.hp).toBe(200);
    expect(outRange.hp).toBe(200);
    expect(near1.stunnedUntilMs).toBe(1600);

    // empireo_judgment_haste reduced active_1 ready time by 500ms (7000 -> 6500)
    expect(hero.skillReadyAtMs.active_1).toBe(6500);
    expect(hero.skillReadyAtMs.crimson_cleave).toBe(6500);

    // While stunned (at 1300ms < 1600ms), near1 cannot move or attack hero
    const near1PosBefore = { ...near1.position };
    const heroHpBefore = hero.stats.hp;
    tickCombat(hero, [near1], 300, 1300, () => 0.99);
    expect(near1.position).toEqual(near1PosBefore);
    expect(hero.stats.hp).toBe(heroHpBefore);

    // After stun expires (at 1600ms), near1 resumes attacking
    const postStun = tickCombat(hero, [near1], 100, 1600, () => 0.99);
    expect(postStun.some((e) => e.type === 'hero_damaged')).toBe(true);
  });

  it('applies hero.cooldownReduction in triggerHeroSkill capped at 0.45', () => {
    const hero = createHero({ x: 100, y: 100 });
    hero.cooldownReduction = 0.25;

    // active_1 base cooldown = 6000ms -> 6000 * 0.75 = 4500ms
    triggerHeroSkill(hero, 'active_1', [], 1000);
    expect(hero.skillReadyAtMs.active_1).toBe(5500);

    // Cap at 0.45 even if cooldownReduction is 0.9: active_2 base = 14000 -> 14000 * 0.55 = 7700ms
    hero.cooldownReduction = 0.9;
    triggerHeroSkill(hero, 'active_2', [], 1000);
    expect(hero.skillReadyAtMs.active_2).toBe(8700);
  });
});
