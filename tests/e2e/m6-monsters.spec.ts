import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { GAME_VERSION } from '../../src/version';

const SCREENSHOT_DIR = '/tmp/qa-m6';

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

const ANIM_STATES = [
  { suffix: 'idle', count: 4 },
  { suffix: 'walk', count: 6 },
  { suffix: 'attack', count: 6 },
  { suffix: 'death', count: 4 },
] as const;

test.describe('SUBMUNDO M6 — Monsters & Bosses 20f testArena E2E', () => {
  test('validates v0.6.0 testArena boot, #000000 bg, hero_living, 8 textures (frameTotal=21), 32 anims, Wave 1 -> Wave 2 (karnak scale 1.06), PC/Mobile screenshots', async ({
    page,
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

    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/');

    await expect(page).toHaveTitle(`SUBMUNDO v${GAME_VERSION}`);

    await page.waitForFunction(
      () =>
        typeof window.__SUBMUNDO_DEBUG__ !== 'undefined' &&
        window.__SUBMUNDO_DEBUG__.getMonsters().length === 5,
      undefined,
      { timeout: 10000 }
    );

    const wave1AndAssets = await page.evaluate((specs) => {
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
        textures: {
          exists: (k: string) => boolean;
          get: (k: string) => {
            source: Array<{ width: number; height: number }>;
            frameTotal: number;
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
        animLengths,
        wave1Monsters,
      };
    }, M6_MONSTER_SPECS);

    expect(wave1AndAssets.isTestArena).toBe(true);
    expect(wave1AndAssets.testArenaWave).toBe(1);
    expect(wave1AndAssets.bgRgb).toEqual([0, 0, 0]);
    expect(wave1AndAssets.heroTextureKey).toBe('hero_living');

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

    expect(wave1AndAssets.wave1Monsters.map((m) => m.defId)).toEqual([
      'slime',
      'cave_bat',
      'wolf',
      'skeleton',
      'skeleton_archer',
    ]);
    expect(wave1AndAssets.wave1Monsters.every((m) => m.isAlive)).toBe(true);

    const pcWave1Path = join(SCREENSHOT_DIR, 'm6_pc_wave1.png');
    await page.screenshot({ path: pcWave1Path });
    expect(existsSync(pcWave1Path)).toBe(true);
    expect(statSync(pcWave1Path).size).toBeGreaterThan(1024);

    // Clear Wave 1 monsters and wait for Wave 2 (wolf_alpha, karnak, skeleton_chief)
    await page.evaluate(() => {
      const monsters = window.__SUBMUNDO_DEBUG__!.getMonsters();
      for (const m of monsters) {
        m.hp = 0;
        m.isAlive = false;
      }
    });

    await page.waitForFunction(
      () => {
        const dbg = window.__SUBMUNDO_DEBUG__;
        if (!dbg) return false;
        const scene = dbg.scene as unknown as { testArenaWave?: number };
        const monsters = dbg.getMonsters();
        return scene.testArenaWave === 2 && monsters.length === 3;
      },
      undefined,
      { timeout: 5000 }
    );

    const wave2Check = await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      const scene = dbg.scene as unknown as {
        testArenaWave: number;
        monsterVisuals?: Map<
          string,
          { sprite: { scaleX: number; scaleY: number; texture: { key: string } } }
        >;
      };

      const monsters = dbg.getMonsters().map((m) => {
        const vis = scene.monsterVisuals?.get(m.instanceId);
        return {
          defId: m.defId,
          isAlive: m.isAlive,
          textureKey: vis?.sprite.texture.key ?? '',
          scaleX: vis?.sprite.scaleX ?? 0,
          scaleY: vis?.sprite.scaleY ?? 0,
        };
      });

      return {
        testArenaWave: scene.testArenaWave,
        monsters,
      };
    });

    expect(wave2Check.testArenaWave).toBe(2);
    expect(wave2Check.monsters.map((m) => m.defId)).toEqual([
      'wolf_alpha',
      'karnak',
      'skeleton_chief',
    ]);
    expect(wave2Check.monsters.every((m) => m.isAlive)).toBe(true);

    const karnakInfo = wave2Check.monsters.find((m) => m.defId === 'karnak');
    expect(karnakInfo?.textureKey).toBe('karnak');
    expect(karnakInfo?.scaleX).toBeCloseTo(1.06, 2);
    expect(karnakInfo?.scaleY).toBeCloseTo(1.06, 2);

    const pcWave2Path = join(SCREENSHOT_DIR, 'm6_pc_wave2.png');
    await page.screenshot({ path: pcWave2Path });
    expect(existsSync(pcWave2Path)).toBe(true);
    expect(statSync(pcWave2Path).size).toBeGreaterThan(1024);

    // Mobile portrait viewport (360x640)
    await page.setViewportSize({ width: 360, height: 640 });
    await page.waitForTimeout(300);

    const mobileWave2Path = join(SCREENSHOT_DIR, 'm6_mobile_wave2.png');
    await page.screenshot({ path: mobileWave2Path });
    expect(existsSync(mobileWave2Path)).toBe(true);
    expect(statSync(mobileWave2Path).size).toBeGreaterThan(1024);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(notFoundUrls).toEqual([]);
  });
});
