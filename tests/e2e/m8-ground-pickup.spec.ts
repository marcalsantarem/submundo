import { expect, test, type Page } from '@playwright/test';
import { DESKTOP_VIEWPORT } from './helpers/landscape';
import type { DungeonMap } from '../../src/core/dungeon/DungeonMap';
import {
  FEET_OFFSET,
  expectNoErrors,
  getMap,
  heroPos,
  isFeetWalkable,
  killAllMonsters,
  waitForTestArena,
  walkFeetTo,
  worldToScreen,
  type XY,
} from './helpers/testDungeon';

// T-125: ground items are collected by click/tap only (no proximity pickup).
// T-130 (BRF-141): same checks on the new procedural map (Decision #20, `?map=rooms&seed=7`).

/** Feet point of the hero when its centre sits on `p` (drops use the hero centre). */
const feetOf = (p: XY): XY => ({ x: p.x, y: p.y + FEET_OFFSET });

/**
 * A walkable feet spot 200-260 px from `dropFeet` with a clear straight line to it (the click
 * walk goes straight), preferring mostly horizontal offsets so the drop stays on screen.
 */
function farSpot(map: DungeonMap, dropFeet: XY): XY {
  const cands: Array<XY & { score: number }> = [];
  for (let dy = -96; dy <= 96; dy += 16) {
    for (let dx = -260; dx <= 260; dx += 16) {
      const d = Math.hypot(dx, dy);
      if (d < 200 || d > 260) continue;
      const p = { x: dropFeet.x + dx, y: dropFeet.y + dy };
      let clear = true;
      for (let t = 0; t <= 1.0001 && clear; t += 0.05) {
        clear = isFeetWalkable(map, p.x + (dropFeet.x - p.x) * t, p.y + (dropFeet.y - p.y) * t, [], 10);
      }
      if (clear) cands.push({ ...p, score: Math.abs(dy) });
    }
  }
  if (cands.length === 0) throw new Error('no clear far spot around the drop');
  cands.sort((a, b) => a.score - b.score);
  return { x: cands[0].x, y: cands[0].y };
}

/** Nearest feet point whose surroundings (-40..+100 px in x, ±40 px in y) are clear floor. */
function openSpot(map: DungeonMap, near: XY): XY {
  let best: XY | null = null;
  let bestD = Infinity;
  for (let dy = -320; dy <= 320; dy += 16) {
    for (let dx = -480; dx <= 480; dx += 16) {
      const p = { x: Math.round((near.x + dx) / 16) * 16, y: Math.round((near.y + dy) / 16) * 16 };
      const d = Math.hypot(p.x - near.x, p.y - near.y);
      if (d >= bestD) continue;
      let ok = true;
      for (let ox = -40; ox <= 100 && ok; ox += 10) {
        for (let oy = -40; oy <= 40 && ok; oy += 10) {
          ok = isFeetWalkable(map, p.x + ox, p.y + oy, [], 6);
        }
      }
      if (ok) {
        best = p;
        bestD = d;
      }
    }
  }
  if (!best) throw new Error('no open floor spot near the hero start');
  return best;
}

async function dropPos(page: Page, instanceId: string): Promise<XY | null> {
  return page.evaluate((id) => {
    const d = window.__SUBMUNDO_DEBUG__!.getGroundDrops().find((g) => g.item.instanceId === id);
    return d ? { x: d.x, y: d.y } : null;
  }, instanceId);
}

async function inInventory(page: Page, instanceId: string): Promise<boolean> {
  return page.evaluate((id) => {
    const inv = window.__SUBMUNDO_DEBUG__!.getInventory();
    const equipped = Object.values(inv.equipped ?? {}) as Array<{ instanceId?: string } | null>;
    return (
      inv.bag.some((i) => i.instanceId === id) ||
      equipped.some((i) => i?.instanceId === id)
    );
  }, instanceId);
}

async function hasPickupTarget(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      (window.__SUBMUNDO_DEBUG__!.scene as unknown as { pickupTarget?: unknown }).pickupTarget !==
      undefined
  );
}

async function spawnDrop(page: Page): Promise<string> {
  return page.evaluate(() => window.__SUBMUNDO_DEBUG__!.spawnTestDrop('rare').instanceId);
}

