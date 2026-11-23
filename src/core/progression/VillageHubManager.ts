import type { CampaignStageDef, CampaignStageId, SaveProfile } from '../index';
import {
  ensureCampaignProgress,
  getAvailableStages,
  getCampaignStage,
  markDialogueSeen,
} from './CampaignManager';

export type VillageNpcId = 'weapon_master' | 'lyra' | 'gorran';
export type VillageDungeonStatus = 'available' | 'locked' | 'completed';
export type VillageReturnSpawn = 'center' | 'gate';

export const PROLOGUE_STAGE_IDS: readonly CampaignStageId[] = [
  'prologue_grotto',
  'prologue_mine',
  'prologue_seal',
];

export interface VillageDungeonEntry {
  stage: CampaignStageDef;
  status: VillageDungeonStatus;
  canEnter: boolean;
  isNextMission: boolean;
}

export interface VillageHubState {
  nextStageId: CampaignStageId | null;
  masterSpoken: boolean;
  gateUnlocked: boolean;
  showMasterExclamation: boolean;
  trackerText: string;
  dungeons: VillageDungeonEntry[];
  spawnPoint: VillageReturnSpawn;
}

export interface MasterSpeakResult {
  gateUnlocked: boolean;
  nextStageId: CampaignStageId | null;
  dialogueId: string;
}

const MASTER_DIALOGUE_BY_STAGE: Partial<Record<CampaignStageId, string>> = {
  prologue_grotto: 'village_master_prologue_grotto',
  prologue_mine: 'village_master_prologue_mine',
  prologue_seal: 'village_master_prologue_seal',
};

export function getMasterBriefKey(stageId: CampaignStageId): string {
  return `village_master_brief_${stageId}`;
}

export function getNextPrologueStageId(profile: SaveProfile): CampaignStageId | null {
  const campaign = ensureCampaignProgress(profile);
  for (const stageId of PROLOGUE_STAGE_IDS) {
    if (!campaign.completedStages.includes(stageId)) {
      return stageId;
    }
  }
  return null;
}

export function hasSpokenToMasterForCurrentMission(profile: SaveProfile): boolean {
  const campaign = ensureCampaignProgress(profile);
  const nextStageId = getNextPrologueStageId(profile);
  if (nextStageId === null) {
    return true;
  }
  return campaign.seenDialogues.includes(getMasterBriefKey(nextStageId));
}

export function markSpokenToMaster(profile: SaveProfile): MasterSpeakResult {
  ensureCampaignProgress(profile);
  const nextStageId = getNextPrologueStageId(profile);

  if (nextStageId === null) {
    return {
      gateUnlocked: true,
      nextStageId: null,
      dialogueId: 'village_master_idle',
    };
  }

  markDialogueSeen(profile, getMasterBriefKey(nextStageId));
  const dialogueId = MASTER_DIALOGUE_BY_STAGE[nextStageId] ?? 'village_master_idle';

  return {
    gateUnlocked: true,
    nextStageId,
    dialogueId,
  };
}

export function getPrologueDungeonList(profile: SaveProfile): VillageDungeonEntry[] {
  const campaign = ensureCampaignProgress(profile);
  const availableIds = new Set<CampaignStageId>(
    getAvailableStages(profile).map((stage) => stage.id)
  );
  const nextStageId = getNextPrologueStageId(profile);
  const gateUnlocked = hasSpokenToMasterForCurrentMission(profile);

  return PROLOGUE_STAGE_IDS.map((stageId) => {
    const stage = getCampaignStage(stageId);
    let status: VillageDungeonStatus;

    if (campaign.completedStages.includes(stageId)) {
      status = 'completed';
    } else if (availableIds.has(stageId)) {
      status = 'available';
    } else {
      status = 'locked';
    }

    return {
      stage,
      status,
      canEnter: status !== 'locked' && gateUnlocked,
      isNextMission: stageId === nextStageId,
    };
  });
}

export function resolveVillageHubState(
  profile: SaveProfile,
  options?: { returnedFromDungeon?: boolean }
): VillageHubState {
  ensureCampaignProgress(profile);
  const nextStageId = getNextPrologueStageId(profile);
  const masterSpoken = hasSpokenToMasterForCurrentMission(profile);
  const gateUnlocked = masterSpoken;
  const showMasterExclamation = !masterSpoken && nextStageId !== null;

  let trackerText: string;
  if (!masterSpoken && nextStageId !== null) {
    trackerText = 'Falar com o Mestre';
  } else if (nextStageId !== null) {
    const nextStage = getCampaignStage(nextStageId);
    trackerText = `Ir ao Portão — ${nextStage.name}`;
  } else {
    trackerText = 'Ir ao Portão — Prólogo Concluído';
  }

  const dungeons = getPrologueDungeonList(profile);
  const spawnPoint: VillageReturnSpawn = options?.returnedFromDungeon ? 'gate' : 'center';

  return {
    nextStageId,
    masterSpoken,
    gateUnlocked,
    showMasterExclamation,
    trackerText,
    dungeons,
    spawnPoint,
  };
}
