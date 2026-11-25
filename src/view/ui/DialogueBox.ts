import Phaser from 'phaser';
import {
  resolveViewportConfig,
  type DialogueLine,
  type PortraitId,
  type ViewportConfig,
} from '../../core/index';
import { soundManager } from '../audio/SoundManager';
import {
  DF_FONTS,
  DF_PALETTE,
  drawOrnamentalDivider,
  drawOrnateButton,
  drawOrnatePanel,
  hasUiTextureFrame,
} from './DarkFantasyUiBuilder';

const PORTRAIT_FRAME_MAP: Record<PortraitId, number> = {
  hero_living: 0,
  hero_wraith: 1,
  weapon_master: 2,
  village_blacksmith: 3,
  // Lyra tem retrato próprio no frame 8 (T-153); ver fallback em PORTRAIT_FRAME_FALLBACK.
  village_healer: 8,
  emissary: 4,
  spectral_blacksmith: 5,
  infernal_warden: 6,
  // Sem retrato próprio na folha `portraits`: reaproveita o do Carcereiro.
  karnak: 6,
  system: 7,
};

/** Frame usado quando a folha `portraits` ainda não tem o frame próprio (8 frames). */
const PORTRAIT_FRAME_FALLBACK: Partial<Record<PortraitId, number>> = {
  village_healer: 2,
};

const PORTRAIT_THEME: Record<
  PortraitId,
  { color: number; hex: string; badge: string }
> = {
  hero_living: { color: 0x34d399, hex: '#6ee7b7', badge: 'JG' },
  hero_wraith: { color: 0x38bdf8, hex: '#7dd3fc', badge: 'GE' },
  weapon_master: { color: 0xf59e0b, hex: '#fcd34d', badge: 'MA' },
  village_blacksmith: { color: 0xf97316, hex: '#fdba74', badge: 'FV' },
  village_healer: { color: 0x22c55e, hex: '#86efac', badge: 'LY' },
  emissary: { color: 0x38bdf8, hex: '#90e0ef', badge: 'EC' },
  spectral_blacksmith: { color: 0x60a5fa, hex: '#93c5fd', badge: 'FE' },
  infernal_warden: { color: 0xef4444, hex: '#fca5a5', badge: 'CI' },
  karnak: { color: 0x7f1d1d, hex: '#f87171', badge: 'KR' },
  system: { color: 0xfacc15, hex: '#fde047', badge: 'SY' },
};

const DIALOGUE_BOX_MAX_W = 820;
const DIALOGUE_BOX_H = 148;
const PORTRAIT_SIZE = 128;
const ACTION_BTN_W = 126;
const ACTION_BTN_H = 38;

export class DialogueBox {
  private readonly scene: Phaser.Scene;
  private viewport: ViewportConfig;

  private lines: DialogueLine[] = [];
  private currentIndex = 0;
  private opened = false;
  private actionBtnHovered = false;
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
      scene.scale.width || 960,
      scene.scale.height || 540
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
        fontFamily: DF_FONTS.TITLE,
        fontSize: '24px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5);

    this.portraitSprite = scene.textures.exists('portraits')
      ? scene.add.sprite(0, 0, 'portraits', 0).setOrigin(0.5)
      : null;

    this.speakerText = scene.add.text(0, 0, '', {
      fontFamily: DF_FONTS.TITLE,
      fontSize: '12px',
      color: DF_PALETTE.textBlue,
      fontStyle: 'bold',
      resolution: 2,
    });

    this.titleText = scene.add.text(0, 0, '', {
      fontFamily: DF_FONTS.TITLE,
      fontSize: '14px',
      color: DF_PALETTE.textGold,
      fontStyle: 'bold',
      resolution: 2,
    });

    this.bodyText = scene.add.text(0, 0, '', {
      fontFamily: DF_FONTS.BODY,
      fontSize: '12px',
      color: DF_PALETTE.textLight,
      lineSpacing: 4,
      resolution: 2,
    });

    this.pageText = scene.add
      .text(0, 0, '1/1', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '11px',
        color: DF_PALETTE.textMuted,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(1, 0);

    this.shortcutText = scene.add
      .text(0, 0, '[Enter / Espaço]', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '10px',
        color: DF_PALETTE.textMuted,
        resolution: 2,
      })
      .setOrigin(0.5, 0);

