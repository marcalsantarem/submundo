import type {
  CampaignStageDef,
  CampaignStageId,
  PrologueMissionId,
  PrologueQuestState,
  QuestGiverNpcId,
  SaveProfile,
} from '../index';
import { ensureCampaignProgress, getCampaignCatalog } from './CampaignManager';

/**
 * Fluxo de missões do prólogo (Decisão #24, T-142). Core puro.
 *
 * Mestre ("!") → introdução → "!" em Lyra e Gorran → aceitar ("?" cinza, "!" no
 * portão) → vencer a dungeon ("?" amarelo) → entregar. Com as duas entregues,
 * "!" no Mestre com a missão 3, que encerra o prólogo.
 */

export const PROLOGUE_MISSION_IDS: readonly PrologueMissionId[] = [
  'mission_herbs',
  'mission_mine',
  'mission_depths',
];

export const QUEST_GIVER_NPC_IDS: readonly QuestGiverNpcId[] = ['master', 'lyra', 'gorran'];

export const PROLOGUE_QUEST_STATES: readonly PrologueQuestState[] = [
  'hidden',
  'available',
  'accepted',
  'completed',
  'turned_in',
];

/** Marcador sobre um NPC: "!" amarelo, "?" cinza (em andamento), "?" amarelo (entregar). */
export type NpcQuestMarker = '!' | '?gray' | '?yellow' | null;
export type GateQuestMarker = '!' | null;

export interface QuestMarkers {
  npcs: Record<QuestGiverNpcId, NpcQuestMarker>;
  gate: GateQuestMarker;
}

export type TalkOutcomeKind = 'intro' | 'accepted' | 'in_progress' | 'turned_in' | 'idle';

export interface TalkOutcome {
  kind: TalkOutcomeKind;
  missionId: PrologueMissionId | null;
}

export interface CompleteMissionResult {
  /** `true` se a missão passou de aceita para cumprida. */
  changed: boolean;
  /** `true` se esta conclusão encerrou o prólogo (missão 3). */
  endedPrologue: boolean;
}

export const VILLAGE_TRACKER_TALK_TO_MASTER = 'Falar com o Mestre';
export const VILLAGE_TRACKER_TALK_TO_VILLAGERS = 'Falar com Lyra e Gorran';
export const VILLAGE_TRACKER_PROLOGUE_DONE = 'Prólogo concluído';

export function isPrologueMissionId(value: unknown): value is PrologueMissionId {
  return (
    typeof value === 'string' && (PROLOGUE_MISSION_IDS as readonly string[]).includes(value)
  );
}

export function isPrologueQuestState(value: unknown): value is PrologueQuestState {
  return (
    typeof value === 'string' && (PROLOGUE_QUEST_STATES as readonly string[]).includes(value)
  );
}

/** Definições das missões do prólogo, na ordem do `campaign.json`. */
export function getPrologueMissions(): CampaignStageDef[] {
  return getCampaignCatalog()
    .stages.filter((stage) => isPrologueMissionId(stage.id))
    .sort((a, b) => a.order - b.order);
}

export function getPrologueMission(missionId: PrologueMissionId): CampaignStageDef {
  const mission = getPrologueMissions().find((stage) => stage.id === missionId);
  if (!mission) {
    throw new Error(`Unknown prologue mission: ${missionId}`);
  }
  return mission;
}

function questStore(profile: SaveProfile): Partial<Record<PrologueMissionId, PrologueQuestState>> {
  const campaign = ensureCampaignProgress(profile);
  if (!campaign.prologueQuests || typeof campaign.prologueQuests !== 'object') {
    campaign.prologueQuests = {};
  }
  return campaign.prologueQuests;
}

/**
 * Revela missões cujos requisitos já foram entregues (só depois da introdução
 * do Mestre). Idempotente.
 */
function refreshAvailability(profile: SaveProfile): void {
  const campaign = ensureCampaignProgress(profile);
  const store = questStore(profile);
  for (const mission of getPrologueMissions()) {
    const id = mission.id as PrologueMissionId;
    const current = store[id] ?? 'hidden';
    if (current !== 'hidden' || !campaign.masterIntroDone) {
      store[id] = current;
      continue;
    }
    const ready = (mission.requires ?? []).every((req) => store[req] === 'turned_in');
    store[id] = ready ? 'available' : 'hidden';
  }
}

export function getQuestState(profile: SaveProfile, missionId: PrologueMissionId): PrologueQuestState {
  refreshAvailability(profile);
  return questStore(profile)[missionId] ?? 'hidden';
}

function missionsOf(npcId: QuestGiverNpcId): CampaignStageDef[] {
  return getPrologueMissions().filter((mission) => mission.giverNpcId === npcId);
}

function findMissionInState(
  profile: SaveProfile,
  npcId: QuestGiverNpcId,
  state: PrologueQuestState
): PrologueMissionId | null {
  const store = questStore(profile);
  const found = missionsOf(npcId).find((mission) => store[mission.id as PrologueMissionId] === state);
  return found ? (found.id as PrologueMissionId) : null;
}

function npcMarker(profile: SaveProfile, npcId: QuestGiverNpcId): NpcQuestMarker {
  if (npcId === 'master' && !ensureCampaignProgress(profile).masterIntroDone) {
    return '!';
  }
  if (findMissionInState(profile, npcId, 'completed')) return '?yellow';
  if (findMissionInState(profile, npcId, 'available')) return '!';
  if (findMissionInState(profile, npcId, 'accepted')) return '?gray';
  return null;
}

