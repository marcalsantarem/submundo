import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { DungeonMap, MapCorridor } from '../../src/core/dungeon/DungeonMap';
import { DESKTOP_VIEWPORT, assertLandscapeCanvas } from './helpers/landscape';
import {
  TILE,
  type ArenaState,
  type XY,
  doorOutward,
  doorPoint,
  expectNoErrors,
  expectTestFinished,
  getArenaState,
  getMap,
  healHero,
  holdKeyUntil,
  killAllMonsters,
  waitForTestArena,
  walkFeetTo,
} from './helpers/testDungeon';

// T-130 (BRF-141): new procedural map of the testArena (Decision #20, T-127/T-128).
const SCREENSHOT_DIR = join(process.cwd(), 'docs', 'qa', 'screenshots');
const EXPECTED_WAVES = [
  ['slime', 'wolf'],
  ['skeleton', 'skeleton_archer'],
  ['skeleton_chief'],
];

async function shot(page: Page, name: string): Promise<void> {
  const p = join(SCREENSHOT_DIR, name);
  await page.screenshot({ path: p });
  expect(existsSync(p)).toBe(true);
  expect(statSync(p).size).toBeGreaterThan(1024);
}

function trackErrors(page: Page) {
  const errors = { consoleErrors: [] as string[], pageErrors: [] as string[], notFoundUrls: [] as string[] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.pageErrors.push(err.message));
  page.on('response', (res) => {
    if (res.status() === 404) errors.notFoundUrls.push(res.url());
  });
  return errors;
}

/** A corridor bends when its 2-wide path spans more than 2 columns AND more than 2 rows. */
function isCurved(c: MapCorridor): boolean {
  return new Set(c.cells.map((x) => x.col)).size > 2 && new Set(c.cells.map((x) => x.row)).size > 2;
}

