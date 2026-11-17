import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT_DIR = path.resolve('public/icons');

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

function parseHex(hex) {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

class OpaquePixelGrid {
  constructor(width, height, bgHex = '#09090b') {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4);
    const [r, g, b] = parseHex(bgHex);
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      this.data[idx] = r;
      this.data[idx + 1] = g;
      this.data[idx + 2] = b;
      this.data[idx + 3] = 255;
    }
  }

  setPixel(x, y, hex, alpha = 255) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return;
    const [r, g, b] = parseHex(hex);
    const idx = (iy * this.width + ix) * 4;
    if (alpha >= 255) {
      this.data[idx] = r;
      this.data[idx + 1] = g;
      this.data[idx + 2] = b;
      this.data[idx + 3] = 255;
      return;
    }
    const a = alpha / 255;
    const inv = 1 - a;
    this.data[idx] = Math.round(r * a + this.data[idx] * inv);
    this.data[idx + 1] = Math.round(g * a + this.data[idx + 1] * inv);
    this.data[idx + 2] = Math.round(b * a + this.data[idx + 2] * inv);
    this.data[idx + 3] = 255;
  }

  fillRect(x, y, w, h, hex, alpha = 255) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.setPixel(x + dx, y + dy, hex, alpha);
      }
    }
  }

  fillDiamond(cx, cy, radius, hex, alpha = 255) {
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (Math.abs(x - cx) + Math.abs(y - cy) <= radius) {
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

  cropAndScaleNearest(cropX, cropY, cropW, cropH, scale) {
    const outW = cropW * scale;
    const outH = cropH * scale;
    const out = Buffer.alloc(outW * outH * 4);
    for (let sy = 0; sy < cropH; sy++) {
      for (let sx = 0; sx < cropW; sx++) {
        const srcIdx = ((cropY + sy) * this.width + (cropX + sx)) * 4;
        const r = this.data[srcIdx];
        const g = this.data[srcIdx + 1];
        const b = this.data[srcIdx + 2];
        const a = this.data[srcIdx + 3];
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const dstX = sx * scale + dx;
            const dstY = sy * scale + dy;
            const dstIdx = (dstY * outW + dstX) * 4;
            out[dstIdx] = r;
            out[dstIdx + 1] = g;
            out[dstIdx + 2] = b;
            out[dstIdx + 3] = a;
          }
        }
      }
    }
    return { width: outW, height: outH, data: out };
  }
}

