import Phaser from 'phaser';
import {
  MAP_CELL_VOID,
  MAP_TILE,
  type DungeonMap,
  type MapDoor,
} from '../../core/dungeon/DungeonMap';

/**
 * T-128 / BRF-140 — Autotile of a `DungeonMap` (Masmorra Básica 2.5D) for the test arena.
 *
 * TS port of `autotile_sample` in `scripts/art/buildDungeonBasic.py` (convention: guia visual 3.3).
 * The core map has corridors touching the room floor; the door "cells" of the art convention are
 * carved out of the corridor here:
 *  - north door: arch 2x2 on the 2 face rows above the room floor + `door_n_link_*` on the row above;
 *  - south door: 1 row below the room floor; east/west doors: 1 column beside it.
 * Those cells stay walkable (collision uses `cells`), they only change what is drawn.
 */

export const DUNGEON_TILES_KEY = 'dungeon_basic_tiles';
export const DUNGEON_DOORS_KEY = 'dungeon_basic_doors';

/** Texture keys of the map sheets (T-073: one pair per biome, same frame contract). */
export interface MapSheetKeys {
  tilesKey: string;
  doorsKey: string;
}
const DEFAULT_SHEETS: MapSheetKeys = { tilesKey: DUNGEON_TILES_KEY, doorsKey: DUNGEON_DOORS_KEY };

export const DUNGEON_TILE_FRAMES = [
  'floor_0', 'floor_1', 'floor_2', 'floor_cracked', 'floor_moss', 'floor_blood',
  'wall_top', 'wall_top_s', 'wall_side_l', 'wall_side_r', 'wall_bottom',
  'corner_in_tl', 'corner_in_tr', 'corner_in_bl', 'corner_in_br',
  'corner_out_tl', 'corner_out_tr', 'corner_out_bl', 'corner_out_br',
  'wall_face_upper', 'wall_face_lower', 'wall_face_upper_cracked',
  'wall_face_lower_grate', 'door_arch_l', 'door_arch_r', 'door_open_l',
  'door_open_r', 'door_threshold_l', 'door_threshold_r', 'shadow_s',
  'shadow_l', 'shadow_r', 'shadow_corner_l', 'shadow_corner_r',
] as const;

/** `dungeon_basic_doors` (43 frames, manifest order). */
export const DUNGEON_DOOR_FRAMES = [
  'door_arch_sealed_l', 'door_arch_sealed_r', 'door_open_sealed_l', 'door_open_sealed_r',
  'door_n_link_l', 'door_n_link_r', 'door_s_l', 'door_s_r', 'door_s_sealed_l', 'door_s_sealed_r',
  'door_w_t', 'door_w_b', 'door_w_sealed_t', 'door_w_sealed_b',
  'door_e_t', 'door_e_b', 'door_e_sealed_t', 'door_e_sealed_b',
  'wall_face_upper_end_l', 'wall_face_upper_end_r', 'wall_face_upper_end_lr',
  'wall_face_lower_end_l', 'wall_face_lower_end_r', 'wall_face_lower_end_lr',
  'cap_ns', 'cap_ew', 'cap_nes', 'cap_esw', 'cap_nsw', 'cap_new', 'cap_nesw',
  'cap_n_dse', 'cap_n_dsw', 'cap_s_dne', 'cap_s_dnw', 'cap_e_dnw', 'cap_e_dsw',
  'cap_w_dne', 'cap_w_dse', 'cap_dne_dnw', 'cap_dse_dsw', 'cap_dne_dse', 'cap_dnw_dsw',
] as const;

