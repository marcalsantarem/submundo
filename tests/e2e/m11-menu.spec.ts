import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { SAVE_STORAGE_KEY } from '../../src/core/progression/StorageAdapter';
import { GAME_VERSION } from '../../src/version';
import {
  DESKTOP_VIEWPORT,
  MOBILE_LANDSCAPE_VIEWPORT,
  assertLandscapeCanvas,
  clickLogicalCanvas,
  dispatchWindowKey,
  menuButtonPoint,
  openMobileLandscapePage,
  waitForMenuHub,
} from './helpers/landscape';
import { pickUpAllDropsViaDebug, waitForTestArena } from './helpers/testDungeon';

/**
 * M11 (Decisões #28/#29) — menu-hub: o jogo abre no menu; 4 botões bloqueados ("Em breve");
 * "Masmorra teste" abre a DungeonScene (testArena); Inventário dentro do menu; volta da dungeon
 * ao menu com o relatório aplicado; `?test` abre a testArena direto; save antigo sem `menuUnlocks`.
 */

const SCREENSHOT_DIR = resolve(process.cwd(), 'docs/qa/screenshots');

// Layout lógico (960x540) do `MenuHubScene`. O jogo é sempre 960x540 lógico: o layout "mobile"
// do menu (h<=420) nunca ativa, então PC e celular usam as mesmas coordenadas.
const ENTRY_POINT = { x: 736, y: 158 }; // cartão "Masmorra teste"
const ENTER_BTN = { x: 818.5, y: 458 };
const BACK_BTN = { x: 653.5, y: 458 };
// Inventário (modal): primeira célula da Mochila, "Equipar"/"Desequipar" do tooltip, slot Elmo, fechar.
const BAG_CELL_0 = { x: 490, y: 150 };
const TOOLTIP_PRIMARY = { x: 392, y: 383 };
const SLOT_HELM = { x: 153, y: 145 };
const INV_CLOSE = { x: 894, y: 52 };

const LOCKED_IDS = ['forja', 'personagem', 'habilidades', 'configuracoes'] as const;

interface MenuState {
  selected: string;
  unlocked: string[];
  rightPanelOpen: boolean;
  inventoryOpen: boolean;
  soulsText: string;
  essenceText: string;
}

interface Errors {
  consoleErrors: string[];
  pageErrors: string[];
  notFoundUrls: string[];
}

function trackErrors(page: Page, prefix = ''): Errors {
  const e: Errors = { consoleErrors: [], pageErrors: [], notFoundUrls: [] };
  page.on('console', (m) => {
    if (m.type() === 'error') e.consoleErrors.push(prefix + m.text());
  });
  page.on('pageerror', (err) => e.pageErrors.push(prefix + err.message));
  page.on('response', (r) => {
    if (r.status() === 404) e.notFoundUrls.push(prefix + r.url());
  });
  return e;
}

function expectClean(e: Errors): void {
  expect(e.consoleErrors).toEqual([]);
  expect(e.pageErrors).toEqual([]);
  expect(e.notFoundUrls).toEqual([]);
}

/** Registra todo texto desenhado no canvas (Phaser desenha Text via fillText/strokeText). */
async function installTextSpy(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __texts: string[] };
    w.__texts = [];
    const wrap = (name: 'fillText' | 'strokeText') => {
      const orig = CanvasRenderingContext2D.prototype[name];
      CanvasRenderingContext2D.prototype[name] = function (this: CanvasRenderingContext2D, t: string, ...rest: number[]) {
        if (typeof t === 'string' && t.trim() && w.__texts[w.__texts.length - 1] !== t) {
          w.__texts.push(t);
          if (w.__texts.length > 4000) w.__texts.splice(0, 2000);
        }
        return (orig as (...a: unknown[]) => void).call(this, t, ...rest);
      } as typeof orig;
    };
    wrap('fillText');
    wrap('strokeText');
  });
}

async function clearTexts(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __texts: string[] }).__texts = [];
  });
}

