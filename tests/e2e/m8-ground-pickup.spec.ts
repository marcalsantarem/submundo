import { expect, test, type Page } from '@playwright/test';
import { DESKTOP_VIEWPORT } from './helpers/landscape';
import {
  expectNoErrors,
  heroPos,
  killAllMonsters,
  waitForTestArena,
  walkToX,
  worldToScreen,
  type XY,
} from './helpers/testDungeon';

// T-125: ground items are collected by click/tap only (no proximity pickup).

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
    await page.goto('/?seed=7');
    await waitForTestArena(page);
    // Keep combat out of the way (and let any death drops settle).
    await killAllMonsters(page);
    await page.waitForTimeout(800);

    // --- 1) Standing on the item does NOT collect it
    const idA = await spawnDrop(page);
    const posA = (await dropPos(page, idA))!;
    expect(posA).not.toBeNull();
    await walkToX(page, posA.x, { tol: 4 });
    const onTop = await heroPos(page);
    expect(Math.hypot(onTop.x - posA.x, onTop.y - posA.y)).toBeLessThan(10);
    await page.waitForTimeout(1500);
    expect(await dropPos(page, idA)).not.toBeNull();
    expect(await inInventory(page, idA)).toBe(false);

    // --- 2) A real click from afar: hero walks to the item and collects it
    await walkToX(page, posA.x - 220);
    const farA = await heroPos(page);
    expect(Math.hypot(farA.x - posA.x, farA.y - posA.y)).toBeGreaterThan(150);
    const screenA = await worldToScreen(page, posA);
    await page.mouse.click(screenA.x, screenA.y);
    await page.waitForTimeout(300);
    expect(await hasPickupTarget(page)).toBe(true);
    expect((await heroPos(page)).x).toBeGreaterThan(farA.x); // walking towards it
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
    await walkToX(page, posB.x - 220);
    const farB = await heroPos(page);
    const screenB = await worldToScreen(page, posB);
    await page.mouse.click(screenB.x, screenB.y);
    await page.waitForTimeout(400);
    expect(await hasPickupTarget(page)).toBe(true);
    const midB = await heroPos(page);
    expect(midB.x).toBeGreaterThan(farB.x);

    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(150);
    await page.keyboard.up('ArrowDown');
    expect(await hasPickupTarget(page)).toBe(false);
    const afterCancel = await heroPos(page);
    await page.waitForTimeout(1200);
    const later = await heroPos(page);
    expect(Math.abs(later.x - afterCancel.x)).toBeLessThan(3); // no longer walking
    expect(Math.hypot(later.x - posB.x, later.y - posB.y)).toBeGreaterThan(70);
    expect(await dropPos(page, idB)).not.toBeNull();
    expect(await inInventory(page, idB)).toBe(false);

    expectNoErrors(errors);
  });
});
