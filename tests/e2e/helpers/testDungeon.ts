import { expect, type Page } from '@playwright/test';
import type { DungeonMap, MapDoor } from '../../../src/core/dungeon/DungeonMap';

/**
 * Helpers for the procedural test map (Decision #20, T-127/T-128): `?map=rooms|giant&seed=N`.
 * Walks use a path found by Dijkstra over the walkable feet grid of `getDungeonMap()` and
 * are driven with real arrow keys.
 */

export interface XY {
  x: number;
  y: number;
}

export interface ArenaState {
  zoneIndex: number;
  wave: number;
  finished: boolean;
  seed: number;
  mode: string;
  hero: XY;
  /** Hero feet (world px): the point used for walkability and zone triggers. */
  feet: XY;
  monsters: string[];
  aliveMonsters: number;
  sealedDoorIds: number[];
}

export const TILE = 32;
/** Same as MAP_FEET_OFFSET / MAP_FEET_BOX in src/core/dungeon/DungeonMap.ts. */
export const FEET_OFFSET = 30;
const FEET_BOX = { left: 14, right: 14, up: 8, down: 6 };
const CELL_VOID = 0;
const GRID = 16;

export async function waitForTestArena(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const d = window.__SUBMUNDO_DEBUG__;
      if (!d) return false;
      const s = d.scene as unknown as { testArenaWave?: number };
      return s.testArenaWave === 1 && d.getMonsters().length > 0 && !!d.getDungeonMap();
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
      testArenaMapMode: string;
    };
    const h = d.getHero().position;
    return {
      zoneIndex: d.getActiveZoneIndex(),
      wave: s.testArenaWave,
      finished: s.testArenaFinished,
      seed: s.testArenaSeed,
      mode: s.testArenaMapMode,
      hero: { x: h.x, y: h.y },
      feet: { x: h.x, y: h.y + 30 },
      monsters: d.getMonsters().map((m) => m.defId),
      aliveMonsters: d.getMonsters().filter((m) => m.isAlive).length,
      sealedDoorIds: d.getSealedDoorIds(),
    };
  });
}

export async function getMap(page: Page): Promise<DungeonMap> {
  const map = await page.evaluate(() => {
    const m = window.__SUBMUNDO_DEBUG__!.getDungeonMap();
    return m ? (JSON.parse(JSON.stringify(m)) as DungeonMap) : null;
  });
  if (!map) throw new Error('getDungeonMap() returned undefined');
  return map;
}

export async function killAllMonsters(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const m of window.__SUBMUNDO_DEBUG__!.getMonsters()) {
      m.hp = 0;
      m.isAlive = false;
    }
  });
}

/** Keeps the hero alive during long walks (monsters of the active zone may hit it). */
export async function healHero(page: Page): Promise<void> {
  await page.evaluate(() => {
    const h = window.__SUBMUNDO_DEBUG__!.getHero();
    h.stats.hp = h.stats.maxHp;
  });
}

export async function heroPos(page: Page): Promise<XY> {
  return page.evaluate(() => {
    const p = window.__SUBMUNDO_DEBUG__!.getHero().position;
    return { x: p.x, y: p.y };
  });
}

export async function heroFeet(page: Page): Promise<XY> {
  const p = await heroPos(page);
  return { x: p.x, y: p.y + FEET_OFFSET };
}

export async function releaseArrows(page: Page): Promise<void> {
  for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
    await page.keyboard.up(k);
  }
}

// ------------------------------------------------------------------------------------------
// Map geometry (mirrors the scene's isFeetValid for the hero, roomId === null)
// ------------------------------------------------------------------------------------------

/** Same as doorBlockRect in src/view/scenes/DungeonMapRenderer.ts. */
export function doorBlockRect(d: MapDoor): { x: number; y: number; w: number; h: number } {
  const T = TILE;
  switch (d.side) {
    case 'n': return { x: d.col * T, y: (d.row - 3) * T, w: 2 * T, h: 3 * T };
    case 's': return { x: d.col * T, y: (d.row + 1) * T, w: 2 * T, h: T };
    case 'e': return { x: (d.col + 1) * T, y: d.row * T, w: T, h: 2 * T };
    default: return { x: (d.col - 1) * T, y: d.row * T, w: T, h: 2 * T };
  }
}