async function seenText(page: Page, re: RegExp, timeout = 4000): Promise<string> {
  const start = Date.now();
  for (;;) {
    const hit = await page.evaluate(
      (src) => {
        const r = new RegExp(src);
        return (window as unknown as { __texts: string[] }).__texts.find((t) => r.test(t)) ?? null;
      },
      re.source
    );
    if (hit) return hit;
    if (Date.now() - start > timeout) throw new Error(`texto não desenhado: ${re}`);
    await page.waitForTimeout(100);
  }
}

async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.waitForTimeout(250);
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, name) });
}

/** Clique real no canvas + um quadro para o Phaser processar o toque. */
async function tap(page: Page, p: { x: number; y: number }): Promise<void> {
  await clickLogicalCanvas(page, p.x, p.y);
  await page.waitForTimeout(160);
}

const menuState = (page: Page): Promise<MenuState> =>
  page.evaluate(() => window.__SUBMUNDO_MENU_DEBUG__!.getState() as MenuState);

const readSave = (page: Page): Promise<any> =>
  page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? 'null'), SAVE_STORAGE_KEY);

interface SeedSpec {
  souls?: number;
  essences?: number;
  stash?: number;
  /** Equipa um Elmo no perfil (para testar "Desequipar"). */
  equipHelm?: boolean;
  /** Remove `menuUnlocks` (save anterior ao M11) ou o substitui. */
  menuUnlocks?: 'remove' | string[];
}

/** Abre `/?test`, monta o save pela própria DungeonScene (itens reais) e deixa o storage pronto. */
async function seedSave(page: Page, spec: SeedSpec): Promise<void> {
  await page.goto('/?test');
  await page.waitForFunction(
    () => {
      const d = window.__SUBMUNDO_DEBUG__;
      return !!d && !!d.getDungeonMap() && d.getMonsters().length > 0;
    },
    undefined,
    { timeout: 30000 }
  );
  await page.evaluate(
    ({ key, spec }) => {
      window.localStorage.clear();
      const d = window.__SUBMUNDO_DEBUG__!;
      const prof = (d.scene as unknown as { activeProfile: any }).activeProfile;
      const rar = ['common', 'magic', 'rare', 'legendary'] as const;
      const pool: any[] = [];
      const need = (spec.stash ?? 0) + (spec.equipHelm ? 40 : 0);
      for (let i = 0; i < need; i++) pool.push(d.spawnTestDrop(rar[i % 4]));
      let helm: any = null;
      if (spec.equipHelm) {
        helm = pool.find((i) => i.slot === 'helm');
        if (!helm) throw new Error('sem elmo no sorteio');
        prof.equipped.helm = helm;
      }
      prof.stash = pool.filter((i) => i !== helm).slice(0, spec.stash ?? 0);
      if (spec.souls !== undefined) prof.souls = spec.souls;
      if (spec.essences !== undefined) prof.generalEssences = spec.essences;
      if (spec.menuUnlocks === 'remove') delete prof.menuUnlocks;
      else if (spec.menuUnlocks) prof.menuUnlocks = spec.menuUnlocks;
      window.localStorage.setItem(key, JSON.stringify(prof));
    },
    { key: SAVE_STORAGE_KEY, spec }
  );
}

async function openMenu(page: Page): Promise<void> {
  await page.goto('/');
  await waitForMenuHub(page);
}

async function expectInTestArena(page: Page): Promise<void> {
  await waitForTestArena(page);
  const info = await page.evaluate(() => {
    const d = window.__SUBMUNDO_DEBUG__!;
    return {
      isTestArena: (d.scene as unknown as { isTestArena: boolean }).isTestArena,
      heroAlive: d.getHero().isAlive,
      menuGone: typeof window.__SUBMUNDO_MENU_DEBUG__ === 'undefined',
    };
  });
  expect(info).toEqual({ isTestArena: true, heroAlive: true, menuGone: true });
}

