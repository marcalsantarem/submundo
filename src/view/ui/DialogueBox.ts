import Phaser from 'phaser';
import {
  resolveViewportConfig,
  type DialogueLine,
  type PortraitId,
  type ViewportConfig,
} from '../../core/index';
import { soundManager } from '../audio/SoundManager';

const PORTRAIT_FRAME_MAP: Record<PortraitId, number> = {
  hero_living: 0,
  hero_wraith: 1,
  weapon_master: 2,
  village_blacksmith: 3,
  emissary: 4,
  spectral_blacksmith: 5,
  infernal_warden: 6,
  system: 7,
};

const PORTRAIT_THEME: Record<
  PortraitId,
  { color: number; hex: string; badge: string }
> = {
  hero_living: { color: 0x34d399, hex: '#6ee7b7', badge: 'JG' },
  hero_wraith: { color: 0x38bdf8, hex: '#7dd3fc', badge: 'GE' },
  weapon_master: { color: 0xf59e0b, hex: '#fcd34d', badge: 'MA' },
  village_blacksmith: { color: 0xf97316, hex: '#fdba74', badge: 'FV' },
  emissary: { color: 0x38bdf8, hex: '#90e0ef', badge: 'EC' },
  spectral_blacksmith: { color: 0x60a5fa, hex: '#93c5fd', badge: 'FE' },
  infernal_warden: { color: 0xef4444, hex: '#fca5a5', badge: 'CI' },
  system: { color: 0xfacc15, hex: '#fde047', badge: 'SY' },
};

const PALETTE = {
  panelBg: 0x0d0f16,
  surfaceBg: 0x161924,
  bronze: 0x8a7048,
  steel: 0x525a6e,
  btnContinue: 0x162133,
  btnClose: 0x3b151c,
} as const;

export class DialogueBox {
  private readonly scene: Phaser.Scene;
  private viewport: ViewportConfig;

  private lines: DialogueLine[] = [];
  private currentIndex = 0;
  private opened = false;
  private onComplete?: () => void;

  private readonly rootContainer: Phaser.GameObjects.Container;
  private readonly backdropGraphic: Phaser.GameObjects.Graphics;
  private readonly backdropZone: Phaser.GameObjects.Zone;
  private readonly panelGraphic: Phaser.GameObjects.Graphics;

  private readonly portraitFrameGraphic: Phaser.GameObjects.Graphics;
  private readonly portraitFallbackGraphic: Phaser.GameObjects.Graphics;
  private readonly portraitFallbackText: Phaser.GameObjects.Text;
  private readonly portraitSprite: Phaser.GameObjects.Sprite | null;

  private readonly speakerText: Phaser.GameObjects.Text;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly pageText: Phaser.GameObjects.Text;
  private readonly shortcutText: Phaser.GameObjects.Text;

  private readonly actionBtnContainer: Phaser.GameObjects.Container;
  private readonly actionBtnBg: Phaser.GameObjects.Graphics;
  private readonly actionBtnText: Phaser.GameObjects.Text;
  private readonly actionBtnZone: Phaser.GameObjects.Zone;

  private readonly keydownHandler: (event: KeyboardEvent) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.viewport = resolveViewportConfig(
      scene.scale.width || 800,
      scene.scale.height || 600
    );

    this.backdropGraphic = scene.add.graphics();
    this.backdropZone = scene.add
      .zone(0, 0, this.viewport.width, this.viewport.height)
      .setOrigin(0.5)
      .setInteractive();
    this.backdropZone.on(
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

    this.panelGraphic = scene.add.graphics();
    this.portraitFrameGraphic = scene.add.graphics();
    this.portraitFallbackGraphic = scene.add.graphics();
    this.portraitFallbackText = scene.add
      .text(0, 0, 'SY', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#f8fafc',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.portraitSprite = scene.textures.exists('portraits')
      ? scene.add.sprite(0, 0, 'portraits', 0).setOrigin(0.5)
      : null;

    this.speakerText = scene.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#90e0ef',
      fontStyle: 'bold',
    });

