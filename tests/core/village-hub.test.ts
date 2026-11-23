import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getPrologueDungeonList,
  getVillageObjective,
  getVillageSpawn,
  isGateUnlocked,
  talkToMaster,
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

describe('VillageHub (T-136)', () => {
  it('has zero Phaser imports', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/core/progression/VillageHub.ts'),
      'utf-8'
    );
    expect(source).not.toMatch(/phaser/i);
  });

  it('handles an old save without campaign nor briefing field', () => {
    const old = createDefaultProfile() as Partial<SaveProfile>;
    delete old.campaign;
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(old) });
    const profile = loadOrCreateProfile(storage);

    expect(isGateUnlocked(profile)).toBe(false);
    expect(getVillageObjective(profile)).toEqual({
      text: 'Falar com o Mestre',
      alertNpcId: 'master',
    });
    expect(statuses(profile)).toEqual([
      'prologue_grotto:available',
      'prologue_mine:locked',
      'prologue_seal:locked',
    ]);
  });

  it('handles an old campaign object without the briefing field', () => {
    const profile = createDefaultProfile();
    profile.campaign = {
      phase: 'prologue',
      currentStageId: 'prologue_mine',
      completedStages: ['prologue_grotto'],
      seenDialogues: [],
      villageFallTriggered: false,
    };
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(profile) });
    const loaded = loadOrCreateProfile(storage);
    expect(loaded.campaign?.masterBriefedStageId).toBeUndefined();
    expect(isGateUnlocked(loaded)).toBe(false);
  });

  it('persists the briefing field across save/load', () => {
    const storage = memoryStorage();
    const profile = loadOrCreateProfile(storage);
    talkToMaster(profile);
    persistProfile(profile, storage);
    const reloaded = loadOrCreateProfile(storage);
    expect(reloaded.campaign?.masterBriefedStageId).toBe('prologue_grotto');
    expect(isGateUnlocked(reloaded)).toBe(true);
  });

  it('talking to the Master unlocks the gate and is idempotent', () => {
    const profile = createDefaultProfile();
    expect(talkToMaster(profile)).toBe(true);
    expect(talkToMaster(profile)).toBe(false);
    expect(isGateUnlocked(profile)).toBe(true);
    expect(getVillageObjective(profile)).toEqual({
      text: 'Saia pelo portão',
      alertNpcId: null,
    });
  });

  it('runs the Gruta → Mina → Selo sequence, re-locking the gate after each victory', () => {
    const profile = createDefaultProfile();
    const order = ['prologue_grotto', 'prologue_mine', 'prologue_seal'] as const;

    for (const [index, stageId] of order.entries()) {
      expect(isGateUnlocked(profile)).toBe(false);
      expect(getVillageObjective(profile).alertNpcId).toBe('master');
      talkToMaster(profile);
      expect(isGateUnlocked(profile)).toBe(true);

      const list = getPrologueDungeonList(profile);
      expect(list.map((entry) => entry.stageId)).toEqual([...order]);
      expect(list[index].status).toBe('available');
      list.slice(0, index).forEach((entry) => expect(entry.status).toBe('completed'));
      list.slice(index + 1).forEach((entry) => expect(entry.status).toBe('locked'));

      applyStageOutcomeToCampaign(profile, stageId, true);
      expect(getVillageSpawn(profile, 'dungeon_victory')).toBe('gate');
    }

    expect(statuses(profile)).toEqual([
      'prologue_grotto:completed',
      'prologue_mine:completed',
      'prologue_seal:completed',
    ]);
    expect(getVillageObjective(profile)).toEqual({
      text: 'Prólogo concluído',
      alertNpcId: null,
    });
  });

  it('keeps the gate unlocked and the list unchanged after a death', () => {
    const profile = createDefaultProfile();
    talkToMaster(profile);
    applyStageOutcomeToCampaign(profile, 'prologue_grotto', false);

    expect(getVillageSpawn(profile, 'dungeon_defeat')).toBe('gate');
    expect(isGateUnlocked(profile)).toBe(true);
    expect(getVillageObjective(profile).text).toBe('Saia pelo portão');
    expect(statuses(profile)).toEqual([
      'prologue_grotto:available',
      'prologue_mine:locked',
      'prologue_seal:locked',
    ]);
  });

  it('exposes Gruta/Mina/Selo titles from campaign.json', () => {
    const titles = getPrologueDungeonList(createDefaultProfile()).map((entry) => entry.title);
    expect(titles).toEqual(['A Gruta da Cachoeira', 'A Mina Abandonada', 'O Selo Antigo']);
  });

  it('spawns at start on first arrival and at the gate when coming back', () => {
    const profile = createDefaultProfile();
    expect(getVillageSpawn(profile, 'boot')).toBe('start');
    expect(getVillageSpawn(profile, 'dungeon_victory')).toBe('gate');
    expect(getVillageSpawn(profile, 'dungeon_defeat')).toBe('gate');
  });
});
