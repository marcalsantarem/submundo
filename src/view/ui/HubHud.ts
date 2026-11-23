import Phaser from 'phaser';
import {
  type Vector2D,
  type ViewportConfig,
  resolveViewportConfig,
} from '../../core/index';
import {
  DF_FONTS,
  DF_PALETTE,
  DF_UI_ICONS_KEY,
  DF_UI_ICON_FRAMES,
  type OrnateButtonVariant,
  drawOrnateButton,
  drawOrnatePanel,
  getChamferPoints,
  hasUiTextureFrame,
} from './DarkFantasyUiBuilder';
import { VirtualJoystick } from './VirtualJoystick';

export interface HubHudSnapshot {
  souls: number;
  generalEssences: number;
  equippedCount: number;
  stashCount: number;
  nearbyStationLabel?: string;
  bannerText?: string;
  locationTitle?: string;
  stageLabel?: string;
  canCycleStage?: boolean;
  isPrologue?: boolean;
  isMuted?: boolean;
  heroHp?: number;
  heroMaxHp?: number;
  heroLevel?: number;
  heroName?: string;
  trackerTitle?: string;
  trackerText?: string;
  heroNormalizedPos?: Vector2D;
  masterExclamation?: boolean;
  gateUnlocked?: boolean;
}

interface MovementKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  w: Phaser.Input.Keyboard.Key;
  s: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
}

interface ActionButtonView {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image | null;
  iconFrame?: number;
  label: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  variant: OrnateButtonVariant;
  width: number;
  height: number;
  hovered: boolean;
  pressed: boolean;
  disabled: boolean;
}

interface VillageCircularBtnView {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image | null;
  fallbackGfx: Phaser.GameObjects.Graphics;
  badgeBg?: Phaser.GameObjects.Graphics;
  badgeText?: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  hovered: boolean;
  pressed: boolean;
}

export interface HubHudCallbacks {
  onOpenAltar: () => void;
  onOpenBlacksmith: () => void;
  onOpenStash: () => void;
  onEnterDungeon: () => void;
  onInteract?: () => void;
  onCycleStage?: () => void;
  onToggleMute?: () => void;
  onResetSave?: () => void;
}

const PORTRAITS_KEY = 'portraits';
const VILLAGE_PORTRAIT_CX = 46;
const VILLAGE_PORTRAIT_CY = 44;
const VILLAGE_PORTRAIT_R = 32;
const VILLAGE_MINIMAP_R = 46;
const VILLAGE_UTILITY_R = 18;
const VILLAGE_INTERACT_R = 42;

export class HubHud {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: HubHudCallbacks;

  private viewport: ViewportConfig;
  private readonly joystick: VirtualJoystick;
  private movementKeys?: MovementKeys;
  private readonly keydownHandler: (event: KeyboardEvent) => void;

  // ---------------------------------------------------------------------------
  // ACT 1 / REFÚGIO DO SUBMUNDO LEGACY HUD ELEMENTS
  // ---------------------------------------------------------------------------
  private readonly topPanelBg: Phaser.GameObjects.Graphics;
  private readonly locationText: Phaser.GameObjects.Text;
  private readonly soulsIcon: Phaser.GameObjects.Image | null;
  private readonly soulsFallbackGraphic: Phaser.GameObjects.Graphics;
  private readonly soulsText: Phaser.GameObjects.Text;
  private readonly essencesIcon: Phaser.GameObjects.Image | null;
  private readonly essencesFallbackGraphic: Phaser.GameObjects.Graphics;
  private readonly essencesText: Phaser.GameObjects.Text;
  private readonly gearText: Phaser.GameObjects.Text;

  private readonly bannerContainer: Phaser.GameObjects.Container;
  private readonly bannerBg: Phaser.GameObjects.Graphics;
  private readonly bannerLabel: Phaser.GameObjects.Text;

  private readonly altarBtn: ActionButtonView;
  private readonly blacksmithBtn: ActionButtonView;
  private readonly stashBtn: ActionButtonView;
  private readonly enterBtn: ActionButtonView;
  private readonly interactBtn: ActionButtonView;
  private readonly stageBtn: ActionButtonView;
  private readonly muteBtn: ActionButtonView;
  private readonly resetBtn: ActionButtonView;

  // ---------------------------------------------------------------------------
  // PROLOGUE / VILA NATAL HUD ELEMENTS (Decision #23 & mockup_m9_village_hub)
  // ---------------------------------------------------------------------------
  private readonly villageHeroContainer: Phaser.GameObjects.Container;
  private readonly villagePortraitBg: Phaser.GameObjects.Graphics;
  private readonly villagePortraitImg: Phaser.GameObjects.Image | null;
  private readonly villagePortraitMaskGfx: Phaser.GameObjects.Graphics | null;
  private readonly villagePortraitFallback: Phaser.GameObjects.Text;
  private readonly villagePortraitRing: Phaser.GameObjects.Graphics;
  private readonly villageLevelBadgeBg: Phaser.GameObjects.Graphics;
  private readonly villageLevelBadgeText: Phaser.GameObjects.Text;
  private readonly villageHeroNameText: Phaser.GameObjects.Text;
  private readonly villageHpBarGfx: Phaser.GameObjects.Graphics;
  private readonly villageHpText: Phaser.GameObjects.Text;
  private readonly villageSecBarGfx: Phaser.GameObjects.Graphics;

  private readonly villageTrackerContainer: Phaser.GameObjects.Container;
  private readonly villageTrackerGfx: Phaser.GameObjects.Graphics;
  private readonly villageTrackerTitle: Phaser.GameObjects.Text;
  private readonly villageTrackerText: Phaser.GameObjects.Text;

  private readonly villageMinimapContainer: Phaser.GameObjects.Container;
  private readonly villageMinimapBg: Phaser.GameObjects.Graphics;
  private readonly villageMinimapDynamic: Phaser.GameObjects.Graphics;
  private readonly villageMinimapFrame: Phaser.GameObjects.Graphics;
  private readonly villageMinimapNorthText: Phaser.GameObjects.Text;

  private readonly villageBagBtn: VillageCircularBtnView;
  private readonly villageAudioBtn: VillageCircularBtnView;
  private readonly villageConfigBtn: VillageCircularBtnView;

  private readonly villageInteractContainer: Phaser.GameObjects.Container;
  private readonly villageInteractGlow: Phaser.GameObjects.Graphics;
  private readonly villageInteractBg: Phaser.GameObjects.Graphics;
  private readonly villageInteractEmblem: Phaser.GameObjects.Graphics;
  private readonly villageInteractLabel: Phaser.GameObjects.Text;
  private readonly villageInteractTargetBg: Phaser.GameObjects.Graphics;
  private readonly villageInteractTargetText: Phaser.GameObjects.Text;
  private readonly villageInteractZone: Phaser.GameObjects.Zone;
  private villageInteractHovered = false;
  private villageInteractPressed = false;

  private resetArmed = false;
  private resetArmTimer?: ReturnType<typeof setTimeout>;

  private lastSnapshot: HubHudSnapshot = {
    souls: 0,
    generalEssences: 0,
    equippedCount: 0,
    stashCount: 0,
  };

