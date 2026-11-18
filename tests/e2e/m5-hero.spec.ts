import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { SAVE_STORAGE_KEY } from '../../src/core/progression/StorageAdapter';
import { GAME_VERSION } from '../../src/version';

const SCREENSHOT_DIR = '/tmp/qa-m5';

interface DebugSpriteSnapshot {
  texture: {
    key: string;
  };
  flipX: boolean;
  frame?: {
    name: string | number;
  };
  anims: {
    currentAnim: {
      key: string;
    } | null;
  };
}

test.describe('SUBMUNDO M5 — Hero 80x80 24f Spritesheets, Weapons & Animations (Living vs Wraith) E2E', () => {
  test('validates v0.5.0 boot, hero_living/hero_wraith 1920x80 (24f), weapons 192x48, 10 animation frame counts, anti-sliding legs check, walk progression, HeroWeaponRig, Prologue/Act 1, and 4 PC/Mobile screenshots', async ({
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

    // 1. Clean boot on Desktop Landscape (800x600) in Prologue — Vila Natal Viva
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/');

    await page.waitForFunction(
      () =>
        typeof window.__SUBMUNDO_HUB_DEBUG__ !== 'undefined' &&
        Boolean(window.__SUBMUNDO_HUB_DEBUG__.getProfile()),
      undefined,
      { timeout: 10000 }
    );

    // Close opening dialogue if open so the living hero in Vila Natal is clearly visible & controllable
    const dialogueInitiallyOpen = await page.evaluate(() =>
      window.__SUBMUNDO_HUB_DEBUG__!.getDialogueBox().isOpen()
    );
    if (dialogueInitiallyOpen) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(60);
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () => window.__SUBMUNDO_HUB_DEBUG__!.getDialogueBox().isOpen() === false,
        undefined,
        { timeout: 3000 }
      );
    }

    // 2. Validate v0.5.0, BootScene textures (hero_living & hero_wraith 1920x80 24f, weapons 192x48), weaponRig, 10 animations & anti-sliding pixel diff
    const assetsAndAnimsCheck = await page.evaluate(() => {
      const hub = window.__SUBMUNDO_HUB_DEBUG__!;
      const scene = hub.scene as unknown as {
        textures: {
          exists: (key: string) => boolean;
          get: (key: string) => {
            source: Array<{
              width: number;
              height: number;
              image?: CanvasImageSource;
            }>;
            frameTotal: number;
            getFrameNames: () => string[];
            get: (frame: number) => { width: number; height: number };
          };
        };
        anims: {
          exists: (key: string) => boolean;
          get: (key: string) => { frames: unknown[] } | undefined;
        };
        heroSprite: DebugSpriteSnapshot;
        weaponRig?: {
          weaponSprite?: {
            visible: boolean;
            texture: { key: string };
            frame: { name: string | number };
          };
        };
      };

      const inspectTexture = (key: string) => {
        if (!scene.textures.exists(key)) {
          return null;
        }
        const tex = scene.textures.get(key);
        const frame0 = tex.get(0);
        return {
          width: tex.source[0]?.width ?? 0,
          height: tex.source[0]?.height ?? 0,
          frameTotal: tex.frameTotal,
          frameCount: tex.getFrameNames().length,
          frameWidth: frame0?.width ?? 0,
          frameHeight: frame0?.height ?? 0,
        };
      };

      const measureLegsDiffRatio = (
        textureKey: string,
        frameA: number,
        frameB: number
      ): number => {
        if (!scene.textures.exists(textureKey)) {
          return -1;
        }
        const tex = scene.textures.get(textureKey);
        const sourceImage = tex.source[0]?.image;
        if (!sourceImage) {
          return -1;
        }

        const frameWidth = 80;
        const bandStartY = 50;
        const bandEndY = 78;
        const bandHeight = bandEndY - bandStartY + 1;
        const canvas = document.createElement('canvas');
        canvas.width = frameWidth;
        canvas.height = bandHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return -1;
        }

        ctx.clearRect(0, 0, frameWidth, bandHeight);
        ctx.drawImage(
          sourceImage,
          frameA * frameWidth,
          bandStartY,
          frameWidth,
          bandHeight,
          0,
          0,
          frameWidth,
          bandHeight
        );
        const dataA = ctx.getImageData(0, 0, frameWidth, bandHeight).data;

        ctx.clearRect(0, 0, frameWidth, bandHeight);
        ctx.drawImage(
          sourceImage,
          frameB * frameWidth,
          bandStartY,
          frameWidth,
          bandHeight,
          0,
          0,
          frameWidth,
          bandHeight
        );
        const dataB = ctx.getImageData(0, 0, frameWidth, bandHeight).data;

        const totalPixels = frameWidth * bandHeight;
        let diffPixels = 0;
        for (let i = 0; i < dataA.length; i += 4) {
          if (
            Math.abs(dataA[i] - dataB[i]) > 2 ||
            Math.abs(dataA[i + 1] - dataB[i + 1]) > 2 ||
            Math.abs(dataA[i + 2] - dataB[i + 2]) > 2 ||
            Math.abs(dataA[i + 3] - dataB[i + 3]) > 2
          ) {
            diffPixels += 1;
          }
        }

        return diffPixels / totalPixels;
      };

      const expectedAnims = [
        'hero_living_idle',
        'hero_living_walk',
        'hero_living_attack',
        'hero_living_dash',
        'hero_living_hit',
        'hero_wraith_idle',
        'hero_wraith_walk',
        'hero_wraith_attack',
        'hero_wraith_dash',
        'hero_wraith_hit',
      ];

      const animResults = Object.fromEntries(
        expectedAnims.map((key) => [key, scene.anims.exists(key)])
      );
      const animFrameCounts = Object.fromEntries(
        expectedAnims.map((key) => [
          key,
          scene.anims.get(key)?.frames.length ?? 0,
        ])
      );

      const antiSliding = {
        heroLivingWalk0VsWalk3: measureLegsDiffRatio('hero_living', 4, 7),
        heroLivingIdle0VsAttack2: measureLegsDiffRatio('hero_living', 0, 12),
        heroWraithWalk0VsWalk3: measureLegsDiffRatio('hero_wraith', 4, 7),
        heroWraithIdle0VsAttack2: measureLegsDiffRatio('hero_wraith', 0, 12),
      };

      const weaponSprite = scene.weaponRig?.weaponSprite;

      return {
        title: document.title,
        phase: hub.getProfile().campaign?.phase,
        heroLiving: inspectTexture('hero_living'),
        heroWraith: inspectTexture('hero_wraith'),
        weapons: inspectTexture('weapons'),
        animResults,
        animFrameCounts,
        antiSliding,
        hubHeroTexture: scene.heroSprite.texture.key,
        hubHeroAnim: scene.heroSprite.anims.currentAnim?.key ?? null,
        hubWeaponRig: weaponSprite
          ? {
              visible: weaponSprite.visible,
              textureKey: weaponSprite.texture.key,
              frame: Number(weaponSprite.frame.name),
            }
          : null,
      };
    });

    expect(GAME_VERSION).toBe('0.5.0');
    expect(assetsAndAnimsCheck.title).toBe('SUBMUNDO v0.5.0');
    expect(assetsAndAnimsCheck.phase).toBe('prologue');
    expect(assetsAndAnimsCheck.heroLiving).toEqual({
      width: 1920,
      height: 80,
      frameTotal: 25,
      frameCount: 24,
      frameWidth: 80,
      frameHeight: 80,
    });
    expect(assetsAndAnimsCheck.heroWraith).toEqual({
      width: 1920,
      height: 80,
      frameTotal: 25,
      frameCount: 24,
      frameWidth: 80,
      frameHeight: 80,
    });
    expect(assetsAndAnimsCheck.weapons).toEqual({
      width: 192,
      height: 48,
      frameTotal: 5,
      frameCount: 4,
      frameWidth: 48,
      frameHeight: 48,
    });
    expect(assetsAndAnimsCheck.animResults).toEqual({
      hero_living_idle: true,
      hero_living_walk: true,
      hero_living_attack: true,
      hero_living_dash: true,
      hero_living_hit: true,
      hero_wraith_idle: true,
      hero_wraith_walk: true,
      hero_wraith_attack: true,
      hero_wraith_dash: true,
      hero_wraith_hit: true,
    });
    expect(assetsAndAnimsCheck.animFrameCounts).toEqual({
      hero_living_idle: 4,
      hero_living_walk: 6,
      hero_living_attack: 6,
      hero_living_dash: 4,
      hero_living_hit: 4,
      hero_wraith_idle: 4,
      hero_wraith_walk: 6,
      hero_wraith_attack: 6,
      hero_wraith_dash: 4,
      hero_wraith_hit: 4,
    });
    expect(assetsAndAnimsCheck.antiSliding.heroLivingWalk0VsWalk3).toBeGreaterThan(
      0.2
    );
    expect(
      assetsAndAnimsCheck.antiSliding.heroLivingIdle0VsAttack2
    ).toBeGreaterThan(0.2);
    expect(assetsAndAnimsCheck.antiSliding.heroWraithWalk0VsWalk3).toBeGreaterThan(
      0.2
    );
    expect(
      assetsAndAnimsCheck.antiSliding.heroWraithIdle0VsAttack2
    ).toBeGreaterThan(0.2);
    expect(assetsAndAnimsCheck.hubHeroTexture).toBe('hero_living');
    expect(assetsAndAnimsCheck.hubHeroAnim).toBe('hero_living_idle');
    expect(assetsAndAnimsCheck.hubWeaponRig).toEqual({
      visible: true,
      textureKey: 'weapons',
      frame: 0,
    });

    // 3. Validate flipX, hero_living_walk, and live frame progression within walk range (4..9) in Vila Natal
    const sampleWalkDirection = async (
      key: 'KeyA' | 'KeyD',
      expectedAnim: 'hero_living_walk' | 'hero_wraith_walk'
    ) => {
      const samples: Array<{
        flipX: boolean;
        anim: string | null;
        frame: number;
      }> = [];

      await page.keyboard.down(key);
      try {
        await page.waitForFunction(
          (targetAnim: string) => {
            const scene = window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
              heroSprite: DebugSpriteSnapshot;
            };
            return scene.heroSprite.anims.currentAnim?.key === targetAnim;
          },
          expectedAnim,
          { timeout: 2500 }
        );

        for (let i = 0; i < 6; i += 1) {
          const snap = await page.evaluate(() => {
            const scene = window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
              heroSprite: DebugSpriteSnapshot;
            };
            return {
              flipX: scene.heroSprite.flipX,
              anim: scene.heroSprite.anims.currentAnim?.key ?? null,
              frame: Number(scene.heroSprite.frame?.name),
            };
          });
          samples.push(snap);
          if (i < 5) {
            await page.waitForTimeout(70);
          }
        }
      } finally {
        await page.keyboard.up(key);
      }

      return samples;
    };

    const moveLeftSamples = await sampleWalkDirection(
      'KeyA',
      'hero_living_walk'
    );
    expect(moveLeftSamples.length).toBeGreaterThanOrEqual(2);
    for (const sample of moveLeftSamples) {
      expect(sample.flipX).toBe(true);
      expect(sample.anim).toBe('hero_living_walk');
      expect(Number.isInteger(sample.frame)).toBe(true);
      expect(sample.frame).toBeGreaterThanOrEqual(4);
      expect(sample.frame).toBeLessThanOrEqual(9);
    }
    expect(new Set(moveLeftSamples.map((s) => s.frame)).size).toBeGreaterThan(1);

    const moveRightSamples = await sampleWalkDirection(
      'KeyD',
      'hero_living_walk'
    );
    expect(moveRightSamples.length).toBeGreaterThanOrEqual(2);
    for (const sample of moveRightSamples) {
      expect(sample.flipX).toBe(false);
      expect(sample.anim).toBe('hero_living_walk');
      expect(Number.isInteger(sample.frame)).toBe(true);
      expect(sample.frame).toBeGreaterThanOrEqual(4);
      expect(sample.frame).toBeLessThanOrEqual(9);
    }
    expect(new Set(moveRightSamples.map((s) => s.frame)).size).toBeGreaterThan(
      1
    );

    await page.waitForTimeout(120);
    const pcPrologueVillagePath = join(
      SCREENSHOT_DIR,
      'm5_pc_prologue_village.png'
    );
    await page.screenshot({ path: pcPrologueVillagePath });
    expect(existsSync(pcPrologueVillagePath)).toBe(true);
    expect(statSync(pcPrologueVillagePath).size).toBeGreaterThan(5000);

    // 4. Enter Prologue Dungeon (Gruta da Cachoeira) and verify hero_living_attack & hero_living_dash
    await page.evaluate(() => {
      window.__SUBMUNDO_HUB_DEBUG__!.enterDungeon('prologue_grotto');
    });

    await page.waitForFunction(
      () =>
        typeof window.__SUBMUNDO_DEBUG__ !== 'undefined' &&
        window.__SUBMUNDO_DEBUG__.getHero()?.isAlive === true &&
        window.__SUBMUNDO_DEBUG__.getRunState()?.totalRooms === 3,
      undefined,
      { timeout: 10000 }
    );

    const prologueDungeonInit = await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      const scene = dbg.scene as unknown as {
        heroSprite: DebugSpriteSnapshot;
        weaponRig?: {
          weaponSprite?: {
            visible: boolean;
            texture: { key: string };
            frame: { name: string | number };
          };
        };
      };
      const hero = dbg.getHero();
      const monsters = dbg.getMonsters();
      if (monsters.length > 0) {
        hero.position.x = monsters[0].position.x - 24;
        hero.position.y = monsters[0].position.y;
      }
      const weaponSprite = scene.weaponRig?.weaponSprite;
      return {
        initialTexture: scene.heroSprite.texture.key,
        weaponRig: weaponSprite
          ? {
              visible: weaponSprite.visible,
              textureKey: weaponSprite.texture.key,
              frame: Number(weaponSprite.frame.name),
            }
          : null,
      };
    });

    expect(prologueDungeonInit.initialTexture).toBe('hero_living');
    expect(prologueDungeonInit.weaponRig).toEqual({
      visible: true,
      textureKey: 'weapons',
      frame: 0,
    });

    await page.waitForFunction(
      () => {
        const scene = window.__SUBMUNDO_DEBUG__!.scene as unknown as {
          heroSprite: DebugSpriteSnapshot;
        };
        return (
          scene.heroSprite.anims.currentAnim?.key === 'hero_living_attack'
        );
      },
      undefined,
      { timeout: 3000 }
    );

    const prologueDashCheck = await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      const scene = dbg.scene as unknown as {
        heroSprite: DebugSpriteSnapshot;
      };
      const dashEvents = dbg.triggerSkill('spectral_dash');
      return {
        dashTriggered: dashEvents.some((e) => e.type === 'hero_dash'),
        dashAnim: scene.heroSprite.anims.currentAnim?.key ?? null,
      };
    });

    expect(prologueDashCheck.dashTriggered).toBe(true);
    expect(prologueDashCheck.dashAnim).toBe('hero_living_dash');

    // Capture combat screenshot in Gruta da Cachoeira (800x600)
    await page.evaluate(() => {
      window.__SUBMUNDO_DEBUG__!.triggerSkill('crimson_cleave');
    });
    await page.waitForTimeout(100);
    const pcPrologueDungeonPath = join(
      SCREENSHOT_DIR,
      'm5_pc_prologue_dungeon.png'
    );
    await page.screenshot({ path: pcPrologueDungeonPath });
    expect(existsSync(pcPrologueDungeonPath)).toBe(true);
    expect(statSync(pcPrologueDungeonPath).size).toBeGreaterThan(5000);

    // 5. Act 1 via localStorage (campaign.phase = 'act1') -> Refúgio no Submundo & Masmorra
    await page.evaluate((storageKey: string) => {
      const profile = {
        version: 1,
        souls: 150,
        generalEssences: 1,
        altarLevels: {
          vitality: 1,
          ferocity: 1,
          greed: 0,
          haste: 0,
        },
        equipped: {
          weapon: null,
          armor: null,
          amulet: null,
          ring: null,
        },
        stash: [],
        maxStashSize: 24,
        itemUpgradeLevels: {},
        stats: {
          totalRuns: 3,
          victories: 3,
          totalKills: 45,
          bossesDefeated: 1,
        },
        campaign: {
          phase: 'act1',
          currentStageId: 'act1_submundo',
          completedStages: [
            'prologue_grotto',
            'prologue_mine',
            'prologue_seal',
          ],
          villageFallTriggered: true,
          seenDialogues: [
            'prologue_welcome',
            'stage_grotto_intro',
            'village_fall_pact',
            'act1_refuge_arrival',
          ],
        },
      };
      window.localStorage.setItem(storageKey, JSON.stringify(profile));
    }, SAVE_STORAGE_KEY);

    await page.goto('/');
    await page.waitForFunction(
      () =>
        typeof window.__SUBMUNDO_HUB_DEBUG__ !== 'undefined' &&
        window.__SUBMUNDO_HUB_DEBUG__.getProfile()?.campaign?.phase === 'act1',
      undefined,
      { timeout: 10000 }
    );

    const act1RefugeIdle = await page.evaluate(() => {
      const hub = window.__SUBMUNDO_HUB_DEBUG__!;
      const scene = hub.scene as unknown as {
        heroSprite: DebugSpriteSnapshot;
        weaponRig?: {
          weaponSprite?: {
            visible: boolean;
            texture: { key: string };
            frame: { name: string | number };
          };
        };
      };
      const weaponSprite = scene.weaponRig?.weaponSprite;
      return {
        phase: hub.getProfile().campaign?.phase,
        texture: scene.heroSprite.texture.key,
        anim: scene.heroSprite.anims.currentAnim?.key ?? null,
        weaponRig: weaponSprite
          ? {
              visible: weaponSprite.visible,
              textureKey: weaponSprite.texture.key,
              frame: Number(weaponSprite.frame.name),
            }
          : null,
      };
    });

    expect(act1RefugeIdle.phase).toBe('act1');
    expect(act1RefugeIdle.texture).toBe('hero_wraith');
    expect(act1RefugeIdle.anim).toBe('hero_wraith_idle');
    expect(act1RefugeIdle.weaponRig).toEqual({
      visible: true,
      textureKey: 'weapons',
      frame: 1,
    });

    // Verify hero_wraith_walk & live frame progression (4..9) in Refúgio
    const act1RefugeWalkSamples = await sampleWalkDirection(
      'KeyD',
      'hero_wraith_walk'
    );
    expect(act1RefugeWalkSamples.length).toBeGreaterThanOrEqual(2);
    for (const sample of act1RefugeWalkSamples) {
      expect(sample.flipX).toBe(false);
      expect(sample.anim).toBe('hero_wraith_walk');
      expect(Number.isInteger(sample.frame)).toBe(true);
      expect(sample.frame).toBeGreaterThanOrEqual(4);
      expect(sample.frame).toBeLessThanOrEqual(9);
    }
    expect(
      new Set(act1RefugeWalkSamples.map((s) => s.frame)).size
    ).toBeGreaterThan(1);

    await page.waitForTimeout(120);
    const pcAct1RefugePath = join(SCREENSHOT_DIR, 'm5_pc_act1_refuge.png');
    await page.screenshot({ path: pcAct1RefugePath });
    expect(existsSync(pcAct1RefugePath)).toBe(true);
    expect(statSync(pcAct1RefugePath).size).toBeGreaterThan(5000);

    // 6. Mobile Portrait (360x640) in Act 1 Dungeon (hero_wraith combat)
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/');
    await page.waitForFunction(
      () =>
        typeof window.__SUBMUNDO_HUB_DEBUG__ !== 'undefined' &&
        window.__SUBMUNDO_HUB_DEBUG__.getProfile()?.campaign?.phase === 'act1',
      undefined,
      { timeout: 10000 }
    );

    await page.evaluate(() => {
      window.__SUBMUNDO_HUB_DEBUG__!.enterDungeon('act1_submundo');
    });

    await page.waitForFunction(
      () =>
        typeof window.__SUBMUNDO_DEBUG__ !== 'undefined' &&
        window.__SUBMUNDO_DEBUG__.getHero()?.isAlive === true &&
        window.__SUBMUNDO_DEBUG__.getRunState()?.totalRooms === 5,
      undefined,
      { timeout: 10000 }
    );

    const act1DungeonCheck = await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      const scene = dbg.scene as unknown as {
        heroSprite: DebugSpriteSnapshot;
        weaponRig?: {
          weaponSprite?: {
            visible: boolean;
            texture: { key: string };
            frame: { name: string | number };
          };
        };
      };
      const canvas = document.querySelector('canvas');
      const hero = dbg.getHero();
      const monsters = dbg.getMonsters();
      if (monsters.length > 0) {
        hero.position.x = monsters[0].position.x - 24;
        hero.position.y = monsters[0].position.y;
      }

      const weaponSprite = scene.weaponRig?.weaponSprite;
      return {
        canvasWidth: canvas?.width ?? 0,
        canvasHeight: canvas?.height ?? 0,
        initialTexture: scene.heroSprite.texture.key,
        initialAnim: scene.heroSprite.anims.currentAnim?.key ?? null,
        weaponRig: weaponSprite
          ? {
              visible: weaponSprite.visible,
              textureKey: weaponSprite.texture.key,
              frame: Number(weaponSprite.frame.name),
            }
          : null,
      };
    });

    expect(act1DungeonCheck.canvasWidth).toBe(360);
    expect(act1DungeonCheck.canvasHeight).toBe(640);
    expect(act1DungeonCheck.initialTexture).toBe('hero_wraith');
    expect(['hero_wraith_idle', 'hero_wraith_walk']).toContain(
      act1DungeonCheck.initialAnim
    );
    expect(act1DungeonCheck.weaponRig).toEqual({
      visible: true,
      textureKey: 'weapons',
      frame: 1,
    });

    await page.waitForFunction(
      () => {
        const scene = window.__SUBMUNDO_DEBUG__!.scene as unknown as {
          heroSprite: DebugSpriteSnapshot;
        };
        return (
          scene.heroSprite.anims.currentAnim?.key === 'hero_wraith_attack'
        );
      },
      undefined,
      { timeout: 3000 }
    );

    await page.waitForTimeout(120);
    const mobileAct1DungeonPath = join(
      SCREENSHOT_DIR,
      'm5_mobile_act1_dungeon.png'
    );
    await page.screenshot({ path: mobileAct1DungeonPath });
    expect(existsSync(mobileAct1DungeonPath)).toBe(true);
    expect(statSync(mobileAct1DungeonPath).size).toBeGreaterThan(5000);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(notFoundUrls).toEqual([]);
  });
});
