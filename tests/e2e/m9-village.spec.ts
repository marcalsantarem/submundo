import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { GAME_VERSION } from '../../src/version';
import {
  DESKTOP_VIEWPORT,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  MOBILE_LANDSCAPE_VIEWPORT,
  assertLandscapeCanvas,
  clickLogicalCanvas,
  openMobileLandscapePage,
} from './helpers/landscape';

/**
 * M9 (Decisão #23, T-138/T-139/T-140): Vila Natal como hub do prólogo.
 * A URL raiz abre a Vila (HubScene, fase `prologue`). Movimento e interação usam teclado
 * real (setas + `E`), mouse e toque; o debug só posiciona o herói e encerra as runs.
 */

const SCREENSHOT_DIR = resolve(process.cwd(), 'docs/qa/screenshots');
// JSON lido via fs: o Node do Playwright não importa .json sem import attribute (ver m4).
const DIALOGUES = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/data/dialogues.json'), 'utf-8')
) as { entries: Record<string, { speaker: string; text: string }> };
const CAMPAIGN = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/data/campaign.json'), 'utf-8')
) as { stages: Array<{ id: string; name: string; phase: string; order: number }> };
const PROLOGUE_STAGES = CAMPAIGN.stages
  .filter((s) => s.phase === 'prologue')
  .sort((a, b) => a.order - b.order);

/** Mesmos valores de src/view/scenes/VillageMap.ts. */
const HERO_START = { x: 672, y: 244 };
const HERO_GATE = { x: 831, y: 184 };
const MASTER_APPROACH = { x: 528, y: 272 };
const GATE_APPROACH = { x: 831, y: 174 };
/** Em frente à Lyra (mesmo ponto do teste 3). */
const LYRA_APPROACH = { x: 573, y: 227 };

interface XY {
  x: number;
  y: number;
}

interface VillageState {
  hero: XY;
  nearby: string | null;
  gateUnlocked: boolean;
  objective: string;
  alertNpcId: string | null;
  dialogueOpen: boolean;
  gateModalOpen: boolean;
}

interface Errors {
  consoleErrors: string[];
  pageErrors: string[];
  notFoundUrls: string[];
}

