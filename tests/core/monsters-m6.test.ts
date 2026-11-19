import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import monstersData from '../../src/data/monsters.json';
import { tickCombat } from '../../src/core/combat/CombatEngine';
import { createHero } from '../../src/core/entities/Hero';
import { spawnMonster } from '../../src/core/entities/Monster';
import type { MonsterDef } from '../../src/core/index';

const MONSTER_DEFS = monstersData as MonsterDef[];

function getMonsterDef(id: string): MonsterDef {
  const found = MONSTER_DEFS.find((monster) => monster.id === id);
  if (!found) {
    throw new Error(`MonsterDef not found: ${id}`);
  }
  return found;
}

describe('M6 Common Monsters Catalog & Ranged Combat (T-093a)', () => {
  it('contains all 5 M6 common monsters and preserves the 4 legacy monsters', () => {
    const ids = MONSTER_DEFS.map((m) => m.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'slime',
        'cave_bat',
        'wolf',
        'skeleton',
        'skeleton_archer',
        'abyssal_slime',
        'bone_sentinel',
        'infernal_warden',
        'abyss_herald',
      ])
    );

    const expectedNames: Record<string, string> = {
      slime: 'Slime',
      cave_bat: 'Morcego',
      wolf: 'Lobo',
      skeleton: 'Esqueleto',
      skeleton_archer: 'Esqueleto Arqueiro',
    };

    for (const [id, expectedName] of Object.entries(expectedNames)) {
      const def = getMonsterDef(id);
      expect(def.name).toBe(expectedName);
      expect(def.type).toBe('normal');
      expect(def.spriteKey).toBe(id);
    }
  });

  it('enforces stat relationships across the 5 M6 monsters', () => {
    const slime = getMonsterDef('slime');
    const caveBat = getMonsterDef('cave_bat');
    const wolf = getMonsterDef('wolf');
    const skeleton = getMonsterDef('skeleton');
    const skeletonArcher = getMonsterDef('skeleton_archer');

    // Wolf is faster and tougher than Slime
    expect(wolf.maxHp).toBeGreaterThan(slime.maxHp);
    expect(wolf.moveSpeed).toBeGreaterThan(slime.moveSpeed);
    expect(wolf.attack).toBeGreaterThan(slime.attack);

    // Cave Bat is the fastest and most fragile
    expect(caveBat.moveSpeed).toBeGreaterThan(wolf.moveSpeed);
    expect(caveBat.maxHp).toBeLessThan(slime.maxHp);

    // Skeleton is the toughest melee common monster
    expect(skeleton.maxHp).toBeGreaterThan(wolf.maxHp);
    expect(skeleton.defense).toBeGreaterThan(wolf.defense);

    // Skeleton Archer is ranged and fragile
    expect(skeletonArcher.attackType).toBe('ranged');
    expect(skeletonArcher.attackRange).toBe(210);
    expect(skeletonArcher.attackRange).toBeGreaterThan(skeleton.attackRange);
    expect(skeletonArcher.maxHp).toBeLessThan(slime.maxHp);
    expect(skeletonArcher.defense).toBeLessThanOrEqual(2);
  });

  it('contains M6 bosses wolf_alpha and karnak with expected boss stats (T-098a)', () => {
    const wolf = getMonsterDef('wolf');
    const wolfAlpha = getMonsterDef('wolf_alpha');
    const karnak = getMonsterDef('karnak');

    expect(wolfAlpha.name).toBe('Chefe da Matilha');
    expect(wolfAlpha.type).toBe('boss');
    expect(wolfAlpha.attackType).toBe('melee');
    expect(wolfAlpha.spriteKey).toBe('wolf_alpha');
    expect(wolfAlpha.maxHp).toBeGreaterThan(wolf.maxHp);
    expect(wolfAlpha.attack).toBeGreaterThan(wolf.attack);
    expect(wolfAlpha.defense).toBeGreaterThan(wolf.defense);
    expect(wolfAlpha.soulReward).toBe(60);

    expect(karnak.name).toBe('Karnak');
    expect(karnak.type).toBe('boss');
    expect(karnak.attackType).toBe('melee');
    expect(karnak.spriteKey).toBe('karnak');
    expect(karnak.maxHp).toBeGreaterThanOrEqual(9999);
    expect(karnak.defense).toBeGreaterThanOrEqual(999);
    expect(karnak.soulReward).toBe(0);
  });

  it('contains M6 boss skeleton_chief with expected stats (T-102a)', () => {
    const skeletonChief = getMonsterDef('skeleton_chief');

    expect(skeletonChief.name).toBe('Esqueleto Chefe');
    expect(skeletonChief.type).toBe('boss');
    expect(skeletonChief.attackType).toBe('melee');
    expect(skeletonChief.spriteKey).toBe('skeleton_chief');
    expect(skeletonChief.maxHp).toBe(175);
    expect(skeletonChief.attack).toBe(14);
    expect(skeletonChief.defense).toBe(5);
    expect(skeletonChief.moveSpeed).toBe(105);
    expect(skeletonChief.attackRange).toBe(46);
    expect(skeletonChief.attackCooldownMs).toBe(1100);
    expect(skeletonChief.soulReward).toBe(55);
  });

  it('propagates attackType on spawnMonster with melee fallback', () => {
    const archer = spawnMonster(getMonsterDef('skeleton_archer'), 'archer_1', { x: 0, y: 0 });
    expect(archer.attackType).toBe('ranged');

    const legacyLikeDef: MonsterDef = {
      ...getMonsterDef('slime'),
      id: 'legacy_test',
    };
    delete legacyLikeDef.attackType;

    const legacyInstance = spawnMonster(legacyLikeDef, 'legacy_1', { x: 0, y: 0 });
    expect(legacyInstance.attackType).toBe('melee');
  });

  it('allows skeleton_archer to attack from ranged distance without closing into melee', () => {
    const hero = createHero({ x: 100, y: 100 });
    const archer = spawnMonster(getMonsterDef('skeleton_archer'), 'archer_1', {
      x: 280, // 180px away (within 210px attackRange, outside melee)
      y: 100,
    });

    const events = tickCombat(hero, [archer], 1000, 16);
    expect(archer.position.x).toBe(280);
    expect(events.some((e) => e.type === 'hero_damaged' && e.sourceId === 'archer_1')).toBe(true);
    expect(hero.stats.hp).toBeLessThan(hero.stats.maxHp);

    // When out of range (250px away), stops at 210px instead of chasing to melee range
    const hero2 = createHero({ x: 100, y: 100 });
    const farArcher = spawnMonster(getMonsterDef('skeleton_archer'), 'archer_2', {
      x: 350,
      y: 100,
    });

    tickCombat(hero2, [farArcher], 1000, 1000);
    expect(farArcher.position.x).toBeCloseTo(310); // 100 + 210
  });

  it('has zero Phaser imports anywhere in src/core/', () => {
    const coreDir = path.resolve(process.cwd(), 'src/core');
    const stack = [coreDir];
    const tsFiles: string[] = [];

    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
        } else if (entry.name.endsWith('.ts')) {
          tsFiles.push(fullPath);
        }
      }
    }

    expect(tsFiles.length).toBeGreaterThan(0);
    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toMatch(/from\s+['"]phaser['"]/i);
    }
  });
});
