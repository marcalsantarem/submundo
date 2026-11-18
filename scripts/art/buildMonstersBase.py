#!/usr/bin/env python3
"""
Gera os 5 sprites base estaticos (80x80) dos monstros em assets/sprites_src/monsters/
e uma prancha de comparacao ampliada 4x em assets/mockups/preview_monsters_5_base.png
ao lado do Heroi (hero_living_base.png).

100% Python stdlib pura (sem Pillow/NumPy).
"""

from __future__ import annotations

from collections import deque
import math
import struct
import subprocess
import zlib
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = ROOT / "assets" / "sprites_src"
MONSTERS_DIR = SRC_DIR / "monsters"
PREVIEW_PATH = ROOT / "assets" / "mockups" / "preview_monsters_5_base.png"
PREVIEW_M6_PATH = ROOT / "assets" / "mockups" / "preview_m6_resize_and_bosses.png"

FW, FH = 80, 80
FOOT_Y = 76
CENTER_X = 40

Color = Tuple[int, int, int, int]
RGB = Tuple[int, int, int]
Pal4 = Tuple[RGB, RGB, RGB, RGB]

OUTLINE: Color = (9, 9, 13, 255)


# ---------------------------------------------------------------------------
# Pure-Python RGBA Canvas & PNG Codec
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

    def blend_pixel(self, x: int, y: int, col: Color) -> None:
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
        for sy in range(src.h):
            ty = sy + dy
            if not (0 <= ty < self.h):
                continue
            for sx in range(src.w):
                tx = sx + dx
                if not (0 <= tx < self.w):
                    continue
                col = src.get(sx, sy)
                if col[3] > 0:
                    self.blend_pixel(tx, ty, col)


def read_png(path: Path) -> Canvas:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"PNG invalido: {path}")
    pos = 8
    w = h = color_type = 0
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
                raise ValueError(f"PNG nao suportado: {path}")
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
# Color & Pixel-Art Primitives
# ---------------------------------------------------------------------------

def clamp(v: float, lo: float, hi: float) -> float:
    return lo if v < lo else (hi if v > hi else v)


def rgba(rgb: RGB, a: int = 255) -> Color:
    return (rgb[0], rgb[1], rgb[2], a)


def dim_rgb(rgb: RGB, factor: float) -> RGB:
    return (
        int(clamp(rgb[0] * factor, 0, 255)),
        int(clamp(rgb[1] * factor, 0, 255)),
        int(clamp(rgb[2] * factor, 0, 255)),
    )


def dim_palette(pal: Pal4, factor: float) -> Pal4:
    return (
        dim_rgb(pal[0], factor),
        dim_rgb(pal[1], factor),
        dim_rgb(pal[2], factor),
        dim_rgb(pal[3], factor),
    )


def add_outline(layer: Canvas, outline_col: Color = OUTLINE) -> Canvas:
    """Contorno 1px (4-vizinhos) ao redor de pixels opacos."""
    out = layer.copy()
    w, h = layer.w, layer.h
    sb = layer.buf
    for y in range(h):
        for x in range(w):
            if sb[(y * w + x) * 4 + 3] >= 128:
                continue
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < w and 0 <= ny < h and sb[(ny * w + nx) * 4 + 3] >= 128:
                    out.put(x, y, outline_col)
                    break
    return out


def remove_isolated_pixels(layer: Canvas) -> Canvas:
    out = layer.copy()
    w, h = layer.w, layer.h
    sb = layer.buf
    for y in range(h):
        for x in range(w):
            if sb[(y * w + x) * 4 + 3] == 0:
                continue
            cnt = 0
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < w and 0 <= ny < h and sb[(ny * w + nx) * 4 + 3] > 0:
                    cnt += 1
            if cnt == 0:
                out.put(x, y, (0, 0, 0, 0))
    return out


def pick_tone(shade: float, pal: Pal4) -> RGB:
    dark, shadow, mid, hi = pal
    if shade > 0.36:
        return hi
    if shade > -0.06:
        return mid
    if shade > -0.48:
        return shadow
    return dark


def draw_capsule(
    cv: Canvas,
    p0: Tuple[float, float],
    p1: Tuple[float, float],
    r0: float,
    r1: float,
    pal: Pal4,
    light_dir: Tuple[float, float] = (-0.55, -0.83),
) -> None:
    x0, y0 = p0
    x1, y1 = p1
    dx, dy = x1 - x0, y1 - y0
    seg_len_sq = dx * dx + dy * dy
    rmax = max(r0, r1) + 1.5
    min_x = max(0, int(math.floor(min(x0, x1) - rmax)))
    max_x = min(cv.w - 1, int(math.ceil(max(x0, x1) + rmax)))
    min_y = max(0, int(math.floor(min(y0, y1) - rmax)))
    max_y = min(cv.h - 1, int(math.ceil(max(y0, y1) + rmax)))
    lx, ly = light_dir

    for py in range(min_y, max_y + 1):
        for px in range(min_x, max_x + 1):
            vx, vy = px - x0, py - y0
            t = clamp((vx * dx + vy * dy) / seg_len_sq, 0.0, 1.0) if seg_len_sq > 1e-6 else 0.0
            cx, cy = x0 + dx * t, y0 + dy * t
            rx, ry = px - cx, py - cy
            dist = math.hypot(rx, ry)
            r = r0 + (r1 - r0) * t
            if dist <= r:
                nx = rx / max(0.35, r)
                ny = ry / max(0.35, r)
                shade = (nx * lx + ny * ly) + 0.22 * (1.0 - min(1.0, dist / max(0.5, r)))
                cv.put(px, py, rgba(pick_tone(shade, pal)))


