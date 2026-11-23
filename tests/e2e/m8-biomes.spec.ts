import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { DungeonMap } from '../../src/core/dungeon/DungeonMap';
import {
  DESKTOP_VIEWPORT,
  MOBILE_LANDSCAPE_VIEWPORT,
  assertLandscapeCanvas,
  clickLogicalCanvas,
  openMobileLandscapePage,
} from './helpers/landscape';
import {
  FEET_OFFSET,
  type XY,
  expectNoErrors,
  expectTestFinished,
  getArenaState,
  getMap,
  healHero,
  heroPos,
  isFeetWalkable,
  killAllMonsters,
  waitForTestArena,
  walkFeetTo,
} from './helpers/testDungeon';

// T-076 (BRF-146): biomes of the testArena via `?biome=` (T-073/T-075), "Pegar" button / E key (T-132).
const SCREENSHOT_DIR = join(process.cwd(), 'docs', 'qa', 'screenshots');
const BIOMES = [
  'herb_field',
  'village_grotto',
  'village_mine',
  'mine_depths',
  'ancient_seal',
  'submundo_abyss',
] as const;
/** Headless Chromium floor; the measured values go to the log (and to docs/qa/qa-M8.md). */
const MIN_AVG_FPS = 25;

type Errors = { consoleErrors: string[]; pageErrors: string[]; notFoundUrls: string[] };

function trackErrors(page: Page, errors: Errors = { consoleErrors: [], pageErrors: [], notFoundUrls: [] }): Errors {
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.pageErrors.push(err.message));
  page.on('response', (res) => {
    if (res.status() === 404) errors.notFoundUrls.push(res.url());
  });
  return errors;
}

async function shot(page: Page, name: string): Promise<void> {
  const p = join(SCREENSHOT_DIR, name);
  await page.screenshot({ path: p });
  expect(existsSync(p)).toBe(true);
  expect(statSync(p).size).toBeGreaterThan(4000);
}

/** Texture keys used by the scene's display list (sprites/images + tilemap layer tilesets). */
async function texturesInUse(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    type GO = {
      texture?: { key?: string };
      tileset?: Array<{ image?: { key?: string } }>;
      list?: GO[];
    };
    const scene = window.__SUBMUNDO_DEBUG__!.scene as unknown as { children: { list: GO[] } };
    const keys = new Set<string>();
    const walk = (objs: GO[]) => {
      for (const o of objs) {
        if (o.texture?.key) keys.add(o.texture.key);
        for (const ts of o.tileset ?? []) if (ts.image?.key) keys.add(ts.image.key);
        if (o.list) walk(o.list);
      }
    };
    walk(scene.children.list);
    return [...keys].sort();
  });
}

/** Average of `game.loop.actualFps` sampled every 250 ms for `ms`. */
async function measureFps(page: Page, ms = 4000): Promise<number> {
  return page.evaluate(async (dur) => {
    const game = (window.__SUBMUNDO_DEBUG__!.scene as unknown as { game: { loop: { actualFps: number } } }).game;
    const samples: number[] = [];
    const end = performance.now() + dur;
    while (performance.now() < end) {
      await new Promise((r) => setTimeout(r, 250));
      samples.push(game.loop.actualFps);
    }
    return samples.reduce((a, b) => a + b, 0) / samples.length;
  }, ms);
}

function expectBiomeTextures(keys: string[], id: string): void {
  expect(keys).toContain(`biome_${id}_tiles`);
  expect(keys).toContain(`biome_${id}_props`);
  expect(keys.filter((k) => k.startsWith('biome_') && !k.startsWith(`biome_${id}_`))).toEqual([]);
  expect(keys.filter((k) => k.startsWith('dungeon_basic_'))).toEqual([]);
}

function expectBasicTextures(keys: string[]): void {
  expect(keys).toContain('dungeon_basic_tiles');
  expect(keys.filter((k) => k.startsWith('biome_'))).toEqual([]);
}

const fpsLog: Record<string, number> = {};

