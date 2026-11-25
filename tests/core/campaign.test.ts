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
import { talkToNpc } from '../../src/core/progression/PrologueQuests';

describe('CampaignManager & Stage-Based Dungeon Generation (T-046)', () => {
  it('enforces zero Phaser imports in CampaignManager.ts', () => {
    const filePath = resolve(process.cwd(), 'src/core/progression/CampaignManager.ts');
    const source = readFileSync(filePath, 'utf-8');
    expect(source).not.toMatch(/phaser/i);
  });

  it('loads campaign catalog with the 3 prologue missions and initializes default campaign progress', () => {
    const catalog = getCampaignCatalog();
    expect(catalog.stages.map((s) => s.id)).toEqual([
      'mission_herbs',
      'mission_mine',
      'mission_depths',
      'act1_submundo',
    ]);

    const herbs = getCampaignStage('mission_herbs');
    expect(herbs).toMatchObject({
      giverNpcId: 'lyra',
      biome: 'herb_field',
      mapMode: 'giant',
      totalRooms: 3,
      objective: { kind: 'collect', itemId: 'herb' },
      dropPolicy: { maxRarity: 'magic' },
    });
    expect(herbs.bossId).toBeUndefined();
    expect(herbs.waves?.map((w) => w.length)).toEqual([3, 5, 7]);

    const mine = getCampaignStage('mission_mine');
    expect(mine).toMatchObject({
      giverNpcId: 'gorran',
      biome: 'village_mine',
      mapMode: 'rooms',
      totalRooms: 4,
      bossId: 'wolf_alpha',
      finalEventId: 'strange_sight',
      objective: { kind: 'collect', itemId: 'mine_tool' },
    });
    const count = (wave: string[], id: string) => wave.filter((m) => m === id).length;
    expect(mine.waves?.map((w) => count(w, 'slime'))).toEqual([2, 3, 5, 0]);
    expect(mine.waves?.map((w) => count(w, 'wolf'))).toEqual([2, 2, 3, 2]);

    const depths = getCampaignStage('mission_depths');
    expect(depths).toMatchObject({
      giverNpcId: 'master',
      requires: ['mission_herbs', 'mission_mine'],
      biome: 'mine_depths',
      mapMode: 'rooms',
      totalRooms: 5,
      bossId: 'karnak',
      bossInvincible: true,
      endsPrologue: true,
    });
    expect(depths.objective).toBeUndefined();
    expect(depths.waves?.map((w) => count(w, 'slime'))).toEqual([2, 2, 2, 0, 0]);
    expect(depths.waves?.map((w) => count(w, 'cave_bat'))).toEqual([2, 4, 4, 4, 0]);
    expect(depths.waves?.map((w) => count(w, 'skeleton'))).toEqual([0, 0, 0, 2, 0]);

    for (const mission of catalog.stages.filter((s) => s.phase === 'prologue')) {
      expect(mission.waves).toHaveLength(mission.totalRooms);
      expect(mission.dropPolicy?.maxRarity).toBe('magic');
    }

    const defaults = createDefaultCampaignProgress();
    expect(defaults).toEqual({
      phase: 'prologue',
      currentStageId: 'mission_herbs',
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

  it('only offers accepted prologue missions and reaches act1 after mission_depths', () => {
    const profile = createDefaultProfile();
    expect(getAvailableStages(profile)).toEqual([]);

    talkToNpc(profile, 'master');
    talkToNpc(profile, 'lyra');
    expect(getAvailableStages(profile).map((s) => s.id)).toEqual(['mission_herbs']);

    const defeat = applyStageOutcomeToCampaign(profile, 'mission_herbs', false);
    expect(defeat).toMatchObject({ newlyCompleted: false, triggeredVillageFall: false });
    expect(getAvailableStages(profile).map((s) => s.id)).toEqual(['mission_herbs']);

    const win = applyStageOutcomeToCampaign(profile, 'mission_herbs', true);
    expect(win).toMatchObject({ newlyCompleted: true, triggeredVillageFall: false });
    expect(win.unlockedStageId).toBeUndefined();
    expect(getAvailableStages(profile)).toEqual([]);
    expect(applyStageOutcomeToCampaign(profile, 'mission_herbs', true).newlyCompleted).toBe(false);

    talkToNpc(profile, 'lyra');
    talkToNpc(profile, 'gorran');
    applyStageOutcomeToCampaign(profile, 'mission_mine', true);
    talkToNpc(profile, 'gorran');
    talkToNpc(profile, 'master');
    expect(getAvailableStages(profile).map((s) => s.id)).toEqual(['mission_depths']);

    const end = applyStageOutcomeToCampaign(profile, 'mission_depths', true);
    expect(end).toMatchObject({
      newlyCompleted: true,
      triggeredVillageFall: true,
      unlockedStageId: 'act1_submundo',
    });
    expect(profile.campaign?.phase).toBe('act1');
    expect(profile.campaign?.currentStageId).toBe('act1_submundo');
    expect(getAvailableStages(profile).map((s) => s.id)).toEqual(['act1_submundo']);

    const replay = applyStageOutcomeToCampaign(profile, 'mission_depths', true);
    expect(replay).toMatchObject({ newlyCompleted: false, triggeredVillageFall: false });
    expect(profile.campaign?.phase).toBe('act1');
  });

  it('supports switching stage/phase via setCampaignStageOrPhase', () => {
    const profile = createDefaultProfile();
    setCampaignStageOrPhase(profile, 'act1');
    expect(profile.campaign?.phase).toBe('act1');
    expect(profile.campaign?.currentStageId).toBe('act1_submundo');
    expect(profile.campaign?.villageFallTriggered).toBe(true);
    expect(getAvailableStages(profile).map((s) => s.id)).toContain('act1_submundo');

    setCampaignStageOrPhase(profile, 'prologue', 'mission_mine');
    expect(profile.campaign?.phase).toBe('prologue');
    expect(profile.campaign?.currentStageId).toBe('mission_mine');
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
    const mine = getCampaignStage('mission_mine');
    const act1 = getCampaignStage('act1_submundo');

    const roomsA = generateDungeonRooms(800, 600, 9001, mine);
    const roomsB = generateDungeonRooms(800, 600, 9001, mine);
    const roomsDiff = generateDungeonRooms(800, 600, 9002, mine);
    expect(roomsA).toEqual(roomsB);
    expect(roomsA).not.toEqual(roomsDiff);
    expect(roomsA).toHaveLength(4);
    expect(roomsA.every((room) => room.biome === 'village_mine')).toBe(true);
    expect(roomsA[3].isBossRoom).toBe(true);
    expect(roomsA[3].spawns.some((s) => s.defId === 'wolf_alpha')).toBe(true);

    const mineRun = createDungeonRun(360, 640, 4242, mine);
    expect(mineRun.stageId).toBe('mission_mine');
    expect(mineRun.totalRooms).toBe(4);
    for (let i = 0; i < 3; i++) {
      expect(evaluateRoomState(mineRun, 0, true)).toBe('room_cleared');
      expect(advanceToNextRoom(mineRun)?.roomNumber).toBe(i + 2);
    }
    expect(getCurrentRoom(mineRun).isBossRoom).toBe(true);
    expect(evaluateRoomState(mineRun, 0, true)).toBe('victory');

    const act1Run = createDungeonRun(800, 600, 777, act1);
    expect(act1Run.totalRooms).toBe(5);
    expect(act1Run.biome).toBe('submundo_abyss');
    expect(act1Run.rooms[4].spawns.some((s) => s.defId === 'infernal_warden')).toBe(true);
  });
});
