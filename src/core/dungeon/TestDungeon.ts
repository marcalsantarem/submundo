import { createSeededRng } from './DungeonGenerator';

/** Rect in px local to the room, "feet space". */
export interface TestRoomRect { x: number; y: number; w: number; h: number }
/** name ∈ torch/chest_closed/barrel/urn/bones/rubble/chain/skulls_candle; x,y = top-left in local px. */
export interface TestRoomFloorProp { name: string; x: number; y: number }
/** frame 0 pillar, 1 broken pillar (32x64). */
export interface TestRoomTallProp { frame: 0 | 1; x: number; y: number }
/** defId: 'slime' | 'wolf' | 'skeleton' | 'skeleton_archer' | 'skeleton_chief'; x,y = actor center, local px. */
export interface TestRoomSpawn { defId: string; x: number; y: number }
export interface TestRoomSpec {
  index: 0 | 1 | 2;
  wave: 1 | 2 | 3;
  isBossRoom: boolean;
  title: string;
  banner: string;
  cols: number;
  rows: number;
  exitDoorCols: [number, number] | null;
  entryDoorCols: [number, number] | null;
  torchCols: number[];
  floorProps: TestRoomFloorProp[];
  tallProps: TestRoomTallProp[];
  obstacles: TestRoomRect[];
  heroStart: { x: number; y: number };
  spawns: TestRoomSpawn[];
}

export const TEST_DUNGEON_TILE = 32;
/** Distance from an actor's center to its feet. */
export const TEST_DUNGEON_FEET_OFFSET = 30;
const SIDE_MARGIN = 14;
const GRID = 16;
const MIN_SPAWN_DIST = 140;

interface Bounds { minX: number; maxX: number; minY: number; maxY: number }

/** Walkable range of actor FEET (not centers) for a room of the given size. */
function feetBounds(cols: number, rows: number): Bounds {
  const T = TEST_DUNGEON_TILE;
  return {
    minX: T + SIDE_MARGIN,
    maxX: cols * T - T - SIDE_MARGIN,
    minY: T * 3 + 8,
    maxY: rows * T - T - 6,
  };
}

function inRect(x: number, y: number, r: TestRoomRect): boolean {
  return x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
}

function overlaps(a: TestRoomRect, b: TestRoomRect, pad = 0): boolean {
  return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function reachable(
  b: Bounds,
  obstacles: TestRoomRect[],
  start: { x: number; y: number },
  goals: Array<{ x: number; y: number }>
): boolean {
  const nx = Math.floor((b.maxX - b.minX) / GRID) + 1;
  const ny = Math.floor((b.maxY - b.minY) / GRID) + 1;
  const blocked = (cx: number, cy: number): boolean => {
    const x = b.minX + cx * GRID;
    const y = b.minY + cy * GRID;
    return obstacles.some((o) => inRect(x, y, o));
  };
  const toCell = (p: { x: number; y: number }): [number, number] => [
    Math.min(nx - 1, Math.max(0, Math.round((p.x - b.minX) / GRID))),
    Math.min(ny - 1, Math.max(0, Math.round((p.y - b.minY) / GRID))),
  ];
  const [sx, sy] = toCell(start);
  if (blocked(sx, sy)) return false;
  const seen = new Uint8Array(nx * ny);
  const queue: Array<[number, number]> = [[sx, sy]];
  seen[sy * nx + sx] = 1;
  for (let i = 0; i < queue.length; i++) {
    const [cx, cy] = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= nx || y >= ny || seen[y * nx + x] || blocked(x, y)) continue;
      seen[y * nx + x] = 1;
      queue.push([x, y]);
    }
  }
  return goals.every((g) => {
    const [gx, gy] = toCell(g);
    return seen[gy * nx + gx] === 1;
  });
}

type PropKind = 'tall0' | 'tall1' | 'chest_closed' | 'barrel' | 'urn' | 'rubble' | 'bones' | 'skulls_candle' | 'chain';

const BLOCKING_SIZE: Record<string, { dx: number; dy: number; w: number; h: number }> = {
  tall0: { dx: -8, dy: 38, w: 48, h: 30 },
  tall1: { dx: -8, dy: 38, w: 48, h: 30 },
  chest_closed: { dx: -8, dy: 12, w: 48, h: 26 },
  barrel: { dx: -8, dy: 12, w: 48, h: 26 },
  urn: { dx: -8, dy: 12, w: 48, h: 26 },
  rubble: { dx: -6, dy: 14, w: 44, h: 22 },
};
const BLOCKING_KINDS: PropKind[] = ['tall0', 'tall0', 'tall1', 'chest_closed', 'barrel', 'urn', 'rubble'];
const DECOR_KINDS: PropKind[] = ['bones', 'skulls_candle', 'chain', 'bones'];

function pickDoorCols(rng: () => number, cols: number): [number, number] {
  // >= 2 tiles of clearance from the corners (floor spans cols 1..cols-2).
  const c = randInt(rng, 3, cols - 5);
  return [c, c + 1];
}

