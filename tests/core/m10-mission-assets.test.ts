import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MISSION_ANIM_SPECS,
  MISSION_ANIMS,
  MISSION_FRAME_SIZES,
  MISSION_FRAMES,
  MISSION_ORIGINS,
  MISSION_TEXTURE_KEYS,
  QUEST_MARKER_HEAD_OFFSET_Y,
} from '../../src/view/scenes/MissionAssets';

// T-148 (BRF-161): folhas das missões do prólogo carregadas pelo BootScene.
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
  origin?: { x: number; y: number };
  animations?: Record<string, { frames: number[]; frameRate: number; repeat: number }>;
  headOffsetY?: number;
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8')) as T;
const manifest = readJson<{ sprites: Record<string, ManifestEntry> }>('public/assets/sprites/manifest.json');
const fragment = readJson<{ sprites: Record<string, ManifestEntry> }>('scripts/art/out/mission_art.manifest.json');

function readPngSize(file: string): { width: number; height: number } {
  const buf = readFileSync(resolve(SPRITES_DIR, file));
  expect(buf.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('M10 mission assets (T-148)', () => {
  it('declara as 5 folhas das missões', () => {
    expect(MISSION_TEXTURE_KEYS).toEqual(['quest_markers', 'mission_herb', 'mission_tools', 'mission_strange', 'mission_icons']);
  });

  it.each(MISSION_TEXTURE_KEYS)('%s: PNG existe e as dimensões batem com o manifest', (key) => {
    const entry = manifest.sprites[key];
    expect(entry).toBeDefined();
    expect(entry.file).toBe(`${key}.png`);
    expect(existsSync(resolve(SPRITES_DIR, entry.file))).toBe(true);
    expect(readPngSize(entry.file)).toEqual({ width: entry.width, height: entry.height });
    expect(entry.width % entry.frameWidth).toBe(0);
    expect(entry.height % entry.frameHeight).toBe(0);
    expect((entry.width / entry.frameWidth) * (entry.height / entry.frameHeight)).toBe(entry.frames.length);
    expect(MISSION_FRAME_SIZES[key]).toEqual({ frameWidth: entry.frameWidth, frameHeight: entry.frameHeight });
    expect(MISSION_ORIGINS[key]).toEqual(entry.origin);
  });

  it('o manifest contém o fragmento inteiro sem alterações', () => {
    for (const [key, entry] of Object.entries(fragment.sprites)) {
      expect(manifest.sprites[key]).toEqual(entry);
    }
  });

  it('frames nomeados batem com o manifest', () => {
    for (const key of MISSION_TEXTURE_KEYS) {
      for (const [name, index] of Object.entries(MISSION_FRAMES[key] as Record<string, number>)) {
        expect(manifest.sprites[key].frames[index]).toBe(name);
      }
    }
    expect(MISSION_FRAMES.mission_herb.picked).toBe(4);
    expect(MISSION_FRAMES.mission_tools.empty).toBe(4);
    expect(MISSION_FRAMES.mission_icons).toEqual({ icon_herb: 0, icon_tools: 1 });
  });

  it('animações seguem frames e fps do fragmento', () => {
    expect(MISSION_ANIM_SPECS.map((a) => a.key).sort()).toEqual(Object.values(MISSION_ANIMS).sort());
    for (const spec of MISSION_ANIM_SPECS) {
      const animName = spec.key.replace(/^quest_marker_/, '').replace(/^mission_(herb|tools|strange)_/, '');
      const src = manifest.sprites[spec.texture].animations?.[animName];
      expect(src, spec.key).toBeDefined();
      expect([...spec.frames]).toEqual(src!.frames);
      expect(spec.frameRate).toBe(src!.frameRate);
      expect(spec.repeat).toBe(src!.repeat);
    }
  });

  it('deslocamento do marcador sobre a cabeça vem do fragmento', () => {
    expect(QUEST_MARKER_HEAD_OFFSET_Y).toBe(manifest.sprites.quest_markers.headOffsetY);
  });
});