    this.actionBtnBg = scene.add.graphics();
    this.actionBtnText = scene.add
      .text(0, 0, 'Continuar', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '12px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5);
    this.actionBtnZone = scene.add
      .zone(0, 0, ACTION_BTN_W, ACTION_BTN_H)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.actionBtnZone.on('pointerover', () => {
      this.actionBtnHovered = true;
      this.redrawCurrentActionButton();
    });
    this.actionBtnZone.on('pointerout', () => {
      this.actionBtnHovered = false;
      this.redrawCurrentActionButton();
    });
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
    this.actionBtnHovered = false;

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
    this.actionBtnHovered = false;
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
      this.scene.scale.width || 960,
      this.scene.scale.height || 540
    );
    this.layout();
    if (this.opened) {
      this.renderCurrentLine();
    }
  }

  public destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.keydownHandler);
    this.rootContainer.destroy(true);
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

  private redrawCurrentActionButton(): void {
    const isLast = this.currentIndex >= Math.max(0, this.lines.length - 1);
    drawOrnateButton(
      this.actionBtnBg,
      -ACTION_BTN_W / 2,
      -ACTION_BTN_H / 2,
      ACTION_BTN_W,
      ACTION_BTN_H,
      {
        variant: isLast ? 'crimson' : 'blue',
        bevel: 6,
        hovered: this.actionBtnHovered,
        clear: true,
      }
    );
  }

  private drawPortrait(
    portraitId: PortraitId,
    theme: { color: number; hex: string; badge: string }
  ): void {
    const metrics = this.getBoxMetrics();
    const portraitCenterX = -metrics.boxW / 2 + metrics.padX + PORTRAIT_SIZE / 2;
    const portraitCenterY = 0;

    drawOrnatePanel(this.portraitFrameGraphic, {
      x: portraitCenterX - PORTRAIT_SIZE / 2,
      y: portraitCenterY - PORTRAIT_SIZE / 2,
      width: PORTRAIT_SIZE,
      height: PORTRAIT_SIZE,
      bevel: 8,
      fillColor: DF_PALETTE.obsidianBg,
      fillAlpha: 1,
      innerFillColor: DF_PALETTE.innerSurface,
      outerBorderColor: DF_PALETTE.bronzeBorder,
      innerBorderColor: theme.color,
      accentColor: theme.color,
      shadow: false,
      cornerOrnaments: true,
      clear: true,
    });

    let frameIndex =
      PORTRAIT_FRAME_MAP[portraitId] ?? PORTRAIT_FRAME_MAP.system;
    const fallbackFrame = PORTRAIT_FRAME_FALLBACK[portraitId];
    if (
      fallbackFrame !== undefined &&
      !hasUiTextureFrame(this.scene, 'portraits', frameIndex)
    ) {
      frameIndex = fallbackFrame;
    }
    const hasPortraitFrame =
      this.portraitSprite !== null &&
      hasUiTextureFrame(this.scene, 'portraits', frameIndex);

    if (hasPortraitFrame && this.portraitSprite) {
      this.portraitSprite
        .setPosition(portraitCenterX, portraitCenterY)
        .setFrame(frameIndex)
        .setDisplaySize(PORTRAIT_SIZE - 14, PORTRAIT_SIZE - 14)
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
        PORTRAIT_SIZE * 0.34
      );
      this.portraitFallbackGraphic.lineStyle(1.5, theme.color, 0.85);
      this.portraitFallbackGraphic.strokeCircle(
        portraitCenterX,
        portraitCenterY,
        PORTRAIT_SIZE * 0.34
      );
      this.portraitFallbackText
        .setPosition(portraitCenterX, portraitCenterY)
        .setColor(theme.hex)
        .setText(theme.badge)
        .setVisible(true);
    }
  }

  private drawPanelAndButton(accentColor: number, isLast: boolean): void {
    const { boxW, boxH, padX } = this.getBoxMetrics();
    const textLeft = -boxW / 2 + padX + PORTRAIT_SIZE + 16;
    const textRight = boxW / 2 - padX;

    drawOrnatePanel(this.panelGraphic, {
      x: -boxW / 2,
      y: -boxH / 2,
      width: boxW,
      height: boxH,
      bevel: 10,
      fillColor: DF_PALETTE.obsidianBg,
      fillAlpha: 0.97,
      innerFillColor: DF_PALETTE.innerSurface,
      outerBorderColor: DF_PALETTE.bronzeBorder,
      innerBorderColor: DF_PALETTE.metalBorder,
      accentColor,
      shadow: true,
      cornerOrnaments: true,
      clear: true,
    });

    // Divisor ornamental sutil entre nome/título e a fala
    const headerDivY = -boxH / 2 + 49;
    drawOrnamentalDivider(
      this.panelGraphic,
      textLeft,
      headerDivY,
      textRight - textLeft,
      DF_PALETTE.bronzeBorder
    );

    this.actionBtnZone.setSize(ACTION_BTN_W, ACTION_BTN_H);
    drawOrnateButton(
      this.actionBtnBg,
      -ACTION_BTN_W / 2,
      -ACTION_BTN_H / 2,
      ACTION_BTN_W,
      ACTION_BTN_H,
      {
        variant: isLast ? 'crimson' : 'blue',
        bevel: 6,
        hovered: this.actionBtnHovered,
        clear: true,
      }
    );
  }

  private getBoxMetrics(): {
    boxW: number;
    boxH: number;
    padX: number;
    padY: number;
    centerYOffset: number;
  } {
    const w = this.viewport.width;
    const h = this.viewport.height;

    const boxW = Math.min(DIALOGUE_BOX_MAX_W, w - 32);
    const boxH = DIALOGUE_BOX_H;
    const targetCenterY = h - boxH / 2 - 16;

    return {
      boxW,
      boxH,
      padX: 14,
      padY: 12,
      centerYOffset: targetCenterY,
    };
  }

  private layout(): void {
    const w = this.viewport.width;
    const h = this.viewport.height;
    const { boxW, boxH, padX, padY, centerYOffset } = this.getBoxMetrics();

    this.rootContainer.setPosition(w / 2, centerYOffset);

    // Backdrop cobrindo toda a tela independente do deslocamento vertical da caixa
    this.backdropGraphic.clear();
    this.backdropGraphic.fillStyle(0x04060a, 0.68);
    this.backdropGraphic.fillRect(-w / 2, -centerYOffset, w, h);
    this.backdropZone
      .setPosition(0, h / 2 - centerYOffset)
      .setSize(w, h);

    const textLeft = -boxW / 2 + padX + PORTRAIT_SIZE + 16;
    const rightEdge = boxW / 2 - padX;
    const bodyRight = rightEdge - ACTION_BTN_W - 18;
    const headerWidth = Math.max(160, rightEdge - textLeft - 46);
    const bodyWidth = Math.max(160, bodyRight - textLeft);
    const top = -boxH / 2 + padY;

    this.speakerText.setPosition(textLeft, top);
    this.titleText.setWordWrapWidth(headerWidth).setPosition(textLeft, top + 16);
    this.bodyText.setWordWrapWidth(bodyWidth).setPosition(textLeft, top + 45);

    this.pageText.setPosition(rightEdge, top + 2);

    const btnCenterX = rightEdge - ACTION_BTN_W / 2;
    const btnCenterY = 18;
    this.actionBtnContainer.setPosition(btnCenterX, btnCenterY);
    this.shortcutText
      .setVisible(true)
      .setPosition(btnCenterX, btnCenterY + ACTION_BTN_H / 2 + 6);

    const currentLine = this.lines[this.currentIndex];
    const theme = currentLine
      ? (PORTRAIT_THEME[currentLine.portraitId] ?? PORTRAIT_THEME.system)
      : PORTRAIT_THEME.system;
    this.drawPanelAndButton(
      theme.color,
      this.currentIndex >= Math.max(0, this.lines.length - 1)
    );
    if (currentLine) {
      this.drawPortrait(currentLine.portraitId, theme);
    }
  }
}
