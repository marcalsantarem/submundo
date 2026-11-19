#!/usr/bin/env python3
"""
Gera os spritesheets 24 frames (1920x80, frames 80x80) do heroi
(hero_living.png e hero_wraith.png) com articulacao anatomica real
(pernas/joelhos/botas em IK 2-bones, bracos, tunica dinamica e capa/bandana)
a partir dos sprites base limpos em assets/sprites_src/*_base.png.

Tambem gera previas ampliadas em grade (assets/mockups/preview_hero_*.png),
calcula metricas objetivas de variacao das pernas no ciclo walk e atualiza
os metadados (24 frames + handAnchors) em public/assets/sprites/manifest.json.

Zero dependencias externas: opera 100% com biblioteca padrao do Python 3.
"""

from __future__ import annotations

import json
import math
import struct
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = ROOT / "assets" / "sprites_src"
OUT_DIR = ROOT / "public" / "assets" / "sprites"
PREVIEW_DIR = ROOT / "assets" / "mockups"
MANIFEST_PATH = OUT_DIR / "manifest.json"

FW, FH = 80, 80
FOOT_Y = 76
CENTER_X = 40

FRAME_NAMES: List[str] = [
    "idle0", "idle1", "idle2", "idle3",
    "walk0", "walk1", "walk2", "walk3", "walk4", "walk5",
    "attack0", "attack1", "attack2", "attack3", "attack4", "attack5",
    "dash0", "dash1", "dash2", "dash3",
    "hit0", "hit1", "hit2", "hit3",
]

Color = Tuple[int, int, int, int]
RGB = Tuple[int, int, int]


# ---------------------------------------------------------------------------
# Pure-Python RGBA Image & PNG Codec (stdlib only)
# ---------------------------------------------------------------------------