test.describe('SUBMUNDO M8 — biomas na testArena via ?biome= (T-073/T-075, PC 960x540 + Mobile 844x390)', () => {
  test.afterAll(() => {
    // eslint-disable-next-line no-console
    console.log(`[m8-biomes] FPS médio: ${JSON.stringify(fpsLog)}`);
  });

  for (const id of BIOMES) {
    test(`?biome=${id}&seed=101: getBiomeId, texturas biome_${id}_*, FPS e capturas PC/mobile`, async ({
      browser,
      page,
    }) => {
      test.setTimeout(120000);
      mkdirSync(SCREENSHOT_DIR, { recursive: true });
      const errors = trackErrors(page);

      await page.setViewportSize(DESKTOP_VIEWPORT);
      await page.goto(`/?biome=${id}&seed=101`);
      await waitForTestArena(page);
      await assertLandscapeCanvas(page, DESKTOP_VIEWPORT);
      expect(await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.getBiomeId())).toBe(id);
      expect((await getArenaState(page)).seed).toBe(101);
      expectBiomeTextures(await texturesInUse(page), id);

      await healHero(page);
      const fps = await measureFps(page);
      fpsLog[id] = Math.round(fps * 10) / 10;
      // eslint-disable-next-line no-console
      console.log(`[m8-biomes] ${id}: FPS médio ${fps.toFixed(1)}`);
      expect(fps).toBeGreaterThan(MIN_AVG_FPS);
      await healHero(page);
      await shot(page, `m8_biome_${id}_pc.png`);

      const mobile = await openMobileLandscapePage(browser, errors);
      try {
        await mobile.page.goto(`/?biome=${id}&seed=101`);
        await waitForTestArena(mobile.page);
        await assertLandscapeCanvas(mobile.page, MOBILE_LANDSCAPE_VIEWPORT);
        expect(await mobile.page.evaluate(() => window.__SUBMUNDO_DEBUG__!.getBiomeId())).toBe(id);
        expectBiomeTextures(await texturesInUse(mobile.page), id);
        await mobile.page.waitForTimeout(400);
        await shot(mobile.page, `m8_biome_${id}_mobile.png`);
      } finally {
        await mobile.context.close();
      }

      expectNoErrors(errors);
    });
  }

  for (const raw of ['village', 'nao_existe']) {
    test(`?biome=${raw} cai na Masmorra Básica`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(`/?biome=${raw}&seed=101`);
      await waitForTestArena(page);
      expect(await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.getBiomeId())).toBe('dungeon_basic');
      expectBasicTextures(await texturesInUse(page));
      expectNoErrors(errors);
    });
  }

  test('?biome=mine_depths&map=giant&seed=707: sala gigante com o bioma e FPS', async ({ page }) => {
    test.setTimeout(60000);
    const errors = trackErrors(page);
    await page.goto('/?biome=mine_depths&map=giant&seed=707');
    await waitForTestArena(page);
    expect(await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.getBiomeId())).toBe('mine_depths');
    const map = await getMap(page);
    expect(map.mode).toBe('giant');
    expect(map.seed).toBe(707);
    expectBiomeTextures(await texturesInUse(page), 'mine_depths');
    await healHero(page);
    const fps = await measureFps(page);
    fpsLog['mine_depths@giant'] = Math.round(fps * 10) / 10;
    // eslint-disable-next-line no-console
    console.log(`[m8-biomes] mine_depths@giant: FPS médio ${fps.toFixed(1)}`);
    expect(fps).toBeGreaterThan(MIN_AVG_FPS);
    expectNoErrors(errors);
  });

  test('?biome=village_grotto&seed=101: animação de ataque do herói e jogo até "Teste finalizado"', async ({
    page,
  }) => {
    test.setTimeout(420000);
    const errors = trackErrors(page);
    await page.goto('/?biome=village_grotto&seed=101');
    await waitForTestArena(page);
    expect(await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.getBiomeId())).toBe('village_grotto');

    // Wave 1 comes to the hero; auto-attack plays the hero attack animation.
    await page.waitForFunction(
      () => {
        const d = window.__SUBMUNDO_DEBUG__!;
        d.getHero().stats.hp = d.getHero().stats.maxHp;
        const s = d.scene as unknown as { heroSprite?: { anims?: { currentAnim?: { key?: string } } } };
        return (s.heroSprite?.anims?.currentAnim?.key ?? '').endsWith('_attack');
      },
      undefined,
      { timeout: 30000, polling: 50 }
    );

    const map = await getMap(page);
    for (const zone of [1, 2]) {
      await killAllMonsters(page);
      const exits = map.zones[zone - 1].exitDoorIds;
      await page.waitForFunction(
        (ids) => ids.every((i) => !window.__SUBMUNDO_DEBUG__!.getSealedDoorIds().includes(i)),
        exits,
        { timeout: 10000 }
      );
      const r = map.zones[zone].trigger[0];
      await walkFeetTo(page, { x: r.x + r.w / 2, y: r.y + r.h / 2 }, {
        timeoutMs: 180000,
        onWaypoint: () => healHero(page),
      });
      await page.waitForFunction(
        (z) => {
          const d = window.__SUBMUNDO_DEBUG__!;
          return d.getActiveZoneIndex() === z && d.getMonsters().length > 0;
        },
        zone,
        { timeout: 10000 }
      );
      const s = await getArenaState(page);
      expect(s.zoneIndex).toBe(zone);
      expect(s.wave).toBe(zone + 1);
    }
    await killAllMonsters(page);
    await expectTestFinished(page);
    expect(await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.getBiomeId())).toBe('village_grotto');
    expectNoErrors(errors);
  });
});

