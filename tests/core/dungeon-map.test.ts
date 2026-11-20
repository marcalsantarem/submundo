import { describe, expect, it } from 'vitest';
import {
  generateDungeonMap,
  mapDoorPoint,
  MAP_CELL_CORRIDOR,
  MAP_CELL_ROOM,
  MAP_CELL_VOID,
  MAP_FEET_OFFSET,
  MAP_TILE,
  type DoorSide,
  type DungeonMap,
  type MapDoor,
  type MapRect,
} from '../../src/core/dungeon/DungeonMap';

const T = MAP_TILE;
const G = 16;
const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 1);
const OPP: Record<DoorSide, DoorSide> = { n: 's', s: 'n', e: 'w', w: 'e' };
const OUT: Record<DoorSide, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

const roomsMaps = SEEDS.map((s) => generateDungeonMap(s, { mode: 'rooms' }));
const giantMaps = SEEDS.map((s) => generateDungeonMap(s, { mode: 'giant' }));

// ------------------------------------------------------------------ independent helpers
const cellAt = (m: DungeonMap, c: number, r: number) =>
  c >= 0 && r >= 0 && c < m.cols && r < m.rows ? m.cells[r * m.cols + c] : MAP_CELL_VOID;
const roomAt = (m: DungeonMap, c: number, r: number) =>
  c >= 0 && r >= 0 && c < m.cols && r < m.rows ? m.roomIdAt[r * m.cols + c] : -1;
const inside = (x: number, y: number, r: MapRect) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
const floorPx = (m: DungeonMap, x: number, y: number) => cellAt(m, Math.floor(x / T), Math.floor(y / T)) !== MAP_CELL_VOID;
const feetCorners = (x: number, y: number): [number, number][] => [[x - 14, y - 8], [x + 14, y - 8], [x - 14, y + 6], [x + 14, y + 6]];

function reachability(m: DungeonMap): { nx: number; seen: Uint8Array; at: (x: number, y: number) => boolean } {
  const nx = m.cols * 2 + 1, ny = m.rows * 2 + 1;
  const ok = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) ok[j * nx + i] = feetCorners(i * G, j * G).every(([a, b]) => floorPx(m, a, b)) ? 1 : 0;
  for (const o of m.obstacles) {
    for (let j = Math.max(0, Math.floor(o.y / G)); j <= Math.min(ny - 1, Math.ceil((o.y + o.h) / G)); j++) {
      for (let i = Math.max(0, Math.floor(o.x / G)); i <= Math.min(nx - 1, Math.ceil((o.x + o.w) / G)); i++) if (inside(i * G, j * G, o)) ok[j * nx + i] = 0;
    }
  }
  const seen = new Uint8Array(nx * ny);
  const si = Math.round(m.heroStart.x / G), sj = Math.round((m.heroStart.y + MAP_FEET_OFFSET) / G);
  const q = [sj * nx + si];
  if (ok[q[0]]) seen[q[0]] = 1; else q.pop();
  for (let h = 0; h < q.length; h++) {
    const k = q[h], i = k % nx, j = (k / nx) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = i + dx, y = j + dy;
      if (x < 0 || y < 0 || x >= nx || y >= ny) continue;
      const n = y * nx + x;
      if (ok[n] && !seen[n]) { seen[n] = 1; q.push(n); }
    }
  }
  const at = (x: number, y: number) => {
    const i = Math.round(x / G), j = Math.round(y / G);
    return i >= 0 && j >= 0 && i < nx && j < ny && seen[j * nx + i] === 1;
  };
  return { nx, seen, at };
}

/** Piece id per floor cell: room id (0..) or 1000 + corridor id. */
function pieces(m: DungeonMap): Int32Array {
  const p = new Int32Array(m.cols * m.rows).fill(-1);
  for (let i = 0; i < p.length; i++) if (m.roomIdAt[i] >= 0) p[i] = m.roomIdAt[i];
  for (const c of m.corridors) for (const { col, row } of c.cells) p[row * m.cols + col] = 1000 + c.id;
  return p;
}

function doorBand(d: MapDoor): Set<number> {
  const out = new Set<number>();
  for (let k = 1; k <= 4; k++) {
    for (let j = 0; j < 2; j++) {
      const [c, r] = d.side === 'n' ? [d.col + j, d.row - k] : d.side === 's' ? [d.col + j, d.row + k] : d.side === 'e' ? [d.col + k, d.row + j] : [d.col - k, d.row + j];
      out.add(r * 100000 + c);
    }
  }
  return out;
}

