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

// --- Color & Canvas Helpers ---
function parseHex(hex, alpha = 255) {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, alpha];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerpColor(rgbA, rgbB, t) {
  const u = clamp(t, 0, 1);
  return [
    lerp(rgbA[0], rgbB[0], u),
    lerp(rgbA[1], rgbB[1], u),
    lerp(rgbA[2], rgbB[2], u),
  ];
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

  setRGBA(x, y, r, g, b, a) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return;
    const idx = (iy * this.width + ix) * 4;
    this.data[idx] = clamp(Math.round(r), 0, 255);
    this.data[idx + 1] = clamp(Math.round(g), 0, 255);
    this.data[idx + 2] = clamp(Math.round(b), 0, 255);
    this.data[idx + 3] = clamp(Math.round(a), 0, 255);
  }

  blendPixel(x, y, hex, alpha = 255) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return;
    const [sr, sg, sb, saRaw] = parseHex(hex, alpha);
    const sa = saRaw / 255;
    if (sa <= 0) return;
    const idx = (iy * this.width + ix) * 4;
    const da = this.data[idx + 3] / 255;
    const outA = sa + da * (1 - sa);
    if (outA <= 0) return;
    this.data[idx] = Math.round((sr * sa + this.data[idx] * da * (1 - sa)) / outA);
    this.data[idx + 1] = Math.round((sg * sa + this.data[idx + 1] * da * (1 - sa)) / outA);
    this.data[idx + 2] = Math.round((sb * sa + this.data[idx + 2] * da * (1 - sa)) / outA);
    this.data[idx + 3] = Math.round(outA * 255);
  }

  fillRect(x, y, w, h, hex, alpha = 255) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.setPixel(x + dx, y + dy, hex, alpha);
      }
    }
  }

  ditherRect(x, y, w, h, hexA, hexB, density = 0.25) {
    // Ordered 2x2 Bayer matrix dithering for 16/32-bit pixel art textures
    const bayer = [
      [0.125, 0.625],
      [0.875, 0.375],
    ];
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const threshold = bayer[(y + dy) & 1][(x + dx) & 1];
        this.setPixel(x + dx, y + dy, density > threshold ? hexB : hexA);
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

// --- Supersampled 2D Stylized Portrait Canvas (3x SSAA for rich smooth shading & crisp edges) ---
class SmoothCanvas {
  constructor(targetSize = 64, scale = 3) {
    this.targetSize = targetSize;
    this.scale = scale;
    this.width = targetSize * scale;
    this.height = targetSize * scale;
    this.data = new Float32Array(this.width * this.height * 4);
  }

  blendRGB(x, y, r, g, b, a) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height || a <= 0) return;
    const sa = clamp(a / 255, 0, 1);
    const idx = (y * this.width + x) * 4;
    const da = this.data[idx + 3] / 255;
    const outA = sa + da * (1 - sa);
    if (outA <= 0.0001) return;
    this.data[idx] = (r * sa + this.data[idx] * da * (1 - sa)) / outA;
    this.data[idx + 1] = (g * sa + this.data[idx + 1] * da * (1 - sa)) / outA;
    this.data[idx + 2] = (b * sa + this.data[idx + 2] * da * (1 - sa)) / outA;
    this.data[idx + 3] = outA * 255;
  }

  fillRadialGlow(cx, cy, r, hexInner, alphaInner = 200, hexOuter = hexInner, alphaOuter = 0) {
    const s = this.scale;
    const scx = cx * s;
    const scy = cy * s;
    const sr = r * s;
    const cIn = parseHex(hexInner);
    const cOut = parseHex(hexOuter);
    const minX = Math.max(0, Math.floor(scx - sr));
    const maxX = Math.min(this.width - 1, Math.ceil(scx + sr));
    const minY = Math.max(0, Math.floor(scy - sr));
    const maxY = Math.min(this.height - 1, Math.ceil(scy + sr));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.hypot(x - scx, y - scy);
        if (dist <= sr) {
          const t = clamp(dist / sr, 0, 1);
          const smoothT = t * t * (3 - 2 * t);
          const rgb = lerpColor(cIn, cOut, smoothT);
          const a = lerp(alphaInner, alphaOuter, smoothT);
          this.blendRGB(x, y, rgb[0], rgb[1], rgb[2], a);
        }
      }
    }
  }

  fillEllipse(cx, cy, rx, ry, hex, alpha = 255, angle = 0) {
    const s = this.scale;
    const scx = cx * s;
    const scy = cy * s;
    const srx = rx * s;
    const sry = ry * s;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const bound = Math.max(srx, sry) + 2;
    const [r, g, b] = parseHex(hex);
    const minX = Math.max(0, Math.floor(scx - bound));
    const maxX = Math.min(this.width - 1, Math.ceil(scx + bound));
    const minY = Math.max(0, Math.floor(scy - bound));
    const maxY = Math.min(this.height - 1, Math.ceil(scy + bound));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - scx;
        const dy = y - scy;
        const lx = (dx * cos + dy * sin) / srx;
        const ly = (-dx * sin + dy * cos) / sry;
        const d = Math.hypot(lx, ly);
        if (d <= 1.015) {
          const cov = clamp((1.015 - d) * Math.min(srx, sry), 0, 1);
          this.blendRGB(x, y, r, g, b, alpha * cov);
        }
      }
    }
  }

  fillShadedEllipse(cx, cy, rx, ry, opts) {
    const {
      shadow,
      mid,
      light,
      rim = null,
      rimSide = 1,
      lightDir = [-0.45, -0.55],
      angle = 0,
      alpha = 255,
      outline = '#09090b',
      outlineWidth = 1.4,
    } = opts;
    if (outline) {
      this.fillEllipse(cx, cy, rx + outlineWidth, ry + outlineWidth, outline, alpha, angle);
    }
    const s = this.scale;
    const scx = cx * s;
    const scy = cy * s;
    const srx = rx * s;
    const sry = ry * s;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const bound = Math.max(srx, sry) + 2;
    const cShad = parseHex(shadow);
    const cMid = parseHex(mid);
    const cLight = parseHex(light);
    const cRim = rim ? parseHex(rim) : null;
    const minX = Math.max(0, Math.floor(scx - bound));
    const maxX = Math.min(this.width - 1, Math.ceil(scx + bound));
    const minY = Math.max(0, Math.floor(scy - bound));
    const maxY = Math.min(this.height - 1, Math.ceil(scy + bound));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - scx;
        const dy = y - scy;
        const nx = (dx * cos + dy * sin) / srx;
        const ny = (-dx * sin + dy * cos) / sry;
        const r2 = nx * nx + ny * ny;
        if (r2 <= 1.02) {
          const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, r2)));
          const ndotl = nx * lightDir[0] + ny * lightDir[1] + nz * 0.72;
          let rgb;
          if (ndotl < 0.35) {
            rgb = lerpColor(cShad, cMid, clamp((ndotl + 0.35) / 0.7, 0, 1));
          } else {
            rgb = lerpColor(cMid, cLight, clamp((ndotl - 0.35) / 0.55, 0, 1));
          }
          if (cRim) {
            const edgeFactor = Math.pow(1 - nz, 2.2) * clamp((nx * rimSide + 0.4) * 0.9, 0, 1);
            rgb = lerpColor(rgb, cRim, clamp(edgeFactor * 0.85, 0, 1));
          }
          const cov = clamp((1.01 - Math.sqrt(r2)) * Math.min(srx, sry), 0, 1);
          this.blendRGB(x, y, rgb[0], rgb[1], rgb[2], alpha * cov);
        }
      }
    }
  }

  fillPolygon(points, hex, alpha = 255) {
    const s = this.scale;
    const scaled = points.map(([x, y]) => [x * s, y * s]);
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of scaled) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    minY = Math.max(0, Math.floor(minY));
    maxY = Math.min(this.height - 1, Math.ceil(maxY));
    const [r, g, b] = parseHex(hex);
    for (let y = minY; y <= maxY; y++) {
      const intersections = [];
      for (let i = 0; i < scaled.length; i++) {
        const [x1, y1] = scaled[i];
        const [x2, y2] = scaled[(i + 1) % scaled.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          intersections.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
        }
      }
      intersections.sort((a, c) => a - c);
      for (let i = 0; i + 1 < intersections.length; i += 2) {
        const xStart = Math.max(0, Math.floor(intersections[i]));
        const xEnd = Math.min(this.width - 1, Math.ceil(intersections[i + 1]));
        for (let x = xStart; x <= xEnd; x++) {
          this.blendRGB(x, y, r, g, b, alpha);
        }
      }
    }
  }

  fillGradientPolygon(points, hexTop, hexBottom, alpha = 255) {
    const s = this.scale;
    const scaled = points.map(([x, y]) => [x * s, y * s]);
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of scaled) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const spanY = Math.max(1, maxY - minY);
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(this.height - 1, Math.ceil(maxY));
    const cTop = parseHex(hexTop);
    const cBot = parseHex(hexBottom);
    for (let y = y0; y <= y1; y++) {
      const t = clamp((y - minY) / spanY, 0, 1);
      const rgb = lerpColor(cTop, cBot, t);
      const intersections = [];
      for (let i = 0; i < scaled.length; i++) {
        const [ax, ay] = scaled[i];
        const [bx, by] = scaled[(i + 1) % scaled.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          intersections.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
        }
      }
      intersections.sort((a, c) => a - c);
      for (let i = 0; i + 1 < intersections.length; i += 2) {
        const xStart = Math.max(0, Math.floor(intersections[i]));
        const xEnd = Math.min(this.width - 1, Math.ceil(intersections[i + 1]));
        for (let x = xStart; x <= xEnd; x++) {
          this.blendRGB(x, y, rgb[0], rgb[1], rgb[2], alpha);
        }
      }
    }
  }

  drawStroke(x0, y0, x1, y1, radius, hex, alpha = 255) {
    const s = this.scale;
    const ax = x0 * s;
    const ay = y0 * s;
    const bx = x1 * s;
    const by = y1 * s;
    const sr = radius * s;
    const [r, g, b] = parseHex(hex);
    const minX = Math.max(0, Math.floor(Math.min(ax, bx) - sr - 1));
    const maxX = Math.min(this.width - 1, Math.ceil(Math.max(ax, bx) + sr + 1));
    const minY = Math.max(0, Math.floor(Math.min(ay, by) - sr - 1));
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(ay, by) + sr + 1));
    const vx = bx - ax;
    const vy = by - ay;
    const v2 = vx * vx + vy * vy || 1;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const t = clamp(((x - ax) * vx + (y - ay) * vy) / v2, 0, 1);
        const px = ax + vx * t;
        const py = ay + vy * t;
        const dist = Math.hypot(x - px, y - py);
        if (dist <= sr + 0.8) {
          const cov = clamp(sr + 0.8 - dist, 0, 1);
          this.blendRGB(x, y, r, g, b, alpha * cov);
        }
      }
    }
  }

  drawArc(cx, cy, r, startRad, endRad, thickness, hex, alpha = 255, steps = 40) {
    for (let i = 0; i < steps; i++) {
      const a0 = lerp(startRad, endRad, i / steps);
      const a1 = lerp(startRad, endRad, (i + 1) / steps);
      this.drawStroke(
        cx + Math.cos(a0) * r,
        cy + Math.sin(a0) * r,
        cx + Math.cos(a1) * r,
        cy + Math.sin(a1) * r,
        thickness,
        hex,
        alpha
      );
    }
  }

  downsampleTo(pixelCanvas, destX, destY) {
    const s = this.scale;
    const area = s * s;
    for (let ty = 0; ty < this.targetSize; ty++) {
      for (let tx = 0; tx < this.targetSize; tx++) {
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let sumA = 0;
        for (let sy = 0; sy < s; sy++) {
          for (let sx = 0; sx < s; sx++) {
            const idx = ((ty * s + sy) * this.width + (tx * s + sx)) * 4;
            const a = this.data[idx + 3] / 255;
            sumR += this.data[idx] * a;
            sumG += this.data[idx + 1] * a;
            sumB += this.data[idx + 2] * a;
            sumA += a;
          }
        }
        const avgA = sumA / area;
        if (avgA > 0.002) {
          pixelCanvas.setRGBA(
            destX + tx,
            destY + ty,
            sumR / sumA,
            sumG / sumA,
            sumB / sumA,
            avgA * 255
          );
        }
      }
    }
  }
}