/** Fluxo comum do menu, PC e celular (só muda o viewport e os nomes das capturas). */
async function runMenuFlow(page: Page, tag: 'pc' | 'mobile', viewport: { width: number; height: number }): Promise<void> {
  await seedSave(page, { stash: 3 });
  await installTextSpy(page);
  await openMenu(page);
  await expect(page).toHaveTitle(`SUBMUNDO v${GAME_VERSION}`);
  await assertLandscapeCanvas(page, viewport);

  // 1. Abre no menu: Masmorras selecionada, só Masmorras e Inventário liberados, painel aberto.
  expect(await menuState(page)).toMatchObject({
    selected: 'masmorras',
    unlocked: ['masmorras', 'inventario'],
    rightPanelOpen: true,
    inventoryOpen: false,
  });
  expect(await page.evaluate(() => typeof window.__SUBMUNDO_DEBUG__)).toBe('undefined'); // sem dungeon
  await seenText(page, /Escolher dungeon/);
  await seenText(page, /Masmorra teste/);
  await shot(page, `m11_menu_${tag}.png`);

  // 2. Os 4 bloqueados: "Em breve", nada abre, seleção e painel intactos.
  for (const id of LOCKED_IDS) {
    await clearTexts(page);
    const p = menuButtonPoint(id, false);
    await tap(page, p);
    await seenText(page, /^Em breve$/);
    expect(await menuState(page), id).toMatchObject({
      selected: 'masmorras',
      rightPanelOpen: true,
      inventoryOpen: false,
    });
    if (id === 'forja') await shot(page, `m11_em_breve_${tag}.png`);
  }
  // Mesmo caminho pela API de debug.
  await page.evaluate(() => window.__SUBMUNDO_MENU_DEBUG__!.select('configuracoes' as never));
  expect(await menuState(page)).toMatchObject({ selected: 'masmorras', inventoryOpen: false });

  // 3. Painel "Escolher dungeon": Voltar fecha. (Reabrir pelo clique em Masmorras falha: ver o teste
  // "Voltar e Masmorras" abaixo; aqui reabrimos pela API de debug para seguir o fluxo.)
  await tap(page, BACK_BTN);
  expect((await menuState(page)).rightPanelOpen).toBe(false);
  await page.evaluate(() => window.__SUBMUNDO_MENU_DEBUG__!.select('masmorras'));
  expect((await menuState(page)).rightPanelOpen).toBe(true);
  await shot(page, `m11_painel_masmorras_${tag}.png`);

  // 4. Inventário: abre, tem os 6 slots, fecha pelo X e reabre; Escape também fecha.
  const inv = menuButtonPoint('inventario', false);
  await tap(page, inv);
  expect(await menuState(page)).toMatchObject({ selected: 'inventario', inventoryOpen: true });
  await seenText(page, /MOCHILA/i);
  await shot(page, `m11_inventario_${tag}.png`);
  await tap(page, INV_CLOSE);
  await page.waitForFunction(() => window.__SUBMUNDO_MENU_DEBUG__?.getState().inventoryOpen === false, undefined, {
    timeout: 3000,
  });
  expect((await menuState(page)).selected).toBe('masmorras');
  await page.evaluate(() => window.__SUBMUNDO_MENU_DEBUG__!.openInventory());
  await dispatchWindowKey(page, 'Escape', 'Escape', 27);
  await page.waitForFunction(() => window.__SUBMUNDO_MENU_DEBUG__?.getState().inventoryOpen === false, undefined, {
    timeout: 3000,
  });

  // 5. "Masmorra teste" + Entrar (clique real): abre a DungeonScene (testArena).
  await tap(page, ENTRY_POINT);
  await tap(page, ENTER_BTN);
  await expectInTestArena(page);
  await shot(page, `m11_dungeon_teste_${tag}.png`);
}

