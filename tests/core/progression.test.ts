import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../../src/core/dungeon/DungeonGenerator';
import { DEFAULT_HERO_STATS } from '../../src/core/entities/Hero';
import type { ItemInstance } from '../../src/core';
import { generateItemDrop } from '../../src/core/loot/LootGenerator';
import {
  applyRunOutcomeToProfile,
  buildHeroFromProfile,
  computeAltarBonuses,
  createDefaultProfile,
  DEFAULT_MAX_STASH_SIZE,
  DEFAULT_PROFILE_VERSION,
  equipStashItem,
  forgeItemWithBlacksmith,
  getAltarUpgradeCost,
  getBlacksmithUpgradeCost,
  getItemUpgradeLevel,
  getProgressionCatalog,
  loadOrCreateProfile,
  persistProfile,
  purchaseAltarUpgrade,
  unequipProfileSlot,
  upgradeItemWithBlacksmith,
} from '../../src/core/progression/ProfileManager';
import {
  SAVE_STORAGE_KEY,
  type StorageLike,
} from '../../src/core/progression/StorageAdapter';

function createMemoryStorageMock(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

describe('ProfileManager & Permanent Progression (T-033)', () => {
  it('guarantees src/core/progression/* has zero Phaser imports', () => {
    const profileCode = readFileSync(
      resolve(process.cwd(), 'src/core/progression/ProfileManager.ts'),
      'utf-8'
    );
    const storageCode = readFileSync(
      resolve(process.cwd(), 'src/core/progression/StorageAdapter.ts'),
      'utf-8'
    );

    expect(profileCode.toLowerCase()).not.toContain('phaser');
    expect(storageCode.toLowerCase()).not.toContain('phaser');
  });

  it('creates default profile and persists/loads via StorageAdapter', () => {
    const storage = createMemoryStorageMock();
    const created = loadOrCreateProfile(storage);

    expect(created.version).toBe(DEFAULT_PROFILE_VERSION);
    expect(created.maxStashSize).toBe(DEFAULT_MAX_STASH_SIZE);
    expect(created.souls).toBe(0);
    expect(created.generalEssences).toBe(0);
    expect(created.altarLevels).toEqual({
      vitality: 0,
      might: 0,
      bastion: 0,
      swiftness: 0,
      fortune: 0,
    });
    expect(storage.getItem(SAVE_STORAGE_KEY)).not.toBeNull();

    created.souls = 250;
    created.generalEssences = 2;
    created.stats.runsCompleted = 1;
    expect(persistProfile(created, storage)).toBe(true);

    const reloaded = loadOrCreateProfile(storage);
    expect(reloaded.souls).toBe(250);
    expect(reloaded.generalEssences).toBe(2);
    expect(reloaded.stats.runsCompleted).toBe(1);

    storage.setItem(SAVE_STORAGE_KEY, '{invalid-json');
    const recovered = loadOrCreateProfile(storage);
    expect(recovered).toEqual(createDefaultProfile());
  });

  it('handles Altar upgrade purchases, cost scaling, bonuses, and Hero building', () => {
    const catalog = getProgressionCatalog();
    const vitalityDef = catalog.altarUpgrades.find((u) => u.id === 'vitality')!;
    expect(getAltarUpgradeCost(vitalityDef, 0)).toBe(30);
    expect(getAltarUpgradeCost(vitalityDef, 1)).toBe(48);
    expect(getAltarUpgradeCost(vitalityDef, vitalityDef.maxLevel)).toBe(Infinity);

    const profile = createDefaultProfile();
    profile.souls = 20;
    const tooPoor = purchaseAltarUpgrade(profile, 'vitality', catalog);
    expect(tooPoor.ok).toBe(false);
    expect(tooPoor.newLevel).toBe(0);
    expect(profile.souls).toBe(20);

    profile.souls = 500;
    const vit1 = purchaseAltarUpgrade(profile, 'vitality', catalog);
    expect(vit1).toEqual({ ok: true, newLevel: 1, cost: 30 });
    const vit2 = purchaseAltarUpgrade(profile, 'vitality', catalog);
    expect(vit2).toEqual({ ok: true, newLevel: 2, cost: 48 });
    const might1 = purchaseAltarUpgrade(profile, 'might', catalog);
    expect(might1).toEqual({ ok: true, newLevel: 1, cost: 35 });
    const swift1 = purchaseAltarUpgrade(profile, 'swiftness', catalog);
    expect(swift1).toEqual({ ok: true, newLevel: 1, cost: 40 });
    const fort1 = purchaseAltarUpgrade(profile, 'fortune', catalog);
    expect(fort1).toEqual({ ok: true, newLevel: 1, cost: 40 });

    const altarBonuses = computeAltarBonuses(profile, catalog);
    expect(altarBonuses.maxHp).toBe(40);
    expect(altarBonuses.attack).toBe(3);
    expect(altarBonuses.moveSpeed).toBe(8);
    expect(altarBonuses.cooldownReduction).toBe(0.02);
    expect(altarBonuses.critChance).toBe(0.02);
    expect(altarBonuses.luck).toBe(0.05);

    const legendaryWeapon: ItemInstance = {
      instanceId: 'hub_wpn_1',
      defId: 'wpn_test',
      name: 'Espada do Abismo',
      slot: 'weapon',
      rarity: 'legendary',
      force: 'submundo',
      baseBonuses: { attack: 10, maxHp: 25, lifeSteal: 0.05 },
      affixes: [
        {
          id: 'af_cdr',
          name: 'da Pressa',
          force: 'empireo',
          allowedSlots: ['weapon'],
          minRarity: 'magic',
          bonuses: { cooldownReduction: 0.08, luck: 0.1 },
          description: '+8% CDR, +10% Sorte',
        },
      ],
      legendaryPower: {
        id: 'submundo_crimson_pact',
        name: 'Pacto Carmesim',
        force: 'submundo',
        description: 'Dobra roubo de vida contra alvos sangrando',
      },
      iconKey: 'icon_wpn_test',
      powerScore: 120,
    };
    profile.equipped.weapon = legendaryWeapon;

    const hero = buildHeroFromProfile(profile, { x: 150, y: 220 }, catalog);
    expect(hero.position).toEqual({ x: 150, y: 220 });
    expect(hero.baseStats.maxHp).toBe(DEFAULT_HERO_STATS.maxHp + 40);
    expect(hero.baseStats.attack).toBe(DEFAULT_HERO_STATS.attack + 3);
    expect(hero.baseStats.moveSpeed).toBe(DEFAULT_HERO_STATS.moveSpeed + 8);
    expect(hero.stats.maxHp).toBe(DEFAULT_HERO_STATS.maxHp + 40 + 25);
    expect(hero.stats.hp).toBe(hero.stats.maxHp);
    expect(hero.stats.attack).toBe(DEFAULT_HERO_STATS.attack + 3 + 10);
    expect(hero.lifeSteal).toBe(0.05);
    expect(hero.cooldownReduction).toBe(0.1);
    expect(hero.luck).toBe(0.15);
    expect(hero.equippedForces).toEqual({
      inferno: 0,
      submundo: 1,
      empireo: 0,
    });
    expect(hero.activeLegendaryPowers).toEqual(['submundo_crimson_pact']);
  });

  it('blocks Altar upgrades beyond maxLevel', () => {
    const catalog = getProgressionCatalog();
    const profile = createDefaultProfile();
    profile.souls = 10000;
    profile.altarLevels.bastion = 5;

    const maxed = purchaseAltarUpgrade(profile, 'bastion', catalog);
    expect(maxed.ok).toBe(false);
    expect(maxed.newLevel).toBe(5);
    expect(maxed.cost).toBe(Infinity);
    expect(profile.souls).toBe(10000);
  });

  it('upgrades items (+1/+2) and forges Rare/Legendary items at the Blacksmith', () => {
    const catalog = getProgressionCatalog();
    const rng = createSeededRng(77);
    const profile = createDefaultProfile();

    const baseWeapon = generateItemDrop({
      rng,
      forcedRarity: 'magic',
      forcedSlot: 'weapon',
      idPrefix: 'test_wpn',
    });
    const initialName = baseWeapon.name;
    const initialAtk = baseWeapon.baseBonuses.attack ?? 0;
    const initialHp = baseWeapon.baseBonuses.maxHp ?? 0;
    const initialDef = baseWeapon.baseBonuses.defense ?? 0;
    const initialScore = baseWeapon.powerScore;

    profile.equipped.weapon = baseWeapon;
    profile.souls = 300;
    profile.generalEssences = 1;

    expect(getItemUpgradeLevel(profile, baseWeapon.instanceId)).toBe(0);
    expect(getBlacksmithUpgradeCost(0, catalog)).toBe(40);
    expect(getBlacksmithUpgradeCost(1, catalog)).toBe(75);
    expect(getBlacksmithUpgradeCost(5, catalog)).toBe(Infinity);

    const up1 = upgradeItemWithBlacksmith(profile, baseWeapon.instanceId, catalog);
    expect(up1.ok).toBe(true);
    expect(up1.newLevel).toBe(1);
    expect(up1.cost).toBe(40);
    expect(baseWeapon.name).toBe(`${initialName} (+1)`);
    expect(baseWeapon.baseBonuses.attack).toBe(
      initialAtk + catalog.blacksmithUpgrade.attackBonusPerLevel
    );
    expect(baseWeapon.baseBonuses.maxHp).toBe(
      initialHp + catalog.blacksmithUpgrade.hpBonusPerLevel
    );
    expect(baseWeapon.baseBonuses.defense).toBe(
      initialDef + catalog.blacksmithUpgrade.defenseBonusPerLevel
    );
    expect(baseWeapon.powerScore).toBeGreaterThan(initialScore);

    const scoreAfterUp1 = baseWeapon.powerScore;
    const up2 = upgradeItemWithBlacksmith(profile, baseWeapon.instanceId, catalog);
    expect(up2.ok).toBe(true);
    expect(up2.newLevel).toBe(2);
    expect(up2.cost).toBe(75);
    expect(baseWeapon.name).toBe(`${initialName} (+2)`);
    expect(baseWeapon.powerScore).toBeGreaterThan(scoreAfterUp1);
    expect(profile.souls).toBe(300 - 40 - 75);

    const forgedLegend = forgeItemWithBlacksmith(
      profile,
      'forge_legendary',
      rng,
      catalog
    );
    expect(forgedLegend.ok).toBe(true);
    expect(forgedLegend.item?.rarity).toBe('legendary');
    expect(forgedLegend.item?.legendaryPower).toBeDefined();
    expect(profile.generalEssences).toBe(0);
    expect(profile.souls).toBe(300 - 40 - 75 - 120);
    expect(profile.stash).toHaveLength(1);

    const missingEssence = forgeItemWithBlacksmith(
      profile,
      'forge_legendary',
      rng,
      catalog
    );
    expect(missingEssence.ok).toBe(false);
  });

  it('equips from stash (with swap) and unequips slots respecting stash capacity', () => {
    const rng = createSeededRng(2025);
    const profile = createDefaultProfile();
    const wpnA = generateItemDrop({ rng, forcedSlot: 'weapon', idPrefix: 'a' });
    const wpnB = generateItemDrop({ rng, forcedSlot: 'weapon', idPrefix: 'b' });

    profile.stash.push(wpnA, wpnB);

    expect(equipStashItem(profile, wpnA.instanceId)).toBe(true);
    expect(profile.equipped.weapon?.instanceId).toBe(wpnA.instanceId);
    expect(profile.stash.map((i) => i.instanceId)).toEqual([wpnB.instanceId]);

    expect(equipStashItem(profile, wpnB.instanceId)).toBe(true);
    expect(profile.equipped.weapon?.instanceId).toBe(wpnB.instanceId);
    expect(profile.stash.map((i) => i.instanceId)).toEqual([wpnA.instanceId]);

    expect(equipStashItem(profile, 'missing_id')).toBe(false);

    expect(unequipProfileSlot(profile, 'weapon')).toBe(true);
    expect(profile.equipped.weapon).toBeNull();
    expect(profile.stash).toHaveLength(2);
    expect(unequipProfileSlot(profile, 'weapon')).toBe(false);

    profile.maxStashSize = 2;
    expect(equipStashItem(profile, wpnB.instanceId)).toBe(true);
    profile.stash.push(
      generateItemDrop({ rng, forcedSlot: 'ring', idPrefix: 'filler' })
    );
    expect(profile.stash).toHaveLength(2);
    expect(unequipProfileSlot(profile, 'weapon')).toBe(false);
  });

  it('applies run victory (extracts new loot without duplicates) and defeat (keeps souls & Hub gear, discards run drops)', () => {
    const rng = createSeededRng(909);
    const profile = createDefaultProfile();

    const hubWeapon = generateItemDrop({
      rng,
      forcedRarity: 'rare',
      forcedSlot: 'weapon',
      idPrefix: 'hub',
    });
    const hubRing = generateItemDrop({
      rng,
      forcedRarity: 'magic',
      forcedSlot: 'ring',
      idPrefix: 'hub',
    });
    profile.equipped.weapon = hubWeapon;
    profile.stash.push(hubRing);

    const extractedDrop = generateItemDrop({
      rng,
      forcedRarity: 'legendary',
      forcedSlot: 'amulet',
      idPrefix: 'run_win',
    });

    applyRunOutcomeToProfile(profile, {
      victory: true,
      soulsGained: 150,
      essencesGained: 1,
      monstersKilled: 24,
      bossDefeated: true,
      keptItems: [hubWeapon, hubRing, extractedDrop],
      lostItems: [],
    });

    expect(profile.souls).toBe(150);
    expect(profile.generalEssences).toBe(1);
    expect(profile.stats).toEqual({
      runsCompleted: 1,
      runsFailed: 0,
      bossesDefeated: 1,
      totalSoulsEarned: 150,
    });
    expect(profile.equipped.weapon?.instanceId).toBe(hubWeapon.instanceId);
    expect(profile.stash.map((i) => i.instanceId)).toEqual([
      hubRing.instanceId,
      extractedDrop.instanceId,
    ]);

    const lostDrop = generateItemDrop({
      rng,
      forcedRarity: 'rare',
      forcedSlot: 'armor',
      idPrefix: 'run_loss',
    });

    applyRunOutcomeToProfile(profile, {
      victory: false,
      soulsGained: 45,
      essencesGained: 0,
      monstersKilled: 9,
      bossDefeated: false,
      keptItems: [],
      lostItems: [hubWeapon, lostDrop],
    });

    expect(profile.souls).toBe(195);
    expect(profile.generalEssences).toBe(1);
    expect(profile.stats).toEqual({
      runsCompleted: 1,
      runsFailed: 1,
      bossesDefeated: 1,
      totalSoulsEarned: 195,
    });
    expect(profile.equipped.weapon?.instanceId).toBe(hubWeapon.instanceId);
    expect(profile.stash.map((i) => i.instanceId)).toEqual([
      hubRing.instanceId,
      extractedDrop.instanceId,
    ]);
  });
});
