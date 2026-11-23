// Renders DungeonMap layouts (src/core/dungeon/DungeonMap.ts) to a PNG, for visual review (T-127 / BRF-136).
//
// Usage:
//   node scripts/dev/renderDungeonMap.mjs                         -> assets/mockups/preview_m8_map_layouts.png
//                                                                    (6 seeds of mode "rooms" + 2 of mode "giant")
//   node scripts/dev/renderDungeonMap.mjs --mode giant --seed 7 --out C:/tmp/map.png   -> a single map
//
// Pure Node (zlib + a hand-written PNG encoder). The TS module is loaded through Vite's SSR loader
// (Vite is already a dev dependency), so no new dependency is needed.
//
// Legend: dark grey = wall (lighter band = 3-row north wall), green = wave-1 room, blue = wave-2 room,
// red = boss room, grey = empty passage room, tan = corridor, yellow = door, outlined boxes = zone
// triggers, brown = obstacles (feet space), light dots = decor props, orange = torches,
// cyan = hero start, coloured dots = spawns (green slime, grey wolf, white skeleton, gold archer, red boss).

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- canvas
class Canvas {
  constructor(w, h, bg) {
    this.w = w;
    this.h = h;
    this.px = Buffer.alloc(w * h * 3);
    this.fill(0, 0, w, h, bg);
  }
  fill(x, y, w, h, color, clip) {
    const [r, g, b] = hex(color);
    let x0 = Math.round(x), y0 = Math.round(y), x1 = Math.round(x + w), y1 = Math.round(y + h);
    if (clip) {
      x0 = Math.max(x0, clip.x); y0 = Math.max(y0, clip.y);
      x1 = Math.min(x1, clip.x + clip.w); y1 = Math.min(y1, clip.y + clip.h);
    }
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(this.w, x1); y1 = Math.min(this.h, y1);
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const i = (yy * this.w + xx) * 3;
        this.px[i] = r; this.px[i + 1] = g; this.px[i + 2] = b;
      }
    }
  }
  outline(x, y, w, h, color, clip) {
    this.fill(x, y, w, 1, color, clip);
    this.fill(x, y + h - 1, w, 1, color, clip);
    this.fill(x, y, 1, h, color, clip);
    this.fill(x + w - 1, y, 1, h, color, clip);
  }
  text(x, y, str, color, scale = 2) {
    let cx = x;
    for (const ch of str.toUpperCase()) {
      const g = FONT[ch] ?? FONT[' '];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 3; c++) if (g[r][c] === '1') this.fill(cx + c * scale, y + r * scale, scale, scale, color);
      }
      cx += 4 * scale;
    }
  }
}
function hex(c) {
  const v = parseInt(c.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

const FONT = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '001', '001', '001'], '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'], A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'], D: ['110', '101', '101', '101', '110'], E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'], G: ['011', '100', '101', '101', '011'], H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'], L: ['100', '100', '100', '100', '111'], M: ['101', '111', '111', '101', '101'],
  N: ['110', '101', '101', '101', '101'], O: ['010', '101', '101', '101', '010'], P: ['110', '101', '110', '100', '100'],
  R: ['110', '101', '110', '101', '101'], S: ['011', '100', '010', '001', '110'], T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'], V: ['101', '101', '101', '101', '010'], W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'], Z: ['111', '001', '010', '100', '111'], ' ': ['000', '000', '000', '000', '000'],
  ':': ['000', '010', '000', '010', '000'], '/': ['001', '001', '010', '100', '100'], '-': ['000', '000', '111', '000', '000'],
  '=': ['000', '111', '000', '111', '000'], '.': ['000', '000', '000', '000', '010'], ',': ['000', '000', '000', '010', '100'],
};

// ---------------------------------------------------------------- map drawing
const COLORS = {
  bg: '#0b0b10', wallN: '#3a3a46', wallS: '#26262e', passage: '#5d5d68', corridor: '#a08458', door: '#ffd24a',
  zone: ['#3f7d4a', '#3c5f8f', '#8a3b3b', '#7a5a9a', '#3f8a86'], zoneLine: ['#8cf09e', '#8fb8ff', '#ff8a8a', '#d6b0ff', '#8ff0ea'],
  giantFloor: '#5d5d68', obstacle: '#7a4f28', decor: '#b8b8b8', torch: '#ff8c1a', hero: '#00e5ff',
  spawn: { slime: '#7cfc00', wolf: '#c0c0c0', skeleton: '#f4f4e6', skeleton_archer: '#e8c060', skeleton_chief: '#ff2a2a' },
};
const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };

function bendsOf(map, cor) {
  const a = map.doors[cor.fromDoorId], b = map.doors[cor.toDoorId];
  if (OPP[a.side] !== b.side) return 1;
  const aligned = a.side === 'n' || a.side === 's' ? a.col === b.col : a.row === b.row;
  return aligned ? 0 : 2;
}