test.describe('SUBMUNDO M8 — coleta de itens no chão por clique (T-125, PC 960x540)', () => {
  test('parar sobre o item não coleta; clique de longe caminha e coleta; tecla de movimento cancela', async ({
    page,
  }) => {
    test.setTimeout(180000);
    const errors = { consoleErrors: [] as string[], pageErrors: [] as string[], notFoundUrls: [] as string[] };
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.pageErrors.push(err.message));
    page.on('response', (res) => {
      if (res.status() === 404) errors.notFoundUrls.push(res.url());
    });

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto('/?map=rooms&seed=7');
    await waitForTestArena(page);
    // Keep combat out of the way (and let any death drops settle).
    await killAllMonsters(page);
    await page.waitForTimeout(800);
    const map = await getMap(page);
    expect(map.mode).toBe('rooms');
    // Start from an open floor spot near the start (the drop spawns 48 px to the hero's right),
    // so the result does not depend on where combat pushed the hero before the kill.
    await walkFeetTo(page, openSpot(map, feetOf(map.heroStart)));

    // --- 1) Standing on the item does NOT collect it
    const idA = await spawnDrop(page);
    const posA = (await dropPos(page, idA))!;
    expect(posA).not.toBeNull();
    await walkFeetTo(page, feetOf(posA));
    const onTop = await heroPos(page);
    expect(Math.hypot(onTop.x - posA.x, onTop.y - posA.y)).toBeLessThan(10);
    await page.waitForTimeout(1500);
    expect(await dropPos(page, idA)).not.toBeNull();
    expect(await inInventory(page, idA)).toBe(false);

    // --- 2) A real click from afar: hero walks to the item and collects it
    await walkFeetTo(page, farSpot(map, feetOf(posA)));
    const farA = await heroPos(page);
    const distFarA = Math.hypot(farA.x - posA.x, farA.y - posA.y);
    expect(distFarA).toBeGreaterThan(150);
    const screenA = await worldToScreen(page, posA);
    await page.mouse.click(screenA.x, screenA.y);
    await page.waitForTimeout(300);
    expect(await hasPickupTarget(page)).toBe(true);
    const midA = await heroPos(page);
    expect(Math.hypot(midA.x - posA.x, midA.y - posA.y)).toBeLessThan(distFarA - 3); // walking towards it
    expect(await dropPos(page, idA)).not.toBeNull(); // not collected instantly
    await page.waitForFunction(
      (id) =>
        !window.__SUBMUNDO_DEBUG__!.getGroundDrops().some((g) => g.item.instanceId === id),
      idA,
      { timeout: 45000 }
    );
    expect(await inInventory(page, idA)).toBe(true);
    const arrivedA = await heroPos(page);
    expect(Math.hypot(arrivedA.x - posA.x, arrivedA.y - posA.y)).toBeLessThanOrEqual(45);
    expect(await hasPickupTarget(page)).toBe(false);

    // --- 3) A movement key during the walk cancels it
    const idB = await spawnDrop(page);
    const posB = (await dropPos(page, idB))!;
    await walkFeetTo(page, farSpot(map, feetOf(posB)));
    const farB = await heroPos(page);
    const distFarB = Math.hypot(farB.x - posB.x, farB.y - posB.y);
    expect(distFarB).toBeGreaterThan(150);
    const screenB = await worldToScreen(page, posB);
    await page.mouse.click(screenB.x, screenB.y);
    await page.waitForTimeout(400);
    expect(await hasPickupTarget(page)).toBe(true);
    const midB = await heroPos(page);
    expect(Math.hypot(midB.x - posB.x, midB.y - posB.y)).toBeLessThan(distFarB - 3);

    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(150);
    await page.keyboard.up('ArrowDown');
    expect(await hasPickupTarget(page)).toBe(false);
    const afterCancel = await heroPos(page);
    await page.waitForTimeout(1200);
    const later = await heroPos(page);
    expect(Math.hypot(later.x - afterCancel.x, later.y - afterCancel.y)).toBeLessThan(3); // no longer walking
    expect(Math.hypot(later.x - posB.x, later.y - posB.y)).toBeGreaterThan(70);
    expect(await dropPos(page, idB)).not.toBeNull();
    expect(await inInventory(page, idB)).toBe(false);

    expectNoErrors(errors);
  });
});
