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
}

export class HubHud {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: HubHudCallbacks;

  private viewport: ViewportConfig;
  private readonly joystick: VirtualJoystick;
  private movementKeys?: MovementKeys;
  private readonly keydownHandler: (event: KeyboardEvent) => void;

  private readonly topPanelBg: Phaser.GameObjects.Graphics;
  private readonly locationText: Phaser.GameObjects.Text;
  private readonly soulsText: Phaser.GameObjects.Text;
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
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffd166',
        fontStyle: 'bold',
      })
      .setScrollFactor(0)
      .setDepth(1012);

    this.soulsText = scene.add
      .text(0, 0, 'Almas: 0', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#90e0ef',
        fontStyle: 'bold',
      })
      .setScrollFactor(0)
      .setDepth(1012);

    this.essencesText = scene.add
      .text(0, 0, 'Essências: 0', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f4a261',
        fontStyle: 'bold',
      })
      .setScrollFactor(0)
      .setDepth(1012);

    this.gearText = scene.add
      .text(0, 0, 'Equip: 0/4 | Baú: 0', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#cbd5e1',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1012);

    // Banner
    this.bannerBg = scene.add.graphics();
    this.bannerLabel = scene.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#e9ecef',
        align: 'center',
      })
      .setOrigin(0.5, 0.5);
    this.bannerContainer = scene.add
      .container(0, 0, [this.bannerBg, this.bannerLabel])
      .setScrollFactor(0)
      .setDepth(1014)
      .setVisible(false);

    // Action Buttons
    this.altarBtn = this.createActionButton(
      'Altar',
      0x16243a,
      0x48cae4,
      '#e0fbfc',
      () => this.callbacks.onOpenAltar()
    );
    this.blacksmithBtn = this.createActionButton(
      'Ferreiro',
      0x291a16,
      0xf48c06,
      '#fff1e6',
      () => this.callbacks.onOpenBlacksmith()
    );
    this.stashBtn = this.createActionButton(
      'Baú (0)',
      0x1a2035,
      0x38bdf8,
      '#e0f2fe',
      () => this.callbacks.onOpenStash()
    );
    this.enterBtn = this.createActionButton(
      'Entrar na Fenda',
      0x7f1d1d,
      0xffba08,
      '#ffffff',
      () => this.callbacks.onEnterDungeon()
    );
    this.interactBtn = this.createActionButton(
      'Interagir',
      0x1b4332,
      0x80ed99,
      '#ffffff',
      () => this.callbacks.onInteract?.()
    );
    this.interactBtn.container.setVisible(false);

    this.stageBtn = this.createActionButton(
      'A Gruta da Cachoeira',
      0x132238,
      0x64748b,
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
      0x0f172a,
      0x38bdf8,
      '#e0f2fe',
      () => this.callbacks.onToggleMute?.()
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
      .setColor(isPrologue ? '#a7f3d0' : '#ffd166');
    this.soulsText.setText(`Almas: ${snap.souls}`);
    this.essencesText.setText(`Essências: ${snap.generalEssences}`);
    this.gearText.setText(`Equip: ${snap.equippedCount}/4 | Baú: ${snap.stashCount}`);
    this.stashBtn.label.setText(`Baú (${snap.stashCount})`);
    this.altarBtn.label.setText(isPrologue ? 'Santuário' : 'Altar');
    this.enterBtn.label.setText(
      isPrologue ? 'Iniciar Missão' : 'Entrar na Fenda'
    );

    const muted = Boolean(snap.isMuted);
    this.muteBtn.label
      .setText(muted ? 'Mudo' : 'Som')
      .setColor(muted ? '#fca5a5' : '#e0f2fe');
    this.redrawButtonGraphics(
      this.muteBtn,
      muted ? 0x1f2937 : 0x0f172a,
      muted ? 0xef4444 : 0x38bdf8
    );

    const stageLabel = snap.stageLabel?.trim() ?? '';
    if (stageLabel.length > 0) {
      this.stageBtn.container.setVisible(true);
      const canCycle = Boolean(snap.canCycleStage);
      this.stageBtn.label
        .setText(canCycle ? `⇄ ${stageLabel}` : stageLabel)
        .setColor(canCycle ? '#fde68a' : '#cbd5e1');
      this.redrawButtonGraphics(
        this.stageBtn,
        canCycle ? 0x1e293b : 0x111827,
        canCycle ? 0xfbbf24 : 0x475569
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
    this.topPanelBg.fillStyle(0x090c14, 0.85);
    this.topPanelBg.fillRect(0, 0, w, topBarHeight);
    this.topPanelBg.lineStyle(1, 0x2b3448, 0.9);
    this.topPanelBg.lineBetween(0, topBarHeight, w, topBarHeight);

    if (isMobile) {
      this.locationText.setFontSize(11).setPosition(12, 8);
      this.soulsText.setFontSize(11).setPosition(12, 27);
      this.essencesText.setFontSize(11).setPosition(112, 27);
      this.gearText.setOrigin(0, 0).setFontSize(10).setPosition(12, 45);
      this.layoutButton(this.muteBtn, w - 38, 18, 54, 22, 10);

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
      this.soulsText.setFontSize(12).setPosition(236, 17);
      this.essencesText.setFontSize(12).setPosition(340, 17);
      this.gearText.setOrigin(1, 0).setFontSize(11).setPosition(w - 82, 18);
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
    this.scene.input.keyboard?.off('keydown', this.keydownHandler);
    this.joystick.destroy();

    this.topPanelBg.destroy();
    this.locationText.destroy();
    this.soulsText.destroy();
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
  }

  private createActionButton(
    text: string,
    fillColor: number,
    strokeColor: number,
    textColor: string,
    onClick: () => void
  ): ActionButtonView {
    const bg = this.scene.add.graphics();
    const label = this.scene.add
      .text(0, 0, text, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: textColor,
        fontStyle: 'bold',
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

    const container = this.scene.add
      .container(0, 0, [bg, label, zone])
      .setScrollFactor(0)
      .setDepth(1020);

    return {
      container,
      bg,
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
  }

  private redrawButtonGraphics(
    btn: ActionButtonView,
    fillColor: number,
    strokeColor: number
  ): void {
    btn.fillColor = fillColor;
    btn.strokeColor = strokeColor;
    btn.bg.clear();
    btn.bg.fillStyle(fillColor, 0.94);
    btn.bg.fillRoundedRect(-btn.width / 2, -btn.height / 2, btn.width, btn.height, 6);
    btn.bg.lineStyle(1.8, strokeColor, 0.95);
    btn.bg.strokeRoundedRect(-btn.width / 2, -btn.height / 2, btn.width, btn.height, 6);
  }

  private drawBannerBox(): void {
    const isMobile = this.viewport.mode === 'mobile_portrait';
    const width = isMobile ? this.viewport.width - 20 : 500;
    const height = isMobile ? 38 : 32;

    this.bannerBg.clear();
    this.bannerBg.fillStyle(0x0b0f19, 0.86);
    this.bannerBg.fillRoundedRect(-width / 2, -height / 2, width, height, 5);
    this.bannerBg.lineStyle(1, 0x48cae4, 0.7);
    this.bannerBg.strokeRoundedRect(-width / 2, -height / 2, width, height, 5);
  }
}