def draw_ellipse(
    cv: Canvas,
    cx: float,
    cy: float,
    rx: float,
    ry: float,
    pal: Pal4,
    light_dir: Tuple[float, float] = (-0.55, -0.83),
) -> None:
    min_x = max(0, int(math.floor(cx - rx - 1)))
    max_x = min(cv.w - 1, int(math.ceil(cx + rx + 1)))
    min_y = max(0, int(math.floor(cy - ry - 1)))
    max_y = min(cv.h - 1, int(math.ceil(cy + ry + 1)))
    lx, ly = light_dir
    for py in range(min_y, max_y + 1):
        for px in range(min_x, max_x + 1):
            nx = (px - cx) / max(0.5, rx)
            ny = (py - cy) / max(0.5, ry)
            d = math.hypot(nx, ny)
            if d <= 1.0:
                shade = (nx * lx + ny * ly) + 0.24 * (1.0 - d)
                cv.put(px, py, rgba(pick_tone(shade, pal)))


def draw_polygon_shaded(
    cv: Canvas,
    pts: Sequence[Tuple[float, float]],
    pal: Pal4,
    light_dir: Tuple[float, float] = (-0.55, -0.83),
) -> None:
    if len(pts) < 3:
        return
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    min_x = max(0, int(math.floor(min(xs))))
    max_x = min(cv.w - 1, int(math.ceil(max(xs))))
    min_y = max(0, int(math.floor(min(ys))))
    max_y = min(cv.h - 1, int(math.ceil(max(ys))))
    cx = sum(xs) / len(xs)
    cy = sum(ys) / len(ys)
    span_x = max(1.0, (max(xs) - min(xs)) * 0.5)
    span_y = max(1.0, (max(ys) - min(ys)) * 0.5)
    lx, ly = light_dir
    n = len(pts)

    for py in range(min_y, max_y + 1):
        for px in range(min_x, max_x + 1):
            inside = False
            j = n - 1
            for i in range(n):
                xi, yi = pts[i]
                xj, yj = pts[j]
                if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / ((yj - yi) + 1e-9) + xi):
                    inside = not inside
                j = i
            if inside:
                nx = (px - cx) / span_x
                ny = (py - cy) / span_y
                shade = (nx * lx + ny * ly) * 0.85 + 0.12
                cv.put(px, py, rgba(pick_tone(shade, pal)))


def draw_line(cv: Canvas, p0: Tuple[int, int], p1: Tuple[int, int], col: Color) -> None:
    x0, y0 = p0
    x1, y1 = p1
    dx = abs(x1 - x0)
    dy = abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx - dy
    while True:
        cv.put(x0, y0, col)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy
            x0 += sx
        if e2 < dx:
            err += dx
            y0 += sy


def compose_outlined(layers: Sequence[Canvas], outline_col: Color = OUTLINE) -> Canvas:
    """Compõe camadas já com contorno ou aplica contorno final limpo."""
    merged = Canvas(FW, FH)
    for lay in layers:
        merged.composite(lay)
    return remove_isolated_pixels(add_outline(merged, outline_col))


# ---------------------------------------------------------------------------
# 1. SLIME (gosma verde gelatinosa brilhante, estilo mockup_pixel_art.jpg)
# ---------------------------------------------------------------------------

def build_slime_base() -> Canvas:
    body = Canvas(FW, FH)
    pal_slime: Pal4 = (
        (16, 94, 30),    # dark base
        (32, 146, 44),   # shadow
        (64, 206, 66),   # mid vibrant green
        (126, 240, 92),  # hi top
    )
    cx, base_y = 40, FOOT_Y
    top_y = 60

    # Domo gelatinoso compacto (~22x17 px, 50% do tamanho anterior)
    for py in range(top_y, base_y + 1):
        t_y = (py - top_y) / float(base_y - top_y)
        profile = math.sin(clamp(t_y, 0.0, 1.0) * math.pi * 0.56 + 0.14)
        half_w = 11.0 * (profile ** 0.72)
        if t_y > 0.85:
            half_w *= 1.0 - 0.10 * ((t_y - 0.85) / 0.15) ** 2
        for px in range(int(cx - half_w - 1), int(cx + half_w + 2)):
            dx = px - cx
            wave_y = base_y - (1.0 if abs(dx) > half_w * 0.78 else 0.0)
            if abs(dx) <= half_w and py <= wave_y:
                nx = dx / max(1.0, half_w)
                ny = (t_y - 0.38) * 1.35
                shade = (-0.48 * nx - 0.82 * ny) + 0.22 * (1.0 - abs(nx))
                if py >= wave_y - 1.0:
                    col = pal_slime[0]
                elif py >= wave_y - 3.0 and shade < 0.05:
                    col = pal_slime[1]
                else:
                    col = pick_tone(shade, pal_slime)
                body.put(px, py, rgba(col))

    # Gotinha lateral esquerda na base
    draw_ellipse(body, 28.0, 74.5, 1.5, 1.1, pal_slime)

    # Reflexos especulares suaves no topo-esquerdo
    spec_hi = (210, 255, 195, 255)
    spec_bright = (255, 255, 255, 255)
    for sx, sy in ((34, 63), (35, 62), (36, 62), (37, 62), (33, 64), (33, 65), (44, 63)):
        body.put(sx, sy, spec_hi)
    for sx, sy in ((35, 63), (36, 63)):
        body.put(sx, sy, spec_bright)

    # Olhos e boca expressivos, nitidos na escala menor
    eye_dark = (10, 22, 12, 255)
    for ex, ey in ((38, 68), (44, 68)):
        body.put(ex, ey, spec_bright)
        body.put(ex + 1, ey, eye_dark)
        body.put(ex, ey + 1, eye_dark)
        body.put(ex + 1, ey + 1, eye_dark)

    # Boca curvada para baixo
    for mx, my in ((39, 72), (40, 71), (41, 71), (42, 71), (43, 72)):
        body.put(mx, my, eye_dark)

    return remove_isolated_pixels(add_outline(body, OUTLINE))


# ---------------------------------------------------------------------------
# 2. CAVE BAT (morcego roxo escuro, asas membranosas, olhos brilhantes)
# ---------------------------------------------------------------------------

