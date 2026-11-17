import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT_DIR = path.resolve('public/assets/sprites');

// --- Minimal Pure Node.js RGBA PNG Encoder ---
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // Filter type 0 (None)
    rgba.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Canvas Helper ---
function parseHex(hex, alpha = 255) {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, alpha];
}

class PixelCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4, 0);
  }

  setPixel(x, y, hex, alpha = 255) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return;
    const [r, g, b, a] = parseHex(hex, alpha);
    const idx = (iy * this.width + ix) * 4;
    this.data[idx] = r;
    this.data[idx + 1] = g;
    this.data[idx + 2] = b;
    this.data[idx + 3] = a;
  }

  fillRect(x, y, w, h, hex, alpha = 255) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.setPixel(x + dx, y + dy, hex, alpha);
      }
    }
  }

  fillCircle(cx, cy, r, hex, alpha = 255) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) {
          this.setPixel(x, y, hex, alpha);
        }
      }
    }
  }

  drawLine(x0, y0, x1, y1, hex, alpha = 255) {
    let cx = Math.floor(x0);
    let cy = Math.floor(y0);
    const tx = Math.floor(x1);
    const ty = Math.floor(y1);
    const dx = Math.abs(tx - cx);
    const sx = cx < tx ? 1 : -1;
    const dy = -Math.abs(ty - cy);
    const sy = cy < ty ? 1 : -1;
    let err = dx + dy;
    while (true) {
      this.setPixel(cx, cy, hex, alpha);
      if (cx === tx && cy === ty) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        cx += sx;
      }
      if (e2 <= dx) {
        err += dx;
        cy += sy;
      }
    }
  }

  save(filePath) {
    fs.writeFileSync(filePath, encodePNG(this.width, this.height, this.data));
  }
}

// --- 1. Wraith Warrior (128x32, 4 frames 32x32: idle0, idle1, attack, dash) ---
function generateWraithWarrior() {
  const c = new PixelCanvas(128, 32);

  function drawBaseWraith(ox, bobY = 0, leanX = 0) {
    // Spectral aura under feet
    c.fillRect(ox + 10, 27, 12, 2, '#0284c7', 140);
    c.fillRect(ox + 12, 28, 8, 1, '#38bdf8', 200);

    // Cloak shadow & body
    c.fillRect(ox + 9 + leanX, 13 + bobY, 14, 13, '#09090b');
    c.fillRect(ox + 10 + leanX, 14 + bobY, 12, 11, '#1e1b4b');
    c.fillRect(ox + 11 + leanX, 15 + bobY, 9, 9, '#312e81');
    // Ragged cloak hem wisps
    c.setPixel(ox + 9 + leanX, 26 + bobY, '#1e1b4b');
    c.setPixel(ox + 12 + leanX, 26 + bobY, '#312e81');
    c.setPixel(ox + 16 + leanX, 26 + bobY, '#1e1b4b');
    c.setPixel(ox + 20 + leanX, 26 + bobY, '#09090b');

    // Hood & head
    c.fillRect(ox + 10 + leanX, 5 + bobY, 12, 9, '#09090b');
    c.fillRect(ox + 11 + leanX, 6 + bobY, 10, 7, '#1e1b4b');
    c.fillRect(ox + 12 + leanX, 8 + bobY, 8, 5, '#09090b');

    // Glowing spectral eyes (#38bdf8)
    c.fillRect(ox + 13 + leanX, 10 + bobY, 2, 2, '#38bdf8');
    c.setPixel(ox + 14 + leanX, 10 + bobY, '#e0f2fe');
    c.fillRect(ox + 17 + leanX, 10 + bobY, 2, 2, '#38bdf8');
    c.setPixel(ox + 18 + leanX, 10 + bobY, '#e0f2fe');

    // Spectral chest core
    c.fillRect(ox + 14 + leanX, 16 + bobY, 4, 3, '#0284c7');
    c.fillRect(ox + 15 + leanX, 17 + bobY, 2, 1, '#38bdf8');
  }

  // Frame 0: idle0
  drawBaseWraith(0, 0, 0);
  // Upright spectral blade on right hand
  c.fillRect(22, 18, 4, 2, '#71717a'); // crossguard
  c.fillRect(23, 8, 2, 10, '#38bdf8');
  c.drawLine(24, 7, 24, 17, '#e0f2fe');

  // Frame 1: idle1 (bobbing + flame flicker)
  drawBaseWraith(32, 1, 0);
  c.fillRect(32 + 22, 19, 4, 2, '#71717a');
  c.fillRect(32 + 23, 8, 2, 11, '#38bdf8');
  c.drawLine(32 + 24, 6, 32 + 24, 17, '#e0f2fe');
  c.setPixel(32 + 22, 10, '#38bdf8');
  c.setPixel(32 + 25, 13, '#38bdf8');

  // Frame 2: attack (lunge + wide spectral slash arc)
  drawBaseWraith(64, 0, 2);
  // Horizontal extended blade + slash arc
  c.fillRect(64 + 20, 15, 11, 2, '#e0f2fe');
  c.fillRect(64 + 19, 14, 11, 4, '#38bdf8', 220);
  c.drawLine(64 + 24, 6, 64 + 30, 14, '#38bdf8');
  c.drawLine(64 + 26, 7, 64 + 31, 15, '#e0f2fe');
  c.drawLine(64 + 24, 25, 64 + 30, 17, '#38bdf8');
  c.drawLine(64 + 26, 24, 64 + 31, 16, '#e0f2fe');

  // Frame 3: dash (spectral streak & afterimages)
  c.fillRect(96 + 2, 12, 10, 10, '#0284c7', 110);
  c.fillRect(96 + 6, 10, 12, 14, '#38bdf8', 160);
  drawBaseWraith(96, 0, 4);
  c.fillRect(96 + 3, 14, 24, 3, '#38bdf8');
  c.fillRect(96 + 8, 15, 20, 1, '#e0f2fe');

  return c;
}

