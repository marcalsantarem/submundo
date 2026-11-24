import { createSeededRng } from './DungeonGenerator';

/**
 * T-127 / BRF-136 — Procedural map generator (pure TS, no Phaser).
 *
 * Two modes (Decision #20, no teleport, the hero always walks):
 *  - 'rooms': non-uniform rooms (rect / L / cross / compound) chained by 2-wide corridors that leave
 *    through any wall (N/S/E/W) and bend 0..2 times. Wave rooms are separated by 1..2 empty passage rooms.
 *  - 'giant': one irregular giant room (>= 60x40 tiles) with 3 zones far apart and props forming paths.
 *
 * 2.5D wall clearance (the scene draws walls on VOID cells): above every north floor edge there are
 * 3 free rows (2 face + 1 top), 1 free column on the sides and 1 free row below south edges. Unrelated
 * floor pieces are kept >= 2 columns / >= 4 rows apart, so they never invade each other's walls.
 *
 * Coordinates: cells are (col,row) on a MAP_TILE grid; every px value is world px. Actor positions
 * (heroStart, spawns) are actor CENTERS; their feet are MAP_FEET_OFFSET px below.
 * Torches are given as the UPPER wall-face cell (floor top row - 2), like TestDungeon's row 1.
 * Zone "entry point": rooms mode -> heroStart feet (zone of the start room) or the entry door point
 * (see mapDoorPoint); giant mode -> the trigger rect itself (spawns are >= 140 px from the rect).
 */

export type DungeonMapMode = 'rooms' | 'giant';
export const MAP_TILE = 32;
export const MAP_CELL_VOID = 0, MAP_CELL_ROOM = 1, MAP_CELL_CORRIDOR = 2;
export type DoorSide = 'n' | 's' | 'e' | 'w';
export interface MapRect { x: number; y: number; w: number; h: number }      // px de mundo
export interface MapDoor { id: number; roomId: number; side: DoorSide; col: number; row: number; /* 1ª das 2 células da abertura, na linha/coluna do piso da sala */ corridorId: number }
export interface MapCorridor { id: number; fromDoorId: number; toDoorId: number; cells: { col: number; row: number }[] } // caminho de 2 de largura, com curvas
export interface MapSpawn { defId: string; x: number; y: number }               // px de mundo, centro do ator
export interface MapZone {                                                       // sala (modo rooms) ou zona da sala gigante
  id: number; wave: number; isBossZone: boolean; title: string; banner: string;
  trigger: MapRect[];                 // onde o herói precisa pisar (pés) para ativar a onda
  floorRoomId: number | null;         // sala a que pertence (monstros presos ao piso dela); na sala gigante, a sala única
  spawns: MapSpawn[];
  entryDoorIds: number[]; exitDoorIds: number[];   // portas a selar/abrir (vazias no modo giant)
}
export interface MapRoom { id: number; shape: 'rect' | 'L' | 'cross' | 'compound'; bounds: { col: number; row: number; cols: number; rows: number } }
export interface MapProp { kind: 'floor' | 'tall'; name: string; frame?: number; x: number; y: number; roomId: number } // canto sup. esq., px de mundo
export interface DungeonMap {
  seed: number; mode: DungeonMapMode; cols: number; rows: number;
  cells: number[];      // cols*rows, MAP_CELL_*
  roomIdAt: number[];   // cols*rows, -1 fora de sala
  rooms: MapRoom[]; doors: MapDoor[]; corridors: MapCorridor[]; zones: MapZone[];
  props: MapProp[]; obstacles: MapRect[]; // obstáculos em "feet space", px de mundo
  torches: { col: number; row: number }[]; // células de face de parede norte com tocha
  heroStart: { x: number; y: number };
  collectibles: MapCollectible[];          // objetivo menor de coleta (vazio sem a opção `collectibles`)
  eventPoint?: MapEventPoint;              // ponto de evento no fim do mapa (só com a opção `eventPoint`)
}

/** Item coletável do objetivo menor. (x, y) é o ponto dos PÉS (px de mundo), num nó caminhável alcançável. */
export interface MapCollectible { id: number; itemId: string; x: number; y: number; roomId: number; zoneId: number | null }
/** Ponto de evento (ex.: "algo estranho" no fundo da Mina). (x, y) é o ponto dos PÉS (px de mundo). */
export interface MapEventPoint { x: number; y: number; roomId: number; zoneId: number | null }

/** T-143 — Opções do gerador. Todas opcionais e retrocompatíveis (sem elas o mapa é o mesmo de antes). */
export interface DungeonMapOptions {
  mode?: DungeonMapMode;
  /** Ondas por sala (rooms) / zona (giant). Sem `exactCounts`, cada id vira 2..4 monstros (DEF_COUNT). */
  waves?: string[][];
  /** true: cada onda já é a lista exata de spawns (um id por monstro, ex.: 3x 'slime'). Lista vazia = sala sem monstros. */
  exactCounts?: boolean;
  /** Nº de salas de combate no modo rooms (padrão: nº de ondas). Ondas faltantes viram salas vazias. */
  roomCount?: number;
  /** Nº de zonas no modo giant (padrão: nº de ondas). */
  zoneCount?: number;
  /** Última sala/zona é a do chefe (sala maior, tipo câmara; `isBossZone`). Padrão: true. */
  bossRoom?: boolean;
  /** Chefe acrescentado à última onda se ainda não estiver nela (1 só, longe da entrada). */
  bossId?: string;
  /** Coletáveis do objetivo menor espalhados por salas/zonas diferentes. */
  collectibles?: { itemId: string; count: number };
  /** Gera `eventPoint` no fim do mapa. */
  eventPoint?: boolean;
  /** Salas de passagem (vazias) entre salas de combate no modo rooms: [mín, máx]. Padrão: [1, 2]. */
  passageRooms?: [number, number];
  /** Escala da sala gigante (padrão 1 = 60-70 x 40-46 tiles). Mais ilhas/notches na mesma proporção. */
  giantScale?: number;
}

/** Distance from an actor's center to its feet (same as TestDungeon). */
export const MAP_FEET_OFFSET = 30;
/** BFS grid step (px) used for every walkability guarantee. */
export const MAP_GRID = 16;
export const MAP_MIN_SPAWN_DIST = 140;
export const DEFAULT_MAP_WAVES: string[][] = [['slime', 'wolf'], ['skeleton', 'skeleton_archer'], ['skeleton_chief']];

const T = MAP_TILE;
const GRID = MAP_GRID;
const MAX_ATTEMPTS = 200;

/** Door opening point on the room floor edge (world px). The hero's feet cross it when entering. */
export function mapDoorPoint(d: MapDoor): { x: number; y: number } {
  switch (d.side) {
    case 'n': return { x: (d.col + 1) * T, y: d.row * T };
    case 's': return { x: (d.col + 1) * T, y: (d.row + 1) * T };
    case 'e': return { x: (d.col + 1) * T, y: (d.row + 1) * T };
    default: return { x: d.col * T, y: (d.row + 1) * T };
  }
}

/** Feet rect (relative to the feet point) that must lie on floor for a node to be walkable. */
export const MAP_FEET_BOX = { left: 14, right: 14, up: 8, down: 6 };

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

type Rng = () => number;
type Side = DoorSide;
interface CellRect { c: number; r: number; w: number; h: number }

const DIR: Record<Side, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const OPP: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' };
const PERP: Record<Side, Side[]> = { n: ['e', 'w'], s: ['e', 'w'], e: ['n', 's'], w: ['n', 's'] };
const ALL_SIDES: Side[] = ['n', 's', 'e', 'w'];

function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function overlaps(a: MapRect, b: MapRect, pad = 0): boolean {
  return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
}
function inRect(x: number, y: number, r: MapRect): boolean {
  return x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
}
function distToRect(x: number, y: number, r: MapRect): number {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.hypot(dx, dy);
}
function subSeed(seed: number, attempt: number, salt: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = (h + Math.imul(attempt + 1, 0xc2b2ae35) + salt) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

// ---------------------------------------------------------------------------------------------
// Room shapes
// ---------------------------------------------------------------------------------------------

type ShapeKind = MapRoom['shape'];
interface Shape { kind: ShapeKind; cols: number; rows: number; mask: Uint8Array; rects: CellRect[]; area: number }

function shapeFromRects(kind: ShapeKind, cols: number, rows: number, rects: CellRect[], holes: CellRect[] = []): Shape | null {
  const mask = new Uint8Array(cols * rows);
  for (const q of rects) {
    if (q.w <= 0 || q.h <= 0) return null;
    for (let r = Math.max(0, q.r); r < Math.min(rows, q.r + q.h); r++) {
      for (let c = Math.max(0, q.c); c < Math.min(cols, q.c + q.w); c++) mask[r * cols + c] = 1;
    }
  }
  for (const q of holes) {
    for (let r = q.r; r < q.r + q.h; r++) for (let c = q.c; c < q.c + q.w; c++) mask[r * cols + c] = 0;
  }
  // Crop to the bounding box.
  let minC = cols, minR = rows, maxC = -1, maxR = -1, area = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!mask[r * cols + c]) continue;
      area++;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
    }
  }
  if (area === 0) return null;
  const nc = maxC - minC + 1;
  const nr = maxR - minR + 1;
  const out = new Uint8Array(nc * nr);
  for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) out[r * nc + c] = mask[(r + minR) * cols + c + minC];
  const shifted = rects.map((q) => {
    const c0 = Math.max(q.c, 0) - minC;
    const r0 = Math.max(q.r, 0) - minR;
    const c1 = Math.min(q.c + q.w, cols) - minC;
    const r1 = Math.min(q.r + q.h, rows) - minR;
    return { c: c0, r: r0, w: c1 - c0, h: r1 - r0 };
  });
  return { kind, cols: nc, rows: nr, mask: out, rects: shifted, area };
}

