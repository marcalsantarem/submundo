import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../../src/core/dungeon/DungeonGenerator';
import { createHero, DEFAULT_HERO_STATS } from '../../src/core/entities/Hero';
import type { ItemInstance } from '../../src/core';
import {
  addItemToBag,
  applyGearToHero,
  computeGearBonuses,
  createRunInventory,
  equipItemFromBag,
  getActiveForces,
  getActiveLegendaryPowers,
  resolveRunEndLoot,
  unequipSlotToBag,
} from '../../src/core/loot/Inventory';
import {
  generateItemDrop,
  RARITY_COLORS,
  rollRarity,
  shouldDropLoot,
} from '../../src/core/loot/LootGenerator';

describe('LootGenerator & Run Inventory (T-017)', () => {
  it('guarantees src/core/loot/* has zero Phaser imports', () => {
    const genCode = readFileSync(
      resolve(process.cwd(), 'src/core/loot/LootGenerator.ts'),
      'utf-8'
    );
    const invCode = readFileSync(
      resolve(process.cwd(), 'src/core/loot/Inventory.ts'),
      'utf-8'
    );

    expect(genCode.toLowerCase()).not.toContain('phaser');
    expect(invCode.toLowerCase()).not.toContain('phaser');
  });

  it('defines canonical rarity colors for all 4 rarities', () => {
    expect(RARITY_COLORS).toEqual({
      common: '#e4e4e7',
      magic: '#38bdf8',
      rare: '#facc15',
      legendary: '#f97316',
    });
  });

  it('guarantees 100% loot drop for bosses and ~30% + luck for normal monsters', () => {
    for (let i = 0; i < 20; i++) {
      expect(shouldDropLoot(true, () => 0.999)).toBe(true);
    }

    expect(shouldDropLoot(false, () => 0.25, 0)).toBe(true);
    expect(shouldDropLoot(false, () => 0.35, 0)).toBe(false);
    expect(shouldDropLoot(false, () => 0.35, 0.1)).toBe(true);
  });

  it('rolls minimum rare (with legendary chance) for bosses and all 4 rarities for normal monsters', () => {
    const bossRng = createSeededRng(42);
    const bossRolls = Array.from({ length: 100 }, () =>
      rollRarity(bossRng, 0, true)
    );
    expect(bossRolls.every((r) => r === 'rare' || r === 'legendary')).toBe(
      true
    );
    expect(bossRolls.some((r) => r === 'legendary')).toBe(true);
    expect(bossRolls.some((r) => r === 'rare')).toBe(true);

    expect(rollRarity(() => 0.01, 0, false)).toBe('legendary');
    expect(rollRarity(() => 0.1, 0, false)).toBe('rare');
    expect(rollRarity(() => 0.35, 0, false)).toBe('magic');
    expect(rollRarity(() => 0.9, 0, false)).toBe('common');
  });

  it('generates drops with exact affix counts and legendary power per rarity', () => {
    const rng = createSeededRng(1001);

    const common = generateItemDrop({
      rng,
      forcedRarity: 'common',
      forcedSlot: 'weapon',
      idPrefix: 'drop',
    });
    expect(common.rarity).toBe('common');
    expect(common.slot).toBe('weapon');
    expect(common.instanceId.startsWith('drop_')).toBe(true);
    expect(common.affixes).toHaveLength(0);
    expect(common.legendaryPower).toBeUndefined();

    const magic = generateItemDrop({
      rng,
      forcedRarity: 'magic',
      forcedSlot: 'armor',
    });
    expect(magic.rarity).toBe('magic');
    expect(magic.slot).toBe('armor');
    expect(magic.affixes).toHaveLength(1);
    expect(magic.affixes[0].allowedSlots).toContain('armor');
    expect(magic.legendaryPower).toBeUndefined();

    const rareDrops = Array.from({ length: 12 }, () =>
      generateItemDrop({
        rng,
        forcedRarity: 'rare',
        forcedSlot: 'amulet',
      })
    );
    for (const rare of rareDrops) {
      expect(rare.affixes.length).toBeGreaterThanOrEqual(2);
      expect(rare.affixes.length).toBeLessThanOrEqual(3);
      const uniqueIds = new Set(rare.affixes.map((a) => a.id));
      expect(uniqueIds.size).toBe(rare.affixes.length);
      expect(rare.legendaryPower).toBeUndefined();
    }

    const legendary = generateItemDrop({
      rng,
      forcedRarity: 'legendary',
      forcedSlot: 'ring',
    });
    expect(legendary.rarity).toBe('legendary');
    expect(legendary.slot).toBe('ring');
    expect(legendary.affixes).toHaveLength(3);
    expect(new Set(legendary.affixes.map((a) => a.id)).size).toBe(3);
    expect(legendary.legendaryPower).toBeDefined();
    expect(legendary.powerScore).toBeGreaterThan(common.powerScore);
  });

  it('manages bag capacity, equipping, swapping and unequipping', () => {
    const inv = createRunInventory(2);
    const rng = createSeededRng(77);

    const weapon1 = generateItemDrop({
      rng,
      forcedRarity: 'magic',
      forcedSlot: 'weapon',
    });
    const weapon2 = generateItemDrop({
      rng,
      forcedRarity: 'rare',
      forcedSlot: 'weapon',
    });
    const armor1 = generateItemDrop({
      rng,
      forcedRarity: 'common',
      forcedSlot: 'armor',
    });

    expect(addItemToBag(inv, weapon1)).toBe(true);
    expect(addItemToBag(inv, weapon2)).toBe(true);
    expect(addItemToBag(inv, armor1)).toBe(false);

    const firstEquip = equipItemFromBag(inv, weapon1.instanceId);
    expect(firstEquip).toEqual({ equipped: weapon1, previous: null });
    expect(inv.equipped.weapon?.instanceId).toBe(weapon1.instanceId);
    expect(inv.bag).toHaveLength(1);

    const swapEquip = equipItemFromBag(inv, weapon2.instanceId);
    expect(swapEquip).toEqual({ equipped: weapon2, previous: weapon1 });
    expect(inv.equipped.weapon?.instanceId).toBe(weapon2.instanceId);
    expect(inv.bag).toHaveLength(1);
    expect(inv.bag[0].instanceId).toBe(weapon1.instanceId);

    expect(equipItemFromBag(inv, 'missing_id')).toBeNull();

    expect(unequipSlotToBag(inv, 'weapon')).toBe(true);
    expect(inv.equipped.weapon).toBeNull();
    expect(inv.bag).toHaveLength(2);
    expect(unequipSlotToBag(inv, 'armor')).toBe(false);
  });

  it('computes gear bonuses, active forces, legendary powers and clamps hero hp <= maxHp', () => {
    const inv = createRunInventory();
    const hero = createHero({ x: 100, y: 100 });
    const baseStats = { ...DEFAULT_HERO_STATS };

    const infernoWeapon: ItemInstance = {
      instanceId: 'w_1',
      defId: 'cinder_greatsword',
      name: 'Montante das Cinzas',
      slot: 'weapon',
      rarity: 'legendary',
      force: 'inferno',
      baseBonuses: { attack: 10, critChance: 0.05 },
      affixes: [
        {
          id: 'af1',
          name: 'da Pira',
          force: 'inferno',
          allowedSlots: ['weapon'],
          minRarity: 'rare',
          bonuses: { attack: 5, critMultiplier: 0.2 },
          description: '+5 ATQ',
        },
      ],
      legendaryPower: {
        id: 'inferno_dash_trail',
        name: 'Rastro das Cinzas',
        force: 'inferno',
        description: 'Dash deixa fogo',
      },
      iconKey: 'icon_weapon',
      powerScore: 150,
    };

    const submundoArmor: ItemInstance = {
      instanceId: 'a_1',
      defId: 'bloodbound_mail',
      name: 'Malha Sanguínea',
      slot: 'armor',
      rarity: 'magic',
      force: 'submundo',
      baseBonuses: { maxHp: 40, defense: 4, lifeSteal: 0.03 },
      affixes: [],
      iconKey: 'icon_armor',
      powerScore: 60,
    };

    addItemToBag(inv, infernoWeapon);
    addItemToBag(inv, submundoArmor);
    equipItemFromBag(inv, infernoWeapon.instanceId);
    equipItemFromBag(inv, submundoArmor.instanceId);

    const bonuses = computeGearBonuses(inv.equipped);
    expect(bonuses.attack).toBe(15);
    expect(bonuses.maxHp).toBe(40);
    expect(bonuses.defense).toBe(4);
    expect(bonuses.critChance).toBe(0.05);
    expect(bonuses.critMultiplier).toBe(0.2);
    expect(bonuses.lifeSteal).toBe(0.03);

    expect(getActiveForces(inv.equipped)).toEqual({
      inferno: 1,
      submundo: 1,
      empireo: 0,
    });
    expect(getActiveLegendaryPowers(inv.equipped)).toEqual([
      'inferno_dash_trail',
    ]);

    const updatedStats = applyGearToHero(hero, baseStats, inv.equipped);
    expect(updatedStats.maxHp).toBe(DEFAULT_HERO_STATS.maxHp + 40);
    expect(updatedStats.attack).toBe(DEFAULT_HERO_STATS.attack + 15);
    expect(updatedStats.defense).toBe(DEFAULT_HERO_STATS.defense + 4);
    expect(hero.stats.hp).toBe(DEFAULT_HERO_STATS.hp);

    // Simula cura ate o novo maximo e depois desequipa a armadura para validar hp <= maxHp
    hero.stats.hp = updatedStats.maxHp;
    unequipSlotToBag(inv, 'armor');
    const afterUnequip = applyGearToHero(hero, baseStats, inv.equipped);
    expect(afterUnequip.maxHp).toBe(DEFAULT_HERO_STATS.maxHp);
    expect(afterUnequip.hp).toBe(afterUnequip.maxHp);
  });

  it('extracts all items on victory and loses all run items on death while preserving souls', () => {
    const rng = createSeededRng(2026);
    const hero = createHero();
    hero.souls = 75;

    const victoryInv = createRunInventory();
    const w = generateItemDrop({ rng, forcedRarity: 'rare', forcedSlot: 'weapon' });
    const r = generateItemDrop({ rng, forcedRarity: 'magic', forcedSlot: 'ring' });
    addItemToBag(victoryInv, w);
    addItemToBag(victoryInv, r);
    equipItemFromBag(victoryInv, w.instanceId);

    const winResult = resolveRunEndLoot(victoryInv, true);
    expect(winResult.lost).toHaveLength(0);
    expect(winResult.kept.map((i) => i.instanceId)).toEqual([
      w.instanceId,
      r.instanceId,
    ]);
    expect(victoryInv.extractedItems).toHaveLength(2);

    const deathInv = createRunInventory();
    const dw = generateItemDrop({
      rng,
      forcedRarity: 'legendary',
      forcedSlot: 'weapon',
    });
    const da = generateItemDrop({
      rng,
      forcedRarity: 'common',
      forcedSlot: 'amulet',
    });
    addItemToBag(deathInv, dw);
    addItemToBag(deathInv, da);
    equipItemFromBag(deathInv, dw.instanceId);

    const lossResult = resolveRunEndLoot(deathInv, false);
    expect(lossResult.kept).toHaveLength(0);
    expect(lossResult.lost.map((i) => i.instanceId)).toEqual([
      dw.instanceId,
      da.instanceId,
    ]);
    expect(deathInv.lostItemsOnDeath).toHaveLength(2);
    expect(deathInv.equipped).toEqual({
      weapon: null,
      armor: null,
      amulet: null,
      ring: null,
    });
    expect(deathInv.bag).toHaveLength(0);
    expect(hero.souls).toBe(75);
  });
});