  constructor(scene: Phaser.Scene, callbacks: HubHudCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.viewport = resolveViewportConfig(
      scene.scale.width || 960,
      scene.scale.height || 540
    );

    const totalPointers = scene.input.manager?.pointersTotal ?? 2;
    if (totalPointers < 4) {
      scene.input.addPointer?.(4 - totalPointers);
    }

    this.joystick = new VirtualJoystick(scene);

    // -------------------------------------------------------------------------
    // ACT 1 TOP BAR (960x540 Landscape)
    // -------------------------------------------------------------------------
    this.topPanelBg = scene.add.graphics().setScrollFactor(0).setDepth(1010);

    this.locationText = scene.add
      .text(0, 0, 'Refúgio do Submundo', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '14px',
        color: DF_PALETTE.textGold,
        fontStyle: 'bold',
        stroke: '#07090e',
        strokeThickness: 2,
        resolution: 2,
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(1012);

    this.soulsIcon = hasUiTextureFrame(
      scene,
      DF_UI_ICONS_KEY,
      DF_UI_ICON_FRAMES.souls
    )
      ? scene.add
          .image(0, 0, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.souls)
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(1012)
      : null;

    this.soulsFallbackGraphic = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(1012);
    this.drawResourceFallbackDiamond(this.soulsFallbackGraphic, 0x90e0ef);

    this.soulsText = scene.add
      .text(0, 0, 'Almas: 0', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '12px',
        color: '#a5f3fc',
        fontStyle: 'bold',
        stroke: '#07090e',
        strokeThickness: 2,
        resolution: 2,
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(1012);

    this.essencesIcon = hasUiTextureFrame(
      scene,
      DF_UI_ICONS_KEY,
      DF_UI_ICON_FRAMES.essence
    )
      ? scene.add
          .image(0, 0, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.essence)
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(1012)
      : null;

    this.essencesFallbackGraphic = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(1012);
    this.drawResourceFallbackDiamond(
      this.essencesFallbackGraphic,
      DF_PALETTE.agedGold
    );

    this.essencesText = scene.add
      .text(0, 0, 'Essências: 0', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '12px',
        color: DF_PALETTE.textGold,
        fontStyle: 'bold',
        stroke: '#07090e',
        strokeThickness: 2,
        resolution: 2,
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(1012);

    this.gearText = scene.add
      .text(0, 0, 'Equip: 0/6 | Baú: 0', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '11px',
        color: DF_PALETTE.textLight,
        stroke: '#07090e',
        strokeThickness: 2,
        resolution: 2,
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(1012);

    // -------------------------------------------------------------------------
    // STATUS / NARRATIVE BANNER
    // -------------------------------------------------------------------------
    this.bannerBg = scene.add.graphics();
    this.bannerLabel = scene.add
      .text(0, 0, '', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '11px',
        color: DF_PALETTE.textParchment,
        align: 'center',
        wordWrap: { width: 472 },
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);
    this.bannerContainer = scene.add
      .container(0, 0, [this.bannerBg, this.bannerLabel])
      .setScrollFactor(0)
      .setDepth(1014)
      .setVisible(false);

    // -------------------------------------------------------------------------
    // ACT 1 ORNATE 2D CHAMFERED ACTION BUTTONS
    // -------------------------------------------------------------------------
    this.altarBtn = this.createActionButton(
      'Altar',
      'iron',
      DF_PALETTE.textLight,
      () => this.callbacks.onOpenAltar()
    );
    this.blacksmithBtn = this.createActionButton(
      'Ferreiro',
      'gold',
      DF_PALETTE.textParchment,
      () => this.callbacks.onOpenBlacksmith()
    );
    this.stashBtn = this.createActionButton(
      'Inventário',
      'iron',
      DF_PALETTE.textLight,
      () => this.callbacks.onOpenStash(),
      DF_UI_ICON_FRAMES.bag
    );
    this.enterBtn = this.createActionButton(
      'Entrar na Fenda',
      'crimson',
      DF_PALETTE.textParchment,
      () => this.callbacks.onEnterDungeon(),
      DF_UI_ICON_FRAMES.attack,
      true
    );
    this.interactBtn = this.createActionButton(
      'Interagir [E]',
      'emerald',
      '#ecfdf5',
      () => this.callbacks.onInteract?.()
    );
    this.interactBtn.container.setVisible(false);

    this.stageBtn = this.createActionButton(
      'A Gruta da Cachoeira',
      'iron',
      DF_PALETTE.textLight,
      () => {
        if (this.lastSnapshot.canCycleStage) {
          this.callbacks.onCycleStage?.();
        }
      }
    );
    this.stageBtn.container.setVisible(false);

    this.muteBtn = this.createActionButton(
      'Áudio',
      'iron',
      DF_PALETTE.textLight,
      () => this.callbacks.onToggleMute?.(),
      DF_UI_ICON_FRAMES.audioOn
    );

    this.resetBtn = this.createActionButton(
      'Resetar',
      'crimson',
      DF_PALETTE.textDanger,
      () => this.handleResetClick()
    );

    // -------------------------------------------------------------------------
    // PROLOGUE / VILA NATAL HUD: 1. TOP-LEFT HERO FRAME & TRACKER
    // -------------------------------------------------------------------------
    this.villagePortraitBg = scene.add.graphics();
    this.villagePortraitImg = hasUiTextureFrame(scene, PORTRAITS_KEY, 0)
      ? scene.add
          .image(VILLAGE_PORTRAIT_CX, VILLAGE_PORTRAIT_CY + 1, PORTRAITS_KEY, 0)
          .setOrigin(0.5)
      : null;

    this.villagePortraitMaskGfx =
      this.villagePortraitImg && typeof scene.make?.graphics === 'function'
        ? scene.make.graphics({}, false)
        : null;
    if (
      this.villagePortraitImg &&
      this.villagePortraitMaskGfx &&
      typeof this.villagePortraitMaskGfx.createGeometryMask === 'function'
    ) {
      this.villagePortraitMaskGfx.fillStyle(0xffffff, 1);
      this.villagePortraitMaskGfx.fillCircle(
        VILLAGE_PORTRAIT_CX,
        VILLAGE_PORTRAIT_CY,
        VILLAGE_PORTRAIT_R - 2
      );
      this.villagePortraitImg.setMask(
        this.villagePortraitMaskGfx.createGeometryMask()
      );
    }

    this.villagePortraitFallback = scene.add
      .text(VILLAGE_PORTRAIT_CX, VILLAGE_PORTRAIT_CY, 'JG', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '15px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5);

    this.villagePortraitRing = scene.add.graphics();
    this.villageLevelBadgeBg = scene.add.graphics();
    this.villageLevelBadgeText = scene.add
      .text(
        VILLAGE_PORTRAIT_CX,
        VILLAGE_PORTRAIT_CY + VILLAGE_PORTRAIT_R + 1,
        'Nv. 1',
        {
          fontFamily: DF_FONTS.BODY,
          fontSize: '10px',
          color: DF_PALETTE.textGold,
          fontStyle: 'bold',
          resolution: 2,
        }
      )
      .setOrigin(0.5);

    this.villageHeroNameText = scene.add
      .text(88, 17, 'JOVEM GUERREIRO', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '13px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        stroke: '#05070c',
        strokeThickness: 3,
        resolution: 2,
      })
      .setOrigin(0, 0.5);

    this.villageHpBarGfx = scene.add.graphics();
    this.villageHpText = scene.add
      .text(86 + 188 * 0.46, 30 + 9, '100/100', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '11px',
        color: '#fff7ed',
        fontStyle: 'bold',
        stroke: '#05070c',
        strokeThickness: 2.5,
        resolution: 2,
      })
      .setOrigin(0.5);

    this.villageSecBarGfx = scene.add.graphics();

    const heroChildren: Phaser.GameObjects.GameObject[] = [
      this.villagePortraitBg,
      this.villagePortraitFallback,
    ];
    if (this.villagePortraitImg) {
      heroChildren.push(this.villagePortraitImg);
    }
    heroChildren.push(
      this.villagePortraitRing,
      this.villageLevelBadgeBg,
      this.villageLevelBadgeText,
      this.villageHeroNameText,
      this.villageHpBarGfx,
      this.villageHpText,
      this.villageSecBarGfx
    );

    this.villageHeroContainer = scene.add
      .container(0, 0, heroChildren)
      .setScrollFactor(0)
      .setDepth(1015);

    // Tracker da Missão (x = 16, y = 94)
    this.villageTrackerGfx = scene.add.graphics();
    this.villageTrackerTitle = scene.add
      .text(24, 10, 'VILA NATAL', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '13px',
        color: DF_PALETTE.textGold,
        fontStyle: 'bold',
        stroke: '#05070c',
        strokeThickness: 3,
        resolution: 2,
      })
      .setOrigin(0, 0.5);

    this.villageTrackerText = scene.add
      .text(24, 26, 'Falar com o Mestre', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '11.5px',
        color: DF_PALETTE.textParchment,
        stroke: '#05070c',
        strokeThickness: 2.5,
        resolution: 2,
      })
      .setOrigin(0, 0.5);

    this.villageTrackerContainer = scene.add
      .container(16, 94, [
        this.villageTrackerGfx,
        this.villageTrackerTitle,
        this.villageTrackerText,
      ])
      .setScrollFactor(0)
      .setDepth(1015);

    // -------------------------------------------------------------------------
    // PROLOGUE / VILA NATAL HUD: 2. TOP-RIGHT CIRCULAR MINIMAP & 3 UTILITY BTNS
    // -------------------------------------------------------------------------
    this.villageMinimapBg = scene.add.graphics();
    this.villageMinimapDynamic = scene.add.graphics();
    this.villageMinimapFrame = scene.add.graphics();
    this.villageMinimapNorthText = scene.add
      .text(0, -VILLAGE_MINIMAP_R + 8, 'N', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '8.5px',
        color: DF_PALETTE.textGold,
        fontStyle: 'bold',
        stroke: '#05070c',
        strokeThickness: 2,
        resolution: 2,
      })
      .setOrigin(0.5);

    this.villageMinimapContainer = scene.add
      .container(0, 0, [
        this.villageMinimapBg,
        this.villageMinimapDynamic,
        this.villageMinimapFrame,
        this.villageMinimapNorthText,
      ])
      .setScrollFactor(0)
      .setDepth(1015);

    this.villageBagBtn = this.createVillageCircularButton(
      'Inventário',
      DF_UI_ICON_FRAMES.bag,
      () => this.callbacks.onOpenStash(),
      true
    );
    this.villageAudioBtn = this.createVillageCircularButton(
      'Áudio',
      DF_UI_ICON_FRAMES.audioOn,
      () => this.callbacks.onToggleMute?.(),
      false
    );
    this.villageConfigBtn = this.createVillageCircularButton(
      'Config.',
      DF_UI_ICON_FRAMES.settings,
      () => this.handleResetClick(),
      false
    );

    // -------------------------------------------------------------------------
    // PROLOGUE / VILA NATAL HUD: 3. BOTTOM-RIGHT CIRCULAR "INTERAGIR" MEDALLION
    // -------------------------------------------------------------------------
    this.villageInteractGlow = scene.add.graphics();
    this.villageInteractBg = scene.add.graphics();
    this.villageInteractEmblem = scene.add.graphics();
    this.villageInteractLabel = scene.add
      .text(0, 20, 'INTERAGIR', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '11.5px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        stroke: '#07090e',
        strokeThickness: 3,
        resolution: 2,
      })
      .setOrigin(0.5);

