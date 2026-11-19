import Phaser from 'phaser';
import { Vector2D, ViewportConfig, resolveViewportConfig } from '../../core/index';
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
  fillColor: number;
  strokeColor: number;
  width: number;
  height: number;
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

const FONT_TITLE =
  "'Cinzel', 'Palatino Linotype', 'Book Antiqua', Georgia, serif";
const FONT_BODY =
  "'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif";

const UI_ICONS_KEY = 'ui_icons';

const ICON_FRAME = {
  ATTACK: 0,
  BAG: 6,
  AUDIO_ON: 8,
  AUDIO_OFF: 9,
  SOULS: 10,
  ESSENCE: 11,
} as const;

const PALETTE = {
  BG_DEEP: 0x0d0f16,
  BG_SURFACE: 0x161924,
  BORDER_BRONZE: 0x8a7048,
  BORDER_STEEL: 0x525a6e,
  CTA_FILL: 0x2b1215,
  INTERACT_FILL: 0x14241e,
  RESET_IDLE_FILL: 0x1b1115,
  RESET_IDLE_STROKE: 0x7f1d1d,
  RESET_ARMED_FILL: 0x7f1d1d,
  RESET_ARMED_STROKE: 0xef4444,
} as const;

export class HubHud {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: HubHudCallbacks;