export type DungeonSheet = 'tiles' | 'doors';
export interface TileRef {
  sheet: DungeonSheet;
  frame: string;
}
/** A drawn door cell; the scene swaps `open` / `sealed` at runtime. */
export interface DoorCell {
  doorId: number;
  col: number;
  row: number;
  open: TileRef;
  sealed: TileRef;
}
export interface AutotileLayout {
  cols: number;
  rows: number;
  /** Base layer per cell (null = nothing drawn, background shows). */
  base: Array<TileRef | null>;
  /** Shadow overlay per floor cell. */
  overlay: Array<TileRef | null>;
  doorCells: DoorCell[];
  /** Cap combinations without a frame (fell back to a simpler cap). */
  capMisses: number;
}

const tiles = (frame: string): TileRef => ({ sheet: 'tiles', frame });
const doors = (frame: string): TileRef => ({ sheet: 'doors', frame });

// (edges n,e,s,w ; sorted dots) -> frame. Same table as CAP_LOOKUP in buildDungeonBasic.py.
const CAP_LOOKUP = new Map<string, TileRef>([
  ['|', tiles('wall_top')],
  ['s|', tiles('wall_top_s')],
  ['e|', tiles('wall_side_l')],
  ['w|', tiles('wall_side_r')],
  ['n|', tiles('wall_bottom')],
  ['|se', tiles('corner_in_tl')],
  ['|sw', tiles('corner_in_tr')],
  ['|ne', tiles('corner_in_bl')],
  ['|nw', tiles('corner_in_br')],
  ['nw|', tiles('corner_out_tl')],
  ['ne|', tiles('corner_out_tr')],
  ['sw|', tiles('corner_out_bl')],
  ['es|', tiles('corner_out_br')],
]);
const CAP_COMBOS: Array<[string, string[]]> = [
  ['ns', []], ['ew', []], ['nes', []], ['esw', []], ['nsw', []], ['new', []], ['nesw', []],
  ['n', ['se']], ['n', ['sw']], ['s', ['ne']], ['s', ['nw']],
  ['e', ['nw']], ['e', ['sw']], ['w', ['ne']], ['w', ['se']],
  ['', ['ne', 'nw']], ['', ['se', 'sw']], ['', ['ne', 'se']], ['', ['nw', 'sw']],
];
for (const [e, d] of CAP_COMBOS) {
  const name = 'cap_' + [...(e ? [e] : []), ...d.map((x) => 'd' + x)].join('_');
  CAP_LOOKUP.set(`${e}|${[...d].sort().join(',')}`, doors(name));
}

type DoorKind = 'side' | 'n_arch' | 'n_open' | 'n_link';
interface DoorSlot {
  doorId: number;
  kind: DoorKind;
  open: TileRef;
  sealed: TileRef;
}

/** Door cells carved from the corridor, keyed by cell index. */
function collectDoorSlots(map: DungeonMap): Map<number, DoorSlot> {
  const { cols, rows, cells } = map;
  const out = new Map<number, DoorSlot>();
  const nonVoid = (c: number, r: number) =>
    c >= 0 && r >= 0 && c < cols && r < rows && cells[r * cols + c] !== MAP_CELL_VOID;
  const put = (c: number, r: number, slot: DoorSlot) => {
    if (c < 0 || r < 0 || c >= cols || r >= rows) return;
    const k = r * cols + c;
    if (!out.has(k)) out.set(k, slot);
  };
  for (const d of map.doors) {
    const id = d.id;
    switch (d.side) {
      case 's':
        for (const [dx, lr] of [[0, 'l'], [1, 'r']] as const) {
          put(d.col + dx, d.row + 1, { doorId: id, kind: 'side', open: doors(`door_s_${lr}`), sealed: doors(`door_s_sealed_${lr}`) });
        }
        break;
      case 'e':
      case 'w': {
        const c = d.side === 'e' ? d.col + 1 : d.col - 1;
        for (const [dy, tb] of [[0, 't'], [1, 'b']] as const) {
          put(c, d.row + dy, { doorId: id, kind: 'side', open: doors(`door_${d.side}_${tb}`), sealed: doors(`door_${d.side}_sealed_${tb}`) });
        }
        break;
      }
      default:
        for (const [dx, lr] of [[0, 'l'], [1, 'r']] as const) {
          const c = d.col + dx;
          put(c, d.row - 1, { doorId: id, kind: 'n_open', open: tiles(`door_open_${lr}`), sealed: doors(`door_open_sealed_${lr}`) });
          put(c, d.row - 2, { doorId: id, kind: 'n_arch', open: tiles(`door_arch_${lr}`), sealed: doors(`door_arch_sealed_${lr}`) });
          if (nonVoid(c, d.row - 3)) {
            put(c, d.row - 3, { doorId: id, kind: 'n_link', open: doors(`door_n_link_${lr}`), sealed: doors(`door_n_link_${lr}`) });
          }
        }
    }
  }
  return out;
}

