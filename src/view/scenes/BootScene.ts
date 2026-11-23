import Phaser from 'phaser';
import { GAME_VERSION } from '../../version';
import {
  VILLAGE_ANIM_SPECS,
  VILLAGE_FALLBACK_COLORS,
  VILLAGE_FRAME_SIZES,
  VILLAGE_TEXTURE_KEYS,
} from './VillageAssets';

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
    key: 'hero_living',
    file: 'assets/sprites/hero_living.png',
    frameWidth: 80,
    frameHeight: 80,
    fallbackColor: 0xe2e8f0,
  },
  {
    key: 'hero_wraith',
    file: 'assets/sprites/hero_wraith.png',
    frameWidth: 80,
    frameHeight: 80,
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
    key: 'skeleton_chief',
    file: 'assets/sprites/skeleton_chief.png',
    frameWidth: 80,
    frameHeight: 80,
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
  {
    key: 'loot_icons',
    file: 'assets/sprites/loot_icons.png',
    frameWidth: 16,
    frameHeight: 16,
    fallbackColor: 0xfacc15,
  },
  {
    key: 'loot_drops',
    file: 'assets/sprites/loot_drops.png',
    frameWidth: 16,
    frameHeight: 16,
    fallbackColor: 0xf97316,
  },
  {
    key: 'hub_tiles',
    file: 'assets/sprites/hub_tiles.png',
    frameWidth: 16,
    frameHeight: 16,
    fallbackColor: 0x1e293b,
  },
  {
    key: 'hub_npcs',
    file: 'assets/sprites/hub_npcs.png',
    frameWidth: 32,
    frameHeight: 32,
    fallbackColor: 0x48cae4,
  },
  {
    key: 'portraits',
    file: 'assets/sprites/portraits.png',
    frameWidth: 128,
    frameHeight: 128,
    fallbackColor: 0x64748b,
  },
  {
    key: 'village_tiles',
    file: 'assets/sprites/village_tiles.png',
    frameWidth: 16,
    frameHeight: 16,
    fallbackColor: 0x2f4f2f,
  },
  {
    key: 'village_npcs',
    file: 'assets/sprites/village_npcs.png',
    frameWidth: 32,
    frameHeight: 32,
    fallbackColor: 0xd97706,
  },
  {
    key: 'cave_bat',
    file: 'assets/sprites/cave_bat.png',
    frameWidth: 80,
    frameHeight: 80,
    fallbackColor: 0x7c3aed,
  },
  {
    key: 'slime',
    file: 'assets/sprites/slime.png',
    frameWidth: 80,
    frameHeight: 80,
    fallbackColor: 0x22c55e,
  },
  {
    key: 'wolf',
    file: 'assets/sprites/wolf.png',
    frameWidth: 80,
    frameHeight: 80,
    fallbackColor: 0x94a3b8,
  },
  {
    key: 'skeleton',
    file: 'assets/sprites/skeleton.png',
    frameWidth: 80,
    frameHeight: 80,
    fallbackColor: 0xe2e8f0,
  },
  {
    key: 'skeleton_archer',
    file: 'assets/sprites/skeleton_archer.png',
    frameWidth: 80,
    frameHeight: 80,
    fallbackColor: 0x65a30d,
  },
  {
    key: 'weapons',
    file: 'assets/sprites/weapons.png',
    frameWidth: 48,
    frameHeight: 48,
    fallbackColor: 0x94a3b8,
  },
  {
    key: 'wolf_alpha',
    file: 'assets/sprites/wolf_alpha.png',
    frameWidth: 80,
    frameHeight: 80,
    fallbackColor: 0x9a3412,
  },
  {
    key: 'karnak',
    file: 'assets/sprites/karnak.png',
    frameWidth: 96,
    frameHeight: 96,
    fallbackColor: 0x991b1b,
  },
  {
    key: 'ui_icons',
    file: 'assets/sprites/ui_icons.png',
    frameWidth: 64,
    frameHeight: 64,
    fallbackColor: 0x334155,
  },
  {
    key: 'dungeon_basic_tiles',
    file: 'assets/sprites/dungeon_basic_tiles.png',
    frameWidth: 32,
    frameHeight: 32,
    fallbackColor: 0x1c1917,
  },
  {
    key: 'dungeon_basic_props',
    file: 'assets/sprites/dungeon_basic_props.png',
    frameWidth: 32,
    frameHeight: 32,
    fallbackColor: 0x78350f,
  },
  {
    key: 'dungeon_basic_props_tall',
    file: 'assets/sprites/dungeon_basic_props_tall.png',
    frameWidth: 32,
    frameHeight: 64,
    fallbackColor: 0x44403c,
  },
  {
    // 43 frames 32x32 (1376x32): portas, selos e vínculos de corredor (T-128).
    key: 'dungeon_basic_doors',
    file: 'assets/sprites/dungeon_basic_doors.png',
    frameWidth: 32,
    frameHeight: 32,
    fallbackColor: 0x292524,
  },
];

