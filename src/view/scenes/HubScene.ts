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
  markSpokenToMaster,
  resolveVillageHubState,
  type VillageHubState,
} from '../../core/progression/VillageHubManager';
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
import { HubHud, type HubHudSnapshot } from '../ui/HubHud';
import {
  InventoryModal,
  type InventoryHudSnapshot,
} from '../ui/InventoryModal';
import { VillageGateModal } from '../ui/VillageGateModal';

export type HubStationId = 'emissary' | 'blacksmith' | 'soul_altar' | 'rift_portal';

export type HubStationAlias =
  | HubStationId
  | 'weapon_master'
  | 'lyra'
  | 'gorran'
  | 'exit_gate'
  | 'gate';

export interface VillageObstacleRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

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
  getVillageState: () => VillageHubState;
  getHeroPosition: () => Vector2D;
  setHeroPosition: (x: number, y: number) => void;
  getVillageObstacles: () => VillageObstacleRect[];
  interactWithStation: (id: HubStationId) => void;
  getGateModal: () => VillageGateModal;
}

declare global {
  interface Window {
    __SUBMUNDO_HUB_DEBUG__?: SubmundoHubDebugApi;
  }
}

interface HubStationConfig {
  id: HubStationId;
  label: string;
  frameIndex: number;
  accentColor: number;
  accentHex: string;
  npcTextureKey?: string;
  npcAnimKey?: string;
  flipX?: boolean;
  labelOffsetY?: number;
}

interface HubStationView {
  config: HubStationConfig;
  position: Vector2D;
  baseY: number;
  container: Phaser.GameObjects.Container;
  aura: Phaser.GameObjects.Graphics;
  visual: Phaser.GameObjects.GameObject;
  nameLabel: Phaser.GameObjects.Text;
  promptLabel: Phaser.GameObjects.Text;
  exclamationLabel?: Phaser.GameObjects.Text;
  hitZone: Phaser.GameObjects.Zone;
}

interface DepthSortedProp {
  obj: Phaser.GameObjects.GameObject & { setDepth: (value: number) => unknown };
  baseY: number;
}

interface VillageTextureSpec {
  key: string;
  file: string;
  frameWidth: number;
  frameHeight: number;
  fallbackColor: number;
}

export const VILLAGE_WORLD_WIDTH = 1280;
export const VILLAGE_WORLD_HEIGHT = 720;

const DEFAULT_HUB_WIDTH = 960;
const DEFAULT_HUB_HEIGHT = 540;
const HUB_WORLD_ZOOM = 1.45;
const TILE_DISPLAY_SIZE = 32;
const ARENA_PADDING_X = 40;
const STATION_INTERACT_RADIUS = 68;
const BANNER_DEFAULT_DURATION_MS = 6500;
const HERO_FEET_OFFSET_Y = 27;

const VILLAGE_TEXTURE_SPECS: readonly VillageTextureSpec[] = [
  {
    key: 'village_hub_tiles',
    file: 'assets/sprites/village_hub_tiles.png',
    frameWidth: 32,
    frameHeight: 32,
    fallbackColor: 0x3b2f20,
  },
  {
    key: 'village_hub_props',
    file: 'assets/sprites/village_hub_props.png',
    frameWidth: 32,
    frameHeight: 32,
    fallbackColor: 0x78350f,
  },
  {
    key: 'village_hub_props_large',
    file: 'assets/sprites/village_hub_props_large.png',
    frameWidth: 64,
    frameHeight: 64,
    fallbackColor: 0x5c4028,
  },
  {
    key: 'village_hub_house',
    file: 'assets/sprites/village_hub_house.png',
    frameWidth: 224,
    frameHeight: 192,
    fallbackColor: 0x6b4f35,
  },
  {
    key: 'village_hub_gate',
    file: 'assets/sprites/village_hub_gate.png',
    frameWidth: 192,
    frameHeight: 160,
    fallbackColor: 0x4b5563,
  },
  {
    key: 'npc_weapon_master',
    file: 'assets/sprites/npc_weapon_master.png',
    frameWidth: 80,
    frameHeight: 80,
    fallbackColor: 0x94a3b8,
  },
  {
    key: 'npc_lyra',
    file: 'assets/sprites/npc_lyra.png',
    frameWidth: 80,
    frameHeight: 80,
    fallbackColor: 0x34d399,
  },
  {
    key: 'npc_gorran',
    file: 'assets/sprites/npc_gorran.png',
    frameWidth: 80,
    frameHeight: 80,
    fallbackColor: 0xd97706,
  },
];

