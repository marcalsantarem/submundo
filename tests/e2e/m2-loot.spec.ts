import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { GAME_VERSION } from '../../src/version';

test.describe('SUBMUNDO M2 — Loot, Synergies, Inventory & PWA E2E (PC 800x600 & Mobile 360x640)', () => {
  test('validates v0.2.0 PWA assets, loot drop/pickup/equip, InventoryModal pause, victory extraction, death loss, and PC/Mobile screenshots', async ({
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

    // 1. Desktop Landscape (800x600) + PWA checks
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
    });

    await page.waitForFunction(
      () => typeof window.__SUBMUNDO_HUB_DEBUG__ !== 'undefined',
      undefined,
      { timeout: 10000 }
    );
    await page.evaluate(() => {
      const hub = window.__SUBMUNDO_HUB_DEBUG__!;
      hub.setCampaignPhase('act1', 'act1_submundo');
      hub.enterDungeon('act1_submundo');
    });

    await page.waitForFunction(
      () =>
        typeof window.__SUBMUNDO_DEBUG__ !== 'undefined' &&
        window.__SUBMUNDO_DEBUG__.getHero()?.isAlive === true &&
        window.__SUBMUNDO_DEBUG__.getRunState()?.totalRooms === 5,
      undefined,
      { timeout: 10000 }
    );

    const pwaCheck = await page.evaluate(async () => {
      const manifestHref = document
        .querySelector('link[rel="manifest"]')
        ?.getAttribute('href');
      const appleIconHref = document
        .querySelector('link[rel="apple-touch-icon"]')
        ?.getAttribute('href');
      const icon192Href = document
        .querySelector('link[rel="icon"][sizes="192x192"]')
        ?.getAttribute('href');

      const manifestRes = await fetch('./manifest.webmanifest');
      const manifestJson = manifestRes.ok ? await manifestRes.json() : null;
      const icon192Res = await fetch('./icons/icon-192.png');
      const appleIconRes = await fetch('./icons/apple-touch-icon.png');
      const swRes = await fetch('./sw.js');

      return {
        title: document.title,
        manifestHref,
        appleIconHref,
        icon192Href,
        manifestStatus: manifestRes.status,
        manifestShortName: manifestJson?.short_name ?? null,
        manifestDisplay: manifestJson?.display ?? null,
        icon192Status: icon192Res.status,
        icon192Type: icon192Res.headers.get('content-type') ?? '',
        appleIconStatus: appleIconRes.status,
        appleIconType: appleIconRes.headers.get('content-type') ?? '',
        swStatus: swRes.status,
      };
    });

    expect(pwaCheck.title).toBe(`SUBMUNDO v${GAME_VERSION}`);
    expect(pwaCheck.title).toBe('SUBMUNDO v0.4.0');
    expect(pwaCheck.manifestHref).toBe('./manifest.webmanifest');
    expect(pwaCheck.appleIconHref).toBe('./icons/apple-touch-icon.png');
    expect(pwaCheck.icon192Href).toBe('./icons/icon-192.png');
    expect(pwaCheck.manifestStatus).toBe(200);
    expect(pwaCheck.manifestShortName).toBe('SUBMUNDO');
    expect(pwaCheck.manifestDisplay).toBe('standalone');
    expect(pwaCheck.icon192Status).toBe(200);
    expect(pwaCheck.icon192Type).toContain('image/png');
    expect(pwaCheck.appleIconStatus).toBe(200);
    expect(pwaCheck.appleIconType).toContain('image/png');
    expect(pwaCheck.swStatus).toBe(200);

    // 2. Spawn legendary drop, move hero right to auto-pickup & auto-equip, verify hero stats/forces
    const drop1 = await page.evaluate(() => {
      const hero = window.__SUBMUNDO_DEBUG__!.getHero();
      hero.stats.hp = hero.stats.maxHp;
      hero.invulnerableUntilMs = 999999;
      return window.__SUBMUNDO_DEBUG__!.spawnTestDrop('legendary');
    });
    expect(drop1.rarity).toBe('legendary');

    await page.keyboard.down('KeyD');
    await page.waitForFunction(
      (targetId: string) => {
        const inv = window.__SUBMUNDO_DEBUG__!.getInventory();
        const equippedIds = Object.values(inv.equipped)
          .filter(Boolean)
          .map((item) => item!.instanceId);
        const bagIds = inv.bag.map((item) => item.instanceId);
        return equippedIds.includes(targetId) || bagIds.includes(targetId);
      },
      drop1.instanceId,
      { timeout: 5000 }
    );
    await page.keyboard.up('KeyD');

    const afterFirstPickup = await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      const hero = dbg.getHero();
      const inv = dbg.getInventory();
      return {
        equipped: inv.equipped,
        bagCount: inv.bag.length,
        equippedForces: hero.equippedForces,
        activeLegendaryPowers: hero.activeLegendaryPowers,
        stats: hero.stats,
      };
    });

    expect(afterFirstPickup.equipped[drop1.slot]?.instanceId).toBe(
      drop1.instanceId
    );
    if (drop1.force !== 'none') {
      expect(afterFirstPickup.equippedForces[drop1.force]).toBeGreaterThanOrEqual(
        1
      );
    }
    if (drop1.legendaryPower) {
      expect(afterFirstPickup.activeLegendaryPowers).toContain(
        drop1.legendaryPower.id
      );
    }

    // 3. Spawn 5 more drops and walk over them to populate bag (>= 2 items) + test explicit equipItem
    await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      dbg.spawnTestDrop('rare');
      dbg.spawnTestDrop('magic');
      dbg.spawnTestDrop('legendary');
      dbg.spawnTestDrop('rare');
      dbg.spawnTestDrop('common');
    });

    await page.keyboard.down('KeyD');
    await page.waitForFunction(
      () => window.__SUBMUNDO_DEBUG__!.getInventory().bag.length >= 2,
      undefined,
      { timeout: 5000 }
    );
    await page.keyboard.up('KeyD');

    const equipResult = await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      const invBefore = dbg.getInventory();
      const candidate = invBefore.bag[0];
      const ok = dbg.equipItem(candidate.instanceId);
      const invAfter = dbg.getInventory();
      const heroAfter = dbg.getHero();
      return {
        ok,
        candidateId: candidate.instanceId,
        candidateSlot: candidate.slot,
        equippedInSlot: invAfter.equipped[candidate.slot]?.instanceId ?? null,
        bagCount: invAfter.bag.length,
        totalForces:
          heroAfter.equippedForces.inferno +
          heroAfter.equippedForces.submundo +
          heroAfter.equippedForces.empireo,
      };
    });

    expect(equipResult.ok).toBe(true);
    expect(equipResult.equippedInSlot).toBe(equipResult.candidateId);
    expect(equipResult.bagCount).toBeGreaterThanOrEqual(2);

    // 4. Open/close InventoryModal via 'I' key (pauses scene) and via "Bolsa" HUD button
    const dispatchKey = async (key: string, code: string, keyCode: number) => {
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
    };

    await dispatchKey('i', 'KeyI', 73);
    await page.waitForFunction(
      () =>
        (
          window.__SUBMUNDO_DEBUG__!.scene as unknown as {
            inventoryModal: { isOpen: () => boolean };
          }
        ).inventoryModal.isOpen() === true,
      undefined,
      { timeout: 3000 }
    );

    const pauseSnapshotA = await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      const skillResultWhilePaused = dbg.triggerSkill('crimson_cleave');
      return {
        elapsedMs: dbg.getRunState().elapsedMs,
        skillEventsCount: skillResultWhilePaused.length,
      };
    });
    expect(pauseSnapshotA.skillEventsCount).toBe(0);

    await page.waitForTimeout(250);
    const pauseSnapshotB = await page.evaluate(() => {
      return window.__SUBMUNDO_DEBUG__!.getRunState().elapsedMs;
    });
    expect(pauseSnapshotB).toBe(pauseSnapshotA.elapsedMs);

    // Close via 'I'
    await dispatchKey('i', 'KeyI', 73);
    await page.waitForFunction(
      () =>
        (
          window.__SUBMUNDO_DEBUG__!.scene as unknown as {
            inventoryModal: { isOpen: () => boolean };
          }
        ).inventoryModal.isOpen() === false,
      undefined,
      { timeout: 3000 }
    );

    // Open via HUD "Bolsa" button click (x=462, y=26 in 800x600 desktop layout)
    const canvasRect = await page.evaluate(() => {
      const rect = document.querySelector('canvas')?.getBoundingClientRect();
      return rect ? { x: rect.left, y: rect.top } : null;
    });
    expect(canvasRect).toBeTruthy();
    await page.mouse.click(canvasRect!.x + 462, canvasRect!.y + 26);

    await page.waitForFunction(
      () =>
        (
          window.__SUBMUNDO_DEBUG__!.scene as unknown as {
            inventoryModal: { isOpen: () => boolean };
          }
        ).inventoryModal.isOpen() === true,
      undefined,
      { timeout: 3000 }
    );
    await page.waitForTimeout(150);

    // PC Screenshot with InventoryModal open showing equipped gear, forces, stats & bag
    const pcScreenshotPath = resolve(
      process.cwd(),
      'docs/qa/screenshots/m2-pc-800x600.png'
    );
    await page.screenshot({ path: pcScreenshotPath });
    expect(existsSync(pcScreenshotPath)).toBe(true);
    expect(statSync(pcScreenshotPath).size).toBeGreaterThan(5000);

    // Close InventoryModal with Escape
    await dispatchKey('Escape', 'Escape', 27);
    await page.waitForFunction(
      () =>
        (
          window.__SUBMUNDO_DEBUG__!.scene as unknown as {
            inventoryModal: { isOpen: () => boolean };
          }
        ).inventoryModal.isOpen() === false,
      undefined,
      { timeout: 3000 }
    );

    // 5. Victory loot resolution (extractedItems) & Boss rebalance check (maxHp === 280)
    const victoryCheck = await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      for (let step = 1; step <= 4; step++) {
        dbg.forceClearRoom();
        dbg.advanceRoom();
      }
      const boss = dbg.getMonsters().find((m) => m.type === 'boss');
      const bossMaxHp = boss?.maxHp ?? 0;

      dbg.forceClearRoom();
      const run = dbg.getRunState();
      const inv = dbg.getInventory();
      return {
        status: run.status,
        bossMaxHp,
        extractedCount: inv.extractedItems.length,
        lostCount: inv.lostItemsOnDeath.length,
      };
    });

    expect(victoryCheck.bossMaxHp).toBe(280);
    expect(victoryCheck.status).toBe('victory');
    expect(victoryCheck.extractedCount).toBeGreaterThanOrEqual(6);
    expect(victoryCheck.lostCount).toBe(0);

    // 6. Defeat loot resolution (lostItemsOnDeath clears equipped & bag)
    await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      dbg.restartRun();
      const hero = dbg.getHero();
      hero.invulnerableUntilMs = 999999;
      hero.basicAttackReadyAtMs = 999999;
      dbg.spawnTestDrop('legendary');
      dbg.spawnTestDrop('rare');
    });

    await page.keyboard.down('KeyD');
    await page.waitForFunction(
      () => {
        const inv = window.__SUBMUNDO_DEBUG__!.getInventory();
        const equippedCount = Object.values(inv.equipped).filter(Boolean).length;
        return equippedCount + inv.bag.length >= 2;
      },
      undefined,
      { timeout: 5000 }
    );
    await page.keyboard.up('KeyD');

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

    const defeatCheck = await page.evaluate(() => {
      const inv = window.__SUBMUNDO_DEBUG__!.getInventory();
      const equippedCount = Object.values(inv.equipped).filter(Boolean).length;
      return {
        lostCount: inv.lostItemsOnDeath.length,
        extractedCount: inv.extractedItems.length,
        bagCount: inv.bag.length,
        equippedCount,
      };
    });

    expect(defeatCheck.lostCount).toBeGreaterThanOrEqual(2);
    expect(defeatCheck.extractedCount).toBe(0);
    expect(defeatCheck.bagCount).toBe(0);
    expect(defeatCheck.equippedCount).toBe(0);

    // 7. Mobile Portrait (360x640, 9:16): ground drops + HUD + Bolsa button + joystick visible
    await page.setViewportSize({ width: 360, height: 640 });
    await page.evaluate(() => {
      const dbg = window.__SUBMUNDO_DEBUG__!;
      dbg.restartRun();
      dbg.spawnTestDrop('legendary');
      dbg.spawnTestDrop('rare');
    });
    await page.waitForTimeout(250);

    const mobileScreenshotPath = resolve(
      process.cwd(),
      'docs/qa/screenshots/m2-mobile-360x640.png'
    );
    await page.screenshot({ path: mobileScreenshotPath });
    expect(existsSync(mobileScreenshotPath)).toBe(true);
    expect(statSync(mobileScreenshotPath).size).toBeGreaterThan(4000);

    // Test Mobile "Bolsa" HUD button tap (x = 360 - 58 = 302, y = 640 - 222 = 418)
    const mobileCanvasRect = await page.evaluate(() => {
      const rect = document.querySelector('canvas')?.getBoundingClientRect();
      return rect ? { x: rect.left, y: rect.top } : null;
    });
    expect(mobileCanvasRect).toBeTruthy();
    await page.mouse.click(mobileCanvasRect!.x + 302, mobileCanvasRect!.y + 418);
    await page.waitForFunction(
      () =>
        (
          window.__SUBMUNDO_DEBUG__!.scene as unknown as {
            inventoryModal: { isOpen: () => boolean };
          }
        ).inventoryModal.isOpen() === true,
      undefined,
      { timeout: 3000 }
    );
    await dispatchKey('Escape', 'Escape', 27);
    await page.waitForFunction(
      () =>
        (
          window.__SUBMUNDO_DEBUG__!.scene as unknown as {
            inventoryModal: { isOpen: () => boolean };
          }
        ).inventoryModal.isOpen() === false,
      undefined,
      { timeout: 3000 }
    );

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