    this.titleText = scene.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffd166',
      fontStyle: 'bold',
    });

    this.bodyText = scene.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#e2e8f0',
      lineSpacing: 5,
    });

    this.pageText = scene.add.text(0, 0, '1/1', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#94a3b8',
      fontStyle: 'bold',
    });

    this.shortcutText = scene.add.text(0, 0, '[Enter/Espaço]', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#64748b',
    });

    this.actionBtnBg = scene.add.graphics();
    this.actionBtnText = scene.add
      .text(0, 0, 'Continuar', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.actionBtnZone = scene.add
      .zone(0, 0, 120, 32)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.actionBtnZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation?.();
        soundManager.unlock();
        this.advanceOrClose();
      }
    );

    this.actionBtnContainer = scene.add.container(0, 0, [
      this.actionBtnBg,
      this.actionBtnText,
      this.actionBtnZone,
    ]);

    const children: Phaser.GameObjects.GameObject[] = [
      this.backdropGraphic,
      this.backdropZone,
      this.panelGraphic,
      this.portraitFrameGraphic,
      this.portraitFallbackGraphic,
      this.portraitFallbackText,
    ];
    if (this.portraitSprite) {
      children.push(this.portraitSprite);
    }
    children.push(
      this.speakerText,
      this.titleText,
      this.bodyText,
      this.pageText,
      this.shortcutText,
      this.actionBtnContainer
    );

    this.rootContainer = scene.add
      .container(this.viewport.width / 2, this.viewport.height / 2, children)
      .setScrollFactor(0)
      .setDepth(1350)
      .setVisible(false);

    this.keydownHandler = (event: KeyboardEvent) => {
      if (!this.opened) {
        return;
      }
      if (event.code === 'Escape') {
        event.preventDefault();
        soundManager.unlock();
        this.close();
      } else if (event.code === 'Enter' || event.code === 'Space') {
        event.preventDefault();
        soundManager.unlock();
        this.advanceOrClose();
      }
    };
    scene.input.keyboard?.on('keydown', this.keydownHandler);

    this.layout();
  }

  public openLines(lines: DialogueLine[], onComplete?: () => void): void {
    const validLines = lines.filter((line) => Boolean(line && line.text));
    if (validLines.length === 0) {
      onComplete?.();
      return;
    }

    this.lines = [...validLines];
    this.currentIndex = 0;
    this.onComplete = onComplete;
    this.opened = true;

    this.layout();
    this.renderCurrentLine();
    this.rootContainer.setVisible(true);
    soundManager.play('dialogue_blip');
  }

  public advanceOrClose(): void {
    if (!this.opened) {
      return;
    }

    if (this.currentIndex < this.lines.length - 1) {
      this.currentIndex += 1;
      this.renderCurrentLine();
      soundManager.play('dialogue_blip');
      return;
    }

    this.close();
  }

  public close(): void {
    if (!this.opened) {
      return;
    }

    this.opened = false;
    this.rootContainer.setVisible(false);
    soundManager.play('ui_click');

    const callback = this.onComplete;
    this.onComplete = undefined;
    this.lines = [];
    this.currentIndex = 0;
    callback?.();
  }

  public isOpen(): boolean {
    return this.opened;
  }

  public handleResize(): void {
    this.viewport = resolveViewportConfig(
      this.scene.scale.width || 800,
      this.scene.scale.height || 600
    );
    this.layout();
    if (this.opened) {
      this.renderCurrentLine();
    }
  }

  public destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.keydownHandler);
    this.rootContainer.destroy();
  }

  private renderCurrentLine(): void {
    const line = this.lines[this.currentIndex];
    if (!line) {
      return;
    }

    const theme = PORTRAIT_THEME[line.portraitId] ?? PORTRAIT_THEME.system;
    const isLast = this.currentIndex >= this.lines.length - 1;

    this.speakerText.setColor(theme.hex).setText(line.speaker.toUpperCase());
    this.titleText.setText(line.title);
    this.bodyText.setText(line.text);
    this.pageText.setText(`${this.currentIndex + 1}/${this.lines.length}`);
    this.actionBtnText.setText(isLast ? 'Fechar' : 'Continuar');

    this.drawPortrait(line.portraitId, theme);
    this.drawPanelAndButton(theme.color, isLast);
  }

  private drawPortrait(
    portraitId: PortraitId,
    theme: { color: number; hex: string; badge: string }
  ): void {
    const isMobile = this.viewport.mode === 'mobile_portrait';
    const metrics = this.getBoxMetrics();
    const portraitSize = isMobile ? 68 : 84;
    const portraitCenterX = -metrics.boxW / 2 + metrics.padX + portraitSize / 2;
    const portraitCenterY = -metrics.boxH / 2 + metrics.padY + portraitSize / 2 + 4;

    this.portraitFrameGraphic.clear();
    const px = portraitCenterX - portraitSize / 2;
    const py = portraitCenterY - portraitSize / 2;
    // Double refined metallic chamfered frame around portrait
    this.fillChamferedRect(
      this.portraitFrameGraphic,
      px,
      py,
      portraitSize,
      portraitSize,
      7,
      PALETTE.panelBg,
      1
    );
    this.strokeChamferedRect(
      this.portraitFrameGraphic,
      px,
      py,
      portraitSize,
      portraitSize,
      7,
      2,
      PALETTE.bronze,
      0.95
    );
    this.fillChamferedRect(
      this.portraitFrameGraphic,
      px + 4,
      py + 4,
      portraitSize - 8,
      portraitSize - 8,
      5,
      PALETTE.surfaceBg,
      0.96
    );
    this.strokeChamferedRect(
      this.portraitFrameGraphic,
      px + 4,
      py + 4,
      portraitSize - 8,
      portraitSize - 8,
      5,
      1.5,
      theme.color,
      0.92
    );

    const frameIndex = PORTRAIT_FRAME_MAP[portraitId] ?? PORTRAIT_FRAME_MAP.system;
    const hasPortraitFrame =
      this.portraitSprite !== null && this.hasTextureFrame('portraits', frameIndex);

    if (hasPortraitFrame && this.portraitSprite) {
      this.portraitSprite
        .setPosition(portraitCenterX, portraitCenterY)
        .setFrame(frameIndex)
        .setDisplaySize(portraitSize - 12, portraitSize - 12)
        .setVisible(true);
      this.portraitFallbackGraphic.clear();
      this.portraitFallbackText.setVisible(false);
    } else {
      if (this.portraitSprite) {
        this.portraitSprite.setVisible(false);
      }
      this.portraitFallbackGraphic.clear();
      this.portraitFallbackGraphic.fillStyle(theme.color, 0.24);
      this.portraitFallbackGraphic.fillCircle(
        portraitCenterX,
        portraitCenterY,
        portraitSize * 0.34
      );
      this.portraitFallbackGraphic.lineStyle(1.5, theme.color, 0.8);
      this.portraitFallbackGraphic.strokeCircle(
        portraitCenterX,
        portraitCenterY,
        portraitSize * 0.34
      );
      this.portraitFallbackText
        .setPosition(portraitCenterX, portraitCenterY)
        .setColor(theme.hex)
        .setFontSize(isMobile ? 16 : 20)
        .setText(theme.badge)
        .setVisible(true);
    }
  }

  private drawPanelAndButton(accentColor: number, isLast: boolean): void {
    const isMobile = this.viewport.mode === 'mobile_portrait';
    const { boxW, boxH, padX, padY } = this.getBoxMetrics();
    const portraitSize = isMobile ? 68 : 84;
    const textLeft = -boxW / 2 + padX + portraitSize + (isMobile ? 12 : 16);
    const textRight = boxW / 2 - padX;

    this.panelGraphic.clear();
    this.fillChamferedRect(
      this.panelGraphic,
      -boxW / 2,
      -boxH / 2,
      boxW,
      boxH,
      10,
      PALETTE.panelBg,
      0.97
    );
    this.strokeChamferedRect(
      this.panelGraphic,
      -boxW / 2,
      -boxH / 2,
      boxW,
      boxH,
      10,
      2,
      PALETTE.bronze,
      0.95
    );
    this.strokeChamferedRect(
      this.panelGraphic,
      -boxW / 2 + 4,
      -boxH / 2 + 4,
      boxW - 8,
      boxH - 8,
      8,
      1,
      PALETTE.steel,
      0.75
    );

    // Subtle accent header & bronze footer dividers
    const headerDivY = -boxH / 2 + padY + (isMobile ? 35 : 37);
    this.panelGraphic.lineStyle(1, accentColor, 0.45);
    this.panelGraphic.lineBetween(textLeft, headerDivY, textRight, headerDivY);

    const footerDivY = boxH / 2 - 44;
    this.panelGraphic.lineStyle(1, PALETTE.bronze, 0.4);
    this.panelGraphic.lineBetween(-boxW / 2 + padX, footerDivY, textRight, footerDivY);

    const btnW = isMobile ? 112 : 120;
    const btnH = 32;
    this.actionBtnZone.setSize(btnW, btnH);
    this.actionBtnBg.clear();
    this.fillChamferedRect(
      this.actionBtnBg,
      -btnW / 2,
      -btnH / 2,
      btnW,
      btnH,
      5,
      isLast ? PALETTE.btnClose : PALETTE.btnContinue,
      0.96
    );
    this.strokeChamferedRect(
      this.actionBtnBg,
      -btnW / 2,
      -btnH / 2,
      btnW,
      btnH,
      5,
      1.6,
      PALETTE.bronze,
      0.96
    );
    this.strokeChamferedRect(
      this.actionBtnBg,
      -btnW / 2 + 2.5,
      -btnH / 2 + 2.5,
      btnW - 5,
      btnH - 5,
      3.5,
      0.8,
      accentColor,
      0.7
    );
  }

  private getBoxMetrics(): {
    boxW: number;
    boxH: number;
    padX: number;
    padY: number;
    centerYOffset: number;
  } {
    const isMobile = this.viewport.mode === 'mobile_portrait';
    const w = this.viewport.width;
    const h = this.viewport.height;

    if (isMobile) {
      const boxW = Math.min(w - 20, 344);
      const boxH = 236;
      const targetCenterY = Math.round(h / 2 + 12);
      return {
        boxW,
        boxH,
        padX: 14,
        padY: 14,
        centerYOffset: targetCenterY,
      };
    }

    const boxW = Math.min(w - 40, 648);
    const boxH = 196;
    const targetCenterY = h - 128;
    return {
      boxW,
      boxH,
      padX: 18,
      padY: 16,
      centerYOffset: targetCenterY,
    };
  }

  private layout(): void {
    const w = this.viewport.width;
    const h = this.viewport.height;
    const isMobile = this.viewport.mode === 'mobile_portrait';
    const { boxW, boxH, padX, padY, centerYOffset } = this.getBoxMetrics();

    this.rootContainer.setPosition(w / 2, centerYOffset);

    // Backdrop covers the whole screen regardless of rootContainer Y offset
    this.backdropGraphic.clear();
    this.backdropGraphic.fillStyle(0x04060a, 0.72);
    this.backdropGraphic.fillRect(-w / 2, -centerYOffset, w, h);
    this.backdropZone
      .setPosition(0, h / 2 - centerYOffset)
      .setSize(w, h);

    const portraitSize = isMobile ? 68 : 84;
    const textLeft = -boxW / 2 + padX + portraitSize + (isMobile ? 12 : 16);
    const textRight = boxW / 2 - padX;
    const textWidth = Math.max(120, textRight - textLeft);
    const top = -boxH / 2 + padY;

    this.speakerText.setFontSize(isMobile ? 10 : 11).setPosition(textLeft, top);
    this.titleText
      .setFontSize(isMobile ? 12 : 14)
      .setWordWrapWidth(textWidth)
      .setPosition(textLeft, top + 16);
    this.bodyText
      .setFontSize(isMobile ? 11 : 12)
      .setWordWrapWidth(textWidth)
      .setPosition(textLeft, top + (isMobile ? 42 : 44));

    const footerY = boxH / 2 - 24;
    this.pageText.setPosition(-boxW / 2 + padX, footerY - 7);
    this.shortcutText
      .setVisible(!isMobile)
      .setPosition(-boxW / 2 + padX + 46, footerY - 6);

    const btnW = isMobile ? 112 : 120;
    this.actionBtnContainer.setPosition(textRight - btnW / 2, footerY);

    const currentLine = this.lines[this.currentIndex];
    const theme = currentLine
      ? PORTRAIT_THEME[currentLine.portraitId] ?? PORTRAIT_THEME.system
      : PORTRAIT_THEME.system;
    this.drawPanelAndButton(
      theme.color,
      this.currentIndex >= Math.max(0, this.lines.length - 1)
    );
    if (currentLine) {
      this.drawPortrait(currentLine.portraitId, theme);
    }
  }

  private hasTextureFrame(key: string, frame: number): boolean {
    if (!this.scene.textures.exists(key)) {
      return false;
    }
    return this.scene.textures.get(key).has(String(frame));
  }

  private buildChamferedPoints(
    x: number,
    y: number,
    w: number,
    h: number,
    bevel: number
  ): Phaser.Types.Math.Vector2Like[] {
    const b = Math.min(bevel, w * 0.25, h * 0.25);
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

  private fillChamferedRect(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    bevel: number,
    color: number,
    alpha: number
  ): void {
    gfx.fillStyle(color, alpha);
    gfx.fillPoints(this.buildChamferedPoints(x, y, w, h, bevel), true);
  }

  private strokeChamferedRect(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    bevel: number,
    lineWidth: number,
    color: number,
    alpha: number
  ): void {
    gfx.lineStyle(lineWidth, color, alpha);
    gfx.strokePoints(this.buildChamferedPoints(x, y, w, h, bevel), true, true);
  }
}