/** Same-room 2.5D sanity: 4x4 thickness everywhere, row gaps >= 2, column gaps >= 4, no pinches, connected. */
function shapeValid(s: Shape): boolean {
  const { cols, rows, mask } = s;
  const at = (c: number, r: number): boolean => c >= 0 && r >= 0 && c < cols && r < rows && mask[r * cols + c] === 1;
  // Thickness.
  const covered = new Uint8Array(cols * rows);
  for (let r = 0; r + 4 <= rows; r++) {
    for (let c = 0; c + 4 <= cols; c++) {
      let full = true;
      for (let y = 0; y < 4 && full; y++) for (let x = 0; x < 4 && full; x++) if (!at(c + x, r + y)) full = false;
      if (!full) continue;
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) covered[(r + y) * cols + c + x] = 1;
    }
  }
  for (let i = 0; i < mask.length; i++) if (mask[i] && !covered[i]) return false;
  // Row gaps.
  for (let r = 0; r < rows; r++) {
    let last = -100;
    for (let c = 0; c < cols; c++) {
      if (!at(c, r)) continue;
      if (last >= 0 && c - last > 1 && c - last - 1 < 2) return false;
      last = c;
    }
  }
  // Column gaps.
  for (let c = 0; c < cols; c++) {
    let last = -100;
    for (let r = 0; r < rows; r++) {
      if (!at(c, r)) continue;
      if (last >= 0 && r - last > 1 && r - last - 1 < 4) return false;
      last = r;
    }
  }
  // Diagonal pinches.
  for (let r = 0; r + 1 < rows; r++) {
    for (let c = 0; c + 1 < cols; c++) {
      const a = at(c, r), b = at(c + 1, r), d = at(c, r + 1), e = at(c + 1, r + 1);
      if ((a && e && !b && !d) || (b && d && !a && !e)) return false;
    }
  }
  // Connectivity.
  const start = mask.indexOf(1);
  const seen = new Uint8Array(cols * rows);
  const q = [start];
  seen[start] = 1;
  let count = 0;
  while (q.length) {
    const i = q.pop() as number;
    count++;
    const c = i % cols, r = (i / cols) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = c + dx, y = r + dy;
      if (!at(x, y) || seen[y * cols + x]) continue;
      seen[y * cols + x] = 1;
      q.push(y * cols + x);
    }
  }
  return count === s.area;
}

function makeRoomShape(rng: Rng, cols: number, rows: number, kind: ShapeKind): Shape | null {
  const ok = (lo: number, hi: number) => lo <= hi;
  switch (kind) {
    case 'rect':
      return shapeFromRects('rect', cols, rows, [{ c: 0, r: 0, w: cols, h: rows }]);
    case 'L': {
      const cwLo = Math.max(3, Math.ceil(cols * 0.3)), cwHi = Math.min(cols - 5, Math.floor(cols * 0.6));
      const chLo = Math.max(3, Math.ceil(rows * 0.3)), chHi = Math.min(rows - 5, Math.floor(rows * 0.6));
      if (!ok(cwLo, cwHi) || !ok(chLo, chHi)) return null;
      const cw = randInt(rng, cwLo, cwHi);
      const ch = randInt(rng, chLo, chHi);
      const corner = randInt(rng, 0, 3);
      const left = corner === 0 || corner === 2; // cut on the left side
      const top = corner < 2; // cut at the top
      const A: CellRect = left ? { c: cw, r: 0, w: cols - cw, h: rows } : { c: 0, r: 0, w: cols - cw, h: rows };
      const B: CellRect = {
        c: left ? 0 : cols - cw,
        r: top ? ch : 0,
        w: cw,
        h: rows - ch,
      };
      return shapeFromRects('L', cols, rows, [A, B]);
    }
    case 'cross': {
      const vwLo = Math.max(5, Math.ceil(cols * 0.35)), vwHi = Math.min(cols - 6, Math.floor(cols * 0.55));
      const hhLo = Math.max(5, Math.ceil(rows * 0.35)), hhHi = Math.min(rows - 6, Math.floor(rows * 0.55));
      if (!ok(vwLo, vwHi) || !ok(hhLo, hhHi)) return null;
      const vw = randInt(rng, vwLo, vwHi);
      const hh = randInt(rng, hhLo, hhHi);
      const a = randInt(rng, 3, cols - vw - 3);
      const b = randInt(rng, 3, rows - hh - 3);
      return shapeFromRects('cross', cols, rows, [{ c: a, r: 0, w: vw, h: rows }, { c: 0, r: b, w: cols, h: hh }]);
    }
    default: {
      const mw = randInt(rng, Math.ceil(cols * 0.5), Math.floor(cols * 0.75));
      const mh = randInt(rng, Math.ceil(rows * 0.55), Math.floor(rows * 0.8));
      const mx = rng() < 0.5 ? 0 : cols - mw;
      const my = rng() < 0.5 ? 0 : rows - mh;
      const rects: CellRect[] = [{ c: mx, r: my, w: mw, h: mh }];
      // Horizontal extension reaching the opposite side, overlapping M by >= 4 columns.
      const ov = randInt(rng, 4, Math.max(4, Math.min(6, mw - 1)));
      const bx = mx === 0 ? mw - ov : 0;
      const bw = mx === 0 ? cols - bx : mx + ov;
      const bhHi = Math.max(5, Math.floor(rows * 0.6));
      const bh = randInt(rng, 5, bhHi);
      const byLo = Math.max(0, my - bh + 4), byHi = Math.min(rows - bh, my + mh - 4);
      if (!ok(byLo, byHi)) return null;
      rects.push({ c: bx, r: randInt(rng, byLo, byHi), w: bw, h: bh });
      if (rng() < 0.6) {
        const ov2 = randInt(rng, 4, Math.max(4, Math.min(6, mh - 1)));
        const cy = my === 0 ? mh - ov2 : 0;
        const chh = my === 0 ? rows - cy : my + ov2;
        const cw = randInt(rng, 5, Math.max(5, Math.floor(cols * 0.55)));
        const cxLo = Math.max(0, mx - cw + 4), cxHi = Math.min(cols - cw, mx + mw - 4);
        if (ok(cxLo, cxHi)) rects.push({ c: randInt(rng, cxLo, cxHi), r: cy, w: cw, h: chh });
      }
      return shapeFromRects('compound', cols, rows, rects);
    }
  }
}

type Role = 'start' | 'passage' | 'wave' | 'boss';

function roomDims(rng: Rng, role: Role): [number, number] {
  switch (role) {
    case 'boss': return [randInt(rng, 26, 34), randInt(rng, 18, 24)];
    case 'start': return [randInt(rng, 14, 22), randInt(rng, 10, 15)];
    case 'wave': return [randInt(rng, 16, 24), randInt(rng, 11, 17)];
    default:
      return rng() < 0.5 ? [randInt(rng, 10, 13), randInt(rng, 8, 10)] : [randInt(rng, 14, 22), randInt(rng, 10, 16)];
  }
}

function makeShapeForRole(rng: Rng, role: Role, simple: boolean, area: { min?: number; max?: number }): Shape | null {
  if (simple) {
    return role === 'boss'
      ? shapeFromRects('rect', 26, 18, [{ c: 0, r: 0, w: 26, h: 18 }])
      : shapeFromRects('rect', 16, 12, [{ c: 0, r: 0, w: 16, h: 12 }]);
  }
  for (let t = 0; t < 40; t++) {
    const [cols, rows] = roomDims(rng, role);
    const small = cols < 13 || rows < 11;
    const roll = rng();
    const kind: ShapeKind = small
      ? (roll < 0.55 ? 'rect' : 'L')
      : roll < 0.28 ? 'rect' : roll < 0.56 ? 'L' : roll < 0.78 ? 'cross' : 'compound';
    const s = makeRoomShape(rng, cols, rows, kind);
    if (!s || !shapeValid(s)) continue;
    if (s.cols < 10 || s.cols > 34 || s.rows < 8 || s.rows > 24) continue;
    if (area.min !== undefined && s.area < area.min) continue;
    if (area.max !== undefined && s.area >= area.max) continue;
    return s;
  }
  return null;
}