// --- 2. Abyssal Slime (64x32, 2 frames 32x32: idle0, idle1) ---
function generateAbyssalSlime() {
  const c = new PixelCanvas(64, 32);

  // Frame 0: tall dome
  c.fillCircle(16, 20, 9, '#450a0a');
  c.fillCircle(16, 20, 8, '#991b1b');
  c.fillCircle(15, 19, 6, '#ef4444');
  c.fillRect(8, 25, 16, 3, '#450a0a');
  c.fillRect(9, 24, 14, 3, '#991b1b');
  // Specular & eyes
  c.fillRect(11, 14, 3, 2, '#fca5a5');
  c.fillRect(12, 19, 2, 2, '#f97316');
  c.fillRect(18, 19, 2, 2, '#f97316');
  c.setPixel(12, 19, '#fef08a');
  c.setPixel(18, 19, '#fef08a');

  // Frame 1: squashed wide + droplets
  c.fillCircle(32 + 16, 22, 9, '#450a0a');
  c.fillRect(32 + 6, 19, 20, 9, '#450a0a');
  c.fillRect(32 + 7, 18, 18, 9, '#991b1b');
  c.fillRect(32 + 9, 17, 14, 8, '#ef4444');
  c.fillRect(32 + 10, 16, 4, 2, '#fca5a5');
  c.fillRect(32 + 11, 21, 2, 2, '#f97316');
  c.fillRect(32 + 19, 21, 2, 2, '#f97316');
  c.fillRect(32 + 5, 14, 2, 2, '#ef4444');
  c.fillRect(32 + 25, 15, 2, 2, '#ef4444');

  return c;
}

// --- 3. Bone Sentinel (64x32, 2 frames 32x32: idle0, attack) ---
function generateBoneSentinel() {
  const c = new PixelCanvas(64, 32);

  function drawSkeletonBody(ox, lean = 0) {
    // Skull outline & cranium
    c.fillRect(ox + 11 + lean, 5, 10, 9, '#09090b');
    c.fillRect(ox + 12 + lean, 6, 8, 6, '#e4e4e7');
    c.fillRect(ox + 13 + lean, 12, 6, 2, '#a1a1aa'); // jaw
    // Glowing orange eyes (#f97316)
    c.fillRect(ox + 13 + lean, 8, 2, 2, '#f97316');
    c.fillRect(ox + 17 + lean, 8, 2, 2, '#f97316');

    // Ribcage & spine
    c.fillRect(ox + 11 + lean, 15, 10, 8, '#09090b');
    c.fillRect(ox + 15 + lean, 14, 2, 10, '#a1a1aa');
    for (let ry = 16; ry <= 20; ry += 2) {
      c.fillRect(ox + 12 + lean, ry, 8, 1, '#e4e4e7');
    }

    // Pelvis & legs
    c.fillRect(ox + 12 + lean, 23, 8, 2, '#a1a1aa');
    c.fillRect(ox + 12 + lean, 25, 2, 4, '#e4e4e7');
    c.fillRect(ox + 18 + lean, 25, 2, 4, '#e4e4e7');
  }

  // Frame 0: idle0
  drawSkeletonBody(0, 0);
  // Shield on left, iron sword upright on right
  c.fillRect(7, 15, 4, 8, '#3f3f46');
  c.fillRect(8, 16, 2, 6, '#71717a');
  c.fillRect(22, 9, 2, 11, '#e4e4e7');
  c.fillRect(21, 18, 4, 2, '#71717a');

  // Frame 1: attack (forward cleave + orange ember arc)
  drawSkeletonBody(32, 2);
  c.fillRect(32 + 21, 14, 9, 3, '#e4e4e7');
  c.drawLine(32 + 22, 6, 32 + 30, 15, '#f97316');
  c.drawLine(32 + 24, 6, 32 + 31, 16, '#facc15');
  c.drawLine(32 + 23, 24, 32 + 30, 16, '#f97316');

  return c;
}

