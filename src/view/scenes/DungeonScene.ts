import Phaser from 'phaser';
import {
  DEFAULT_SKILLS,
  distanceBetween,
  tickCombat,
  triggerHeroSkill,
  type CombatEvent,
} from '../../core/combat/CombatEngine';
import {
  advanceToNextRoom,
  createDungeonRun,
  evaluateRoomState,
  getCurrentRoom,
  type DungeonRunState,
} from '../../core/dungeon/DungeonRun';
import {
  generateDungeonMap,
  MAP_CELL_VOID,
  MAP_FEET_BOX,
  MAP_FEET_OFFSET,
  MAP_TILE,
  type DungeonMap,
  type DungeonMapMode,
  type MapDoor,
  type MapZone,
} from '../../core/dungeon/DungeonMap';
import {
  autotileDungeonMap,
  doorBlockRect,
  doorCenter,
  DungeonMapView,
  DUNGEON_TILE_FRAMES,
  type AutotileLayout,
} from './DungeonMapRenderer';
import {
  getBiomeTheme,
  resolveTestArenaBiome,
  themePropFrame,
  type ArenaBiomeId,
} from './BiomeTheme';
import { moveHero, type HeroState } from '../../core/entities/Hero';
import { spawnMonster, type MonsterInstance } from '../../core/entities/Monster';
import {
  resolveViewportConfig,
  type BiomeId,
  type CampaignStageDef,
  type CampaignStageId,
  type EquipSlot,
  type ItemInstance,
  type MonsterDef,
  type Rarity,
  type RunEndReport,
  type SaveProfile,
  type SkillDef,
  type Vector2D,
} from '../../core/index';
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
  type RunInventoryState,
} from '../../core/loot/Inventory';
import {
  generateItemDrop,
  RARITY_COLORS,
  shouldDropLoot,
} from '../../core/loot/LootGenerator';
import {
  applyStageOutcomeToCampaign,
  ensureCampaignProgress,
  getCampaignStage,
  getDialogueLine,
} from '../../core/progression/CampaignManager';
import {
  applyRunOutcomeToProfile,
  buildHeroFromProfile,
  computeAltarBonuses,
  loadOrCreateProfile,
  persistProfile,
} from '../../core/progression/ProfileManager';
import dialoguesData from '../../data/dialogues.json';
import monstersJson from '../../data/monsters.json';
import skillsJson from '../../data/skills.json';
import { soundManager } from '../audio/SoundManager';
import {
  CombatVfxManager,
  HERO_WALK_FOOTSTEP_FRAMES,
  registerGameAnimations,
  resolveMonsterAnimKey,
  spawnFootstepDust,
} from '../sprites/CombatVfx';
import {
  HERO_ATTACK_DURATION_MS,
  HERO_ATTACK_IMPACT_MS,
  HERO_SKILL_ATTACK_DURATION_MS,
  HERO_SKILL_ATTACK_IMPACT_MS,
  HeroWeaponRig,
} from '../sprites/HeroWeaponRig';
import { SceneCameraRig } from '../ui/CameraRig';
import { DF_FONTS, DF_RARITY_THEME } from '../ui/DarkFantasyUiBuilder';
import { DungeonHud, type HudSnapshot } from '../ui/DungeonHud';
import {
  InventoryModal,
  type InventoryHudSnapshot,
} from '../ui/InventoryModal';

interface MonsterVisual {
  sprite: Phaser.GameObjects.Sprite;
  hpBar: Phaser.GameObjects.Graphics;
  isActionPlaying?: boolean;
  isDying?: boolean;
  deathFinished?: boolean;
}

const ANIMATED_SPRITESHEET_MONSTERS = new Set<string>([
  'slime',
  'cave_bat',
  'wolf',
  'skeleton',
  'skeleton_archer',
  'skeleton_chief',
  'wolf_alpha',
  'karnak',
]);

const TEST_ARENA_FINISHED_TEXT = 'Teste finalizado';
const TEST_ARENA_FINISH_DELAY_MS = 800;

/** Distance from an actor's center (sprite origin) to its feet, in world px. */
const ACTOR_FEET_OFFSET = 30;
interface GroundDrop {
  item: ItemInstance;
  position: Vector2D;
  sprite: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Graphics;
  labelContainer: Phaser.GameObjects.Container;
  pillar?: Phaser.GameObjects.Graphics;
  pillarTween?: Phaser.Tweens.Tween;
}

/** Shape of the removed TestDungeon room spec (typing only, see getTestRooms). */
interface LegacyTestRoomInfo {
  index: number;
  wave: number;
  isBossRoom: boolean;
  spawns: Array<{ defId: string; x: number; y: number }>;
  exitDoorCols: [number, number] | null;
  entryDoorCols: [number, number] | null;
}

export interface SubmundoDebugApi {
  scene: DungeonScene;
  getRunState: () => DungeonRunState;
  getHero: () => HeroState;
  getMonsters: () => MonsterInstance[];
  getInventory: () => RunInventoryState;
  spawnTestDrop: (rarity?: Rarity) => ItemInstance;
  equipItem: (instanceId: string) => boolean;
  triggerSkill: (id: string) => CombatEvent[];
  forceClearRoom: () => void;
  advanceRoom: () => void;
  restartRun: (stageId?: CampaignStageId) => void;
  returnToHub?: () => void;
  /** Procedural map of the test arena (T-128); undefined outside it. */
  getDungeonMap: () => DungeonMap | undefined;
  /** Index of the active zone (wave) of the test arena. */
  getActiveZoneIndex: () => number;
  getTestRoomIndex: () => number;
  /** Ids of the doors currently sealed. */
  getSealedDoorIds: () => number[];
  /** @deprecated T-128: the 3-room TestDungeon is gone; always empty (kept for old e2e typings). */
  getTestRooms: () => LegacyTestRoomInfo[];
  /** @deprecated T-128: always empty. */
  getTestRoomWorldOrigins: () => Array<{ x: number; y: number }>;
  getGroundDrops: () => Array<{ x: number; y: number; item: ItemInstance }>;
  pickUpDropAt: (index: number) => boolean;
  /** Same as the "Pegar" button / E key (T-132). */
  pickUpNearest: () => boolean;
  /** Biome of the test arena (`?biome=`, T-073); `dungeon_basic` by default. */
  getBiomeId: () => ArenaBiomeId;
}

declare global {
  interface Window {
    __SUBMUNDO_DEBUG__?: SubmundoDebugApi;
  }
}

const TILE_DISPLAY_SIZE = 32;
const ARENA_PADDING = 36;
const ROOM_CLEAR_AUTO_ADVANCE_MS = 1200;
/** Click/tap pickup: collect at once within this reach, else walk to it. */
const DROP_CLICK_REACH = 70;
const DROP_WALK_ARRIVE = 40;
/** "Pegar" button / E key (T-132): search radius for the nearest ground item. */
const DROP_NEAREST_SEARCH_RADIUS = 180;
const DROP_HIT_SIZE = 44;
const GROUND_DROP_TAG_OFFSET_Y = 26;
const GROUND_DROP_TAG_COLORS: Record<Rarity, string> = {
  common: '#cbd5e1',
  magic: '#60a5fa',
  rare: '#facc15',
  legendary: '#f97316',
};
const HERO_ATTACK_CANCEL_FRAME = 12;
const HERO_HIT_CANCEL_FRAME = 21;
const MONSTER_HIT_FLASH_MS = 70;
const EQUIP_SLOTS: readonly EquipSlot[] = [
  'weapon',
  'armor',
  'helm',
  'boots',
  'amulet',
  'ring',
];

const RARITY_DROP_FRAME: Record<Rarity, number> = {
  common: 0,
  magic: 1,
  rare: 2,
  legendary: 3,
};

/** First test run honours `?seed=N`; later restarts use a fresh seed. */
let urlSeedConsumed = false;
/** Test map mode from the URL: `?map=giant`, otherwise `rooms`. */
function resolveTestArenaMapMode(): DungeonMapMode {
  if (typeof window === 'undefined') {
    return 'rooms';
  }
  return new URLSearchParams(window.location.search).get('map') === 'giant'
    ? 'giant'
    : 'rooms';
}

function resolveTestArenaSeed(): number {
  if (!urlSeedConsumed && typeof window !== 'undefined') {
    urlSeedConsumed = true;
    const raw = new URLSearchParams(window.location.search).get('seed');
    const parsed = raw === null ? NaN : Number(raw);
    if (Number.isFinite(parsed)) {
      return Math.abs(Math.trunc(parsed));
    }
  }
  return Date.now() % 2147483647;
}

export class DungeonScene extends Phaser.Scene {
  private readonly monstersCatalog: MonsterDef[] =
    monstersJson as MonsterDef[];
  private readonly skillsCatalog: SkillDef[] =
    (skillsJson as SkillDef[]) ?? DEFAULT_SKILLS;
  private readonly monsterDefMap = new Map<string, MonsterDef>();

  private activeProfile!: SaveProfile;
  private activeStage!: CampaignStageDef;
  private startingHubItemIds = new Set<string>();
  private runState!: DungeonRunState;
  private hero!: HeroState;
  private monsters: MonsterInstance[] = [];
  private inventory!: RunInventoryState;

  private vfx!: CombatVfxManager;
  private hud!: DungeonHud;
  private inventoryModal!: InventoryModal;
  private cameraRig?: SceneCameraRig;
  private viewport = resolveViewportConfig(960, 540);

  private arenaLayer!: Phaser.GameObjects.Container;
  private lightingGraphics!: Phaser.GameObjects.Graphics;
  private heroAura!: Phaser.GameObjects.Graphics;
  private heroSprite?: Phaser.GameObjects.Sprite;
  private heroSpriteKey: 'hero_living' | 'hero_wraith' = 'hero_wraith';
  private weaponRig?: HeroWeaponRig;
  private isHeroActionAnimPlaying = false;
  private currentHeroActionAnim: 'attack' | 'dash' | 'hit' | null = null;
  private heroIsMoving = false;
  private heroFlipX = false;
  private lastMoveDirX = 0;
  private lastHeroFootstepFrame = -1;
  /** Scene-clock (this.time.now) timeline of the current hero swing. */
  private heroSwingEndsAtMs = 0;
  private heroSwingImpactAtMs = 0;
  /** Impact visuals waiting for the swing's impact moment. */
  private pendingHeroImpacts: Array<{
    timer: Phaser.Time.TimerEvent;
    show: () => void;
  }> = [];
  /** Monsters killed by a hero hit whose death visual waits for impact. */
  private readonly deferredDeathIds = new Set<string>();
  private readonly monsterVisuals = new Map<string, MonsterVisual>();
  private readonly minionVisuals = new Map<string, Phaser.GameObjects.Graphics>();
  private groundDrops: GroundDrop[] = [];
  /** Drop the hero is auto-walking to after a click/tap (cancelled by input). */
  private pickupTarget?: GroundDrop;
  private pickupLastPos?: Vector2D;
  private pickupStuckMs = 0;

  private portalContainer?: Phaser.GameObjects.Container;
  private portalPosition?: Vector2D;

  private elapsedTimeMs = 0;
  private roomClearTimerMs = 0;
  private bannerText?: string;
  private bannerExpiresAtMs = 0;
  private isTestArena = false;
  private testArenaWave = 1;
  /** Seed of the current test dungeon run (`?seed=N` overrides the first run). */
  public testArenaSeed = 0;
  /** Index of the active zone (wave) of the test map. */
  public testArenaRoomIndex = 0;
  /** `?map=rooms` (default) or `?map=giant`. */
  public testArenaMapMode: DungeonMapMode = 'rooms';
  /** Biome of the test arena from `?biome=<id>` (T-073); `dungeon_basic` by default. */
  public testArenaBiome: ArenaBiomeId = 'dungeon_basic';
  /** Soft light that follows the hero in dark biomes. */
  private heroLight?: Phaser.GameObjects.Image;
  private dungeonMap?: DungeonMap;
  private mapLayout?: AutotileLayout;
  private mapView?: DungeonMapView;
  private testRoomClearAtMs?: number;
  /** Per zone: cleared and exit doors opened / entry doors sealed behind the hero. */
  private testDoorOpenFlags: boolean[] = [];
  private testEntryClosedFlags: boolean[] = [];
  private readonly sealedDoorIds = new Set<number>();
  private readonly doorGlows = new Map<number, Phaser.GameObjects.Image>();
  /** Last valid feet point per actor ('hero' or monster instanceId). */
  private readonly lastValidFeet = new Map<string, Vector2D>();
  private rangedArrows: Phaser.GameObjects.Graphics[] = [];
  /** True once the last test room (boss) is cleared ("Teste finalizado"). */
  public testArenaFinished = false;
  private testArenaFinishAtMs?: number;
  private testArenaObjects: Phaser.GameObjects.GameObject[] = [];
  private testArenaTallProps: Array<{
    image: Phaser.GameObjects.Image;
    baseY: number;
  }> = [];
  private testArenaLights: Array<{
    image: Phaser.GameObjects.Image;
    baseAlpha: number;
  }> = [];
  private actorShadows?: Phaser.GameObjects.Graphics;
  private testArenaFinishOverlay?: Phaser.GameObjects.Container;
  private testArenaRestartKeyHandler?: () => void;
  private autoAttackEnabled = true;
  private manualAttackQueued = false;
  private manualAttackReadyAtMs = 0;
  private runSeedCounter = 1337;
  private lootSummaryText?: string;
  private runLootResolved = false;
  private essencesCollected = 0;
  private bossDefeated = false;
  private lastRunReport?: RunEndReport;

  constructor() {
    super({ key: 'DungeonScene' });
    for (const def of this.monstersCatalog) {
      this.monsterDefMap.set(def.id, def);
    }
  }

