/**
 * T-143 / BRF-156 — Objetivos menores das missões do prólogo e regra de "missão cumprida" (TS puro, sem Phaser).
 *
 * Regra (Decisão #24): missão cumprida = TODAS as zonas limpas E objetivo de coleta cumprido (se houver)
 * E ponto de evento visitado (se houver). Ex.: Ervas = 3 zonas + ervas; Mina = 4 salas + ferramentas +
 * "algo estranho"; Fundo da Mina = 5 salas (o Karnak é invencível: a missão 3 termina na morte do herói, T-146).
 *
 * ----------------------------------------------------------------------------------------------------
 * Calibragem ~3 min (estimateMissionSeconds; os números saem de `src/data/monsters.json` e do herói base):
 *   - Herói: 140 px/s, ataque 18 a cada 650 ms. Golpes p/ matar = ceil(maxHp / max(1, 18 - defesa)).
 *     Slime 3 golpes (2,0 s), Lobo 5 (3,3 s), Morcego 2 (1,3 s), Esqueleto 7 (4,6 s), Chefe da Matilha 14 (9,1 s).
 *   - Combate de uma onda = soma(golpes x 0,65 s + 1,5 s de aproximação/esquiva por monstro) + 4 s de onda
 *     (faixa, entrada e o tempo de sala limpa). Chefe: x1,5 (esquivas). Karnak (invencível): 30 s fixos.
 *   - Caminhada = rota BFS (grade de 16 px) início -> zonas em ordem, com cada coletável inserido no ponto
 *     mais barato da rota, -> ponto de evento; dividida por 140 px/s e x1,3 (desvios de monstros e props).
 *     +0,5 s por coletável (parar e pegar).
 *   - Resultado (média de 40 seeds com as opções de `MISSION_MAP_DEFAULTS`, ver o teste):
 *       Ervas (giant x1,2 = 72-84 x 48-55 tiles, 3 zonas, 15 slimes, 10 ervas): 64 s combate + 111 s caminhada = ~175 s.
 *       Mina (rooms, 4 salas, 1-2 passagens, 10 slimes + 9 lobos + alfa, 6 ferramentas, evento): 109 s + 92 s = ~201 s.
 *       Fundo da Mina (rooms, 5 salas, 1 passagem, 6 slimes + 14 morcegos + 2 esqueletos + Karnak 30 s): 122 s + 67 s = ~189 s.
 *     Faixa por seed: 158-191 s / 188-214 s / 168-199 s (log `[mission-time]` do teste
 *     `tests/core/mission-objectives.test.ts`, que exige média entre 150 e 210 s).
 *   Alavancas: nº de coletáveis, `giantScale` (sala gigante) e `passageRooms` (salas de passagem).
 * ----------------------------------------------------------------------------------------------------
 */
import monstersJson from '../../data/monsters.json';
import { DEFAULT_HERO_STATS } from '../entities/Hero';
import {
  mapDistanceField,
  mapPathLength,
  MAP_FEET_OFFSET,
  type DungeonMap,
  type DungeonMapMode,
  type DungeonMapOptions,
  type MapRect,
} from './DungeonMap';

// ---------------------------------------------------------------------------------------------------
// Objetivo de coleta
// ---------------------------------------------------------------------------------------------------

export interface MissionObjectiveDef { kind: 'collect'; itemId: string; count: number }

export interface MissionObjectiveState {
  kind: 'collect';
  itemId: string;
  count: number;
  collected: number;
  collectedIds: number[]; // ids de `DungeonMap.collectibles` já pegos
}

export function createObjectiveState(def: MissionObjectiveDef): MissionObjectiveState {
  return { kind: 'collect', itemId: def.itemId, count: Math.max(0, Math.floor(def.count)), collected: 0, collectedIds: [] };
}

/** Marca o coletável `id` como pego (muta o estado). Retorna true só na primeira vez (ignora repetidos). */
export function collectAt(state: MissionObjectiveState, id: number): boolean {
  if (state.collectedIds.includes(id)) return false;
  state.collectedIds.push(id);
  state.collected = Math.min(state.count, state.collected + 1);
  return true;
}

export function isObjectiveDone(state: MissionObjectiveState | null | undefined): boolean {
  return !state || state.collected >= state.count;
}

/** Texto curto do HUD, ex.: "Ervas 3/8". */
export function objectiveProgressText(state: MissionObjectiveState, label: string): string {
  return `${label} ${state.collected}/${state.count}`;
}

