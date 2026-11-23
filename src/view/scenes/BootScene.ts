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
  {
    key: 'village_hub_tiles',
    file: 'assets/sprites/village_hub_tiles.png',
    frameWidth: 32,
    frameHeight: 32,
    fallbackColor: 0x4b382a,
  },
  {
    key: 'village_hub_props',
    file: 'assets/sprites/village_hub_props.png',
    frameWidth: 32,
    frameHeight: 32,
    fallbackColor: 0x78350f,
  },
  {
    key: 'village_hub_props_large',
    file: 'assets/sprites/village_hub_props_large.png',
    frameWidth: 64,
    frameHeight: 64,
    fallbackColor: 0x92400e,
  },
  {
    key: 'village_hub_house',
    file: 'assets/sprites/village_hub_house.png',
    frameWidth: 224,
    frameHeight: 192,
    fallbackColor: 0x713f12,
  },
  {
    key: 'village_hub_gate',
    file: 'assets/sprites/village_hub_gate.png',
    frameWidth: 192,
    frameHeight: 160,
    fallbackColor: 0x57534e,
  },
  {
    key: 'npc_weapon_master',
    file: 'assets/sprites/npc_weapon_master.png',
    frameWidth: 80,
    frameHeight: 80,
    fallbackColor: 0x64748b,
  },
  {
    key: 'npc_lyra',
    file: 'assets/sprites/npc_lyra.png',
    frameWidth: 80,
    frameHeight: 80,
    fallbackColor: 0x15803d,
  },
  {
    key: 'npc_gorran',
    file: 'assets/sprites/npc_gorran.png',
    frameWidth: 80,
    frameHeight: 80,
    fallbackColor: 0xb45309,
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

const ALL_SPRITESHEET_SPECS: readonly SpritesheetSpec[] = [
  ...SPRITESHEET_SPECS,
  ...BIOME_SPRITESHEET_SPECS,
];

const DUNGEON_BASIC_TORCH_ANIM_KEY = 'dungeon_basic_torch';

const VILLAGE_GLOBAL_ANIMATIONS: readonly {
  key: string;
  texture: string;
  start: number;
  end: number;
  frameRate: number;
}[] = [
  { key: 'village_campfire_idle', texture: 'village_hub_props', start: 6, end: 9, frameRate: 8 },
  { key: 'village_brazier_idle', texture: 'village_hub_props', start: 10, end: 13, frameRate: 8 },
  { key: 'village_torch_idle', texture: 'village_hub_props', start: 14, end: 17, frameRate: 8 },
  { key: 'village_forge_idle', texture: 'village_hub_props', start: 18, end: 21, frameRate: 8 },
  {
    key: 'village_campfire_large_idle',
    texture: 'village_hub_props_large',
    start: 0,
    end: 3,
    frameRate: 8,
  },
  {
    key: 'village_forge_large_idle',
    texture: 'village_hub_props_large',
    start: 4,
    end: 7,
    frameRate: 8,
  },
  { key: 'npc_weapon_master_idle', texture: 'npc_weapon_master', start: 0, end: 3, frameRate: 5 },
  { key: 'npc_lyra_idle', texture: 'npc_lyra', start: 0, end: 3, frameRate: 5 },
  { key: 'npc_gorran_idle', texture: 'npc_gorran', start: 0, end: 3, frameRate: 5 },
  { key: 'npc_gorran_hammer', texture: 'npc_gorran', start: 4, end: 7, frameRate: 7 },
];

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

    const shouldStartTestArena =
      typeof window !== 'undefined' &&
      (() => {
        const params = new URLSearchParams(window.location.search);
        return (
          params.has('testArena') ||
          params.has('biome') ||
          params.has('map') ||
          params.has('seed')
        );
      })();

    if (shouldStartTestArena && 'DungeonScene' in this.scene.manager.keys) {
      this.scene.start('DungeonScene', { testArena: true });
    } else if ('HubScene' in this.scene.manager.keys) {
      this.scene.start('HubScene');
    } else if ('DungeonScene' in this.scene.manager.keys) {
      this.scene.start('DungeonScene');
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

    // Village Natal Hub props and NPC global animations (T-140).
    for (const anim of VILLAGE_GLOBAL_ANIMATIONS) {
      if (
        !this.anims.exists(anim.key) &&
        this.textures.exists(anim.texture) &&
        this.textures.get(anim.texture).has(String(anim.end))
      ) {
        this.anims.create({
          key: anim.key,
          frames: this.anims.generateFrameNumbers(anim.texture, {
            start: anim.start,
            end: anim.end,
          }),
          frameRate: anim.frameRate,
          repeat: -1,
        });
      }
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