// --- 1. Wraith Warrior (128x32, 4 frames 32x32: idle0, idle1, attack, dash) ---
function generateWraithWarrior() {
  const c = new PixelCanvas(128, 32);

  function drawBaseWraith(ox, bobY = 0, leanX = 0) {
    // Spectral ground aura under feet
    c.fillRect(ox + 9, 27, 14, 2, '#0284c7', 130);
    c.fillRect(ox + 11, 28, 10, 1, '#38bdf8', 200);
    c.setPixel(ox + 15, 28, '#e0f2fe', 220);

    // Tapered cloak silhouette (wider at bottom, notched shoulders)
    for (let row = -1; row < 13; row++) {
      const y = 14 + bobY + row;
      const halfW = 5 + Math.max(0, Math.floor(row / 4));
      const cx = ox + 16 + leanX;
      c.fillRect(cx - halfW - 1, y, (halfW + 1) * 2, 1, '#09090b');
      c.fillRect(cx - halfW, y, halfW * 2, 1, '#1e1b4b');
      c.fillRect(cx - halfW + 1, y, Math.max(2, halfW * 2 - 3), 1, '#312e81');
      c.fillRect(cx - halfW + 1, y, Math.max(1, halfW - 2), 1, '#4338ca');
    }

    // Shoulder pauldrons with metallic rim light
    c.fillRect(ox + 8 + leanX, 13 + bobY, 5, 4, '#09090b');
    c.fillRect(ox + 9 + leanX, 14 + bobY, 3, 2, '#334155');
    c.drawLine(ox + 9 + leanX, 14 + bobY, ox + 11 + leanX, 14 + bobY, '#7dd3fc');
    c.fillRect(ox + 19 + leanX, 13 + bobY, 5, 4, '#09090b');
    c.fillRect(ox + 20 + leanX, 14 + bobY, 3, 2, '#1e293b');
    c.setPixel(ox + 21 + leanX, 14 + bobY, '#38bdf8');

    // Ragged cloak hem wisps
    c.setPixel(ox + 8 + leanX, 27 + bobY, '#1e1b4b');
    c.setPixel(ox + 11 + leanX, 27 + bobY, '#312e81');
    c.setPixel(ox + 14 + leanX, 27 + bobY, '#0284c7');
    c.setPixel(ox + 18 + leanX, 27 + bobY, '#312e81');
    c.setPixel(ox + 22 + leanX, 27 + bobY, '#09090b');

    // Pointed hood silhouette (4-tone + cyan rim)
    const hoodSpans = [
      [15, 2],
      [13, 6],
      [12, 8],
      [11, 10],
      [10, 12],
      [10, 12],
      [10, 12],
      [11, 10],
      [11, 10],
    ];
    for (let i = 0; i < hoodSpans.length; i++) {
      const [sx, sw] = hoodSpans[i];
      const hy = 4 + bobY + i;
      c.fillRect(ox + sx + leanX - 1, hy, sw + 2, 1, '#09090b');
      c.fillRect(ox + sx + leanX, hy, sw, 1, '#1e1b4b');
      if (i < 5) c.fillRect(ox + sx + leanX, hy, Math.max(2, Math.floor(sw * 0.6)), 1, '#312e81');
    }
    c.drawLine(ox + 15 + leanX, 4 + bobY, ox + 11 + leanX, 8 + bobY, '#38bdf8');
    c.fillRect(ox + 12 + leanX, 8 + bobY, 8, 5, '#09090b');

    // Glowing spectral eyes (#38bdf8 / #e0f2fe)
    c.fillRect(ox + 13 + leanX, 10 + bobY, 2, 2, '#0284c7');
    c.setPixel(ox + 13 + leanX, 10 + bobY, '#38bdf8');
    c.setPixel(ox + 14 + leanX, 10 + bobY, '#e0f2fe');
    c.fillRect(ox + 17 + leanX, 10 + bobY, 2, 2, '#0284c7');
    c.setPixel(ox + 17 + leanX, 10 + bobY, '#38bdf8');
    c.setPixel(ox + 18 + leanX, 10 + bobY, '#e0f2fe');

    // Spectral chest core & rune trim
    c.fillRect(ox + 14 + leanX, 16 + bobY, 4, 4, '#0c4a6e');
    c.fillRect(ox + 14 + leanX, 16 + bobY, 4, 3, '#0284c7');
    c.fillRect(ox + 15 + leanX, 17 + bobY, 2, 1, '#38bdf8');
    c.setPixel(ox + 15 + leanX, 17 + bobY, '#e0f2fe');
  }

  // Frame 0: idle0
  drawBaseWraith(0, 0, 0);
  c.fillRect(22, 18, 4, 2, '#52525b');
  c.setPixel(22, 18, '#a1a1aa');
  c.fillRect(23, 7, 2, 11, '#0284c7');
  c.fillRect(23, 8, 2, 9, '#38bdf8');
  c.drawLine(24, 6, 24, 17, '#e0f2fe');

  // Frame 1: idle1
  drawBaseWraith(32, 1, 0);
  c.fillRect(32 + 22, 19, 4, 2, '#52525b');
  c.setPixel(32 + 22, 19, '#a1a1aa');
  c.fillRect(32 + 23, 7, 2, 12, '#0284c7');
  c.fillRect(32 + 23, 8, 2, 10, '#38bdf8');
  c.drawLine(32 + 24, 6, 32 + 24, 17, '#e0f2fe');
  c.setPixel(32 + 22, 10, '#38bdf8');
  c.setPixel(32 + 25, 13, '#7dd3fc');
  c.setPixel(32 + 10, 12, '#38bdf8');

  // Frame 2: attack
  drawBaseWraith(64, 0, 2);
  c.fillRect(64 + 19, 14, 11, 4, '#0284c7', 210);
  c.fillRect(64 + 20, 15, 11, 2, '#e0f2fe');
  c.drawLine(64 + 23, 5, 64 + 30, 13, '#0284c7');
  c.drawLine(64 + 24, 6, 64 + 30, 14, '#38bdf8');
  c.drawLine(64 + 26, 7, 64 + 31, 15, '#e0f2fe');
  c.drawLine(64 + 23, 26, 64 + 30, 18, '#0284c7');
  c.drawLine(64 + 24, 25, 64 + 30, 17, '#38bdf8');
  c.drawLine(64 + 26, 24, 64 + 31, 16, '#e0f2fe');

  // Frame 3: dash
  c.fillRect(96 + 2, 12, 10, 10, '#0284c7', 110);
  c.fillRect(96 + 6, 10, 12, 14, '#38bdf8', 160);
  drawBaseWraith(96, 0, 4);
  c.fillRect(96 + 2, 14, 25, 3, '#38bdf8');
  c.fillRect(96 + 8, 15, 21, 1, '#e0f2fe');
  c.setPixel(96 + 4, 10, '#7dd3fc');
  c.setPixel(96 + 7, 22, '#38bdf8');

  return c;
}

