import Phaser from 'phaser';
import { distanceBetween } from '../../core/combat/CombatEngine';
import { moveHero, type HeroState } from '../../core/entities/Hero';
import {
  resolveViewportConfig,
  type CampaignPhase,
  type CampaignStageId,
  type DialogueLine,
  type EquipSlot,
  type HubTransitionData,
  type RunEndReport,
  type SaveProfile,
  type Vector2D,
  type ViewportConfig,
} from '../../core/index';
import {
  ensureCampaignProgress,
  getAvailableStages,
  getCampaignCatalog,
  getCampaignStage,
  getDialogueLine,
  markDialogueSeen,
  setCampaignStageOrPhase,
} from '../../core/progression/CampaignManager';
import {
  applyRunOutcomeToProfile,
  buildHeroFromProfile,
  equipStashItem,
  forgeItemWithBlacksmith,
  getAltarUpgradeCost,
  getBlacksmithUpgradeCost,
  getProgressionCatalog,
  loadOrCreateProfile,
  persistProfile,
  purchaseAltarUpgrade,
  unequipProfileSlot,
  upgradeItemWithBlacksmith,
} from '../../core/progression/ProfileManager';
import { clearProfileStorage } from '../../core/progression/StorageAdapter';
import {
  completeMission,
  getGateMissions,
  getPrologueMission,
  getQuestMarkers,
  getVillageObjectiveText,
  isPrologueMissionId,
  talkToNpc,
  type QuestMarkers,
  type TalkOutcome,
} from '../../core/progression/PrologueQuests';
import {
  getVillageSpawn,
  type VillageArrivalOrigin,
  type VillageNpcId,
} from '../../core/progression/VillageHub';
import dialoguesData from '../../data/dialogues.json';
import { soundManager } from '../audio/SoundManager';
import {
  HERO_WALK_FOOTSTEP_FRAMES,
  registerGameAnimations,
  spawnFootstepDust,
} from '../sprites/CombatVfx';
import { HeroWeaponRig } from '../sprites/HeroWeaponRig';
import { AltarModal, type AltarModalSnapshot } from '../ui/AltarModal';
import {
  BlacksmithModal,
  type BlacksmithModalSnapshot,
} from '../ui/BlacksmithModal';
import { SceneCameraRig } from '../ui/CameraRig';
import {
  DF_EQUIP_SLOT_ORDER,
  DF_FONTS,
  DF_PALETTE,
  hasUiTextureFrame,
} from '../ui/DarkFantasyUiBuilder';
import { DialogueBox } from '../ui/DialogueBox';
import { GateModal, type GateMissionEntry } from '../ui/GateModal';
import { PrologueEndScreen } from '../ui/PrologueEndScreen';
import { VillageHud } from '../ui/VillageHud';
import {
  HERO_FEET_OFFSET,
  VILLAGE_ACTOR_SCALE,
  VILLAGE_LANDMARKS,
  VILLAGE_MAP_H,
  VILLAGE_MAP_W,
  VILLAGE_NPCS,
  VillageWorld,
  villageDepthForY,
  type VillageInteractableId,
  type VillageProximity,
} from './VillageMap';
import { HubHud, type HubHudSnapshot } from '../ui/HubHud';
import {
  InventoryModal,
  type InventoryHudSnapshot,
} from '../ui/InventoryModal';

export type HubStationId = 'emissary' | 'blacksmith' | 'soul_altar' | 'rift_portal';

export interface SubmundoHubDebugApi {
  scene: HubScene;
  getProfile: () => SaveProfile;
  openAltar: () => void;
  openBlacksmith: () => void;
  openStash: () => void;
  enterDungeon: (stageId?: CampaignStageId) => void;
  grantTestResources: (souls: number, essences?: number) => void;
  setCampaignPhase: (phase: CampaignPhase, stageId?: CampaignStageId) => void;
  openDialogue: (ids: string[]) => void;
  getDialogueBox: () => DialogueBox;
}

/** Estado da Vila exposto no debug (T-138). */
export interface VillageDebugState {
  hero: Vector2D;
  nearby: VillageInteractableId | null;
  gateUnlocked: boolean;
  objective: string;
  alertNpcId: VillageNpcId | null;
  dialogueOpen: boolean;
  gateModalOpen: boolean;
  /** Marcadores de missão (T-147). */
  markers: QuestMarkers;
  /** Ids das missões listadas no portão. */
  gateMissions: string[];
  /** Última conversa com NPC (resultado de `talkToNpc`) e a fala aberta. */
  lastTalk: { npcId: VillageNpcId; outcome: TalkOutcome; dialogueId: string } | null;
  bannerText: string | null;
}

export interface SubmundoVillageDebugApi {
  getVillageState: () => VillageDebugState | null;
  /** Leva o herói ao NPC e interage (Decisão #24). `true` se abriu uma fala. */
  talkTo: (npcId: VillageNpcId) => boolean;
  openGate: () => boolean;
  getQuestMarkers: () => QuestMarkers | null;
  /** Marca uma missão aceita como cumprida (atalho de teste da vitória). */
  completeMission: (missionId: string) => boolean;
  /** Mostra a tela "Fim do Prólogo" (pré-visualização; a DungeonScene chama a real). */
  showPrologueEnd: () => boolean;
}

const VILLAGE_DEBUG_KEYS = [
  'getVillageState',
  'talkTo',
  'openGate',
  'getQuestMarkers',
  'completeMission',
  'showPrologueEnd',
] as const;

const QUEST_GIVER_NAMES: Record<VillageNpcId, string> = {
  master: 'Mestre de Armas',
  lyra: 'Lyra',
  gorran: 'Gorran',
};

declare global {
  interface Window {
    __SUBMUNDO_HUB_DEBUG__?: SubmundoHubDebugApi & Partial<SubmundoVillageDebugApi>;
  }
}

type HubCreateData = HubTransitionData & {
  applyOutcome?: boolean;
  villageOrigin?: VillageArrivalOrigin;
};

interface HubStationConfig {
  id: HubStationId;
  label: string;
  frameIndex: number;
  accentColor: number;
  accentHex: string;
}

interface HubStationView {
  config: HubStationConfig;
  position: Vector2D;
  container: Phaser.GameObjects.Container;
  aura: Phaser.GameObjects.Graphics;
  visual: Phaser.GameObjects.GameObject;
  nameLabel: Phaser.GameObjects.Text;
  promptLabel: Phaser.GameObjects.Text;
  hitZone: Phaser.GameObjects.Zone;
}

const DEFAULT_HUB_WIDTH = 960;
const DEFAULT_HUB_HEIGHT = 540;
const HUB_WORLD_ZOOM = 1.45;
const TILE_DISPLAY_SIZE = 32;
const ARENA_PADDING_X = 40;
const STATION_INTERACT_RADIUS = 62;
const BANNER_DEFAULT_DURATION_MS = 6500;

const VILLAGE_STATIONS: readonly HubStationConfig[] = [
  {
    id: 'emissary',
    label: 'Mestre de Armas',
    frameIndex: 0,
    accentColor: 0x34d399,
    accentHex: '#6ee7b7',
  },
  {
    id: 'blacksmith',
    label: 'Ferreiro da Vila',
    frameIndex: 1,
    accentColor: 0xf59e0b,
    accentHex: '#fcd34d',
  },
  {
    id: 'soul_altar',
    label: 'Santuário da Vila',
    frameIndex: 2,
    accentColor: 0x84cc16,
    accentHex: '#bef264',
  },
  {
    id: 'rift_portal',
    label: 'Saída da Missão',
    frameIndex: 3,
    accentColor: 0xfbbf24,
    accentHex: '#fde68a',
  },
];

const HUB_STATIONS: readonly HubStationConfig[] = [
  {
    id: 'emissary',
    label: 'Emissário Celestial',
    frameIndex: 0,
    accentColor: 0x38bdf8,
    accentHex: '#90e0ef',
  },
  {
    id: 'blacksmith',
    label: 'Ferreiro Espiritual',
    frameIndex: 1,
    accentColor: 0xf97316,
    accentHex: '#f4a261',
  },
  {
    id: 'soul_altar',
    label: 'Altar de Almas',
    frameIndex: 2,
    accentColor: 0x48cae4,
    accentHex: '#80ed99',
  },
  {
    id: 'rift_portal',
    label: 'Portal da Fenda',
    frameIndex: 3,
    accentColor: 0xffba08,
    accentHex: '#ffd166',
  },
];

const PROLOGUE_NPC_DIALOGUE_KEYS = [
  'prologue_welcome',
  'stage_grotto_intro',
  'prologue_blacksmith',
] as const;

const EMISSARY_DIALOGUE_KEYS = [
  'hub_welcome',
  'altar_intro',
  'blacksmith_intro',
  'portal_enter',
  'extraction_loot_kept',
] as const;

