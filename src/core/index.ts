export interface Vector2D {
  x: number;
  y: number;
}

export type ForceType = 'inferno' | 'submundo' | 'empireo' | 'none';

export type MonsterType = 'normal' | 'boss';

export type MonsterAttackType = 'melee' | 'ranged';

export interface MonsterDef {
  id: string;
  name: string;
  type: MonsterType;
  attackType?: MonsterAttackType;
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

export type ViewportMode = 'landscape';

export interface ViewportConfig {
  mode: ViewportMode;
  width: number;
  height: number;
  aspectRatio: string;
  isPortraitWindow?: boolean;
}

export function resolveViewportConfig(
  windowWidth: number,
  windowHeight: number
): ViewportConfig {
  return {
    mode: 'landscape',
    width: 960,
    height: 540,
    aspectRatio: '16:9',
    isPortraitWindow: windowWidth < windowHeight,
  };
}

export type EquipSlot = 'weapon' | 'armor' | 'helm' | 'boots' | 'amulet' | 'ring';

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

export type AltarUpgradeId = 'vitality' | 'might' | 'bastion' | 'swiftness' | 'fortune';

export interface AltarUpgradeDef {
  id: AltarUpgradeId;
  name: string;
  description: string;
  maxLevel: number;
  baseSoulCost: number;
  costMultiplier: number;
  bonusPerLevel: StatBonus;
}

export interface BlacksmithUpgradeConfig {
  maxLevel: number;
  baseSoulCost: number;
  costPerLevel: number;
  attackBonusPerLevel: number;
  hpBonusPerLevel: number;
  defenseBonusPerLevel: number;
}

export interface BlacksmithForgeDef {
  id: string;
  name: string;
  description: string;
  essenceCost: number;
  soulCost: number;
  rarity: Rarity;
  slot?: EquipSlot;
}

export interface ProgressionCatalog {
  altarUpgrades: AltarUpgradeDef[];
  blacksmithUpgrade: BlacksmithUpgradeConfig;
  blacksmithForge: BlacksmithForgeDef[];
}

export interface SaveProfile {
  version: number;
  souls: number;
  generalEssences: number;
  altarLevels: Record<AltarUpgradeId, number>;
  equipped: EquippedGear;
  stash: ItemInstance[];
  maxStashSize: number;
  itemUpgradeLevels: Record<string, number>;
  stats: {
    runsCompleted: number;
    runsFailed: number;
    bossesDefeated: number;
    totalSoulsEarned: number;
  };
  campaign?: CampaignProgress;
}

export interface RunEndReport {
  victory: boolean;
  soulsGained: number;
  essencesGained: number;
  monstersKilled: number;
  bossDefeated: boolean;
  keptItems: ItemInstance[];
  lostItems: ItemInstance[];
  stageId?: CampaignStageId;
  triggeredVillageFall?: boolean;
}

export interface HubTransitionData {
  fromRun?: RunEndReport;
  stageId?: CampaignStageId;
}

export type CampaignPhase = 'prologue' | 'act1';

export type CampaignStageId =
  | 'prologue_grotto'
  | 'prologue_mine'
  | 'prologue_seal'
  | 'act1_submundo';

export type PortraitId =
  | 'hero_living'
  | 'hero_wraith'
  | 'weapon_master'
  | 'village_blacksmith'
  | 'village_healer'
  | 'emissary'
  | 'spectral_blacksmith'
  | 'infernal_warden'
  | 'system';

export type BiomeId =
  | 'village_grotto'
  | 'village_mine'
  | 'ancient_seal'
  | 'submundo_abyss';

export interface DialogueLine {
  id: string;
  speaker: string;
  portraitId: PortraitId;
  title: string;
  text: string;
  shortText?: string;
}

export interface CampaignStageDef {
  id: CampaignStageId;
  phase: CampaignPhase;
  order: number;
  name: string;
  subtitle: string;
  description: string;
  biome: BiomeId;
  totalRooms: number;
  difficultyScale: number;
  monsterPool: string[];
  bossId: string;
  introDialogueIds: string[];
  victoryDialogueIds: string[];
  defeatDialogueIds?: string[];
  unlocksStageId?: CampaignStageId;
  triggersFallOfVillage?: boolean;
}

export interface CampaignCatalog {
  stages: CampaignStageDef[];
}

export interface CampaignProgress {
  phase: CampaignPhase;
  currentStageId: CampaignStageId;
  completedStages: CampaignStageId[];
  seenDialogues: string[];
  villageFallTriggered: boolean;
  /** Missão sobre a qual o Mestre de Armas já falou (libera o portão da vila). Opcional para saves antigos. */
  masterBriefedStageId?: CampaignStageId;
}

export * from './progression/VillageHub';
