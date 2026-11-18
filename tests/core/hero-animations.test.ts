import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const EXPECTED_HERO_FRAME_NAMES: readonly string[] = [
  'idle0',
  'idle1',
  'idle2',
  'idle3',
  'walk0',
  'walk1',
  'walk2',
  'walk3',
  'walk4',
  'walk5',
  'attack0',
  'attack1',
  'attack2',
  'attack3',
  'attack4',
  'attack5',
  'dash0',
  'dash1',
  'dash2',
  'dash3',
  'hit0',
  'hit1',
  'hit2',
  'hit3',
];

interface PngHeaderInfo {
  signatureValid: boolean;
  ihdrLength: number;
  chunkType: string;
  width: number;
  height: number;
  byteLength: number;
}

interface HandAnchorEntry {
  dx: number;
  dy: number;
  rot: number;
}

interface HeroSpriteManifestEntry {
  key: string;
  file: string;
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  frames: string[];
  handAnchors: HandAnchorEntry[];
}

interface WeaponsSpriteManifestEntry {
  key: string;
  file: string;
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  frames: string[];
}

interface SpritesManifest {
  version: string;
  sprites: {
    hero_living: HeroSpriteManifestEntry;
    hero_wraith: HeroSpriteManifestEntry;
    weapons: WeaponsSpriteManifestEntry;
  };
}

function readPngHeader(relativePath: string): PngHeaderInfo {
  const filePath = resolve(process.cwd(), relativePath);
  const buf = readFileSync(filePath);
  if (buf.length < 33) {
    throw new Error(`PNG file too small (${buf.length} bytes): ${relativePath}`);
  }

  return {
    signatureValid: buf.subarray(0, 8).equals(PNG_SIGNATURE),
    ihdrLength: buf.readUInt32BE(8),
    chunkType: buf.toString('ascii', 12, 16),
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    byteLength: buf.length,
  };
}

function loadSpritesManifest(): SpritesManifest {
  const manifestPath = resolve(
    process.cwd(),
    'public/assets/sprites/manifest.json'
  );
  const raw = readFileSync(manifestPath, 'utf-8');
  return JSON.parse(raw) as SpritesManifest;
}

function parseHeroHandAnchorsFromSource(source: string): HandAnchorEntry[] {
  const blockMatch = source.match(
    /export const HERO_HAND_ANCHORS\b[\s\S]*?=\s*\[([\s\S]*?)\]\s*as const;/
  );
  if (!blockMatch) {
    throw new Error('HERO_HAND_ANCHORS declaration not found in HeroWeaponRig.ts');
  }

  const anchors: HandAnchorEntry[] = [];
  const entryRegex =
    /\{\s*dx:\s*(-?\d+(?:\.\d+)?)\s*,\s*dy:\s*(-?\d+(?:\.\d+)?)\s*,\s*rot:\s*(-?\d+(?:\.\d+)?)\s*\}/g;

  for (const match of blockMatch[1].matchAll(entryRegex)) {
    anchors.push({
      dx: Number(match[1]),
      dy: Number(match[2]),
      rot: Number(match[3]),
    });
  }

  return anchors;
}

