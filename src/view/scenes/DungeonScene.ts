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
import { HeroWeaponRig } from '../sprites/HeroWeaponRig';
import { SceneCameraRig } from '../ui/CameraRig';
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

const ANIMATED_80X80_MONSTERS = new Set<string>([
  'slime',
  'cave_bat',
  'wolf',
  'skeleton',
  'skeleton_archer',
]);

const TEST_ARENA_SPAWNS: ReadonlyArray<{ id: string; dx: number; dy: number }> = [
  { id: 'slime', dx: -135, dy: -95 },
  { id: 'cave_bat', dx: 135, dy: -95 },
  { id: 'wolf', dx: -150, dy: 55 },
  { id: 'skeleton', dx: 150, dy: 55 },
  { id: 'skeleton_archer', dx: 0, dy: 135 },
];

interface GroundDrop {
  item: ItemInstance;
  position: Vector2D;
  sprite: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Graphics;
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
}

declare global {
  interface Window {
    __SUBMUNDO_DEBUG__?: SubmundoDebugApi;
  }
}

const TILE_DISPLAY_SIZE = 32;
const ARENA_PADDING = 36;
const ROOM_CLEAR_AUTO_ADVANCE_MS = 1200;
const DROP_PICKUP_RADIUS = 34;
const HERO_ATTACK_CANCEL_FRAME = 12;
const HERO_HIT_CANCEL_FRAME = 21;
const EQUIP_SLOTS: readonly EquipSlot[] = ['weapon', 'armor', 'amulet', 'ring'];