/** Door candidates (first of the 2 opening cells, local coords) at >= 2 tiles from the edge corners. */
function doorCandidates(s: Shape, side: Side): { c: number; r: number }[] {
  const out: { c: number; r: number }[] = [];
  const at = (c: number, r: number) => c >= 0 && r >= 0 && c < s.cols && r < s.rows && s.mask[r * s.cols + c] === 1;
  const [dx, dy] = DIR[side];
  if (side === 'n' || side === 's') {
    for (let r = 0; r < s.rows; r++) {
      let start = -1;
      for (let c = 0; c <= s.cols; c++) {
        const edge = c < s.cols && at(c, r) && !at(c, r + dy);
        if (edge && start < 0) start = c;
        if (!edge && start >= 0) {
          const end = c - 1;
          for (let k = start + 2; k <= end - 3; k++) out.push({ c: k, r });
          start = -1;
        }
      }
    }
  } else {
    for (let c = 0; c < s.cols; c++) {
      let start = -1;
      for (let r = 0; r <= s.rows; r++) {
        const edge = r < s.rows && at(c, r) && !at(c + dx, r);
        if (edge && start < 0) start = r;
        if (!edge && start >= 0) {
          const end = r - 1;
          for (let k = start + 2; k <= end - 3; k++) out.push({ c, r: k });
          start = -1;
        }
      }
    }
  }
  // The approach box right outside the door must be free of this room's own floor (no overhangs).
  const free = (c0: number, r0: number, c1: number, r1: number) => {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (at(c, r)) return false;
    return true;
  };
  return out.filter(({ c, r }) => {
    if (side === 'n') return free(c - 2, r - 4, c + 3, r - 1);
    if (side === 's') return free(c - 2, r + 1, c + 3, r + 4);
    if (side === 'e') return free(c + 1, r - 4, c + 4, r + 5);
    return free(c - 4, r - 4, c - 1, r + 5);
  });
}

/** Corridor cells right outside a door (distance 1..4, door band only): allowed to touch the room. */
function doorBand(side: Side, c: number, r: number): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 1; k <= 4; k++) {
    for (let j = 0; j < 2; j++) {
      if (side === 'n') out.push([c + j, r - k]);
      else if (side === 's') out.push([c + j, r + k]);
      else if (side === 'e') out.push([c + k, r + j]);
      else out.push([c - k, r + j]);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Rooms mode: chain of rooms on a working grid
// ---------------------------------------------------------------------------------------------

const WG = 440; // working grid size (cells)

interface PlacedRoom { shape: Shape; ox: number; oy: number; role: Role; wave: number; entrySide: Side | null; piece: number }
interface PlacedDoor { side: Side; c: number; r: number; room: number }
interface PlacedCorridor { cells: number[]; from: PlacedDoor; to: PlacedDoor; piece: number }

class Work {
  owner = new Int32Array(WG * WG);
  pieces: number[][] = []; // cells per piece
  stubs = new Map<number, Set<number>>(); // key corridorPiece*4096 + roomPiece

  write(cells: number[], p: number): void { for (const k of cells) this.owner[k] = p + 1; }
  clear(cells: number[]): void { for (const k of cells) this.owner[k] = 0; }

  allowed(p: number, pk: number, q: number, qk: number): boolean {
    const a = this.stubs.get(p * 4096 + q);
    if (a && a.has(pk)) return true;
    const b = this.stubs.get(q * 4096 + p);
    return !!b && b.has(qk);
  }

  /** Any unrelated floor within 2 columns / 4 rows of this piece's cells? */
  conflicts(p: number): boolean {
    for (const k of this.pieces[p]) {
      const c = k % WG, r = (k / WG) | 0;
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const gk = (r + dy) * WG + c + dx;
          const q = this.owner[gk] - 1;
          if (q < 0 || q === p) continue;
          if (this.allowed(p, k, q, gk)) continue;
          return true;
        }
      }
    }
    return false;
  }
}

const inWork = (c: number, r: number) => c >= 6 && r >= 6 && c < WG - 6 && r < WG - 6;

function sampleMoves(rng: Rng, dirs: Side[]): number[] | null {
  const vert = (d: Side) => d === 'n' || d === 's';
  const n = dirs.length;
  for (let t = 0; t < 12; t++) {
    const ms = dirs.map((d, i) => {
      let min: number;
      if (n === 1) min = vert(d) ? 2 : 1;
      else if (i === 0 || i === n - 1) min = vert(d) ? 4 : 2;
      else min = 2;
      return randInt(rng, min, min + (n === 1 ? 8 : 4));
    });
    const total = ms.reduce((a, b) => a + b, 0);
    if (total >= 1 && total <= 12) return ms;
  }
  return null;
}

function roomCellKeys(s: Shape, ox: number, oy: number): number[] | null {
  const out: number[] = [];
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.cols; c++) {
      if (!s.mask[r * s.cols + c]) continue;
      if (!inWork(ox + c, oy + r)) return null;
      out.push((oy + r) * WG + ox + c);
    }
  }
  return out;
}

function tryLink(rng: Rng, work: Work, rooms: PlacedRoom[], fromIdx: number, target: Shape, plan: { role: Role; wave: number }, simple: boolean): PlacedCorridor | null {
  const from = rooms[fromIdx];
  for (let attempt = 0; attempt < 30; attempt++) {
    const sides = simple ? (['e'] as Side[]) : ALL_SIDES.filter((s) => s !== from.entrySide);
    const side = pick(rng, sides);
    const cands = doorCandidates(from.shape, side);
    if (!cands.length) continue;
    const d = simple ? cands[Math.floor(cands.length / 2)] : pick(rng, cands);
    const gc = from.ox + d.c, gr = from.oy + d.r;
    const roll = rng();
    const bends = simple ? 0 : roll < 0.2 ? 0 : roll < 0.62 ? 1 : 2;
    const dirs: Side[] = [side];
    if (bends >= 1) dirs.push(pick(rng, PERP[side]));
    if (bends === 2) dirs.push(side);
    const moves = simple ? [4] : sampleMoves(rng, dirs);
    if (!moves) continue;

    // 2x2 brush path.
    let bx: number, by: number;
    if (side === 'n') { bx = gc; by = gr - 2; } else if (side === 's') { bx = gc; by = gr + 1; } else if (side === 'e') { bx = gc + 1; by = gr; } else { bx = gc - 2; by = gr; }
    const seen = new Set<number>();
    const cells: number[] = [];
    let bad = false;
    const addBlock = () => {
      for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 2; x++) {
          if (!inWork(bx + x, by + y)) { bad = true; return; }
          const k = (by + y) * WG + bx + x;
          if (!seen.has(k)) { seen.add(k); cells.push(k); }
        }
      }
    };
    addBlock();
    dirs.forEach((dir, i) => {
      for (let m = 0; m < moves[i]; m++) { bx += DIR[dir][0]; by += DIR[dir][1]; addBlock(); }
    });
    if (bad) continue;
    const df = dirs[dirs.length - 1];
    const tSide = OPP[df];
    let tdc: number, tdr: number;
    if (df === 'n') { tdc = bx; tdr = by - 1; } else if (df === 's') { tdc = bx; tdr = by + 2; } else if (df === 'e') { tdc = bx + 2; tdr = by; } else { tdc = bx - 1; tdr = by; }
    const tc = doorCandidates(target, tSide);
    if (!tc.length) continue;
    const td = simple ? tc[Math.floor(tc.length / 2)] : pick(rng, tc);
    const ox = tdc - td.c, oy = tdr - td.r;
    const roomCells = roomCellKeys(target, ox, oy);
    if (!roomCells) continue;
    if (cells.some((k) => work.owner[k] !== 0) || roomCells.some((k) => work.owner[k] !== 0 || seen.has(k))) continue;

    const cp = work.pieces.length;
    work.pieces.push(cells);
    const rp = work.pieces.length;
    work.pieces.push(roomCells);
    work.write(cells, cp);
    work.write(roomCells, rp);
    const band = (sd: Side, c: number, r: number) => new Set(doorBand(sd, c, r).map(([x, y]) => y * WG + x));
    work.stubs.set(cp * 4096 + from.piece, band(side, gc, gr));
    work.stubs.set(cp * 4096 + rp, band(tSide, tdc, tdr));
    if (work.conflicts(cp) || work.conflicts(rp)) {
      work.clear(cells);
      work.clear(roomCells);
      work.stubs.delete(cp * 4096 + from.piece);
      work.stubs.delete(cp * 4096 + rp);
      work.pieces.length = cp;
      continue;
    }
    rooms.push({ shape: target, ox, oy, role: plan.role, wave: plan.wave, entrySide: tSide, piece: rp });
    return { cells, from: { side, c: gc, r: gr, room: fromIdx }, to: { side: tSide, c: tdc, r: tdr, room: rooms.length - 1 }, piece: cp };
  }
  return null;
}