describe('Hero 24-Frame Spritesheets, Manifest & Hand Anchors Integrity (T-090)', () => {
  it('validates PNG signatures and IHDR dimensions for hero_living (1920x80), hero_wraith (1920x80), and weapons (192x48)', () => {
    const heroLiving = readPngHeader('public/assets/sprites/hero_living.png');
    const heroWraith = readPngHeader('public/assets/sprites/hero_wraith.png');
    const weapons = readPngHeader('public/assets/sprites/weapons.png');

    for (const info of [heroLiving, heroWraith, weapons]) {
      expect(info.signatureValid).toBe(true);
      expect(info.chunkType).toBe('IHDR');
      expect(info.ihdrLength).toBe(13);
      expect(info.byteLength).toBeGreaterThan(1024);
    }

    expect({ width: heroLiving.width, height: heroLiving.height }).toEqual({
      width: 1920,
      height: 80,
    });
    expect({ width: heroWraith.width, height: heroWraith.height }).toEqual({
      width: 1920,
      height: 80,
    });
    expect({ width: weapons.width, height: weapons.height }).toEqual({
      width: 192,
      height: 48,
    });
  });

  it('validates 24 canonical frame names and 24 finite handAnchors in manifest.json for both hero_living and hero_wraith', () => {
    const manifest = loadSpritesManifest();

    for (const key of ['hero_living', 'hero_wraith'] as const) {
      const entry = manifest.sprites[key];
      expect(entry.key).toBe(key);
      expect(entry.file).toBe(`${key}.png`);
      expect(entry.width).toBe(1920);
      expect(entry.height).toBe(80);
      expect(entry.frameWidth).toBe(80);
      expect(entry.frameHeight).toBe(80);
      expect(entry.frames).toHaveLength(24);
      expect(entry.frames).toEqual(EXPECTED_HERO_FRAME_NAMES);

      expect(entry.handAnchors).toHaveLength(24);
      for (const anchor of entry.handAnchors) {
        expect(Number.isFinite(anchor.dx)).toBe(true);
        expect(Number.isFinite(anchor.dy)).toBe(true);
        expect(Number.isFinite(anchor.rot)).toBe(true);
      }
    }

    expect(manifest.sprites.weapons.width).toBe(192);
    expect(manifest.sprites.weapons.height).toBe(48);
    expect(manifest.sprites.weapons.frameWidth).toBe(48);
    expect(manifest.sprites.weapons.frameHeight).toBe(48);
    expect(manifest.sprites.weapons.frames).toHaveLength(4);
  });

  it('guarantees HERO_HAND_ANCHORS in HeroWeaponRig.ts matches all 24 handAnchors in manifest.json with zero drift', () => {
    const manifest = loadSpritesManifest();
    const rigPath = resolve(process.cwd(), 'src/view/sprites/HeroWeaponRig.ts');
    const rigSource = readFileSync(rigPath, 'utf-8');
    const rigAnchors = parseHeroHandAnchorsFromSource(rigSource);

    expect(rigAnchors).toHaveLength(24);
    expect(rigAnchors).toEqual(manifest.sprites.hero_living.handAnchors);
    expect(rigAnchors).toEqual(manifest.sprites.hero_wraith.handAnchors);
  });

  it('guarantees CombatVfx.ts registers all 10 hero animations with exact 24-frame index ranges (0..23)', () => {
    const vfxPath = resolve(process.cwd(), 'src/view/sprites/CombatVfx.ts');
    const vfxSource = readFileSync(vfxPath, 'utf-8');

    const expectedSpecs: ReadonlyArray<{
      key: string;
      texture: string;
      frames: number[];
    }> = [
      { key: 'hero_living_idle', texture: 'hero_living', frames: [0, 1, 2, 3] },
      {
        key: 'hero_living_walk',
        texture: 'hero_living',
        frames: [4, 5, 6, 7, 8, 9],
      },
      {
        key: 'hero_living_attack',
        texture: 'hero_living',
        frames: [10, 11, 12, 13, 14, 15],
      },
      {
        key: 'hero_living_dash',
        texture: 'hero_living',
        frames: [16, 17, 18, 19],
      },
      {
        key: 'hero_living_hit',
        texture: 'hero_living',
        frames: [20, 21, 22, 23],
      },
      { key: 'hero_wraith_idle', texture: 'hero_wraith', frames: [0, 1, 2, 3] },
      {
        key: 'hero_wraith_walk',
        texture: 'hero_wraith',
        frames: [4, 5, 6, 7, 8, 9],
      },
      {
        key: 'hero_wraith_attack',
        texture: 'hero_wraith',
        frames: [10, 11, 12, 13, 14, 15],
      },
      {
        key: 'hero_wraith_dash',
        texture: 'hero_wraith',
        frames: [16, 17, 18, 19],
      },
      {
        key: 'hero_wraith_hit',
        texture: 'hero_wraith',
        frames: [20, 21, 22, 23],
      },
    ];

    for (const spec of expectedSpecs) {
      const pattern = new RegExp(
        `key:\\s*'${spec.key}'\\s*,\\s*texture:\\s*'([^']+)'\\s*,\\s*frames:\\s*\\[([^\\]]+)\\]`
      );
      const match = vfxSource.match(pattern);
      expect(match).not.toBeNull();
      expect(match?.[1]).toBe(spec.texture);

      const parsedFrames = (match?.[2] ?? '')
        .split(',')
        .map((part) => Number(part.trim()));
      expect(parsedFrames).toEqual(spec.frames);
    }

    const footstepMatch = vfxSource.match(
      /HERO_WALK_FOOTSTEP_FRAMES[^=]*=\s*\[([^\]]+)\]/
    );
    expect(footstepMatch).not.toBeNull();
    const footstepFrames = (footstepMatch?.[1] ?? '')
      .split(',')
      .map((part) => Number(part.trim()));
    expect(footstepFrames).toEqual([4, 7]);
  });
});