export class HubScene extends Phaser.Scene {
  private profile!: SaveProfile;
  private hero!: HeroState;
  private viewport!: ViewportConfig;

  private hud?: HubHud;
  private isVillage = false;
  private villageWorld?: VillageWorld;
  private villageHud?: VillageHud;
  private gateModal?: GateModal;
  private villageNearby: VillageProximity | null = null;
  private villageLineIdx: Record<'lyra' | 'gorran', number> = { lyra: 0, gorran: 0 };
  private heroFacingX = 1;
  private altarModal!: AltarModal;
  private blacksmithModal!: BlacksmithModal;
  private inventoryModal!: InventoryModal;
  private dialogueBox!: DialogueBox;
  private cameraRig?: SceneCameraRig;

  private arenaLayer!: Phaser.GameObjects.Container;
  private lightingGraphics!: Phaser.GameObjects.Graphics;
  private heroAura!: Phaser.GameObjects.Graphics;
  private heroSprite!: Phaser.GameObjects.Sprite;
  private heroSpriteKey: 'hero_living' | 'hero_wraith' = 'hero_living';
  private weaponRig?: HeroWeaponRig;
  private lastFootstepFrame = -1;

  private stations: HubStationView[] = [];
  private nearbyStationId: HubStationId | null = null;
  private emissaryDialogueIndex = 0;
  private selectedStageId: CampaignStageId = 'mission_herbs';
  private lastVillageTalk: VillageDebugState['lastTalk'] = null;
  private villageDebugKeysAdded: string[] = [];

  private elapsedTimeMs = 0;
  private bannerText?: string;
  private bannerExpiresAtMs = 0;
  private enteringDungeon = false;

  private pointerUnlockHandler?: () => void;
  private keydownHandler?: (event: KeyboardEvent) => void;
  private resizeHandler?: (gameSize: Phaser.Structs.Size) => void;

  constructor() {
    super({ key: 'HubScene' });
  }

  public create(data?: HubTransitionData): void {
    this.enteringDungeon = false;
    this.elapsedTimeMs = 0;
    this.nearbyStationId = null;
    this.emissaryDialogueIndex = 0;
    this.lastFootstepFrame = -1;

    const width = this.scale.width || DEFAULT_HUB_WIDTH;
    const height = this.scale.height || DEFAULT_HUB_HEIGHT;
    this.viewport = resolveViewportConfig(width, height);

    this.ensureRequiredFallbackTextures();
    registerGameAnimations(this);

    this.profile = loadOrCreateProfile();
    const campaign = ensureCampaignProgress(this.profile);

    const transitionExt = data as HubCreateData | undefined;

    this.isVillage = campaign.phase === 'prologue';
    if (this.isVillage) {
      this.createVillage(transitionExt);
      return;
    }

    if (transitionExt?.fromRun) {
      if (transitionExt.applyOutcome === true) {
        applyRunOutcomeToProfile(this.profile, transitionExt.fromRun);
        persistProfile(this.profile);
      }
      this.showTimedBanner(
        this.formatRunEndBanner(transitionExt.fromRun),
        9000
      );
    } else {
      const welcomeText =
        campaign.phase === 'prologue'
          ? dialoguesData.entries.prologue_welcome.shortText
          : dialoguesData.entries.hub_welcome.shortText;
      this.showTimedBanner(welcomeText, BANNER_DEFAULT_DURATION_MS);
    }

    this.syncSelectedStage(transitionExt?.stageId);
    this.cameras.main.setBackgroundColor(
      campaign.phase === 'prologue' ? '#121a14' : '#090b12'
    );

    const spawnPos = this.getInitialHeroSpawn(this.viewport);
    this.hero = buildHeroFromProfile(this.profile, spawnPos);

    this.arenaLayer = this.add.container(0, 0).setDepth(1);
    this.lightingGraphics = this.add.graphics().setDepth(5);
    this.heroAura = this.add.graphics().setDepth(19);

    this.buildArenaTilesAndLighting(this.viewport);
    this.createStations(this.viewport);

    const heroKey =
      campaign.phase === 'prologue' ? 'hero_living' : 'hero_wraith';
    this.heroSpriteKey = heroKey;
    this.heroSprite = this.add
      .sprite(this.hero.position.x, this.hero.position.y, this.heroSpriteKey, 0)
      .setScale(0.88)
      .setDepth(20);
    if (this.anims.exists(`${this.heroSpriteKey}_idle`)) {
      this.heroSprite.play(`${this.heroSpriteKey}_idle`, true);
    }
    this.weaponRig = new HeroWeaponRig(
      this,
      this.heroSprite,
      this.profile.equipped.weapon,
      this.heroSpriteKey === 'hero_wraith'
    );

    this.hud = new HubHud(this, {
      onOpenAltar: () => this.openAltar(),
      onOpenBlacksmith: () => this.openBlacksmith(),
      onOpenStash: () => this.openStash(),
      onEnterDungeon: () => this.enterDungeon(),
      onInteract: () => {
        if (!this.isAnyModalOpen()) {
          this.interactWithNearbyStation();
        }
      },
      onCycleStage: () => this.cycleSelectedStage(),
      onToggleMute: () => {
        soundManager.unlock();
        soundManager.toggleMute();
        if (!soundManager.isMuted()) {
          soundManager.play('ui_click');
        }
        this.updateHud();
      },
      onResetSave: () => this.resetSaveAndRestart(),
    });

    this.createModals();

    this.pointerUnlockHandler = () => {
      soundManager.unlock();
    };
    this.input.on('pointerdown', this.pointerUnlockHandler);

    // Register HubScene keydown BEFORE DialogueBox so Space checks dialogueBox.isOpen() first
    this.keydownHandler = (event: KeyboardEvent) => {
      soundManager.unlock();
      if (this.dialogueBox?.isOpen() || this.isAnyModalOpen()) {
        return;
      }

      if (event.code === 'Space' && this.nearbyStationId) {
        event.preventDefault();
        this.interactWithNearbyStation();
      }
    };
    this.input.keyboard?.on('keydown', this.keydownHandler);

    this.dialogueBox = new DialogueBox(this);

    this.cameraRig = new SceneCameraRig(this, {
      width: this.viewport.width,
      height: this.viewport.height,
      worldZoom: this.getWorldZoom(),
      boundsWidth: this.viewport.width,
      boundsHeight: this.viewport.height,
    });
    this.cameraRig.follow(this.heroSprite);
    this.cameraRig.syncLayers();

    this.resizeHandler = (gameSize: Phaser.Structs.Size) => {
      this.handleViewportResize(gameSize.width, gameSize.height);
    };
    this.scale.on('resize', this.resizeHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanupScene();
    });

    if (typeof window !== 'undefined') {
      window.__SUBMUNDO_HUB_DEBUG__ = {
        scene: this,
        getProfile: () => this.profile,
        openAltar: () => this.openAltar(),
        openBlacksmith: () => this.openBlacksmith(),
        openStash: () => this.openStash(),
        enterDungeon: (stageId?: CampaignStageId) => this.enterDungeon(stageId),
        grantTestResources: (souls: number, essences = 0) => {
          this.grantTestResources(souls, essences);
        },
        setCampaignPhase: (phase: CampaignPhase, stageId?: CampaignStageId) => {
          this.setCampaignPhase(phase, stageId);
        },
        openDialogue: (ids: string[]) => this.openDialogue(ids),
        getDialogueBox: () => this.dialogueBox,
      };
    }