// --- 4. Infernal Warden (128x64, 2 frames 64x64: idle, slam) ---
function generateInfernalWarden() {
  const c = new PixelCanvas(128, 64);

  function drawBossBody(ox, yOff = 0) {
    // Great curved horns
    c.fillRect(ox + 14, 6 + yOff, 6, 10, '#27272a');
    c.fillRect(ox + 10, 4 + yOff, 5, 6, '#52525b');
    c.fillRect(ox + 44, 6 + yOff, 6, 10, '#27272a');
    c.fillRect(ox + 49, 4 + yOff, 5, 6, '#52525b');

    // Armored torso & demonic shoulders
    c.fillRect(ox + 14, 18 + yOff, 36, 32, '#09090b');
    c.fillRect(ox + 16, 20 + yOff, 32, 28, '#7f1d1d');
    c.fillRect(ox + 18, 22 + yOff, 28, 22, '#dc2626');

    // Shoulder pauldrons with spikes
    c.fillRect(ox + 8, 18 + yOff, 10, 12, '#27272a');
    c.fillRect(ox + 46, 18 + yOff, 10, 12, '#27272a');
    c.fillRect(ox + 10, 20 + yOff, 6, 8, '#dc2626');
    c.fillRect(ox + 48, 20 + yOff, 6, 8, '#dc2626');

    // Demon head & blazing crown
    c.fillRect(ox + 22, 10 + yOff, 20, 14, '#09090b');
    c.fillRect(ox + 24, 12 + yOff, 16, 10, '#dc2626');
    c.fillRect(ox + 26, 15 + yOff, 4, 3, '#f97316');
    c.fillRect(ox + 34, 15 + yOff, 4, 3, '#f97316');
    c.setPixel(ox + 27, 16 + yOff, '#facc15');
    c.setPixel(ox + 35, 16 + yOff, '#facc15');

    // Molten chest core & runes (#f97316 / #facc15)
    c.fillCircle(ox + 32, 32 + yOff, 6, '#f97316');
    c.fillCircle(ox + 32, 32 + yOff, 3, '#facc15');

    // Heavy greaves
    c.fillRect(ox + 18, 48 + yOff, 10, 10, '#27272a');
    c.fillRect(ox + 36, 48 + yOff, 10, 10, '#27272a');
  }

  // Frame 0: idle (holding magma warhammer high)
  drawBossBody(0, 0);
  c.fillRect(52, 12, 3, 42, '#52525b');
  c.fillRect(46, 8, 14, 10, '#27272a');
  c.fillRect(48, 10, 10, 6, '#f97316');

  // Frame 1: slam (crouched + magma shockwave at ground)
  drawBossBody(64, 3);
  c.fillRect(64 + 48, 26, 4, 30, '#52525b');
  c.fillRect(64 + 42, 48, 18, 10, '#dc2626');
  c.fillRect(64 + 44, 50, 14, 6, '#f97316');
  // Ground lava wave
  c.fillRect(64 + 6, 56, 52, 5, '#dc2626');
  c.fillRect(64 + 10, 57, 44, 3, '#f97316');
  c.fillRect(64 + 16, 58, 32, 1, '#facc15');

  return c;
}

// --- 5. Dungeon Tiles (64x16, 4 tiles 16x16) ---
function generateDungeonTiles() {
  const c = new PixelCanvas(64, 16);

  // Tile 0 (0..15): Dark stone floor
  c.fillRect(0, 0, 16, 16, '#14141b');
  c.fillRect(1, 1, 6, 6, '#181822');
  c.fillRect(8, 1, 7, 6, '#16161f');
  c.fillRect(1, 8, 7, 7, '#16161f');
  c.fillRect(9, 8, 6, 7, '#181822');
  c.drawLine(0, 7, 15, 7, '#09090b');
  c.drawLine(7, 0, 7, 7, '#09090b');
  c.drawLine(8, 7, 8, 15, '#09090b');

  // Tile 1 (16..31): Cracked floor with moss/ash
  c.fillRect(16, 0, 16, 16, '#14141b');
  c.drawLine(16 + 2, 2, 16 + 9, 8, '#09090b');
  c.drawLine(16 + 9, 8, 16 + 13, 6, '#09090b');
  c.drawLine(16 + 9, 8, 16 + 7, 13, '#09090b');
  c.fillRect(16 + 3, 11, 3, 2, '#272730'); // ash
  c.fillRect(16 + 11, 3, 2, 2, '#1e3a2f'); // dark moss
  c.fillRect(16 + 8, 9, 2, 2, '#1e3a2f');

  // Tile 2 (32..47): Abyssal brick wall
  c.fillRect(32, 0, 16, 16, '#09090b');
  c.fillRect(32, 0, 16, 2, '#3f3f4e'); // top bevel highlight
  c.fillRect(32 + 1, 2, 6, 5, '#272730');
  c.fillRect(32 + 8, 2, 7, 5, '#272730');
  c.fillRect(32, 8, 4, 6, '#1f1f29');
  c.fillRect(32 + 5, 8, 6, 6, '#272730');
  c.fillRect(32 + 12, 8, 4, 6, '#1f1f29');

  // Tile 3 (48..63): Spectral blue portal
  c.fillRect(48, 0, 16, 16, '#14141b');
  c.fillCircle(48 + 8, 8, 7, '#0c4a6e');
  c.fillCircle(48 + 8, 8, 5, '#0284c7');
  c.fillCircle(48 + 8, 8, 3, '#38bdf8');
  c.fillCircle(48 + 8, 8, 1.5, '#e0f2fe');

  return c;
}