/** Marcadores sobre os NPCs e o portão. */
export function getQuestMarkers(profile: SaveProfile): QuestMarkers {
  refreshAvailability(profile);
  const npcs = {} as Record<QuestGiverNpcId, NpcQuestMarker>;
  for (const npcId of QUEST_GIVER_NPC_IDS) {
    npcs[npcId] = npcMarker(profile, npcId);
  }
  return { npcs, gate: getGateMissions(profile).length > 0 ? '!' : null };
}

/**
 * Conversa com um NPC e aplica a transição: introdução do Mestre, aceitar,
 * entregar ou só lembrar a missão em andamento.
 */
export function talkToNpc(profile: SaveProfile, npcId: QuestGiverNpcId): TalkOutcome {
  const campaign = ensureCampaignProgress(profile);
  refreshAvailability(profile);
  const store = questStore(profile);

  if (npcId === 'master' && !campaign.masterIntroDone) {
    campaign.masterIntroDone = true;
    refreshAvailability(profile);
    return { kind: 'intro', missionId: null };
  }

  const toTurnIn = findMissionInState(profile, npcId, 'completed');
  if (toTurnIn) {
    store[toTurnIn] = 'turned_in';
    refreshAvailability(profile);
    return { kind: 'turned_in', missionId: toTurnIn };
  }

  const toAccept = findMissionInState(profile, npcId, 'available');
  if (toAccept) {
    store[toAccept] = 'accepted';
    return { kind: 'accepted', missionId: toAccept };
  }

  const inProgress = findMissionInState(profile, npcId, 'accepted');
  if (inProgress) {
    return { kind: 'in_progress', missionId: inProgress };
  }

  return { kind: 'idle', missionId: null };
}

/** Missões listadas no portão: aceitas e ainda não cumpridas, na ordem do catálogo. */
export function getGateMissions(profile: SaveProfile): CampaignStageDef[] {
  refreshAvailability(profile);
  const store = questStore(profile);
  return getPrologueMissions().filter(
    (mission) => store[mission.id as PrologueMissionId] === 'accepted'
  );
}

/**
 * Chamada ao vencer a dungeon de uma missão aceita. Derrota não chama esta
 * função (o estado não muda). A missão com `endsPrologue` vai direto para
 * entregue e leva a campanha ao Ato 1.
 */
export function completeMission(
  profile: SaveProfile,
  missionId: PrologueMissionId
): CompleteMissionResult {
  const campaign = ensureCampaignProgress(profile);
  refreshAvailability(profile);
  const store = questStore(profile);
  if (store[missionId] !== 'accepted') {
    return { changed: false, endedPrologue: false };
  }

  const mission = getPrologueMission(missionId);
  if (!campaign.completedStages.includes(missionId)) {
    campaign.completedStages.push(missionId);
  }

  if (mission.endsPrologue) {
    store[missionId] = 'turned_in';
    campaign.phase = 'act1';
    campaign.villageFallTriggered = true;
    campaign.currentStageId = (mission.unlocksStageId ?? 'act1_submundo') as CampaignStageId;
    return { changed: true, endedPrologue: true };
  }

  store[missionId] = 'completed';
  return { changed: true, endedPrologue: false };
}

/** Prólogo encerrado: missão com `endsPrologue` entregue ou campanha já no Ato 1. */
export function isPrologueFinished(profile: SaveProfile): boolean {
  const campaign = ensureCampaignProgress(profile);
  if (campaign.phase === 'act1') {
    return true;
  }
  const store = questStore(profile);
  return getPrologueMissions().some(
    (mission) => mission.endsPrologue && store[mission.id as PrologueMissionId] === 'turned_in'
  );
}

/** Texto curto do tracker da vila. */
export function getVillageObjectiveText(profile: SaveProfile): string {
  if (isPrologueFinished(profile)) {
    return VILLAGE_TRACKER_PROLOGUE_DONE;
  }
  const campaign = ensureCampaignProgress(profile);
  if (!campaign.masterIntroDone) {
    return VILLAGE_TRACKER_TALK_TO_MASTER;
  }
  const markers = getQuestMarkers(profile);
  const giverName: Record<QuestGiverNpcId, string> = {
    master: 'o Mestre',
    lyra: 'Lyra',
    gorran: 'Gorran',
  };

  const toTurnIn = QUEST_GIVER_NPC_IDS.find((npcId) => markers.npcs[npcId] === '?yellow');
  if (toTurnIn) {
    return `Volte a ${giverName[toTurnIn]}`;
  }
  const gate = getGateMissions(profile);
  if (gate.length > 0) {
    return `Saia pelo portão: ${gate.map((mission) => mission.name).join(' / ')}`;
  }
  const available = QUEST_GIVER_NPC_IDS.filter((npcId) => markers.npcs[npcId] === '!');
  if (available.length === 2 && available.includes('lyra') && available.includes('gorran')) {
    return VILLAGE_TRACKER_TALK_TO_VILLAGERS;
  }
  if (available.length > 0) {
    return `Falar com ${available.map((npcId) => giverName[npcId]).join(' e ')}`;
  }
  return VILLAGE_TRACKER_TALK_TO_MASTER;
}