/** The 7 approved biomes (Decision #21). Texture keys: biome_<id>_{tiles,doors,props,props_tall}. */
export const BIOME_IDS = [
  'village',
  'herb_field',
  'village_grotto',
  'village_mine',
  'mine_depths',
  'ancient_seal',
  'submundo_abyss',
] as const;

export type BiomeId = (typeof BIOME_IDS)[number];

/** Torch flicker animation key for a biome: frames 0-3 of biome_<id>_props. */
export function biomeTorchAnimKey(id: BiomeId): string {
  return `biome_${id}_torch`;
}

interface BiomeSheetSpec {
  /** Fallback tint used when the biome sheets fail to load. */
  fallbackColor: number;
  /** Torch frameRate from scripts/art/biomes/out/<id>.manifest.json (repeat is always -1). */
  torchFrameRate: number;
}

const BIOME_SHEET_SPECS: Readonly<Record<BiomeId, BiomeSheetSpec>> = {
  village: { fallbackColor: 0x57534e, torchFrameRate: 8 },
  herb_field: { fallbackColor: 0x3f6212, torchFrameRate: 8 },
  village_grotto: { fallbackColor: 0x334155, torchFrameRate: 6 },
  village_mine: { fallbackColor: 0x78350f, torchFrameRate: 8 },
  mine_depths: { fallbackColor: 0x44403c, torchFrameRate: 8 },
  ancient_seal: { fallbackColor: 0x3730a3, torchFrameRate: 8 },
  submundo_abyss: { fallbackColor: 0x4c0519, torchFrameRate: 8 },
};

// Same frame contract as dungeon_basic_*: tiles 34f, doors 43f, props 32x32, props_tall 32x64.
const BIOME_SPRITESHEET_SPECS: readonly SpritesheetSpec[] = BIOME_IDS.flatMap((id) => {
  const { fallbackColor } = BIOME_SHEET_SPECS[id];
  return (['tiles', 'doors', 'props', 'props_tall'] as const).map((sheet) => ({
    key: `biome_${id}_${sheet}`,
    file: `assets/sprites/biome_${id}_${sheet}.png`,
    frameWidth: 32,
    frameHeight: sheet === 'props_tall' ? 64 : 32,
    fallbackColor,
  }));
});

// Vila Natal e NPCs (T-140): contrato em VillageAssets.ts.
const VILLAGE_SPRITESHEET_SPECS: readonly SpritesheetSpec[] = VILLAGE_TEXTURE_KEYS.map((key) => ({
  key,
  file: `assets/sprites/${key}.png`,
  ...VILLAGE_FRAME_SIZES[key],
  fallbackColor: VILLAGE_FALLBACK_COLORS[key],
}));

const ALL_SPRITESHEET_SPECS: readonly SpritesheetSpec[] = [
  ...SPRITESHEET_SPECS,
  ...BIOME_SPRITESHEET_SPECS,
  ...VILLAGE_SPRITESHEET_SPECS,
];

/**
 * Entrada do jogo (T-140): a Vila (HubScene) por padrão; a testArena com `?test`,
 * `?map=`, `?biome=` ou `?seed=` (URLs dos E2E da M6/M8).
 */
