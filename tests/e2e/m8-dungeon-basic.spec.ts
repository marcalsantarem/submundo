import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DESKTOP_VIEWPORT, assertLandscapeCanvas } from './helpers/landscape';

// Evidence lives in the repo (BRF-129 / T-120).
const SCREENSHOT_DIR = join(process.cwd(), 'docs', 'qa', 'screenshots');

async function killAllMonsters(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const m of window.__SUBMUNDO_DEBUG__!.getMonsters()) {
      m.hp = 0;
      m.isAlive = false;
    }
  });
}

test.describe('SUBMUNDO M8 — testArena na Masmorra Básica (PC 960x540)', () => {
  test('mata as duas ondas e mostra "Teste finalizado" (testArenaFinished=true, sem Karnak)', async ({
    page,
  }) => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const notFoundUrls: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('response', (res) => {
      if (res.status() === 404) notFoundUrls.push(res.url());
    });

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto('/');
    await page.waitForFunction(
      () =>
        typeof window.__SUBMUNDO_DEBUG__ !== 'undefined' &&
        window.__SUBMUNDO_DEBUG__.getMonsters().length === 5,
      undefined,
      { timeout: 10000 }
    );
    await assertLandscapeCanvas(page, DESKTOP_VIEWPORT);

    const initial = await page.evaluate(() => {
      const scene = window.__SUBMUNDO_DEBUG__!.scene as unknown as {
        isTestArena: boolean;
        testArenaWave: number;
        testArenaFinished: boolean;
      };
      return {
        isTestArena: scene.isTestArena,
        testArenaWave: scene.testArenaWave,
        testArenaFinished: scene.testArenaFinished,
      };
    });
    expect(initial).toEqual({
      isTestArena: true,
      testArenaWave: 1,
      testArenaFinished: false,
    });

    const pcRoomPath = join(SCREENSHOT_DIR, 'm8_pc_dungeon_basic_wave1.png');
    await page.screenshot({ path: pcRoomPath });
    expect(statSync(pcRoomPath).size).toBeGreaterThan(1024);

    // Wave 1 -> Wave 2
    await killAllMonsters(page);
    await page.waitForFunction(
      () => {
        const dbg = window.__SUBMUNDO_DEBUG__;
        if (!dbg) return false;
        const scene = dbg.scene as unknown as { testArenaWave?: number };
        return scene.testArenaWave === 2 && dbg.getMonsters().length === 2;
      },
      undefined,
      { timeout: 5000 }
    );

    const wave2 = await page.evaluate(() => {
      const scene = window.__SUBMUNDO_DEBUG__!.scene as unknown as {
        testArenaFinished: boolean;
      };
      return {
        defIds: window.__SUBMUNDO_DEBUG__!.getMonsters().map((m) => m.defId),
        finished: scene.testArenaFinished,
      };
    });
    expect(wave2.defIds).toEqual(['wolf_alpha', 'skeleton_chief']);
    expect(wave2.defIds).not.toContain('karnak');
    expect(wave2.finished).toBe(false);

    // Wave 2 -> "Teste finalizado"
    await killAllMonsters(page);
    await page.waitForFunction(
      () =>
        (
          window.__SUBMUNDO_DEBUG__?.scene as unknown as {
            testArenaFinished?: boolean;
          }
        )?.testArenaFinished === true,
      undefined,
      // ~800 ms of game time; headless frame pacing can stretch it considerably.
      { timeout: 15000 }
    );
    // Let the 280 ms overlay fade-in finish.
    await page.waitForTimeout(500);

    const finish = await page.evaluate(() => {
      type GO = {
        type: string;
        text?: string;
        visible?: boolean;
        alpha?: number;
        list?: GO[];
        parentContainer?: GO | null;
      };
      const scene = window.__SUBMUNDO_DEBUG__!.scene as unknown as {
        testArenaFinished: boolean;
        children: { list: GO[] };
      };
      const found: GO[] = [];
      const walk = (objs: GO[]) => {
        for (const o of objs) {
          if (o.type === 'Text' && o.text === 'Teste finalizado') found.push(o);
          if (o.list) walk(o.list);
        }
      };
      walk(scene.children.list);
      const t = found[0];
      let effAlpha = t ? t.alpha ?? 1 : 0;
      let visible = t ? t.visible !== false : false;
      for (let p = t?.parentContainer; p; p = p.parentContainer) {
        effAlpha *= p.alpha ?? 1;
        visible = visible && p.visible !== false;
      }
      return {
        finished: scene.testArenaFinished,
        textCount: found.length,
        visible,
        effAlpha,
      };
    });
    expect(finish.finished).toBe(true);
    expect(finish.textCount).toBe(1);
    expect(finish.visible).toBe(true);
    expect(finish.effAlpha).toBeGreaterThan(0.95);

    const pcFinishedPath = join(SCREENSHOT_DIR, 'm8_pc_teste_finalizado.png');
    await page.screenshot({ path: pcFinishedPath });
    expect(existsSync(pcFinishedPath)).toBe(true);
    expect(statSync(pcFinishedPath).size).toBeGreaterThan(1024);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(notFoundUrls).toEqual([]);
  });
});
