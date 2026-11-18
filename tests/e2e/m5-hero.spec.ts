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
  anims: {
    currentAnim: {
      key: string;
    } | null;
  };
}

test.describe('SUBMUNDO M5 — Hero 80x80 Spritesheets, Weapons & Animations (Living vs Wraith) E2E', () => {
  test('validates v0.5.0 boot, hero_living/hero_wraith 80x80, weapons 48x48, HeroWeaponRig, 10 animations, Prologue/Act 1, and 4 PC/Mobile screenshots', async ({
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

    // 2. Validate v0.5.0, BootScene textures (hero_living & hero_wraith 1280x80, weapons 192x48), weaponRig, and 10 animations
    const assetsAndAnimsCheck = await page.evaluate(() => {
      const hub = window.__SUBMUNDO_HUB_DEBUG__!;
      const scene = hub.scene as unknown as {
        textures: {
          exists: (key: string) => boolean;
          get: (key: string) => {
            source: Array<{ width: number; height: number }>;
            frameTotal: number;
            getFrameNames: () => string[];
            get: (frame: number) => { width: number; height: number };
          };
        };
        anims: {
          exists: (key: string) => boolean;
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

      const weaponSprite = scene.weaponRig?.weaponSprite;

      return {
        title: document.title,
        phase: hub.getProfile().campaign?.phase,
        heroLiving: inspectTexture('hero_living'),
        heroWraith: inspectTexture('hero_wraith'),
        weapons: inspectTexture('weapons'),
        animResults,
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
      width: 1280,
      height: 80,
      frameTotal: 17,
      frameCount: 16,
      frameWidth: 80,
      frameHeight: 80,
    });
    expect(assetsAndAnimsCheck.heroWraith).toEqual({
      width: 1280,
      height: 80,
      frameTotal: 17,
      frameCount: 16,
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
    expect(assetsAndAnimsCheck.hubHeroTexture).toBe('hero_living');
    expect(assetsAndAnimsCheck.hubHeroAnim).toBe('hero_living_idle');
    expect(assetsAndAnimsCheck.hubWeaponRig).toEqual({
      visible: true,
      textureKey: 'weapons',
      frame: 0,
    });

    // 3. Validate flipX & hero_living_walk on movement in Vila Natal
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(160);
    const moveLeftState = await page.evaluate(() => {
      const scene = window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
        heroSprite: DebugSpriteSnapshot;
      };
      return {
        flipX: scene.heroSprite.flipX,
        anim: scene.heroSprite.anims.currentAnim?.key ?? null,
      };
    });
    await page.keyboard.up('KeyA');

    expect(moveLeftState.flipX).toBe(true);
    expect(moveLeftState.anim).toBe('hero_living_walk');

    await page.keyboard.down('KeyD');
    await page.waitForTimeout(160);
    const moveRightState = await page.evaluate(() => {
      const scene = window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
        heroSprite: DebugSpriteSnapshot;
      };
      return {
        flipX: scene.heroSprite.flipX,
        anim: scene.heroSprite.anims.currentAnim?.key ?? null,
      };
    });
    await page.keyboard.up('KeyD');

    expect(moveRightState.flipX).toBe(false);
    expect(moveRightState.anim).toBe('hero_living_walk');

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

    // Verify hero_wraith_walk in Refúgio
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(160);
    const act1RefugeWalk = await page.evaluate(() => {
      const scene = window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
        heroSprite: DebugSpriteSnapshot;
      };
      return scene.heroSprite.anims.currentAnim?.key ?? null;
    });
    await page.keyboard.up('KeyD');
    expect(act1RefugeWalk).toBe('hero_wraith_walk');

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
