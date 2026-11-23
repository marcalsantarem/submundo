import Phaser from 'phaser';
import { resolveViewportConfig, type Vector2D, type ViewportConfig } from '../../core/index';
import {
  DF_FONTS,
  DF_PALETTE,
  DF_UI_ICONS_KEY,
  DF_UI_ICON_FRAMES,
  drawOrnateButton,
  drawOrnatePanel,
  hasUiTextureFrame,
} from './DarkFantasyUiBuilder';
import { VirtualJoystick } from './VirtualJoystick';

/** Estado da HUD da Vila Natal (T-139). */
export interface VillageHudSnapshot {
  heroName: string;
  heroLevel: number;
  hp: number;
  maxHp: number;
  objectiveText: string;
  /** Alvo de interação ao alcance (NPC ou portão). */
  interactLabel?: string;
  isMuted: boolean;
  bannerText?: string;
  minimap: {
    mapWidth: number;
    mapTop: number;
    mapBottom: number;
    hero: Vector2D;
    heroFacingX: number;
    gate: Vector2D;
    house: Vector2D;
    campfire: Vector2D;
    npcs: Array<{ id: string; pos: Vector2D; alert: boolean }>;
  };
}

export interface VillageHudCallbacks {
  onInteract: () => void;
  onOpenInventory: () => void;
  onToggleMute: () => void;
  onResetSave: () => void;
}

interface MovementKeys {
  keys: Phaser.Input.Keyboard.Key[];
  up: Phaser.Input.Keyboard.Key[];
  down: Phaser.Input.Keyboard.Key[];
  left: Phaser.Input.Keyboard.Key[];
  right: Phaser.Input.Keyboard.Key[];
}

interface UtilityButton {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image | null;
  label: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
}

const PORTRAITS_KEY = 'portraits';
const UI_DEPTH = 1010;
const PORTRAIT = { cx: 46, cy: 44, r: 32 };
const BAR = { x: 86, y: 30, w: 188, h: 18 };
const MINIMAP_R = 46;
const UTIL_R = 18;
const INTERACT_R = 42;

/**
 * HUD da Vila: retrato e vida, tracker da missão, minimapa, joystick,
 * botão "Interagir" (tecla E), Inventário, Áudio e Configurações.
 * Sem AUTO, skills, poções, esquiva, moedas, Loja, Passe ou chat (decisão #23).
 */
export class VillageHud {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: VillageHudCallbacks;
  private viewport: ViewportConfig;
  private readonly joystick: VirtualJoystick;
  private movementKeys?: MovementKeys;
  private readonly keydownHandler: (event: KeyboardEvent) => void;
  private readonly all: Phaser.GameObjects.GameObject[] = [];

  private readonly portraitBg: Phaser.GameObjects.Graphics;
  private readonly portraitSprite: Phaser.GameObjects.Image | null;
  private readonly portraitMask: Phaser.GameObjects.Graphics | null;
  private readonly portraitRing: Phaser.GameObjects.Graphics;
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly hpBar: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;

  private readonly trackerGfx: Phaser.GameObjects.Graphics;
  private readonly trackerTitle: Phaser.GameObjects.Text;
  private readonly trackerText: Phaser.GameObjects.Text;

  private readonly minimapBg: Phaser.GameObjects.Graphics;
  private readonly minimapDots: Phaser.GameObjects.Graphics;
  private readonly minimapNorth: Phaser.GameObjects.Text;
  private readonly minimapAlert: Phaser.GameObjects.Text;

  private readonly bagBtn: UtilityButton;
  private readonly muteBtn: UtilityButton;
  private readonly configBtn: UtilityButton;

  private readonly interactContainer: Phaser.GameObjects.Container;
  private readonly interactGfx: Phaser.GameObjects.Graphics;
  private readonly interactLabel: Phaser.GameObjects.Text;
  private readonly interactKeyText: Phaser.GameObjects.Text;
  private readonly interactZone: Phaser.GameObjects.Zone;
  private interactPressed = false;

