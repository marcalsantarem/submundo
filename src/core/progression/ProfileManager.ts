import progressionJson from '../../data/progression.json';
import { createHero, DEFAULT_HERO_STATS } from '../entities/Hero';
import type { HeroState } from '../entities/Hero';
import type {
  AltarUpgradeDef,
  AltarUpgradeId,
  CampaignPhase,
  CampaignProgress,
  CampaignStageId,
  EquipSlot,
  HeroStats,
  ItemInstance,
  ProgressionCatalog,
  RunEndReport,
  SaveProfile,
  StatBonus,
  Vector2D,
} from '../index';
import {
  applyGearToHero,
  computeGearBonuses,
  getActiveForces,
  getActiveLegendaryPowers,
} from '../loot/Inventory';
import {
  calculateItemPowerScore,
  generateItemDrop,
} from '../loot/LootGenerator';
import {
  loadProfileFromStorage,
  saveProfileToStorage,
  type StorageLike,
} from './StorageAdapter';

export const DEFAULT_PROFILE_VERSION = 1;
export const DEFAULT_MAX_STASH_SIZE = 30;

const EQUIP_SLOTS: readonly EquipSlot[] = ['weapon', 'armor', 'amulet', 'ring'];
const ALTAR_IDS: readonly AltarUpgradeId[] = [
  'vitality',
  'might',
  'bastion',
  'swiftness',
  'fortune',
];
const CAMPAIGN_PHASES: readonly CampaignPhase[] = ['prologue', 'act1'];
const CAMPAIGN_STAGE_IDS: readonly CampaignStageId[] = [
  'prologue_grotto',
  'prologue_mine',
  'prologue_seal',
  'act1_submundo',
];

function isCampaignPhase(value: unknown): value is CampaignPhase {
  return (
    typeof value === 'string' &&
    (CAMPAIGN_PHASES as readonly string[]).includes(value)
  );
}

function isCampaignStageId(value: unknown): value is CampaignStageId {
  return (
    typeof value === 'string' &&
    (CAMPAIGN_STAGE_IDS as readonly string[]).includes(value)
  );
}

function normalizeCampaign(raw: unknown): CampaignProgress | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const candidate = raw as Partial<CampaignProgress>;
  return {
    phase: isCampaignPhase(candidate.phase) ? candidate.phase : 'prologue',
    currentStageId: isCampaignStageId(candidate.currentStageId)
      ? candidate.currentStageId
      : 'prologue_grotto',
    completedStages: Array.isArray(candidate.completedStages)
      ? candidate.completedStages.filter(isCampaignStageId)
      : [],
    seenDialogues: Array.isArray(candidate.seenDialogues)
      ? candidate.seenDialogues.filter(
          (id): id is string => typeof id === 'string'
        )
      : [],
    villageFallTriggered:
      typeof candidate.villageFallTriggered === 'boolean'
        ? candidate.villageFallTriggered
        : false,
  };
}

