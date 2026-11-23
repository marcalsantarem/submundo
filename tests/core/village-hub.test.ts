import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyStageOutcomeToCampaign } from '../../src/core/progression/CampaignManager';
import { createDefaultProfile } from '../../src/core/progression/ProfileManager';
import {
  PROLOGUE_STAGE_IDS,
  getMasterBriefKey,
  getNextPrologueStageId,
  getPrologueDungeonList,
  hasSpokenToMasterForCurrentMission,
  markSpokenToMaster,
  resolveVillageHubState,
} from '../../src/core/progression/VillageHubManager';

describe('VillageHubManager (T-136)', () => {
  it('enforces zero Phaser imports in VillageHubManager.ts', () => {
    const filePath = resolve(process.cwd(), 'src/core/progression/VillageHubManager.ts');
    const source = readFileSync(filePath, 'utf-8');
    expect(source).not.toMatch(/phaser/i);
  });

  it('locks the gate on a fresh profile until the player speaks with the Weapon Master', () => {
    const profile = createDefaultProfile();
    const state = resolveVillageHubState(profile);

    expect(PROLOGUE_STAGE_IDS).toEqual(['prologue_grotto', 'prologue_mine', 'prologue_seal']);
    expect(state.nextStageId).toBe('prologue_grotto');
    expect(state.masterSpoken).toBe(false);
    expect(state.gateUnlocked).toBe(false);
    expect(state.showMasterExclamation).toBe(true);
    expect(state.trackerText).toBe('Falar com o Mestre');
    expect(state.spawnPoint).toBe('center');

    expect(state.dungeons).toHaveLength(3);
    expect(state.dungeons.map((d) => d.stage.id)).toEqual([
      'prologue_grotto',
      'prologue_mine',
      'prologue_seal',
    ]);

    expect(state.dungeons[0]).toMatchObject({
      status: 'available',
      canEnter: false,
      isNextMission: true,
    });
    expect(state.dungeons[1]).toMatchObject({
      status: 'locked',
      canEnter: false,
      isNextMission: false,
    });
    expect(state.dungeons[2]).toMatchObject({
      status: 'locked',
      canEnter: false,
      isNextMission: false,
    });
  });

  it('unlocks the gate, clears the exclamation mark, and allows entering Grotto after speaking with the Master', () => {
    const profile = createDefaultProfile();

    const speakResult = markSpokenToMaster(profile);
    expect(speakResult).toEqual({
      gateUnlocked: true,
      nextStageId: 'prologue_grotto',
      dialogueId: 'village_master_prologue_grotto',
    });
    expect(profile.campaign?.seenDialogues).toContain(getMasterBriefKey('prologue_grotto'));
    expect(hasSpokenToMasterForCurrentMission(profile)).toBe(true);

    const state = resolveVillageHubState(profile);
    expect(state.masterSpoken).toBe(true);
    expect(state.gateUnlocked).toBe(true);
    expect(state.showMasterExclamation).toBe(false);
    expect(state.trackerText).toBe('Ir ao Portão — A Gruta da Cachoeira');

    expect(state.dungeons[0]).toMatchObject({
      status: 'available',
      canEnter: true,
      isNextMission: true,
    });
    expect(state.dungeons[1]).toMatchObject({
      status: 'locked',
      canEnter: false,
      isNextMission: false,
    });
    expect(state.dungeons[2]).toMatchObject({
      status: 'locked',
      canEnter: false,
      isNextMission: false,
    });

    // Idempotent second call should not duplicate seenDialogues entry
    markSpokenToMaster(profile);
    const occurrences =
      profile.campaign?.seenDialogues.filter((id) => id === getMasterBriefKey('prologue_grotto'))
        .length ?? 0;
    expect(occurrences).toBe(1);
  });

  it('re-enables the Master exclamation for the next mission after completing Grotto and unlocks replay once spoken again', () => {
    const profile = createDefaultProfile();
    markSpokenToMaster(profile);
    applyStageOutcomeToCampaign(profile, 'prologue_grotto', true);

    expect(getNextPrologueStageId(profile)).toBe('prologue_mine');
    expect(hasSpokenToMasterForCurrentMission(profile)).toBe(false);

    const beforeMasterState = resolveVillageHubState(profile, { returnedFromDungeon: true });
    expect(beforeMasterState.spawnPoint).toBe('gate');
    expect(beforeMasterState.nextStageId).toBe('prologue_mine');
    expect(beforeMasterState.masterSpoken).toBe(false);
    expect(beforeMasterState.gateUnlocked).toBe(false);
    expect(beforeMasterState.showMasterExclamation).toBe(true);
    expect(beforeMasterState.trackerText).toBe('Falar com o Mestre');
    expect(beforeMasterState.dungeons[0]).toMatchObject({
      status: 'completed',
      canEnter: false,
      isNextMission: false,
    });
    expect(beforeMasterState.dungeons[1]).toMatchObject({
      status: 'available',
      canEnter: false,
      isNextMission: true,
    });
    expect(beforeMasterState.dungeons[2]).toMatchObject({
      status: 'locked',
      canEnter: false,
      isNextMission: false,
    });

    const speakMine = markSpokenToMaster(profile);
    expect(speakMine).toEqual({
      gateUnlocked: true,
      nextStageId: 'prologue_mine',
      dialogueId: 'village_master_prologue_mine',
    });

    const afterMasterState = resolveVillageHubState(profile);
    expect(afterMasterState.gateUnlocked).toBe(true);
    expect(afterMasterState.showMasterExclamation).toBe(false);
    expect(afterMasterState.trackerText).toBe('Ir ao Portão — A Mina Abandonada');
    expect(afterMasterState.dungeons[0]).toMatchObject({
      status: 'completed',
      canEnter: true,
      isNextMission: false,
    });
    expect(afterMasterState.dungeons[1]).toMatchObject({
      status: 'available',
      canEnter: true,
      isNextMission: true,
    });
    expect(afterMasterState.dungeons[2]).toMatchObject({
      status: 'locked',
      canEnter: false,
      isNextMission: false,
    });
  });

  it('spawns the hero at the gate when returning from a dungeon (defeat or victory)', () => {
    const profile = createDefaultProfile();
    markSpokenToMaster(profile);
    applyStageOutcomeToCampaign(profile, 'prologue_grotto', false);

    const returnedState = resolveVillageHubState(profile, { returnedFromDungeon: true });
    expect(returnedState.spawnPoint).toBe('gate');
    expect(returnedState.gateUnlocked).toBe(true);
    expect(returnedState.dungeons[0]).toMatchObject({
      status: 'available',
      canEnter: true,
      isNextMission: true,
    });

    const defaultState = resolveVillageHubState(profile);
    expect(defaultState.spawnPoint).toBe('center');
  });

  it('handles full prologue completion and legacy saves without campaign field', () => {
    const legacyProfile = createDefaultProfile();
    delete legacyProfile.campaign;

    const initialList = getPrologueDungeonList(legacyProfile);
    expect(initialList.map((d) => d.status)).toEqual(['available', 'locked', 'locked']);
    expect(legacyProfile.campaign).toBeDefined();

    // Progress through all 3 prologue stages
    markSpokenToMaster(legacyProfile);
    applyStageOutcomeToCampaign(legacyProfile, 'prologue_grotto', true);
    markSpokenToMaster(legacyProfile);
    applyStageOutcomeToCampaign(legacyProfile, 'prologue_mine', true);

    const speakSeal = markSpokenToMaster(legacyProfile);
    expect(speakSeal).toEqual({
      gateUnlocked: true,
      nextStageId: 'prologue_seal',
      dialogueId: 'village_master_prologue_seal',
    });

    applyStageOutcomeToCampaign(legacyProfile, 'prologue_seal', true);

    expect(getNextPrologueStageId(legacyProfile)).toBeNull();
    expect(hasSpokenToMasterForCurrentMission(legacyProfile)).toBe(true);

    const idleSpeak = markSpokenToMaster(legacyProfile);
    expect(idleSpeak).toEqual({
      gateUnlocked: true,
      nextStageId: null,
      dialogueId: 'village_master_idle',
    });

    const finalState = resolveVillageHubState(legacyProfile, { returnedFromDungeon: true });
    expect(finalState.nextStageId).toBeNull();
    expect(finalState.masterSpoken).toBe(true);
    expect(finalState.gateUnlocked).toBe(true);
    expect(finalState.showMasterExclamation).toBe(false);
    expect(finalState.spawnPoint).toBe('gate');
    expect(finalState.dungeons.every((d) => d.status === 'completed' && d.canEnter && !d.isNextMission)).toBe(true);
  });
});