/** Port of `autotile_sample` (buildDungeonBasic.py) over the whole map. */
export function autotileDungeonMap(map: DungeonMap): AutotileLayout {
  const W = map.cols;
  const H = map.rows;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const slots = collectDoorSlots(map);
  const slotAt = (x: number, y: number) => (inb(x, y) ? slots.get(y * W + x) : undefined);
  const isSideDoor = (x: number, y: number) => slotAt(x, y)?.kind === 'side';
  const isNorth = (x: number, y: number) => {
    const s = slotAt(x, y);
    return !!s && s.kind !== 'side';
  };
  // Real floor for drawing: walkable cells that are not carved into door art.
  const F = (x: number, y: number) =>
    inb(x, y) && map.cells[y * W + x] !== MAP_CELL_VOID && !slots.has(y * W + x);

  const face = new Uint8Array(W * H); // 0 none, 1 lower, 2 upper
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (F(x, y) || isSideDoor(x, y)) continue;
      if (F(x, y + 1)) face[y * W + x] = 1;
      else if (!isSideDoor(x, y + 1) && F(x, y + 2)) face[y * W + x] = 2;
    }
  }
  const isFace = (x: number, y: number) => inb(x, y) && face[y * W + x] !== 0;
  const R = (x: number, y: number) => F(x, y) || isFace(x, y);
  const isWall = (x: number, y: number) => !F(x, y) && !isSideDoor(x, y);

  // Plain wall tops far from everything are left undrawn (black background).
  const near = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!(R(x, y) || slots.has(y * W + x))) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (inb(x + dx, y + dy)) near[(y + dy) * W + x + dx] = 1;
        }
      }
    }
  }

  const base: Array<TileRef | null> = new Array(W * H).fill(null);
  const overlay: Array<TileRef | null> = new Array(W * H).fill(null);
  const doorCells: DoorCell[] = [];
  let capMisses = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      const slot = slots.get(k);
      if (slot) {
        if (slot.kind === 'n_link') {
          base[k] = slot.open;
        } else {
          doorCells.push({ doorId: slot.doorId, col: x, row: y, open: slot.open, sealed: slot.sealed });
          base[k] = slot.open;
        }
        continue;
      }
      if (F(x, y)) {
        const h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) & 0xffff;
        let fname = ['floor_0', 'floor_1', 'floor_2'][h % 3];
        if (h % 23 === 0) fname = 'floor_cracked';
        else if (h % 29 === 0) fname = 'floor_moss';
        else if (h % 37 === 0) fname = 'floor_blood';
        const above = slotAt(x, y - 1);
        if (above && above.kind === 'n_open') {
          fname = above.open.frame.endsWith('_l') ? 'door_threshold_l' : 'door_threshold_r';
        }
        base[k] = tiles(fname);
        const nFace = isFace(x, y - 1) || isNorth(x, y - 1);
        const wW = isWall(x - 1, y);
        const eW = isWall(x + 1, y);
        overlay[k] =
          nFace && wW ? tiles('shadow_corner_l')
          : nFace && eW ? tiles('shadow_corner_r')
          : nFace ? tiles('shadow_s')
          : wW ? tiles('shadow_l')
          : eW ? tiles('shadow_r')
          : null;
        continue;
      }
      if (face[k]) {
        const kind = face[k] === 1 ? 'lower' : 'upper';
        const end = (F(x - 1, y) ? 'l' : '') + (F(x + 1, y) ? 'r' : '');
        if (end) {
          base[k] = doors(`wall_face_${kind}_end_${end}`);
        } else {
          const h = (x * 31 + y * 17) % 19;
          let name = `wall_face_${kind}`;
          if (kind === 'upper' && h === 3) name = 'wall_face_upper_cracked';
          else if (kind === 'lower' && h === 7) name = 'wall_face_lower_grate';
          base[k] = tiles(name);
        }
        continue;
      }
      const n = R(x, y - 1), e = R(x + 1, y), s = R(x, y + 1), w = R(x - 1, y);
      const edges = (n ? 'n' : '') + (e ? 'e' : '') + (s ? 's' : '') + (w ? 'w' : '');
      const dots: string[] = [];
      for (const [dn, dx, dy, a, b] of [
        ['ne', 1, -1, n, e], ['nw', -1, -1, n, w], ['se', 1, 1, s, e], ['sw', -1, 1, s, w],
      ] as const) {
        if (R(x + dx, y + dy) && !a && !b) dots.push(dn);
      }
      if (!edges && !dots.length && !near[k]) continue;
      let ref = CAP_LOOKUP.get(`${edges}|${dots.sort().join(',')}`);
      if (!ref) {
        capMisses++;
        ref = CAP_LOOKUP.get(`${edges}|`) ?? tiles('wall_top');
      }
      base[k] = ref;
    }
  }
  return { cols: W, rows: H, base, overlay, doorCells, capMisses };
}