function bendsOf(m: DungeonMap, id: number): number {
  const c = m.corridors[id];
  const a = m.doors[c.fromDoorId], b = m.doors[c.toDoorId];
  if (OPP[a.side] !== b.side) return 1;
  const aligned = a.side === 'n' || a.side === 's' ? a.col === b.col : a.row === b.row;
  return aligned ? 0 : 2;
}

function checkGeometry(m: DungeonMap): void {
  // Margins for the walls drawn around the map.
  for (let r = 0; r < m.rows; r++) {
    for (let c = 0; c < m.cols; c++) {
      const v = cellAt(m, c, r);
      const fail = (why: string) => { throw new Error(`seed ${m.seed} ${m.mode}: ${why} at ${c},${r}`); };
      if (v !== MAP_CELL_VOID && v !== MAP_CELL_ROOM && v !== MAP_CELL_CORRIDOR) fail('bad cell');
      if ((m.roomIdAt[r * m.cols + c] >= 0) !== (v === MAP_CELL_ROOM)) fail('roomIdAt mismatch');
      if (v === MAP_CELL_VOID) continue;
      if (!(r >= 3 && c >= 1 && c < m.cols - 1 && r < m.rows - 1)) fail('no room for walls at the map border');
      // 3 free rows above every north edge (2 face + top).
      if (cellAt(m, c, r - 1) === MAP_CELL_VOID && (cellAt(m, c, r - 2) !== MAP_CELL_VOID || cellAt(m, c, r - 3) !== MAP_CELL_VOID)) {
        fail('floor inside a north wall band');
      }
    }
  }
  // Unrelated floor pieces never invade each other's wall band (1 col on the sides, 3 rows up, 1 row down).
  const p = pieces(m);
  const linkBand = new Map<string, Set<number>>();
  for (const d of m.doors) linkBand.set(`${1000 + d.corridorId}:${d.roomId}`, doorBand(d));
  for (let r = 0; r < m.rows; r++) {
    for (let c = 0; c < m.cols; c++) {
      const a = p[r * m.cols + c];
      if (a < 0) continue;
      for (let dy = -3; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = c + dx, y = r + dy;
          if (x < 0 || y < 0 || x >= m.cols || y >= m.rows) continue;
          const b = p[y * m.cols + x];
          if (b < 0 || b === a) continue;
          const ab = linkBand.get(`${a}:${b}`);
          const ba = linkBand.get(`${b}:${a}`);
          const ok = (ab && ab.has(r * 100000 + c)) || (ba && ba.has(y * 100000 + x));
          if (!ok) throw new Error(`seed ${m.seed}: piece ${b} invades wall of ${a} at ${x},${y}`);
        }
      }
    }
  }
}

function checkCorridorsAndDoors(m: DungeonMap): void {
  const owner = new Map<number, number>();
  let corridorCells = 0;
  for (const c of m.corridors) {
    expect(c.cells.length % 2).toBe(0);
    const len = c.cells.length / 2;
    expect(len).toBeGreaterThanOrEqual(3);
    expect(len).toBeLessThanOrEqual(14);
    const set = new Set(c.cells.map(({ col, row }) => row * 100000 + col));
    expect(set.size).toBe(c.cells.length);
    for (const { col, row } of c.cells) {
      const k = row * 100000 + col;
      expect(owner.has(k)).toBe(false); // corridors never cross
      owner.set(k, c.id);
      expect(cellAt(m, col, row)).toBe(MAP_CELL_CORRIDOR);
      expect(roomAt(m, col, row)).toBe(-1);
      // 2 tiles wide: every cell belongs to a 2x2 block of the corridor.
      const block = [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([ox, oy]) =>
        [[0, 0], [1, 0], [0, 1], [1, 1]].every(([bx, by]) => set.has((row + oy + by) * 100000 + col + ox + bx)));
      expect(block).toBe(true);
    }
    // 4-connected.
    const start = c.cells[0];
    const seen = new Set([start.row * 100000 + start.col]);
    const q = [start];
    for (let h = 0; h < q.length; h++) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = (q[h].row + dy) * 100000 + q[h].col + dx;
        if (set.has(k) && !seen.has(k)) { seen.add(k); q.push({ col: q[h].col + dx, row: q[h].row + dy }); }
      }
    }
    expect(seen.size).toBe(set.size);
    const from = m.doors[c.fromDoorId], to = m.doors[c.toDoorId];
    expect(from.corridorId).toBe(c.id);
    expect(to.corridorId).toBe(c.id);
    expect(from.roomId).not.toBe(to.roomId);
    expect(bendsOf(m, c.id)).toBeLessThanOrEqual(2);
  }
  for (let i = 0; i < m.cells.length; i++) if (m.cells[i] === MAP_CELL_CORRIDOR) corridorCells++;
  expect(corridorCells).toBe(owner.size);
  expect(m.doors.length).toBe(m.corridors.length * 2);
  m.doors.forEach((d, i) => {
    expect(d.id).toBe(i);
    const [ox, oy] = OUT[d.side];
    const along: [number, number] = d.side === 'n' || d.side === 's' ? [1, 0] : [0, 1];
    for (let k = -2; k <= 3; k++) {
      const c = d.col + along[0] * k, r = d.row + along[1] * k;
      expect(roomAt(m, c, r)).toBe(d.roomId); // straight edge, >= 2 tiles from the corners
      const outC = c + ox, outR = r + oy;
      if (k === 0 || k === 1) expect(owner.get(outR * 100000 + outC)).toBe(d.corridorId);
      else expect(cellAt(m, outC, outR)).toBe(MAP_CELL_VOID);
    }
  });
}

