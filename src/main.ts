import Phaser from 'phaser';
import { resolveViewportConfig, type ViewportConfig } from './core';
import { GAME_VERSION } from './version';
import { BootScene } from './view/scenes/BootScene';
import { DungeonScene } from './view/scenes/DungeonScene';
import { HubScene } from './view/scenes/HubScene';

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
    scene: [BootScene, HubScene, DungeonScene],
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

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return;
  }
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    try {
      void navigator.serviceWorker.register('./sw.js').catch(() => {});
    } catch {
      // Safe fallback for dev/test environments
    }
  });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  bootstrapGame();
  registerServiceWorker();
}
