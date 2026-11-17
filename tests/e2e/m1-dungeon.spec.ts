import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test.describe('SUBMUNDO M1 — Real Browser E2E Validation (PC 800x600 & Mobile 9:16)', () => {
  test('renders DungeonScene without console/page errors, validates skills & 5-room Boss progression, and captures PC/Mobile screenshots', async ({
    page,
  }) => {
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

    // 1. Desktop Landscape (800x600)
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/');

    await page.waitForFunction(
      () =>
        typeof window.__SUBMUNDO_DEBUG__ !== 'undefined' &&
        window.__SUBMUNDO_DEBUG__.getHero()?.isAlive === true &&
        window.__SUBMUNDO_DEBUG__.getRunState()?.totalRooms === 5,
      undefined,
      { timeout: 10000 }
    );

    const initialCheck = await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      const run = dbg.getRunState();
      const hero = dbg.getHero();
      const monsters = dbg.getMonsters();
      const canvas = document.querySelector('canvas');
      return {
        title: document.title,
        hasCanvas: Boolean(canvas),
        canvasWidth: canvas?.width ?? 0,
        canvasHeight: canvas?.height ?? 0,
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

    expect(initialCheck.title).toContain('SUBMUNDO v0.1.0');
    expect(initialCheck.hasCanvas).toBe(true);
    expect(initialCheck.canvasWidth).toBe(800);
    expect(initialCheck.canvasHeight).toBe(600);
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

    const pcScreenshotPath = resolve(
      process.cwd(),
      'docs/qa/screenshots/m1-pc-800x600.png'
    );
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

    // 4. Mobile Portrait (360x640, 9:16 aspect ratio)
    await page.setViewportSize({ width: 360, height: 640 });
    await page.evaluate(() => {
      window.__SUBMUNDO_DEBUG__!.restartRun();
    });
    await page.waitForTimeout(250);

    const mobileCheck = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const dbg = window.__SUBMUNDO_DEBUG__!;
      dbg.triggerSkill('infernal_eruption');
      return {
        canvasWidth: canvas?.width ?? 0,
        canvasHeight: canvas?.height ?? 0,
        roomIndex: dbg.getRunState().currentRoomIndex,
        status: dbg.getRunState().status,
      };
    });

    expect(mobileCheck.canvasWidth).toBe(360);
    expect(mobileCheck.canvasHeight).toBe(640);
    expect(mobileCheck.roomIndex).toBe(0);

    await page.waitForTimeout(120);
    const mobileScreenshotPath = resolve(
      process.cwd(),
      'docs/qa/screenshots/m1-mobile-360x640.png'
    );
    await page.screenshot({ path: mobileScreenshotPath });
    expect(existsSync(mobileScreenshotPath)).toBe(true);
    expect(statSync(mobileScreenshotPath).size).toBeGreaterThan(4000);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
