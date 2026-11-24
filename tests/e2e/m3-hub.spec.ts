import { existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { DEFAULT_HERO_STATS } from '../../src/core/entities/Hero';
import { SAVE_STORAGE_KEY } from '../../src/core/progression/StorageAdapter';
import { GAME_VERSION } from '../../src/version';
import {
  DESKTOP_VIEWPORT,
  MOBILE_LANDSCAPE_VIEWPORT,
  assertLandscapeCanvas,
  clickLogicalCanvas,
  ensureHubScene,
  openMobileLandscapePage,
} from './helpers/landscape';
import { clickGroundDrop, pickUpAllDropsViaDebug } from './helpers/testDungeon';

const SCREENSHOT_DIR = resolve(process.cwd(), 'docs/qa/screenshots');

// APOSENTADO — M11 (Decisão #29): a Vila/HubScene (Altar, Ferreiro, Baú) saiu do fluxo e os botões Forja/Personagem/Habilidades estão bloqueados. Extração/derrota e equipar passaram para m11-menu.spec.ts. Reativar quando a Forja voltar (marco futuro).
test.describe.skip('SUBMUNDO M3 — Hub Sanctuary, Altar, Blacksmith, Stash & Meta-Progression E2E (PC 960x540 & Mobile Landscape 844x390)', () => {
  test('validates HubScene boot, LocalStorage persistence, Altar/Blacksmith/Stash modals, ItemTooltipCard equip, Dungeon victory extraction vs punitive death, and PC/Mobile Landscape screenshots', async ({
    page,
    browser,
    baseURL,
  }) => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });

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

    // 1. Boot in HubScene on Desktop Landscape (960x540)
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto('/');
    await ensureHubScene(page, { clearStorage: true });
    await assertLandscapeCanvas(page, DESKTOP_VIEWPORT);

    const bootCheck = await page.evaluate((storageKey: string) => {
      const hub = window.__SUBMUNDO_HUB_DEBUG__!;
      const profile = hub.getProfile();
      const rawSaved = window.localStorage.getItem(storageKey);
      const parsedSaved = rawSaved ? JSON.parse(rawSaved) : null;
      return {
        title: document.title,
        sceneKey: hub.scene.scene.key,
        profileVersion: profile.version,
        souls: profile.souls,
        essences: profile.generalEssences,
        hasSavedInStorage: Boolean(rawSaved),
        savedVersion: parsedSaved?.version ?? null,
        village: hub.getVillageState?.() ?? null,
        hasOldStations:
          ((hub.scene as unknown as { stations?: unknown[] }).stations ?? []).length > 0,
      };
    }, SAVE_STORAGE_KEY);

    expect(bootCheck.title).toBe(`SUBMUNDO v${GAME_VERSION}`);
    expect(bootCheck.sceneKey).toBe('HubScene');
    expect(bootCheck.profileVersion).toBe(1);
    expect(bootCheck.souls).toBe(0);
    expect(bootCheck.essences).toBe(0);
    expect(bootCheck.hasSavedInStorage).toBe(true);
    expect(bootCheck.savedVersion).toBe(1);
    // M9 (Decisão #23): the prologue hub is the Vila Natal (no old stations / HubHud).
    expect(bootCheck.village).not.toBeNull();
    expect(bootCheck.village!.gateUnlocked).toBe(false);
    expect(bootCheck.village!.objective).toBe('Falar com o Mestre');
    expect(bootCheck.hasOldStations).toBe(false);

    await page.evaluate(() => {
      const hub = window.__SUBMUNDO_HUB_DEBUG__!;
      hub.getDialogueBox().close();
      hub.setCampaignPhase('act1', 'act1_submundo');
    });
    // Leaving the Vila recreates the HubScene (Refúgio scenario): wait for the new scene.
    await page.waitForFunction(
      () => {
        const hub = window.__SUBMUNDO_HUB_DEBUG__;
        return (
          Boolean(hub) &&
          hub!.getProfile().campaign?.phase === 'act1' &&
          (hub!.getVillageState?.() ?? null) === null &&
          Boolean((hub!.scene as unknown as { hud?: unknown }).hud)
        );
      },
      undefined,
      { timeout: 10000 }
    );

    // 2. Grant test resources (500 Souls, 3 General Essences) & purchase Altar upgrades (level 0 -> 1)
    await page.evaluate(() => {
      const hub = window.__SUBMUNDO_HUB_DEBUG__!;
      hub.grantTestResources(500, 3);
      hub.openAltar();
    });

    await page.waitForFunction(
      () =>
        (
          window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
            altarModal: { isOpen: () => boolean };
          }
        ).altarModal.isOpen() === true,
      undefined,
      { timeout: 3000 }
    );

    const altarBtnCoords = await page.evaluate(() => {
      const scene = window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
        altarModal: {
          rootContainer: { x: number; y: number };
          rows: Array<{
            boundUpgradeId: string | null;
            canPurchase: boolean;
            container: { x: number; y: number };
            btnContainer: { x: number; y: number };
          }>;
        };
      };
      const modal = scene.altarModal;
      const vitalityRow = modal.rows.find((r) => r.boundUpgradeId === 'vitality')!;
      const mightRow = modal.rows.find((r) => r.boundUpgradeId === 'might')!;
      return {
        canPurchaseVitality: vitalityRow.canPurchase,
        vitalityBtn: {
          x: modal.rootContainer.x + vitalityRow.container.x + vitalityRow.btnContainer.x,
          y: modal.rootContainer.y + vitalityRow.container.y + vitalityRow.btnContainer.y,
        },
        mightBtn: {
          x: modal.rootContainer.x + mightRow.container.x + mightRow.btnContainer.x,
          y: modal.rootContainer.y + mightRow.container.y + mightRow.btnContainer.y,
        },
      };
    });

    expect(altarBtnCoords.canPurchaseVitality).toBe(true);
    await clickLogicalCanvas(
      page,
      altarBtnCoords.vitalityBtn.x,
      altarBtnCoords.vitalityBtn.y
    );
    await clickLogicalCanvas(
      page,
      altarBtnCoords.mightBtn.x,
      altarBtnCoords.mightBtn.y
    );

    const afterAltarPurchase = await page.evaluate((storageKey: string) => {
      const profile = window.__SUBMUNDO_HUB_DEBUG__!.getProfile();
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
      return {
        vitalityLevel: profile.altarLevels.vitality,
        mightLevel: profile.altarLevels.might,
        souls: profile.souls,
        savedVitalityLevel: saved.altarLevels?.vitality ?? 0,
        savedMightLevel: saved.altarLevels?.might ?? 0,
      };
    }, SAVE_STORAGE_KEY);

    expect(afterAltarPurchase.vitalityLevel).toBe(1);
    expect(afterAltarPurchase.mightLevel).toBe(1);
    expect(afterAltarPurchase.souls).toBe(500 - 30 - 35);
    expect(afterAltarPurchase.savedVitalityLevel).toBe(1);
    expect(afterAltarPurchase.savedMightLevel).toBe(1);

    // 3. Open Blacksmith: forge Legendary & Rare relics + upgrade item to +1
    await page.evaluate(() => {
      window.__SUBMUNDO_HUB_DEBUG__!.openBlacksmith();
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

    const forgeCoords = await page.evaluate(() => {
      const scene = window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
        blacksmithModal: {
          rootContainer: { x: number; y: number };
          forgeCards: Array<{
            boundRecipeId: string | null;
            canForge: boolean;
            container: { x: number; y: number };
            btnContainer: { x: number; y: number };
          }>;
        };
      };
      const modal = scene.blacksmithModal;
      const rareCard = modal.forgeCards.find((c) => c.boundRecipeId === 'forge_rare')!;
      const legCard = modal.forgeCards.find((c) => c.boundRecipeId === 'forge_legendary')!;
      return {
        canForgeRare: rareCard.canForge,
        canForgeLegendary: legCard.canForge,
        rareBtn: {
          x: modal.rootContainer.x + rareCard.container.x + rareCard.btnContainer.x,
          y: modal.rootContainer.y + rareCard.container.y + rareCard.btnContainer.y,
        },
        legBtn: {
          x: modal.rootContainer.x + legCard.container.x + legCard.btnContainer.x,
          y: modal.rootContainer.y + legCard.container.y + legCard.btnContainer.y,
        },
      };
    });

    expect(forgeCoords.canForgeRare).toBe(true);
    expect(forgeCoords.canForgeLegendary).toBe(true);

    await clickLogicalCanvas(page, forgeCoords.legBtn.x, forgeCoords.legBtn.y);
    await clickLogicalCanvas(page, forgeCoords.rareBtn.x, forgeCoords.rareBtn.y);

    const upgradeRowCoords = await page.evaluate(() => {
      const scene = window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
        blacksmithModal: {
          rootContainer: { x: number; y: number };
          itemRows: Array<{
            boundInstanceId: string | null;
            canUpgrade: boolean;
            container: { x: number; y: number };
            btnContainer: { x: number; y: number };
          }>;
        };
      };
      const modal = scene.blacksmithModal;
      const firstRow = modal.itemRows[0];
      const profile = window.__SUBMUNDO_HUB_DEBUG__!.getProfile();
      const firstItem = profile.stash.find(
        (i) => i.instanceId === firstRow.boundInstanceId
      )!;
      return {
        instanceId: firstRow.boundInstanceId,
        canUpgrade: firstRow.canUpgrade,
        scoreBefore: firstItem.powerScore,
        btn: {
          x: modal.rootContainer.x + firstRow.container.x + firstRow.btnContainer.x,
          y: modal.rootContainer.y + firstRow.container.y + firstRow.btnContainer.y,
        },
      };
    });

    expect(upgradeRowCoords.instanceId).toBeTruthy();
    expect(upgradeRowCoords.canUpgrade).toBe(true);

    await clickLogicalCanvas(page, upgradeRowCoords.btn.x, upgradeRowCoords.btn.y);

    const afterBlacksmith = await page.evaluate(
      (targetId: string) => {
        const profile = window.__SUBMUNDO_HUB_DEBUG__!.getProfile();
        const upgradedItem = profile.stash.find((i) => i.instanceId === targetId)!;
        return {
          stashCount: profile.stash.length,
          essences: profile.generalEssences,
          souls: profile.souls,
          upgradeLevel: profile.itemUpgradeLevels[targetId] ?? 0,
          upgradedName: upgradedItem.name,
          scoreAfter: upgradedItem.powerScore,
        };
      },
      upgradeRowCoords.instanceId!
    );

    expect(afterBlacksmith.stashCount).toBe(2);
    expect(afterBlacksmith.essences).toBe(2); // 3 - 1 legendary forge
    expect(afterBlacksmith.souls).toBe(435 - 120 - 80 - 40); // 195
    expect(afterBlacksmith.upgradeLevel).toBe(1);
    expect(afterBlacksmith.upgradedName).toContain('(+1)');
    expect(afterBlacksmith.scoreAfter).toBeGreaterThan(upgradeRowCoords.scoreBefore);

    // Capture Desktop PC 960x540 screenshot showing HubScene + BlacksmithModal
    await page.waitForTimeout(150);
    const pcScreenshotPath = resolve(SCREENSHOT_DIR, 'm3-pc-960x540.png');
    await page.screenshot({ path: pcScreenshotPath });
    expect(existsSync(pcScreenshotPath)).toBe(true);
    expect(statSync(pcScreenshotPath).size).toBeGreaterThan(5000);

    // 4. Open Stash (InventoryModal 6-slot + 4x4 grid + ItemTooltipCard) and equip forged +1 item
    await page.evaluate(() => {
      window.__SUBMUNDO_HUB_DEBUG__!.openStash();
    });

    await page.waitForFunction(
      () =>
        (
          window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
            inventoryModal: { isOpen: () => boolean };
          }
        ).inventoryModal.isOpen() === true,
      undefined,
      { timeout: 3000 }
    );

    const stashGridCheck = await page.evaluate(() => {
      const scene = window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
        inventoryModal: {
          rootContainer: { x: number; y: number };
          bagSection: { x: number; y: number };
          slotCards: Array<{ slot: string }>;
          bagCells: Array<{
            boundItem: { instanceId: string } | null;
            container: { x: number; y: number; visible: boolean };
            nameText: { text: string };
            powerText: { text: string };
          }>;
        };
      };
      const modal = scene.inventoryModal;
      const occupiedCells = modal.bagCells.filter(
        (c) => c.container.visible && c.boundItem !== null
      );
      const firstCell = occupiedCells[0];
      return {
        slotCount: modal.slotCards.length,
        visibleCount: occupiedCells.length,
        firstCellId: firstCell.boundItem!.instanceId,
        firstCellHasText:
          firstCell.nameText.text.length > 0 &&
          firstCell.powerText.text.length > 0,
        firstCellClick: {
          x: modal.rootContainer.x + modal.bagSection.x + firstCell.container.x,
          y: modal.rootContainer.y + modal.bagSection.y + firstCell.container.y,
        },
      };
    });

    expect(stashGridCheck.slotCount).toBe(6);
    expect(stashGridCheck.visibleCount).toBe(2);
    expect(stashGridCheck.firstCellHasText).toBe(true);

    // Click first cell in Stash to pin ItemTooltipCard, then click EQUIPAR
    await clickLogicalCanvas(
      page,
      stashGridCheck.firstCellClick.x,
      stashGridCheck.firstCellClick.y
    );

    await page.waitForFunction(
      () =>
        (
          window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
            inventoryModal: { tooltipCard: { isOpen: () => boolean } };
          }
        ).inventoryModal.tooltipCard.isOpen() === true,
      undefined,
      { timeout: 3000 }
    );

    await page.waitForTimeout(150);

    const equipBtnPos = await page.evaluate(() => {
      const scene = window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
        inventoryModal: {
          tooltipCard: {
            dynamicGroup: {
              list: Array<{
                list?: Array<{
                  text?: string;
                  getWorldTransformMatrix?: () => { tx: number; ty: number };
                }>;
              }>;
            };
          };
        };
      };
      const cards = scene.inventoryModal.tooltipCard.dynamicGroup.list;
      for (const card of cards) {
        const children = card.list ?? [];
        for (const child of children) {
          if (child.text === 'EQUIPAR' && child.getWorldTransformMatrix) {
            const m = child.getWorldTransformMatrix();
            return { x: m.tx, y: m.ty };
          }
        }
      }
      return null;
    });

    expect(equipBtnPos).toBeTruthy();
    await clickLogicalCanvas(page, equipBtnPos!.x, equipBtnPos!.y);

    const equippedHubItemCheck = await page.evaluate(() => {
      const scene = window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
        inventoryModal: {
          slotCards: Array<{
            slot: string;
            slotLabelText: { y: number; height: number; text: string };
            itemNameText: { y: number; height: number; text: string };
          }>;
        };
      };
      const profile = window.__SUBMUNDO_HUB_DEBUG__!.getProfile();
      const equippedItems = Object.values(profile.equipped).filter(
        (i): i is NonNullable<typeof i> => i !== null
      );
      const equippedCard = scene.inventoryModal.slotCards.find(
        (c) => c.slot === equippedItems[0]?.slot
      );
      return {
        equippedCount: equippedItems.length,
        equippedItemId: equippedItems[0]?.instanceId ?? null,
        equippedSlot: equippedItems[0]?.slot ?? null,
        stashCount: profile.stash.length,
        equippedCardName: equippedCard?.itemNameText.text ?? '',
      };
    });

    expect(equippedHubItemCheck.equippedCount).toBe(1);
    expect(equippedHubItemCheck.equippedItemId).toBe(stashGridCheck.firstCellId);
    expect(equippedHubItemCheck.stashCount).toBe(1);
    expect(equippedHubItemCheck.equippedCardName.length).toBeGreaterThan(0);

    // 5. Enter Dungeon and verify Altar + Hub gear bonuses are applied to Hero
    await page.evaluate(() => {
      window.__SUBMUNDO_HUB_DEBUG__!.enterDungeon();
    });

    await page.waitForFunction(
      () =>
        typeof window.__SUBMUNDO_DEBUG__ !== 'undefined' &&
        window.__SUBMUNDO_DEBUG__.getHero()?.isAlive === true &&
        window.__SUBMUNDO_DEBUG__.getRunState()?.totalRooms === 5,
      undefined,
      { timeout: 10000 }
    );

    const dungeonEntryCheck = await page.evaluate((equippedId: string) => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      const hero = dbg.getHero();
      const inv = dbg.getInventory();
      const equippedIds = Object.values(inv.equipped)
        .filter((i): i is NonNullable<typeof i> => i !== null)
        .map((i) => i.instanceId);
      const hasAnyGearStatBoost =
        hero.stats.maxHp > hero.baseStats.maxHp ||
        hero.stats.attack > hero.baseStats.attack ||
        hero.stats.defense > hero.baseStats.defense ||
        hero.stats.moveSpeed > hero.baseStats.moveSpeed ||
        hero.stats.critChance > hero.baseStats.critChance ||
        hero.lifeSteal > 0 ||
        hero.cooldownReduction > 0 ||
        hero.luck > 0;
      return {
        baseMaxHp: hero.baseStats.maxHp,
        baseAttack: hero.baseStats.attack,
        hasAnyGearStatBoost,
        equippedIds,
        hasHubItemEquipped: equippedIds.includes(equippedId),
      };
    }, equippedHubItemCheck.equippedItemId!);

    // Vitality Lv.1 (+20 MaxHP) and Might Lv.1 (+3 Attack) plus Hub +1 item
    expect(dungeonEntryCheck.baseMaxHp).toBe(DEFAULT_HERO_STATS.maxHp + 20);
    expect(dungeonEntryCheck.baseAttack).toBe(DEFAULT_HERO_STATS.attack + 3);
    expect(dungeonEntryCheck.hasAnyGearStatBoost).toBe(true);
    expect(dungeonEntryCheck.hasHubItemEquipped).toBe(true);

    // 6. Victory Extraction: spawn & collect a run drop, clear Rooms 1->5 (Boss infernal_warden), win +1 Essence, returnToHub()
    const victoryDrop = await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      dbg.getHero().invulnerableUntilMs = 999999;
      return dbg.spawnTestDrop('rare');
    });

    // T-125: ground items are collected by click/tap only (real mouse click).
    await clickGroundDrop(page, victoryDrop.instanceId);
    await page.waitForFunction(
      (dropId: string) => {
        const inv = window.__SUBMUNDO_DEBUG__!.getInventory();
        const equippedIds = Object.values(inv.equipped)
          .filter(Boolean)
          .map((i) => i!.instanceId);
        const bagIds = inv.bag.map((i) => i.instanceId);
        return equippedIds.includes(dropId) || bagIds.includes(dropId);
      },
      victoryDrop.instanceId,
      { timeout: 5000 }
    );

    const victoryRunResult = await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      for (let step = 1; step <= 4; step++) {
        dbg.forceClearRoom();
        dbg.advanceRoom();
      }
      const boss = dbg.getMonsters().find((m) => m.defId === 'infernal_warden');
      const hasBoss = Boolean(boss);
      dbg.forceClearRoom();
      const runState = dbg.getRunState();
      return {
        hasBoss,
        status: runState.status,
        soulsCollected: runState.soulsCollected,
      };
    });

    expect(victoryRunResult.hasBoss).toBe(true);
    expect(victoryRunResult.status).toBe('victory');
    expect(victoryRunResult.soulsCollected).toBeGreaterThanOrEqual(250);

    await page.evaluate(() => {
      window.__SUBMUNDO_DEBUG__!.returnToHub?.();
    });

    await page.waitForFunction(
      () => typeof window.__SUBMUNDO_HUB_DEBUG__ !== 'undefined',
      undefined,
      { timeout: 10000 }
    );

    const afterVictoryHub = await page.evaluate(
      ({ hubItemId, runDropId }) => {
        const profile = window.__SUBMUNDO_HUB_DEBUG__!.getProfile();
        const allProfileItemIds = [
          ...Object.values(profile.equipped)
            .filter(Boolean)
            .map((i) => i!.instanceId),
          ...profile.stash.map((i) => i.instanceId),
        ];
        return {
          souls: profile.souls,
          essences: profile.generalEssences,
          runsCompleted: profile.stats.runsCompleted,
          bossesDefeated: profile.stats.bossesDefeated,
          hasHubItem: allProfileItemIds.includes(hubItemId),
          hasExtractedRunDrop: allProfileItemIds.includes(runDropId),
          stashCount: profile.stash.length,
        };
      },
      {
        hubItemId: equippedHubItemCheck.equippedItemId!,
        runDropId: victoryDrop.instanceId,
      }
    );

    expect(afterVictoryHub.souls).toBe(195 + victoryRunResult.soulsCollected);
    expect(afterVictoryHub.essences).toBeGreaterThanOrEqual(3); // 2 + 1 from Boss
    expect(afterVictoryHub.runsCompleted).toBe(1);
    expect(afterVictoryHub.bossesDefeated).toBe(1);
    expect(afterVictoryHub.hasHubItem).toBe(true);
    expect(afterVictoryHub.hasExtractedRunDrop).toBe(true);

    // 7. Punitive Death: enter new run, collect a run drop + souls, die, returnToHub() -> keep Souls & Hub gear, lose run drop
    const soulsBeforeDeathRun = afterVictoryHub.souls;
    await page.evaluate(() => {
      window.__SUBMUNDO_HUB_DEBUG__!.enterDungeon();
    });

    await page.waitForFunction(
      () =>
        typeof window.__SUBMUNDO_DEBUG__ !== 'undefined' &&
        window.__SUBMUNDO_DEBUG__.getRunState()?.status === 'in_progress',
      undefined,
      { timeout: 10000 }
    );

    const deathRunSetup = await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      // Clear Room 1 and advance to Room 2 so the hero earns some Souls before dying
      dbg.forceClearRoom();
      dbg.advanceRoom();
      const hero = dbg.getHero();
      hero.invulnerableUntilMs = 999999;
      hero.basicAttackReadyAtMs = 999999;
      const drop = dbg.spawnTestDrop('magic');
      return {
        dropId: drop.instanceId,
        soulsInRoom2: dbg.getRunState().soulsCollected,
      };
    });

    expect(deathRunSetup.soulsInRoom2).toBeGreaterThan(0);

    // T-125: collect via debug pickUpDropAt (same path as a click).
    await pickUpAllDropsViaDebug(page);
    await page.waitForFunction(
      (dropId: string) => {
        const inv = window.__SUBMUNDO_DEBUG__!.getInventory();
        const equippedIds = Object.values(inv.equipped)
          .filter(Boolean)
          .map((i) => i!.instanceId);
        const bagIds = inv.bag.map((i) => i.instanceId);
        return equippedIds.includes(dropId) || bagIds.includes(dropId);
      },
      deathRunSetup.dropId,
      { timeout: 5000 }
    );

    // Trigger hero death in Room 2
    await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      const hero = dbg.getHero();
      const monsters = dbg.getMonsters();
      hero.invulnerableUntilMs = 0;
      hero.baseStats.defense = 0;
      hero.stats.defense = 0;
      hero.stats.hp = 1;
      hero.basicAttackReadyAtMs = 999999;
      hero.minions = [];
      const attacker = monsters.find((m) => m.isAlive)!;
      attacker.hp = Math.max(attacker.hp, 500);
      attacker.stunnedUntilMs = 0;
      attacker.bleedDps = 0;
      attacker.position = { x: hero.position.x, y: hero.position.y };
      attacker.nextAttackAtMs = 0;
    });

    await page.waitForFunction(
      () => window.__SUBMUNDO_DEBUG__!.getRunState().status === 'defeat',
      undefined,
      { timeout: 5000 }
    );

    await page.evaluate(() => {
      window.__SUBMUNDO_DEBUG__!.returnToHub?.();
    });

    await page.waitForFunction(
      () => typeof window.__SUBMUNDO_HUB_DEBUG__ !== 'undefined',
      undefined,
      { timeout: 10000 }
    );

    const afterDeathHub = await page.evaluate(
      ({ hubItemId, prevExtractedDropId, lostRunDropId, storageKey }) => {
        const profile = window.__SUBMUNDO_HUB_DEBUG__!.getProfile();
        const savedRaw = window.localStorage.getItem(storageKey) || '{}';
        const saved = JSON.parse(savedRaw);
        const allProfileItemIds = [
          ...Object.values(profile.equipped)
            .filter(Boolean)
            .map((i) => i!.instanceId),
          ...profile.stash.map((i) => i.instanceId),
        ];
        return {
          souls: profile.souls,
          savedSouls: saved.souls,
          savedRaw,
          runsFailed: profile.stats.runsFailed,
          hasHubItem: allProfileItemIds.includes(hubItemId),
          hasPrevExtractedDrop: allProfileItemIds.includes(prevExtractedDropId),
          hasLostRunDrop: allProfileItemIds.includes(lostRunDropId),
        };
      },
      {
        hubItemId: equippedHubItemCheck.equippedItemId!,
        prevExtractedDropId: victoryDrop.instanceId,
        lostRunDropId: deathRunSetup.dropId,
        storageKey: SAVE_STORAGE_KEY,
      }
    );

    expect(afterDeathHub.souls).toBe(
      soulsBeforeDeathRun + deathRunSetup.soulsInRoom2
    );
    expect(afterDeathHub.savedSouls).toBe(afterDeathHub.souls);
    expect(afterDeathHub.runsFailed).toBe(1);
    expect(afterDeathHub.hasHubItem).toBe(true);
    expect(afterDeathHub.hasPrevExtractedDrop).toBe(true);
    expect(afterDeathHub.hasLostRunDrop).toBe(false);

    // 8. Mobile Landscape (844x390, hasTouch: true) responsive HubScene & AltarModal screenshot
    const { context: mobileContext, page: mobilePage } =
      await openMobileLandscapePage(browser, {
        baseURL,
        consoleErrors,
        pageErrors,
        initialStorage: {
          [SAVE_STORAGE_KEY]: afterDeathHub.savedRaw,
        },
      });

    try {
      await mobilePage.goto('/');
      await ensureHubScene(mobilePage);
      await mobilePage.waitForTimeout(200);

      await assertLandscapeCanvas(mobilePage, MOBILE_LANDSCAPE_VIEWPORT);

      const mobileHubCheck = await mobilePage.evaluate(() => {
        window.__SUBMUNDO_HUB_DEBUG__!.openAltar();
        const scene = window.__SUBMUNDO_HUB_DEBUG__!.scene as unknown as {
          altarModal: { isOpen: () => boolean };
        };
        return {
          altarOpen: scene.altarModal.isOpen(),
        };
      });

      expect(mobileHubCheck.altarOpen).toBe(true);

      await mobilePage.waitForTimeout(150);
      const mobileScreenshotPath = resolve(
        SCREENSHOT_DIR,
        'm3-mobile-844x390.png'
      );
      await mobilePage.screenshot({ path: mobileScreenshotPath });
      expect(existsSync(mobileScreenshotPath)).toBe(true);
      expect(statSync(mobileScreenshotPath).size).toBeGreaterThan(4000);
    } finally {
      await mobileContext.close();
    }

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