def build_cave_bat_base() -> Canvas:
    pal_fur: Pal4 = (
        (30, 22, 48),
        (52, 38, 80),
        (82, 62, 118),
        (120, 96, 160),
    )
    pal_wing_bone: Pal4 = (
        (44, 30, 62),
        (72, 52, 98),
        (106, 80, 138),
        (144, 116, 176),
    )
    pal_membrane: Pal4 = (
        (34, 16, 44),
        (56, 26, 70),
        (84, 42, 100),
        (114, 60, 132),
    )
    pal_ear_in: Pal4 = (
        (92, 48, 88),
        (134, 72, 124),
        (178, 102, 158),
        (210, 140, 190),
    )

    wings = Canvas(FW, FH)
    # Asa esquerda (~30x20 px total do morcego, centralizado no ar em y~44)
    left_wing_pts = [
        (37, 44), (32, 38), (25, 36), (25, 41),
        (27, 47), (30, 45), (33, 49), (36, 46),
    ]
    draw_polygon_shaded(wings, left_wing_pts, pal_membrane)
    # Asa direita
    right_wing_pts = [
        (43, 44), (48, 38), (55, 36), (55, 41),
        (53, 47), (50, 45), (47, 49), (44, 46),
    ]
    draw_polygon_shaded(wings, right_wing_pts, dim_palette(pal_membrane, 0.85))

    # Ossos finos das asas
    draw_capsule(wings, (37, 44), (32, 38), 1.0, 0.8, pal_wing_bone)
    draw_capsule(wings, (32, 38), (25, 36), 0.9, 0.6, pal_wing_bone)
    draw_line(wings, (32, 38), (27, 46), rgba(pal_wing_bone[2]))
    draw_line(wings, (32, 38), (33, 48), rgba(pal_wing_bone[1]))

    bone_r = dim_palette(pal_wing_bone, 0.88)
    draw_capsule(wings, (43, 44), (48, 38), 1.0, 0.8, bone_r)
    draw_capsule(wings, (48, 38), (55, 36), 0.9, 0.6, bone_r)
    draw_line(wings, (48, 38), (53, 46), rgba(bone_r[2]))
    draw_line(wings, (48, 38), (47, 48), rgba(bone_r[1]))

    # Garrinhas no topo das asas
    claw_col = (218, 212, 198, 255)
    wings.put(32, 37, claw_col)
    wings.put(48, 37, claw_col)

    wings_out = add_outline(wings, OUTLINE)

    body = Canvas(FW, FH)
    # Pes/garras inferiores
    draw_line(body, (38, 50), (37, 53), rgba(pal_wing_bone[2]))
    draw_line(body, (42, 50), (43, 53), rgba(pal_wing_bone[2]))

    # Tronco peludo
    draw_ellipse(body, 40.0, 46.5, 4.0, 4.3, pal_fur)

    # Orelhas pontudas
    draw_polygon_shaded(body, [(36, 40), (34, 33), (39, 37)], pal_fur)
    draw_polygon_shaded(body, [(41, 37), (46, 33), (44, 40)], pal_fur)
    body.put(36, 37, rgba(pal_ear_in[2]))
    body.put(44, 37, rgba(pal_ear_in[2]))

    # Cabeca
    draw_ellipse(body, 40.0, 40.5, 4.0, 3.2, pal_fur)

    # Olhos vermelhos/ambar nitidos (2x1 cada)
    body.put(37, 40, (220, 30, 30, 255))
    body.put(38, 40, (255, 200, 70, 255))
    body.put(42, 40, (255, 200, 70, 255))
    body.put(43, 40, (220, 30, 30, 255))

    # Focinho e presinhas
    body.put(40, 42, (28, 18, 40, 255))
    body.put(39, 43, (245, 242, 236, 255))
    body.put(41, 43, (245, 242, 236, 255))

    body_out = add_outline(body, OUTLINE)

    res = Canvas(FW, FH)
    res.composite(wings_out)
    res.composite(body_out)
    return remove_isolated_pixels(res)


# ---------------------------------------------------------------------------
# 3. WOLF (lobo cinzento de dungeon, quadrúpede pronto para investir)
# ---------------------------------------------------------------------------

