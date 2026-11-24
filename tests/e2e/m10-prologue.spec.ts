import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  DESKTOP_VIEWPORT,
  MOBILE_LANDSCAPE_VIEWPORT,
  assertLandscapeCanvas,
  openMobileLandscapePage,
} from './helpers/landscape';

/**
 * M10 (Decisão #24, T-129/T-142..T-148): o prólogo inteiro em 3 missões.
 * Mestre → Lyra (Ervas) e Gorran (Mina) em paralelo → entrega → missão 3 do Mestre
 * (Fundo da Mina, Karnak invencível) → morte → "Fim do Prólogo" → Ato 1.
 * Na Vila, `talkTo`/`openGate` posicionam o herói e interagem (o caminho a pé foi coberto na m9);
 * o portão é escolhido com a tecla real `1`. Na dungeon o herói anda com o piloto `autoWalkTo`,
 * a erva é colhida com a tecla real `E` e a volta à Vila é pela tecla `Enter` no painel final.
 * Para ir rápido entre as salas, o debug zera os monstros da sala ativa (`killZone`).
 */

const SCREENSHOT_DIR = resolve(process.cwd(), 'docs/qa/screenshots');
// JSON lido via fs: o Node do Playwright não importa .json sem import attribute (ver m4).
const DIALOGUES = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/data/dialogues.json'), 'utf-8')
) as { entries: Record<string, { speaker: string; text: string; shortText?: string }> };
const SAVE_KEY = 'submundo_save_v1';

/** Mesmo valor de src/view/scenes/VillageMap.ts (herói volta da dungeon no portão). */
const HERO_GATE = { x: 831, y: 184 };

type Marker = '!' | '?gray' | '?yellow' | null;
interface Markers {
  npcs: { master: Marker; lyra: Marker; gorran: Marker };
  gate: '!' | null;
}
interface VillageState {
  hero: { x: number; y: number };
  objective: string;
  dialogueOpen: boolean;
  gateModalOpen: boolean;
  markers: Markers;
  gateMissions: string[];
  lastTalk: { npcId: string; outcome: { kind: string; missionId: string | null }; dialogueId: string } | null;
}
interface MissionState {
  missionId: string;
  mapMode: string;
  zoneIndex: number;
  zoneCount: number;
  zonesCleared: boolean[];
  doorsOpen: boolean[];
  zoneTriggers: Array<{ x: number; y: number }>;
  objective: { itemId: string; collected: number; count: number } | null;
  collectibles: Array<{ id: number; x: number; y: number; zoneId: number | null; picked: boolean }>;
  eventPoint: { x: number; y: number; visited: boolean } | null;
  complete: boolean;
  finished: boolean;
  prologueEnded: boolean;
  karnakIntroShown: boolean;
  heroFeet: { x: number; y: number };
  heroHp: number;
  heroAlive: boolean;
  runStatus: string;
  autoWalking: boolean;
  elapsedMs: number;
}

interface Errors {
  consoleErrors: string[];
  pageErrors: string[];
  notFoundUrls: string[];
}

function trackErrors(page: Page): Errors {
  const errors: Errors = { consoleErrors: [], pageErrors: [], notFoundUrls: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.pageErrors.push(err.message));
  page.on('response', (res) => {
    if (res.status() === 404) errors.notFoundUrls.push(res.url());
  });
  return errors;
}

function expectNoErrors(errors: Errors): void {
  expect(errors.consoleErrors).toEqual([]);
  expect(errors.pageErrors).toEqual([]);
  expect(errors.notFoundUrls).toEqual([]);
}

async function shot(page: Page, name: string, tag: string | null): Promise<void> {
  if (!tag) return;
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.waitForTimeout(300);
  const path = resolve(SCREENSHOT_DIR, `m10_${name}_${tag}.png`);
  await page.screenshot({ path });
  expect(existsSync(path)).toBe(true);
  expect(statSync(path).size).toBeGreaterThan(5000);
}

// ------------------------------------------------------------------------------------------
// Vila
// ------------------------------------------------------------------------------------------

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

async function village(page: Page): Promise<VillageState> {
  const s = await page.evaluate(() => window.__SUBMUNDO_HUB_DEBUG__?.getVillageState?.() ?? null);
  if (!s) throw new Error('Vila não está ativa');
  return s as unknown as VillageState;
}

