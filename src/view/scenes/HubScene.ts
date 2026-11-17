import Phaser from 'phaser';
import { distanceBetween } from '../../core/combat/CombatEngine';
import { moveHero, type HeroState } from '../../core/entities/Hero';
import {
  resolveViewportConfig,
  type EquipSlot,
  type HubTransitionData,
  type RunEndReport,
  type SaveProfile,
  type Vector2D,
  type ViewportConfig,
} from '../../core/index';
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
import dialoguesData from '../../data/dialogues.json';
import { registerGameAnimations } from '../sprites/CombatVfx';
import { AltarModal, type AltarModalSnapshot } from '../ui/AltarModal';
import {
  BlacksmithModal,
  type BlacksmithModalSnapshot,
} from '../ui/BlacksmithModal';
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
  enterDungeon: () => void;
  grantTestResources: (souls: number, essences?: number) => void;
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

interface EmissaryDialogueModalView {
  root: Phaser.GameObjects.Container;
  backdropGraphic: Phaser.GameObjects.Graphics;
  backdropZone: Phaser.GameObjects.Zone;
  panelGraphic: Phaser.GameObjects.Graphics;
  speakerText: Phaser.GameObjects.Text;
  titleText: Phaser.GameObjects.Text;
  bodyText: Phaser.GameObjects.Text;
  hintText: Phaser.GameObjects.Text;
  closeBg: Phaser.GameObjects.Graphics;
  closeText: Phaser.GameObjects.Text;
  closeZone: Phaser.GameObjects.Zone;
  closeBtnContainer: Phaser.GameObjects.Container;
  isOpen: boolean;
}

const TILE_DISPLAY_SIZE = 32;
const ARENA_PADDING_X = 36;
const STATION_INTERACT_RADIUS = 58;
const BANNER_DEFAULT_DURATION_MS = 6500;

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

export class HubScene extends Phaser.Scene {
  private profile!: SaveProfile;
  private hero!: HeroState;
  private viewport!: ViewportConfig;

  private hud!: HubHud;
  private altarModal!: AltarModal;
  private blacksmithModal!: BlacksmithModal;
  private inventoryModal!: InventoryModal;
  private dialogueView!: EmissaryDialogueModalView;

  private arenaLayer!: Phaser.GameObjects.Container;
  private lightingGraphics!: Phaser.GameObjects.Graphics;
  private heroAura!: Phaser.GameObjects.Graphics;
  private heroSprite!: Phaser.GameObjects.Sprite;

  private stations: HubStationView[] = [];
  private nearbyStationId: HubStationId | null = null;
  private emissaryDialogueIndex = 0;

  private elapsedTimeMs = 0;
  private bannerText?: string;
  private bannerExpiresAtMs = 0;
  private enteringDungeon = false;

  private keydownHandler?: (event: KeyboardEvent) => void;
  private resizeHandler?: (gameSize: Phaser.Structs.Size) => void;

  constructor() {
    super({ key: 'HubScene' });
  }

  public create(data?: HubTransitionData): void {
    this.cameras.main.setBackgroundColor('#090b12');
    this.enteringDungeon = false;
    this.elapsedTimeMs = 0;
    this.nearbyStationId = null;
    this.emissaryDialogueIndex = 0;

    const width = this.scale.width || 800;
    const height = this.scale.height || 600;
    this.viewport = resolveViewportConfig(width, height);

    this.ensureRequiredFallbackTextures();
    registerGameAnimations(this);

    this.profile = loadOrCreateProfile();
    const transitionExt = data as
      | (HubTransitionData & { applyOutcome?: boolean })
      | undefined;

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
      this.showTimedBanner(
        dialoguesData.entries.hub_welcome.shortText,
        BANNER_DEFAULT_DURATION_MS
      );
    }

    const spawnPos = this.getInitialHeroSpawn(this.viewport);
    this.hero = buildHeroFromProfile(this.profile, spawnPos);