// ------------------------------------------------------------------------------------------
// "Pegar" button / E key (T-132)
// ------------------------------------------------------------------------------------------

/** Nearest feet spot whose strip -20..+200 px in x (±24 px in y) is clear floor. */
function clearStrip(map: DungeonMap, near: XY): XY {
  let best: XY | null = null;
  let bestD = Infinity;
  for (let dy = -320; dy <= 320; dy += 16) {
    for (let dx = -480; dx <= 480; dx += 16) {
      const p = { x: Math.round((near.x + dx) / 16) * 16, y: Math.round((near.y + dy) / 16) * 16 };
      const d = Math.hypot(p.x - near.x, p.y - near.y);
      if (d >= bestD) continue;
      let ok = true;
      for (let ox = -20; ox <= 200 && ok; ox += 10) {
        for (let oy = -24; oy <= 24 && ok; oy += 8) {
          ok = isFeetWalkable(map, p.x + ox, p.y + oy, [], 6);
        }
      }
      if (ok) {
        best = p;
        bestD = d;
      }
    }
  }
  if (!best) throw new Error('no clear floor strip near the hero start');
  return best;
}

interface PickupUi {
  stateKey: string;
  alpha: number;
  available: boolean;
  /** Logical canvas position of the button (uiCamera: zoom 1, scroll 0). */
  x: number;
  y: number;
}

async function pickupUi(page: Page): Promise<PickupUi> {
  return page.evaluate(() => {
    const hud = (window.__SUBMUNDO_DEBUG__!.scene as unknown as {
      hud: {
        pickupStateKey: string;
        lastSnapshot: { pickupAvailable?: boolean };
        pickupBtnContainer: { alpha: number; getWorldTransformMatrix: () => { tx: number; ty: number } };
      };
    }).hud;
    const m = hud.pickupBtnContainer.getWorldTransformMatrix();
    return {
      stateKey: hud.pickupStateKey,
      alpha: hud.pickupBtnContainer.alpha,
      available: hud.lastSnapshot.pickupAvailable === true,
      x: m.tx,
      y: m.ty,
    };
  });
}

async function dropPos(page: Page, instanceId: string): Promise<XY | null> {
  return page.evaluate((iid) => {
    const d = window.__SUBMUNDO_DEBUG__!.getGroundDrops().find((g) => g.item.instanceId === iid);
    return d ? { x: d.x, y: d.y } : null;
  }, instanceId);
}

async function inInventory(page: Page, instanceId: string): Promise<boolean> {
  return page.evaluate((iid) => {
    const inv = window.__SUBMUNDO_DEBUG__!.getInventory();
    const equipped = Object.values(inv.equipped ?? {}) as Array<{ instanceId?: string } | null>;
    return inv.bag.some((i) => i.instanceId === iid) || equipped.some((i) => i?.instanceId === iid);
  }, instanceId);
}

async function nearestDropDist(page: Page): Promise<number> {
  return page.evaluate(() => {
    const d = window.__SUBMUNDO_DEBUG__!;
    const h = d.getHero().position;
    return Math.min(Infinity, ...d.getGroundDrops().map((g) => Math.hypot(g.x - h.x, g.y - h.y)));
  });
}

