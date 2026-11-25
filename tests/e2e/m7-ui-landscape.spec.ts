import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { GAME_VERSION } from '../../src/version';
import {
  DESKTOP_VIEWPORT,
  MOBILE_LANDSCAPE_VIEWPORT,
  assertLandscapeCanvas,
  clickLogicalCanvas,
  dispatchWindowKey,
  menuButtonPoint,
  waitForMenuHub,
  openMobileLandscapePage,
} from './helpers/landscape';

const ROOT_DIR = process.cwd();
const SCREENSHOT_DIR = resolve(ROOT_DIR, 'docs/qa/screenshots');

const UI_FILES_TO_AUDIT = [
  'src/view/ui/DarkFantasyUiBuilder.ts',
  'src/view/ui/ItemTooltipCard.ts',
  'src/view/ui/InventoryModal.ts',
  'src/view/ui/DungeonHud.ts',
  'src/view/ui/HubHud.ts',
  'src/view/ui/BlacksmithModal.ts',
  'src/view/ui/AltarModal.ts',
  'src/view/ui/DialogueBox.ts',
] as const;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPngDimensions(filePath: string): { width: number; height: number } {
  const buf = readFileSync(filePath);
  expect(buf.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

test.describe('SUBMUNDO M7 — Dark Fantasy 2D UI & Exclusive Landscape Mode (960x540 / 844x390)', () => {
  test('validates 2D UI spritesheets, sprites manifest, PWA landscape orientation, #rotate-overlay, Cinzel font, and clean UI sources', () => {
    // 1. Validate ui_icons.png (1152x64, 18 frames 64x64) & portraits.png (1152x128, 9 frames 128x128; frame 8 = Lyra, T-153)
    const uiIconsPath = resolve(ROOT_DIR, 'public/assets/sprites/ui_icons.png');
    const portraitsPath = resolve(ROOT_DIR, 'public/assets/sprites/portraits.png');
    const spritesManifestPath = resolve(ROOT_DIR, 'public/assets/sprites/manifest.json');

    expect(existsSync(uiIconsPath)).toBe(true);
    expect(existsSync(portraitsPath)).toBe(true);
    expect(existsSync(spritesManifestPath)).toBe(true);

    expect(readPngDimensions(uiIconsPath)).toEqual({ width: 1152, height: 64 });
    expect(readPngDimensions(portraitsPath)).toEqual({ width: 1152, height: 128 });

    const spritesManifest = JSON.parse(
      readFileSync(spritesManifestPath, 'utf-8')
    ) as {
      sprites: Record<
        string,
        {
          key: string;
          file: string;
          width: number;
          height: number;
          frameWidth: number;
          frameHeight: number;
          frames: string[];
        }
      >;
    };

    const uiIconsSpec = spritesManifest.sprites.ui_icons;
    expect(uiIconsSpec).toBeDefined();
    expect(uiIconsSpec.width).toBe(1152);
    expect(uiIconsSpec.height).toBe(64);
    expect(uiIconsSpec.frameWidth).toBe(64);
    expect(uiIconsSpec.frameHeight).toBe(64);
    expect(uiIconsSpec.frames).toHaveLength(18);
    expect(uiIconsSpec.frames).toContain('slot_helm');
    expect(uiIconsSpec.frames).toContain('slot_boots');

    const portraitsSpec = spritesManifest.sprites.portraits;
    expect(portraitsSpec).toBeDefined();
    expect(portraitsSpec.width).toBe(1152);
    expect(portraitsSpec.height).toBe(128);
    expect(portraitsSpec.frameWidth).toBe(128);
    expect(portraitsSpec.frameHeight).toBe(128);
    expect(portraitsSpec.frames).toHaveLength(9);

    // 2. Validate public/manifest.webmanifest ("orientation": "landscape") & index.html (#rotate-overlay + Cinzel)
    const webManifestPath = resolve(ROOT_DIR, 'public/manifest.webmanifest');
    expect(existsSync(webManifestPath)).toBe(true);
    const webManifest = JSON.parse(readFileSync(webManifestPath, 'utf-8')) as {
      orientation?: string;
      display?: string;
      short_name?: string;
    };
    expect(webManifest.orientation).toBe('landscape');
    expect(webManifest.display).toBe('standalone');
    expect(webManifest.short_name).toBe('SUBMUNDO');

    const indexHtmlPath = resolve(ROOT_DIR, 'index.html');
    expect(existsSync(indexHtmlPath)).toBe(true);
    const indexHtml = readFileSync(indexHtmlPath, 'utf-8');
    expect(indexHtml).toContain('#rotate-overlay');
    expect(indexHtml).toContain('id="rotate-overlay"');
    expect(indexHtml).toContain('Cinzel');

    // 3. Validate DarkFantasyUiBuilder.ts exports & absence of 'monospace' / 'mobile_portrait' across UI modules
    const uiBuilderSource = readFileSync(
      resolve(ROOT_DIR, 'src/view/ui/DarkFantasyUiBuilder.ts'),
      'utf-8'
    );
    expect(uiBuilderSource).toContain('export const DF_FONTS');
    expect(uiBuilderSource).toContain('Cinzel');
    expect(uiBuilderSource).toContain('export function drawOrnatePanel');
    expect(uiBuilderSource).toContain('export function drawOrnateButton');
    expect(uiBuilderSource).toContain('export function drawRaritySlotFrame');

    for (const relPath of UI_FILES_TO_AUDIT) {
      const fullPath = resolve(ROOT_DIR, relPath);
      expect(existsSync(fullPath)).toBe(true);
      const source = readFileSync(fullPath, 'utf-8');
      expect(source, `${relPath} must not reference monospace`).not.toMatch(
        /monospace/i
      );
      expect(
        source,
        `${relPath} must not reference mobile_portrait`
      ).not.toContain('mobile_portrait');
    }
  });

  test('renders the menu-hub (root URL) in Desktop Landscape (960x540), opens the Inventory from the Inventário button cleanly, and saves m7-desktop-landscape.png', async ({
    page,
  }) => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const notFoundUrls: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    page.on('response', (res) => {
      if (res.status() === 404) {
        notFoundUrls.push(res.url());
      }
    });

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto('/');

    await expect(page).toHaveTitle(`SUBMUNDO v${GAME_VERSION}`);

    // M11 (Decisão #29): a raiz abre o menu-hub (MenuHubScene).
    await waitForMenuHub(page);
    await assertLandscapeCanvas(page, DESKTOP_VIEWPORT);

    const overlayDisplay = await page.evaluate(() => {
      const overlay = document.getElementById('rotate-overlay');
      return overlay ? window.getComputedStyle(overlay).display : null;
    });
    expect(overlayDisplay).toBe('none');

    // Abre o Inventário com clique real no botão "Inventário".
    const btn = menuButtonPoint('inventario', false);
    await clickLogicalCanvas(page, btn.x, btn.y);
    await page.waitForFunction(
      () => window.__SUBMUNDO_MENU_DEBUG__?.getState().inventoryOpen === true,
      undefined,
      { timeout: 3000 }
    );

    await page.waitForTimeout(150);
    const desktopScreenshotPath = resolve(SCREENSHOT_DIR, 'm7-desktop-landscape.png');
    await page.screenshot({ path: desktopScreenshotPath });
    expect(existsSync(desktopScreenshotPath)).toBe(true);
    expect(statSync(desktopScreenshotPath).size).toBeGreaterThan(5000);

    // Fecha com Escape.
    await dispatchWindowKey(page, 'Escape', 'Escape', 27);
    await page.waitForFunction(
      () => window.__SUBMUNDO_MENU_DEBUG__?.getState().inventoryOpen === false,
      undefined,
      { timeout: 3000 }
    );

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(notFoundUrls).toEqual([]);
  });

  test('renders the menu-hub (root URL) in Mobile Landscape (844x390, hasTouch: true), opens the Inventory by tap cleanly, and saves m7-mobile-landscape.png', async ({
    browser,
    baseURL,
  }) => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const notFoundUrls: string[] = [];

    const { context: mobileContext, page: mobilePage } = await openMobileLandscapePage(browser, {
      baseURL,
      consoleErrors,
      pageErrors,
      notFoundUrls,
    });

    try {
      await mobilePage.goto('/');
      await expect(mobilePage).toHaveTitle(`SUBMUNDO v${GAME_VERSION}`);
      await waitForMenuHub(mobilePage);
      await assertLandscapeCanvas(mobilePage, MOBILE_LANDSCAPE_VIEWPORT);

      const mobileState = await mobilePage.evaluate(() => {
        const overlay = document.getElementById('rotate-overlay');
        return {
          maxTouchPoints: navigator.maxTouchPoints,
          overlayDisplay: overlay ? window.getComputedStyle(overlay).display : null,
        };
      });
      expect(mobileState.maxTouchPoints).toBeGreaterThan(0);
      expect(mobileState.overlayDisplay).toBe('none');

      const btn = menuButtonPoint('inventario', true);
      await clickLogicalCanvas(mobilePage, btn.x, btn.y);
      await mobilePage.waitForFunction(
        () => window.__SUBMUNDO_MENU_DEBUG__?.getState().inventoryOpen === true,
        undefined,
        { timeout: 3000 }
      );

      await mobilePage.waitForTimeout(150);
      const mobileScreenshotPath = resolve(SCREENSHOT_DIR, 'm7-mobile-landscape.png');
      await mobilePage.screenshot({ path: mobileScreenshotPath });
      expect(existsSync(mobileScreenshotPath)).toBe(true);
      expect(statSync(mobileScreenshotPath).size).toBeGreaterThan(4000);

      await dispatchWindowKey(mobilePage, 'Escape', 'Escape', 27);
      await mobilePage.waitForFunction(
        () => window.__SUBMUNDO_MENU_DEBUG__?.getState().inventoryOpen === false,
        undefined,
        { timeout: 3000 }
      );
    } finally {
      await mobileContext.close();
    }

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(notFoundUrls).toEqual([]);
  });
});
