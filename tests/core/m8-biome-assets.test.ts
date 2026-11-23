import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// T-075 (BRF-144): the 7 approved biomes (Decision #21) loaded by BootScene.
const BIOME_IDS = [
  'village',
  'herb_field',
  'village_grotto',
  'village_mine',
  'mine_depths',
  'ancient_seal',
  'submundo_abyss',
] as const;
const SHEETS = ['tiles', 'doors', 'props', 'props_tall'] as const;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SPRITES_DIR = resolve(process.cwd(), 'public/assets/sprites');

interface ManifestEntry {
  key: string;
  file: string;
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  frames: string[];
  animations?: { torch?: { frames: number[]; frameRate: number; repeat: number } };
}

const manifest = JSON.parse(readFileSync(resolve(SPRITES_DIR, 'manifest.json'), 'utf8')) as {
  sprites: Record<string, ManifestEntry>;
};

function readPngSize(file: string): { width: number; height: number } {
  const buf = readFileSync(resolve(SPRITES_DIR, file));
  expect(buf.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const allKeys = BIOME_IDS.flatMap((id) => SHEETS.map((sheet) => `biome_${id}_${sheet}`));

describe('M8 biome assets (T-075)', () => {
  it('has the 28 biome PNGs on disk and in the manifest', () => {
    expect(allKeys).toHaveLength(28);
    for (const key of allKeys) {
      expect(existsSync(resolve(SPRITES_DIR, `${key}.png`)), key).toBe(true);
      const entry = manifest.sprites[key];
      expect(entry, key).toBeDefined();
      expect(entry.key).toBe(key);
      expect(entry.file).toBe(`${key}.png`);
    }
  });

  it('PNG dimensions match the manifest (width = frames x frameWidth)', () => {
    for (const key of allKeys) {
      const entry = manifest.sprites[key];
      const png = readPngSize(entry.file);
      expect(png, key).toEqual({ width: entry.width, height: entry.height });
      expect(entry.width, key).toBe(entry.frames.length * entry.frameWidth);
      expect(entry.height, key).toBe(entry.frameHeight);
      expect(entry.frameWidth, key).toBe(32);
      expect(entry.frameHeight, key).toBe(key.endsWith('_props_tall') ? 64 : 32);
    }
  });

  it('tiles/doors sheets have 34/43 frames with the same names as dungeon_basic_*', () => {
    const baseTiles = manifest.sprites.dungeon_basic_tiles.frames;
    const baseDoors = manifest.sprites.dungeon_basic_doors.frames;
    expect(baseTiles).toHaveLength(34);
    expect(baseDoors).toHaveLength(43);
    for (const id of BIOME_IDS) {
      expect(manifest.sprites[`biome_${id}_tiles`].frames, id).toEqual(baseTiles);
      expect(manifest.sprites[`biome_${id}_doors`].frames, id).toEqual(baseDoors);
    }
  });

  it('props start with torch_0..3 and BootScene torch frameRates match the manifest', () => {
    const bootSource = readFileSync(resolve(process.cwd(), 'src/view/scenes/BootScene.ts'), 'utf8');
    for (const id of BIOME_IDS) {
      const props = manifest.sprites[`biome_${id}_props`];
      expect(props.frames.slice(0, 4), id).toEqual(['torch_0', 'torch_1', 'torch_2', 'torch_3']);
      const torch = props.animations?.torch;
      expect(torch, id).toBeDefined();
      expect(torch?.frames).toEqual([0, 1, 2, 3]);
      expect(torch?.repeat).toBe(-1);
      const match = new RegExp(`\\b${id}: \\{[^}]*torchFrameRate: (\\d+)`).exec(bootSource);
      expect(match, id).not.toBeNull();
      expect(Number(match?.[1]), id).toBe(torch?.frameRate);
    }
  });
});