def build_wolf_base() -> Canvas:
    pal_fur: Pal4 = (
        (42, 46, 56),
        (72, 78, 92),
        (114, 122, 138),
        (164, 174, 192),
    )
    pal_fur_back = dim_palette(pal_fur, 0.72)
    pal_light: Pal4 = (
        (96, 102, 114),
        (136, 144, 158),
        (178, 186, 200),
        (216, 222, 234),
    )

    back = Canvas(FW, FH)
    # Cauda felpuda erguida
    draw_capsule(back, (22, 49), (14, 41), 3.8, 3.0, pal_fur)
    draw_capsule(back, (14, 41), (10, 34), 3.0, 1.5, pal_light)
    # Pata traseira direita (fundo)
    draw_capsule(back, (28, 56), (25, 65), 3.4, 2.2, pal_fur_back)
    draw_capsule(back, (25, 65), (27, 74), 2.1, 1.8, pal_fur_back)
    draw_ellipse(back, 28.0, 74.5, 2.8, 1.6, pal_fur_back)
    # Pata dianteira direita (fundo)
    draw_capsule(back, (51, 55), (54, 65), 3.0, 2.0, pal_fur_back)
    draw_capsule(back, (54, 65), (56, 74), 1.9, 1.6, pal_fur_back)
    draw_ellipse(back, 57.0, 74.5, 2.6, 1.6, pal_fur_back)
    back_out = add_outline(back, OUTLINE)

    front = Canvas(FW, FH)
    # Torso musculoso
    draw_capsule(front, (25, 52), (47, 48), 7.2, 8.5, pal_fur)
    # Peito e juba volumosa
    draw_ellipse(front, 48.0, 49.0, 6.8, 7.2, pal_light)
    draw_polygon_shaded(front, [(37, 43), (44, 33), (53, 39), (46, 48)], pal_fur)
    draw_polygon_shaded(front, [(42, 43), (48, 36), (55, 42), (48, 49)], pal_light)

    # Pata traseira esquerda (frontal)
    draw_capsule(front, (23, 54), (19, 64), 4.0, 2.5, pal_fur)
    draw_capsule(front, (19, 64), (21, 74), 2.3, 1.9, pal_fur)
    draw_ellipse(front, 22.5, 74.5, 3.0, 1.7, pal_light)

    # Pata dianteira esquerda (frontal)
    draw_capsule(front, (46, 54), (48, 65), 3.4, 2.2, pal_fur)
    draw_capsule(front, (48, 65), (50, 74), 2.1, 1.8, pal_fur)
    draw_ellipse(front, 51.5, 74.5, 2.8, 1.7, pal_light)

    # Cabeca erguida em 3/4 para a direita
    draw_ellipse(front, 53.5, 38.0, 7.0, 6.0, pal_fur)
    # Orelhas pontudas
    draw_polygon_shaded(front, [(47, 34), (45, 24), (51, 31)], pal_fur)
    draw_polygon_shaded(front, [(53, 32), (55, 23), (58, 32)], pal_fur)
    front.put(47, 28, (145, 110, 120, 255))
    front.put(55, 27, (145, 110, 120, 255))

    # Focinho superior + mandibula inferior rosnando
    draw_capsule(front, (56, 38), (66, 39), 3.4, 2.1, pal_light)
    draw_capsule(front, (56, 42), (64, 43), 2.0, 1.4, pal_light)
    # Nariz preto
    front.put(67, 38, (16, 16, 22, 255))
    front.put(67, 39, (16, 16, 22, 255))
    front.put(66, 38, (28, 28, 36, 255))
    # Boca com presas
    for mx in range(59, 65):
        front.put(mx, 41, (120, 28, 36, 255))
    front.put(61, 40, (245, 244, 236, 255))
    front.put(64, 40, (245, 244, 236, 255))

    # Olho ambar feroz 2x2
    front.put(55, 35, (235, 145, 25, 255))
    front.put(56, 35, (255, 220, 80, 255))
    front.put(55, 36, (250, 185, 40, 255))
    front.put(56, 36, (255, 245, 160, 255))

    front_out = add_outline(front, OUTLINE)

    res = Canvas(FW, FH)
    res.composite(back_out)
    res.composite(front_out)
    return remove_isolated_pixels(res)


# ---------------------------------------------------------------------------
# 4. SKELETON (guerreiro esqueleto com espada e escudo, escala do Heroi)
# ---------------------------------------------------------------------------

def build_skeleton_base() -> Canvas:
    pal_bone: Pal4 = (
        (94, 84, 68),
        (148, 136, 110),
        (202, 190, 158),
        (238, 230, 206),
    )
    pal_bone_back = dim_palette(pal_bone, 0.74)
    pal_cloth: Pal4 = (
        (28, 24, 34),
        (48, 42, 58),
        (72, 64, 86),
        (98, 88, 114),
    )
    pal_wood: Pal4 = (
        (56, 34, 20),
        (92, 56, 32),
        (130, 82, 46),
        (166, 112, 66),
    )
    pal_steel: Pal4 = (
        (58, 66, 78),
        (96, 108, 124),
        (148, 162, 180),
        (212, 224, 238),
    )

    # Camada 1: braco direito (fundo) com espada + perna direita (fundo)
    back = Canvas(FW, FH)
    draw_capsule(back, (44, 51), (47, 63), 2.1, 1.7, pal_bone_back)
    draw_capsule(back, (47, 63), (48, 74), 1.8, 1.5, pal_bone_back)
    draw_ellipse(back, 50.5, 74.5, 3.2, 1.5, pal_bone_back)

    # Braco direito segurando espada imponente
    draw_capsule(back, (47, 34), (54, 42), 1.8, 1.5, pal_bone_back)
    draw_capsule(back, (54, 42), (59, 40), 1.6, 1.5, pal_bone_back)
    draw_polygon_shaded(back, [(59, 40), (73, 23), (75, 25), (61, 42)], pal_steel)
    draw_capsule(back, (57, 37), (62, 43), 1.3, 1.3, pal_wood)
    draw_capsule(back, (55, 44), (59, 40), 1.2, 1.2, pal_wood)
    back_out = add_outline(back, OUTLINE)

    # Camada 2: tronco, pelvis, perna esquerda, cranio (topo em y~13, escala Heroi)
    body = Canvas(FW, FH)
    draw_capsule(body, (35, 51), (31, 63), 2.2, 1.8, pal_bone)
    draw_capsule(body, (31, 63), (29, 74), 1.9, 1.5, pal_bone)
    draw_ellipse(body, 31.0, 74.5, 3.2, 1.5, pal_bone)

    # Pelvis + tanga rasgada assimetrica
    draw_ellipse(body, 40.0, 50.0, 6.2, 2.8, pal_bone)
    draw_polygon_shaded(body, [(33, 49), (47, 49), (48, 57), (43, 55), (38, 58), (32, 56)], pal_cloth)

    # Coluna e costelas
    draw_capsule(body, (40, 32), (40, 49), 2.2, 2.0, pal_bone_back)
    for ry in (34, 38, 42):
        draw_capsule(body, (33, ry), (46, ry), 1.5, 1.5, pal_bone)
        body.put(40, ry + 1, (38, 32, 30, 255))
        body.put(41, ry + 1, (38, 32, 30, 255))

    # Ombreira de ferro enferrujado
    draw_ellipse(body, 47.0, 33.0, 3.8, 3.2, pal_steel)

    # Cranio classico bem arredondado (sem elmo reto)
    draw_ellipse(body, 41.0, 20.5, 6.8, 6.6, pal_bone)
    draw_ellipse(body, 42.0, 27.0, 4.3, 2.7, pal_bone)
    # Orbitas profundas + brilho vermelho
    for ex, ey in ((39, 20), (45, 20)):
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                body.put(ex + dx, ey + dy, (18, 14, 18, 255))
        body.put(ex, ey, (240, 75, 42, 255))
    body.put(43, 23, (28, 22, 22, 255))
    for dx in (39, 41, 43, 45):
        body.put(dx, 27, (74, 64, 52, 255))
        body.put(dx, 28, (236, 228, 202, 255))
    body_out = add_outline(body, OUTLINE)

    # Camada 3: braco esquerdo frontal + Escudo em perspectiva 3/4
    shield = Canvas(FW, FH)
    draw_capsule(shield, (33, 34), (29, 42), 1.9, 1.6, pal_bone)
    draw_ellipse(shield, 27.5, 44.0, 5.8, 8.8, pal_steel)
    draw_ellipse(shield, 27.5, 44.0, 4.2, 6.8, pal_wood)
    draw_ellipse(shield, 28.0, 44.0, 2.0, 2.5, pal_steel)
    shield_out = add_outline(shield, OUTLINE)

    res = Canvas(FW, FH)
    res.composite(back_out)
    res.composite(body_out)
    res.composite(shield_out)
    return remove_isolated_pixels(res)


