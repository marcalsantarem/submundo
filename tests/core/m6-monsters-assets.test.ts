import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

interface ExpectedMonsterSheet {
  key: string;
  file: string;
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
}

const EXPECTED_M6_SHEETS: readonly ExpectedMonsterSheet[] = [
  { key: 'slime', file: 'assets/sprites/slime.png', width: 1600, height: 80, frameWidth: 80, frameHeight: 80 },
  { key: 'cave_bat', file: 'assets/sprites/cave_bat.png', width: 1600, height: 80, frameWidth: 80, frameHeight: 80 },
  { key: 'wolf', file: 'assets/sprites/wolf.png', width: 1600, height: 80, frameWidth: 80, frameHeight: 80 },
  { key: 'skeleton', file: 'assets/sprites/skeleton.png', width: 1600, height: 80, frameWidth: 80, frameHeight: 80 },
  { key: 'skeleton_archer', file: 'assets/sprites/skeleton_archer.png', width: 1600, height: 80, frameWidth: 80, frameHeight: 80 },
  { key: 'wolf_alpha', file: 'assets/sprites/wolf_alpha.png', width: 1600, height: 80, frameWidth: 80, frameHeight: 80 },
  { key: 'skeleton_chief', file: 'assets/sprites/skeleton_chief.png', width: 1600, height: 80, frameWidth: 80, frameHeight: 80 },
  { key: 'karnak', file: 'assets/sprites/karnak.png', width: 1920, height: 96, frameWidth: 96, frameHeight: 96 },
];

const EXPECTED_MONSTER_FRAME_NAMES: readonly string[] = [
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
  'death0',
  'death1',
  'death2',
  'death3',
];

interface PngHeaderInfo {
  signatureValid: boolean;
  ihdrLength: number;
  chunkType: string;
  width: number;
  height: number;
}

interface ManifestMonsterEntry {
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
  sprites: Record<string, ManifestMonsterEntry>;
}

interface MonsterJsonEntry {
  id: string;
  name: string;
  type: 'normal' | 'boss';
  attackType: 'melee' | 'ranged';
  maxHp: number;
  attack: number;
  defense: number;
  moveSpeed: number;
  attackRange: number;
  attackCooldownMs: number;
  soulReward: number;
  spriteKey: string;
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
  };
}

describe('M6 Monsters & Bosses 20f Assets and Code Contracts (T-071b)', () => {
  it('validates PNG signature and IHDR dimensions for all 8 M6 spritesheets', () => {
    for (const spec of EXPECTED_M6_SHEETS) {
      const header = readPngHeader(`public/${spec.file}`);
      expect(header.signatureValid).toBe(true);
      expect(header.ihdrLength).toBe(13);
      expect(header.chunkType).toBe('IHDR');
      expect(header.width).toBe(spec.width);
      expect(header.height).toBe(spec.height);
    }
  });

  it('validates manifest.json has all 8 M6 monsters/bosses with 20 canonical frames', () => {
    const raw = readFileSync(
      resolve(process.cwd(), 'public/assets/sprites/manifest.json'),
      'utf-8'
    );
    const manifest = JSON.parse(raw) as SpritesManifest;

    for (const spec of EXPECTED_M6_SHEETS) {
      const entry = manifest.sprites[spec.key];
      expect(entry).toBeDefined();
      expect(entry.key).toBe(spec.key);
      expect(entry.width).toBe(spec.width);
      expect(entry.height).toBe(spec.height);
      expect(entry.frameWidth).toBe(spec.frameWidth);
      expect(entry.frameHeight).toBe(spec.frameHeight);
      expect(entry.frames).toEqual([...EXPECTED_MONSTER_FRAME_NAMES]);
    }
  });

  it('validates CombatVfx.ts registers createMonsterAnimSpecs and ANIMATED_MONSTER_KEYS for all 8 M6 keys', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/view/sprites/CombatVfx.ts'),
      'utf-8'
    );

    const setMatch = source.match(
      /const ANIMATED_MONSTER_KEYS\s*=\s*new Set<string>\(\[([\s\S]*?)\]\);/
    );
    expect(setMatch).not.toBeNull();
    const keyMatches = Array.from(setMatch![1].matchAll(/'([^']+)'/g)).map(
      (m) => m[1]
    );

    for (const spec of EXPECTED_M6_SHEETS) {
      const animSpecRegex = new RegExp(
        `createMonsterAnimSpecs\\(\\s*'${spec.key}'`
      );
      expect(source).toMatch(animSpecRegex);
      expect(keyMatches).toContain(spec.key);
    }
  });

  it('validates BootScene.ts SPRITESHEET_SPECS preloads all 8 M6 spritesheets with exact frame sizes', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/view/scenes/BootScene.ts'),
      'utf-8'
    );

    for (const spec of EXPECTED_M6_SHEETS) {
      const blockRegex = new RegExp(
        `\\{\\s*key:\\s*'${spec.key}'[\\s\\S]*?file:\\s*'${spec.file}'[\\s\\S]*?frameWidth:\\s*${spec.frameWidth}[\\s\\S]*?frameHeight:\\s*${spec.frameHeight}[\\s\\S]*?\\}`
      );
      expect(source).toMatch(blockRegex);
    }
  });

  it('validates monsters.json contains all 12 valid records (4 legacy + 5 M6 common + 3 M6 bosses)', () => {
    const raw = readFileSync(
      resolve(process.cwd(), 'src/data/monsters.json'),
      'utf-8'
    );
    const monsters = JSON.parse(raw) as MonsterJsonEntry[];
    expect(monsters).toHaveLength(12);

    const expectedIds = [
      'abyssal_slime',
      'bone_sentinel',
      'infernal_warden',
      'abyss_herald',
      'slime',
      'cave_bat',
      'wolf',
      'skeleton',
      'skeleton_archer',
      'wolf_alpha',
      'karnak',
      'skeleton_chief',
    ];
    const ids = monsters.map((m) => m.id);
    for (const expectedId of expectedIds) {
      expect(ids).toContain(expectedId);
    }

    for (const monster of monsters) {
      expect(monster.id.length).toBeGreaterThan(0);
      expect(monster.name.length).toBeGreaterThan(0);
      expect(['normal', 'boss']).toContain(monster.type);
      expect(['melee', 'ranged']).toContain(monster.attackType);
      expect(monster.maxHp).toBeGreaterThan(0);
      expect(monster.attack).toBeGreaterThan(0);
      expect(monster.defense).toBeGreaterThanOrEqual(0);
      expect(monster.moveSpeed).toBeGreaterThan(0);
      expect(monster.attackRange).toBeGreaterThan(0);
      expect(monster.attackCooldownMs).toBeGreaterThan(0);
      expect(monster.soulReward).toBeGreaterThanOrEqual(0);
      expect(monster.spriteKey.length).toBeGreaterThan(0);
    }
  });
});