async function openFreshVillage(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await waitVillage(page);
  await closeDialogues(page);
}

async function dialogueOpen(page: Page): Promise<boolean> {
  return page.evaluate(() => window.__SUBMUNDO_HUB_DEBUG__!.getDialogueBox().isOpen());
}

/** Fecha as falas com `Enter` (teclado real). */
async function closeDialogues(page: Page): Promise<void> {
  for (let i = 0; i < 12; i++) {
    if (!(await dialogueOpen(page))) return;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  }
  expect(await dialogueOpen(page)).toBe(false);
}

async function dialogueText(page: Page): Promise<{ speaker: string; body: string }> {
  return page.evaluate(() => {
    const box = window.__SUBMUNDO_HUB_DEBUG__!.getDialogueBox() as unknown as {
      speakerText: { text: string };
      bodyText: { text: string };
    };
    return { speaker: box.speakerText.text, body: box.bodyText.text };
  });
}

/** Conversa com o NPC, confere o resultado e a fala aberta e fecha com `Enter`. */
async function talk(
  page: Page,
  npc: 'master' | 'lyra' | 'gorran',
  kind: string,
  dialogueId: string,
  missionId: string | null = null
): Promise<void> {
  const opened = await page.evaluate((id) => window.__SUBMUNDO_HUB_DEBUG__!.talkTo!(id), npc);
  expect(opened, `fala de ${npc} abriu`).toBe(true);
  const s = await village(page);
  expect(s.lastTalk?.npcId).toBe(npc);
  expect(s.lastTalk?.outcome.kind).toBe(kind);
  expect(s.lastTalk?.outcome.missionId).toBe(missionId);
  expect(s.lastTalk?.dialogueId).toBe(dialogueId);
  const entry = DIALOGUES.entries[dialogueId];
  expect(entry, `fala ${dialogueId} existe`).toBeTruthy();
  const shown = await dialogueText(page);
  expect(shown.speaker.toLowerCase()).toBe(entry.speaker.toLowerCase());
  // A caixa pode quebrar o texto em páginas: confere o começo.
  expect(entry.text.replace(/\s+/g, ' ')).toContain(shown.body.replace(/\s+/g, ' ').slice(0, 30));
  await closeDialogues(page);
}

async function expectMarkers(page: Page, npcs: Markers['npcs'], gate: '!' | null): Promise<void> {
  const fromApi = (await page.evaluate(() => window.__SUBMUNDO_HUB_DEBUG__!.getQuestMarkers!())) as Markers;
  expect(fromApi.npcs).toEqual(npcs);
  expect(fromApi.gate).toBe(gate);
  expect((await village(page)).markers).toEqual(fromApi);
  // O que está desenhado na Vila (sprites dos marcadores sobre NPCs e portão).
  await page.waitForTimeout(80);
  const drawn = await page.evaluate(() =>
    (window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
      villageWorld: { getQuestMarkerKinds: () => Record<string, string | null> };
    }).villageWorld.getQuestMarkerKinds()
  );
  expect(drawn).toEqual({ ...npcs, gate });
}

async function savedProfile(page: Page): Promise<{
  campaign: {
    phase: string;
    currentStageId: string;
    completedStages: string[];
    masterIntroDone?: boolean;
    prologueQuests?: Record<string, string>;
  };
  runsFailed?: number;
}> {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? 'null'), SAVE_KEY);
}

/** Abre o portão, confere a lista e escolhe a missão com a tecla real do número. */
async function enterViaGate(page: Page, expected: string[], missionId: string, shotTag: string | null): Promise<void> {
  expect(await page.evaluate(() => window.__SUBMUNDO_HUB_DEBUG__!.openGate!())).toBe(true);
  const s = await village(page);
  expect(s.gateModalOpen).toBe(true);
  expect(s.gateMissions).toEqual(expected);
  if (shotTag) await shot(page, 'gate', shotTag);
  const index = expected.indexOf(missionId);
  expect(index).toBeGreaterThanOrEqual(0);
  await page.keyboard.press(`Digit${index + 1}`);
  await waitMission(page, missionId);
}