interface BaseMap {
  mode: DungeonMapMode;
  cols: number;
  rows: number;
  cells: number[];
  roomIdAt: number[];
  rooms: MapRoom[];
  roomRects: CellRect[][]; // global cell rects composing each room
  roomRole: Role[];
  roomWave: number[];
  doors: MapDoor[];
  corridors: MapCorridor[];
}

function buildRoomsBase(rng: Rng, nWaves: number, simple: boolean, bossRoom = true, passage: [number, number] = [1, 2]): BaseMap | null {
  const plan: { role: Role; wave: number }[] = [];
  for (let w = 0; w < nWaves; w++) {
    plan.push({ role: w === nWaves - 1 && bossRoom ? 'boss' : w === 0 ? 'start' : 'wave', wave: w });
    if (w < nWaves - 1) {
      const k = simple ? 0 : randInt(rng, passage[0], passage[1]);
      for (let i = 0; i < k; i++) plan.push({ role: 'passage', wave: -1 });
    }
  }
  const bossShape = bossRoom ? makeShapeForRole(rng, 'boss', simple, { min: 430 }) : null;
  if (bossRoom && !bossShape) return null;
  const shapeFor = (p: { role: Role }) =>
    p.role === 'boss' && bossShape ? bossShape : makeShapeForRole(rng, p.role, simple, bossShape ? { max: bossShape.area } : {});

  const work = new Work();
  const rooms: PlacedRoom[] = [];
  const corridors: PlacedCorridor[] = [];
  const first = shapeFor(plan[0]);
  if (!first) return null;
  const ox0 = Math.floor(WG / 2 - first.cols / 2), oy0 = Math.floor(WG / 2 - first.rows / 2);
  const c0 = roomCellKeys(first, ox0, oy0);
  if (!c0) return null;
  work.pieces.push(c0);
  work.write(c0, 0);
  rooms.push({ shape: first, ox: ox0, oy: oy0, role: plan[0].role, wave: plan[0].wave, entrySide: null, piece: 0 });

  for (let i = 1; i < plan.length; i++) {
    let link: PlacedCorridor | null = null;
    for (let t = 0; t < 4 && !link; t++) {
      const shape = shapeFor(plan[i]);
      if (!shape) continue;
      link = tryLink(rng, work, rooms, i - 1, shape, plan[i], simple);
    }
    if (!link) return null;
    corridors.push(link);
  }

  // Normalize: 4 free rows on top, 2 columns on each side, 2 rows below.
  let minC = WG, minR = WG, maxC = 0, maxR = 0;
  for (let k = 0; k < work.owner.length; k++) {
    if (!work.owner[k]) continue;
    const c = k % WG, r = (k / WG) | 0;
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
  }
  const offC = 2 - minC, offR = 4 - minR;
  const cols = maxC - minC + 1 + 4;
  const rows = maxR - minR + 1 + 6;
  const cells = new Array<number>(cols * rows).fill(MAP_CELL_VOID);
  const roomIdAt = new Array<number>(cols * rows).fill(-1);
  const toFinal = (k: number) => ({ col: (k % WG) + offC, row: ((k / WG) | 0) + offR });
  rooms.forEach((room, id) => {
    for (const k of work.pieces[room.piece]) {
      const { col, row } = toFinal(k);
      cells[row * cols + col] = MAP_CELL_ROOM;
      roomIdAt[row * cols + col] = id;
    }
  });
  const doors: MapDoor[] = [];
  const mapCorridors: MapCorridor[] = corridors.map((cor, id) => {
    const list = cor.cells.map(toFinal);
    for (const { col, row } of list) cells[row * cols + col] = MAP_CELL_CORRIDOR;
    doors.push({ id: id * 2, roomId: cor.from.room, side: cor.from.side, col: cor.from.c + offC, row: cor.from.r + offR, corridorId: id });
    doors.push({ id: id * 2 + 1, roomId: cor.to.room, side: cor.to.side, col: cor.to.c + offC, row: cor.to.r + offR, corridorId: id });
    return { id, fromDoorId: id * 2, toDoorId: id * 2 + 1, cells: list };
  });
  return {
    mode: 'rooms',
    cols,
    rows,
    cells,
    roomIdAt,
    rooms: rooms.map((r, id) => ({
      id,
      shape: r.shape.kind,
      bounds: { col: r.ox + offC, row: r.oy + offR, cols: r.shape.cols, rows: r.shape.rows },
    })),
    roomRects: rooms.map((r) => r.shape.rects.map((q) => ({ c: q.c + r.ox + offC, r: q.r + r.oy + offR, w: q.w, h: q.h }))),
    roomRole: rooms.map((r) => r.role),
    roomWave: rooms.map((r) => r.wave),
    doors,
    corridors: mapCorridors,
  };
}

// ---------------------------------------------------------------------------------------------
// Giant mode: one irregular room
// ---------------------------------------------------------------------------------------------

function buildGiantBase(rng: Rng, simple: boolean, scale = 1): BaseMap | null {
  const sc = (v: number) => Math.round(v * scale);
  const W = simple ? sc(64) : randInt(rng, sc(60), sc(70));
  const H = simple ? sc(42) : randInt(rng, sc(40), sc(46));
  const P = 12;
  const cw = W + 2 * P, chh = H + 2 * P;
  const rects: CellRect[] = [{ c: P, r: P, w: W, h: H }];
  const holes: CellRect[] = [];
  if (!simple) {
    // Protrusions (rectangles glued outside a side).
    const nProt = randInt(rng, 1, 3);
    for (let i = 0; i < nProt; i++) {
      const side = pick(rng, ALL_SIDES);
      const len = randInt(rng, 10, 18);
      const depth = randInt(rng, 6, 10);
      if (side === 'n' || side === 's') {
        const c = P + randInt(rng, 4, W - len - 4);
        rects.push({ c, r: side === 'n' ? P - depth : P + H, w: len, h: depth });
      } else {
        const r = P + randInt(rng, 4, H - len - 4);
        rects.push({ c: side === 'w' ? P - depth : P + W, r, w: depth, h: len });
      }
    }
    // Notches cut from the outer boundary (away from the corners so the bbox stays >= 60x40).
    const nNotch = randInt(rng, 2, 4);
    for (let i = 0; i < nNotch; i++) {
      const side = pick(rng, ALL_SIDES);
      const len = randInt(rng, 8, 14);
      const depth = randInt(rng, 5, 9);
      if (side === 'n' || side === 's') {
        const c = P + randInt(rng, 5, W - len - 5);
        holes.push({ c, r: side === 'n' ? P : P + H - depth, w: len, h: depth });
      } else {
        const r = P + randInt(rng, 5, H - len - 5);
        holes.push({ c: side === 'w' ? P : P + W - depth, r, w: depth, h: len });
      }
    }
    // Inner void islands (walls in the middle) that make routes.
    const nIsl = randInt(rng, sc(3), sc(6));
    for (let i = 0; i < nIsl; i++) {
      const w = randInt(rng, 3, 7);
      const h = randInt(rng, 4, 6);
      holes.push({ c: P + randInt(rng, 8, W - w - 8), r: P + randInt(rng, 9, H - h - 8), w, h });
    }
  }
  const shape = shapeFromRects('compound', cw, chh, rects, holes);
  if (!shape || !shapeValid(shape)) return null;
  if (shape.cols < 60 || shape.rows < 40) return null;
  const offC = 2, offR = 4;
  const cols = shape.cols + 4, rows = shape.rows + 6;
  const cells = new Array<number>(cols * rows).fill(MAP_CELL_VOID);
  const roomIdAt = new Array<number>(cols * rows).fill(-1);
  for (let r = 0; r < shape.rows; r++) {
    for (let c = 0; c < shape.cols; c++) {
      if (!shape.mask[r * shape.cols + c]) continue;
      cells[(r + offR) * cols + c + offC] = MAP_CELL_ROOM;
      roomIdAt[(r + offR) * cols + c + offC] = 0;
    }
  }
  return {
    mode: 'giant',
    cols,
    rows,
    cells,
    roomIdAt,
    rooms: [{ id: 0, shape: 'compound', bounds: { col: offC, row: offR, cols: shape.cols, rows: shape.rows } }],
    roomRects: [[]],
    roomRole: ['start'],
    roomWave: [-1],
    doors: [],
    corridors: [],
  };
}

// ---------------------------------------------------------------------------------------------
// Walkability (16 px grid on the hero's feet)
// ---------------------------------------------------------------------------------------------

interface Walk { nx: number; ny: number; walk: Uint8Array }

