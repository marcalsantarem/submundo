import { describe, expect, it } from 'vitest';
import {
  generateDungeonMap,
  MAP_CELL_VOID,
  MAP_FEET_OFFSET,
  MAP_TILE,
  type DungeonMap,
  type MapRect,
} from '../../src/core/dungeon/DungeonMap';
import {
  collectAt,
  createMissionProgress,
  createObjectiveState,
  estimateMissionSeconds,
  findCollectibleAt,
  isAtEventPoint,
  isMissionComplete,
  isObjectiveDone,
  markEventVisited,
  markZoneCleared,
  missionMapOptions,
  MISSION_MAP_DEFAULTS,
  objectiveProgressText,
} from '../../src/core/dungeon/MissionObjectives';

const T = MAP_TILE;
const G = 16;
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 104729 + 17);
const M = MISSION_MAP_DEFAULTS;
const herbs = SEEDS.map((s) => generateDungeonMap(s, missionMapOptions(M.mission_herbs)));
const mine = SEEDS.map((s) => generateDungeonMap(s, missionMapOptions(M.mission_mine)));
const depths = SEEDS.map((s) => generateDungeonMap(s, missionMapOptions(M.mission_depths)));

// Independent BFS on the hero's feet (same feet box as the generator test).
const inside = (x: number, y: number, r: MapRect) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
function reach(m: DungeonMap): (x: number, y: number) => boolean {
  const nx = m.cols * 2 + 1, ny = m.rows * 2 + 1;
  const floor = (x: number, y: number) => {
    const c = Math.floor(x / T), r = Math.floor(y / T);
    return c >= 0 && r >= 0 && c < m.cols && r < m.rows && m.cells[r * m.cols + c] !== MAP_CELL_VOID;
  };
  const ok = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = i * G, y = j * G;
    ok[j * nx + i] = floor(x - 14, y - 8) && floor(x + 14, y - 8) && floor(x - 14, y + 6) && floor(x + 14, y + 6) &&
      !m.obstacles.some((o) => inside(x, y, o)) ? 1 : 0;
  }
  const seen = new Uint8Array(nx * ny);
  const s0 = Math.round((m.heroStart.y + MAP_FEET_OFFSET) / G) * nx + Math.round(m.heroStart.x / G);
  const q = ok[s0] ? [s0] : [];
  if (q.length) seen[s0] = 1;
  for (let h = 0; h < q.length; h++) {
    const k = q[h], i = k % nx, j = (k / nx) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = i + dx, y = j + dy;
      if (x < 0 || y < 0 || x >= nx || y >= ny) continue;
      const n = y * nx + x;
      if (ok[n] && !seen[n]) { seen[n] = 1; q.push(n); }
    }
  }
  return (x, y) => {
    const i = Math.round(x / G), j = Math.round(y / G);
    return i >= 0 && j >= 0 && i < nx && j < ny && seen[j * nx + i] === 1;
  };
}
const countOf = (m: DungeonMap, zone: number, id: string) => m.zones[zone].spawns.filter((s) => s.defId === id).length;
function checkCollectibles(m: DungeonMap, count: number): void {
  const at = reach(m);
  expect(m.collectibles).toHaveLength(count);
  m.collectibles.forEach((c, i) => {
    expect(c.id).toBe(i);
    expect(at(c.x, c.y)).toBe(true);
    expect(m.obstacles.some((o) => inside(c.x, c.y, o))).toBe(false);
    for (const d of m.collectibles.slice(i + 1)) expect(Math.hypot(c.x - d.x, c.y - d.y)).toBeGreaterThanOrEqual(48);
  });
}