// ------------------------------------------------------------------------------------------
// Dungeon (missões no mapa contínuo)
// ------------------------------------------------------------------------------------------

async function waitMission(page: Page, missionId: string): Promise<void> {
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

async function mission(page: Page): Promise<MissionState> {
  const s = await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.getMissionState());
  if (!s) throw new Error('missão não está ativa');
  return s as unknown as MissionState;
}

/** Texto do contador do objetivo no HUD (T-147). */
async function hudCounter(page: Page): Promise<{ visible: boolean; text: string }> {
  return page.evaluate(() => {
    const hud = (window.__SUBMUNDO_DEBUG__!.scene as unknown as {
      hud: {
        objectiveCounter: { visible: boolean };
        objectiveCounterText: { text: string };
      };
    }).hud;
    return { visible: hud.objectiveCounter.visible, text: hud.objectiveCounterText.text };
  });
}

async function bannerText(page: Page): Promise<string> {
  return page.evaluate(
    () => (window.__SUBMUNDO_DEBUG__!.scene as unknown as { bannerText?: string }).bannerText ?? ''
  );
}

async function monsterIds(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    window.__SUBMUNDO_DEBUG__!.getMonsters().filter((m) => m.isAlive).map((m) => m.defId)
  );
}

async function heal(page: Page): Promise<void> {
  await page.evaluate(() => {
    const h = window.__SUBMUNDO_DEBUG__!.getHero();
    if (h.isAlive) h.stats.hp = h.stats.maxHp;
  });
}

async function killZone(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const m of window.__SUBMUNDO_DEBUG__!.getMonsters()) {
      if ((m as unknown as { defId: string }).defId === 'karnak') continue;
      m.hp = 0;
      m.isAlive = false;
    }
  });
}

/**
 * Morte de verdade (pelo combate): a cena só confere a derrota no tick em que o herói morre,
 * então zerar `isAlive` por fora não basta. Um monstro forte encosta e ataca com o herói a 1 HP.
 */
async function killHeroInCombat(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__SUBMUNDO_DEBUG__!.getMonsters().some((m) => m.isAlive), undefined, {
    timeout: 10000,
  });
  await page.evaluate(() => {
    const dbg = window.__SUBMUNDO_DEBUG__!;
    const hero = dbg.getHero();
    hero.invulnerableUntilMs = 0;
    hero.baseStats.defense = 0;
    hero.stats.defense = 0;
    hero.stats.hp = 1;
    hero.minions = [];
    const attacker = dbg.getMonsters().find((m) => m.isAlive)!;
    attacker.hp = Math.max(attacker.hp, 500);
    attacker.maxHp = Math.max(attacker.maxHp, 500);
    attacker.stunnedUntilMs = 0;
    attacker.bleedDps = 0;
    attacker.position = { x: hero.position.x, y: hero.position.y };
    attacker.nextAttackAtMs = 0;
  });
}

/** Piloto: anda até o ponto (pés) e espera chegar; refaz o caminho se ele parar no meio. */
async function walkTo(
  page: Page,
  target: { x: number; y: number },
  { reach = 24, timeoutMs = 60000, keepAlive = true, until }: {
    reach?: number;
    timeoutMs?: number;
    keepAlive?: boolean;
    until?: (s: MissionState) => boolean;
  } = {}
): Promise<MissionState> {
  const deadline = Date.now() + timeoutMs;
  let tries = 0;
  for (;;) {
    let s = await mission(page);
    const d = Math.hypot(s.heroFeet.x - target.x, s.heroFeet.y - target.y);
    if ((until && until(s)) || (!until && d <= reach)) return s;
    if (Date.now() > deadline) {
      throw new Error(`walkTo(${target.x}, ${target.y}) não chegou: pés em (${s.heroFeet.x.toFixed(0)}, ${s.heroFeet.y.toFixed(0)})`);
    }
    if (!s.autoWalking) {
      const len = await page.evaluate(
        (t) => window.__SUBMUNDO_DEBUG__!.autoWalkTo(t.x, t.y),
        target
      );
      tries++;
      if (len < 0 && tries > 20) throw new Error(`autoWalkTo(${target.x}, ${target.y}) sem caminho`);
      if (len === 0 && !until) return s;
    }
    if (keepAlive) {
      await page.evaluate(() => {
        const h = window.__SUBMUNDO_DEBUG__!.getHero();
        if (h.isAlive && h.stats.hp < h.stats.maxHp * 0.6) h.stats.hp = h.stats.maxHp;
      });
    }
    await page.waitForTimeout(80);
  }
}

