import campaignJson from '../../data/campaign.json';
import dialoguesJson from '../../data/dialogues.json';
import type {
  CampaignCatalog,
  CampaignPhase,
  CampaignProgress,
  CampaignStageDef,
  CampaignStageId,
  DialogueLine,
  SaveProfile,
} from '../index';

export interface StageOutcomeResult {
  stage: CampaignStageDef;
  unlockedStageId?: CampaignStageId;
  triggeredVillageFall: boolean;
  newlyCompleted: boolean;
}

export function getCampaignCatalog(): CampaignCatalog {
  return campaignJson as CampaignCatalog;
}

export function getCampaignStage(stageId: CampaignStageId): CampaignStageDef {
  const stage = getCampaignCatalog().stages.find((item) => item.id === stageId);
  if (!stage) {
    throw new Error(`Unknown campaign stage: ${stageId}`);
  }
  return stage;
}

export function createDefaultCampaignProgress(): CampaignProgress {
  return {
    phase: 'prologue',
    currentStageId: 'prologue_grotto',
    completedStages: [],
    seenDialogues: [],
    villageFallTriggered: false,
  };
}

export function ensureCampaignProgress(profile: SaveProfile): CampaignProgress {
  if (!profile.campaign) {
    profile.campaign = createDefaultCampaignProgress();
    return profile.campaign;
  }

  if (!Array.isArray(profile.campaign.completedStages)) {
    profile.campaign.completedStages = [];
  }
  if (!Array.isArray(profile.campaign.seenDialogues)) {
    profile.campaign.seenDialogues = [];
  }
  return profile.campaign;
}

export function getAvailableStages(profile: SaveProfile): CampaignStageDef[] {
  const campaign = ensureCampaignProgress(profile);
  const catalog = getCampaignCatalog();
  const stagesByOrder = [...catalog.stages].sort((a, b) => a.order - b.order);
  const stageMap = new Map<CampaignStageId, CampaignStageDef>(
    stagesByOrder.map((stage) => [stage.id, stage])
  );

  const unlocked = new Set<CampaignStageId>(['prologue_grotto']);
  unlocked.add(campaign.currentStageId);

  for (const completedId of campaign.completedStages) {
    unlocked.add(completedId);
    const completedDef = stageMap.get(completedId);
    if (completedDef?.unlocksStageId) {
      unlocked.add(completedDef.unlocksStageId);
    }
  }

  if (campaign.villageFallTriggered || campaign.phase === 'act1') {
    for (const stage of stagesByOrder) {
      if (stage.phase === 'act1') {
        unlocked.add(stage.id);
      }
    }
  }

  return stagesByOrder.filter((stage) => unlocked.has(stage.id));
}

export function getDialogueLine(id: string): DialogueLine | null {
  const entries = dialoguesJson.entries as Record<string, DialogueLine>;
  if (!Object.prototype.hasOwnProperty.call(entries, id)) {
    return null;
  }
  return entries[id] ?? null;
}

export function markDialogueSeen(profile: SaveProfile, id: string): boolean {
  const campaign = ensureCampaignProgress(profile);
  if (!id || campaign.seenDialogues.includes(id)) {
    return false;
  }
  campaign.seenDialogues.push(id);
  return true;
}

export function applyStageOutcomeToCampaign(
  profile: SaveProfile,
  stageId: CampaignStageId,
  victory: boolean
): StageOutcomeResult {
  const campaign = ensureCampaignProgress(profile);
  const stage = getCampaignStage(stageId);

  if (!victory) {
    return {
      stage,
      triggeredVillageFall: false,
      newlyCompleted: false,
    };
  }

  const newlyCompleted = !campaign.completedStages.includes(stageId);
  if (newlyCompleted) {
    campaign.completedStages.push(stageId);
  }

  const unlockedStageId = newlyCompleted ? stage.unlocksStageId : undefined;
  let triggeredVillageFall = false;

  if (stage.triggersFallOfVillage) {
    triggeredVillageFall = !campaign.villageFallTriggered;
    campaign.villageFallTriggered = true;
    campaign.phase = 'act1';
    campaign.currentStageId = stage.unlocksStageId ?? 'act1_submundo';
  } else if (stage.unlocksStageId && (newlyCompleted || campaign.currentStageId === stageId)) {
    const unlockedStage = getCampaignStage(stage.unlocksStageId);
    if (campaign.phase !== 'act1' || unlockedStage.phase === 'act1') {
      campaign.currentStageId = stage.unlocksStageId;
    }
  }

  return {
    stage,
    unlockedStageId,
    triggeredVillageFall,
    newlyCompleted,
  };
}

export function setCampaignStageOrPhase(
  profile: SaveProfile,
  phase: CampaignPhase,
  stageId?: CampaignStageId
): void {
  const campaign = ensureCampaignProgress(profile);
  campaign.phase = phase;

  if (phase === 'act1') {
    campaign.villageFallTriggered = true;
  }

  if (stageId) {
    getCampaignStage(stageId);
    campaign.currentStageId = stageId;
    return;
  }

  if (phase === 'act1') {
    campaign.currentStageId = 'act1_submundo';
  } else {
    const currentDef = getCampaignStage(campaign.currentStageId);
    if (currentDef.phase !== 'prologue') {
      campaign.currentStageId = 'prologue_grotto';
    }
  }
}