# ---------------------------------------------------------------------------
# 5. SKELETON ARCHER (capuz, aljava, arco de madeira e flecha)
# ---------------------------------------------------------------------------

def build_skeleton_archer_base() -> Canvas:
    pal_bone: Pal4 = (
        (94, 84, 68),
        (148, 136, 110),
        (202, 190, 158),
        (238, 230, 206),
    )
    pal_bone_back = dim_palette(pal_bone, 0.74)
    pal_hood: Pal4 = (
        (26, 36, 30),
        (42, 58, 48),
        (64, 86, 70),
        (94, 120, 98),
    )
    pal_leather: Pal4 = (
        (54, 34, 22),
        (88, 54, 32),
        (124, 78, 46),
        (158, 104, 62),
    )
    pal_bow: Pal4 = (
        (62, 36, 18),
        (104, 62, 30),
        (144, 90, 46),
        (182, 122, 68),
    )

    back = Canvas(FW, FH)
    # Aljava inclinada atras do ombro esquerdo
    draw_capsule(back, (29, 25), (35, 42), 3.0, 2.4, pal_leather)
    for fx, fy in ((27, 21), (29, 20), (31, 21)):
        back.put(fx, fy, (210, 68, 56, 255))
        back.put(fx, fy + 1, (235, 225, 195, 255))

    # Perna direita (fundo)
    draw_capsule(back, (43, 51), (46, 63), 2.1, 1.7, pal_bone_back)
    draw_capsule(back, (46, 63), (47, 74), 2.2, 1.8, pal_leather)
    draw_ellipse(back, 49.5, 74.5, 3.1, 1.5, pal_leather)

    # Braco direito estendido segurando o arco
    draw_capsule(back, (46, 35), (57, 39), 1.8, 1.5, pal_bone_back)
    back_out = add_outline(back, OUTLINE)

    body = Canvas(FW, FH)
    # Perna esquerda (frontal) com bota
    draw_capsule(body, (35, 51), (32, 63), 2.2, 1.8, pal_bone)
    draw_capsule(body, (32, 63), (30, 74), 2.3, 1.9, pal_leather)
    draw_ellipse(body, 32.0, 74.5, 3.2, 1.5, pal_leather)

    # Tunica esfarrapada + costelas visiveis
    draw_polygon_shaded(body, [(33, 33), (46, 33), (49, 55), (42, 53), (36, 56), (31, 54)], pal_hood)
    for ry in (36, 39, 42):
        draw_capsule(body, (37, ry), (44, ry), 1.2, 1.2, pal_bone)
    draw_capsule(body, (33, 48), (47, 48), 1.6, 1.6, pal_leather)

    # Cranio + Capuz com ponta caida natural
    draw_ellipse(body, 40.5, 21.5, 6.4, 6.0, pal_bone)
    draw_ellipse(body, 41.5, 27.0, 4.0, 2.4, pal_bone)
    draw_polygon_shaded(
        body,
        [(28, 31), (30, 18), (37, 11), (47, 14), (48, 20), (40, 18), (35, 22), (34, 33)],
        pal_hood,
    )
    for ex, ey in ((39, 21), (44, 21)):
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                body.put(ex + dx, ey + dy, (14, 18, 14, 255))
        body.put(ex, ey, (125, 245, 95, 255))
    body.put(42, 24, (24, 20, 20, 255))
    for dx in (39, 41, 43):
        body.put(dx, 27, (236, 228, 202, 255))
    body_out = add_outline(body, OUTLINE)

    # Arco curvo + braco esquerdo saindo do ombro esquerdo puxando a flecha
    bow = Canvas(FW, FH)
    draw_capsule(bow, (55, 23), (61, 31), 1.5, 1.6, pal_bow)
    draw_capsule(bow, (61, 31), (62, 39), 1.7, 1.7, pal_bow)
    draw_capsule(bow, (62, 39), (61, 47), 1.7, 1.6, pal_bow)
    draw_capsule(bow, (61, 47), (55, 54), 1.6, 1.5, pal_bow)

    draw_line(bow, (54, 24), (47, 39), (205, 200, 185, 255))
    draw_line(bow, (47, 39), (54, 53), (205, 200, 185, 255))
    draw_line(bow, (47, 39), (68, 39), (195, 160, 110, 255))
    bow.put(68, 38, (190, 205, 220, 255))
    bow.put(69, 39, (230, 240, 250, 255))
    bow.put(68, 40, (190, 205, 220, 255))
    bow.put(46, 38, (210, 68, 56, 255))
    bow.put(46, 40, (210, 68, 56, 255))

    # Braco esquerdo articulado do ombro (32, 34) -> cotovelo (39, 41) -> mao na corda (47, 39)
    draw_capsule(bow, (32, 34), (39, 41), 1.8, 1.5, pal_bone)
    draw_capsule(bow, (39, 41), (47, 39), 1.6, 1.4, pal_bone)
    bow_out = add_outline(bow, OUTLINE)

    res = Canvas(FW, FH)
    res.composite(back_out)
    res.composite(body_out)
    res.composite(bow_out)
    return remove_isolated_pixels(res)