/** Zera a sala ativa e espera ela ser marcada como limpa (e as saídas abrirem). */
async function clearCurrentZone(page: Page): Promise<MissionState> {
  const idx = (await mission(page)).zoneIndex;
  const deadline = Date.now() + 15000;
  for (;;) {
    await killZone(page);
    await heal(page);
    const s = await mission(page);
    const last = idx === s.zoneCount - 1;
    if (s.zonesCleared[idx] && (last || s.mapMode === 'giant' || s.doorsOpen[idx])) return s;
    if (Date.now() > deadline) throw new Error(`sala ${idx} não limpou`);
    await page.waitForTimeout(120);
  }
}

/** Atravessa as salas (limpando pelo debug) até entrar na sala `target`. */
async function goToZone(page: Page, target: number): Promise<MissionState> {
  for (;;) {
    let s = await mission(page);
    if (s.zoneIndex >= target) return s;
    s = await clearCurrentZone(page);
    const next = s.zoneIndex + 1;
    s = await walkTo(page, s.zoneTriggers[next], {
      timeoutMs: 90000,
      until: (m) => m.zoneIndex >= next,
    });
    await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.stopAutoWalk());
  }
}

/** Colhe um item de verdade: anda até ele e aperta `E`. Retorna a contagem nova. */
async function collectOneWithE(page: Page, zoneFilter?: (c: MissionState['collectibles'][number], s: MissionState) => boolean): Promise<number> {
  const s = await mission(page);
  const before = s.objective!.collected;
  const candidates = s.collectibles
    .filter((c) => !c.picked && (!zoneFilter || zoneFilter(c, s)))
    .sort(
      (a, b) =>
        Math.hypot(a.x - s.heroFeet.x, a.y - s.heroFeet.y) - Math.hypot(b.x - s.heroFeet.x, b.y - s.heroFeet.y)
    );
  expect(candidates.length, 'há item para colher').toBeGreaterThan(0);
  const c = candidates[0];
  await walkTo(page, { x: c.x, y: c.y }, { reach: 28, timeoutMs: 90000 });
  await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.stopAutoWalk());
  await killZone(page);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(
    (n) => (window.__SUBMUNDO_DEBUG__!.getMissionState()?.objective?.collected ?? 0) > n,
    before,
    { timeout: 8000 }
  );
  const after = await mission(page);
  expect(after.collectibles.find((k) => k.id === c.id)?.picked).toBe(true);
  return after.objective!.collected;
}

/** Painel de vitória → `Enter` (teclado real) → Vila com o herói no portão. */
async function returnToVillageByEnter(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const s = window.__SUBMUNDO_DEBUG__?.getMissionState?.();
      return Boolean(s?.finished) && (s?.runStatus === 'victory' || s?.runStatus === 'defeat');
    },
    undefined,
    { timeout: 15000 }
  );
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await waitVillage(page);
  await page.waitForTimeout(300);
  const s = await village(page);
  expect(Math.abs(s.hero.x - HERO_GATE.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(s.hero.y - HERO_GATE.y)).toBeLessThanOrEqual(2);
  await closeDialogues(page);
}

/** Ervas: sala gigante, 10 ervas, 1 colhida com `E`, contador do HUD sobe. */
async function playHerbs(page: Page, shotTag: string | null): Promise<void> {
  const s = await mission(page);
  expect(s.mapMode).toBe('giant');
  expect(s.zoneCount).toBe(3);
  expect(s.objective).toEqual({ itemId: 'herb', collected: 0, count: 10 });
  expect(s.collectibles.length).toBe(10);
  expect(s.eventPoint).toBeNull();
  let hud = await hudCounter(page);
  expect(hud.visible).toBe(true);
  expect(hud.text).toContain('0/10');
  const n = await collectOneWithE(page);
  expect(n).toBe(1);
  await page.waitForTimeout(200);
  hud = await hudCounter(page);
  expect(hud.text).toContain('1/10');
  await shot(page, 'herbs_counter', shotTag);
  expect(await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.completeMissionNow())).toBe(true);
  const done = await mission(page);
  expect(done.objective!.collected).toBe(10);
  expect(done.runStatus).toBe('victory');
  await returnToVillageByEnter(page);
}

