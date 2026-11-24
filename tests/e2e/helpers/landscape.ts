import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export const LOGICAL_WIDTH = 960;
export const LOGICAL_HEIGHT = 540;
export const EXPECTED_ASPECT_RATIO = LOGICAL_WIDTH / LOGICAL_HEIGHT; // 16:9

export const DESKTOP_VIEWPORT = {
  width: 960,
  height: 540,
} as const;

export const MOBILE_LANDSCAPE_VIEWPORT = {
  width: 844,
  height: 390,
} as const;

export interface ViewportSize {
  width: number;
  height: number;
}

export interface CanvasMetrics {
  hasCanvas: boolean;
  canvasWidth: number;
  canvasHeight: number;
  rectWidth: number;
  rectHeight: number;
  aspectRatio: number;
}

export async function inspectLandscapeCanvas(page: Page): Promise<CanvasMetrics> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      return {
        hasCanvas: false,
        canvasWidth: 0,
        canvasHeight: 0,
        rectWidth: 0,
        rectHeight: 0,
        aspectRatio: 0,
      };
    }
    const rect = canvas.getBoundingClientRect();
    return {
      hasCanvas: true,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      rectWidth: rect.width,
      rectHeight: rect.height,
      aspectRatio: rect.height > 0 ? rect.width / rect.height : 0,
    };
  });
}

export async function assertLandscapeCanvas(
  page: Page,
  viewport: ViewportSize
): Promise<CanvasMetrics> {
  const metrics = await inspectLandscapeCanvas(page);
  expect(metrics.hasCanvas).toBe(true);
  expect(metrics.canvasWidth).toBe(LOGICAL_WIDTH);
  expect(metrics.canvasHeight).toBe(LOGICAL_HEIGHT);
  expect(metrics.rectWidth).toBeGreaterThan(0);
  expect(metrics.rectHeight).toBeGreaterThan(0);
  expect(metrics.rectWidth).toBeGreaterThan(metrics.rectHeight);
  expect(metrics.rectWidth).toBeLessThanOrEqual(viewport.width + 2);
  expect(metrics.rectHeight).toBeLessThanOrEqual(viewport.height + 2);
  expect(Math.abs(metrics.aspectRatio - EXPECTED_ASPECT_RATIO)).toBeLessThan(0.05);
  return metrics;
}

export async function clickLogicalCanvas(
  page: Page,
  logicalX: number,
  logicalY: number
): Promise<void> {
  const target = await page.evaluate(
    ({ lx, ly, fallbackW, fallbackH }) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) {
        return null;
      }
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / (canvas.width || fallbackW);
      const scaleY = rect.height / (canvas.height || fallbackH);
      return {
        x: rect.left + lx * scaleX,
        y: rect.top + ly * scaleY,
      };
    },
    {
      lx: logicalX,
      ly: logicalY,
      fallbackW: LOGICAL_WIDTH,
      fallbackH: LOGICAL_HEIGHT,
    }
  );
  expect(target).toBeTruthy();
  await page.mouse.click(target!.x, target!.y);
}