test.describe('SUBMUNDO M11 — menu-hub (Decisões #28/#29)', () => {
  test.setTimeout(90000);

  // GRAVE: depois de "Voltar" (painel fechado, Masmorras ainda selecionada) o botão Masmorras não
  // reage ao clique/toque real; só `select('masmorras')` (debug) ou passar pelo Inventário reabre.
  // Falha esperada até o AG02 corrigir (provável: `repaintButtons()` dentro do pointerdown do
  // "Voltar", MenuHubScene.ts:~291-296 e ~397).
  test('Voltar e depois clicar em Masmorras reabre o painel "Escolher dungeon"', async ({ page }) => {
    test.fail(true, 'MenuHubScene: botão Masmorras morto após "Voltar" (clique real não reabre o painel)');
    await openMenu(page);
    await tap(page, BACK_BTN);
    expect((await menuState(page)).rightPanelOpen).toBe(false);
    await tap(page, menuButtonPoint('masmorras', false));
    await page.waitForTimeout(300);
    expect((await menuState(page)).rightPanelOpen).toBe(true);
  });

  test('PC 960×540: abre no menu, bloqueados "Em breve", painel, Inventário e Masmorra teste', async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await runMenuFlow(page, 'pc', DESKTOP_VIEWPORT);
    expectClean(errors);
  });

  test('Mobile 844×390 (toque): abre no menu, bloqueados "Em breve", painel, Inventário e Masmorra teste', async ({
    browser,
    baseURL,
  }) => {
    const errors: Errors = { consoleErrors: [], pageErrors: [], notFoundUrls: [] };
    const { context, page } = await openMobileLandscapePage(browser, {
      baseURL,
      consoleErrors: errors.consoleErrors,
      pageErrors: errors.pageErrors,
      notFoundUrls: errors.notFoundUrls,
    });
    try {
      expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
      await runMenuFlow(page, 'mobile', MOBILE_LANDSCAPE_VIEWPORT);
    } finally {
      await context.close();
    }
    expectClean(errors);
  });

  test('?test, ?map, ?biome e ?seed abrem a testArena direto (sem menu)', async ({ page }) => {
    const errors = trackErrors(page);
    for (const q of ['?test', '?map=giant&seed=707', '?biome=dungeon_basic', '?seed=101']) {
      await page.goto('/' + q);
      await expectInTestArena(page);
    }
    expectClean(errors);
  });

  test('saves antigos: sem `menuUnlocks`, com lixo, e sem save nenhum abrem o menu normal', async ({ page }) => {
    const errors = trackErrors(page);
    await installTextSpy(page);

    // (a) save do M10: sem `menuUnlocks`, com Almas.
    await seedSave(page, { souls: 77, essences: 3, menuUnlocks: 'remove' });
    expect((await readSave(page)).menuUnlocks).toBeUndefined();
    await openMenu(page);
    expect(await menuState(page)).toMatchObject({
      selected: 'masmorras',
      unlocked: ['masmorras', 'inventario'],
      rightPanelOpen: true,
      soulsText: '77',
      essenceText: '3',
    });

    // (b) `menuUnlocks` inválido: ids desconhecidos são ignorados, os padrões continuam.
    await seedSave(page, { menuUnlocks: ['nao_existe', 'inventario'] });
    await openMenu(page);
    expect((await menuState(page)).unlocked).toEqual(['masmorras', 'inventario']);

    // (c) sem nenhum save.
    await page.evaluate(() => window.localStorage.clear());
    await openMenu(page);
    expect(await menuState(page)).toMatchObject({ unlocked: ['masmorras', 'inventario'], soulsText: '0', essenceText: '0' });

    // (d) save corrompido (JSON inválido): o menu abre e não quebra.
    await page.evaluate((k) => window.localStorage.setItem(k, '{nao eh json'), SAVE_STORAGE_KEY);
    await openMenu(page);
    expect((await menuState(page)).unlocked).toEqual(['masmorras', 'inventario']);
    expectClean(errors);
  });
});

// =============================================================================
// Volta da dungeon ao menu (BRF-174: atenção especial)
// =============================================================================

/** Entra pelo menu na "Masmorra teste" e troca por uma run normal (`restartRun`). */
async function enterRunFromMenu(page: Page, stageId: string): Promise<void> {
  await openMenu(page);
  await page.evaluate(() => window.__SUBMUNDO_MENU_DEBUG__!.enter());
  await waitForTestArena(page);
  await page.evaluate((id) => window.__SUBMUNDO_DEBUG__!.restartRun(id as never), stageId);
  await page.waitForFunction(
    () => {
      const d = window.__SUBMUNDO_DEBUG__;
      return !!d && d.getHero()?.isAlive === true && d.getRunState()?.status === 'in_progress';
    },
    undefined,
    { timeout: 10000 }
  );
}

async function waitMenuAgain(page: Page): Promise<void> {
  await waitForMenuHub(page);
  await page.waitForFunction(() => typeof window.__SUBMUNDO_DEBUG__ === 'undefined' || !window.__SUBMUNDO_DEBUG__.getHero, undefined, {
    timeout: 5000,
  }).catch(() => undefined);
}