/** Rect (world px) covered by a door's drawn cells; blocks walking while the door is sealed. */
export function doorBlockRect(d: MapDoor): { x: number; y: number; w: number; h: number } {
  const T = MAP_TILE;
  switch (d.side) {
    case 'n': return { x: d.col * T, y: (d.row - 3) * T, w: 2 * T, h: 3 * T };
    case 's': return { x: d.col * T, y: (d.row + 1) * T, w: 2 * T, h: T };
    case 'e': return { x: (d.col + 1) * T, y: d.row * T, w: T, h: 2 * T };
    default: return { x: (d.col - 1) * T, y: d.row * T, w: T, h: 2 * T };
  }
}

/** Visual centre (world px) of a door, for the seal glow. */
export function doorCenter(d: MapDoor): { x: number; y: number } {
  const T = MAP_TILE;
  switch (d.side) {
    case 'n': return { x: (d.col + 1) * T, y: (d.row - 1) * T };
    case 's': return { x: (d.col + 1) * T, y: (d.row + 1.5) * T };
    case 'e': return { x: (d.col + 1.5) * T, y: (d.row + 1) * T };
    default: return { x: (d.col - 0.5) * T, y: (d.row + 1) * T };
  }
}

/** Fallback (no doors sheet for the theme): closest frame of the tiles sheet. */
function doorFallback(frame: string): string {
  if (frame.startsWith('door_arch_sealed_')) return frame.replace('_sealed', '');
  if (frame.startsWith('door_open_sealed_')) return 'wall_face_lower';
  if (frame.startsWith('wall_face_upper_end')) return 'wall_face_upper';
  if (frame.startsWith('wall_face_lower_end')) return 'wall_face_lower';
  if (frame === 'door_s_sealed_l' || frame === 'door_s_sealed_r') return 'wall_bottom';
  if (frame.startsWith('door_w_sealed')) return 'wall_side_r';
  if (frame.startsWith('door_e_sealed')) return 'wall_side_l';
  if (frame.startsWith('door_s_') || frame.startsWith('door_w_') || frame.startsWith('door_e_')) return 'floor_0';
  return 'wall_top';
}