/** Same as mapDoorPoint: the opening point on the room floor edge (world px). */
export function doorPoint(d: MapDoor): XY {
  const T = TILE;
  switch (d.side) {
    case 'n': return { x: (d.col + 1) * T, y: d.row * T };
    case 's': return { x: (d.col + 1) * T, y: (d.row + 1) * T };
    case 'e': return { x: (d.col + 1) * T, y: (d.row + 1) * T };
    default: return { x: d.col * T, y: (d.row + 1) * T };
  }
}

/** Outward unit vector of a door (from its room into the corridor). */
export function doorOutward(d: MapDoor): XY {
  return { n: { x: 0, y: -1 }, s: { x: 0, y: 1 }, e: { x: 1, y: 0 }, w: { x: -1, y: 0 } }[d.side];
}

export function isFeetWalkable(
  map: DungeonMap,
  fx: number,
  fy: number,
  sealed: number[] = [],
  margin = 0
): boolean {
  const l = fx - FEET_BOX.left - margin;
  const r = fx + FEET_BOX.right + margin;
  const t = fy - FEET_BOX.up - margin;
  const b = fy + FEET_BOX.down + margin;
  for (const x of [l, (l + r) / 2, r]) {
    for (const y of [t, (t + b) / 2, b]) {
      const c = Math.floor(x / TILE);
      const row = Math.floor(y / TILE);
      if (c < 0 || row < 0 || c >= map.cols || row >= map.rows) return false;
      if (map.cells[row * map.cols + c] === CELL_VOID) return false;
    }
  }
  for (const o of map.obstacles) {
    if (fx > o.x - margin && fx < o.x + o.w + margin && fy > o.y - margin && fy < o.y + o.h + margin) {
      return false;
    }
  }
  for (const id of sealed) {
    const door = map.doors.find((d) => d.id === id);
    if (!door) continue;
    const q = doorBlockRect(door);
    if (l < q.x + q.w && r > q.x && t < q.y + q.h && b > q.y) return false;
  }
  return true;
}

/**
 * Shortest feet path (world px, GRID nodes) from `from` to `to`, preferring nodes away from
 * walls/obstacles. Returns the simplified list of corner points (last one = `to` snapped).
 */
export function findFeetPath(map: DungeonMap, from: XY, to: XY, sealed: number[] = []): XY[] {
  const W = Math.ceil((map.cols * TILE) / GRID) + 1;
  const H = Math.ceil((map.rows * TILE) / GRID) + 1;
  const walk = new Int8Array(W * H).fill(-1); // -1 unknown, 0 blocked, 1 ok, 2 ok but near a wall
  const state = (i: number, j: number): number => {
    const k = j * W + i;
    if (walk[k] === -1) {
      const x = i * GRID;
      const y = j * GRID;
      walk[k] = !isFeetWalkable(map, x, y, sealed) ? 0 : isFeetWalkable(map, x, y, sealed, 10) ? 1 : 2;
    }
    return walk[k];
  };
  const nearestNode = (p: XY): [number, number] => {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    const ci = Math.round(p.x / GRID);
    const cj = Math.round(p.y / GRID);
    for (let dj = -6; dj <= 6; dj++) {
      for (let di = -6; di <= 6; di++) {
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= W || j >= H || state(i, j) === 0) continue;
        const d = Math.hypot(i * GRID - p.x, j * GRID - p.y);
        if (d < bestD) {
          bestD = d;
          best = [i, j];
        }
      }
    }
    if (!best) throw new Error(`no walkable node near (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`);
    return best;
  };
  const [si, sj] = nearestNode(from);
  const [ti, tj] = nearestNode(to);
  const start = sj * W + si;
  const goal = tj * W + ti;
  const dist = new Float64Array(W * H).fill(Infinity);
  const prev = new Int32Array(W * H).fill(-1);
  // Binary heap of [cost, node].
  const heap: Array<[number, number]> = [];
  const push = (e: [number, number]) => {
    heap.push(e);
    let n = heap.length - 1;
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (heap[p][0] <= heap[n][0]) break;
      [heap[p], heap[n]] = [heap[n], heap[p]];
      n = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let n = 0;
      for (;;) {
        const a = 2 * n + 1;
        const b = a + 1;
        let m = n;
        if (a < heap.length && heap[a][0] < heap[m][0]) m = a;
        if (b < heap.length && heap[b][0] < heap[m][0]) m = b;
        if (m === n) break;
        [heap[m], heap[n]] = [heap[n], heap[m]];
        n = m;
      }
    }
    return top;
  };
  dist[start] = 0;
  push([0, start]);
  while (heap.length > 0) {
    const [c, k] = pop();
    if (c > dist[k]) continue;
    if (k === goal) break;
    const i = k % W;
    const j = (k - i) / W;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const st = state(ni, nj);
      if (st === 0) continue;
      const nk = nj * W + ni;
      const nc = c + (st === 2 ? 6 : 1);
      if (nc < dist[nk]) {
        dist[nk] = nc;
        prev[nk] = k;
        push([nc, nk]);
      }
    }
  }
  if (dist[goal] === Infinity) {
    throw new Error(`no path from (${from.x.toFixed(0)}, ${from.y.toFixed(0)}) to (${to.x}, ${to.y})`);
  }
  const nodes: XY[] = [];
  for (let k = goal; k !== -1; k = prev[k]) {
    const i = k % W;
    nodes.push({ x: i * GRID, y: ((k - i) / W) * GRID });
  }
  nodes.reverse();
  // Keep only the corners (direction changes) and the last node.
  const corners: XY[] = [];
  for (let n = 1; n < nodes.length; n++) {
    const a = nodes[n - 1];
    const b = nodes[n];
    const c = nodes[n + 1];
    if (!c || Math.sign(b.x - a.x) !== Math.sign(c.x - b.x) || Math.sign(b.y - a.y) !== Math.sign(c.y - b.y)) {
      corners.push(b);
    }
  }
  return corners;
}

