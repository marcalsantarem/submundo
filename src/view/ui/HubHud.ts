import Phaser from 'phaser';
import { Vector2D, ViewportConfig, resolveViewportConfig } from '../../core/index';
import {
  DF_FONTS,
  DF_PALETTE,
  DF_UI_ICONS_KEY,
  DF_UI_ICON_FRAMES,
  type OrnateButtonVariant,
  drawOrnateButton,
  drawOrnatePanel,
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
      scene.scale.width || 960,
      scene.scale.height || 540
    );

    const totalPointers = scene.input.manager?.pointersTotal ?? 2;
    if (totalPointers < 4) {
      scene.input.addPointer?.(4 - totalPointers);
    }

    this.joystick = new VirtualJoystick(scene);

    // -------------------------------------------------------------------------
    // TOP BAR (960x540 Landscape)
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
    // ORNATE 2D CHAMFERED ACTION BUTTONS
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
    const locationTitle =
      snap.locationTitle?.trim() ||
      (isPrologue ? 'Vila Natal' : 'Refúgio do Submundo');

    this.locationText
      .setText(locationTitle)
      .setColor(isPrologue ? DF_PALETTE.textSuccess : DF_PALETTE.textGold);

    this.soulsText.setText(`Almas: ${snap.souls}`);
    this.essencesText.setText(`Essências: ${snap.generalEssences}`);
    this.syncResourceIcons();

    this.gearText.setText(
      `Equip: ${snap.equippedCount}/6 | Baú: ${snap.stashCount}`
    );
    this.stashBtn.label.setText(
      snap.stashCount > 0 ? `Inventário (${snap.stashCount})` : 'Inventário'
    );
    this.altarBtn.label.setText(isPrologue ? 'Santuário' : 'Altar');
    this.enterBtn.label.setText(
      isPrologue ? 'Iniciar Missão' : 'Entrar na Fenda'
    );
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

    const w = viewport.width;
    const h = viewport.height;

    // -------------------------------------------------------------------------
    // TOP BAR (54px height, 960x540 landscape)
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

    // Left: Area title in Cinzel
    this.locationText.setFontSize(14).setPosition(18, barMidY);

    // Center-Right: Souls, Essences, and Equip/Stash summary
    const resBaseX = Math.max(286, Math.round(w * 0.34));
    this.soulsIcon?.setPosition(resBaseX, barMidY).setDisplaySize(17, 17);
    this.soulsFallbackGraphic.setPosition(resBaseX, barMidY);
    this.soulsText.setFontSize(12).setPosition(resBaseX + 14, barMidY);

    const essBaseX = resBaseX + 142;
    this.essencesIcon?.setPosition(essBaseX, barMidY).setDisplaySize(17, 17);
    this.essencesFallbackGraphic.setPosition(essBaseX, barMidY);
    this.essencesText.setFontSize(12).setPosition(essBaseX + 14, barMidY);

    this.gearText.setFontSize(11).setPosition(w - 186, barMidY);

    // Top-Right: Audio & Reset buttons
    this.layoutButton(this.muteBtn, w - 132, barMidY, 78, 30, 11);
    this.layoutButton(this.resetBtn, w - 48, barMidY, 76, 30, 11);

    // Banner below top bar
    this.bannerContainer.setPosition(w / 2, 80);
    this.bannerLabel.setWordWrapWidth(Math.min(500, w - 64));

    // -------------------------------------------------------------------------
    // BOTTOM-RIGHT 2-HAND CLUSTER (Clear of left VirtualJoystick x <= 0.46*w)
    // -------------------------------------------------------------------------
    this.layoutButton(this.altarBtn, w - 352, h - 42, 100, 40, 12);
    this.layoutButton(this.blacksmithBtn, w - 244, h - 42, 100, 40, 12);
    this.layoutButton(this.enterBtn, w - 100, h - 42, 172, 44, 13);

    this.layoutButton(this.stashBtn, w - 298, h - 92, 208, 38, 12);
    this.layoutButton(this.stageBtn, w - 100, h - 92, 172, 38, 11);

    // Contextual Interact [E] button cleanly above the right-hand cluster
    this.layoutButton(this.interactBtn, w - 208, h - 140, 264, 36, 12);

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
      this.resetBtn.variant = 'crimson';
      this.redrawButtonGraphics(this.resetBtn);

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