function pickTorchCols(rng: () => number, cols: number, doors: Array<[number, number] | null>): number[] {
  const picks: number[] = [];
  for (let tries = 0; tries < 60 && picks.length < 4; tries++) {
    const c = randInt(rng, 2, cols - 3);
    if (picks.some((p) => Math.abs(p - c) < 2)) continue;
    if (doors[0] && c >= doors[0][0] - 1 && c <= doors[0][1] + 1) continue;
    picks.push(c);
  }
  return picks.sort((a, b) => a - b);
}

const ROOM_META = [
  { title: 'Sala 1/3 — Slimes e Lobos', banner: 'Onda 1: Slimes e Lobos!' },
  { title: 'Sala 2/3 — Esqueletos e Arqueiros', banner: 'Onda 2: Esqueletos e Arqueiros!' },
  { title: 'Sala 3/3 — Esqueleto Chefe', banner: 'Onda 3: Esqueleto Chefe!' },
] as const;

function spawnPlan(rng: () => number, index: number): string[] {
  if (index === 0) {
    return [
      ...Array<string>(randInt(rng, 3, 4)).fill('slime'),
      ...Array<string>(randInt(rng, 2, 3)).fill('wolf'),
    ];
  }
  if (index === 1) {
    return [...Array<string>(randInt(rng, 3, 4)).fill('skeleton'), 'skeleton_archer', 'skeleton_archer'];
  }
  return ['skeleton_chief'];
}

function tryBuildRoom(
  seed: number,
  index: 0 | 1 | 2,
  cols: number,
  rows: number,
  attempt: number
): TestRoomSpec | null {
  const T = TEST_DUNGEON_TILE;
  const rng = createSeededRng((seed * 7919 + index * 104729 + attempt * 1299709 + 12345) >>> 0);
  const b = feetBounds(cols, rows);
  const W = cols * T;
  const isBoss = index === 2;

  const exitDoorCols = isBoss ? null : pickDoorCols(rng, cols);
  const entryDoorCols = index === 0 ? null : pickDoorCols(rng, cols);
  const torchCols = pickTorchCols(rng, cols, [exitDoorCols]);

  // Hero start (actor center).
  let heroFeet: { x: number; y: number };
  if (entryDoorCols) {
    heroFeet = { x: entryDoorCols[0] * T + T, y: b.maxY - 24 };
  } else {
    heroFeet = { x: Math.round(W / 2), y: Math.round((b.minY + b.maxY) / 2) };
  }
  const heroStart = { x: heroFeet.x, y: heroFeet.y - TEST_DUNGEON_FEET_OFFSET };

  // Keep door approaches and the hero start clear.
  const reserved: TestRoomRect[] = [{ x: heroFeet.x - 48, y: heroFeet.y - 48, w: 96, h: 96 }];
  if (exitDoorCols) reserved.push({ x: exitDoorCols[0] * T - 16, y: b.minY - 8, w: 96, h: 80 });
  if (entryDoorCols) reserved.push({ x: entryDoorCols[0] * T - 16, y: b.maxY - 70, w: 96, h: 80 });

  const floorProps: TestRoomFloorProp[] = [];
  const tallProps: TestRoomTallProp[] = [];
  const obstacles: TestRoomRect[] = [];

  const blockingCount = randInt(rng, 4, 7);
  for (let i = 0; i < blockingCount; i++) {
    const kind = BLOCKING_KINDS[Math.floor(rng() * BLOCKING_KINDS.length)];
    const s = BLOCKING_SIZE[kind];
    for (let t = 0; t < 12; t++) {
      const ox = randInt(rng, b.minX, b.maxX - s.w);
      const oy = randInt(rng, b.minY + 4, b.maxY - s.h - 4);
      const rect: TestRoomRect = { x: ox, y: oy, w: s.w, h: s.h };
      if (reserved.some((r) => overlaps(rect, r)) || obstacles.some((o) => overlaps(rect, o, 24))) continue;
      const px = ox - s.dx;
      const py = oy - s.dy;
      if (kind === 'tall0' || kind === 'tall1') {
        tallProps.push({ frame: kind === 'tall0' ? 0 : 1, x: px, y: py });
      } else {
        floorProps.push({ name: kind, x: px, y: py });
      }
      obstacles.push(rect);
      break;
    }
  }
  const decorCount = randInt(rng, 2, 4);
  for (let i = 0; i < decorCount; i++) {
    const kind = DECOR_KINDS[Math.floor(rng() * DECOR_KINDS.length)];
    floorProps.push({
      name: kind,
      x: randInt(rng, b.minX, b.maxX - 32),
      y: randInt(rng, b.minY - 8, b.maxY - 40),
    });
  }

  // Connectivity: hero -> exit door and hero -> entry door.
  const goals: Array<{ x: number; y: number }> = [];
  if (exitDoorCols) goals.push({ x: exitDoorCols[0] * T + T, y: b.minY });
  if (entryDoorCols) goals.push({ x: entryDoorCols[0] * T + T, y: b.maxY });
  if (!reachable(b, obstacles, heroFeet, goals)) return null;

  // Spawns (actor centers).
  const plan = spawnPlan(rng, index);
  const spawns: TestRoomSpawn[] = [];
  const bossOnlyCenter = isBoss;
  for (const defId of plan) {
    let placed = false;
    for (let t = 0; t < 60 && !placed; t++) {
      let fx: number;
      let fy: number;
      if (bossOnlyCenter) {
        fx = Math.round(W / 2);
        fy = Math.round(b.minY + (b.maxY - b.minY) * 0.3);
      } else {
        fx = randInt(rng, b.minX + 8, b.maxX - 8);
        fy = randInt(rng, b.minY + 8, b.maxY - 8);
      }
      const cx = fx;
      const cy = fy - TEST_DUNGEON_FEET_OFFSET;
      if (Math.hypot(cx - heroStart.x, cy - heroStart.y) < MIN_SPAWN_DIST) continue;
      if (obstacles.some((o) => inRect(fx, fy, { x: o.x - 8, y: o.y - 8, w: o.w + 16, h: o.h + 16 }))) continue;
      if (spawns.some((s) => Math.hypot(s.x - cx, s.y - cy) < 36)) continue;
      if (!reachable(b, obstacles, heroFeet, [{ x: fx, y: fy }])) continue;
      spawns.push({ defId, x: cx, y: cy });
      placed = true;
    }
    if (!placed) return null;
  }

  return {
    index,
    wave: (index + 1) as 1 | 2 | 3,
    isBossRoom: isBoss,
    title: ROOM_META[index].title,
    banner: ROOM_META[index].banner,
    cols,
    rows,
    exitDoorCols,
    entryDoorCols,
    torchCols,
    floorProps,
    tallProps,
    obstacles,
    heroStart,
    spawns,
  };
}