// --- 6. Soul Orb (16x16, 1 frame 16x16) ---
function generateSoulOrb() {
  const c = new PixelCanvas(16, 16);
  c.fillCircle(8, 8, 6, '#0284c7', 140);
  c.fillCircle(8, 8, 4.5, '#38bdf8', 230);
  c.fillCircle(8, 8, 2.5, '#e0f2fe', 255);
  c.setPixel(8, 2, '#38bdf8');
  c.setPixel(7, 1, '#e0f2fe');
  c.setPixel(4, 5, '#e0f2fe');
  return c;
}

// --- 7. Loot Icons (64x16, 4 frames 16x16: icon_weapon, icon_armor, icon_amulet, icon_ring) ---
function generateLootIcons() {
  const c = new PixelCanvas(64, 16);

  // Frame 0 (ox = 0): icon_weapon (Dark Fantasy spectral/steel blade)
  {
    const ox = 0;
    // Outline along diagonal blade & hilt
    for (let i = 0; i < 8; i++) {
      const bx = ox + 12 - i;
      const by = 2 + i;
      c.fillRect(bx - 1, by - 1, 3, 3, '#09090b');
    }
    // Crossguard & grip outline
    c.fillRect(ox + 2, 8, 6, 6, '#09090b');
    c.fillRect(ox + 1, 12, 3, 3, '#09090b');
    // Blade steel + spectral edge
    for (let i = 0; i < 8; i++) {
      const bx = ox + 12 - i;
      const by = 2 + i;
      c.setPixel(bx, by, '#e4e4e7');
      c.setPixel(bx + 1, by, '#38bdf8');
      c.setPixel(bx, by + 1, '#a1a1aa');
    }
    c.setPixel(ox + 13, 2, '#e0f2fe');
    c.setPixel(ox + 12, 2, '#e0f2fe');
    // Crossguard
    c.drawLine(ox + 3, 8, ox + 7, 12, '#facc15');
    c.drawLine(ox + 3, 9, ox + 6, 12, '#71717a');
    // Grip & pommel
    c.setPixel(ox + 3, 12, '#3f3f46');
    c.setPixel(ox + 2, 13, '#facc15');
  }

  // Frame 1 (ox = 16): icon_armor (Dark iron cuirass with spectral core)
  {
    const ox = 16;
    // Dark outline
    c.fillRect(ox + 2, 2, 12, 12, '#09090b');
    c.fillRect(ox + 5, 2, 6, 2, '#09090b');
    // Neck opening cut
    c.fillRect(ox + 6, 2, 4, 2, '#000000', 0);
    // Shoulders / pauldrons
    c.fillRect(ox + 2, 3, 4, 4, '#52525b');
    c.fillRect(ox + 10, 3, 4, 4, '#52525b');
    c.fillRect(ox + 3, 3, 2, 2, '#e4e4e7');
    c.fillRect(ox + 11, 3, 2, 2, '#e4e4e7');
    // Chestplate body
    c.fillRect(ox + 4, 4, 8, 8, '#3f3f46');
    c.fillRect(ox + 5, 5, 6, 6, '#71717a');
    c.fillRect(ox + 5, 11, 6, 2, '#52525b');
    // Rib highlight & center ridge
    c.drawLine(ox + 5, 5, ox + 10, 5, '#e4e4e7');
    c.drawLine(ox + 7, 5, ox + 7, 12, '#3f3f46');
    // Spectral core gem
    c.fillRect(ox + 7, 7, 2, 2, '#38bdf8');
    c.setPixel(ox + 7, 7, '#e0f2fe');
  }

  // Frame 2 (ox = 32): icon_amulet (Pendant chain + gold bezel + crimson ruby)
  {
    const ox = 32;
    // Chain arc
    c.drawLine(ox + 4, 5, ox + 6, 2, '#a1a1aa');
    c.drawLine(ox + 6, 2, ox + 9, 2, '#e4e4e7');
    c.drawLine(ox + 9, 2, ox + 11, 5, '#a1a1aa');
    c.setPixel(ox + 5, 4, '#71717a');
    c.setPixel(ox + 10, 4, '#71717a');
    // Pendant outline
    c.fillRect(ox + 4, 6, 8, 8, '#09090b');
    c.fillRect(ox + 5, 5, 6, 10, '#09090b');
    // Gold bezel
    c.fillRect(ox + 5, 6, 6, 8, '#ca8a04');
    c.fillRect(ox + 6, 6, 4, 7, '#facc15');
    // Crimson/ruby core
    c.fillRect(ox + 6, 8, 4, 4, '#991b1b');
    c.fillRect(ox + 7, 8, 2, 3, '#ef4444');
    c.setPixel(ox + 7, 8, '#fca5a5');
  }

  // Frame 3 (ox = 48): icon_ring (Signet band + spectral gem)
  {
    const ox = 48;
    // Outer shadow ring
    c.fillCircle(ox + 8, 9, 5, '#09090b');
    // Gold/silver band
    c.fillCircle(ox + 8, 9, 4, '#ca8a04');
    c.fillCircle(ox + 8, 9, 3, '#facc15');
    // Inner hole (transparent)
    c.fillCircle(ox + 8, 9, 1.8, '#000000', 0);
    // Gem socket at top
    c.fillRect(ox + 6, 2, 4, 4, '#09090b');
    c.fillRect(ox + 7, 3, 2, 2, '#38bdf8');
    c.setPixel(ox + 7, 3, '#e0f2fe');
    c.setPixel(ox + 5, 8, '#fef08a');
  }

  return c;
}