# ---------------------------------------------------------------------------
# 6. WOLF ALPHA (Chefe da Matilha - maior que Wolf, pelagem marrom/vermelha)
# ---------------------------------------------------------------------------

def build_wolf_alpha_base() -> Canvas:
    pal_fur: Pal4 = (
        (48, 18, 16),
        (86, 30, 24),
        (132, 50, 34),
        (176, 80, 50),
    )
    pal_fur_back = dim_palette(pal_fur, 0.70)
    pal_mane: Pal4 = (
        (72, 24, 20),
        (120, 44, 30),
        (168, 72, 46),
        (212, 114, 72),
    )
    pal_claw: Pal4 = (
        (90, 82, 78),
        (135, 126, 120),
        (185, 176, 168),
        (226, 218, 210),
    )

    back = Canvas(FW, FH)
    # Cauda felpuda grande erguida
    draw_capsule(back, (18, 45), (10, 33), 4.6, 3.6, pal_fur)
    draw_capsule(back, (10, 33), (6, 21), 3.6, 1.8, pal_mane)
    # Pata traseira direita (fundo)
    draw_capsule(back, (25, 51), (21, 63), 4.0, 2.6, pal_fur_back)
    draw_capsule(back, (21, 63), (23, 74), 2.5, 2.0, pal_fur_back)
    draw_ellipse(back, 24.5, 74.5, 3.2, 1.8, pal_fur_back)
    # Pata dianteira direita (fundo)
    draw_capsule(back, (52, 50), (55, 62), 3.6, 2.4, pal_fur_back)
    draw_capsule(back, (55, 62), (57, 74), 2.3, 1.9, pal_fur_back)
    draw_ellipse(back, 58.5, 74.5, 3.0, 1.8, pal_fur_back)
    back_out = add_outline(back, OUTLINE)

    front = Canvas(FW, FH)
    # Torso robusto
    draw_capsule(front, (21, 46), (48, 42), 8.6, 10.2, pal_fur)
    # Juba e peito imponentes (mechas eriçadas no pescoco e ombros)
    draw_ellipse(front, 49.0, 43.0, 8.2, 8.6, pal_mane)
    draw_polygon_shaded(front, [(32, 39), (38, 28), (47, 34), (40, 43)], pal_fur)
    draw_polygon_shaded(front, [(37, 37), (43, 24), (54, 31), (47, 42)], pal_fur)
    draw_polygon_shaded(front, [(41, 38), (48, 26), (57, 34), (49, 44)], pal_mane)
    draw_polygon_shaded(front, [(44, 46), (53, 52), (57, 42)], pal_mane)

    # Pata traseira esquerda (frontal)
    draw_capsule(front, (19, 49), (15, 62), 4.5, 2.8, pal_fur)
    draw_capsule(front, (15, 62), (17, 74), 2.7, 2.2, pal_fur)
    draw_ellipse(front, 18.5, 74.5, 3.4, 1.9, pal_mane)
    draw_ellipse(front, 21.0, 75.0, 1.2, 0.9, pal_claw)

    # Pata dianteira esquerda (frontal)
    draw_capsule(front, (46, 49), (48, 62), 4.0, 2.6, pal_fur)
    draw_capsule(front, (48, 62), (50, 74), 2.5, 2.0, pal_fur)
    draw_ellipse(front, 51.5, 74.5, 3.2, 1.9, pal_mane)
    draw_ellipse(front, 54.0, 75.0, 1.2, 0.9, pal_claw)

    # Cabeca grande 3/4 para a direita
    draw_ellipse(front, 56.5, 29.0, 8.2, 7.0, pal_fur)
    # Orelhas pontudas grandes
    draw_polygon_shaded(front, [(49, 25), (46, 14), (54, 21)], pal_fur)
    draw_polygon_shaded(front, [(56, 23), (58, 13), (62, 23)], pal_fur)
    front.put(49, 19, (180, 96, 86, 255))
    front.put(58, 18, (180, 96, 86, 255))

    # Focinho poderoso + mandibula rosnando
    draw_capsule(front, (59, 29), (72, 30), 4.0, 2.4, pal_mane)
    draw_capsule(front, (59, 34), (70, 35), 2.3, 1.6, pal_mane)
    # Nariz preto
    for nx, ny in ((73, 29), (73, 30), (72, 29)):
        front.put(nx, ny, (16, 12, 14, 255))
    # Boca com presas maiores
    for mx in range(62, 71):
        front.put(mx, 32, (130, 22, 28, 255))
        front.put(mx, 33, (95, 16, 22, 255))
    for fx in (64, 67, 70):
        front.put(fx, 31, (248, 244, 236, 255))
        front.put(fx, 32, (248, 244, 236, 255))

    # Olho vermelho/ambar feroz 2x2
    front.put(58, 26, (220, 36, 24, 255))
    front.put(59, 26, (255, 190, 50, 255))
    front.put(58, 27, (255, 95, 30, 255))
    front.put(59, 27, (255, 240, 140, 255))

    # Cicatriz de batalha na bochecha/focinho
    scar_col = (232, 168, 152, 255)
    front.put(56, 23, scar_col)
    front.put(57, 24, scar_col)
    front.put(61, 29, scar_col)
    front.put(62, 30, scar_col)

    front_out = add_outline(front, OUTLINE)

    res = Canvas(FW, FH)
    res.composite(back_out)
    res.composite(front_out)
    return remove_isolated_pixels(res)


# ---------------------------------------------------------------------------
# 7. KARNAK (Demonio escuro/vermelho com machado grande, maior que o Heroi)
# ---------------------------------------------------------------------------