/** Raio (px) entre os pés do herói e o coletável/ponto de evento para contar como pego/visitado. */
export const MISSION_PICKUP_RADIUS = 36;
export const MISSION_EVENT_RADIUS = 56;

/** Coletável ainda não pego ao alcance dos pés do herói (ou null). */
export function findCollectibleAt(map: DungeonMap, state: MissionObjectiveState, feetX: number, feetY: number, radius = MISSION_PICKUP_RADIUS): number | null {
  for (const c of map.collectibles) {
    if (state.collectedIds.includes(c.id)) continue;
    if (Math.hypot(c.x - feetX, c.y - feetY) <= radius) return c.id;
  }
  return null;
}

export function isAtEventPoint(map: DungeonMap, feetX: number, feetY: number, radius = MISSION_EVENT_RADIUS): boolean {
  return !!map.eventPoint && Math.hypot(map.eventPoint.x - feetX, map.eventPoint.y - feetY) <= radius;
}

// ---------------------------------------------------------------------------------------------------
// Progresso da missão e regra de cumprimento
// ---------------------------------------------------------------------------------------------------

export interface MissionProgress {
  zonesCleared: boolean[];
  objective: MissionObjectiveState | null;
  eventRequired: boolean;
  eventVisited: boolean;
}

export function createMissionProgress(map: DungeonMap, objective?: MissionObjectiveDef | null): MissionProgress {
  return {
    zonesCleared: map.zones.map(() => false),
    objective: objective && objective.count > 0 ? createObjectiveState(objective) : null,
    eventRequired: !!map.eventPoint,
    eventVisited: false,
  };
}

export function markZoneCleared(p: MissionProgress, zoneId: number): void {
  if (zoneId >= 0 && zoneId < p.zonesCleared.length) p.zonesCleared[zoneId] = true;
}

export function markEventVisited(p: MissionProgress): void {
  p.eventVisited = true;
}

/** Missão cumprida = todas as zonas limpas E objetivo cumprido (se houver) E evento visitado (se houver). */
export function isMissionComplete(p: MissionProgress): boolean {
  return p.zonesCleared.every(Boolean) && isObjectiveDone(p.objective) && (!p.eventRequired || p.eventVisited);
}

// ---------------------------------------------------------------------------------------------------
// Opções de mapa a partir da missão (os valores vêm do campaign.json, recebidos por parâmetro)
// ---------------------------------------------------------------------------------------------------

/** Subconjunto da missão do `campaign.json` (T-142) usado para montar o mapa. */
export interface MissionMapInput {
  mapMode: DungeonMapMode;
  waves: string[][];          // por sala/zona, um id por monstro (ex.: ['slime','slime','slime'])
  bossId?: string | null;
  objective?: MissionObjectiveDef | null;
  eventPoint?: boolean;       // Mina: "algo estranho" no fim
  passageRooms?: [number, number]; // modo rooms: salas de passagem entre salas de combate (padrão [1, 2])
  giantScale?: number;             // modo giant: escala da sala gigante (padrão 1)
}

export function missionMapOptions(m: MissionMapInput): DungeonMapOptions {
  const n = m.waves.length;
  const bossId = m.bossId || undefined;
  return {
    mode: m.mapMode,
    waves: m.waves,
    exactCounts: true,
    ...(m.mapMode === 'rooms' ? { roomCount: n } : { zoneCount: n }),
    bossRoom: !!bossId,
    ...(bossId ? { bossId } : {}),
    ...(m.objective && m.objective.count > 0 ? { collectibles: { itemId: m.objective.itemId, count: m.objective.count } } : {}),
    ...(m.eventPoint ? { eventPoint: true } : {}),
    ...(m.passageRooms ? { passageRooms: m.passageRooms } : {}),
    ...(m.giantScale ? { giantScale: m.giantScale } : {}),
  };
}

const rep = (id: string, n: number) => Array.from({ length: n }, () => id);
const mix = (cols: Record<string, number[]>, n: number) =>
  Array.from({ length: n }, (_, i) => Object.entries(cols).flatMap(([id, c]) => rep(id, c[i] ?? 0)));

/**
 * Referência da Decisão #24 (calibrada para ~3 min). O `campaign.json` (AG04) é a fonte de verdade;
 * isto serve para os testes e como sugestão do nº de coletáveis (8 ervas, 6 ferramentas).
 */
