#!/usr/bin/env python3
"""
Gera os 3 NPCs da Vila Natal no padrao 48x48 Dark Fantasy Pixel Art (T-134 / BRF-148):
  - public/assets/sprites/npc_weapon_master.png (4 frames idle, 192x48)
  - public/assets/sprites/npc_lyra.png          (4 frames idle, 192x48)
  - public/assets/sprites/npc_gorran.png        (8 frames: 4 idle + 4 hammer, 384x48)
  - scripts/art/biomes/out/village_hub_npcs.manifest.json
  - assets/mockups/preview_m9_village_npcs.png  (prancha 4x com comparacao ao hero_living)

100% Python stdlib pura (sem Pillow/NumPy/Node).
"""

from __future__ import annotations

import json
import math
import struct
import zlib
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

ROOT = Path(__file__).resolve().parents[2]
OUT_SPRITES = ROOT / "public" / "assets" / "sprites"
OUT_MANIFEST = ROOT / "scripts" / "art" / "biomes" / "out" / "village_hub_npcs.manifest.json"
OUT_PREVIEW = ROOT / "assets" / "mockups" / "preview_m9_village_npcs.png"
HERO_PATH = OUT_SPRITES / "hero_living.png"

FW, FH = 48, 48
FOOT_Y = 44  # Linha de base dos pes (sola em y=43..44, outline em y=45)

Color = Tuple[int, int, int, int]
RGB = Tuple[int, int, int]
Pal4 = Tuple[RGB, RGB, RGB, RGB]  # (dark, mid, base, hi)

OUTLINE: Color = (10, 10, 15, 255)


# ---------------------------------------------------------------------------
# Paletas Dark Fantasy (harmonizadas com hero_living.png e ref_m9_village_hub)
# ---------------------------------------------------------------------------

SKIN_MASTER: Pal4 = ((96, 62, 48), (146, 100, 78), (192, 138, 106), (224, 174, 140))
SKIN_LYRA: Pal4 = ((108, 70, 58), (164, 114, 94), (212, 160, 132), (240, 198, 170))
SKIN_GORRAN: Pal4 = ((96, 56, 42), (148, 92, 68), (194, 130, 98), (228, 168, 132))

HAIR_GRAY: Pal4 = ((52, 56, 66), (92, 98, 112), (146, 154, 168), (204, 212, 224))
HAIR_BROWN: Pal4 = ((34, 22, 18), (64, 42, 32), (98, 66, 48), (138, 98, 72))
HAIR_GINGER: Pal4 = ((56, 24, 16), (104, 46, 24), (154, 74, 36), (198, 108, 56))

STEEL_WORN: Pal4 = ((42, 46, 56), (78, 86, 100), (124, 136, 154), (186, 198, 214))
STEEL_DARK: Pal4 = ((28, 30, 38), (54, 58, 70), (86, 94, 110), (136, 148, 166))
BRONZE: Pal4 = ((58, 38, 22), (108, 74, 38), (160, 116, 58), (214, 170, 96))

CAPE_DARK: Pal4 = ((24, 26, 36), (42, 46, 62), (62, 68, 88), (88, 96, 118))
LEATHER_DARK: Pal4 = ((36, 22, 16), (64, 40, 28), (96, 62, 42), (132, 90, 62))
LEATHER_WARM: Pal4 = ((52, 30, 20), (92, 56, 34), (134, 84, 52), (172, 118, 76))
DRESS_OLIVE: Pal4 = ((34, 42, 28), (58, 70, 46), (86, 102, 68), (118, 136, 94))
APRON_LINEN: Pal4 = ((96, 86, 72), (138, 126, 108), (182, 168, 146), (218, 206, 186))
SHIRT_LINEN: Pal4 = ((88, 78, 66), (128, 116, 100), (168, 154, 136), (204, 192, 174))
PANTS_SLATE: Pal4 = ((30, 32, 38), (52, 56, 66), (76, 82, 94), (104, 112, 126))
WOOD_HAFT: Pal4 = ((42, 24, 16), (74, 44, 26), (108, 66, 38), (144, 94, 56))
POTION_EMERALD: Pal4 = ((18, 72, 52), (34, 132, 92), (66, 196, 136), (156, 244, 198))


def rgba(rgb: RGB, a: int = 255) -> Color:
    return (rgb[0], rgb[1], rgb[2], a)


# ---------------------------------------------------------------------------
# Pure-Python RGBA Canvas & PNG Codec (stdlib only)
# ---------------------------------------------------------------------------

