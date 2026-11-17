import Phaser from 'phaser';
import { resolveViewportConfig, type ViewportConfig } from './core';
import { GAME_VERSION } from './version';
import { BootScene } from './view/scenes/BootScene';
import { DungeonScene } from './view/scenes/DungeonScene';

export function createGameConfig(viewport: ViewportConfig): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: viewport.width,
    height: viewport.height,
    backgroundColor: '#09090b',
    pixelArt: true,
    roundPixels: true,
    input: {
      activePointers: 4,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: viewport.width,
      height: viewport.height,
    },
    scene: [BootScene, DungeonScene],
  };
}

export function bootstrapGame(): Phaser.Game {
  const initialViewport = resolveViewportConfig(window.innerWidth, window.innerHeight);
  const game = new Phaser.Game(createGameConfig(initialViewport));

  let currentMode = initialViewport.mode;
  window.addEventListener('resize', () => {
    const nextViewport = resolveViewportConfig(window.innerWidth, window.innerHeight);
    if (nextViewport.mode !== currentMode) {
      currentMode = nextViewport.mode;
      game.scale.setGameSize(nextViewport.width, nextViewport.height);
    }
    game.scale.refresh();
  });

  document.title = `SUBMUNDO v${GAME_VERSION}`;
  return game;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  bootstrapGame();
}