/** Generates the 3-room test dungeon deterministically from a seed. */
export function generateTestDungeon(seed: number): TestRoomSpec[] {
  const sizeRng = createSeededRng((seed * 31 + 7) >>> 0);
  const sizes = [0, 1].map(() => ({ cols: randInt(sizeRng, 18, 26), rows: randInt(sizeRng, 11, 15) }));
  const boss = {
    cols: Math.max(22, sizes[0].cols, sizes[1].cols),
    rows: Math.max(13, sizes[0].rows, sizes[1].rows),
  };
  sizes.push(boss);

  return ([0, 1, 2] as const).map((index) => {
    const { cols, rows } = sizes[index];
    for (let attempt = 0; attempt < 200; attempt++) {
      const room = tryBuildRoom(seed, index, cols, rows, attempt);
      if (room) return room;
    }
    // Fallback: no props at all (always valid).
    return tryBuildEmptyRoom(seed, index, cols, rows);
  });
}

function tryBuildEmptyRoom(seed: number, index: 0 | 1 | 2, cols: number, rows: number): TestRoomSpec {
  const T = TEST_DUNGEON_TILE;
  const b = feetBounds(cols, rows);
  const W = cols * T;
  const isBoss = index === 2;
  const exitDoorCols: [number, number] | null = isBoss ? null : [Math.floor(cols / 2) - 1, Math.floor(cols / 2)];
  const entryDoorCols: [number, number] | null = index === 0 ? null : [Math.floor(cols / 2) - 1, Math.floor(cols / 2)];
  const heroFeet = entryDoorCols
    ? { x: entryDoorCols[0] * T + T, y: b.maxY - 24 }
    : { x: Math.round(W / 2), y: Math.round((b.minY + b.maxY) / 2) };
  const heroStart = { x: heroFeet.x, y: heroFeet.y - TEST_DUNGEON_FEET_OFFSET };
  const plan = spawnPlan(createSeededRng(seed >>> 0), index);
  const spawns: TestRoomSpawn[] = [];
  plan.forEach((defId, i) => {
    const fx = b.minX + 20 + ((i * 97) % (b.maxX - b.minX - 40));
    const fy = b.minY + 12 + (i % 2) * 20;
    spawns.push({ defId, x: fx, y: fy - TEST_DUNGEON_FEET_OFFSET });
  });
  return {
    index,
    wave: (index + 1) as 1 | 2 | 3,
    isBossRoom: isBoss,
    title: ROOM_META[index].title,
    banner: ROOM_META[index].banner,
    cols,
    rows,
    exitDoorCols,
    entryDoorCols,
    torchCols: [3, 6, cols - 7, cols - 4].filter((c) => !exitDoorCols || c < exitDoorCols[0] - 1 || c > exitDoorCols[1] + 1),
    floorProps: [],
    tallProps: [],
    obstacles: [],
    heroStart,
    spawns,
  };
}