export function shouldOpenTestArena(search: string): boolean {
  const params = new URLSearchParams(search);
  return ['test', 'map', 'biome', 'seed'].some((name) => params.has(name));
}

const DUNGEON_BASIC_TORCH_ANIM_KEY = 'dungeon_basic_torch';

const LINEAR_TEXTURE_KEYS: readonly string[] = ['ui_icons', 'portraits'];

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  public preload(): void {
    this.load.on('loaderror', () => {
      // Fallback textures are generated in create() if any spritesheet fails to load.
    });

    for (const spec of ALL_SPRITESHEET_SPECS) {
      this.load.spritesheet(spec.key, spec.file, {
        frameWidth: spec.frameWidth,
        frameHeight: spec.frameHeight,
      });
    }
  }

  public create(): void {
    this.ensureFallbackTextures();
    this.applyTextureFilters();
    this.createGlobalAnimations();

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

    const keys = this.scene.manager.keys;
    const wantsTestArena = shouldOpenTestArena(window.location.search);
    if (wantsTestArena && 'DungeonScene' in keys) {
      this.scene.start('DungeonScene', { testArena: true });
    } else if ('HubScene' in keys) {
      this.scene.start('HubScene');
    } else if ('DungeonScene' in keys) {
      this.scene.start('DungeonScene', { testArena: true });
    }
  }

  private createGlobalAnimations(): void {
    // Torch flicker: frames 0-3 of dungeon_basic_props (Decision #17).
    // Skipped when the sheet fell back to a single-frame placeholder texture.
    const propsKey = 'dungeon_basic_props';
    if (
      !this.anims.exists(DUNGEON_BASIC_TORCH_ANIM_KEY) &&
      this.textures.exists(propsKey) &&
      this.textures.get(propsKey).has('3')
    ) {
      this.anims.create({
        key: DUNGEON_BASIC_TORCH_ANIM_KEY,
        frames: this.anims.generateFrameNumbers(propsKey, { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      });
    }

    // Biome torches (T-075): frames 0-3 of biome_<id>_props, same fallback guard.
    for (const id of BIOME_IDS) {
      const animKey = biomeTorchAnimKey(id);
      const biomePropsKey = `biome_${id}_props`;
      if (
        !this.anims.exists(animKey) &&
        this.textures.exists(biomePropsKey) &&
        this.textures.get(biomePropsKey).has('3')
      ) {
        this.anims.create({
          key: animKey,
          frames: this.anims.generateFrameNumbers(biomePropsKey, { start: 0, end: 3 }),
          frameRate: BIOME_SHEET_SPECS[id].torchFrameRate,
          repeat: -1,
        });
      }
    }

    this.createVillageAnimations();
  }

  private createVillageAnimations(): void {
    // Mesmo guarda de fallback: só cria se a folha real (com o último frame) carregou.
    for (const spec of VILLAGE_ANIM_SPECS) {
      const last = spec.frames[spec.frames.length - 1];
      if (
        this.anims.exists(spec.key) ||
        !this.textures.exists(spec.texture) ||
        !this.textures.get(spec.texture).has(String(last))
      ) {
        continue;
      }
      this.anims.create({
        key: spec.key,
        frames: this.anims.generateFrameNumbers(spec.texture, { frames: [...spec.frames] }),
        frameRate: spec.frameRate,
        repeat: spec.repeat,
        ...(spec.repeatDelay !== undefined ? { repeatDelay: spec.repeatDelay } : {}),
      });
    }
  }

  private applyTextureFilters(): void {
    for (const spec of ALL_SPRITESHEET_SPECS) {
      if (!this.textures.exists(spec.key)) {
        continue;
      }
      const mode = LINEAR_TEXTURE_KEYS.includes(spec.key)
        ? Phaser.Textures.FilterMode.LINEAR
        : Phaser.Textures.FilterMode.NEAREST;
      this.textures.get(spec.key).setFilter(mode);
    }
  }

  private ensureFallbackTextures(): void {
    for (const spec of ALL_SPRITESHEET_SPECS) {
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