// --- 2. Abyssal Slime (64x32, 2 frames 32x32: idle0, idle1) ---
function generateAbyssalSlime() {
  const c = new PixelCanvas(64, 32);

  c.fillRect(8, 26, 16, 2, '#09090b', 180);
  c.fillCircle(16, 20, 9.5, '#09090b');
  c.fillCircle(16, 20, 8.5, '#450a0a');
  c.fillCircle(16, 19.5, 7.5, '#991b1b');
  c.fillCircle(15, 18.5, 5.5, '#dc2626');
  c.fillCircle(14, 17.5, 3.5, '#ef4444');
  c.fillRect(8, 25, 16, 3, '#09090b');
  c.fillRect(9, 24, 14, 3, '#450a0a');
  c.fillRect(10, 24, 12, 2, '#991b1b');
  c.fillRect(11, 13, 4, 2, '#fca5a5');
  c.setPixel(11, 13, '#fee2e2');
  c.setPixel(19, 15, '#f87171');
  c.fillRect(12, 19, 2, 2, '#f97316');
  c.fillRect(18, 19, 2, 2, '#f97316');
  c.setPixel(12, 19, '#fef08a');
  c.setPixel(18, 19, '#fef08a');

  c.fillRect(32 + 6, 27, 20, 2, '#09090b', 180);
  c.fillCircle(32 + 16, 21.5, 9.5, '#09090b');
  c.fillRect(32 + 5, 19, 22, 9, '#09090b');
  c.fillRect(32 + 6, 18, 20, 9, '#450a0a');
  c.fillRect(32 + 7, 17, 18, 8, '#991b1b');
  c.fillRect(32 + 9, 16, 14, 7, '#dc2626');
  c.fillRect(32 + 10, 16, 9, 4, '#ef4444');
  c.fillRect(32 + 10, 15, 4, 2, '#fca5a5');
  c.setPixel(32 + 10, 15, '#fee2e2');
  c.fillRect(32 + 11, 21, 2, 2, '#f97316');
  c.fillRect(32 + 19, 21, 2, 2, '#f97316');
  c.setPixel(32 + 11, 21, '#fef08a');
  c.setPixel(32 + 19, 21, '#fef08a');
  c.fillRect(32 + 4, 13, 3, 3, '#09090b');
  c.setPixel(32 + 5, 14, '#ef4444');
  c.fillRect(32 + 25, 14, 3, 3, '#09090b');
  c.setPixel(32 + 26, 15, '#ef4444');

  return c;
}

// --- 3. Bone Sentinel (64x32, 2 frames 32x32: idle0, attack) ---
function generateBoneSentinel() {
  const c = new PixelCanvas(64, 32);

  function drawSkeletonBody(ox, lean = 0) {
    c.fillRect(ox + 10 + lean, 28, 12, 2, '#09090b', 180);

    c.fillRect(ox + 11 + lean, 4, 10, 10, '#09090b');
    c.fillRect(ox + 12 + lean, 5, 8, 7, '#a1a1aa');
    c.fillRect(ox + 12 + lean, 5, 6, 5, '#e4e4e7');
    c.fillRect(ox + 13 + lean, 5, 3, 2, '#fafafa');
    c.fillRect(ox + 13 + lean, 12, 6, 2, '#71717a');
    c.setPixel(ox + 14 + lean, 12, '#d4d4d8');
    c.setPixel(ox + 16 + lean, 12, '#d4d4d8');
    c.fillRect(ox + 13 + lean, 8, 2, 2, '#f97316');
    c.setPixel(ox + 13 + lean, 8, '#fef08a');
    c.fillRect(ox + 17 + lean, 8, 2, 2, '#f97316');
    c.setPixel(ox + 17 + lean, 8, '#fef08a');

    c.fillRect(ox + 11 + lean, 15, 10, 8, '#09090b');
    c.fillRect(ox + 15 + lean, 14, 2, 10, '#71717a');
    for (let ry = 16; ry <= 20; ry += 2) {
      c.fillRect(ox + 12 + lean, ry, 8, 1, '#d4d4d8');
      c.fillRect(ox + 13 + lean, ry, 3, 1, '#fafafa');
    }

    c.fillRect(ox + 12 + lean, 23, 8, 2, '#71717a');
    c.fillRect(ox + 13 + lean, 23, 3, 1, '#d4d4d8');
    c.fillRect(ox + 12 + lean, 25, 2, 4, '#d4d4d8');
    c.setPixel(ox + 12 + lean, 25, '#fafafa');
    c.fillRect(ox + 18 + lean, 25, 2, 4, '#d4d4d8');
    c.setPixel(ox + 18 + lean, 25, '#fafafa');
  }

  drawSkeletonBody(0, 0);
  c.fillRect(6, 14, 6, 10, '#09090b');
  c.fillRect(7, 15, 4, 8, '#3f3f46');
  c.fillRect(8, 16, 2, 6, '#71717a');
  c.drawLine(7, 15, 7, 22, '#a1a1aa');
  c.fillRect(21, 8, 4, 13, '#09090b');
  c.fillRect(22, 9, 2, 11, '#d4d4d8');
  c.drawLine(22, 9, 22, 18, '#fafafa');
  c.fillRect(21, 18, 4, 2, '#52525b');

  drawSkeletonBody(32, 2);
  c.fillRect(32 + 21, 14, 9, 3, '#e4e4e7');
  c.drawLine(32 + 21, 14, 32 + 29, 14, '#fafafa');
  c.drawLine(32 + 22, 6, 32 + 30, 15, '#f97316');
  c.drawLine(32 + 24, 6, 32 + 31, 16, '#facc15');
  c.drawLine(32 + 23, 24, 32 + 30, 16, '#f97316');
  c.setPixel(32 + 30, 15, '#fef08a');

  return c;
}

// --- 4. Infernal Warden (128x64, 2 frames 64x64: idle, slam) ---
function generateInfernalWarden() {
  const c = new PixelCanvas(128, 64);

  function drawBossBody(ox, yOff = 0) {
    c.fillRect(ox + 14, 57, 36, 4, '#09090b', 180);

    // Sweeping curved obsidian horns
    const hornSteps = [
      [8, 3, 4],
      [9, 5, 5],
      [11, 7, 5],
      [14, 9, 6],
      [16, 11, 6],
    ];
    for (const [hx, hy, hw] of hornSteps) {
      c.fillRect(ox + hx - 1, hy + yOff - 1, hw + 2, 4, '#09090b');
      c.fillRect(ox + hx, hy + yOff, hw, 2, '#27272a');
      c.fillRect(ox + hx, hy + yOff, Math.max(2, hw - 2), 1, '#71717a');
      const rx = 64 - hx - hw;
      c.fillRect(ox + rx - 1, hy + yOff - 1, hw + 2, 4, '#09090b');
      c.fillRect(ox + rx, hy + yOff, hw, 2, '#27272a');
      c.fillRect(ox + rx + 2, hy + yOff, Math.max(2, hw - 2), 1, '#71717a');
    }

    // Tapered muscular demonic torso
    for (let row = 0; row < 30; row++) {
      const w = 36 - Math.floor(row / 3);
      const sx = Math.floor((64 - w) / 2);
      const ry = 19 + yOff + row;
      c.fillRect(ox + sx - 1, ry, w + 2, 1, '#09090b');
      c.fillRect(ox + sx, ry, w, 1, '#450a0a');
      c.fillRect(ox + sx + 2, ry, w - 4, 1, '#7f1d1d');
      if (row < 22) c.fillRect(ox + sx + 4, ry, Math.max(4, w - 10), 1, '#b91c1c');
    }

    // Spiked shoulder pauldrons with ember rim
    for (let row = 0; row < 12; row++) {
      const pw = 12 - Math.floor(row / 2);
      const py = 18 + yOff + row;
      c.fillRect(ox + 6, py, pw + 2, 1, '#09090b');
      c.fillRect(ox + 7, py, pw, 1, row < 3 ? '#f97316' : '#27272a');
      if (row >= 3 && row < 9) c.fillRect(ox + 8, py, Math.max(2, pw - 3), 1, '#991b1b');

      c.fillRect(ox + 56 - pw, py, pw + 2, 1, '#09090b');
      c.fillRect(ox + 57 - pw, py, pw, 1, row < 3 ? '#f97316' : '#27272a');
      if (row >= 3 && row < 9) c.fillRect(ox + 58 - pw, py, Math.max(2, pw - 3), 1, '#991b1b');
    }
    // Pauldron spikes
    c.fillRect(ox + 8, 15 + yOff, 3, 4, '#09090b');
    c.setPixel(ox + 9, 15 + yOff, '#a1a1aa');
    c.fillRect(ox + 53, 15 + yOff, 3, 4, '#09090b');
    c.setPixel(ox + 54, 15 + yOff, '#a1a1aa');

    // Angular demon helm/head & blazing crown
    c.fillRect(ox + 22, 10 + yOff, 20, 14, '#09090b');
    c.fillRect(ox + 24, 11 + yOff, 16, 11, '#7f1d1d');
    c.fillRect(ox + 25, 12 + yOff, 14, 9, '#dc2626');
    c.drawLine(ox + 25, 11 + yOff, ox + 38, 11 + yOff, '#f87171');
    c.fillRect(ox + 26, 15 + yOff, 4, 3, '#f97316');
    c.fillRect(ox + 34, 15 + yOff, 4, 3, '#f97316');
    c.fillRect(ox + 27, 16 + yOff, 2, 1, '#fef08a');
    c.fillRect(ox + 35, 16 + yOff, 2, 1, '#fef08a');

    // Molten chest core & radiating fissures
    c.fillCircle(ox + 32, 32 + yOff, 7, '#7f1d1d');
    c.fillCircle(ox + 32, 32 + yOff, 5.5, '#f97316');
    c.fillCircle(ox + 32, 32 + yOff, 3, '#facc15');
    c.fillCircle(ox + 32, 32 + yOff, 1.5, '#fef08a');
    c.drawLine(ox + 22, 30 + yOff, ox + 26, 32 + yOff, '#f97316');
    c.drawLine(ox + 38, 32 + yOff, ox + 42, 30 + yOff, '#f97316');

    // Heavy greaves
    c.fillRect(ox + 18, 48 + yOff, 11, 11, '#09090b');
    c.fillRect(ox + 19, 49 + yOff, 9, 9, '#27272a');
    c.fillRect(ox + 20, 50 + yOff, 5, 4, '#52525b');
    c.fillRect(ox + 35, 48 + yOff, 11, 11, '#09090b');
    c.fillRect(ox + 36, 49 + yOff, 9, 9, '#27272a');
    c.fillRect(ox + 37, 50 + yOff, 5, 4, '#52525b');
  }

  drawBossBody(0, 0);
  c.fillRect(51, 12, 5, 42, '#09090b');
  c.fillRect(52, 12, 3, 41, '#52525b');
  c.drawLine(52, 12, 52, 50, '#a1a1aa');
  c.fillRect(45, 7, 16, 12, '#09090b');
  c.fillRect(46, 8, 14, 10, '#27272a');
  c.fillRect(48, 10, 10, 6, '#dc2626');
  c.fillRect(49, 11, 8, 4, '#f97316');
  c.fillRect(51, 12, 4, 2, '#fef08a');

  drawBossBody(64, 3);
  c.fillRect(64 + 47, 26, 6, 30, '#09090b');
  c.fillRect(64 + 48, 26, 4, 29, '#52525b');
  c.fillRect(64 + 41, 47, 20, 12, '#09090b');
  c.fillRect(64 + 42, 48, 18, 10, '#991b1b');
  c.fillRect(64 + 44, 50, 14, 6, '#f97316');
  c.fillRect(64 + 47, 52, 8, 2, '#fef08a');
  c.fillRect(64 + 4, 56, 56, 6, '#7f1d1d');
  c.fillRect(64 + 6, 56, 52, 5, '#dc2626');
  c.fillRect(64 + 10, 57, 44, 3, '#f97316');
  c.fillRect(64 + 16, 58, 32, 1, '#fef08a');
  c.setPixel(64 + 12, 53, '#facc15');
  c.setPixel(64 + 28, 52, '#f97316');
  c.setPixel(64 + 54, 53, '#facc15');

  return c;
}

