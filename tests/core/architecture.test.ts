import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  resolveViewportConfig,
  type AffixDef,
  type EquipSlot,
  type EquippedGear,
  type ItemDef,
  type ItemInstance,
  type LegendaryPowerDef,
  type LegendaryPowerId,
  type Rarity,
  type StatBonus,
  type StatusEffectType,
} from '../../src/core';
import { GAME_VERSION } from '../../src/version';

describe('Architecture & Viewport Contracts (T-001)', () => {
  it('exports GAME_VERSION as 0.7.0', () => {
    expect(GAME_VERSION).toBe('0.7.0');
  });

  it('always resolves exclusive landscape viewport (960x540, 16:9) for landscape windows with isPortraitWindow false', () => {
    expect(resolveViewportConfig(1920, 1080)).toEqual({
      mode: 'landscape',
      width: 960,
      height: 540,
      aspectRatio: '16:9',
      isPortraitWindow: false,
    });

    expect(resolveViewportConfig(960, 540)).toEqual({
      mode: 'landscape',
      width: 960,
      height: 540,
      aspectRatio: '16:9',
      isPortraitWindow: false,
    });

    expect(resolveViewportConfig(844, 390)).toEqual({
      mode: 'landscape',
      width: 960,
      height: 540,
      aspectRatio: '16:9',
      isPortraitWindow: false,
    });
  });

  it('always resolves exclusive landscape viewport (960x540, 16:9) for portrait windows with isPortraitWindow true', () => {
    expect(resolveViewportConfig(360, 640)).toEqual({
      mode: 'landscape',
      width: 960,
      height: 540,
      aspectRatio: '16:9',
      isPortraitWindow: true,
    });

    expect(resolveViewportConfig(390, 844)).toEqual({
      mode: 'landscape',
      width: 960,
      height: 540,
      aspectRatio: '16:9',
      isPortraitWindow: true,
    });
  });

  it('includes #rotate-overlay in index.html and landscape orientation in public/manifest.webmanifest', () => {
    const htmlPath = resolve(process.cwd(), 'index.html');
    const html = readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('id="rotate-overlay"');
    expect(html).toContain('id="rotate-dismiss-btn"');
    expect(html).toContain('@media (orientation: portrait) and (pointer: coarse)');

    const manifestPath = resolve(process.cwd(), 'public/manifest.webmanifest');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { orientation?: string };
    expect(manifest.orientation).toBe('landscape');
  });

  it('guarantees src/core/index.ts is 100% pure TypeScript and does not import phaser', () => {
    const coreIndexPath = resolve(process.cwd(), 'src/core/index.ts');
    const content = readFileSync(coreIndexPath, 'utf-8');
    expect(content.toLowerCase()).not.toContain('phaser');
  });

  it('enables multi-touch (activePointers >= 4) in createGameConfig and touch-action CSS in index.html (T-023)', () => {
    const mainPath = resolve(process.cwd(), 'src/main.ts');
    const mainContent = readFileSync(mainPath, 'utf-8');
    const match = mainContent.match(/createGameConfig[\s\S]*?input:\s*\{[\s\S]*?activePointers:\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(4);

    const htmlPath = resolve(process.cwd(), 'index.html');
    const html = readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('touch-action: none');
    expect(html).toContain('user-select: none');
    expect(html).toContain('-webkit-user-select: none');
    expect(html).toContain('-webkit-touch-callout: none');
  });

  it('provides pure M2 equipment and synergy type contracts in src/core/index.ts (T-013)', () => {
    const slots: EquipSlot[] = [
      'weapon',
      'armor',
      'helm',
      'boots',
      'amulet',
      'ring',
    ];
    const rarities: Rarity[] = ['common', 'magic', 'rare', 'legendary'];
    const statuses: StatusEffectType[] = ['ember', 'bleed', 'judgment'];
    const powerIds: LegendaryPowerId[] = [
      'inferno_dash_trail',
      'submundo_bleed_minion',
      'empireo_crit_lightning',
      'inferno_ember_nova',
      'submundo_crimson_pact',
      'empireo_judgment_haste',
    ];

    const bonus: StatBonus = {
      attack: 12,
      critChance: 0.1,
      luck: 5,
    };
    const affix: AffixDef = {
      id: 'af_ember',
      name: 'da Brasa',
      force: 'inferno',
      allowedSlots: ['weapon'],
      minRarity: 'magic',
      bonuses: bonus,
      description: '+12 ATQ',
    };
    const legendaryPower: LegendaryPowerDef = {
      id: powerIds[0],
      name: 'Rastro de Cinzas',
      force: 'inferno',
      description: 'Dash deixa rastro de fogo',
    };
    const def: ItemDef = {
      id: 'wpn_blade',
      name: 'Lamina Espectral',
      slot: 'weapon',
      force: 'inferno',
      baseBonuses: bonus,
      iconKey: 'icon_wpn_blade',
      description: 'Espada inicial',
    };
    const instance: ItemInstance = {
      instanceId: 'inst_1',
      defId: def.id,
      name: def.name,
      slot: def.slot,
      rarity: 'legendary',
      force: def.force,
      baseBonuses: def.baseBonuses,
      affixes: [affix],
      legendaryPower,
      iconKey: def.iconKey,
      powerScore: 100,
    };
    const gear: EquippedGear = {
      weapon: instance,
      armor: null,
      helm: null,
      boots: null,
      amulet: null,
      ring: null,
    };

    expect(slots).toHaveLength(6);
    expect(rarities).toHaveLength(4);
    expect(statuses).toHaveLength(3);
    expect(powerIds).toHaveLength(6);
    expect(gear.weapon?.legendaryPower?.id).toBe('inferno_dash_trail');
  });

  it('configures iOS/PWA meta tags and links in index.html and registers ./sw.js on load in src/main.ts (T-028)', () => {
    const htmlPath = resolve(process.cwd(), 'index.html');
    const html = readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain('<meta name="theme-color" content="#09090b" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="SUBMUNDO" />');
    expect(html).toContain('<link rel="manifest" href="./manifest.webmanifest" />');
    expect(html).toContain('<link rel="apple-touch-icon" sizes="180x180" href="./icons/apple-touch-icon.png" />');
    expect(html).toContain('<link rel="icon" type="image/png" sizes="192x192" href="./icons/icon-192.png" />');

    const mainPath = resolve(process.cwd(), 'src/main.ts');
    const mainContent = readFileSync(mainPath, 'utf-8');
    expect(mainContent).toContain("'serviceWorker' in navigator");
    expect(mainContent).toContain("addEventListener('load'");
    expect(mainContent).toContain("navigator.serviceWorker.register('./sw.js')");
    expect(mainContent).toContain('.catch(');
  });
});

