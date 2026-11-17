export interface Vector2D {
  x: number;
  y: number;
}

export type ForceType = 'inferno' | 'submundo' | 'empireo' | 'none';

export type MonsterType = 'normal' | 'boss';

export interface MonsterDef {
  id: string;
  name: string;
  type: MonsterType;
  maxHp: number;
  attack: number;
  defense: number;
  moveSpeed: number;
  attackRange: number;
  attackCooldownMs: number;
  soulReward: number;
  spriteKey: string;
}

export type SkillSlot = 'dash' | 'active_1' | 'active_2' | 'potion';

export interface SkillDef {
  id: string;
  name: string;
  slot: SkillSlot;
  force: ForceType;
  cooldownMs: number;
  damageMultiplier?: number;
  radius?: number;
  healPercent?: number;
  maxCharges?: number;
  invulnerabilityMs?: number;
  dashDistance?: number;
  description: string;
}

export interface HeroStats {
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  moveSpeed: number;
  attackRange: number;
  attackCooldownMs: number;
  critChance: number;
  critMultiplier: number;
}

export type ViewportMode = 'desktop_landscape' | 'mobile_portrait';

export interface ViewportConfig {
  mode: ViewportMode;
  width: number;
  height: number;
  aspectRatio: string;
}

export function resolveViewportConfig(
  windowWidth: number,
  windowHeight: number
): ViewportConfig {
  if (windowWidth >= windowHeight) {
    return {
      mode: 'desktop_landscape',
      width: 800,
      height: 600,
      aspectRatio: '4:3',
    };
  }
  return {
    mode: 'mobile_portrait',
    width: 360,
    height: 640,
    aspectRatio: '9:16',
  };
}

export type EquipSlot = 'weapon' | 'armor' | 'amulet' | 'ring';

export type Rarity = 'common' | 'magic' | 'rare' | 'legendary';

export type StatusEffectType = 'ember' | 'bleed' | 'judgment';

export type LegendaryPowerId =
  | 'inferno_dash_trail'
  | 'submundo_bleed_minion'
  | 'empireo_crit_lightning'
  | 'inferno_ember_nova'
  | 'submundo_crimson_pact'
  | 'empireo_judgment_haste';

export interface StatBonus {
  maxHp?: number;
  attack?: number;
  defense?: number;
  moveSpeed?: number;
  attackRange?: number;
  cooldownReduction?: number;
  critChance?: number;
  critMultiplier?: number;
  lifeSteal?: number;
  luck?: number;
}

export interface AffixDef {
  id: string;
  name: string;
  force: ForceType;
  allowedSlots: EquipSlot[];
  minRarity: Rarity;
  bonuses: StatBonus;
  description: string;
}

export interface LegendaryPowerDef {
  id: LegendaryPowerId;
  name: string;
  force: ForceType;
  description: string;
}

export interface ItemDef {
  id: string;
  name: string;
  slot: EquipSlot;
  force: ForceType;
  baseBonuses: StatBonus;
  iconKey: string;
  description: string;
}

export interface ItemInstance {
  instanceId: string;
  defId: string;
  name: string;
  slot: EquipSlot;
  rarity: Rarity;
  force: ForceType;
  baseBonuses: StatBonus;
  affixes: AffixDef[];
  legendaryPower?: LegendaryPowerDef;
  iconKey: string;
  powerScore: number;
}

export type EquippedGear = Record<EquipSlot, ItemInstance | null>;