function stashIds(save: any): string[] {
  return [
    ...Object.values(save.equipped).filter(Boolean).map((i: any) => i.instanceId),
    ...save.stash.map((i: any) => i.instanceId),
  ];
}

test.describe('SUBMUNDO M11 — volta da dungeon ao menu', () => {
  test.setTimeout(90000);
  test('vitória do Ato 1: Enter volta ao menu e o relatório entra no perfil UMA vez (Almas, runs, item)', async ({ page }) => {
    const errors = trackErrors(page);
    await installTextSpy(page);
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await seedSave(page, { souls: 100 });
    await enterRunFromMenu(page, 'act1_submundo');

    const drop = await page.evaluate(() => {
      const d = window.__SUBMUNDO_DEBUG__!;
      d.getHero().invulnerableUntilMs = 999999;
      return d.spawnTestDrop('rare');
    });
    await pickUpAllDropsViaDebug(page);
    const run = await page.evaluate(() => {
      const d = window.__SUBMUNDO_DEBUG__!;
      for (let i = 0; i < 4; i++) {
        d.forceClearRoom();
        d.advanceRoom();
      }
      d.forceClearRoom();
      const r = d.getRunState();
      return { status: r.status, souls: r.soulsCollected };
    });
    expect(run.status).toBe('victory');
    expect(run.souls).toBeGreaterThanOrEqual(250);

    const savedByRun = await readSave(page); // a DungeonScene já persiste ao fechar a run
    await shot(page, 'm11_fim_dungeon_vitoria.png');
    await clearTexts(page);
    await dispatchWindowKey(page, 'Enter', 'Enter', 13); // "Voltar" do painel de fim de run
    await waitMenuAgain(page);

    // Aviso na volta + estado do menu.
    const notice = await seenText(page, /^Vit.ria!/);
    expect(notice).toContain(`+${run.souls} Almas`);
    const state = await menuState(page);
    const save = await readSave(page);
    await shot(page, 'm11_volta_dungeon_aviso.png');
    expect(state).toMatchObject({ selected: 'masmorras', rightPanelOpen: true });

    // Regra: Almas e runs entram UMA vez (a DungeonScene aplica; o menu não pode reaplicar).
    expect(savedByRun.souls, 'save após a run (antes do menu)').toBe(100 + run.souls);
    expect(save.souls).toBeGreaterThanOrEqual(100 + run.souls); // o valor EXATO está no teste "uma vez" abaixo
    expect(state.soulsText).toBe(String(save.souls));
    expect(save.stats.runsCompleted).toBeGreaterThanOrEqual(1);
    expect(save.stats.bossesDefeated).toBeGreaterThanOrEqual(1);
    expect(stashIds(save).filter((id) => id === drop.instanceId)).toHaveLength(1);
    expectClean(errors);
  });

  // GRAVE: as Almas/runs da run entram DUAS vezes no perfil. A DungeonScene já aplica o relatório
  // ao perfil e persiste (DungeonScene.ts:3491-3492), e o MenuHubScene aplica o mesmo `fromRun` de
  // novo ao abrir (MenuHubScene.ts:158-160). Falha esperada até o AG04/AG02 corrigir (os itens não
  // duplicam porque `storeRunItems` ignora ids já guardados).
  test('Almas e runs da vitória entram no perfil uma vez só (Almas = antes + coletadas)', async ({ page }) => {
    test.fail(true, 'MenuHubScene.ts:158 reaplica applyRunOutcomeToProfile sobre um perfil que a DungeonScene já atualizou (Almas x2)');
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await seedSave(page, { souls: 100 });
    await enterRunFromMenu(page, 'act1_submundo');
    const run = await page.evaluate(() => {
      const d = window.__SUBMUNDO_DEBUG__!;
      d.getHero().invulnerableUntilMs = 999999;
      for (let i = 0; i < 4; i++) {
        d.forceClearRoom();
        d.advanceRoom();
      }
      d.forceClearRoom();
      return d.getRunState().soulsCollected;
    });
    await dispatchWindowKey(page, 'Enter', 'Enter', 13);
    await waitMenuAgain(page);
    const save = await readSave(page);
    expect(save.souls).toBe(100 + run);
    expect(save.stats.runsCompleted).toBe(1);
    expect((await menuState(page)).soulsText).toBe(String(100 + run));
  });

  test('derrota do Ato 1: Almas salvas, item da run perdido, menu mostra "Derrota"', async ({ page }) => {
    const errors = trackErrors(page);
    await installTextSpy(page);
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await seedSave(page, { souls: 10 });
    await enterRunFromMenu(page, 'act1_submundo');

    const setup = await page.evaluate(() => {
      const d = window.__SUBMUNDO_DEBUG__!;
      d.forceClearRoom();
      d.advanceRoom();
      const hero = d.getHero();
      hero.invulnerableUntilMs = 999999;
      hero.basicAttackReadyAtMs = 999999;
      const drop = d.spawnTestDrop('magic');
      return { dropId: drop.instanceId, souls: d.getRunState().soulsCollected };
    });
    expect(setup.souls).toBeGreaterThan(0);
    await pickUpAllDropsViaDebug(page);
    await page.evaluate(() => {
      const d = window.__SUBMUNDO_DEBUG__!;
      const hero = d.getHero();
      hero.invulnerableUntilMs = 0;
      hero.baseStats.defense = 0;
      hero.stats.defense = 0;
      hero.stats.hp = 1;
      hero.minions = [];
      const attacker = d.getMonsters().find((m) => m.isAlive)!;
      attacker.hp = Math.max(attacker.hp, 500);
      attacker.stunnedUntilMs = 0;
      attacker.position = { x: hero.position.x, y: hero.position.y };
      attacker.nextAttackAtMs = 0;
    });
    await page.waitForFunction(() => window.__SUBMUNDO_DEBUG__!.getRunState().status === 'defeat', undefined, { timeout: 8000 });
    await clearTexts(page);
    await dispatchWindowKey(page, 'Enter', 'Enter', 13);
    await waitMenuAgain(page);

    expect(await seenText(page, /^Derrota\./)).toContain(`+${setup.souls} Almas`);
    const save = await readSave(page);
    expect(save.souls).toBeGreaterThanOrEqual(10 + setup.souls);
    expect(save.stats.runsFailed).toBeGreaterThanOrEqual(1);
    expect(stashIds(save)).not.toContain(setup.dropId);
    expect((await menuState(page)).soulsText).toBe(String(save.souls));
    expectClean(errors);
  });

  test('missão do prólogo: botão "Voltar ao menu" (clique real) volta ao menu; itens ficam no perfil', async ({ page }) => {
    const errors = trackErrors(page);
    await installTextSpy(page);
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await seedSave(page, { souls: 5 });
    await enterRunFromMenu(page, 'mission_herbs');
    await page.waitForFunction(() => window.__SUBMUNDO_DEBUG__!.getMissionState()?.missionId === 'mission_herbs');

    await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.completeMissionNow());
    await seenText(page, /^Voltar ao menu$/, 8000);
    await shot(page, 'm11_fim_missao_voltar_ao_menu.png');
    await clearTexts(page);
    await dispatchWindowKey(page, 'Enter', 'Enter', 13);
    await waitMenuAgain(page);

    expect(await seenText(page, /^Vit.ria!/)).toContain('+0 Almas'); // prólogo não conta Almas (Decisão #27)
    expect((await readSave(page)).souls).toBe(5);
    expect((await menuState(page)).soulsText).toBe('5');
    expectClean(errors);
  });

  // GRAVE: na testArena (a "Masmorra teste" do menu) não existe caminho de volta ao menu.
  // O fim é "Teste finalizado" -> Enter/toque reinicia a arena; a morte é desligada (herói imortal)
  // e nenhum RunEndReport é gerado. Este teste descreve o comportamento ESPERADO pelo BRF-174
  // ("todo fim de dungeon volta ao menu"); está marcado como falha esperada até o AG01 corrigir.
  test('Masmorra teste: ao terminar volta ao menu', async ({ page }) => {
    test.fail(true, 'src/view/scenes/DungeonScene.ts:3333 (restartTestArena): "Teste finalizado" reinicia a arena em vez de voltar ao menu');
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await openMenu(page);
    await page.evaluate(() => window.__SUBMUNDO_MENU_DEBUG__!.enter());
    await waitForTestArena(page);
    // Atalho: mata a onda e teletransporta o herói ao gatilho da próxima zona, até a zona do chefe.
    const zones = await page.evaluate(() => window.__SUBMUNDO_DEBUG__!.getDungeonMap()!.zones.length);
    for (let z = 1; z < zones; z++) {
      await page.evaluate((zone) => {
        const d = window.__SUBMUNDO_DEBUG__!;
        for (const m of d.getMonsters()) {
          m.hp = 0;
          m.isAlive = false;
        }
        const r = d.getDungeonMap()!.zones[zone].trigger[0];
        const h = d.getHero();
        h.position.x = r.x + r.w / 2;
        h.position.y = r.y + r.h / 2 - 30; // pés = y + 30
      }, z);
      await page.waitForFunction(
        (zone) => {
          const d = window.__SUBMUNDO_DEBUG__!;
          return d.getActiveZoneIndex() === zone && d.getMonsters().some((m) => m.isAlive);
        },
        z,
        { timeout: 10000 }
      );
    }
    await page.evaluate(() => {
      for (const m of window.__SUBMUNDO_DEBUG__!.getMonsters()) {
        m.hp = 0;
        m.isAlive = false;
      }
    });
    await page.waitForFunction(
      () => (window.__SUBMUNDO_DEBUG__?.scene as unknown as { testArenaFinished?: boolean })?.testArenaFinished === true,
      undefined,
      { timeout: 8000 }
    );
    await page.waitForTimeout(500);
    await shot(page, 'm11_teste_finalizado.png');
    await dispatchWindowKey(page, 'Enter', 'Enter', 13);
    await page.waitForFunction(() => !!window.__SUBMUNDO_MENU_DEBUG__, undefined, { timeout: 4000 });
  });
});

