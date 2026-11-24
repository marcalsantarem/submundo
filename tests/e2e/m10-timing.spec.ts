import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * M10 (T-149): tempo real de cada missão do prólogo jogada pelo piloto de debug (`autoWalkTo`).
 * O herói só anda (piloto) e colhe com a tecla `E`; o combate é o auto-ataque normal.
 * Sem atalhos de vitória: as salas só abrem quando os monstros morrem de verdade.
 * Cura de emergência (HP < 25%) é contada e registrada, para a medida não parar numa derrota.
 * Demorado (~10 min): só roda com `M10_TIMING=1`. Resultado em `test-results/m10-timing.json`.
 */

const RUN = process.env.M10_TIMING === '1';

interface MissionState {
  missionId: string;
  zoneIndex: number;
  zoneCount: number;
  zonesCleared: boolean[];
  zoneTriggers: Array<{ x: number; y: number }>;
  objective: { itemId: string; collected: number; count: number } | null;
  collectibles: Array<{ id: number; x: number; y: number; zoneId: number | null; picked: boolean }>;
  eventPoint: { x: number; y: number; visited: boolean } | null;
  finished: boolean;
  prologueEnded: boolean;
  heroFeet: { x: number; y: number };
  heroHp: number;
  heroAlive: boolean;
  runStatus: string;
  autoWalking: boolean;
  elapsedMs: number;
}

interface Timing {
  missionId: string;
  gameSeconds: number;
  wallSeconds: number;
  heals: number;
  result: string;
  avgFps: number;
  notes: string[];
}

async function waitVillage(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const hub = window.__SUBMUNDO_HUB_DEBUG__;
      return (
        Boolean(hub?.getVillageState?.()) &&
        (hub!.scene as unknown as { scene: { isActive: () => boolean } }).scene.isActive()
      );
    },
    undefined,
    { timeout: 20000 }
  );
}

async function closeDialogues(page: Page): Promise<void> {
  for (let i = 0; i < 12; i++) {
    const open = await page.evaluate(() => window.__SUBMUNDO_HUB_DEBUG__!.getDialogueBox().isOpen());
    if (!open) return;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  }
}

async function talk(page: Page, npc: 'master' | 'lyra' | 'gorran'): Promise<void> {
  await page.evaluate((id) => window.__SUBMUNDO_HUB_DEBUG__!.talkTo!(id), npc);
  await closeDialogues(page);
}

async function enter(page: Page, missionId: string): Promise<void> {
  expect(await page.evaluate(() => window.__SUBMUNDO_HUB_DEBUG__!.openGate!())).toBe(true);
  const list = await page.evaluate(() => window.__SUBMUNDO_HUB_DEBUG__!.getVillageState!()!.gateMissions);
  await page.keyboard.press(`Digit${list.indexOf(missionId) + 1}`);
  await page.waitForFunction(
    (id) => {
      const d = window.__SUBMUNDO_DEBUG__;
      const sc = d?.scene as unknown as { scene?: { key: string; isActive: () => boolean } } | undefined;
      return (
        sc?.scene?.key === 'DungeonScene' &&
        sc.scene.isActive() &&
        typeof d!.getMissionState === 'function' &&
        d!.getMissionState()?.missionId === id
      );
    },
    missionId,
    { timeout: 20000 }
  );
}

async function state(page: Page): Promise<MissionState> {
  return (await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.getMissionState())) as unknown as MissionState;
}