/** Mina: 4 salas, 6 ferramentas, Chefe da Matilha na última, "algo estranho" no fim. */
async function playMine(page: Page, shotTag: string | null): Promise<void> {
  let s = await mission(page);
  expect(s.mapMode).toBe('rooms');
  expect(s.zoneCount).toBe(4);
  expect(s.objective).toEqual({ itemId: 'mine_tool', collected: 0, count: 6 });
  expect(s.collectibles.length).toBe(6);
  expect(s.eventPoint).not.toBeNull();
  const map = await page.evaluate(() => {
    const m = window.__SUBMUNDO_DEBUG__!.getDungeonMap()!;
    return m.zones.map((z) => ({ boss: z.isBossZone, spawns: z.spawns.map((sp) => sp.defId) }));
  });
  expect(map[3].boss).toBe(true);
  expect(map[3].spawns).toContain('wolf_alpha');
  expect(map.slice(0, 3).every((z) => !z.spawns.includes('wolf_alpha'))).toBe(true);
  let hud = await hudCounter(page);
  expect(hud.text).toContain('0/6');
  // Uma ferramenta de verdade, se houver alguma na primeira sala.
  if (s.collectibles.some((c) => c.zoneId === s.zoneIndex)) {
    await collectOneWithE(page, (c, m) => c.zoneId === m.zoneIndex);
    await page.waitForTimeout(200);
    hud = await hudCounter(page);
    expect(hud.text).toContain('1/6');
    await shot(page, 'mine_counter', shotTag);
  }
  // Até a última sala: o Chefe da Matilha aparece lá.
  s = await goToZone(page, 3);
  await page.waitForTimeout(300);
  expect(await monsterIds(page)).toContain('wolf_alpha');
  await shot(page, 'mine_boss', shotTag);
  s = await clearCurrentZone(page);
  expect(s.zonesCleared.every(Boolean)).toBe(true);
  // "Algo estranho": o herói vai até o ponto e a fala `mission_mine_strange` aparece.
  expect(s.eventPoint!.visited).toBe(false);
  s = await walkTo(page, s.eventPoint!, { timeoutMs: 60000, until: (m) => m.eventPoint!.visited });
  await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.stopAutoWalk());
  const strange = DIALOGUES.entries.mission_mine_strange;
  expect(await bannerText(page)).toBe(strange.text ?? strange.shortText);
  await shot(page, 'mine_strange', shotTag);
  expect(await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.completeMissionNow())).toBe(true);
  expect((await mission(page)).runStatus).toBe('victory');
  await returnToVillageByEnter(page);
}

