import { describe, expect, it } from 'vitest';
import monstersJson from '../../src/data/monsters.json';
import { tickCombat } from '../../src/core/combat/CombatEngine';
import { createHero } from '../../src/core/entities/Hero';
import {
  makeMonsterDormant,
  spawnMonster,
  updateMonsterAwareness,
  MONSTER_AGGRO_RADIUS,
} from '../../src/core/entities/Monster';
import type { MonsterDef } from '../../src/core/index';
import {
  generateDungeonMap,
  MAP_CELL_VOID,
  MAP_FEET_OFFSET,
  MAP_PLACED_START_DIST,
  MAP_TILE,
  mapMinimapLayout,
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
  isEventUnlocked,
  isObjectiveDone,
  killObjectiveText,
  markEventVisited,
  monstersAlive,
  setMonstersKilled,
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
      checkCollectibles(m, 5);
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
      checkCollectibles(m, 4);
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

  it('regra de cumprimento: todos os monstros mortos E objetivo E evento', () => {
    const m = mine[0];
    const p = createMissionProgress(m, M.mission_mine.objective);
    expect(p.monstersTotal).toBe(20); // 10 slimes + 9 lobos + Chefe da Matilha
    expect(killObjectiveText(p)).toBe('Elimine todos os monstros 0/20');
    m.zones.forEach((z) => markZoneCleared(p, z.id));
    setMonstersKilled(p, 19);
    expect(monstersAlive(p)).toBe(1);
    expect(isEventUnlocked(m, p)).toBe(true); // a sala do evento (chefe) está limpa
    collectAt(p.objective!, 99);
    p.objective!.collected = p.objective!.count;
    markEventVisited(p);
    expect(isMissionComplete(p)).toBe(false); // falta 1 monstro
    const p0 = createMissionProgress(m, M.mission_mine.objective);
    expect(isEventUnlocked(m, p0)).toBe(false);
    setMonstersKilled(p, 99);
    expect(killObjectiveText(p)).toBe('Elimine todos os monstros 20/20');
    expect(isMissionComplete(p)).toBe(true);
    // Mesma regra, passo a passo: objetivo e evento.
    p.objective = createMissionProgress(m, M.mission_mine.objective).objective;
    p.eventVisited = false;
    expect(isMissionComplete(p)).toBe(false); // falta objetivo e evento
    const o = p.objective!;
    const c0 = m.collectibles[0];
    expect(findCollectibleAt(m, o, c0.x + 10, c0.y)).toBe(0);
    expect(collectAt(o, 0)).toBe(true);
    expect(collectAt(o, 0)).toBe(false); // repetido não conta
    expect(findCollectibleAt(m, o, c0.x, c0.y)).toBeNull();
    m.collectibles.slice(1).forEach((c) => collectAt(o, c.id));
    expect(isObjectiveDone(o)).toBe(true);
    expect(objectiveProgressText(o, 'Ferramentas')).toBe('Ferramentas 4/4');
    expect(isMissionComplete(p)).toBe(false); // falta o evento
    expect(isAtEventPoint(m, m.eventPoint!.x, m.eventPoint!.y)).toBe(true);
    markEventVisited(p);
    expect(isMissionComplete(p)).toBe(true);

    const h = createMissionProgress(herbs[0], M.mission_herbs.objective);
    expect(h.eventRequired).toBe(false);
    expect(h.monstersTotal).toBe(15);
    herbs[0].zones.forEach((z) => markZoneCleared(h, z.id));
    setMonstersKilled(h, 15);
    expect(isMissionComplete(h)).toBe(false);
    herbs[0].collectibles.forEach((c) => collectAt(h.objective!, c.id));
    expect(isMissionComplete(h)).toBe(true);

    const d = createMissionProgress(depths[0], null, ['karnak']);
    expect(d.objective).toBeNull();
    expect(d.monstersTotal).toBe(22); // o Karnak invencível não conta
    markZoneCleared(d, 0);
    expect(isMissionComplete(d)).toBe(false);
    depths[0].zones.forEach((z) => markZoneCleared(d, z.id));
    expect(isMissionComplete(d)).toBe(false);
    setMonstersKilled(d, 22);
    expect(isMissionComplete(d)).toBe(true);
    expect(isObjectiveDone(createObjectiveState({ kind: 'collect', itemId: 'a', count: 0 }))).toBe(true);
  });

  it('calibragem: cada missão estima ~2-4 min (130-240 s em média; o piloto real fica abaixo, ver o topo de MissionObjectives.ts)', () => {
    const avg = (maps: DungeonMap[]) => {
      const es = maps.map(estimateMissionSeconds);
      const f = (k: 'combatS' | 'walkS' | 'totalS') => Math.round(es.reduce((a, e) => a + e[k], 0) / es.length);
      return { combat: f('combatS'), walk: f('walkS'), total: f('totalS'), min: Math.round(Math.min(...es.map((e) => e.totalS))), max: Math.round(Math.max(...es.map((e) => e.totalS))) };
    };
    const res = { herbs: avg(herbs), mine: avg(mine), depths: avg(depths) };
    console.log('[mission-time] s', JSON.stringify(res));
    for (const r of Object.values(res)) {
      expect(r.total).toBeGreaterThanOrEqual(130);
      expect(r.total).toBeLessThanOrEqual(240);
    }
  });

  it('T-151: missões sem ondas — monstros já no mapa, espalhados e longe do início do herói', () => {
    for (const m of [...herbs, ...mine, ...depths]) {
      expect(m.spawnMode).toBe('placed');
      expect(m.zones.every((z) => z.banner === '')).toBe(true); // sem banner de onda
      const at = reach(m);
      const all = m.zones.flatMap((z) => z.spawns);
      const start = { x: m.heroStart.x, y: m.heroStart.y + MAP_FEET_OFFSET };
      for (const sp of all) {
        const fx = sp.x, fy = sp.y + MAP_FEET_OFFSET;
        expect(at(fx, fy)).toBe(true);
        expect(m.obstacles.some((o) => inside(fx, fy, o))).toBe(false);
        expect(Math.hypot(fx - start.x, fy - start.y)).toBeGreaterThanOrEqual(140);
      }
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        expect(Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y)).toBeGreaterThanOrEqual(36);
      }
    }
    // Em média os monstros da sala/zona inicial ficam bem longe do herói (não acordam no início).
    const firstZoneMin = herbs.map((m) => Math.min(...m.zones[0].spawns.map((sp) =>
      Math.hypot(sp.x - m.heroStart.x, sp.y - m.heroStart.y))));
    expect(firstZoneMin.filter((d) => d >= MAP_PLACED_START_DIST).length).toBe(herbs.length);
    // testArena continua com ondas (spawnMode 'waves').
    expect(generateDungeonMap(101, { mode: 'rooms' }).spawnMode).toBe('waves');
    expect(generateDungeonMap(101, { mode: 'giant' }).zones[0].banner).toMatch(/^Onda 1/);
  });

  it('T-151: o Fundo da Mina ficou mais longo (mais salas de passagem)', () => {
    for (const m of depths) expect(m.rooms.length).toBeGreaterThanOrEqual(5 + 4 * 3);
  });

  it('T-152: planta do minimapa cobre exatamente as células de sala e corredor', () => {
    for (const m of [herbs[0], mine[0], depths[0]]) {
      const lay = mapMinimapLayout(m);
      expect(lay.worldW).toBe(m.cols * T);
      expect(lay.worldH).toBe(m.rows * T);
      const cover = (rects: MapRect[]) => rects.reduce((a, r) => a + (r.w / T) * (r.h / T), 0);
      expect(cover(lay.rooms)).toBe(m.cells.filter((c) => c === 1).length);
      expect(cover(lay.corridors)).toBe(m.cells.filter((c) => c === 2).length);
      expect(lay.rooms.length).toBeLessThan(m.cells.filter((c) => c === 1).length / 4);
    }
  });

  it('T-151: monstro adormecido patrulha perto de casa e acorda por proximidade, dano ou pelo grupo', () => {
    const def = (monstersJson as MonsterDef[]).find((m) => m.id === 'slime')!;
    const hero = createHero({ x: 0, y: 0 });
    const a = spawnMonster(def, 'a', { x: 600, y: 0 });
    const b = spawnMonster(def, 'b', { x: 700, y: 0 });
    const c = spawnMonster(def, 'c', { x: 1400, y: 0 });
    for (const m of [a, b, c]) makeMonsterDormant(m);
    for (let t = 1; t <= 60; t++) tickCombat(hero, [a, b, c], 100, t * 100, () => 0.5);
    expect(hero.stats.hp).toBe(hero.stats.maxHp); // ninguém atacou
    expect(Math.hypot(a.position.x - 600, a.position.y)).toBeLessThanOrEqual(40); // só patrulha
    expect(updateMonsterAwareness([a, b, c], hero.position)).toEqual([]);
    hero.position = { x: 600 - MONSTER_AGGRO_RADIUS + 10, y: 0 };
    expect(updateMonsterAwareness([a, b, c], hero.position, () => false)).toEqual([]); // outra sala
    const woke = updateMonsterAwareness([a, b, c], hero.position);
    expect(woke.map((m) => m.instanceId)).toEqual(['a', 'b']); // b acorda com o grupo
    expect(c.dormant).toBe(true);
    c.hp -= 1;
    expect(updateMonsterAwareness([c], hero.position).map((m) => m.instanceId)).toEqual(['c']); // dano
    const x0 = a.position.x;
    tickCombat(hero, [a], 100, 10000, () => 0.5);
    expect(a.position.x).toBeLessThan(x0); // acordado: persegue
  });
});
