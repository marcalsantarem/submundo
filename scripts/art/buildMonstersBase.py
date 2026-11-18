#!/usr/bin/env python3
"""
Gera os 5 sprites base estaticos (80x80) dos monstros em assets/sprites_src/monsters/
e uma prancha de comparacao ampliada 4x em assets/mockups/preview_monsters_5_base.png
ao lado do Heroi (hero_living_base.png).

100% Python stdlib pura (sem Pillow/NumPy).
"""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = ROOT / "assets" / "sprites_src"
MONSTERS_DIR = SRC_DIR / "monsters"
PREVIEW_PATH = ROOT / "assets" / "mockups" / "preview_monsters_5_base.png"

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
    top_y = 43

    # Domo gelatinoso bem arredondado (~44x33 px, estilo mockup)
    for py in range(top_y, base_y + 1):
        t_y = (py - top_y) / float(base_y - top_y)  # 0 no topo, 1 na base
        # Curva de cúpula: raiz quadrada no topo para ficar bem redondo, base larga
        profile = math.sin(clamp(t_y, 0.0, 1.0) * math.pi * 0.56 + 0.14)
        half_w = 22.0 * (profile ** 0.72)
        if t_y > 0.85:
            half_w *= 1.0 - 0.10 * ((t_y - 0.85) / 0.15) ** 2
        for px in range(int(cx - half_w - 1), int(cx + half_w + 2)):
            dx = px - cx
            wave_y = base_y - (1.0 if abs(dx) > half_w * 0.78 else 0.0)
            if abs(dx) <= half_w and py <= wave_y:
                nx = dx / max(1.0, half_w)
                ny = (t_y - 0.38) * 1.35
                shade = (-0.48 * nx - 0.82 * ny) + 0.22 * (1.0 - abs(nx))
                if py >= wave_y - 2.0:
                    col = pal_slime[0]
                elif py >= wave_y - 5.0 and shade < 0.05:
                    col = pal_slime[1]
                else:
                    col = pick_tone(shade, pal_slime)
                body.put(px, py, rgba(col))

    # Gotinha lateral esquerda na base
    draw_ellipse(body, 17.5, 73.5, 2.8, 2.0, pal_slime)

    # Reflexos especulares suaves em arco no topo-esquerdo (estilo mockup)
    spec_hi = (210, 255, 195, 255)
    spec_bright = (255, 255, 255, 255)
    for sx, sy in (
        (29, 47), (30, 46), (31, 46), (32, 46), (33, 46), (34, 47),
        (27, 49), (28, 48), (29, 48), (27, 50), (26, 51),
        (48, 48), (49, 49),
    ):
        body.put(sx, sy, spec_hi)
    for sx, sy in ((30, 47), (31, 47), (32, 47), (28, 49)):
        body.put(sx, sy, spec_bright)

    # Bolhas internas sutis (apenas 1 tom mais claro, sem contorno)
    for bx, by in ((27, 63), (51, 61)):
        body.put(bx, by, rgba(pal_slime[3]))
        body.put(bx + 1, by, rgba(pal_slime[3]))
        body.put(bx, by + 1, rgba(pal_slime[2]))

    # Rosto expressivo 3/4 para a direita (olhos + boca rabugenta como no mockup)
    eye_dark = (10, 22, 12, 255)
    for ex, ey in ((36, 58), (47, 58)):
        for dy in range(-2, 3):
            for dx in range(-1, 2):
                if abs(dx) + abs(dy) <= 2:
                    body.put(ex + dx, ey + dy, eye_dark)
        body.put(ex - 1, ey - 1, spec_bright)

    # Boca curvada para baixo (estilo slime do mockup)
    for mx, my in ((38, 66), (39, 65), (40, 64), (41, 64), (42, 64), (43, 64), (44, 65), (45, 66)):
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
    # Asa esquerda (mais aberta, perspectiva 3/4)
    left_wing_pts = [
        (34, 42), (24, 30), (11, 26), (9, 36),
        (14, 48), (19, 43), (24, 51), (29, 46), (34, 52),
    ]
    draw_polygon_shaded(wings, left_wing_pts, pal_membrane)
    # Asa direita (recolhida atras)
    right_wing_pts = [
        (46, 42), (56, 29), (68, 26), (71, 36),
        (66, 47), (61, 42), (56, 50), (51, 45), (46, 51),
    ]
    draw_polygon_shaded(wings, right_wing_pts, dim_palette(pal_membrane, 0.85))

    # Ossos/dedos das asas
    draw_capsule(wings, (34, 42), (24, 30), 2.0, 1.5, pal_wing_bone)
    draw_capsule(wings, (24, 30), (11, 26), 1.5, 1.1, pal_wing_bone)
    draw_capsule(wings, (24, 30), (14, 47), 1.2, 0.8, pal_wing_bone)
    draw_capsule(wings, (24, 30), (24, 50), 1.2, 0.8, pal_wing_bone)

    bone_r = dim_palette(pal_wing_bone, 0.88)
    draw_capsule(wings, (46, 42), (56, 29), 2.0, 1.5, bone_r)
    draw_capsule(wings, (56, 29), (68, 26), 1.5, 1.1, bone_r)
    draw_capsule(wings, (56, 29), (66, 46), 1.2, 0.8, bone_r)
    draw_capsule(wings, (56, 29), (56, 49), 1.2, 0.8, bone_r)

    # Garrinhas no topo das asas
    claw_col = (218, 212, 198, 255)
    wings.put(24, 27, claw_col)
    wings.put(24, 28, claw_col)
    wings.put(56, 26, claw_col)
    wings.put(56, 27, claw_col)

    wings_out = add_outline(wings, OUTLINE)

    body = Canvas(FW, FH)
    # Pés/garras inferiores
    draw_capsule(body, (37, 54), (35, 60), 1.3, 1.0, pal_wing_bone)
    draw_capsule(body, (43, 54), (45, 60), 1.3, 1.0, pal_wing_bone)

    # Tronco peludo
    draw_ellipse(body, 40.0, 47.0, 7.6, 8.5, pal_fur)
    draw_ellipse(body, 40.5, 45.0, 4.6, 4.2, (pal_fur[1], pal_fur[2], pal_fur[3], (148, 124, 186)))

    # Orelhas pontudas inclinadas para fora (sem pixels soltos)
    draw_polygon_shaded(body, [(33, 35), (29, 21), (38, 28)], pal_fur)
    draw_polygon_shaded(body, [(34, 33), (31, 24), (37, 29)], pal_ear_in)
    draw_polygon_shaded(body, [(43, 28), (51, 21), (47, 35)], pal_fur)
    draw_polygon_shaded(body, [(44, 29), (49, 24), (46, 33)], pal_ear_in)

    # Cabeca
    draw_ellipse(body, 40.5, 36.0, 7.4, 6.2, pal_fur)

    # Olhos vermelhos/ambar expressivos (2x2)
    for ex, ey in ((37, 35), (43, 35)):
        body.put(ex, ey, (215, 28, 28, 255))
        body.put(ex + 1, ey, (255, 78, 36, 255))
        body.put(ex, ey + 1, (255, 195, 70, 255))
        body.put(ex + 1, ey + 1, (255, 235, 130, 255))

    # Focinho e presinhas brancas
    body.put(40, 39, (28, 18, 40, 255))
    body.put(41, 39, (28, 18, 40, 255))
    body.put(38, 41, (245, 242, 236, 255))
    body.put(43, 41, (245, 242, 236, 255))

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