// --- 8. Loot Drops (64x16, 4 frames 16x16: common, magic, rare, legendary) ---
function generateLootDrops() {
  const c = new PixelCanvas(64, 16);

  const tiers = [
    {
      // 0: common (#e4e4e7)
      ox: 0,
      glow: '#71717a',
      shadow: '#3f3f46',
      mid: '#a1a1aa',
      primary: '#e4e4e7',
      highlight: '#fafafa',
      flair: 0,
    },
    {
      // 1: magic (#38bdf8)
      ox: 16,
      glow: '#0284c7',
      shadow: '#0c4a6e',
      mid: '#0284c7',
      primary: '#38bdf8',
      highlight: '#e0f2fe',
      flair: 1,
    },
    {
      // 2: rare (#facc15)
      ox: 32,
      glow: '#ca8a04',
      shadow: '#713f12',
      mid: '#eab308',
      primary: '#facc15',
      highlight: '#fef08a',
      flair: 2,
    },
    {
      // 3: legendary (#f97316)
      ox: 48,
      glow: '#dc2626',
      shadow: '#7f1d1d',
      mid: '#ea580c',
      primary: '#f97316',
      highlight: '#fed7aa',
      flair: 3,
    },
  ];

  for (const t of tiers) {
    const cx = t.ox + 8;

    // Soft outer aura
    c.fillCircle(cx, 8, 6, t.glow, 95);

    // Dark outline + iron pedestal base
    c.fillCircle(cx, 8, 5, '#09090b');
    c.fillRect(t.ox + 4, 11, 8, 3, '#09090b');
    c.fillRect(t.ox + 5, 12, 6, 1, '#52525b');

    // Faceted relic orb core
    c.fillCircle(cx, 7.5, 3.8, t.shadow);
    c.fillCircle(cx, 7, 3, t.mid);
    c.fillCircle(cx - 0.5, 6.5, 2.2, t.primary);
    c.setPixel(cx - 1, 5, t.highlight);
    c.setPixel(cx - 2, 6, t.highlight);

    // Tier visual progression
    if (t.flair >= 1) {
      c.setPixel(t.ox + 2, 7, t.primary);
      c.setPixel(t.ox + 13, 7, t.primary);
    }
    if (t.flair >= 2) {
      c.setPixel(cx, 1, t.highlight);
      c.setPixel(t.ox + 3, 3, t.primary);
      c.setPixel(t.ox + 12, 3, t.primary);
    }
    if (t.flair >= 3) {
      // Blazing crown & side embers for legendary
      c.fillRect(cx - 1, 1, 2, 2, '#facc15');
      c.setPixel(cx, 0, '#fef08a');
      c.setPixel(t.ox + 1, 5, '#f97316');
      c.setPixel(t.ox + 14, 5, '#f97316');
      c.setPixel(t.ox + 2, 10, '#facc15');
      c.setPixel(t.ox + 13, 10, '#facc15');
    }
  }

  return c;
}