/**
 * Static 2-layer tilemap (base + shadows). Phaser culls tilemap layers to the camera, so even the
 * giant map costs only the visible tiles per frame. Door cells are swapped with `setDoorSealed`.
 */
export class DungeonMapView {
  readonly tilemap: Phaser.Tilemaps.Tilemap;
  readonly baseLayer: Phaser.Tilemaps.TilemapLayer;
  readonly overlayLayer: Phaser.Tilemaps.TilemapLayer;
  private readonly doorCellsById = new Map<number, DoorCell[]>();
  private readonly hasDoorSheet: boolean;
  private readonly doorsGid0: number;

  constructor(
    scene: Phaser.Scene,
    readonly layout: AutotileLayout,
    depth: number,
    sheets: MapSheetKeys = DEFAULT_SHEETS
  ) {
    const T = MAP_TILE;
    this.tilemap = scene.make.tilemap({ tileWidth: T, tileHeight: T, width: layout.cols, height: layout.rows });
    const tsTiles = this.tilemap.addTilesetImage('map_tiles', sheets.tilesKey, T, T, 0, 0, 1);
    this.hasDoorSheet =
      scene.textures.exists(sheets.doorsKey) &&
      scene.textures.get(sheets.doorsKey).has(String(DUNGEON_DOOR_FRAMES.length - 1));
    this.doorsGid0 = 1 + DUNGEON_TILE_FRAMES.length;
    const tsDoors = this.hasDoorSheet
      ? this.tilemap.addTilesetImage('map_doors', sheets.doorsKey, T, T, 0, 0, this.doorsGid0)
      : null;
    const sets = [tsTiles, tsDoors].filter((s): s is Phaser.Tilemaps.Tileset => !!s);
    this.baseLayer = this.tilemap.createBlankLayer('base', sets, 0, 0) as Phaser.Tilemaps.TilemapLayer;
    this.overlayLayer = this.tilemap.createBlankLayer('shadows', sets, 0, 0) as Phaser.Tilemaps.TilemapLayer;
    this.baseLayer.setDepth(depth);
    this.overlayLayer.setDepth(depth + 0.05);

    const W = layout.cols;
    const baseData: number[][] = [];
    const overData: number[][] = [];
    for (let y = 0; y < layout.rows; y++) {
      const b: number[] = [];
      const o: number[] = [];
      for (let x = 0; x < W; x++) {
        const k = y * W + x;
        b.push(this.gid(layout.base[k]));
        o.push(this.gid(layout.overlay[k]));
      }
      baseData.push(b);
      overData.push(o);
    }
    this.baseLayer.putTilesAt(baseData, 0, 0, false);
    this.overlayLayer.putTilesAt(overData, 0, 0, false);
    for (const cell of layout.doorCells) {
      const list = this.doorCellsById.get(cell.doorId) ?? [];
      list.push(cell);
      this.doorCellsById.set(cell.doorId, list);
    }
  }

  gid(ref: TileRef | null): number {
    if (!ref) return -1;
    if (ref.sheet === 'doors') {
      if (this.hasDoorSheet) {
        const i = (DUNGEON_DOOR_FRAMES as readonly string[]).indexOf(ref.frame);
        if (i >= 0) return this.doorsGid0 + i;
      }
      return 1 + (DUNGEON_TILE_FRAMES as readonly string[]).indexOf(doorFallback(ref.frame));
    }
    const i = (DUNGEON_TILE_FRAMES as readonly string[]).indexOf(ref.frame);
    return i >= 0 ? 1 + i : -1;
  }

  setDoorSealed(doorId: number, sealed: boolean): void {
    for (const c of this.doorCellsById.get(doorId) ?? []) {
      this.baseLayer.putTileAt(this.gid(sealed ? c.sealed : c.open), c.col, c.row, false);
    }
  }

  destroy(): void {
    this.tilemap.destroy();
  }
}