function floorAt(b: BaseMap, x: number, y: number): boolean {
  const c = Math.floor(x / T), r = Math.floor(y / T);
  return c >= 0 && r >= 0 && c < b.cols && r < b.rows && b.cells[r * b.cols + c] !== MAP_CELL_VOID;
}
function roomAt(b: BaseMap, x: number, y: number): number {
  const c = Math.floor(x / T), r = Math.floor(y / T);
  return c >= 0 && r >= 0 && c < b.cols && r < b.rows ? b.roomIdAt[r * b.cols + c] : -1;
}
function feetOnFloor(b: BaseMap, x: number, y: number): boolean {
  const F = MAP_FEET_BOX;
  return floorAt(b, x - F.left, y - F.up) && floorAt(b, x + F.right, y - F.up) && floorAt(b, x - F.left, y + F.down) && floorAt(b, x + F.right, y + F.down);
}
function feetInRoom(b: BaseMap, x: number, y: number, roomId: number): boolean {
  const F = MAP_FEET_BOX;
  return roomAt(b, x - F.left, y - F.up) === roomId && roomAt(b, x + F.right, y - F.up) === roomId &&
    roomAt(b, x - F.left, y + F.down) === roomId && roomAt(b, x + F.right, y + F.down) === roomId;
}

function buildWalk(b: BaseMap, obstacles: MapRect[]): Walk {
  const nx = b.cols * 2 + 1, ny = b.rows * 2 + 1;
  const walk = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (feetOnFloor(b, i * GRID, j * GRID)) walk[j * nx + i] = 1;
  for (const o of obstacles) {
    const i0 = Math.floor(o.x / GRID) + 1, i1 = Math.ceil((o.x + o.w) / GRID) - 1;
    const j0 = Math.floor(o.y / GRID) + 1, j1 = Math.ceil((o.y + o.h) / GRID) - 1;
    for (let j = Math.max(0, j0); j <= Math.min(ny - 1, j1); j++) {
      for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) {
        if (inRect(i * GRID, j * GRID, o)) walk[j * nx + i] = 0;
      }
    }
  }
  return { nx, ny, walk };
}

function bfs(w: Walk, sx: number, sy: number): Int32Array {
  const dist = new Int32Array(w.nx * w.ny).fill(-1);
  const i0 = Math.round(sx / GRID), j0 = Math.round(sy / GRID);
  if (i0 < 0 || j0 < 0 || i0 >= w.nx || j0 >= w.ny || !w.walk[j0 * w.nx + i0]) return dist;
  const q = new Int32Array(w.nx * w.ny);
  let head = 0, tail = 0;
  q[tail++] = j0 * w.nx + i0;
  dist[j0 * w.nx + i0] = 0;
  while (head < tail) {
    const k = q[head++];
    const i = k % w.nx, j = (k / w.nx) | 0;
    const d = dist[k] + 1;
    if (i > 0 && w.walk[k - 1] && dist[k - 1] < 0) { dist[k - 1] = d; q[tail++] = k - 1; }
    if (i < w.nx - 1 && w.walk[k + 1] && dist[k + 1] < 0) { dist[k + 1] = d; q[tail++] = k + 1; }
    if (j > 0 && w.walk[k - w.nx] && dist[k - w.nx] < 0) { dist[k - w.nx] = d; q[tail++] = k - w.nx; }
    if (j < w.ny - 1 && w.walk[k + w.nx] && dist[k + w.nx] < 0) { dist[k + w.nx] = d; q[tail++] = k + w.nx; }
  }
  return dist;
}

/** Walk distance field (16 px grid, same walkability as the generator) from a FEET point of a generated map. */
export interface MapDistanceField { nx: number; ny: number; dist: Int32Array }
export function mapDistanceField(map: DungeonMap, feetX: number, feetY: number): MapDistanceField {
  const w = buildWalk(map as unknown as BaseMap, map.obstacles);
  return { nx: w.nx, ny: w.ny, dist: bfs(w, feetX, feetY) };
}
/** Walking length in px (grid steps x 16) to a FEET point, or -1 when unreachable. */
export function mapPathLength(f: MapDistanceField, feetX: number, feetY: number): number {
  const i = Math.round(feetX / GRID), j = Math.round(feetY / GRID);
  if (i < 0 || j < 0 || i >= f.nx || j >= f.ny) return -1;
  const d = f.dist[j * f.nx + i];
  return d < 0 ? -1 : d * GRID;
}