  private readonly bannerContainer: Phaser.GameObjects.Container;
  private readonly bannerBg: Phaser.GameObjects.Graphics;
  private readonly bannerLabel: Phaser.GameObjects.Text;

  private readonly configContainer: Phaser.GameObjects.Container;
  private readonly configBg: Phaser.GameObjects.Graphics;
  private readonly resetBtnBg: Phaser.GameObjects.Graphics;
  private readonly resetBtnText: Phaser.GameObjects.Text;
  private readonly closeBtnBg: Phaser.GameObjects.Graphics;
  private configOpen = false;
  private resetArmed = false;
  private resetTimer?: ReturnType<typeof setTimeout>;

  private snapshot?: VillageHudSnapshot;
  private lastHpKey = '';

  constructor(scene: Phaser.Scene, callbacks: VillageHudCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.viewport = resolveViewportConfig(scene.scale.width || 960, scene.scale.height || 540);

    const totalPointers = scene.input.manager?.pointersTotal ?? 2;
    if (totalPointers < 4) {
      scene.input.addPointer?.(4 - totalPointers);
    }
    this.joystick = new VirtualJoystick(scene);

    // --- Retrato + vida -------------------------------------------------------
    this.portraitBg = this.track(scene.add.graphics());
    this.portraitSprite = hasUiTextureFrame(scene, PORTRAITS_KEY, 0)
      ? this.track(scene.add.image(PORTRAIT.cx, PORTRAIT.cy + 1, PORTRAITS_KEY, 0))
      : null;
    this.portraitMask =
      this.portraitSprite && typeof scene.make?.graphics === 'function'
        ? scene.make.graphics({}, false)
        : null;
    if (this.portraitSprite && this.portraitMask) {
      this.portraitMask.fillStyle(0xffffff, 1);
      this.portraitMask.fillCircle(PORTRAIT.cx, PORTRAIT.cy, PORTRAIT.r - 2);
      this.portraitSprite.setMask(this.portraitMask.createGeometryMask());
      const size = (PORTRAIT.r - 1) * 2;
      this.portraitSprite.setDisplaySize(size, size);
    }
    this.portraitRing = this.track(scene.add.graphics());
    this.levelText = this.track(
      this.text(PORTRAIT.cx, PORTRAIT.cy + PORTRAIT.r + 1, 'Nv. 1', 10.5, DF_PALETTE.textGold, true)
    ).setOrigin(0.5);
    this.nameText = this.track(
      scene.add.text(88, 17, '', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '12.5px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        stroke: '#05070c',
        strokeThickness: 3,
        resolution: 2,
      })
    ).setOrigin(0, 0.5);
    this.hpBar = this.track(scene.add.graphics());
    this.hpText = this.track(
      this.text(BAR.x + BAR.w * 0.46, BAR.y + BAR.h / 2, '', 11, '#fff7ed', true)
    ).setOrigin(0.5);