    this.triggerAutomaticEntryDialogues(transitionExt);
    this.updateProximityState();
    this.syncVisuals();
    this.weaponRig?.sync(false, this.time?.now ?? this.elapsedTimeMs);
    this.cameraRig?.syncLayers();
    this.updateHud();
  }

  public update(time: number, delta: number): void {
    if (!this.hero || (!this.hud && !this.villageHud) || this.enteringDungeon) {
      return;
    }

    const clampedDelta = Math.min(Math.max(0, delta), 100);
    this.elapsedTimeMs += clampedDelta;

    if (this.bannerText && this.elapsedTimeMs >= this.bannerExpiresAtMs) {
      this.bannerText = undefined;
    }

    if (this.isVillage) {
      this.updateVillage(time, clampedDelta);
      return;
    }
    if (!this.hud) {
      return;
    }

    const canMove = !this.isAnyModalOpen();
    let moveDir: Vector2D = { x: 0, y: 0 };
    let dx = 0;
    let dy = 0;

    if (canMove) {
      moveDir = this.hud.getMoveVector();
      const bounds = this.getMovementBounds(this.viewport);
      const prevX = this.hero.position.x;
      const prevY = this.hero.position.y;
      moveHero(this.hero, moveDir, clampedDelta, {
        width: this.viewport.width,
        height: this.viewport.height,
        padding: ARENA_PADDING_X,
      });
      this.hero.position.x = Math.max(
        bounds.minX,
        Math.min(bounds.maxX, this.hero.position.x)
      );
      this.hero.position.y = Math.max(
        bounds.minY,
        Math.min(bounds.maxY, this.hero.position.y)
      );
      dx = this.hero.position.x - prevX;
      dy = this.hero.position.y - prevY;
      this.updateProximityState();
    }

    if (canMove && Math.abs(moveDir.x) > 0.05) {
      this.heroSprite.setFlipX(moveDir.x < 0);
    } else if (Math.abs(dx) > 0.05) {
      this.heroSprite.setFlipX(dx < 0);
    }

    const hasMoveIntent =
      canMove && (Math.abs(moveDir.x) > 0.05 || Math.abs(moveDir.y) > 0.05);
    const isMoving = hasMoveIntent && Math.hypot(dx, dy) > 0.05;

    const walkKey = `${this.heroSpriteKey}_walk`;
    const idleKey = `${this.heroSpriteKey}_idle`;
    const desiredKey =
      isMoving && this.anims.exists(walkKey) ? walkKey : idleKey;
    if (
      this.anims.exists(desiredKey) &&
      this.heroSprite.anims.currentAnim?.key !== desiredKey
    ) {
      this.heroSprite.play(desiredKey, true);
    }

    this.syncVisuals();

    if (isMoving && this.heroSprite.anims.currentAnim?.key === walkKey) {
      const frameIdx = Number(this.heroSprite.frame?.name);
      if (Number.isFinite(frameIdx) && frameIdx !== this.lastFootstepFrame) {
        this.lastFootstepFrame = frameIdx;
        if (HERO_WALK_FOOTSTEP_FRAMES.includes(frameIdx)) {
          spawnFootstepDust(
            this,
            this.heroSprite.x,
            this.heroSprite.y + 31 * this.heroSprite.scaleY,
            this.heroSpriteKey === 'hero_wraith'
          );
        }
      }
    } else {
      this.lastFootstepFrame = -1;
    }

    this.weaponRig?.sync(isMoving, time);
    this.cameraRig?.syncLayers();
    this.updateHud();
  }

  // ===========================================================================
  // VILA NATAL (T-138 / T-139): fase `prologue`
  // ===========================================================================

  private createVillage(data?: HubCreateData): void {
    if (data?.fromRun) {
      if (data.applyOutcome === true) {
        applyRunOutcomeToProfile(this.profile, data.fromRun);
        persistProfile(this.profile);
      }
      this.showTimedBanner(this.formatRunEndBanner(data.fromRun), 7000);
    }
    this.syncSelectedStage(data?.stageId);
    this.cameras.main.setBackgroundColor('#141a12');
    this.villageNearby = null;
    this.villageLineIdx = { lyra: 0, gorran: 0 };
    this.heroFacingX = 1;

    const origin: VillageArrivalOrigin = data?.villageOrigin ?? 'boot';
    this.lastVillageTalk = null;
    const world = new VillageWorld(this, getGateMissions(this.profile).length > 0);
    this.villageWorld = world;
    const spawn = world.getSpawn(getVillageSpawn(this.profile, origin));
    this.hero = buildHeroFromProfile(this.profile, spawn);

    this.heroSpriteKey = 'hero_living';
    this.heroSprite = this.add
      .sprite(spawn.x, spawn.y - HERO_FEET_OFFSET, this.heroSpriteKey, 0)
      .setScale(VILLAGE_ACTOR_SCALE)
      .setDepth(villageDepthForY(spawn.y));
    if (this.anims.exists(`${this.heroSpriteKey}_idle`)) {
      this.heroSprite.play(`${this.heroSpriteKey}_idle`, true);
    }
    this.weaponRig = new HeroWeaponRig(this, this.heroSprite, this.profile.equipped.weapon, false);

    this.villageHud = new VillageHud(this, {
      onInteract: () => {
        if (!this.isAnyModalOpen()) {
          this.interactInVillage();
        }
      },
      onOpenInventory: () => this.openStash(),
      onToggleMute: () => {
        soundManager.unlock();
        soundManager.toggleMute();
        if (!soundManager.isMuted()) {
          soundManager.play('ui_click');
        }
        this.updateHud();
      },
      onResetSave: () => this.resetSaveAndRestart(),
    });

    this.createModals();
    this.gateModal = new GateModal(this, {
      onSelectStage: (stageId) => this.enterDungeon(stageId),
      onClose: () => {
        soundManager.play('ui_click');
        this.updateHud();
      },
    });

    this.pointerUnlockHandler = () => {
      soundManager.unlock();
    };
    this.input.on('pointerdown', this.pointerUnlockHandler);

    this.dialogueBox = new DialogueBox(this);

    this.cameraRig = new SceneCameraRig(this, {
      width: this.viewport.width,
      height: this.viewport.height,
      worldZoom: this.getWorldZoom(),
      boundsWidth: VILLAGE_MAP_W,
      boundsHeight: VILLAGE_MAP_H,
    });
    this.cameraRig.follow(this.heroSprite);
    this.cameras.main.centerOn(this.heroSprite.x, this.heroSprite.y);
    this.cameraRig.syncLayers();

    this.resizeHandler = (gameSize: Phaser.Structs.Size) => {
      this.handleViewportResize(gameSize.width, gameSize.height);
    };
    this.scale.on('resize', this.resizeHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanupScene();
    });

    this.installDebugApi();
    this.triggerAutomaticEntryDialogues(data);
    this.updateVillageProximity();
    world.update(this.time?.now ?? 0, this.hero.position, null);
    this.weaponRig.sync(false, this.time?.now ?? 0);
    this.cameraRig.syncLayers();
    this.updateHud();
  }

  private updateVillage(time: number, delta: number): void {
    const world = this.villageWorld;
    const hud = this.villageHud;
    if (!world || !hud) {
      return;
    }
    const canMove = !this.isAnyModalOpen();
    let moveDir: Vector2D = { x: 0, y: 0 };
    let dx = 0;
    let dy = 0;
    if (canMove) {
      moveDir = hud.getMoveVector();
      const prev = { ...this.hero.position };
      moveHero(this.hero, moveDir, delta, {
        width: VILLAGE_MAP_W,
        height: VILLAGE_MAP_H,
        padding: 0,
      });
      const next = world.resolveMove(prev, this.hero.position);
      this.hero.position.x = next.x;
      this.hero.position.y = next.y;
      dx = next.x - prev.x;
      dy = next.y - prev.y;
    }

    if (canMove && Math.abs(moveDir.x) > 0.05) {
      this.heroFacingX = moveDir.x < 0 ? -1 : 1;
      this.heroSprite.setFlipX(moveDir.x < 0);
    }
    const isMoving =
      canMove &&
      (Math.abs(moveDir.x) > 0.05 || Math.abs(moveDir.y) > 0.05) &&
      Math.hypot(dx, dy) > 0.05;

    const walkKey = `${this.heroSpriteKey}_walk`;
    const idleKey = `${this.heroSpriteKey}_idle`;
    const desiredKey = isMoving && this.anims.exists(walkKey) ? walkKey : idleKey;
    if (this.anims.exists(desiredKey) && this.heroSprite.anims.currentAnim?.key !== desiredKey) {
      this.heroSprite.play(desiredKey, true);
    }

    const feet = this.hero.position;
    this.heroSprite
      .setPosition(feet.x, feet.y - HERO_FEET_OFFSET)
      .setDepth(villageDepthForY(feet.y + 0.2));

    if (isMoving && this.heroSprite.anims.currentAnim?.key === walkKey) {
      const frameIdx = Number(this.heroSprite.frame?.name);
      if (Number.isFinite(frameIdx) && frameIdx !== this.lastFootstepFrame) {
        this.lastFootstepFrame = frameIdx;
        if (HERO_WALK_FOOTSTEP_FRAMES.includes(frameIdx)) {
          spawnFootstepDust(this, feet.x, feet.y - 4, false);
        }
      }
    } else {
      this.lastFootstepFrame = -1;
    }

    this.weaponRig?.sync(isMoving, time);
    this.updateVillageProximity();
    world.update(time, feet, this.villageNearby?.id ?? null);
    this.cameraRig?.syncLayers();
    this.updateHud();
  }

  private updateVillageProximity(): void {
    this.villageNearby = this.villageWorld?.findInteractable(this.hero.position) ?? null;
  }

  private updateVillageHud(): void {
    if (!this.villageHud || !this.villageWorld) {
      return;
    }
    const markers = getQuestMarkers(this.profile);
    this.villageWorld.setQuestMarkers(markers.npcs, markers.gate);
    const gateOpen = markers.gate !== null;
    if (this.villageWorld.isGateOpen() !== gateOpen) {
      this.villageWorld.setGateOpen(gateOpen);
    }
    const heroLevel =
      1 + Object.values(this.profile.altarLevels).reduce((a, b) => a + b, 0);
    this.villageHud.update({
      heroName: 'Jovem Guerreiro',
      heroLevel,
      hp: this.hero.stats.hp,
      maxHp: this.hero.stats.maxHp,
      objectiveText: getVillageObjectiveText(this.profile),
      interactLabel: this.villageNearby?.label,
      isMuted: soundManager.isMuted(),
      bannerText: this.bannerText,
      minimap: {
        mapWidth: VILLAGE_MAP_W,
        mapTop: VILLAGE_LANDMARKS.topY,
        mapBottom: VILLAGE_LANDMARKS.bottomY,
        hero: this.hero.position,
        heroFacingX: this.heroFacingX,
        gate: VILLAGE_LANDMARKS.gate,
        house: VILLAGE_LANDMARKS.house,
        campfire: VILLAGE_LANDMARKS.campfire,
        npcs: VILLAGE_NPCS.map((n) => ({
          id: n.id,
          pos: n.pos,
          alert: markers.npcs[n.id] === '!' || markers.npcs[n.id] === '?yellow',
          marker: markers.npcs[n.id],
        })),
        gateAlert: gateOpen,
      },
    });
  }

  private interactInVillage(): void {
    const near = this.villageNearby;
    if (!near || this.enteringDungeon) {
      return;
    }
    soundManager.unlock();
    if (near.id === 'gate') {
      if (getGateMissions(this.profile).length > 0) {
        this.openGateModal();
      } else {
        this.openGateLockedLine();
      }
      return;
    }
    this.talkToVillageNpc(near.id);
  }

  /** Portão sem missão aceita (T-147): antes do Mestre, a fala do M9; depois, um lembrete. */
  private openGateLockedLine(): void {
    if (!ensureCampaignProgress(this.profile).masterIntroDone) {
      this.openDialogue(['village_gate_locked']);
      return;
    }
    const base = getDialogueLine('village_gate_locked');
    if (!base) {
      return;
    }
    this.openDialogueLines([
      {
        ...base,
        text: 'Nenhuma missão aceita no momento. Fale com os moradores da vila antes de sair.',
        shortText: 'Aceite uma missão antes de sair.',
      },
    ]);
  }

  /** Fala certa para o resultado de `talkToNpc` (Decisão #24). */
  private questDialogueId(npcId: VillageNpcId, outcome: TalkOutcome): string {
    if (npcId === 'master') {
      switch (outcome.kind) {
        case 'intro':
          return 'quest_master_intro';
        case 'accepted':
          return 'quest_master_depths_offer';
        case 'in_progress':
          return 'quest_master_depths_progress';
        default:
          return 'quest_master_wait';
      }
    }
    switch (outcome.kind) {
      case 'accepted':
        return `quest_${npcId}_offer`;
      case 'in_progress':
        return `quest_${npcId}_progress`;
      case 'turned_in':
        return `quest_${npcId}_turnin`;
      default:
        // Antes da introdução do Mestre ainda não há missão: falas soltas do M9.
        if (!ensureCampaignProgress(this.profile).masterIntroDone) {
          const idx = this.villageLineIdx[npcId];
          this.villageLineIdx[npcId] = idx + 1;
          return idx % 2 === 0 ? `village_${npcId}_idle` : `village_${npcId}_idle_2`;
        }
        return `quest_${npcId}_done`;
    }
  }

  private talkToVillageNpc(id: VillageNpcId): void {
    const outcome = talkToNpc(this.profile, id);
    persistProfile(this.profile);
    const dialogueId = this.questDialogueId(id, outcome);
    this.lastVillageTalk = { npcId: id, outcome, dialogueId };

    if (outcome.missionId && (outcome.kind === 'accepted' || outcome.kind === 'turned_in')) {
      const name = this.missionName(outcome.missionId);
      if (outcome.kind === 'accepted') {
        this.showTimedBanner(`Missão aceita: ${name}`, 3200);
      } else {
        soundManager.play('altar');
        this.showTimedBanner(`Missão concluída: ${name}`, 3600);
      }
    }
    this.openDialogue([dialogueId]);
    this.updateHud();
  }

  private missionName(missionId: string): string {
    if (!isPrologueMissionId(missionId)) {
      return missionId;
    }
    try {
      return getPrologueMission(missionId).name;
    } catch {
      return missionId;
    }
  }

  private buildGateEntries(): GateMissionEntry[] {
    return getGateMissions(this.profile).map((mission) => {
      const itemId = mission.objective?.itemId;
      const giver = mission.giverNpcId as VillageNpcId | undefined;
      return {
        stageId: mission.id,
        title: mission.name,
        giverName: giver ? QUEST_GIVER_NAMES[giver] : undefined,
        icon: itemId === 'herb' ? 'herb' : itemId === 'mine_tool' ? 'tools' : null,
      };
    });
  }

  private openGateModal(): void {
    if (!this.gateModal || this.enteringDungeon) {
      return;
    }
    soundManager.play('ui_click');
    this.closeAllModalsExcept('gate');
    this.gateModal.open(this.buildGateEntries());
    this.updateHud();
  }

  private teleportHeroInVillage(id: VillageInteractableId): void {
    if (!this.villageWorld) {
      return;
    }
    const p = this.villageWorld.getApproachPoint(id);
    this.hero.position.x = p.x;
    this.hero.position.y = p.y;
    this.heroSprite
      .setPosition(p.x, p.y - HERO_FEET_OFFSET)
      .setDepth(villageDepthForY(p.y + 0.2));
    this.updateVillageProximity();
  }

  private getVillageDebugState(): VillageDebugState | null {
    if (!this.isVillage || !this.hero) {
      return null;
    }
    const markers = getQuestMarkers(this.profile);
    const gate = getGateMissions(this.profile);
    const alertNpcId =
      VILLAGE_NPCS.map((n) => n.id).find(
        (id) => markers.npcs[id] === '!' || markers.npcs[id] === '?yellow'
      ) ?? null;
    return {
      hero: { x: Math.round(this.hero.position.x), y: Math.round(this.hero.position.y) },
      nearby: this.villageNearby?.id ?? null,
      gateUnlocked: gate.length > 0,
      objective: getVillageObjectiveText(this.profile),
      alertNpcId,
      dialogueOpen: Boolean(this.dialogueBox?.isOpen()),
      gateModalOpen: Boolean(this.gateModal?.isOpen()),
      markers,
      gateMissions: gate.map((m) => m.id),
      lastTalk: this.lastVillageTalk,
      bannerText: this.bannerText ?? null,
    };
  }

  private installDebugApi(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const village: SubmundoVillageDebugApi = {
      getVillageState: () => this.getVillageDebugState(),
      talkTo: (npcId: VillageNpcId) => {
        if (!this.isVillage) {
          return false;
        }
        this.closeAllModalsExcept(null);
        this.teleportHeroInVillage(npcId);
        this.interactInVillage();
        return Boolean(this.dialogueBox?.isOpen());
      },
      openGate: () => {
        if (!this.isVillage) {
          return false;
        }
        this.closeAllModalsExcept(null);
        this.teleportHeroInVillage('gate');
        this.interactInVillage();
        return Boolean(this.gateModal?.isOpen());
      },
      getQuestMarkers: () => (this.isVillage ? getQuestMarkers(this.profile) : null),
      completeMission: (missionId: string) => {
        if (!this.isVillage || !isPrologueMissionId(missionId)) {
          return false;
        }
        const result = completeMission(this.profile, missionId);
        if (result.changed) {
          persistProfile(this.profile);
          this.updateHud();
        }
        return result.changed;
      },
      showPrologueEnd: () => {
        if (!this.isVillage) {
          return false;
        }
        this.closeAllModalsExcept(null);
        PrologueEndScreen.show(this, {
          title: getDialogueLine('prologue_end_title')?.text ?? 'Fim do Prólogo',
          text: getDialogueLine('prologue_end_text')?.text ?? '',
          onContinue: () => this.updateHud(),
        });
        return true;
      },
    };
    window.__SUBMUNDO_HUB_DEBUG__ = {
      scene: this,
      getProfile: () => this.profile,
      openAltar: () => this.openAltar(),
      openBlacksmith: () => this.openBlacksmith(),
      openStash: () => this.openStash(),
      enterDungeon: (stageId?: CampaignStageId) => this.enterDungeon(stageId),
      grantTestResources: (souls: number, essences = 0) => {
        this.grantTestResources(souls, essences);
      },
      setCampaignPhase: (phase: CampaignPhase, stageId?: CampaignStageId) => {
        this.setCampaignPhase(phase, stageId);
      },
      openDialogue: (ids: string[]) => this.openDialogue(ids),
      getDialogueBox: () => this.dialogueBox,
      ...village,
    };
    // Também em `window.__SUBMUNDO_DEBUG__`, só com a Vila ativa e sem sobrescrever
    // chaves da DungeonScene (ressalva do M9). As chaves saem no SHUTDOWN.
    const w = window as unknown as { __SUBMUNDO_DEBUG__?: Record<string, unknown> };
    const target = w.__SUBMUNDO_DEBUG__ ?? {};
    this.villageDebugKeysAdded = [];
    for (const key of VILLAGE_DEBUG_KEYS) {
      if (!(key in target)) {
        target[key] = village[key];
        this.villageDebugKeysAdded.push(key);
      }
    }
    w.__SUBMUNDO_DEBUG__ = target;
  }

  private createModals(): void {
    this.altarModal = new AltarModal(this, {
      onPurchaseUpgrade: (upgradeId) => {
        soundManager.unlock();
        const result = purchaseAltarUpgrade(this.profile, upgradeId);
        if (result.ok) {
          soundManager.play('altar');
          persistProfile(this.profile);
          this.refreshHeroFromProfile();
          this.altarModal.update(this.buildAltarSnapshot());
          this.showTimedBanner(
            `Altar fortalecido! Nível ${result.newLevel} (-${result.cost} Almas).`,
            3200
          );
        } else if (result.reason) {
          soundManager.play('ui_click');
          this.showTimedBanner(result.reason, 2600);
        }
        this.updateHud();
      },
      onClose: () => {
        soundManager.play('ui_click');
        this.updateHud();
      },
    });

    this.blacksmithModal = new BlacksmithModal(this, {
      onUpgradeItem: (instanceId) => {
        soundManager.unlock();
        const result = upgradeItemWithBlacksmith(this.profile, instanceId);
        if (result.ok) {
          soundManager.play('forge');
          persistProfile(this.profile);
          this.refreshHeroFromProfile();
          this.blacksmithModal.update(this.buildBlacksmithSnapshot());
          this.showTimedBanner(
            `${result.item?.name ?? 'Item'} temperado (-${result.cost} Almas).`,
            3200
          );
        } else if (result.reason) {
          soundManager.play('ui_click');
          this.showTimedBanner(result.reason, 2600);
        }
        this.updateHud();
      },
      onForgeRecipe: (recipeId) => {
        soundManager.unlock();
        const result = forgeItemWithBlacksmith(this.profile, recipeId);
        if (result.ok) {
          soundManager.play('forge');
          persistProfile(this.profile);
          this.refreshHeroFromProfile();
          this.blacksmithModal.update(this.buildBlacksmithSnapshot());
          this.showTimedBanner(
            `Relíquia forjada: ${result.item?.name ?? 'Equipamento'} (no Baú).`,
            3800
          );
        } else if (result.reason) {
          soundManager.play('ui_click');
          this.showTimedBanner(result.reason, 2800);
        }
        this.updateHud();
      },
      onClose: () => {
        soundManager.play('ui_click');
        this.updateHud();
      },
    });

    this.inventoryModal = new InventoryModal(this, {
      onEquipItem: (instanceId) => {
        soundManager.unlock();
        if (equipStashItem(this.profile, instanceId)) {
          soundManager.play('ui_click');
          persistProfile(this.profile);
          this.refreshHeroFromProfile();
          this.inventoryModal.update(this.buildInventorySnapshot());
          this.updateHud();
        }
      },
      onUnequipSlot: (slot: EquipSlot) => {
        soundManager.unlock();
        if (!unequipProfileSlot(this.profile, slot)) {
          this.showTimedBanner('Baú cheio para desequipar este item.', 2600);
          this.updateHud();
          return;
        }
        soundManager.play('ui_click');
        persistProfile(this.profile);
        this.refreshHeroFromProfile();
        this.inventoryModal.update(this.buildInventorySnapshot());
        this.updateHud();
      },
      onClose: () => {
        soundManager.play('ui_click');
        this.updateHud();
      },
    });
  }

  public openAltar(): void {
    if (this.enteringDungeon) {
      return;
    }
    soundManager.unlock();
    soundManager.play('ui_click');
    this.closeAllModalsExcept('altar');
    this.altarModal.open(this.buildAltarSnapshot());
    this.updateHud();
  }

  public openBlacksmith(): void {
    if (this.enteringDungeon) {
      return;
    }
    soundManager.unlock();
    soundManager.play('ui_click');
    this.closeAllModalsExcept('blacksmith');
    this.blacksmithModal.open(this.buildBlacksmithSnapshot());
    this.updateHud();
  }

  public openStash(): void {
    if (this.enteringDungeon) {
      return;
    }
    soundManager.unlock();
    soundManager.play('ui_click');
    this.closeAllModalsExcept('stash');
    this.inventoryModal.open(this.buildInventorySnapshot());
    this.updateHud();
  }

  public openDialogue(ids: string[], onComplete?: () => void): void {
    if (this.enteringDungeon) {
      return;
    }
    const lines = ids
      .map((id) => getDialogueLine(id))
      .filter((line): line is DialogueLine => line !== null);
    this.openDialogueLines(lines, onComplete);
  }

  /** Abre falas já montadas (ex.: variação do texto do portão). */
  private openDialogueLines(lines: DialogueLine[], onComplete?: () => void): void {
    if (this.enteringDungeon) {
      return;
    }
    if (lines.length === 0) {
      onComplete?.();
      return;
    }

    this.closeAllModalsExcept('dialogue');
    this.dialogueBox.openLines(lines, () => {
      this.updateHud();
      onComplete?.();
    });
    this.updateHud();
  }

  public openEmissaryDialogue(): void {
    if (this.enteringDungeon) {
      return;
    }
    const phase = this.getCampaignPhase();
    const keys =
      phase === 'prologue' ? PROLOGUE_NPC_DIALOGUE_KEYS : EMISSARY_DIALOGUE_KEYS;
    const key = keys[this.emissaryDialogueIndex % keys.length];
    this.emissaryDialogueIndex += 1;
    this.openDialogue([key]);
  }

  public setCampaignPhase(phase: CampaignPhase, stageId?: CampaignStageId): void {
    setCampaignStageOrPhase(this.profile, phase, stageId);
    this.syncSelectedStage(stageId);
    persistProfile(this.profile);
    if (this.isVillage || phase === 'prologue') {
      // Vila e Refúgio são cenários diferentes: recria a cena.
      this.scene.restart({});
      return;
    }
    this.rebuildPhaseScenario();
  }

  public enterDungeon(stageId?: CampaignStageId): void {
    if (this.enteringDungeon) {
      return;
    }
    soundManager.unlock();
    soundManager.play('ui_click');

    const targetStageId = stageId ?? this.selectedStageId;
    if (stageId) {
      this.selectedStageId = stageId;
      ensureCampaignProgress(this.profile).currentStageId = stageId;
    }

    this.enteringDungeon = true;
    this.closeAllModalsExcept(null);
    persistProfile(this.profile);
    this.scene.start('DungeonScene', {
      profileSnapshot: this.profile,
      stageId: targetStageId,
    });
  }

  public grantTestResources(souls: number, essences = 0): void {
    const safeSouls = Math.round(souls);
    const safeEssences = Math.round(essences);
    this.profile.souls = Math.max(0, this.profile.souls + safeSouls);
    this.profile.generalEssences = Math.max(
      0,
      this.profile.generalEssences + safeEssences
    );
    persistProfile(this.profile);
    this.refreshHeroFromProfile();

    if (this.altarModal.isOpen()) {
      this.altarModal.update(this.buildAltarSnapshot());
    }
    if (this.blacksmithModal.isOpen()) {
      this.blacksmithModal.update(this.buildBlacksmithSnapshot());
    }
    if (this.inventoryModal.isOpen()) {
      this.inventoryModal.update(this.buildInventorySnapshot());
    }
    this.updateHud();
  }

  private interactWithNearbyStation(): void {
    if (!this.nearbyStationId) {
      return;
    }
    this.activateStation(this.nearbyStationId);
  }

  private activateStation(stationId: HubStationId): void {
    soundManager.unlock();
    switch (stationId) {
      case 'emissary':
        this.openEmissaryDialogue();
        break;
      case 'blacksmith':
        this.openBlacksmith();
        break;
      case 'soul_altar':
        this.openAltar();
        break;
      case 'rift_portal':
        this.enterDungeon();
        break;
    }
  }

  private closeAllModalsExcept(
    keep: 'altar' | 'blacksmith' | 'stash' | 'dialogue' | 'gate' | null
  ): void {
    if (keep !== 'gate' && this.gateModal?.isOpen()) {
      this.gateModal.hide();
    }
    if (keep !== 'altar' && this.altarModal?.isOpen()) {
      this.altarModal.close();
    }
    if (keep !== 'blacksmith' && this.blacksmithModal?.isOpen()) {
      this.blacksmithModal.close();
    }
    if (keep !== 'stash' && this.inventoryModal?.isOpen()) {
      this.inventoryModal.close();
    }
    if (keep !== 'dialogue' && this.dialogueBox?.isOpen()) {
      this.dialogueBox.close();
    }
  }

  private resetSaveAndRestart(): void {
    this.closeAllModalsExcept(null);
    soundManager.unlock();
    soundManager.play('ui_click');
    clearProfileStorage();
    this.scene.restart({});
  }

  private isAnyModalOpen(): boolean {
    return (
      Boolean(this.altarModal?.isOpen()) ||
      Boolean(this.blacksmithModal?.isOpen()) ||
      Boolean(this.inventoryModal?.isOpen()) ||
      Boolean(this.dialogueBox?.isOpen()) ||
      Boolean(this.gateModal?.isOpen()) ||
      Boolean(this.villageHud?.isConfigOpen())
    );
  }

  private refreshHeroFromProfile(): void {
    const pos = this.hero ? { ...this.hero.position } : this.getInitialHeroSpawn(this.viewport);
    const facing = this.hero ? { ...this.hero.facing } : { x: 1, y: 0 };
    this.hero = buildHeroFromProfile(this.profile, pos);
    this.hero.facing = facing;
    this.weaponRig?.setEquippedWeapon(
      this.profile.equipped.weapon,
      this.heroSpriteKey === 'hero_wraith'
    );
  }

  private buildAltarSnapshot(): AltarModalSnapshot {
    const catalog = getProgressionCatalog();
    return {
      souls: this.profile.souls,
      altarLevels: { ...this.profile.altarLevels },
      upgrades: catalog.altarUpgrades,
      getCost: getAltarUpgradeCost,
    };
  }

  private buildBlacksmithSnapshot(): BlacksmithModalSnapshot {
    const catalog = getProgressionCatalog();
    const equippedItems = DF_EQUIP_SLOT_ORDER.map(
      (slot) => this.profile.equipped[slot]
    ).filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      souls: this.profile.souls,
      generalEssences: this.profile.generalEssences,
      items: [...equippedItems, ...this.profile.stash],
      itemUpgradeLevels: { ...this.profile.itemUpgradeLevels },
      maxUpgradeLevel: catalog.blacksmithUpgrade.maxLevel,
      getUpgradeCost: (level: number) => getBlacksmithUpgradeCost(level, catalog),
      forgeRecipes: catalog.blacksmithForge,
    };
  }

  private buildInventorySnapshot(): InventoryHudSnapshot {
    return {
      equipped: { ...this.profile.equipped },
      bag: [...this.profile.stash],
      heroStats: { ...this.hero.stats },
      lifeSteal: this.hero.lifeSteal,
      cooldownReduction: this.hero.cooldownReduction,
      luck: this.hero.luck,
      activeForces: { ...this.hero.equippedForces },
    };
  }

  private updateHud(): void {
    if (this.isVillage) {
      this.updateVillageHud();
      return;
    }
    if (!this.hud) {
      return;
    }
    const equippedCount = DF_EQUIP_SLOT_ORDER.filter(
      (slot) => this.profile.equipped[slot] !== null
    ).length;

    const nearbyStation = this.stations.find(
      (station) => station.config.id === this.nearbyStationId
    );

    const campaign = ensureCampaignProgress(this.profile);
    const isPrologue = campaign.phase === 'prologue';
    const availableStages = getAvailableStages(this.profile);
    const selectedStage =
      availableStages.find((stage) => stage.id === this.selectedStageId) ??
      availableStages[0];

    const snapshot: HubHudSnapshot = {
      souls: this.profile.souls,
      generalEssences: this.profile.generalEssences,
      equippedCount,
      stashCount: this.profile.stash.length,
      nearbyStationLabel: nearbyStation?.config.label,
      bannerText: this.bannerText,
      locationTitle: isPrologue
        ? 'Vila Natal — Campo de Treino'
        : 'Refúgio do Submundo',
      stageLabel: selectedStage?.name,
      canCycleStage: availableStages.length > 1,
      isPrologue,
      isMuted: soundManager.isMuted(),
    };

    this.hud.update(snapshot);
  }

  private updateProximityState(): void {
    let closestId: HubStationId | null = null;
    let closestDist = STATION_INTERACT_RADIUS;

    for (const station of this.stations) {
      const dist = distanceBetween(this.hero.position, station.position);
      if (dist <= closestDist) {
        closestDist = dist;
        closestId = station.config.id;
      }
    }

    this.nearbyStationId = closestId;
  }

  private getCampaignPhase(): CampaignPhase {
    return ensureCampaignProgress(this.profile).phase;
  }

  private syncSelectedStage(preferredStageId?: CampaignStageId): void {
    const available = getAvailableStages(this.profile);
    const campaign = ensureCampaignProgress(this.profile);
    const candidates: Array<CampaignStageId | undefined> = [
      preferredStageId,
      campaign.currentStageId,
      this.selectedStageId,
    ];

    for (const candidate of candidates) {
      if (candidate && available.some((stage) => stage.id === candidate)) {
        this.selectedStageId = candidate;
        return;
      }
    }

    this.selectedStageId =
      available[0]?.id ?? (campaign.phase === 'act1' ? 'act1_submundo' : 'mission_herbs');
  }

  private cycleSelectedStage(): void {
    const available = getAvailableStages(this.profile);
    if (available.length <= 1) {
      return;
    }

    soundManager.unlock();
    soundManager.play('ui_click');

    const currentIdx = available.findIndex(
      (stage) => stage.id === this.selectedStageId
    );
    const nextIdx = (currentIdx + 1) % available.length;
    const nextStage = available[nextIdx];
    if (!nextStage) {
      return;
    }

    this.selectedStageId = nextStage.id;
    ensureCampaignProgress(this.profile).currentStageId = nextStage.id;
    persistProfile(this.profile);

    this.showTimedBanner(`Fase selecionada: ${nextStage.name}`, 2800);
    this.updateHud();
  }

  private rebuildPhaseScenario(): void {
    const phase = this.getCampaignPhase();
    this.heroSpriteKey = phase === 'prologue' ? 'hero_living' : 'hero_wraith';
    this.lastFootstepFrame = -1;
    if (this.heroSprite) {
      this.heroSprite.setTexture(this.heroSpriteKey, 0).setScale(0.88);
      if (this.anims.exists(`${this.heroSpriteKey}_idle`)) {
        this.heroSprite.play(`${this.heroSpriteKey}_idle`, true);
      }
    }
    this.weaponRig?.setEquippedWeapon(
      this.profile.equipped.weapon,
      this.heroSpriteKey === 'hero_wraith'
    );
    this.cameras.main.setBackgroundColor(
      phase === 'prologue' ? '#121a14' : '#090b12'
    );
    this.buildArenaTilesAndLighting(this.viewport);
    this.createStations(this.viewport);
    this.updateProximityState();
    this.syncVisuals();
    this.weaponRig?.sync(false, this.time?.now ?? this.elapsedTimeMs);
    this.cameraRig?.syncLayers();
    this.updateHud();
  }

  private triggerAutomaticEntryDialogues(
    transitionExt?: HubTransitionData & { applyOutcome?: boolean }
  ): void {
    const campaign = ensureCampaignProgress(this.profile);
    const fromRun = transitionExt?.fromRun;

    if (fromRun?.triggeredVillageFall) {
      const fallIds = ['village_fall_boss', 'village_fall_pact', 'act1_briefing'];
      let changed = false;
      for (const id of fallIds) {
        if (markDialogueSeen(this.profile, id)) {
          changed = true;
        }
      }
      if (changed) {
        persistProfile(this.profile);
      }
      this.openDialogue(fallIds);
      return;
    }

    const stageExists =
      Boolean(fromRun?.stageId) &&
      getCampaignCatalog().stages.some((stage) => stage.id === fromRun?.stageId);
    if (fromRun?.victory && fromRun.stageId && stageExists) {
      try {
        const stageDef = getCampaignStage(fromRun.stageId);
        const unseenVictoryIds = stageDef.victoryDialogueIds.filter(
          (id) => !campaign.seenDialogues.includes(id)
        );
        if (unseenVictoryIds.length > 0) {
          for (const id of unseenVictoryIds) {
            markDialogueSeen(this.profile, id);
          }
          persistProfile(this.profile);
          this.openDialogue(unseenVictoryIds);
          return;
        }
      } catch {
        // Ignore unknown stageId safely.
      }
    }

    if (
      !fromRun &&
      campaign.phase === 'prologue' &&
      !campaign.seenDialogues.includes('prologue_welcome')
    ) {
      const introIds = ['prologue_welcome'];
      for (const id of introIds) {
        markDialogueSeen(this.profile, id);
      }
      persistProfile(this.profile);
      this.openDialogue(introIds);
    }
  }

  private syncVisuals(): void {
    if (!this.heroSprite || !this.hero) {
      return;
    }

    this.heroSprite.setPosition(this.hero.position.x, this.hero.position.y);

    const isPrologue = this.getCampaignPhase() === 'prologue';
    const auraColor = isPrologue ? 0xfbbf24 : 0x38bdf8;
    const pulse = isPrologue
      ? 0.06 + Math.sin(this.elapsedTimeMs * 0.004) * 0.02
      : 0.14 + Math.sin(this.elapsedTimeMs * 0.005) * 0.04;
    const auraRadius = isPrologue ? 16 : 19;
    this.heroAura.clear();
    this.heroAura.fillStyle(auraColor, pulse);
    this.heroAura.fillCircle(
      this.hero.position.x,
      this.hero.position.y + 6,
      auraRadius
    );

    const highlightPulse = 0.28 + Math.sin(this.elapsedTimeMs * 0.007) * 0.08;
    for (const station of this.stations) {
      const isNearby = station.config.id === this.nearbyStationId;
      station.aura.clear();
      station.aura.fillStyle(
        station.config.accentColor,
        isNearby ? highlightPulse : 0.14
      );
      station.aura.fillCircle(0, 4, isNearby ? 30 : 22);
      station.aura.lineStyle(
        isNearby ? 2 : 1,
        station.config.accentColor,
        isNearby ? 0.92 : 0.42
      );
      station.aura.strokeCircle(0, 4, isNearby ? 28 : 21);

      station.nameLabel.setColor(isNearby ? '#ffffff' : station.config.accentHex);
      station.promptLabel.setVisible(isNearby);
    }
  }

  private createStations(viewport: ViewportConfig): void {
    this.destroyStations();

    const isPrologue = this.getCampaignPhase() === 'prologue';
    const stationConfigs = isPrologue ? VILLAGE_STATIONS : HUB_STATIONS;
    const npcTextureKey = isPrologue ? 'village_npcs' : 'hub_npcs';
    const positions = this.getStationPositions(viewport);
    const hasNpcTexture = this.textures.exists(npcTextureKey);

    for (const config of stationConfigs) {
      const pos = positions[config.id];
      const aura = this.add.graphics();

      let visual: Phaser.GameObjects.GameObject;
      if (hasNpcTexture) {
        const frameArg = hasUiTextureFrame(
          this,
          npcTextureKey,
          config.frameIndex
        )
          ? config.frameIndex
          : 0;
        visual = this.add
          .sprite(0, 0, npcTextureKey, frameArg)
          .setScale(1.5);
      } else {
        const gfx = this.add.graphics();
        gfx.fillStyle(config.accentColor, 0.9);
        gfx.fillRoundedRect(-14, -14, 28, 28, 6);
        gfx.lineStyle(2, 0xf8fafc, 0.85);
        gfx.strokeRoundedRect(-14, -14, 28, 28, 6);
        visual = gfx;
      }

      const nameLabel = this.add
        .text(0, -34, config.label, {
          fontFamily: DF_FONTS.TITLE,
          fontSize: '11px',
          color: config.accentHex,
          fontStyle: 'bold',
          stroke: '#05070d',
          strokeThickness: 3,
          align: 'center',
          resolution: 2,
        })
        .setOrigin(0.5);

      const promptLabel = this.add
        .text(0, 30, '[E / Toque] Usar', {
          fontFamily: DF_FONTS.BODY,
          fontSize: '10px',
          color: DF_PALETTE.textSuccess,
          fontStyle: 'bold',
          stroke: '#05070d',
          strokeThickness: 3,
          resolution: 2,
        })
        .setOrigin(0.5)
        .setVisible(false);

      const hitZone = this.add
        .zone(0, 0, 64, 68)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      hitZone.on(
        'pointerdown',
        (
          _pointer: Phaser.Input.Pointer,
          _lx: number,
          _ly: number,
          event?: Phaser.Types.Input.EventData
        ) => {
          event?.stopPropagation?.();
          if (this.isAnyModalOpen()) {
            return;
          }
          this.activateStation(config.id);
        }
      );

      const container = this.add
        .container(pos.x, pos.y, [aura, visual, nameLabel, promptLabel, hitZone])
        .setDepth(16);

      this.stations.push({
        config,
        position: { ...pos },
        container,
        aura,
        visual,
        nameLabel,
        promptLabel,
        hitZone,
      });
    }
  }

  private layoutStations(viewport: ViewportConfig): void {
    const positions = this.getStationPositions(viewport);

    for (const station of this.stations) {
      const pos = positions[station.config.id];
      station.position = { ...pos };
      station.container.setPosition(pos.x, pos.y);
      station.nameLabel.setFontSize(11);
      station.promptLabel.setText('[E / Toque] Usar');
    }
  }

  private destroyStations(): void {
    for (const station of this.stations) {
      station.container.destroy();
    }
    this.stations = [];
  }

  private buildArenaTilesAndLighting(viewport: ViewportConfig): void {
    this.arenaLayer.removeAll(true);

    const isPrologue = this.getCampaignPhase() === 'prologue';
    const tileKey = isPrologue ? 'village_tiles' : 'hub_tiles';
    const width = viewport.width;
    const height = viewport.height;
    const cols = Math.ceil(width / TILE_DISPLAY_SIZE);
    const rows = Math.ceil(height / TILE_DISPLAY_SIZE);

    const hasTiles = this.textures.exists(tileKey);
    const tileTexture = hasTiles ? this.textures.get(tileKey) : null;
    const hasTileFrames = Boolean(tileTexture && tileTexture.frameTotal > 4);

    if (hasTiles) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const isWall =
            row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
          const isCenterFeature =
            !isWall &&
            Math.abs(col - Math.floor(cols / 2)) <= 1 &&
            Math.abs(row - Math.floor(rows / 2)) <= 1;
          const hash = (col * 29 + row * 19) % 9;
          const frameIndex = isWall ? 2 : isCenterFeature || hash === 0 ? 1 : 0;

          const tileX = col * TILE_DISPLAY_SIZE + TILE_DISPLAY_SIZE / 2;
          const tileY = row * TILE_DISPLAY_SIZE + TILE_DISPLAY_SIZE / 2;

          const tile = this.add.image(
            tileX,
            tileY,
            tileKey,
            hasTileFrames ? frameIndex : undefined
          );
          tile.setDisplaySize(TILE_DISPLAY_SIZE, TILE_DISPLAY_SIZE);
          this.arenaLayer.add(tile);
        }
      }
    } else {
      const fallbackBg = this.add.graphics();
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const isWall =
            row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
          const isFeature =
            !isWall &&
            ((Math.abs(col - Math.floor(cols / 2)) <= 1 &&
              Math.abs(row - Math.floor(rows / 2)) <= 1) ||
              (col * 29 + row * 19) % 9 === 0);
          const color = isPrologue
            ? isWall
              ? 0x2b1d14
              : isFeature
                ? 0x363b2e
                : 0x182a1c
            : isWall
              ? 0x090d16
              : isFeature
                ? 0x1a2336
                : 0x111622;
          fallbackBg.fillStyle(color, 1);
          fallbackBg.fillRect(
            col * TILE_DISPLAY_SIZE,
            row * TILE_DISPLAY_SIZE,
            TILE_DISPLAY_SIZE - 1,
            TILE_DISPLAY_SIZE - 1
          );
        }
      }
      this.arenaLayer.add(fallbackBg);
    }

    // Sanctuary / Village Lighting & Corner Braziers/Lanterns
    this.lightingGraphics.clear();
    this.lightingGraphics.lineStyle(
      18,
      isPrologue ? 0x0b120c : 0x05070c,
      isPrologue ? 0.42 : 0.58
    );
    this.lightingGraphics.strokeRect(9, 9, width - 18, height - 18);

    this.lightingGraphics.lineStyle(2, isPrologue ? 0xf59e0b : 0x38bdf8, 0.28);
    this.lightingGraphics.strokeRect(
      TILE_DISPLAY_SIZE,
      TILE_DISPLAY_SIZE,
      width - TILE_DISPLAY_SIZE * 2,
      height - TILE_DISPLAY_SIZE * 2
    );

    const bounds = this.getMovementBounds(viewport);
    const centerX = Math.round((bounds.minX + bounds.maxX) / 2);
    const centerY = Math.round((bounds.minY + bounds.maxY) / 2);
    this.lightingGraphics.lineStyle(1.5, isPrologue ? 0xfbbf24 : 0x48cae4, 0.22);
    this.lightingGraphics.strokeCircle(centerX, centerY, 56);
    this.lightingGraphics.lineStyle(1, isPrologue ? 0x6ee7b7 : 0xffd166, 0.16);
    this.lightingGraphics.strokeCircle(centerX, centerY, 42);

    const brazierTopY = 92;
    const brazierBottomY = height - 108;
    const braziers: Vector2D[] = [
      { x: TILE_DISPLAY_SIZE + 14, y: brazierTopY },
      { x: width - TILE_DISPLAY_SIZE - 14, y: brazierTopY },
      { x: TILE_DISPLAY_SIZE + 14, y: brazierBottomY },
      { x: width - TILE_DISPLAY_SIZE - 14, y: brazierBottomY },
    ];

    for (const brazier of braziers) {
      if (hasTiles && hasTileFrames) {
        const img = this.add
          .image(brazier.x, brazier.y, tileKey, 3)
          .setDisplaySize(24, 24);
        this.arenaLayer.add(img);
      }
      this.lightingGraphics.fillStyle(
        isPrologue ? 0xf59e0b : 0xf97316,
        isPrologue ? 0.2 : 0.15
      );
      this.lightingGraphics.fillCircle(brazier.x, brazier.y, isPrologue ? 44 : 40);
      this.lightingGraphics.fillStyle(
        isPrologue ? 0xfbbf24 : 0xffba08,
        isPrologue ? 0.34 : 0.26
      );
      this.lightingGraphics.fillCircle(brazier.x, brazier.y, 18);
      this.lightingGraphics.fillStyle(0xfef3c7, isPrologue ? 0.85 : 0.72);
      this.lightingGraphics.fillCircle(brazier.x, brazier.y, 4);
    }
  }

  private getStationPositions(
    viewport: ViewportConfig
  ): Record<HubStationId, Vector2D> {
    const w = viewport.width || DEFAULT_HUB_WIDTH;
    const h = viewport.height || DEFAULT_HUB_HEIGHT;

    return {
      rift_portal: { x: Math.round(w * 0.5), y: Math.round(h * 0.27) },
      soul_altar: { x: Math.round(w * 0.2), y: Math.round(h * 0.5) },
      blacksmith: { x: Math.round(w * 0.8), y: Math.round(h * 0.5) },
      emissary: { x: Math.round(w * 0.34), y: Math.round(h * 0.72) },
    };
  }

  private getInitialHeroSpawn(viewport: ViewportConfig): Vector2D {
    const w = viewport.width || DEFAULT_HUB_WIDTH;
    const h = viewport.height || DEFAULT_HUB_HEIGHT;
    return { x: Math.round(w * 0.5), y: Math.round(h * 0.54) };
  }

  private getMovementBounds(viewport: ViewportConfig): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    return {
      minX: ARENA_PADDING_X,
      maxX: Math.max(ARENA_PADDING_X, viewport.width - ARENA_PADDING_X),
      minY: 102,
      maxY: Math.max(140, viewport.height - 108),
    };
  }

  private getWorldZoom(): number {
    return HUB_WORLD_ZOOM;
  }

  private handleViewportResize(width: number, height: number): void {
    if (!this.hero) {
      return;
    }

    this.viewport = resolveViewportConfig(width, height);
    if (this.isVillage) {
      this.cameraRig?.resize(
        this.viewport.width,
        this.viewport.height,
        this.getWorldZoom(),
        VILLAGE_MAP_W,
        VILLAGE_MAP_H
      );
      this.villageHud?.resize(this.viewport);
      this.gateModal?.resize(this.viewport);
      this.altarModal?.resize(this.viewport);
      this.blacksmithModal?.resize(this.viewport);
      this.inventoryModal?.resize(this.viewport);
      this.dialogueBox?.handleResize();
      this.cameraRig?.syncLayers();
      this.updateHud();
      return;
    }
    if (!this.hud) {
      return;
    }
    this.buildArenaTilesAndLighting(this.viewport);
    this.layoutStations(this.viewport);

    const bounds = this.getMovementBounds(this.viewport);
    this.hero.position.x = Math.max(
      bounds.minX,
      Math.min(bounds.maxX, this.hero.position.x)
    );
    this.hero.position.y = Math.max(
      bounds.minY,
      Math.min(bounds.maxY, this.hero.position.y)
    );

    this.cameraRig?.resize(
      this.viewport.width,
      this.viewport.height,
      this.getWorldZoom(),
      this.viewport.width,
      this.viewport.height
    );

    this.hud.resize(this.viewport);
    this.altarModal?.resize(this.viewport);
    this.blacksmithModal?.resize(this.viewport);
    this.inventoryModal?.resize(this.viewport);
    this.dialogueBox?.handleResize();

    this.updateProximityState();
    this.syncVisuals();
    this.weaponRig?.sync(false, this.time?.now ?? this.elapsedTimeMs);
    this.cameraRig?.syncLayers();
    this.updateHud();
  }

  private formatRunEndBanner(report: RunEndReport): string {
    if (report.victory) {
      return `Extração completa! +${report.soulsGained} Almas, +${report.essencesGained} Essências, ${report.keptItems.length} item(ns) no Baú.`;
    }
    return `Retorno da Fenda: +${report.soulsGained} Almas salvas; ${report.lostItems.length} espólio(s) perdido(s).`;
  }

  private showTimedBanner(text: string, durationMs: number): void {
    this.bannerText = text;
    this.bannerExpiresAtMs = this.elapsedTimeMs + durationMs;
  }

  private ensureRequiredFallbackTextures(): void {
    if (!this.textures.exists('hero_living')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0xd97706, 1);
      gfx.fillRect(14, 10, 52, 60);
      gfx.lineStyle(2, 0xfef3c7, 1);
      gfx.strokeRect(14, 10, 52, 60);
      gfx.generateTexture('hero_living', 80, 80);
      gfx.destroy();
    }
    if (!this.textures.exists('hero_wraith')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x38bdf8, 1);
      gfx.fillRect(14, 10, 52, 60);
      gfx.lineStyle(2, 0x09090b, 1);
      gfx.strokeRect(14, 10, 52, 60);
      gfx.generateTexture('hero_wraith', 80, 80);
      gfx.destroy();
    }
    if (!this.textures.exists('weapons')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0xe2e8f0, 1);
      gfx.fillRect(20, 6, 8, 36);
      gfx.fillStyle(0xfbbf24, 1);
      gfx.fillRect(14, 30, 20, 5);
      gfx.generateTexture('weapons', 48, 48);
      gfx.destroy();
    }
  }

  private cleanupScene(): void {
    this.lastFootstepFrame = -1;
    if (this.resizeHandler) {
      this.scale.off('resize', this.resizeHandler);
      this.resizeHandler = undefined;
    }
    if (this.pointerUnlockHandler) {
      this.input.off('pointerdown', this.pointerUnlockHandler);
      this.pointerUnlockHandler = undefined;
    }
    if (this.keydownHandler) {
      this.input.keyboard?.off('keydown', this.keydownHandler);
      this.keydownHandler = undefined;
    }

    this.cameraRig?.destroy();
    this.cameraRig = undefined;

    this.destroyStations();
    this.arenaLayer?.destroy();
    this.lightingGraphics?.destroy();
    this.heroAura?.destroy();
    this.weaponRig?.destroy();
    this.weaponRig = undefined;
    this.heroSprite?.destroy();

    this.dialogueBox?.destroy();
    this.altarModal?.destroy();
    this.blacksmithModal?.destroy();
    this.inventoryModal?.destroy();
    this.hud?.destroy();
    this.hud = undefined;
    this.gateModal?.destroy();
    this.gateModal = undefined;
    this.villageHud?.destroy();
    this.villageHud = undefined;
    this.villageWorld?.destroy();
    this.villageWorld = undefined;
    this.villageNearby = null;

    if (typeof window !== 'undefined') {
      const w = window as unknown as { __SUBMUNDO_DEBUG__?: Record<string, unknown> };
      const dbg = w.__SUBMUNDO_DEBUG__;
      if (dbg) {
        for (const key of this.villageDebugKeysAdded) {
          delete dbg[key];
        }
        if (Object.keys(dbg).length === 0) {
          w.__SUBMUNDO_DEBUG__ = undefined;
        }
      }
      this.villageDebugKeysAdded = [];
    }

    if (
      typeof window !== 'undefined' &&
      window.__SUBMUNDO_HUB_DEBUG__?.scene === this
    ) {
      window.__SUBMUNDO_HUB_DEBUG__ = undefined;
    }
  }
}
