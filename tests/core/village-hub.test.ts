import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getPrologueDungeonList,
  getVillageObjective,
  getVillageSpawn,
  isGateUnlocked,
  talkToMaster,
  talkToNpc,
  type SaveProfile,
} from '../../src/core';
import { applyStageOutcomeToCampaign } from '../../src/core/progression/CampaignManager';
import {
  createDefaultProfile,
  loadOrCreateProfile,
  persistProfile,
} from '../../src/core/progression/ProfileManager';
import { SAVE_STORAGE_KEY, type StorageLike } from '../../src/core/progression/StorageAdapter';

function memoryStorage(initial?: Record<string, string>): StorageLike {
  const store = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

function statuses(profile: SaveProfile): string[] {
  return getPrologueDungeonList(profile).map((entry) => `${entry.stageId}:${entry.status}`);
}

/**
 * VillageHub do M9 virou adaptador da `PrologueQuests` (T-142) até a T-147
 * trocar a UI. Aqui só se garante que os adaptadores refletem o fluxo novo.
 */
describe('VillageHub adapters (T-136 → T-142)', () => {
  it('has zero Phaser imports', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/core/progression/VillageHub.ts'),
      'utf-8'
    );
    expect(source).not.toMatch(/phaser/i);
  });

  it('starts with the Master alert, gate closed and empty list (old save without campaign)', () => {
    const old = createDefaultProfile() as Partial<SaveProfile>;
    delete old.campaign;
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(old) });
    const profile = loadOrCreateProfile(storage);

    expect(isGateUnlocked(profile)).toBe(false);
    expect(getVillageObjective(profile)).toEqual({
      text: 'Falar com o Mestre',
      alertNpcId: 'master',
    });
    expect(statuses(profile)).toEqual([]);
  });

  it('talkToMaster runs the intro once; the gate opens only after accepting a mission', () => {
    const storage = memoryStorage();
    const profile = loadOrCreateProfile(storage);
    expect(talkToMaster(profile)).toBe(true);
    expect(talkToMaster(profile)).toBe(false);
    expect(isGateUnlocked(profile)).toBe(false);
    expect(getVillageObjective(profile).alertNpcId).toBe('lyra');

    talkToNpc(profile, 'gorran');
    persistProfile(profile, storage);
    const reloaded = loadOrCreateProfile(storage);
    expect(isGateUnlocked(reloaded)).toBe(true);
    expect(statuses(reloaded)).toEqual(['mission_mine:available']);
  });

  it('lists only accepted missions and removes them once completed; death keeps the list', () => {
    const profile = createDefaultProfile();
    talkToMaster(profile);
    talkToNpc(profile, 'lyra');
    talkToNpc(profile, 'gorran');
    expect(statuses(profile)).toEqual(['mission_herbs:available', 'mission_mine:available']);
    expect(getPrologueDungeonList(profile).map((e) => e.title)).toEqual([
      'A Plantação de Ervas',
      'A Mina Iluminada',
    ]);

    applyStageOutcomeToCampaign(profile, 'mission_mine', false);
    expect(getVillageSpawn(profile, 'dungeon_defeat')).toBe('gate');
    expect(statuses(profile)).toEqual(['mission_herbs:available', 'mission_mine:available']);

    applyStageOutcomeToCampaign(profile, 'mission_mine', true);
    expect(getVillageSpawn(profile, 'dungeon_victory')).toBe('gate');
    expect(statuses(profile)).toEqual(['mission_herbs:available']);
    expect(getVillageObjective(profile)).toEqual({
      text: 'Volte a Gorran',
      alertNpcId: 'gorran',
    });
  });

  it('spawns at start on first arrival and at the gate when coming back', () => {
    const profile = createDefaultProfile();
    expect(getVillageSpawn(profile, 'boot')).toBe('start');
    expect(getVillageSpawn(profile, 'dungeon_victory')).toBe('gate');
    expect(getVillageSpawn(profile, 'dungeon_defeat')).toBe('gate');
  });
});