    this.arenaLayer = this.add.container(0, 0).setDepth(1);
    this.lightingGraphics = this.add.graphics().setDepth(5);
    this.heroAura = this.add.graphics().setDepth(19);

    this.buildArenaTilesAndLighting(this.viewport);
    this.createStations(this.viewport);

    this.heroSprite = this.add
      .sprite(this.hero.position.x, this.hero.position.y, 'wraith_warrior', 0)
      .setScale(1.5)
      .setDepth(20);
    if (this.anims.exists('wraith_idle')) {
      this.heroSprite.play('wraith_idle', true);
    }

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
    });

    this.altarModal = new AltarModal(this, {
      onPurchaseUpgrade: (upgradeId) => {
        const result = purchaseAltarUpgrade(this.profile, upgradeId);
        if (result.ok) {
          persistProfile(this.profile);
          this.refreshHeroFromProfile();
          this.altarModal.update(this.buildAltarSnapshot());
          this.showTimedBanner(
            `Altar fortalecido! Nível ${result.newLevel} (-${result.cost} Almas).`,
            3200
          );
        } else if (result.reason) {
          this.showTimedBanner(result.reason, 2600);
        }
        this.updateHud();
      },
      onClose: () => {
        this.updateHud();
      },
    });

    this.blacksmithModal = new BlacksmithModal(this, {
      onUpgradeItem: (instanceId) => {
        const result = upgradeItemWithBlacksmith(this.profile, instanceId);
        if (result.ok) {
          persistProfile(this.profile);
          this.refreshHeroFromProfile();
          this.blacksmithModal.update(this.buildBlacksmithSnapshot());
          this.showTimedBanner(
            `${result.item?.name ?? 'Item'} temperado (-${result.cost} Almas).`,
            3200
          );
        } else if (result.reason) {
          this.showTimedBanner(result.reason, 2600);
        }
        this.updateHud();
      },
      onForgeRecipe: (recipeId) => {
        const result = forgeItemWithBlacksmith(this.profile, recipeId);
        if (result.ok) {
          persistProfile(this.profile);
          this.refreshHeroFromProfile();
          this.blacksmithModal.update(this.buildBlacksmithSnapshot());
          this.showTimedBanner(
            `Relíquia forjada: ${result.item?.name ?? 'Equipamento'} (no Baú).`,
            3800
          );
        } else if (result.reason) {
          this.showTimedBanner(result.reason, 2800);
        }
        this.updateHud();
      },
      onClose: () => {
        this.updateHud();
      },
    });

    this.inventoryModal = new InventoryModal(this, {
      onEquipItem: (instanceId) => {
        if (equipStashItem(this.profile, instanceId)) {
          persistProfile(this.profile);
          this.refreshHeroFromProfile();
          this.inventoryModal.update(this.buildInventorySnapshot());
          this.updateHud();
        }
      },
      onUnequipSlot: (slot: EquipSlot) => {
        if (!unequipProfileSlot(this.profile, slot)) {
          this.showTimedBanner('Baú cheio para desequipar este item.', 2600);
          this.updateHud();
          return;
        }
        persistProfile(this.profile);
        this.refreshHeroFromProfile();
        this.inventoryModal.update(this.buildInventorySnapshot());
        this.updateHud();
      },
      onClose: () => {
        this.updateHud();
      },
    });

    this.dialogueView = this.createEmissaryDialogueModal(this.viewport);

    this.keydownHandler = (event: KeyboardEvent) => {
      if (this.dialogueView.isOpen) {
        if (event.code === 'Escape' || event.code === 'Space' || event.code === 'Enter') {
          this.closeEmissaryDialogue();
        }
        return;
      }

      if (this.isAnyModalOpen()) {
        return;
      }

      if (event.code === 'Space' && this.nearbyStationId) {
        event.preventDefault();
        this.interactWithNearbyStation();
      }
    };
    this.input.keyboard?.on('keydown', this.keydownHandler);

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
        enterDungeon: () => this.enterDungeon(),
        grantTestResources: (souls: number, essences = 0) => {
          this.grantTestResources(souls, essences);
        },
      };
    }

    this.updateProximityState();
    this.syncVisuals();
    this.updateHud();
  }

  public update(_time: number, delta: number): void {
    if (!this.hero || !this.hud || this.enteringDungeon) {
      return;
    }

    const clampedDelta = Math.min(Math.max(0, delta), 100);
    this.elapsedTimeMs += clampedDelta;

    if (this.bannerText && this.elapsedTimeMs >= this.bannerExpiresAtMs) {
      this.bannerText = undefined;
    }

    if (!this.isAnyModalOpen()) {
      const moveDir = this.hud.getMoveVector();
      const bounds = this.getMovementBounds(this.viewport);
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
      this.updateProximityState();
    }

    this.syncVisuals();
    this.updateHud();
  }

  public openAltar(): void {
    if (this.enteringDungeon) {
      return;
    }
    this.closeAllModalsExcept('altar');
    this.altarModal.open(this.buildAltarSnapshot());
    this.updateHud();
  }

  public openBlacksmith(): void {
    if (this.enteringDungeon) {
      return;
    }
    this.closeAllModalsExcept('blacksmith');
    this.blacksmithModal.open(this.buildBlacksmithSnapshot());
    this.updateHud();
  }

  public openStash(): void {
    if (this.enteringDungeon) {
      return;
    }
    this.closeAllModalsExcept('stash');
    this.inventoryModal.open(this.buildInventorySnapshot());
    this.updateHud();
  }

  public openEmissaryDialogue(): void {
    if (this.enteringDungeon) {
      return;
    }
    this.closeAllModalsExcept('dialogue');

    const key =
      EMISSARY_DIALOGUE_KEYS[
        this.emissaryDialogueIndex % EMISSARY_DIALOGUE_KEYS.length
      ];
    this.emissaryDialogueIndex += 1;

    const entry = dialoguesData.entries[key];
    this.dialogueView.speakerText.setText(entry.speaker.toUpperCase());
    this.dialogueView.titleText.setText(entry.title);
    this.dialogueView.bodyText.setText(entry.text);
    this.dialogueView.isOpen = true;
    this.dialogueView.root.setVisible(true);
    this.updateHud();
  }

  public enterDungeon(): void {
    if (this.enteringDungeon) {
      return;
    }
    this.enteringDungeon = true;
    this.closeAllModalsExcept(null);
    persistProfile(this.profile);
    this.scene.start('DungeonScene', { profileSnapshot: this.profile });
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

  private closeEmissaryDialogue(): void {
    if (!this.dialogueView.isOpen) {
      return;
    }
    this.dialogueView.isOpen = false;
    this.dialogueView.root.setVisible(false);
    this.updateHud();
  }

  private closeAllModalsExcept(
    keep: 'altar' | 'blacksmith' | 'stash' | 'dialogue' | null
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
    if (keep !== 'dialogue' && this.dialogueView?.isOpen) {
      this.dialogueView.isOpen = false;
      this.dialogueView.root.setVisible(false);
    }
  }

  private isAnyModalOpen(): boolean {
    return (
      Boolean(this.altarModal?.isOpen()) ||
      Boolean(this.blacksmithModal?.isOpen()) ||
      Boolean(this.inventoryModal?.isOpen()) ||
      Boolean(this.dialogueView?.isOpen)
    );
  }

  private refreshHeroFromProfile(): void {
    const pos = this.hero ? { ...this.hero.position } : this.getInitialHeroSpawn(this.viewport);
    const facing = this.hero ? { ...this.hero.facing } : { x: 1, y: 0 };
    this.hero = buildHeroFromProfile(this.profile, pos);
    this.hero.facing = facing;
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
    const equippedItems = (
      ['weapon', 'armor', 'amulet', 'ring'] as const
    )
      .map((slot) => this.profile.equipped[slot])
      .filter((item): item is NonNullable<typeof item> => item !== null);

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
    const equippedCount = (
      ['weapon', 'armor', 'amulet', 'ring'] as const
    ).filter((slot) => this.profile.equipped[slot] !== null).length;

    const nearbyStation = this.stations.find(
      (station) => station.config.id === this.nearbyStationId
    );

    const snapshot: HubHudSnapshot = {
      souls: this.profile.souls,
      generalEssences: this.profile.generalEssences,
      equippedCount,
      stashCount: this.profile.stash.length,
      nearbyStationLabel: nearbyStation?.config.label,
      bannerText: this.bannerText,
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

  private syncVisuals(): void {
    if (!this.heroSprite || !this.hero) {
      return;
    }

    this.heroSprite.setPosition(this.hero.position.x, this.hero.position.y);
    this.heroSprite.setFlipX(this.hero.facing.x < 0);

    const pulse = 0.14 + Math.sin(this.elapsedTimeMs * 0.005) * 0.04;
    this.heroAura.clear();
    this.heroAura.fillStyle(0x38bdf8, pulse);
    this.heroAura.fillCircle(this.hero.position.x, this.hero.position.y + 4, 19);

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

    const positions = this.getStationPositions(viewport);
    const hasNpcFrames =
      this.textures.exists('hub_npcs') &&
      this.textures.get('hub_npcs').frameTotal > 4;

    for (const config of HUB_STATIONS) {
      const pos = positions[config.id];
      const aura = this.add.graphics();

      let visual: Phaser.GameObjects.GameObject;
      if (this.textures.exists('hub_npcs')) {
        visual = this.add
          .sprite(0, 0, 'hub_npcs', hasNpcFrames ? config.frameIndex : 0)
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
          fontFamily: 'monospace',
          fontSize: viewport.mode === 'mobile_portrait' ? '10px' : '11px',
          color: config.accentHex,
          fontStyle: 'bold',
          stroke: '#05070d',
          strokeThickness: 3,
          align: 'center',
        })
        .setOrigin(0.5);

      const promptLabel = this.add
        .text(0, 30, viewport.mode === 'mobile_portrait' ? '[Toque]' : '[E] Usar', {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#80ed99',
          fontStyle: 'bold',
          stroke: '#05070d',
          strokeThickness: 3,
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
    const isMobile = viewport.mode === 'mobile_portrait';

    for (const station of this.stations) {
      const pos = positions[station.config.id];
      station.position = { ...pos };
      station.container.setPosition(pos.x, pos.y);
      station.nameLabel.setFontSize(isMobile ? 10 : 11);
      station.promptLabel.setText(isMobile ? '[Toque]' : '[E] Usar');
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

    const width = viewport.width;
    const height = viewport.height;
    const cols = Math.ceil(width / TILE_DISPLAY_SIZE);
    const rows = Math.ceil(height / TILE_DISPLAY_SIZE);

    const hasHubTiles = this.textures.exists('hub_tiles');
    const hasTileFrames =
      hasHubTiles && this.textures.get('hub_tiles').frameTotal > 4;

    if (hasHubTiles) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const isWall =
            row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
          const isCenterRune =
            !isWall &&
            Math.abs(col - Math.floor(cols / 2)) <= 1 &&
            Math.abs(row - Math.floor(rows / 2)) <= 1;
          const hash = (col * 29 + row * 19) % 9;
          const frameIndex = isWall ? 2 : isCenterRune || hash === 0 ? 1 : 0;

          const tileX = col * TILE_DISPLAY_SIZE + TILE_DISPLAY_SIZE / 2;
          const tileY = row * TILE_DISPLAY_SIZE + TILE_DISPLAY_SIZE / 2;

          const tile = this.add.image(
            tileX,
            tileY,
            'hub_tiles',
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
          const isRune = !isWall && (col * 29 + row * 19) % 9 === 0;
          const color = isWall ? 0x090d16 : isRune ? 0x1a2336 : 0x111622;
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

    // Sanctuary Lighting & Corner Braziers
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

    const brazierTopY = viewport.mode === 'mobile_portrait' ? 124 : 96;
    const brazierBottomY =
      viewport.mode === 'mobile_portrait' ? height - 246 : height - 118;
    const braziers: Vector2D[] = [
      { x: TILE_DISPLAY_SIZE + 14, y: brazierTopY },
      { x: width - TILE_DISPLAY_SIZE - 14, y: brazierTopY },
      { x: TILE_DISPLAY_SIZE + 14, y: brazierBottomY },
      { x: width - TILE_DISPLAY_SIZE - 14, y: brazierBottomY },
    ];

    for (const brazier of braziers) {
      if (hasHubTiles && hasTileFrames) {
        const img = this.add
          .image(brazier.x, brazier.y, 'hub_tiles', 3)
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

  private createEmissaryDialogueModal(
    viewport: ViewportConfig
  ): EmissaryDialogueModalView {
    const backdropGraphic = this.add.graphics();
    const backdropZone = this.add
      .zone(0, 0, viewport.width, viewport.height)
      .setOrigin(0.5)
      .setInteractive();
    backdropZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation?.();
      }
    );

    const panelGraphic = this.add.graphics();
    const speakerText = this.add.text(0, 0, 'EMISSÁRIO CELESTIAL', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#90e0ef',
      fontStyle: 'bold',
    });
    const titleText = this.add.text(0, 0, 'O Refúgio do Submundo', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#ffd166',
      fontStyle: 'bold',
    });
    const bodyText = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#e2e8f0',
      lineSpacing: 5,
    });
    const hintText = this.add.text(
      0,
      0,
      'Dica: Interaja novamente com o Emissário para ouvir mais orientações.',
      {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#94a3b8',
      }
    );

    const closeBg = this.add.graphics();
    const closeText = this.add
      .text(0, 0, 'Continuar', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const closeZone = this.add
      .zone(0, 0, 110, 32)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation?.();
        this.closeEmissaryDialogue();
      }
    );
    const closeBtnContainer = this.add.container(0, 0, [
      closeBg,
      closeText,
      closeZone,
    ]);

    const root = this.add
      .container(viewport.width / 2, viewport.height / 2, [
        backdropGraphic,
        backdropZone,
        panelGraphic,
        speakerText,
        titleText,
        bodyText,
        hintText,
        closeBtnContainer,
      ])
      .setScrollFactor(0)
      .setDepth(1085)
      .setVisible(false);

    const view: EmissaryDialogueModalView = {
      root,
      backdropGraphic,
      backdropZone,
      panelGraphic,
      speakerText,
      titleText,
      bodyText,
      hintText,
      closeBg,
      closeText,
      closeZone,
      closeBtnContainer,
      isOpen: false,
    };

    this.layoutEmissaryDialogueModal(view, viewport);
    return view;
  }

  private layoutEmissaryDialogueModal(
    view: EmissaryDialogueModalView,
    viewport: ViewportConfig
  ): void {
    const w = viewport.width;
    const h = viewport.height;
    const isMobile = viewport.mode === 'mobile_portrait';

    view.root.setPosition(w / 2, h / 2);

    view.backdropGraphic.clear();
    view.backdropGraphic.fillStyle(0x04060a, 0.78);
    view.backdropGraphic.fillRect(-w / 2, -h / 2, w, h);
    view.backdropZone.setSize(w, h);

    const boxW = isMobile ? w - 24 : 580;
    const boxH = isMobile ? 250 : 210;

    view.panelGraphic.clear();
    view.panelGraphic.fillStyle(0x0f172a, 0.97);
    view.panelGraphic.fillRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 8);
    view.panelGraphic.lineStyle(2, 0x38bdf8, 0.9);
    view.panelGraphic.strokeRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 8);

    const left = -boxW / 2 + 18;
    const right = boxW / 2 - 18;
    const top = -boxH / 2 + 16;
    const innerW = boxW - 36;

    view.speakerText.setPosition(left, top);
    view.titleText.setFontSize(isMobile ? 13 : 15).setPosition(left, top + 18);
    view.bodyText
      .setFontSize(isMobile ? 11 : 12)
      .setWordWrapWidth(innerW)
      .setPosition(left, top + 46);
    view.hintText
      .setFontSize(isMobile ? 9 : 10)
      .setWordWrapWidth(innerW - (isMobile ? 0 : 120))
      .setPosition(left, boxH / 2 - (isMobile ? 64 : 34));

    const btnW = isMobile ? 116 : 112;
    const btnH = 32;
    view.closeBtnContainer.setPosition(right - btnW / 2, boxH / 2 - 26);
    view.closeZone.setSize(btnW, btnH);
    view.closeBg.clear();
    view.closeBg.fillStyle(0x155e75, 0.96);
    view.closeBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 6);
    view.closeBg.lineStyle(1.5, 0x48cae4, 1);
    view.closeBg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 6);
  }

  private getStationPositions(
    viewport: ViewportConfig
  ): Record<HubStationId, Vector2D> {
    if (viewport.mode === 'mobile_portrait') {
      return {
        rift_portal: { x: 180, y: 152 },
        soul_altar: { x: 76, y: 256 },
        blacksmith: { x: 284, y: 256 },
        emissary: { x: 180, y: 354 },
      };
    }

    return {
      rift_portal: { x: 400, y: 158 },
      soul_altar: { x: 165, y: 274 },
      blacksmith: { x: 635, y: 274 },
      emissary: { x: 260, y: 392 },
    };
  }

  private getInitialHeroSpawn(viewport: ViewportConfig): Vector2D {
    if (viewport.mode === 'mobile_portrait') {
      return { x: 180, y: 256 };
    }
    return { x: 400, y: 294 };
  }

  private getMovementBounds(viewport: ViewportConfig): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    if (viewport.mode === 'mobile_portrait') {
      return {
        minX: ARENA_PADDING_X,
        maxX: Math.max(ARENA_PADDING_X, viewport.width - ARENA_PADDING_X),
        minY: 118,
        maxY: Math.max(140, viewport.height - 246),
      };
    }
    return {
      minX: ARENA_PADDING_X,
      maxX: Math.max(ARENA_PADDING_X, viewport.width - ARENA_PADDING_X),
      minY: 108,
      maxY: Math.max(140, viewport.height - 120),
    };
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

    this.hud.resize(this.viewport);
    this.altarModal?.resize(this.viewport);
    this.blacksmithModal?.resize(this.viewport);
    this.inventoryModal?.resize(this.viewport);
    if (this.dialogueView) {
      this.layoutEmissaryDialogueModal(this.dialogueView, this.viewport);
    }

    this.updateProximityState();
    this.syncVisuals();
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
    if (!this.textures.exists('wraith_warrior')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x38bdf8, 1);
      gfx.fillRect(0, 0, 32, 32);
      gfx.lineStyle(2, 0x09090b, 1);
      gfx.strokeRect(0, 0, 32, 32);
      gfx.generateTexture('wraith_warrior', 32, 32);
      gfx.destroy();
    }
  }

  private cleanupScene(): void {
    if (this.resizeHandler) {
      this.scale.off('resize', this.resizeHandler);
      this.resizeHandler = undefined;
    }
    if (this.keydownHandler) {
      this.input.keyboard?.off('keydown', this.keydownHandler);
      this.keydownHandler = undefined;
    }

    this.destroyStations();
    this.arenaLayer?.destroy();
    this.lightingGraphics?.destroy();
    this.heroAura?.destroy();
    this.heroSprite?.destroy();

    this.dialogueView?.root.destroy();
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
