import { expect, type Page } from '@playwright/test';

/** Helpers for the 3-room test dungeon (Decisions #18/#19, T-123/T-124/T-125). */

export interface XY {
  x: number;
  y: number;
}

export interface TestGeo {
  x: number;
  y: number;
  width: number;
  height: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ArenaState {
  roomIndex: number;
  wave: number;
  finished: boolean;
  seed: number;
  hero: XY;
  monsters: string[];
  aliveMonsters: number;
}

export const TILE = 32;

export async function waitForTestArena(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const d = window.__SUBMUNDO_DEBUG__;
      if (!d) return false;
      const s = d.scene as unknown as { testArenaWave?: number };
      return s.testArenaWave === 1 && d.getMonsters().length > 0;
    },
    undefined,
    { timeout: 10000 }
  );
}

export async function getArenaState(page: Page): Promise<ArenaState> {
  return page.evaluate(() => {
    const d = window.__SUBMUNDO_DEBUG__!;
    const s = d.scene as unknown as {
      testArenaRoomIndex: number;
      testArenaWave: number;
      testArenaFinished: boolean;
      testArenaSeed: number;
    };
    const h = d.getHero().position;
    return {
      roomIndex: s.testArenaRoomIndex,
      wave: s.testArenaWave,
      finished: s.testArenaFinished,
      seed: s.testArenaSeed,
      hero: { x: h.x, y: h.y },
      monsters: d.getMonsters().map((m) => m.defId),
      aliveMonsters: d.getMonsters().filter((m) => m.isAlive).length,
    };
  });
}

/** World geometry of every room (private runtime, read for test steering only). */
export async function getRoomGeos(page: Page): Promise<TestGeo[]> {
  return page.evaluate(() => {
    const s = window.__SUBMUNDO_DEBUG__!.scene as unknown as {
      testRuntime: Array<{ geo: TestGeo }>;
    };
    return s.testRuntime.map((rt) => ({ ...rt.geo }));
  });
}

/** World x of the centre of room `index`'s exit door (null for the boss room). */
export async function getExitDoorX(page: Page, index: number): Promise<number | null> {
  return page.evaluate((i) => {
    const d = window.__SUBMUNDO_DEBUG__!;
    const spec = d.getTestRooms()[i];
    const origin = d.getTestRoomWorldOrigins()[i];
    if (!spec?.exitDoorCols || !origin) return null;
    return origin.x + (spec.exitDoorCols[0] + 1) * 32;
  }, index);
}

export async function killAllMonsters(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const m of window.__SUBMUNDO_DEBUG__!.getMonsters()) {
      m.hp = 0;
      m.isAlive = false;
    }
  });
}

export async function heroPos(page: Page): Promise<XY> {
  return page.evaluate(() => {
    const p = window.__SUBMUNDO_DEBUG__!.getHero().position;
    return { x: p.x, y: p.y };
  });
}

export async function releaseArrows(page: Page): Promise<void> {
  for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
    await page.keyboard.up(k);
  }
}

/** Real keyboard steering on the x axis until the hero is within `tol` px of `targetX`. */
export async function walkToX(
  page: Page,
  targetX: number,
  { tol = 6, timeoutMs = 30000 } = {}
): Promise<XY> {
  const deadline = Date.now() + timeoutMs;
  let held: string | null = null;
  try {
    for (;;) {
      const p = await heroPos(page);
      const dx = targetX - p.x;
      if (Math.abs(dx) <= tol) return p;
      if (Date.now() > deadline) {
        throw new Error(`walkToX(${targetX}) timed out at x=${p.x.toFixed(1)}`);
      }
      const want = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
      if (held !== want) {
        if (held) await page.keyboard.up(held);
        await page.keyboard.down(want);
        held = want;
      }
      // Short polling keeps the overshoot small (headless walk speed is ~50 px/s).
      await page.waitForTimeout(Math.abs(dx) < 30 ? 15 : 40);
    }
  } finally {
    if (held) await page.keyboard.up(held);
  }
}

/** Holds `key` until `predicate(state)` is true or the timeout expires (returns last state). */
export async function holdKeyUntil(
  page: Page,
  key: string,
  predicate: (s: ArenaState) => boolean,
  timeoutMs: number
): Promise<{ ok: boolean; state: ArenaState }> {
  const deadline = Date.now() + timeoutMs;
  await page.keyboard.down(key);
  try {
    for (;;) {
      const state = await getArenaState(page);
      if (predicate(state)) return { ok: true, state };
      if (Date.now() > deadline) return { ok: false, state };
      await page.waitForTimeout(40);
    }
  } finally {
    await page.keyboard.up(key);
  }
}

/** World -> page (CSS px) for the main camera. */
export async function worldToScreen(page: Page, p: XY): Promise<XY> {
  return page.evaluate((w) => {
    const s = window.__SUBMUNDO_DEBUG__!.scene as unknown as {
      cameras: { main: { worldView: { x: number; y: number }; zoom: number; x: number; y: number } };
      scale: { width: number; height: number };
      game: { canvas: HTMLCanvasElement };
    };
    const cam = s.cameras.main;
    const r = s.game.canvas.getBoundingClientRect();
    const k = r.width / s.scale.width;
    return {
      x: r.left + (cam.x + (w.x - cam.worldView.x) * cam.zoom) * k,
      y: r.top + (cam.y + (w.y - cam.worldView.y) * cam.zoom) * k,
    };
  }, p);
}

/** Real mouse click on a ground drop's screen position (T-125 click pickup). */
export async function clickGroundDrop(page: Page, instanceId: string): Promise<void> {
  const world = await page.evaluate((id) => {
    const d = window.__SUBMUNDO_DEBUG__!.getGroundDrops().find((g) => g.item.instanceId === id);
    return d ? { x: d.x, y: d.y } : null;
  }, instanceId);
  if (!world) throw new Error(`ground drop ${instanceId} not found`);
  const screen = await worldToScreen(page, world);
  await page.mouse.click(screen.x, screen.y);
}

/**
 * Collects every ground drop through the debug `pickUpDropAt(i)` (same path as a
 * click). Drops spawned by `spawnTestDrop` sit within click reach of the hero.
 */
export async function pickUpAllDropsViaDebug(page: Page): Promise<number> {
  return page.evaluate(() => {
    const dbg = window.__SUBMUNDO_DEBUG__!;
    let picked = 0;
    for (let i = dbg.getGroundDrops().length - 1; i >= 0; i--) {
      if (dbg.pickUpDropAt(i)) picked++;
    }
    return picked;
  });
}

export function expectNoErrors(errors: {
  consoleErrors: string[];
  pageErrors: string[];
  notFoundUrls: string[];
}): void {
  expect(errors.consoleErrors).toEqual([]);
  expect(errors.pageErrors).toEqual([]);
  expect(errors.notFoundUrls).toEqual([]);
}