  public create(data?: {
    profileSnapshot?: SaveProfile;
    stageId?: CampaignStageId;
    testArena?: boolean;
  }): void {
    this.isTestArena = Boolean(data?.testArena);
    this.testArenaWave = 1;
    this.resetTestRoomState();
    this.testArenaFinished = false;
    this.testArenaFinishAtMs = undefined;
    this.testArenaObjects = [];
    this.testArenaTallProps = [];
    this.testArenaLights = [];
    this.testArenaFinishOverlay = undefined;
    this.autoAttackEnabled = true;
    this.manualAttackQueued = false;
    this.manualAttackReadyAtMs = 0;
    this.cameras.main.setBackgroundColor(
      this.isTestArena ? '#000000' : '#09090b'
    );
    this.ensureCampaignFallbackTextures();
    registerGameAnimations(this);

    const unlockAudio = () => {
      soundManager.unlock();
    };
    this.input.once('pointerdown', unlockAudio);
    this.input.keyboard?.once('keydown', unlockAudio);

    this.arenaLayer = this.add.container(0, 0).setDepth(1);
    this.lightingGraphics = this.add.graphics().setDepth(5);
    this.actorShadows = this.add.graphics().setDepth(7);
    this.heroAura = this.add.graphics().setDepth(19);

    this.vfx = new CombatVfxManager(this);
    this.hud = new DungeonHud(this, this.skillsCatalog, {
      onUseSkill: (skillId: string) => {
        this.handleUseSkill(skillId);
      },
      onRestartRun: () => {
        this.returnToHub();
      },
      onToggleInventory: () => {
        this.toggleInventoryModal();
      },
      onBasicAttack: () => {
        this.handleManualBasicAttack();
      },
      onToggleAutoAttack: () => {
        this.autoAttackEnabled = !this.autoAttackEnabled;
        if (this.autoAttackEnabled && this.hero) {
          this.hero.basicAttackReadyAtMs = Math.min(
            this.hero.basicAttackReadyAtMs,
            this.elapsedTimeMs
          );
        }
        soundManager.play('ui_click');
        this.updateHud(this.elapsedTimeMs);
      },
      onPickupNearest: () => {
        this.pickUpNearestDrop();
      },
    });

    this.inventoryModal = new InventoryModal(this, {
      onEquipItem: (instanceId: string) => {
        this.handleEquipItem(instanceId);
      },
      onUnequipSlot: (slot: EquipSlot) => {
        this.handleUnequipSlot(slot);
      },
      onClose: () => {
        this.updateHud(this.elapsedTimeMs);
      },
    });

    this.viewport = resolveViewportConfig(
      this.scale.width || 960,
      this.scale.height || 540
    );
    this.cameraRig = new SceneCameraRig(this, {
      width: this.viewport.width,
      height: this.viewport.height,
      worldZoom: this.getWorldZoom(),
      boundsWidth: this.viewport.width,
      boundsHeight: this.viewport.height,
    });

    this.isHeroActionAnimPlaying = false;
    this.currentHeroActionAnim = null;
    this.heroIsMoving = false;
    this.lastMoveDirX = 0;
    this.lastHeroFootstepFrame = -1;

    this.startNewRun(data);
    this.cameraRig.syncLayers();

    const onResize = (gameSize: Phaser.Structs.Size) => {
      this.handleViewportResize(gameSize.width, gameSize.height);
    };
    this.scale.on('resize', onResize);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', onResize);
      this.input.off('pointerdown', unlockAudio);
      this.input.keyboard?.off('keydown', unlockAudio);
      this.clearMonsterVisuals();
      this.clearGroundDrops();
      this.clearMinionVisuals();
      this.destroyPortal();
      this.cancelHeroImpacts();
      this.resetHeroSwing();
      this.weaponRig?.destroy();
      this.weaponRig = undefined;
      this.heroSprite = undefined;
      this.isHeroActionAnimPlaying = false;
      this.currentHeroActionAnim = null;
      this.heroIsMoving = false;
      this.heroFlipX = false;
      this.lastMoveDirX = 0;
      this.lastHeroFootstepFrame = -1;
      this.bannerText = undefined;
      this.bannerExpiresAtMs = 0;
      this.isTestArena = false;
      this.testArenaWave = 1;
      this.resetTestRoomState();
      // Camera manager may already be torn down during SHUTDOWN (return to Hub).
      this.cameras?.main?.resetFX();
      this.clearRangedArrows();
      this.testArenaFinishAtMs = undefined;
      this.destroyTestArenaFinishOverlay();
      this.clearTestArenaRoom();
      this.autoAttackEnabled = true;
      this.manualAttackQueued = false;
      this.manualAttackReadyAtMs = 0;
      this.cameraRig?.destroy();
      this.cameraRig = undefined;
      this.inventoryModal?.destroy();
      this.hud?.destroy();
    });

    if (typeof window !== 'undefined') {
      window.__SUBMUNDO_DEBUG__ = {
        scene: this,
        getRunState: () => this.runState,
        getHero: () => this.hero,
        getMonsters: () => this.monsters,
        getInventory: () => this.inventory,
        spawnTestDrop: (rarity?: Rarity) => this.spawnTestDrop(rarity),
        equipItem: (instanceId: string) => this.handleEquipItem(instanceId),
        triggerSkill: (id: string) => this.handleUseSkill(id),
        forceClearRoom: () => this.forceClearRoom(),
        advanceRoom: () => this.advanceRoomNow(),
        restartRun: (stageId?: CampaignStageId) =>
          this.startNewRun(stageId ? { stageId } : undefined),
        returnToHub: () => this.returnToHub(),
        getDungeonMap: () => this.dungeonMap,
        getActiveZoneIndex: () => this.testArenaRoomIndex,
        getTestRoomIndex: () => this.testArenaRoomIndex,
        getSealedDoorIds: () => [...this.sealedDoorIds],
        getTestRooms: () => [],
        getTestRoomWorldOrigins: () => [],
        getGroundDrops: () =>
          this.groundDrops.map((d) => ({
            x: d.position.x,
            y: d.position.y,
            item: d.item,
          })),
        pickUpDropAt: (index: number) => {
          const drop = this.groundDrops[index];
          return drop ? this.handleDropClick(drop) : false;
        },
        pickUpNearest: () => this.pickUpNearestDrop(),
        getBiomeId: () => this.testArenaBiome,
      };
    }
  }

  public update(_time: number, delta: number): void {
    if (!this.runState || !this.hero || !this.hud) {
      return;
    }

    if (this.inventoryModal?.isOpen()) {
      this.heroIsMoving = false;
      this.lastMoveDirX = 0;
      this.lastHeroFootstepFrame = -1;
      this.syncVisuals(this.elapsedTimeMs);
      this.updateHud(this.elapsedTimeMs);
      this.cameraRig?.syncLayers();
      return;
    }

    if (this.isTestArena && this.testArenaFinished) {
      // Combat and input are paused behind the "Teste finalizado" screen.
      this.heroIsMoving = false;
      this.lastMoveDirX = 0;
      this.syncVisuals(this.elapsedTimeMs);
      this.cameraRig?.syncLayers();
      return;
    }

    const clampedDelta = Math.min(Math.max(0, delta), 100);

    this.elapsedTimeMs += clampedDelta;
    const nowMs = this.elapsedTimeMs;

    const bounds = this.getActorBounds();

    const moveDir = this.resolveMoveDir(clampedDelta);
    const canMove =
      this.hero.isAlive &&
      (this.runState.status === 'in_progress' ||
        this.runState.status === 'room_cleared');
    this.heroIsMoving = canMove && (moveDir.x !== 0 || moveDir.y !== 0);
    this.lastMoveDirX = canMove ? moveDir.x : 0;
    // Facing is locked while a swing is in progress (BRF-131).
    if (canMove && moveDir.x !== 0 && !this.isHeroSwingActive()) {
      this.heroFlipX = moveDir.x < 0;
    }

    if (this.runState.status === 'in_progress' && this.hero.isAlive) {
      this.runState.elapsedMs += clampedDelta;

      moveHero(this.hero, moveDir, clampedDelta, bounds);
      this.constrainActorsToTestArenaRoom();

      if (!this.autoAttackEnabled) {
        if (this.manualAttackQueued) {
          this.manualAttackQueued = false;
          this.hero.basicAttackReadyAtMs = 0;
        } else {
          this.hero.basicAttackReadyAtMs = Math.max(
            this.hero.basicAttackReadyAtMs,
            nowMs + 120
          );
        }
      } else {
        this.manualAttackQueued = false;
      }

      const events = tickCombat(
        this.hero,
        this.monsters,
        clampedDelta,
        nowMs
      );
      this.constrainActorsToTestArenaRoom();
      this.processCombatEvents(events);
      this.checkAndUpdateRoomState(nowMs);
      this.checkTestRoomEntry();
    } else if (
      !this.isTestArena &&
      this.runState.status === 'room_cleared' &&
      this.hero.isAlive
    ) {
      moveHero(this.hero, moveDir, clampedDelta, bounds);
      this.roomClearTimerMs -= clampedDelta;

      const touchedPortal =
        this.portalPosition !== undefined &&
        distanceBetween(this.hero.position, this.portalPosition) <= 42;

      if (touchedPortal || this.roomClearTimerMs <= 0) {
        this.advanceRoomNow();
      }
    }

    this.syncVisuals(nowMs);
    this.updateHeroFootstepDust();
    this.updateHud(nowMs);
    this.cameraRig?.syncLayers();
  }

  public handleUseSkill(skillIdOrSlot: string): CombatEvent[] {
    if (
      !this.hero ||
      !this.hero.isAlive ||
      this.inventoryModal?.isOpen() ||
      (this.isTestArena && this.testArenaFinished) ||
      this.runState.status === 'victory' ||
      this.runState.status === 'defeat'
    ) {
      return [];
    }

    const nowMs = this.elapsedTimeMs;
    const bounds = this.getActorBounds();
    const moveDir = this.hud.getMoveVector();
    const prevHeroPos = { ...this.hero.position };

    const events = triggerHeroSkill(
      this.hero,
      skillIdOrSlot,
      this.monsters,
      nowMs,
      {
        bounds,
        direction:
          moveDir.x !== 0 || moveDir.y !== 0 ? moveDir : this.hero.facing,
        skillsCatalog: this.skillsCatalog,
      }
    );

    if (events.length > 0) {
      this.constrainActorsToTestArenaRoom();
      // Show dash trail from previous position if dash occurred
      if (events.some((e) => e.type === 'hero_dash')) {
        this.cancelPickupWalk();
        this.vfx.showDashTrail(prevHeroPos.x, prevHeroPos.y);
      }
      this.processCombatEvents(events);
      this.checkAndUpdateRoomState(nowMs);
      this.syncVisuals(nowMs);
      this.updateHud(nowMs);
    }

    return events;
  }

  private handleManualBasicAttack(): void {
    if (
      !this.hero ||
      !this.hero.isAlive ||
      !this.runState ||
      this.inventoryModal?.isOpen() ||
      (this.isTestArena && this.testArenaFinished) ||
      this.runState.status !== 'in_progress'
    ) {
      return;
    }

    const nowMs = this.elapsedTimeMs;
    if (nowMs < this.manualAttackReadyAtMs) {
      return;
    }

    const cooldownMs = Math.max(
      220,
      Math.round(this.hero.stats.attackCooldownMs * 0.65)
    );
    this.manualAttackReadyAtMs = nowMs + cooldownMs;

    const reach = this.hero.stats.attackRange + 28;
    let nearestTarget: MonsterInstance | undefined;
    let nearestDist = Number.POSITIVE_INFINITY;
    for (const monster of this.monsters) {
      if (!monster.isAlive || monster.hp <= 0) {
        continue;
      }
      const dist = distanceBetween(this.hero.position, monster.position);
      if (dist <= reach && dist < nearestDist) {
        nearestDist = dist;
        nearestTarget = monster;
      }
    }

    if (nearestTarget) {
      if (!this.isHeroSwingActive()) {
        this.faceHeroToward(nearestTarget.position.x);
      }

      if (this.autoAttackEnabled) {
        this.hero.basicAttackReadyAtMs = Math.min(
          this.hero.basicAttackReadyAtMs,
          nowMs
        );
      } else {
        this.manualAttackQueued = true;
        this.hero.basicAttackReadyAtMs = 0;
      }

      if (nearestDist <= this.hero.stats.attackRange) {
        return;
      }
    }

    // Whiff swing (no target in range): same swing timeline, no impact VFX.
    soundManager.play('attack');
    this.beginHeroSwing(false);
  }

  public forceClearRoom(): void {
    if (!this.runState || !this.hero) {
      return;
    }

    if (this.runState.status === 'room_cleared') {
      this.advanceRoomNow();
      return;
    }

    for (const monster of this.monsters) {
      if (monster.isAlive) {
        monster.hp = 0;
        monster.isAlive = false;
        this.hero.souls += monster.soulReward;
        this.runState.soulsCollected += monster.soulReward;
        this.runState.monstersKilled += 1;
        this.vfx.showSoulCollectEffect(
          monster.position.x,
          monster.position.y,
          monster.soulReward
        );
        soundManager.play('soul_pickup');
        if (monster.defId === 'infernal_warden' || monster.type === 'boss') {
          this.handleBossDefeated(monster.position, monster);
        }
      }
    }

    this.checkAndUpdateRoomState(this.elapsedTimeMs);
    this.syncVisuals(this.elapsedTimeMs);
    this.updateHud(this.elapsedTimeMs);
  }

  public advanceRoomNow(): void {
    if (!this.runState || !this.hero.isAlive) {
      return;
    }

    const nextRoom = advanceToNextRoom(this.runState);
    if (!nextRoom) {
      return;
    }

    this.loadCurrentRoom();
  }

  public returnToHub(): void {
    if ('HubScene' in this.scene.manager.keys) {
      this.scene.start('HubScene', { fromRun: this.lastRunReport });
      return;
    }
    this.startNewRun();
  }

  private startNewRun(data?: {
    profileSnapshot?: SaveProfile;
    stageId?: CampaignStageId;
    testArena?: boolean;
  }): void {
    const width = this.scale.width || 960;
    const height = this.scale.height || 540;

    this.isTestArena = Boolean(data?.testArena);
    this.testArenaWave = 1;
    this.resetTestRoomState();
    this.testArenaFinished = false;
    this.testArenaFinishAtMs = undefined;
    this.destroyTestArenaFinishOverlay();
    this.clearRangedArrows();
    this.cameras.main.resetFX();
    if (this.isTestArena) {
      this.testArenaSeed = resolveTestArenaSeed();
      this.testArenaMapMode = resolveTestArenaMapMode();
      this.testArenaBiome = resolveTestArenaBiome();
      const map = generateDungeonMap(this.testArenaSeed, {
        mode: this.testArenaMapMode,
      });
      this.dungeonMap = map;
      this.testDoorOpenFlags = map.zones.map(() => false);
      this.testEntryClosedFlags = map.zones.map(() => false);
      // Exit doors stay sealed until their zone is cleared.
      for (const zone of map.zones) {
        for (const id of zone.exitDoorIds) {
          this.sealedDoorIds.add(id);
        }
      }
    }
    this.autoAttackEnabled = true;
    this.manualAttackQueued = false;
    this.manualAttackReadyAtMs = 0;
    this.cameras.main.setBackgroundColor(
      this.isTestArena ? '#000000' : '#09090b'
    );

    this.elapsedTimeMs = 0;
    this.roomClearTimerMs = 0;
    this.bannerText = undefined;
    this.bannerExpiresAtMs = 0;
    this.lootSummaryText = undefined;
    this.runLootResolved = false;
    this.essencesCollected = 0;
    this.bossDefeated = false;
    this.lastRunReport = undefined;
    this.clearGroundDrops();
    this.clearMinionVisuals();
    if (this.inventoryModal?.isOpen()) {
      this.inventoryModal.close();
    }

    this.activeProfile = data?.profileSnapshot ?? loadOrCreateProfile();
    const campaign = ensureCampaignProgress(this.activeProfile);
    this.activeStage = getCampaignStage(data?.stageId ?? campaign.currentStageId);
    this.runState = createDungeonRun(
      width,
      height,
      this.runSeedCounter,
      this.activeStage
    );
    this.runSeedCounter += 7;

    const centerPos: Vector2D = {
      x: Math.round(width / 2),
      y: Math.round(height / 2),
    };
    this.hero = buildHeroFromProfile(this.activeProfile, centerPos);

    this.startingHubItemIds = new Set<string>();
    this.inventory = createRunInventory();
    for (const slot of EQUIP_SLOTS) {
      const equippedItem = this.activeProfile.equipped[slot];
      if (equippedItem !== null) {
        this.inventory.equipped[slot] = equippedItem;
        this.startingHubItemIds.add(equippedItem.instanceId);
      }
    }
    this.recalculateHeroGear();

    const heroKey: 'hero_living' | 'hero_wraith' =
      this.isTestArena || this.activeStage.phase === 'prologue'
        ? 'hero_living'
        : 'hero_wraith';
    this.heroSpriteKey = heroKey;
    this.isHeroActionAnimPlaying = false;
    this.currentHeroActionAnim = null;
    this.heroIsMoving = false;
    this.lastMoveDirX = 0;
    this.lastHeroFootstepFrame = -1;
    this.heroFlipX = this.hero.facing.x < 0;

    if (!this.heroSprite || !this.heroSprite.scene) {
      this.heroSprite = this.add
        .sprite(this.hero.position.x, this.hero.position.y, heroKey, 0)
        .setScale(0.88)
        .setDepth(20);
    } else {
      this.heroSprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
      this.heroSprite
        .setTexture(heroKey, 0)
        .setPosition(this.hero.position.x, this.hero.position.y)
        .setScale(0.88)
        .setDepth(20)
        .setAlpha(1)
        .clearTint();
    }

    this.weaponRig?.destroy();
    this.weaponRig = new HeroWeaponRig(
      this,
      this.heroSprite,
      this.inventory.equipped.weapon,
      this.heroSpriteKey === 'hero_wraith'
    );

    this.cameraRig?.follow(this.heroSprite);
    this.updateHeroLocomotionAnim();

    this.loadCurrentRoom();

    if (!this.isTestArena) {
      const introDialogueId =
        this.activeStage.introDialogueIds[
          this.activeStage.introDialogueIds.length - 1
        ];
      const introDialogue = introDialogueId
        ? getDialogueLine(introDialogueId)
        : null;
      this.showTimedBanner(
        introDialogue?.shortText ??
          introDialogue?.text ??
          dialoguesData.entries.dungeon_enter.shortText,
        3200
      );
    }
    this.syncVisuals(this.elapsedTimeMs);
    this.updateHud(this.elapsedTimeMs);
  }

  private loadCurrentRoom(): void {
    const width = this.scale.width || 960;
    const height = this.scale.height || 540;
    const currentRoom = getCurrentRoom(this.runState);

    this.destroyPortal();
    this.cancelHeroImpacts();
    this.resetHeroSwing();
    this.clearMonsterVisuals();
    this.clearGroundDrops();
    this.cancelHeroActionAnim();
    this.lastHeroFootstepFrame = -1;
    if (this.isTestArena) {
      this.clearMinionVisuals();
    }
    this.buildArenaTilesAndLighting(
      width,
      height,
      currentRoom.roomNumber,
      currentRoom.isBossRoom,
      currentRoom.biome
    );

    // Reposition hero at center of the new chamber
    this.hero.position = {
      x: Math.round(width / 2),
      y: Math.round(height / 2),
    };

    if (this.isTestArena) {
      const map = this.dungeonMap;
      if (map) {
        this.hero.position = { x: map.heroStart.x, y: map.heroStart.y };
        this.lastValidFeet.clear();
        this.constrainPositionToTestArenaRoom(this.hero.position, true);
        this.enterZone(0, true);
        this.cameras.main.centerOn(this.hero.position.x, this.hero.position.y);
      }
      return;
    }

    const difficultyScale =
      currentRoom.difficultyScale ?? this.activeStage?.difficultyScale ?? 1;

    // Spawn room monsters from core RoomSpec + monsters.json catalog
    this.monsters = currentRoom.spawns.map((spawn, idx) => {
      const baseDef =
        this.monsterDefMap.get(spawn.defId) ?? this.monstersCatalog[0];
      const scaledDef: MonsterDef =
        difficultyScale === 1
          ? baseDef
          : {
              ...baseDef,
              maxHp: Math.max(1, Math.round(baseDef.maxHp * difficultyScale)),
              attack: Math.max(1, Math.round(baseDef.attack * difficultyScale)),
            };
      const clampedX = Math.max(
        ARENA_PADDING,
        Math.min(width - ARENA_PADDING, spawn.x)
      );
      const clampedY = Math.max(
        ARENA_PADDING + 24,
        Math.min(height - ARENA_PADDING - 24, spawn.y)
      );
      return spawnMonster(
        scaledDef,
        `r${currentRoom.roomNumber}_m${idx}_${scaledDef.id}`,
        { x: clampedX, y: clampedY }
      );
    });

    for (const monster of this.monsters) {
      this.createMonsterVisual(monster);
    }

    if (currentRoom.isBossRoom) {
      if (this.activeStage?.id === 'prologue_seal') {
        const fallBossLine = getDialogueLine('village_fall_boss');
        this.showTimedBanner(
          fallBossLine?.shortText ?? currentRoom.title,
          4200
        );
      } else if (this.activeStage?.id === 'act1_submundo') {
        this.showTimedBanner(
          dialoguesData.entries.boss_intro.shortText,
          4000
        );
      } else {
        this.showTimedBanner(currentRoom.title, 3200);
      }
    } else if (currentRoom.roomNumber > 1) {
      this.showTimedBanner(currentRoom.title, 2000);
    }
  }

  private createMonsterVisual(monster: MonsterInstance): void {
    const isAbyssHerald = monster.defId === 'abyss_herald';
    const isAnimatedSpritesheet = ANIMATED_SPRITESHEET_MONSTERS.has(
      monster.spriteKey
    );
    const scale =
      monster.spriteKey === 'karnak'
        ? 1.06
        : isAnimatedSpritesheet
          ? 0.88
          : isAbyssHerald
            ? 1.75
            : 1.5;

    const sprite = this.add
      .sprite(monster.position.x, monster.position.y, monster.spriteKey, 0)
      .setScale(scale)
      .setDepth(monster.type === 'boss' ? 19 : 18);

    if (isAbyssHerald) {
      sprite.setTint(0xdc2626);
    }

    const idleKey = resolveMonsterAnimKey(monster.spriteKey, 'idle');
    if (idleKey && this.anims.exists(idleKey)) {
      sprite.play(idleKey, true);
    }

    const hpBar = this.add.graphics().setDepth(25);
    this.monsterVisuals.set(monster.instanceId, { sprite, hpBar });
  }

  private buildArenaTilesAndLighting(
    width: number,
    height: number,
    roomNumber: number,
    isBossRoom: boolean,
    biome?: BiomeId
  ): void {
    this.arenaLayer.removeAll(true);
    this.clearTestArenaRoom();

    if (this.isTestArena) {
      this.lightingGraphics.clear();
      this.buildTestArenaRoom();
      return;
    }

    this.cameras.main.setBounds(0, 0, width, height);

    const activeBiome: BiomeId =
      biome ?? this.activeStage?.biome ?? 'submundo_abyss';
    const isVillageBiome =
      activeBiome === 'village_grotto' ||
      activeBiome === 'village_mine' ||
      activeBiome === 'ancient_seal';
    const hasVillageTiles = this.textures.exists('village_tiles');
    const tileTextureKey =
      isVillageBiome && hasVillageTiles ? 'village_tiles' : 'dungeon_tiles';

    const cols = Math.ceil(width / TILE_DISPLAY_SIZE);
    const rows = Math.ceil(height / TILE_DISPLAY_SIZE);
    const hasTileFrames =
      this.textures.exists(tileTextureKey) &&
      this.textures.get(tileTextureKey).frameTotal > 4;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const isWall =
          row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
        const hash = (col * 31 + row * 17 + roomNumber * 13) % 7;
        const frameIndex = isWall ? 2 : hash === 0 ? 1 : 0;

        const tileX = col * TILE_DISPLAY_SIZE + TILE_DISPLAY_SIZE / 2;
        const tileY = row * TILE_DISPLAY_SIZE + TILE_DISPLAY_SIZE / 2;

        const tile = this.add.image(
          tileX,
          tileY,
          tileTextureKey,
          hasTileFrames ? frameIndex : undefined
        );
        tile.setDisplaySize(TILE_DISPLAY_SIZE, TILE_DISPLAY_SIZE);

        this.applyBiomeTileTint(tile, activeBiome, isWall, isBossRoom, hash);
        this.arenaLayer.add(tile);
      }
    }

    // Biome lighting and corner braziers / lanterns
    this.lightingGraphics.clear();
    const palette = this.resolveBiomeLighting(activeBiome, isBossRoom);

    // Outer dark vignette frame
    this.lightingGraphics.lineStyle(18, 0x09090b, 0.55);
    this.lightingGraphics.strokeRect(9, 9, width - 18, height - 18);

    // Inner barrier / ambient rim
    this.lightingGraphics.lineStyle(2, palette.borderGlow, 0.35);
    this.lightingGraphics.strokeRect(
      TILE_DISPLAY_SIZE,
      TILE_DISPLAY_SIZE,
      width - TILE_DISPLAY_SIZE * 2,
      height - TILE_DISPLAY_SIZE * 2
    );

    if (activeBiome === 'ancient_seal') {
      const cx = Math.round(width / 2);
      const cy = Math.round(height / 2);
      this.lightingGraphics.lineStyle(2, 0xdc2626, 0.25);
      this.lightingGraphics.strokeCircle(cx, cy, 86);
      this.lightingGraphics.lineStyle(1.5, 0xf87171, 0.22);
      this.lightingGraphics.strokeCircle(cx, cy, 56);
    }

    // 4 Corner braziers / lanterns
    const corners: Vector2D[] = [
      { x: TILE_DISPLAY_SIZE + 12, y: TILE_DISPLAY_SIZE + 28 },
      { x: width - TILE_DISPLAY_SIZE - 12, y: TILE_DISPLAY_SIZE + 28 },
      { x: TILE_DISPLAY_SIZE + 12, y: height - TILE_DISPLAY_SIZE - 28 },
      { x: width - TILE_DISPLAY_SIZE - 12, y: height - TILE_DISPLAY_SIZE - 28 },
    ];

    for (const corner of corners) {
      this.lightingGraphics.fillStyle(palette.secondaryGlow, 0.16);
      this.lightingGraphics.fillCircle(corner.x, corner.y, 44);
      this.lightingGraphics.fillStyle(palette.borderGlow, 0.26);
      this.lightingGraphics.fillCircle(corner.x, corner.y, 20);
      this.lightingGraphics.fillStyle(palette.coreGlow, 0.7);
      this.lightingGraphics.fillCircle(corner.x, corner.y, 4);
    }
  }

  private processCombatEvents(events: CombatEvent[]): void {
    // Core damage is already applied; only the visuals wait for the impact
    // moment of the swing that produced them (BRF-131).
    let basicImpactDelayMs = 0;
    let skillImpactDelayMs = 0;
    // Impact delay of the hero hit on each target in this batch, so a killing
    // blow can defer the death visuals to the same instant.
    const heroHitDelayByTarget = new Map<string, number>();
    for (const event of events) {
      switch (event.type) {
        case 'hero_basic_attack': {
          // Single attack sound: it marks the hit, so it plays at impact.
          const hitSound = event.isCrit ? 'crit' : 'attack';
          basicImpactDelayMs = this.beginHeroSwing(false, event.position.x);
          const targetId = event.targetId;
          const fallbackPos = { ...event.position };
          const isWraith = this.heroSpriteKey === 'hero_wraith';
          this.scheduleHeroImpact(basicImpactDelayMs, () => {
            soundManager.play(hitSound);
            const targetPos = this.resolveImpactPosition(targetId, fallbackPos);
            this.vfx.showSlashEffect(
              this.hero.position.x,
              this.hero.position.y,
              targetPos.x,
              targetPos.y,
              isWraith
            );
          });
          break;
        }

        case 'hero_dash': {
          soundManager.play('dash');
          this.vfx.showDashTrail(event.position.x, event.position.y);
          this.playHeroActionAnim('dash');
          break;
        }

        case 'hero_skill_used': {
          const skill = this.skillsCatalog.find((s) => s.id === event.skillId);
          if (skill) {
            if (skill.slot === 'potion') {
              soundManager.play('potion');
            } else if (skill.force === 'inferno') {
              soundManager.play('skill_inferno');
            } else if (skill.force === 'submundo') {
              soundManager.play('skill_submundo');
            } else if (skill.force === 'empireo') {
              soundManager.play('skill_empireo');
            }
          }
          if (
            skill &&
            (skill.slot === 'active_1' || skill.slot === 'active_2')
          ) {
            skillImpactDelayMs = this.beginHeroSwing(true);
            const areaPos = { ...event.position };
            const radius = skill.radius ?? 80;
            const force = skill.force;
            this.scheduleHeroImpact(skillImpactDelayMs, () => {
              this.vfx.showSkillAreaEffect(areaPos.x, areaPos.y, radius, force);
            });
          }
          break;
        }

        case 'hero_healed': {
          this.vfx.showHealEffect(
            event.position.x,
            event.position.y,
            event.value ?? 0
          );
          break;
        }

        case 'monster_damaged': {
          const targetId = event.targetId;
          const fallbackPos = { ...event.position };
          const value = event.value ?? 1;
          const isCrit = Boolean(event.isCrit);
          const playSkillCrit = isCrit && Boolean(event.skillId);
          const hitDelayMs = event.skillId
            ? skillImpactDelayMs
            : basicImpactDelayMs;
          if (targetId) {
            heroHitDelayByTarget.set(targetId, hitDelayMs);
          }
          this.scheduleHeroImpact(
            hitDelayMs,
            () => {
              if (playSkillCrit) {
                soundManager.play('crit');
              }
              const targetPos = this.resolveImpactPosition(
                targetId,
                fallbackPos
              );
              this.flashMonsterHit(targetId);
              this.vfx.showDamageNumber(
                targetPos.x,
                targetPos.y,
                value,
                isCrit,
                false
              );
            }
          );
          break;
        }

        case 'monster_killed': {
          // State (souls, counters, boss flag, loot roll) follows the core
          // immediately; only the death visuals wait for the hit's impact.
          const reward = event.value ?? 0;
          this.runState.soulsCollected += reward;
          this.runState.monstersKilled += 1;

          const killedId = event.targetId;
          const killedMonster = this.monsters.find(
            (m) => m.instanceId === killedId
          );
          const isBoss =
            killedMonster?.type === 'boss' ||
            killedMonster?.defId === 'infernal_warden';
          if (isBoss) {
            this.handleBossDefeated(event.position, killedMonster);
          }
          const droppedItem = shouldDropLoot(isBoss, Math.random, this.hero.luck)
            ? generateItemDrop({ luck: this.hero.luck, isBoss })
            : undefined;

          const deathPos = { ...event.position };
          const deathDelayMs = killedId
            ? (heroHitDelayByTarget.get(killedId) ?? 0)
            : 0;
          if (killedId && deathDelayMs > 0) {
            this.deferredDeathIds.add(killedId);
          }
          this.scheduleHeroImpact(deathDelayMs, () => {
            if (killedId) {
              this.deferredDeathIds.delete(killedId);
            }
            this.vfx.showSoulCollectEffect(deathPos.x, deathPos.y, reward);
            if (reward > 0) {
              soundManager.play('soul_pickup');
            }
            if (droppedItem) {
              this.spawnGroundDrop(droppedItem, deathPos);
            }
          });
          break;
        }

        case 'ember_explosion': {
          const radius = this.hero.activeLegendaryPowers.includes(
            'inferno_ember_nova'
          )
            ? 130
            : 90;
          this.vfx.showEmberExplosion(
            event.position.x,
            event.position.y,
            radius
          );
          break;
        }

        case 'lightning_chain': {
          const points = [event.position, ...(event.chainTargets ?? [])];
          this.vfx.showLightningChain(points);
          break;
        }

        case 'bleed_tick': {
          this.vfx.showBleedEffect(event.position.x, event.position.y);
          if ((event.value ?? 0) > 0) {
            this.vfx.showDamageNumber(
              event.position.x,
              event.position.y,
              event.value ?? 1,
              false,
              false
            );
          }
          break;
        }

        case 'lifesteal_heal': {
          this.vfx.showHealEffect(
            event.position.x,
            event.position.y,
            event.value ?? 1
          );
          break;
        }

        case 'minion_spawned': {
          this.vfx.showSkillAreaEffect(
            event.position.x,
            event.position.y,
            26,
            'submundo'
          );
          break;
        }

        case 'minion_attack': {
          if ((event.value ?? 0) > 0) {
            this.vfx.showDamageNumber(
              event.position.x,
              event.position.y,
              event.value ?? 1,
              false,
              false
            );
          }
          break;
        }

        case 'hero_damaged': {
          if (!this.isTestArena) {
            soundManager.play('hit_player');
            this.vfx.showDamageNumber(
              event.position.x,
              event.position.y,
              event.value ?? 1,
              false,
              true
            );
          }
          const attacker = this.monsters.find(
            (m) => m.instanceId === event.sourceId
          );
          const attackerVisual = attacker
            ? this.monsterVisuals.get(attacker.instanceId)
            : undefined;
          if (
            attacker &&
            attacker.isAlive &&
            attackerVisual &&
            !attackerVisual.isDying
          ) {
            const attackAnim = resolveMonsterAnimKey(
              attacker.spriteKey,
              'attack'
            );
            if (
              attackAnim &&
              attackAnim.endsWith('_attack') &&
              this.anims.exists(attackAnim)
            ) {
              attackerVisual.isActionPlaying = true;
              attackerVisual.sprite.play(attackAnim, true);
              attackerVisual.sprite.once(
                Phaser.Animations.Events.ANIMATION_COMPLETE,
                () => {
                  attackerVisual.isActionPlaying = false;
                }
              );
            }
            if (attacker.attackType === 'ranged') {
              this.spawnRangedArrow(attacker.position, this.hero.position);
            }
          }
          if (this.isTestArena) {
            this.hero.stats.hp = this.hero.stats.maxHp;
            this.hero.isAlive = true;
            break;
          }
          this.playHeroActionAnim('hit');
          if (this.heroSprite && this.hero.isAlive) {
            this.heroSprite.setTint(0xfca5a5);
            this.time.delayedCall(120, () => {
              if (this.hero.isAlive) {
                this.heroSprite?.clearTint();
              }
            });
          }
          break;
        }

        case 'hero_killed': {
          if (this.isTestArena) {
            this.hero.stats.hp = this.hero.stats.maxHp;
            this.hero.isAlive = true;
            return;
          }
          // Hero died mid-swing: show pending hits now, at last known points.
          this.flushHeroImpacts();
          this.resetHeroSwing();
          this.cancelHeroActionAnim();
          this.lastHeroFootstepFrame = -1;
          this.heroSprite?.stop();
          this.heroSprite?.setTint(0xef4444);
          this.heroSprite?.setAlpha(0.45);
          this.weaponRig?.setVisible(false);
          break;
        }
      }
    }
  }

  private handleBossDefeated(
    position: Vector2D,
    monster?: MonsterInstance
  ): void {
    if (this.bossDefeated) {
      return;
    }
    this.bossDefeated = true;

    const isAct1Warden =
      this.activeStage?.id === 'act1_submundo' &&
      (monster ? monster.defId === 'infernal_warden' : true);

    if (!isAct1Warden) {
      return;
    }

    this.essencesCollected += 1;
    this.vfx.showItemPickupBanner(
      position.x,
      position.y - 16,
      '+1 Essência de General',
      '#f59e0b'
    );
    this.showTimedBanner(
      dialoguesData.entries.boss_essence_drop.shortText,
      4000
    );
  }

  private currentZone(): MapZone | undefined {
    return this.dungeonMap?.zones[this.testArenaRoomIndex];
  }

  private resetTestRoomState(): void {
    this.testArenaRoomIndex = 0;
    this.dungeonMap = undefined;
    this.mapLayout = undefined;
    this.testRoomClearAtMs = undefined;
    this.testDoorOpenFlags = [];
    this.testEntryClosedFlags = [];
    this.sealedDoorIds.clear();
    this.lastValidFeet.clear();
  }

  /** Actor movement bounds: the whole map (world px) or the scene. */
  private getActorBounds(): { width: number; height: number; padding: number } {
    const map = this.isTestArena ? this.dungeonMap : undefined;
    if (map) {
      return {
        width: map.cols * MAP_TILE + 200,
        height: map.rows * MAP_TILE + 200,
        padding: 0,
      };
    }
    return {
      width: this.scale.width || 960,
      height: this.scale.height || 540,
      padding: ARENA_PADDING,
    };
  }

  /** The hero's feet entered zone `index`: its wave spawns and (rooms) the doors behind seal. */
  private enterZone(index: number, initial: boolean): void {
    const zone = this.dungeonMap?.zones[index];
    if (!zone) {
      return;
    }
    this.testArenaRoomIndex = index;
    this.testArenaWave = zone.wave;
    this.testRoomClearAtMs = undefined;
    this.testArenaFinishAtMs = undefined;
    if (!initial && zone.entryDoorIds.length > 0) {
      for (const id of zone.entryDoorIds) {
        this.setDoorSealed(id, true);
      }
      this.testEntryClosedFlags[index] = true;
    }
    this.spawnTestArenaWave();
    this.showTimedBanner(zone.banner, 2500);
  }

  private spawnTestArenaWave(): void {
    const zone = this.currentZone();
    this.monsters = [];
    if (!zone) {
      return;
    }
    zone.spawns.forEach((sp, i) => {
      const def = this.monsterDefMap.get(sp.defId);
      if (!def) {
        return;
      }
      const spawnPos: Vector2D = { x: sp.x, y: sp.y };
      this.constrainPositionToTestArenaRoom(spawnPos);
      const monster = spawnMonster(
        def,
        `test_z${zone.id}_${i}_${sp.defId}`,
        spawnPos
      );
      this.monsters.push(monster);
      this.createMonsterVisual(monster);
    });
  }

  // ===========================================================================
  // TEST ARENA: procedural DungeonMap, rooms or giant room (Decision #20, T-128)
  // ===========================================================================

  private buildTestArenaRoom(): void {
    const map = this.dungeonMap;
    if (!map) {
      return;
    }
    const T = MAP_TILE;
    const mapW = map.cols * T;
    const mapH = map.rows * T;
    const track = <O extends Phaser.GameObjects.GameObject>(obj: O): O =>
      this.trackTestObject(obj);
    this.lightingGraphics.clear();

    const theme = getBiomeTheme(this.testArenaBiome, this.textures);
    const light = theme.lighting;
    const hasTiles =
      this.textures.exists(theme.tilesKey) &&
      this.textures.get(theme.tilesKey).has(String(DUNGEON_TILE_FRAMES.length - 1));
    const hasProps =
      this.textures.exists(theme.propsKey) &&
      this.textures.get(theme.propsKey).has(String(theme.propFrames.length - 1));
    const hasTall =
      this.textures.exists(theme.tallKey) &&
      this.textures.get(theme.tallKey).has(String(theme.tallFrames.length - 1));

    if (!this.mapLayout) {
      this.mapLayout = autotileDungeonMap(map);
    }
    const layout = this.mapLayout;

    if (hasTiles) {
      // Static tilemap (culled to the camera): keeps the FPS on the giant map.
      this.mapView = new DungeonMapView(this, layout, 1, theme);
      for (const id of this.sealedDoorIds) {
        this.mapView.setDoorSealed(id, true);
      }
    } else {
      // Fallback (textures not loaded): flat floor blocks with the same geometry.
      const g = track(this.add.graphics().setDepth(1));
      g.fillStyle(0x1b2029, 1);
      for (let r = 0; r < map.rows; r++) {
        for (let c = 0; c < map.cols; c++) {
          if (map.cells[r * map.cols + c] !== MAP_CELL_VOID) {
            g.fillRect(c * T, r * T, T, T);
          }
        }
      }
    }

    // Torches on the upper wall face (skipped where a door was carved).
    const isFaceCell = (col: number, row: number): boolean => {
      const ref = layout.base[row * layout.cols + col];
      return !!ref && ref.frame.startsWith('wall_face_upper');
    };
    const torches = map.torches.filter((t) => isFaceCell(t.col, t.row));
    // Lights emitted by props (candles, crystals, braziers...).
    const propLights: Array<{ x: number; y: number; color: number; size: number; alpha: number }> = [];
    if (hasProps) {
      torches.forEach((t, i) => {
        // Above the darkness layer: the flame itself is never dimmed.
        const torch = track(
          this.add
            .sprite(t.col * T, t.row * T, theme.propsKey, i % 4)
            .setOrigin(0, 0)
            .setDepth(5.5)
        );
        if (this.anims.exists(theme.torchAnim)) {
          torch.play({ key: theme.torchAnim, startFrame: [0, 2, 1, 3][i % 4] });
        }
      });
      map.props
        .filter((p) => p.kind === 'floor')
        .sort((a, b) => a.y - b.y)
        .forEach((p, i) => {
          const frame = themePropFrame(theme, p.name, p.x, p.y);
          const index = frame ? theme.propFrames.indexOf(frame) : -1;
          if (!frame || index < 0) {
            return;
          }
          track(
            this.add
              .image(p.x, p.y, theme.propsKey, index)
              .setOrigin(0, 0)
              .setDepth(1.3 + i * 0.0001)
          );
          const glow = theme.propLights[frame];
          if (glow) {
            propLights.push({ ...glow, x: p.x + 16, y: p.y + (glow.dy ?? 16) });
          }
        });
    }
    if (hasTall) {
      for (const p of map.props) {
        if (p.kind !== 'tall') {
          continue;
        }
        const frame = themePropFrame(theme, p.name, p.x, p.y);
        const index = frame ? theme.tallFrames.indexOf(frame) : -1;
        const image = track(
          this.add
            .image(p.x + 16, p.y + 64 * 0.95, theme.tallKey, index >= 0 ? index : (p.frame ?? 0))
            .setOrigin(0.5, 0.95)
            .setDepth(4.5)
            .setTint(light.tallTint)
        );
        this.testArenaTallProps.push({ image, baseY: p.y + 61 });
        const glow = frame ? theme.propLights[frame] : undefined;
        if (glow) {
          propLights.push({ ...glow, x: p.x + 16, y: p.y + 61 + (glow.dy ?? 0) });
        }
      }
    }

    // Biome ambient darkness (normal blend, over floor/walls, under the actors).
    if (light.ambientAlpha > 0) {
      this.lightingGraphics.fillStyle(light.ambientColor, light.ambientAlpha);
      this.lightingGraphics.fillRect(0, 0, mapW, mapH);
    }

    // Torch halos in the biome's color (additive radial gradients).
    const k = light.torchIntensity;
    for (const t of torches) {
      const fx = t.col * T + 15.5;
      const fy = t.row * T + 9;
      this.addTestLight(fx, fy + 34, 230, 190, light.torchColor, 0.34 * k, true);
      this.addTestLight(fx, (t.row + 2) * T + 18, 120, 48, light.torchColor, 0.22 * k, true);
      this.addTestLight(fx, fy, 34, 34, light.torchCore, 0.55 * k, true);
    }
    for (const l of propLights) {
      this.addTestLight(l.x, l.y, l.size, l.size, l.color, l.alpha, true);
    }
    // Soft light around the hero in the dark biomes (follows him every frame).
    this.heroLight = undefined;
    if (light.heroLight) {
      const h = light.heroLight;
      this.heroLight = this.addTestLight(
        this.hero?.position.x ?? 0,
        (this.hero?.position.y ?? 0) + ACTOR_FEET_OFFSET * 0.5,
        h.w,
        h.h,
        h.color,
        h.alpha,
        false
      );
    }

    // Rune glow over every sealed door.
    this.doorGlows.clear();
    for (const id of this.sealedDoorIds) {
      this.addDoorGlow(id);
    }
    this.applyTestArenaCameraBounds();
  }

  private trackTestObject<O extends Phaser.GameObjects.GameObject>(obj: O): O {
    this.testArenaObjects.push(obj);
    return obj;
  }

  private addTestLight(
    x: number,
    y: number,
    w: number,
    h: number,
    tint: number,
    alpha: number,
    flicker: boolean
  ): Phaser.GameObjects.Image {
    const img = this.trackTestObject(
      this.add
        .image(x, y, this.ensureRadialLightTexture())
        .setDisplaySize(w, h)
        .setTint(tint)
        .setAlpha(alpha)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(6)
    );
    if (flicker) {
      this.testArenaLights.push({ image: img, baseAlpha: alpha });
    }
    return img;
  }

  private findDoor(id: number): MapDoor | undefined {
    return this.dungeonMap?.doors.find((d) => d.id === id);
  }

  private addDoorGlow(id: number): void {
    const door = this.findDoor(id);
    if (!door || this.doorGlows.has(id)) {
      return;
    }
    const c = doorCenter(door);
    this.doorGlows.set(id, this.addTestLight(c.x, c.y, 76, 76, 0xa855f7, 0.42, true));
  }

  private freeTestObjects(objs: Phaser.GameObjects.GameObject[]): void {
    for (const obj of objs) {
      this.testArenaLights = this.testArenaLights.filter(
        (l) => (l.image as unknown) !== obj
      );
      this.testArenaObjects = this.testArenaObjects.filter((o) => o !== obj);
      obj.destroy();
    }
  }

  /** Seals (rune frames + glow, blocks walking) or opens a door of the map. */
  private setDoorSealed(id: number, sealed: boolean): void {
    if (sealed) {
      this.sealedDoorIds.add(id);
    } else {
      this.sealedDoorIds.delete(id);
    }
    this.mapView?.setDoorSealed(id, sealed);
    const glow = this.doorGlows.get(id);
    if (!sealed && glow) {
      this.freeTestObjects([glow]);
      this.doorGlows.delete(id);
    } else if (sealed && !glow && this.mapView) {
      this.addDoorGlow(id);
    }
  }

  /** Zone cleared: its exit doors open (rooms mode) and the banner points the way. */
  private openZoneExits(index: number): void {
    const zone = this.dungeonMap?.zones[index];
    if (!zone || this.testDoorOpenFlags[index]) {
      return;
    }
    this.testDoorOpenFlags[index] = true;
    for (const id of zone.exitDoorIds) {
      this.setDoorSealed(id, false);
    }
    this.showTimedBanner(
      this.testArenaMapMode === 'giant'
        ? 'Zona limpa — siga em frente'
        : 'Sala limpa — siga pela porta',
      6000
    );
  }

  /** The next wave spawns only when the hero's feet WALK into the next zone's trigger. */
  private checkTestRoomEntry(): void {
    const map = this.dungeonMap;
    if (!this.isTestArena || !map || this.testArenaFinished || !this.hero.isAlive) {
      return;
    }
    const idx = this.testArenaRoomIndex;
    const next = map.zones[idx + 1];
    if (!next || !this.testDoorOpenFlags[idx]) {
      return;
    }
    const fx = this.hero.position.x;
    const fy = this.hero.position.y + MAP_FEET_OFFSET;
    if (next.trigger.some((r) => fx > r.x && fx < r.x + r.w && fy > r.y && fy < r.y + r.h)) {
      this.enterZone(idx + 1, false);
    }
  }

  /** Soft white radial gradient used (tinted, additive) for torch halos. */
  private ensureRadialLightTexture(): string {
    const key = 'test_arena_radial_light';
    if (this.textures.exists(key)) {
      return key;
    }
    const size = 128;
    const tex = this.textures.createCanvas(key, size, size);
    const ctx = tex?.getContext();
    if (tex && ctx) {
      const r = size / 2;
      const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.25, 'rgba(255,255,255,0.6)');
      grad.addColorStop(0.55, 'rgba(255,255,255,0.22)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      tex.refresh();
    }
    return key;
  }

  /** Destroys the map visuals (the map itself and the door state stay). */
  private clearTestArenaRoom(): void {
    for (const obj of this.testArenaObjects) {
      obj.destroy();
    }
    this.testArenaObjects = [];
    this.testArenaTallProps = [];
    this.testArenaLights = [];
    this.heroLight = undefined;
    this.doorGlows.clear();
    this.mapView?.destroy();
    this.mapView = undefined;
    this.actorShadows?.clear();
  }

  /** Camera bounds = the whole map. */
  private applyTestArenaCameraBounds(): void {
    const map = this.dungeonMap;
    if (!this.isTestArena || !map) {
      return;
    }
    const worldW = map.cols * MAP_TILE;
    const worldH = map.rows * MAP_TILE;
    const zoom = this.getWorldZoom();
    const viewW = (this.viewport.width || this.scale.width || 960) / zoom;
    const viewH = (this.viewport.height || this.scale.height || 540) / zoom;
    const padX = Math.max(0, (viewW - worldW) / 2);
    const padY = Math.max(0, (viewH - worldH) / 2);
    this.cameras.main.setBounds(-padX, -padY, worldW + padX * 2, worldH + padY * 2);
  }

  /**
   * Feet (world px) are valid when the whole feet box is on walkable cells (the zone room for
   * monsters), outside prop obstacles and, for the hero, outside sealed doors.
   */
  private isFeetValid(fx: number, fy: number, roomId: number | null): boolean {
    const map = this.dungeonMap;
    if (!map) {
      return true;
    }
    const T = MAP_TILE;
    const B = MAP_FEET_BOX;
    const l = fx - B.left;
    const r = fx + B.right;
    const t = fy - B.up;
    const b = fy + B.down;
    for (const x of [l, r]) {
      for (const y of [t, b]) {
        const c = Math.floor(x / T);
        const row = Math.floor(y / T);
        if (c < 0 || row < 0 || c >= map.cols || row >= map.rows) {
          return false;
        }
        const k = row * map.cols + c;
        if (roomId === null ? map.cells[k] === MAP_CELL_VOID : map.roomIdAt[k] !== roomId) {
          return false;
        }
      }
    }
    for (const o of map.obstacles) {
      if (fx > o.x && fx < o.x + o.w && fy > o.y && fy < o.y + o.h) {
        return false;
      }
    }
    if (roomId === null) {
      for (const id of this.sealedDoorIds) {
        const door = this.findDoor(id);
        if (!door) {
          continue;
        }
        const q = doorBlockRect(door);
        if (l < q.x + q.w && r > q.x && t < q.y + q.h && b > q.y) {
          return false;
        }
      }
    }
    return true;
  }

  private findNearestValidFeet(
    fx: number,
    fy: number,
    valid: (x: number, y: number) => boolean
  ): Vector2D {
    for (let rad = 8; rad <= 480; rad += 8) {
      const n = Math.max(8, Math.round(rad / 4));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = fx + Math.cos(a) * rad;
        const y = fy + Math.sin(a) * rad;
        if (valid(x, y)) {
          return { x, y };
        }
      }
    }
    const start = this.dungeonMap?.heroStart;
    return start ? { x: start.x, y: start.y + MAP_FEET_OFFSET } : { x: fx, y: fy };
  }

  /**
   * Moves an actor's feet from its last valid point toward its new position in <= 8 px steps,
   * sliding along walls (x then y), so nothing crosses a wall, a sealed door or a prop.
   */
  private constrainActor(key: string, pos: Vector2D, roomId: number | null): void {
    const valid = (x: number, y: number) => this.isFeetValid(x, y, roomId);
    const tx = pos.x;
    const ty = pos.y + MAP_FEET_OFFSET;
    const prev = this.lastValidFeet.get(key);
    let fx: number;
    let fy: number;
    if (!prev || !valid(prev.x, prev.y)) {
      if (valid(tx, ty)) {
        fx = tx;
        fy = ty;
      } else {
        const s = this.findNearestValidFeet(tx, ty, valid);
        fx = s.x;
        fy = s.y;
      }
    } else if (Math.hypot(tx - prev.x, ty - prev.y) > 400 && valid(tx, ty)) {
      // Explicit relocation (restart / debug), not a movement step.
      fx = tx;
      fy = ty;
    } else {
      fx = prev.x;
      fy = prev.y;
      const steps = Math.max(1, Math.ceil(Math.hypot(tx - fx, ty - fy) / 8));
      const sx = (tx - fx) / steps;
      const sy = (ty - fy) / steps;
      for (let i = 0; i < steps; i++) {
        const nx = fx + sx;
        const ny = fy + sy;
        if (valid(nx, ny)) {
          fx = nx;
          fy = ny;
        } else if (sx !== 0 && valid(nx, fy)) {
          fx = nx;
        } else if (sy !== 0 && valid(fx, ny)) {
          fy = ny;
        } else {
          // Corner assist: a straight move blocked by a corner slides sideways (<= 12 px off).
          const n = this.cornerNudge(fx, fy, sx, sy, valid);
          if (!n) {
            break;
          }
          fx = n.x;
          fy = n.y;
        }
      }
    }
    pos.x = fx;
    pos.y = fy - MAP_FEET_OFFSET;
    this.lastValidFeet.set(key, { x: fx, y: fy });
  }

  private cornerNudge(
    fx: number,
    fy: number,
    sx: number,
    sy: number,
    valid: (x: number, y: number) => boolean
  ): Vector2D | null {
    const alongY = Math.abs(sy) > Math.abs(sx) * 2;
    const alongX = Math.abs(sx) > Math.abs(sy) * 2;
    if (!alongX && !alongY) {
      return null;
    }
    for (let d = 1; d <= 12; d++) {
      for (const dir of [1, -1]) {
        const ox = alongY ? dir * d : 0;
        const oy = alongX ? dir * d : 0;
        if (!valid(fx + ox + sx, fy + oy + sy)) {
          continue;
        }
        const step = Math.min(d, 2);
        const px = fx + (alongY ? dir * step : 0);
        const py = fy + (alongX ? dir * step : 0);
        return valid(px, py) ? { x: px, y: py } : null;
      }
    }
    return null;
  }

  /** Snaps a position (actor centre) onto valid floor: hero = map, monster = zone room. */
  private constrainPositionToTestArenaRoom(pos: Vector2D, isHero = false): void {
    if (!this.dungeonMap) {
      return;
    }
    const roomId = isHero ? null : (this.currentZone()?.floorRoomId ?? null);
    const fy = pos.y + MAP_FEET_OFFSET;
    if (this.isFeetValid(pos.x, fy, roomId)) {
      return;
    }
    const s = this.findNearestValidFeet(pos.x, fy, (x, y) => this.isFeetValid(x, y, roomId));
    pos.x = s.x;
    pos.y = s.y - MAP_FEET_OFFSET;
  }

  private constrainActorsToTestArenaRoom(): void {
    if (!this.isTestArena || !this.dungeonMap) {
      return;
    }
    if (this.hero) {
      this.constrainActor('hero', this.hero.position, null);
    }
    const roomId = this.currentZone()?.floorRoomId ?? null;
    for (const monster of this.monsters) {
      if (monster.isAlive) {
        this.constrainActor(monster.instanceId, monster.position, roomId);
      }
    }
  }

  /** Per-frame room visuals: contact shadows, tall-prop depth and torch flicker. */
  private syncTestArenaRoomVisuals(nowMs: number): void {
    const shadows = this.actorShadows;
    if (!shadows) {
      return;
    }
    shadows.clear();
    if (!this.isTestArena || !this.dungeonMap) {
      return;
    }

    const drawShadow = (x: number, y: number, w: number, h: number, a: number) => {
      shadows.fillStyle(0x000000, a * 0.55);
      shadows.fillEllipse(x, y, w, h);
      shadows.fillStyle(0x000000, a);
      shadows.fillEllipse(x, y, w * 0.62, h * 0.6);
    };

    if (this.hero?.isAlive) {
      drawShadow(this.hero.position.x, this.hero.position.y + ACTOR_FEET_OFFSET, 38, 10, 0.32);
    }
    for (const monster of this.monsters) {
      const visual = this.monsterVisuals.get(monster.instanceId);
      if (!visual || !monster.isAlive || visual.isDying || !visual.sprite.visible) {
        continue;
      }
      const sprite = visual.sprite;
      const isFlyer = monster.spriteKey === 'cave_bat';
      const w = Math.min(64, Math.max(20, sprite.displayWidth * 0.42));
      const feetY = monster.position.y + sprite.displayHeight * 0.4;
      drawShadow(
        monster.position.x,
        feetY + (isFlyer ? 14 : 0),
        isFlyer ? w * 0.6 : w,
        isFlyer ? 7 : 10,
        isFlyer ? 0.2 : 0.32
      );
    }

    if (this.heroLight && this.hero) {
      this.heroLight.setPosition(
        this.hero.position.x,
        this.hero.position.y + ACTOR_FEET_OFFSET * 0.5
      );
    }

    // Tall props occlude the hero when he walks behind them.
    const heroFeetY = (this.hero?.position.y ?? 0) + ACTOR_FEET_OFFSET;
    for (const prop of this.testArenaTallProps) {
      prop.image.setDepth(heroFeetY < prop.baseY ? 20.5 : 4.5);
    }

    this.testArenaLights.forEach((light, i) => {
      const flicker =
        0.9 +
        Math.sin(nowMs * 0.011 + i * 1.7) * 0.05 +
        Math.sin(nowMs * 0.027 + i * 0.9) * 0.05;
      light.image.setAlpha(light.baseAlpha * flicker);
    });
  }

  private finishTestArena(): void {
    if (this.testArenaFinished) {
      return;
    }
    this.testArenaFinished = true;
    this.testArenaFinishAtMs = undefined;
    this.heroIsMoving = false;
    this.lastMoveDirX = 0;
    this.manualAttackQueued = false;
    this.bannerText = undefined;
    this.bannerExpiresAtMs = 0;
    if (this.inventoryModal?.isOpen()) {
      this.inventoryModal.close();
    }
    soundManager.play('victory');
    this.showTestArenaFinishOverlay(true);
    this.updateHud(this.elapsedTimeMs);
    this.cameraRig?.syncLayers();
  }

  private showTestArenaFinishOverlay(animate: boolean): void {
    this.destroyTestArenaFinishOverlay();
    const w = this.scale.width || 960;
    const h = this.scale.height || 540;

    const backdrop = this.add
      .rectangle(0, 0, w, h, 0x05060a, 0.86)
      .setOrigin(0, 0)
      .setInteractive();
    backdrop.on('pointerdown', () => this.restartTestArena());

    const ornament = this.add.graphics();
    ornament.lineStyle(1.5, 0xd4a95a, 0.85);
    ornament.lineBetween(w / 2 - 190, h / 2 - 42, w / 2 + 190, h / 2 - 42);
    ornament.lineBetween(w / 2 - 190, h / 2 + 30, w / 2 + 190, h / 2 + 30);
    ornament.fillStyle(0xf1d28a, 0.95);
    for (const y of [h / 2 - 42, h / 2 + 30]) {
      ornament.fillTriangle(w / 2, y - 5, w / 2 + 5, y, w / 2, y + 5);
      ornament.fillTriangle(w / 2, y - 5, w / 2 - 5, y, w / 2, y + 5);
    }

    const title = this.add
      .text(w / 2, h / 2 - 6, TEST_ARENA_FINISHED_TEXT, {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '44px',
        fontStyle: 'bold',
        color: '#f1d28a',
        stroke: '#120d06',
        strokeThickness: 6,
        resolution: 2,
      })
      .setOrigin(0.5)
      .setShadow(0, 3, '#000000', 8, true, true);

    const hint = this.add
      .text(w / 2, h / 2 + 58, 'Toque ou pressione Enter para reiniciar', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '16px',
        color: '#cbd5e1',
        stroke: '#05060a',
        strokeThickness: 3,
        resolution: 2,
      })
      .setOrigin(0.5);

    const overlay = this.add
      .container(0, 0, [backdrop, ornament, title, hint])
      .setDepth(3000);
    this.testArenaFinishOverlay = overlay;

    if (animate) {
      overlay.setAlpha(0);
      this.tweens.add({ targets: overlay, alpha: 1, duration: 280, ease: 'Quad.easeOut' });
    }
    this.tweens.add({
      targets: hint,
      alpha: 0.45,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const onEnter = () => this.restartTestArena();
    this.testArenaRestartKeyHandler = onEnter;
    this.input.keyboard?.on('keydown-ENTER', onEnter);
    this.cameraRig?.syncLayers();
  }

  private destroyTestArenaFinishOverlay(): void {
    if (this.testArenaRestartKeyHandler) {
      this.input.keyboard?.off('keydown-ENTER', this.testArenaRestartKeyHandler);
      this.testArenaRestartKeyHandler = undefined;
    }
    if (this.testArenaFinishOverlay) {
      this.tweens.killTweensOf(this.testArenaFinishOverlay);
      this.testArenaFinishOverlay.each((child: Phaser.GameObjects.GameObject) => {
        this.tweens.killTweensOf(child);
      });
      this.testArenaFinishOverlay.destroy();
      this.testArenaFinishOverlay = undefined;
    }
  }

  private restartTestArena(): void {
    if (!this.isTestArena || !this.testArenaFinished) {
      return;
    }
    soundManager.play('ui_click');
    this.destroyTestArenaFinishOverlay();
    this.scene.restart({ testArena: true });
  }

  private checkAndUpdateRoomState(nowMs: number): void {
    if (this.isTestArena) {
      if (this.bannerText && nowMs >= this.bannerExpiresAtMs) {
        this.bannerText = undefined;
      }
      const zone = this.currentZone();
      if (!zone || this.testArenaFinished) {
        return;
      }
      const cleared =
        this.monsters.length > 0 && this.monsters.every((m) => !m.isAlive);
      if (!cleared) {
        return;
      }
      if (zone.isBossZone) {
        if (this.testArenaFinishAtMs === undefined) {
          this.testArenaFinishAtMs = nowMs + TEST_ARENA_FINISH_DELAY_MS;
        } else if (nowMs >= this.testArenaFinishAtMs) {
          this.finishTestArena();
        }
      } else if (!this.testDoorOpenFlags[this.testArenaRoomIndex]) {
        if (this.testRoomClearAtMs === undefined) {
          this.testRoomClearAtMs = nowMs + 650;
        } else if (nowMs >= this.testRoomClearAtMs) {
          this.openZoneExits(this.testArenaRoomIndex);
        }
      }
      return;
    }

    const livingMonsters = this.monsters.filter((m) => m.isAlive).length;
    const previousStatus = this.runState.status;
    const nextStatus = evaluateRoomState(
      this.runState,
      livingMonsters,
      this.hero.isAlive
    );

    if (previousStatus !== nextStatus) {
      if (nextStatus === 'room_cleared') {
        this.roomClearTimerMs = ROOM_CLEAR_AUTO_ADVANCE_MS;
        this.spawnRoomPortal();
        this.showTimedBanner(
          dialoguesData.entries.room_clear.shortText,
          ROOM_CLEAR_AUTO_ADVANCE_MS
        );
      } else if (nextStatus === 'victory' || nextStatus === 'defeat') {
        this.finalizeRunOutcome(nextStatus === 'victory');
      }
    }

    if (this.bannerText && nowMs >= this.bannerExpiresAtMs) {
      this.bannerText = undefined;
    }
  }

  private finalizeRunOutcome(isVictory: boolean): void {
    // Deferred kill visuals may still hold loot: land them before resolving.
    this.flushHeroImpacts();
    if (isVictory) {
      this.collectRemainingDropsOnVictory();
    } else {
      this.clearGroundDrops();
    }

    soundManager.play(isVictory ? 'victory' : 'defeat');

    if (!this.runLootResolved) {
      this.runLootResolved = true;
      const { kept, lost } = resolveRunEndLoot(this.inventory, isVictory);
      const runKeptDrops = kept.filter(
        (item) => !this.startingHubItemIds.has(item.instanceId)
      );
      const runLostDrops = lost.filter(
        (item) => !this.startingHubItemIds.has(item.instanceId)
      );
      const preservedHubCount = isVictory
        ? kept.length - runKeptDrops.length
        : lost.length - runLostDrops.length;

      if (isVictory) {
        const parts = [`Novos itens extraídos: ${runKeptDrops.length}`];
        if (preservedHubCount > 0) {
          parts.push(`Gear do Refúgio mantido: ${preservedHubCount}`);
        }
        if (this.essencesCollected > 0) {
          parts.push(`+${this.essencesCollected} Essência de General`);
        }
        this.lootSummaryText = parts.join(' | ');
      } else {
        const parts = [`Itens perdidos na incursão: ${runLostDrops.length}`];
        if (preservedHubCount > 0) {
          parts.push(`Gear do Refúgio preservado: ${preservedHubCount}`);
        }
        this.lootSummaryText = parts.join(' | ');
      }

      const stageOutcome = applyStageOutcomeToCampaign(
        this.activeProfile,
        this.activeStage.id,
        isVictory
      );

      const report: RunEndReport = {
        victory: isVictory,
        soulsGained: this.runState.soulsCollected,
        essencesGained: this.essencesCollected,
        monstersKilled: this.runState.monstersKilled,
        bossDefeated: this.bossDefeated,
        keptItems: runKeptDrops,
        lostItems: runLostDrops,
        stageId: this.activeStage.id,
        triggeredVillageFall: stageOutcome.triggeredVillageFall,
      };
      this.lastRunReport = report;
      applyRunOutcomeToProfile(this.activeProfile, report);
      persistProfile(this.activeProfile);
    }

    if (this.inventoryModal?.isOpen()) {
      this.inventoryModal.close();
    }

    if (isVictory) {
      if (this.lastRunReport?.triggeredVillageFall) {
        const pactLine = getDialogueLine('village_fall_pact');
        const fallBanner = pactLine?.shortText
          ? `QUEDA DA VILA NATAL! ${pactLine.shortText} O Refúgio no Submundo (Ato 1) foi aberto.`
          : 'QUEDA DA VILA NATAL! O Emissário Celestial selou sua alma no Refúgio do Submundo (Ato 1).';
        this.showTimedBanner(fallBanner, 60000);
      } else {
        const firstVictoryId = this.activeStage.victoryDialogueIds[0];
        const victoryLine = firstVictoryId
          ? getDialogueLine(firstVictoryId)
          : null;
        this.showTimedBanner(
          victoryLine?.text ?? dialoguesData.entries.run_victory.text,
          60000
        );
      }
    } else {
      this.showTimedBanner(dialoguesData.entries.run_death.text, 60000);
    }
  }

  private spawnRoomPortal(): void {
    this.destroyPortal();

    const width = this.scale.width || 960;
    const height = this.scale.height || 540;
    const portalX = Math.round(width / 2);
    const portalY = Math.round(Math.max(88, height * 0.24));

    this.portalPosition = { x: portalX, y: portalY };

    const glow = this.add.graphics();
    glow.fillStyle(0x38bdf8, 0.28);
    glow.fillCircle(0, 0, 26);
    glow.lineStyle(2, 0xe0f2fe, 0.9);
    glow.strokeCircle(0, 0, 20);

    const hasTileFrames =
      this.textures.exists('dungeon_tiles') &&
      this.textures.get('dungeon_tiles').frameTotal > 4;
    const sprite = this.add
      .image(0, 0, 'dungeon_tiles', hasTileFrames ? 3 : undefined)
      .setDisplaySize(36, 36);

    const label = this.add
      .text(0, -28, 'Portal Espectral', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#e0f2fe',
        stroke: '#09090b',
        strokeThickness: 3,
        resolution: 2,
      })
      .setOrigin(0.5);

    this.portalContainer = this.add
      .container(portalX, portalY, [glow, sprite, label])
      .setDepth(15);
  }

  private destroyPortal(): void {
    if (this.portalContainer) {
      this.portalContainer.destroy();
      this.portalContainer = undefined;
    }
    this.portalPosition = undefined;
  }

  private syncVisuals(nowMs: number): void {
    // Sync Hero Sprite & Aura
    this.heroSprite?.setPosition(this.hero.position.x, this.hero.position.y);
    this.heroSprite?.setFlipX(this.heroFlipX);
    this.updateHeroLocomotionAnim();

    const isInvulnerable = nowMs < this.hero.invulnerableUntilMs;
    if (this.hero.isAlive) {
      const alpha = isInvulnerable ? 0.65 : 1;
      this.heroSprite?.setAlpha(alpha);
      this.weaponRig?.setVisible(true);
      this.weaponRig?.setAlpha(alpha);
    }
    this.weaponRig?.sync(this.heroIsMoving, nowMs);

    this.heroAura.clear();
    if (this.hero.isAlive) {
      this.heroAura.fillStyle(
        0x38bdf8,
        isInvulnerable ? 0.32 : 0.14
      );
      this.heroAura.fillCircle(
        this.hero.position.x,
        this.hero.position.y + 4,
        isInvulnerable ? 24 : 18
      );
    }

    // Sync Spectral Minions
    const activeMinionIds = new Set(this.hero.minions.map((m) => m.id));
    for (const [minionId, gfx] of this.minionVisuals.entries()) {
      if (!activeMinionIds.has(minionId)) {
        gfx.destroy();
        this.minionVisuals.delete(minionId);
      }
    }

    for (const minion of this.hero.minions) {
      let gfx = this.minionVisuals.get(minion.id);
      if (!gfx) {
        gfx = this.add.graphics().setDepth(19);
        gfx.fillStyle(0xef4444, 0.28);
        gfx.fillCircle(0, 0, 13);
        gfx.fillStyle(0xff4d6d, 0.92);
        gfx.fillTriangle(0, -8, 7, 5, -7, 5);
        gfx.lineStyle(1.5, 0xfca5a5, 0.95);
        gfx.strokeTriangle(0, -8, 7, 5, -7, 5);
        this.minionVisuals.set(minion.id, gfx);
      }
      gfx.setPosition(minion.position.x, minion.position.y);
    }

    // Sync Monster Sprites & Individual HP Bars
    for (const monster of this.monsters) {
      const visual = this.monsterVisuals.get(monster.instanceId);
      if (!visual || visual.deathFinished) {
        continue;
      }

      if (
        (!monster.isAlive || monster.hp <= 0) &&
        this.deferredDeathIds.has(monster.instanceId)
      ) {
        // Dead in the core, but the killing swing has not landed yet: freeze
        // the visual in place (no anim change, no attack) until impact.
        continue;
      }

      if (!monster.isAlive || monster.hp <= 0) {
        visual.hpBar.clear();
        visual.hpBar.setVisible(false);

        if (!visual.isDying) {
          const deathAnim = resolveMonsterAnimKey(monster.spriteKey, 'death');
          if (
            deathAnim &&
            deathAnim.endsWith('_death') &&
            this.anims.exists(deathAnim)
          ) {
            visual.isDying = true;
            visual.isActionPlaying = false;
            visual.sprite.setVisible(true);
            visual.sprite.play(deathAnim, true);
            visual.sprite.once(
              Phaser.Animations.Events.ANIMATION_COMPLETE,
              () => {
                if (!visual.sprite.scene) {
                  return;
                }
                this.tweens.add({
                  targets: visual.sprite,
                  alpha: 0,
                  duration: 250,
                  ease: 'Quad.easeOut',
                  onComplete: () => {
                    visual.deathFinished = true;
                    visual.sprite.setVisible(false);
                  },
                });
              }
            );
          } else {
            visual.deathFinished = true;
            visual.sprite.setVisible(false);
          }
        }
        continue;
      }

      visual.sprite.setVisible(true);
      visual.sprite.setPosition(monster.position.x, monster.position.y);
      visual.sprite.setFlipX(this.hero.position.x < monster.position.x);

      if (!visual.isActionPlaying) {
        const dist = distanceBetween(monster.position, this.hero.position);
        const desiredState = dist > monster.attackRange ? 'walk' : 'idle';
        const animKey = resolveMonsterAnimKey(monster.spriteKey, desiredState);
        if (
          animKey &&
          this.anims.exists(animKey) &&
          visual.sprite.anims.currentAnim?.key !== animKey
        ) {
          visual.sprite.play(animKey, true);
        }
      }

      const isBoss = monster.type === 'boss';
      const isAnimatedSpritesheet = ANIMATED_SPRITESHEET_MONSTERS.has(
        monster.spriteKey
      );
      const barWidth = isBoss ? 56 : 34;
      const barHeight = isBoss ? 6 : 4;
      const offsetY =
        monster.spriteKey === 'karnak'
          ? 56
          : monster.spriteKey === 'wolf_alpha'
            ? 40
            : monster.spriteKey === 'skeleton_chief'
              ? 38
              : isBoss
                ? 44
                : isAnimatedSpritesheet
                  ? 34
                  : 26;
      const barX = monster.position.x - barWidth / 2;
      const barY = monster.position.y - offsetY;
      const ratio =
        monster.maxHp > 0
          ? Math.max(0, Math.min(1, monster.hp / monster.maxHp))
          : 0;

      visual.hpBar.clear();
      visual.hpBar.setVisible(true);
      visual.hpBar.fillStyle(0x09090b, 0.9);
      visual.hpBar.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
      visual.hpBar.fillStyle(0x272730, 0.95);
      visual.hpBar.fillRect(barX, barY, barWidth, barHeight);
      visual.hpBar.fillStyle(isBoss ? 0xf97316 : 0xef4444, 1);
      visual.hpBar.fillRect(
        barX,
        barY,
        Math.max(2, Math.round(barWidth * ratio)),
        barHeight
      );
    }

    this.syncTestArenaRoomVisuals(nowMs);
  }

  private updateHud(nowMs: number): void {
    const currentRoom = getCurrentRoom(this.runState);
    const livingBosses = this.monsters.filter(
      (m) => m.isAlive && m.hp > 0 && m.type === 'boss'
    );
    let bossMonster: MonsterInstance | undefined;
    if (livingBosses.length > 0) {
      let nearestBossDist = Number.POSITIVE_INFINITY;
      for (const candidate of livingBosses) {
        const dist = distanceBetween(this.hero.position, candidate.position);
        if (dist < nearestBossDist) {
          nearestBossDist = dist;
          bossMonster = candidate;
        }
      }
    } else if (currentRoom.isBossRoom) {
      bossMonster =
        this.monsters.find((m) => m.type === 'boss') ??
        this.monsters.find((m) => m.defId === this.activeStage?.bossId);
    }

    const skillCooldownsMs: Record<string, number> = {};
    for (const skill of this.skillsCatalog) {
      const readyAt = Math.max(
        this.hero.skillReadyAtMs[skill.id] ?? 0,
        this.hero.skillReadyAtMs[skill.slot] ?? 0
      );
      skillCooldownsMs[skill.id] = Math.max(0, readyAt - nowMs);
    }

    const activeBanner =
      this.bannerText && nowMs < this.bannerExpiresAtMs
        ? this.bannerText
        : undefined;

    const equippedCount = (
      ['weapon', 'armor', 'helm', 'boots', 'amulet', 'ring'] as const
    ).filter((slot) => this.inventory.equipped[slot] !== null).length;

    const heroLevel =
      1 +
      (this.activeProfile
        ? Object.values(this.activeProfile.altarLevels).reduce(
            (a, b) => a + b,
            0
          )
        : 0);

    const testZone = this.isTestArena ? this.currentZone() : undefined;
    const testMap = this.isTestArena ? this.dungeonMap : undefined;
    const missionObjective = this.isTestArena
      ? this.testArenaFinished
        ? `Arena de Teste — ${TEST_ARENA_FINISHED_TEXT}`
        : (testZone?.title ?? 'Arena de Teste')
      : `${currentRoom.roomNumber}/${this.runState.totalRooms} — ${currentRoom.title}`;

    // Test arena: position relative to the whole map (world px).
    const minimap = {
      heroX: this.hero.position.x,
      heroY: this.hero.position.y,
      arenaWidth: testMap ? testMap.cols * MAP_TILE : this.scale.width || 960,
      arenaHeight: testMap ? testMap.rows * MAP_TILE : this.scale.height || 540,
      enemies: this.monsters
        .filter((m) => m.isAlive)
        .map((m) => ({
          x: m.position.x,
          y: m.position.y,
          isBoss: m.type === 'boss',
        })),
    };

    const nearestDrop = this.findNearestDrop();
    const snapshot: HudSnapshot = {
      pickupAvailable: Boolean(nearestDrop),
      pickupRarity: nearestDrop?.item.rarity,
      hp: this.hero.stats.hp,
      maxHp: this.hero.stats.maxHp,
      souls: this.hero.souls,
      essences: this.essencesCollected,
      heroPortraitFrame: this.heroSpriteKey === 'hero_wraith' ? 1 : 0,
      heroName: this.heroSpriteKey === 'hero_wraith' ? 'ESPECTRO' : 'GUERREIRO',
      heroLevel,
      autoAttackEnabled: this.autoAttackEnabled,
      isTestArena: this.isTestArena,
      missionObjective,
      minimap,
      roomNumber: currentRoom.roomNumber,
      totalRooms: this.runState.totalRooms,
      isBossRoom:
        currentRoom.isBossRoom ||
        livingBosses.length > 0 ||
        Boolean(testZone?.isBossZone),
      roomTitle: testZone?.title ?? currentRoom.title,
      stageName: this.activeStage?.name,
      bossHp: bossMonster?.hp,
      bossMaxHp: bossMonster?.maxHp,
      bossName: bossMonster?.name,
      potionCharges: this.hero.potionCharges,
      maxPotionCharges: this.hero.maxPotionCharges,
      skillCooldownsMs,
      runStatus: this.runState.status,
      bannerText: activeBanner,
      bagCount: this.inventory.bag.length,
      equippedCount,
      lootSummaryText: this.lootSummaryText,
    };

    this.hud.update(snapshot);
  }

  private getWorldZoom(): number {
    return 1.45;
  }

  private handleViewportResize(width: number, height: number): void {
    if (!this.runState || !this.hero || !this.hud) {
      return;
    }

    const viewport = resolveViewportConfig(width, height);
    this.viewport = viewport;
    const currentRoom = getCurrentRoom(this.runState);
    this.buildArenaTilesAndLighting(
      width,
      height,
      currentRoom.roomNumber,
      currentRoom.isBossRoom,
      currentRoom.biome
    );

    if (!this.isTestArena) {
      this.hero.position.x = Math.max(
        ARENA_PADDING,
        Math.min(width - ARENA_PADDING, this.hero.position.x)
      );
      this.hero.position.y = Math.max(
        ARENA_PADDING,
        Math.min(height - ARENA_PADDING, this.hero.position.y)
      );

      for (const monster of this.monsters) {
        monster.position.x = Math.max(
          ARENA_PADDING,
          Math.min(width - ARENA_PADDING, monster.position.x)
        );
        monster.position.y = Math.max(
          ARENA_PADDING,
          Math.min(height - ARENA_PADDING, monster.position.y)
        );
      }
    }

    for (const drop of this.isTestArena ? [] : this.groundDrops) {
      drop.position.x = Math.max(
        ARENA_PADDING,
        Math.min(width - ARENA_PADDING, drop.position.x)
      );
      drop.position.y = Math.max(
        ARENA_PADDING + 24,
        Math.min(height - ARENA_PADDING - 24, drop.position.y)
      );
      drop.sprite.setPosition(drop.position.x, drop.position.y);
      drop.glow.setPosition(drop.position.x, drop.position.y);
      drop.labelContainer.setPosition(
        drop.position.x,
        drop.position.y - GROUND_DROP_TAG_OFFSET_Y
      );
      drop.pillar?.setPosition(drop.position.x, drop.position.y);
    }

    this.constrainActorsToTestArenaRoom();

    this.cameraRig?.resize(
      viewport.width,
      viewport.height,
      this.getWorldZoom(),
      viewport.width,
      viewport.height
    );
    this.applyTestArenaCameraBounds();
    this.hud.resize(viewport);
    if (this.testArenaFinishOverlay) {
      this.showTestArenaFinishOverlay(false);
    }
    this.inventoryModal?.resize(viewport);
    this.syncVisuals(this.elapsedTimeMs);
    this.updateHud(this.elapsedTimeMs);
    this.cameraRig?.syncLayers();
  }

  private toggleInventoryModal(): void {
    if (
      !this.inventoryModal ||
      !this.runState ||
      (this.isTestArena && this.testArenaFinished) ||
      this.runState.status === 'victory' ||
      this.runState.status === 'defeat'
    ) {
      return;
    }

    if (this.inventoryModal.isOpen()) {
      this.inventoryModal.close();
    } else {
      this.inventoryModal.open(this.buildInventorySnapshot());
    }
    this.updateHud(this.elapsedTimeMs);
  }

  private handleEquipItem(instanceId: string): boolean {
    if (!this.inventory || !this.hero) {
      return false;
    }

    const result = equipItemFromBag(this.inventory, instanceId);
    if (!result) {
      return false;
    }

    soundManager.play('ui_click');
    this.recalculateHeroGear();
    if (this.inventoryModal?.isOpen()) {
      this.inventoryModal.update(this.buildInventorySnapshot());
    }
    this.updateHud(this.elapsedTimeMs);
    return true;
  }

  private handleUnequipSlot(slot: EquipSlot): boolean {
    if (!this.inventory || !this.hero) {
      return false;
    }

    const ok = unequipSlotToBag(this.inventory, slot);
    if (!ok) {
      return false;
    }

    soundManager.play('ui_click');
    this.recalculateHeroGear();
    if (this.inventoryModal?.isOpen()) {
      this.inventoryModal.update(this.buildInventorySnapshot());
    }
    this.updateHud(this.elapsedTimeMs);
    return true;
  }

  private recalculateHeroGear(): void {
    const altarBonuses = this.activeProfile
      ? computeAltarBonuses(this.activeProfile)
      : undefined;
    applyGearToHero(this.hero, this.hero.baseStats, this.inventory.equipped);
    const bonuses = computeGearBonuses(this.inventory.equipped);
    this.hero.lifeSteal = Math.max(
      0,
      (altarBonuses?.lifeSteal ?? 0) + bonuses.lifeSteal
    );
    this.hero.cooldownReduction = Math.max(
      0,
      (altarBonuses?.cooldownReduction ?? 0) + bonuses.cooldownReduction
    );
    this.hero.luck = Math.max(0, (altarBonuses?.luck ?? 0) + bonuses.luck);
    this.hero.equippedForces = getActiveForces(this.inventory.equipped);
    this.hero.activeLegendaryPowers = getActiveLegendaryPowers(
      this.inventory.equipped
    );
    this.weaponRig?.setEquippedWeapon(
      this.inventory.equipped.weapon,
      this.heroSpriteKey === 'hero_wraith'
    );
  }

  private buildInventorySnapshot(): InventoryHudSnapshot {
    return {
      equipped: { ...this.inventory.equipped },
      bag: [...this.inventory.bag],
      heroStats: { ...this.hero.stats },
      lifeSteal: this.hero.lifeSteal,
      cooldownReduction: this.hero.cooldownReduction,
      luck: this.hero.luck,
      activeForces: { ...this.hero.equippedForces },
    };
  }

  private createLegendaryLootPillar(
    x: number,
    y: number
  ): { pillar: Phaser.GameObjects.Graphics; tween: Phaser.Tweens.Tween } {
    const pillar = this.add.graphics({ x, y }).setDepth(15);
    const totalHeight = 190;
    const segments = 10;
    const segmentHeight = totalHeight / segments;

    // Camadas verticais douradas/alaranjadas com decaimento suave de alpha
    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const fade = Math.pow(1 - t, 1.55);
      const segY = -(i + 1) * segmentHeight;
      const overlap = 1;

      const outerWidth = 26 * (1 - t * 0.42);
      pillar.fillStyle(0xf97316, 0.22 * fade);
      pillar.fillRect(
        -outerWidth / 2,
        segY,
        outerWidth,
        segmentHeight + overlap
      );

      const midWidth = 12 * (1 - t * 0.48);
      pillar.fillStyle(0xfde047, 0.36 * fade);
      pillar.fillRect(-midWidth / 2, segY, midWidth, segmentHeight + overlap);

      const coreWidth = Math.max(2, 4 * (1 - t * 0.5));
      pillar.fillStyle(0xfffbeb, 0.72 * fade);
      pillar.fillRect(-coreWidth / 2, segY, coreWidth, segmentHeight + overlap);
    }

    // Anel radiante na base do item lendário no chão
    pillar.fillStyle(0xf97316, 0.22);
    pillar.fillEllipse(0, 2, 42, 16);
    pillar.fillStyle(0xfde047, 0.34);
    pillar.fillEllipse(0, 1, 26, 10);
    pillar.lineStyle(1.8, 0xfde047, 0.85);
    pillar.strokeEllipse(0, 2, 34, 13);
    pillar.lineStyle(1.2, 0xfffbeb, 0.9);
    pillar.strokeEllipse(0, 2, 20, 8);

    const tween = this.tweens.add({
      targets: pillar,
      alpha: { from: 0.82, to: 1 },
      scaleX: { from: 0.94, to: 1.06 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    return { pillar, tween };
  }

  private createGroundDropLabel(
    item: ItemInstance,
    x: number,
    y: number,
    rarityNum: number
  ): Phaser.GameObjects.Container {
    const rarityLabel = DF_RARITY_THEME[item.rarity].label;
    const tagText = this.add
      .text(0, 0, `[${item.name} (${rarityLabel})]`, {
        fontFamily: DF_FONTS.BODY,
        fontSize: '10px',
        fontStyle: 'bold',
        color: GROUND_DROP_TAG_COLORS[item.rarity],
        stroke: '#090b10',
        strokeThickness: 2,
        resolution: 2,
      })
      .setOrigin(0.5);

    const padX = 7;
    const padY = 3;
    const boxW = Math.ceil(tagText.width) + padX * 2;
    const boxH = Math.ceil(tagText.height) + padY * 2;
    const tagBg = this.add.graphics();
    tagBg.fillStyle(0x090b10, 0.78);
    tagBg.fillRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 4);
    tagBg.lineStyle(
      1,
      item.rarity === 'legendary' ? 0xf97316 : rarityNum,
      item.rarity === 'legendary' ? 0.65 : 0.32
    );
    tagBg.strokeRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 4);

    return this.add
      .container(x, y - GROUND_DROP_TAG_OFFSET_Y, [tagBg, tagText])
      .setDepth(28);
  }

  private destroyGroundDropVisuals(drop: GroundDrop): void {
    if (this.pickupTarget === drop) {
      this.cancelPickupWalk();
    }
    if (drop.pillarTween) {
      drop.pillarTween.stop();
      drop.pillarTween = undefined;
    }
    if (drop.pillar) {
      this.tweens?.killTweensOf(drop.pillar);
      drop.pillar.destroy();
      drop.pillar = undefined;
    }
    drop.labelContainer.destroy(true);
    drop.sprite.destroy();
    drop.glow.destroy();
  }

  private spawnGroundDrop(item: ItemInstance, rawPosition: Vector2D): void {
    const width = this.scale.width || 960;
    const height = this.scale.height || 540;
    const x = this.isTestArena
      ? rawPosition.x
      : Math.max(ARENA_PADDING, Math.min(width - ARENA_PADDING, rawPosition.x));
    const y = this.isTestArena
      ? rawPosition.y
      : Math.max(
          ARENA_PADDING + 24,
          Math.min(height - ARENA_PADDING - 24, rawPosition.y)
        );

    const rarityNum = Number.parseInt(
      RARITY_COLORS[item.rarity].replace('#', ''),
      16
    );
    const glow = this.add.graphics({ x, y }).setDepth(14);
    glow.fillStyle(rarityNum, 0.24);
    glow.fillCircle(0, 0, 15);
    glow.lineStyle(1.5, rarityNum, 0.9);
    glow.strokeCircle(0, 0, 13);

    const hasDropFrames =
      this.textures.exists('loot_drops') &&
      this.textures.get('loot_drops').frameTotal > 4;
    const frameIndex = hasDropFrames ? RARITY_DROP_FRAME[item.rarity] : 0;
    const sprite = this.add
      .sprite(x, y, 'loot_drops', frameIndex)
      .setScale(1.5)
      .setDepth(16);

    const labelContainer = this.createGroundDropLabel(item, x, y, rarityNum);

    // REGRA INEGOCIÁVEL: pilar de luz vertical EXCLUSIVAMENTE em itens Lendários
    let pillar: Phaser.GameObjects.Graphics | undefined;
    let pillarTween: Phaser.Tweens.Tween | undefined;
    if (item.rarity === 'legendary') {
      const created = this.createLegendaryLootPillar(x, y);
      pillar = created.pillar;
      pillarTween = created.tween;
    }

    soundManager.play(
      item.rarity === 'legendary' ? 'loot_legendary' : 'loot_drop'
    );
    this.vfx.showLootDropBeam(x, y, item.rarity);
    const drop: GroundDrop = {
      item,
      position: { x, y },
      sprite,
      glow,
      labelContainer,
      pillar,
      pillarTween,
    };
    this.groundDrops.push(drop);
    this.makeDropInteractive(drop);
  }

  /** Sprite, glow and name tag all take clicks/taps (>= 44 px hit areas). */
  private makeDropInteractive(drop: GroundDrop): void {
    const onDown = (
      _pointer: Phaser.Input.Pointer,
      _lx: number,
      _ly: number,
      event: Phaser.Types.Input.EventData
    ) => {
      event?.stopPropagation();
      this.handleDropClick(drop);
    };

    const sw = drop.sprite.width || 16;
    const sh = drop.sprite.height || 16;
    const localW = Math.max(sw, DROP_HIT_SIZE / Math.max(0.1, drop.sprite.scaleX));
    const localH = Math.max(sh, DROP_HIT_SIZE / Math.max(0.1, drop.sprite.scaleY));
    drop.sprite
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(
          (sw - localW) / 2,
          (sh - localH) / 2,
          localW,
          localH
        ),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      })
      .on('pointerdown', onDown);

    drop.glow
      .setInteractive({
        hitArea: new Phaser.Geom.Circle(0, 0, DROP_HIT_SIZE / 2),
        hitAreaCallback: Phaser.Geom.Circle.Contains,
        useHandCursor: true,
      })
      .on('pointerdown', onDown);

    const bounds = drop.labelContainer.getBounds();
    drop.labelContainer
      .setSize(
        Math.max(bounds.width, DROP_HIT_SIZE),
        Math.max(bounds.height, DROP_HIT_SIZE)
      )
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onDown);
  }

  /** Click/tap on a ground item: collect when near, otherwise walk to it. */
  private handleDropClick(drop: GroundDrop): boolean {
    if (
      !this.groundDrops.includes(drop) ||
      !this.hero?.isAlive ||
      !this.runState ||
      this.inventoryModal?.isOpen() ||
      (this.isTestArena && this.testArenaFinished) ||
      this.runState.status === 'victory' ||
      this.runState.status === 'defeat'
    ) {
      return false;
    }
    if (distanceBetween(this.hero.position, drop.position) <= DROP_CLICK_REACH) {
      this.cancelPickupWalk();
      return this.collectDrop(drop);
    }
    this.pickupTarget = drop;
    this.pickupLastPos = undefined;
    this.pickupStuckMs = 0;
    return true;
  }

  /** Nearest ground item to the hero's feet within the search radius. */
  private findNearestDrop(): GroundDrop | undefined {
    if (!this.hero) {
      return undefined;
    }
    let best: GroundDrop | undefined;
    let bestDist = DROP_NEAREST_SEARCH_RADIUS;
    for (const drop of this.groundDrops) {
      const dist = distanceBetween(this.hero.position, drop.position);
      if (dist <= bestDist) {
        best = drop;
        bestDist = dist;
      }
    }
    return best;
  }

  /** "Pegar" button / E key: same as clicking the nearest item in range. */
  private pickUpNearestDrop(): boolean {
    const drop = this.findNearestDrop();
    return drop ? this.handleDropClick(drop) : false;
  }

  private cancelPickupWalk(): void {
    this.pickupTarget = undefined;
    this.pickupLastPos = undefined;
    this.pickupStuckMs = 0;
  }

  /** Player input beats the auto-walk; otherwise steer straight at the item. */
  private resolveMoveDir(deltaMs: number): Vector2D {
    const input = this.hud.getMoveVector();
    const target = this.pickupTarget;
    if (!target) {
      return input;
    }
    if (
      input.x !== 0 ||
      input.y !== 0 ||
      !this.hero.isAlive ||
      !this.groundDrops.includes(target)
    ) {
      this.cancelPickupWalk();
      return input;
    }
    const dx = target.position.x - this.hero.position.x;
    const dy = target.position.y - this.hero.position.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= DROP_WALK_ARRIVE) {
      this.cancelPickupWalk();
      this.collectDrop(target);
      return { x: 0, y: 0 };
    }
    // Give up when blocked (walls/obstacles): barely moved for ~0.5 s.
    if (this.pickupLastPos) {
      const moved = distanceBetween(this.hero.position, this.pickupLastPos);
      const expected = (this.hero.stats.moveSpeed * deltaMs) / 1000;
      this.pickupStuckMs = moved < expected * 0.25 ? this.pickupStuckMs + deltaMs : 0;
      if (this.pickupStuckMs > 500) {
        this.cancelPickupWalk();
        // Blocked right beside the item (prop in the way): still collect it.
        if (dist <= DROP_CLICK_REACH) {
          this.collectDrop(target);
        }
        return { x: 0, y: 0 };
      }
    }
    this.pickupLastPos = { ...this.hero.position };
    return { x: dx / dist, y: dy / dist };
  }

  private spawnTestDrop(rarity?: Rarity): ItemInstance {
    const item = generateItemDrop({
      luck: this.hero.luck,
      forcedRarity: rarity,
    });
    this.spawnGroundDrop(item, {
      x: this.hero.position.x + 48,
      y: this.hero.position.y,
    });
    return item;
  }

  /** Same routine as the old proximity pickup (bag, auto-equip, feedback). */
  private collectDrop(drop: GroundDrop): boolean {
    const added = addItemToBag(this.inventory, drop.item);
    if (!added) {
      this.showTimedBanner('Mochila cheia', 1800);
      return false;
    }
    this.groundDrops = this.groundDrops.filter((d) => d !== drop);
    this.destroyGroundDropVisuals(drop);
    if (this.inventory.equipped[drop.item.slot] === null) {
      equipItemFromBag(this.inventory, drop.item.instanceId);
      this.recalculateHeroGear();
    }
    this.vfx.showItemPickupBanner(
      drop.position.x,
      drop.position.y,
      drop.item.name,
      RARITY_COLORS[drop.item.rarity]
    );
    if (this.inventoryModal?.isOpen()) {
      this.inventoryModal.update(this.buildInventorySnapshot());
    }
    return true;
  }

  private collectRemainingDropsOnVictory(): void {
    if (this.groundDrops.length === 0) {
      return;
    }
    for (const drop of this.groundDrops) {
      const added = addItemToBag(this.inventory, drop.item);
      if (added) {
        if (this.inventory.equipped[drop.item.slot] === null) {
          equipItemFromBag(this.inventory, drop.item.instanceId);
          this.recalculateHeroGear();
        }
        this.vfx.showItemPickupBanner(
          drop.position.x,
          drop.position.y,
          drop.item.name,
          RARITY_COLORS[drop.item.rarity]
        );
      }
      this.destroyGroundDropVisuals(drop);
    }
    this.groundDrops = [];
  }

  private clearGroundDrops(): void {
    for (const drop of this.groundDrops) {
      this.destroyGroundDropVisuals(drop);
    }
    this.groundDrops = [];
  }

  private clearMinionVisuals(): void {
    for (const gfx of this.minionVisuals.values()) {
      gfx.destroy();
    }
    this.minionVisuals.clear();
  }

  private showTimedBanner(text: string, durationMs: number): void {
    this.bannerText = text;
    this.bannerExpiresAtMs = this.elapsedTimeMs + durationMs;
  }

  private clearRangedArrows(): void {
    for (const arrow of this.rangedArrows) {
      this.tweens.killTweensOf(arrow);
      arrow.destroy();
    }
    this.rangedArrows = [];
  }

  private clearMonsterVisuals(): void {
    this.deferredDeathIds.clear();
    for (const visual of this.monsterVisuals.values()) {
      this.tweens.killTweensOf(visual.sprite);
      visual.sprite.destroy();
      visual.hpBar.destroy();
    }
    this.monsterVisuals.clear();
  }

  private isHeroSwingActive(): boolean {
    return this.time.now < this.heroSwingEndsAtMs;
  }

  private resetHeroSwing(): void {
    this.heroSwingEndsAtMs = 0;
    this.heroSwingImpactAtMs = 0;
  }

  private faceHeroToward(targetX: number): void {
    const dx = targetX - this.hero.position.x;
    if (Math.abs(dx) > 0.5 && (!this.heroIsMoving || this.lastMoveDirX === 0)) {
      this.heroFlipX = dx < 0;
      this.heroSprite?.setFlipX(this.heroFlipX);
    }
  }

  /**
   * Starts a hero swing (body `attack` + weapon rig) and returns the delay in
   * ms until its impact. While a swing is in progress nothing is restarted and
   * facing stays locked; the new hit lands on the current swing's impact.
   */
  private beginHeroSwing(isSkill: boolean, targetX?: number): number {
    const now = this.time.now;
    if (now < this.heroSwingEndsAtMs) {
      return Math.max(0, this.heroSwingImpactAtMs - now);
    }

    if (targetX !== undefined) {
      this.faceHeroToward(targetX);
    }
    const durationMs = isSkill
      ? HERO_SKILL_ATTACK_DURATION_MS
      : HERO_ATTACK_DURATION_MS;
    const impactMs = isSkill ? HERO_SKILL_ATTACK_IMPACT_MS : HERO_ATTACK_IMPACT_MS;
    this.heroSwingEndsAtMs = now + durationMs;
    this.heroSwingImpactAtMs = now + impactMs;

    // Skills drive the body even while walking; basic swings only when still.
    if (
      this.currentHeroActionAnim !== 'dash' &&
      (isSkill || !this.heroIsMoving)
    ) {
      this.playHeroActionAnim('attack');
    }
    this.weaponRig?.playAttackSwing(this.heroFlipX, isSkill);
    return impactMs;
  }

  private scheduleHeroImpact(delayMs: number, show: () => void): void {
    if (delayMs <= 0) {
      show();
      return;
    }
    const timer = this.time.delayedCall(delayMs, () => {
      this.pendingHeroImpacts = this.pendingHeroImpacts.filter(
        (pending) => pending.timer !== timer
      );
      show();
    });
    this.pendingHeroImpacts.push({ timer, show });
  }

  /** Runs every pending impact visual right now (e.g. the hero died). */
  private flushHeroImpacts(): void {
    const pending = this.pendingHeroImpacts;
    this.pendingHeroImpacts = [];
    for (const entry of pending) {
      entry.timer.remove(false);
      entry.show();
    }
  }

  /** Drops pending impact visuals without showing them (room/run reset). */
  private cancelHeroImpacts(): void {
    for (const entry of this.pendingHeroImpacts) {
      entry.timer.remove(false);
    }
    this.pendingHeroImpacts = [];
    this.deferredDeathIds.clear();
  }

  /** Current target position, or its last known point if it is gone. */
  private resolveImpactPosition(
    targetId: string | undefined,
    fallback: Vector2D
  ): Vector2D {
    const monster = targetId
      ? this.monsters.find((m) => m.instanceId === targetId)
      : undefined;
    return monster ? { ...monster.position } : fallback;
  }

  private flashMonsterHit(targetId: string | undefined): void {
    if (!targetId) {
      return;
    }
    const monster = this.monsters.find((m) => m.instanceId === targetId);
    const visual = this.monsterVisuals.get(targetId);
    if (!monster || !visual || visual.isDying || !visual.sprite.scene) {
      return;
    }
    const sprite = visual.sprite;
    sprite.setTintFill(0xffffff);
    this.time.delayedCall(MONSTER_HIT_FLASH_MS, () => {
      if (!sprite.scene) {
        return;
      }
      if (monster.defId === 'abyss_herald') {
        sprite.setTint(0xdc2626);
      } else {
        sprite.clearTint();
      }
    });
  }

  private playHeroActionAnim(action: 'attack' | 'dash' | 'hit'): void {
    if (!this.heroSprite || !this.hero.isAlive) {
      return;
    }

    if (
      this.isHeroActionAnimPlaying &&
      this.currentHeroActionAnim === 'dash' &&
      action !== 'dash'
    ) {
      return;
    }

    const animKey = `${this.heroSpriteKey}_${action}`;
    const fallbackKey =
      action === 'attack'
        ? 'wraith_attack'
        : action === 'dash'
          ? 'wraith_dash'
          : undefined;
    const resolvedKey = this.anims.exists(animKey)
      ? animKey
      : fallbackKey && this.anims.exists(fallbackKey)
        ? fallbackKey
        : undefined;

    if (!resolvedKey) {
      return;
    }

    this.isHeroActionAnimPlaying = true;
    this.currentHeroActionAnim = action;
    this.lastHeroFootstepFrame = -1;
    this.heroSprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
    this.heroSprite.play(resolvedKey);
    this.heroSprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.isHeroActionAnimPlaying = false;
      this.currentHeroActionAnim = null;
      this.updateHeroLocomotionAnim();
    });
  }

  private cancelHeroActionAnim(): void {
    this.isHeroActionAnimPlaying = false;
    this.currentHeroActionAnim = null;
    this.heroSprite?.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
  }

  private getCurrentHeroFrameIndex(): number {
    if (!this.heroSprite) {
      return 0;
    }
    const parsed = Number(this.heroSprite.frame?.name);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  }

  private updateHeroFootstepDust(): void {
    if (!this.heroSprite || !this.hero.isAlive) {
      this.lastHeroFootstepFrame = -1;
      return;
    }

    const currentAnimKey = this.heroSprite.anims.currentAnim?.key;
    const isWalkingAnim =
      currentAnimKey === `${this.heroSpriteKey}_walk` &&
      this.heroSprite.anims.isPlaying;

    if (!isWalkingAnim) {
      this.lastHeroFootstepFrame = -1;
      return;
    }

    const frameIdx = this.getCurrentHeroFrameIndex();
    if (frameIdx === this.lastHeroFootstepFrame) {
      return;
    }

    this.lastHeroFootstepFrame = frameIdx;
    if (HERO_WALK_FOOTSTEP_FRAMES.includes(frameIdx)) {
      spawnFootstepDust(
        this,
        this.heroSprite.x,
        this.heroSprite.y + 31 * this.heroSprite.scaleY,
        this.heroSpriteKey === 'hero_wraith'
      );
    }
  }

  private updateHeroLocomotionAnim(): void {
    if (!this.heroSprite || !this.hero.isAlive) {
      return;
    }

    if (this.isHeroActionAnimPlaying) {
      const frameIdx = this.getCurrentHeroFrameIndex();
      const canCancelAttack =
        this.currentHeroActionAnim === 'attack' &&
        frameIdx >= HERO_ATTACK_CANCEL_FRAME;
      const canCancelHit =
        this.currentHeroActionAnim === 'hit' &&
        frameIdx >= HERO_HIT_CANCEL_FRAME;

      if (this.heroIsMoving && (canCancelAttack || canCancelHit)) {
        this.cancelHeroActionAnim();
      } else {
        return;
      }
    }

    const desiredKey = this.heroIsMoving
      ? `${this.heroSpriteKey}_walk`
      : `${this.heroSpriteKey}_idle`;
    const resolvedKey = this.anims.exists(desiredKey)
      ? desiredKey
      : this.anims.exists(`${this.heroSpriteKey}_idle`)
        ? `${this.heroSpriteKey}_idle`
        : this.anims.exists('wraith_idle')
          ? 'wraith_idle'
          : undefined;

    if (resolvedKey && this.heroSprite.anims.currentAnim?.key !== resolvedKey) {
      this.heroSprite.play(resolvedKey, true);
    }
  }

  private spawnRangedArrow(from: Vector2D, to: Vector2D): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const arrow = this.add
      .graphics({ x: from.x, y: from.y })
      .setDepth(25)
      .setRotation(angle);

    arrow.lineStyle(2.5, 0xb45309, 1);
    arrow.lineBetween(-9, 0, 5, 0);
    arrow.fillStyle(0xe2e8f0, 1);
    arrow.fillTriangle(11, 0, 4, -3.5, 4, 3.5);
    arrow.lineStyle(1.5, 0xfef3c7, 0.9);
    arrow.lineBetween(-9, 0, -12, -2.5);
    arrow.lineBetween(-9, 0, -12, 2.5);

    this.rangedArrows.push(arrow);
    this.tweens.add({
      targets: arrow,
      x: to.x,
      y: to.y,
      duration: 160,
      ease: 'Linear',
      onComplete: () => {
        this.rangedArrows = this.rangedArrows.filter((a) => a !== arrow);
        arrow.destroy();
      },
    });
  }

  private ensureCampaignFallbackTextures(): void {
    const fallbackSpecs: Record<string, { color: number; size: number }> = {
      slime: { color: 0x22c55e, size: 80 },
      cave_bat: { color: 0x7c3aed, size: 80 },
      wolf: { color: 0x64748b, size: 80 },
      skeleton: { color: 0xe2e8f0, size: 80 },
      skeleton_archer: { color: 0xcbd5e1, size: 80 },
      skeleton_chief: { color: 0xf59e0b, size: 80 },
      wolf_alpha: { color: 0x94a3b8, size: 80 },
      karnak: { color: 0xef4444, size: 96 },
    };

    for (const [key, spec] of Object.entries(fallbackSpecs)) {
      if (!this.textures.exists(key)) {
        const cx = spec.size / 2;
        const cy = spec.size / 2 + 4;
        const radius = spec.size >= 96 ? 22 : 18;
        const gfx = this.make.graphics({ x: 0, y: 0 });
        gfx.fillStyle(spec.color, 1);
        gfx.fillCircle(cx, cy, radius);
        gfx.fillStyle(0xfef08a, 1);
        gfx.fillRect(cx - 6, cy - 6, 3, 3);
        gfx.fillRect(cx + 3, cy - 6, 3, 3);
        gfx.generateTexture(key, spec.size, spec.size);
        gfx.destroy();
      }
    }
  }

  private applyBiomeTileTint(
    tile: Phaser.GameObjects.Image,
    biome: BiomeId,
    isWall: boolean,
    isBossRoom: boolean,
    hash: number
  ): void {
    switch (biome) {
      case 'village_grotto': {
        if (isWall) {
          tile.setTint(0x2f5e4e);
        } else if (hash === 3) {
          tile.setTint(0x38bdf8);
        } else if (hash === 1) {
          tile.setTint(0x86efac);
        } else {
          tile.setTint(0xa7f3d0);
        }
        break;
      }
      case 'village_mine': {
        if (isWall) {
          tile.setTint(0x44403c);
        } else if (hash === 2) {
          tile.setTint(0x78716c);
        } else {
          tile.setTint(0xa8a29e);
        }
        break;
      }
      case 'ancient_seal': {
        if (isWall) {
          tile.setTint(0x450a0a);
        } else if (hash === 2) {
          tile.setTint(0xdc2626);
        } else {
          tile.setTint(0x7f1d1d);
        }
        break;
      }
      case 'submundo_abyss':
      default: {
        if (isBossRoom && !isWall && hash === 2) {
          tile.setTint(0x991b1b);
        }
        break;
      }
    }
  }

  private resolveBiomeLighting(
    biome: BiomeId,
    isBossRoom: boolean
  ): { borderGlow: number; secondaryGlow: number; coreGlow: number } {
    switch (biome) {
      case 'village_grotto':
        return {
          borderGlow: isBossRoom ? 0x2dd4bf : 0x34d399,
          secondaryGlow: 0x0284c7,
          coreGlow: 0xccfbf1,
        };
      case 'village_mine':
        return {
          borderGlow: isBossRoom ? 0xf59e0b : 0xfbbf24,
          secondaryGlow: 0x92400e,
          coreGlow: 0xfef3c7,
        };
      case 'ancient_seal':
        return {
          borderGlow: 0xef4444,
          secondaryGlow: 0x991b1b,
          coreGlow: 0xfecaca,
        };
      case 'submundo_abyss':
      default:
        return {
          borderGlow: isBossRoom ? 0xf97316 : 0x38bdf8,
          secondaryGlow: isBossRoom ? 0xdc2626 : 0x0284c7,
          coreGlow: 0xe0f2fe,
        };
    }
  }
}