// =============================================================================
// Inventário no menu: equipar e mochila cheia
// =============================================================================

async function openInventoryByClick(page: Page): Promise<void> {
  const p = menuButtonPoint('inventario', false);
  await tap(page, p);
  await page.waitForFunction(() => window.__SUBMUNDO_MENU_DEBUG__?.getState().inventoryOpen === true, undefined, { timeout: 3000 });
  await page.waitForTimeout(300);
}

test.describe('SUBMUNDO M11 — Inventário e mochila cheia', () => {
  test.setTimeout(90000);
  test('equipar um item do Baú pelo menu persiste no save', async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await seedSave(page, { stash: 6 });
    const before = await readSave(page);
    await openMenu(page);
    await openInventoryByClick(page);

    await tap(page, BAG_CELL_0);
    await page.waitForTimeout(250);
    await shot(page, 'm11_inventario_equipar.png');
    await tap(page, TOOLTIP_PRIMARY); // "Equipar"
    await page.waitForFunction(
      (k) => Object.values(JSON.parse(window.localStorage.getItem(k)!).equipped).some(Boolean),
      SAVE_STORAGE_KEY,
      { timeout: 4000 }
    );
    const after = await readSave(page);
    expect(Object.values(after.equipped).filter(Boolean)).toHaveLength(1);
    expect(after.stash).toHaveLength(before.stash.length - 1);
    const eq: any = Object.values(after.equipped).find(Boolean);
    expect(before.stash.map((i: any) => i.instanceId)).toContain(eq.instanceId);
    expect((await menuState(page)).inventoryOpen).toBe(true);
    expectClean(errors);
  });

  test('mochila cheia (30/30): equipar no slot vazio funciona; Desequipar não quebra, não perde o item e avisa', async ({ page }) => {
    const errors = trackErrors(page);
    await installTextSpy(page);
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await seedSave(page, { stash: 30, equipHelm: true });
    const before = await readSave(page);
    expect(before.stash).toHaveLength(30);
    expect(before.maxStashSize).toBe(30);
    await openMenu(page);
    await openInventoryByClick(page);
    await shot(page, 'm11_inventario_cheio.png');

    // Desequipar com o Baú cheio: bloqueado, item continua equipado, nada some, aviso aparece.
    await clearTexts(page);
    // A altura do tooltip varia com o nº de afixos: tenta alturas do botão "Desequipar" até o aviso.
    let warned = false;
    for (let y = 470; y >= 380 && !warned; y -= 10) {
      await tap(page, SLOT_HELM);
      await page.waitForTimeout(200);
      await tap(page, { x: TOOLTIP_PRIMARY.x, y });
      warned = await seenText(page, /Ba. cheio/, 500).then(
        () => true,
        () => false
      );
    }
    expect(warned, 'aviso "Baú cheio" ao desequipar com o Baú cheio').toBe(true);
    await shot(page, 'm11_bau_cheio_aviso.png');
    const afterUnequip = await readSave(page);
    expect(afterUnequip.equipped.helm?.instanceId).toBe(before.equipped.helm.instanceId);
    expect(afterUnequip.stash).toHaveLength(30);
    expect((await menuState(page)).inventoryOpen).toBe(true);

    // Equipar um item do Baú no slot vazio com o Baú cheio: o Baú encolhe para 29, nada se perde.
    await tap(page, INV_CLOSE).catch(() => undefined);
    await page.evaluate(() => window.__SUBMUNDO_MENU_DEBUG__!.closeInventory());
    await page.evaluate(() => window.__SUBMUNDO_MENU_DEBUG__!.openInventory());
    await page.waitForTimeout(300);
    const slotOfFirst = afterUnequip.stash[0].slot;
    await tap(page, BAG_CELL_0);
    await page.waitForTimeout(250);
    await tap(page, TOOLTIP_PRIMARY);
    await page.waitForTimeout(400);
    const afterEquip = await readSave(page);
    const total = (s: any) => stashIds(s).length;
    expect(total(afterEquip), 'itens totais (equipados + Baú) não mudam ao equipar').toBe(total(afterUnequip));
    expect(afterEquip.equipped[slotOfFirst]?.instanceId).toBe(afterUnequip.stash[0].instanceId);
    expectClean(errors);
  });

  test('mochila cheia (30/30): vitória com item novo volta ao menu sem erro; o item novo é descartado em silêncio', async ({ page }) => {
    const errors = trackErrors(page);
    await installTextSpy(page);
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await seedSave(page, { stash: 30, souls: 0 });
    await enterRunFromMenu(page, 'act1_submundo');
    const drop = await page.evaluate(() => {
      const d = window.__SUBMUNDO_DEBUG__!;
      d.getHero().invulnerableUntilMs = 999999;
      return d.spawnTestDrop('legendary');
    });
    await pickUpAllDropsViaDebug(page);
    const run = await page.evaluate(() => {
      const d = window.__SUBMUNDO_DEBUG__!;
      for (let i = 0; i < 4; i++) {
        d.forceClearRoom();
        d.advanceRoom();
      }
      d.forceClearRoom();
      return { status: d.getRunState().status, souls: d.getRunState().soulsCollected };
    });
    expect(run.status).toBe('victory');
    const heldInRun = await page.evaluate(
      (id) => {
        const inv = window.__SUBMUNDO_DEBUG__!.getInventory();
        return [...inv.bag, ...Object.values(inv.equipped).filter(Boolean)].some((i: any) => i.instanceId === id);
      },
      drop.instanceId
    );
    await dispatchWindowKey(page, 'Enter', 'Enter', 13);
    await waitMenuAgain(page);
    await seenText(page, /^Vit.ria!/);
    await shot(page, 'm11_volta_bau_cheio.png');
    const save = await readSave(page);
    expect(save.stash).toHaveLength(30); // nunca passa de maxStashSize
    expect(save.souls).toBeGreaterThanOrEqual(run.souls);
    // Documenta o comportamento atual: se o herói segurava o item na run e o Baú está cheio, ele some.
    // (ressalva no qa-M11: o aviso da volta diz "1 item(ns) obtido(s)" mesmo assim)
    if (heldInRun && !stashIds(save).includes(drop.instanceId)) {
      test.info().annotations.push({ type: 'ressalva', description: 'item da run descartado em silêncio com o Baú cheio' });
    }
    expect((await menuState(page)).selected).toBe('masmorras');
    // O menu continua utilizável: Inventário abre e fecha.
    await openInventoryByClick(page);
    await page.evaluate(() => window.__SUBMUNDO_MENU_DEBUG__!.closeInventory());
    expectClean(errors);
  });
});