/** Joga a missão com o piloto até terminar (vitória, derrota ou fim do prólogo). */
async function pilot(page: Page, limitMs: number): Promise<Timing> {
  const wall0 = Date.now();
  const s0 = await state(page);
  const notes: string[] = [];
  let heals = 0;
  let frames = 0;
  let fpsSum = 0;
  let lastTarget = '';
  let lastEPress = 0;
  let lastSig = '';
  const skipped = new Set<number>();
  let skipZone = -1;
  let itemTarget = -1;
  let itemSince = 0;
  let lastProgressAt = Date.now();
  const walk = async (x: number, y: number, key: string) => {
    const s = await state(page);
    if (key !== lastTarget || !s.autoWalking) {
      lastTarget = key;
      await page.evaluate((t) => window.__SUBMUNDO_DEBUG__!.autoWalkTo(t.x, t.y), { x, y });
    }
  };
  for (;;) {
    const s = await state(page);
    if (!s || s.finished || s.prologueEnded || s.runStatus === 'victory' || s.runStatus === 'defeat') break;
    if (Date.now() - wall0 > limitMs) {
      notes.push('limite de tempo de parede atingido');
      break;
    }
    const fps = await page.evaluate(
      () => (window.__SUBMUNDO_DEBUG__!.scene as unknown as { game: { loop: { actualFps: number } } }).game.loop.actualFps
    );
    fpsSum += fps;
    frames++;
    const karnakRoom = s.missionId === 'mission_depths' && s.zoneIndex === s.zoneCount - 1;
    if (!karnakRoom && s.heroAlive && s.heroHp > 0 && s.heroHp < 30) {
      await page.evaluate(() => {
        const h = window.__SUBMUNDO_DEBUG__!.getHero();
        h.stats.hp = h.stats.maxHp;
      });
      heals++;
    }
    const idx = s.zoneIndex;
    const sig = `${idx}:${s.zonesCleared.filter(Boolean).length}:${s.objective?.collected ?? 0}:${s.eventPoint?.visited ?? ''}`;
    if (sig !== lastSig) {
      lastSig = sig;
      lastProgressAt = Date.now();
      console.log(`[m10-timing] ${s.missionId} t=${(s.elapsedMs / 1000).toFixed(0)}s ${sig}`);
    } else if (Date.now() - lastProgressAt > 90000) {
      notes.push(`sem progresso por 90 s em ${sig} (pés ${s.heroFeet.x.toFixed(0)},${s.heroFeet.y.toFixed(0)})`);
      console.log(`[m10-timing] travado: ${JSON.stringify({ sig, feet: s.heroFeet, items: s.collectibles.filter((c) => !c.picked) })}`);
      break;
    }
    const monsters = await page.evaluate(() =>
      window.__SUBMUNDO_DEBUG__!
        .getMonsters()
        .filter((m) => m.isAlive)
        .map((m) => ({ x: m.position.x, y: m.position.y, id: m.instanceId }))
    );
    if (monsters.length > 0) {
      // Vai até o monstro mais próximo; o auto-ataque resolve.
      const near = monsters.sort(
        (a, b) =>
          Math.hypot(a.x - s.heroFeet.x, a.y - s.heroFeet.y) - Math.hypot(b.x - s.heroFeet.x, b.y - s.heroFeet.y)
      )[0];
      if (Math.hypot(near.x - s.heroFeet.x, near.y + 20 - s.heroFeet.y) > 40) {
        await walk(near.x, near.y + 20, `m${near.id}:${Math.round(near.x / 32)}:${Math.round(near.y / 32)}`);
      }
    } else {
      // Item mais próximo já alcançável (sala atual ou anteriores).
      if (skipZone !== idx) {
        // Item pulado (ainda sem caminho) volta a valer quando o herói muda de sala.
        skipped.clear();
        skipZone = idx;
      }
      const items = s.collectibles
        .filter((c) => !c.picked && !skipped.has(c.id) && (c.zoneId === null || c.zoneId <= idx))
        .sort(
          (a, b) =>
            Math.hypot(a.x - s.heroFeet.x, a.y - s.heroFeet.y) - Math.hypot(b.x - s.heroFeet.x, b.y - s.heroFeet.y)
        );
      if (items.length > 0) {
        const c = items[0];
        const d = Math.hypot(c.x - s.heroFeet.x, c.y - s.heroFeet.y);
        if (c.id !== itemTarget) {
          itemTarget = c.id;
          itemSince = Date.now();
        } else if (Date.now() - itemSince > 20000) {
          // Item de corredor ainda atrás de porta selada: deixa para depois.
          skipped.add(c.id);
          itemTarget = -1;
          continue;
        }
        if (d <= 150) {
          // Perto: a tecla E colhe (ou faz o herói andar até o item, como o botão "Pegar").
          if (Date.now() - lastEPress > 600) {
            lastEPress = Date.now();
            await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.stopAutoWalk());
            await page.keyboard.press('KeyE');
          }
        } else {
          await walk(c.x, c.y, `c${c.id}`);
        }
      } else if (idx < s.zoneCount - 1 && s.zonesCleared[idx]) {
        const t = s.zoneTriggers[idx + 1];
        await walk(t.x, t.y, `z${idx + 1}`);
      } else if (idx < s.zoneCount - 1 && !s.zonesCleared[idx]) {
        // Sala ainda não marcada como limpa (atraso de 650 ms) ou ainda sem onda: espera/entra.
        const t = s.zoneTriggers[idx];
        if (Math.hypot(t.x - s.heroFeet.x, t.y - s.heroFeet.y) > 48) await walk(t.x, t.y, `z${idx}`);
      } else if (s.eventPoint && !s.eventPoint.visited && s.zonesCleared.every(Boolean)) {
        await walk(s.eventPoint.x, s.eventPoint.y, 'event');
      }
    }
    await page.waitForTimeout(120);
  }
  // Espera o fim (atraso da conclusão / pausa do Karnak).
  await page
    .waitForFunction(
      () => {
        const m = window.__SUBMUNDO_DEBUG__!.getMissionState();
        return Boolean(m?.finished || m?.prologueEnded);
      },
      undefined,
      { timeout: 15000 }
    )
    .catch(() => notes.push('não terminou'));
  const end = await state(page);
  return {
    missionId: s0.missionId,
    gameSeconds: Math.round((end.elapsedMs - s0.elapsedMs) / 100) / 10,
    wallSeconds: Math.round((Date.now() - wall0) / 100) / 10,
    heals,
    result: end.prologueEnded ? 'fim do prólogo' : end.runStatus,
    avgFps: frames > 0 ? Math.round(fpsSum / frames) : 0,
    notes,
  };
}

test.describe('SUBMUNDO M10 — tempo das missões (piloto)', () => {
  test.skip(!RUN, 'medida demorada: rode com M10_TIMING=1');

  test('mede Ervas, Mina e Fundo da Mina jogadas pelo piloto', async ({ page }) => {
    test.setTimeout(40 * 60 * 1000);
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await waitVillage(page);
    await closeDialogues(page);
    await talk(page, 'master');
    await talk(page, 'lyra');
    await talk(page, 'gorran');
    const results: Timing[] = [];
    for (const [missionId, giver] of [
      ['mission_herbs', 'lyra'],
      ['mission_mine', 'gorran'],
    ] as const) {
      await enter(page, missionId);
      const t = await pilot(page, 12 * 60 * 1000);
      results.push(t);
      console.log(`[m10-timing] resultado ${JSON.stringify(t)}`);
      expect(t.result).toBe('victory');
      await page.keyboard.press('Enter');
      await waitVillage(page);
      await closeDialogues(page);
      await talk(page, giver);
    }
    await talk(page, 'master');
    await enter(page, 'mission_depths');
    const depths = await pilot(page, 12 * 60 * 1000);
    results.push(depths);
    console.log(`[m10-timing] resultado ${JSON.stringify(depths)}`);
    const dir = resolve(process.cwd(), 'test-results');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'm10-timing.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    expect(depths.result).toBe('fim do prólogo');
  });
});
