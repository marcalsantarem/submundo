import affixesJson from '../../data/affixes.json';
import itemsJson from '../../data/items.json';
import type {
  AffixDef,
  EquipSlot,
  ForceType,
  ItemDef,
  ItemInstance,
  LegendaryPowerDef,
  Rarity,
  StatBonus,
} from '../index';

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#e4e4e7',
  magic: '#38bdf8',
  rare: '#facc15',
  legendary: '#f97316',
};

const RARITY_RANK: Record<Rarity, number> = {
  common: 0,
  magic: 1,
  rare: 2,
  legendary: 3,
};

const RARITY_SCORE_BONUS: Record<Rarity, number> = {
  common: 0,
  magic: 10,
  rare: 25,
  legendary: 60,
};

const EQUIP_SLOTS: readonly EquipSlot[] = [
  'weapon',
  'armor',
  'helm',
  'boots',
  'amulet',
  'ring',
];

interface AffixesData {
  affixes: AffixDef[];
  legendaryPowers: LegendaryPowerDef[];
}

const ITEMS_CATALOG: ItemDef[] = itemsJson as ItemDef[];
const AFFIXES_DATA: AffixesData = affixesJson as AffixesData;

let nextItemSeq = 0;

function safeIndex(rng: () => number, length: number): number {
  if (length <= 1) {
    return 0;
  }
  const raw = Math.floor(rng() * length);
  return Math.max(0, Math.min(length - 1, raw));
}

function scoreStatBonus(bonuses: StatBonus): number {
  let score = 0;
  score += (bonuses.maxHp ?? 0) * 0.5;
  score += (bonuses.attack ?? 0) * 4;
  score += (bonuses.defense ?? 0) * 3;
  score += (bonuses.moveSpeed ?? 0) * 0.5;
  score += (bonuses.attackRange ?? 0) * 0.5;
  score += (bonuses.cooldownReduction ?? 0) * 120;
  score += (bonuses.critChance ?? 0) * 150;
  score += (bonuses.critMultiplier ?? 0) * 50;
  score += (bonuses.lifeSteal ?? 0) * 160;
  score += (bonuses.luck ?? 0) * 60;
  return score;
}

export function calculateItemPowerScore(
  rarity: Rarity,
  baseBonuses: StatBonus,
  affixes: readonly AffixDef[],
  legendaryPower?: LegendaryPowerDef
): number {
  let total = scoreStatBonus(baseBonuses) + RARITY_SCORE_BONUS[rarity];
  for (const affix of affixes) {
    total += scoreStatBonus(affix.bonuses);
  }
  if (legendaryPower) {
    total += 20;
  }
  return Math.max(1, Math.round(total));
}

export function rollRarity(
  rng: () => number = Math.random,
  luck = 0,
  isBoss = false
): Rarity {
  const safeLuck = Math.max(0, luck);
  const roll = rng();

  if (isBoss) {
    const legendaryChance = Math.min(0.85, 0.35 + safeLuck * 0.4);
    return roll < legendaryChance ? 'legendary' : 'rare';
  }

  const legendaryThreshold = Math.min(0.35, 0.04 + safeLuck * 0.2);
  const rareThreshold = Math.min(0.65, legendaryThreshold + 0.16 + safeLuck * 0.25);
  const magicThreshold = Math.min(0.95, rareThreshold + 0.35 + safeLuck * 0.1);

  if (roll < legendaryThreshold) {
    return 'legendary';
  }
  if (roll < rareThreshold) {
    return 'rare';
  }
  if (roll < magicThreshold) {
    return 'magic';
  }
  return 'common';
}

export function shouldDropLoot(
  isBoss: boolean,
  rng: () => number = Math.random,
  luck = 0
): boolean {
  if (isBoss) {
    return true;
  }
  const safeLuck = Math.max(0, luck);
  const dropChance = Math.min(0.95, 0.3 + safeLuck);
  return rng() < dropChance;
}

export interface GenerateItemDropOptions {
  rng?: () => number;
  luck?: number;
  isBoss?: boolean;
  forcedRarity?: Rarity;
  forcedSlot?: EquipSlot;
  idPrefix?: string;
}

function getAffixCountForRarity(rarity: Rarity, rng: () => number): number {
  switch (rarity) {
    case 'common':
      return 0;
    case 'magic':
      return 1;
    case 'rare':
      return rng() < 0.5 ? 2 : 3;
    case 'legendary':
      return 3;
  }
}

function pickUniqueAffixes(
  slot: EquipSlot,
  rarity: Rarity,
  count: number,
  rng: () => number
): AffixDef[] {
  if (count <= 0) {
    return [];
  }

  const minRank = RARITY_RANK[rarity];
  const pool = AFFIXES_DATA.affixes.filter(
    (affix) =>
      affix.allowedSlots.includes(slot) && RARITY_RANK[affix.minRarity] <= minRank
  );

  const selected: AffixDef[] = [];
  const available = [...pool];
  const targetCount = Math.min(count, available.length);

  for (let i = 0; i < targetCount; i++) {
    const idx = safeIndex(rng, available.length);
    const [picked] = available.splice(idx, 1);
    selected.push({
      ...picked,
      allowedSlots: [...picked.allowedSlots],
      bonuses: { ...picked.bonuses },
    });
  }

  return selected;
}

function pickLegendaryPower(
  baseForce: ForceType,
  rng: () => number
): LegendaryPowerDef {
  const allPowers = AFFIXES_DATA.legendaryPowers;
  const matching =
    baseForce !== 'none'
      ? allPowers.filter((power) => power.force === baseForce)
      : allPowers;
  const pool = matching.length > 0 ? matching : allPowers;
  const picked = pool[safeIndex(rng, pool.length)];
  return { ...picked };
}

export function generateItemDrop(
  options: GenerateItemDropOptions = {}
): ItemInstance {
  const rng = options.rng ?? Math.random;
  const rarity =
    options.forcedRarity ?? rollRarity(rng, options.luck, options.isBoss);
  const slot =
    options.forcedSlot ?? EQUIP_SLOTS[safeIndex(rng, EQUIP_SLOTS.length)];

  const slotItems = ITEMS_CATALOG.filter((item) => item.slot === slot);
  const baseDef = slotItems[safeIndex(rng, slotItems.length)];

  const affixCount = getAffixCountForRarity(rarity, rng);
  const affixes = pickUniqueAffixes(slot, rarity, affixCount, rng);

  const legendaryPower =
    rarity === 'legendary' ? pickLegendaryPower(baseDef.force, rng) : undefined;

  const force: ForceType =
    baseDef.force === 'none' && legendaryPower
      ? legendaryPower.force
      : baseDef.force;

  let name = baseDef.name;
  if (rarity === 'legendary' && legendaryPower) {
    name = `${baseDef.name} — ${legendaryPower.name}`;
  } else if (affixes.length > 0) {
    name = `${baseDef.name} ${affixes[0].name}`;
  }

  const baseBonuses: StatBonus = { ...baseDef.baseBonuses };
  const powerScore = calculateItemPowerScore(
    rarity,
    baseBonuses,
    affixes,
    legendaryPower
  );

  nextItemSeq += 1;
  const prefix = options.idPrefix ?? 'item';
  const instanceId = `${prefix}_${nextItemSeq}`;

  return {
    instanceId,
    defId: baseDef.id,
    name,
    slot,
    rarity,
    force,
    baseBonuses,
    affixes,
    ...(legendaryPower ? { legendaryPower } : {}),
    iconKey: baseDef.iconKey,
    powerScore,
  };
}