    this.villageInteractTargetBg = scene.add.graphics();
    this.villageInteractTargetText = scene.add
      .text(0, -VILLAGE_INTERACT_R - 16, '', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '11px',
        color: DF_PALETTE.textGold,
        fontStyle: 'bold',
        stroke: '#05070c',
        strokeThickness: 3,
        resolution: 2,
      })
      .setOrigin(0.5);

    this.villageInteractZone = scene.add
      .zone(0, 0, VILLAGE_INTERACT_R * 2 + 12, VILLAGE_INTERACT_R * 2 + 12)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.villageInteractZone.on('pointerover', () => {
      this.villageInteractHovered = true;
      this.drawVillageInteractButton();
    });
    this.villageInteractZone.on('pointerout', () => {
      this.villageInteractHovered = false;
      this.villageInteractPressed = false;
      this.drawVillageInteractButton();
    });
    this.villageInteractZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation?.();
        this.villageInteractPressed = true;
        this.drawVillageInteractButton();
        this.callbacks.onInteract?.();
      }
    );
    this.villageInteractZone.on('pointerup', () => {
      this.villageInteractPressed = false;
      this.drawVillageInteractButton();
    });

    this.villageInteractContainer = scene.add
      .container(0, 0, [
        this.villageInteractGlow,
        this.villageInteractBg,
        this.villageInteractEmblem,
        this.villageInteractLabel,
        this.villageInteractTargetBg,
        this.villageInteractTargetText,
        this.villageInteractZone,
      ])
      .setScrollFactor(0)
      .setDepth(1020);

    this.drawVillageHeroStaticShell();
    this.drawVillageTrackerStatic();
    this.drawVillageMinimapStaticShell();

    // -------------------------------------------------------------------------
    // MOVEMENT KEYS (WASD + ARROWS) & CONTEXTUAL INTERACT [E]
    // -------------------------------------------------------------------------
    if (scene.input.keyboard) {
      this.movementKeys = {
        up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
        down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
        left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
        w: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        s: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        a: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        d: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    this.keydownHandler = (event: KeyboardEvent) => {
      if (event.code === 'KeyE' && this.lastSnapshot.nearbyStationLabel) {
        this.callbacks.onInteract?.();
      }
    };
    scene.input.keyboard?.on('keydown', this.keydownHandler);

    this.resize(this.viewport);
    this.update(this.lastSnapshot);
  }

  public getMoveVector(): Vector2D {
    let vx = 0;
    let vy = 0;

    if (this.movementKeys) {
      if (this.movementKeys.left.isDown || this.movementKeys.a.isDown) {
        vx -= 1;
      }
      if (this.movementKeys.right.isDown || this.movementKeys.d.isDown) {
        vx += 1;
      }
      if (this.movementKeys.up.isDown || this.movementKeys.w.isDown) {
        vy -= 1;
      }
      if (this.movementKeys.down.isDown || this.movementKeys.s.isDown) {
        vy += 1;
      }
    }

    const joyDir = this.joystick.getDirection();
    if (joyDir.x !== 0 || joyDir.y !== 0) {
      vx += joyDir.x;
      vy += joyDir.y;
    }

    const length = Math.hypot(vx, vy);
    if (length === 0) {
      return { x: 0, y: 0 };
    }

    return {
      x: vx / length,
      y: vy / length,
    };
  }

  public update(snap: HubHudSnapshot): void {
    this.lastSnapshot = snap;

    const isPrologue = Boolean(snap.isPrologue);
    this.setLayoutVisibility(isPrologue);

    const banner = snap.bannerText?.trim() ?? '';
    if (banner.length > 0) {
      this.bannerContainer.setVisible(true);
      this.bannerLabel.setText(banner);
      this.drawBannerBox();
    } else {
      this.bannerContainer.setVisible(false);
    }

    if (isPrologue) {
      this.updateVillageHud(snap);
      return;
    }

    const locationTitle =
      snap.locationTitle?.trim() || 'Refúgio do Submundo';

    this.locationText
      .setText(locationTitle)
      .setColor(DF_PALETTE.textGold);

    this.soulsText.setText(`Almas: ${snap.souls}`);
    this.essencesText.setText(`Essências: ${snap.generalEssences}`);
    this.syncResourceIcons();

    this.gearText.setText(
      `Equip: ${snap.equippedCount}/6 | Baú: ${snap.stashCount}`
    );
    this.stashBtn.label.setText(
      snap.stashCount > 0 ? `Inventário (${snap.stashCount})` : 'Inventário'
    );
    this.altarBtn.label.setText('Altar');
    this.enterBtn.label.setText('Entrar na Fenda');
    this.syncButtonIconLayout(this.stashBtn);
    this.syncButtonIconLayout(this.enterBtn);

    const muted = Boolean(snap.isMuted);
    this.muteBtn.iconFrame = muted
      ? DF_UI_ICON_FRAMES.audioOff
      : DF_UI_ICON_FRAMES.audioOn;
    this.muteBtn.label
      .setText(muted ? 'Mudo' : 'Áudio')
      .setColor(muted ? DF_PALETTE.textDanger : DF_PALETTE.textLight);
    this.muteBtn.variant = muted ? 'crimson' : 'iron';
    this.redrawButtonGraphics(this.muteBtn);
    this.syncButtonIconLayout(this.muteBtn);

    const stageLabel = snap.stageLabel?.trim() ?? '';
    if (stageLabel.length > 0) {
      this.stageBtn.container.setVisible(true);
      const canCycle = Boolean(snap.canCycleStage);
      this.stageBtn.label
        .setText(canCycle ? `⇄ ${stageLabel}` : stageLabel)
        .setColor(canCycle ? DF_PALETTE.textGold : DF_PALETTE.textMuted);
      this.stageBtn.variant = canCycle ? 'gold' : 'iron';
      this.stageBtn.disabled = !canCycle;
      this.redrawButtonGraphics(this.stageBtn);
    } else {
      this.stageBtn.container.setVisible(false);
    }

    const station = snap.nearbyStationLabel?.trim() ?? '';
    if (station.length > 0) {
      this.interactBtn.container.setVisible(true);
      this.interactBtn.label.setText(`Interagir [E]: ${station}`);
    } else {
      this.interactBtn.container.setVisible(false);
    }
  }

  public resize(viewport: ViewportConfig): void {
    this.viewport = viewport;
    this.joystick.resize(viewport);

    const w = viewport.width;
    const h = viewport.height;

    // -------------------------------------------------------------------------
    // ACT 1 TOP BAR (54px height, 960x540 landscape)
    // -------------------------------------------------------------------------
    const topBarHeight = 54;
    const barMidY = Math.round(topBarHeight / 2);

    this.topPanelBg.clear();
    this.topPanelBg.fillStyle(DF_PALETTE.obsidianBg, 0.94);
    this.topPanelBg.fillRect(0, 0, w, topBarHeight);
    this.topPanelBg.fillStyle(DF_PALETTE.headerBg, 0.62);
    this.topPanelBg.fillRect(0, 0, w, 24);
    this.topPanelBg.lineStyle(1.5, DF_PALETTE.metalBorder, 0.92);
    this.topPanelBg.lineBetween(0, topBarHeight - 2, w, topBarHeight - 2);
    this.topPanelBg.lineStyle(1.2, DF_PALETTE.bronzeBorder, 0.95);
    this.topPanelBg.lineBetween(0, topBarHeight, w, topBarHeight);

    this.locationText.setFontSize(14).setPosition(18, barMidY);

    const resBaseX = Math.max(286, Math.round(w * 0.34));
    this.soulsIcon?.setPosition(resBaseX, barMidY).setDisplaySize(17, 17);
    this.soulsFallbackGraphic.setPosition(resBaseX, barMidY);
    this.soulsText.setFontSize(12).setPosition(resBaseX + 14, barMidY);

    const essBaseX = resBaseX + 142;
    this.essencesIcon?.setPosition(essBaseX, barMidY).setDisplaySize(17, 17);
    this.essencesFallbackGraphic.setPosition(essBaseX, barMidY);
    this.essencesText.setFontSize(12).setPosition(essBaseX + 14, barMidY);

    this.gearText.setFontSize(11).setPosition(w - 186, barMidY);

    this.layoutButton(this.muteBtn, w - 132, barMidY, 78, 30, 11);
    this.layoutButton(this.resetBtn, w - 48, barMidY, 76, 30, 11);

    this.bannerContainer.setPosition(w / 2, 80);
    this.bannerLabel.setWordWrapWidth(Math.min(500, w - 64));

    this.layoutButton(this.altarBtn, w - 352, h - 42, 100, 40, 12);
    this.layoutButton(this.blacksmithBtn, w - 244, h - 42, 100, 40, 12);
    this.layoutButton(this.enterBtn, w - 100, h - 42, 172, 44, 13);

    this.layoutButton(this.stashBtn, w - 298, h - 92, 208, 38, 12);
    this.layoutButton(this.stageBtn, w - 100, h - 92, 172, 38, 11);
    this.layoutButton(this.interactBtn, w - 208, h - 140, 264, 36, 12);

    // -------------------------------------------------------------------------
    // PROLOGUE / VILA NATAL LAYOUT (960x540 Landscape)
    // -------------------------------------------------------------------------
    this.villageHeroContainer.setPosition(0, 0);
    this.villageTrackerContainer.setPosition(16, 94);

    // Minimap circular (cx = width - 60, cy = 60, r = 46)
    this.villageMinimapContainer.setPosition(w - 60, 60);

    // 3 Botões Circulares Compactos abaixo do minimapa (y = 128, r = 18, gap = 50)
    const rowY = 128;
    this.villageBagBtn.container.setPosition(w - 134, rowY);
    this.villageAudioBtn.container.setPosition(w - 84, rowY);
    this.villageConfigBtn.container.setPosition(w - 34, rowY);

    // Botão Circular Principal Interagir (cx = width - 92, cy = height - 104, r = 42)
    this.villageInteractContainer.setPosition(w - 92, h - 104);

    this.update(this.lastSnapshot);
  }

  public destroy(): void {
    if (this.resetArmTimer !== undefined) {
      clearTimeout(this.resetArmTimer);
      this.resetArmTimer = undefined;
    }
    this.resetArmed = false;

    this.scene.input.keyboard?.off('keydown', this.keydownHandler);
    this.joystick.destroy();

    this.topPanelBg.destroy();
    this.locationText.destroy();
    this.soulsIcon?.destroy();
    this.soulsFallbackGraphic.destroy();
    this.soulsText.destroy();
    this.essencesIcon?.destroy();
    this.essencesFallbackGraphic.destroy();
    this.essencesText.destroy();
    this.gearText.destroy();
    this.bannerContainer.destroy();

    this.altarBtn.container.destroy();
    this.blacksmithBtn.container.destroy();
    this.stashBtn.container.destroy();
    this.enterBtn.container.destroy();
    this.interactBtn.container.destroy();
    this.stageBtn.container.destroy();
    this.muteBtn.container.destroy();
    this.resetBtn.container.destroy();

    this.villagePortraitMaskGfx?.destroy();
    this.villageHeroContainer.destroy(true);
    this.villageTrackerContainer.destroy(true);
    this.villageMinimapContainer.destroy(true);
    this.villageBagBtn.container.destroy(true);
    this.villageAudioBtn.container.destroy(true);
    this.villageConfigBtn.container.destroy(true);
    this.villageInteractContainer.destroy(true);
  }

  private setLayoutVisibility(isPrologue: boolean): void {
    // Act 1 / Refúgio elements
    const showAct1 = !isPrologue;
    this.topPanelBg.setVisible(showAct1);
    this.locationText.setVisible(showAct1);
    if (!showAct1) {
      this.soulsIcon?.setVisible(false);
      this.soulsFallbackGraphic.setVisible(false);
      this.essencesIcon?.setVisible(false);
      this.essencesFallbackGraphic.setVisible(false);
    }
    this.soulsText.setVisible(showAct1);
    this.essencesText.setVisible(showAct1);
    this.gearText.setVisible(showAct1);

    this.altarBtn.container.setVisible(showAct1);
    this.blacksmithBtn.container.setVisible(showAct1);
    this.stashBtn.container.setVisible(showAct1);
    this.enterBtn.container.setVisible(showAct1);
    this.muteBtn.container.setVisible(showAct1);
    this.resetBtn.container.setVisible(showAct1);
    if (isPrologue) {
      this.interactBtn.container.setVisible(false);
      this.stageBtn.container.setVisible(false);
    }

    // Prologue / Vila Natal elements
    this.villageHeroContainer.setVisible(isPrologue);
    this.villageTrackerContainer.setVisible(isPrologue);
    this.villageMinimapContainer.setVisible(isPrologue);
    this.villageBagBtn.container.setVisible(isPrologue);
    this.villageAudioBtn.container.setVisible(isPrologue);
    this.villageConfigBtn.container.setVisible(isPrologue);
    this.villageInteractContainer.setVisible(isPrologue);
  }

  private updateVillageHud(snap: HubHudSnapshot): void {
    // 1. Hero Portrait, Name, Level & HP Bar
    const heroName = (snap.heroName?.trim() || 'JOVEM GUERREIRO').toUpperCase();
    const heroLevel = Math.max(1, Math.floor(snap.heroLevel ?? 1));
    const maxHp = Math.max(1, Math.round(snap.heroMaxHp ?? 100));
    const hp = Math.max(0, Math.min(maxHp, Math.round(snap.heroHp ?? maxHp)));

    this.villageHeroNameText.setText(heroName);
    this.villageLevelBadgeText.setText(`Nv. ${heroLevel}`);
    this.villageHpText.setText(`${hp}/${maxHp}`);

    const hasPortrait =
      this.villagePortraitImg !== null &&
      hasUiTextureFrame(this.scene, PORTRAITS_KEY, 0);
    if (this.villagePortraitImg) {
      this.villagePortraitImg.setVisible(hasPortrait);
      if (hasPortrait) {
        this.villagePortraitImg.setFrame(0);
        const size = (VILLAGE_PORTRAIT_R - 1) * 2;
        this.villagePortraitImg.setDisplaySize(size, size);
      }
    }
    this.villagePortraitFallback.setVisible(!hasPortrait);

    this.drawVillageHpBars(hp / maxHp);

    // 2. Mission Tracker
    const trackerTitle = (snap.trackerTitle?.trim() || 'VILA NATAL').toUpperCase();
    const trackerText = snap.trackerText?.trim() || 'Falar com o Mestre';
    this.villageTrackerTitle.setText(trackerTitle);
    this.villageTrackerText.setText(trackerText);

    // 3. Minimap Dynamic Layer
    this.drawVillageMinimapDynamic(snap);

    // 4. Utility Circular Trio (Inventário, Áudio, Config.)
    this.refreshVillageUtilityButtons(snap);

    // 5. Primary Circular "INTERAGIR" Button
    this.drawVillageInteractButton();
  }

  private drawVillageHeroStaticShell(): void {
    const cx = VILLAGE_PORTRAIT_CX;
    const cy = VILLAGE_PORTRAIT_CY;
    const r = VILLAGE_PORTRAIT_R;

    this.villagePortraitBg.clear();
    this.villagePortraitBg.fillStyle(0x000000, 0.5);
    this.villagePortraitBg.fillCircle(cx, cy + 2, r + 3);
    this.villagePortraitBg.fillStyle(DF_PALETTE.deepRecess, 0.96);
    this.villagePortraitBg.fillCircle(cx, cy, r);

    this.villagePortraitRing.clear();
    this.villagePortraitRing.lineStyle(3.5, DF_PALETTE.metalDark, 0.98);
    this.villagePortraitRing.strokeCircle(cx, cy, r + 1.5);
    this.villagePortraitRing.lineStyle(2.2, DF_PALETTE.bronzeBorder, 0.98);
    this.villagePortraitRing.strokeCircle(cx, cy, r);
    this.villagePortraitRing.lineStyle(1, DF_PALETTE.agedGold, 0.75);
    this.villagePortraitRing.strokeCircle(cx, cy, r - 2);

    this.villagePortraitRing.fillStyle(DF_PALETTE.agedGold, 0.96);
    for (const pt of [
      { x: cx, y: cy - r },
      { x: cx + r, y: cy },
      { x: cx - r, y: cy },
    ]) {
      this.villagePortraitRing.fillCircle(pt.x, pt.y, 2);
    }

    const bw = 46;
    const bh = 15;
    const by = cy + r + 1;
    this.villageLevelBadgeBg.clear();
    this.villageLevelBadgeBg.fillStyle(DF_PALETTE.obsidianBg, 0.96);
    this.villageLevelBadgeBg.fillRoundedRect(
      cx - bw / 2,
      by - bh / 2,
      bw,
      bh,
      4
    );
    this.villageLevelBadgeBg.lineStyle(1.3, DF_PALETTE.agedGold, 0.95);
    this.villageLevelBadgeBg.strokeRoundedRect(
      cx - bw / 2,
      by - bh / 2,
      bw,
      bh,
      4
    );
  }

  private drawVillageHpBars(ratio: number): void {
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const barX = 86;
    const hpY = 30;
    const hpW = 188;
    const hpH = 18;
    const bevel = 9;

    this.villageHpBarGfx.clear();
    const bgPts = getChamferPoints(barX, hpY, hpW, hpH, bevel);
    this.villageHpBarGfx.fillStyle(DF_PALETTE.deepRecess, 0.95);
    this.villageHpBarGfx.fillPoints(bgPts, true);

    if (clampedRatio > 0) {
      const fw = Math.max(bevel + 2, hpW * clampedRatio);
      const fillPts = getChamferPoints(
        barX + 1,
        hpY + 1,
        fw - 2,
        hpH - 2,
        Math.min(bevel, fw * 0.35)
      );
      this.villageHpBarGfx.fillStyle(0xb91c1c, 0.98);
      this.villageHpBarGfx.fillPoints(fillPts, true);

      const hiPts = getChamferPoints(
        barX + 2,
        hpY + 2,
        Math.max(4, fw - 6),
        6,
        4
      );
      this.villageHpBarGfx.fillStyle(0xef4444, 0.55);
      this.villageHpBarGfx.fillPoints(hiPts, true);
    }

    this.villageHpBarGfx.lineStyle(1.6, DF_PALETTE.bronzeBorder, 0.98);
    this.villageHpBarGfx.strokePoints(bgPts, true);
    const outerPts = getChamferPoints(barX - 1, hpY - 1, hpW + 2, hpH + 2, bevel);
    this.villageHpBarGfx.lineStyle(1, DF_PALETTE.metalDark, 0.92);
    this.villageHpBarGfx.strokePoints(outerPts, true);

    // Secondary amber bar below HP bar
    const secY = 53;
    const secW = 154;
    const secH = 6;
    this.villageSecBarGfx.clear();
    const secBgPts = getChamferPoints(barX, secY, secW, secH, 4);
    this.villageSecBarGfx.fillStyle(DF_PALETTE.deepRecess, 0.92);
    this.villageSecBarGfx.fillPoints(secBgPts, true);

    const secFillPts = getChamferPoints(
      barX + 1,
      secY + 1,
      (secW - 2) * 0.45,
      secH - 2,
      3
    );
    this.villageSecBarGfx.fillStyle(0xd97706, 0.95);
    this.villageSecBarGfx.fillPoints(secFillPts, true);
    this.villageSecBarGfx.lineStyle(1, DF_PALETTE.metalBorder, 0.88);
    this.villageSecBarGfx.strokePoints(secBgPts, true);
  }

  private drawVillageTrackerStatic(): void {
    const dcx = 10;
    const dcy = 10;

    this.villageTrackerGfx.clear();
    this.villageTrackerGfx.fillStyle(DF_PALETTE.agedGold, 0.96);
    this.villageTrackerGfx.fillPoints(
      [
        new Phaser.Geom.Point(dcx, dcy - 6.2),
        new Phaser.Geom.Point(dcx + 6.2, dcy),
        new Phaser.Geom.Point(dcx, dcy + 6.2),
        new Phaser.Geom.Point(dcx - 6.2, dcy),
      ],
      true
    );
    this.villageTrackerGfx.fillStyle(DF_PALETTE.bronzeDark, 0.95);
    this.villageTrackerGfx.fillPoints(
      [
        new Phaser.Geom.Point(dcx, dcy - 5),
        new Phaser.Geom.Point(dcx + 5, dcy),
        new Phaser.Geom.Point(dcx, dcy + 5),
        new Phaser.Geom.Point(dcx - 5, dcy),
      ],
      true
    );
    this.villageTrackerGfx.fillStyle(DF_PALETTE.goldBright, 0.98);
    this.villageTrackerGfx.fillPoints(
      [
        new Phaser.Geom.Point(dcx, dcy - 3),
        new Phaser.Geom.Point(dcx + 3, dcy),
        new Phaser.Geom.Point(dcx, dcy + 3),
        new Phaser.Geom.Point(dcx - 3, dcy),
      ],
      true
    );

    this.villageTrackerGfx.lineStyle(1, DF_PALETTE.bronzeBorder, 0.5);
    this.villageTrackerGfx.lineBetween(0, 44, 214, 44);
    this.villageTrackerGfx.lineStyle(1.2, DF_PALETTE.agedGold, 0.65);
    this.villageTrackerGfx.lineBetween(0, 44, 56, 44);
  }

  private drawVillageMinimapStaticShell(): void {
    const r = VILLAGE_MINIMAP_R;

    this.villageMinimapBg.clear();
    this.villageMinimapBg.fillStyle(0x000000, 0.5);
    this.villageMinimapBg.fillCircle(0, 2, r + 4);
    this.villageMinimapBg.fillStyle(0x0a101a, 0.94);
    this.villageMinimapBg.fillCircle(0, 0, r);

    // Stylized silhouette of the village clearing with North gate corridor & South opening
    const clearingPts = [
      new Phaser.Geom.Point(-26, -12),
      new Phaser.Geom.Point(4, -12),
      new Phaser.Geom.Point(4, -28),
      new Phaser.Geom.Point(16, -28),
      new Phaser.Geom.Point(16, -12),
      new Phaser.Geom.Point(28, -12),
      new Phaser.Geom.Point(32, -6),
      new Phaser.Geom.Point(32, 12),
      new Phaser.Geom.Point(24, 18),
      new Phaser.Geom.Point(5, 18),
      new Phaser.Geom.Point(5, 25),
      new Phaser.Geom.Point(-5, 25),
      new Phaser.Geom.Point(-5, 18),
      new Phaser.Geom.Point(-24, 18),
      new Phaser.Geom.Point(-32, 10),
      new Phaser.Geom.Point(-32, -6),
    ];
    this.villageMinimapBg.fillStyle(0x28364a, 0.92);
    this.villageMinimapBg.fillPoints(clearingPts, true);
    this.villageMinimapBg.lineStyle(1, 0x64748b, 0.9);
    this.villageMinimapBg.strokePoints(clearingPts, true);

    this.villageMinimapFrame.clear();
    this.villageMinimapFrame.lineStyle(3.5, DF_PALETTE.metalDark, 0.98);
    this.villageMinimapFrame.strokeCircle(0, 0, r + 1.5);
    this.villageMinimapFrame.lineStyle(2.2, DF_PALETTE.bronzeBorder, 0.98);
    this.villageMinimapFrame.strokeCircle(0, 0, r);
    this.villageMinimapFrame.lineStyle(1, DF_PALETTE.agedGold, 0.6);
    this.villageMinimapFrame.strokeCircle(0, 0, r - 2);

    this.villageMinimapFrame.fillStyle(DF_PALETTE.agedGold, 0.96);
    for (const pt of [
      { x: r, y: 0 },
      { x: 0, y: r },
      { x: -r, y: 0 },
      { x: 0, y: -r },
    ]) {
      this.villageMinimapFrame.fillCircle(pt.x, pt.y, 2);
    }
  }

  private drawVillageMinimapDynamic(snap: HubHudSnapshot): void {
    this.villageMinimapDynamic.clear();

    const projectNorm = (nx: number, ny: number): Vector2D => {
      const clampedX = Math.max(0.1, Math.min(0.9, nx));
      const clampedY = Math.max(0.15, Math.min(0.85, ny));
      const px = (clampedX - 0.5) * 68;
      const py = (clampedY - 0.5) * 44;
      const dist = Math.hypot(px, py);
      const maxR = VILLAGE_MINIMAP_R - 7;
      if (dist > maxR && dist > 0) {
        return { x: (px / dist) * maxR, y: (py / dist) * maxR };
      }
      return { x: px, y: py };
    };

    // Campfire at center (640/1280 = 0.5, 390/720 = 0.542)
    const firePt = projectNorm(0.5, 0.542);
    this.villageMinimapDynamic.fillStyle(0xf97316, 0.98);
    this.villageMinimapDynamic.fillCircle(firePt.x, firePt.y, 2.1);

    // Exit Gate marker at north-east corridor (860/1280 = 0.672, 235/720 = 0.326)
    const gatePt = projectNorm(0.672, 0.326);
    this.villageMinimapDynamic.fillStyle(
      snap.gateUnlocked ? 0xfde047 : 0x94a3b8,
      0.92
    );
    this.villageMinimapDynamic.fillRect(gatePt.x - 3, gatePt.y - 1.5, 6, 3);

    // Lyra at north-west in front of house (372/1280 = 0.291, 296/720 = 0.411)
    const lyraPt = projectNorm(0.291, 0.411);
    this.villageMinimapDynamic.fillStyle(0x4ade80, 0.96);
    this.villageMinimapDynamic.fillCircle(lyraPt.x, lyraPt.y, 2.2);

    // Gorran at east forge (922/1280 = 0.720, 392/720 = 0.544)
    const gorranPt = projectNorm(0.72, 0.544);
    this.villageMinimapDynamic.fillStyle(0xfb923c, 0.96);
    this.villageMinimapDynamic.fillCircle(gorranPt.x, gorranPt.y, 2.2);

    // Weapon Master at west clearing (310/1280 = 0.242, 410/720 = 0.569)
    const masterPt = projectNorm(0.242, 0.569);
    this.villageMinimapDynamic.fillStyle(0xfacc15, 1);
    this.villageMinimapDynamic.fillCircle(masterPt.x, masterPt.y, 2.7);

    // Hero cyan triangle
    const heroNorm = snap.heroNormalizedPos ?? { x: 0.4, y: 0.59 };
    const heroPt = projectNorm(heroNorm.x, heroNorm.y);
    this.villageMinimapDynamic.fillStyle(0x38bdf8, 1);
    this.villageMinimapDynamic.fillPoints(
      [
        new Phaser.Geom.Point(heroPt.x, heroPt.y - 4),
        new Phaser.Geom.Point(heroPt.x + 3.5, heroPt.y + 3),
        new Phaser.Geom.Point(heroPt.x - 3.5, heroPt.y + 3),
      ],
      true
    );
  }

  private createVillageCircularButton(
    labelText: string,
    iconFrame: number,
    onClick: () => void,
    hasBadge: boolean
  ): VillageCircularBtnView {
    const bg = this.scene.add.graphics();
    const fallbackGfx = this.scene.add.graphics();
    const icon = hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, iconFrame)
      ? this.scene.add
          .image(0, 0, DF_UI_ICONS_KEY, iconFrame)
          .setOrigin(0.5)
          .setDisplaySize(20, 20)
      : null;

    const badgeBg = hasBadge ? this.scene.add.graphics() : undefined;
    const badgeText = hasBadge
      ? this.scene.add
          .text(13, -13, '0', {
            fontFamily: DF_FONTS.BODY,
            fontSize: '9px',
            color: '#ffffff',
            fontStyle: 'bold',
            resolution: 2,
          })
          .setOrigin(0.5)
          .setVisible(false)
      : undefined;

    const label = this.scene.add
      .text(0, VILLAGE_UTILITY_R + 9, labelText, {
        fontFamily: DF_FONTS.BODY,
        fontSize: '9px',
        color: DF_PALETTE.textMuted,
        stroke: '#05070c',
        strokeThickness: 2.5,
        resolution: 2,
      })
      .setOrigin(0.5);

    const hitSize = VILLAGE_UTILITY_R * 2 + 8;
    const zone = this.scene.add
      .zone(0, 0, hitSize, hitSize)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const children: Phaser.GameObjects.GameObject[] = [bg, fallbackGfx];
    if (icon) {
      children.push(icon);
    }
    if (badgeBg && badgeText) {
      children.push(badgeBg, badgeText);
    }
    children.push(label, zone);

    const container = this.scene.add
      .container(0, 0, children)
      .setScrollFactor(0)
      .setDepth(1020);

    const view: VillageCircularBtnView = {
      container,
      bg,
      icon,
      fallbackGfx,
      badgeBg,
      badgeText,
      label,
      zone,
      hovered: false,
      pressed: false,
    };

    zone.on('pointerover', () => {
      view.hovered = true;
      this.refreshVillageUtilityButtons(this.lastSnapshot);
    });
    zone.on('pointerout', () => {
      view.hovered = false;
      view.pressed = false;
      this.refreshVillageUtilityButtons(this.lastSnapshot);
    });
    zone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation?.();
        view.pressed = true;
        onClick();
        this.refreshVillageUtilityButtons(this.lastSnapshot);
      }
    );
    zone.on('pointerup', () => {
      view.pressed = false;
      this.refreshVillageUtilityButtons(this.lastSnapshot);
    });

    return view;
  }

  private refreshVillageUtilityButtons(snap: HubHudSnapshot): void {
    const r = VILLAGE_UTILITY_R;

    // 1. Inventário
    this.drawCircularMetalShell(
      this.villageBagBtn.bg,
      r,
      DF_PALETTE.agedGold,
      this.villageBagBtn.hovered
    );
    const hasBagIcon =
      this.villageBagBtn.icon !== null &&
      hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.bag);
    this.villageBagBtn.icon?.setVisible(hasBagIcon);
    this.villageBagBtn.fallbackGfx.clear();
    if (!hasBagIcon) {
      this.villageBagBtn.fallbackGfx.lineStyle(1.6, DF_PALETTE.agedGold, 0.95);
      this.villageBagBtn.fallbackGfx.strokeRoundedRect(-6, -5, 12, 11, 2);
    }
    if (this.villageBagBtn.badgeBg && this.villageBagBtn.badgeText) {
      this.villageBagBtn.badgeBg.clear();
      if (snap.stashCount > 0) {
        this.villageBagBtn.badgeBg.fillStyle(0xb91c1c, 0.98);
        this.villageBagBtn.badgeBg.fillCircle(13, -13, 7.5);
        this.villageBagBtn.badgeBg.lineStyle(1.2, DF_PALETTE.agedGold, 0.98);
        this.villageBagBtn.badgeBg.strokeCircle(13, -13, 7.5);
        this.villageBagBtn.badgeText
          .setText(`${Math.min(99, snap.stashCount)}`)
          .setVisible(true);
      } else {
        this.villageBagBtn.badgeText.setVisible(false);
      }
    }

    // 2. Áudio
    const muted = Boolean(snap.isMuted);
    this.drawCircularMetalShell(
      this.villageAudioBtn.bg,
      r,
      muted ? DF_PALETTE.buttonCrimsonBorder : DF_PALETTE.bronzeBorder,
      this.villageAudioBtn.hovered
    );
    const audioFrame = muted
      ? DF_UI_ICON_FRAMES.audioOff
      : DF_UI_ICON_FRAMES.audioOn;
    const hasAudioIcon =
      this.villageAudioBtn.icon !== null &&
      hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, audioFrame);
    if (this.villageAudioBtn.icon) {
      this.villageAudioBtn.icon.setVisible(hasAudioIcon);
      if (hasAudioIcon) {
        this.villageAudioBtn.icon.setFrame(audioFrame);
      }
    }
    this.villageAudioBtn.fallbackGfx.clear();
    if (!hasAudioIcon) {
      this.villageAudioBtn.fallbackGfx.lineStyle(
        1.6,
        muted ? 0xf87171 : DF_PALETTE.agedGold,
        0.95
      );
      this.villageAudioBtn.fallbackGfx.strokeCircle(0, 0, 5);
    }
    this.villageAudioBtn.label
      .setText(muted ? 'Mudo' : 'Áudio')
      .setColor(muted ? DF_PALETTE.textDanger : DF_PALETTE.textMuted);

    // 3. Config. (clean 2D gear graphic + 2-click reset confirmation)
    this.drawCircularMetalShell(
      this.villageConfigBtn.bg,
      r,
      this.resetArmed ? 0xef4444 : DF_PALETTE.bronzeBorder,
      this.villageConfigBtn.hovered,
      this.resetArmed ? 0x5c151b : undefined
    );
    const hasSettingsIcon =
      this.villageConfigBtn.icon !== null &&
      hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.settings);
    this.villageConfigBtn.icon?.setVisible(hasSettingsIcon);
    this.drawConfigGearFallback(
      this.villageConfigBtn.fallbackGfx,
      !hasSettingsIcon
    );
    this.villageConfigBtn.label
      .setText(this.resetArmed ? 'Confirmar?' : 'Config.')
      .setColor(this.resetArmed ? '#ffffff' : DF_PALETTE.textMuted);
  }

  private drawCircularMetalShell(
    gfx: Phaser.GameObjects.Graphics,
    r: number,
    accentColor: number,
    hovered: boolean,
    fillOverride?: number
  ): void {
    gfx.clear();
    gfx.fillStyle(0x000000, 0.45);
    gfx.fillCircle(0, 2, r + 2);
    gfx.fillStyle(
      fillOverride ?? (hovered ? 0x1e2534 : DF_PALETTE.innerSurface),
      0.95
    );
    gfx.fillCircle(0, 0, r);
    gfx.lineStyle(2.4, DF_PALETTE.metalDark, 0.98);
    gfx.strokeCircle(0, 0, r + 1.2);
    gfx.lineStyle(hovered ? 2 : 1.6, accentColor, 0.96);
    gfx.strokeCircle(0, 0, r);
    gfx.lineStyle(0.9, DF_PALETTE.metalDark, 0.85);
    gfx.strokeCircle(0, 0, r - 2.5);
  }

  private drawConfigGearFallback(
    gfx: Phaser.GameObjects.Graphics,
    visible: boolean
  ): void {
    gfx.clear();
    if (!visible) {
      return;
    }
    const color = this.resetArmed ? 0xfca5a5 : 0xcbd5e1;
    gfx.lineStyle(1.8, color, 0.95);
    gfx.strokeCircle(0, 0, 5.2);
    gfx.fillStyle(color, 0.95);
    for (let i = 0; i < 8; i += 1) {
      const angle = (i * Math.PI) / 4;
      gfx.fillCircle(Math.cos(angle) * 7.2, Math.sin(angle) * 7.2, 1.4);
    }
  }

  private drawVillageInteractButton(): void {
    const r = VILLAGE_INTERACT_R;
    const nearbyTarget = this.lastSnapshot.nearbyStationLabel?.trim() ?? '';
    const isActive = nearbyTarget.length > 0;

    this.villageInteractGlow.clear();
    if (isActive) {
      this.villageInteractGlow.fillStyle(0xfacc15, 0.16);
      this.villageInteractGlow.fillCircle(0, 0, r + 14);
      this.villageInteractGlow.fillStyle(0xfbbf24, 0.28);
      this.villageInteractGlow.fillCircle(0, 0, r + 7);
    } else {
      this.villageInteractGlow.fillStyle(0xfaae46, 0.12);
      this.villageInteractGlow.fillCircle(0, 0, r + 10);
    }

    this.villageInteractBg.clear();
    this.villageInteractBg.fillStyle(0x000000, 0.5);
    this.villageInteractBg.fillCircle(0, 3, r + 4);

    const fillColor = this.villageInteractPressed
      ? 0x331015
      : this.villageInteractHovered || isActive
        ? 0x581c22
        : DF_PALETTE.buttonCrimsonFill;
    this.villageInteractBg.fillStyle(fillColor, 0.95);
    this.villageInteractBg.fillCircle(0, 0, r);

    this.villageInteractBg.fillStyle(0x6e242c, 0.35);
    this.villageInteractBg.fillCircle(0, -6, r - 8);

    this.villageInteractBg.lineStyle(3.5, DF_PALETTE.metalDark, 0.98);
    this.villageInteractBg.strokeCircle(0, 0, r + 1.5);
    this.villageInteractBg.lineStyle(
      2.4,
      isActive ? DF_PALETTE.goldBright : DF_PALETTE.buttonCrimsonBorder,
      0.98
    );
    this.villageInteractBg.strokeCircle(0, 0, r);
    this.villageInteractBg.lineStyle(1.2, DF_PALETTE.agedGold, 0.88);
    this.villageInteractBg.strokeCircle(0, 0, r - 3);

    this.drawInteractEmblemGraphics(this.villageInteractEmblem, 0, -9);

    this.villageInteractLabel.setColor(
      isActive ? '#fef08a' : DF_PALETTE.textParchment
    );

    this.villageInteractTargetBg.clear();
    if (isActive) {
      this.villageInteractTargetText.setText(nearbyTarget).setVisible(true);
      const pillW = Math.max(92, (this.villageInteractTargetText.width || 80) + 18);
      const pillH = 20;
      const pillY = -r - 16;
      this.villageInteractTargetBg.fillStyle(DF_PALETTE.obsidianBg, 0.94);
      this.villageInteractTargetBg.fillRoundedRect(
        -pillW / 2,
        pillY - pillH / 2,
        pillW,
        pillH,
        5
      );
      this.villageInteractTargetBg.lineStyle(1.3, DF_PALETTE.agedGold, 0.95);
      this.villageInteractTargetBg.strokeRoundedRect(
        -pillW / 2,
        pillY - pillH / 2,
        pillW,
        pillH,
        5
      );
    } else {
      this.villageInteractTargetText.setVisible(false);
    }
  }

  private drawInteractEmblemGraphics(
    gfx: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number
  ): void {
    gfx.clear();
    const bw = 30;
    const bh = 20;
    const x0 = cx - bw / 2;
    const y0 = cy - bh / 2 - 1;

    // Shadow
    gfx.fillStyle(0x060508, 0.72);
    gfx.fillPoints(getChamferPoints(x0 + 1, y0 + 2, bw, bh, 5), true);

    // Outer metallic dark plate
    gfx.fillStyle(DF_PALETTE.metalDark, 0.98);
    gfx.fillPoints(getChamferPoints(x0, y0, bw, bh, 5), true);

    // Inner warm bronze/gold plate
    gfx.fillStyle(DF_PALETTE.bronzeDark, 0.96);
    gfx.fillPoints(getChamferPoints(x0 + 1.6, y0 + 1.6, bw - 3.2, bh - 3.2, 4), true);
    gfx.fillStyle(DF_PALETTE.bronzeBorder, 0.75);
    gfx.fillPoints(
      getChamferPoints(x0 + 2.6, y0 + 2.4, bw - 5.2, (bh - 4.8) * 0.55, 3),
      true
    );

    // Dialogue crest lower tail
    gfx.fillStyle(DF_PALETTE.metalDark, 0.98);
    gfx.fillPoints(
      [
        new Phaser.Geom.Point(cx - 6.5, y0 + bh - 1),
        new Phaser.Geom.Point(cx - 10.5, y0 + bh + 6),
        new Phaser.Geom.Point(cx - 0.5, y0 + bh - 1),
      ],
      true
    );
    gfx.fillStyle(DF_PALETTE.agedGold, 0.96);
    gfx.fillPoints(
      [
        new Phaser.Geom.Point(cx - 5.5, y0 + bh - 1.8),
        new Phaser.Geom.Point(cx - 8.5, y0 + bh + 3.8),
        new Phaser.Geom.Point(cx - 1.5, y0 + bh - 1.8),
      ],
      true
    );

    // Double golden fillet
    gfx.lineStyle(1.5, DF_PALETTE.agedGold, 0.96);
    gfx.strokePoints(
      getChamferPoints(x0 + 1.2, y0 + 1.2, bw - 2.4, bh - 2.4, 4.2),
      true
    );
    gfx.lineStyle(0.9, DF_PALETTE.goldBright, 0.55);
    gfx.strokePoints(
      getChamferPoints(x0 + 2.4, y0 + 2.4, bw - 4.8, bh - 4.8, 3.2),
      true
    );

    // 3 golden diamond gems in the center
    for (const dx of [-7.5, 0, 7.5]) {
      const px = cx + dx;
      const py = y0 + bh / 2;
      const r1 = 2.7;
      gfx.fillStyle(DF_PALETTE.metalDark, 0.95);
      gfx.fillPoints(
        [
          new Phaser.Geom.Point(px, py - r1),
          new Phaser.Geom.Point(px + r1, py),
          new Phaser.Geom.Point(px, py + r1),
          new Phaser.Geom.Point(px - r1, py),
        ],
        true
      );
      const r2 = 2.0;
      gfx.fillStyle(DF_PALETTE.goldBright, 0.98);
      gfx.fillPoints(
        [
          new Phaser.Geom.Point(px, py - r2),
          new Phaser.Geom.Point(px + r2, py),
          new Phaser.Geom.Point(px, py + r2),
          new Phaser.Geom.Point(px - r2, py),
        ],
        true
      );
    }
  }

  private handleResetClick(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.resetBtn.label.setText('Confirmar?').setColor('#ffffff');
      this.resetBtn.variant = 'crimson';
      this.redrawButtonGraphics(this.resetBtn);
      this.refreshVillageUtilityButtons(this.lastSnapshot);

      if (this.resetArmTimer !== undefined) {
        clearTimeout(this.resetArmTimer);
      }
      this.resetArmTimer = setTimeout(() => {
        this.disarmReset();
      }, 3500);
      return;
    }

    this.disarmReset();
    this.callbacks.onResetSave?.();
  }

  private disarmReset(): void {
    if (this.resetArmTimer !== undefined) {
      clearTimeout(this.resetArmTimer);
      this.resetArmTimer = undefined;
    }
    this.resetArmed = false;
    this.resetBtn.label.setText('Resetar').setColor(DF_PALETTE.textDanger);
    this.resetBtn.variant = 'crimson';
    this.redrawButtonGraphics(this.resetBtn);
    this.refreshVillageUtilityButtons(this.lastSnapshot);
  }

  private createActionButton(
    text: string,
    variant: OrnateButtonVariant,
    textColor: string,
    onClick: () => void,
    iconFrame?: number,
    useTitleFont = false
  ): ActionButtonView {
    const bg = this.scene.add.graphics();
    const icon =
      iconFrame !== undefined &&
      hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, iconFrame)
        ? this.scene.add.image(0, 0, DF_UI_ICONS_KEY, iconFrame).setOrigin(0.5)
        : null;

    const label = this.scene.add
      .text(0, 0, text, {
        fontFamily: useTitleFont ? DF_FONTS.TITLE : DF_FONTS.BODY,
        fontSize: '12px',
        color: textColor,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);
    const zone = this.scene.add
      .zone(0, 0, 100, 40)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    const children: Phaser.GameObjects.GameObject[] = [bg];
    if (icon) {
      children.push(icon);
    }
    children.push(label, zone);

    const container = this.scene.add
      .container(0, 0, children)
      .setScrollFactor(0)
      .setDepth(1020);

    const btn: ActionButtonView = {
      container,
      bg,
      icon,
      iconFrame,
      label,
      zone,
      variant,
      width: 100,
      height: 40,
      hovered: false,
      pressed: false,
      disabled: false,
    };

    zone.on('pointerover', () => {
      btn.hovered = true;
      this.redrawButtonGraphics(btn);
    });
    zone.on('pointerout', () => {
      btn.hovered = false;
      btn.pressed = false;
      this.redrawButtonGraphics(btn);
    });
    zone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation?.();
        btn.pressed = true;
        this.redrawButtonGraphics(btn);
        onClick();
      }
    );
    zone.on('pointerup', () => {
      btn.pressed = false;
      this.redrawButtonGraphics(btn);
    });

    return btn;
  }

  private layoutButton(
    btn: ActionButtonView,
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number
  ): void {
    btn.width = width;
    btn.height = height;
    btn.container.setPosition(x, y);
    btn.zone.setSize(width, height);
    btn.label.setFontSize(fontSize);
    this.redrawButtonGraphics(btn);
    this.syncButtonIconLayout(btn);
  }

  private syncButtonIconLayout(btn: ActionButtonView): void {
    if (!btn.icon || btn.iconFrame === undefined) {
      btn.label.setPosition(0, 0);
      return;
    }

    const available = hasUiTextureFrame(
      this.scene,
      DF_UI_ICONS_KEY,
      btn.iconFrame
    );
    btn.icon.setVisible(available);
    if (!available) {
      btn.label.setPosition(0, 0);
      return;
    }

    btn.icon.setFrame(btn.iconFrame);
    const iconSize = Math.max(12, Math.min(20, Math.round(btn.height * 0.52)));
    btn.icon.setDisplaySize(iconSize, iconSize);

    const textW = btn.label.width || 0;
    const gap = btn.width <= 80 ? 4 : 6;
    const totalW = iconSize + gap + textW;
    const maxW = btn.width - 14;

    if (totalW <= maxW) {
      const startX = -totalW / 2;
      btn.icon.setPosition(startX + iconSize / 2, 0);
      btn.label.setPosition(startX + iconSize + gap + textW / 2, 0);
    } else {
      btn.icon.setPosition(-btn.width / 2 + iconSize / 2 + 7, 0);
      btn.label.setPosition(iconSize / 2 + 3, 0);
    }
  }

  private redrawButtonGraphics(btn: ActionButtonView): void {
    const bevel = Math.min(7, Math.max(4, Math.round(btn.height * 0.2)));
    const isArmedReset = btn === this.resetBtn && this.resetArmed;

    drawOrnateButton(
      btn.bg,
      -btn.width / 2,
      -btn.height / 2,
      btn.width,
      btn.height,
      {
        variant: btn.variant,
        bevel,
        hovered: btn.hovered,
        pressed: btn.pressed,
        disabled: btn.disabled,
        ...(isArmedReset
          ? { fillColor: 0x7f1d1d, borderColor: 0xef4444 }
          : {}),
        clear: true,
      }
    );
  }

  private drawBannerBox(): void {
    const width = Math.min(520, this.viewport.width - 48);
    const textHeight = this.bannerLabel.height || 16;
    const height = Math.max(34, Math.min(54, Math.ceil(textHeight) + 16));

    drawOrnatePanel(this.bannerBg, {
      x: -width / 2,
      y: -height / 2,
      width,
      height,
      bevel: 7,
      fillColor: DF_PALETTE.obsidianBg,
      fillAlpha: 0.92,
      innerFillColor: DF_PALETTE.innerSurface,
      outerBorderColor: DF_PALETTE.metalBorder,
      innerBorderColor: DF_PALETTE.bronzeBorder,
      accentColor: DF_PALETTE.agedGold,
      shadow: true,
      shadowOffsetX: 2,
      shadowOffsetY: 3,
      shadowAlpha: 0.45,
      cornerOrnaments: false,
      clear: true,
    });
  }

  private syncResourceIcons(): void {
    const hasSouls =
      this.soulsIcon !== null &&
      hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.souls);
    this.soulsIcon?.setVisible(hasSouls);
    if (hasSouls && this.soulsIcon) {
      this.soulsIcon.setFrame(DF_UI_ICON_FRAMES.souls);
    }
    this.soulsFallbackGraphic.setVisible(!hasSouls);

    const hasEssence =
      this.essencesIcon !== null &&
      hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.essence);
    this.essencesIcon?.setVisible(hasEssence);
    if (hasEssence && this.essencesIcon) {
      this.essencesIcon.setFrame(DF_UI_ICON_FRAMES.essence);
    }
    this.essencesFallbackGraphic.setVisible(!hasEssence);
  }

  private drawResourceFallbackDiamond(
    gfx: Phaser.GameObjects.Graphics,
    color: number
  ): void {
    gfx.clear();
    gfx.fillStyle(color, 0.95);
    gfx.fillPoints(
      [
        { x: 0, y: -5 },
        { x: 5, y: 0 },
        { x: 0, y: 5 },
        { x: -5, y: 0 },
      ],
      true
    );
    gfx.lineStyle(1, DF_PALETTE.obsidianBg, 0.9);
    gfx.strokePoints(
      [
        { x: 0, y: -5 },
        { x: 5, y: 0 },
        { x: 0, y: 5 },
        { x: -5, y: 0 },
      ],
      true,
      true
    );
  }
}