def _paeth(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa = abs(p - a)
    pb = abs(p - b)
    pc = abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


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
            b[o] = col[0]
            b[o + 1] = col[1]
            b[o + 2] = col[2]
            b[o + 3] = col[3]

    def blend_pixel(self, x: int, y: int, col: Color) -> None:
        if not (0 <= x < self.w and 0 <= y < self.h):
            return
        sa = col[3]
        if sa == 0:
            return
        o = (y * self.w + x) * 4
        b = self.buf
        if sa == 255 or b[o + 3] == 0:
            b[o] = col[0]
            b[o + 1] = col[1]
            b[o + 2] = col[2]
            b[o + 3] = sa
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
        sb = src.buf
        db = self.buf
        y0 = max(0, -dy)
        y1 = min(sh, dh - dy)
        x0 = max(0, -dx)
        x1 = min(sw, dw - dx)
        for sy in range(y0, y1):
            ty = sy + dy
            s_row = sy * sw * 4
            d_row = ty * dw * 4
            for sx in range(x0, x1):
                so = s_row + sx * 4
                sa = sb[so + 3]
                if sa == 0:
                    continue
                do = d_row + (sx + dx) * 4
                if sa == 255 or db[do + 3] == 0:
                    db[do] = sb[so]
                    db[do + 1] = sb[so + 1]
                    db[do + 2] = sb[so + 2]
                    db[do + 3] = sa
                else:
                    da = db[do + 3]
                    inv_sa = 255 - sa
                    out_a = sa + (da * inv_sa) // 255
                    if out_a > 0:
                        db[do] = (sb[so] * sa + db[do] * da * inv_sa // 255) // out_a
                        db[do + 1] = (sb[so + 1] * sa + db[do + 1] * da * inv_sa // 255) // out_a
                        db[do + 2] = (sb[so + 2] * sa + db[do + 2] * da * inv_sa // 255) // out_a
                        db[do + 3] = out_a

    def crop(self, x0: int, y0: int, cw: int, ch: int) -> "Canvas":
        out = Canvas(cw, ch)
        for y in range(ch):
            so = ((y0 + y) * self.w + x0) * 4
            do = (y * cw) * 4
            out.buf[do:do + cw * 4] = self.buf[so:so + cw * 4]
        return out

    def scale_nearest(self, scale: int) -> "Canvas":
        nw, nh = self.w * scale, self.h * scale
        out = Canvas(nw, nh)
        sb = self.buf
        db = out.buf
        for sy in range(self.h):
            row = bytearray(nw * 4)
            s_off = sy * self.w * 4
            for sx in range(self.w):
                px = sb[s_off + sx * 4: s_off + sx * 4 + 4]
                base = sx * scale * 4
                for k in range(scale):
                    row[base + k * 4: base + k * 4 + 4] = px
            for ky in range(scale):
                do = (sy * scale + ky) * nw * 4
                db[do:do + nw * 4] = row
        return out


def read_png(path: Path) -> Canvas:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Arquivo PNG invalido: {path}")
    pos = 8
    w = h = bit_depth = color_type = 0
    idat = bytearray()
    palette: Optional[List[RGB]] = None
    trns: Optional[bytes] = None
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        ctype = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        pos += 12 + length
        if ctype == b"IHDR":
            w, h, bit_depth, color_type, _, _, interlace = struct.unpack(">IIBBBBB", chunk)
            if bit_depth != 8 or interlace != 0:
                raise ValueError(f"PNG nao suportado ({bit_depth}b, interlace={interlace}): {path}")
        elif ctype == b"PLTE":
            palette = [(chunk[i], chunk[i + 1], chunk[i + 2]) for i in range(0, len(chunk), 3)]
        elif ctype == b"tRNS":
            trns = chunk
        elif ctype == b"IDAT":
            idat.extend(chunk)
        elif ctype == b"IEND":
            break
    raw = zlib.decompress(bytes(idat))
    bpp = {6: 4, 2: 3, 3: 1, 4: 2, 0: 1}[color_type]
    stride = w * bpp
    recon = bytearray(h * stride)
    in_pos = 0
    for y in range(h):
        ftype = raw[in_pos]
        in_pos += 1
        rs = y * stride
        ps = (y - 1) * stride
        for x in range(stride):
            v = raw[in_pos + x]
            a = recon[rs + x - bpp] if x >= bpp else 0
            b = recon[ps + x] if y > 0 else 0
            c = recon[ps + x - bpp] if (y > 0 and x >= bpp) else 0
            if ftype == 0:
                val = v
            elif ftype == 1:
                val = (v + a) & 0xFF
            elif ftype == 2:
                val = (v + b) & 0xFF
            elif ftype == 3:
                val = (v + ((a + b) >> 1)) & 0xFF
            elif ftype == 4:
                val = (v + _paeth(a, b, c)) & 0xFF
            else:
                raise ValueError(f"Filtro PNG invalido: {ftype}")
            recon[rs + x] = val
        in_pos += stride
    cv = Canvas(w, h)
    if color_type == 6:
        cv.buf[:] = recon
    elif color_type == 2:
        for i in range(w * h):
            cv.buf[i * 4:i * 4 + 3] = recon[i * 3:i * 3 + 3]
            cv.buf[i * 4 + 3] = 255
    elif color_type == 3 and palette is not None:
        for i in range(w * h):
            idx = recon[i]
            r, g, b = palette[idx]
            a = trns[idx] if (trns is not None and idx < len(trns)) else 255
            cv.buf[i * 4:i * 4 + 4] = bytes((r, g, b, a))
    else:
        raise ValueError(f"Color type nao tratado: {color_type}")
    return cv


def write_png(path: Path, cv: Canvas) -> None:
    def chunk(ctype: bytes, payload: bytes) -> bytes:
        crc = zlib.crc32(ctype + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + ctype + payload + struct.pack(">I", crc)

    raw = bytearray()
    stride = cv.w * 4
    for y in range(cv.h):
        raw.append(0)
        raw.extend(cv.buf[y * stride:(y + 1) * stride])
    ihdr = struct.pack(">IIBBBBB", cv.w, cv.h, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


# ---------------------------------------------------------------------------
# Color & Pixel-Art Post-Processing Helpers
# ---------------------------------------------------------------------------

OUTLINE: Color = (9, 9, 13, 255)


def clamp(v: float, lo: float, hi: float) -> float:
    return lo if v < lo else (hi if v > hi else v)


def rgba(rgb: RGB, a: int = 255) -> Color:
    return (rgb[0], rgb[1], rgb[2], a)


def dim_rgb(rgb: RGB, factor: float) -> RGB:
    return (
        max(0, min(255, int(round(rgb[0] * factor)))),
        max(0, min(255, int(round(rgb[1] * factor)))),
        max(0, min(255, int(round(rgb[2] * factor)))),
    )


def dim_palette(pal: Tuple[RGB, RGB, RGB, RGB], factor: float) -> Tuple[RGB, RGB, RGB, RGB]:
    return (
        dim_rgb(pal[0], factor),
        dim_rgb(pal[1], factor),
        dim_rgb(pal[2], factor),
        dim_rgb(pal[3], factor),
    )


def add_outline(layer: Canvas, outline_col: Color = OUTLINE) -> Canvas:
    """Adiciona contorno nitido de 1px (4-vizinhanca) ao redor dos pixels opacos."""
    out = layer.copy()
    w, h = layer.w, layer.h
    sb = layer.buf
    for y in range(h):
        for x in range(w):
            if sb[(y * w + x) * 4 + 3] >= 128:
                continue
            has_neighbor = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < w and 0 <= ny < h:
                    if sb[(ny * w + nx) * 4 + 3] >= 128:
                        has_neighbor = True
                        break
            if has_neighbor:
                out.put(x, y, outline_col)
    return out


def remove_isolated_pixels(layer: Canvas) -> Canvas:
    """Remove pixels soltos (0 vizinhos ortogonais opacos) para silhueta limpa."""
    out = layer.copy()
    w, h = layer.w, layer.h
    sb = layer.buf
    for y in range(h):
        for x in range(w):
            if sb[(y * w + x) * 4 + 3] == 0:
                continue
            n_cnt = 0
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < w and 0 <= ny < h and sb[(ny * w + nx) * 4 + 3] > 0:
                    n_cnt += 1
            if n_cnt == 0:
                out.put(x, y, (0, 0, 0, 0))
    return out


def apply_flash(
    cv: Canvas,
    color: RGB = (255, 215, 215),
    strength: float = 0.55,
    preserve_cyan_eyes: bool = False,
) -> Canvas:
    out = cv.copy()
    b = out.buf
    cr, cg, cb = color
    for i in range(0, len(b), 4):
        a = b[i + 3]
        if a > 0:
            r, g, bl = b[i], b[i + 1], b[i + 2]
            # Mantem contorno preto nitido (apenas leve tom vinho escuro no impacto)
            if r <= 16 and g <= 16 and bl <= 22:
                s = strength * 0.14
            # Mantem olhos ciano do Espectro brilhantes e nitidos
            elif preserve_cyan_eyes and bl > 170 and g > 170 and r < 170:
                b[i] = min(255, r + 90)
                b[i + 1] = 255
                b[i + 2] = 255
                continue
            else:
                s = strength
            iv = 1.0 - s
            b[i] = min(255, int(r * iv + cr * s))
            b[i + 1] = min(255, int(g * iv + cg * s))
            b[i + 2] = min(255, int(bl * iv + cb * s))
    return out


def apply_ghost_tint(
    cv: Canvas,
    alpha_scale: float,
    tint: RGB,
    tint_strength: float,
    keep_eyes_bright: bool = False,
) -> Canvas:
    out = cv.copy()
    b = out.buf
    tr, tg, tb = tint
    iv = 1.0 - tint_strength
    for i in range(0, len(b), 4):
        a = b[i + 3]
        if a > 0:
            r, g, bl = b[i], b[i + 1], b[i + 2]
            if keep_eyes_bright and bl > 170 and g > 170 and r < 170:
                b[i] = min(255, r + 40)
                b[i + 1] = 255
                b[i + 2] = 255
                b[i + 3] = 255
                continue
            b[i] = min(255, int(r * iv + tr * tint_strength))
            b[i + 1] = min(255, int(g * iv + tg * tint_strength))
            b[i + 2] = min(255, int(bl * iv + tb * tint_strength))
            b[i + 3] = max(0, min(255, int(a * alpha_scale)))
    return out


def shear_canvas(cv: Canvas, top_dx: float, pivot_y: float, height_span: float) -> Canvas:
    """Inclina horizontalmente pixels por linha preservando nitidez pixel-art."""
    if abs(top_dx) < 0.05:
        return cv.copy()
    out = Canvas(cv.w, cv.h)
    for y in range(cv.h):
        t = (pivot_y - y) / max(1.0, height_span)
        dx = int(round(top_dx * t))
        for x in range(cv.w):
            col = cv.get(x, y)
            if col[3] > 0:
                nx = x + dx
                if 0 <= nx < cv.w:
                    out.put(nx, y, col)
    return out


# ---------------------------------------------------------------------------
# 2-Bone Analytic IK & Pixel-Art Primitives
# ---------------------------------------------------------------------------

def solve_2bone_ik(
    p0: Tuple[float, float],
    target: Tuple[float, float],
    l1: float,
    l2: float,
    bend_sign: int = 1,
) -> Tuple[Tuple[float, float], Tuple[float, float]]:
    """
    Resolve junta intermediaria (joelho/cotovelo) para cadeia 2-bones.
    bend_sign = +1 dobra para frente (+x quando p0->target aponta para baixo),
    bend_sign = -1 dobra para tras (-x).
    """
    x0, y0 = p0
    tx, ty = target
    dx = tx - x0
    dy = ty - y0
    dist = math.hypot(dx, dy)
    max_reach = (l1 + l2) - 0.15
    min_reach = abs(l1 - l2) + 0.5
    if dist < 1e-4:
        dx, dy, dist = 0.0, 1.0, 1.0
    clamped = clamp(dist, min_reach, max_reach)
    ux, uy = dx / dist, dy / dist
    # Alvo efetivo (preserva comprimento rigido sem esticar ossos)
    ex = x0 + ux * clamped
    ey = y0 + uy * clamped

    cos_a = clamp((l1 * l1 + clamped * clamped - l2 * l2) / (2.0 * l1 * clamped), -1.0, 1.0)
    a = l1 * cos_a
    h = math.sqrt(max(0.0, l1 * l1 - a * a))

    # Vetor perpendicular: quando (ux, uy) aponta para baixo (0, 1),
    # (uy, -ux) aponta para direita (+1, 0) = frente do personagem!
    px, py = uy * bend_sign, -ux * bend_sign
    jx = x0 + ux * a + px * h
    jy = y0 + uy * a + py * h
    return (jx, jy), (ex, ey)


def draw_capsule(
    cv: Canvas,
    p0: Tuple[float, float],
    p1: Tuple[float, float],
    r0: float,
    r1: float,
    pal: Tuple[RGB, RGB, RGB, RGB],
    light_dir: Tuple[float, float] = (-0.55, -0.83),
    t_min: float = 0.0,
    t_max: float = 1.0,
) -> None:
    """Desenha segmento organico sombreado em 4 tons (dark, shadow, mid, hi)."""
    x0, y0 = p0
    x1, y1 = p1
    dx, dy = x1 - x0, y1 - y0
    seg_len_sq = dx * dx + dy * dy
    seg_len = math.sqrt(seg_len_sq) if seg_len_sq > 1e-6 else 1.0
    rmax = max(r0, r1) + 1.5
    min_x = max(0, int(math.floor(min(x0, x1) - rmax)))
    max_x = min(cv.w - 1, int(math.ceil(max(x0, x1) + rmax)))
    min_y = max(0, int(math.floor(min(y0, y1) - rmax)))
    max_y = min(cv.h - 1, int(math.ceil(max(y0, y1) + rmax)))

    dark, shadow, mid, hi = pal
    lx, ly = light_dir

    for py in range(min_y, max_y + 1):
        for px in range(min_x, max_x + 1):
            vx = px - x0
            vy = py - y0
            t_raw = (vx * dx + vy * dy) / seg_len_sq if seg_len_sq > 1e-6 else 0.0
            if t_raw < t_min - 0.12 or t_raw > t_max + 0.12:
                continue
            t = clamp(t_raw, t_min, t_max)
            cx = x0 + dx * t
            cy = y0 + dy * t
            rx = px - cx
            ry = py - cy
            dist = math.hypot(rx, ry)
            r = r0 + (r1 - r0) * t
            if dist <= r:
                # Normal estimada no plano 2D em relacao ao eixo do osso
                nx = rx / max(0.35, r)
                ny = ry / max(0.35, r)
                # Projecao na direcao da luz (topo-esquerda)
                ndotl = nx * lx + ny * ly
                # Pequeno destaque tambem no centro frontal do volume
                depth_boost = 0.25 * (1.0 - min(1.0, dist / max(0.5, r)))
                shade = ndotl + depth_boost
                if shade > 0.42:
                    col = hi
                elif shade > -0.05:
                    col = mid
                elif shade > -0.52:
                    col = shadow
                else:
                    col = dark
                cv.put(px, py, rgba(col))


def draw_disc(
    cv: Canvas,
    center: Tuple[float, float],
    radius: float,
    pal: Tuple[RGB, RGB, RGB, RGB],
    squareness: float = 0.0,
) -> None:
    """Desenha punho ou junta arredondada/quadrada com sombreamento 4 tons."""
    cx, cy = center
    r = radius
    min_x = max(0, int(math.floor(cx - r - 1)))
    max_x = min(cv.w - 1, int(math.ceil(cx + r + 1)))
    min_y = max(0, int(math.floor(cy - r - 1)))
    max_y = min(cv.h - 1, int(math.ceil(cy + r + 1)))
    dark, shadow, mid, hi = pal
    for py in range(min_y, max_y + 1):
        for px in range(min_x, max_x + 1):
            dx = (px - cx) / max(0.5, r)
            dy = (py - cy) / max(0.5, r)
            d_circ = math.hypot(dx, dy)
            d_box = max(abs(dx), abs(dy))
            d = d_circ * (1.0 - squareness) + d_box * squareness
            if d <= 1.0:
                shade = (-0.55 * dx - 0.83 * dy) + 0.22 * (1.0 - d)
                if shade > 0.38:
                    col = hi
                elif shade > -0.08:
                    col = mid
                elif shade > -0.52:
                    col = shadow
                else:
                    col = dark
                cv.put(px, py, rgba(col))


def draw_polygon_shaded(
    cv: Canvas,
    pts: Sequence[Tuple[float, float]],
    pal: Tuple[RGB, RGB, RGB, RGB],
    fold_xs: Sequence[float] = (),
    rim_left: bool = False,
) -> None:
    """Rasteriza poligono de tecido (tunica/capa) com dobras e luz direcional."""
    if len(pts) < 3:
        return
    min_x = max(0, int(math.floor(min(p[0] for p in pts))))
    max_x = min(cv.w - 1, int(math.ceil(max(p[0] for p in pts))))
    min_y = max(0, int(math.floor(min(p[1] for p in pts))))
    max_y = min(cv.h - 1, int(math.ceil(max(p[1] for p in pts))))
    dark, shadow, mid, hi = pal
    n = len(pts)
    y_top = min(p[1] for p in pts)
    y_bot = max(p[1] for p in pts)
    y_span = max(1.0, y_bot - y_top)

    for py in range(min_y, max_y + 1):
        # Scanline polygon intersections
        xs: List[float] = []
        yf = py + 0.15
        for i in range(n):
            x1, y1 = pts[i]
            x2, y2 = pts[(i + 1) % n]
            if (y1 <= yf < y2) or (y2 <= yf < y1):
                t = (yf - y1) / (y2 - y1)
                xs.append(x1 + t * (x2 - x1))
        xs.sort()
        yt = (py - y_top) / y_span
        for k in range(0, len(xs) - 1, 2):
            sx0 = max(0, int(math.ceil(xs[k])))
            sx1 = min(cv.w - 1, int(math.floor(xs[k + 1])))
            span_w = max(1.0, xs[k + 1] - xs[k])
            for px in range(sx0, sx1 + 1):
                xt = (px - xs[k]) / span_w
                # Borda esquerda da capa do espectro ganha rim light ciano/teal
                if rim_left and (px <= sx0 + 1) and yt > 0.12:
                    col = hi
                elif rim_left and (px == sx0 + 2) and yt > 0.25:
                    col = mid
                else:
                    # Dobras verticais sutis
                    in_fold = any(abs(px - fx) < 1.3 for fx in fold_xs)
                    if in_fold:
                        col = dark if yt > 0.55 else shadow
                    elif xt < 0.22 and yt < 0.72:
                        col = hi if not rim_left else mid
                    elif xt > 0.78 or yt > 0.86:
                        col = shadow
                    else:
                        col = mid
                cv.put(px, py, rgba(col))


# ---------------------------------------------------------------------------
# Hero Palettes & Base Sprite Part Extraction
# ---------------------------------------------------------------------------

@dataclass
class HeroTheme:
    name: str
    is_wraith: bool
    base_shift_x: int
    pants: Tuple[RGB, RGB, RGB, RGB]        # (dark, shadow, mid, hi)
    boot_cuff: Tuple[RGB, RGB, RGB, RGB]
    boot: Tuple[RGB, RGB, RGB, RGB]
    tunic: Tuple[RGB, RGB, RGB, RGB]
    sleeve: Tuple[RGB, RGB, RGB, RGB]
    skin: Tuple[RGB, RGB, RGB, RGB]
    bracer: Tuple[RGB, RGB, RGB, RGB]
    cape: Optional[Tuple[RGB, RGB, RGB, RGB]]
    bandana: Optional[Tuple[RGB, RGB, RGB, RGB]]
    dash_tint: RGB
    hit_flash: RGB


LIVING_THEME = HeroTheme(
    name="hero_living",
    is_wraith=False,
    base_shift_x=0,
    pants=((28, 27, 36), (44, 43, 50), (68, 63, 64), (86, 78, 76)),
    boot_cuff=((52, 38, 36), (82, 62, 52), (112, 88, 72), (138, 110, 90)),
    boot=((42, 30, 29), (66, 48, 41), (92, 72, 58), (114, 94, 78)),
    tunic=((31, 38, 48), (49, 59, 71), (71, 82, 94), (92, 105, 118)),
    sleeve=((30, 38, 48), (46, 56, 68), (64, 76, 88), (82, 96, 108)),
    skin=((146, 98, 82), (186, 128, 106), (226, 166, 134), (242, 192, 154)),
    bracer=((52, 32, 29), (84, 57, 46), (118, 89, 71), (156, 126, 104)),
    cape=None,
    bandana=((26, 30, 40), (46, 54, 64), (68, 79, 88), (88, 100, 112)),
    dash_tint=(186, 224, 252),
    hit_flash=(255, 212, 212),
)

WRAITH_THEME = HeroTheme(
    name="hero_wraith",
    is_wraith=True,
    base_shift_x=-4,  # Centraliza torso/quadril do wraith exatamente em x=40
    pants=((24, 34, 42), (42, 54, 62), (58, 72, 80), (76, 96, 102)),
    boot_cuff=((38, 42, 46), (62, 68, 66), (88, 94, 88), (112, 118, 108)),
    boot=((28, 34, 39), (48, 54, 53), (68, 74, 70), (88, 96, 90)),
    tunic=((26, 39, 49), (44, 62, 75), (66, 82, 95), (84, 104, 118)),
    sleeve=((24, 36, 46), (40, 56, 70), (60, 76, 92), (76, 96, 112)),
    skin=((142, 94, 78), (186, 128, 106), (224, 164, 132), (240, 190, 152)),
    bracer=((24, 30, 34), (45, 50, 52), (72, 78, 76), (99, 106, 99)),
    cape=((14, 36, 45), (25, 61, 74), (43, 87, 101), (68, 126, 140)),
    bandana=None,
    dash_tint=(56, 189, 248),
    hit_flash=(255, 200, 215),
)


@dataclass
class ExtractedParts:
    head: Canvas
    torso: Canvas
    pauldron: Canvas


def _copy_masked(src: Canvas, shift_x: int, predicate) -> Canvas:
    out = Canvas(FW, FH)
    for y in range(src.h):
        for x in range(src.w):
            col = src.get(x, y)
            if col[3] >= 96 and predicate(x, y, col):
                nx = x + shift_x
                if 0 <= nx < FW:
                    out.put(nx, y, (col[0], col[1], col[2], 255))
    return remove_isolated_pixels(out)


def extract_hero_parts(base: Canvas, theme: HeroTheme) -> ExtractedParts:
    """
    Segmenta a imagem base (frame 0 original) em Cabeca, Torso+Cinto e Ombreira,
    preservando 100% da pixel art original do rosto/capuz, olhos ciano e couraca.
    """
    sx = theme.base_shift_x

    if not theme.is_wraith:
        def is_head(x: int, y: int, _c: Color) -> bool:
            if 8 <= y <= 18 and 33 <= x <= 49:
                return True
            if 19 <= y <= 22 and 35 <= x <= 49:
                return True
            if 23 <= y <= 25 and 37 <= x <= 47:
                return True
            return False

        def is_pauldron(x: int, y: int, _c: Color) -> bool:
            if y == 23 and 32 <= x <= 36:
                return True
            if y == 24 and 30 <= x <= 36:
                return True
            if 25 <= y <= 26 and 29 <= x <= 37:
                return True
            if 27 <= y <= 30 and 28 <= x <= 37:
                return True
            if y == 31 and 29 <= x <= 36:
                return True
            return False

        def is_torso(x: int, y: int, _c: Color) -> bool:
            if y == 25 and 37 <= x <= 45:
                return True
            if y == 26 and 36 <= x <= 46:
                return True
            if 27 <= y <= 30 and 35 <= x <= 45:
                return True
            if 31 <= y <= 35 and 33 <= x <= 45:
                return True
            if 36 <= y <= 40 and 32 <= x <= 44:
                return True
            if 41 <= y <= 44 and 31 <= x <= 44:
                return True
            return False
    else:
        def is_head(x: int, y: int, _c: Color) -> bool:
            if 8 <= y <= 20 and 37 <= x <= 53:
                return True
            if y == 21 and 38 <= x <= 53:
                return True
            if y == 22 and 39 <= x <= 53:
                return True
            if y == 23 and 40 <= x <= 52:
                return True
            if y == 24 and 41 <= x <= 51:
                return True
            if y == 25 and 42 <= x <= 50:
                return True
            return False

        def is_pauldron(x: int, y: int, _c: Color) -> bool:
            if y == 23 and 35 <= x <= 40:
                return True
            if y == 24 and 34 <= x <= 41:
                return True
            if 25 <= y <= 29 and 33 <= x <= 41:
                return True
            if y == 30 and 34 <= x <= 40:
                return True
            return False

        def is_torso(x: int, y: int, _c: Color) -> bool:
            if y == 26 and 40 <= x <= 50:
                return True
            if 27 <= y <= 30 and 39 <= x <= 50:
                return True
            if 31 <= y <= 35 and 38 <= x <= 50:
                return True
            if 36 <= y <= 40 and 37 <= x <= 49:
                return True
            if 41 <= y <= 44 and 36 <= x <= 49:
                return True
            return False

    head = _copy_masked(base, sx, is_head)
    pauldron = _copy_masked(base, sx, is_pauldron)
    torso = _copy_masked(base, sx, is_torso)

    # Garante preenchimento solido no canto esquerdo do peito sob a ombreira/braco
    # para que nenhum buraco apareca quando o braco proximo balancar para tras.
    chest_fill = (88, 60, 44, 255) if not theme.is_wraith else (46, 58, 64, 255)
    belt_fill = (76, 52, 38, 255) if not theme.is_wraith else (38, 48, 54, 255)
    for y in range(28, 41):
        for x in range(33, 36):
            if torso.get(x, y)[3] == 0:
                torso.put(x, y, chest_fill)
    for y in range(41, 45):
        for x in range(32, 35):
            if torso.get(x, y)[3] == 0:
                torso.put(x, y, belt_fill)

    torso = add_outline(torso)
    pauldron = add_outline(pauldron)
    head = add_outline(head)
    return ExtractedParts(head=head, torso=torso, pauldron=pauldron)


# ---------------------------------------------------------------------------
# Articulated Body Part Renderers
# ---------------------------------------------------------------------------

def draw_leg(
    hip: Tuple[float, float],
    ankle_target: Tuple[float, float],
    foot_angle_deg: float,
    theme: HeroTheme,
    is_far: bool,
) -> Tuple[Canvas, Tuple[float, float], Tuple[float, float]]:
    """
    Desenha uma perna completa com IK 2-bones (coxa, joelho, canela, dobra da bota e pe).
    Retorna (layer_com_contorno, knee_pos, ankle_pos).
    """
    layer = Canvas(FW, FH)
    dim = 0.78 if is_far else 1.0
    pants = dim_palette(theme.pants, dim)
    cuff = dim_palette(theme.boot_cuff, dim)
    boot = dim_palette(theme.boot, dim)

    # Comprimento constante dos ossos (evita encolher/esticar pernas)
    knee, ankle = solve_2bone_ik(hip, ankle_target, l1=12.2, l2=12.2, bend_sign=1)

    # 1. Coxa robusta fiel as proporcoes do sprite base
    draw_capsule(layer, hip, knee, r0=4.05, r1=3.25, pal=pants)

    # 2. Joelho + topo da canela sob a dobra da bota
    draw_disc(layer, knee, radius=3.2, pal=pants)
    shin_dx = ankle[0] - knee[0]
    shin_dy = ankle[1] - knee[1]
    cuff_top = (knee[0] + shin_dx * 0.12, knee[1] + shin_dy * 0.12)
    cuff_bot = (knee[0] + shin_dx * 0.48, knee[1] + shin_dy * 0.48)

    # 3. Cano da bota (abaixo da dobra ate o tornozelo)
    draw_capsule(layer, cuff_bot, ankle, r0=2.85, r1=2.5, pal=boot)

    # 4. Pe/bota medieval estruturada com calcanhar firme e biqueira
    rad = math.radians(foot_angle_deg)
    fx, fy = math.cos(rad), math.sin(rad)
    heel = (ankle[0] - fx * 2.0, ankle[1] - fy * 2.0 + 0.5)
    toe = (ankle[0] + fx * 5.8, ankle[1] + fy * 5.8 + 0.5)
    # Garante que a biqueira de um pe apoiado nao passe abaixo da linha do solo (y=74 interior + 1px contorno = 75)
    max_foot_y = 73.2 if not is_far else 72.4
    if toe[1] > max_foot_y:
        toe = (toe[0], max_foot_y)
    if heel[1] > max_foot_y:
        heel = (heel[0], max_foot_y)
    draw_capsule(layer, heel, toe, r0=2.55, r1=1.85, pal=boot)

    # Se o pe estiver quase plano no chao, nivela a sola com nitidez
    if abs(foot_angle_deg) <= 10.0 and ankle[1] >= 70.0:
        sole_y = min(74 if not is_far else 73, int(round(ankle[1] + 2.2)))
        x_lo = max(0, int(round(heel[0] - 1.5)))
        x_hi = min(FW - 1, int(round(toe[0] + 1.0)))
        for sx in range(x_lo, x_hi + 1):
            if 0 <= sole_y < FH:
                layer.put(sx, sole_y, rgba(boot[0]))
            if 0 <= sole_y - 1 < FH:
                layer.put(sx, sole_y - 1, rgba(boot[2] if sx > ankle[0] else boot[1]))

    # 5. Dobra/punho superior caracteristico da bota (mais encorpado e marcante)
    draw_capsule(layer, cuff_top, cuff_bot, r0=3.75, r1=3.45, pal=cuff)
    # Vinco de sombra sob a dobra da bota para leitura 32-bit
    shin_len = max(1.0, math.hypot(shin_dx, shin_dy))
    perp_x, perp_y = -shin_dy / shin_len, shin_dx / shin_len
    for s in (-2.5, -1.25, 0.0, 1.25, 2.5):
        cx = int(round(cuff_bot[0] + perp_x * s + shin_dx * 0.08))
        cy = int(round(cuff_bot[1] + perp_y * s + shin_dy * 0.08))
        if 0 <= cx < FW and 0 <= cy < FH and layer.get(cx, cy)[3] > 0:
            layer.put(cx, cy, rgba(boot[0]))

    outlined = add_outline(layer)
    # Limpa qualquer pixel que eventualmente vaze para y >= FOOT_Y (76)
    for y in range(FOOT_Y, FH):
        for x in range(FW):
            outlined.put(x, y, (0, 0, 0, 0))
    return outlined, knee, ankle


def draw_arm(
    shoulder: Tuple[float, float],
    hand_target: Tuple[float, float],
    bend_sign: int,
    theme: HeroTheme,
    is_far: bool,
) -> Tuple[Canvas, Tuple[float, float]]:
    """
    Desenha braco completo com IK 2-bones: manga, biceps/cotovelo, bracadeira e punho fechado.
    Retorna (layer_com_contorno, hand_pos_efetiva).
    """
    layer = Canvas(FW, FH)
    dim = 0.88 if is_far else 1.0
    sleeve = dim_palette(theme.sleeve, dim)
    skin = dim_palette(theme.skin, 0.94 if is_far else 1.0)
    bracer = dim_palette(theme.bracer, dim)

    # Braco da arma ganha leve folga extra para extensao dramatica no attack0/attack2
    l1, l2 = (10.5, 10.6) if is_far else (9.8, 10.0)
    elbow, hand = solve_2bone_ik(shoulder, hand_target, l1=l1, l2=l2, bend_sign=bend_sign)

    # Manga no terco superior
    u_dx, u_dy = elbow[0] - shoulder[0], elbow[1] - shoulder[1]
    sleeve_end = (shoulder[0] + u_dx * 0.45, shoulder[1] + u_dy * 0.45)

    # Pele do biceps/cotovelo ate inicio da bracadeira
    f_dx, f_dy = hand[0] - elbow[0], hand[1] - elbow[1]
    bracer_start = (elbow[0] + f_dx * 0.24, elbow[1] + f_dy * 0.24)
    wrist = (elbow[0] + f_dx * 0.84, elbow[1] + f_dy * 0.84)

    # Biceps + cotovelo expostos
    draw_capsule(layer, sleeve_end, elbow, r0=2.35, r1=2.2, pal=skin)
    draw_capsule(layer, elbow, bracer_start, r0=2.2, r1=2.15, pal=skin)

    # Manga por cima do ombro
    draw_capsule(layer, shoulder, sleeve_end, r0=3.0, r1=2.75, pal=sleeve)

    # Bracadeira no antebraco
    draw_capsule(layer, bracer_start, wrist, r0=2.5, r1=2.4, pal=bracer)

    # Punho fechado (quadradinho arredondado 5x5 + contorno = 7x7, igual ao sprite base)
    draw_disc(layer, hand, radius=2.75, pal=skin, squareness=0.45)
    # Detalhe de dedos/dobra interna no punho
    fx, fy = int(round(hand[0])), int(round(hand[1]))
    layer.put(fx + (1 if not is_far else -1), fy + 1, rgba(skin[0]))
    layer.put(fx, fy - 1, rgba(skin[3]))

    return add_outline(layer), hand


def draw_tunic_skirt(
    pelvis_cx: float,
    belt_y: float,
    near_knee_x: float,
    far_knee_x: float,
    sway_dx: float,
    theme: HeroTheme,
) -> Canvas:
    """Desenha barra dinamica da tunica acoplada sob o cinto acompanhando as pernas."""
    layer = Canvas(FW, FH)
    top_y = belt_y - 1.0
    top_l = pelvis_cx - 7.4
    top_r = pelvis_cx + 6.8
    spread_l = clamp(min(near_knee_x, far_knee_x) - 1.4, pelvis_cx - 14.0, pelvis_cx - 8.2)
    spread_r = clamp(max(near_knee_x, far_knee_x) + 1.4, pelvis_cx + 7.2, pelvis_cx + 13.0)
    bot_l = spread_l + sway_dx * 0.45
    bot_r = spread_r + sway_dx * 0.45
    hem_y = belt_y + 9.8

    if not theme.is_wraith:
        pts = [
            (top_l, top_y),
            (top_r, top_y),
            (bot_r, hem_y - 1.2),
            (pelvis_cx + 3.2 + sway_dx * 0.3, hem_y + 0.7),
            (pelvis_cx - 2.6 + sway_dx * 0.3, hem_y + 0.7),
            (bot_l, hem_y - 0.8),
        ]
    else:
        # Barra esfarrapada/pontiaguda caracteristica do Espectro
        mid_x = pelvis_cx + sway_dx * 0.35
        pts = [
            (top_l, top_y),
            (top_r, top_y),
            (bot_r, hem_y - 0.5),
            (bot_r - 2.6, hem_y + 2.3),
            (mid_x + 2.4, hem_y - 0.6),
            (mid_x + 0.2, hem_y + 2.8),
            (mid_x - 2.6, hem_y - 0.4),
            (bot_l + 2.3, hem_y + 2.1),
            (bot_l, hem_y - 0.8),
        ]

    folds = (pelvis_cx - 2.6 + sway_dx * 0.2, pelvis_cx + 2.4 + sway_dx * 0.25)
    draw_polygon_shaded(layer, pts, theme.tunic, fold_xs=folds, rim_left=False)
    return add_outline(layer)


def draw_wraith_cape(
    sh_x: float,
    sh_y: float,
    billow: float,
    lift: float,
    phase: float,
    theme: HeroTheme,
) -> Canvas:
    """Desenha capa esfarrapada cheia do Espectro envolvendo ombros com ondulacao fluida."""
    layer = Canvas(FW, FH)
    assert theme.cape is not None

    # Ancoragem alta na gola/capuz para caimento fluido natural
    neck_top = (sh_x + 2.0, sh_y - 6.0)
    neck_r = (sh_x + 11.0, sh_y + 2.0)

    # Curva da borda traseira com onda viajante continua
    w0 = math.sin(phase + 0.5) * 1.4
    w1 = math.sin(phase) * 2.5
    w2 = math.sin(phase - 1.2) * 3.3
    w3 = math.sin(phase - 2.3) * 3.6

    upper_back = (max(3.5, sh_x - 5.0 - billow * 0.22), sh_y + 3.5 - lift * 0.15 + w0)
    mid_back = (max(3.0, sh_x - 11.5 - billow * 0.55), sh_y + 16.5 - lift * 0.42 + w1)
    tip1 = (max(2.5, sh_x - 18.0 - billow * 0.95), sh_y + 31.5 - lift * 0.82 + w2)
    notch1 = (max(4.0, sh_x - 13.5 - billow * 0.72), sh_y + 26.5 - lift * 0.62 + w2 * 0.6)
    tip2 = (max(4.5, sh_x - 11.5 - billow * 0.68), sh_y + 35.5 - lift * 0.78 + w3)
    notch2 = (sh_x - 6.2 - billow * 0.45, sh_y + 27.5 - lift * 0.52 + w2 * 0.4)
    tip3 = (sh_x - 2.5 - billow * 0.35, sh_y + 34.0 - lift * 0.58 - w1 * 0.7)
    inner_notch = (sh_x + 2.2 - billow * 0.18, sh_y + 26.5 - lift * 0.32)
    tip4 = (sh_x + 5.5 - billow * 0.12, sh_y + 32.0 - lift * 0.42 - w2 * 0.4)
    inner_mid = (sh_x + 9.0 - billow * 0.05, sh_y + 20.0 - lift * 0.18)

    pts = [
        neck_top, neck_r, inner_mid, tip4, inner_notch,
        tip3, notch2, tip2, notch1, tip1, mid_back, upper_back,
    ]
    folds = (
        sh_x - 6.5 - billow * 0.38,
        sh_x - 11.8 - billow * 0.65,
    )
    draw_polygon_shaded(layer, pts, theme.cape, fold_xs=folds, rim_left=True)
    return add_outline(layer)


def draw_bandana_tails(
    head_x: float,
    head_y: float,
    billow: float,
    lift: float,
    phase: float,
    theme: HeroTheme,
) -> Canvas:
    """Desenha as duas pontas da faixa na cabeca do hero_living ondulando atras."""
    layer = Canvas(FW, FH)
    assert theme.bandana is not None
    w1 = math.sin(phase) * 1.4
    w2 = math.sin(phase - 1.2) * 1.8

    root = (head_x - 5.5, head_y + 11.0)
    tip_a = (root[0] - 4.2 - billow * 0.32, root[1] + 2.8 - lift * 0.22 + w1)
    tip_b = (root[0] - 2.8 - billow * 0.24, root[1] + 5.2 - lift * 0.16 + w2)
    draw_capsule(layer, root, tip_a, r0=1.5, r1=0.95, pal=theme.bandana)
    draw_capsule(layer, (root[0] + 0.5, root[1] + 1.0), tip_b, r0=1.35, r1=0.85, pal=theme.bandana)
    return add_outline(layer)


# ---------------------------------------------------------------------------
# 24-Frame Keyframe Pose Table
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class HeroPose:
    name: str
    body_dx: float
    body_dy: float
    torso_lean: float
    head_dx: float
    head_dy: float
    # Alvos de tornozelo (chao near: y=72 -> sola y=75; chao far: y=71 -> sola y=74)
    near_ankle: Tuple[float, float]
    near_foot_deg: float
    far_ankle: Tuple[float, float]
    far_foot_deg: float
    # Alvos de mao
    near_hand: Tuple[float, float]
    weapon_hand: Tuple[float, float]
    weapon_rot: float           # Radianos (base HeroWeaponRig)
    # Dinamica de tecido
    cape_billow: float
    cape_lift: float
    cape_phase: float
    skirt_sway: float
    # Efeitos de acao
    ghost_offsets: Tuple[Tuple[int, float], ...] = ()
    speed_lines: bool = False
    flash_strength: float = 0.0
    wraith_dash_tint: bool = False
    # Braco da arma desenhado na frente do torso/cabeca (golpe cruzando o corpo)
    weapon_arm_front: bool = False


def build_poses() -> List[HeroPose]:
    """Define os 24 keyframes com passos amplos, inversao real e combate expressivo."""
    poses: List[HeroPose] = []

    # ---- 0..3: IDLE (4 frames — pes firmes no chao, respiracao organica) ----
    idle_specs = [
        # (name, b_dy, h_dy, w_dy, w_rot, n_dy, billow, phase)
        ("idle0",  0.0,  0.0,  0.0, 0.06,  0.0, 0.0, 0.0),
        ("idle1", -1.0, -1.0, -0.8, 0.03, -0.8, 1.8, 1.57),
        ("idle2", -1.5, -2.0, -1.6, 0.00, -1.5, 3.2, 3.14),
        ("idle3", -0.8, -1.0, -0.7, 0.03, -0.6, 1.6, 4.71),
    ]
    for name, bdy, hdy, wdy, wrot, ndy, billow, ph in idle_specs:
        poses.append(HeroPose(
            name=name,
            body_dx=0.0, body_dy=bdy, torso_lean=0.0,
            head_dx=0.0, head_dy=hdy,
            near_ankle=(27.0, 72.0), near_foot_deg=0.0,
            far_ankle=(48.0, 71.0), far_foot_deg=0.0,
            near_hand=(29.5, 48.0 + ndy),
            weapon_hand=(55.0, 32.5 + wdy),
            weapon_rot=wrot,
            cape_billow=billow, cape_lift=billow * 0.45, cape_phase=ph,
            skirt_sway=billow * 0.35,
        ))

    # ---- 4..9: WALK (6 frames — ciclo completo de passos com inversao clara!) ----
    # walk0: contato D (near frente estendida, far atras erguida)
    # walk1: apoio baixo D (near sob corpo, far recolhendo dobrada, torso +2px)
    # walk2: passagem E (far dobrada alta passando a frente, near empurrando atras, torso -2px)
    # walk3: contato E (INVERSAO CLARA: far bem a frente, near bem atras erguida)
    # walk4: apoio baixo E (far sob corpo, near recolhendo dobrada, torso +2px)
    # walk5: passagem D (near dobrada alta passando a frente, far empurrando atras, torso -2px)
    walk_specs = [
        # walk0 (Contato D)
        HeroPose(
            name="walk0",
            body_dx=1.0, body_dy=0.0, torso_lean=2.2,
            head_dx=2.6, head_dy=0.0,
            near_ankle=(51.0, 72.0), near_foot_deg=-8.0,
            far_ankle=(21.5, 68.0), far_foot_deg=20.0,
            near_hand=(21.5, 46.5),       # Braco proximo balanca para tras
            weapon_hand=(57.5, 33.5),     # Braco arma avanca em contra-fase
            weapon_rot=0.22,
            cape_billow=5.5, cape_lift=3.5, cape_phase=0.0, skirt_sway=-2.5,
        ),
        # walk1 (Apoio baixo D — torso +2px)
        HeroPose(
            name="walk1",
            body_dx=1.0, body_dy=2.0, torso_lean=2.5,
            head_dx=2.8, head_dy=2.0,
            near_ankle=(42.5, 72.0), near_foot_deg=0.0,
            far_ankle=(22.0, 63.5), far_foot_deg=26.0,
            near_hand=(26.5, 49.0),
            weapon_hand=(54.5, 36.0),
            weapon_rot=0.14,
            cape_billow=6.4, cape_lift=2.5, cape_phase=1.05, skirt_sway=-1.5,
        ),
        # walk2 (Passagem E — torso -2px, perna far dobrada passando alto a frente)
        HeroPose(
            name="walk2",
            body_dx=1.0, body_dy=-2.0, torso_lean=1.8,
            head_dx=2.3, head_dy=-2.0,
            near_ankle=(30.0, 72.0), near_foot_deg=10.0,
            far_ankle=(43.5, 63.0), far_foot_deg=16.0,
            near_hand=(35.5, 45.5),
            weapon_hand=(51.5, 34.0),
            weapon_rot=0.04,
            cape_billow=5.0, cape_lift=4.5, cape_phase=2.09, skirt_sway=2.0,
        ),
        # walk3 (Contato E — INVERSAO CLARA: far bem a frente, near bem atras erguida)
        HeroPose(
            name="walk3",
            body_dx=1.0, body_dy=0.0, torso_lean=2.2,
            head_dx=2.6, head_dy=0.0,
            near_ankle=(21.5, 68.5), near_foot_deg=22.0,
            far_ankle=(51.5, 71.0), far_foot_deg=-8.0,
            near_hand=(41.5, 44.5),       # Braco proximo balanca bem a frente!
            weapon_hand=(50.5, 35.5),     # Braco arma recua em contra-fase
            weapon_rot=-0.05,
            cape_billow=5.8, cape_lift=3.5, cape_phase=3.14, skirt_sway=2.5,
        ),
        # walk4 (Apoio baixo E — torso +2px)
        HeroPose(
            name="walk4",
            body_dx=1.0, body_dy=2.0, torso_lean=2.5,
            head_dx=2.8, head_dy=2.0,
            near_ankle=(22.0, 63.5), near_foot_deg=26.0,
            far_ankle=(42.5, 71.0), far_foot_deg=0.0,
            near_hand=(36.0, 48.0),
            weapon_hand=(52.5, 36.5),
            weapon_rot=0.04,
            cape_billow=6.6, cape_lift=2.5, cape_phase=4.19, skirt_sway=1.5,
        ),
        # walk5 (Passagem D — torso -2px, perna near dobrada passando alto a frente)
        HeroPose(
            name="walk5",
            body_dx=1.0, body_dy=-2.0, torso_lean=1.8,
            head_dx=2.3, head_dy=-2.0,
            near_ankle=(43.5, 63.0), near_foot_deg=16.0,
            far_ankle=(30.5, 71.0), far_foot_deg=10.0,
            near_hand=(27.0, 45.5),
            weapon_hand=(55.5, 33.5),
            weapon_rot=0.16,
            cape_billow=5.2, cape_lift=4.5, cape_phase=5.24, skirt_sway=-2.0,
        ),
    ]
    poses.extend(walk_specs)

    # ---- 10..15: ATTACK (6 frames — T-121) ----
    # Linha do tempo (ms, igual a HERO_ATTACK_FRAME_DURATIONS_MS no HeroWeaponRig):
    #   attack0   0- 90  antecipacao: peso atras, tronco recua, mao da arma alta atras da cabeca
    #   attack1  90-145  golpe: avanco do quadril, braco cruzando por cima e a frente
    #   attack2 145-210  IMPACTO (145 ms): extensao maxima, peso no pe da frente
    #   attack3 210-265  follow-through: mao desce cruzando a frente do cinto
    #   attack4 265-315  recuperacao 1
    #   attack5 315-360  recuperacao 2 (volta a guarda do idle)
    # weapon_rot = rotacao da arma no INICIO do frame (keyframe do rig).
    attack_specs = [
        HeroPose(
            name="attack0",
            body_dx=-2.5, body_dy=1.5, torso_lean=-2.6,
            head_dx=-3.6, head_dy=1.0,
            near_ankle=(22.5, 72.0), near_foot_deg=0.0,
            far_ankle=(50.0, 71.0), far_foot_deg=-6.0,
            near_hand=(25.5, 44.5),       # mao livre recolhida a frente do peito
            weapon_hand=(44.5, 12.0),     # mao da arma alta, atras da cabeca
            weapon_rot=-1.7,
            cape_billow=1.5, cape_lift=5.0, cape_phase=0.6, skirt_sway=2.0,
            weapon_arm_front=True,
        ),
        HeroPose(
            name="attack1",
            body_dx=2.0, body_dy=0.5, torso_lean=2.6,
            head_dx=3.8, head_dy=0.5,
            near_ankle=(23.0, 72.0), near_foot_deg=10.0,
            far_ankle=(54.5, 71.0), far_foot_deg=0.0,
            near_hand=(22.0, 44.0),
            weapon_hand=(60.0, 15.5),     # braco cruzando por cima, a frente
            weapon_rot=-1.95,
            cape_billow=7.0, cape_lift=6.0, cape_phase=1.8, skirt_sway=-2.5,
            weapon_arm_front=True,
        ),
        HeroPose(
            name="attack2",
            body_dx=5.0, body_dy=3.0, torso_lean=4.0,
            head_dx=7.6, head_dy=3.0,
            near_ankle=(20.0, 72.0), near_foot_deg=22.0,
            far_ankle=(58.5, 71.0), far_foot_deg=0.0,
            near_hand=(20.5, 42.5),       # contrapeso para tras
            weapon_hand=(70.0, 34.0),     # extensao maxima a frente
            weapon_rot=1.05,
            cape_billow=11.5, cape_lift=8.5, cape_phase=2.9, skirt_sway=-4.0,
            weapon_arm_front=True,
        ),
        HeroPose(
            name="attack3",
            body_dx=4.5, body_dy=3.5, torso_lean=3.4,
            head_dx=6.6, head_dy=3.5,
            near_ankle=(20.5, 72.0), near_foot_deg=18.0,
            far_ankle=(58.0, 71.0), far_foot_deg=0.0,
            near_hand=(23.5, 45.5),
            weapon_hand=(63.0, 47.0),     # follow-through baixo, cruzando a frente do cinto
            weapon_rot=1.7,
            cape_billow=9.5, cape_lift=6.0, cape_phase=4.0, skirt_sway=-3.2,
            weapon_arm_front=True,
        ),
        HeroPose(
            name="attack4",
            body_dx=2.5, body_dy=2.0, torso_lean=1.6,
            head_dx=3.4, head_dy=2.0,
            near_ankle=(23.5, 72.0), near_foot_deg=8.0,
            far_ankle=(53.0, 71.0), far_foot_deg=0.0,
            near_hand=(27.0, 48.0),
            weapon_hand=(58.5, 40.5),
            weapon_rot=1.75,
            cape_billow=5.0, cape_lift=3.0, cape_phase=5.0, skirt_sway=-1.5,
        ),
        HeroPose(
            name="attack5",
            body_dx=1.0, body_dy=0.5, torso_lean=0.5,
            head_dx=1.4, head_dy=0.5,
            near_ankle=(26.0, 72.0), near_foot_deg=2.0,
            far_ankle=(50.0, 71.0), far_foot_deg=0.0,
            near_hand=(29.0, 48.0),
            weapon_hand=(56.0, 34.5),
            weapon_rot=0.75,
            cape_billow=2.2, cape_lift=1.2, cape_phase=5.8, skirt_sway=-0.5,
        ),
    ]
    poses.extend(attack_specs)

    # ---- 16..19: DASH (4 frames — agachamento impulso, arranque + rastro, pico spectral, pouso) ----
    dash_specs = [
        # dash0: Agachamento de impulso comprimido atletico
        HeroPose(
            name="dash0",
            body_dx=-2.5, body_dy=5.0, torso_lean=3.0,
            head_dx=-0.2, head_dy=5.2,
            near_ankle=(29.0, 72.0), near_foot_deg=0.0,
            far_ankle=(49.0, 71.0), far_foot_deg=0.0,
            near_hand=(23.5, 49.5),
            weapon_hand=(50.5, 40.5),
            weapon_rot=0.45,
            cape_billow=3.0, cape_lift=-0.5, cape_phase=0.4, skirt_sway=-2.0,
        ),
        # dash1: Arranque aerodinamico inclinado com perna traseira estendida + rastro
        HeroPose(
            name="dash1",
            body_dx=4.0, body_dy=1.5, torso_lean=4.5,
            head_dx=7.4, head_dy=1.8,
            near_ankle=(19.5, 67.5), near_foot_deg=24.0,
            far_ankle=(51.0, 68.5), far_foot_deg=14.0,
            near_hand=(23.5, 42.5),
            weapon_hand=(59.0, 36.0),
            weapon_rot=0.85,
            cape_billow=11.5, cape_lift=10.0, cape_phase=1.9, skirt_sway=-4.5,
            ghost_offsets=((-6, 0.36),),
            speed_lines=True,
        ),
        # dash2: Pico de velocidade com afterimage espectral duplo
        HeroPose(
            name="dash2",
            body_dx=6.0, body_dy=0.5, torso_lean=5.0,
            head_dx=9.8, head_dy=0.8,
            near_ankle=(20.5, 66.0), near_foot_deg=26.0,
            far_ankle=(54.0, 69.0), far_foot_deg=16.0,
            near_hand=(25.0, 41.0),
            weapon_hand=(61.5, 37.5),
            weapon_rot=1.08,
            cape_billow=13.0, cape_lift=12.0, cape_phase=3.4, skirt_sway=-5.0,
            ghost_offsets=((-11, 0.22), (-5, 0.42)),
            speed_lines=True,
            wraith_dash_tint=True,
        ),
        # dash3: Desaceleracao / pouso com frenagem firme na perna dianteira
        HeroPose(
            name="dash3",
            body_dx=2.0, body_dy=2.5, torso_lean=-1.2,
            head_dx=1.2, head_dy=2.5,
            near_ankle=(26.0, 72.0), near_foot_deg=6.0,
            far_ankle=(55.0, 71.0), far_foot_deg=-6.0,
            near_hand=(26.0, 49.0),
            weapon_hand=(54.5, 35.0),
            weapon_rot=0.26,
            cape_billow=4.5, cape_lift=4.0, cape_phase=4.8, skirt_sway=1.0,
            ghost_offsets=((-4, 0.18),),
        ),
    ]
    poses.extend(dash_specs)

    # ---- 20..23: HIT (4 frames — impacto + flash, recuo maximo, passo atras, retomada guarda) ----
    hit_specs = [
        # hit0: Impacto com recuo de tronco/cabeca + flash
        HeroPose(
            name="hit0",
            body_dx=-4.0, body_dy=0.0, torso_lean=-3.2,
            head_dx=-6.8, head_dy=-0.5,
            near_ankle=(24.0, 72.0), near_foot_deg=0.0,
            far_ankle=(47.0, 69.5), far_foot_deg=-10.0,
            near_hand=(20.5, 44.0),
            weapon_hand=(49.0, 27.5),
            weapon_rot=-0.65,
            cape_billow=7.0, cape_lift=7.5, cape_phase=0.8, skirt_sway=3.0,
            flash_strength=0.58,
        ),
        # hit1: Recuo maximo (stagger)
        HeroPose(
            name="hit1",
            body_dx=-5.5, body_dy=2.0, torso_lean=-3.8,
            head_dx=-8.6, head_dy=1.6,
            near_ankle=(21.5, 72.0), near_foot_deg=-4.0,
            far_ankle=(43.5, 68.5), far_foot_deg=-12.0,
            near_hand=(19.5, 47.0),
            weapon_hand=(46.0, 32.5),
            weapon_rot=-0.38,
            cape_billow=6.0, cape_lift=5.5, cape_phase=2.2, skirt_sway=3.5,
            flash_strength=0.22,
        ),
        # hit2: Passo atras recuperando equilibrio
        HeroPose(
            name="hit2",
            body_dx=-3.0, body_dy=2.0, torso_lean=-1.0,
            head_dx=-3.7, head_dy=2.0,
            near_ankle=(20.5, 72.0), near_foot_deg=0.0,
            far_ankle=(46.5, 71.0), far_foot_deg=0.0,
            near_hand=(25.5, 49.5),
            weapon_hand=(51.0, 35.5),
            weapon_rot=0.14,
            cape_billow=4.0, cape_lift=2.5, cape_phase=3.8, skirt_sway=1.5,
        ),
        # hit3: Retomada de guarda
        HeroPose(
            name="hit3",
            body_dx=-1.0, body_dy=0.5, torso_lean=-0.2,
            head_dx=-1.1, head_dy=0.5,
            near_ankle=(25.5, 72.0), near_foot_deg=0.0,
            far_ankle=(48.0, 71.0), far_foot_deg=0.0,
            near_hand=(28.5, 48.5),
            weapon_hand=(54.0, 33.5),
            weapon_rot=0.08,
            cape_billow=1.5, cape_lift=1.0, cape_phase=5.1, skirt_sway=0.5,
        ),
    ]
    poses.extend(hit_specs)

    assert len(poses) == 24
    return poses


# ---------------------------------------------------------------------------
# Frame Compositor
# ---------------------------------------------------------------------------

def render_core_character(
    pose: HeroPose,
    parts: ExtractedParts,
    theme: HeroTheme,
) -> Tuple[Canvas, Tuple[float, float]]:
    """Compoe o personagem articulado em um frame 80x80 e retorna (frame, weapon_hand_pos)."""
    frame = Canvas(FW, FH)

    # Centros anatomicos canonicos (alinhados com hero_living_base.png e hero_wraith_base.png -4px)
    pelvis_cx = 39.0 + pose.body_dx
    hip_y = 49.5 + pose.body_dy
    belt_y = 43.5 + pose.body_dy

    # Inclinacao do torso desloca os ombros proporcionalmente ao torso_lean
    sh_shift_x = pose.torso_lean * 0.78
    near_sh = (32.5 + pose.body_dx + sh_shift_x, 29.0 + pose.body_dy)
    far_sh = (45.0 + pose.body_dx + sh_shift_x, 29.5 + pose.body_dy)

    near_hip = (pelvis_cx - 3.0, hip_y)
    far_hip = (pelvis_cx + 2.5, hip_y - 0.5)

    # 1. Capa traseira (wraith) ou pontas da bandana (living)
    if theme.is_wraith:
        cape = draw_wraith_cape(
            near_sh[0], near_sh[1],
            billow=pose.cape_billow, lift=pose.cape_lift, phase=pose.cape_phase,
            theme=theme,
        )
        frame.composite(cape)
    else:
        bandana = draw_bandana_tails(
            40.0 + pose.head_dx, 8.0 + pose.head_dy,
            billow=pose.cape_billow, lift=pose.cape_lift, phase=pose.cape_phase,
            theme=theme,
        )
        frame.composite(bandana)

    # 2. Braco distante / braco da arma (atras da borda direita do peito)
    far_arm_layer, actual_weapon_hand = draw_arm(
        far_sh, pose.weapon_hand, bend_sign=-1, theme=theme, is_far=True
    )
    if not pose.weapon_arm_front:
        frame.composite(far_arm_layer)

    # 3. Perna distante (mais escura para leitura clara no cruzamento de passos)
    far_leg_layer, far_knee, _ = draw_leg(
        far_hip, pose.far_ankle, pose.far_foot_deg, theme=theme, is_far=True
    )
    frame.composite(far_leg_layer)

    # 4. Perna proxima (brilho total, contorno proprio sobrepondo a perna distante)
    near_leg_layer, near_knee, _ = draw_leg(
        near_hip, pose.near_ankle, pose.near_foot_deg, theme=theme, is_far=False
    )
    frame.composite(near_leg_layer)

    # 5. Barra da tunica dinamica sobre o quadril/topo das coxas
    skirt = draw_tunic_skirt(
        pelvis_cx=pelvis_cx,
        belt_y=belt_y,
        near_knee_x=near_knee[0],
        far_knee_x=far_knee[0],
        sway_dx=pose.skirt_sway,
        theme=theme,
    )
    frame.composite(skirt)

    # 6. Torso + Cinto preservados do sprite base (com shear sutil por linha)
    torso_sheared = shear_canvas(parts.torso, pose.torso_lean, pivot_y=44.0, height_span=19.0)
    frame.composite(torso_sheared, int(round(pose.body_dx)), int(round(pose.body_dy)))

    # 7. Cabeca / Capuz preservados 100% nitidos do sprite base
    frame.composite(parts.head, int(round(pose.head_dx)), int(round(pose.head_dy)))

    # 7b. No golpe o braco da arma cruza a frente do corpo/cabeca
    if pose.weapon_arm_front:
        frame.composite(far_arm_layer)

    # 8. Braco proximo (na frente do torso/tunica) + Ombreira preservada
    near_arm_layer, _ = draw_arm(
        near_sh, pose.near_hand, bend_sign=-1, theme=theme, is_far=False
    )
    frame.composite(near_arm_layer)

    # Ombreira acompanha o ombro proximo e leve deslocamento do balanco do braco
    arm_swing_dx = clamp((pose.near_hand[0] - 29.5) * 0.10, -1.5, 1.5)
    pauldron_dx = int(round(pose.body_dx + sh_shift_x + arm_swing_dx))
    pauldron_dy = int(round(pose.body_dy))
    frame.composite(parts.pauldron, pauldron_dx, pauldron_dy)

    # Limpeza final de eventual pixel isolado
    frame = remove_isolated_pixels(frame)
    return frame, actual_weapon_hand


def render_frame(
    pose: HeroPose,
    parts: ExtractedParts,
    theme: HeroTheme,
) -> Tuple[Canvas, Dict[str, float]]:
    core, weapon_hand = render_core_character(pose, parts, theme)
    out = Canvas(FW, FH)

    # Afterimages espectrais / rastro do Dash atras do personagem
    if pose.ghost_offsets:
        for gx, alpha_scale in pose.ghost_offsets:
            ghost = apply_ghost_tint(
                core,
                alpha_scale=alpha_scale,
                tint=theme.dash_tint,
                tint_strength=0.62 if theme.is_wraith else 0.42,
            )
            out.composite(ghost, gx, 0)

    # Linhas sutis de velocidade durante pico do dash
    if pose.speed_lines:
        line_col = (125, 226, 255, 170) if theme.is_wraith else (225, 238, 250, 150)
        for ly, lx0, lx1 in ((28, 4, 18), (44, 2, 16), (60, 6, 19)):
            for lx in range(lx0, lx1 + 1):
                fade = int(line_col[3] * ((lx - lx0 + 1) / max(1, lx1 - lx0 + 1)))
                out.blend_pixel(lx, ly, (line_col[0], line_col[1], line_col[2], fade))

    main_spr = core
    if pose.wraith_dash_tint and theme.is_wraith:
        # Leve brilho espectral ciano no pico do dash do Espectro, mantendo olhos ciano intensos
        main_spr = apply_ghost_tint(
            main_spr,
            alpha_scale=0.92,
            tint=(56, 189, 248),
            tint_strength=0.22,
            keep_eyes_bright=True,
        )

    if pose.flash_strength > 0.0:
        main_spr = apply_flash(
            main_spr,
            color=theme.hit_flash,
            strength=pose.flash_strength,
            preserve_cyan_eyes=theme.is_wraith,
        )

    out.composite(main_spr)

    anchor = {
        "dx": round(weapon_hand[0] - CENTER_X, 1),
        "dy": round(weapon_hand[1] - 40.0, 1),
        "rot": round(pose.weapon_rot, 3),
    }
    return out, anchor


# ---------------------------------------------------------------------------
# Objective Metrics & Labeled 3x/4x Previews (Built-in 3x5 Pixel Font)
# ---------------------------------------------------------------------------

FONT_3X5: Dict[str, Tuple[str, ...]] = {
    "0": ("111", "101", "101", "101", "111"),
    "1": ("010", "110", "010", "010", "111"),
    "2": ("111", "001", "111", "100", "111"),
    "3": ("111", "001", "111", "001", "111"),
    "4": ("101", "101", "111", "001", "001"),
    "5": ("111", "100", "111", "001", "111"),
    "6": ("111", "100", "111", "101", "111"),
    "7": ("111", "001", "010", "010", "010"),
    "8": ("111", "101", "111", "101", "111"),
    "9": ("111", "101", "111", "001", "111"),
    "a": ("010", "101", "111", "101", "101"),
    "c": ("111", "100", "100", "100", "111"),
    "d": ("110", "101", "101", "101", "110"),
    "e": ("111", "100", "110", "100", "111"),
    "h": ("101", "101", "111", "101", "101"),
    "i": ("111", "010", "010", "010", "111"),
    "k": ("101", "101", "110", "101", "101"),
    "l": ("100", "100", "100", "100", "111"),
    "s": ("111", "100", "111", "001", "111"),
    "t": ("111", "010", "010", "010", "010"),
    "w": ("101", "101", "111", "111", "101"),
    ":": ("000", "010", "000", "010", "000"),
    " ": ("000", "000", "000", "000", "000"),
}


def draw_text(cv: Canvas, x: int, y: int, text: str, col: Color, scale: int = 2) -> None:
    cx = x
    for ch in text.lower():
        glyph = FONT_3X5.get(ch, FONT_3X5[" "])
        for ry, row in enumerate(glyph):
            for rx, bit in enumerate(row):
                if bit == "1":
                    for sy in range(scale):
                        for sx in range(scale):
                            cv.put(cx + rx * scale + sx, y + ry * scale + sy, col)
        cx += 4 * scale


def fill_rect(cv: Canvas, x0: int, y0: int, w: int, h: int, col: Color) -> None:
    for y in range(max(0, y0), min(cv.h, y0 + h)):
        for x in range(max(0, x0), min(cv.w, x0 + w)):
            cv.put(x, y, col)


def diff_band_ratio(f1: Canvas, f2: Canvas, y0: int = 50, y1: int = 78) -> float:
    """Calcula a razao de pixels alterados dentro da uniao opaca na faixa das pernas."""
    changed = 0
    union = 0
    for y in range(y0, min(FH, y1 + 1)):
        for x in range(FW):
            p1 = f1.get(x, y)
            p2 = f2.get(x, y)
            o1 = p1[3] > 0
            o2 = p2[3] > 0
            if o1 or o2:
                union += 1
                if o1 != o2 or abs(p1[0] - p2[0]) + abs(p1[1] - p2[1]) + abs(p1[2] - p2[2]) > 24:
                    changed += 1
    return (changed / union) if union > 0 else 0.0


def build_grid_preview(
    frames: Sequence[Canvas],
    anchors: Sequence[Dict[str, float]],
    out_path: Path,
    scale: int = 3,
) -> None:
    """Gera previa 3x em grade 6x4 com rotulos, linha de chao (y=76) e crosshair do handAnchor."""
    cols, rows = 6, 4
    header_h = 18
    cell_w = FW * scale
    cell_h = FH * scale + header_h
    pad = 4
    total_w = cols * cell_w + (cols + 1) * pad
    total_h = rows * cell_h + (rows + 1) * pad
    cv = Canvas(total_w, total_h, (24, 28, 38, 255))

    for idx, frame in enumerate(frames):
        r = idx // cols
        c = idx % cols
        ox = pad + c * (cell_w + pad)
        oy = pad + r * (cell_h + pad)

        # Cabecalho com indice e nome do frame
        fill_rect(cv, ox, oy, cell_w, header_h, (18, 22, 32, 255))
        draw_text(cv, ox + 6, oy + 4, f"{idx:02d}:{FRAME_NAMES[idx]}", (220, 232, 248, 255), scale=2)

        # Fundo xadrez neutro
        fy0 = oy + header_h
        chk = 12
        for py in range(FH * scale):
            for px in range(FW * scale):
                is_light = ((px // chk) + (py // chk)) % 2 == 0
                bg = (58, 66, 82, 255) if is_light else (44, 50, 64, 255)
                cv.put(ox + px, fy0 + py, bg)

        # Linha sutil de solo (y=76) e centro (x=40)
        ground_py = fy0 + FOOT_Y * scale
        for px in range(FW * scale):
            if ground_py < cv.h:
                cv.blend_pixel(ox + px, ground_py, (250, 204, 21, 130))
        center_px = ox + CENTER_X * scale
        for py in range(0, FH * scale, 4):
            cv.blend_pixel(center_px, fy0 + py, (148, 163, 184, 70))

        # Frame ampliado NEAREST
        up = frame.scale_nearest(scale)
        cv.composite(up, ox, fy0)

        # Pequeno marcador discreto do handAnchor (ponto magenta/ciano na mao da arma)
        ax = ox + int(round((CENTER_X + anchors[idx]["dx"]) * scale))
        ay = fy0 + int(round((40.0 + anchors[idx]["dy"]) * scale))
        for d in (-3, -2, 2, 3):
            cv.blend_pixel(ax + d, ay, (56, 240, 255, 190))
            cv.blend_pixel(ax, ay + d, (56, 240, 255, 190))

    write_png(out_path, cv)


def build_walk_strip_preview(
    living_frames: Sequence[Canvas],
    wraith_frames: Sequence[Canvas],
    out_path: Path,
    scale: int = 4,
) -> None:
    """Gera tira comparativa 4x exclusiva do ciclo walk (6 frames living + 6 frames wraith)."""
    cols, rows = 6, 2
    header_h = 20
    cell_w = FW * scale
    cell_h = FH * scale + header_h
    pad = 6
    total_w = cols * cell_w + (cols + 1) * pad
    total_h = rows * cell_h + (rows + 1) * pad
    cv = Canvas(total_w, total_h, (20, 24, 34, 255))

    for row_idx, frames in enumerate((living_frames, wraith_frames)):
        for c in range(6):
            f_idx = 4 + c
            ox = pad + c * (cell_w + pad)
            oy = pad + row_idx * (cell_h + pad)
            fill_rect(cv, ox, oy, cell_w, header_h, (16, 20, 30, 255))
            draw_text(cv, ox + 8, oy + 5, f"{f_idx:02d}:{FRAME_NAMES[f_idx]}", (235, 242, 255, 255), scale=2)
            fy0 = oy + header_h
            chk = 16
            for py in range(FH * scale):
                for px in range(FW * scale):
                    bg = (58, 66, 82, 255) if ((px // chk + py // chk) % 2 == 0) else (44, 50, 64, 255)
                    cv.put(ox + px, fy0 + py, bg)
            ground_py = fy0 + FOOT_Y * scale
            for px in range(FW * scale):
                cv.blend_pixel(ox + px, ground_py, (250, 204, 21, 150))
            up = frames[f_idx].scale_nearest(scale)
            cv.composite(up, ox, fy0)

    write_png(out_path, cv)


# ---------------------------------------------------------------------------
# Pipeline Entry Point
# ---------------------------------------------------------------------------

def ensure_base_sprite(name: str) -> Canvas:
    """Garante idempotencia lendo assets/sprites_src/<name>_base.png (extrai frame 0 se ausente)."""
    base_path = SRC_DIR / f"{name}_base.png"
    if not base_path.exists():
        sheet_path = OUT_DIR / f"{name}.png"
        if not sheet_path.exists():
            raise FileNotFoundError(f"Nem {base_path} nem {sheet_path} foram encontrados.")
        sheet = read_png(sheet_path)
        base = sheet.crop(0, 0, FW, FH)
        write_png(base_path, base)
        print(f"Extracted base frame 0 -> {base_path}")
        return base
    return read_png(base_path)


def build_hero_24f(theme: HeroTheme, poses: Sequence[HeroPose]) -> Tuple[List[Canvas], List[Dict[str, float]]]:
    base = ensure_base_sprite(theme.name)
    parts = extract_hero_parts(base, theme)

    sheet = Canvas(FW * len(poses), FH)
    frames: List[Canvas] = []
    anchors: List[Dict[str, float]] = []

    for i, pose in enumerate(poses):
        fr, anchor = render_frame(pose, parts, theme)
        frames.append(fr)
        anchors.append(anchor)
        sheet.composite(fr, i * FW, 0)

    out_path = OUT_DIR / f"{theme.name}.png"
    write_png(out_path, sheet)

    # Metricas objetivas da faixa das pernas (y = 50..78) no ciclo walk (frames 4..9)
    w0_vs_w3 = diff_band_ratio(frames[4], frames[7], 50, 78)
    consec = [diff_band_ratio(frames[4 + i], frames[4 + ((i + 1) % 6)], 50, 78) for i in range(6)]
    avg_consec = sum(consec) / len(consec)
    idle_vs_atk2 = diff_band_ratio(frames[0], frames[12], 50, 78)
    idle_vs_dash2 = diff_band_ratio(frames[0], frames[18], 50, 78)

    print(f"Saved {out_path} ({sheet.w}x{sheet.h}, {len(frames)} frames {FW}x{FH})")
    print(
        f"  [{theme.name}] Leg-band (y=50..78) diff: "
        f"walk0 vs walk3 = {w0_vs_w3 * 100:.1f}% | "
        f"avg consecutive walk = {avg_consec * 100:.1f}% | "
        f"idle0 vs attack2 = {idle_vs_atk2 * 100:.1f}% | "
        f"idle0 vs dash2 = {idle_vs_dash2 * 100:.1f}%"
    )
    return frames, anchors


def update_manifest(
    living_anchors: Sequence[Dict[str, float]],
    wraith_anchors: Sequence[Dict[str, float]],
) -> None:
    data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    for key, anchors in (("hero_living", living_anchors), ("hero_wraith", wraith_anchors)):
        entry = data["sprites"][key]
        entry["width"] = FW * len(FRAME_NAMES)
        entry["height"] = FH
        entry["frameWidth"] = FW
        entry["frameHeight"] = FH
        entry["frames"] = list(FRAME_NAMES)
        entry["handAnchors"] = list(anchors)
    MANIFEST_PATH.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {MANIFEST_PATH} (24 frames + handAnchors for hero_living & hero_wraith)")


def main() -> None:
    SRC_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

    poses = build_poses()

    living_frames, living_anchors = build_hero_24f(LIVING_THEME, poses)
    wraith_frames, wraith_anchors = build_hero_24f(WRAITH_THEME, poses)

    # Preserva public/assets/sprites/weapons.png se weapons_concept.jpg nao existir
    weapons_src = SRC_DIR / "weapons_concept.jpg"
    if not weapons_src.exists():
        print("Preserving existing public/assets/sprites/weapons.png (weapons_concept.jpg absent)")

    living_prev = PREVIEW_DIR / "preview_hero_living_24f.png"
    wraith_prev = PREVIEW_DIR / "preview_hero_wraith_24f.png"
    walk_prev = PREVIEW_DIR / "preview_hero_walk_4x.png"

    build_grid_preview(living_frames, living_anchors, living_prev, scale=3)
    build_grid_preview(wraith_frames, wraith_anchors, wraith_prev, scale=3)
    build_walk_strip_preview(living_frames, wraith_frames, walk_prev, scale=4)
    print(f"Saved previews: {living_prev.name}, {wraith_prev.name}, {walk_prev.name}")

    update_manifest(living_anchors, wraith_anchors)


if __name__ == "__main__":
    main()