function triggerTarget(map: DungeonMap, zone: number): XY {
  const r = map.zones[zone].trigger[0];
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

async function waitZone(page: Page, zone: number): Promise<ArenaState> {
  await page.waitForFunction(
    (z) => {
      const d = window.__SUBMUNDO_DEBUG__!;
      return d.getActiveZoneIndex() === z && d.getMonsters().length > 0;
    },
    zone,
    { timeout: 10000 }
  );
  return getArenaState(page);
}

function expectWave(s: ArenaState, zone: number): void {
  expect(s.zoneIndex).toBe(zone);
  expect(s.wave).toBe(zone + 1);
  expect(s.finished).toBe(false);
  expect([...new Set(s.monsters)].sort()).toEqual(EXPECTED_WAVES[zone]);
  expect(s.aliveMonsters).toBe(s.monsters.length);
}

/** Clears zone `zone` (debug) and waits for its exit doors to unseal. */
async function clearZone(page: Page, map: DungeonMap, zone: number): Promise<void> {
  await killAllMonsters(page);
  const exits = map.zones[zone].exitDoorIds;
  await page.waitForFunction(
    (ids) => {
      const sealed = window.__SUBMUNDO_DEBUG__!.getSealedDoorIds();
      return ids.every((id) => !sealed.includes(id));
    },
    exits,
    { timeout: 10000 }
  );
}

for (const SEED of [101, 606]) {
  test.describe(`SUBMUNDO M8 — mapa novo modo rooms seed=${SEED} (PC 960x540)`, () => {
    test(`seed=${SEED}: porta selada segura o herói, caminhada por teclado 0→1→2, ondas 1→2→3 e "Teste finalizado"`, async ({
      page,
    }) => {
      test.setTimeout(420000);
      mkdirSync(SCREENSHOT_DIR, { recursive: true });
      const errors = trackErrors(page);
      const captures = SEED === 101;

      await page.setViewportSize(DESKTOP_VIEWPORT);
      await page.goto(`/?map=rooms&seed=${SEED}`);
      await waitForTestArena(page);
      await assertLandscapeCanvas(page, DESKTOP_VIEWPORT);

      // --- Map structure
      const map = await getMap(page);
      expect(map.mode).toBe('rooms');
      expect(map.seed).toBe(SEED);
      expect(map.zones.map((z) => z.wave)).toEqual([1, 2, 3]);
      expect(map.zones.map((z) => z.isBossZone)).toEqual([false, false, true]);
      expect(map.zones[0].entryDoorIds).toEqual([]);
      expect(map.zones[2].exitDoorIds).toEqual([]);
      expect(map.doors.some((d) => d.side === 'e' || d.side === 'w')).toBe(true);
      expect(map.corridors.some(isCurved)).toBe(true);

      const s0 = await getArenaState(page);
      expect(s0).toMatchObject({ seed: SEED, mode: 'rooms' });
      expectWave(s0, 0);
      for (const banned of ['cave_bat', 'wolf_alpha', 'karnak']) {
        expect(s0.monsters).not.toContain(banned);
      }
      // Exit doors are born sealed (all zones); no entry door is sealed yet.
      const allExits = map.zones.flatMap((z) => z.exitDoorIds);
      expect([...s0.sealedDoorIds].sort()).toEqual([...allExits].sort());

      // --- Sealed exit door of zone 0: pushing against it keeps the hero inside
      const exitDoor = map.doors.find((d) => d.id === map.zones[0].exitDoorIds[0])!;
      const dp = doorPoint(exitDoor);
      const out = doorOutward(exitDoor);
      const proj = (f: XY) => (f.x - dp.x) * out.x + (f.y - dp.y) * out.y;
      // Feet 40 px inside the room, in front of the opening.
      await healHero(page);
      await walkFeetTo(page, { x: dp.x - out.x * 40, y: dp.y - out.y * 40 }, {
        onWaypoint: () => healHero(page),
      });
      const pushKey = { n: 'ArrowUp', s: 'ArrowDown', e: 'ArrowRight', w: 'ArrowLeft' }[exitDoor.side];
      const atWall = await holdKeyUntil(page, pushKey, (s) => proj(s.feet) > -24, 20000);
      expect(atWall.ok).toBe(true);
      const sealed = await holdKeyUntil(page, pushKey, (s) => proj(s.feet) > 2 || s.zoneIndex !== 0, 2500);
      expect(sealed.ok).toBe(false);
      expect(sealed.state.zoneIndex).toBe(0);
      expect(proj(sealed.state.feet)).toBeLessThanOrEqual(2);
      expect(proj(sealed.state.feet)).toBeGreaterThan(-30); // it really reached the door
      expect(sealed.state.sealedDoorIds).toContain(exitDoor.id);
      if (captures && (exitDoor.side === 'e' || exitDoor.side === 'w')) {
        await page.waitForTimeout(150);
        await shot(page, 'm8_map_porta_lateral.png');
      }

      // --- Zone 0 -> 1 -> 2 by keyboard
      const zoneSeq: number[] = [0];
      const waveSeq: number[] = [s0.wave];
      let curveShot = !captures;
      const curved = new Set(
        map.corridors.filter(isCurved).flatMap((c) => c.cells.map((x) => x.row * map.cols + x.col))
      );

      for (const zone of [1, 2]) {
        await clearZone(page, map, zone - 1);
        expect((await getArenaState(page)).zoneIndex).toBe(zone - 1);
        await walkFeetTo(page, triggerTarget(map, zone), {
          timeoutMs: 180000,
          onWaypoint: async (p, i) => {
            await healHero(page);
            const k = Math.floor(p.y / TILE) * map.cols + Math.floor(p.x / TILE);
            if (!curveShot && i > 0 && curved.has(k) && map.cells[k] === 2) {
              curveShot = true;
              // The waypoint is a corner of the path inside a curved corridor (its bend).
              await page.waitForTimeout(150);
              await shot(page, 'm8_map_corredor_curva.png');
            }
          },
        });
        const s = await waitZone(page, zone);
        expectWave(s, zone);
        // The entry doors of the new zone seal behind the hero.
        for (const id of map.zones[zone].entryDoorIds) expect(s.sealedDoorIds).toContain(id);
        zoneSeq.push(s.zoneIndex);
        waveSeq.push(s.wave);
      }
      expect(zoneSeq).toEqual([0, 1, 2]);
      expect(waveSeq).toEqual([1, 2, 3]);
      expect(curveShot).toBe(true);

      // --- Clear the boss zone -> "Teste finalizado"
      await killAllMonsters(page);
      await expectTestFinished(page);
      if (captures) await shot(page, 'm8_map_teste_finalizado.png');

      expectNoErrors(errors);
    });
  });
}

test.describe('SUBMUNDO M8 — mapa novo modo giant seed=707 (PC 960x540)', () => {
  test('seed=707: zonas ativam ao pisar no trigger, ondas 1→2→3 e "Teste finalizado"', async ({ page }) => {
    test.setTimeout(420000);
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const errors = trackErrors(page);

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto('/?map=giant&seed=707');
    await waitForTestArena(page);
    await assertLandscapeCanvas(page, DESKTOP_VIEWPORT);

    const map = await getMap(page);
    expect(map.mode).toBe('giant');
    expect(map.seed).toBe(707);
    expect(map.rooms).toHaveLength(1);
    expect(map.doors).toEqual([]);
    expect(map.zones.map((z) => z.wave)).toEqual([1, 2, 3]);
    for (const z of map.zones) {
      expect(z.entryDoorIds).toEqual([]);
      expect(z.exitDoorIds).toEqual([]);
    }

    const s0 = await getArenaState(page);
    expect(s0).toMatchObject({ seed: 707, mode: 'giant' });
    expectWave(s0, 0);
    expect(s0.sealedDoorIds).toEqual([]);

    for (const zone of [1, 2]) {
      await killAllMonsters(page);
      await page.waitForTimeout(400);
      // Not inside the next trigger yet: the next wave has not spawned.
      expect((await getArenaState(page)).zoneIndex).toBe(zone - 1);
      await walkFeetTo(page, triggerTarget(map, zone), {
        timeoutMs: 180000,
        onWaypoint: () => healHero(page),
      });
      const s = await waitZone(page, zone);
      expectWave(s, zone);
      const f = s.feet;
      expect(map.zones[zone].trigger.some((t) => f.x > t.x && f.x < t.x + t.w && f.y > t.y && f.y < t.y + t.h)).toBe(true);
      if (zone === 1) {
        await page.waitForTimeout(300);
        await shot(page, 'm8_map_sala_gigante.png');
      }
    }

    await killAllMonsters(page);
    await expectTestFinished(page);
    expectNoErrors(errors);
  });
});