describe('Mapas das missões do prólogo (T-143)', () => {
  it('testArena intacta: sem opções novas não há coletáveis nem ponto de evento', () => {
    for (const mode of ['rooms', 'giant'] as const) {
      const m = generateDungeonMap(101, { mode });
      expect(m.collectibles).toEqual([]);
      expect(m.eventPoint).toBeUndefined();
      expect(m.zones).toHaveLength(3);
      expect(m.zones[2].isBossZone).toBe(true);
    }
  });

  it('Plantação de Ervas: sala gigante, 3 zonas de slimes 3/5/7, sem chefe, ervas em zonas diferentes', () => {
    for (const m of herbs) {
      expect(m.mode).toBe('giant');
      expect(m.rooms).toHaveLength(1);
      expect(m.zones.map((z, i) => countOf(m, i, 'slime'))).toEqual([3, 5, 7]);
      expect(m.zones.every((z) => z.spawns.length === countOf(m, z.id, 'slime'))).toBe(true);
      expect(m.zones.some((z) => z.isBossZone)).toBe(false);
      checkCollectibles(m, 10);
      expect(m.collectibles.every((c) => c.itemId === 'herb')).toBe(true);
      expect(new Set(m.collectibles.map((c) => c.zoneId)).size).toBe(3);
      expect(m.eventPoint).toBeUndefined();
    }
  });

  it('Mina Iluminada: 4 salas com corredores, ondas exatas, Chefe da Matilha na sala 4, ferramentas e evento', () => {
    let withPassage = 0;
    for (const m of mine) {
      expect(m.mode).toBe('rooms');
      expect(m.zones).toHaveLength(4);
      expect(m.corridors.length).toBeGreaterThanOrEqual(3);
      expect(m.zones.map((_, i) => countOf(m, i, 'slime'))).toEqual([2, 3, 5, 0]);
      expect(m.zones.map((_, i) => countOf(m, i, 'wolf'))).toEqual([2, 2, 3, 2]);
      expect(m.zones.map((_, i) => countOf(m, i, 'wolf_alpha'))).toEqual([0, 0, 0, 1]);
      expect(m.zones.map((z) => z.isBossZone)).toEqual([false, false, false, true]);
      checkCollectibles(m, 6);
      const bossRoom = m.zones[3].floorRoomId;
      expect(m.collectibles.some((c) => c.roomId === bossRoom)).toBe(false);
      expect(new Set(m.collectibles.map((c) => c.roomId)).size).toBeGreaterThanOrEqual(3);
      if (m.collectibles.some((c) => c.zoneId === null)) withPassage++;
      const ev = m.eventPoint!;
      expect(ev).toBeDefined();
      expect(reach(m)(ev.x, ev.y)).toBe(true);
      expect(ev.roomId).toBe(bossRoom);
      expect(ev.zoneId).toBe(3);
    }
    expect(withPassage).toBeGreaterThanOrEqual(Math.floor(SEEDS.length * 0.9)); // ferramentas também nas salas de passagem
  });

  it('Fundo da Mina: 5 salas, slimes/morcegos/esqueletos exatos, Karnak na sala 5, sem objetivo menor', () => {
    for (const m of depths) {
      expect(m.mode).toBe('rooms');
      expect(m.zones).toHaveLength(5);
      expect(m.zones.map((_, i) => countOf(m, i, 'slime'))).toEqual([2, 2, 2, 0, 0]);
      expect(m.zones.map((_, i) => countOf(m, i, 'cave_bat'))).toEqual([2, 4, 4, 4, 0]);
      expect(m.zones.map((_, i) => countOf(m, i, 'skeleton'))).toEqual([0, 0, 0, 2, 0]);
      expect(m.zones[4].spawns.map((s) => s.defId)).toEqual(['karnak']);
      expect(m.zones[4].isBossZone).toBe(true);
      expect(m.collectibles).toEqual([]);
      expect(m.eventPoint).toBeUndefined();
      // A câmara do chefe é a maior sala.
      const area = (id: number) => m.roomIdAt.filter((v) => v === id).length;
      const bossArea = area(m.zones[4].floorRoomId as number);
      expect(m.rooms.every((r) => area(r.id) <= bossArea)).toBe(true);
    }
  });

  it('roomCount/zoneCount/bossRoom/eventPoint funcionam sem as ondas exatas', () => {
    const r = generateDungeonMap(7, { mode: 'rooms', roomCount: 5, bossRoom: false, eventPoint: true });
    expect(r.zones).toHaveLength(5);
    expect(r.zones.some((z) => z.isBossZone)).toBe(false);
    expect(r.zones[3].spawns).toEqual([]); // ondas faltantes = salas vazias
    expect(r.eventPoint?.roomId).toBe(r.zones[4].floorRoomId);
    const g = generateDungeonMap(7, { mode: 'giant', zoneCount: 2, collectibles: { itemId: 'x', count: 4 } });
    expect(g.zones).toHaveLength(2);
    checkCollectibles(g, 4);
    expect(generateDungeonMap(7, missionMapOptions(M.mission_mine))).toEqual(generateDungeonMap(7, missionMapOptions(M.mission_mine)));
  });

  it('regra de cumprimento: zonas limpas E objetivo E evento', () => {
    const m = mine[0];
    const p = createMissionProgress(m, M.mission_mine.objective);
    m.zones.forEach((z) => markZoneCleared(p, z.id));
    expect(isMissionComplete(p)).toBe(false); // falta objetivo e evento
    const o = p.objective!;
    const c0 = m.collectibles[0];
    expect(findCollectibleAt(m, o, c0.x + 10, c0.y)).toBe(0);
    expect(collectAt(o, 0)).toBe(true);
    expect(collectAt(o, 0)).toBe(false); // repetido não conta
    expect(findCollectibleAt(m, o, c0.x, c0.y)).toBeNull();
    m.collectibles.slice(1).forEach((c) => collectAt(o, c.id));
    expect(isObjectiveDone(o)).toBe(true);
    expect(objectiveProgressText(o, 'Ferramentas')).toBe('Ferramentas 6/6');
    expect(isMissionComplete(p)).toBe(false); // falta o evento
    expect(isAtEventPoint(m, m.eventPoint!.x, m.eventPoint!.y)).toBe(true);
    markEventVisited(p);
    expect(isMissionComplete(p)).toBe(true);

    const h = createMissionProgress(herbs[0], M.mission_herbs.objective);
    expect(h.eventRequired).toBe(false);
    herbs[0].zones.forEach((z) => markZoneCleared(h, z.id));
    expect(isMissionComplete(h)).toBe(false);
    herbs[0].collectibles.forEach((c) => collectAt(h.objective!, c.id));
    expect(isMissionComplete(h)).toBe(true);

    const d = createMissionProgress(depths[0], null);
    expect(d.objective).toBeNull();
    markZoneCleared(d, 0);
    expect(isMissionComplete(d)).toBe(false);
    depths[0].zones.forEach((z) => markZoneCleared(d, z.id));
    expect(isMissionComplete(d)).toBe(true);
    expect(isObjectiveDone(createObjectiveState({ kind: 'collect', itemId: 'a', count: 0 }))).toBe(true);
  });

  it('calibragem: cada missão estima ~3 min (150-210 s em média)', () => {
    const avg = (maps: DungeonMap[]) => {
      const es = maps.map(estimateMissionSeconds);
      const f = (k: 'combatS' | 'walkS' | 'totalS') => Math.round(es.reduce((a, e) => a + e[k], 0) / es.length);
      return { combat: f('combatS'), walk: f('walkS'), total: f('totalS'), min: Math.round(Math.min(...es.map((e) => e.totalS))), max: Math.round(Math.max(...es.map((e) => e.totalS))) };
    };
    const res = { herbs: avg(herbs), mine: avg(mine), depths: avg(depths) };
    console.log('[mission-time] s', JSON.stringify(res));
    for (const r of Object.values(res)) {
      expect(r.total).toBeGreaterThanOrEqual(150);
      expect(r.total).toBeLessThanOrEqual(210);
    }
  });
});