def build_comparison_sheet(entries: Sequence[Tuple[str, Canvas]], scale: int = 3) -> Canvas:
    cols = 3
    rows = 2
    cell_w = FW * scale + 28
    cell_h = FH * scale + 42
    pad = 16
    total_w = cols * cell_w + (cols + 1) * pad
    total_h = rows * cell_h + (rows + 1) * pad + 24

    sheet = Canvas(total_w, total_h, (24, 26, 34, 255))
    draw_text(sheet, pad, 8, "HEROI VS 5 MONSTROS BASE", (235, 225, 195, 255), scale=2)

    for idx, (label, spr) in enumerate(entries):
        c = idx % cols
        r = idx // cols
        x0 = pad + c * (cell_w + pad)
        y0 = 28 + pad + r * (cell_h + pad)

        # Fundo xadrez neutro dentro da celula
        box_w = FW * scale
        box_h = FH * scale
        bx0 = x0 + (cell_w - box_w) // 2
        by0 = y0 + 24
        for py in range(box_h):
            for px in range(box_w):
                checker = ((px // (8 * scale)) + (py // (8 * scale))) % 2 == 0
                bg = (54, 58, 68, 255) if checker else (44, 47, 56, 255)
                sheet.put(bx0 + px, by0 + py, bg)

        # Linha guia do chao (y = 76)
        gy = by0 + FOOT_Y * scale
        for px in range(box_w):
            sheet.put(bx0 + px, gy, (110, 180, 120, 255))

        # Sprite ampliado nearest-neighbor
        for sy in range(FH):
            for sx in range(FW):
                col = spr.get(sx, sy)
                if col[3] == 0:
                    continue
                for dy in range(scale):
                    for dx in range(scale):
                        sheet.blend_pixel(bx0 + sx * scale + dx, by0 + sy * scale + dy, col)

        draw_text(sheet, bx0, y0 + 4, label, (220, 230, 245, 255), scale=2)

    return sheet


def main() -> None:
    MONSTERS_DIR.mkdir(parents=True, exist_ok=True)
    hero = read_png(SRC_DIR / "hero_living_base.png")

    monsters: List[Tuple[str, Canvas]] = [
        ("slime", build_slime_base()),
        ("cave_bat", build_cave_bat_base()),
        ("wolf", build_wolf_base()),
        ("skeleton", build_skeleton_base()),
        ("skeleton_archer", build_skeleton_archer_base()),
    ]

    for name, cv in monsters:
        out_path = MONSTERS_DIR / f"{name}_base.png"
        write_png(out_path, cv)
        print(f"Gerado: {out_path} ({cv.w}x{cv.h})")

    sheet = build_comparison_sheet([("hero_living", hero)] + monsters, scale=3)
    write_png(PREVIEW_PATH, sheet)
    print(f"Preview: {PREVIEW_PATH} ({sheet.w}x{sheet.h})")


if __name__ == "__main__":
    main()
