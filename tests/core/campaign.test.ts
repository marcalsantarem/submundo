import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  advanceToNextRoom,
  createDungeonRun,
  evaluateRoomState,
  getCurrentRoom,
} from '../../src/core/dungeon/DungeonRun';
import { generateDungeonRooms } from '../../src/core/dungeon/DungeonGenerator';
import {
  applyStageOutcomeToCampaign,
  createDefaultCampaignProgress,
  ensureCampaignProgress,
  getAvailableStages,
  getCampaignCatalog,
  getCampaignStage,
  getDialogueLine,
  markDialogueSeen,
  setCampaignStageOrPhase,
} from '../../src/core/progression/CampaignManager';
import { createDefaultProfile } from '../../src/core/progression/ProfileManager';

describe('CampaignManager & Stage-Based Dungeon Generation (T-046)', () => {
  it('enforces zero Phaser imports in CampaignManager.ts', () => {
    const filePath = resolve(process.cwd(), 'src/core/progression/CampaignManager.ts');
    const source = readFileSync(filePath, 'utf-8');
    expect(source).not.toMatch(/phaser/i);
  });

  it('loads campaign catalog, stage definitions, and initializes default campaign progress', () => {
    const catalog = getCampaignCatalog();
    expect(catalog.stages.map((s) => s.id)).toEqual([
      'prologue_grotto',
      'prologue_mine',
      'prologue_seal',
      'act1_submundo',
    ]);

    const seal = getCampaignStage('prologue_seal');
    expect(seal.biome).toBe('ancient_seal');
    expect(seal.bossId).toBe('abyss_herald');
    expect(seal.triggersFallOfVillage).toBe(true);

    const defaults = createDefaultCampaignProgress();
    expect(defaults).toEqual({
      phase: 'prologue',
      currentStageId: 'prologue_grotto',
      completedStages: [],
      seenDialogues: [],
      villageFallTriggered: false,
    });

    const profile = createDefaultProfile();
    delete profile.campaign;
    const ensured = ensureCampaignProgress(profile);
    expect(ensured).toEqual(defaults);
    expect(profile.campaign).toBe(ensured);
  });

  it('progresses sequentially through prologue_grotto -> prologue_mine -> prologue_seal -> Fall of Village -> act1_submundo', () => {
    const profile = createDefaultProfile();

    // Initially only prologue_grotto is available
    expect(getAvailableStages(profile).map((s) => s.id)).toEqual(['prologue_grotto']);

    // Defeat does not unlock next stage or mark completion
    const defeatResult = applyStageOutcomeToCampaign(profile, 'prologue_grotto', false);
    expect(defeatResult.newlyCompleted).toBe(false);
    expect(defeatResult.triggeredVillageFall).toBe(false);
    expect(defeatResult.unlockedStageId).toBeUndefined();
    expect(getAvailableStages(profile).map((s) => s.id)).toEqual(['prologue_grotto']);

    // Victory 1: prologue_grotto -> unlocks prologue_mine
    const grottoWin = applyStageOutcomeToCampaign(profile, 'prologue_grotto', true);
    expect(grottoWin.newlyCompleted).toBe(true);
    expect(grottoWin.unlockedStageId).toBe('prologue_mine');
    expect(grottoWin.triggeredVillageFall).toBe(false);
    expect(profile.campaign?.currentStageId).toBe('prologue_mine');
    expect(getAvailableStages(profile).map((s) => s.id)).toEqual([
      'prologue_grotto',
      'prologue_mine',
    ]);

    // Victory 2: prologue_mine -> unlocks prologue_seal
    const mineWin = applyStageOutcomeToCampaign(profile, 'prologue_mine', true);
    expect(mineWin.newlyCompleted).toBe(true);
    expect(mineWin.unlockedStageId).toBe('prologue_seal');
    expect(mineWin.triggeredVillageFall).toBe(false);
    expect(profile.campaign?.currentStageId).toBe('prologue_seal');
    expect(getAvailableStages(profile).map((s) => s.id)).toEqual([
      'prologue_grotto',
      'prologue_mine',
      'prologue_seal',
    ]);

    // Victory 3: prologue_seal -> triggers Fall of Village and transitions to Act 1
    const sealWin = applyStageOutcomeToCampaign(profile, 'prologue_seal', true);
    expect(sealWin.newlyCompleted).toBe(true);
    expect(sealWin.unlockedStageId).toBe('act1_submundo');
    expect(sealWin.triggeredVillageFall).toBe(true);
    expect(profile.campaign?.phase).toBe('act1');
    expect(profile.campaign?.villageFallTriggered).toBe(true);
    expect(profile.campaign?.currentStageId).toBe('act1_submundo');
    expect(getAvailableStages(profile).map((s) => s.id)).toEqual([
      'prologue_grotto',
      'prologue_mine',
      'prologue_seal',
      'act1_submundo',
    ]);

    // Replaying prologue_seal does not re-trigger Fall of Village or regress phase
    const sealReplay = applyStageOutcomeToCampaign(profile, 'prologue_seal', true);
    expect(sealReplay.newlyCompleted).toBe(false);
    expect(sealReplay.triggeredVillageFall).toBe(false);
    expect(sealReplay.unlockedStageId).toBeUndefined();
    expect(profile.campaign?.phase).toBe('act1');
    expect(profile.campaign?.currentStageId).toBe('act1_submundo');
  });

  it('supports switching stage/phase via setCampaignStageOrPhase', () => {
    const profile = createDefaultProfile();
    setCampaignStageOrPhase(profile, 'act1');
    expect(profile.campaign?.phase).toBe('act1');
    expect(profile.campaign?.currentStageId).toBe('act1_submundo');
    expect(profile.campaign?.villageFallTriggered).toBe(true);
    expect(getAvailableStages(profile).map((s) => s.id)).toContain('act1_submundo');

    setCampaignStageOrPhase(profile, 'prologue', 'prologue_mine');
    expect(profile.campaign?.phase).toBe('prologue');
    expect(profile.campaign?.currentStageId).toBe('prologue_mine');
  });

  it('retrieves dialogue lines with portraitId and tracks seen dialogues idempotently', () => {
    const welcome = getDialogueLine('prologue_welcome');
    expect(welcome).not.toBeNull();
    expect(welcome?.portraitId).toBe('weapon_master');
    expect(welcome?.speaker).toBe('Mestre de Armas');

    const pact = getDialogueLine('village_fall_pact');
    expect(pact).not.toBeNull();
    expect(pact?.portraitId).toBe('emissary');

    expect(getDialogueLine('non_existent_dialogue')).toBeNull();

    const profile = createDefaultProfile();
    expect(markDialogueSeen(profile, 'prologue_welcome')).toBe(true);
    expect(markDialogueSeen(profile, 'prologue_welcome')).toBe(false);
    expect(profile.campaign?.seenDialogues).toEqual(['prologue_welcome']);
  });

  it('generates deterministic stage-specific rooms and DungeonRunState without breaking default runs', () => {
    const grotto = getCampaignStage('prologue_grotto');
    const seal = getCampaignStage('prologue_seal');
    const act1 = getCampaignStage('act1_submundo');

    const grottoRoomsA = generateDungeonRooms(800, 600, 9001, grotto);
    const grottoRoomsB = generateDungeonRooms(800, 600, 9001, grotto);
    const grottoRoomsDiff = generateDungeonRooms(800, 600, 9002, grotto);

    expect(grottoRoomsA).toEqual(grottoRoomsB);
    expect(grottoRoomsA).not.toEqual(grottoRoomsDiff);
    expect(grottoRoomsA).toHaveLength(3);

    for (let i = 0; i < grottoRoomsA.length; i++) {
      const room = grottoRoomsA[i];
      expect(room.roomNumber).toBe(i + 1);
      expect(room.biome).toBe('village_grotto');
      expect(room.difficultyScale).toBe(0.7);
      expect(room.isBossRoom).toBe(i === 2);
      if (!room.isBossRoom) {
        expect(room.spawns.every((s) => grotto.monsterPool.includes(s.defId))).toBe(true);
      } else {
        expect(room.spawns.some((s) => s.defId === grotto.bossId)).toBe(true);
      }
    }

    const sealRun = createDungeonRun(360, 640, 4242, seal);
    expect(sealRun.stageId).toBe('prologue_seal');
    expect(sealRun.biome).toBe('ancient_seal');
    expect(sealRun.totalRooms).toBe(4);
    expect(getCurrentRoom(sealRun).biome).toBe('ancient_seal');

    // Clear all 4 rooms of prologue_seal to reach victory
    for (let i = 0; i < 3; i++) {
      expect(evaluateRoomState(sealRun, 0, true)).toBe('room_cleared');
      expect(advanceToNextRoom(sealRun)?.roomNumber).toBe(i + 2);
    }
    expect(getCurrentRoom(sealRun).isBossRoom).toBe(true);
    expect(getCurrentRoom(sealRun).spawns.some((s) => s.defId === 'abyss_herald')).toBe(true);
    expect(evaluateRoomState(sealRun, 0, true)).toBe('victory');

    const act1Run = createDungeonRun(800, 600, 777, act1);
    expect(act1Run.totalRooms).toBe(5);
    expect(act1Run.biome).toBe('submundo_abyss');
    expect(act1Run.rooms[4].spawns.some((s) => s.defId === 'infernal_warden')).toBe(true);
  });
});