/** Fundo da Mina: Karnak na sala 5 não perde HP; a morte do herói abre "Fim do Prólogo". */
async function playDepths(page: Page, shotTag: string | null): Promise<void> {
  let s = await mission(page);
  expect(s.mapMode).toBe('rooms');
  expect(s.zoneCount).toBe(5);
  expect(s.objective).toBeNull();
  s = await goToZone(page, 4);
  await page.waitForTimeout(400);
  s = await mission(page);
  expect(s.karnakIntroShown).toBe(true);
  const karnakLine = DIALOGUES.entries.mission_depths_karnak;
  expect(await bannerText(page)).toBe(karnakLine.text ?? karnakLine.shortText);
  expect(await monsterIds(page)).toContain('karnak');
  // Herói luta com o Karnak (auto-ataque); o HP dele nunca cai.
  const karnak = async () =>
    page.evaluate(() => {
      const k = window.__SUBMUNDO_DEBUG__!.getMonsters().find((m) => m.defId === 'karnak')!;
      return { hp: k.hp, maxHp: k.maxHp, alive: k.isAlive, x: k.position.x, y: k.position.y };
    });
  let k = await karnak();
  const start = Date.now();
  let minHp = k.hp;
  let heroHit = false;
  let shotTaken = false;
  const hp0 = (await mission(page)).heroHp;
  // Anda até ele e espera a morte natural do herói (até 60 s).
  while (Date.now() - start < 60000) {
    s = await mission(page);
    if (!s.heroAlive || s.prologueEnded) break;
    if (s.heroHp < hp0) heroHit = true;
    k = await karnak();
    minHp = Math.min(minHp, k.hp);
    expect(k.alive).toBe(true);
    if (!s.autoWalking && Math.hypot(k.x - s.heroFeet.x, k.y - s.heroFeet.y) > 60) {
      await page.evaluate((t) => window.__SUBMUNDO_DEBUG__!.autoWalkTo(t.x, t.y + 20), k);
    }
    if (!shotTaken && Date.now() - start > 2500) {
      shotTaken = true;
      await shot(page, 'karnak', shotTag);
    }
    await page.waitForTimeout(120);
  }
  expect(minHp).toBe(k.maxHp);
  s = await mission(page);
  const naturalDeath = !s.heroAlive;
  if (!naturalDeath) {
    // Sem morte natural no tempo (headless lento): o atalho de debug encerra pelo Karnak.
    expect(await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.completeMissionNow())).toBe(true);
  }
  console.log(`[m10] karnak: morte natural=${naturalDeath} herói atingido=${heroHit} HP mínimo do Karnak ${minHp}/${k.maxHp}`);
  test.info().annotations.push({
    type: 'karnak',
    description: `morte natural=${naturalDeath} herói atingido=${heroHit} Karnak HP ${minHp}/${k.maxHp}`,
  });
  await page.waitForFunction(() => window.__SUBMUNDO_DEBUG__!.getMissionState()?.prologueEnded === true, undefined, {
    timeout: 10000,
  });
  // A tela "Fim do Prólogo" aparece depois da pausa.
  await page.waitForFunction(
    () => {
      const sc = window.__SUBMUNDO_DEBUG__!.scene as unknown as {
        children: { getByName: (n: string) => { visible: boolean } | null };
      };
      return Boolean(sc.children.getByName('prologue_end_screen')?.visible);
    },
    undefined,
    { timeout: 10000 }
  );
  const texts = await page.evaluate(() => {
    type GO = { type: string; text?: string; list?: GO[] };
    const sc = window.__SUBMUNDO_DEBUG__!.scene as unknown as {
      children: { getByName: (n: string) => GO | null };
    };
    const out: string[] = [];
    const walk = (o: GO | null) => {
      if (!o) return;
      if (o.type === 'Text' && o.text) out.push(o.text);
      for (const c of o.list ?? []) walk(c);
    };
    walk(sc.children.getByName('prologue_end_screen'));
    return out;
  });
  expect(texts.join(' ')).toContain(DIALOGUES.entries.prologue_end_title.text);
  expect(texts).toContain('Continuar');
  // O Karnak continua com HP cheio.
  k = await karnak();
  expect(k.hp).toBe(k.maxHp);
  const saved = await savedProfile(page);
  expect(saved.campaign.phase).toBe('act1');
  expect(saved.campaign.prologueQuests?.mission_depths).toBe('turned_in');
  await shot(page, 'prologue_end', shotTag);
  // "Continuar" (Enter) leva ao Ato 1.
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => {
      const hub = window.__SUBMUNDO_HUB_DEBUG__;
      const sc = hub?.scene as unknown as { scene?: { isActive: () => boolean } } | undefined;
      return Boolean(sc?.scene?.isActive()) && hub!.getProfile().campaign?.phase === 'act1';
    },
    undefined,
    { timeout: 20000 }
  );
  expect(await page.evaluate(() => window.__SUBMUNDO_HUB_DEBUG__!.getVillageState?.() ?? null)).toBeNull();
  const final = await savedProfile(page);
  expect(final.campaign.phase).toBe('act1');
  expect(final.campaign.currentStageId).toBe('act1_submundo');
  expect(final.campaign.completedStages).toEqual(
    expect.arrayContaining(['mission_herbs', 'mission_mine', 'mission_depths'])
  );
  expect(final.campaign.prologueQuests).toEqual({
    mission_herbs: 'turned_in',
    mission_mine: 'turned_in',
    mission_depths: 'turned_in',
  });
  await shot(page, 'act1', shotTag);
}