export async function dispatchWindowKey(
  page: Page,
  key: string,
  code: string,
  keyCode: number
): Promise<void> {
  await page.evaluate(
    ({ k, c, kc }) => {
      const down = new KeyboardEvent('keydown', {
        key: k,
        code: c,
        keyCode: kc,
        which: kc,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(down);
    },
    { k: key, c: code, kc: keyCode }
  );
  await page.waitForTimeout(60);
  await page.evaluate(
    ({ k, c, kc }) => {
      const up = new KeyboardEvent('keyup', {
        key: k,
        code: c,
        keyCode: kc,
        which: kc,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(up);
    },
    { k: key, c: code, kc: keyCode }
  );
}

/**
 * M11 (Decisão #29): a Vila saiu do fluxo. Abre `/?test` (testArena), limpa o save e
 * reinicia como uma run normal do Ato 1 (`act1_submundo`, 5 salas) via `restartRun`.
 */
export async function openAct1Run(
  page: Page,
  stageId = 'act1_submundo',
  options?: { clearStorage?: boolean }
): Promise<void> {
  await page.goto('/?test');
  await page.waitForFunction(() => typeof window.__SUBMUNDO_DEBUG__ !== 'undefined', undefined, {
    timeout: 10000,
  });
  if (options?.clearStorage !== false) {
    await page.evaluate(() => window.localStorage.clear());
  }
  await page.evaluate((id) => {
    window.__SUBMUNDO_DEBUG__!.restartRun(id as never);
  }, stageId);
}

/** Ordem dos botões do menu-hub (MENU_HUB_ITEMS). */
export const MENU_ORDER = ['masmorras', 'inventario', 'forja', 'personagem', 'habilidades', 'configuracoes'] as const;

/**
 * Centro lógico (960x540) do botão do menu pelo índice, conforme o layout do `MenuHubScene`.
 * O jogo é sempre 960x540 lógico, então o layout `mobile` do menu (h<=420) nunca ativa:
 * use `mobile=false` também no celular (ver ressalva no qa-M11).
 */
export function menuButtonPoint(id: (typeof MENU_ORDER)[number], mobile: boolean): { x: number; y: number } {
  const i = MENU_ORDER.indexOf(id);
  return mobile
    ? { x: 16 + 236 / 2, y: 76 + i * 48 + 22 }
    : { x: 36 + 276 / 2, y: 150 + i * 58 + 25 };
}

/** Aguarda o menu-hub (M11) estar ativo; opcionalmente limpa o save e recarrega o menu. */
export async function waitForMenuHub(page: Page): Promise<void> {
  await page.waitForFunction(() => typeof window.__SUBMUNDO_MENU_DEBUG__ !== 'undefined', undefined, {
    timeout: 15000,
  });
}

export async function ensureHubScene(
  page: Page,
  options?: { clearStorage?: boolean }
): Promise<void> {
  await page.waitForFunction(
    () =>
      typeof window.__SUBMUNDO_HUB_DEBUG__ !== 'undefined' ||
      typeof window.__SUBMUNDO_DEBUG__ !== 'undefined',
    undefined,
    { timeout: 10000 }
  );

  if (options?.clearStorage) {
    await page.evaluate(() => {
      window.localStorage.clear();
    });
  }

  const inHub = await page.evaluate(
    () => typeof window.__SUBMUNDO_HUB_DEBUG__ !== 'undefined'
  );

  if (!inHub) {
    await page.evaluate(() => {
      window.__SUBMUNDO_DEBUG__!.returnToHub?.();
    });
  } else if (options?.clearStorage) {
    await page.evaluate(() => {
      window.__SUBMUNDO_HUB_DEBUG__!.scene.scene.restart();
    });
  }

  await page.waitForFunction(
    () =>
      typeof window.__SUBMUNDO_HUB_DEBUG__ !== 'undefined' &&
      Boolean(window.__SUBMUNDO_HUB_DEBUG__.getProfile()),
    undefined,
    { timeout: 10000 }
  );
}

export async function openMobileLandscapePage(
  browser: Browser,
  options?: {
    baseURL?: string;
    consoleErrors?: string[];
    pageErrors?: string[];
    notFoundUrls?: string[];
    initialStorage?: Record<string, string>;
  }
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL: options?.baseURL ?? 'http://127.0.0.1:4173',
    viewport: MOBILE_LANDSCAPE_VIEWPORT,
    hasTouch: true,
    isMobile: true,
  });

  if (options?.initialStorage && Object.keys(options.initialStorage).length > 0) {
    const entries = Object.entries(options.initialStorage);
    await context.addInitScript((pairs: Array<[string, string]>) => {
      window.localStorage.clear();
      for (const [k, v] of pairs) {
        window.localStorage.setItem(k, v);
      }
    }, entries);
  }

  const page = await context.newPage();

  if (options?.consoleErrors) {
    const errors = options.consoleErrors;
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(`[mobile] ${msg.text()}`);
      }
    });
  }

  if (options?.pageErrors) {
    const errors = options.pageErrors;
    page.on('pageerror', (err) => {
      errors.push(`[mobile] ${err.message}`);
    });
  }

  if (options?.notFoundUrls) {
    const urls = options.notFoundUrls;
    page.on('response', (res) => {
      if (res.status() === 404) {
        urls.push(`[mobile] ${res.url()}`);
      }
    });
  }

  return { context, page };
}