/** Door cells plus 2 tiles inward. */
function doorArea(d: MapDoor): MapRect {
  switch (d.side) {
    case 'n': return { x: d.col * T, y: d.row * T, w: 2 * T, h: 3 * T };
    case 's': return { x: d.col * T, y: (d.row - 2) * T, w: 2 * T, h: 3 * T };
    case 'e': return { x: (d.col - 2) * T, y: d.row * T, w: 3 * T, h: 2 * T };
    default: return { x: d.col * T, y: d.row * T, w: 3 * T, h: 2 * T };
  }
}
const overlap = (a: MapRect, b: MapRect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function touchesCorridor(m: DungeonMap, r: MapRect): boolean {
  for (let row = Math.floor(r.y / T); row <= Math.floor((r.y + r.h - 1) / T); row++) {
    for (let col = Math.floor(r.x / T); col <= Math.floor((r.x + r.w - 1) / T); col++) if (cellAt(m, col, row) === MAP_CELL_CORRIDOR) return true;
  }
  return false;
}

function checkPropsAndSpawns(m: DungeonMap): void {
  const areas = m.doors.map(doorArea);
  for (const o of m.obstacles) {
    expect(touchesCorridor(m, o)).toBe(false);
    expect(areas.some((a) => overlap(a, o))).toBe(false);
    for (const [x, y] of [[o.x, o.y], [o.x + o.w - 1, o.y + o.h - 1]]) expect(floorPx(m, x, y)).toBe(true);
  }
  for (const p of m.props) {
    const r: MapRect = { x: p.x, y: p.y, w: T, h: p.kind === 'tall' ? 2 * T : T };
    expect(touchesCorridor(m, r)).toBe(false);
    expect(areas.some((a) => overlap(a, r))).toBe(false);
    expect(roomAt(m, Math.floor(p.x / T), Math.floor((r.y + r.h - 1) / T))).toBe(p.roomId);
  }
  const reach = reachability(m);
  for (const z of m.zones) {
    // Trigger reachable: some reachable node strictly inside it.
    for (const t of z.trigger) {
      let ok = false;
      for (let y = Math.ceil(t.y / G) * G; y < t.y + t.h && !ok; y += G) for (let x = Math.ceil(t.x / G) * G; x < t.x + t.w && !ok; x += G) if (inside(x, y, t) && reach.at(x, y)) ok = true;
      expect(ok).toBe(true);
    }
    const entries = m.mode === 'rooms'
      ? (z.entryDoorIds.length ? z.entryDoorIds.map((id) => mapDoorPoint(m.doors[id])) : [{ x: m.heroStart.x, y: m.heroStart.y + MAP_FEET_OFFSET }])
      : [];
    for (const s of z.spawns) {
      const fx = s.x, fy = s.y + MAP_FEET_OFFSET;
      expect(reach.at(fx, fy)).toBe(true);
      for (const [x, y] of feetCorners(fx, fy)) expect(roomAt(m, Math.floor(x / T), Math.floor(y / T))).toBe(z.floorRoomId);
      expect(m.obstacles.some((o) => inside(fx, fy, { x: o.x - 8, y: o.y - 8, w: o.w + 16, h: o.h + 16 }))).toBe(false);
      for (const e of entries) expect(Math.hypot(fx - e.x, fy - e.y)).toBeGreaterThanOrEqual(140);
      if (m.mode === 'giant') {
        for (const t of z.trigger) {
          const dx = Math.max(t.x - fx, 0, fx - (t.x + t.w)), dy = Math.max(t.y - fy, 0, fy - (t.y + t.h));
          expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(140);
        }
      }
    }
  }
}

function checkWaves(m: DungeonMap): void {
  expect(m.zones.map((z) => z.wave)).toEqual([1, 2, 3]);
  expect(m.zones.map((z) => z.isBossZone)).toEqual([false, false, true]);
  const count = (z: number, d: string) => m.zones[z].spawns.filter((s) => s.defId === d).length;
  expect(count(0, 'slime')).toBeGreaterThanOrEqual(3);
  expect(count(0, 'slime')).toBeLessThanOrEqual(4);
  expect(count(0, 'wolf')).toBeGreaterThanOrEqual(2);
  expect(count(0, 'wolf')).toBeLessThanOrEqual(3);
  expect(m.zones[0].spawns.length).toBe(count(0, 'slime') + count(0, 'wolf'));
  expect(count(1, 'skeleton')).toBeGreaterThanOrEqual(3);
  expect(count(1, 'skeleton')).toBeLessThanOrEqual(4);
  expect(count(1, 'skeleton_archer')).toBe(2);
  expect(m.zones[1].spawns.length).toBe(count(1, 'skeleton') + 2);
  expect(m.zones[2].spawns.map((s) => s.defId)).toEqual(['skeleton_chief']);
  expect(m.zones[0].banner).toBe('Onda 1: Slimes e Lobos!');
  expect(m.zones[1].banner).toBe('Onda 2: Esqueletos e Arqueiros!');
  expect(m.zones[2].banner).toBe('Onda 3: Esqueleto Chefe!');
}

function roomArea(m: DungeonMap, id: number): number {
  return m.roomIdAt.filter((v) => v === id).length;
}

// ------------------------------------------------------------------ tests
describe('DungeonMap generator (T-127)', () => {
  it('is deterministic per seed in both modes', () => {
    for (const mode of ['rooms', 'giant'] as const) {
      for (const s of [1, 42, 99991]) expect(generateDungeonMap(s, { mode })).toEqual(generateDungeonMap(s, { mode }));
    }
  });

  it('varies between seeds', () => {
    for (const maps of [roomsMaps, giantMaps]) {
      const sigs = new Set(maps.map((m) => `${m.cols}x${m.rows}:${m.cells.join('')}`));
      expect(sigs.size).toBeGreaterThanOrEqual(195);
    }
  });

  it('rooms mode: geometry, corridors, doors and chain of waves for 200 seeds', () => {
    for (const m of roomsMaps) {
      expect(m.mode).toBe('rooms');
      checkGeometry(m);
      checkCorridorsAndDoors(m);
      checkWaves(m);
      for (const r of m.rooms) {
        expect(r.bounds.cols).toBeGreaterThanOrEqual(10);
        expect(r.bounds.cols).toBeLessThanOrEqual(34);
        expect(r.bounds.rows).toBeGreaterThanOrEqual(8);
        expect(r.bounds.rows).toBeLessThanOrEqual(24);
      }
      // Chain: corridor k links room k -> room k+1.
      m.corridors.forEach((c, k) => {
        expect(m.doors[c.fromDoorId].roomId).toBe(k);
        expect(m.doors[c.toDoorId].roomId).toBe(k + 1);
      });
      expect(m.corridors.length).toBe(m.rooms.length - 1);
      const zr = m.zones.map((z) => z.floorRoomId as number);
      expect(zr[0]).toBe(0);
      expect(roomAt(m, Math.floor(m.heroStart.x / T), Math.floor((m.heroStart.y + MAP_FEET_OFFSET) / T))).toBe(0);
      expect(zr[2]).toBe(m.rooms.length - 1);
      for (let i = 1; i < zr.length; i++) {
        expect(zr[i] - zr[i - 1] - 1).toBeGreaterThanOrEqual(1); // 1..2 empty passage rooms
        expect(zr[i] - zr[i - 1] - 1).toBeLessThanOrEqual(2);
      }
      const bossArea = roomArea(m, zr[2]);
      for (const r of m.rooms) if (r.id !== zr[2]) expect(roomArea(m, r.id)).toBeLessThan(bossArea);
      expect(m.zones[0].entryDoorIds).toEqual([]);
      expect(m.zones[2].exitDoorIds).toEqual([]);
      m.zones.forEach((z, i) => {
        if (i > 0) expect(z.entryDoorIds).toEqual([m.corridors[zr[i] - 1].toDoorId]);
        if (i < 2) expect(z.exitDoorIds).toEqual([m.corridors[zr[i]].fromDoorId]);
        for (const t of z.trigger) {
          for (const [x, y] of [[t.x + 1, t.y + 1], [t.x + t.w - 1, t.y + t.h - 1]]) expect(roomAt(m, Math.floor(x / T), Math.floor(y / T))).toBe(zr[i]);
        }
      });
      for (const t of m.torches) {
        expect(cellAt(m, t.col, t.row)).toBe(MAP_CELL_VOID);
        expect(cellAt(m, t.col, t.row + 2)).toBe(MAP_CELL_ROOM);
      }
    }
  });

  it('rooms mode: connectivity, spawns and props for 200 seeds', () => {
    for (const m of roomsMaps) {
      checkPropsAndSpawns(m);
      const reach = reachability(m);
      for (const d of m.doors) {
        const p = mapDoorPoint(d);
        expect(reach.at(p.x, p.y)).toBe(true);
      }
    }
  });

  it('rooms mode: curves, door sides, sizes and shapes really vary', () => {
    let withCurve = 0, twoSides = 0;
    const sides: Record<string, number> = {}, shapes: Record<string, number> = {}, bends = [0, 0, 0];
    const dims = new Set<string>();
    const areas: number[] = [];
    let doors = 0, rooms = 0;
    for (const m of roomsMaps) {
      const b = m.corridors.map((c) => bendsOf(m, c.id));
      b.forEach((v) => bends[v]++);
      if (b.some((v) => v > 0)) withCurve++;
      if (new Set(m.doors.map((d) => d.side)).size >= 2) twoSides++;
      for (const d of m.doors) { sides[d.side] = (sides[d.side] ?? 0) + 1; doors++; }
      for (const r of m.rooms) {
        shapes[r.shape] = (shapes[r.shape] ?? 0) + 1;
        dims.add(`${r.bounds.cols}x${r.bounds.rows}`);
        areas.push(roomArea(m, r.id));
        rooms++;
      }
    }
    areas.sort((a, b) => a - b);
    console.log('[dungeon-map] door sides', sides, 'shapes', shapes, 'bends 0/1/2', bends,
      'room area min/p50/max', areas[0], areas[areas.length >> 1], areas[areas.length - 1], 'distinct dims', dims.size);
    expect(withCurve).toBeGreaterThanOrEqual(180);
    expect(twoSides).toBeGreaterThanOrEqual(180);
    for (const s of ['n', 's', 'e', 'w']) expect(sides[s] / doors).toBeGreaterThan(0.12);
    for (const s of ['rect', 'L', 'cross', 'compound']) expect(shapes[s] / rooms).toBeGreaterThan(0.05);
    expect(bends[0] + bends[1] + bends[2]).toBeGreaterThan(0);
    expect(bends[1]).toBeGreaterThan(0);
    expect(bends[2]).toBeGreaterThan(0);
    expect(areas[0]).toBeLessThanOrEqual(130);
    expect(areas[areas.length - 1]).toBeGreaterThanOrEqual(500);
    expect(dims.size).toBeGreaterThanOrEqual(60);
  });

  it('giant mode: one big irregular room, 3 far zones, boss farthest, for 200 seeds', () => {
    for (const m of giantMaps) {
      expect(m.mode).toBe('giant');
      expect(m.rooms).toHaveLength(1);
      expect(m.rooms[0].bounds.cols).toBeGreaterThanOrEqual(60);
      expect(m.rooms[0].bounds.rows).toBeGreaterThanOrEqual(40);
      expect(roomArea(m, 0)).toBeLessThan(m.rooms[0].bounds.cols * m.rooms[0].bounds.rows); // irregular
      expect(m.doors).toEqual([]);
      expect(m.corridors).toEqual([]);
      checkGeometry(m);
      checkWaves(m);
      checkPropsAndSpawns(m);
      for (const z of m.zones) {
        expect(z.floorRoomId).toBe(0);
        expect(z.entryDoorIds).toEqual([]);
        expect(z.exitDoorIds).toEqual([]);
      }
      const centers = m.zones.map((z) => ({ x: z.trigger[0].x + z.trigger[0].w / 2, y: z.trigger[0].y + z.trigger[0].h / 2 }));
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(Math.hypot(centers[i].x - centers[j].x, centers[i].y - centers[j].y)).toBeGreaterThanOrEqual(560);
      const hero = { x: m.heroStart.x, y: m.heroStart.y + MAP_FEET_OFFSET };
      expect(inside(hero.x, hero.y, m.zones[0].trigger[0])).toBe(true);
      const d = centers.map((c) => Math.hypot(c.x - hero.x, c.y - hero.y));
      expect(d[2]).toBeGreaterThan(d[1]);
      expect(m.obstacles.length).toBeGreaterThanOrEqual(20);
    }
  });
});