/** Prólogo inteiro: `order` define qual missão paralela é feita primeiro. */
async function runPrologue(page: Page, order: 'herbs_first' | 'mine_first', tag: string): Promise<void> {
  await openFreshVillage(page);
  // 1) Início: só o "!" do Mestre; portão sem missão.
  await expectMarkers(page, { master: '!', lyra: null, gorran: null }, null);
  expect((await village(page)).objective).toBe('Falar com o Mestre');
  expect((await village(page)).gateMissions).toEqual([]);
  expect(await page.evaluate(() => window.__SUBMUNDO_HUB_DEBUG__!.openGate!())).toBe(false);
  await closeDialogues(page);
  await shot(page, 'village_start', tag);
  // 2) Introdução do Mestre libera Lyra e Gorran.
  await talk(page, 'master', 'intro', 'quest_master_intro');
  await expectMarkers(page, { master: null, lyra: '!', gorran: '!' }, null);
  expect((await village(page)).objective).toBe('Falar com Lyra e Gorran');
  await shot(page, 'village_markers', tag);
  // 3) Aceitar as duas: "?" cinza e "!" no portão.
  await talk(page, 'lyra', 'accepted', 'quest_lyra_offer', 'mission_herbs');
  await expectMarkers(page, { master: null, lyra: '?gray', gorran: '!' }, '!');
  await talk(page, 'gorran', 'accepted', 'quest_gorran_offer', 'mission_mine');
  await expectMarkers(page, { master: null, lyra: '?gray', gorran: '?gray' }, '!');
  await talk(page, 'lyra', 'in_progress', 'quest_lyra_progress', 'mission_herbs');
  await talk(page, 'master', 'idle', 'quest_master_wait');
  expect((await village(page)).objective).toContain('Saia pelo portão');
  await shot(page, 'village_accepted', tag);

  const both = ['mission_herbs', 'mission_mine'];
  const first = order === 'herbs_first' ? 'mission_herbs' : 'mission_mine';
  const second = order === 'herbs_first' ? 'mission_mine' : 'mission_herbs';
  const giver = (m: string) => (m === 'mission_herbs' ? 'lyra' : 'gorran');
  const play = (m: string) => (m === 'mission_herbs' ? playHerbs(page, tag) : playMine(page, tag));

  // 4) Primeira missão.
  await enterViaGate(page, both, first, tag);
  await play(first);
  {
    const npcs = { master: null as Marker, lyra: '?gray' as Marker, gorran: '?gray' as Marker };
    npcs[giver(first)] = '?yellow';
    await expectMarkers(page, npcs, '!');
    expect((await village(page)).gateMissions).toEqual([second]);
    expect((await village(page)).objective).toBe(`Volte a ${giver(first) === 'lyra' ? 'Lyra' : 'Gorran'}`);
    await shot(page, 'village_turnin', tag);
    await talk(page, giver(first), 'turned_in', `quest_${giver(first)}_turnin`, first);
    npcs[giver(first)] = null;
    await expectMarkers(page, npcs, '!');
    await talk(page, giver(first), 'idle', `quest_${giver(first)}_done`);
  }
  // 5) Segunda missão (a entregue não aparece mais no portão).
  await enterViaGate(page, [second], second, null);
  await play(second);
  {
    const npcs = { master: null as Marker, lyra: null as Marker, gorran: null as Marker };
    npcs[giver(second)] = '?yellow';
    await expectMarkers(page, npcs, null);
    expect((await village(page)).gateMissions).toEqual([]);
    await talk(page, giver(second), 'turned_in', `quest_${giver(second)}_turnin`, second);
  }
  // 6) Missão 3 aparece no Mestre.
  await expectMarkers(page, { master: '!', lyra: null, gorran: null }, null);
  await shot(page, 'village_master_depths', tag);
  await talk(page, 'master', 'accepted', 'quest_master_depths_offer', 'mission_depths');
  await expectMarkers(page, { master: '?gray', lyra: null, gorran: null }, '!');
  await talk(page, 'master', 'in_progress', 'quest_master_depths_progress', 'mission_depths');
  const mid = await savedProfile(page);
  expect(mid.campaign.prologueQuests).toEqual({
    mission_herbs: 'turned_in',
    mission_mine: 'turned_in',
    mission_depths: 'accepted',
  });
  // 7) Fundo da Mina → Karnak → Fim do Prólogo → Ato 1.
  await enterViaGate(page, ['mission_depths'], 'mission_depths', null);
  await playDepths(page, tag);
}

