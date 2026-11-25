import Phaser from 'phaser';
import {
  DF_FONTS,
  DF_PALETTE,
  drawOrnamentalDivider,
  drawOrnateButton,
} from './DarkFantasyUiBuilder';

/**
 * Tela "Fim do Prólogo" (T-147). Fundo escuro, título em Cinzel, texto sóbrio e
 * botão "Continuar" (também Enter/Espaço/E). Chamada pela `DungeonScene` após a
 * morte para o Karnak.
 */
export interface PrologueEndScreenOptions {
  title: string;
  text: string;
  onContinue: () => void;
  /** Texto do botão (padrão "Continuar"). */
  buttonLabel?: string;
}

export interface PrologueEndScreenHandle {
  container: Phaser.GameObjects.Container;
  destroy: () => void;
}

const DEPTH = 5000;

export const PrologueEndScreen = {
  show(scene: Phaser.Scene, opts: PrologueEndScreenOptions): PrologueEndScreenHandle {
    // Profundidade alta: o `SceneCameraRig` manda para a câmera de UI (sem zoom).
    const w = scene.scale.width || scene.cameras.main.width;
    const h = scene.scale.height || scene.cameras.main.height;
    const cx = w / 2;
    const compact = w < 560;

    const container = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0);
    container.setName('prologue_end_screen');

    const bg = scene.add.rectangle(0, 0, w, h, 0x05060a, 1).setOrigin(0, 0);
    bg.setInteractive(); // bloqueia cliques no que estiver por baixo
    const vignette = scene.add.graphics();
    // Brilho vermelho tênue, em camadas, sem borda marcada.
    for (let i = 0; i < 6; i++) {
      const k = 1 - i * 0.14;
      vignette.fillStyle(0x3a0d12, 0.035);
      vignette.fillEllipse(cx, h * 0.42, w * 0.95 * k, h * 0.6 * k);
    }

    const titleSize = compact ? 26 : 34;
    const title = scene.add
      .text(cx, h * 0.3, opts.title, {
        fontFamily: DF_FONTS.TITLE,
        fontSize: `${titleSize}px`,
        fontStyle: 'bold',
        color: DF_PALETTE.textGold,
        align: 'center',
        resolution: 2,
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: { width: w - 48 },
      })
      .setOrigin(0.5, 0.5);

    const divider = scene.add.graphics();
    const dividerW = Math.min(320, w - 64);
    drawOrnamentalDivider(divider, cx - dividerW / 2, title.y + titleSize * 0.9, dividerW);

    const body = scene.add
      .text(cx, title.y + titleSize * 0.9 + 22, opts.text, {
        fontFamily: DF_FONTS.BODY,
        fontSize: compact ? '14px' : '15px',
        color: DF_PALETTE.textParchment,
        align: 'center',
        resolution: 2,
        lineSpacing: 6,
        wordWrap: { width: Math.min(520, w - 48) },
      })
      .setOrigin(0.5, 0);

    const btnW = 180;
    const btnH = 44;
    const btnX = cx - btnW / 2;
    const btnY = Math.min(h - btnH - 32, body.y + body.height + 40);
    const btnGfx = scene.add.graphics();
    const label = opts.buttonLabel ?? 'Continuar';
    const btnText = scene.add
      .text(cx, btnY + btnH / 2, label, {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '16px',
        fontStyle: 'bold',
        color: DF_PALETTE.textParchment,
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);
    const draw = (hovered: boolean, pressed = false): void => {
      drawOrnateButton(btnGfx, btnX, btnY, btnW, btnH, {
        variant: 'gold',
        hovered,
        pressed,
        clear: true,
      });
    };
    draw(false);
    const hit = scene.add
      .zone(btnX, btnY, btnW, btnH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    hit.setName('prologue_end_continue');

    container.add([bg, vignette, title, divider, body, btnGfx, btnText, hit]);
    container.setAlpha(0);
    scene.tweens.add({ targets: container, alpha: 1, duration: 600, ease: 'Sine.easeOut' });

    let done = false;
    const keyboard = scene.input.keyboard;
    const onKey = (event: KeyboardEvent): void => {
      if (event.code === 'Enter' || event.code === 'Space' || event.code === 'KeyE') {
        finish();
      }
    };
    const destroy = (): void => {
      keyboard?.off('keydown', onKey);
      if (container.active) {
        container.destroy(true);
      }
    };
    const finish = (): void => {
      if (done) return;
      done = true;
      destroy();
      opts.onContinue();
    };

    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => draw(true, true));
    hit.on('pointerup', () => finish());
    // Atraso curto para a tecla que matou o herói não pular a tela.
    scene.time.delayedCall(400, () => {
      if (!done) keyboard?.on('keydown', onKey);
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, destroy);

    return { container, destroy };
  },
};

export function showPrologueEndScreen(
  scene: Phaser.Scene,
  opts: PrologueEndScreenOptions
): PrologueEndScreenHandle {
  return PrologueEndScreen.show(scene, opts);
}