def _paeth(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    return b if pb <= pc else c


class Canvas:
    __slots__ = ("w", "h", "buf")

    def __init__(self, w: int, h: int, fill: Color = (0, 0, 0, 0)) -> None:
        self.w = w
        self.h = h
        if fill == (0, 0, 0, 0):
            self.buf = bytearray(w * h * 4)
        else:
            self.buf = bytearray(bytes(fill) * (w * h))

    def copy(self) -> "Canvas":
        c = Canvas(self.w, self.h)
        c.buf[:] = self.buf
        return c

    def get(self, x: int, y: int) -> Color:
        if 0 <= x < self.w and 0 <= y < self.h:
            o = (y * self.w + x) * 4
            b = self.buf
            return (b[o], b[o + 1], b[o + 2], b[o + 3])
        return (0, 0, 0, 0)

    def put(self, x: int, y: int, col: Color) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            o = (y * self.w + x) * 4
            b = self.buf
            b[o], b[o + 1], b[o + 2], b[o + 3] = col

    def blend(self, x: int, y: int, col: Color) -> None:
        if not (0 <= x < self.w and 0 <= y < self.h):
            return
        sa = col[3]
        if sa == 0:
            return
        o = (y * self.w + x) * 4
        b = self.buf
        if sa == 255 or b[o + 3] == 0:
            b[o], b[o + 1], b[o + 2], b[o + 3] = col
            return
        da = b[o + 3]
        inv_sa = 255 - sa
        out_a = sa + (da * inv_sa) // 255
        if out_a == 0:
            return
        b[o] = (col[0] * sa + b[o] * da * inv_sa // 255) // out_a
        b[o + 1] = (col[1] * sa + b[o + 1] * da * inv_sa // 255) // out_a
        b[o + 2] = (col[2] * sa + b[o + 2] * da * inv_sa // 255) // out_a
        b[o + 3] = out_a

    def composite(self, src: "Canvas", dx: int = 0, dy: int = 0) -> None:
        sw, sh = src.w, src.h
        dw, dh = self.w, self.h
        sb, db = src.buf, self.buf
        y0, y1 = max(0, -dy), min(sh, dh - dy)
        x0, x1 = max(0, -dx), min(sw, dw - dx)
        for sy in range(y0, y1):
            s_row = sy * sw * 4
            d_row = (sy + dy) * dw * 4
            for sx in range(x0, x1):
                so = s_row + sx * 4
                sa = sb[so + 3]
                if sa == 0:
                    continue
                do = d_row + (sx + dx) * 4
                if sa == 255 or db[do + 3] == 0:
                    db[do : do + 4] = sb[so : so + 4]
                else:
                    da = db[do + 3]
                    inv_sa = 255 - sa
                    out_a = sa + (da * inv_sa) // 255
                    if out_a > 0:
                        db[do] = (sb[so] * sa + db[do] * da * inv_sa // 255) // out_a
                        db[do + 1] = (sb[so + 1] * sa + db[do + 1] * da * inv_sa // 255) // out_a
                        db[do + 2] = (sb[so + 2] * sa + db[do + 2] * da * inv_sa // 255) // out_a
                        db[do + 3] = out_a

    def scale_nearest(self, factor: int) -> "Canvas":
        out = Canvas(self.w * factor, self.h * factor)
        for y in range(self.h):
            for x in range(self.w):
                c = self.get(x, y)
                if c[3] == 0:
                    continue
                for yy in range(y * factor, (y + 1) * factor):
                    for xx in range(x * factor, (x + 1) * factor):
                        out.put(xx, yy, c)
        return out

    def resize_nearest(self, nw: int, nh: int) -> "Canvas":
        out = Canvas(nw, nh)
        for y in range(nh):
            sy = min(self.h - 1, int(y * self.h / nh))
            for x in range(nw):
                sx = min(self.w - 1, int(x * self.w / nw))
                c = self.get(sx, sy)
                if c[3] > 0:
                    out.put(x, y, c)
        return out

    def crop(self, x0: int, y0: int, cw: int, ch: int) -> "Canvas":
        out = Canvas(cw, ch)
        for y in range(ch):
            so = ((y0 + y) * self.w + x0) * 4
            do = (y * cw) * 4
            out.buf[do : do + cw * 4] = self.buf[so : so + cw * 4]
        return out

    def fill_rect(self, x0: int, y0: int, x1: int, y1: int, col: Color) -> None:
        for y in range(max(0, y0), min(self.h, y1 + 1)):
            for x in range(max(0, x0), min(self.w, x1 + 1)):
                self.blend(x, y, col)

    def rect_shaded(self, x0: float, y0: float, x1: float, y1: float, pal: Pal4, hi_top: bool = True) -> None:
        ix0, iy0, ix1, iy1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
        w = max(1, ix1 - ix0)
        h = max(1, iy1 - iy0)
        for y in range(iy0, iy1 + 1):
            ny = (y - iy0) / h
            for x in range(ix0, ix1 + 1):
                nx = (x - ix0) / w
                shade = (1.0 - nx) * 0.58 + (1.0 - ny) * 0.42
                if hi_top and shade > 0.72:
                    c = pal[3]
                elif shade > 0.42:
                    c = pal[2]
                elif shade > 0.18:
                    c = pal[1]
                else:
                    c = pal[0]
                self.put(x, y, rgba(c))

    def ellipse_shaded(
        self,
        cx: float,
        cy: float,
        rx: float,
        ry: float,
        pal: Pal4,
        hi_bias: float = 0.0,
    ) -> None:
        x0 = int(math.floor(cx - rx - 1))
        x1 = int(math.ceil(cx + rx + 1))
        y0 = int(math.floor(cy - ry - 1))
        y1 = int(math.ceil(cy + ry + 1))
        for y in range(y0, y1 + 1):
            dy = (y - cy) / max(0.5, ry)
            for x in range(x0, x1 + 1):
                dx = (x - cx) / max(0.5, rx)
                d2 = dx * dx + dy * dy
                if d2 <= 1.0:
                    nz = math.sqrt(max(0.0, 1.0 - d2))
                    dot = -dx * 0.55 - dy * 0.65 + nz * 0.52 + hi_bias
                    if dot > 0.58:
                        c = pal[3]
                    elif dot > 0.22:
                        c = pal[2]
                    elif dot > -0.15:
                        c = pal[1]
                    else:
                        c = pal[0]
                    self.put(x, y, rgba(c))

    def ellipse_solid(self, cx: float, cy: float, rx: float, ry: float, col: Color) -> None:
        x0 = int(math.floor(cx - rx - 1))
        x1 = int(math.ceil(cx + rx + 1))
        y0 = int(math.floor(cy - ry - 1))
        y1 = int(math.ceil(cy + ry + 1))
        for y in range(y0, y1 + 1):
            dy = (y - cy) / max(0.5, ry)
            for x in range(x0, x1 + 1):
                dx = (x - cx) / max(0.5, rx)
                if dx * dx + dy * dy <= 1.0:
                    self.blend(x, y, col)

    def capsule_shaded(
        self,
        x0: float,
        y0: float,
        x1: float,
        y1: float,
        r: float,
        pal: Pal4,
    ) -> None:
        vx, vy = x1 - x0, y1 - y0
        l2 = vx * vx + vy * vy
        minx = int(math.floor(min(x0, x1) - r - 1))
        maxx = int(math.ceil(max(x0, x1) + r + 1))
        miny = int(math.floor(min(y0, y1) - r - 1))
        maxy = int(math.ceil(max(y0, y1) + r + 1))
        for y in range(miny, maxy + 1):
            for x in range(minx, maxx + 1):
                if l2 < 1e-6:
                    px, py = x0, y0
                else:
                    t = max(0.0, min(1.0, ((x - x0) * vx + (y - y0) * vy) / l2))
                    px, py = x0 + vx * t, y0 + vy * t
                dx, dy = (x - px) / max(0.5, r), (y - py) / max(0.5, r)
                d2 = dx * dx + dy * dy
                if d2 <= 1.0:
                    nz = math.sqrt(max(0.0, 1.0 - d2))
                    dot = -dx * 0.55 - dy * 0.65 + nz * 0.52
                    if dot > 0.56:
                        c = pal[3]
                    elif dot > 0.18:
                        c = pal[2]
                    elif dot > -0.18:
                        c = pal[1]
                    else:
                        c = pal[0]
                    self.put(x, y, rgba(c))

    def poly_shaded(self, pts: Sequence[Tuple[float, float]], pal: Pal4) -> None:
        if len(pts) < 3:
            return
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        minx, maxx = int(math.floor(min(xs))), int(math.ceil(max(xs)))
        miny, maxy = int(math.floor(min(ys))), int(math.ceil(max(ys)))
        w = max(1.0, max(xs) - min(xs))
        h = max(1.0, max(ys) - min(ys))
        n = len(pts)
        for y in range(miny, maxy + 1):
            py = y + 0.5
            nodes: List[float] = []
            j = n - 1
            for i in range(n):
                yi, yj = pts[i][1], pts[j][1]
                if (yi < py <= yj) or (yj < py <= yi):
                    nodes.append(pts[i][0] + (py - yi) / (yj - yi) * (pts[j][0] - pts[i][0]))
                j = i
            nodes.sort()
            for k in range(0, len(nodes) - 1, 2):
                xa = int(math.floor(nodes[k]))
                xb = int(math.ceil(nodes[k + 1]))
                for x in range(xa, xb + 1):
                    nx = (x - min(xs)) / w
                    ny = (y - min(ys)) / h
                    shade = (1.0 - nx) * 0.56 + (1.0 - ny) * 0.44
                    if shade > 0.72:
                        c = pal[3]
                    elif shade > 0.42:
                        c = pal[2]
                    elif shade > 0.18:
                        c = pal[1]
                    else:
                        c = pal[0]
                    self.put(x, y, rgba(c))

    def line(self, x0: int, y0: int, x1: int, y1: int, col: Color) -> None:
        dx = abs(x1 - x0)
        dy = -abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx + dy
        x, y = x0, y0
        while True:
            self.blend(x, y, col)
            if x == x1 and y == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x += sx
            if e2 <= dx:
                err += dx
                y += sy


def read_png(path: Path) -> Canvas:
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", f"Not PNG: {path}"
    pos = 8
    idat = bytearray()
    w = h = 0
    col_type = 6
    while pos < len(data):
        ln, ct = struct.unpack(">I4s", data[pos : pos + 8])
        chunk = data[pos + 8 : pos + 8 + ln]
        pos += 12 + ln
        if ct == b"IHDR":
            w, h, _bd, col_type = struct.unpack(">IIBB", chunk[:10])
        elif ct == b"IDAT":
            idat.extend(chunk)
    raw = zlib.decompress(bytes(idat))
    bpp = 4 if col_type == 6 else 3
    stride = w * bpp
    out = bytearray(w * h * bpp)
    for y in range(h):
        ft = raw[y * (stride + 1)]
        row = raw[y * (stride + 1) + 1 : (y + 1) * (stride + 1)]
        for x in range(stride):
            v = row[x]
            a = out[y * stride + x - bpp] if x >= bpp else 0
            b = out[(y - 1) * stride + x] if y > 0 else 0
            c = out[(y - 1) * stride + x - bpp] if (x >= bpp and y > 0) else 0
            if ft == 1:
                v = (v + a) & 255
            elif ft == 2:
                v = (v + b) & 255
            elif ft == 3:
                v = (v + ((a + b) >> 1)) & 255
            elif ft == 4:
                v = (v + _paeth(a, b, c)) & 255
            out[y * stride + x] = v
    cv = Canvas(w, h)
    if bpp == 4:
        cv.buf[:] = out
    else:
        for i in range(w * h):
            cv.buf[i * 4 : i * 4 + 3] = out[i * 3 : i * 3 + 3]
            cv.buf[i * 4 + 3] = 255
    return cv


def write_png(path: Path, canvas: Canvas) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = bytearray()
    stride = canvas.w * 4
    for y in range(canvas.h):
        raw.append(0)
        o = y * stride
        raw.extend(canvas.buf[o : o + stride])

    def chunk(tag: bytes, payload: bytes) -> bytes:
        crc = zlib.crc32(tag + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", canvas.w, canvas.h, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def add_outline(src: Canvas, outline_col: Color = OUTLINE) -> Canvas:
    """Adiciona contorno 1px 4-conectado ao redor de todos os pixels opacos."""
    out = src.copy()
    w, h = src.w, src.h
    for y in range(h):
        for x in range(w):
            if src.get(x, y)[3] > 20:
                continue
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and src.get(nx, ny)[3] > 180:
                    out.put(x, y, outline_col)
                    break
    return out


def add_ground_shadow(dst: Canvas, cx: float, cy: float, rx: float, ry: float) -> None:
    """Sombra eliptica de contato no chao (dois niveis suaves)."""
    dst.ellipse_solid(cx, cy, rx, ry, (8, 8, 14, 65))
    dst.ellipse_solid(cx, cy, rx * 0.72, ry * 0.68, (6, 6, 12, 95))


# ---------------------------------------------------------------------------
# NPC 1: Mestre de Armas (npc_weapon_master.png — 4 frames idle)
# ---------------------------------------------------------------------------

def draw_weapon_master(frame_idx: int) -> Canvas:
    bob = [0, 0, -1, 0][frame_idx]
    cape_sway = [0, 1, 2, 1][frame_idx]
    glint = frame_idx == 2

    body = Canvas(FW, FH)
    cx = 22

    # 1. Capa escura atras (balanco suave)
    cape = Canvas(FW, FH)
    cape.poly_shaded(
        [
            (cx - 6, 15 + bob),
            (cx - 2, 15 + bob),
            (cx - 5 - cape_sway, 38),
            (cx - 11 - cape_sway, 37),
            (cx - 9 - (cape_sway // 2), 24 + bob),
        ],
        CAPE_DARK,
    )
    cape.line(cx - 7 - (cape_sway // 2), 20 + bob, cx - 8 - cape_sway, 36, rgba(CAPE_DARK[0]))
    cape.line(cx - 5 - (cape_sway // 2), 21 + bob, cx - 6 - cape_sway, 36, rgba(CAPE_DARK[2]))
    body.composite(add_outline(cape, OUTLINE))

    # 2. Pernas mais longas e separadas em postura firme (alinhadas a proporcao do hero_living)
    legs = Canvas(FW, FH)
    # Perna esquerda (atras, ligeiramente recuada)
    legs.capsule_shaded(cx - 3.5, 29, cx - 5.5, 37, 1.8, PANTS_SLATE)
    legs.capsule_shaded(cx - 5.5, 37, cx - 6.0, 43, 1.8, LEATHER_DARK)
    legs.rect_shaded(cx - 7, 42, cx - 3, 44, LEATHER_DARK, hi_top=False)
    legs.put(cx - 5, 36, rgba(STEEL_WORN[2]))  # joelheira traseira
    # Perna direita (frente, base firme)
    legs.capsule_shaded(cx + 2.5, 29, cx + 4.0, 37, 1.8, PANTS_SLATE)
    legs.capsule_shaded(cx + 4.0, 37, cx + 4.5, 43, 1.9, LEATHER_DARK)
    legs.rect_shaded(cx + 3, 42, cx + 7, 44, LEATHER_DARK)
    # Joelheira e caneleira de aco
    legs.rect_shaded(cx + 2, 34, cx + 5, 36, STEEL_WORN)
    legs.put(cx + 4, 38, rgba(STEEL_WORN[2]))
    legs.put(cx + 4, 39, rgba(STEEL_WORN[1]))
    body.composite(add_outline(legs, OUTLINE))

    # 3. Torso: peitoral de placas desgastadas + tassets/saia de batalha
    torso = Canvas(FW, FH)
    # Saia/tassets (y=26..32)
    torso.poly_shaded(
        [
            (cx - 5, 26 + bob),
            (cx + 5, 26 + bob),
            (cx + 6, 32),
            (cx - 6, 32),
        ],
        LEATHER_DARK,
    )
    torso.rect_shaded(cx - 5, 27 + bob, cx - 2, 31, STEEL_DARK)
    torso.rect_shaded(cx + 2, 27 + bob, cx + 5, 31, STEEL_WORN)
    # Peitoral de aco (y=15..26)
    torso.poly_shaded(
        [
            (cx - 5, 15 + bob),
            (cx + 5, 15 + bob),
            (cx + 4.5, 26 + bob),
            (cx - 4.5, 26 + bob),
        ],
        STEEL_WORN,
    )
    torso.line(cx, 16 + bob, cx, 24 + bob, rgba(STEEL_WORN[1]))
    torso.put(cx - 2, 18 + bob, rgba(STEEL_WORN[3]))
    # Correia diagonal de couro
    for i in range(8):
        bx = cx - 4 + i
        by = 16 + bob + i
        torso.put(bx, by, rgba(LEATHER_WARM[1]))
        torso.put(bx + 1, by, rgba(LEATHER_WARM[2]))
    # Cinto robusto + fivela
    torso.rect_shaded(cx - 5, 24 + bob, cx + 5, 26 + bob, LEATHER_WARM, hi_top=False)
    torso.rect_shaded(cx - 1, 24 + bob, cx + 2, 26 + bob, BRONZE)
    # Gola alta
    torso.rect_shaded(cx - 2, 13 + bob, cx + 2, 15 + bob, STEEL_DARK)
    body.composite(add_outline(torso, OUTLINE))

    # 4. Braco esquerdo + ombreira de placas
    arm_l = Canvas(FW, FH)
    arm_l.capsule_shaded(cx - 5, 17 + bob, cx - 6, 25 + bob, 1.9, STEEL_DARK)
    arm_l.rect_shaded(cx - 7, 23 + bob, cx - 5, 26 + bob, LEATHER_WARM)
    arm_l.ellipse_shaded(cx - 5.5, 27 + bob, 1.6, 1.6, SKIN_MASTER)
    arm_l.ellipse_shaded(cx - 5.5, 16 + bob, 3.8, 2.8, STEEL_WORN, hi_bias=0.18 if glint else 0.0)
    arm_l.put(cx - 6, 15 + bob, rgba(STEEL_WORN[3]))
    arm_l.put(cx - 4, 17 + bob, rgba(BRONZE[2]))
    body.composite(add_outline(arm_l, OUTLINE))

    # 5. Cabeca proporcional ao heroi (cabelo e barba grisalhos)
    head = Canvas(FW, FH)
    head.ellipse_shaded(cx, 10 + bob, 3.6, 4.0, SKIN_MASTER)
    # Cabelo grisalho modelado (arredondado no topo, sem bloco quadrado)
    head.poly_shaded(
        [
            (cx - 4, 9 + bob),
            (cx - 3.5, 6 + bob),
            (cx - 1, 5 + bob),
            (cx + 2, 5.5 + bob),
            (cx + 4, 8 + bob),
            (cx + 2, 7.5 + bob),
            (cx - 1.5, 7.5 + bob),
            (cx - 2.5, 11 + bob),
        ],
        HAIR_GRAY,
    )
    # Sobrancelhas + olhos determinados
    head.put(cx, 9 + bob, rgba(HAIR_GRAY[1]))
    head.put(cx + 2, 9 + bob, rgba(HAIR_GRAY[1]))
    head.put(cx + 1, 10 + bob, (18, 20, 28, 255))
    head.put(cx + 3, 10 + bob, (18, 20, 28, 255))
    # Barba grisalha bem recortada
    head.poly_shaded(
        [
            (cx - 2, 12 + bob),
            (cx + 3.5, 12 + bob),
            (cx + 3, 14.5 + bob),
            (cx + 1, 15.5 + bob),
            (cx - 1.5, 14.5 + bob),
        ],
        HAIR_GRAY,
    )
    head.put(cx + 2, 13 + bob, rgba(HAIR_GRAY[3]))
    body.composite(add_outline(head, OUTLINE))

    # 6. Alabarda/Lanca elegante e afiada apoiada no chao (x=35)
    weapon = Canvas(FW, FH)
    wx = 35
    for y in range(11, 45):
        weapon.put(wx, y, rgba(WOOD_HAFT[2]))
        weapon.put(wx + 1, y, rgba(WOOD_HAFT[0]))
    for ry in (13, 23, 35, 43):
        weapon.put(wx, ry, rgba(BRONZE[2]))
        weapon.put(wx + 1, ry, rgba(BRONZE[1]))
    # Ponta de lanca fina e afiada (y=2..12)
    weapon.poly_shaded(
        [
            (wx + 0.5, 2),
            (wx + 1.8, 7),
            (wx + 1.2, 12),
            (wx - 0.2, 12),
            (wx - 0.8, 7),
        ],
        STEEL_WORN,
    )
    # Lamina crescente de alabarda a direita (recorte limpo)
    weapon.poly_shaded(
        [
            (wx + 1, 7),
            (wx + 4.5, 8.5),
            (wx + 5.0, 11.5),
            (wx + 3.5, 13.5),
            (wx + 1, 12),
        ],
        STEEL_WORN,
    )
    # Fio brilhante da lamina
    weapon.line(wx + 4, 8, wx + 4, 12, rgba(STEEL_WORN[3]))
    # Gancho traseiro fino
    weapon.put(wx - 1, 10, rgba(STEEL_WORN[2]))
    weapon.put(wx - 2, 10, rgba(STEEL_WORN[1]))
    if glint:
        weapon.put(wx + 4, 9, (248, 252, 255, 255))
        weapon.put(wx + 4, 10, (226, 238, 250, 255))
        weapon.put(wx, 4, (248, 252, 255, 255))
    body.composite(add_outline(weapon, OUTLINE))

    # Braco direito segurando o cabo
    arm_r = Canvas(FW, FH)
    arm_r.ellipse_shaded(cx + 4.5, 16 + bob, 3.1, 2.5, STEEL_WORN)
    arm_r.capsule_shaded(cx + 5, 18 + bob, wx - 1, 21 + bob, 1.8, STEEL_DARK)
    arm_r.rect_shaded(wx - 3, 19 + bob, wx - 1, 22 + bob, LEATHER_WARM)
    arm_r.ellipse_shaded(wx + 0.5, 21 + bob, 1.8, 1.8, SKIN_MASTER)
    body.composite(add_outline(arm_r, OUTLINE))

    final = Canvas(FW, FH)
    add_ground_shadow(final, cx, FOOT_Y + 0.5, 10.5, 2.5)
    add_ground_shadow(final, wx + 0.5, FOOT_Y + 0.5, 2.4, 1.3)
    final.composite(body)
    return final


# ---------------------------------------------------------------------------
# NPC 2: Lyra (npc_lyra.png — 4 frames idle)
# ---------------------------------------------------------------------------

def draw_lyra(frame_idx: int) -> Canvas:
    bob = [0, 0, -1, 0][frame_idx]
    hand_lift = [0, -1, -1, 0][frame_idx]
    skirt_sway = [0, 0, 1, 0][frame_idx]
    potion_glow = frame_idx in (1, 2)

    body = Canvas(FW, FH)
    cx = 24

    # 1. Coque preso atras da cabeca
    hair_back = Canvas(FW, FH)
    hair_back.ellipse_shaded(cx - 4.5, 10.5 + bob, 2.6, 2.8, HAIR_BROWN)
    hair_back.put(cx - 3, 10 + bob, rgba(APRON_LINEN[2]))
    hair_back.put(cx - 3, 11 + bob, rgba(APRON_LINEN[1]))
    body.composite(add_outline(hair_back, OUTLINE))

    # 2. Pontas das botinhas sob a saia longa (FOOT_Y=44)
    feet = Canvas(FW, FH)
    feet.rect_shaded(cx - 4, 42, cx - 1, 44, LEATHER_DARK, hi_top=False)
    feet.rect_shaded(cx + 1, 42, cx + 4, 44, LEATHER_DARK, hi_top=False)
    body.composite(add_outline(feet, OUTLINE))

    # 3. Vestido longo medieval (tons terrosos/oliva) + avental claro gasto
    dress = Canvas(FW, FH)
    # Saia longa mais esguia e fluida (y=25..43)
    dress.poly_shaded(
        [
            (cx - 3.5, 25 + bob),
            (cx + 3.5, 25 + bob),
            (cx + 7.5 + skirt_sway, 43),
            (cx - 7.5 + skirt_sway, 43),
        ],
        DRESS_OLIVE,
    )
    dress.line(cx - 4, 27 + bob, cx - 5 + skirt_sway, 42, rgba(DRESS_OLIVE[0]))
    dress.line(cx + 4, 27 + bob, cx + 5 + skirt_sway, 42, rgba(DRESS_OLIVE[0]))
    dress.line(cx - 6 + skirt_sway, 42, cx + 6 + skirt_sway, 42, rgba(DRESS_OLIVE[0]))

    # Corpete (y=17..25) com ombros suavizados
    dress.poly_shaded(
        [
            (cx - 3.5, 17 + bob),
            (cx + 3.5, 17 + bob),
            (cx + 3.5, 25 + bob),
            (cx - 3.5, 25 + bob),
        ],
        DRESS_OLIVE,
    )
    # Blusa de linho claro no decote
    dress.poly_shaded(
        [
            (cx - 2, 16 + bob),
            (cx + 2.5, 16 + bob),
            (cx + 1, 20 + bob),
            (cx - 1, 20 + bob),
        ],
        APRON_LINEN,
    )
    # Avental claro gasto (y=24..41)
    dress.poly_shaded(
        [
            (cx - 2.5, 24 + bob),
            (cx + 3.5, 24 + bob),
            (cx + 4.5 + skirt_sway, 41),
            (cx - 3.5 + skirt_sway, 41),
        ],
        APRON_LINEN,
    )
    dress.line(cx + 1, 26 + bob, cx + 1 + skirt_sway, 40, rgba(APRON_LINEN[1]))
    dress.line(cx - 2 + skirt_sway, 40, cx + 3 + skirt_sway, 40, rgba(APRON_LINEN[0]))
    # Cinto fino na cintura
    dress.rect_shaded(cx - 4, 24 + bob, cx + 4, 25 + bob, LEATHER_WARM, hi_top=False)
    body.composite(add_outline(dress, OUTLINE))

    # 4. Bolsinha de couro + Frasquinho delicado de pocao esmeralda na cintura
    pouch = Canvas(FW, FH)
    pouch.rect_shaded(cx - 5, 25 + bob, cx - 3, 28 + bob, LEATHER_WARM)
    pouch.put(cx - 4, 26 + bob, rgba(BRONZE[2]))
    # Frasco compacto (3x3 corpo + 1px gargalo)
    pouch.put(cx + 5, 25 + bob, rgba(WOOD_HAFT[2]))  # rolha
    pouch.rect_shaded(cx + 4, 26 + bob, cx + 6, 28 + bob, POTION_EMERALD)
    pouch.put(cx + 5, 27 + bob, (215, 255, 232, 255) if potion_glow else rgba(POTION_EMERALD[3]))
    body.composite(add_outline(pouch, OUTLINE))

    # 5. Cabeca delicada e proporcional
    head = Canvas(FW, FH)
    head.rect_shaded(cx - 1, 14 + bob, cx + 1, 16 + bob, SKIN_LYRA)
    head.ellipse_shaded(cx, 11 + bob, 3.3, 3.8, SKIN_LYRA)
    head.poly_shaded(
        [
            (cx - 3.5, 11 + bob),
            (cx - 3.5, 7.5 + bob),
            (cx - 0.5, 6 + bob),
            (cx + 2.5, 7 + bob),
            (cx + 3.5, 9.5 + bob),
            (cx + 1.5, 8.5 + bob),
            (cx - 1, 8.5 + bob),
            (cx - 2, 12 + bob),
        ],
        HAIR_BROWN,
    )
    head.put(cx - 3, 12 + bob, rgba(HAIR_BROWN[1]))
    head.put(cx, 11 + bob, (24, 20, 26, 255))
    head.put(cx + 2, 11 + bob, (24, 20, 26, 255))
    head.put(cx + 1, 13 + bob, rgba(SKIN_LYRA[1]))
    body.composite(add_outline(head, OUTLINE))

    # 6. Bracos com mangas suaves + maos juntas a frente
    arms = Canvas(FW, FH)
    arms.capsule_shaded(cx - 3.5, 18 + bob, cx - 3, 23 + bob + hand_lift, 1.5, DRESS_OLIVE)
    arms.capsule_shaded(cx - 3, 23 + bob + hand_lift, cx, 24 + bob + hand_lift, 1.3, SKIN_LYRA)
    arms.capsule_shaded(cx + 3.5, 18 + bob, cx + 3.5, 23 + bob + hand_lift, 1.5, DRESS_OLIVE)
    arms.capsule_shaded(cx + 3.5, 23 + bob + hand_lift, cx + 1, 24 + bob + hand_lift, 1.3, SKIN_LYRA)
    arms.put(cx - 3, 22 + bob + hand_lift, rgba(APRON_LINEN[2]))
    arms.put(cx + 3, 22 + bob + hand_lift, rgba(APRON_LINEN[2]))
    body.composite(add_outline(arms, OUTLINE))

    final = Canvas(FW, FH)
    add_ground_shadow(final, cx, FOOT_Y + 0.5, 9.0, 2.4)
    final.composite(body)
    return final


# ---------------------------------------------------------------------------
# NPC 3: Gorran (npc_gorran.png — 8 frames: 0..3 idle, 4..7 hammer)
# ---------------------------------------------------------------------------

def draw_hammer_tool(
    cv: Canvas,
    hx: float,
    hy: float,
    angle_deg: float,
    haft_len: float = 10.5,
) -> Tuple[float, float]:
    """Desenha martelo de forja a partir da mao (hx, hy) na direcao angle_deg.
    Retorna a posicao (tx, ty) do centro da cabeca do martelo."""
    rad = math.radians(angle_deg)
    dx, dy = math.cos(rad), math.sin(rad)
    x_tail = hx - dx * 2.2
    y_tail = hy - dy * 2.2
    x_head = hx + dx * haft_len
    y_head = hy + dy * haft_len
    cv.capsule_shaded(x_tail, y_tail, x_head, y_head, 1.0, WOOD_HAFT)

    px, py = -dy, dx
    hw, hh = 3.3, 2.1
    pts = [
        (x_head - px * hw - dx * hh, y_head - py * hw - dy * hh),
        (x_head + px * hw - dx * hh, y_head + py * hw - dy * hh),
        (x_head + px * hw + dx * hh, y_head + py * hw + dy * hh),
        (x_head - px * hw + dx * hh, y_head - py * hw + dy * hh),
    ]
    cv.poly_shaded(pts, STEEL_DARK)
    cv.line(
        int(round(x_head - px * (hw - 0.5))),
        int(round(y_head - py * (hw - 0.5))),
        int(round(x_head + px * (hw - 0.5))),
        int(round(y_head + py * (hw - 0.5))),
        rgba(STEEL_WORN[2]),
    )
    return x_head, y_head


def draw_gorran(frame_idx: int) -> Canvas:
    is_hammer = frame_idx >= 4
    sub = frame_idx - 4 if is_hammer else frame_idx

    if not is_hammer:
        bob = [0, 0, -1, 0][sub]
        lean = 0
        cx = 21
    else:
        # hammer0 (ergue), hammer1 (desce), hammer2 (impacto), hammer3 (recuo)
        bob = [0, 0, 1, 0][sub]
        lean = [-1, 1, 2, 0][sub]
        cx = 20

    body = Canvas(FW, FH)

    # 1. Pernas robustas e proporcionais em base firme 3/4 (FOOT_Y=44)
    legs = Canvas(FW, FH)
    # Perna traseira (esquerda)
    legs.capsule_shaded(cx - 4.0, 29, cx - 5.5, 37, 2.1, PANTS_SLATE)
    legs.capsule_shaded(cx - 5.5, 37, cx - 6.0, 43, 2.1, LEATHER_DARK)
    legs.rect_shaded(cx - 7, 42, cx - 3, 44, LEATHER_DARK, hi_top=False)
    # Perna dianteira (direita)
    legs.capsule_shaded(cx + 2.5, 29, cx + 4.0, 37, 2.1, PANTS_SLATE)
    legs.capsule_shaded(cx + 4.0, 37, cx + 4.5, 43, 2.2, LEATHER_DARK)
    legs.rect_shaded(cx + 3, 42, cx + 8, 44, LEATHER_DARK)
    body.composite(add_outline(legs, OUTLINE))

    # 2. Braco esquerdo (atras): idle descansa; hammer segura tenaz + ferro em brasa
    arm_back = Canvas(FW, FH)
    if not is_hammer:
        arm_back.capsule_shaded(cx + 5 + lean, 17 + bob, cx + 7 + lean, 25 + bob, 2.1, SKIN_GORRAN)
        arm_back.rect_shaded(cx + 5 + lean, 23 + bob, cx + 8 + lean, 26 + bob, LEATHER_WARM)
        arm_back.ellipse_shaded(cx + 6 + lean, 27 + bob, 1.8, 1.8, SKIN_GORRAN)
    else:
        tx, ty = 30, 28 + (1 if sub == 2 else 0)
        arm_back.capsule_shaded(cx + 5 + lean, 18 + bob, tx, ty, 2.0, SKIN_GORRAN)
        arm_back.rect_shaded(tx - 3, ty - 2, tx, ty + 1, LEATHER_WARM)
        arm_back.line(tx, ty, tx + 7, ty + 1, rgba(STEEL_DARK[2]))
        arm_back.line(tx, ty + 1, tx + 7, ty + 2, rgba(STEEL_DARK[0]))
        hot_col = (255, 214, 108, 255) if sub == 2 else (238, 118, 44, 255)
        arm_back.fill_rect(tx + 6, ty, tx + 11, ty + 2, (186, 56, 24, 255))
        arm_back.fill_rect(tx + 7, ty + 1, tx + 10, ty + 1, hot_col)
    body.composite(add_outline(arm_back, OUTLINE))

    # 3. Torso largo: camisa de linho nos ombros + avental pesado de couro escuro
    torso = Canvas(FW, FH)
    torso.poly_shaded(
        [
            (cx - 6.5 + lean, 15 + bob),
            (cx + 6.5 + lean, 15 + bob),
            (cx + 5.5 + lean, 26 + bob),
            (cx - 5.5 + lean, 26 + bob),
        ],
        SHIRT_LINEN,
    )
    # Avental de couro escuro (peito ate metade das coxas)
    torso.poly_shaded(
        [
            (cx - 4.5 + lean, 17 + bob),
            (cx + 4.5 + lean, 17 + bob),
            (cx + 5.5 + lean, 34),
            (cx - 5.5 + lean, 34),
        ],
        LEATHER_DARK,
    )
    torso.rect_shaded(cx - 5 + lean, 15 + bob, cx - 3 + lean, 18 + bob, LEATHER_WARM, hi_top=False)
    torso.rect_shaded(cx + 3 + lean, 15 + bob, cx + 5 + lean, 18 + bob, LEATHER_WARM, hi_top=False)
    torso.rect_shaded(cx - 5 + lean, 25 + bob, cx + 5 + lean, 27 + bob, LEATHER_WARM, hi_top=False)
    torso.rect_shaded(cx + lean, 25 + bob, cx + 2 + lean, 27 + bob, STEEL_WORN)
    torso.line(cx - 2 + lean, 28 + bob, cx - 2 + lean, 33, rgba(LEATHER_DARK[0]))
    torso.line(cx + 3 + lean, 28 + bob, cx + 3 + lean, 33, rgba(LEATHER_DARK[2]))
    body.composite(add_outline(torso, OUTLINE))

    # 4. Cabeca robusta proporcional com cabelo arredondado e barba cheia ruiva/castanha
    head = Canvas(FW, FH)
    hx = cx + lean
    hy = 10 + bob
    head.ellipse_shaded(hx, hy, 4.0, 4.1, SKIN_GORRAN)
    # Cabelo curto com volume arredondado no topo
    head.poly_shaded(
        [
            (hx - 4.5, hy - 1),
            (hx - 3.5, hy - 4),
            (hx - 1, hy - 5),
            (hx + 2, hy - 4.8),
            (hx + 4, hy - 3.2),
            (hx + 4.2, hy - 1.5),
            (hx + 2, hy - 2.5),
            (hx - 2, hy - 2.5),
        ],
        HAIR_GINGER,
    )
    head.put(hx, hy - 1, rgba(HAIR_GINGER[0]))
    head.put(hx + 2, hy - 1, rgba(HAIR_GINGER[0]))
    head.put(hx + 1, hy, (20, 16, 18, 255))
    head.put(hx + 3, hy, (20, 16, 18, 255))
    # Barba cheia e espessa
    head.poly_shaded(
        [
            (hx - 3.5, hy + 1),
            (hx + 4.2, hy + 1),
            (hx + 4.0, hy + 4.5),
            (hx + 1.5, hy + 5.8),
            (hx - 1.5, hy + 5.8),
            (hx - 3.5, hy + 4.0),
        ],
        HAIR_GINGER,
    )
    head.put(hx + 2, hy + 2, rgba(HAIR_GINGER[3]))
    head.put(hx + 1, hy + 3, rgba(HAIR_GINGER[0]))
    body.composite(add_outline(head, OUTLINE))

    # 5. Braco direito musculoso exposto + Martelo de Forja
    arm_r = Canvas(FW, FH)
    sx, sy = cx - 5.5 + lean, 17 + bob

    spark_origin: Optional[Tuple[int, int]] = None
    motion_arc = False

    if not is_hammer:
        hand_x = cx - 4 + [0, 0, 1, 0][sub]
        hand_y = 26 + bob
        arm_r.ellipse_shaded(sx, sy + 1, 2.9, 2.6, SKIN_GORRAN)
        arm_r.capsule_shaded(sx, sy + 2, hand_x, hand_y, 2.1, SKIN_GORRAN)
        arm_r.rect_shaded(hand_x - 2, hand_y - 2, hand_x + 1, hand_y + 1, LEATHER_WARM)
        draw_hammer_tool(arm_r, hand_x + 1, hand_y, angle_deg=-25 + [0, -3, -5, -2][sub], haft_len=10.5)
        arm_r.ellipse_shaded(hand_x + 1, hand_y, 1.9, 1.9, SKIN_GORRAN)
    else:
        if sub == 0:
            # hammer0: ergue o martelo para tras/alto sem tampar o rosto nem cortar no topo
            elbow_x, elbow_y = sx - 3, sy - 2
            hand_x, hand_y = sx - 1, sy - 6
            arm_r.ellipse_shaded(sx, sy, 2.8, 2.6, SKIN_GORRAN)
            arm_r.capsule_shaded(sx, sy, elbow_x, elbow_y, 2.0, SKIN_GORRAN)
            arm_r.capsule_shaded(elbow_x, elbow_y, hand_x, hand_y, 1.9, SKIN_GORRAN)
            arm_r.rect_shaded(hand_x - 2, hand_y, hand_x + 1, hand_y + 2, LEATHER_WARM)
            draw_hammer_tool(arm_r, hand_x, hand_y, angle_deg=-138, haft_len=9.5)
            arm_r.ellipse_shaded(hand_x, hand_y, 1.9, 1.9, SKIN_GORRAN)
        elif sub == 1:
            # hammer1: desce com forca (arco rapido para frente)
            elbow_x, elbow_y = sx + 4, sy - 1
            hand_x, hand_y = sx + 10, sy - 2
            arm_r.ellipse_shaded(sx, sy, 2.9, 2.6, SKIN_GORRAN)
            arm_r.capsule_shaded(sx, sy, elbow_x, elbow_y, 2.1, SKIN_GORRAN)
            arm_r.capsule_shaded(elbow_x, elbow_y, hand_x, hand_y, 2.0, SKIN_GORRAN)
            arm_r.rect_shaded(hand_x - 3, hand_y - 1, hand_x - 1, hand_y + 2, LEATHER_WARM)
            draw_hammer_tool(arm_r, hand_x, hand_y, angle_deg=-28, haft_len=10.5)
            arm_r.ellipse_shaded(hand_x, hand_y, 2.0, 1.9, SKIN_GORRAN)
            motion_arc = True
        elif sub == 2:
            # hammer2: impacto direto na barra incandescente (x~38, y~28)!
            elbow_x, elbow_y = sx + 6, sy + 3
            hand_x, hand_y = sx + 12, sy + 6
            arm_r.ellipse_shaded(sx, sy + 1, 2.9, 2.6, SKIN_GORRAN)
            arm_r.capsule_shaded(sx, sy + 1, elbow_x, elbow_y, 2.1, SKIN_GORRAN)
            arm_r.capsule_shaded(elbow_x, elbow_y, hand_x, hand_y, 2.0, SKIN_GORRAN)
            arm_r.rect_shaded(hand_x - 3, hand_y - 1, hand_x - 1, hand_y + 2, LEATHER_WARM)
            hx_m, hy_m = draw_hammer_tool(arm_r, hand_x, hand_y, angle_deg=18, haft_len=10.5)
            arm_r.ellipse_shaded(hand_x, hand_y, 2.0, 1.9, SKIN_GORRAN)
            spark_origin = (int(round(hx_m)), int(round(hy_m + 1)))
        else:
            # hammer3: recuo a meia altura
            elbow_x, elbow_y = sx + 4, sy + 1
            hand_x, hand_y = sx + 10, sy + 1
            arm_r.ellipse_shaded(sx, sy, 2.9, 2.6, SKIN_GORRAN)
            arm_r.capsule_shaded(sx, sy, elbow_x, elbow_y, 2.1, SKIN_GORRAN)
            arm_r.capsule_shaded(elbow_x, elbow_y, hand_x, hand_y, 2.0, SKIN_GORRAN)
            arm_r.rect_shaded(hand_x - 3, hand_y - 1, hand_x - 1, hand_y + 2, LEATHER_WARM)
            draw_hammer_tool(arm_r, hand_x, hand_y, angle_deg=-15, haft_len=10.5)
            arm_r.ellipse_shaded(hand_x, hand_y, 2.0, 1.9, SKIN_GORRAN)
            spark_origin = (38, 27)

    body.composite(add_outline(arm_r, OUTLINE))

    # 6. VFX (sem contorno escuro): arco de movimento e faiscas douradas/laranjas
    vfx = Canvas(FW, FH)
    if motion_arc:
        arc_pts = [(19, 4), (24, 4), (29, 6), (33, 9), (36, 13)]
        for i, (ax, ay) in enumerate(arc_pts):
            a = 70 + i * 38
            vfx.put(ax, ay, (226, 236, 248, a))
            vfx.put(ax - 1, ay + 1, (186, 200, 224, a // 2))

    if is_hammer and sub == 2 and spark_origin is not None:
        ox, oy = spark_origin
        vfx.ellipse_solid(ox, oy, 3.6, 2.6, (255, 136, 28, 135))
        vfx.ellipse_solid(ox, oy, 2.0, 1.6, (255, 232, 128, 225))
        vfx.put(ox, oy, (255, 252, 232, 255))
        sparks = [
            (-5, -4, (255, 196, 54, 255)),
            (-3, -6, (255, 240, 150, 255)),
            (2, -6, (255, 158, 36, 255)),
            (5, -4, (255, 232, 128, 255)),
            (6, -1, (255, 112, 24, 255)),
            (4, 3, (255, 184, 48, 255)),
            (-4, 2, (255, 128, 28, 255)),
            (0, -8, (255, 210, 80, 215)),
            (7, -6, (255, 146, 32, 205)),
        ]
        for dx, dy, scol in sparks:
            vfx.put(ox + dx, oy + dy, scol)
            vfx.put(ox + dx // 2, oy + dy // 2, (255, 220, 110, 185))
    elif is_hammer and sub == 3 and spark_origin is not None:
        ox, oy = spark_origin
        for dx, dy, scol in (
            (-4, -5, (255, 170, 44, 190)),
            (1, -7, (255, 224, 118, 180)),
            (5, -4, (255, 120, 26, 170)),
            (3, -1, (255, 190, 62, 145)),
        ):
            vfx.put(ox + dx, oy + dy, scol)

    final = Canvas(FW, FH)
    add_ground_shadow(final, cx, FOOT_Y + 0.5, 11.2, 2.6)
    final.composite(body)
    final.composite(vfx)
    return final


# ---------------------------------------------------------------------------
# Fonte Bitmap 5x7 para rotulos da prancha de aprovacao
# ---------------------------------------------------------------------------

FONT_5X7: Dict[str, List[str]] = {
    "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "B": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
    "C": [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
    "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    "F": ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
    "G": [".####", "#....", "#....", "#.###", "#...#", "#...#", ".####"],
    "H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "I": [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
    "K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    "L": ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    "M": ["#...#", "##.##", "#.#.#", "#...#", "#...#", "#...#", "#...#"],
    "N": ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
    "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
    "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    "S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    "U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "V": ["#...#", "#...#", "#...#", "#...#", ".#.#.", ".#.#.", "..#.."],
    "W": ["#...#", "#...#", "#...#", "#...#", "#.#.#", "##.##", "#...#"],
    "X": ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
    "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
    "0": [".###.", "#..##", "#.#.#", "#.#.#", "##..#", "#...#", ".###."],
    "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
    "2": [".###.", "#...#", "....#", "..##.", ".#...", "#....", "#####"],
    "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
    "4": ["#...#", "#...#", "#...#", "#####", "....#", "....#", "....#"],
    "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
    "6": [".###.", "#....", "####.", "#...#", "#...#", "#...#", ".###."],
    "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
    "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
    "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
    ":": [".....", "..#..", "..#..", ".....", "..#..", "..#..", "....."],
    "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
    "_": [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
    ".": [".....", ".....", ".....", ".....", ".....", "..##.", "..##."],
    ",": [".....", ".....", ".....", ".....", "..##.", "..#..", ".#..."],
    "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
    ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
    ">": [".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."],
    " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
}


def draw_text(cv: Canvas, x: int, y: int, text: str, col: Color = (232, 236, 245, 255), scale: int = 1) -> None:
    cx = x
    for ch in text.upper():
        glyph = FONT_5X7.get(ch, FONT_5X7[" "])
        for ry, row in enumerate(glyph):
            for rx, bit in enumerate(row):
                if bit == "#":
                    for sy in range(scale):
                        for sx in range(scale):
                            cv.put(cx + rx * scale + sx, y + ry * scale + sy, col)
        cx += 6 * scale


# ---------------------------------------------------------------------------
# Montagem dos spritesheets, manifesto parcial e prancha de aprovacao 4x
# ---------------------------------------------------------------------------

def build_sheet(frames: List[Canvas]) -> Canvas:
    sheet = Canvas(FW * len(frames), FH)
    for idx, fr in enumerate(frames):
        sheet.composite(fr, idx * FW, 0)
    return sheet


def extract_hero_frame0_48() -> Canvas:
    """Carrega hero_living.png (80x80) frame 0 e redimensiona para 48x48 preservando linha de base."""
    if not HERO_PATH.exists():
        return Canvas(FW, FH)
    hero_sheet = read_png(HERO_PATH)
    f0 = hero_sheet.crop(0, 0, 80, 80)
    scaled = f0.resize_nearest(FW, FH)
    aligned = Canvas(FW, FH)
    aligned.composite(scaled, 0, -1)
    return aligned


def build_preview(
    master_frames: List[Canvas],
    lyra_frames: List[Canvas],
    gorran_frames: List[Canvas],
) -> Canvas:
    scale = 4
    cell_w = FW * scale
    cell_h = FH * scale
    hdr_h = 20
    sec_h = 26
    pad = 8
    cols = 4

    rows_spec: List[Tuple[str, List[Tuple[str, Canvas]]]] = [
        (
            "MESTRE DE ARMAS - NPC_WEAPON_MASTER (48X48, 4F IDLE)",
            [(f"0{i}:IDLE{i}", master_frames[i]) for i in range(4)],
        ),
        (
            "LYRA - NPC_LYRA (48X48, 4F IDLE)",
            [(f"0{i}:IDLE{i}", lyra_frames[i]) for i in range(4)],
        ),
        (
            "GORRAN - NPC_GORRAN (48X48, 0..3 IDLE)",
            [(f"0{i}:IDLE{i}", gorran_frames[i]) for i in range(4)],
        ),
        (
            "GORRAN - NPC_GORRAN (48X48, 4..7 HAMMER)",
            [(f"0{i + 4}:HAMMER{i}", gorran_frames[i + 4]) for i in range(4)],
        ),
        (
            "COMPARACAO DE ESCALA (4X, ALINHADOS NA LINHA DE BASE DOS PES)",
            [
                ("HERO_LIVING 80->48", extract_hero_frame0_48()),
                ("MESTRE (IDLE0)", master_frames[0]),
                ("LYRA (IDLE0)", lyra_frames[0]),
                ("GORRAN (IDLE0)", gorran_frames[0]),
            ],
        ),
    ]

    total_w = cols * cell_w + (cols + 1) * pad
    row_block_h = sec_h + hdr_h + cell_h + pad
    total_h = len(rows_spec) * row_block_h + pad

    cv = Canvas(total_w, total_h, (18, 21, 29, 255))

    for r_idx, (sec_title, items) in enumerate(rows_spec):
        y_sec = pad + r_idx * row_block_h
        cv.fill_rect(pad, y_sec, total_w - pad - 1, y_sec + sec_h - 4, (28, 33, 46, 255))
        draw_text(cv, pad + 8, y_sec + 6, sec_title, (238, 206, 138, 255), scale=1)

        y_hdr = y_sec + sec_h
        y_cell = y_hdr + hdr_h

        for c_idx, (label, frame) in enumerate(items):
            x_cell = pad + c_idx * (cell_w + pad)
            cv.fill_rect(x_cell, y_hdr, x_cell + cell_w - 1, y_cell - 1, (24, 28, 40, 255))
            draw_text(cv, x_cell + 6, y_hdr + 6, label, (224, 232, 244, 255), scale=1)

            for ty in range(0, cell_h, 16):
                for tx in range(0, cell_w, 16):
                    chk = ((tx // 16) + (ty // 16)) % 2 == 0
                    col = (34, 40, 54, 255) if chk else (42, 49, 66, 255)
                    cv.fill_rect(x_cell + tx, y_cell + ty, x_cell + tx + 15, y_cell + ty + 15, col)

            foot_line_y = y_cell + (FOOT_Y + 1) * scale
            cv.fill_rect(x_cell, foot_line_y, x_cell + cell_w - 1, foot_line_y, (196, 160, 74, 150))

            cv.composite(frame.scale_nearest(scale), x_cell, y_cell)

    return cv


def write_manifest() -> None:
    manifest = {
        "sprites": {
            "npc_weapon_master": {
                "key": "npc_weapon_master",
                "file": "npc_weapon_master.png",
                "width": FW * 4,
                "height": FH,
                "frameWidth": FW,
                "frameHeight": FH,
                "frames": ["idle0", "idle1", "idle2", "idle3"],
            },
            "npc_lyra": {
                "key": "npc_lyra",
                "file": "npc_lyra.png",
                "width": FW * 4,
                "height": FH,
                "frameWidth": FW,
                "frameHeight": FH,
                "frames": ["idle0", "idle1", "idle2", "idle3"],
            },
            "npc_gorran": {
                "key": "npc_gorran",
                "file": "npc_gorran.png",
                "width": FW * 8,
                "height": FH,
                "frameWidth": FW,
                "frameHeight": FH,
                "frames": [
                    "idle0",
                    "idle1",
                    "idle2",
                    "idle3",
                    "hammer0",
                    "hammer1",
                    "hammer2",
                    "hammer3",
                ],
            },
        }
    }
    OUT_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    OUT_MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    master_frames = [draw_weapon_master(i) for i in range(4)]
    lyra_frames = [draw_lyra(i) for i in range(4)]
    gorran_frames = [draw_gorran(i) for i in range(8)]

    master_sheet = build_sheet(master_frames)
    lyra_sheet = build_sheet(lyra_frames)
    gorran_sheet = build_sheet(gorran_frames)

    write_png(OUT_SPRITES / "npc_weapon_master.png", master_sheet)
    write_png(OUT_SPRITES / "npc_lyra.png", lyra_sheet)
    write_png(OUT_SPRITES / "npc_gorran.png", gorran_sheet)
    write_manifest()

    preview = build_preview(master_frames, lyra_frames, gorran_frames)
    write_png(OUT_PREVIEW, preview)

    print(f"OK npc_weapon_master.png: {master_sheet.w}x{master_sheet.h} (4f)")
    print(f"OK npc_lyra.png:          {lyra_sheet.w}x{lyra_sheet.h} (4f)")
    print(f"OK npc_gorran.png:        {gorran_sheet.w}x{gorran_sheet.h} (8f)")
    print(f"OK manifest:              {OUT_MANIFEST.relative_to(ROOT)}")
    print(f"OK preview:               {OUT_PREVIEW.relative_to(ROOT)} ({preview.w}x{preview.h})")


if __name__ == "__main__":
    main()
