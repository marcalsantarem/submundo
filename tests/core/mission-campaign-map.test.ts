import { describe, expect, it } from 'vitest';
import campaignJson from '../../src/data/campaign.json';
import { generateDungeonRooms } from '../../src/core/dungeon/DungeonGenerator';
import { generateDungeonMap } from '../../src/core/dungeon/DungeonMap';
import {
  missionMapInputFromStage,
  missionMapOptions,
  missionObjectiveLabel,
  type MissionStageLike,
} from '../../src/core/dungeon/MissionObjectives';
import type { CampaignStageDef } from '../../src/core/index';

// T-129 / BRF-159: the prologue campaign runs on the continuous map built from campaign.json.
const stages = campaignJson.stages as unknown as CampaignStageDef[];
const stage = (id: string) => stages.find((s) => s.id === id)!;
const SEEDS = [3, 71, 9001, 123457];

describe('Missões do prólogo no mapa contínuo (T-129)', () => {
  it('campaign.json: 10 ervas e 6 ferramentas', () => {
    expect(stage('mission_herbs').objective?.count).toBe(10);
    expect(stage('mission_mine').objective?.count).toBe(6);
  });

  it('Ervas: sala gigante, 3 zonas com 3/5/7 slimes, sem chefe, 10 ervas', () => {
    const input = missionMapInputFromStage(stage('mission_herbs') as MissionStageLike)!;
    for (const seed of SEEDS) {
      const map = generateDungeonMap(seed, missionMapOptions(input));
      expect(map.mode).toBe('giant');
      expect(map.zones.map((z) => z.spawns.length)).toEqual([3, 5, 7]);
      expect(map.zones.some((z) => z.isBossZone)).toBe(false);
      expect(map.collectibles.filter((c) => c.itemId === 'herb')).toHaveLength(10);
      expect(map.eventPoint).toBeUndefined();
    }
  });

  it('Mina: 4 salas, Chefe da Matilha na sala 4, 6 ferramentas e o "algo estranho"', () => {
    const input = missionMapInputFromStage(stage('mission_mine') as MissionStageLike)!;
    for (const seed of SEEDS) {
      const map = generateDungeonMap(seed, missionMapOptions(input));
      expect(map.mode).toBe('rooms');
      expect(map.zones).toHaveLength(4);
      const last = map.zones[3];
      expect(last.isBossZone).toBe(true);
      expect(last.spawns.filter((s) => s.defId === 'wolf_alpha')).toHaveLength(1);
      expect(map.collectibles).toHaveLength(6);
      expect(map.eventPoint).toBeDefined();
    }
  });

  it('Fundo da Mina: 5 salas, Karnak sozinho na sala 5, sem coleta', () => {
    const input = missionMapInputFromStage(stage('mission_depths') as MissionStageLike)!;
    for (const seed of SEEDS) {
      const map = generateDungeonMap(seed, missionMapOptions(input));
      expect(map.zones).toHaveLength(5);
      expect(map.zones[4].isBossZone).toBe(true);
      expect(map.zones[4].spawns.map((s) => s.defId)).toEqual(['karnak']);
      expect(map.collectibles).toHaveLength(0);
    }
  });

  it('Ato 1 não é missão no mapa; o gerador antigo aceita fase sem chefe', () => {
    expect(missionMapInputFromStage(stage('act1_submundo') as MissionStageLike)).toBeNull();
    const rooms = generateDungeonRooms(960, 540, 7, stage('mission_herbs'));
    expect(rooms[rooms.length - 1].spawns.every((s) => typeof s.defId === 'string')).toBe(true);
  });

  it('rótulos do contador do HUD', () => {
    expect(missionObjectiveLabel('herb')).toEqual({ label: 'Ervas', icon: 'herb' });
    expect(missionObjectiveLabel('mine_tool')).toEqual({ label: 'Ferramentas', icon: 'tools' });
  });
});