function drawMap(cv, map, panel, T) {
  const labelH = 34;
  const area = { x: panel.x + 6, y: panel.y + labelH, w: panel.w - 12, h: panel.h - labelH - 6 };
  const s = Math.max(1, Math.min(area.w / map.cols, area.h / map.rows));
  const ox = area.x + Math.floor((area.w - s * map.cols) / 2);
  const oy = area.y + Math.floor((area.h - s * map.rows) / 2);
  const clip = panel;
  const cellAt = (c, r) => (c >= 0 && r >= 0 && c < map.cols && r < map.rows ? map.cells[r * map.cols + c] : 0);
  const zoneOfRoom = new Map();
  map.zones.forEach((z, i) => { if (map.mode === 'rooms' && z.floorRoomId !== null) zoneOfRoom.set(z.floorRoomId, i); });

  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const v = map.cells[r * map.cols + c];
      let color = null;
      if (v === 1) {
        const rid = map.roomIdAt[r * map.cols + c];
        color = map.mode === 'giant' ? COLORS.giantFloor : zoneOfRoom.has(rid) ? COLORS.zone[zoneOfRoom.get(rid) % 5] : COLORS.passage;
      } else if (v === 2) {
        color = COLORS.corridor;
      } else if (cellAt(c, r + 1) || cellAt(c, r + 2) || cellAt(c, r + 3)) {
        color = COLORS.wallN;
      } else {
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) if (cellAt(c + dx, r + dy)) near = true;
        if (near) color = COLORS.wallS;
      }
      if (color) cv.fill(ox + c * s, oy + r * s, Math.ceil(s), Math.ceil(s), color, clip);
    }
  }
  const P = (v) => (v * s) / T; // world px -> panel px
  map.zones.forEach((z, i) => {
    for (const t of z.trigger) cv.outline(ox + P(t.x), oy + P(t.y), Math.max(2, P(t.w)), Math.max(2, P(t.h)), COLORS.zoneLine[i % 5], clip);
  });
  for (const d of map.doors) {
    const w = d.side === 'n' || d.side === 's' ? 2 : 1;
    const h = d.side === 'n' || d.side === 's' ? 1 : 2;
    cv.fill(ox + d.col * s, oy + d.row * s, w * s, h * s, COLORS.door, clip);
  }
  for (const o of map.obstacles) cv.fill(ox + P(o.x), oy + P(o.y), Math.max(1, P(o.w)), Math.max(1, P(o.h)), COLORS.obstacle, clip);
  for (const p of map.props) {
    if (p.kind === 'floor' && ['bones', 'skulls_candle', 'chain'].includes(p.name)) {
      cv.fill(ox + P(p.x + 12), oy + P(p.y + 12), Math.max(1, P(8)), Math.max(1, P(8)), COLORS.decor, clip);
    }
  }
  for (const t of map.torches) cv.fill(ox + t.col * s + s / 4, oy + t.row * s, Math.max(1, s / 2), Math.max(1, s), COLORS.torch, clip);
  const dot = (x, y, r, color) => cv.fill(ox + P(x) - r, oy + P(y) - r, 2 * r, 2 * r, color, clip);
  for (const z of map.zones) {
    for (const sp of z.spawns) {
      const boss = sp.defId === 'skeleton_chief';
      dot(sp.x, sp.y + 30, boss ? 4 : 2, COLORS.spawn[sp.defId] ?? '#ff00ff');
    }
  }
  dot(map.heroStart.x, map.heroStart.y + 30, 4, COLORS.hero);

  cv.text(panel.x + 8, panel.y + 6, `${map.mode} seed ${map.seed}  ${map.cols}x${map.rows}`, '#f0f0f0', 2);
  let line2;
  if (map.mode === 'rooms') {
    const bends = map.corridors.reduce((a, c) => a + bendsOf(map, c), 0);
    const sides = [...new Set(map.doors.map((d) => d.side))].sort().join('');
    const shapes = map.rooms.map((r) => ({ rect: 'R', L: 'L', cross: 'X', compound: 'C' })[r.shape]).join('');
    line2 = `${map.rooms.length} salas ${shapes}  ${map.corridors.length} corr ${bends} curvas  lados ${sides}`;
  } else {
    const b = map.rooms[0].bounds;
    line2 = `sala ${b.cols}x${b.rows}  ${map.zones.length} zonas  ${map.obstacles.length} obst`;
  }
  cv.text(panel.x + 8, panel.y + 20, line2, '#b0b0c0', 2);
  cv.outline(panel.x, panel.y, panel.w, panel.h, '#30303a');
}

// ---------------------------------------------------------------- main
const args = parseArgs(process.argv.slice(2));
const server = await createServer({ root: ROOT, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
try {
  const mod = await server.ssrLoadModule('/src/core/dungeon/DungeonMap.ts');
  const T = mod.MAP_TILE;
  let jobs;
  if (args.seed !== undefined) {
    jobs = [{ seed: Number(args.seed), mode: args.mode ?? 'rooms' }];
  } else {
    jobs = [101, 202, 303, 404, 505, 606].map((seed) => ({ seed, mode: 'rooms' }))
      .concat([707, 808].map((seed) => ({ seed, mode: 'giant' })));
  }
  const perRow = jobs.length === 1 ? 1 : 4;
  const PW = jobs.length === 1 ? 1200 : 600, PH = jobs.length === 1 ? 900 : 480;
  const rows = Math.ceil(jobs.length / perRow);
  const cv = new Canvas(perRow * PW, rows * PH, COLORS.bg);
  jobs.forEach((job, i) => {
    const map = mod.generateDungeonMap(job.seed, { mode: job.mode });
    drawMap(cv, map, { x: (i % perRow) * PW, y: Math.floor(i / perRow) * PH, w: PW, h: PH }, T);
  });
  const out = resolve(ROOT, args.out ?? 'assets/mockups/preview_m8_map_layouts.png');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, encodePng(cv.w, cv.h, cv.px));
  console.log(`wrote ${out} (${cv.w}x${cv.h}, ${jobs.length} maps)`);
} finally {
  await server.close();
}