const RARITY_DROP_FRAME: Record<Rarity, number> = {
  common: 0,
  magic: 1,
  rare: 2,
  legendary: 3,
};

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
  private viewport = resolveViewportConfig(800, 600);

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
  private readonly monsterVisuals = new Map<string, MonsterVisual>();
  private readonly minionVisuals = new Map<string, Phaser.GameObjects.Graphics>();
  private groundDrops: GroundDrop[] = [];

  private portalContainer?: Phaser.GameObjects.Container;
  private portalPosition?: Vector2D;

  private elapsedTimeMs = 0;
  private roomClearTimerMs = 0;
  private bannerText?: string;
  private bannerExpiresAtMs = 0;
  private isTestArena = false;
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
      this.scale.width || 800,
      this.scale.height || 600
    );
    this.cameraRig = new SceneCameraRig(this, {
      width: this.viewport.width,
      height: this.viewport.height,
      worldZoom: this.getWorldZoom(this.viewport.mode),
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

    const clampedDelta = Math.min(Math.max(0, delta), 100);
    this.elapsedTimeMs += clampedDelta;
    const nowMs = this.elapsedTimeMs;

    const bounds = {
      width: this.scale.width || 800,
      height: this.scale.height || 600,
      padding: ARENA_PADDING,
    };

    const moveDir = this.hud.getMoveVector();
    const canMove =
      this.hero.isAlive &&
      (this.runState.status === 'in_progress' ||
        this.runState.status === 'room_cleared');
    this.heroIsMoving = canMove && (moveDir.x !== 0 || moveDir.y !== 0);
    this.lastMoveDirX = canMove ? moveDir.x : 0;
    if (canMove && moveDir.x !== 0) {
      this.heroFlipX = moveDir.x < 0;
    }

    if (this.runState.status === 'in_progress' && this.hero.isAlive) {
      this.runState.elapsedMs += clampedDelta;

      moveHero(this.hero, moveDir, clampedDelta, bounds);
      if (!this.isTestArena) {
        this.collectNearbyDrops();
      }

      const events = tickCombat(
        this.hero,
        this.monsters,
        clampedDelta,
        nowMs
      );
      this.processCombatEvents(events);
      if (!this.isTestArena) {
        this.checkAndUpdateRoomState(nowMs);
      }
    } else if (
      !this.isTestArena &&
      this.runState.status === 'room_cleared' &&
      this.hero.isAlive
    ) {
      moveHero(this.hero, moveDir, clampedDelta, bounds);
      this.collectNearbyDrops();
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
      this.runState.status === 'victory' ||
      this.runState.status === 'defeat'
    ) {
      return [];
    }

    const nowMs = this.elapsedTimeMs;
    const bounds = {
      width: this.scale.width || 800,
      height: this.scale.height || 600,
      padding: ARENA_PADDING,
    };
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
      // Show dash trail from previous position if dash occurred
      if (events.some((e) => e.type === 'hero_dash')) {
        this.vfx.showDashTrail(prevHeroPos.x, prevHeroPos.y);
      }
      this.processCombatEvents(events);
      this.checkAndUpdateRoomState(nowMs);
      this.syncVisuals(nowMs);
      this.updateHud(nowMs);
    }

    return events;
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
    const width = this.scale.width || 800;
    const height = this.scale.height || 600;

    this.isTestArena = Boolean(data?.testArena);
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
    const width = this.scale.width || 800;
    const height = this.scale.height || 600;
    const currentRoom = getCurrentRoom(this.runState);

    this.destroyPortal();
    this.clearMonsterVisuals();
    this.clearGroundDrops();
    this.cancelHeroActionAnim();
    this.lastHeroFootstepFrame = -1;
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
      this.monsters = [];
      for (const spec of TEST_ARENA_SPAWNS) {
        const def = this.monsterDefMap.get(spec.id);
        if (!def) {
          continue;
        }
        const clampedX = Math.max(
          ARENA_PADDING,
          Math.min(width - ARENA_PADDING, this.hero.position.x + spec.dx)
        );
        const clampedY = Math.max(
          ARENA_PADDING + 24,
          Math.min(height - ARENA_PADDING - 24, this.hero.position.y + spec.dy)
        );
        const monster = spawnMonster(
          def,
          `test_${spec.id}`,
          { x: clampedX, y: clampedY }
        );
        this.monsters.push(monster);
        this.createMonsterVisual(monster);
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
    const isAnimated80 = ANIMATED_80X80_MONSTERS.has(monster.spriteKey);
    const scale = isAnimated80 ? 0.88 : isAbyssHerald ? 1.75 : 1.5;

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

    if (this.isTestArena) {
      this.lightingGraphics.clear();
      return;
    }

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
    for (const event of events) {
      switch (event.type) {
        case 'hero_basic_attack': {
          soundManager.play(event.isCrit ? 'crit' : 'attack');
          const dx = event.position.x - this.hero.position.x;
          if (
            Math.abs(dx) > 0.5 &&
            (!this.heroIsMoving || this.lastMoveDirX === 0)
          ) {
            this.heroFlipX = dx < 0;
            this.heroSprite?.setFlipX(this.heroFlipX);
          }
          const facingLeft = this.heroSprite?.flipX ?? this.heroFlipX;
          this.vfx.showSlashEffect(
            this.hero.position.x,
            this.hero.position.y,
            event.position.x,
            event.position.y,
            this.heroSpriteKey === 'hero_wraith'
          );
          if (!this.heroIsMoving) {
            this.playHeroActionAnim('attack');
          }
          this.weaponRig?.playAttackSwing(facingLeft, false);
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
            this.vfx.showSkillAreaEffect(
              event.position.x,
              event.position.y,
              skill.radius ?? 80,
              skill.force
            );
            if (this.currentHeroActionAnim !== 'dash') {
              this.playHeroActionAnim('attack');
            }
            this.weaponRig?.playAttackSwing(
              this.heroSprite?.flipX ?? this.heroFlipX,
              true
            );
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
          if (event.isCrit && event.skillId) {
            soundManager.play('crit');
          }
          this.vfx.showDamageNumber(
            event.position.x,
            event.position.y,
            event.value ?? 1,
            Boolean(event.isCrit),
            false
          );
          break;
        }

        case 'monster_killed': {
          const reward = event.value ?? 0;
          this.runState.soulsCollected += reward;
          this.runState.monstersKilled += 1;
          this.vfx.showSoulCollectEffect(
            event.position.x,
            event.position.y,
            reward
          );
          if (reward > 0) {
            soundManager.play('soul_pickup');
          }

          const killedMonster = this.monsters.find(
            (m) => m.instanceId === event.targetId
          );
          const isBoss =
            killedMonster?.type === 'boss' ||
            killedMonster?.defId === 'infernal_warden';
          if (isBoss) {
            this.handleBossDefeated(event.position, killedMonster);
          }
          if (shouldDropLoot(isBoss, Math.random, this.hero.luck)) {
            const item = generateItemDrop({
              luck: this.hero.luck,
              isBoss,
            });
            this.spawnGroundDrop(item, event.position);
          }
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
          soundManager.play('hit_player');
          this.vfx.showDamageNumber(
            event.position.x,
            event.position.y,
            event.value ?? 1,
            false,
            true
          );
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

  private checkAndUpdateRoomState(nowMs: number): void {
    if (this.isTestArena) {
      if (this.bannerText && nowMs >= this.bannerExpiresAtMs) {
        this.bannerText = undefined;
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

    const width = this.scale.width || 800;
    const height = this.scale.height || 600;
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
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#e0f2fe',
        stroke: '#09090b',
        strokeThickness: 3,
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
      const isAnimated80 = ANIMATED_80X80_MONSTERS.has(monster.spriteKey);
      const barWidth = isBoss ? 56 : 34;
      const barHeight = isBoss ? 6 : 4;
      const offsetY = isBoss ? 44 : isAnimated80 ? 34 : 26;
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
  }

  private updateHud(nowMs: number): void {
    const currentRoom = getCurrentRoom(this.runState);
    const bossMonster = currentRoom.isBossRoom
      ? (this.monsters.find((m) => m.type === 'boss') ??
        this.monsters.find((m) => m.defId === this.activeStage?.bossId))
      : undefined;

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
      ['weapon', 'armor', 'amulet', 'ring'] as const
    ).filter((slot) => this.inventory.equipped[slot] !== null).length;

    const snapshot: HudSnapshot = {
      hp: this.hero.stats.hp,
      maxHp: this.hero.stats.maxHp,
      souls: this.hero.souls,
      roomNumber: currentRoom.roomNumber,
      totalRooms: this.runState.totalRooms,
      isBossRoom: currentRoom.isBossRoom,
      roomTitle: currentRoom.title,
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

  private getWorldZoom(mode: 'desktop_landscape' | 'mobile_portrait'): number {
    return mode === 'mobile_portrait' ? 1.45 : 1.65;
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

    for (const drop of this.groundDrops) {
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
    }

    this.cameraRig?.resize(
      viewport.width,
      viewport.height,
      this.getWorldZoom(viewport.mode),
      viewport.width,
      viewport.height
    );
    this.hud.resize(viewport);
    this.inventoryModal?.resize(viewport);
    this.syncVisuals(this.elapsedTimeMs);
    this.updateHud(this.elapsedTimeMs);
    this.cameraRig?.syncLayers();
  }

  private toggleInventoryModal(): void {
    if (
      !this.inventoryModal ||
      !this.runState ||
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

  private spawnGroundDrop(item: ItemInstance, rawPosition: Vector2D): void {
    const width = this.scale.width || 800;
    const height = this.scale.height || 600;
    const x = Math.max(
      ARENA_PADDING,
      Math.min(width - ARENA_PADDING, rawPosition.x)
    );
    const y = Math.max(
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

    soundManager.play(
      item.rarity === 'legendary' ? 'loot_legendary' : 'loot_drop'
    );
    this.vfx.showLootDropBeam(x, y, item.rarity);
    this.groundDrops.push({
      item,
      position: { x, y },
      sprite,
      glow,
    });
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

  private collectNearbyDrops(): void {
    if (this.groundDrops.length === 0) {
      return;
    }

    const remaining: GroundDrop[] = [];
    for (const drop of this.groundDrops) {
      if (
        distanceBetween(this.hero.position, drop.position) <=
        DROP_PICKUP_RADIUS
      ) {
        const added = addItemToBag(this.inventory, drop.item);
        if (!added) {
          remaining.push(drop);
          continue;
        }
        drop.sprite.destroy();
        drop.glow.destroy();
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
      } else {
        remaining.push(drop);
      }
    }
    this.groundDrops = remaining;
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
      drop.sprite.destroy();
      drop.glow.destroy();
    }
    this.groundDrops = [];
  }

  private clearGroundDrops(): void {
    for (const drop of this.groundDrops) {
      drop.sprite.destroy();
      drop.glow.destroy();
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

  private clearMonsterVisuals(): void {
    for (const visual of this.monsterVisuals.values()) {
      visual.sprite.destroy();
      visual.hpBar.destroy();
    }
    this.monsterVisuals.clear();
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

    this.tweens.add({
      targets: arrow,
      x: to.x,
      y: to.y,
      duration: 160,
      ease: 'Linear',
      onComplete: () => {
        arrow.destroy();
      },
    });
  }

  private ensureCampaignFallbackTextures(): void {
    const fallbackColors: Record<string, number> = {
      slime: 0x22c55e,
      cave_bat: 0x7c3aed,
      wolf: 0x64748b,
      skeleton: 0xe2e8f0,
      skeleton_archer: 0xcbd5e1,
    };

    for (const [key, color] of Object.entries(fallbackColors)) {
      if (!this.textures.exists(key)) {
        const gfx = this.make.graphics({ x: 0, y: 0 });
        gfx.fillStyle(color, 1);
        gfx.fillCircle(40, 44, 18);
        gfx.fillStyle(0xfef08a, 1);
        gfx.fillRect(34, 38, 3, 3);
        gfx.fillRect(43, 38, 3, 3);
        gfx.generateTexture(key, 80, 80);
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
