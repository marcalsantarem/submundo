import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GORRAN_HAMMER_IMPACT_FRAME,
  GORRAN_HAMMER_IMPACT_OFFSET,
  VILLAGE_ANIM_SPECS,
  VILLAGE_FOOTPRINTS,
  VILLAGE_FRAME_NAMES,
  VILLAGE_FRAME_SIZES,
  VILLAGE_FRAMES,
  VILLAGE_ORIGINS,
  VILLAGE_TEXTURE_KEYS,
} from '../../src/view/scenes/VillageAssets';

// T-140 (BRF-151): folhas da Vila Natal e dos NPCs carregadas pelo BootScene.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SPRITES_DIR = resolve(process.cwd(), 'public/assets/sprites');

interface AnimEntry {
  frames: number[];
  frameRate: number;
  repeat: number;
  repeatDelay?: number;
}

interface ManifestEntry {
  key: string;
  file: string;
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  frames: string[];
  origin?: { x: number; y: number };
  animations?: Record<string, AnimEntry>;
  footprints?: Record<string, Array<{ x: number; y: number; w: number; h: number }>>;
  hammerImpact?: { frame: number; frameName: string; dx: number; dy: number };
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8')) as T;
const manifest = readJson<{ sprites: Record<string, ManifestEntry> }>('public/assets/sprites/manifest.json');
const fragments = [
  readJson<{ sprites: Record<string, ManifestEntry> }>('scripts/art/out/village_hub.manifest.json'),
  readJson<{ sprites: Record<string, ManifestEntry> }>('scripts/art/out/village_npcs.manifest.json'),
];

function readPngSize(file: string): { width: number; height: number } {
  const buf = readFileSync(resolve(SPRITES_DIR, file));
  expect(buf.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('M9 village assets (T-140)', () => {
  it('declara as 14 folhas da Vila e dos NPCs', () => {
    expect(VILLAGE_TEXTURE_KEYS).toHaveLength(14);
  });

  it.each(VILLAGE_TEXTURE_KEYS)('%s: PNG existe e as dimensões batem com o manifest', (key) => {
    const entry = manifest.sprites[key];
    expect(entry, `manifest sem ${key}`).toBeDefined();
    expect(entry.file).toBe(`${key}.png`);
    expect(existsSync(resolve(SPRITES_DIR, entry.file))).toBe(true);
    const size = readPngSize(entry.file);
    expect(size).toEqual({ width: entry.width, height: entry.height });
    expect(entry.width % entry.frameWidth).toBe(0);
    expect(entry.height % entry.frameHeight).toBe(0);
    expect((entry.width / entry.frameWidth) * (entry.height / entry.frameHeight)).toBe(entry.frames.length);
  });

  it('o manifest contém os fragmentos sem alteração', () => {
    for (const fragment of fragments) {
      for (const [key, entry] of Object.entries(fragment.sprites)) {
        expect(manifest.sprites[key]).toEqual(entry);
      }
    }
  });

  it('VillageAssets espelha frames, tamanhos, origens e footprints do manifest', () => {
    for (const key of VILLAGE_TEXTURE_KEYS) {
      const entry = manifest.sprites[key];
      expect([...VILLAGE_FRAME_NAMES[key]]).toEqual(entry.frames);
      entry.frames.forEach((name, i) => {
        expect((VILLAGE_FRAMES[key] as Record<string, number>)[name]).toBe(i);
      });
      expect(VILLAGE_FRAME_SIZES[key]).toEqual({ frameWidth: entry.frameWidth, frameHeight: entry.frameHeight });
      expect(VILLAGE_ORIGINS[key]).toEqual(entry.origin ?? { x: 0, y: 0 });
      expect((VILLAGE_FOOTPRINTS as Record<string, unknown>)[key]).toEqual(entry.footprints);
    }
  });

  it('as animações seguem os fps do fragmento', () => {
    for (const spec of VILLAGE_ANIM_SPECS) {
      const entry = manifest.sprites[spec.texture];
      const animName = spec.key.slice(`${spec.texture}_`.length) || spec.key.replace('village_hub_', '');
      const anim = entry.animations?.[animName];
      expect(anim, `${spec.key} sem animação ${animName}`).toBeDefined();
      expect([...spec.frames]).toEqual(anim!.frames);
      expect(spec.frameRate).toBe(anim!.frameRate);
      expect(spec.repeat).toBe(anim!.repeat);
      expect(spec.repeatDelay).toBe(anim!.repeatDelay);
    }
    expect(VILLAGE_ANIM_SPECS).toHaveLength(8);
  });

  it('impacto do martelo do Gorran bate com hammerImpact', () => {
    const impact = manifest.sprites.village_npc_gorran.hammerImpact!;
    expect(GORRAN_HAMMER_IMPACT_FRAME).toBe(impact.frame);
    expect(VILLAGE_FRAMES.village_npc_gorran.hammer5).toBe(impact.frame);
    expect(GORRAN_HAMMER_IMPACT_OFFSET).toEqual({ dx: impact.dx, dy: impact.dy });
  });
});