function roundStat(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function createEmptyStatBonus(): Required<StatBonus> {
  return {
    maxHp: 0,
    attack: 0,
    defense: 0,
    moveSpeed: 0,
    attackRange: 0,
    cooldownReduction: 0,
    critChance: 0,
    critMultiplier: 0,
    lifeSteal: 0,
    luck: 0,
  };
}

function addScaledStatBonus(
  target: Required<StatBonus>,
  bonus: StatBonus,
  multiplier: number
): void {
  if (multiplier <= 0) {
    return;
  }
  target.maxHp = roundStat(target.maxHp + (bonus.maxHp ?? 0) * multiplier);
  target.attack = roundStat(target.attack + (bonus.attack ?? 0) * multiplier);
  target.defense = roundStat(target.defense + (bonus.defense ?? 0) * multiplier);
  target.moveSpeed = roundStat(target.moveSpeed + (bonus.moveSpeed ?? 0) * multiplier);
  target.attackRange = roundStat(target.attackRange + (bonus.attackRange ?? 0) * multiplier);
  target.cooldownReduction = roundStat(
    target.cooldownReduction + (bonus.cooldownReduction ?? 0) * multiplier
  );
  target.critChance = roundStat(target.critChance + (bonus.critChance ?? 0) * multiplier);
  target.critMultiplier = roundStat(
    target.critMultiplier + (bonus.critMultiplier ?? 0) * multiplier
  );
  target.lifeSteal = roundStat(target.lifeSteal + (bonus.lifeSteal ?? 0) * multiplier);
  target.luck = roundStat(target.luck + (bonus.luck ?? 0) * multiplier);
}

function findProfileItemById(
  profile: SaveProfile,
  instanceId: string
): ItemInstance | null {
  for (const slot of EQUIP_SLOTS) {
    const equippedItem = profile.equipped[slot];
    if (equippedItem && equippedItem.instanceId === instanceId) {
      return equippedItem;
    }
  }
  for (const stashedItem of profile.stash) {
    if (stashedItem.instanceId === instanceId) {
      return stashedItem;
    }
  }
  return null;
}

export function getProgressionCatalog(): ProgressionCatalog {
  return progressionJson as ProgressionCatalog;
}

export function createDefaultProfile(): SaveProfile {
  return {
    version: DEFAULT_PROFILE_VERSION,
    souls: 0,
    generalEssences: 0,
    altarLevels: {
      vitality: 0,
      might: 0,
      bastion: 0,
      swiftness: 0,
      fortune: 0,
    },
    equipped: {
      weapon: null,
      armor: null,
      amulet: null,
      ring: null,
    },
    stash: [],
    maxStashSize: DEFAULT_MAX_STASH_SIZE,
    itemUpgradeLevels: {},
    stats: {
      runsCompleted: 0,
      runsFailed: 0,
      bossesDefeated: 0,
      totalSoulsEarned: 0,
    },
  };
}

export function loadOrCreateProfile(storage?: StorageLike): SaveProfile {
  const loaded = loadProfileFromStorage(storage);
  if (!loaded) {
    const created = createDefaultProfile();
    saveProfileToStorage(created, storage);
    return created;
  }

  const defaults = createDefaultProfile();
  const altarLevels = { ...defaults.altarLevels };
  for (const id of ALTAR_IDS) {
    const val = loaded.altarLevels?.[id];
    if (typeof val === 'number' && Number.isFinite(val)) {
      altarLevels[id] = Math.max(0, Math.floor(val));
    }
  }

  const equipped = { ...defaults.equipped };
  for (const slot of EQUIP_SLOTS) {
    equipped[slot] = loaded.equipped?.[slot] ?? null;
  }

  const campaign = normalizeCampaign(loaded.campaign);

  return {
    version:
      typeof loaded.version === 'number' && Number.isFinite(loaded.version)
        ? loaded.version
        : DEFAULT_PROFILE_VERSION,
    souls:
      typeof loaded.souls === 'number' && Number.isFinite(loaded.souls)
        ? Math.max(0, loaded.souls)
        : 0,
    generalEssences:
      typeof loaded.generalEssences === 'number' &&
      Number.isFinite(loaded.generalEssences)
        ? Math.max(0, loaded.generalEssences)
        : 0,
    altarLevels,
    equipped,
    stash: Array.isArray(loaded.stash) ? [...loaded.stash] : [],
    maxStashSize:
      typeof loaded.maxStashSize === 'number' &&
      Number.isFinite(loaded.maxStashSize)
        ? Math.max(0, Math.floor(loaded.maxStashSize))
        : DEFAULT_MAX_STASH_SIZE,
    itemUpgradeLevels:
      loaded.itemUpgradeLevels && typeof loaded.itemUpgradeLevels === 'object'
        ? { ...loaded.itemUpgradeLevels }
        : {},
    stats: {
      runsCompleted: Math.max(0, loaded.stats?.runsCompleted ?? 0),
      runsFailed: Math.max(0, loaded.stats?.runsFailed ?? 0),
      bossesDefeated: Math.max(0, loaded.stats?.bossesDefeated ?? 0),
      totalSoulsEarned: Math.max(0, loaded.stats?.totalSoulsEarned ?? 0),
    },
    ...(campaign ? { campaign } : {}),
  };
}

export function persistProfile(
  profile: SaveProfile,
  storage?: StorageLike
): boolean {
  return saveProfileToStorage(profile, storage);
}

export function getAltarUpgradeCost(
  def: AltarUpgradeDef,
  currentLevel: number
): number {
  const safeLevel = Math.max(0, Math.floor(currentLevel));
  if (safeLevel >= def.maxLevel) {
    return Infinity;
  }
  return Math.round(def.baseSoulCost * Math.pow(def.costMultiplier, safeLevel));
}

export function computeAltarBonuses(
  profile: SaveProfile,
  catalog: ProgressionCatalog = getProgressionCatalog()
): Required<StatBonus> {
  const totals = createEmptyStatBonus();

  for (const def of catalog.altarUpgrades) {
    const rawLevel = profile.altarLevels[def.id] ?? 0;
    const level = Math.max(0, Math.min(def.maxLevel, Math.floor(rawLevel)));
    addScaledStatBonus(totals, def.bonusPerLevel, level);
  }

  return totals;
}

export function purchaseAltarUpgrade(
  profile: SaveProfile,
  upgradeId: AltarUpgradeId,
  catalog: ProgressionCatalog = getProgressionCatalog()
): { ok: boolean; reason?: string; newLevel: number; cost: number } {
  const def = catalog.altarUpgrades.find((item) => item.id === upgradeId);
  if (!def) {
    return {
      ok: false,
      reason: 'Melhoria do Altar não encontrada.',
      newLevel: 0,
      cost: Infinity,
    };
  }

  const currentLevel = Math.max(0, Math.floor(profile.altarLevels[upgradeId] ?? 0));
  if (currentLevel >= def.maxLevel) {
    return {
      ok: false,
      reason: 'Nível máximo atingido.',
      newLevel: currentLevel,
      cost: Infinity,
    };
  }

  const cost = getAltarUpgradeCost(def, currentLevel);
  if (profile.souls < cost) {
    return {
      ok: false,
      reason: 'Almas insuficientes.',
      newLevel: currentLevel,
      cost,
    };
  }

  profile.souls -= cost;
  const newLevel = currentLevel + 1;
  profile.altarLevels[upgradeId] = newLevel;

  return {
    ok: true,
    newLevel,
    cost,
  };
}

export function getItemUpgradeLevel(
  profile: SaveProfile,
  instanceId: string
): number {
  const level = profile.itemUpgradeLevels[instanceId] ?? 0;
  return Math.max(0, Math.floor(level));
}

export function getBlacksmithUpgradeCost(
  currentLevel: number,
  catalog: ProgressionCatalog = getProgressionCatalog()
): number {
  const config = catalog.blacksmithUpgrade;
  const safeLevel = Math.max(0, Math.floor(currentLevel));
  if (safeLevel >= config.maxLevel) {
    return Infinity;
  }
  return config.baseSoulCost + safeLevel * config.costPerLevel;
}

export function upgradeItemWithBlacksmith(
  profile: SaveProfile,
  instanceId: string,
  catalog: ProgressionCatalog = getProgressionCatalog()
): {
  ok: boolean;
  reason?: string;
  item?: ItemInstance;
  newLevel: number;
  cost: number;
} {
  const item = findProfileItemById(profile, instanceId);
  if (!item) {
    return {
      ok: false,
      reason: 'Item não encontrado no perfil.',
      newLevel: 0,
      cost: Infinity,
    };
  }

  const config = catalog.blacksmithUpgrade;
  const currentLevel = getItemUpgradeLevel(profile, instanceId);
  if (currentLevel >= config.maxLevel) {
    return {
      ok: false,
      reason: 'Item já está no nível máximo.',
      item,
      newLevel: currentLevel,
      cost: Infinity,
    };
  }

  const cost = getBlacksmithUpgradeCost(currentLevel, catalog);
  if (profile.souls < cost) {
    return {
      ok: false,
      reason: 'Almas insuficientes.',
      item,
      newLevel: currentLevel,
      cost,
    };
  }

  profile.souls -= cost;
  const newLevel = currentLevel + 1;
  profile.itemUpgradeLevels[instanceId] = newLevel;

  item.baseBonuses = { ...item.baseBonuses };
  if (config.attackBonusPerLevel !== 0) {
    item.baseBonuses.attack =
      (item.baseBonuses.attack ?? 0) + config.attackBonusPerLevel;
  }
  if (config.hpBonusPerLevel !== 0) {
    item.baseBonuses.maxHp =
      (item.baseBonuses.maxHp ?? 0) + config.hpBonusPerLevel;
  }
  if (config.defenseBonusPerLevel !== 0) {
    item.baseBonuses.defense =
      (item.baseBonuses.defense ?? 0) + config.defenseBonusPerLevel;
  }

  const baseName = item.name.replace(/ \(\+\d+\)$/, '');
  item.name = `${baseName} (+${newLevel})`;
  item.powerScore = calculateItemPowerScore(
    item.rarity,
    item.baseBonuses,
    item.affixes,
    item.legendaryPower
  );

  return {
    ok: true,
    item,
    newLevel,
    cost,
  };
}

export function forgeItemWithBlacksmith(
  profile: SaveProfile,
  recipeId: string,
  rng: () => number = Math.random,
  catalog: ProgressionCatalog = getProgressionCatalog()
): { ok: boolean; reason?: string; item?: ItemInstance } {
  const recipe = catalog.blacksmithForge.find((entry) => entry.id === recipeId);
  if (!recipe) {
    return {
      ok: false,
      reason: 'Receita de forja não encontrada.',
    };
  }

  if (profile.stash.length >= profile.maxStashSize) {
    return {
      ok: false,
      reason: 'Baú cheio.',
    };
  }

  if (profile.generalEssences < recipe.essenceCost) {
    return {
      ok: false,
      reason: 'Essências de General insuficientes.',
    };
  }

  if (profile.souls < recipe.soulCost) {
    return {
      ok: false,
      reason: 'Almas insuficientes.',
    };
  }

  profile.generalEssences -= recipe.essenceCost;
  profile.souls -= recipe.soulCost;

  const item = generateItemDrop({
    rng,
    forcedRarity: recipe.rarity,
    ...(recipe.slot ? { forcedSlot: recipe.slot } : {}),
    idPrefix: 'forge',
  });
  profile.stash.push(item);

  return {
    ok: true,
    item,
  };
}

export function equipStashItem(
  profile: SaveProfile,
  instanceId: string
): boolean {
  const index = profile.stash.findIndex(
    (item) => item.instanceId === instanceId
  );
  if (index === -1) {
    return false;
  }

  const [item] = profile.stash.splice(index, 1);
  const previous = profile.equipped[item.slot];
  profile.equipped[item.slot] = item;

  if (previous !== null) {
    profile.stash.push(previous);
  }

  return true;
}

export function unequipProfileSlot(
  profile: SaveProfile,
  slot: EquipSlot
): boolean {
  const current = profile.equipped[slot];
  if (current === null) {
    return false;
  }
  if (profile.stash.length >= profile.maxStashSize) {
    return false;
  }

  profile.equipped[slot] = null;
  profile.stash.push(current);
  return true;
}

export function applyRunOutcomeToProfile(
  profile: SaveProfile,
  report: RunEndReport
): SaveProfile {
  const soulsGained = Math.max(0, Math.round(report.soulsGained));
  const essencesGained = Math.max(0, Math.round(report.essencesGained));

  profile.souls += soulsGained;
  profile.stats.totalSoulsEarned += soulsGained;
  profile.generalEssences += essencesGained;

  if (report.victory) {
    profile.stats.runsCompleted += 1;
    if (report.bossDefeated) {
      profile.stats.bossesDefeated += 1;
    }

    const knownIds = new Set<string>();
    for (const slot of EQUIP_SLOTS) {
      const equippedItem = profile.equipped[slot];
      if (equippedItem !== null) {
        knownIds.add(equippedItem.instanceId);
      }
    }
    for (const stashedItem of profile.stash) {
      knownIds.add(stashedItem.instanceId);
    }

    for (const keptItem of report.keptItems) {
      if (knownIds.has(keptItem.instanceId)) {
        continue;
      }
      if (profile.stash.length >= profile.maxStashSize) {
        break;
      }
      profile.stash.push(keptItem);
      knownIds.add(keptItem.instanceId);
    }
  } else {
    profile.stats.runsFailed += 1;
  }

  return profile;
}

export function buildHeroFromProfile(
  profile: SaveProfile,
  initialPos?: Vector2D,
  catalog: ProgressionCatalog = getProgressionCatalog()
): HeroState {
  const altarBonuses = computeAltarBonuses(profile, catalog);

  const baseMaxHp = Math.max(
    1,
    Math.round(DEFAULT_HERO_STATS.maxHp + altarBonuses.maxHp)
  );
  const baseStats: HeroStats = {
    maxHp: baseMaxHp,
    hp: baseMaxHp,
    attack: Math.max(
      1,
      Math.round(DEFAULT_HERO_STATS.attack + altarBonuses.attack)
    ),
    defense: Math.max(
      0,
      Math.round(DEFAULT_HERO_STATS.defense + altarBonuses.defense)
    ),
    moveSpeed: Math.max(
      20,
      Math.round(DEFAULT_HERO_STATS.moveSpeed + altarBonuses.moveSpeed)
    ),
    attackRange: Math.max(
      10,
      Math.round(DEFAULT_HERO_STATS.attackRange + altarBonuses.attackRange)
    ),
    attackCooldownMs: DEFAULT_HERO_STATS.attackCooldownMs,
    critChance: Math.min(
      1,
      Math.max(
        0,
        roundStat(DEFAULT_HERO_STATS.critChance + altarBonuses.critChance)
      )
    ),
    critMultiplier: Math.max(
      1,
      roundStat(DEFAULT_HERO_STATS.critMultiplier + altarBonuses.critMultiplier)
    ),
  };

  const hero = createHero(initialPos, baseStats);
  applyGearToHero(hero, hero.baseStats, profile.equipped);
  hero.stats.hp = hero.stats.maxHp;

  const gearBonuses = computeGearBonuses(profile.equipped);
  hero.lifeSteal = Math.max(
    0,
    roundStat(altarBonuses.lifeSteal + gearBonuses.lifeSteal)
  );
  hero.cooldownReduction = Math.max(
    0,
    roundStat(altarBonuses.cooldownReduction + gearBonuses.cooldownReduction)
  );
  hero.luck = Math.max(0, roundStat(altarBonuses.luck + gearBonuses.luck));
  hero.equippedForces = getActiveForces(profile.equipped);
  hero.activeLegendaryPowers = getActiveLegendaryPowers(profile.equipped);

  return hero;
}
