import { existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { GAME_VERSION } from '../../src/version';
import {
  DESKTOP_VIEWPORT,
  MOBILE_LANDSCAPE_VIEWPORT,
  assertLandscapeCanvas,
  openAct1Run,
  openMobileLandscapePage,
} from './helpers/landscape';

const SCREENSHOT_DIR = resolve(process.cwd(), 'docs/qa/screenshots');

test.describe('SUBMUNDO M1 — Real Browser E2E Validation (PC 960x540 & Mobile Landscape 844x390)', () => {
  test('renders DungeonScene without console/page errors, validates skills & 5-room Boss progression, and captures PC/Mobile Landscape screenshots', async ({
    page,
    browser,
    baseURL,
  }) => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // 1. Desktop Landscape (960x540, 16:9)
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await openAct1Run(page);

    await page.waitForFunction(
      () =>
        typeof window.__SUBMUNDO_DEBUG__ !== 'undefined' &&
        window.__SUBMUNDO_DEBUG__.getHero()?.isAlive === true &&
        window.__SUBMUNDO_DEBUG__.getRunState()?.totalRooms === 5,
      undefined,
      { timeout: 10000 }
    );

    await assertLandscapeCanvas(page, DESKTOP_VIEWPORT);

    const initialCheck = await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      const run = dbg.getRunState();
      const hero = dbg.getHero();
      const monsters = dbg.getMonsters();
      return {
        title: document.title,
        heroAlive: hero.isAlive,
        heroHp: hero.stats.hp,
        heroMaxHp: hero.stats.maxHp,
        potionCharges: hero.potionCharges,
        roomIndex: run.currentRoomIndex,
        totalRooms: run.totalRooms,
        status: run.status,
        monsterCount: monsters.length,
      };
    });

    expect(initialCheck.title).toContain(`SUBMUNDO v${GAME_VERSION}`);
    expect(initialCheck.heroAlive).toBe(true);
    expect(initialCheck.heroHp).toBe(120);
    expect(initialCheck.potionCharges).toBe(3);
    expect(initialCheck.roomIndex).toBe(0);
    expect(initialCheck.totalRooms).toBe(5);
    expect(initialCheck.status).toBe('in_progress');
    expect(initialCheck.monsterCount).toBe(3);

    // Let a few frames render in Room 1 and trigger an AoE skill for visual richness before PC screenshot
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      window.__SUBMUNDO_DEBUG__!.triggerSkill('crimson_cleave');
    });
    await page.waitForTimeout(120);

    const pcScreenshotPath = resolve(SCREENSHOT_DIR, 'm1-pc-960x540.png');
    await page.screenshot({ path: pcScreenshotPath });
    expect(existsSync(pcScreenshotPath)).toBe(true);
    expect(statSync(pcScreenshotPath).size).toBeGreaterThan(5000);

    // 2. Verify skills: spectral_dash, infernal_eruption, and soul_potion
    const skillsCheck = await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      const hero = dbg.getHero();
      const beforeX = hero.position.x;
      const beforeY = hero.position.y;

      const dashEvents = dbg.triggerSkill('spectral_dash');
      const afterDashX = hero.position.x;
      const afterDashY = hero.position.y;
      const movedDist = Math.hypot(afterDashX - beforeX, afterDashY - beforeY);

      const eruptionEvents = dbg.triggerSkill('infernal_eruption');

      // Simulate damage on hero to verify Soul Potion healing & charge consumption
      hero.stats.hp = 60;
      const potionEvents = dbg.triggerSkill('soul_potion');

      return {
        dashTriggered: dashEvents.some((e) => e.type === 'hero_dash'),
        movedDist,
        eruptionTriggered: eruptionEvents.some(
          (e) => e.type === 'hero_skill_used' && e.skillId === 'infernal_eruption'
        ),
        potionHealed: potionEvents.some((e) => e.type === 'hero_healed'),
        hpAfterPotion: hero.stats.hp,
        chargesAfterPotion: hero.potionCharges,
      };
    });

    expect(skillsCheck.dashTriggered).toBe(true);
    expect(skillsCheck.movedDist).toBeGreaterThan(20);
    expect(skillsCheck.eruptionTriggered).toBe(true);
    expect(skillsCheck.potionHealed).toBe(true);
    expect(skillsCheck.hpAfterPotion).toBe(108); // 60 + 48 (40% of 120)
    expect(skillsCheck.chargesAfterPotion).toBe(2);

    // 3. Clear Rooms 1 to 4 and advance to Room 5 (Boss Room: infernal_warden)
    const progressionCheck = await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      const visitedRooms: number[] = [];

      for (let step = 1; step <= 4; step++) {
        visitedRooms.push(dbg.getRunState().currentRoomIndex + 1);
        dbg.forceClearRoom();
        dbg.advanceRoom();
      }

      const bossRunState = dbg.getRunState();
      const bossRoomMonsters = dbg.getMonsters().map((m) => ({
        defId: m.defId,
        type: m.type,
        hp: m.hp,
      }));

      // Defeat Room 5 Boss & escort
      dbg.forceClearRoom();
      const finalState = dbg.getRunState();

      return {
        visitedRooms,
        room5Index: bossRunState.currentRoomIndex,
        hasInfernalWarden: bossRoomMonsters.some(
          (m) => m.defId === 'infernal_warden' && m.type === 'boss'
        ),
        finalStatus: finalState.status,
        monstersKilled: finalState.monstersKilled,
        soulsCollected: finalState.soulsCollected,
      };
    });

    expect(progressionCheck.visitedRooms).toEqual([1, 2, 3, 4]);
    expect(progressionCheck.room5Index).toBe(4);
    expect(progressionCheck.hasInfernalWarden).toBe(true);
    expect(progressionCheck.finalStatus).toBe('victory');
    expect(progressionCheck.monstersKilled).toBe(21);
    expect(progressionCheck.soulsCollected).toBeGreaterThanOrEqual(250);

    // 4. Mobile Landscape (844x390, hasTouch: true, Phaser.Scale.FIT 16:9)
    const { context: mobileContext, page: mobilePage } =
      await openMobileLandscapePage(browser, {
        baseURL,
        consoleErrors,
        pageErrors,
      });

    try {
      await openAct1Run(mobilePage);

      await mobilePage.waitForFunction(
        () =>
          typeof window.__SUBMUNDO_DEBUG__ !== 'undefined' &&
          window.__SUBMUNDO_DEBUG__.getHero()?.isAlive === true &&
          window.__SUBMUNDO_DEBUG__.getRunState()?.totalRooms === 5,
        undefined,
        { timeout: 10000 }
      );

      await mobilePage.waitForTimeout(200);
      await assertLandscapeCanvas(mobilePage, MOBILE_LANDSCAPE_VIEWPORT);

      const mobileCheck = await mobilePage.evaluate(() => {
        const dbg = window.__SUBMUNDO_DEBUG__!;
        dbg.triggerSkill('infernal_eruption');
        return {
          maxTouchPoints: navigator.maxTouchPoints,
          roomIndex: dbg.getRunState().currentRoomIndex,
          status: dbg.getRunState().status,
        };
      });

      expect(mobileCheck.maxTouchPoints).toBeGreaterThan(0);
      expect(mobileCheck.roomIndex).toBe(0);

      await mobilePage.waitForTimeout(120);
      const mobileScreenshotPath = resolve(
        SCREENSHOT_DIR,
        'm1-mobile-844x390.png'
      );
      await mobilePage.screenshot({ path: mobileScreenshotPath });
      expect(existsSync(mobileScreenshotPath)).toBe(true);
      expect(statSync(mobileScreenshotPath).size).toBeGreaterThan(4000);
    } finally {
      await mobileContext.close();
    }

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
