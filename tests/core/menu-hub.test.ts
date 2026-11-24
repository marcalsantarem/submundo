import { describe, expect, it } from 'vitest';
import { MENU_HUB_ITEMS } from '../../src/core';
import type { MenuHubItemId } from '../../src/core';
import {
  createDefaultProfile,
  isMenuItemUnlocked,
  loadOrCreateProfile,
  unlockMenuItem,
} from '../../src/core/progression/ProfileManager';
import {
  SAVE_STORAGE_KEY,
  type StorageLike,
} from '../../src/core/progression/StorageAdapter';

function memStorage(initial?: string): StorageLike {
  const m = new Map<string, string>();
  if (initial) m.set(SAVE_STORAGE_KEY, initial);
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

describe('Menu-hub (Decisão #29)', () => {
  it('mantém a ordem dos botões', () => {
    expect(MENU_HUB_ITEMS.map((i) => i.id)).toEqual([
      'masmorras',
      'inventario',
      'forja',
      'personagem',
      'habilidades',
      'configuracoes',
    ]);
    expect(MENU_HUB_ITEMS.filter((i) => i.unlockedByDefault).map((i) => i.id)).toEqual([
      'masmorras',
      'inventario',
    ]);
  });

  it('perfil novo começa com Masmorras e Inventário', () => {
    const p = createDefaultProfile();
    expect(p.menuUnlocks).toEqual(['masmorras', 'inventario']);
    expect(isMenuItemUnlocked(p, 'masmorras')).toBe(true);
    expect(isMenuItemUnlocked(p, 'forja')).toBe(false);
  });

  it('migra save antigo sem menuUnlocks', () => {
    const old: Record<string, unknown> = { ...createDefaultProfile(), souls: 7 };
    delete old.menuUnlocks;
    const p = loadOrCreateProfile(memStorage(JSON.stringify(old)));
    expect(p.souls).toBe(7);
    expect(p.menuUnlocks).toEqual(['masmorras', 'inventario']);
  });

  it('migração mantém extras válidos, garante padrões e descarta lixo', () => {
    const old = {
      ...createDefaultProfile(),
      menuUnlocks: ['forja', 'invalido', 'forja'],
    };
    const p = loadOrCreateProfile(memStorage(JSON.stringify(old)));
    expect(p.menuUnlocks).toEqual(['masmorras', 'inventario', 'forja']);
  });

  it('unlockMenuItem não duplica', () => {
    const p = createDefaultProfile();
    unlockMenuItem(p, 'forja');
    unlockMenuItem(p, 'forja');
    unlockMenuItem(p, 'masmorras');
    const ids: MenuHubItemId[] = p.menuUnlocks;
    expect(ids).toEqual(['masmorras', 'inventario', 'forja']);
    expect(isMenuItemUnlocked(p, 'forja')).toBe(true);
  });
});