function reached(w: Walk, dist: Int32Array, x: number, y: number): boolean {
  const i = Math.round(x / GRID), j = Math.round(y / GRID);
  return i >= 0 && j >= 0 && i < w.nx && j < w.ny && dist[j * w.nx + i] >= 0;
}
function rectReached(w: Walk, dist: Int32Array, r: MapRect): boolean {
  for (let j = Math.floor(r.y / GRID); j <= Math.ceil((r.y + r.h) / GRID); j++) {
    for (let i = Math.floor(r.x / GRID); i <= Math.ceil((r.x + r.w) / GRID); i++) {
      if (i < 0 || j < 0 || i >= w.nx || j >= w.ny) continue;
      if (dist[j * w.nx + i] >= 0 && inRect(i * GRID, j * GRID, r)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// Props (reused from TestDungeon: same kinds, feet-space blocking sizes)
// ---------------------------------------------------------------------------------------------

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
const LINE_KINDS: PropKind[] = ['tall0', 'tall1', 'rubble', 'barrel', 'tall0'];
const DECOR_KINDS: PropKind[] = ['bones', 'skulls_candle', 'chain', 'bones'];

interface PropCtx {
  base: BaseMap;
  props: MapProp[];
  obstacles: MapRect[];
  sprites: MapRect[];
}

function rectInRoom(b: BaseMap, r: MapRect, roomId: number): boolean {
  for (let row = Math.floor(r.y / T); row <= Math.floor((r.y + r.h - 1) / T); row++) {
    for (let col = Math.floor(r.x / T); col <= Math.floor((r.x + r.w - 1) / T); col++) {
      if (col < 0 || row < 0 || col >= b.cols || row >= b.rows || b.roomIdAt[row * b.cols + col] !== roomId) return false;
    }
  }
  return true;
}
function rectTouchesCorridor(b: BaseMap, r: MapRect): boolean {
  for (let row = Math.floor(r.y / T); row <= Math.floor((r.y + r.h - 1) / T); row++) {
    for (let col = Math.floor(r.x / T); col <= Math.floor((r.x + r.w - 1) / T); col++) {
      if (col >= 0 && row >= 0 && col < b.cols && row < b.rows && b.cells[row * b.cols + col] === MAP_CELL_CORRIDOR) return true;
    }
  }
  return false;
}

/** Tries to add one blocking prop whose feet-space obstacle has its top-left at (ox, oy). */
function tryBlocking(ctx: PropCtx, kind: PropKind, ox: number, oy: number, roomId: number, reserves: MapRect[], ignore: MapRect[] = []): boolean {
  const s = BLOCKING_SIZE[kind];
  const o: MapRect = { x: ox, y: oy, w: s.w, h: s.h };
  const px = ox - s.dx, py = oy - s.dy;
  const tall = kind === 'tall0' || kind === 'tall1';
  const sprite: MapRect = { x: px, y: py, w: T, h: tall ? 2 * T : T };
  const base: MapRect = tall ? { x: px, y: py + T, w: T, h: T } : sprite;
  const b = ctx.base;
  if (!rectInRoom(b, o, roomId) || !rectInRoom(b, base, roomId)) return false;
  if (rectTouchesCorridor(b, sprite)) return false;
  if (reserves.some((r) => overlaps(o, r) || overlaps(sprite, r))) return false;
  if (ctx.obstacles.some((q) => !ignore.includes(q) && overlaps(o, q, 24))) return false;
  if (ctx.sprites.some((q) => overlaps(sprite, q, 2))) return false;
  ctx.obstacles.push(o);
  ctx.sprites.push(sprite);
  ctx.props.push(tall
    ? { kind: 'tall', name: kind === 'tall0' ? 'pillar' : 'pillar_broken', frame: kind === 'tall0' ? 0 : 1, x: px, y: py, roomId }
    : { kind: 'floor', name: kind, x: px, y: py, roomId });
  return true;
}

function roomPxBox(b: BaseMap, roomId: number): MapRect {
  const bd = b.rooms[roomId].bounds;
  return { x: bd.col * T, y: bd.row * T, w: bd.cols * T, h: bd.rows * T };
}

function scatterProps(rng: Rng, ctx: PropCtx, roomId: number, reserves: MapRect[], nBlock: number, nDecor: number): void {
  const box = roomPxBox(ctx.base, roomId);
  for (let i = 0; i < nBlock; i++) {
    const kind = pick(rng, BLOCKING_KINDS);
    const s = BLOCKING_SIZE[kind];
    for (let t = 0; t < 16; t++) {
      const ox = randInt(rng, box.x, box.x + box.w - s.w);
      const oy = randInt(rng, box.y, box.y + box.h - s.h);
      if (tryBlocking(ctx, kind, ox, oy, roomId, reserves)) break;
    }
  }
  for (let i = 0; i < nDecor; i++) {
    const kind = pick(rng, DECOR_KINDS);
    for (let t = 0; t < 16; t++) {
      const r: MapRect = { x: randInt(rng, box.x, box.x + box.w - T), y: randInt(rng, box.y, box.y + box.h - T), w: T, h: T };
      if (!rectInRoom(ctx.base, r, roomId)) continue;
      if (reserves.some((q) => overlaps(r, q))) continue;
      if (ctx.sprites.some((q) => overlaps(r, q, 2)) || ctx.obstacles.some((q) => overlaps(r, q))) continue;
      ctx.sprites.push(r);
      ctx.props.push({ kind: 'floor', name: kind, x: r.x, y: r.y, roomId });
      break;
    }
  }
}

/** Area (inside the room) right behind a door that must stay free of props. */
function doorReserve(d: MapDoor): MapRect {
  switch (d.side) {
    case 'n': return { x: (d.col - 1) * T, y: d.row * T, w: 4 * T, h: 4 * T };
    case 's': return { x: (d.col - 1) * T, y: (d.row - 3) * T, w: 4 * T, h: 4 * T };
    case 'e': return { x: (d.col - 3) * T, y: (d.row - 1) * T, w: 4 * T, h: 4 * T };
    default: return { x: d.col * T, y: (d.row - 1) * T, w: 4 * T, h: 4 * T };
  }
}

function pickTorches(rng: Rng, b: BaseMap, roomId: number): { col: number; row: number }[] {
  const out: { col: number; row: number }[] = [];
  const voidAt = (c: number, r: number) => c >= 0 && r >= 0 && c < b.cols && r < b.rows && b.cells[r * b.cols + c] === MAP_CELL_VOID;
  const bd = b.rooms[roomId].bounds;
  let edgeLen = 0;
  const cands: { col: number; row: number }[] = [];
  for (let r = bd.row; r < bd.row + bd.rows; r++) {
    for (let c = bd.col; c < bd.col + bd.cols; c++) {
      if (b.roomIdAt[r * b.cols + c] !== roomId || !voidAt(c, r - 1)) continue;
      edgeLen++;
      let free = true;
      for (let y = 1; y <= 3 && free; y++) for (let x = -1; x <= 1 && free; x++) if (!voidAt(c + x, r - y)) free = false;
      if (free) cands.push({ col: c, row: r - 2 });
    }
  }
  const max = Math.max(2, Math.min(10, Math.round(edgeLen / 6)));
  for (const cd of cands) {
    if (out.length >= max) break;
    if (out.some((o) => o.row === cd.row && Math.abs(o.col - cd.col) < 3)) continue;
    if (rng() < 0.3) out.push(cd);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Waves, zones and spawns
// ---------------------------------------------------------------------------------------------

const DEF_LABEL: Record<string, string> = {
  slime: 'Slimes',
  wolf: 'Lobos',
  skeleton: 'Esqueletos',
  skeleton_archer: 'Arqueiros',
  skeleton_chief: 'Esqueleto Chefe',
  cave_bat: 'Morcegos',
  wolf_alpha: 'Chefe da Matilha',
  karnak: 'Karnak',
};
/** Ids de chefes: 1 por onda e posicionados longe da entrada. */
const BOSS_IDS = new Set(['skeleton_chief', 'wolf_alpha', 'karnak']);
const DEF_COUNT: Record<string, [number, number]> = {
  slime: [3, 4],
  wolf: [2, 3],
  skeleton: [3, 4],
  skeleton_archer: [2, 2],
  skeleton_chief: [1, 1],
  cave_bat: [3, 4],
  wolf_alpha: [1, 1],
  karnak: [1, 1],
};

function waveLabel(wave: string[]): string {
  const names = [...new Set(wave)].map((d) => DEF_LABEL[d] ?? d);
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}
function spawnPlan(rng: Rng, wave: string[], cfg: GenConfig): string[] {
  if (cfg.exactCounts) return wave.slice();
  const out: string[] = [];
  for (const d of wave) {
    const [lo, hi] = d === cfg.bossId ? [1, 1] : DEF_COUNT[d] ?? [2, 3];
    const n = randInt(rng, lo, hi);
    for (let i = 0; i < n; i++) out.push(d);
  }
  return out;
}

interface Node { x: number; y: number }

function spawnCandidates(b: BaseMap, w: Walk, dist: Int32Array, obstacles: MapRect[], roomId: number, filter: (x: number, y: number) => boolean): Node[] {
  const out: Node[] = [];
  for (let j = 0; j < w.ny; j++) {
    for (let i = 0; i < w.nx; i++) {
      if (dist[j * w.nx + i] < 0) continue;
      const x = i * GRID, y = j * GRID;
      if (!feetInRoom(b, x, y, roomId)) continue;
      if (obstacles.some((o) => inRect(x, y, { x: o.x - 8, y: o.y - 8, w: o.w + 16, h: o.h + 16 }))) continue;
      if (!filter(x, y)) continue;
      out.push({ x, y });
    }
  }
  return out;
}

function placeSpawns(rng: Rng, plan: string[], cands: Node[], taken: Node[], bossPick: ((c: Node[]) => Node[]) | null, bossId?: string): MapSpawn[] | null {
  const out: MapSpawn[] = [];
  for (const defId of plan) {
    const pool = (BOSS_IDS.has(defId) || defId === bossId) && bossPick ? bossPick(cands) : cands;
    let placed: Node | null = null;
    for (let t = 0; t < 200 && !placed; t++) {
      const c = pool[Math.floor(rng() * pool.length)];
      if (!c) break;
      if (taken.some((s) => Math.hypot(s.x - c.x, s.y - c.y) < 36)) continue;
      placed = c;
    }
    if (!placed) return null;
    taken.push(placed);
    out.push({ defId, x: placed.x, y: placed.y - MAP_FEET_OFFSET });
  }
  return out;
}

function snap(v: number): number {
  return Math.round(v / GRID) * GRID;
}

function decorateRooms(rng: Rng, seed: number, b: BaseMap, cfg: GenConfig, simple: boolean): DungeonMap | null {
  const waves = cfg.waves;
  // Hero start: center of the largest rect of the start room.
  const startRects = b.roomRects[0].slice().sort((p, q) => q.w * q.h - p.w * p.h);
  const sr = startRects[0];
  const heroFeet = { x: snap((sr.c + sr.w / 2) * T), y: snap((sr.r + sr.h / 2) * T) };
  if (!feetInRoom(b, heroFeet.x, heroFeet.y, 0)) return null;

  const ctx: PropCtx = { base: b, props: [], obstacles: [], sprites: [] };
  if (!simple) {
    b.rooms.forEach((room) => {
      const reserves = b.doors.filter((d) => d.roomId === room.id).map(doorReserve);
      if (room.id === 0) reserves.push({ x: heroFeet.x - 56, y: heroFeet.y - 64, w: 112, h: 112 });
      let area = 0;
      for (const v of b.roomIdAt) if (v === room.id) area++;
      const nBlock = Math.max(2, Math.min(12, Math.round(area / 50)));
      const nDecor = Math.max(1, Math.min(5, Math.round(area / 90)));
      scatterProps(rng, ctx, room.id, reserves, nBlock, nDecor);
    });
  }

  const walk = buildWalk(b, ctx.obstacles);
  const dist = bfs(walk, heroFeet.x, heroFeet.y);
  // Every door point must be reachable (all rooms are traversable).
  for (const d of b.doors) {
    const p = mapDoorPoint(d);
    if (!reached(walk, dist, p.x, p.y)) return null;
  }

  const zones: MapZone[] = [];
  const taken: Node[] = [];
  for (let wv = 0; wv < waves.length; wv++) {
    const roomId = b.roomWave.indexOf(wv);
    if (roomId < 0) return null;
    const isBoss = cfg.bossRoom && wv === waves.length - 1;
    const entryDoors = b.doors.filter((d) => d.roomId === roomId && b.corridors[d.corridorId].toDoorId === d.id);
    const exitDoors = b.doors.filter((d) => d.roomId === roomId && b.corridors[d.corridorId].fromDoorId === d.id);
    const entries = roomId === 0 ? [heroFeet] : entryDoors.map(mapDoorPoint);
    const trigger = b.roomRects[roomId].map((q) => ({ x: q.c * T + T, y: q.r * T + T, w: q.w * T - 2 * T, h: q.h * T - 2 * T }));
    for (const t of trigger) if (!rectReached(walk, dist, t)) return null;
    const cands = spawnCandidates(b, walk, dist, ctx.obstacles, roomId, (x, y) =>
      entries.every((e) => Math.hypot(x - e.x, y - e.y) >= MAP_MIN_SPAWN_DIST));
    if (!cands.length) return null;
    const far = (cs: Node[]) => {
      const dOf = (c: Node) => Math.min(...entries.map((e) => Math.hypot(c.x - e.x, c.y - e.y)));
      const max = Math.max(...cs.map(dOf));
      return cs.filter((c) => dOf(c) >= max * 0.6);
    };
    const spawns = placeSpawns(rng, spawnPlan(rng, waves[wv], cfg), cands, taken, far, cfg.bossId);
    if (!spawns) return null;
    const label = waveLabel(waves[wv]);
    zones.push({
      id: wv,
      wave: wv + 1,
      isBossZone: isBoss,
      title: label ? `Sala ${wv + 1}/${waves.length} — ${label}` : `Sala ${wv + 1}/${waves.length}`,
      banner: label ? `Onda ${wv + 1}: ${label}!` : '',
      trigger,
      floorRoomId: roomId,
      spawns,
      entryDoorIds: entryDoors.map((d) => d.id),
      exitDoorIds: exitDoors.map((d) => d.id),
    });
  }

  const torches = b.rooms.flatMap((r) => pickTorches(rng, b, r.id));
  const extras = placeExtras(cfg, b, walk, dist, ctx.obstacles, heroFeet, zones, null);
  if (!extras) return null;
  return {
    seed,
    mode: 'rooms',
    cols: b.cols,
    rows: b.rows,
    cells: b.cells,
    roomIdAt: b.roomIdAt,
    rooms: b.rooms,
    doors: b.doors,
    corridors: b.corridors,
    zones,
    props: ctx.props,
    obstacles: ctx.obstacles,
    torches,
    heroStart: { x: heroFeet.x, y: heroFeet.y - MAP_FEET_OFFSET },
    ...extras,
  };
}

function decorateGiant(rng: Rng, seed: number, b: BaseMap, cfg: GenConfig, simple: boolean): DungeonMap | null {
  const waves = cfg.waves;
  const n = waves.length;
  const walk0 = buildWalk(b, []);
  // "Clear" nodes: a 4x4-tile neighbourhood of floor around them.
  const clear: Node[] = [];
  for (let j = 0; j < walk0.ny; j++) {
    for (let i = 0; i < walk0.nx; i++) {
      if (!walk0.walk[j * walk0.nx + i]) continue;
      const x = i * GRID, y = j * GRID;
      let ok = true;
      for (const dx of [-64, 0, 64]) for (const dy of [-64, 0, 64]) if (ok && !feetOnFloor(b, x + dx, y + dy)) ok = false;
      if (ok) clear.push({ x, y });
    }
  }
  if (clear.length < 50) return null;
  const box = roomPxBox(b, 0);
  const corner = { x: box.x + (rng() < 0.5 ? 0 : box.w), y: box.y + (rng() < 0.5 ? 0 : box.h) };
  const byCorner = clear.slice().sort((p, q) => Math.hypot(p.x - corner.x, p.y - corner.y) - Math.hypot(q.x - corner.x, q.y - corner.y));
  const heroFeet = byCorner[randInt(rng, 0, Math.min(9, byCorner.length - 1))];
  const nodeDist = (d: Int32Array, p: Node) => d[Math.round(p.y / GRID) * walk0.nx + Math.round(p.x / GRID)];

  // Zone centres: start, boss at the farthest walkable point, the others by farthest-point sampling.
  const centers: Node[] = [heroFeet];
  const dists: Int32Array[] = [bfs(walk0, heroFeet.x, heroFeet.y)];
  if (n >= 2) {
    let best = heroFeet, bestD = -1;
    for (const c of clear) { const d = nodeDist(dists[0], c); if (d > bestD) { bestD = d; best = c; } }
    const bossDist = bfs(walk0, best.x, best.y);
    const mids: Node[] = [];
    const midD: Int32Array[] = [];
    for (let k = 1; k < n - 1; k++) {
      let bm = heroFeet, bmD = -1;
      for (const c of clear) {
        let m = Math.min(nodeDist(dists[0], c), nodeDist(bossDist, c));
        for (const md of midD) m = Math.min(m, nodeDist(md, c));
        if (m > bmD) { bmD = m; bm = c; }
      }
      mids.push(bm);
      midD.push(bfs(walk0, bm.x, bm.y));
    }
    centers.push(...mids, best);
  }
  for (let i = 0; i < centers.length; i++) {
    for (let j = i + 1; j < centers.length; j++) {
      if (Math.hypot(centers[i].x - centers[j].x, centers[i].y - centers[j].y) < 560) return null;
    }
  }
  const triggers: MapRect[] = centers.map((c) => ({ x: c.x - 3 * T, y: c.y - 80, w: 6 * T, h: 160 }));

  const ctx: PropCtx = { base: b, props: [], obstacles: [], sprites: [] };
  const reserves: MapRect[] = [
    ...triggers.map((t) => ({ x: t.x - 48, y: t.y - 48, w: t.w + 96, h: t.h + 96 })),
    { x: heroFeet.x - 64, y: heroFeet.y - 72, w: 128, h: 128 },
  ];
  const goalsOk = (): boolean => {
    const w = buildWalk(b, ctx.obstacles);
    const d = bfs(w, heroFeet.x, heroFeet.y);
    return centers.every((c) => reached(w, d, c.x, c.y));
  };
  if (!simple) {
    // Lines of props that shape routes.
    const nLines = randInt(rng, 6, 10);
    for (let l = 0; l < nLines; l++) {
      const kind = pick(rng, LINE_KINDS);
      const s = BLOCKING_SIZE[kind];
      const horizontal = rng() < 0.5;
      const count = randInt(rng, 3, 6);
      const step = horizontal ? s.w + 8 : s.h + 8;
      const ox = randInt(rng, box.x, box.x + box.w - s.w);
      const oy = randInt(rng, box.y, box.y + box.h - s.h);
      const before = { p: ctx.props.length, o: ctx.obstacles.length, s: ctx.sprites.length };
      const mine: MapRect[] = [];
      for (let k = 0; k < count; k++) {
        const x = ox + (horizontal ? k * step : 0);
        const y = oy + (horizontal ? 0 : k * step);
        if (!tryBlocking(ctx, kind, x, y, 0, reserves, mine)) break;
        mine.push(ctx.obstacles[ctx.obstacles.length - 1]);
      }
      if (mine.length < 2 || !goalsOk()) {
        ctx.props.length = before.p;
        ctx.obstacles.length = before.o;
        ctx.sprites.length = before.s;
      }
    }
    let area = 0;
    for (const v of b.roomIdAt) if (v === 0) area++;
    scatterProps(rng, ctx, 0, reserves, Math.round(area / 45), Math.round(area / 80));
  }

  const walk = buildWalk(b, ctx.obstacles);
  const dist = bfs(walk, heroFeet.x, heroFeet.y);
  for (const t of triggers) if (!rectReached(walk, dist, t)) return null;

  const zones: MapZone[] = [];
  const taken: Node[] = [];
  for (let wv = 0; wv < n; wv++) {
    const tr = triggers[wv];
    const c = centers[wv];
    const cands = spawnCandidates(b, walk, dist, ctx.obstacles, 0, (x, y) =>
      distToRect(x, y, tr) >= MAP_MIN_SPAWN_DIST && Math.hypot(x - c.x, y - c.y) <= 420 &&
      Math.hypot(x - heroFeet.x, y - heroFeet.y) >= MAP_MIN_SPAWN_DIST);
    if (cands.length < 8) return null;
    const near = (cs: Node[]) => {
      const band = cs.filter((p) => distToRect(p.x, p.y, tr) <= 260);
      return band.length ? band : cs;
    };
    const spawns = placeSpawns(rng, spawnPlan(rng, waves[wv], cfg), cands, taken, near, cfg.bossId);
    if (!spawns) return null;
    const label = waveLabel(waves[wv]);
    zones.push({
      id: wv,
      wave: wv + 1,
      isBossZone: cfg.bossRoom && wv === n - 1,
      title: label ? `Zona ${wv + 1}/${n} — ${label}` : `Zona ${wv + 1}/${n}`,
      banner: label ? `Onda ${wv + 1}: ${label}!` : '',
      trigger: [tr],
      floorRoomId: 0,
      spawns,
      entryDoorIds: [],
      exitDoorIds: [],
    });
  }

  const extras = placeExtras(cfg, b, walk, dist, ctx.obstacles, heroFeet, zones, centers);
  if (!extras) return null;
  return {
    seed,
    mode: 'giant',
    cols: b.cols,
    rows: b.rows,
    cells: b.cells,
    roomIdAt: b.roomIdAt,
    rooms: b.rooms,
    doors: [],
    corridors: [],
    zones,
    props: ctx.props,
    obstacles: ctx.obstacles,
    torches: pickTorches(rng, b, 0),
    heroStart: { x: heroFeet.x, y: heroFeet.y - MAP_FEET_OFFSET },
    ...extras,
  };
}

// ---------------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------
// T-143 — Collectibles (objetivo menor) and event point
// ---------------------------------------------------------------------------------------------

interface ExtraCand { x: number; y: number; roomId: number; d: number }
interface Extras { collectibles: MapCollectible[]; eventPoint?: MapEventPoint }

const COLLECT_MIN_GAP = 96;    // px entre coletáveis
const COLLECT_HERO_GAP = 128;  // px do início do herói
const COLLECT_DOOR_GAP = 72;   // px dos pontos de porta (não bloqueia a passagem)

function shuffle<T>(rng: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Places the collectibles and the event point on reachable 16 px nodes (BFS from the hero), away from
 * obstacles, doors and the hero start. Uses `cfg.xrng`, so the main stream (layout/spawns) is unchanged.
 *  - rooms: round-robin over the rooms (passage rooms included, one first; boss room and start room
 *    last/excluded), each item in the room's "corners" (far from its centre and doors).
 *  - giant: round-robin over the zones (nearest zone centre), farthest-point sampling from the hero,
 *    the zone centres and the items already placed (lands in corners and between zones).
 *  - event point: the reachable node of the last room (rooms) / whole map (giant) with the longest walk.
 */
function placeExtras(cfg: GenConfig, b: BaseMap, w: Walk, dist: Int32Array, obstacles: MapRect[], heroFeet: Node, zones: MapZone[], centers: Node[] | null): Extras | null {
  if (!cfg.collectibles && !cfg.eventPoint) return { collectibles: [] };
  const rng = cfg.xrng;
  const doorPts = b.doors.map(mapDoorPoint);
  const cands: ExtraCand[] = [];
  for (let j = 0; j < w.ny; j++) {
    for (let i = 0; i < w.nx; i++) {
      const d = dist[j * w.nx + i];
      if (d < 0) continue;
      const x = i * GRID, y = j * GRID;
      const roomId = roomAt(b, x, y);
      if (roomId < 0 || !feetInRoom(b, x, y, roomId)) continue;
      if (obstacles.some((o) => inRect(x, y, { x: o.x - 12, y: o.y - 12, w: o.w + 24, h: o.h + 24 }))) continue;
      if (Math.hypot(x - heroFeet.x, y - heroFeet.y) < COLLECT_HERO_GAP) continue;
      if (doorPts.some((p) => Math.hypot(x - p.x, y - p.y) < COLLECT_DOOR_GAP)) continue;
      cands.push({ x, y, roomId, d });
    }
  }
  const nearestZone = (x: number, y: number): number => {
    if (!centers) return -1;
    let best = 0;
    for (let k = 1; k < centers.length; k++) {
      if (Math.hypot(x - centers[k].x, y - centers[k].y) < Math.hypot(x - centers[best].x, y - centers[best].y)) best = k;
    }
    return best;
  };
  const zoneIdOf = (c: { x: number; y: number; roomId: number }): number | null => {
    if (centers) return zones[nearestZone(c.x, c.y)]?.id ?? null;
    const z = zones.find((q) => q.floorRoomId === c.roomId);
    return z ? z.id : null;
  };

  const collectibles: MapCollectible[] = [];
  const farFromItems = (c: ExtraCand, gap: number) => collectibles.every((p) => Math.hypot(c.x - p.x, c.y - p.y) >= gap);
  const push = (c: ExtraCand) => collectibles.push({ id: collectibles.length, itemId: cfg.collectibles!.itemId, x: c.x, y: c.y, roomId: c.roomId, zoneId: zoneIdOf(c) });

  if (cfg.collectibles) {
    const count = cfg.collectibles.count;
    if (!centers) {
      // Rooms mode.
      let order = shuffle(rng, b.rooms.map((r) => r.id).filter((id) => !(cfg.bossRoom && b.roomRole[id] === 'boss')));
      const firstPassage = order.findIndex((id) => b.roomRole[id] === 'passage');
      if (firstPassage > 0) order.unshift(...order.splice(firstPassage, 1));
      const startIdx = order.indexOf(0);
      if (startIdx >= 0 && order.length > 1) order.push(...order.splice(startIdx, 1));
      order = order.filter((id) => cands.some((c) => c.roomId === id));
      if (!order.length) return null;
      for (let k = 0; k < count; k++) {
        const roomId = order[k % order.length];
        const pool = cands.filter((c) => c.roomId === roomId);
        const bd = b.rooms[roomId].bounds;
        const cx = (bd.col + bd.cols / 2) * T, cy = (bd.row + bd.rows / 2) * T;
        const myDoors = b.doors.filter((d) => d.roomId === roomId).map(mapDoorPoint);
        const score = (c: ExtraCand) =>
          Math.hypot(c.x - cx, c.y - cy) + 0.5 * Math.min(1e9, ...myDoors.map((p) => Math.hypot(c.x - p.x, c.y - p.y)));
        const ranked = pool.filter((c) => farFromItems(c, COLLECT_MIN_GAP)).sort((p, q) => score(q) - score(p));
        let pickFrom = ranked.slice(0, Math.max(1, Math.ceil(ranked.length * 0.3)));
        if (!pickFrom.length) pickFrom = pool.filter((c) => farFromItems(c, 48));
        if (!pickFrom.length) return null;
        push(pickFrom[Math.floor(rng() * pickFrom.length)]);
      }
    } else {
      // Giant mode.
      const anchors: Node[] = [heroFeet, ...centers];
      for (let k = 0; k < count; k++) {
        const zone = k % centers.length;
        const pool = cands.filter((c) => nearestZone(c.x, c.y) === zone && farFromItems(c, COLLECT_MIN_GAP));
        if (!pool.length) return null;
        const m = (c: ExtraCand) => Math.min(
          ...anchors.map((a) => Math.hypot(c.x - a.x, c.y - a.y)),
          ...collectibles.map((p) => Math.hypot(c.x - p.x, c.y - p.y)),
        );
        const ranked = pool.map((c) => ({ c, s: m(c) })).sort((p, q) => q.s - p.s).slice(0, 6);
        push(ranked[Math.floor(rng() * ranked.length)].c);
      }
    }
  }

  let eventPoint: MapEventPoint | undefined;
  if (cfg.eventPoint) {
    const lastRoom = centers ? null : zones[zones.length - 1]?.floorRoomId ?? null;
    let best: ExtraCand | null = null;
    for (const c of cands) {
      if (lastRoom !== null && c.roomId !== lastRoom) continue;
      if (!farFromItems(c, 64)) continue;
      if (!best || c.d > best.d) best = c;
    }
    if (!best) return null;
    eventPoint = { x: best.x, y: best.y, roomId: best.roomId, zoneId: zoneIdOf(best) };
  }
  return eventPoint ? { collectibles, eventPoint } : { collectibles };
}

// ---------------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------------

interface GenConfig {
  waves: string[][];
  exactCounts: boolean;
  bossRoom: boolean;
  bossId?: string;
  collectibles?: { itemId: string; count: number };
  eventPoint: boolean;
  passageRooms: [number, number];
  giantScale: number;
  xrng: Rng; // RNG separado para coletáveis/evento: o fluxo principal (e a testArena) não muda
}

function buildOnce(seed: number, mode: DungeonMapMode, cfg0: Omit<GenConfig, 'xrng'>, attempt: number, simple: boolean): DungeonMap | null {
  const rng = createSeededRng(subSeed(seed, attempt, mode === 'rooms' ? 0x51 : 0xa7));
  const cfg: GenConfig = { ...cfg0, xrng: createSeededRng(subSeed(seed, attempt, 0xc3)) };
  if (mode === 'rooms') {
    const base = buildRoomsBase(rng, cfg.waves.length, simple, cfg.bossRoom, cfg.passageRooms);
    return base ? decorateRooms(rng, seed, base, cfg, simple) : null;
  }
  const base = buildGiantBase(rng, simple, cfg.giantScale);
  return base ? decorateGiant(rng, seed, base, cfg, simple) : null;
}

/**
 * Generates a map deterministically from `seed`. Regenerates with sub-seeds when a guarantee fails
 * (up to 200 times), then falls back to a simple layout (rect rooms in a row / plain giant room).
 */
export function generateDungeonMap(seed: number, options?: DungeonMapOptions): DungeonMap {
  const mode: DungeonMapMode = options?.mode ?? 'rooms';
  const baseWaves = options?.waves && options.waves.length ? options.waves : DEFAULT_MAP_WAVES;
  const n = Math.max(1, Math.floor((mode === 'rooms' ? options?.roomCount : options?.zoneCount) ?? baseWaves.length));
  const waves = Array.from({ length: n }, (_, i) => (baseWaves[i] ?? []).slice());
  const bossRoom = options?.bossRoom ?? true;
  const bossId = options?.bossId;
  if (bossId && !waves[n - 1].includes(bossId)) waves[n - 1].push(bossId);
  const col = options?.collectibles;
  const cfg: Omit<GenConfig, 'xrng'> = {
    waves,
    exactCounts: options?.exactCounts ?? false,
    bossRoom,
    bossId,
    collectibles: col && col.count > 0 ? { itemId: col.itemId, count: Math.floor(col.count) } : undefined,
    eventPoint: options?.eventPoint ?? false,
    passageRooms: options?.passageRooms
      ? [Math.max(0, Math.floor(Math.min(...options.passageRooms))), Math.max(0, Math.floor(Math.max(...options.passageRooms)))] as [number, number]
      : [1, 2] as [number, number],
    giantScale: Math.max(1, Math.min(2, options?.giantScale ?? 1)),
  };
  const s = seed >>> 0;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const map = buildOnce(s, mode, cfg, attempt, false);
    if (map) return map;
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    const map = buildOnce(s, mode, cfg, MAX_ATTEMPTS + attempt, true);
    if (map) return map;
  }
  throw new Error(`generateDungeonMap: could not build a ${mode} map for seed ${seed}`);
}
