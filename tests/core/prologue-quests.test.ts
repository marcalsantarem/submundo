import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  completeMission,
  getGateMissions,
  getQuestMarkers,
  getQuestState,
  getVillageObjectiveText,
  isPrologueFinished,
  talkToNpc,
  type PrologueMissionId,
  type SaveProfile,
} from '../../src/core';
import {
  applyStageOutcomeToCampaign,
  getAvailableStages,
} from '../../src/core/progression/CampaignManager';
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

function markers(profile: SaveProfile) {
  const m = getQuestMarkers(profile);
  return { ...m.npcs, gate: m.gate };
}

function gate(profile: SaveProfile): string[] {
  return getGateMissions(profile).map((mission) => mission.id);
}

function reload(profile: SaveProfile): SaveProfile {
  const storage = memoryStorage();
  persistProfile(profile, storage);
  return loadOrCreateProfile(storage);
}

/** Lyra (ervas) e Gorran (mina) em ordem configurável até a entrega das duas. */
function runVillagerMissions(
  profile: SaveProfile,
  order: Array<{ npc: 'lyra' | 'gorran'; mission: PrologueMissionId }>
): void {
  for (const { npc, mission } of order) {
    expect(talkToNpc(profile, npc)).toEqual({ kind: 'accepted', missionId: mission });
  }
  for (const { npc, mission } of order) {
    expect(completeMission(profile, mission)).toEqual({ changed: true, endedPrologue: false });
    expect(getQuestMarkers(profile).npcs[npc]).toBe('?yellow');
    expect(talkToNpc(profile, npc)).toEqual({ kind: 'turned_in', missionId: mission });
    expect(getQuestMarkers(profile).npcs[npc]).toBeNull();
  }
}