// --- 5. Dungeon Tiles (64x16, 4 tiles 16x16) ---
function generateDungeonTiles() {
  const c = new PixelCanvas(64, 16);

  c.ditherRect(0, 0, 16, 16, '#121218', '#171720', 0.25);
  c.ditherRect(1, 1, 6, 6, '#171720', '#1c1c27', 0.35);
  c.ditherRect(8, 1, 7, 6, '#15151d', '#191924', 0.25);
  c.ditherRect(1, 8, 7, 7, '#15151d', '#1a1a24', 0.25);
  c.ditherRect(9, 8, 6, 7, '#171720', '#1d1d28', 0.35);
  c.drawLine(0, 7, 15, 7, '#09090b');
  c.drawLine(7, 0, 7, 7, '#09090b');
  c.drawLine(8, 7, 8, 15, '#09090b');
  c.setPixel(1, 1, '#232331');
  c.setPixel(9, 8, '#232331');

  c.ditherRect(16, 0, 16, 16, '#121218', '#171721', 0.3);
  c.drawLine(16 + 2, 2, 16 + 9, 8, '#09090b');
  c.drawLine(16 + 9, 8, 16 + 13, 6, '#09090b');
  c.drawLine(16 + 9, 8, 16 + 7, 13, '#09090b');
  c.drawLine(16 + 3, 2, 16 + 9, 7, '#1f1f2b');
  c.fillRect(16 + 3, 11, 3, 2, '#272730');
  c.fillRect(16 + 11, 3, 2, 2, '#1e3a2f');
  c.setPixel(16 + 12, 3, '#2d5a47');
  c.fillRect(16 + 8, 9, 2, 2, '#1e3a2f');

  c.fillRect(32, 0, 16, 16, '#09090b');
  c.fillRect(32, 0, 16, 2, '#3f3f4e');
  c.drawLine(32, 0, 47, 0, '#52525b');
  c.fillRect(32 + 1, 2, 6, 5, '#272730');
  c.fillRect(32 + 1, 2, 5, 2, '#343440');
  c.fillRect(32 + 8, 2, 7, 5, '#272730');
  c.fillRect(32 + 8, 2, 6, 2, '#343440');
  c.fillRect(32, 8, 4, 6, '#1f1f29');
  c.fillRect(32 + 5, 8, 6, 6, '#272730');
  c.fillRect(32 + 5, 8, 5, 2, '#343440');
  c.fillRect(32 + 12, 8, 4, 6, '#1f1f29');

  c.ditherRect(48, 0, 16, 16, '#121218', '#171721', 0.25);
  c.fillCircle(48 + 8, 8, 7, '#0c4a6e');
  c.fillCircle(48 + 8, 8, 5.5, '#0284c7');
  c.fillCircle(48 + 8, 8, 3.5, '#38bdf8');
  c.fillCircle(48 + 8, 8, 1.8, '#e0f2fe');
  c.setPixel(48 + 4, 4, '#7dd3fc');
  c.setPixel(48 + 12, 11, '#7dd3fc');

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

  {
    const ox = 0;
    for (let i = 0; i < 8; i++) {
      const bx = ox + 12 - i;
      const by = 2 + i;
      c.fillRect(bx - 1, by - 1, 3, 3, '#09090b');
    }
    c.fillRect(ox + 2, 8, 6, 6, '#09090b');
    c.fillRect(ox + 1, 12, 3, 3, '#09090b');
    for (let i = 0; i < 8; i++) {
      const bx = ox + 12 - i;
      const by = 2 + i;
      c.setPixel(bx, by, '#e4e4e7');
      c.setPixel(bx + 1, by, '#38bdf8');
      c.setPixel(bx, by + 1, '#a1a1aa');
    }
    c.setPixel(ox + 13, 2, '#e0f2fe');
    c.setPixel(ox + 12, 2, '#e0f2fe');
    c.drawLine(ox + 3, 8, ox + 7, 12, '#facc15');
    c.drawLine(ox + 3, 9, ox + 6, 12, '#71717a');
    c.setPixel(ox + 3, 12, '#3f3f46');
    c.setPixel(ox + 2, 13, '#facc15');
  }

  {
    const ox = 16;
    c.fillRect(ox + 2, 2, 12, 12, '#09090b');
    c.fillRect(ox + 5, 2, 6, 2, '#09090b');
    c.fillRect(ox + 6, 2, 4, 2, '#000000', 0);
    c.fillRect(ox + 2, 3, 4, 4, '#52525b');
    c.fillRect(ox + 10, 3, 4, 4, '#52525b');
    c.fillRect(ox + 3, 3, 2, 2, '#e4e4e7');
    c.fillRect(ox + 11, 3, 2, 2, '#e4e4e7');
    c.fillRect(ox + 4, 4, 8, 8, '#3f3f46');
    c.fillRect(ox + 5, 5, 6, 6, '#71717a');
    c.fillRect(ox + 5, 11, 6, 2, '#52525b');
    c.drawLine(ox + 5, 5, ox + 10, 5, '#e4e4e7');
    c.drawLine(ox + 7, 5, ox + 7, 12, '#3f3f46');
    c.fillRect(ox + 7, 7, 2, 2, '#38bdf8');
    c.setPixel(ox + 7, 7, '#e0f2fe');
  }

  {
    const ox = 32;
    c.drawLine(ox + 4, 5, ox + 6, 2, '#a1a1aa');
    c.drawLine(ox + 6, 2, ox + 9, 2, '#e4e4e7');
    c.drawLine(ox + 9, 2, ox + 11, 5, '#a1a1aa');
    c.setPixel(ox + 5, 4, '#71717a');
    c.setPixel(ox + 10, 4, '#71717a');
    c.fillRect(ox + 4, 6, 8, 8, '#09090b');
    c.fillRect(ox + 5, 5, 6, 10, '#09090b');
    c.fillRect(ox + 5, 6, 6, 8, '#ca8a04');
    c.fillRect(ox + 6, 6, 4, 7, '#facc15');
    c.fillRect(ox + 6, 8, 4, 4, '#991b1b');
    c.fillRect(ox + 7, 8, 2, 3, '#ef4444');
    c.setPixel(ox + 7, 8, '#fca5a5');
  }

  {
    const ox = 48;
    c.fillCircle(ox + 8, 9, 5, '#09090b');
    c.fillCircle(ox + 8, 9, 4, '#ca8a04');
    c.fillCircle(ox + 8, 9, 3, '#facc15');
    c.fillCircle(ox + 8, 9, 1.8, '#000000', 0);
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
    { ox: 0, glow: '#71717a', shadow: '#3f3f46', mid: '#a1a1aa', primary: '#e4e4e7', highlight: '#fafafa', flair: 0 },
    { ox: 16, glow: '#0284c7', shadow: '#0c4a6e', mid: '#0284c7', primary: '#38bdf8', highlight: '#e0f2fe', flair: 1 },
    { ox: 32, glow: '#ca8a04', shadow: '#713f12', mid: '#eab308', primary: '#facc15', highlight: '#fef08a', flair: 2 },
    { ox: 48, glow: '#dc2626', shadow: '#7f1d1d', mid: '#ea580c', primary: '#f97316', highlight: '#fed7aa', flair: 3 },
  ];

  for (const t of tiers) {
    const cx = t.ox + 8;
    c.fillCircle(cx, 8, 6, t.glow, 95);
    c.fillCircle(cx, 8, 5, '#09090b');
    c.fillRect(t.ox + 4, 11, 8, 3, '#09090b');
    c.fillRect(t.ox + 5, 12, 6, 1, '#52525b');
    c.fillCircle(cx, 7.5, 3.8, t.shadow);
    c.fillCircle(cx, 7, 3, t.mid);
    c.fillCircle(cx - 0.5, 6.5, 2.2, t.primary);
    c.setPixel(cx - 1, 5, t.highlight);
    c.setPixel(cx - 2, 6, t.highlight);
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

  {
    const ox = 0;
    c.ditherRect(ox, 0, 16, 16, '#13131b', '#171722', 0.25);
    c.ditherRect(ox + 1, 1, 6, 6, '#1a1a25', '#21212f', 0.3);
    c.ditherRect(ox + 8, 1, 7, 5, '#171721', '#1c1c28', 0.25);
    c.ditherRect(ox + 1, 8, 7, 7, '#171721', '#1c1c28', 0.25);
    c.ditherRect(ox + 9, 7, 6, 8, '#1a1a25', '#21212f', 0.3);
    c.drawLine(ox, 7, ox + 7, 7, '#09090b');
    c.drawLine(ox + 8, 6, ox + 15, 6, '#09090b');
    c.drawLine(ox + 7, 0, ox + 7, 15, '#09090b');
    c.setPixel(ox + 2, 2, '#272735');
    c.setPixel(ox + 10, 8, '#272735');
    c.drawLine(ox + 10, 2, ox + 12, 4, '#09090b');
  }

  {
    const ox = 16;
    c.fillRect(ox, 0, 16, 16, '#12121a');
    c.ditherRect(ox + 1, 1, 14, 14, '#181824', '#1f1f2f', 0.25);
    c.drawLine(ox, 0, ox + 15, 0, '#09090b');
    c.drawLine(ox, 15, ox + 15, 15, '#09090b');
    c.drawLine(ox, 0, ox, 15, '#09090b');
    c.drawLine(ox + 15, 0, ox + 15, 15, '#09090b');
    c.fillCircle(ox + 8, 8, 5, '#0c4a6e', 90);
    c.drawLine(ox + 5, 3, ox + 10, 3, '#0284c7');
    c.drawLine(ox + 5, 12, ox + 10, 12, '#0284c7');
    c.drawLine(ox + 3, 5, ox + 3, 10, '#0284c7');
    c.drawLine(ox + 12, 5, ox + 12, 10, '#0284c7');
    c.drawLine(ox + 7, 4, ox + 7, 11, '#38bdf8');
    c.drawLine(ox + 8, 4, ox + 8, 11, '#0284c7');
    c.drawLine(ox + 5, 7, ox + 10, 7, '#38bdf8');
    c.fillRect(ox + 7, 7, 2, 2, '#e0f2fe');
  }

  {
    const ox = 32;
    c.fillRect(ox, 0, 16, 16, '#09090b');
    c.fillRect(ox, 0, 10, 2, '#3f3f4e');
    c.drawLine(ox, 0, ox + 9, 0, '#64748b');
    c.fillRect(ox + 11, 1, 5, 1, '#52525b');
    c.fillRect(ox + 1, 2, 6, 5, '#272730');
    c.fillRect(ox + 1, 2, 5, 2, '#343440');
    c.fillRect(ox + 8, 2, 7, 5, '#1f1f29');
    c.fillRect(ox, 8, 4, 6, '#1f1f29');
    c.fillRect(ox + 5, 8, 6, 6, '#272730');
    c.fillRect(ox + 5, 8, 5, 2, '#343440');
    c.fillRect(ox + 12, 8, 4, 6, '#272730');
    c.fillRect(ox + 2, 3, 2, 2, '#3f3f4e');
    c.fillRect(ox + 9, 9, 2, 2, '#1e3a2f');
    c.setPixel(ox + 9, 9, '#2d5a47');
    c.fillRect(ox + 6, 12, 2, 2, '#1e3a2f');
  }

  {
    const ox = 48;
    c.ditherRect(ox, 0, 16, 16, '#13131b', '#171722', 0.25);
    c.fillCircle(ox + 8, 8, 6.5, '#0284c7', 85);
    c.fillRect(ox + 4, 12, 8, 3, '#09090b');
    c.fillRect(ox + 5, 13, 6, 2, '#272730');
    c.fillRect(ox + 3, 8, 10, 5, '#09090b');
    c.fillRect(ox + 4, 9, 8, 3, '#3f3f46');
    c.drawLine(ox + 4, 9, ox + 11, 9, '#94a3b8');
    c.fillRect(ox + 5, 4, 6, 5, '#0284c7');
    c.fillRect(ox + 6, 3, 4, 6, '#38bdf8');
    c.fillRect(ox + 7, 2, 2, 5, '#e0f2fe');
    c.setPixel(ox + 5, 2, '#38bdf8');
    c.setPixel(ox + 10, 3, '#7dd3fc');
    c.setPixel(ox + 8, 1, '#e0f2fe');
  }

  return c;
}

// --- 10. Hub NPCs (128x32, 4 frames 32x32: emissary, blacksmith, soul_altar, rift_portal) ---
function generateHubNpcs() {
  const c = new PixelCanvas(128, 32);

  {
    const ox = 0;
    c.fillRect(ox + 10, 27, 12, 2, '#0284c7', 150);
    c.fillRect(ox + 4, 10, 5, 11, '#09090b');
    c.fillRect(ox + 23, 10, 5, 11, '#09090b');
    c.fillRect(ox + 5, 11, 4, 9, '#0284c7');
    c.fillRect(ox + 23, 11, 4, 9, '#0284c7');
    c.drawLine(ox + 5, 12, ox + 7, 18, '#7dd3fc');
    c.drawLine(ox + 26, 12, ox + 24, 18, '#7dd3fc');
    c.fillRect(ox + 9, 13, 14, 14, '#09090b');
    c.fillRect(ox + 10, 14, 12, 12, '#1e1b4b');
    c.fillRect(ox + 12, 14, 8, 11, '#cbd5e1');
    c.fillRect(ox + 12, 14, 4, 9, '#f1f5f9');
    c.fillRect(ox + 14, 15, 4, 9, '#94a3b8');
    c.fillRect(ox + 15, 16, 2, 7, '#38bdf8');
    c.fillRect(ox + 11, 4, 10, 10, '#09090b');
    c.fillRect(ox + 12, 5, 8, 8, '#cbd5e1');
    c.fillRect(ox + 12, 5, 4, 2, '#f8fafc');
    c.fillRect(ox + 13, 7, 6, 5, '#09090b');
    c.fillRect(ox + 14, 9, 1, 2, '#38bdf8');
    c.fillRect(ox + 17, 9, 1, 2, '#38bdf8');
    c.setPixel(ox + 14, 9, '#e0f2fe');
    c.setPixel(ox + 17, 9, '#e0f2fe');
    c.drawLine(ox + 13, 2, ox + 18, 2, '#fde047');
    c.setPixel(ox + 12, 3, '#facc15');
    c.setPixel(ox + 19, 3, '#facc15');
    c.fillRect(ox + 24, 9, 2, 18, '#71717a');
    c.fillRect(ox + 23, 6, 4, 4, '#09090b');
    c.fillRect(ox + 24, 7, 2, 2, '#38bdf8');
    c.setPixel(ox + 24, 7, '#e0f2fe');
  }

  {
    const ox = 32;
    c.fillRect(ox + 5, 27, 22, 2, '#09090b', 180);
    c.fillRect(ox + 6, 13, 12, 14, '#09090b');
    c.fillRect(ox + 7, 14, 10, 12, '#334155');
    c.fillRect(ox + 7, 14, 4, 6, '#475569');
    c.fillRect(ox + 9, 15, 6, 9, '#1e3a5f');
    c.fillRect(ox + 10, 17, 4, 3, '#38bdf8');
    c.setPixel(ox + 11, 18, '#e0f2fe');
    c.fillRect(ox + 7, 6, 10, 8, '#09090b');
    c.fillRect(ox + 8, 7, 8, 6, '#475569');
    c.drawLine(ox + 8, 7, ox + 13, 7, '#94a3b8');
    c.fillRect(ox + 9, 9, 6, 3, '#09090b');
    c.fillRect(ox + 10, 10, 2, 1, '#38bdf8');
    c.fillRect(ox + 13, 10, 2, 1, '#38bdf8');
    c.fillRect(ox + 17, 10, 3, 7, '#64748b');
    c.fillRect(ox + 16, 7, 6, 4, '#09090b');
    c.fillRect(ox + 17, 8, 4, 2, '#cbd5e1');
    c.setPixel(ox + 17, 8, '#f8fafc');
    c.fillRect(ox + 19, 19, 10, 8, '#09090b');
    c.fillRect(ox + 18, 19, 11, 3, '#475569');
    c.drawLine(ox + 19, 19, ox + 28, 19, '#cbd5e1');
    c.fillRect(ox + 21, 22, 5, 4, '#334155');
    c.fillRect(ox + 20, 25, 7, 2, '#475569');
    c.setPixel(ox + 23, 17, '#e0f2fe');
    c.setPixel(ox + 25, 16, '#38bdf8');
    c.setPixel(ox + 21, 18, '#7dd3fc');
  }

  {
    const ox = 64;
    c.fillCircle(ox + 16, 14, 11, '#0284c7', 75);
    c.fillRect(ox + 5, 25, 22, 4, '#09090b');
    c.fillRect(ox + 6, 26, 20, 2, '#272730');
    c.drawLine(ox + 6, 26, ox + 25, 26, '#3f3f4e');
    c.fillRect(ox + 8, 21, 16, 4, '#09090b');
    c.fillRect(ox + 9, 22, 14, 2, '#3f3f4e');
    c.fillRect(ox + 10, 13, 12, 9, '#09090b');
    c.fillRect(ox + 11, 14, 10, 7, '#272730');
    c.fillRect(ox + 12, 14, 8, 2, '#64748b');
    c.fillRect(ox + 13, 17, 2, 3, '#0284c7');
    c.fillRect(ox + 17, 17, 2, 3, '#0284c7');
    c.setPixel(ox + 15, 18, '#38bdf8');
    c.setPixel(ox + 16, 18, '#38bdf8');
    c.fillCircle(ox + 16, 8, 5, '#0284c7', 190);
    c.fillCircle(ox + 16, 8, 3.5, '#38bdf8', 240);
    c.fillCircle(ox + 16, 8, 2, '#e0f2fe', 255);
    c.setPixel(ox + 16, 2, '#38bdf8');
    c.setPixel(ox + 12, 6, '#e0f2fe');
    c.setPixel(ox + 20, 7, '#7dd3fc');
  }

  {
    const ox = 96;
    c.fillRect(ox + 4, 4, 24, 25, '#09090b');
    c.fillRect(ox + 6, 2, 20, 4, '#09090b');
    c.fillRect(ox + 5, 6, 5, 22, '#272730');
    c.fillRect(ox + 5, 6, 2, 22, '#3f3f4e');
    c.fillRect(ox + 22, 6, 5, 22, '#272730');
    c.fillRect(ox + 22, 6, 2, 22, '#3f3f4e');
    c.fillRect(ox + 7, 3, 18, 4, '#3f3f4e');
    c.drawLine(ox + 7, 3, ox + 24, 3, '#64748b');
    c.fillRect(ox + 7, 10, 2, 3, '#38bdf8');
    c.fillRect(ox + 7, 17, 2, 3, '#0284c7');
    c.fillRect(ox + 23, 10, 2, 3, '#38bdf8');
    c.fillRect(ox + 23, 17, 2, 3, '#0284c7');
    c.fillRect(ox + 15, 4, 2, 2, '#e0f2fe');
    c.fillRect(ox + 10, 7, 12, 21, '#09090b');
    c.fillCircle(ox + 16, 17, 7, '#1e1b4b');
    c.fillCircle(ox + 16, 17, 5.5, '#0284c7');
    c.fillCircle(ox + 16, 17, 3.5, '#38bdf8');
    c.fillCircle(ox + 16, 17, 1.8, '#e0f2fe');
    c.setPixel(ox + 12, 12, '#e0f2fe');
    c.setPixel(ox + 20, 21, '#e0f2fe');
    c.setPixel(ox + 13, 22, '#7dd3fc');
    c.setPixel(ox + 19, 12, '#7dd3fc');
    c.fillRect(ox + 8, 27, 16, 2, '#52525b');
  }

  return c;
}

// --- 11. Village Tiles (64x16, 4 frames 16x16: grass_path, cobble_square, wood_wall, village_lantern) ---
function generateVillageTiles() {
  const c = new PixelCanvas(64, 16);

  // Frame 0: grass_path (grama escura/musgo sombrio contínuo, sem listras)
  c.ditherRect(0, 0, 16, 16, '#1a3322', '#1f3d28', 0.45);
  const mossClusters = [
    [2, 2], [3, 2], [2, 3],
    [10, 4], [11, 5],
    [6, 9], [7, 9], [7, 10],
    [13, 12], [14, 12], [13, 13],
    [0, 5], [15, 11], [5, 14], [11, 1],
  ];
  for (const [mx, my] of mossClusters) {
    c.setPixel(mx, my, '#264b31');
  }
  // Raros tufos de grama e pedrinhas discretas distribuídos de forma equilibrada
  c.setPixel(4, 6, '#264b31');
  c.setPixel(4, 5, '#2f5c3c');
  c.setPixel(12, 10, '#264b31');
  c.setPixel(13, 9, '#2f5c3c');
  c.setPixel(9, 2, '#2d3630');
  c.setPixel(10, 2, '#3a423d');
  c.setPixel(2, 13, '#2d3630');

  c.fillRect(16, 0, 16, 16, '#3b352f');
  const stones = [
    [1, 1, 6, 6],
    [8, 1, 7, 5],
    [1, 8, 5, 7],
    [7, 7, 8, 8],
  ];
  for (const [sx, sy, sw, sh] of stones) {
    c.fillRect(16 + sx, sy, sw, sh, '#6b6257');
    c.ditherRect(16 + sx, sy, sw - 1, sh - 1, '#7e7467', '#8f8476', 0.4);
    c.drawLine(16 + sx, sy, 16 + sx + sw - 2, sy, '#a89b8c');
    c.drawLine(16 + sx, sy + sh - 1, 16 + sx + sw - 1, sy + sh - 1, '#4f4840');
  }

  c.fillRect(32, 0, 16, 16, '#2e1a0d');
  c.fillRect(32, 0, 16, 3, '#7c4d2b');
  c.drawLine(32, 0, 47, 0, '#a66d42');
  c.fillRect(32 + 1, 3, 14, 11, '#5c3a21');
  c.fillRect(32 + 3, 4, 10, 8, '#d6b892');
  c.ditherRect(32 + 3, 4, 10, 8, '#c8a67d', '#dfc5a4', 0.35);
  c.fillRect(32 + 7, 4, 2, 8, '#5c3a21');
  c.fillRect(32, 13, 16, 3, '#4f4840');
  c.drawLine(32, 13, 47, 13, '#7e7467');

  c.ditherRect(48, 0, 16, 16, '#6b6257', '#7e7467', 0.35);
  c.fillCircle(48 + 8, 6, 6, '#f59e0b', 90);
  c.fillRect(48 + 6, 12, 4, 3, '#1c1917');
  c.fillRect(48 + 7, 8, 2, 6, '#44403c');
  c.fillRect(48 + 5, 2, 6, 7, '#1c1917');
  c.fillRect(48 + 6, 3, 4, 5, '#f59e0b');
  c.fillRect(48 + 7, 4, 2, 3, '#fde047');
  c.setPixel(48 + 7, 5, '#fef9c3');

  return c;
}

// --- 12. Village NPCs (128x32, 4 frames 32x32: weapon_master, village_blacksmith, potion_stall, village_gate) ---
function generateVillageNpcs() {
  const c = new PixelCanvas(128, 32);

  // Frame 0: weapon_master
  {
    const ox = 0;
    c.fillRect(ox + 9, 27, 14, 2, '#09090b', 170);
    for (let row = 0; row < 13; row++) {
      const w = 12 + Math.floor(row / 3);
      const sx = 15 - Math.floor(w / 2);
      c.fillRect(ox + sx - 1, 14 + row, w + 2, 1, '#09090b');
      c.fillRect(ox + sx, 14 + row, w, 1, '#7f1d1d');
      c.fillRect(ox + sx + 1, 14 + row, Math.max(2, w - 3), 1, '#b91c1c');
    }
    c.fillRect(ox + 12, 15, 7, 8, '#52525b');
    c.fillRect(ox + 13, 15, 4, 4, '#94a3b8');
    c.fillRect(ox + 11, 5, 10, 9, '#09090b');
    c.fillRect(ox + 12, 6, 8, 5, '#d6a47a');
    c.fillRect(ox + 12, 5, 8, 2, '#94a3b8');
    c.fillRect(ox + 12, 10, 8, 3, '#cbd5e1');
    c.fillRect(ox + 13, 12, 6, 2, '#94a3b8');
    c.setPixel(ox + 14, 8, '#09090b');
    c.setPixel(ox + 17, 8, '#09090b');
    c.fillRect(ox + 23, 4, 2, 24, '#78350f');
    c.fillRect(ox + 22, 3, 5, 6, '#09090b');
    c.fillRect(ox + 23, 4, 3, 4, '#e2e8f0');
    c.setPixel(ox + 24, 3, '#f8fafc');
  }

  // Frame 1: village_blacksmith
  {
    const ox = 32;
    c.fillRect(ox + 5, 27, 22, 2, '#09090b', 170);
    c.fillRect(ox + 6, 13, 12, 14, '#09090b');
    c.fillRect(ox + 7, 14, 10, 12, '#d6a47a');
    c.fillRect(ox + 9, 14, 6, 11, '#78350f');
    c.fillRect(ox + 10, 15, 4, 6, '#92400e');
    c.fillRect(ox + 7, 6, 10, 8, '#09090b');
    c.fillRect(ox + 8, 7, 8, 6, '#e2b086');
    c.fillRect(ox + 8, 6, 8, 2, '#451a03');
    c.fillRect(ox + 9, 10, 6, 2, '#78350f');
    c.setPixel(ox + 10, 9, '#09090b');
    c.setPixel(ox + 13, 9, '#09090b');
    c.fillRect(ox + 17, 10, 2, 7, '#78350f');
    c.fillRect(ox + 16, 7, 5, 4, '#09090b');
    c.fillRect(ox + 17, 8, 3, 2, '#cbd5e1');
    c.fillRect(ox + 19, 19, 10, 8, '#09090b');
    c.fillRect(ox + 18, 19, 11, 3, '#52525b');
    c.drawLine(ox + 19, 19, ox + 28, 19, '#cbd5e1');
    c.fillRect(ox + 21, 22, 5, 4, '#3f3f46');
    c.setPixel(ox + 22, 18, '#f97316');
    c.setPixel(ox + 24, 17, '#facc15');
    c.setPixel(ox + 26, 18, '#f97316');
  }

  // Frame 2: potion_stall
  {
    const ox = 64;
    c.fillRect(ox + 4, 27, 24, 2, '#09090b', 160);
    c.fillRect(ox + 4, 5, 24, 22, '#09090b');
    c.fillRect(ox + 5, 11, 22, 15, '#3b2314');
    c.fillRect(ox + 6, 11, 2, 15, '#7c4d2b');
    c.fillRect(ox + 24, 11, 2, 15, '#7c4d2b');
    for (let x = 0; x < 24; x += 4) {
      c.fillRect(ox + 4 + x, 5, 2, 6, '#b91c1c');
      c.fillRect(ox + 6 + x, 5, 2, 6, '#fef3c7');
    }
    c.drawLine(ox + 4, 11, ox + 27, 11, '#7f1d1d');
    c.fillRect(ox + 5, 18, 22, 8, '#7c4d2b');
    c.drawLine(ox + 5, 18, ox + 26, 18, '#b47a4c');
    c.fillRect(ox + 9, 14, 3, 4, '#ef4444');
    c.setPixel(ox + 10, 15, '#fca5a5');
    c.fillRect(ox + 15, 13, 3, 5, '#38bdf8');
    c.setPixel(ox + 16, 14, '#e0f2fe');
    c.fillRect(ox + 20, 14, 3, 4, '#facc15');
  }

  // Frame 3: village_gate
  {
    const ox = 96;
    c.fillRect(ox + 3, 4, 26, 25, '#09090b');
    c.fillRect(ox + 4, 5, 6, 23, '#78716c');
    c.fillRect(ox + 4, 5, 3, 23, '#a8a29e');
    c.fillRect(ox + 22, 5, 6, 23, '#78716c');
    c.fillRect(ox + 22, 5, 3, 23, '#a8a29e');
    c.fillRect(ox + 6, 3, 20, 5, '#78716c');
    c.drawLine(ox + 6, 3, ox + 25, 3, '#d6d3d1');
    c.fillRect(ox + 10, 8, 12, 20, '#292524');
    c.fillRect(ox + 11, 20, 10, 8, '#7c5836');
    c.fillRect(ox + 13, 12, 6, 8, '#3f6b35');
    c.fillRect(ox + 6, 12, 2, 5, '#f59e0b');
    c.setPixel(ox + 6, 12, '#fef08a');
    c.fillRect(ox + 24, 12, 2, 5, '#f59e0b');
    c.setPixel(ox + 24, 12, '#fef08a');
  }

  return c;
}

// --- 13. Cave Bat (64x32, 2 frames 32x32: flap0, flap1) ---
function generateCaveBat() {
  const c = new PixelCanvas(64, 32);

  function drawBat(ox, wingsUp) {
    const bodyY = wingsUp ? 13 : 11;
    c.fillRect(ox + 11, 26, 10, 2, '#09090b', 150);

    // Sculpted scalloped wings (diagonal triangles)
    for (let i = 0; i < 8; i++) {
      const wy = wingsUp ? (6 + Math.floor(i * 0.7)) : (15 + Math.floor(i * 0.6));
      const wh = Math.max(2, 8 - Math.floor(i * 0.6));
      // Left wing
      c.fillRect(ox + 3 + i, wy - 1, 1, wh + 2, '#09090b');
      c.fillRect(ox + 3 + i, wy, 1, wh, i < 3 ? '#4c1d95' : '#312e81');
      c.setPixel(ox + 3 + i, wy, '#7c3aed');
      // Right wing
      c.fillRect(ox + 28 - i, wy - 1, 1, wh + 2, '#09090b');
      c.fillRect(ox + 28 - i, wy, 1, wh, i < 3 ? '#4c1d95' : '#312e81');
      c.setPixel(ox + 28 - i, wy, '#7c3aed');
    }

    // Pointed ears & fuzzy rounded torso
    c.fillRect(ox + 11, bodyY - 3, 3, 4, '#09090b');
    c.fillRect(ox + 18, bodyY - 3, 3, 4, '#09090b');
    c.setPixel(ox + 12, bodyY - 2, '#584c7a');
    c.setPixel(ox + 19, bodyY - 2, '#584c7a');

    c.fillCircle(ox + 16, bodyY + 5, 5.5, '#09090b');
    c.fillCircle(ox + 16, bodyY + 5, 4.5, '#2e294e');
    c.fillCircle(ox + 15.5, bodyY + 4, 3, '#4338ca');
    c.fillRect(ox + 13, bodyY + 3, 2, 2, '#ef4444');
    c.setPixel(ox + 13, bodyY + 3, '#fca5a5');
    c.fillRect(ox + 17, bodyY + 3, 2, 2, '#ef4444');
    c.setPixel(ox + 17, bodyY + 3, '#fca5a5');
    c.setPixel(ox + 14, bodyY + 7, '#fafafa');
    c.setPixel(ox + 17, bodyY + 7, '#fafafa');
  }

  drawBat(0, true);
  drawBat(32, false);
  return c;
}

// --- 14. Stylized 2D Portraits (512x64, 8 frames 64x64) ---
function generatePortraits() {
  const c = new PixelCanvas(512, 64);

  function makePortrait(frameIdx, drawFn) {
    const sc = new SmoothCanvas(64, 3);
    drawFn(sc);
    sc.downsampleTo(c, frameIdx * 64, 0);
  }

  // Frame 0: hero_living (Young warrior alive, village iron armor, resolute gaze)
  makePortrait(0, (sc) => {
    sc.fillRadialGlow(32, 30, 28, '#334155', 110, '#09090b', 0);
    sc.fillPolygon([[8, 63], [14, 44], [50, 44], [56, 63]], '#09090b');
    sc.fillGradientPolygon([[10, 63], [16, 46], [48, 46], [54, 63]], '#334155', '#1e293b');
    sc.fillShadedEllipse(16, 52, 9, 7, { shadow: '#334155', mid: '#64748b', light: '#cbd5e1', rim: '#f8fafc', rimSide: -1 });
    sc.fillShadedEllipse(48, 52, 9, 7, { shadow: '#1e293b', mid: '#475569', light: '#94a3b8', rim: '#cbd5e1', rimSide: 1 });
    sc.fillShadedEllipse(32, 43, 6.5, 6, { shadow: '#8c5a3c', mid: '#c68b65', light: '#e8b490' });
    sc.fillShadedEllipse(32, 28, 12, 14, { shadow: '#9c6644', mid: '#d69e78', light: '#f3caa7', rim: '#fde68a', rimSide: -1 });
    sc.fillPolygon([[19, 25], [21, 12], [33, 8], [44, 14], [45, 25], [40, 18], [31, 16], [23, 20]], '#09090b');
    sc.fillGradientPolygon([[20, 24], [22, 13], [33, 9], [43, 15], [44, 24], [39, 17], [31, 15], [24, 19]], '#5c2808', '#291002');
    // Nose bridge & firm eyes
    sc.drawStroke(32, 27, 31.5, 32, 0.55, '#9c6644', 180);
    sc.drawStroke(24, 24.5, 29.5, 25.5, 0.9, '#1c0f06');
    sc.drawStroke(40, 24.5, 34.5, 25.5, 0.9, '#1c0f06');
    sc.fillEllipse(27, 27.5, 2.2, 1.3, '#f8fafc');
    sc.fillEllipse(37, 27.5, 2.2, 1.3, '#f8fafc');
    sc.fillEllipse(27, 27.5, 1.1, 1.1, '#1e3a8a');
    sc.fillEllipse(37, 27.5, 1.1, 1.1, '#1e3a8a');
    sc.drawStroke(29, 36.5, 35, 36.5, 0.7, '#7c4328');
  });

  // Frame 1: hero_wraith (Wraith Warrior, dark hood, celestial cyan eyes & runes)
  makePortrait(1, (sc) => {
    sc.fillRadialGlow(32, 28, 30, '#0284c7', 165, '#09090b', 0);
    sc.fillPolygon([[7, 63], [14, 42], [50, 42], [57, 63]], '#09090b');
    sc.fillGradientPolygon([[9, 63], [16, 44], [48, 44], [55, 63]], '#312e81', '#0f172a');
    sc.fillShadedEllipse(16, 51, 9, 7, { shadow: '#0f172a', mid: '#1e1b4b', light: '#4338ca', rim: '#38bdf8', rimSide: -1 });
    sc.fillShadedEllipse(48, 51, 9, 7, { shadow: '#0f172a', mid: '#1e1b4b', light: '#312e81', rim: '#38bdf8', rimSide: 1 });
    sc.drawStroke(32, 48, 32, 59, 1.0, '#0284c7');
    sc.drawStroke(28, 52, 36, 52, 0.9, '#38bdf8');
    sc.fillRadialGlow(32, 52, 6, '#e0f2fe', 200, '#38bdf8', 0);
    sc.fillPolygon([[14, 44], [18, 17], [32, 7], [46, 17], [50, 44]], '#09090b');
    sc.fillGradientPolygon([[16, 42], [20, 18], [32, 9], [44, 18], [48, 42]], '#312e81', '#1e1b4b');
    sc.drawStroke(18, 22, 32, 9, 0.9, '#38bdf8', 210);
    sc.fillEllipse(32, 29, 10.5, 13, '#050508');
    sc.fillRadialGlow(27, 28, 5, '#38bdf8', 190, '#0284c7', 0);
    sc.fillRadialGlow(37, 28, 5, '#38bdf8', 190, '#0284c7', 0);
    sc.fillEllipse(27, 28, 2.5, 1.3, '#e0f2fe');
    sc.fillEllipse(37, 28, 2.5, 1.3, '#e0f2fe');
  });

  // Frame 2: weapon_master (Veteran weapon master, sculpted grey beard, scar, crimson war cloak)
  makePortrait(2, (sc) => {
    sc.fillRadialGlow(32, 30, 28, '#7f1d1d', 120, '#09090b', 0);
    sc.fillPolygon([[7, 63], [14, 44], [50, 44], [57, 63]], '#09090b');
    sc.fillGradientPolygon([[9, 63], [16, 46], [48, 46], [55, 63]], '#991b1b', '#450a0a');
    sc.fillShadedEllipse(16, 53, 8.5, 6.5, { shadow: '#27272a', mid: '#52525b', light: '#a1a1aa', rim: '#f87171', rimSide: -1 });
    sc.fillShadedEllipse(32, 27, 12, 13.5, { shadow: '#8c583a', mid: '#c68863', light: '#e2ab88' });
    // Sculpted veteran grey hair
    sc.fillPolygon([[19, 23], [21, 11], [32, 9], [43, 11], [45, 23], [39, 16], [25, 16]], '#334155');
    sc.fillGradientPolygon([[20, 22], [22, 12], [32, 10], [42, 12], [44, 22], [38, 15], [26, 15]], '#94a3b8', '#475569');
    // Tapered full beard & mustache below mouth/nose (leaves upper face clear)
    sc.fillPolygon([[20, 31], [23, 44], [32, 50], [41, 44], [44, 31], [38, 34], [26, 34]], '#09090b');
    sc.fillGradientPolygon([[21, 32], [24, 43], [32, 48.5], [40, 43], [43, 32], [38, 34], [26, 34]], '#cbd5e1', '#64748b');
    sc.fillPolygon([[25, 32], [32, 30], [39, 32], [37, 35], [27, 35]], '#e2e8f0');
    sc.drawStroke(29, 34, 35, 34, 0.7, '#334155'); // mouth under mustache
    // Diagonal battle scar across right brow & cheek
    sc.drawStroke(23, 19, 29, 31, 0.9, '#7f1d1d', 225);
    sc.drawStroke(23.6, 19.3, 29.6, 31.3, 0.35, '#fca5a5', 160);
    // Stern eyes & nose
    sc.drawStroke(32, 25, 32, 30, 0.6, '#8c583a');
    sc.drawStroke(24, 23.5, 29.5, 24.5, 1.0, '#475569');
    sc.drawStroke(40, 23.5, 34.5, 24.5, 1.0, '#475569');
    sc.fillEllipse(27, 26, 1.8, 1.1, '#09090b');
    sc.fillEllipse(37, 26, 1.8, 1.1, '#09090b');
  });

  // Frame 3: village_blacksmith (Living blacksmith, sculpted handlebar mustache, leather apron, warm forge glow)
  makePortrait(3, (sc) => {
    sc.fillRadialGlow(48, 40, 28, '#f97316', 175, '#09090b', 0);
    sc.fillPolygon([[6, 63], [12, 43], [52, 43], [58, 63]], '#09090b');
    sc.fillGradientPolygon([[8, 63], [14, 45], [50, 45], [56, 63]], '#92400e', '#451a03');
    sc.fillPolygon([[20, 63], [22, 46], [42, 46], [44, 63]], '#78350f');
    sc.drawStroke(22, 46, 22, 62, 1.1, '#f97316', 140);
    sc.fillShadedEllipse(32, 28, 13, 13.5, {
      shadow: '#854d2e',
      mid: '#c98a63',
      light: '#ebb48f',
      rim: '#f97316',
      rimSide: 1,
      lightDir: [0.5, -0.4],
    });
    // Hair & bandana
    sc.fillPolygon([[19, 22], [22, 11], [42, 11], [45, 22], [38, 16], [26, 16]], '#451a03');
    sc.fillPolygon([[19, 20], [22, 15], [42, 15], [45, 20], [32, 18]], '#b91c1c');
    // Nose & sculpted thick handlebar mustache (not lips!)
    sc.drawStroke(32, 26, 32, 31, 0.75, '#854d2e');
    sc.fillPolygon([[22, 35], [27, 31.5], [32, 32.5], [37, 31.5], [42, 35], [39, 37], [32, 34.5], [25, 37]], '#09090b');
    sc.fillGradientPolygon([[23, 35], [27, 32], [32, 33], [37, 32], [41, 35], [38, 36.5], [32, 34], [26, 36.5]], '#92400e', '#451a03');
    // Brows & warm eyes
    sc.drawStroke(24, 24, 29.5, 24.5, 1.0, '#451a03');
    sc.drawStroke(40, 24, 34.5, 24.5, 1.0, '#451a03');
    sc.fillEllipse(27, 26.5, 1.8, 1.1, '#1c1917');
    sc.fillEllipse(37, 26.5, 1.8, 1.1, '#1c1917');
    sc.fillEllipse(27.5, 26.2, 0.5, 0.5, '#fef08a');
    sc.fillEllipse(37.5, 26.2, 0.5, 0.5, '#fef08a');
  });

  // Frame 4: emissary (Celestial Emissary, golden-ivory winged helm, azure-gold halo)
  makePortrait(4, (sc) => {
    sc.fillRadialGlow(32, 24, 28, '#38bdf8', 155, '#09090b', 0);
    sc.drawArc(32, 24, 20, Math.PI * 0.85, Math.PI * 2.15, 1.8, '#facc15', 230);
    sc.drawArc(32, 24, 18.5, Math.PI * 0.9, Math.PI * 2.1, 0.9, '#fef08a', 220);
    sc.fillPolygon([[8, 63], [15, 44], [49, 44], [56, 63]], '#09090b');
    sc.fillGradientPolygon([[10, 63], [17, 46], [47, 46], [54, 63]], '#e2e8f0', '#475569');
    sc.fillGradientPolygon([[24, 63], [26, 46], [38, 46], [40, 63]], '#38bdf8', '#0284c7');
    // Sculpted wing-crests on helm
    sc.fillPolygon([[10, 28], [12, 10], [22, 21], [19, 34]], '#facc15');
    sc.fillPolygon([[54, 28], [52, 10], [42, 21], [45, 34]], '#facc15');
    sc.fillShadedEllipse(32, 27, 12, 15, { shadow: '#64748b', mid: '#e2e8f0', light: '#ffffff', rim: '#facc15', rimSide: -1 });
    sc.fillPolygon([[23, 25], [32, 21], [41, 25], [38, 39], [32, 42], [26, 39]], '#09090b');
    sc.drawStroke(32, 12, 32, 21, 1.1, '#facc15');
    sc.fillRadialGlow(28, 29, 4, '#38bdf8', 190, '#0284c7', 0);
    sc.fillRadialGlow(36, 29, 4, '#38bdf8', 190, '#0284c7', 0);
    sc.fillEllipse(28, 29, 2.2, 1.1, '#e0f2fe');
    sc.fillEllipse(36, 29, 2.2, 1.1, '#e0f2fe');
  });

  // Frame 5: spectral_blacksmith (Translucent bearded spectral smith with forge helm & spirit flame)
  makePortrait(5, (sc) => {
    sc.fillRadialGlow(32, 30, 29, '#0284c7', 175, '#09090b', 0);
    // Broad armored spectral shoulders
    sc.fillPolygon([[7, 63], [13, 43], [51, 43], [57, 63]], '#082f49', 220);
    sc.fillGradientPolygon([[9, 63], [15, 45], [49, 45], [55, 63]], '#0284c7', '#1e1b4b', 200);
    // Forge helmet dome + cheek guards
    sc.fillPolygon([[18, 32], [20, 14], [32, 10], [44, 14], [46, 32], [41, 35], [23, 35]], '#082f49', 230);
    sc.fillGradientPolygon([[20, 31], [22, 15], [32, 11.5], [42, 15], [44, 31], [39, 33], [25, 33]], '#7dd3fc', '#0369a1', 215);
    // Visor slit & blazing eyes
    sc.fillPolygon([[22, 23], [42, 23], [40, 29], [24, 29]], '#050814', 245);
    sc.fillEllipse(27.5, 26, 2.3, 1.2, '#e0f2fe');
    sc.fillEllipse(36.5, 26, 2.3, 1.2, '#e0f2fe');
    // Flowing translucent spectral beard wisps
    sc.fillGradientPolygon([[22, 33], [25, 46], [32, 52], [39, 46], [42, 33]], '#bae6fd', '#0284c7', 195);
    // Spirit blue flame dancing beside shoulder
    sc.fillRadialGlow(48, 44, 11, '#38bdf8', 220, '#0284c7', 0);
    sc.fillPolygon([[44, 53], [48, 33], [53, 49], [48, 55]], '#e0f2fe', 235);
  });

  // Frame 6: infernal_warden (Sculpted demon skull, curved ridged horns, ember fissures)
  makePortrait(6, (sc) => {
    sc.fillRadialGlow(32, 30, 30, '#dc2626', 175, '#09090b', 0);
    // Curved multi-segment obsidian horns
    sc.fillPolygon([[5, 7], [13, 8], [21, 16], [24, 24], [18, 27], [13, 18]], '#09090b');
    sc.fillGradientPolygon([[7, 9], [13, 10], [20, 17], [22, 23], [18, 25], [14, 17]], '#71717a', '#18181b');
    sc.fillPolygon([[59, 7], [51, 8], [43, 16], [40, 24], [46, 27], [51, 18]], '#09090b');
    sc.fillGradientPolygon([[57, 9], [51, 10], [44, 17], [42, 23], [46, 25], [50, 17]], '#71717a', '#18181b');
    // Spiked demon pauldrons & chest
    sc.fillPolygon([[4, 63], [11, 41], [53, 41], [60, 63]], '#09090b');
    sc.fillGradientPolygon([[6, 63], [13, 43], [51, 43], [58, 63]], '#991b1b', '#450a0a');
    sc.fillPolygon([[6, 44], [12, 33], [19, 44]], '#27272a');
    sc.fillPolygon([[58, 44], [52, 33], [45, 44]], '#27272a');
    // Angular horned demon visage / jawline
    sc.fillPolygon([[19, 19], [32, 14], [45, 19], [43, 36], [36, 45], [28, 45], [21, 36]], '#09090b');
    sc.fillGradientPolygon([[21, 20], [32, 16], [43, 20], [41, 35], [35, 43], [29, 43], [23, 35]], '#ef4444', '#7f1d1d');
    // Heavy brow ridge & glowing magma fissures
    sc.fillPolygon([[21, 22], [32, 26], [43, 22], [41, 26], [32, 29], [23, 26]], '#450a0a');
    sc.drawStroke(24, 34, 29, 40, 0.9, '#f97316');
    sc.drawStroke(40, 34, 35, 40, 0.9, '#f97316');
    sc.drawStroke(32, 47, 32, 59, 1.4, '#facc15');
    // Blazing ember eyes
    sc.fillRadialGlow(26.5, 28, 5, '#f97316', 200, '#dc2626', 0);
    sc.fillRadialGlow(37.5, 28, 5, '#f97316', 200, '#dc2626', 0);
    sc.fillPolygon([[24, 27], [29, 28.5], [25, 29.5]], '#fef08a');
    sc.fillPolygon([[40, 27], [35, 28.5], [39, 29.5]], '#fef08a');
  });

  // Frame 7: system (Glowing runic Spectral Seal)
  makePortrait(7, (sc) => {
    sc.fillRadialGlow(32, 32, 28, '#0284c7', 180, '#09090b', 0);
    sc.fillShadedEllipse(32, 32, 22, 22, { shadow: '#09090b', mid: '#0f172a', light: '#1e1b4b', rim: '#38bdf8', rimSide: -1 });
    sc.drawArc(32, 32, 18.5, 0, Math.PI * 2, 1.2, '#0284c7', 240, 56);
    sc.drawArc(32, 32, 14.5, 0, Math.PI * 2, 0.9, '#38bdf8', 240, 56);
    sc.fillPolygon([[32, 12], [44, 32], [32, 52], [20, 32]], '#0c4a6e', 200);
    sc.drawStroke(32, 13, 43, 32, 0.9, '#7dd3fc');
    sc.drawStroke(43, 32, 32, 51, 0.9, '#7dd3fc');
    sc.drawStroke(32, 51, 21, 32, 0.9, '#7dd3fc');
    sc.drawStroke(21, 32, 32, 13, 0.9, '#7dd3fc');
    sc.drawStroke(32, 17, 32, 47, 1.3, '#e0f2fe');
    sc.drawStroke(25, 27, 39, 27, 1.1, '#38bdf8');
    sc.fillRadialGlow(32, 32, 8, '#e0f2fe', 220, '#38bdf8', 0);
  });

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
    {
      key: 'portraits',
      file: 'portraits.png',
      width: 512,
      height: 64,
      frameWidth: 64,
      frameHeight: 64,
      frames: [
        'hero_living',
        'hero_wraith',
        'weapon_master',
        'village_blacksmith',
        'emissary',
        'spectral_blacksmith',
        'infernal_warden',
        'system',
      ],
      build: generatePortraits,
    },
    {
      key: 'village_tiles',
      file: 'village_tiles.png',
      width: 64,
      height: 16,
      frameWidth: 16,
      frameHeight: 16,
      frames: ['grass_path', 'cobble_square', 'wood_wall', 'village_lantern'],
      build: generateVillageTiles,
    },
    {
      key: 'village_npcs',
      file: 'village_npcs.png',
      width: 128,
      height: 32,
      frameWidth: 32,
      frameHeight: 32,
      frames: ['weapon_master', 'village_blacksmith', 'potion_stall', 'village_gate'],
      build: generateVillageNpcs,
    },
    {
      key: 'cave_bat',
      file: 'cave_bat.png',
      width: 64,
      height: 32,
      frameWidth: 32,
      frameHeight: 32,
      frames: ['flap0', 'flap1'],
      build: generateCaveBat,
    },
  ];

  const manifest = {
    version: '0.4.0',
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
  console.log(`Generated ${specs.length} PNG spritesheets and manifest.json (v${manifest.version}) in ${OUT_DIR}`);
}

main();
