import Phaser from 'phaser';
import { resolveViewportConfig, type ViewportConfig } from './core';
import { GAME_VERSION } from './version';
import { BootScene } from './view/scenes/BootScene';
import { DungeonScene } from './view/scenes/DungeonScene';
import { HubScene } from './view/scenes/HubScene';

interface LockableScreenOrientation {
  lock?: (orientation: 'landscape') => Promise<void>;
}

export function createGameConfig(viewport: ViewportConfig): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: viewport.width,
    height: viewport.height,
    backgroundColor: '#09090b',
    pixelArt: false,
    roundPixels: true,
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: true,
    },
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

function setupLandscapeOrientationLock(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const isTouchDevice =
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
    'ontouchstart' in window ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);

  if (!isTouchDevice) {
    return;
  }

  let attempted = false;
  const tryLockLandscape = () => {
    if (attempted) {
      return;
    }
    attempted = true;
    try {
      const orientation = window.screen?.orientation as unknown as
        | LockableScreenOrientation
        | undefined;
      if (orientation && typeof orientation.lock === 'function') {
        void Promise.resolve(orientation.lock('landscape')).catch(() => {});
      }
    } catch {
      // Safe fallback when orientation lock is unsupported or blocked by browser policy
    }
  };

  window.addEventListener('pointerdown', tryLockLandscape, { once: true, passive: true });
  window.addEventListener('touchstart', tryLockLandscape, { once: true, passive: true });
}

function setupRotateOverlayDismiss(): void {
  if (typeof document === 'undefined') {
    return;
  }

  const overlay = document.getElementById('rotate-overlay');
  const dismissBtn = document.getElementById('rotate-dismiss-btn');
  if (!overlay || !dismissBtn) {
    return;
  }

  dismissBtn.addEventListener('click', () => {
    overlay.setAttribute('data-dismissed', 'true');
    overlay.style.display = 'none';
  });
}

export function bootstrapGame(): Phaser.Game {
  const initialViewport = resolveViewportConfig(window.innerWidth, window.innerHeight);
  const game = new Phaser.Game(createGameConfig(initialViewport));

  const handleViewportChange = () => {
    game.scale.refresh();
  };

  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('orientationchange', handleViewportChange);

  setupLandscapeOrientationLock();
  setupRotateOverlayDismiss();

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