const VILLAGE_STATIONS: readonly HubStationConfig[] = [
  {
    id: 'emissary',
    label: 'Mestre de Armas',
    frameIndex: 0,
    accentColor: 0xfacc15,
    accentHex: '#e7c47a',
    npcTextureKey: 'npc_weapon_master',
    npcAnimKey: 'npc_weapon_master_idle',
    labelOffsetY: -40,
  },
  {
    id: 'soul_altar',
    label: 'Lyra',
    frameIndex: 2,
    accentColor: 0x4ade80,
    accentHex: '#f3e6cc',
    npcTextureKey: 'npc_lyra',
    npcAnimKey: 'npc_lyra_idle',
    labelOffsetY: -38,
  },
  {
    id: 'blacksmith',
    label: 'Gorran',
    frameIndex: 1,
    accentColor: 0xf97316,
    accentHex: '#f3e6cc',
    npcTextureKey: 'npc_gorran',
    npcAnimKey: 'npc_gorran_hammer',
    flipX: true,
    labelOffsetY: -40,
  },
  {
    id: 'rift_portal',
    label: 'Portão de Saída',
    frameIndex: 3,
    accentColor: 0xfbbf24,
    accentHex: '#fde68a',
    labelOffsetY: -28,
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

const EMISSARY_DIALOGUE_KEYS = [
  'hub_welcome',
  'altar_intro',
  'blacksmith_intro',
  'portal_enter',
  'extraction_loot_kept',
] as const;

function makeObstacleRect(
  id: string,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): VillageObstacleRect {
  return {
    id,
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    minX,
    maxX,
    minY,
    maxY,
  };
}

const DEFAULT_VILLAGE_OBSTACLES: readonly VillageObstacleRect[] = [
  // 1. Casa de Palha (tronco/base da casa)
  makeObstacleRect('straw_house', 225, 120, 435, 278),
  // 2. Pilares do Portão de Pedra (deixando o vão central x: 826..894 livre até y = 215)
  makeObstacleRect('gate_pillar_left', 765, 110, 825, 248),
  makeObstacleRect('gate_pillar_right', 895, 110, 955, 248),
  makeObstacleRect('gate_arch_top', 825, 110, 895, 215),
  // 3. Carroça grande à esquerda do portão
  makeObstacleRect('wooden_cart', 705, 215, 765, 262),
  // 4. Fogueira central
  makeObstacleRect('campfire', 616, 372, 664, 412),
  // 5. Bigorna e Forja à direita
  makeObstacleRect('forge_and_anvil', 860, 360, 1020, 418),
];

export class HubScene extends Phaser.Scene {
  private profile!: SaveProfile;
  private hero!: HeroState;
  private viewport!: ViewportConfig;

  private hud!: HubHud;
  private altarModal!: AltarModal;
  private blacksmithModal!: BlacksmithModal;
  private inventoryModal!: InventoryModal;
  private gateModal!: VillageGateModal;
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
  private villageDepthProps: DepthSortedProp[] = [];
  private villageObstacles: VillageObstacleRect[] = [];
  private nearbyStationId: HubStationId | null = null;
  private emissaryDialogueIndex = 0;
  private selectedStageId: CampaignStageId = 'prologue_grotto';
  private returnedFromDungeon = false;

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

  public preload(): void {
    if (!this.load || typeof this.load.spritesheet !== 'function') {
      return;
    }
    for (const spec of VILLAGE_TEXTURE_SPECS) {
      if (!this.textures.exists(spec.key)) {
        this.load.spritesheet(spec.key, spec.file, {
          frameWidth: spec.frameWidth,
          frameHeight: spec.frameHeight,
        });
      }
    }
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
    this.registerVillageAnimations();

    this.profile = loadOrCreateProfile();
    const campaign = ensureCampaignProgress(this.profile);

    const transitionExt = data as
      | (HubTransitionData & {
          applyOutcome?: boolean;
          returnedFromDungeon?: boolean;
        })
      | undefined;

    this.returnedFromDungeon = Boolean(
      transitionExt?.fromRun || transitionExt?.returnedFromDungeon
    );

    if (transitionExt?.fromRun) {
      if (transitionExt.applyOutcome === true) {
        applyRunOutcomeToProfile(this.profile, transitionExt.fromRun);
        persistProfile(this.profile);
      }
      this.showTimedBanner(
        this.formatRunEndBanner(transitionExt.fromRun),
        9000
      );
    } else if (campaign.phase !== 'prologue') {
      this.showTimedBanner(
        dialoguesData.entries.hub_welcome.shortText,
        BANNER_DEFAULT_DURATION_MS
      );
    } else {
      this.bannerText = undefined;
    }

    const updatedCampaign = ensureCampaignProgress(this.profile);
    const isPrologue = updatedCampaign.phase === 'prologue';

    this.syncSelectedStage(transitionExt?.stageId);
    this.cameras.main.setBackgroundColor(isPrologue ? '#0e120e' : '#090b12');

    const spawnPos = this.getInitialHeroSpawn(this.viewport);
    this.hero = buildHeroFromProfile(this.profile, spawnPos);

    this.arenaLayer = this.add.container(0, 0).setDepth(1);
    this.lightingGraphics = this.add.graphics().setDepth(5);
    this.heroAura = this.add.graphics().setDepth(19);

    this.buildArenaTilesAndLighting(this.viewport);
    this.createStations(this.viewport);

    const heroKey = isPrologue ? 'hero_living' : 'hero_wraith';
    this.heroSpriteKey = heroKey;
    this.heroSprite = this.add
      .sprite(this.hero.position.x, this.hero.position.y, this.heroSpriteKey, 0)
      .setScale(0.88)
      .setDepth(20);
    if (isPrologue && this.returnedFromDungeon) {
      this.heroSprite.setFlipX(true);
    }
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

    this.gateModal = new VillageGateModal(this, {
      onSelectStage: (stageId) => {
        soundManager.unlock();
        this.enterDungeon(stageId);
      },
      onClose: () => {
        soundManager.play('ui_click');
        this.updateHud();
      },
    });

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
      boundsWidth: this.getWorldWidth(),
      boundsHeight: this.getWorldHeight(),
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
        getVillageState: () =>
          resolveVillageHubState(this.profile, {
            returnedFromDungeon: this.returnedFromDungeon,
          }),
        getHeroPosition: () => ({ ...this.hero.position }),
        setHeroPosition: (x: number, y: number) => {
          this.hero.position.x = x;
          this.hero.position.y = y;
          this.updateProximityState();
          this.syncVisuals();
          this.weaponRig?.sync(false, this.time?.now ?? this.elapsedTimeMs);
          this.cameraRig?.syncLayers();
          this.updateHud();
        },
        getVillageObstacles: () => [...this.villageObstacles],
        interactWithStation: (id: HubStationId) => this.activateStation(id),
        getGateModal: () => this.gateModal,
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
    if (!this.hero || !this.hud || this.enteringDungeon) {
      return;
    }

    const clampedDelta = Math.min(Math.max(0, delta), 100);
    this.elapsedTimeMs += clampedDelta;

    if (this.bannerText && this.elapsedTimeMs >= this.bannerExpiresAtMs) {
      this.bannerText = undefined;
    }

    const canMove = !this.isAnyModalOpen();
    let moveDir: Vector2D = { x: 0, y: 0 };
    let dx = 0;
    let dy = 0;

    if (canMove) {
      moveDir = this.hud.getMoveVector();
      const prevX = this.hero.position.x;
      const prevY = this.hero.position.y;

      if (this.getCampaignPhase() === 'prologue') {
        this.moveHeroInVillageWithCollision(moveDir, clampedDelta);
      } else {
        const bounds = this.getMovementBounds(this.viewport);
        moveHero(this.hero, moveDir, clampedDelta, {
          width: this.getWorldWidth(),
          height: this.getWorldHeight(),
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
      }

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

  public openGateModal(): void {
    if (this.enteringDungeon) {
      return;
    }
    soundManager.unlock();
    soundManager.play('ui_click');
    const state = resolveVillageHubState(this.profile, {
      returnedFromDungeon: this.returnedFromDungeon,
    });
    this.closeAllModalsExcept('gate');
    this.gateModal.open(state.dungeons);
    this.updateHud();
  }

  public openDialogue(ids: string[], onComplete?: () => void): void {
    if (this.enteringDungeon) {
      return;
    }
    const lines = ids
      .map((id) => getDialogueLine(id))
      .filter((line): line is DialogueLine => line !== null);
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
    if (phase === 'prologue') {
      const res = markSpokenToMaster(this.profile);
      persistProfile(this.profile);
      this.syncVisuals();
      this.updateHud();
      this.openDialogue([res.dialogueId]);
      return;
    }

    const key =
      EMISSARY_DIALOGUE_KEYS[
        this.emissaryDialogueIndex % EMISSARY_DIALOGUE_KEYS.length
      ];
    this.emissaryDialogueIndex += 1;
    this.openDialogue([key]);
  }

  public setCampaignPhase(phase: CampaignPhase, stageId?: CampaignStageId): void {
    setCampaignStageOrPhase(this.profile, phase, stageId);
    this.syncSelectedStage(stageId);
    persistProfile(this.profile);
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

  private normalizeStationId(id: HubStationAlias): HubStationId {
    switch (id) {
      case 'weapon_master':
      case 'emissary':
        return 'emissary';
      case 'lyra':
      case 'soul_altar':
        return 'soul_altar';
      case 'gorran':
      case 'blacksmith':
        return 'blacksmith';
      case 'exit_gate':
      case 'gate':
      case 'rift_portal':
        return 'rift_portal';
    }
  }

  private activateStation(stationId: HubStationAlias): void {
    soundManager.unlock();
    const canonicalId = this.normalizeStationId(stationId);
    const isPrologue = this.getCampaignPhase() === 'prologue';

    if (isPrologue) {
      switch (canonicalId) {
        case 'emissary': {
          const res = markSpokenToMaster(this.profile);
          persistProfile(this.profile);
          this.syncVisuals();
          this.updateHud();
          this.openDialogue([res.dialogueId]);
          return;
        }
        case 'soul_altar':
          this.openDialogue(['village_lyra_talk']);
          return;
        case 'blacksmith':
          this.openDialogue(['village_gorran_talk']);
          return;
        case 'rift_portal': {
          const state = resolveVillageHubState(this.profile, {
            returnedFromDungeon: this.returnedFromDungeon,
          });
          if (!state.gateUnlocked) {
            this.openDialogue(['village_gate_locked']);
            return;
          }
          this.openGateModal();
          return;
        }
      }
    }

    switch (canonicalId) {
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
    keep: 'altar' | 'blacksmith' | 'stash' | 'gate' | 'dialogue' | null
  ): void {
    if (keep !== 'altar' && this.altarModal?.isOpen()) {
      this.altarModal.close();
    }
    if (keep !== 'blacksmith' && this.blacksmithModal?.isOpen()) {
      this.blacksmithModal.close();
    }
    if (keep !== 'stash' && this.inventoryModal?.isOpen()) {
      this.inventoryModal.close();
    }
    if (keep !== 'gate' && this.gateModal?.isOpen()) {
      this.gateModal.close();
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
      Boolean(this.gateModal?.isOpen()) ||
      Boolean(this.dialogueBox?.isOpen())
    );
  }

  private refreshHeroFromProfile(): void {
    const pos = this.hero
      ? { ...this.hero.position }
      : this.getInitialHeroSpawn(this.viewport);
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

    const villageState = isPrologue
      ? resolveVillageHubState(this.profile, {
          returnedFromDungeon: this.returnedFromDungeon,
        })
      : undefined;

    const worldW = this.getWorldWidth();
    const worldH = this.getWorldHeight();

    const snapshot: HubHudSnapshot = {
      souls: this.profile.souls,
      generalEssences: this.profile.generalEssences,
      equippedCount,
      stashCount: this.profile.stash.length,
      nearbyStationLabel: nearbyStation?.config.label,
      bannerText: this.bannerText,
      locationTitle: isPrologue ? 'Vila Natal' : 'Refúgio do Submundo',
      stageLabel: selectedStage?.name,
      canCycleStage: availableStages.length > 1,
      isPrologue,
      isMuted: soundManager.isMuted(),
      heroHp: this.hero?.stats.hp ?? 100,
      heroMaxHp: this.hero?.stats.maxHp ?? 100,
      heroLevel: 1,
      heroName: isPrologue ? 'JOVEM GUERREIRO' : 'ESPECTRO',
      trackerTitle: 'VILA NATAL',
      trackerText: villageState?.trackerText ?? 'Falar com o Mestre',
      heroNormalizedPos: {
        x: worldW > 0 ? this.hero.position.x / worldW : 0.5,
        y: worldH > 0 ? this.hero.position.y / worldH : 0.5,
      },
      masterExclamation: villageState?.showMasterExclamation ?? false,
      gateUnlocked: villageState?.gateUnlocked ?? false,
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

    this.selectedStageId = available[0]?.id ?? 'prologue_grotto';
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
    const spawnPos = this.getInitialHeroSpawn(this.viewport);
    if (this.hero) {
      this.hero.position.x = spawnPos.x;
      this.hero.position.y = spawnPos.y;
    }
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
      phase === 'prologue' ? '#0e120e' : '#090b12'
    );
    this.buildArenaTilesAndLighting(this.viewport);
    this.createStations(this.viewport);
    this.cameraRig?.resize(
      this.viewport.width,
      this.viewport.height,
      this.getWorldZoom(),
      this.getWorldWidth(),
      this.getWorldHeight()
    );
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

    if (fromRun?.victory && fromRun.stageId) {
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

    // Decision #23 / BRF-153: No automatic blocking dialogue on clean boot of the Village.
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

    const villageState = isPrologue
      ? resolveVillageHubState(this.profile, {
          returnedFromDungeon: this.returnedFromDungeon,
        })
      : undefined;

    const heroFeetY = this.hero.position.y + HERO_FEET_OFFSET_Y;

    // 2.5D Y-depth sorting for structures and props relative to hero (depth 20) & weapon (depth 21)
    if (isPrologue) {
      for (const prop of this.villageDepthProps) {
        const nextDepth =
          prop.baseY <= heroFeetY
            ? 8 + prop.baseY * 0.012
            : 22 + prop.baseY * 0.012;
        prop.obj.setDepth(nextDepth);
      }
    }

    const highlightPulse = 0.28 + Math.sin(this.elapsedTimeMs * 0.007) * 0.08;
    const exclPulseY = Math.sin(this.elapsedTimeMs * 0.008) * 2.5;
    const exclScale = 1 + Math.sin(this.elapsedTimeMs * 0.008) * 0.08;

    for (const station of this.stations) {
      const isNearby = station.config.id === this.nearbyStationId;
      station.aura.clear();

      if (isPrologue && station.config.id !== 'rift_portal') {
        // Subtle contact shadow + proximity ring under 80x80 village NPCs
        station.aura.fillStyle(0x000000, 0.36);
        station.aura.fillEllipse(0, 27, 36, 11);
        if (isNearby) {
          station.aura.lineStyle(2, station.config.accentColor, 0.88);
          station.aura.strokeEllipse(0, 27, 42, 15);
        }
      } else {
        station.aura.fillStyle(
          station.config.accentColor,
          isNearby ? highlightPulse : 0.14
        );
        station.aura.fillCircle(0, 4, isNearby ? 28 : 20);
        station.aura.lineStyle(
          isNearby ? 2 : 1,
          station.config.accentColor,
          isNearby ? 0.92 : 0.42
        );
        station.aura.strokeCircle(0, 4, isNearby ? 26 : 19);
      }

      station.nameLabel.setColor(
        isNearby ? '#ffffff' : station.config.accentHex
      );
      station.promptLabel.setVisible(!isPrologue && isNearby);

      if (station.exclamationLabel) {
        const showExcl = Boolean(
          isPrologue &&
            station.config.id === 'emissary' &&
            villageState?.showMasterExclamation
        );
        station.exclamationLabel.setVisible(showExcl);
        if (showExcl) {
          station.exclamationLabel.setY(-62 + exclPulseY);
          station.exclamationLabel.setScale(exclScale);
        }
      }

      if (isPrologue) {
        const stationDepth =
          station.baseY <= heroFeetY
            ? 8 + station.baseY * 0.012
            : 22 + station.baseY * 0.012;
        station.container.setDepth(stationDepth);
      } else {
        station.container.setDepth(16);
      }
    }
  }

  private createStations(viewport: ViewportConfig): void {
    this.destroyStations();

    const isPrologue = this.getCampaignPhase() === 'prologue';
    const stationConfigs = isPrologue ? VILLAGE_STATIONS : HUB_STATIONS;
    const positions = this.getStationPositions(viewport);

    for (const config of stationConfigs) {
      const pos = positions[config.id];
      const aura = this.add.graphics();

      let visual: Phaser.GameObjects.GameObject;
      if (isPrologue) {
        if (config.npcTextureKey && this.textures.exists(config.npcTextureKey)) {
          const spr = this.add
            .sprite(0, 0, config.npcTextureKey, 0)
            .setScale(0.88);
          if (config.flipX) {
            spr.setFlipX(true);
          }
          if (config.npcAnimKey && this.anims.exists(config.npcAnimKey)) {
            spr.play(config.npcAnimKey, true);
          }
          visual = spr;
        } else if (config.id === 'rift_portal') {
          const gateGfx = this.add.graphics();
          gateGfx.fillStyle(0xfbbf24, 0.16);
          gateGfx.fillEllipse(0, 4, 48, 18);
          visual = gateGfx;
        } else {
          const gfx = this.add.graphics();
          gfx.fillStyle(config.accentColor, 0.9);
          gfx.fillRoundedRect(-14, -14, 28, 28, 6);
          visual = gfx;
        }
      } else {
        const hasNpcTexture = this.textures.exists('hub_npcs');
        if (hasNpcTexture) {
          const frameArg = hasUiTextureFrame(
            this,
            'hub_npcs',
            config.frameIndex
          )
            ? config.frameIndex
            : 0;
          visual = this.add
            .sprite(0, 0, 'hub_npcs', frameArg)
            .setScale(1.5);
        } else {
          const gfx = this.add.graphics();
          gfx.fillStyle(config.accentColor, 0.9);
          gfx.fillRoundedRect(-14, -14, 28, 28, 6);
          gfx.lineStyle(2, 0xf8fafc, 0.85);
          gfx.strokeRoundedRect(-14, -14, 28, 28, 6);
          visual = gfx;
        }
      }

      const labelY = config.labelOffsetY ?? -34;
      const nameLabel = this.add
        .text(0, labelY, config.label, {
          fontFamily: DF_FONTS.TITLE,
          fontSize: '11.5px',
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

      let exclamationLabel: Phaser.GameObjects.Text | undefined;
      if (isPrologue && config.id === 'emissary') {
        exclamationLabel = this.add
          .text(0, -62, '!', {
            fontFamily: DF_FONTS.TITLE,
            fontSize: '24px',
            color: '#facc15',
            fontStyle: 'bold',
            stroke: '#2d1405',
            strokeThickness: 4,
            resolution: 2,
          })
          .setOrigin(0.5);
      }

      const hitZone = this.add
        .zone(0, 0, 72, 76)
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

      const children: Phaser.GameObjects.GameObject[] = [
        aura,
        visual,
        nameLabel,
        promptLabel,
      ];
      if (exclamationLabel) {
        children.push(exclamationLabel);
      }
      children.push(hitZone);

      const baseY =
        isPrologue && config.id !== 'rift_portal'
          ? pos.y + HERO_FEET_OFFSET_Y
          : pos.y;

      const container = this.add
        .container(pos.x, pos.y, children)
        .setDepth(16);

      this.stations.push({
        config,
        position: { ...pos },
        baseY,
        container,
        aura,
        visual,
        nameLabel,
        promptLabel,
        exclamationLabel,
        hitZone,
      });
    }
  }

  private layoutStations(viewport: ViewportConfig): void {
    const positions = this.getStationPositions(viewport);
    const isPrologue = this.getCampaignPhase() === 'prologue';

    for (const station of this.stations) {
      const pos = positions[station.config.id];
      station.position = { ...pos };
      station.baseY =
        isPrologue && station.config.id !== 'rift_portal'
          ? pos.y + HERO_FEET_OFFSET_Y
          : pos.y;
      station.container.setPosition(pos.x, pos.y);
      station.nameLabel.setFontSize(11.5);
      station.promptLabel.setText('[E / Toque] Usar');
    }
  }

  private destroyStations(): void {
    for (const station of this.stations) {
      station.container.destroy();
    }
    this.stations = [];
  }

  private destroyVillageDepthProps(): void {
    for (const item of this.villageDepthProps) {
      item.obj.destroy();
    }
    this.villageDepthProps = [];
  }

  private buildArenaTilesAndLighting(viewport: ViewportConfig): void {
    this.arenaLayer.removeAll(true);
    this.destroyVillageDepthProps();

    const isPrologue = this.getCampaignPhase() === 'prologue';
    if (isPrologue) {
      this.villageObstacles = [...DEFAULT_VILLAGE_OBSTACLES];
      this.buildVillageHubScenario();
      return;
    }

    this.villageObstacles = [];
    const tileKey = 'hub_tiles';
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
          const color = isWall
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

    this.lightingGraphics.clear();
    this.lightingGraphics.lineStyle(18, 0x05070c, 0.58);
    this.lightingGraphics.strokeRect(9, 9, width - 18, height - 18);

    this.lightingGraphics.lineStyle(2, 0x38bdf8, 0.28);
    this.lightingGraphics.strokeRect(
      TILE_DISPLAY_SIZE,
      TILE_DISPLAY_SIZE,
      width - TILE_DISPLAY_SIZE * 2,
      height - TILE_DISPLAY_SIZE * 2
    );

    const bounds = this.getMovementBounds(viewport);
    const centerX = Math.round((bounds.minX + bounds.maxX) / 2);
    const centerY = Math.round((bounds.minY + bounds.maxY) / 2);
    this.lightingGraphics.lineStyle(1.5, 0x48cae4, 0.22);
    this.lightingGraphics.strokeCircle(centerX, centerY, 56);
    this.lightingGraphics.lineStyle(1, 0xffd166, 0.16);
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
      this.lightingGraphics.fillStyle(0xf97316, 0.15);
      this.lightingGraphics.fillCircle(brazier.x, brazier.y, 40);
      this.lightingGraphics.fillStyle(0xffba08, 0.26);
      this.lightingGraphics.fillCircle(brazier.x, brazier.y, 18);
      this.lightingGraphics.fillStyle(0xfef3c7, 0.72);
      this.lightingGraphics.fillCircle(brazier.x, brazier.y, 4);
    }
  }

  private buildVillageHubScenario(): void {
    const worldW = VILLAGE_WORLD_WIDTH;
    const worldH = VILLAGE_WORLD_HEIGHT;
    const cols = Math.ceil(worldW / TILE_DISPLAY_SIZE);
    const rows = Math.ceil(worldH / TILE_DISPLAY_SIZE);

    const hasHubTiles =
      this.textures.exists('village_hub_tiles') &&
      this.textures.get('village_hub_tiles').frameTotal > 5;
    const hasHerbTiles =
      this.textures.exists('biome_herb_field_tiles') &&
      this.textures.get('biome_herb_field_tiles').frameTotal > 10;
    const hasVillageTiles =
      this.textures.exists('biome_village_tiles') &&
      this.textures.get('biome_village_tiles').frameTotal > 4;

    // 1. Piso contínuo em tiles 32x32 (grama externa, clareira de terra batida, pátio da casa, estrada do portão e cinzas na fogueira/forja)
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const wx = col * TILE_DISPLAY_SIZE + TILE_DISPLAY_SIZE / 2;
        const wy = row * TILE_DISPLAY_SIZE + TILE_DISPLAY_SIZE / 2;
        const hash = (col * 31 + row * 17) % 7;

        const inNorthGateRoad =
          wx >= 795 && wx <= 925 && wy >= 48 && wy <= 310;
        const inRoadCurve =
          wy > 220 &&
          wy <= 405 &&
          Math.abs(wx - (860 - ((wy - 220) / 185) * 185)) <= 56;
        const inHousePatio =
          wx >= 250 && wx <= 450 && wy >= 240 && wy <= 330;
        const inCampfireAsh = Math.hypot(wx - 640, wy - 390) <= 58;
        const inForgeAsh =
          wx >= 848 && wx <= 1038 && wy >= 348 && wy <= 435;
        const inSouthEntry =
          wx >= 585 && wx <= 695 && wy >= 540 && wy <= 680;
        const inClearing =
          wx >= 175 && wx <= 1105 && wy >= 195 && wy <= 565;

        let texKey = 'village_hub_tiles';
        let frameIdx = 0;

        if (inCampfireAsh || inForgeAsh) {
          frameIdx = hash % 2 === 0 ? 8 : 9; // dirt_ash / dirt_cobble
        } else if (inNorthGateRoad || inHousePatio) {
          if (hasVillageTiles && hash === 0) {
            texKey = 'biome_village_tiles';
            frameIdx = (col + row) % 3;
          } else {
            frameIdx = hash % 3 === 0 ? 3 : 9; // dirt_trail / dirt_cobble
          }
        } else if (inRoadCurve) {
          frameIdx = hash % 2 === 0 ? 3 : 9;
        } else if (inClearing || inSouthEntry) {
          if (wy < 220 && !inNorthGateRoad) {
            frameIdx = 6; // dirt_grass_n
          } else if (wy > 542 && !inSouthEntry) {
            frameIdx = 7; // dirt_grass_s
          } else {
            frameIdx = hash < 3 ? 0 : hash < 5 ? 1 : 2; // dirt_0..2
          }
        } else if (hasHerbTiles && (row <= 1 || row >= rows - 2 || col <= 1 || col >= cols - 2)) {
          texKey = 'biome_herb_field_tiles';
          frameIdx = 6; // forest hedge canopy top
        } else if (hasHerbTiles && hash === 0) {
          texKey = 'biome_herb_field_tiles';
          frameIdx = (col + row) % 3;
        } else {
          frameIdx = (col + row) % 2 === 0 ? 4 : 5; // grass_0 / grass_1
        }

        if (hasHubTiles || (texKey !== 'village_hub_tiles' && this.textures.exists(texKey))) {
          const tile = this.add
            .image(wx, wy, texKey, frameIdx)
            .setDisplaySize(TILE_DISPLAY_SIZE, TILE_DISPLAY_SIZE);
          this.arenaLayer.add(tile);
        } else {
          const g = this.add.graphics();
          const fallbackColor =
            inCampfireAsh || inForgeAsh
              ? 0x3b3530
              : inNorthGateRoad || inHousePatio || inRoadCurve
                ? 0x52473b
                : inClearing || inSouthEntry
                  ? 0x4a3728
                  : 0x1e3320;
          g.fillStyle(fallbackColor, 1);
          g.fillRect(
            col * TILE_DISPLAY_SIZE,
            row * TILE_DISPLAY_SIZE,
            TILE_DISPLAY_SIZE,
            TILE_DISPLAY_SIZE
          );
          this.arenaLayer.add(g);
        }
      }
    }

    // Decalques planos de arbustos e pedras nas bordas de grama
    if (
      this.textures.exists('biome_herb_field_props') &&
      this.textures.get('biome_herb_field_props').frameTotal > 16
    ) {
      const groundDecals: Array<{ frame: number; x: number; y: number }> = [
        { frame: 16, x: 185, y: 215 },
        { frame: 15, x: 560, y: 205 },
        { frame: 16, x: 985, y: 220 },
        { frame: 15, x: 1050, y: 255 },
        { frame: 16, x: 1045, y: 495 },
        { frame: 15, x: 240, y: 545 },
        { frame: 16, x: 950, y: 548 },
      ];
      for (const d of groundDecals) {
        const img = this.add.image(
          d.x,
          d.y,
          'biome_herb_field_props',
          d.frame
        );
        this.arenaLayer.add(img);
      }
    }

    // Helper para registrar estruturas e props 2.5D com Y-depth sorting
    const addDepthImage = (
      key: string,
      frame: number | undefined,
      x: number,
      y: number,
      baseY: number,
      scale = 1,
      flipX = false
    ): void => {
      if (!this.textures.exists(key)) {
        return;
      }
      const tex = this.textures.get(key);
      const safeFrame =
        frame !== undefined && tex.frameTotal > frame ? frame : undefined;
      const img = this.add
        .image(x, y, key, safeFrame)
        .setScale(scale)
        .setFlipX(flipX);
      this.villageDepthProps.push({ obj: img, baseY });
    };

    const addDepthSprite = (
      key: string,
      frame: number,
      animKey: string,
      x: number,
      y: number,
      baseY: number,
      scale = 1
    ): void => {
      if (!this.textures.exists(key)) {
        return;
      }
      const tex = this.textures.get(key);
      const safeFrame = tex.frameTotal > frame ? frame : 0;
      const spr = this.add
        .sprite(x, y, key, safeFrame)
        .setScale(scale);
      if (this.anims.exists(animKey)) {
        spr.play(animKey, true);
      }
      this.villageDepthProps.push({ obj: spr, baseY });
    };

    // 2. Perímetro 2.5D: Árvores e Paliçada Alta (palisade_tall_h = 10, palisade_tall_v = 11)
    const treePositions: Array<{ x: number; y: number; apple?: boolean }> = [
      { x: 140, y: 145 },
      { x: 540, y: 140 },
      { x: 610, y: 146, apple: true },
      { x: 1020, y: 152 },
      { x: 1120, y: 158 },
      { x: 105, y: 240 },
      { x: 96, y: 360 },
      { x: 108, y: 490 },
      { x: 1168, y: 265 },
      { x: 1175, y: 410 },
      { x: 1160, y: 520 },
    ];
    for (const t of treePositions) {
      if (t.apple && this.textures.exists('biome_herb_field_props_tall')) {
        addDepthImage(
          'biome_herb_field_props_tall',
          2,
          t.x,
          t.y,
          t.y + 28,
          1.15
        );
      } else {
        addDepthImage(
          'biome_village_props_tall',
          1,
          t.x,
          t.y,
          t.y + 28,
          1.15
        );
      }
    }

    // Paliçada Norte (entre a Casa de Palha e o Portão de Pedra, e à direita do Portão)
    for (const px of [485, 545, 605, 665, 725]) {
      addDepthImage('village_hub_props_large', 10, px, 172, 196);
    }
    for (const px of [995, 1055, 1115]) {
      addDepthImage('village_hub_props_large', 10, px, 178, 202);
    }

    // Paliçadas Laterais Oeste e Leste
    for (const py of [245, 325, 405, 485]) {
      addDepthImage('village_hub_props_large', 11, 148, py, py + 24);
      addDepthImage('village_hub_props_large', 11, 1132, py, py + 24, 1, true);
    }

    // Paliçada Frontal Sul com abertura central (x: 585..695 livre)
    for (const px of [215, 275, 335, 395, 455, 515]) {
      addDepthImage('village_hub_props_large', 10, px, 586, 610);
    }
    addDepthImage('village_hub_props', 5, 560, 596, 612, 1.1);
    addDepthImage('village_hub_props', 5, 720, 596, 612, 1.1);
    for (const px of [765, 825, 885, 945, 1005, 1065]) {
      addDepthImage('village_hub_props_large', 10, px, 586, 610);
    }

    // 3. Estruturas 2.5D Principais: Casa de Palha (224x192) e Portão de Pedra com "SAÍDA" (192x160)
    addDepthImage('village_hub_house', 0, 330, 195, 278);
    addDepthImage('village_hub_gate', 0, 860, 175, 215);

    // Props junto à Casa de Palha
    addDepthImage('village_hub_props', 25, 198, 262, 276); // barrel
    addDepthImage('village_hub_props', 24, 218, 272, 286); // firewood
    if (this.textures.exists('biome_village_props')) {
      addDepthImage('biome_village_props', 5, 444, 266, 280); // crate
      addDepthImage('biome_village_props', 6, 700, 236, 250); // sacks near cart
    }

    // Braseiro animado à direita da porta da Casa de Palha (418, 286)
    addDepthSprite(
      'village_hub_props',
      10,
      'village_brazier_idle',
      418,
      286,
      298
    );

    // Carroça grande à esquerda do Portão de Pedra (735, 240) + Tocha animada norte (690, 215)
    addDepthImage('village_hub_props_large', 9, 735, 240, 262);
    addDepthSprite(
      'village_hub_props',
      14,
      'village_torch_idle',
      690,
      215,
      228
    );

    // 4. Fogueira Central Grande Animada (640, 390)
    addDepthSprite(
      'village_hub_props_large',
      0,
      'village_campfire_large_idle',
      640,
      390,
      408
    );

    // 5. Forja e Bigorna à direita: Bigorna grande (885, 395) e Forja grande animada (985, 385)
    addDepthImage('village_hub_props_large', 8, 885, 395, 410, 0.88);
    addDepthSprite(
      'village_hub_props_large',
      4,
      'village_forge_large_idle',
      985,
      385,
      408,
      0.95
    );
    addDepthImage('village_hub_props', 25, 1028, 356, 370); // barrel
    addDepthImage('village_hub_props', 26, 1032, 418, 432); // cart_wheel

    // Tocha sul animada em primeiro plano (480, 540)
    addDepthSprite(
      'village_hub_props',
      14,
      'village_torch_idle',
      480,
      540,
      614,
      1.1
    );

    // 6. Iluminação 2.5D Quente da Vila Natal (halos na fogueira, forja, braseiro, tochas e portão)
    this.lightingGraphics.clear();
    const warmSources: Array<{
      x: number;
      y: number;
      outerR: number;
      innerR: number;
      alpha: number;
    }> = [
      { x: 640, y: 390, outerR: 115, innerR: 42, alpha: 0.24 }, // Campfire
      { x: 985, y: 382, outerR: 96, innerR: 36, alpha: 0.22 }, // Forge
      { x: 418, y: 282, outerR: 68, innerR: 24, alpha: 0.18 }, // Brazier
      { x: 690, y: 208, outerR: 64, innerR: 22, alpha: 0.17 }, // North Torch
      { x: 480, y: 532, outerR: 72, innerR: 24, alpha: 0.19 }, // South Torch
      { x: 860, y: 185, outerR: 84, innerR: 30, alpha: 0.14 }, // Exit Gate
    ];

    for (const light of warmSources) {
      this.lightingGraphics.fillStyle(0xf59e0b, light.alpha * 0.65);
      this.lightingGraphics.fillCircle(light.x, light.y, light.outerR);
      this.lightingGraphics.fillStyle(0xfbbf24, light.alpha);
      this.lightingGraphics.fillCircle(light.x, light.y, light.innerR);
      this.lightingGraphics.fillStyle(0xfef3c7, light.alpha * 1.4);
      this.lightingGraphics.fillCircle(light.x, light.y, 7);
    }
  }

  private moveHeroInVillageWithCollision(
    moveDir: Vector2D,
    deltaMs: number
  ): void {
    const bounds = this.getMovementBounds(this.viewport);
    const startX = this.hero.position.x;
    const startY = this.hero.position.y;

    moveHero(this.hero, moveDir, deltaMs, {
      width: VILLAGE_WORLD_WIDTH,
      height: VILLAGE_WORLD_HEIGHT,
      padding: 0,
    });

    const targetX = Math.max(
      bounds.minX,
      Math.min(bounds.maxX, this.hero.position.x)
    );
    const targetY = Math.max(
      bounds.minY,
      Math.min(bounds.maxY, this.hero.position.y)
    );

    // Axis-separated collision resolution (test X first; if colliding, revert X; then test Y; if colliding, revert Y)
    let resolvedX = targetX;
    if (this.isCollidingWithVillageObstacles(resolvedX, startY)) {
      resolvedX = startX;
    }

    let resolvedY = targetY;
    if (this.isCollidingWithVillageObstacles(resolvedX, resolvedY)) {
      resolvedY = startY;
    }

    this.hero.position.x = resolvedX;
    this.hero.position.y = resolvedY;
  }

  private isCollidingWithVillageObstacles(x: number, y: number): boolean {
    for (const obs of this.villageObstacles) {
      if (
        x >= obs.minX &&
        x <= obs.maxX &&
        y >= obs.minY &&
        y <= obs.maxY
      ) {
        return true;
      }
    }
    return false;
  }

  private getStationPositions(
    viewport: ViewportConfig
  ): Record<HubStationId, Vector2D> {
    if (this.getCampaignPhase() === 'prologue') {
      return {
        emissary: { x: 310, y: 410 }, // Mestre de Armas
        soul_altar: { x: 372, y: 296 }, // Lyra diante da porta da Casa de Palha
        blacksmith: { x: 922, y: 392 }, // Gorran à direita da bigorna (885, 395)
        rift_portal: { x: 860, y: 235 }, // Portão de Saída
      };
    }

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
    if (this.getCampaignPhase() === 'prologue') {
      const state = resolveVillageHubState(this.profile, {
        returnedFromDungeon: this.returnedFromDungeon,
      });
      if (state.spawnPoint === 'gate' || this.returnedFromDungeon) {
        return { x: 860, y: 255 };
      }
      return { x: 505, y: 425 };
    }

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
    if (this.getCampaignPhase() === 'prologue') {
      return {
        minX: 160,
        maxX: 1120,
        minY: 190,
        maxY: 575,
      };
    }

    return {
      minX: ARENA_PADDING_X,
      maxX: Math.max(ARENA_PADDING_X, viewport.width - ARENA_PADDING_X),
      minY: 102,
      maxY: Math.max(140, viewport.height - 108),
    };
  }

  private getWorldWidth(): number {
    return this.getCampaignPhase() === 'prologue'
      ? VILLAGE_WORLD_WIDTH
      : this.viewport.width || DEFAULT_HUB_WIDTH;
  }

  private getWorldHeight(): number {
    return this.getCampaignPhase() === 'prologue'
      ? VILLAGE_WORLD_HEIGHT
      : this.viewport.height || DEFAULT_HUB_HEIGHT;
  }

  private getWorldZoom(): number {
    return HUB_WORLD_ZOOM;
  }

  private handleViewportResize(width: number, height: number): void {
    if (!this.hero || !this.hud) {
      return;
    }

    this.viewport = resolveViewportConfig(width, height);
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
      this.getWorldWidth(),
      this.getWorldHeight()
    );

    this.hud.resize(this.viewport);
    this.altarModal?.resize(this.viewport);
    this.blacksmithModal?.resize(this.viewport);
    this.inventoryModal?.resize(this.viewport);
    this.gateModal?.resize(this.viewport);
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

  private registerVillageAnimations(): void {
    const specs: Array<{
      key: string;
      texture: string;
      frames: number[];
      frameRate: number;
    }> = [
      {
        key: 'village_campfire_large_idle',
        texture: 'village_hub_props_large',
        frames: [0, 1, 2, 3],
        frameRate: 8,
      },
      {
        key: 'village_forge_large_idle',
        texture: 'village_hub_props_large',
        frames: [4, 5, 6, 7],
        frameRate: 7,
      },
      {
        key: 'village_brazier_idle',
        texture: 'village_hub_props',
        frames: [10, 11, 12, 13],
        frameRate: 8,
      },
      {
        key: 'village_torch_idle',
        texture: 'village_hub_props',
        frames: [14, 15, 16, 17],
        frameRate: 8,
      },
      {
        key: 'npc_weapon_master_idle',
        texture: 'npc_weapon_master',
        frames: [0, 1, 2, 3],
        frameRate: 5,
      },
      {
        key: 'npc_lyra_idle',
        texture: 'npc_lyra',
        frames: [0, 1, 2, 3],
        frameRate: 5,
      },
      {
        key: 'npc_gorran_idle',
        texture: 'npc_gorran',
        frames: [0, 1, 2, 3],
        frameRate: 5,
      },
      {
        key: 'npc_gorran_hammer',
        texture: 'npc_gorran',
        frames: [4, 5, 6, 7],
        frameRate: 7,
      },
    ];

    for (const spec of specs) {
      if (this.anims.exists(spec.key) || !this.textures.exists(spec.texture)) {
        continue;
      }
      const tex = this.textures.get(spec.texture);
      const maxFrame = Math.max(...spec.frames);
      const hasFrames = tex.frameTotal > maxFrame + 1;
      const animFrames = hasFrames
        ? this.anims.generateFrameNumbers(spec.texture, { frames: spec.frames })
        : [{ key: spec.texture }];
      if (animFrames.length > 0) {
        this.anims.create({
          key: spec.key,
          frames: animFrames,
          frameRate: spec.frameRate,
          repeat: -1,
        });
      }
    }
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

    for (const spec of VILLAGE_TEXTURE_SPECS) {
      if (!this.textures.exists(spec.key)) {
        const gfx = this.make.graphics({ x: 0, y: 0 });
        gfx.fillStyle(spec.fallbackColor, 1);
        gfx.fillRect(0, 0, spec.frameWidth, spec.frameHeight);
        gfx.lineStyle(2, 0x09090b, 1);
        gfx.strokeRect(0, 0, spec.frameWidth, spec.frameHeight);
        gfx.generateTexture(spec.key, spec.frameWidth, spec.frameHeight);
        gfx.destroy();
      } else {
        this.textures
          .get(spec.key)
          .setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
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
    this.destroyVillageDepthProps();
    this.arenaLayer?.destroy();
    this.lightingGraphics?.destroy();
    this.heroAura?.destroy();
    this.weaponRig?.destroy();
    this.weaponRig = undefined;
    this.heroSprite?.destroy();

    this.dialogueBox?.destroy();
    this.gateModal?.destroy();
    this.altarModal?.destroy();
    this.blacksmithModal?.destroy();
    this.inventoryModal?.destroy();
    this.hud?.destroy();

    if (
      typeof window !== 'undefined' &&
      window.__SUBMUNDO_HUB_DEBUG__?.scene === this
    ) {
      window.__SUBMUNDO_HUB_DEBUG__ = undefined;
    }
  }
}