    // --- Tracker da missão ----------------------------------------------------
    this.trackerGfx = this.track(scene.add.graphics());
    this.trackerTitle = this.track(
      scene.add.text(40, 104, 'VILA NATAL', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '13px',
        color: DF_PALETTE.textGold,
        fontStyle: 'bold',
        stroke: '#05070c',
        strokeThickness: 3,
        resolution: 2,
      })
    ).setOrigin(0, 0.5);
    this.trackerText = this.track(this.text(40, 120, '', 12, DF_PALETTE.textParchment, false)).setOrigin(
      0,
      0.5
    );

    // --- Minimapa -------------------------------------------------------------
    this.minimapBg = this.track(scene.add.graphics());
    this.minimapDots = this.track(scene.add.graphics());
    this.minimapNorth = this.track(this.text(0, 0, 'N', 8, DF_PALETTE.textGold, true)).setOrigin(0.5);
    this.minimapAlert = this.track(this.text(0, 0, '!', 9, '#facc15', true)).setOrigin(0.5);

    // --- Utilitários ----------------------------------------------------------
    this.bagBtn = this.createUtilityButton('Inventário', DF_UI_ICON_FRAMES.bag, DF_PALETTE.agedGold, () =>
      this.callbacks.onOpenInventory()
    );
    this.muteBtn = this.createUtilityButton('Áudio', DF_UI_ICON_FRAMES.audioOn, DF_PALETTE.bronzeBorder, () =>
      this.callbacks.onToggleMute()
    );
    this.configBtn = this.createUtilityButton(
      'Config.',
      DF_UI_ICON_FRAMES.settings,
      DF_PALETTE.bronzeBorder,
      () => this.toggleConfig()
    );

    // --- Botão Interagir (no lugar do Ataque) ---------------------------------
    this.interactGfx = scene.add.graphics();
    this.interactLabel = this.text(0, 22, 'INTERAGIR', 12.5, DF_PALETTE.textParchment, true, true).setOrigin(
      0.5
    );
    this.interactKeyText = this.text(INTERACT_R - 6, -INTERACT_R + 8, 'E', 10, DF_PALETTE.textGold, true).setOrigin(
      0.5
    );
    this.interactZone = scene.add
      .zone(0, 0, INTERACT_R * 2 + 12, INTERACT_R * 2 + 12)
      .setInteractive({ useHandCursor: true });
    this.interactZone.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, event?: Phaser.Types.Input.EventData) => {
        event?.stopPropagation?.();
        this.interactPressed = true;
        this.drawInteractButton();
        this.callbacks.onInteract();
      }
    );
    const release = () => {
      this.interactPressed = false;
      this.drawInteractButton();
    };
    this.interactZone.on('pointerup', release);
    this.interactZone.on('pointerout', release);
    this.interactContainer = this.track(
      scene.add.container(0, 0, [this.interactGfx, this.interactLabel, this.interactKeyText, this.interactZone])
    );

    // --- Banner ---------------------------------------------------------------
    this.bannerBg = scene.add.graphics();
    this.bannerLabel = this.text(0, 0, '', 11, DF_PALETTE.textParchment, false)
      .setOrigin(0.5)
      .setAlign('center')
      .setWordWrapWidth(440);
    this.bannerContainer = this.track(scene.add.container(0, 0, [this.bannerBg, this.bannerLabel])).setVisible(
      false
    );

    // --- Configurações (popover) ---------------------------------------------
    this.configBg = scene.add.graphics();
    const configTitle = this.text(0, -46, 'Configurações', 14, DF_PALETTE.textGold, true, true).setOrigin(0.5);
    this.resetBtnBg = scene.add.graphics();
    this.resetBtnText = this.text(0, -6, 'Resetar progresso', 12, DF_PALETTE.textDanger, true).setOrigin(0.5);
    const resetZone = scene.add.zone(0, -6, 200, 34).setInteractive({ useHandCursor: true });
    resetZone.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, event?: Phaser.Types.Input.EventData) => {
        event?.stopPropagation?.();
        this.handleResetClick();
      }
    );
    this.closeBtnBg = scene.add.graphics();
    const closeText = this.text(0, 36, 'Fechar', 12, DF_PALETTE.textLight, true).setOrigin(0.5);
    const closeZone = scene.add.zone(0, 36, 140, 30).setInteractive({ useHandCursor: true });
    closeZone.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, event?: Phaser.Types.Input.EventData) => {
        event?.stopPropagation?.();
        this.setConfigOpen(false);
      }
    );
    const blocker = scene.add.zone(0, 0, 260, 130).setInteractive();
    blocker.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, event?: Phaser.Types.Input.EventData) => {
        event?.stopPropagation?.();
      }
    );
    this.configContainer = this.track(
      scene.add.container(0, 0, [
        blocker,
        this.configBg,
        configTitle,
        this.resetBtnBg,
        this.resetBtnText,
        resetZone,
        this.closeBtnBg,
        closeText,
        closeZone,
      ])
    )
      .setDepth(UI_DEPTH + 40)
      .setVisible(false);
    this.drawConfigPanel();

    // --- Teclado --------------------------------------------------------------
    const kb = scene.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      const add = (code: number) => kb.addKey(code, false);
      const up = [add(K.UP), add(K.W)];
      const down = [add(K.DOWN), add(K.S)];
      const left = [add(K.LEFT), add(K.A)];
      const right = [add(K.RIGHT), add(K.D)];
      this.movementKeys = { keys: [...up, ...down, ...left, ...right], up, down, left, right };
    }
    this.keydownHandler = (event: KeyboardEvent) => {
      if (event.code === 'KeyE' && !event.repeat) {
        this.callbacks.onInteract();
      } else if (event.code === 'Escape' && this.configOpen) {
        this.setConfigOpen(false);
      }
    };
    kb?.on('keydown', this.keydownHandler);

    for (const obj of this.all) {
      const o = obj as unknown as { setScrollFactor?: (v: number) => void; depth: number; setDepth: (d: number) => void };
      o.setScrollFactor?.(0);
      if (o.depth < UI_DEPTH) {
        o.setDepth(UI_DEPTH + 2);
      }
    }
    this.interactContainer.setDepth(UI_DEPTH + 6);
    this.bannerContainer.setDepth(UI_DEPTH + 8);

    this.resize(this.viewport);
  }

  public isConfigOpen(): boolean {
    return this.configOpen;
  }

  public getMoveVector(): Vector2D {
    let vx = 0;
    let vy = 0;
    const down = (list: Phaser.Input.Keyboard.Key[]) => list.some((k) => k.isDown);
    if (this.movementKeys) {
      if (down(this.movementKeys.left)) vx -= 1;
      if (down(this.movementKeys.right)) vx += 1;
      if (down(this.movementKeys.up)) vy -= 1;
      if (down(this.movementKeys.down)) vy += 1;
    }
    const joy = this.joystick.getDirection();
    vx += joy.x;
    vy += joy.y;
    const len = Math.hypot(vx, vy);
    return len === 0 ? { x: 0, y: 0 } : { x: vx / len, y: vy / len };
  }

  public update(snap: VillageHudSnapshot): void {
    const prev = this.snapshot;
    this.snapshot = snap;

    this.nameText.setText(snap.heroName.toUpperCase());
    this.levelText.setText(`Nv. ${Math.max(1, Math.floor(snap.heroLevel))}`);
    const hpKey = `${snap.hp}/${snap.maxHp}`;
    if (hpKey !== this.lastHpKey) {
      this.lastHpKey = hpKey;
      this.hpText.setText(`${Math.ceil(snap.hp)}/${Math.ceil(snap.maxHp)}`);
      this.drawHpBar(snap.maxHp > 0 ? snap.hp / snap.maxHp : 0);
    }

    if (this.trackerText.text !== snap.objectiveText) {
      this.trackerText.setText(snap.objectiveText);
      this.drawTracker();
    }

    const muted = snap.isMuted;
    if (!prev || prev.isMuted !== muted) {
      if (this.muteBtn.icon) {
        const frame = muted ? DF_UI_ICON_FRAMES.audioOff : DF_UI_ICON_FRAMES.audioOn;
        if (hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, frame)) {
          this.muteBtn.icon.setFrame(frame).setDisplaySize(20, 20);
        }
      }
      this.muteBtn.label.setText(muted ? 'Mudo' : 'Áudio');
      this.muteBtn.label.setColor(muted ? DF_PALETTE.textDanger : DF_PALETTE.textMuted);
    }

    if (!prev || prev.interactLabel !== snap.interactLabel) {
      this.drawInteractButton();
    }

    const banner = snap.bannerText?.trim() ?? '';
    if (banner.length > 0) {
      if (this.bannerLabel.text !== banner || !this.bannerContainer.visible) {
        this.bannerLabel.setText(banner);
        this.drawBanner();
      }
      this.bannerContainer.setVisible(true);
    } else {
      this.bannerContainer.setVisible(false);
    }

    this.drawMinimapDots(snap);
  }

  public resize(viewport: ViewportConfig): void {
    this.viewport = viewport;
    this.joystick.resize(viewport);
    const w = viewport.width;
    const h = viewport.height;

    this.drawPortraitFrame();
    this.drawHpBar(1);
    this.lastHpKey = '';
    this.drawTracker();

    const mx = w - 60;
    const my = 60;
    this.minimapBg.setPosition(mx, my);
    this.minimapDots.setPosition(mx, my);
    this.minimapNorth.setPosition(mx, my - MINIMAP_R + 8);
    this.drawMinimapShell();

    const rowY = 128;
    const right = w - 30;
    const gap = 48;
    this.bagBtn.container.setPosition(right - gap * 2, rowY);
    this.muteBtn.container.setPosition(right - gap, rowY);
    this.configBtn.container.setPosition(right, rowY);

    this.interactContainer.setPosition(w - 92, h - 104);
    this.drawInteractButton();

    this.bannerContainer.setPosition(w / 2, 34);
    this.configContainer.setPosition(w / 2, h / 2);
    if (this.snapshot) {
      this.update(this.snapshot);
    }
  }

  public destroy(): void {
    if (this.resetTimer !== undefined) {
      clearTimeout(this.resetTimer);
    }
    this.scene.input.keyboard?.off('keydown', this.keydownHandler);
    if (this.movementKeys) {
      for (const k of this.movementKeys.keys) {
        this.scene.input.keyboard?.removeKey(k);
      }
    }
    this.joystick.destroy();
    this.portraitMask?.destroy();
    for (const obj of this.all) {
      obj.destroy();
    }
    this.all.length = 0;
  }

  // ---------------------------------------------------------------------------

  private track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.all.push(obj);
    return obj;
  }

  private text(
    x: number,
    y: number,
    value: string,
    size: number,
    color: string,
    bold: boolean,
    title = false
  ): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, value, {
      fontFamily: title ? DF_FONTS.TITLE : DF_FONTS.BODY,
      fontSize: `${size}px`,
      color,
      fontStyle: bold ? 'bold' : 'normal',
      stroke: '#05070c',
      strokeThickness: 3,
      resolution: 2,
    });
  }

  private createUtilityButton(
    label: string,
    iconFrame: number,
    ringColor: number,
    onClick: () => void
  ): UtilityButton {
    const scene = this.scene;
    const bg = scene.add.graphics();
    const draw = (pressed: boolean) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.45);
      bg.fillCircle(0, 2, UTIL_R + 3);
      bg.fillStyle(pressed ? 0x262b38 : DF_PALETTE.innerSurface, 0.95);
      bg.fillCircle(0, 0, UTIL_R);
      bg.fillStyle(0x2a3142, 0.5);
      bg.fillCircle(0, -4, UTIL_R - 6);
      bg.lineStyle(3, DF_PALETTE.metalDark, 1);
      bg.strokeCircle(0, 0, UTIL_R + 1.4);
      bg.lineStyle(2, ringColor, 0.98);
      bg.strokeCircle(0, 0, UTIL_R);
    };
    draw(false);
    const icon = hasUiTextureFrame(scene, DF_UI_ICONS_KEY, iconFrame)
      ? scene.add.image(0, 0, DF_UI_ICONS_KEY, iconFrame).setDisplaySize(20, 20)
      : null;
    const text = this.text(0, UTIL_R + 9, label, 9, DF_PALETTE.textMuted, false).setOrigin(0.5);
    const zone = scene.add.zone(0, 0, UTIL_R * 2 + 10, UTIL_R * 2 + 10).setInteractive({ useHandCursor: true });
    zone.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, event?: Phaser.Types.Input.EventData) => {
        event?.stopPropagation?.();
        draw(true);
        onClick();
      }
    );
    zone.on('pointerup', () => draw(false));
    zone.on('pointerout', () => draw(false));
    const children: Phaser.GameObjects.GameObject[] = [bg];
    if (icon) children.push(icon);
    children.push(text, zone);
    const container = this.track(scene.add.container(0, 0, children));
    return { container, bg, icon, label: text, zone };
  }

  private drawPortraitFrame(): void {
    const { cx, cy, r } = PORTRAIT;
    const g = this.portraitBg;
    g.clear();
    g.fillStyle(0x000000, 0.5);
    g.fillCircle(cx, cy + 2, r + 3);
    g.fillStyle(DF_PALETTE.deepRecess, 0.96);
    g.fillCircle(cx, cy, r);

    const ring = this.portraitRing;
    ring.clear();
    ring.lineStyle(3.5, DF_PALETTE.metalDark, 1);
    ring.strokeCircle(cx, cy, r + 1.5);
    ring.lineStyle(2.2, DF_PALETTE.bronzeBorder, 0.98);
    ring.strokeCircle(cx, cy, r);
    ring.lineStyle(1, DF_PALETTE.agedGold, 0.75);
    ring.strokeCircle(cx, cy, r - 2);
    ring.fillStyle(DF_PALETTE.agedGold, 0.96);
    for (const [dx, dy] of [[0, -r], [r, 0], [-r, 0]]) {
      ring.fillCircle(cx + dx, cy + dy, 2);
    }
    const bw = 46;
    const bh = 15;
    const by = cy + r + 1;
    ring.fillStyle(DF_PALETTE.obsidianBg, 0.96);
    ring.fillRoundedRect(cx - bw / 2, by - bh / 2, bw, bh, 4);
    ring.lineStyle(1.3, DF_PALETTE.agedGold, 0.95);
    ring.strokeRoundedRect(cx - bw / 2, by - bh / 2, bw, bh, 4);
  }

  private chamfer(x: number, y: number, w: number, h: number, c: number): Phaser.Types.Math.Vector2Like[] {
    return [
      { x: x + c, y },
      { x: x + w, y },
      { x: x + w - c, y: y + h },
      { x, y: y + h },
    ];
  }

  private drawHpBar(ratio: number): void {
    const g = this.hpBar;
    const { x, y, w, h } = BAR;
    const r = Phaser.Math.Clamp(ratio, 0, 1);
    g.clear();
    g.fillStyle(0x07090e, 0.95);
    g.fillPoints(this.chamfer(x, y, w, h, 9), true);
    if (r > 0) {
      const fw = Math.max(10, (w - 2) * r);
      g.fillStyle(0xb91c1c, 0.98);
      g.fillPoints(this.chamfer(x + 1, y + 1, fw, h - 2, 9), true);
      g.fillStyle(0xef4444, 0.55);
      g.fillPoints(this.chamfer(x + 2, y + 2, Math.max(6, fw - 4), 6, 4), true);
    }
    g.lineStyle(1.6, DF_PALETTE.bronzeBorder, 0.98);
    g.strokePoints(this.chamfer(x, y, w, h, 9), true, true);
    g.lineStyle(1, DF_PALETTE.metalDark, 0.92);
    g.strokePoints(this.chamfer(x - 1, y - 1, w + 2, h + 2, 9), true, true);
  }

  private drawTracker(): void {
    const g = this.trackerGfx;
    const dx = 26;
    const dy = 104;
    g.clear();
    const diamond = (r: number) => [
      { x: dx, y: dy - r },
      { x: dx + r, y: dy },
      { x: dx, y: dy + r },
      { x: dx - r, y: dy },
    ];
    g.fillStyle(DF_PALETTE.agedGold, 0.96);
    g.fillPoints(diamond(6.2), true);
    g.fillStyle(DF_PALETTE.bronzeDark, 0.95);
    g.fillPoints(diamond(5), true);
    g.fillStyle(DF_PALETTE.goldBright, 0.98);
    g.fillPoints(diamond(3), true);
    const lineY = 138;
    g.lineStyle(1, DF_PALETTE.bronzeBorder, 0.5);
    g.lineBetween(16, lineY, 220, lineY);
    g.lineStyle(1, DF_PALETTE.agedGold, 0.55);
    g.lineBetween(16, lineY, 72, lineY);
  }

  private drawMinimapShell(): void {
    const g = this.minimapBg;
    const r = MINIMAP_R;
    g.clear();
    g.fillStyle(0x000000, 0.5);
    g.fillCircle(0, 2, r + 4);
    g.fillStyle(0x0a101a, 0.94);
    g.fillCircle(0, 0, r);
    g.lineStyle(3.5, DF_PALETTE.metalDark, 1);
    g.strokeCircle(0, 0, r + 1.5);
    g.lineStyle(2.2, DF_PALETTE.bronzeBorder, 0.98);
    g.strokeCircle(0, 0, r);
    g.lineStyle(1, DF_PALETTE.agedGold, 0.6);
    g.strokeCircle(0, 0, r - 2);
    g.fillStyle(DF_PALETTE.agedGold, 0.96);
    for (const a of [0, 90, 180, 270]) {
      const rad = Phaser.Math.DegToRad(a);
      g.fillCircle(Math.cos(rad) * r, Math.sin(rad) * r, 2);
    }
  }

  private drawMinimapDots(snap: VillageHudSnapshot): void {
    const m = snap.minimap;
    const g = this.minimapDots;
    const sx0 = -34;
    const sy0 = -15;
    const sw = 68;
    const sh = 30;
    const top = m.mapTop - 44;
    const map = (p: Vector2D) => ({
      x: sx0 + (p.x / m.mapWidth) * sw,
      y: sy0 + ((p.y - top) / (m.mapBottom - top)) * sh,
    });
    g.clear();
    g.fillStyle(0x342e28, 0.9);
    g.fillRect(sx0, sy0, sw, sh);
    g.lineStyle(1, 0x786040, 0.9);
    g.strokeRect(sx0, sy0, sw, sh);

    const gate = map(m.gate);
    g.fillStyle(0x463e34, 0.95);
    g.fillRect(gate.x - 3, gate.y - 9, 6, 9);
    g.fillStyle(0x94a3b8, 0.8);
    g.fillTriangle(gate.x - 4, gate.y - 1, gate.x + 4, gate.y - 1, gate.x, gate.y - 5);
    const house = map(m.house);
    g.fillStyle(0xaa8c50, 0.9);
    g.fillRect(house.x - 5, house.y - 3, 10, 4);
    const fire = map(m.campfire);
    g.fillStyle(0xf97316, 1);
    g.fillCircle(fire.x, fire.y, 1.8);

    let alertPos: { x: number; y: number } | null = null;
    for (const npc of m.npcs) {
      const p = map(npc.pos);
      if (npc.alert) {
        g.fillStyle(0xfacc15, 1);
        g.fillCircle(p.x, p.y, 2.6);
        alertPos = p;
      } else {
        g.fillStyle(0x86efac, 0.95);
        g.fillCircle(p.x, p.y, 1.8);
      }
    }
    const hp = map(m.hero);
    const f = m.heroFacingX < 0 ? -1 : 1;
    g.fillStyle(0x38bdf8, 1);
    g.fillTriangle(hp.x + 4 * f, hp.y, hp.x - 3 * f, hp.y - 3.5, hp.x - 3 * f, hp.y + 3.5);

    if (alertPos) {
      this.minimapAlert
        .setVisible(true)
        .setPosition(this.minimapDots.x + alertPos.x, this.minimapDots.y + alertPos.y - 7);
    } else {
      this.minimapAlert.setVisible(false);
    }
  }

  private drawInteractButton(): void {
    const g = this.interactGfx;
    const r = INTERACT_R;
    const active = Boolean(this.snapshot?.interactLabel);
    const pressed = this.interactPressed && active;
    g.clear();
    if (active) {
      g.fillStyle(0xf97316, 0.14);
      g.fillCircle(0, 0, r + 12);
    }
    g.fillStyle(0x000000, 0.5);
    g.fillCircle(0, 3, r + 4);
    g.fillStyle(pressed ? 0x2a0f0b : 0x180b09, 0.96);
    g.fillCircle(0, 0, r);
    g.fillStyle(0x5f1b0d, active ? 0.7 : 0.35);
    g.fillCircle(0, 0, r - 4);
    g.fillStyle(0x9a3412, active ? 0.3 : 0.12);
    g.fillCircle(0, 6, r - 10);
    g.lineStyle(3.8, DF_PALETTE.metalDark, 0.98);
    g.strokeCircle(0, 0, r + 2);
    g.lineStyle(2.6, active ? 0xe0763a : 0x7c5a44, 0.98);
    g.strokeCircle(0, 0, r);
    g.lineStyle(1.2, DF_PALETTE.agedGold, active ? 0.8 : 0.35);
    g.strokeCircle(0, 0, r - 3);

    // Balão de fala.
    const cx = 0;
    const cy = -9;
    const a = active ? 0.97 : 0.5;
    g.fillStyle(0x3c2e28, 0.9 * a);
    g.fillRoundedRect(cx - 15, cy - 11, 30, 20, 6);
    g.fillStyle(0xf3e6cc, a);
    g.fillRoundedRect(cx - 14, cy - 12, 28, 19, 6);
    g.fillTriangle(cx - 7, cy + 5, cx - 1, cy + 5, cx - 9, cy + 13);
    g.fillStyle(0x5c3828, a);
    for (const k of [-1, 0, 1]) {
      g.fillCircle(cx + k * 7, cy - 2.5, 2.2);
    }

    // Selo da tecla E.
    g.fillStyle(DF_PALETTE.obsidianBg, 0.95);
    g.fillCircle(r - 6, -r + 8, 9);
    g.lineStyle(1.3, DF_PALETTE.agedGold, 0.9);
    g.strokeCircle(r - 6, -r + 8, 9);

    this.interactLabel.setAlpha(active ? 1 : 0.6);
    this.interactKeyText.setAlpha(active ? 1 : 0.6);
    this.interactContainer.setScale(pressed ? 0.95 : 1);
  }

  private drawBanner(): void {
    const width = Math.min(480, this.viewport.width - 48);
    const height = Math.max(30, Math.min(54, Math.ceil(this.bannerLabel.height || 16) + 14));
    drawOrnatePanel(this.bannerBg, {
      x: -width / 2,
      y: -height / 2,
      width,
      height,
      bevel: 7,
      fillColor: DF_PALETTE.obsidianBg,
      fillAlpha: 0.9,
      innerFillColor: DF_PALETTE.innerSurface,
      outerBorderColor: DF_PALETTE.metalBorder,
      innerBorderColor: DF_PALETTE.bronzeBorder,
      accentColor: DF_PALETTE.agedGold,
      shadow: true,
      cornerOrnaments: false,
      clear: true,
    });
  }

  private toggleConfig(): void {
    this.setConfigOpen(!this.configOpen);
  }

  private setConfigOpen(open: boolean): void {
    this.configOpen = open;
    this.configContainer.setVisible(open);
    if (!open) {
      this.disarmReset();
    }
  }

  private drawConfigPanel(): void {
    drawOrnatePanel(this.configBg, {
      x: -130,
      y: -65,
      width: 260,
      height: 130,
      bevel: 9,
      fillColor: DF_PALETTE.obsidianBg,
      fillAlpha: 0.96,
      innerFillColor: DF_PALETTE.innerSurface,
      outerBorderColor: DF_PALETTE.metalBorder,
      innerBorderColor: DF_PALETTE.bronzeBorder,
      accentColor: DF_PALETTE.agedGold,
      shadow: true,
      cornerOrnaments: true,
      clear: true,
    });
    drawOrnateButton(this.resetBtnBg, -100, -23, 200, 34, {
      variant: 'crimson',
      bevel: 6,
      clear: true,
      ...(this.resetArmed ? { fillColor: 0x7f1d1d, borderColor: 0xef4444 } : {}),
    });
    drawOrnateButton(this.closeBtnBg, -70, 21, 140, 30, { variant: 'iron', bevel: 6, clear: true });
  }

  private handleResetClick(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.resetBtnText.setText('Confirmar reset?').setColor('#ffffff');
      this.drawConfigPanel();
      this.resetTimer = setTimeout(() => this.disarmReset(), 3500);
      return;
    }
    this.disarmReset();
    this.setConfigOpen(false);
    this.callbacks.onResetSave();
  }

  private disarmReset(): void {
    if (this.resetTimer !== undefined) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
    if (!this.resetArmed) {
      return;
    }
    this.resetArmed = false;
    this.resetBtnText.setText('Resetar progresso').setColor(DF_PALETTE.textDanger);
    this.drawConfigPanel();
  }
}
