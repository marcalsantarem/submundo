import type { CampaignStageId, SaveProfile } from '../index';
import {
  QUEST_GIVER_NPC_IDS,
  getGateMissions,
  getQuestMarkers,
  getVillageObjectiveText,
  talkToNpc,
} from './PrologueQuests';

/**
 * Vila Natal (M9). A lógica de missões passou para `PrologueQuests.ts` (T-142);
 * as funções abaixo, exceto `getVillageSpawn`, são adaptadores para a
 * `HubScene`/`GateModal` do M9 até a T-147 trocar a UI.
 */

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

/** NPC que pode receber marcador de missão na vila. */
export type VillageNpcId = 'master' | 'lyra' | 'gorran';

export interface VillageObjective {
  text: string;
  alertNpcId: VillageNpcId | null;
}

export const VILLAGE_OBJECTIVE_TALK_TO_MASTER = 'Falar com o Mestre';
export const VILLAGE_OBJECTIVE_PROLOGUE_DONE = 'Prólogo concluído';

/**
 * @deprecated Use `talkToNpc(profile, 'master')`.
 * Retorna `true` se a conversa mudou o estado (introdução, aceitar ou entregar).
 */
export function talkToMaster(profile: SaveProfile): boolean {
  const outcome = talkToNpc(profile, 'master');
  return outcome.kind === 'intro' || outcome.kind === 'accepted' || outcome.kind === 'turned_in';
}

/** @deprecated Use `getQuestMarkers(profile).gate` ou `getGateMissions(profile)`. */
export function isGateUnlocked(profile: SaveProfile): boolean {
  return getGateMissions(profile).length > 0;
}

/** @deprecated Use `getGateMissions(profile)`. Só missões aceitas e não cumpridas. */
export function getPrologueDungeonList(profile: SaveProfile): VillageDungeonEntry[] {
  return getGateMissions(profile).map((mission) => ({
    stageId: mission.id,
    title: mission.name,
    status: 'available',
  }));
}

/** Onde o herói aparece: no início na primeira chegada, no portão ao voltar da dungeon. */
export function getVillageSpawn(
  _profile: SaveProfile,
  origin: VillageArrivalOrigin
): VillageSpawnPoint {
  return origin === 'boot' ? 'start' : 'gate';
}

/**
 * @deprecated Use `getVillageObjectiveText` e `getQuestMarkers`.
 * `alertNpcId` é o primeiro NPC com "!" ou "?" amarelo.
 */
export function getVillageObjective(profile: SaveProfile): VillageObjective {
  const markers = getQuestMarkers(profile);
  const alertNpcId =
    QUEST_GIVER_NPC_IDS.find(
      (npcId) => markers.npcs[npcId] === '!' || markers.npcs[npcId] === '?yellow'
    ) ?? null;
  return { text: getVillageObjectiveText(profile), alertNpcId };
}
