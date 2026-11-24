import type { CampaignStageId, SaveProfile } from '../index';
import {
  ensureCampaignProgress,
  getAvailableStages,
  getCampaignCatalog,
} from './CampaignManager';

/** Status de uma dungeon do prólogo na lista aberta pelo portão da vila. */
export type VillageDungeonStatus = 'available' | 'locked' | 'completed';

export interface VillageDungeonEntry {
  stageId: CampaignStageId;
  title: string;
  status: VillageDungeonStatus;
}

/** De onde o herói chega à vila. */
export type VillageArrivalOrigin = 'boot' | 'dungeon_victory' | 'dungeon_defeat';

/** Ponto de surgimento do herói na cena da vila. */
export type VillageSpawnPoint = 'start' | 'gate';

/** NPC que pode receber o "!" de missão na vila. */
export type VillageNpcId = 'master' | 'lyra' | 'gorran';

export interface VillageObjective {
  text: string;
  alertNpcId: VillageNpcId | null;
}

export const VILLAGE_OBJECTIVE_TALK_TO_MASTER = 'Falar com o Mestre';
export const VILLAGE_OBJECTIVE_LEAVE_BY_GATE = 'Saia pelo portão';
export const VILLAGE_OBJECTIVE_PROLOGUE_DONE = 'Prólogo concluído';

function isPrologueComplete(profile: SaveProfile): boolean {
  const campaign = ensureCampaignProgress(profile);
  return getCampaignCatalog()
    .stages.filter((stage) => stage.phase === 'prologue')
    .every((stage) => campaign.completedStages.includes(stage.id));
}

/**
 * Registra que o herói falou com o Mestre de Armas sobre a missão atual.
 * Retorna `true` se o estado mudou (primeira conversa para esta missão).
 */
export function talkToMaster(profile: SaveProfile): boolean {
  const campaign = ensureCampaignProgress(profile);
  if (campaign.masterBriefedStageId === campaign.currentStageId) {
    return false;
  }
  campaign.masterBriefedStageId = campaign.currentStageId;
  return true;
}

/**
 * O portão libera quando o Mestre já falou sobre a missão atual. Como o
 * estado guarda o id da missão, concluir uma fase (que avança
 * `currentStageId`) volta a travar o portão até a próxima conversa.
 */
export function isGateUnlocked(profile: SaveProfile): boolean {
  const campaign = ensureCampaignProgress(profile);
  return campaign.masterBriefedStageId === campaign.currentStageId;
}

/** Fases do prólogo em ordem, com status derivado do progresso da campanha. */
export function getPrologueDungeonList(profile: SaveProfile): VillageDungeonEntry[] {
  const campaign = ensureCampaignProgress(profile);
  const available = new Set(getAvailableStages(profile).map((stage) => stage.id));
  return [...getCampaignCatalog().stages]
    .filter((stage) => stage.phase === 'prologue')
    .sort((a, b) => a.order - b.order)
    .map((stage) => {
      let status: VillageDungeonStatus = 'locked';
      if (campaign.completedStages.includes(stage.id)) {
        status = 'completed';
      } else if (available.has(stage.id)) {
        status = 'available';
      }
      return { stageId: stage.id, title: stage.name, status };
    });
}

/** Onde o herói aparece: no início na primeira chegada, no portão ao voltar da dungeon. */
export function getVillageSpawn(
  _profile: SaveProfile,
  origin: VillageArrivalOrigin
): VillageSpawnPoint {
  return origin === 'boot' ? 'start' : 'gate';
}

/** Texto curto do tracker da vila e qual NPC recebe o "!". */
export function getVillageObjective(profile: SaveProfile): VillageObjective {
  if (isPrologueComplete(profile)) {
    return { text: VILLAGE_OBJECTIVE_PROLOGUE_DONE, alertNpcId: null };
  }
  if (!isGateUnlocked(profile)) {
    return { text: VILLAGE_OBJECTIVE_TALK_TO_MASTER, alertNpcId: 'master' };
  }
  return { text: VILLAGE_OBJECTIVE_LEAVE_BY_GATE, alertNpcId: null };
}
