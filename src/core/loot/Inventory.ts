import type { HeroState } from '../entities/Hero';
import type {
  EquipSlot,
  EquippedGear,
  HeroStats,
  ItemInstance,
  LegendaryPowerId,
  StatBonus,
} from '../index';

const EQUIP_SLOTS: readonly EquipSlot[] = ['weapon', 'armor', 'amulet', 'ring'];
const DEFAULT_MAX_BAG_SIZE = 20;

export interface RunInventoryState {
  equipped: EquippedGear;
  bag: ItemInstance[];
  extractedItems: ItemInstance[];
  lostItemsOnDeath: ItemInstance[];
  maxBagSize: number;
}

export function createRunInventory(
  maxBagSize: number = DEFAULT_MAX_BAG_SIZE
): RunInventoryState {
  return {
    equipped: {
      weapon: null,
      armor: null,
      amulet: null,
      ring: null,
    },
    bag: [],
    extractedItems: [],
    lostItemsOnDeath: [],
    maxBagSize: Math.max(0, Math.floor(maxBagSize)),
  };
}

export function addItemToBag(
  inv: RunInventoryState,
  item: ItemInstance
): boolean {
  if (inv.bag.length >= inv.maxBagSize) {
    return false;
  }
  inv.bag.push(item);
  return true;
}

export function equipItemFromBag(
  inv: RunInventoryState,
  instanceId: string
): { equipped: ItemInstance; previous: ItemInstance | null } | null {
  const index = inv.bag.findIndex((item) => item.instanceId === instanceId);
  if (index === -1) {
    return null;
  }

  const [item] = inv.bag.splice(index, 1);
  const previous = inv.equipped[item.slot];
  inv.equipped[item.slot] = item;

  if (previous !== null) {
    inv.bag.push(previous);
  }

  return { equipped: item, previous };
}

export function unequipSlotToBag(
  inv: RunInventoryState,
  slot: EquipSlot
): boolean {
  const current = inv.equipped[slot];
  if (current === null) {
    return false;
  }
  if (inv.bag.length >= inv.maxBagSize) {
    return false;
  }

  inv.equipped[slot] = null;
  inv.bag.push(current);
  return true;
}

function roundStat(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function addStatBonus(
  target: Required<StatBonus>,
  bonus: StatBonus | undefined
): void {
  if (!bonus) {
    return;
  }
  target.maxHp = roundStat(target.maxHp + (bonus.maxHp ?? 0));
  target.attack = roundStat(target.attack + (bonus.attack ?? 0));
  target.defense = roundStat(target.defense + (bonus.defense ?? 0));
  target.moveSpeed = roundStat(target.moveSpeed + (bonus.moveSpeed ?? 0));
  target.attackRange = roundStat(target.attackRange + (bonus.attackRange ?? 0));
  target.cooldownReduction = roundStat(
    target.cooldownReduction + (bonus.cooldownReduction ?? 0)
  );
  target.critChance = roundStat(target.critChance + (bonus.critChance ?? 0));
  target.critMultiplier = roundStat(
    target.critMultiplier + (bonus.critMultiplier ?? 0)
  );
  target.lifeSteal = roundStat(target.lifeSteal + (bonus.lifeSteal ?? 0));
  target.luck = roundStat(target.luck + (bonus.luck ?? 0));
}

export function computeGearBonuses(
  equipped: EquippedGear
): Required<StatBonus> {
  const totals: Required<StatBonus> = {
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

  for (const slot of EQUIP_SLOTS) {
    const item = equipped[slot];
    if (!item) {
      continue;
    }
    addStatBonus(totals, item.baseBonuses);
    for (const affix of item.affixes) {
      addStatBonus(totals, affix.bonuses);
    }
  }

  return totals;
}

export function getActiveForces(
  equipped: EquippedGear
): Record<'inferno' | 'submundo' | 'empireo', number> {
  const counts: Record<'inferno' | 'submundo' | 'empireo', number> = {
    inferno: 0,
    submundo: 0,
    empireo: 0,
  };

  for (const slot of EQUIP_SLOTS) {
    const item = equipped[slot];
    if (!item) {
      continue;
    }
    if (
      item.force === 'inferno' ||
      item.force === 'submundo' ||
      item.force === 'empireo'
    ) {
      counts[item.force] += 1;
    }
  }

  return counts;
}

export function getActiveLegendaryPowers(
  equipped: EquippedGear
): LegendaryPowerId[] {
  const powers: LegendaryPowerId[] = [];

  for (const slot of EQUIP_SLOTS) {
    const item = equipped[slot];
    const powerId = item?.legendaryPower?.id;
    if (powerId && !powers.includes(powerId)) {
      powers.push(powerId);
    }
  }

  return powers;
}

export function applyGearToHero(
  hero: HeroState,
  baseStats: HeroStats,
  equipped: EquippedGear
): HeroStats {
  const bonuses = computeGearBonuses(equipped);
  const maxHp = Math.max(1, Math.round(baseStats.maxHp + bonuses.maxHp));
  const hp = Math.min(maxHp, Math.max(0, hero.stats.hp));

  const nextStats: HeroStats = {
    maxHp,
    hp,
    attack: Math.max(1, Math.round(baseStats.attack + bonuses.attack)),
    defense: Math.max(0, Math.round(baseStats.defense + bonuses.defense)),
    moveSpeed: Math.max(20, Math.round(baseStats.moveSpeed + bonuses.moveSpeed)),
    attackRange: Math.max(
      10,
      Math.round(baseStats.attackRange + bonuses.attackRange)
    ),
    attackCooldownMs: baseStats.attackCooldownMs,
    critChance: Math.min(
      1,
      Math.max(0, roundStat(baseStats.critChance + bonuses.critChance))
    ),
    critMultiplier: Math.max(
      1,
      roundStat(baseStats.critMultiplier + bonuses.critMultiplier)
    ),
  };

  hero.stats = nextStats;
  return nextStats;
}

export function resolveRunEndLoot(
  inv: RunInventoryState,
  victory: boolean
): { kept: ItemInstance[]; lost: ItemInstance[] } {
  const runItems: ItemInstance[] = [];
  for (const slot of EQUIP_SLOTS) {
    const equippedItem = inv.equipped[slot];
    if (equippedItem !== null) {
      runItems.push(equippedItem);
    }
  }
  runItems.push(...inv.bag);

  if (victory) {
    inv.extractedItems.push(...runItems);
    return {
      kept: runItems,
      lost: [],
    };
  }

  inv.lostItemsOnDeath.push(...runItems);
  for (const slot of EQUIP_SLOTS) {
    inv.equipped[slot] = null;
  }
  inv.bag = [];

  return {
    kept: [],
    lost: runItems,
  };
}
