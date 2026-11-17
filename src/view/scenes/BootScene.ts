import Phaser from 'phaser';
import { GAME_VERSION } from '../../version';

interface FallbackSpriteSpec {
  key: string;
  color: number;
  size: number;
}

const FALLBACK_SPRITES: FallbackSpriteSpec[] = [
  { key: 'hero', color: 0x38bdf8, size: 24 },
  { key: 'imp', color: 0xef4444, size: 20 },
  { key: 'skeleton', color: 0xe4e4e7, size: 22 },
  { key: 'hellhound', color: 0xf97316, size: 22 },
  { key: 'boss_azaroth', color: 0xdc2626, size: 40 },
  { key: 'floor_tile', color: 0x18181b, size: 32 },
  { key: 'wall_tile', color: 0x3f3f46, size: 32 },
  { key: 'portal', color: 0xa855f7, size: 32 },
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  public preload(): void {
    this.load.on('loaderror', () => {
      // Fallback textures will be generated in create() for any missing sprites.
    });

    for (const spec of FALLBACK_SPRITES) {
      this.load.image(spec.key, `assets/sprites/${spec.key}.png`);
    }
  }

  public create(): void {
    this.ensureFallbackTextures();

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#09090b');

    this.add
      .text(width / 2, height / 2 - 16, 'SUBMUNDO', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#f4f4f5',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 20, `v${GAME_VERSION}`, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#a1a1aa',
      })
      .setOrigin(0.5);

    if ('DungeonScene' in this.scene.manager.keys) {
      this.scene.start('DungeonScene');
    }
  }

  private ensureFallbackTextures(): void {
    for (const spec of FALLBACK_SPRITES) {
      if (!this.textures.exists(spec.key)) {
        const gfx = this.make.graphics({ x: 0, y: 0 });
        gfx.fillStyle(spec.color, 1);
        gfx.fillRect(0, 0, spec.size, spec.size);
        gfx.lineStyle(2, 0x09090b, 1);
        gfx.strokeRect(0, 0, spec.size, spec.size);
        gfx.generateTexture(spec.key, spec.size, spec.size);
        gfx.destroy();
      }
    }
  }
}