/** Real keyboard steering of the hero's feet to `target` (both axes within `tol`). */
export async function steerFeetTo(
  page: Page,
  target: XY,
  { tol = 5, timeoutMs = 30000, stuckMs = 4000 } = {}
): Promise<XY> {
  const deadline = Date.now() + timeoutMs;
  const held = new Set<string>();
  let lastProgress = Date.now();
  let bestD = Infinity;
  try {
    for (;;) {
      const f = await heroFeet(page);
      const dx = target.x - f.x;
      const dy = target.y - f.y;
      const d = Math.hypot(dx, dy);
      if (Math.abs(dx) <= tol && Math.abs(dy) <= tol) return f;
      if (d < bestD - 1) {
        bestD = d;
        lastProgress = Date.now();
      }
      // Under heavy frame pacing a step can overshoot a corner into a wall: close enough is fine.
      if (Date.now() - lastProgress > stuckMs / 2 && d <= 16) return f;
      if (Date.now() > deadline || Date.now() - lastProgress > stuckMs) {
        throw new Error(
          `steerFeetTo(${target.x.toFixed(0)}, ${target.y.toFixed(0)}) stuck/timed out at feet ` +
            `(${f.x.toFixed(1)}, ${f.y.toFixed(1)})`
        );
      }
      const want = new Set<string>();
      if (Math.abs(dx) > tol) want.add(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
      if (Math.abs(dy) > tol) want.add(dy > 0 ? 'ArrowDown' : 'ArrowUp');
      for (const k of [...held]) {
        if (!want.has(k)) {
          await page.keyboard.up(k);
          held.delete(k);
        }
      }
      for (const k of want) {
        if (!held.has(k)) {
          await page.keyboard.down(k);
          held.add(k);
        }
      }
      await page.waitForTimeout(d < 30 ? 10 : 35);
    }
  } finally {
    for (const k of held) await page.keyboard.up(k);
  }
}

/**
 * Walks the hero (real arrow keys) along a Dijkstra path over walkable cells to the feet
 * point `target`. `onWaypoint` runs after each corner (e.g. heal / screenshots).
 */
export async function walkFeetTo(
  page: Page,
  target: XY,
  {
    timeoutMs = 120000,
    onWaypoint,
  }: { timeoutMs?: number; onWaypoint?: (p: XY, i: number) => Promise<void> } = {}
): Promise<XY> {
  const map = await getMap(page);
  const { sealedDoorIds } = await getArenaState(page);
  const from = await heroFeet(page);
  const path = findFeetPath(map, from, target, sealedDoorIds);
  const deadline = Date.now() + timeoutMs;
  let last = from;
  for (let i = 0; i < path.length; i++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error(`walkFeetTo timed out at waypoint ${i}/${path.length}`);
    const isLast = i === path.length - 1;
    last = await steerFeetTo(page, path[i], { tol: isLast ? 5 : 7, timeoutMs: remaining });
    if (onWaypoint) await onWaypoint(last, i);
  }
  return last;
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

/** Waits until `testArenaFinished` and checks the "Teste finalizado" overlay text is visible. */
export async function expectTestFinished(page: Page): Promise<void> {
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