export const MISSION_MAP_DEFAULTS: Record<'mission_herbs' | 'mission_mine' | 'mission_depths', MissionMapInput> = {
  mission_herbs: { mapMode: 'giant', waves: mix({ slime: [3, 5, 7] }, 3), objective: { kind: 'collect', itemId: 'herb', count: 10 }, giantScale: 1.2 },
  mission_mine: {
    mapMode: 'rooms', waves: mix({ slime: [2, 3, 5, 0], wolf: [2, 2, 3, 2] }, 4), bossId: 'wolf_alpha',
    objective: { kind: 'collect', itemId: 'gorran_tool', count: 6 }, eventPoint: true,
  },
  mission_depths: {
    mapMode: 'rooms', waves: mix({ slime: [2, 2, 2, 0, 0], cave_bat: [2, 4, 4, 4, 0], skeleton: [0, 0, 0, 2, 0] }, 5), bossId: 'karnak',
    passageRooms: [1, 1],
  },
};

// ---------------------------------------------------------------------------------------------------
// Estimativa de duração (ver a conta no topo)
// ---------------------------------------------------------------------------------------------------

export const MISSION_TARGET_SECONDS = 180;
const ENGAGE_S = 1.5, WAVE_S = 4, BOSS_FACTOR = 1.5, INVINCIBLE_BOSS_S = 30, DETOUR = 1.3, PICKUP_S = 0.5;

interface MonsterRow { id: string; maxHp: number; defense: number; type?: string }
const MONSTERS = new Map((monstersJson as MonsterRow[]).map((m) => [m.id, m]));

export function monsterKillSeconds(defId: string): number {
  const m = MONSTERS.get(defId);
  if (!m) return 3;
  if (m.defense >= DEFAULT_HERO_STATS.attack * 10) return INVINCIBLE_BOSS_S; // Karnak
  const hits = Math.ceil(m.maxHp / Math.max(1, DEFAULT_HERO_STATS.attack - m.defense));
  const t = hits * (DEFAULT_HERO_STATS.attackCooldownMs / 1000) + ENGAGE_S;
  return m.type === 'boss' ? t * BOSS_FACTOR : t;
}

export interface MissionEstimate { combatS: number; walkS: number; totalS: number; walkPx: number }

const rectCenter = (r: MapRect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export function estimateMissionSeconds(map: DungeonMap): MissionEstimate {
  let combatS = 0;
  for (const z of map.zones) {
    if (!z.spawns.length) continue;
    combatS += WAVE_S + z.spawns.reduce((a, s) => a + monsterKillSeconds(s.defId), 0);
  }
  // Pontos da rota (pés): início, alvo de cada zona (centro do maior gatilho), coletáveis, evento.
  const start = { x: map.heroStart.x, y: map.heroStart.y + MAP_FEET_OFFSET };
  const zonePts = map.zones.map((z) => {
    const big = z.trigger.slice().sort((a, b) => b.w * b.h - a.w * a.h)[0];
    return rectCenter(big);
  });
  const fields = new Map<string, ReturnType<typeof mapDistanceField>>();
  const field = (p: { x: number; y: number }) => {
    const k = `${p.x},${p.y}`;
    let f = fields.get(k);
    if (!f) { f = mapDistanceField(map, p.x, p.y); fields.set(k, f); }
    return f;
  };
  const near = (f: ReturnType<typeof mapDistanceField>, p: { x: number; y: number }) => {
    // O centro do gatilho pode cair num prop: usa o nó alcançável mais próximo (até 64 px).
    for (let r = 0; r <= 64; r += 16) {
      for (let dy = -r; dy <= r; dy += 16) for (let dx = -r; dx <= r; dx += 16) {
        const d = mapPathLength(f, p.x + dx, p.y + dy);
        if (d >= 0) return d;
      }
    }
    return 0;
  };
  const leg = (a: { x: number; y: number }, b: { x: number; y: number }) => near(field(a), b);
  const route: { x: number; y: number }[] = [start, ...zonePts];
  if (map.eventPoint) route.push(map.eventPoint);
  for (const c of map.collectibles) {
    let best = 1, bestCost = Infinity;
    for (let i = 1; i <= route.length; i++) {
      const prev = route[i - 1], next = route[i];
      const cost = leg(prev, c) + (next ? leg(c, next) - leg(prev, next) : 0);
      if (cost < bestCost) { bestCost = cost; best = i; }
    }
    route.splice(best, 0, c);
  }
  let walkPx = 0;
  for (let i = 1; i < route.length; i++) walkPx += leg(route[i - 1], route[i]);
  const walkS = (walkPx / DEFAULT_HERO_STATS.moveSpeed) * DETOUR + map.collectibles.length * PICKUP_S;
  return { combatS, walkS, totalS: combatS + walkS, walkPx };
}
