import Phaser from 'phaser';
import { GAME_VERSION } from '../../version';

interface SpritesheetSpec {
  key: string;
  file: string;
  frameWidth: number;
  frameHeight: number;
  fallbackColor: number;
}

const SPRITESHEET_SPECS: readonly SpritesheetSpec[] = [
  {
    key: 'wraith_warrior',
    file: 'assets/sprites/wraith_warrior.png',
    frameWidth: 32,
    frameHeight: 32,
    fallbackColor: 0x38bdf8,
  },
  {
    key: 'abyssal_slime',
    file: 'assets/sprites/abyssal_slime.png',
    frameWidth: 32,
    frameHeight: 32,
    fallbackColor: 0xef4444,
  },
  {
    key: 'bone_sentinel',
    file: 'assets/sprites/bone_sentinel.png',
    frameWidth: 32,
    frameHeight: 32,
    fallbackColor: 0xe4e4e7,
  },
  {
    key: 'infernal_warden',
    file: 'assets/sprites/infernal_warden.png',
    frameWidth: 64,
    frameHeight: 64,
    fallbackColor: 0xdc2626,
  },
  {
    key: 'dungeon_tiles',
    file: 'assets/sprites/dungeon_tiles.png',
    frameWidth: 16,
    frameHeight: 16,
    fallbackColor: 0x18181b,
  },
  {
    key: 'soul_orb',
    file: 'assets/sprites/soul_orb.png',
    frameWidth: 16,
    frameHeight: 16,
    fallbackColor: 0x38bdf8,
  },
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  public preload(): void {
    this.load.on('loaderror', () => {
      // Fallback textures are generated in create() if any spritesheet fails to load.
    });

    for (const spec of SPRITESHEET_SPECS) {
      this.load.spritesheet(spec.key, spec.file, {
        frameWidth: spec.frameWidth,
        frameHeight: spec.frameHeight,
      });
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
    for (const spec of SPRITESHEET_SPECS) {
      if (!this.textures.exists(spec.key)) {
        const gfx = this.make.graphics({ x: 0, y: 0 });
        gfx.fillStyle(spec.fallbackColor, 1);
        gfx.fillRect(0, 0, spec.frameWidth, spec.frameHeight);
        gfx.lineStyle(2, 0x09090b, 1);
        gfx.strokeRect(0, 0, spec.frameWidth, spec.frameHeight);
        gfx.generateTexture(spec.key, spec.frameWidth, spec.frameHeight);
        gfx.destroy();
      }
    }
  }
}