describe('PrologueQuests (T-142, Decisão #24)', () => {
  it('has zero Phaser imports', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/core/progression/PrologueQuests.ts'),
      'utf-8'
    );
    expect(source).not.toMatch(/phaser/i);
  });

  it('runs the whole prologue with the right markers at each step', () => {
    let profile = createDefaultProfile();

    // 1. Início: só o Mestre tem "!".
    expect(markers(profile)).toEqual({ master: '!', lyra: null, gorran: null, gate: null });
    expect(getVillageObjectiveText(profile)).toBe('Falar com o Mestre');
    expect(gate(profile)).toEqual([]);
    expect(talkToNpc(profile, 'lyra')).toEqual({ kind: 'idle', missionId: null });

    // Introdução do Mestre: "!" passa para Lyra e Gorran.
    expect(talkToNpc(profile, 'master')).toEqual({ kind: 'intro', missionId: null });
    expect(markers(profile)).toEqual({ master: null, lyra: '!', gorran: '!', gate: null });
    expect(getVillageObjectiveText(profile)).toBe('Falar com Lyra e Gorran');
    expect(talkToNpc(profile, 'master')).toEqual({ kind: 'idle', missionId: null });
    profile = reload(profile);

    // 2. Aceitar a missão da Lyra: "?" cinza e "!" no portão.
    expect(talkToNpc(profile, 'lyra')).toEqual({ kind: 'accepted', missionId: 'mission_herbs' });
    expect(markers(profile)).toEqual({ master: null, lyra: '?gray', gorran: '!', gate: '!' });
    expect(gate(profile)).toEqual(['mission_herbs']);
    expect(getVillageObjectiveText(profile)).toBe('Saia pelo portão: A Plantação de Ervas');
    expect(talkToNpc(profile, 'lyra')).toEqual({ kind: 'in_progress', missionId: 'mission_herbs' });

    expect(talkToNpc(profile, 'gorran')).toEqual({ kind: 'accepted', missionId: 'mission_mine' });
    expect(markers(profile)).toEqual({ master: null, lyra: '?gray', gorran: '?gray', gate: '!' });
    expect(gate(profile)).toEqual(['mission_herbs', 'mission_mine']);
    profile = reload(profile);

    // 4. Vencer: "?" amarelo no NPC, sai do portão.
    expect(applyStageOutcomeToCampaign(profile, 'mission_mine', true).newlyCompleted).toBe(true);
    expect(markers(profile)).toEqual({ master: null, lyra: '?gray', gorran: '?yellow', gate: '!' });
    expect(gate(profile)).toEqual(['mission_herbs']);
    expect(getVillageObjectiveText(profile)).toBe('Volte a Gorran');
    expect(talkToNpc(profile, 'gorran')).toEqual({ kind: 'turned_in', missionId: 'mission_mine' });
    expect(markers(profile)).toEqual({ master: null, lyra: '?gray', gorran: null, gate: '!' });

    applyStageOutcomeToCampaign(profile, 'mission_herbs', true);
    expect(markers(profile)).toEqual({ master: null, lyra: '?yellow', gorran: null, gate: null });
    expect(gate(profile)).toEqual([]);
    expect(getQuestState(profile, 'mission_depths')).toBe('hidden');
    expect(talkToNpc(profile, 'lyra')).toEqual({ kind: 'turned_in', missionId: 'mission_herbs' });

    // 5. Com 1 e 2 entregues: "!" no Mestre com a missão 3.
    expect(markers(profile)).toEqual({ master: '!', lyra: null, gorran: null, gate: null });
    expect(getVillageObjectiveText(profile)).toBe('Falar com o Mestre');
    profile = reload(profile);
    expect(talkToNpc(profile, 'master')).toEqual({ kind: 'accepted', missionId: 'mission_depths' });
    expect(markers(profile)).toEqual({ master: '?gray', lyra: null, gorran: null, gate: '!' });
    expect(gate(profile)).toEqual(['mission_depths']);
    expect(isPrologueFinished(profile)).toBe(false);

    // Missão 3 encerra o prólogo.
    expect(completeMission(profile, 'mission_depths')).toEqual({ changed: true, endedPrologue: true });
    expect(getQuestState(profile, 'mission_depths')).toBe('turned_in');
    expect(isPrologueFinished(profile)).toBe(true);
    expect(profile.campaign?.phase).toBe('act1');
    expect(profile.campaign?.currentStageId).toBe('act1_submundo');
    expect(getVillageObjectiveText(profile)).toBe('Prólogo concluído');
    expect(markers(profile)).toEqual({ master: null, lyra: null, gorran: null, gate: null });
    expect(getAvailableStages(profile).map((s) => s.id)).toEqual(['act1_submundo']);
  });

  it('accepts and delivers missions 1 and 2 in either order', () => {
    const orders = [
      [
        { npc: 'lyra', mission: 'mission_herbs' },
        { npc: 'gorran', mission: 'mission_mine' },
      ],
      [
        { npc: 'gorran', mission: 'mission_mine' },
        { npc: 'lyra', mission: 'mission_herbs' },
      ],
    ] as const;
    for (const order of orders) {
      const profile = createDefaultProfile();
      talkToNpc(profile, 'master');
      runVillagerMissions(profile, [...order]);
      expect(getQuestState(profile, 'mission_depths')).toBe('available');
      expect(getQuestMarkers(profile).npcs.master).toBe('!');
    }
  });

  it('keeps mission 3 hidden while only one villager mission is delivered', () => {
    const profile = createDefaultProfile();
    talkToNpc(profile, 'master');
    runVillagerMissions(profile, [{ npc: 'lyra', mission: 'mission_herbs' }]);
    expect(getQuestState(profile, 'mission_depths')).toBe('hidden');
    expect(markers(profile)).toEqual({ master: null, lyra: null, gorran: '!', gate: null });
    expect(getVillageObjectiveText(profile)).toBe('Falar com Gorran');
  });

  it('defeat does not change any state', () => {
    const profile = createDefaultProfile();
    talkToNpc(profile, 'master');
    talkToNpc(profile, 'lyra');
    const before = JSON.stringify(profile.campaign);
    const result = applyStageOutcomeToCampaign(profile, 'mission_herbs', false);
    expect(result).toMatchObject({ newlyCompleted: false, triggeredVillageFall: false });
    expect(JSON.stringify(profile.campaign)).toBe(before);
    expect(gate(profile)).toEqual(['mission_herbs']);
  });

  it('does not repeat delivered missions nor complete missions that were not accepted', () => {
    const profile = createDefaultProfile();
    expect(completeMission(profile, 'mission_herbs')).toEqual({ changed: false, endedPrologue: false });
    talkToNpc(profile, 'master');
    expect(completeMission(profile, 'mission_herbs')).toEqual({ changed: false, endedPrologue: false });
    expect(completeMission(profile, 'mission_depths')).toEqual({ changed: false, endedPrologue: false });

    runVillagerMissions(profile, [{ npc: 'lyra', mission: 'mission_herbs' }]);
    expect(completeMission(profile, 'mission_herbs')).toEqual({ changed: false, endedPrologue: false });
    expect(talkToNpc(profile, 'lyra')).toEqual({ kind: 'idle', missionId: null });
    expect(getQuestState(profile, 'mission_herbs')).toBe('turned_in');
    expect(gate(profile)).toEqual([]);
  });

  it('migrates an old M9 save in the prologue to the new flow from scratch', () => {
    const old = createDefaultProfile() as unknown as Record<string, unknown>;
    old.campaign = {
      phase: 'prologue',
      currentStageId: 'prologue_mine',
      completedStages: ['prologue_grotto'],
      seenDialogues: ['prologue_welcome'],
      villageFallTriggered: false,
      masterBriefedStageId: 'prologue_mine',
    };
    const profile = loadOrCreateProfile(
      memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(old) })
    );
    expect(profile.campaign).toEqual({
      phase: 'prologue',
      currentStageId: 'mission_herbs',
      completedStages: [],
      seenDialogues: ['prologue_welcome'],
      villageFallTriggered: false,
    });
    expect(markers(profile)).toEqual({ master: '!', lyra: null, gorran: null, gate: null });
  });

  it('keeps an old save already in Act 1 in Act 1', () => {
    const old = createDefaultProfile() as unknown as Record<string, unknown>;
    old.campaign = {
      phase: 'act1',
      currentStageId: 'act1_submundo',
      completedStages: ['prologue_grotto', 'prologue_mine', 'prologue_seal'],
      seenDialogues: [],
      villageFallTriggered: true,
    };
    const profile = loadOrCreateProfile(
      memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(old) })
    );
    expect(profile.campaign?.phase).toBe('act1');
    expect(profile.campaign?.currentStageId).toBe('act1_submundo');
    expect(profile.campaign?.completedStages).toEqual([]);
    expect(isPrologueFinished(profile)).toBe(true);
    expect(getAvailableStages(profile).map((s) => s.id)).toEqual(['act1_submundo']);
  });

  it('drops invalid quest entries when loading a save', () => {
    const raw = createDefaultProfile() as unknown as Record<string, unknown>;
    raw.campaign = {
      phase: 'prologue',
      currentStageId: 'mission_herbs',
      completedStages: [],
      seenDialogues: [],
      villageFallTriggered: false,
      masterIntroDone: true,
      prologueQuests: { mission_herbs: 'accepted', mission_mine: 'bogus', other: 'accepted' },
    };
    const profile = loadOrCreateProfile(
      memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(raw) })
    );
    expect(profile.campaign?.prologueQuests).toEqual({ mission_herbs: 'accepted' });
    expect(markers(profile)).toEqual({ master: null, lyra: '?gray', gorran: '!', gate: '!' });
  });
});
