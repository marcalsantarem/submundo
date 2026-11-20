import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DESKTOP_VIEWPORT, assertLandscapeCanvas } from './helpers/landscape';
import {
  expectNoErrors,
  getArenaState,
  getExitDoorX,
  getRoomGeos,
  holdKeyUntil,
  killAllMonsters,
  waitForTestArena,
  walkToX,
} from './helpers/testDungeon';

// Evidence lives in the repo (BRF-129 / BRF-134).
const SCREENSHOT_DIR = join(process.cwd(), 'docs', 'qa', 'screenshots');
const SEED = 7;

async function waitDoorOpen(page: Page, index: number): Promise<void> {
  await page.waitForFunction(
    (i) =>
      (
        window.__SUBMUNDO_DEBUG__?.scene as unknown as {
          testDoorOpenFlags?: boolean[];
        }
      )?.testDoorOpenFlags?.[i] === true,
    index,
    { timeout: 10000 }
  );
}

async function shot(page: Page, name: string): Promise<void> {
  const p = join(SCREENSHOT_DIR, name);
  await page.screenshot({ path: p });
  expect(existsSync(p)).toBe(true);
  expect(statSync(p).size).toBeGreaterThan(1024);
}

test.describe('SUBMUNDO M8 — dungeon de teste em mapa contínuo (3 salas, PC 960x540)', () => {
  test(`seed=${SEED}: 3 salas, ondas 1-3, porta selada, caminhada pelo corredor e "Teste finalizado"`, async ({
    page,
  }) => {
    test.setTimeout(300000);
    mkdirSync(SCREENSHOT_DIR, { recursive: true });

    const errors = { consoleErrors: [] as string[], pageErrors: [] as string[], notFoundUrls: [] as string[] };
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.pageErrors.push(err.message));
    page.on('response', (res) => {
      if (res.status() === 404) errors.notFoundUrls.push(res.url());
    });

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto(`/?seed=${SEED}`);
    await waitForTestArena(page);
    await assertLandscapeCanvas(page, DESKTOP_VIEWPORT);

    // --- 3 rooms, wave composition, stacked vertically (room 1 at the bottom)
    const layout = await page.evaluate(() => {
      const d = window.__SUBMUNDO_DEBUG__!;
      return {
        rooms: d.getTestRooms().map((r) => ({
          index: r.index,
          wave: r.wave,
          isBossRoom: r.isBossRoom,
          defIds: [...new Set(r.spawns.map((s) => s.defId))].sort(),
          hasExit: r.exitDoorCols !== null,
          hasEntry: r.entryDoorCols !== null,
        })),
        origins: d.getTestRoomWorldOrigins(),
        roomIndexApi: d.getTestRoomIndex(),
      };
    });
    expect(layout.rooms).toEqual([
      { index: 0, wave: 1, isBossRoom: false, defIds: ['slime', 'wolf'], hasExit: true, hasEntry: false },
      { index: 1, wave: 2, isBossRoom: false, defIds: ['skeleton', 'skeleton_archer'], hasExit: true, hasEntry: true },
      { index: 2, wave: 3, isBossRoom: true, defIds: ['skeleton_chief'], hasExit: false, hasEntry: true },
    ]);
    expect(layout.origins).toHaveLength(3);
    expect(layout.origins[0].y).toBeGreaterThan(layout.origins[1].y);
    expect(layout.origins[1].y).toBeGreaterThan(layout.origins[2].y);
    expect(layout.roomIndexApi).toBe(0);

    const s0 = await getArenaState(page);
    expect(s0).toMatchObject({ seed: SEED, roomIndex: 0, wave: 1, finished: false });
    expect([...new Set(s0.monsters)].sort()).toEqual(['slime', 'wolf']);
    for (const banned of ['cave_bat', 'wolf_alpha', 'karnak']) {
      expect(s0.monsters).not.toContain(banned);
    }

    await page.waitForTimeout(300);
    await shot(page, 'm8_pc_sala1.png');

    const geos = await getRoomGeos(page);
    const door0X = (await getExitDoorX(page, 0))!;
    const door1X = (await getExitDoorX(page, 1))!;
    expect(door0X).not.toBeNull();
    expect(door1X).not.toBeNull();

    // --- Sealed door: pushing up against it keeps the hero in room 1
    // Walk speed depends on headless frame pacing, so first reach the wall
    // (condition-driven), then keep pushing and confirm nothing gives way.
    await walkToX(page, door0X);
    const atWall = await holdKeyUntil(
      page,
      'ArrowUp',
      (s) => s.roomIndex !== 0 || s.hero.y <= geos[0].minY + 2,
      25000
    );
    expect(atWall.ok).toBe(true);
    const sealed = await holdKeyUntil(
      page,
      'ArrowUp',
      (s) => s.roomIndex !== 0 || s.hero.y < geos[0].minY - 4,
      2000
    );
    expect(sealed.ok).toBe(false);
    expect(sealed.state.roomIndex).toBe(0);
    expect(sealed.state.hero.y).toBeGreaterThanOrEqual(geos[0].minY - 2);
    expect(sealed.state.hero.y).toBeLessThanOrEqual(geos[0].minY + 10); // it did reach the wall

    // --- Clear room 1, walk through the door into the corridor
    await killAllMonsters(page);
    await waitDoorOpen(page, 0);
    expect((await getArenaState(page)).roomIndex).toBe(0);

    await walkToX(page, door0X);
    const inCorridor = await holdKeyUntil(
      page,
      'ArrowUp',
      (s) => s.hero.y < geos[0].y - 4,
      60000
    );
    expect(inCorridor.ok).toBe(true);
    expect(inCorridor.state.roomIndex).toBe(0); // still in the corridor, wave 2 not spawned
    expect(inCorridor.state.wave).toBe(1);
    expect(inCorridor.state.hero.y).toBeGreaterThan(geos[1].y + geos[1].height - 40);
    await page.waitForTimeout(150);
    await shot(page, 'm8_pc_corredor.png');

    // --- Walk into room 2: wave 2 spawns (skeleton + skeleton_archer)
    const enter1 = await holdKeyUntil(page, 'ArrowUp', (s) => s.roomIndex === 1, 60000);
    expect(enter1.ok).toBe(true);
    await page.waitForFunction(
      () => (window.__SUBMUNDO_DEBUG__?.getMonsters().length ?? 0) > 0,
      undefined,
      { timeout: 5000 }
    );
    const s1 = await getArenaState(page);
    expect(s1).toMatchObject({ roomIndex: 1, wave: 2, finished: false });
    expect([...new Set(s1.monsters)].sort()).toEqual(['skeleton', 'skeleton_archer']);
    expect(s1.aliveMonsters).toBe(s1.monsters.length);
    expect(await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.getTestRoomIndex())).toBe(1);

    // --- Clear room 2 and walk to room 3: wave 3 (skeleton_chief only)
    await killAllMonsters(page);
    await waitDoorOpen(page, 1);
    // Step clear of the (now sealed) entry before steering sideways.
    await holdKeyUntil(page, 'ArrowUp', (s) => s.hero.y < geos[1].maxY - 40, 15000);
    await walkToX(page, door1X);
    const enter2 = await holdKeyUntil(page, 'ArrowUp', (s) => s.roomIndex === 2, 60000);
    expect(enter2.ok).toBe(true);
    await page.waitForFunction(
      () => (window.__SUBMUNDO_DEBUG__?.getMonsters().length ?? 0) > 0,
      undefined,
      { timeout: 5000 }
    );
    const s2 = await getArenaState(page);
    expect(s2).toMatchObject({ roomIndex: 2, wave: 3, finished: false });
    expect(s2.monsters).toEqual(['skeleton_chief']);

    // --- Clear room 3 -> "Teste finalizado"
    await killAllMonsters(page);
    await page.waitForFunction(
      () =>
        (window.__SUBMUNDO_DEBUG__?.scene as unknown as { testArenaFinished?: boolean })
          ?.testArenaFinished === true,
      undefined,
      { timeout: 15000 }
    );
    await page.waitForTimeout(500); // overlay fade-in

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
      return { finished: scene.testArenaFinished, textCount: found.length, visible, effAlpha };
    });
    expect(finish.finished).toBe(true);
    expect(finish.textCount).toBe(1);
    expect(finish.visible).toBe(true);
    expect(finish.effAlpha).toBeGreaterThan(0.95);
    await shot(page, 'm8_pc_teste_finalizado.png');

    expectNoErrors(errors);
  });
});
