import { describe, expect, it } from 'vitest';
import {
  generateTestDungeon,
  TEST_DUNGEON_FEET_OFFSET,
  TEST_DUNGEON_TILE,
  type TestRoomRect,
} from '../../src/core/dungeon/TestDungeon';

const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 1);
const T = TEST_DUNGEON_TILE;

function inside(x: number, y: number, r: TestRoomRect): boolean {
  return x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
}

function reachableFromHero(room: ReturnType<typeof generateTestDungeon>[number], goals: Array<[number, number]>): boolean {
  const G = 16;
  const minX = T + 14;
  const maxX = room.cols * T - T - 14;
  const minY = T * 3 + 8;
  const maxY = room.rows * T - T - 6;
  const nx = Math.floor((maxX - minX) / G) + 1;
  const ny = Math.floor((maxY - minY) / G) + 1;
  const blocked = (cx: number, cy: number) =>
    room.obstacles.some((o) => inside(minX + cx * G, minY + cy * G, o));
  const cell = (x: number, y: number): [number, number] => [
    Math.min(nx - 1, Math.max(0, Math.round((x - minX) / G))),
    Math.min(ny - 1, Math.max(0, Math.round((y - minY) / G))),
  ];
  const [sx, sy] = cell(room.heroStart.x, room.heroStart.y + TEST_DUNGEON_FEET_OFFSET);
  const seen = new Set<number>([sy * nx + sx]);
  const q: Array<[number, number]> = [[sx, sy]];
  for (let i = 0; i < q.length; i++) {
    const [cx, cy] = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = cx + dx;
      const y = cy + dy;
      const k = y * nx + x;
      if (x < 0 || y < 0 || x >= nx || y >= ny || seen.has(k) || blocked(x, y)) continue;
      seen.add(k);
      q.push([x, y]);
    }
  }
  return goals.every(([gx, gy]) => {
    const [cx, cy] = cell(gx, gy);
    return seen.has(cy * nx + cx);
  });
}

describe('generateTestDungeon', () => {
  it('gera sempre 3 salas com índices e ondas corretos', () => {
    for (const seed of SEEDS) {
      const rooms = generateTestDungeon(seed);
      expect(rooms).toHaveLength(3);
      expect(rooms.map((r) => r.index)).toEqual([0, 1, 2]);
      expect(rooms.map((r) => r.wave)).toEqual([1, 2, 3]);
    }
  });

  it('respeita a composição por onda', () => {
    for (const seed of SEEDS) {
      const [r1, r2, r3] = generateTestDungeon(seed);
      const count = (r: typeof r1, id: string) => r.spawns.filter((s) => s.defId === id).length;
      expect(count(r1, 'slime')).toBeGreaterThanOrEqual(3);
      expect(count(r1, 'slime')).toBeLessThanOrEqual(4);
      expect(count(r1, 'wolf')).toBeGreaterThanOrEqual(2);
      expect(count(r1, 'wolf')).toBeLessThanOrEqual(3);
      expect(r1.spawns.length).toBe(count(r1, 'slime') + count(r1, 'wolf'));
      expect(count(r2, 'skeleton')).toBeGreaterThanOrEqual(3);
      expect(count(r2, 'skeleton')).toBeLessThanOrEqual(4);
      expect(count(r2, 'skeleton_archer')).toBe(2);
      expect(r2.spawns.length).toBe(count(r2, 'skeleton') + 2);
      expect(r3.spawns.map((s) => s.defId)).toEqual(['skeleton_chief']);
    }
  });

  it('é determinístico e varia entre sementes', () => {
    expect(generateTestDungeon(42)).toEqual(generateTestDungeon(42));
    const sigs = new Set(SEEDS.map((s) => JSON.stringify(generateTestDungeon(s))));
    expect(sigs.size).toBeGreaterThan(190);
    expect(JSON.stringify(generateTestDungeon(1))).not.toBe(JSON.stringify(generateTestDungeon(2)));
  });

  it('tamanhos válidos e sala do boss é a maior', () => {
    for (const seed of SEEDS) {
      const rooms = generateTestDungeon(seed);
      for (const r of rooms) {
        expect(r.cols).toBeGreaterThanOrEqual(18);
        expect(r.cols).toBeLessThanOrEqual(26);
        expect(r.rows).toBeGreaterThanOrEqual(11);
        expect(r.rows).toBeLessThanOrEqual(15);
      }
      expect(rooms[2].cols).toBeGreaterThanOrEqual(22);
      expect(rooms[2].rows).toBeGreaterThanOrEqual(13);
      expect(rooms[2].cols).toBeGreaterThanOrEqual(Math.max(rooms[0].cols, rooms[1].cols));
      expect(rooms[2].rows).toBeGreaterThanOrEqual(Math.max(rooms[0].rows, rooms[1].rows));
    }
  });

  it('portas coerentes e boss na sala 3', () => {
    for (const seed of SEEDS) {
      const rooms = generateTestDungeon(seed);
      expect(rooms[0].entryDoorCols).toBeNull();
      expect(rooms[0].exitDoorCols).not.toBeNull();
      expect(rooms[1].entryDoorCols).not.toBeNull();
      expect(rooms[1].exitDoorCols).not.toBeNull();
      expect(rooms[2].exitDoorCols).toBeNull();
      expect(rooms[2].entryDoorCols).not.toBeNull();
      expect(rooms.map((r) => r.isBossRoom)).toEqual([false, false, true]);
      for (const r of rooms) {
        for (const d of [r.exitDoorCols, r.entryDoorCols]) {
          if (!d) continue;
          expect(d[1]).toBe(d[0] + 1);
          expect(d[0]).toBeGreaterThanOrEqual(3);
          expect(d[1]).toBeLessThanOrEqual(r.cols - 4);
        }
      }
    }
  });

  it('há caminho livre do herói até as portas (200 sementes)', () => {
    for (const seed of SEEDS) {
      for (const r of generateTestDungeon(seed)) {
        const goals: Array<[number, number]> = [];
        if (r.exitDoorCols) goals.push([r.exitDoorCols[0] * T + T, T * 3 + 8]);
        if (r.entryDoorCols) goals.push([r.entryDoorCols[0] * T + T, r.rows * T - T - 6]);
        expect(reachableFromHero(r, goals)).toBe(true);
      }
    }
  });

  it('spawns dentro do piso, fora de obstáculos e longe do herói', () => {
    for (const seed of SEEDS) {
      for (const r of generateTestDungeon(seed)) {
        for (const s of r.spawns) {
          const fy = s.y + TEST_DUNGEON_FEET_OFFSET;
          expect(s.x).toBeGreaterThanOrEqual(T + 14);
          expect(s.x).toBeLessThanOrEqual(r.cols * T - T - 14);
          expect(fy).toBeGreaterThanOrEqual(T * 3 + 8);
          expect(fy).toBeLessThanOrEqual(r.rows * T - T - 6);
          expect(r.obstacles.some((o) => inside(s.x, fy, o))).toBe(false);
          expect(Math.hypot(s.x - r.heroStart.x, s.y - r.heroStart.y)).toBeGreaterThanOrEqual(140);
        }
        const hf = r.heroStart.y + TEST_DUNGEON_FEET_OFFSET;
        expect(r.obstacles.some((o) => inside(r.heroStart.x, hf, o))).toBe(false);
      }
    }
  });
});