// --- Master 64x64 Pixel-Art Emblem: Guerreiro Espectral ---
function buildMasterEmblem() {
  const g = new OpaquePixelGrid(64, 64, '#09090b');

  // 1. Subtle abyssal radial stone backdrop inside frame (x,y in 5..58)
  for (let y = 5; y <= 58; y++) {
    for (let x = 5; x <= 58; x++) {
      const dist = Math.hypot(x - 31.5, y - 31.5);
      if (dist < 14) {
        g.setPixel(x, y, '#14141b');
      } else if (dist < 22) {
        g.setPixel(x, y, '#101016');
      } else {
        g.setPixel(x, y, '#0c0c10');
      }
    }
  }

  // Subtle spectral nebula glow behind head & blade + soft radial ember glow at bottom
  g.fillDiamond(32, 28, 18, '#1e1b4b', 110);
  g.fillDiamond(32, 27, 12, '#0284c7', 55);
  for (let y = 43; y <= 57; y++) {
    for (let x = 7; x <= 56; x++) {
      const dx = (x - 31.5) / 24;
      const dy = (58 - y) / 15;
      const d = Math.hypot(dx, dy);
      if (d < 1) {
        const alpha = Math.round((1 - d) * 75);
        g.setPixel(x, y, '#991b1b', alpha);
      }
    }
  }

  // 2. Runic outer border (fits inside 4..59 so 60x60 crop for 180x180 keeps full frame)
  const min = 4;
  const max = 59;
  const chamfer = 4;

  // Dark iron outer bezel
  for (let i = min + chamfer; i <= max - chamfer; i++) {
    g.setPixel(i, min, '#272730');
    g.setPixel(i, max, '#272730');
    g.setPixel(min, i, '#272730');
    g.setPixel(max, i, '#272730');

    g.setPixel(i, min + 1, '#3f3f46');
    g.setPixel(i, max - 1, '#1e1b4b');
    g.setPixel(min + 1, i, '#3f3f46');
    g.setPixel(max - 1, i, '#3f3f46');
  }
  // Chamfered corners
  for (let c = 0; c <= chamfer; c++) {
    g.setPixel(min + chamfer - c, min + c, '#3f3f46');
    g.setPixel(max - chamfer + c, min + c, '#3f3f46');
    g.setPixel(min + chamfer - c, max - c, '#3f3f46');
    g.setPixel(max - chamfer + c, max - c, '#3f3f46');
  }

  // Cardinal runic glyphs on frame (spectral cyan top/sides, ember accents bottom)
  g.fillRect(30, 4, 4, 2, '#0284c7');
  g.fillRect(31, 3, 2, 4, '#38bdf8');
  g.setPixel(31, 4, '#e0fbfc');
  g.setPixel(32, 4, '#e0fbfc');
  g.fillRect(4, 30, 2, 4, '#0284c7');
  g.fillRect(5, 31, 2, 2, '#38bdf8');
  g.fillRect(58, 30, 2, 4, '#0284c7');
  g.fillRect(57, 31, 2, 2, '#38bdf8');
  for (const [rx, ry] of [
    [12, 5], [51, 5], [5, 12], [58, 12],
    [12, 58], [51, 58], [5, 51], [58, 51],
  ]) {
    g.setPixel(rx, ry, '#38bdf8', 190);
  }
  g.fillRect(29, 58, 6, 2, '#991b1b');
  g.fillRect(30, 58, 4, 1, '#ef4444');
  g.fillRect(31, 57, 2, 2, '#f97316');

  // 3. Diagonal Spectral Blade (bottom-left hilt -> top-right glowing tip, behind helm)
  for (let t = 0; t <= 37; t++) {
    const bx = 14 + t;
    const by = 49 - t;
    g.fillDiamond(bx, by, 2, '#0284c7', 95);
  }
  // Sharp blade body (above crossguard: t = 9..37)
  for (let t = 9; t <= 37; t++) {
    const bx = 14 + t;
    const by = 49 - t;
    g.setPixel(bx - 2, by - 1, '#09090b');
    g.setPixel(bx + 1, by + 2, '#09090b');
    g.setPixel(bx - 1, by - 1, '#0284c7');
    g.setPixel(bx, by + 1, '#0284c7');
    g.setPixel(bx - 1, by, '#38bdf8');
    g.setPixel(bx + 1, by, '#38bdf8');
    g.setPixel(bx, by, '#e0fbfc');
  }
  // Tip flare
  g.setPixel(52, 11, '#e0fbfc');
  g.setPixel(53, 10, '#38bdf8');
  g.setPixel(51, 10, '#38bdf8');
  g.setPixel(52, 13, '#38bdf8');

  // Iron crossguard & pommel tucked cleanly under left shoulder (no stray pixel above y=39)
  g.drawLine(17, 40, 23, 46, '#09090b');
  g.drawLine(18, 40, 24, 46, '#71717a');
  g.drawLine(19, 41, 23, 45, '#e4e4e7');
  g.drawLine(12, 51, 18, 45, '#09090b');
  g.drawLine(13, 50, 18, 45, '#3f3f46');
  g.fillRect(11, 50, 3, 3, '#71717a');
  g.setPixel(12, 51, '#e4e4e7');

  // 4. Guerreiro Espectral — Hood, Armored Shoulders & Helm (centered around x=31.5)
  g.fillRect(17, 40, 30, 12, '#09090b');
  g.fillRect(19, 36, 26, 15, '#09090b');
  g.fillRect(19, 16, 26, 23, '#09090b');
  g.fillRect(22, 12, 20, 6, '#09090b');
  g.fillRect(26, 9, 12, 4, '#09090b');
  g.fillRect(29, 7, 6, 3, '#09090b');

  // Cloak shoulders & pauldrons
  g.fillRect(18, 41, 28, 10, '#1e1b4b');
  g.fillRect(20, 40, 24, 10, '#312e81');
  // Ragged cloak hem wisps
  for (const wx of [18, 22, 27, 32, 37, 41, 45]) {
    g.fillRect(wx, 50, 2, 3, '#1e1b4b');
    g.setPixel(wx, 53, '#0284c7', 160);
  }
  // Iron shoulder pauldrons
  g.fillRect(18, 39, 9, 5, '#3f3f46');
  g.fillRect(19, 40, 7, 3, '#71717a');
  g.fillRect(19, 39, 7, 1, '#e4e4e7');
  g.fillRect(37, 39, 9, 5, '#3f3f46');
  g.fillRect(38, 40, 7, 3, '#71717a');
  g.fillRect(38, 39, 7, 1, '#e4e4e7');

  // Spectral chest core sigil
  g.fillDiamond(32, 45, 3, '#0284c7');
  g.fillDiamond(32, 45, 2, '#38bdf8');
  g.setPixel(32, 45, '#e0fbfc');
  g.setPixel(31, 45, '#e0fbfc');

  // Hood exterior folds + outer spectral rim
  g.fillRect(21, 17, 22, 20, '#1e1b4b');
  g.fillRect(23, 13, 18, 6, '#1e1b4b');
  g.fillRect(27, 10, 10, 4, '#312e81');
  g.fillRect(30, 8, 4, 3, '#312e81');
  // Trace outer hood silhouette ridge
  g.drawLine(30, 8, 21, 17, '#38bdf8', 135);
  g.drawLine(33, 8, 42, 17, '#38bdf8', 135);
  g.fillRect(21, 18, 2, 18, '#312e81');
  g.fillRect(41, 18, 2, 18, '#312e81');

  // Deep shadow void inside hood
  g.fillRect(24, 18, 16, 19, '#09090b');
  g.fillRect(26, 15, 12, 4, '#09090b');

  // Iron crown / brow plate of the Wraith Helm
  g.fillRect(24, 18, 16, 3, '#3f3f46');
  g.fillRect(25, 18, 14, 2, '#71717a');
  g.fillRect(29, 17, 6, 3, '#e4e4e7');
  g.fillRect(31, 18, 2, 7, '#71717a');
  g.setPixel(31, 18, '#e0fbfc');
  g.setPixel(32, 18, '#e0fbfc');

  // Menacing angular steel respirator/gorget mask (pointed dark-iron cheek & chin plates)
  g.fillRect(25, 32, 14, 5, '#272730');
  g.fillRect(26, 33, 12, 4, '#3f3f46');
  g.fillRect(27, 33, 10, 1, '#71717a');
  g.fillRect(29, 34, 6, 3, '#71717a');
  g.fillRect(31, 35, 2, 3, '#a1a1aa');
  // Vertical visor vents
  g.fillRect(28, 34, 1, 2, '#09090b');
  g.fillRect(35, 34, 1, 2, '#09090b');

  // Glowing spectral eyes (#38bdf8 / #e0fbfc) with trailing flame wisps
  g.fillRect(25, 25, 5, 4, '#0284c7', 160);
  g.fillRect(26, 26, 3, 2, '#38bdf8');
  g.fillRect(27, 26, 2, 2, '#e0fbfc');
  g.setPixel(25, 25, '#38bdf8');
  g.setPixel(24, 24, '#0284c7');
  g.fillRect(34, 25, 5, 4, '#0284c7', 160);
  g.fillRect(35, 26, 3, 2, '#38bdf8');
  g.fillRect(35, 26, 2, 2, '#e0fbfc');
  g.setPixel(38, 25, '#38bdf8');
  g.setPixel(39, 24, '#0284c7');

  // 5. Subtle Infernal Embers (#ef4444 / #f97316) rising from abyssal base
  const embers = [
    [13, 54, '#ef4444'], [14, 53, '#f97316'],
    [21, 55, '#f97316'], [24, 52, '#ef4444'],
    [40, 53, '#ef4444'], [43, 55, '#f97316'],
    [49, 52, '#ef4444'], [50, 50, '#f97316'],
    [11, 47, '#ef4444'], [52, 45, '#f97316'],
  ];
  for (const [ex, ey, col] of embers) {
    g.setPixel(ex, ey, col);
  }
  for (const [sx, sy] of [[46, 13], [49, 19], [54, 15], [20, 14], [14, 24]]) {
    g.setPixel(sx, sy, '#38bdf8', 210);
  }

  return g;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const master = buildMasterEmblem();

  const targets = [
    // 60x60 active emblem cropped at (2,2) * 3 = 180x180 (exact integer nearest-neighbor)
    {
      name: 'apple-touch-icon.png',
      cropX: 2,
      cropY: 2,
      cropW: 60,
      cropH: 60,
      scale: 3,
    },
    // 64x64 * 3 = 192x192
    {
      name: 'icon-192.png',
      cropX: 0,
      cropY: 0,
      cropW: 64,
      cropH: 64,
      scale: 3,
    },
    // 64x64 * 8 = 512x512
    {
      name: 'icon-512.png',
      cropX: 0,
      cropY: 0,
      cropW: 64,
      cropH: 64,
      scale: 8,
    },
  ];

  for (const t of targets) {
    const img = master.cropAndScaleNearest(t.cropX, t.cropY, t.cropW, t.cropH, t.scale);
    const outPath = path.join(OUT_DIR, t.name);
    fs.writeFileSync(outPath, encodePNG(img.width, img.height, img.data));
    console.log(`Generated ${t.name}: ${img.width}x${img.height} px`);
  }
}

main();