// --- 9. Hub Tiles (64x16, 4 frames 16x16: refuge_floor, refuge_runes, refuge_wall, refuge_brazier) ---
function generateHubTiles() {
  const c = new PixelCanvas(64, 16);

  // Frame 0 (0..15): refuge_floor (ruined stone flagstones, low luminance)
  {
    const ox = 0;
    c.fillRect(ox, 0, 16, 16, '#14141b');
    c.fillRect(ox + 1, 1, 6, 6, '#1b1b26');
    c.fillRect(ox + 8, 1, 7, 5, '#171721');
    c.fillRect(ox + 1, 8, 7, 7, '#171721');
    c.fillRect(ox + 9, 7, 6, 8, '#1b1b26');
    // Mortar joints & weathered cracks
    c.drawLine(ox, 7, ox + 7, 7, '#09090b');
    c.drawLine(ox + 8, 6, ox + 15, 6, '#09090b');
    c.drawLine(ox + 7, 0, ox + 7, 15, '#09090b');
    c.setPixel(ox + 3, 4, '#272730');
    c.setPixel(ox + 11, 10, '#272730');
    c.drawLine(ox + 10, 2, ox + 12, 4, '#09090b');
  }

  // Frame 1 (16..31): refuge_runes (carved sanctuary stone with faint spectral blue runes)
  {
    const ox = 16;
    c.fillRect(ox, 0, 16, 16, '#14141b');
    c.fillRect(ox + 1, 1, 14, 14, '#181824');
    c.drawLine(ox, 0, ox + 15, 0, '#09090b');
    c.drawLine(ox, 15, ox + 15, 15, '#09090b');
    c.drawLine(ox, 0, ox, 15, '#09090b');
    c.drawLine(ox + 15, 0, ox + 15, 15, '#09090b');
    // Subtle rune circle & sigil (#0284c7 / #38bdf8)
    c.drawLine(ox + 5, 3, ox + 10, 3, '#0284c7');
    c.drawLine(ox + 5, 12, ox + 10, 12, '#0284c7');
    c.drawLine(ox + 3, 5, ox + 3, 10, '#0284c7');
    c.drawLine(ox + 12, 5, ox + 12, 10, '#0284c7');
    c.drawLine(ox + 7, 4, ox + 7, 11, '#38bdf8');
    c.drawLine(ox + 8, 4, ox + 8, 11, '#0284c7');
    c.drawLine(ox + 5, 7, ox + 10, 7, '#38bdf8');
    c.fillRect(ox + 7, 7, 2, 2, '#e0f2fe');
  }

  // Frame 2 (32..47): refuge_wall (crumbling sanctuary stone wall with top highlight)
  {
    const ox = 32;
    c.fillRect(ox, 0, 16, 16, '#09090b');
    // Cracked top bevel
    c.fillRect(ox, 0, 10, 2, '#3f3f4e');
    c.fillRect(ox + 11, 1, 5, 1, '#52525b');
    c.fillRect(ox + 1, 2, 6, 5, '#272730');
    c.fillRect(ox + 8, 2, 7, 5, '#1f1f29');
    c.fillRect(ox, 8, 4, 6, '#1f1f29');
    c.fillRect(ox + 5, 8, 6, 6, '#272730');
    c.fillRect(ox + 12, 8, 4, 6, '#272730');
    // Ruin moss & weathered edge
    c.fillRect(ox + 2, 3, 2, 2, '#3f3f4e');
    c.fillRect(ox + 9, 9, 2, 2, '#1e3a2f');
    c.fillRect(ox + 6, 12, 2, 2, '#1e3a2f');
  }

  // Frame 3 (48..63): refuge_brazier (iron brazier with spectral blue spirit flame)
  {
    const ox = 48;
    // Stone floor beneath
    c.fillRect(ox, 0, 16, 16, '#14141b');
    // Soft blue aura on floor
    c.fillCircle(ox + 8, 8, 6, '#0284c7', 75);
    // Pedestal & iron bowl
    c.fillRect(ox + 4, 12, 8, 3, '#09090b');
    c.fillRect(ox + 5, 13, 6, 2, '#272730');
    c.fillRect(ox + 3, 8, 10, 5, '#09090b');
    c.fillRect(ox + 4, 9, 8, 3, '#3f3f46');
    c.drawLine(ox + 4, 9, ox + 11, 9, '#71717a');
    // Spectral blue flames (#0284c7 / #38bdf8 / #e0f2fe)
    c.fillRect(ox + 5, 4, 6, 5, '#0284c7');
    c.fillRect(ox + 6, 3, 4, 6, '#38bdf8');
    c.fillRect(ox + 7, 2, 2, 5, '#e0f2fe');
    c.setPixel(ox + 5, 2, '#38bdf8');
    c.setPixel(ox + 10, 3, '#38bdf8');
    c.setPixel(ox + 8, 1, '#e0f2fe');
  }

  return c;
}