async function waitPickupState(page: Page, on: boolean): Promise<PickupUi> {
  await page.waitForFunction(
    (want) => {
      const hud = (window.__SUBMUNDO_DEBUG__!.scene as unknown as { hud: { pickupStateKey: string } }).hud;
      return want ? hud.pickupStateKey.startsWith('on:') : hud.pickupStateKey === 'off';
    },
    on,
    { timeout: 5000 }
  );
  return pickupUi(page);
}

test.describe('SUBMUNDO M8 — botão "Pegar" e tecla E (T-132, PC 960x540)', () => {
  test('apagado sem item; aceso perto; E coleta de perto; E caminha até item a ~120 px; clique no botão coleta', async ({
    page,
  }) => {
    test.setTimeout(180000);
    const errors = trackErrors(page);
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto('/?biome=herb_field&map=rooms&seed=7');
    await waitForTestArena(page);
    await killAllMonsters(page);
    await page.waitForTimeout(800);
    const map = await getMap(page);
    const spot = clearStrip(map, { x: map.heroStart.x, y: map.heroStart.y + FEET_OFFSET });
    await walkFeetTo(page, spot);
    await page.waitForTimeout(300);

    // --- 1) No item nearby: button off (dimmed)
    expect(await nearestDropDist(page)).toBeGreaterThan(200);
    const off = await waitPickupState(page, false);
    expect(off.available).toBe(false);
    expect(off.alpha).toBeCloseTo(0.45, 2);
    // E with nothing around does nothing.
    await page.keyboard.press('e');
    await page.waitForTimeout(200);
    expect((await pickupUi(page)).stateKey).toBe('off');

    // --- 2) Item 48 px away: button on; E collects at once
    const idA = await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.spawnTestDrop('rare').instanceId);
    const on = await waitPickupState(page, true);
    expect(on.stateKey).toBe('on:rare');
    expect(on.available).toBe(true);
    expect(on.alpha).toBe(1);
    await page.keyboard.press('e');
    await page.waitForTimeout(150);
    expect(await dropPos(page, idA)).toBeNull();
    expect(await inInventory(page, idA)).toBe(true);
    await waitPickupState(page, false);

    // --- 3) Item ~120 px away: E walks there and collects
    const idB = await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.spawnTestDrop('magic').instanceId);
    const posB = (await dropPos(page, idB))!;
    await walkFeetTo(page, { x: posB.x + 120, y: posB.y + FEET_OFFSET });
    const far = await heroPos(page);
    const distFar = Math.hypot(far.x - posB.x, far.y - posB.y);
    // ~120 px (walk steering tolerance ±5 px/axis): above the click reach (70), inside the search radius (180).
    expect(distFar).toBeGreaterThan(100);
    expect(distFar).toBeLessThan(140);
    expect((await waitPickupState(page, true)).stateKey).toBe('on:magic');
    await page.keyboard.press('e');
    await page.waitForTimeout(250);
    expect(await dropPos(page, idB)).not.toBeNull(); // not instant: it walks
    const mid = await heroPos(page);
    expect(Math.hypot(mid.x - posB.x, mid.y - posB.y)).toBeLessThan(distFar - 3);
    await page.waitForFunction(
      (iid) => !window.__SUBMUNDO_DEBUG__!.getGroundDrops().some((g) => g.item.instanceId === iid),
      idB,
      { timeout: 20000 }
    );
    expect(await inInventory(page, idB)).toBe(true);
    const arrived = await heroPos(page);
    expect(Math.hypot(arrived.x - posB.x, arrived.y - posB.y)).toBeLessThanOrEqual(45);

    // --- 4) Real mouse click on the "Pegar" button collects the nearby item
    await walkFeetTo(page, spot);
    const idC = await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.spawnTestDrop('common').instanceId);
    const btn = await waitPickupState(page, true);
    expect(btn.stateKey).toBe('on:common');
    await clickLogicalCanvas(page, btn.x, btn.y);
    await page.waitForTimeout(200);
    expect(await dropPos(page, idC)).toBeNull();
    expect(await inInventory(page, idC)).toBe(true);
    await waitPickupState(page, false);

    expectNoErrors(errors);
  });
});