def _ensure_karnak_ref_png() -> Path:
    ref_png = MONSTERS_DIR / "karnak_ref.png"
    if ref_png.exists():
        return ref_png
    ref_jpg = MONSTERS_DIR / "karnak_ref.jpg"
    if not ref_jpg.exists():
        raise FileNotFoundError(f"Referencia nao encontrada: {ref_jpg}")
    ps = (
        "Add-Type -AssemblyName System.Drawing; "
        f"$img = [System.Drawing.Image]::FromFile('{ref_jpg}'); "
        f"$img.Save('{ref_png}', [System.Drawing.Imaging.ImageFormat]::Png); "
        "$img.Dispose()"
    )
    subprocess.run(["powershell", "-NoProfile", "-Command", ps], check=True)
    return ref_png


def build_karnak_base() -> Canvas:
    ref = read_png(_ensure_karnak_ref_png())
    w, h = ref.w, ref.h
    bg_r, bg_g, bg_b, _ = ref.get(0, 0)

    # 1. Flood-fill do fundo cinza a partir das bordas (incluindo sombra do chao)
    bg_mask = bytearray(w * h)
    q: deque[Tuple[int, int]] = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))

    def is_bg_pixel(x: int, y: int) -> bool:
        r, g, b, _ = ref.get(x, y)
        chroma = max(r, g, b) - min(r, g, b)
        if abs(r - bg_r) <= 22 and abs(g - bg_g) <= 22 and abs(b - bg_b) <= 22 and chroma <= 18:
            return True
        if y >= 880 and r <= 65 and g <= 68 and b <= 72 and chroma <= 16:
            if not (r <= 14 and g <= 14 and b <= 16):
                return True
        return False

    while q:
        x, y = q.popleft()
        idx = y * w + x
        if bg_mask[idx] or not is_bg_pixel(x, y):
            continue
        bg_mask[idx] = 1
        if x > 0:
            q.append((x - 1, y))
        if x < w - 1:
            q.append((x + 1, y))
        if y > 0:
            q.append((x, y - 1))
        if y < h - 1:
            q.append((x, y + 1))

    # 2. Remove pequenos bolsoes internos fechados com a cor exata do fundo cinza
    for y in range(h):
        for x in range(w):
            idx = y * w + x
            if bg_mask[idx]:
                continue
            r, g, b, _ = ref.get(x, y)
            if 40 <= r <= 52 and 44 <= g <= 56 and 48 <= b <= 62 and (max(r, g, b) - min(r, g, b)) <= 12:
                bg_mask[idx] = 1

    # 3. Bounding box do foreground
    xs = [x for y in range(h) for x in range(w) if not bg_mask[y * w + x]]
    ys = [y for y in range(h) for x in range(w) if not bg_mask[y * w + x]]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    fg_w = max_x - min_x + 1
    fg_h = max_y - min_y + 1

    # 4. Downscale crisp para 96x96 (altura ~84px > Heroi 68px, cascos em y=91, chao em y=92)
    out_w, out_h = 96, 96
    target_h = 84
    target_w = max(1, round(fg_w * (target_h / fg_h)))
    dx0 = (out_w - target_w) // 2
    dy0 = 92 - target_h

    raw_cv = Canvas(out_w, out_h)
    for ty in range(target_h):
        sy0 = min_y + int(ty * fg_h / target_h)
        sy1 = min(max_y + 1, min_y + max(sy0 - min_y + 1, int((ty + 1) * fg_h / target_h)))
        for tx in range(target_w):
            sx0 = min_x + int(tx * fg_w / target_w)
            sx1 = min(max_x + 1, min_x + max(sx0 - min_x + 1, int((tx + 1) * fg_w / target_w)))

            fg_cols: List[Tuple[int, int, int, int]] = []
            total = 0
            for sy in range(sy0, sy1):
                for sx in range(sx0, sx1):
                    total += 1
                    if not bg_mask[sy * w + sx]:
                        r, g, b, _ = ref.get(sx, sy)
                        fg_cols.append((r + g + b, r, g, b))

            if not fg_cols or len(fg_cols) < total * 0.36:
                continue

            non_halo = [
                c for c in fg_cols
                if not (34 <= c[1] <= 58 and 38 <= c[2] <= 62 and 42 <= c[3] <= 66 and (max(c[1], c[2], c[3]) - min(c[1], c[2], c[3])) <= 14)
            ]
            pool = non_halo if non_halo else fg_cols
            pool.sort(key=lambda c: c[0])

            darks = [c for c in pool if c[0] < 54]
            if len(darks) >= len(pool) * 0.55:
                chosen = darks[len(darks) // 2]
                col = OUTLINE if chosen[0] < 42 else (chosen[1], chosen[2], chosen[3], 255)
            else:
                chosen = pool[len(pool) // 2]
                col = (chosen[1], chosen[2], chosen[3], 255)

            raw_cv.put(dx0 + tx, dy0 + ty, col)

    cleaned = remove_isolated_pixels(raw_cv)

    # 5. Limpa halo residual nas bordas externas e garante contorno 1px escuro
    final_cv = cleaned.copy()
    for y in range(out_h):
        for x in range(out_w):
            c = cleaned.get(x, y)
            if c[3] == 0:
                continue
            is_edge = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if not (0 <= nx < out_w and 0 <= ny < out_h) or cleaned.get(nx, ny)[3] == 0:
                    is_edge = True
                    break
            if is_edge and (c[0] + c[1] + c[2]) <= 120:
                final_cv.put(x, y, OUTLINE)

    return final_cv


# ---------------------------------------------------------------------------
# Prancha de Comparação 3x (Heroi + 5 Monstros)
# ---------------------------------------------------------------------------

FONT_3X5: Dict[str, Tuple[str, ...]] = {
    "5": ("111", "100", "111", "001", "111"),
    "A": ("010", "101", "111", "101", "101"),
    "B": ("110", "101", "110", "101", "110"),
    "C": ("011", "100", "100", "100", "011"),
    "D": ("110", "101", "101", "101", "110"),
    "E": ("111", "100", "110", "100", "111"),
    "F": ("111", "100", "110", "100", "100"),
    "G": ("011", "100", "101", "101", "011"),
    "H": ("101", "101", "111", "101", "101"),
    "I": ("111", "010", "010", "010", "111"),
    "K": ("101", "101", "110", "101", "101"),
    "L": ("100", "100", "100", "100", "111"),
    "M": ("101", "111", "101", "101", "101"),
    "N": ("101", "111", "111", "101", "101"),
    "O": ("010", "101", "101", "101", "010"),
    "P": ("110", "101", "110", "100", "100"),
    "R": ("110", "101", "110", "101", "101"),
    "S": ("011", "100", "010", "001", "110"),
    "T": ("111", "010", "010", "010", "010"),
    "U": ("101", "101", "101", "101", "111"),
    "V": ("101", "101", "101", "101", "010"),
    "W": ("101", "101", "101", "111", "101"),
    "X": ("101", "101", "010", "101", "101"),
    "Y": ("101", "101", "010", "010", "010"),
    "Z": ("111", "001", "010", "100", "111"),
    "_": ("000", "000", "000", "000", "111"),
    " ": ("000", "000", "000", "000", "000"),
}


def draw_text(cv: Canvas, x: int, y: int, text: str, col: Color, scale: int = 2) -> None:
    cx = x
    for ch in text.upper():
        glyph = FONT_3X5.get(ch, FONT_3X5[" "])
        for ry, row in enumerate(glyph):
            for rx, bit in enumerate(row):
                if bit == "1":
                    for sy in range(scale):
                        for sx in range(scale):
                            cv.put(cx + rx * scale + sx, y + ry * scale + sy, col)
        cx += 4 * scale


def build_comparison_sheet(
    entries: Sequence[Tuple[str, Canvas]],
    scale: int = 3,
    title: str = "HEROI VS 5 MONSTROS BASE",
) -> Canvas:
    cols = 3
    rows = max(1, (len(entries) + cols - 1) // cols)
    box_dim_w = max(spr.w for _, spr in entries)
    box_dim_h = max(spr.h for _, spr in entries)
    cell_w = box_dim_w * scale + 28
    cell_h = box_dim_h * scale + 42
    pad = 16
    total_w = cols * cell_w + (cols + 1) * pad
    total_h = rows * cell_h + (rows + 1) * pad + 24

    sheet = Canvas(total_w, total_h, (24, 26, 34, 255))
    draw_text(sheet, pad, 8, title, (235, 225, 195, 255), scale=2)

    guide_foot_y = box_dim_h - 4
    for idx, (label, spr) in enumerate(entries):
        c = idx % cols
        r = idx // cols
        x0 = pad + c * (cell_w + pad)
        y0 = 28 + pad + r * (cell_h + pad)

        # Fundo xadrez neutro dentro da celula
        box_w = box_dim_w * scale
        box_h = box_dim_h * scale
        bx0 = x0 + (cell_w - box_w) // 2
        by0 = y0 + 24
        for py in range(box_h):
            for px in range(box_w):
                checker = ((px // (8 * scale)) + (py // (8 * scale))) % 2 == 0
                bg = (54, 58, 68, 255) if checker else (44, 47, 56, 255)
                sheet.put(bx0 + px, by0 + py, bg)

        # Linha guia do chao (alinhada para 80x80 y=76 e 96x96 y=92)
        gy = by0 + guide_foot_y * scale
        for px in range(box_w):
            sheet.put(bx0 + px, gy, (110, 180, 120, 255))

        # Sprite ampliado nearest-neighbor alinhado pelo centro X e linha do chao
        spr_foot_y = spr.h - 4
        ox = (box_dim_w - spr.w) // 2
        oy = guide_foot_y - spr_foot_y
        for sy in range(spr.h):
            for sx in range(spr.w):
                col = spr.get(sx, sy)
                if col[3] == 0:
                    continue
                for dy in range(scale):
                    for dx in range(scale):
                        sheet.blend_pixel(bx0 + (ox + sx) * scale + dx, by0 + (oy + sy) * scale + dy, col)

        draw_text(sheet, bx0, y0 + 4, label, (220, 230, 245, 255), scale=2)

    return sheet


def main() -> None:
    MONSTERS_DIR.mkdir(parents=True, exist_ok=True)
    hero = read_png(SRC_DIR / "hero_living_base.png")

    slime = build_slime_base()
    cave_bat = build_cave_bat_base()
    wolf = build_wolf_base()
    skeleton = build_skeleton_base()
    skeleton_archer = build_skeleton_archer_base()
    wolf_alpha = build_wolf_alpha_base()
    karnak = build_karnak_base()

    monsters: List[Tuple[str, Canvas]] = [
        ("slime", slime),
        ("cave_bat", cave_bat),
        ("wolf", wolf),
        ("skeleton", skeleton),
        ("skeleton_archer", skeleton_archer),
        ("wolf_alpha", wolf_alpha),
        ("karnak", karnak),
    ]

    for name, cv in monsters:
        out_path = MONSTERS_DIR / f"{name}_base.png"
        write_png(out_path, cv)
        print(f"Gerado: {out_path} ({cv.w}x{cv.h})")

    sheet = build_comparison_sheet([("hero_living", hero)] + monsters[:5], scale=3)
    write_png(PREVIEW_PATH, sheet)
    print(f"Preview: {PREVIEW_PATH} ({sheet.w}x{sheet.h})")

    m6_entries: List[Tuple[str, Canvas]] = [
        ("hero_living", hero),
        ("slime", slime),
        ("cave_bat", cave_bat),
        ("wolf", wolf),
        ("wolf_alpha", wolf_alpha),
        ("karnak", karnak),
    ]
    sheet_m6 = build_comparison_sheet(m6_entries, scale=3, title="RESIZE AND BOSSES")
    write_png(PREVIEW_M6_PATH, sheet_m6)
    print(f"Preview M6: {PREVIEW_M6_PATH} ({sheet_m6.w}x{sheet_m6.h})")


if __name__ == "__main__":
    main()
