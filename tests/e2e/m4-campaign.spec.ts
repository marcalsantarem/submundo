import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { getAvailableStages } from '../../src/core/progression/CampaignManager';
import { MUTE_STORAGE_KEY } from '../../src/view/audio/SoundManager';
import affixesJson from '../../src/data/affixes.json';
import { GAME_VERSION } from '../../src/version';

test.describe('SUBMUNDO M4 — Campaign (Prologue -> Village Fall -> Act 1), 2D Portraits, T-051, 36 Affixes & Web Audio SFX E2E', () => {
  test('validates Prologue clean boot with 2D portrait DialogueBox, SoundManager mute toggle, 36 affixes, T-051 Blacksmith fixes, and PC/Mobile screenshots', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // Verify 36 affixes in src/data/affixes.json
    expect(affixesJson.affixes.length).toBe(36);

    // 1. Clean boot on Desktop Landscape (800x600) in Prologue — Vila Natal Viva
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/');

    await page.waitForFunction(
      () =>
        typeof window.__SUBMUNDO_HUB_DEBUG__ !== 'undefined' &&
        Boolean(window.__SUBMUNDO_HUB_DEBUG__.getProfile()) &&
        window.__SUBMUNDO_HUB_DEBUG__.getDialogueBox().isOpen() === true,
      undefined,
      { timeout: 10000 }
    );

    const prologueBootCheck = await page.evaluate(() => {
      const hub = window.__SUBMUNDO_HUB_DEBUG__!;
      const profile = hub.getProfile();
      const box = hub.getDialogueBox() as unknown as {
        isOpen: () => boolean;
        portraitSprite: { visible: boolean; frame: { name: string } } | null;
        speakerText: { text: string };
        titleText: { text: string };
      };
      const hasPortraitsTexture = hub.scene.textures.exists('portraits');
      const hasVillageTiles = hub.scene.textures.exists('village_tiles');
      const hasVillageNpcs = hub.scene.textures.exists('village_npcs');

      return {
        title: document.title,
        phase: profile.campaign?.phase,
        currentStageId: profile.campaign?.currentStageId,
        dialogueOpen: box.isOpen(),
        hasPortraitsTexture,
        hasVillageTiles,
        hasVillageNpcs,
        portraitVisible: box.portraitSprite?.visible ?? false,
        portraitFrame: box.portraitSprite?.frame?.name ?? null,
        speaker: box.speakerText.text,
        dialogueTitle: box.titleText.text,
      };
    });

    expect(GAME_VERSION).toBe('0.4.0');
    expect(prologueBootCheck.title).toBe('SUBMUNDO v0.4.0');
    expect(prologueBootCheck.phase).toBe('prologue');
    expect(prologueBootCheck.currentStageId).toBe('prologue_grotto');
    expect(prologueBootCheck.dialogueOpen).toBe(true);
    expect(prologueBootCheck.hasPortraitsTexture).toBe(true);
    expect(prologueBootCheck.hasVillageTiles).toBe(true);
    expect(prologueBootCheck.hasVillageNpcs).toBe(true);
    expect(prologueBootCheck.portraitVisible).toBe(true);
    expect(prologueBootCheck.portraitFrame).toBe(2); // weapon_master
    expect(prologueBootCheck.speaker).toContain('MESTRE DE ARMAS');

    // Capture Desktop PC 800x600 screenshot: Vila Natal + DialogueBox + 2D portrait
    await page.waitForTimeout(150);
    const pcScreenshotPath = resolve(
      process.cwd(),
      'docs/qa/screenshots/m4-pc-800x600.png'
    );
    await page.screenshot({ path: pcScreenshotPath });
    expect(existsSync(pcScreenshotPath)).toBe(true);
    expect(statSync(pcScreenshotPath).size).toBeGreaterThan(5000);

    // Advance & close the 2-line opening dialogue (prologue_welcome -> stage_grotto_intro)
    await page.keyboard.press('Enter');
    await page.waitForTimeout(60);
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      () => window.__SUBMUNDO_HUB_DEBUG__!.getDialogueBox().isOpen() === false,
      undefined,
      { timeout: 3000 }
    );

    // 2. Test SoundManager mute toggle & LocalStorage persistence in headless browser
    const muteBtnPos = await page.evaluate(() => {
      const rect = document.querySelector('canvas')?.getBoundingClientRect();
      const scene = window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
        hud: {
          muteBtn: { container: { x: number; y: number } };
        };
      };
      return {
        x: (rect?.left ?? 0) + scene.hud.muteBtn.container.x,
        y: (rect?.top ?? 0) + scene.hud.muteBtn.container.y,
      };
    });

    await page.mouse.click(muteBtnPos.x, muteBtnPos.y);
    const mutedState = await page.evaluate((key: string) => {
      return window.localStorage.getItem(key);
    }, MUTE_STORAGE_KEY);
    expect(mutedState).toBe('true');

    await page.mouse.click(muteBtnPos.x, muteBtnPos.y);
    const unmutedState = await page.evaluate((key: string) => {
      return window.localStorage.getItem(key);
    }, MUTE_STORAGE_KEY);
    expect(unmutedState).toBe('false');

    // 3. Verify T-051 fixes in BlacksmithModal (no duplicate +N suffix & costText spacing on 800x600)
    await page.evaluate(() => {
      const hub = window.__SUBMUNDO_HUB_DEBUG__!;
      hub.grantTestResources(500, 3);
      hub.openBlacksmith();
    });

    await page.waitForFunction(
      () =>
        (
          window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
            blacksmithModal: { isOpen: () => boolean };
          }
        ).blacksmithModal.isOpen() === true,
      undefined,
      { timeout: 3000 }
    );

    const blacksmithTargets = await page.evaluate(() => {
      const rect = document.querySelector('canvas')?.getBoundingClientRect();
      const scene = window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
        blacksmithModal: {
          rootContainer: { x: number; y: number };
          forgeCards: Array<{
            boundRecipeId: string | null;
            container: { x: number; y: number };
            costText: { x: number; width: number; text: string };
            btnContainer: { x: number; y: number };
            btnZone: { width: number };
          }>;
        };
      };
      const modal = scene.blacksmithModal;
      const legCard = modal.forgeCards.find((c) => c.boundRecipeId === 'forge_legendary')!;
      const costRight = legCard.costText.x + legCard.costText.width;
      const btnLeft = legCard.btnContainer.x - legCard.btnZone.width / 2;
      return {
        costText: legCard.costText.text,
        costRight,
        btnLeft,
        legBtnClick: {
          x: (rect?.left ?? 0) + modal.rootContainer.x + legCard.container.x + legCard.btnContainer.x,
          y: (rect?.top ?? 0) + modal.rootContainer.y + legCard.container.y + legCard.btnContainer.y,
        },
      };
    });

    expect(blacksmithTargets.costText).toContain('1 Essência');
    expect(blacksmithTargets.costText).toContain('120 Almas');
    expect(blacksmithTargets.costRight).toBeLessThan(blacksmithTargets.btnLeft);

    // Forge legendary item and upgrade it to +1, then check row.nameText for no duplicate (+1) +1
    await page.mouse.click(
      blacksmithTargets.legBtnClick.x,
      blacksmithTargets.legBtnClick.y
    );

    const upgradeBtnPos = await page.evaluate(() => {
      const rect = document.querySelector('canvas')?.getBoundingClientRect();
      const scene = window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
        blacksmithModal: {
          rootContainer: { x: number; y: number };
          itemRows: Array<{
            boundInstanceId: string | null;
            container: { x: number; y: number };
            btnContainer: { x: number; y: number };
          }>;
        };
      };
      const modal = scene.blacksmithModal;
      const firstRow = modal.itemRows[0];
      return {
        x: (rect?.left ?? 0) + modal.rootContainer.x + firstRow.container.x + firstRow.btnContainer.x,
        y: (rect?.top ?? 0) + modal.rootContainer.y + firstRow.container.y + firstRow.btnContainer.y,
      };
    });

    await page.mouse.click(upgradeBtnPos.x, upgradeBtnPos.y);

    const upgradedCheck = await page.evaluate(() => {
      const hub = window.__SUBMUNDO_HUB_DEBUG__!;
      const scene = hub.scene as unknown as {
        blacksmithModal: {
          close: () => void;
          itemRows: Array<{
            boundInstanceId: string | null;
            nameText: { text: string };
            levelText: { text: string };
          }>;
        };
      };
      const firstRow = scene.blacksmithModal.itemRows[0];
      const item = hub
        .getProfile()
        .stash.find((i) => i.instanceId === firstRow.boundInstanceId);
      const rowText = firstRow.nameText.text;
      const levelText = firstRow.levelText.text;
      scene.blacksmithModal.close();
      return {
        itemName: item?.name ?? '',
        rowText,
        levelText,
      };
    });

    expect(upgradedCheck.itemName).toContain('(+1)');
    expect(upgradedCheck.levelText).toBe('+1/+5');
    expect(/\(\+\d+\)\s*\+\d+/.test(upgradedCheck.rowText)).toBe(false);
    expect(/\+1\s*\+1/.test(upgradedCheck.rowText)).toBe(false);

    // 4. Mobile Portrait (360x640) screenshot of Vila Natal Viva (9:16)
    await page.setViewportSize({ width: 360, height: 640 });
    await page.waitForTimeout(200);

    const mobileCheck = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const hud = (
        window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
          hud: { locationText: { text: string } };
        }
      ).hud;
      return {
        canvasWidth: canvas?.width ?? 0,
        canvasHeight: canvas?.height ?? 0,
        locationTitle: hud.locationText.text,
      };
    });

    expect(mobileCheck.canvasWidth).toBe(360);
    expect(mobileCheck.canvasHeight).toBe(640);
    expect(mobileCheck.locationTitle).toContain('Vila Natal');

    const mobileScreenshotPath = resolve(
      process.cwd(),
      'docs/qa/screenshots/m4-mobile-360x640.png'
    );
    await page.screenshot({ path: mobileScreenshotPath });
    expect(existsSync(mobileScreenshotPath)).toBe(true);
    expect(statSync(mobileScreenshotPath).size).toBeGreaterThan(4000);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('validates Campaign progression (prologue_grotto -> prologue_mine -> prologue_seal -> Village Fall -> act1_submundo) with Emissary portrait', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/');

    await page.waitForFunction(
      () => typeof window.__SUBMUNDO_HUB_DEBUG__ !== 'undefined',
      undefined,
      { timeout: 10000 }
    );

    await page.evaluate(() => {
      const hub = window.__SUBMUNDO_HUB_DEBUG__!;
      hub.getDialogueBox().close();
      hub.enterDungeon('prologue_grotto');
    });

    await page.waitForFunction(
      () =>
        typeof window.__SUBMUNDO_DEBUG__ !== 'undefined' &&
        window.__SUBMUNDO_DEBUG__.getRunState()?.totalRooms === 3,
      undefined,
      { timeout: 10000 }
    );

    const grottoVictory = await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      for (let i = 0; i < 2; i++) {
        dbg.forceClearRoom();
        dbg.advanceRoom();
      }
      dbg.forceClearRoom();
      return dbg.getRunState().status;
    });
    expect(grottoVictory).toBe('victory');

    await page.evaluate(() => {
      window.__SUBMUNDO_DEBUG__!.returnToHub?.();
    });

    await page.waitForFunction(
      () => typeof window.__SUBMUNDO_HUB_DEBUG__ !== 'undefined',
      undefined,
      { timeout: 10000 }
    );

    const afterGrottoProfile = await page.evaluate(() => {
      const hub = window.__SUBMUNDO_HUB_DEBUG__!;
      hub.getDialogueBox().close();
      return hub.getProfile();
    });
    expect(afterGrottoProfile.campaign?.completedStages).toContain('prologue_grotto');
    expect(afterGrottoProfile.campaign?.currentStageId).toBe('prologue_mine');
    expect(getAvailableStages(afterGrottoProfile).map((s) => s.id)).toContain(
      'prologue_mine'
    );

    // Enter prologue_seal (4 rooms, boss abyss_herald) -> Village Fall -> Act 1
    await page.evaluate(() => {
      window.__SUBMUNDO_HUB_DEBUG__!.enterDungeon('prologue_seal');
    });

    await page.waitForFunction(
      () =>
        typeof window.__SUBMUNDO_DEBUG__ !== 'undefined' &&
        window.__SUBMUNDO_DEBUG__.getRunState()?.totalRooms === 4,
      undefined,
      { timeout: 10000 }
    );

    const sealVictory = await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      for (let i = 0; i < 3; i++) {
        dbg.forceClearRoom();
        dbg.advanceRoom();
      }
      const hasAbyssHerald = dbg
        .getMonsters()
        .some((m) => m.defId === 'abyss_herald');
      dbg.forceClearRoom();
      return {
        hasAbyssHerald,
        status: dbg.getRunState().status,
      };
    });

    expect(sealVictory.hasAbyssHerald).toBe(true);
    expect(sealVictory.status).toBe('victory');

    await page.evaluate(() => {
      window.__SUBMUNDO_DEBUG__!.returnToHub?.();
    });

    await page.waitForFunction(
      () =>
        typeof window.__SUBMUNDO_HUB_DEBUG__ !== 'undefined' &&
        window.__SUBMUNDO_HUB_DEBUG__.getDialogueBox().isOpen() === true,
      undefined,
      { timeout: 10000 }
    );

    const act1TransitionCheck = await page.evaluate(() => {
      const hub = window.__SUBMUNDO_HUB_DEBUG__!;
      const profile = hub.getProfile();
      const box = hub.getDialogueBox() as unknown as {
        isOpen: () => boolean;
        portraitSprite: { visible: boolean; frame: { name: string } } | null;
        speakerText: { text: string };
        titleText: { text: string };
      };
      const hud = (
        hub.scene as unknown as { hud: { locationText: { text: string } } }
      ).hud;
      return {
        phase: profile.campaign?.phase,
        villageFallTriggered: profile.campaign?.villageFallTriggered,
        currentStageId: profile.campaign?.currentStageId,
        locationTitle: hud.locationText.text,
        dialogueOpen: box.isOpen(),
        speaker: box.speakerText.text,
        dialogueTitle: box.titleText.text,
      };
    });

    expect(act1TransitionCheck.phase).toBe('act1');
    expect(act1TransitionCheck.villageFallTriggered).toBe(true);
    expect(act1TransitionCheck.currentStageId).toBe('act1_submundo');
    expect(act1TransitionCheck.locationTitle).toBe('Refúgio do Submundo');
    expect(act1TransitionCheck.dialogueOpen).toBe(true);

    // Advance from village_fall_boss -> village_fall_pact (Emissário Celestial portrait) -> act1_briefing -> close
    await page.keyboard.press('Enter');
    await page.waitForTimeout(60);

    const pactPortraitCheck = await page.evaluate(() => {
      const box = window.__SUBMUNDO_HUB_DEBUG__!.getDialogueBox() as unknown as {
        portraitSprite: { visible: boolean; frame: { name: string } } | null;
        speakerText: { text: string };
      };
      return {
        portraitVisible: box.portraitSprite?.visible ?? false,
        portraitFrame: box.portraitSprite?.frame?.name ?? null,
        speaker: box.speakerText.text,
      };
    });

    expect(pactPortraitCheck.portraitVisible).toBe(true);
    expect(pactPortraitCheck.portraitFrame).toBe(4); // emissary
    expect(pactPortraitCheck.speaker).toContain('EMISSÁRIO CELESTIAL');

    await page.keyboard.press('Enter');
    await page.waitForTimeout(60);
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      () => window.__SUBMUNDO_HUB_DEBUG__!.getDialogueBox().isOpen() === false,
      undefined,
      { timeout: 3000 }
    );
  });
});
