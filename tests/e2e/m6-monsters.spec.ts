import { existsSync, mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { GAME_VERSION } from '../../src/version';
import {
  DESKTOP_VIEWPORT,
  MOBILE_LANDSCAPE_VIEWPORT,
  assertLandscapeCanvas,
  openMobileLandscapePage,
} from './helpers/landscape';

const SCREENSHOT_DIR = join(tmpdir(), 'qa-m6');

const M6_MONSTER_SPECS = [
  { key: 'slime', width: 1600, height: 80, frameWidth: 80, frameHeight: 80 },
  { key: 'cave_bat', width: 1600, height: 80, frameWidth: 80, frameHeight: 80 },
  { key: 'wolf', width: 1600, height: 80, frameWidth: 80, frameHeight: 80 },
  { key: 'skeleton', width: 1600, height: 80, frameWidth: 80, frameHeight: 80 },
  { key: 'skeleton_archer', width: 1600, height: 80, frameWidth: 80, frameHeight: 80 },
  { key: 'wolf_alpha', width: 1600, height: 80, frameWidth: 80, frameHeight: 80 },
  { key: 'skeleton_chief', width: 1600, height: 80, frameWidth: 80, frameHeight: 80 },
  { key: 'karnak', width: 1920, height: 96, frameWidth: 96, frameHeight: 96 },
] as const;

// Masmorra Básica 2.5D (Decision #17, T-118): 32x32 tiles/props, 32x64 tall props.
// Phaser's frameTotal includes the implicit __BASE frame (+1).
const DUNGEON_BASIC_SPECS = [
  { key: 'dungeon_basic_tiles', frames: 34, frameWidth: 32, frameHeight: 32 },
  { key: 'dungeon_basic_props', frames: 11, frameWidth: 32, frameHeight: 32 },
  { key: 'dungeon_basic_props_tall', frames: 2, frameWidth: 32, frameHeight: 64 },
] as const;

const ANIM_STATES = [
  { suffix: 'idle', count: 4 },
  { suffix: 'walk', count: 6 },
  { suffix: 'attack', count: 6 },
  { suffix: 'death', count: 4 },
] as const;

test.describe('SUBMUNDO M6 — Monsters & Bosses 20f testArena E2E (PC 960x540 & Mobile Landscape 844x390)', () => {
  test('validates testArena boot, tiled room bg, hero_living, 8 textures (frameTotal=21), 32 anims, dungeon_basic_* textures, Wave 1 = slimes + wolves only (T-123), PC/Mobile Landscape screenshots', async ({
    page,
    browser,
    baseURL,
  }) => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const notFoundUrls: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    page.on('response', (res) => {
      if (res.status() === 404) {
        notFoundUrls.push(res.url());
      }
    });

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto('/');

    await expect(page).toHaveTitle(`SUBMUNDO v${GAME_VERSION}`);

    await page.waitForFunction(
      () =>
        typeof window.__SUBMUNDO_DEBUG__ !== 'undefined' &&
        window.__SUBMUNDO_DEBUG__.getMonsters().length > 0,
      undefined,
      { timeout: 10000 }
    );

    await assertLandscapeCanvas(page, DESKTOP_VIEWPORT);

    const wave1AndAssets = await page.evaluate(([specs, dungeonSpecs]) => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      const scene = dbg.scene as unknown as {
        isTestArena: boolean;
        testArenaWave: number;
        cameras: {
          main: {
            backgroundColor: { red: number; green: number; blue: number };
          };
        };
        heroSprite?: { texture: { key: string } };
        testArenaObjects?: unknown[];
        textures: {
          exists: (k: string) => boolean;
          get: (k: string) => {
            source: Array<{ width: number; height: number }>;
            frameTotal: number;
            has: (frame: string) => boolean;
            get: (frame: number) => { width: number; height: number };
          };
        };
        anims: {
          exists: (k: string) => boolean;
          get: (k: string) => { frames: unknown[] } | undefined;
        };
      };

      const bg = scene.cameras.main.backgroundColor;
      const textures = specs.map((s) => {
        if (!scene.textures.exists(s.key)) {
          return { key: s.key, exists: false };
        }
        const tex = scene.textures.get(s.key);
        const f0 = tex.get(0);
        return {
          key: s.key,
          exists: true,
          width: tex.source[0]?.width ?? 0,
          height: tex.source[0]?.height ?? 0,
          frameTotal: tex.frameTotal,
          frameWidth: f0?.width ?? 0,
          frameHeight: f0?.height ?? 0,
        };
      });

      const dungeonTextures = dungeonSpecs.map((s) => {
        if (!scene.textures.exists(s.key)) {
          return { key: s.key, exists: false };
        }
        const tex = scene.textures.get(s.key);
        const f0 = tex.get(0);
        return {
          key: s.key,
          exists: true,
          frames: tex.frameTotal - 1,
          hasLastFrame: tex.has(String(s.frames - 1)),
          frameWidth: f0?.width ?? 0,
          frameHeight: f0?.height ?? 0,
        };
      });
      const torchAnimFrames = scene.anims.exists('dungeon_basic_torch')
        ? scene.anims.get('dungeon_basic_torch')?.frames.length ?? 0
        : -1;

      const animLengths: Record<string, number> = {};
      for (const s of specs) {
        for (const st of ['idle', 'walk', 'attack', 'death']) {
          const animKey = `${s.key}_${st}`;
          animLengths[animKey] = scene.anims.exists(animKey)
            ? scene.anims.get(animKey)?.frames.length ?? 0
            : -1;
        }
      }

      const wave1Monsters = dbg.getMonsters().map((m) => ({
        defId: m.defId,
        isAlive: m.isAlive,
      }));

      return {
        isTestArena: scene.isTestArena,
        testArenaWave: scene.testArenaWave,
        bgRgb: [bg.red, bg.green, bg.blue],
        heroTextureKey: scene.heroSprite?.texture.key ?? '',
        textures,
        dungeonTextures,
        torchAnimFrames,
        // T-128: the testArena renders the procedural map (generateDungeonMap).
        map: (() => {
          const m = dbg.getDungeonMap();
          return m
            ? { mode: m.mode, cols: m.cols, rows: m.rows, zones: m.zones.length, rooms: m.rooms.length }
            : null;
        })(),
        roomObjectCount: scene.testArenaObjects?.length ?? 0,
        animLengths,
        wave1Monsters,
      };
    }, [M6_MONSTER_SPECS, DUNGEON_BASIC_SPECS] as const);

    expect(wave1AndAssets.isTestArena).toBe(true);
    expect(wave1AndAssets.testArenaWave).toBe(1);
    // Camera clear color stays #000000; the tiled room now covers the centre.
    expect(wave1AndAssets.bgRgb).toEqual([0, 0, 0]);
    expect(wave1AndAssets.heroTextureKey).toBe('hero_living');

    for (const spec of DUNGEON_BASIC_SPECS) {
      expect(
        wave1AndAssets.dungeonTextures.find((t) => t.key === spec.key)
      ).toEqual({
        key: spec.key,
        exists: true,
        frames: spec.frames,
        hasLastFrame: true,
        frameWidth: spec.frameWidth,
        frameHeight: spec.frameHeight,
      });
    }
    expect(wave1AndAssets.torchAnimFrames).toBe(4);

    expect(wave1AndAssets.map).not.toBeNull();
    expect(wave1AndAssets.roomObjectCount).toBeGreaterThan(0);
    // New map (Decision #20, T-127/T-128): default `?map=rooms`, 3 zones (waves 1-3).
    const map0 = wave1AndAssets.map!;
    expect(map0.mode).toBe('rooms');
    expect(map0.zones).toBe(3);
    expect(map0.rooms).toBeGreaterThanOrEqual(3);
    expect(map0.cols).toBeGreaterThan(0);
    expect(map0.rows).toBeGreaterThan(0);
    // Sample the central screen area (camera centred on the hero inside room 1).
    const room = { x: 160, y: 120, width: 640, height: 300 };

    // The centre of the screen is no longer pure #000000: sample rendered pixels
    // (screenshot decoded through a 2D canvas in the page).
    const roomShot = await page.screenshot();
    const nonBlackSamples = await page.evaluate(
      async ({ b64, r }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        let nonBlack = 0;
        let total = 0;
        for (let i = 1; i <= 7; i++) {
          for (let j = 1; j <= 5; j++) {
            const px = Math.round(r.x + (r.width * i) / 8);
            const py = Math.round(r.y + (r.height * j) / 6);
            const d = ctx.getImageData(px, py, 1, 1).data;
            total++;
            if (d[0] + d[1] + d[2] > 0) nonBlack++;
          }
        }
        return { nonBlack, total };
      },
      { b64: roomShot.toString('base64'), r: room }
    );
    expect(nonBlackSamples.nonBlack).toBeGreaterThan(nonBlackSamples.total / 2);

    for (const spec of M6_MONSTER_SPECS) {
      const texInfo = wave1AndAssets.textures.find((t) => t.key === spec.key);
      expect(texInfo).toEqual({
        key: spec.key,
        exists: true,
        width: spec.width,
        height: spec.height,
        frameTotal: 21,
        frameWidth: spec.frameWidth,
        frameHeight: spec.frameHeight,
      });

      for (const st of ANIM_STATES) {
        expect(wave1AndAssets.animLengths[`${spec.key}_${st.suffix}`]).toBe(
          st.count
        );
      }
    }

    // Wave 1 (room 1 of the test dungeon, T-123): only slimes and wolves.
    const wave1Ids = wave1AndAssets.wave1Monsters.map((m) => m.defId);
    expect(wave1Ids.length).toBeGreaterThan(0);
    expect([...new Set(wave1Ids)].sort()).toEqual(['slime', 'wolf']);
    expect(wave1AndAssets.wave1Monsters.every((m) => m.isAlive)).toBe(true);

    // Each wave-1 monster is rendered with its own texture.
    const wave1Textures = await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      const scene = dbg.scene as unknown as {
        monsterVisuals?: Map<string, { sprite: { texture: { key: string } } }>;
      };
      return dbg
        .getMonsters()
        .map((m) => [m.defId, scene.monsterVisuals?.get(m.instanceId)?.sprite.texture.key ?? '']);
    });
    for (const [defId, key] of wave1Textures) {
      expect(key).toBe(defId);
    }

    const pcWave1Path = join(SCREENSHOT_DIR, 'm6_pc_wave1.png');
    await page.screenshot({ path: pcWave1Path });
    expect(existsSync(pcWave1Path)).toBe(true);
    expect(statSync(pcWave1Path).size).toBeGreaterThan(1024);

    // Mobile Landscape viewport (844x390, hasTouch: true)
    const { context: mobileContext, page: mobilePage } =
      await openMobileLandscapePage(browser, {
        baseURL,
        consoleErrors,
        pageErrors,
        notFoundUrls,
      });

    try {
      await mobilePage.goto('/');
      await mobilePage.waitForFunction(
        () =>
          typeof window.__SUBMUNDO_DEBUG__ !== 'undefined' &&
          window.__SUBMUNDO_DEBUG__.getMonsters().length > 0,
        undefined,
        { timeout: 10000 }
      );

      await assertLandscapeCanvas(mobilePage, MOBILE_LANDSCAPE_VIEWPORT);

      const mobileWave1 = await mobilePage.evaluate(() => {
        const dbg = window.__SUBMUNDO_DEBUG__!;
        const scene = dbg.scene as unknown as { testArenaWave?: number };
        return {
          wave: scene.testArenaWave,
          defIds: [...new Set(dbg.getMonsters().map((m) => m.defId))].sort(),
        };
      });
      expect(mobileWave1).toEqual({ wave: 1, defIds: ['slime', 'wolf'] });

      await mobilePage.waitForTimeout(200);
      const mobileWave1Path = join(SCREENSHOT_DIR, 'm6_mobile_wave1.png');
      await mobilePage.screenshot({ path: mobileWave1Path });
      expect(existsSync(mobileWave1Path)).toBe(true);
      expect(statSync(mobileWave1Path).size).toBeGreaterThan(1024);
    } finally {
      await mobileContext.close();
    }

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(notFoundUrls).toEqual([]);
  });
});