  private viewport: ViewportConfig;
  private readonly joystick: VirtualJoystick;
  private movementKeys?: MovementKeys;
  private readonly keydownHandler: (event: KeyboardEvent) => void;

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
      scene.scale.width || 800,
      scene.scale.height || 600
    );

    const totalPointers = scene.input.manager?.pointersTotal ?? 2;
    if (totalPointers < 4) {
      scene.input.addPointer?.(4 - totalPointers);
    }

    this.joystick = new VirtualJoystick(scene);

    // Top HUD Bar
    this.topPanelBg = scene.add.graphics().setScrollFactor(0).setDepth(1010);

    this.locationText = scene.add
      .text(0, 0, 'Refúgio do Submundo', {
        fontFamily: FONT_TITLE,
        fontSize: '13px',
        color: '#f0c46c',
        fontStyle: 'bold',
        resolution: 2,
      })
      .setScrollFactor(0)
      .setDepth(1012);

    this.soulsIcon = this.hasTextureFrame(UI_ICONS_KEY, ICON_FRAME.SOULS)
      ? scene.add
          .image(0, 0, UI_ICONS_KEY, ICON_FRAME.SOULS)
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
        fontFamily: FONT_BODY,
        fontSize: '12px',
        color: '#90e0ef',
        fontStyle: 'bold',
        resolution: 2,
      })
      .setScrollFactor(0)
      .setDepth(1012);

    this.essencesIcon = this.hasTextureFrame(UI_ICONS_KEY, ICON_FRAME.ESSENCE)
      ? scene.add
          .image(0, 0, UI_ICONS_KEY, ICON_FRAME.ESSENCE)
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(1012)
      : null;

    this.essencesFallbackGraphic = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(1012);
    this.drawResourceFallbackDiamond(this.essencesFallbackGraphic, 0xf4a261);

    this.essencesText = scene.add
      .text(0, 0, 'Essências: 0', {
        fontFamily: FONT_BODY,
        fontSize: '12px',
        color: '#f4a261',
        fontStyle: 'bold',
        resolution: 2,
      })
      .setScrollFactor(0)
      .setDepth(1012);

    this.gearText = scene.add
      .text(0, 0, 'Equip: 0/6 | Baú: 0', {
        fontFamily: FONT_BODY,
        fontSize: '11px',
        color: '#cbd5e1',
        resolution: 2,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1012);

    // Banner
    this.bannerBg = scene.add.graphics();
    this.bannerLabel = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_BODY,
        fontSize: '11px',
        color: '#e9ecef',
        align: 'center',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);
    this.bannerContainer = scene.add
      .container(0, 0, [this.bannerBg, this.bannerLabel])
      .setScrollFactor(0)
      .setDepth(1014)
      .setVisible(false);

    // Action Buttons (Diablo Dark Fantasy metallic style)
    this.altarBtn = this.createActionButton(
      'Altar',
      PALETTE.BG_SURFACE,
      PALETTE.BORDER_STEEL,
      '#e2e8f0',
      () => this.callbacks.onOpenAltar()
    );
    this.blacksmithBtn = this.createActionButton(
      'Ferreiro',
      PALETTE.BG_SURFACE,
      PALETTE.BORDER_BRONZE,
      '#f5e6c8',
      () => this.callbacks.onOpenBlacksmith()
    );
    this.stashBtn = this.createActionButton(
      'Baú (0)',
      PALETTE.BG_SURFACE,
      PALETTE.BORDER_STEEL,
      '#e2e8f0',
      () => this.callbacks.onOpenStash(),
      ICON_FRAME.BAG
    );
    this.enterBtn = this.createActionButton(
      'Entrar na Fenda',
      PALETTE.CTA_FILL,
      PALETTE.BORDER_BRONZE,
      '#f8e7c2',
      () => this.callbacks.onEnterDungeon(),
      ICON_FRAME.ATTACK
    );
    this.interactBtn = this.createActionButton(
      'Interagir',
      PALETTE.INTERACT_FILL,
      PALETTE.BORDER_BRONZE,
      '#ecfdf5',
      () => this.callbacks.onInteract?.()
    );
    this.interactBtn.container.setVisible(false);

    this.stageBtn = this.createActionButton(
      'A Gruta da Cachoeira',
      PALETTE.BG_DEEP,
      PALETTE.BORDER_STEEL,
      '#e2e8f0',
      () => {
        if (this.lastSnapshot.canCycleStage) {
          this.callbacks.onCycleStage?.();
        }
      }
    );
    this.stageBtn.container.setVisible(false);

    this.muteBtn = this.createActionButton(
      'Som',
      PALETTE.BG_SURFACE,
      PALETTE.BORDER_STEEL,
      '#e2e8f0',
      () => this.callbacks.onToggleMute?.(),
      ICON_FRAME.AUDIO_ON
    );

    this.resetBtn = this.createActionButton(
      'Resetar',
      PALETTE.RESET_IDLE_FILL,
      PALETTE.RESET_IDLE_STROKE,
      '#fca5a5',
      () => this.handleResetClick()
    );

    // Movement Keys (WASD + Arrows)
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
    const locationTitle =
      snap.locationTitle?.trim() ||
      (isPrologue ? 'Vila Natal — Campo de Treino' : 'Refúgio do Submundo');

    this.locationText
      .setText(locationTitle)
      .setColor(isPrologue ? '#a7f3d0' : '#f0c46c');

    this.soulsText.setText(`Almas: ${snap.souls}`);
    this.essencesText.setText(`Essências: ${snap.generalEssences}`);
    this.syncResourceIcons();

    this.gearText.setText(`Equip: ${snap.equippedCount}/6 | Baú: ${snap.stashCount}`);
    this.stashBtn.label.setText(`Baú (${snap.stashCount})`);
    this.altarBtn.label.setText(isPrologue ? 'Santuário' : 'Altar');
    this.enterBtn.label.setText(
      isPrologue ? 'Iniciar Missão' : 'Entrar na Fenda'
    );
    this.syncButtonIconLayout(this.stashBtn);
    this.syncButtonIconLayout(this.enterBtn);

    const muted = Boolean(snap.isMuted);
    this.muteBtn.iconFrame = muted ? ICON_FRAME.AUDIO_OFF : ICON_FRAME.AUDIO_ON;
    this.muteBtn.label
      .setText(muted ? 'Mudo' : 'Som')
      .setColor(muted ? '#fca5a5' : '#e2e8f0');
    this.redrawButtonGraphics(
      this.muteBtn,
      muted ? PALETTE.BG_DEEP : PALETTE.BG_SURFACE,
      muted ? PALETTE.RESET_ARMED_STROKE : PALETTE.BORDER_STEEL
    );
    this.syncButtonIconLayout(this.muteBtn);

    const stageLabel = snap.stageLabel?.trim() ?? '';
    if (stageLabel.length > 0) {
      this.stageBtn.container.setVisible(true);
      const canCycle = Boolean(snap.canCycleStage);
      this.stageBtn.label
        .setText(canCycle ? `⇄ ${stageLabel}` : stageLabel)
        .setColor(canCycle ? '#f0c46c' : '#cbd5e1');
      this.redrawButtonGraphics(
        this.stageBtn,
        canCycle ? PALETTE.BG_SURFACE : PALETTE.BG_DEEP,
        canCycle ? PALETTE.BORDER_BRONZE : PALETTE.BORDER_STEEL
      );
    } else {
      this.stageBtn.container.setVisible(false);
    }

    const station = snap.nearbyStationLabel?.trim() ?? '';
    if (station.length > 0) {
      this.interactBtn.container.setVisible(true);
      const label =
        this.viewport.mode === 'mobile_portrait'
          ? `Interagir: ${station}`
          : `[E] Interagir: ${station}`;
      this.interactBtn.label.setText(label);
    } else {
      this.interactBtn.container.setVisible(false);
    }

    const banner = snap.bannerText?.trim() ?? '';
    if (banner.length > 0) {
      this.bannerContainer.setVisible(true);
      this.bannerLabel.setText(banner);
      this.drawBannerBox();
    } else {
      this.bannerContainer.setVisible(false);
    }
  }

  public resize(viewport: ViewportConfig): void {
    this.viewport = viewport;
    this.joystick.resize(viewport);

    const isMobile = viewport.mode === 'mobile_portrait';
    const w = viewport.width;
    const h = viewport.height;

    const topBarHeight = isMobile ? 64 : 52;
    this.topPanelBg.clear();
    this.topPanelBg.fillStyle(PALETTE.BG_DEEP, 0.92);
    this.topPanelBg.fillRect(0, 0, w, topBarHeight);
    this.topPanelBg.fillStyle(PALETTE.BG_SURFACE, 0.55);
    this.topPanelBg.fillRect(0, 0, w, isMobile ? 22 : 24);
    this.topPanelBg.lineStyle(1.5, PALETTE.BORDER_STEEL, 0.9);
    this.topPanelBg.lineBetween(0, topBarHeight - 2, w, topBarHeight - 2);
    this.topPanelBg.lineStyle(1, PALETTE.BORDER_BRONZE, 0.9);
    this.topPanelBg.lineBetween(0, topBarHeight, w, topBarHeight);

    if (isMobile) {
      this.locationText.setFontSize(11).setPosition(12, 6);

      this.soulsIcon?.setPosition(18, 33).setDisplaySize(14, 14);
      this.soulsFallbackGraphic.setPosition(18, 33);
      this.soulsText.setFontSize(11).setPosition(28, 27);

      this.essencesIcon?.setPosition(116, 33).setDisplaySize(14, 14);
      this.essencesFallbackGraphic.setPosition(116, 33);
      this.essencesText.setFontSize(11).setPosition(126, 27);

      this.gearText.setOrigin(0, 0).setFontSize(10).setPosition(12, 46);
      this.layoutButton(this.resetBtn, w - 107, 18, 72, 22, 10);
      this.layoutButton(this.muteBtn, w - 38, 18, 56, 22, 10);

      this.bannerContainer.setPosition(w / 2, 88);
      this.bannerLabel.setWordWrapWidth(w - 32);

      // Action cluster on bottom-right, clear of left VirtualJoystick (x: 36..128)
      this.layoutButton(this.interactBtn, w / 2, h - 224, 224, 36, 11);
      this.layoutButton(this.altarBtn, 208, h - 168, 84, 38, 11);
      this.layoutButton(this.blacksmithBtn, 302, h - 168, 90, 38, 11);
      this.layoutButton(this.stashBtn, 255, h - 122, 184, 36, 11);
      this.layoutButton(this.enterBtn, 255, h - 74, 184, 40, 12);
      this.layoutButton(this.stageBtn, 255, h - 32, 184, 28, 10);
    } else {
      this.locationText.setFontSize(12).setPosition(16, 16);

      this.soulsIcon?.setPosition(230, 23).setDisplaySize(16, 16);
      this.soulsFallbackGraphic.setPosition(230, 23);
      this.soulsText.setFontSize(12).setPosition(242, 17);

      this.essencesIcon?.setPosition(336, 23).setDisplaySize(16, 16);
      this.essencesFallbackGraphic.setPosition(336, 23);
      this.essencesText.setFontSize(12).setPosition(348, 17);

      this.gearText.setOrigin(1, 0).setFontSize(11).setPosition(w - 160, 18);
      this.layoutButton(this.resetBtn, w - 114, 26, 74, 26, 10);
      this.layoutButton(this.muteBtn, w - 42, 26, 58, 26, 10);

      this.bannerContainer.setPosition(w / 2, 78);
      this.bannerLabel.setWordWrapWidth(480);

      // Desktop bottom bar clear of left VirtualJoystick (x: 50..142)
      this.layoutButton(this.interactBtn, w / 2, h - 110, 240, 36, 12);
      this.layoutButton(this.altarBtn, 316, h - 48, 96, 42, 12);
      this.layoutButton(this.blacksmithBtn, 422, h - 48, 102, 42, 12);
      this.layoutButton(this.stashBtn, 530, h - 48, 98, 42, 12);
      this.layoutButton(this.enterBtn, 684, h - 48, 192, 46, 13);
      this.layoutButton(this.stageBtn, 684, h - 92, 192, 28, 10);
    }

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
  }

  private handleResetClick(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.resetBtn.label.setText('Confirmar?').setColor('#ffffff');
      this.redrawButtonGraphics(
        this.resetBtn,
        PALETTE.RESET_ARMED_FILL,
        PALETTE.RESET_ARMED_STROKE
      );

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
    this.resetBtn.label.setText('Resetar').setColor('#fca5a5');
    this.redrawButtonGraphics(
      this.resetBtn,
      PALETTE.RESET_IDLE_FILL,
      PALETTE.RESET_IDLE_STROKE
    );
  }

  private createActionButton(
    text: string,
    fillColor: number,
    strokeColor: number,
    textColor: string,
    onClick: () => void,
    iconFrame?: number
  ): ActionButtonView {
    const bg = this.scene.add.graphics();
    const icon =
      iconFrame !== undefined && this.hasTextureFrame(UI_ICONS_KEY, iconFrame)
        ? this.scene.add.image(0, 0, UI_ICONS_KEY, iconFrame).setOrigin(0.5)
        : null;

    const label = this.scene.add
      .text(0, 0, text, {
        fontFamily: FONT_BODY,
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

    zone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation?.();
        onClick();
      }
    );

    const children: Phaser.GameObjects.GameObject[] = [bg];
    if (icon) {
      children.push(icon);
    }
    children.push(label, zone);

    const container = this.scene.add
      .container(0, 0, children)
      .setScrollFactor(0)
      .setDepth(1020);

    return {
      container,
      bg,
      icon,
      iconFrame,
      label,
      zone,
      fillColor,
      strokeColor,
      width: 100,
      height: 40,
    };
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
    this.redrawButtonGraphics(btn, btn.fillColor, btn.strokeColor);
    this.syncButtonIconLayout(btn);
  }

  private syncButtonIconLayout(btn: ActionButtonView): void {
    if (!btn.icon || btn.iconFrame === undefined) {
      btn.label.setPosition(0, 0);
      return;
    }

    const available = this.hasTextureFrame(UI_ICONS_KEY, btn.iconFrame);
    btn.icon.setVisible(available);
    if (!available) {
      btn.label.setPosition(0, 0);
      return;
    }

    btn.icon.setFrame(btn.iconFrame);
    const iconSize = Math.max(12, Math.min(20, Math.round(btn.height * 0.52)));
    btn.icon.setDisplaySize(iconSize, iconSize);

    const textW = btn.label.width || 0;
    const gap = btn.width <= 64 ? 3 : 5;
    const totalW = iconSize + gap + textW;
    const maxW = btn.width - 10;

    if (totalW <= maxW) {
      const startX = -totalW / 2;
      btn.icon.setPosition(startX + iconSize / 2, 0);
      btn.label.setPosition(startX + iconSize + gap + textW / 2, 0);
    } else {
      btn.icon.setPosition(-btn.width / 2 + iconSize / 2 + 5, 0);
      btn.label.setPosition(iconSize / 2 + 2, 0);
    }
  }

  private redrawButtonGraphics(
    btn: ActionButtonView,
    fillColor: number,
    strokeColor: number
  ): void {
    btn.fillColor = fillColor;
    btn.strokeColor = strokeColor;
    btn.bg.clear();

    const bevel = Math.min(6, Math.round(btn.height * 0.24));
    const outerPts = this.getChamferPoints(
      -btn.width / 2,
      -btn.height / 2,
      btn.width,
      btn.height,
      bevel
    );
    const innerPts = this.getChamferPoints(
      -btn.width / 2 + 2,
      -btn.height / 2 + 2,
      Math.max(4, btn.width - 4),
      Math.max(4, btn.height - 4),
      Math.max(2, bevel - 1)
    );

    btn.bg.fillStyle(fillColor, 0.95);
    btn.bg.fillPoints(outerPts, true);
    btn.bg.lineStyle(1, PALETTE.BG_DEEP, 0.85);
    btn.bg.strokePoints(innerPts, true, true);
    btn.bg.lineStyle(1.8, strokeColor, 0.96);
    btn.bg.strokePoints(outerPts, true, true);
  }

  private drawBannerBox(): void {
    const isMobile = this.viewport.mode === 'mobile_portrait';
    const width = isMobile ? this.viewport.width - 20 : 500;
    const height = isMobile ? 38 : 32;
    const pts = this.getChamferPoints(-width / 2, -height / 2, width, height, 6);

    this.bannerBg.clear();
    this.bannerBg.fillStyle(PALETTE.BG_DEEP, 0.92);
    this.bannerBg.fillPoints(pts, true);
    this.bannerBg.lineStyle(1.4, PALETTE.BORDER_BRONZE, 0.92);
    this.bannerBg.strokePoints(pts, true, true);
  }

  private syncResourceIcons(): void {
    const hasSouls =
      this.soulsIcon !== null &&
      this.hasTextureFrame(UI_ICONS_KEY, ICON_FRAME.SOULS);
    this.soulsIcon?.setVisible(hasSouls);
    if (hasSouls && this.soulsIcon) {
      this.soulsIcon.setFrame(ICON_FRAME.SOULS);
    }
    this.soulsFallbackGraphic.setVisible(!hasSouls);

    const hasEssence =
      this.essencesIcon !== null &&
      this.hasTextureFrame(UI_ICONS_KEY, ICON_FRAME.ESSENCE);
    this.essencesIcon?.setVisible(hasEssence);
    if (hasEssence && this.essencesIcon) {
      this.essencesIcon.setFrame(ICON_FRAME.ESSENCE);
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
    gfx.lineStyle(1, PALETTE.BG_DEEP, 0.9);
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

  private hasTextureFrame(key: string, frame: number): boolean {
    if (!this.scene.textures?.exists(key)) {
      return false;
    }
    return this.scene.textures.get(key).has(String(frame));
  }

  private getChamferPoints(
    x: number,
    y: number,
    w: number,
    h: number,
    bevel: number
  ): Array<{ x: number; y: number }> {
    const b = Math.min(bevel, w * 0.35, h * 0.35);
    return [
      { x: x + b, y },
      { x: x + w - b, y },
      { x: x + w, y: y + b },
      { x: x + w, y: y + h - b },
      { x: x + w - b, y: y + h },
      { x: x + b, y: y + h },
      { x, y: y + h - b },
      { x, y: y + b },
    ];
  }
}