function trackErrors(page: Page, tag = ''): Errors {
  const errors: Errors = { consoleErrors: [], pageErrors: [], notFoundUrls: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.consoleErrors.push(`${tag}${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.pageErrors.push(`${tag}${err.message}`));
  page.on('response', (res) => {
    if (res.status() === 404) errors.notFoundUrls.push(`${tag}${res.url()}`);
  });
  return errors;
}

function expectNoErrors(errors: Errors): void {
  expect(errors.consoleErrors).toEqual([]);
  expect(errors.pageErrors).toEqual([]);
  expect(errors.notFoundUrls).toEqual([]);
}

async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.waitForTimeout(250);
  const path = resolve(SCREENSHOT_DIR, `m9_village_${name}.png`);
  await page.screenshot({ path });
  expect(existsSync(path)).toBe(true);
  expect(statSync(path).size).toBeGreaterThan(5000);
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
    { timeout: 15000 }
  );
}

async function villageState(page: Page): Promise<VillageState> {
  const s = await page.evaluate(() => window.__SUBMUNDO_HUB_DEBUG__?.getVillageState?.() ?? null);
  if (!s) throw new Error('Vila não está ativa');
  return s as VillageState;
}

/** Abre a raiz com o save limpo e espera a Vila. */
async function openFreshVillage(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await waitVillage(page);
}

async function dialogue(page: Page): Promise<{ open: boolean; speaker: string; body: string }> {
  return page.evaluate(() => {
    const box = window.__SUBMUNDO_HUB_DEBUG__!.getDialogueBox() as unknown as {
      isOpen: () => boolean;
      speakerText: { text: string };
      bodyText: { text: string };
    };
    return { open: box.isOpen(), speaker: box.speakerText.text, body: box.bodyText.text };
  });
}

/** Fecha o diálogo com `Enter` (teclado real), avançando as falas. */
async function closeDialogueWithKeyboard(page: Page): Promise<void> {
  for (let i = 0; i < 8; i++) {
    if (!(await dialogue(page)).open) return;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
  }
  expect((await dialogue(page)).open).toBe(false);
}

async function expectDialogueLine(page: Page, id: string): Promise<void> {
  const entry = DIALOGUES.entries[id];
  expect(entry, `fala ${id} existe em dialogues.json`).toBeTruthy();
  await page.waitForFunction(() => window.__SUBMUNDO_HUB_DEBUG__!.getDialogueBox().isOpen(), undefined, {
    timeout: 3000,
  });
  const d = await dialogue(page);
  expect(d.speaker.toLowerCase()).toBe(entry.speaker.toLowerCase());
  expect(d.body).toBe(entry.text);
}

/** Posiciona os pés do herói (setup de teste; sem passar pelo movimento). */
async function placeHero(page: Page, p: XY): Promise<void> {
  await page.evaluate((pos) => {
    const s = window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as { hero: { position: XY } };
    s.hero.position.x = pos.x;
    s.hero.position.y = pos.y;
  }, p);
  await page.waitForTimeout(80);
}

async function releaseArrows(page: Page): Promise<void> {
  for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) await page.keyboard.up(k);
}

/** Segura `key` por `ms` e devolve a posição final dos pés. */
async function holdKey(page: Page, key: string, ms: number): Promise<XY> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(80);
  return (await villageState(page)).hero;
}

/** Leva os pés do herói até `target` com as setas do teclado (eixo a eixo, X primeiro ou Y primeiro). */
async function walkTo(page: Page, target: XY, order: 'xy' | 'yx', tol = 6): Promise<XY> {
  const legs: XY[] =
    order === 'xy'
      ? [{ x: target.x, y: NaN }, target]
      : [{ x: NaN, y: target.y }, target];
  for (const leg of legs) {
    const deadline = Date.now() + 20000;
    const held = new Set<string>();
    try {
      for (;;) {
        const { hero } = await villageState(page);
        const dx = Number.isNaN(leg.x) ? 0 : leg.x - hero.x;
        const dy = Number.isNaN(leg.y) ? 0 : leg.y - hero.y;
        if (Math.abs(dx) <= tol && Math.abs(dy) <= tol) break;
        if (Date.now() > deadline) {
          throw new Error(`walkTo(${target.x}, ${target.y}) parado em (${hero.x}, ${hero.y})`);
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
        await page.waitForTimeout(Math.hypot(dx, dy) < 24 ? 12 : 30);
      }
    } finally {
      for (const k of held) await page.keyboard.up(k);
    }
  }
  await page.waitForTimeout(100);
  return (await villageState(page)).hero;
}

async function gateEntries(page: Page): Promise<Array<{ stageId: string; title: string; label: string; statusText: string; giver: string }>> {
  return page.evaluate(() => {
    const s = window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
      gateModal: {
        entries: Array<{ stageId: string; title: string }>;
        rows: Array<{ title: { text: string }; status: { text: string }; giver: { text: string } }>;
      };
    };
    return s.gateModal.entries.map((e, i) => ({
      stageId: e.stageId,
      title: e.title,
      label: s.gateModal.rows[i].title.text,
      statusText: s.gateModal.rows[i].status.text,
      giver: s.gateModal.rows[i].giver.text,
    }));
  });
}

/** Centro (coordenadas lógicas da câmera de UI) da linha `index` do modal do portão. */
async function gateRowCenter(page: Page, index: number): Promise<XY> {
  return page.evaluate((i) => {
    const s = window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
      gateModal: { root: { x: number; y: number }; rows: Array<{ container: { x: number; y: number } }> };
    };
    const m = s.gateModal;
    return { x: m.root.x + m.rows[i].container.x, y: m.root.y + m.rows[i].container.y };
  }, index);
}

async function interactButtonCenter(page: Page): Promise<XY> {
  return page.evaluate(() => {
    const s = window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
      villageHud: { interactContainer: { x: number; y: number } };
    };
    return { x: s.villageHud.interactContainer.x, y: s.villageHud.interactContainer.y };
  });
}

async function logicalToPage(page: Page, p: XY): Promise<XY> {
  return page.evaluate(
    ({ lx, ly, W, H }) => {
      const c = document.querySelector('canvas')!;
      const r = c.getBoundingClientRect();
      return { x: r.left + (lx * r.width) / (c.width || W), y: r.top + (ly * r.height) / (c.height || H) };
    },
    { lx: p.x, ly: p.y, W: LOGICAL_WIDTH, H: LOGICAL_HEIGHT }
  );
}

async function tapLogical(page: Page, p: XY): Promise<void> {
  const t = await logicalToPage(page, p);
  await page.touchscreen.tap(t.x, t.y);
}

async function waitDungeon(page: Page, stageId: string): Promise<void> {
  await page.waitForFunction(
    (id) => {
      const d = window.__SUBMUNDO_DEBUG__ as unknown as
        | {
            scene?: { scene: { key: string; isActive: () => boolean } };
            getMissionState?: () => { missionId: string; runStatus: string } | null;
            getHero?: () => { isAlive: boolean } | undefined;
          }
        | undefined;
      return (
        d?.scene?.scene.key === 'DungeonScene' &&
        d.scene.scene.isActive() &&
        typeof d.getMissionState === 'function' &&
        d.getMissionState()?.missionId === id &&
        d.getMissionState()?.runStatus === 'in_progress' &&
        d.getHero?.()?.isAlive === true
      );
    },
    stageId,
    { timeout: 15000 }
  );
}

/** Vence a missão pelo debug (`completeMissionNow`) e volta pelo `returnToHub`. */
async function winRunAndReturn(page: Page): Promise<void> {
  expect(await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.completeMissionNow())).toBe(true);
  expect(await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.getMissionState()?.runStatus)).toBe('victory');
  await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.returnToHub?.());
  await waitVillage(page);
}

/** Faz o herói morrer na sala 1 e volta pelo `returnToHub`. */
async function loseRunAndReturn(page: Page): Promise<void> {
  await page.evaluate(() => {
    const dbg = window.__SUBMUNDO_DEBUG__!;
    const hero = dbg.getHero();
    // Morte de verdade (pelo combate): a cena só confere a derrota no tick em que o herói morre.
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
  await page.waitForFunction(
    () => window.__SUBMUNDO_DEBUG__!.getMissionState()?.runStatus === 'defeat',
    undefined,
    { timeout: 10000 }
  );
  await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.returnToHub?.());
  await waitVillage(page);
}

async function questMarkersDrawn(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate(() =>
    (window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
      villageWorld: { getQuestMarkerKinds: () => Record<string, string | null> };
    }).villageWorld.getQuestMarkerKinds()
  );
}

async function trackerText(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      (window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as { villageHud: { trackerText: { text: string } } })
        .villageHud.trackerText.text
  );
}

test.describe('SUBMUNDO M9 — Vila Natal (hub do prólogo) E2E (PC 960x540 & Mobile Landscape 844x390)', () => {
  test('raiz abre a Vila; "!" no Mestre; portão travado; Mestre por teclado + E; Lyra libera o portão; lista do portão; Ervas; volta no portão (vitória e derrota); perfil persiste', async ({
    page,
  }) => {
    test.setTimeout(150000);
    const errors = trackErrors(page);
    await page.setViewportSize(DESKTOP_VIEWPORT);

    // 1. Raiz abre a Vila Natal (HubScene, prólogo), com a HUD da vila.
    await openFreshVillage(page);
    await expect(page).toHaveTitle(`SUBMUNDO v${GAME_VERSION}`);
    await assertLandscapeCanvas(page, DESKTOP_VIEWPORT);
    const boot = await page.evaluate(() => {
      const hub = window.__SUBMUNDO_HUB_DEBUG__!;
      const s = hub.scene as unknown as {
        scene: { key: string; manager: { isActive: (k: string) => boolean } };
        hud?: unknown;
        villageHud?: unknown;
        stations: unknown[];
        villageWorld: { gateRects: unknown[]; isGateOpen: () => boolean };
      };
      return {
        key: s.scene.key,
        dungeonActive: s.scene.manager.isActive('DungeonScene'),
        hasOldHud: Boolean(s.hud),
        hasVillageHud: Boolean(s.villageHud),
        stations: s.stations.length,
        phase: hub.getProfile().campaign?.phase,
        gateRects: s.villageWorld.gateRects.length,
        gateOpenVisual: s.villageWorld.isGateOpen(),
      };
    });
    expect(boot).toMatchObject({
      key: 'HubScene',
      dungeonActive: false,
      hasOldHud: false,
      hasVillageHud: true,
      stations: 0,
      phase: 'prologue',
      gateRects: 3,
      gateOpenVisual: false,
    });
    let st = await villageState(page);
    expect(st.hero).toEqual(HERO_START);
    expect(st.gateUnlocked).toBe(false);
    expect(st.objective).toBe('Falar com o Mestre');
    expect(st.alertNpcId).toBe('master');
    expect(st.dialogueOpen).toBe(true); // falas de boas-vindas do prólogo
    await closeDialogueWithKeyboard(page);
    await shot(page, 'pc');

    // 2. "!" desenhado sobre o Mestre; tracker "Falar com o Mestre" (M10: marcadores de missão).
    expect(await questMarkersDrawn(page)).toEqual({ master: '!', lyra: null, gorran: null, gate: null });
    expect(await trackerText(page)).toBe('Falar com o Mestre');

    // 3. Portão travado: a fala de bloqueio, sem lista.
    const opened = await page.evaluate(() => window.__SUBMUNDO_HUB_DEBUG__!.openGate!());
    expect(opened).toBe(false);
    await expectDialogueLine(page, 'village_gate_locked');
    st = await villageState(page);
    expect(st.gateModalOpen).toBe(false);
    await closeDialogueWithKeyboard(page);
    // Portão fechado bloqueia a passagem para fora (setas reais para cima).
    await placeHero(page, { x: 831, y: 176 });
    const atClosedGate = await holdKey(page, 'ArrowUp', 600);
    expect(atClosedGate.y).toBeGreaterThanOrEqual(154);

    // 4. Andar até o Mestre com o teclado e apertar E: introdução (M10) libera Lyra e Gorran.
    await placeHero(page, HERO_START);
    const nearMaster = await walkTo(page, MASTER_APPROACH, 'yx');
    expect(Math.hypot(nearMaster.x - 524, nearMaster.y - 251)).toBeLessThanOrEqual(46);
    st = await villageState(page);
    expect(st.nearby).toBe('master');
    expect(st.gateUnlocked).toBe(false);
    await page.keyboard.press('e');
    await expectDialogueLine(page, 'quest_master_intro');
    st = await villageState(page);
    expect(st.gateUnlocked).toBe(false); // nenhuma missão aceita ainda
    expect(st.objective).toBe('Falar com Lyra e Gorran');
    await shot(page, 'master_dialogue_pc');
    await closeDialogueWithKeyboard(page);
    expect(await trackerText(page)).toBe('Falar com Lyra e Gorran');
    expect(await questMarkersDrawn(page)).toEqual({ master: null, lyra: '!', gorran: '!', gate: null });
    // Falar de novo com o Mestre: fala de espera.
    await page.keyboard.press('e');
    await expectDialogueLine(page, 'quest_master_wait');
    await closeDialogueWithKeyboard(page);

    // 5. Lyra (E) dá a missão das Ervas: "?" cinza nela, "!" no portão, portão abre.
    await placeHero(page, LYRA_APPROACH);
    expect((await villageState(page)).nearby).toBe('lyra');
    await page.keyboard.press('e');
    await expectDialogueLine(page, 'quest_lyra_offer');
    await closeDialogueWithKeyboard(page);
    st = await villageState(page);
    expect(st.gateUnlocked).toBe(true);
    expect(await questMarkersDrawn(page)).toEqual({ master: null, lyra: '?gray', gorran: '!', gate: '!' });
    const gateVisual = await page.evaluate(() => {
      const w = (window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
        villageWorld: { gateRects: unknown[]; isGateOpen: () => boolean };
      }).villageWorld;
      return { rects: w.gateRects.length, open: w.isGateOpen() };
    });
    expect(gateVisual).toEqual({ rects: 2, open: true });

    // 6. Andar até o portão e interagir (E): lista só com a missão aceita.
    await placeHero(page, HERO_START);
    await walkTo(page, GATE_APPROACH, 'xy');
    st = await villageState(page);
    expect(st.nearby).toBe('gate');
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.__SUBMUNDO_HUB_DEBUG__!.getVillageState!()!.gateModalOpen, undefined, {
      timeout: 3000,
    });
    let entries = await gateEntries(page);
    expect(entries.map((e) => e.stageId)).toEqual(['mission_herbs']);
    expect(entries[0].title).toBe(PROLOGUE_STAGES.find((x) => x.id === 'mission_herbs')!.name);
    expect(entries[0].label).toContain('A Plantação de Ervas');
    expect(entries[0].giver).toBe('Pedido de Lyra');
    await shot(page, 'gate_modal_pc');

    // Clique real na linha inicia a DungeonScene das Ervas.
    const herbsRow = await gateRowCenter(page, 0);
    await clickLogicalCanvas(page, herbsRow.x, herbsRow.y);
    await waitDungeon(page, 'mission_herbs');

    // 7. Vitória (debug) -> herói nasce no portão; "?" amarelo na Lyra; portão trava (nada aceito).
    await winRunAndReturn(page);
    st = await villageState(page);
    expect(st.hero).toEqual(HERO_GATE);
    expect(st.gateUnlocked).toBe(false);
    expect(st.objective).toBe('Volte a Lyra');
    expect(st.alertNpcId).toBe('lyra');
    const profile = await page.evaluate(() => {
      const p = window.__SUBMUNDO_HUB_DEBUG__!.getProfile();
      return { completed: p.campaign?.completedStages ?? [], runsCompleted: p.stats.runsCompleted };
    });
    expect(profile.completed).toContain('mission_herbs');
    expect(profile.runsCompleted).toBe(1);
    await closeDialogueWithKeyboard(page);
    await shot(page, 'gate_return_pc');
    expect(await questMarkersDrawn(page)).toEqual({ master: null, lyra: '?yellow', gorran: '!', gate: null });

    // 8. Gorran (debug talkTo) dá a Mina; a lista do portão mostra só a Mina; tecla 1 entra.
    expect(await page.evaluate(() => window.__SUBMUNDO_HUB_DEBUG__!.talkTo!('gorran'))).toBe(true);
    await expectDialogueLine(page, 'quest_gorran_offer');
    await closeDialogueWithKeyboard(page);
    expect(await page.evaluate(() => window.__SUBMUNDO_HUB_DEBUG__!.openGate!())).toBe(true);
    entries = await gateEntries(page);
    expect(entries.map((e) => e.stageId)).toEqual(['mission_mine']);
    await page.keyboard.press('Digit1');
    await waitDungeon(page, 'mission_mine');

    // 9. Derrota (debug) -> herói nasce no portão; a Mina segue aceita.
    await loseRunAndReturn(page);
    st = await villageState(page);
    expect(st.hero).toEqual(HERO_GATE);
    expect(st.gateUnlocked).toBe(true);
    const afterDefeat = await page.evaluate(() => {
      const p = window.__SUBMUNDO_HUB_DEBUG__!.getProfile();
      return { runsCompleted: p.stats.runsCompleted, runsFailed: p.stats.runsFailed };
    });
    expect(afterDefeat).toEqual({ runsCompleted: 1, runsFailed: 1 });
    await closeDialogueWithKeyboard(page);

    // 10. Recarregar: perfil persiste, herói no início, sem as boas-vindas.
    await page.reload();
    await waitVillage(page);
    st = await villageState(page);
    expect(st.hero).toEqual(HERO_START);
    expect(st.gateUnlocked).toBe(true);
    expect(st.objective).toBe('Volte a Lyra');
    expect(st.dialogueOpen).toBe(false);
    const persisted = await page.evaluate(() => {
      const c = window.__SUBMUNDO_HUB_DEBUG__!.getProfile().campaign!;
      return { completed: c.completedStages, quests: c.prologueQuests };
    });
    expect(persisted.completed).toContain('mission_herbs');
    expect(persisted.quests).toEqual({ mission_herbs: 'completed', mission_mine: 'accepted', mission_depths: 'hidden' });
    expect(await page.evaluate(() => window.__SUBMUNDO_HUB_DEBUG__!.openGate!())).toBe(true);
    expect((await gateEntries(page)).map((e) => e.stageId)).toEqual(['mission_mine']);

    expectNoErrors(errors);
  });

  test('colisão com casa, forja e paliçada (setas reais)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await openFreshVillage(page);
    await closeDialogueWithKeyboard(page);

    // Casa de palha (retângulo y 121..165): subindo de baixo, para antes do limite da clareira (y 150).
    await placeHero(page, { x: 590, y: 190 });
    const house = await holdKey(page, 'ArrowUp', 1500);
    expect(house.x).toBe(590);
    expect(house.y).toBeGreaterThanOrEqual(169);
    expect(house.y).toBeLessThanOrEqual(176);

    // Forja (retângulo y 201..217): subindo de baixo.
    await placeHero(page, { x: 945, y: 245 });
    const forge = await holdKey(page, 'ArrowUp', 1500);
    expect(forge.y).toBeGreaterThanOrEqual(221);
    expect(forge.y).toBeLessThanOrEqual(228);

    // Paliçada leste (x 1003): andando para a direita, para antes do limite do mapa (x 1010).
    await placeHero(page, { x: 972, y: 330 });
    const east = await holdKey(page, 'ArrowRight', 1500);
    expect(east.x).toBeGreaterThanOrEqual(990);
    expect(east.x).toBeLessThanOrEqual(996);

    // Paliçada sul (y 374): andando para baixo, para antes do limite do mapa (y 410).
    await placeHero(page, { x: 600, y: 348 });
    const south = await holdKey(page, 'ArrowDown', 1500);
    expect(south.y).toBeGreaterThanOrEqual(366);
    expect(south.y).toBeLessThanOrEqual(375);

    // Controle: em área livre o herói anda normalmente.
    await placeHero(page, { x: 640, y: 300 });
    const free = await holdKey(page, 'ArrowLeft', 1000);
    expect(free.x).toBeLessThan(628);

    await releaseArrows(page);
    expectNoErrors(errors);
  });

  test('Lyra e Gorran respondem com as falas (alternando) pelo E', async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await openFreshVillage(page);
    await closeDialogueWithKeyboard(page);

    for (const npc of [
      { id: 'lyra', pos: { x: 573, y: 227 } },
      { id: 'gorran', pos: { x: 890, y: 251 } },
    ]) {
      await placeHero(page, npc.pos);
      expect((await villageState(page)).nearby).toBe(npc.id);
      await page.keyboard.press('e');
      await expectDialogueLine(page, `village_${npc.id}_idle`);
      await closeDialogueWithKeyboard(page);
      await page.keyboard.press('e');
      await expectDialogueLine(page, `village_${npc.id}_idle_2`);
      await closeDialogueWithKeyboard(page);
      // Falar com eles não libera o portão.
      expect((await villageState(page)).gateUnlocked).toBe(false);
    }
    expectNoErrors(errors);
  });

  test('mobile paisagem 844x390: Vila renderiza e o botão Interagir responde a toque', async ({ browser, baseURL }) => {
    test.setTimeout(90000);
    const errors: Errors = { consoleErrors: [], pageErrors: [], notFoundUrls: [] };
    const { context, page } = await openMobileLandscapePage(browser, {
      baseURL,
      consoleErrors: errors.consoleErrors,
      pageErrors: errors.pageErrors,
      notFoundUrls: errors.notFoundUrls,
    });
    try {
      await openFreshVillage(page);
      await expect(page).toHaveTitle(`SUBMUNDO v${GAME_VERSION}`);
      await assertLandscapeCanvas(page, MOBILE_LANDSCAPE_VIEWPORT);
      expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
      expect(
        await page.evaluate(() => window.getComputedStyle(document.getElementById('rotate-overlay')!).display)
      ).toBe('none');
      await closeDialogueWithKeyboard(page);
      await shot(page, 'mobile');

      // Toque no Interagir longe de tudo: nada abre.
      const btn = await interactButtonCenter(page);
      await tapLogical(page, btn);
      await page.waitForTimeout(250);
      expect((await villageState(page)).dialogueOpen).toBe(false);

      // Perto do Mestre: toque no Interagir abre a introdução; perto da Lyra, a missão libera o portão.
      await placeHero(page, MASTER_APPROACH);
      expect((await villageState(page)).nearby).toBe('master');
      await tapLogical(page, btn);
      await expectDialogueLine(page, 'quest_master_intro');
      await shot(page, 'master_dialogue_mobile');
      await closeDialogueWithKeyboard(page);
      await placeHero(page, LYRA_APPROACH);
      expect((await villageState(page)).nearby).toBe('lyra');
      await tapLogical(page, btn);
      await expectDialogueLine(page, 'quest_lyra_offer');
      expect((await villageState(page)).gateUnlocked).toBe(true);
      await closeDialogueWithKeyboard(page);

      // Perto do portão: toque abre a lista; toque nas Ervas inicia a dungeon.
      await placeHero(page, GATE_APPROACH);
      expect((await villageState(page)).nearby).toBe('gate');
      await tapLogical(page, btn);
      await page.waitForFunction(() => window.__SUBMUNDO_HUB_DEBUG__!.getVillageState!()!.gateModalOpen, undefined, {
        timeout: 3000,
      });
      expect((await gateEntries(page)).map((e) => e.stageId)).toEqual(['mission_herbs']);
      await shot(page, 'gate_modal_mobile');
      await tapLogical(page, await gateRowCenter(page, 0));
      await waitDungeon(page, 'mission_herbs');

      await winRunAndReturn(page);
      expect((await villageState(page)).hero).toEqual(HERO_GATE);
      await closeDialogueWithKeyboard(page);
      await shot(page, 'gate_return_mobile');
    } finally {
      await context.close();
    }
    expectNoErrors(errors);
  });
});