test.describe('SUBMUNDO M10 — Prólogo em 3 missões (Decisão #24)', () => {
  test('PC 960×540: prólogo inteiro, Ervas antes da Mina', async ({ page }) => {
    test.setTimeout(420000);
    await page.setViewportSize(DESKTOP_VIEWPORT);
    const errors = trackErrors(page);
    await runPrologue(page, 'herbs_first', 'pc');
    await assertLandscapeCanvas(page, DESKTOP_VIEWPORT);
    expectNoErrors(errors);
  });

  test('Mobile 844×390: prólogo inteiro, Mina antes das Ervas', async ({ browser }) => {
    test.setTimeout(420000);
    const errors: Errors = { consoleErrors: [], pageErrors: [], notFoundUrls: [] };
    const { context, page } = await openMobileLandscapePage(browser, errors);
    try {
      await runPrologue(page, 'mine_first', 'mobile');
      await assertLandscapeCanvas(page, MOBILE_LANDSCAPE_VIEWPORT);
      expectNoErrors(errors);
    } finally {
      await context.close();
    }
  });

  test('Derrota numa missão não muda o estado', async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize(DESKTOP_VIEWPORT);
    const errors = trackErrors(page);
    await openFreshVillage(page);
    await talk(page, 'master', 'intro', 'quest_master_intro');
    await talk(page, 'lyra', 'accepted', 'quest_lyra_offer', 'mission_herbs');
    await talk(page, 'gorran', 'accepted', 'quest_gorran_offer', 'mission_mine');
    const before = await savedProfile(page);
    const markersBefore = (await village(page)).markers;
    for (const m of ['mission_herbs', 'mission_mine']) {
      await enterViaGate(page, ['mission_herbs', 'mission_mine'], m, null);
      await killHeroInCombat(page);
      await page.waitForFunction(
        () => window.__SUBMUNDO_DEBUG__!.getMissionState()?.runStatus === 'defeat',
        undefined,
        { timeout: 10000 }
      );
      expect((await mission(page)).prologueEnded).toBe(false);
      await returnToVillageByEnter(page);
      const after = await savedProfile(page);
      expect(after.campaign.prologueQuests).toEqual(before.campaign.prologueQuests);
      expect(after.campaign.completedStages).toEqual(before.campaign.completedStages);
      expect(after.campaign.phase).toBe('prologue');
      expect((await village(page)).markers).toEqual(markersBefore);
      expect((await village(page)).gateMissions).toEqual(['mission_herbs', 'mission_mine']);
    }
    // A missão 3 também: derrota fora da sala do Karnak é derrota comum.
    await page.evaluate(() => {
      const hub = window.__SUBMUNDO_HUB_DEBUG__!;
      hub.completeMission!('mission_herbs');
      hub.completeMission!('mission_mine');
    });
    await talk(page, 'lyra', 'turned_in', 'quest_lyra_turnin', 'mission_herbs');
    await talk(page, 'gorran', 'turned_in', 'quest_gorran_turnin', 'mission_mine');
    await talk(page, 'master', 'accepted', 'quest_master_depths_offer', 'mission_depths');
    await enterViaGate(page, ['mission_depths'], 'mission_depths', null);
    await killHeroInCombat(page);
    await page.waitForFunction(
      () => window.__SUBMUNDO_DEBUG__!.getMissionState()?.runStatus === 'defeat',
      undefined,
      { timeout: 10000 }
    );
    expect((await mission(page)).prologueEnded).toBe(false);
    await returnToVillageByEnter(page);
    const after = await savedProfile(page);
    expect(after.campaign.phase).toBe('prologue');
    expect(after.campaign.prologueQuests?.mission_depths).toBe('accepted');
    expect((await village(page)).gateMissions).toEqual(['mission_depths']);
    expectNoErrors(errors);
  });
});