// --- 10. Hub NPCs (128x32, 4 frames 32x32: emissary, blacksmith, soul_altar, rift_portal) ---
function generateHubNpcs() {
  const c = new PixelCanvas(128, 32);

  // Frame 0 (ox = 0): emissary (Celestial Emissary with pale/azure robes, ethereal wings & staff)
  {
    const ox = 0;
    // Ground aura
    c.fillRect(ox + 10, 27, 12, 2, '#0284c7', 140);
    // Ethereal folded wings
    c.fillRect(ox + 4, 10, 5, 11, '#09090b');
    c.fillRect(ox + 23, 10, 5, 11, '#09090b');
    c.fillRect(ox + 5, 11, 4, 9, '#0284c7');
    c.fillRect(ox + 23, 11, 4, 9, '#0284c7');
    c.drawLine(ox + 5, 12, ox + 7, 18, '#38bdf8');
    c.drawLine(ox + 26, 12, ox + 24, 18, '#38bdf8');
    // Robe & cloak
    c.fillRect(ox + 9, 13, 14, 14, '#09090b');
    c.fillRect(ox + 10, 14, 12, 12, '#1e1b4b');
    c.fillRect(ox + 12, 14, 8, 11, '#e4e4e7');
    c.fillRect(ox + 14, 15, 4, 9, '#94a3b8');
    c.fillRect(ox + 15, 16, 2, 7, '#38bdf8');
    // Hooded head & celestial halo
    c.fillRect(ox + 11, 4, 10, 10, '#09090b');
    c.fillRect(ox + 12, 5, 8, 8, '#e4e4e7');
    c.fillRect(ox + 13, 7, 6, 5, '#09090b');
    // Glowing azure eyes
    c.fillRect(ox + 14, 9, 1, 2, '#38bdf8');
    c.fillRect(ox + 17, 9, 1, 2, '#38bdf8');
    c.setPixel(ox + 14, 9, '#e0f2fe');
    c.setPixel(ox + 17, 9, '#e0f2fe');
    // Golden halo & staff
    c.drawLine(ox + 13, 2, ox + 18, 2, '#facc15');
    c.setPixel(ox + 12, 3, '#facc15');
    c.setPixel(ox + 19, 3, '#facc15');
    c.fillRect(ox + 24, 9, 2, 18, '#71717a');
    c.fillRect(ox + 23, 6, 4, 4, '#09090b');
    c.fillRect(ox + 24, 7, 2, 2, '#38bdf8');
    c.setPixel(ox + 24, 7, '#e0f2fe');
  }

  // Frame 1 (ox = 32): blacksmith (Spectral Blacksmith with hammer & glowing anvil)
  {
    const ox = 32;
    // Floor shadow
    c.fillRect(ox + 5, 27, 22, 2, '#09090b', 180);
    // Blacksmith body (left-center)
    c.fillRect(ox + 6, 13, 12, 14, '#09090b');
    c.fillRect(ox + 7, 14, 10, 12, '#3f3f46'); // apron & mail
    c.fillRect(ox + 9, 15, 6, 9, '#7f1d1d'); // dark leather apron
    c.fillRect(ox + 10, 17, 4, 3, '#f97316'); // forge ember glow on apron
    // Helmet / head
    c.fillRect(ox + 7, 6, 10, 8, '#09090b');
    c.fillRect(ox + 8, 7, 8, 6, '#52525b');
    c.fillRect(ox + 9, 9, 6, 3, '#09090b');
    c.fillRect(ox + 10, 10, 2, 1, '#facc15');
    c.fillRect(ox + 13, 10, 2, 1, '#facc15');
    // Raised hammer
    c.fillRect(ox + 17, 10, 3, 7, '#71717a');
    c.fillRect(ox + 16, 7, 6, 4, '#09090b');
    c.fillRect(ox + 17, 8, 4, 2, '#e4e4e7');
    // Anvil on right
    c.fillRect(ox + 19, 19, 10, 8, '#09090b');
    c.fillRect(ox + 18, 19, 11, 3, '#52525b');
    c.drawLine(ox + 19, 19, ox + 28, 19, '#a1a1aa');
    c.fillRect(ox + 21, 22, 5, 4, '#3f3f46');
    c.fillRect(ox + 20, 25, 7, 2, '#52525b');
    // Spectral/ember sparks on anvil
    c.setPixel(ox + 23, 17, '#facc15');
    c.setPixel(ox + 25, 16, '#38bdf8');
    c.setPixel(ox + 21, 18, '#f97316');
  }

  // Frame 2 (ox = 64): soul_altar (Runic monolith altar with levitating blue soul flame)
  {
    const ox = 64;
    // Aura under altar
    c.fillCircle(ox + 16, 14, 11, '#0284c7', 70);
    // Stepped stone base
    c.fillRect(ox + 5, 25, 22, 4, '#09090b');
    c.fillRect(ox + 6, 26, 20, 2, '#272730');
    c.fillRect(ox + 8, 21, 16, 4, '#09090b');
    c.fillRect(ox + 9, 22, 14, 2, '#3f3f4e');
    // Altar pillars & rune tablet
    c.fillRect(ox + 10, 13, 12, 9, '#09090b');
    c.fillRect(ox + 11, 14, 10, 7, '#272730');
    c.fillRect(ox + 12, 14, 8, 2, '#52525b');
    // Engraved glowing blue runes
    c.fillRect(ox + 13, 17, 2, 3, '#0284c7');
    c.fillRect(ox + 17, 17, 2, 3, '#0284c7');
    c.setPixel(ox + 15, 18, '#38bdf8');
    c.setPixel(ox + 16, 18, '#38bdf8');
    // Floating Soul Orb / Flame above altar
    c.fillCircle(ox + 16, 8, 5, '#0284c7', 190);
    c.fillCircle(ox + 16, 8, 3.5, '#38bdf8', 240);
    c.fillCircle(ox + 16, 8, 2, '#e0f2fe', 255);
    c.setPixel(ox + 16, 2, '#38bdf8');
    c.setPixel(ox + 12, 6, '#e0f2fe');
    c.setPixel(ox + 20, 7, '#38bdf8');
  }

  // Frame 3 (ox = 96): rift_portal (Ruined runic arch framing a swirling blue Rift vortex)
  {
    const ox = 96;
    // Outer stone arch outline & pillars
    c.fillRect(ox + 4, 4, 24, 25, '#09090b');
    c.fillRect(ox + 6, 2, 20, 4, '#09090b');
    // Stone arch blocks
    c.fillRect(ox + 5, 6, 5, 22, '#272730');
    c.fillRect(ox + 22, 6, 5, 22, '#272730');
    c.fillRect(ox + 7, 3, 18, 4, '#3f3f4e');
    c.drawLine(ox + 7, 3, ox + 24, 3, '#52525b');
    // Glowing runes on arch pillars
    c.fillRect(ox + 7, 10, 2, 3, '#38bdf8');
    c.fillRect(ox + 7, 17, 2, 3, '#0284c7');
    c.fillRect(ox + 23, 10, 2, 3, '#38bdf8');
    c.fillRect(ox + 23, 17, 2, 3, '#0284c7');
    c.fillRect(ox + 15, 4, 2, 2, '#e0f2fe');
    // Dimensional Rift vortex inside arch
    c.fillRect(ox + 10, 7, 12, 21, '#09090b');
    c.fillCircle(ox + 16, 17, 7, '#1e1b4b');
    c.fillCircle(ox + 16, 17, 5.5, '#0284c7');
    c.fillCircle(ox + 16, 17, 3.5, '#38bdf8');
    c.fillCircle(ox + 16, 17, 1.8, '#e0f2fe');
    // Vortex swirl sparks & threshold
    c.setPixel(ox + 12, 12, '#e0f2fe');
    c.setPixel(ox + 20, 21, '#e0f2fe');
    c.setPixel(ox + 13, 22, '#38bdf8');
    c.setPixel(ox + 19, 12, '#38bdf8');
    c.fillRect(ox + 8, 27, 16, 2, '#3f3f4e');
  }

  return c;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const specs = [
    {
      key: 'wraith_warrior',
      file: 'wraith_warrior.png',
      width: 128,
      height: 32,
      frameWidth: 32,
      frameHeight: 32,
      frames: ['idle0', 'idle1', 'attack', 'dash'],
      build: generateWraithWarrior,
    },
    {
      key: 'abyssal_slime',
      file: 'abyssal_slime.png',
      width: 64,
      height: 32,
      frameWidth: 32,
      frameHeight: 32,
      frames: ['idle0', 'idle1'],
      build: generateAbyssalSlime,
    },
    {
      key: 'bone_sentinel',
      file: 'bone_sentinel.png',
      width: 64,
      height: 32,
      frameWidth: 32,
      frameHeight: 32,
      frames: ['idle0', 'attack'],
      build: generateBoneSentinel,
    },
    {
      key: 'infernal_warden',
      file: 'infernal_warden.png',
      width: 128,
      height: 64,
      frameWidth: 64,
      frameHeight: 64,
      frames: ['idle', 'slam'],
      build: generateInfernalWarden,
    },
    {
      key: 'dungeon_tiles',
      file: 'dungeon_tiles.png',
      width: 64,
      height: 16,
      frameWidth: 16,
      frameHeight: 16,
      frames: ['floor_dark', 'floor_cracked', 'wall_abyssal', 'portal_soul'],
      build: generateDungeonTiles,
    },
    {
      key: 'soul_orb',
      file: 'soul_orb.png',
      width: 16,
      height: 16,
      frameWidth: 16,
      frameHeight: 16,
      frames: ['idle'],
      build: generateSoulOrb,
    },
    {
      key: 'loot_icons',
      file: 'loot_icons.png',
      width: 64,
      height: 16,
      frameWidth: 16,
      frameHeight: 16,
      frames: ['icon_weapon', 'icon_armor', 'icon_amulet', 'icon_ring'],
      build: generateLootIcons,
    },
    {
      key: 'loot_drops',
      file: 'loot_drops.png',
      width: 64,
      height: 16,
      frameWidth: 16,
      frameHeight: 16,
      frames: ['common', 'magic', 'rare', 'legendary'],
      build: generateLootDrops,
    },
    {
      key: 'hub_tiles',
      file: 'hub_tiles.png',
      width: 64,
      height: 16,
      frameWidth: 16,
      frameHeight: 16,
      frames: ['refuge_floor', 'refuge_runes', 'refuge_wall', 'refuge_brazier'],
      build: generateHubTiles,
    },
    {
      key: 'hub_npcs',
      file: 'hub_npcs.png',
      width: 128,
      height: 32,
      frameWidth: 32,
      frameHeight: 32,
      frames: ['emissary', 'blacksmith', 'soul_altar', 'rift_portal'],
      build: generateHubNpcs,
    },
  ];

  const manifest = {
    version: '0.3.0',
    sprites: {},
  };

  for (const s of specs) {
    const canvas = s.build();
    const outPath = path.join(OUT_DIR, s.file);
    canvas.save(outPath);
    manifest.sprites[s.key] = {
      key: s.key,
      file: s.file,
      width: s.width,
      height: s.height,
      frameWidth: s.frameWidth,
      frameHeight: s.frameHeight,
      frames: s.frames,
    };
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8'
  );
  console.log(`Generated ${specs.length} PNG spritesheets and manifest.json in ${OUT_DIR}`);
}

main();
