"""
SUBMUNDO - Gerador da Masmorra Basica 2.5D (M8 piloto, BRF-126 / T-117)
==========================================================================

Gera de forma deterministica (sem dependencias externas, apenas stdlib):

- public/assets/sprites/dungeon_basic_tiles.png       (frames 32x32)
- public/assets/sprites/dungeon_basic_props.png       (frames 32x32, tocha animada 4f)
- public/assets/sprites/dungeon_basic_props_tall.png  (frames 32x64, pilares)
- assets/mockups/preview_m8_dungeon_basic_sheets.png  (prancha 3x rotulada)
- entradas novas em public/assets/sprites/manifest.json

Convencao 2.5D top-down (linha a linha da sala):
  linha 0      -> topo da parede (wall_top_s; cantos corner_in_tl/tr)
  linhas 1..2  -> face frontal da parede (wall_face_upper / wall_face_lower, porta door_*)
  linhas 3..   -> piso (floor_*), com sombra projetada shadow_* sobreposta na 1a linha
  colunas 0/N  -> topo das paredes laterais (wall_side_l / wall_side_r)
  ultima linha -> topo da parede inferior (wall_bottom; cantos corner_in_bl/br)

Uso: python scripts/art/buildDungeonBasic.py
"""
from __future__ import annotations

import json
import math
import random
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Callable, Dict, List, Sequence, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))
from buildMonstersBase import Canvas, read_png, write_png  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SPRITES_DIR = ROOT / "public" / "assets" / "sprites"
MOCKUPS_DIR = ROOT / "assets" / "mockups"
MANIFEST_JSON = SPRITES_DIR / "manifest.json"
TILES_PNG = SPRITES_DIR / "dungeon_basic_tiles.png"
PROPS_PNG = SPRITES_DIR / "dungeon_basic_props.png"
PROPS_TALL_PNG = SPRITES_DIR / "dungeon_basic_props_tall.png"
PREVIEW_PNG = MOCKUPS_DIR / "preview_m8_dungeon_basic_sheets.png"
DOORS_PNG = SPRITES_DIR / "dungeon_basic_doors.png"
DOORS_PREVIEW_PNG = MOCKUPS_DIR / "preview_m8_dungeon_doors_corridors.png"

T = 32
Color = Tuple[int, int, int, int]
RGB = Tuple[int, int, int]

# Paleta Abismo / Ossos & Ferro / Luz Quente (docs/guia_visual.md)
OUT: Color = (9, 9, 11, 255)
MORTAR: RGB = (11, 11, 15)
FLOOR_TONES: Sequence[RGB] = ((27, 27, 34), (31, 31, 39), (35, 34, 43), (29, 30, 38))
CAP_TONES: Sequence[RGB] = ((21, 21, 28), (24, 23, 31), (19, 19, 25))
CAP_MORTAR: RGB = (9, 9, 12)
BRICK_TONES: Sequence[RGB] = ((44, 42, 53), (50, 48, 60), (40, 39, 49), (47, 45, 57))
BRICK_MORTAR: RGB = (13, 13, 17)
RIM_HI: RGB = (100, 116, 139)  # #64748b
RIM: RGB = (82, 82, 91)  # #52525b
RIM_LO: RGB = (58, 58, 70)
IRON_D: RGB = (39, 39, 45)
IRON: RGB = (63, 63, 70)  # #3f3f46
IRON_L: RGB = (113, 113, 122)  # #71717a
IRON_H: RGB = (161, 161, 170)
WOOD_D: RGB = (46, 26, 13)  # #2e1a0d
WOOD: RGB = (92, 58, 33)  # #5c3a21
WOOD_L: RGB = (124, 77, 43)  # #7c4d2b
WOOD_H: RGB = (150, 98, 58)
GOLD: RGB = (212, 169, 90)
GOLD_H: RGB = (241, 210, 138)
RUNE_D: RGB = (2, 132, 199)  # #0284c7
RUNE: RGB = (56, 189, 248)  # #38bdf8
RUNE_H: RGB = (224, 242, 254)  # #e0f2fe
FLAME_RED: RGB = (185, 28, 28)
FLAME_OR: RGB = (234, 88, 12)
FLAME_AM: RGB = (245, 158, 11)  # #f59e0b
FLAME_Y: RGB = (253, 224, 71)  # #fde047
FLAME_W: RGB = (254, 249, 195)
BONE_D: RGB = (112, 106, 92)
BONE: RGB = (168, 162, 146)
BONE_L: RGB = (204, 198, 180)


# ---------------------------------------------------------------------------
# Primitivas
# ---------------------------------------------------------------------------

def rgba(c: RGB, a: int = 255) -> Color:
    return (int(c[0]), int(c[1]), int(c[2]), a)


def shade(c: RGB, f: float) -> RGB:
    return tuple(max(0, min(255, int(round(v * f)))) for v in c[:3])  # type: ignore[return-value]


def mix(a: RGB, b: RGB, t: float) -> RGB:
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))  # type: ignore[return-value]


def fill_rect(cv: Canvas, x: int, y: int, w: int, h: int, c: Color) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            cv.put(xx, yy, c)


def fill_ellipse(cv: Canvas, cx: float, cy: float, rx: float, ry: float,
                 col_fn: Callable[[int, int, float, float], Color | None]) -> None:
    for yy in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for xx in range(int(cx - rx) - 1, int(cx + rx) + 2):
            nx = (xx + 0.5 - cx) / rx
            ny = (yy + 0.5 - cy) / ry
            if nx * nx + ny * ny <= 1.0:
                c = col_fn(xx, yy, nx, ny)
                if c is not None:
                    cv.put(xx, yy, c)


def line(cv: Canvas, x0: int, y0: int, x1: int, y1: int, c: Color) -> None:
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        cv.put(x0, y0, c)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def outline(layer: Canvas, col: Color = OUT) -> Canvas:
    out = layer.copy()
    for y in range(layer.h):
        for x in range(layer.w):
            if layer.get(x, y)[3] != 0:
                continue
            for ddx, ddy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if layer.get(x + ddx, y + ddy)[3] >= 160:
                    out.put(x, y, col)
                    break
    return out


def darken_region(cv: Canvas, x: int, y: int, w: int, h: int, f: float) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            r, g, b, a = cv.get(xx, yy)
            if a:
                cv.put(xx, yy, (int(r * f), int(g * f), int(b * f), a))


def blit(dst: Canvas, src: Canvas, dx: int, dy: int) -> None:
    dst.composite(src, dx, dy)


# ---------------------------------------------------------------------------
# Piso
# ---------------------------------------------------------------------------

FLOOR_LAYOUTS: Dict[str, Sequence[Tuple[int, int, int, int]]] = {
    "a": ((0, 0, 18, 16), (18, 0, 14, 16), (0, 16, 9, 16), (9, 16, 16, 16), (25, 16, 7, 16)),
    "b": ((0, 0, 12, 11), (12, 0, 20, 11), (0, 11, 20, 10), (20, 11, 12, 10), (0, 21, 14, 11), (14, 21, 18, 11)),
    "c": ((0, 0, 10, 10), (10, 0, 12, 10), (22, 0, 10, 10), (0, 10, 16, 12), (16, 10, 16, 12),
          (0, 22, 8, 10), (8, 22, 13, 10), (21, 22, 11, 10)),
    "cap": ((0, 0, 11, 8), (11, 0, 13, 8), (24, 0, 8, 8), (0, 8, 7, 8), (7, 8, 14, 8), (21, 8, 11, 8), (0, 16, 12, 8), (12, 16, 11, 8), (23, 16, 9, 8), (0, 24, 8, 8), (8, 24, 15, 8), (23, 24, 9, 8)),
}


def draw_stones(cv: Canvas, rects: Sequence[Tuple[int, int, int, int]], rng: random.Random,
                tones: Sequence[RGB], mortar: RGB, hi_f: float = 1.22, lo_f: float = 0.76) -> None:
    for (x, y, w, h) in rects:
        base = rng.choice(tones)
        j = rng.randint(-2, 2)
        base = (base[0] + j, base[1] + j, base[2] + j)
        pits = [(rng.randint(x + 2, x + w - 3), rng.randint(y + 2, y + h - 3)) for _ in range(2)] if w > 5 and h > 5 else []
        for py in range(y, y + h):
            for px in range(x, x + w):
                if px == x or py == y:
                    col = mortar
                else:
                    col = base
                    if py == y + 1 or px == x + 1:
                        col = shade(base, hi_f)
                    if py == y + h - 1 or px == x + w - 1:
                        col = shade(base, lo_f)
                    r = rng.random()
                    if r < 0.08:
                        col = shade(col, 0.86)
                    elif r < 0.12:
                        col = shade(col, 1.12)
                    if (px, py) in pits or (px - 1, py) in pits:
                        col = shade(base, 0.7)
                cv.put(px, py, rgba(col))
        # quinas lascadas
        cv.put(x + 1, y + 1, rgba(shade(mortar, 1.5)))
        if rng.random() < 0.5:
            cv.put(x + w - 1, y + h - 1, rgba(shade(base, 0.6)))


def draw_crack(cv: Canvas, rng: random.Random, x: int, y: int, steps: int, dirx: int = 1) -> None:
    dark = rgba((7, 7, 9))
    lit = rgba((50, 50, 62))
    for i in range(steps):
        cv.put(x, y, dark)
        cv.put(x + 1, y + 1, lit) if cv.get(x + 1, y + 1)[:3] != dark[:3] else None
        y += 1
        x += dirx if rng.random() < 0.6 else 0
        if rng.random() < 0.18:
            x -= dirx
        if i == steps // 2:
            # ramo
            bx, by = x, y
            for _ in range(5):
                bx -= dirx
                by += 1 if rng.random() < 0.5 else 0
                cv.put(bx, by, dark)


def tile_floor(variant: str, seed: int, extra: str = "") -> Canvas:
    cv = Canvas(T, T)
    rng = random.Random(seed)
    draw_stones(cv, FLOOR_LAYOUTS[variant], rng, FLOOR_TONES, MORTAR)
    if extra == "cracked":
        draw_crack(cv, rng, 9, 3, 22, 1)
        draw_crack(cv, rng, 25, 14, 9, -1)
    elif extra == "moss":
        centers = [(4, 26, 9.0), (22, 6, 6.5), (13, 15, 4.5)]
        for y in range(T):
            for x in range(T):
                best = 9.0
                for (cx, cy, r) in centers:
                    d = math.hypot(x - cx, y - cy) / r
                    best = min(best, d)
                n = rng.random()
                if best < 0.75 + 0.4 * n:
                    old = cv.get(x, y)
                    is_mortar = old[0] < 15
                    if is_mortar:
                        col = (26, 40, 25)
                    else:
                        col = (34, 50, 31) if n < 0.55 else ((46, 66, 38) if n < 0.85 else (62, 84, 46))
                    cv.put(x, y, rgba(col))
    elif extra == "blood":
        blobs = [(15, 17, 6.5, 4.5), (20, 13, 3.5, 3.0), (10, 21, 3.0, 2.5)]
        for y in range(T):
            for x in range(T):
                inside = 9.0
                for (cx, cy, rx, ry) in blobs:
                    d = math.hypot((x - cx) / rx, (y - cy) / ry)
                    inside = min(inside, d)
                n = rng.random()
                if inside < 0.85 + 0.25 * n:
                    col = (44, 10, 12) if inside < 0.45 else (62, 14, 16)
                    if n > 0.93:
                        col = (86, 22, 22)
                    cv.put(x, y, rgba(col))
        for (dx, dy) in ((26, 8), (5, 12), (24, 25), (7, 27), (28, 20)):
            cv.put(dx, dy, rgba((58, 13, 15)))
            cv.put(dx + 1, dy, rgba((44, 10, 12)))
    return cv


# ---------------------------------------------------------------------------
# Topo das paredes (vista de cima) e cantos
# ---------------------------------------------------------------------------

def cap_base(seed: int) -> Canvas:
    cv = Canvas(T, T)
    rng = random.Random(seed)
    draw_stones(cv, FLOOR_LAYOUTS["cap"], rng, CAP_TONES, CAP_MORTAR, 1.15, 0.82)
    return cv


def rim_s(cv: Canvas) -> None:
    for x in range(T):
        cv.put(x, 28, rgba(shade(cv.get(x, 28)[:3], 0.8)))
        cv.put(x, 29, rgba(SIDE_RIM_LO))
        cv.put(x, 30, rgba(RIM if x % 9 else RIM_HI))
        cv.put(x, 31, rgba(RIM_LO))


SIDE_RIM: RGB = (64, 66, 80)
SIDE_RIM_LO: RGB = (44, 44, 55)


def rim_n(cv: Canvas) -> None:
    for x in range(T):
        cv.put(x, 0, rgba(SIDE_RIM_LO))
        cv.put(x, 1, rgba(SIDE_RIM if x % 7 else RIM))
        cv.put(x, 2, rgba(SIDE_RIM_LO))


def rim_e(cv: Canvas) -> None:
    for y in range(T):
        cv.put(31, y, rgba(SIDE_RIM_LO))
        cv.put(30, y, rgba(SIDE_RIM if y % 11 else RIM))
        cv.put(29, y, rgba(SIDE_RIM_LO))


def rim_w(cv: Canvas) -> None:
    for y in range(T):
        cv.put(0, y, rgba(SIDE_RIM_LO))
        cv.put(1, y, rgba(SIDE_RIM if y % 11 else RIM))
        cv.put(2, y, rgba(SIDE_RIM_LO))


def flip_h(cv: Canvas) -> Canvas:
    out = Canvas(cv.w, cv.h)
    for y in range(cv.h):
        for x in range(cv.w):
            out.put(cv.w - 1 - x, y, cv.get(x, y))
    return out


def flip_v(cv: Canvas) -> Canvas:
    out = Canvas(cv.w, cv.h)
    for y in range(cv.h):
        for x in range(cv.w):
            out.put(x, cv.h - 1 - y, cv.get(x, y))
    return out


def tile_cap(kind: str, seed: int) -> Canvas:
    cv = cap_base(seed)
    if kind == "s":
        rim_s(cv)
    elif kind == "n":
        rim_n(cv)
    elif kind == "e":
        rim_e(cv)
    elif kind == "w":
        rim_w(cv)
    elif kind.startswith("in_"):
        # canto interno (concavo): apenas o encontro dos aros na quina voltada para a sala
        corner = kind[3:]
        base = Canvas(T, T)
        base.buf[:] = cv.buf
        tmp = cap_base(seed)
        for (x, y) in ((29, 29), (30, 29), (31, 29), (29, 30), (29, 31)):
            tmp.put(x, y, rgba(SIDE_RIM_LO))
        for (x, y) in ((30, 30), (31, 30), (30, 31)):
            tmp.put(x, y, rgba(SIDE_RIM))
        tmp.put(31, 31, rgba(RIM))
        if corner == "tl":
            cv = tmp
        elif corner == "tr":
            cv = flip_h(tmp)
        elif corner == "bl":
            cv = flip_v(tmp)
        else:
            cv = flip_v(flip_h(tmp))
    elif kind.startswith("out_"):
        # canto externo (convexo): bloco com aro em dois lados
        corner = kind[4:]
        if "t" in corner:
            rim_n(cv)
        if "b" in corner:
            rim_s(cv)
        if "l" in corner:
            rim_w(cv)
        if "r" in corner:
            rim_e(cv)
    return cv


# ---------------------------------------------------------------------------
# Face frontal (tijolos em amarracao, 2 tiles de altura)
# ---------------------------------------------------------------------------

def draw_bricks(cv: Canvas, tile_row: int, rng: random.Random, y_max: int = T, ox: int = 0, width: int = T) -> None:
    for y in range(y_max):
        gy = tile_row * T + y
        course = gy // 8
        yin = gy % 8
        offset = 8 if course % 2 else 0
        for xl in range(width):
            x = ox + xl
            xm = (x + offset) % 16
            idx = ((x + offset) // 16) % 2
            tone = BRICK_TONES[(course * 3 + idx * 2) % len(BRICK_TONES)]
            if yin == 0 or xm == 0:
                col = BRICK_MORTAR
            else:
                col = tone
                if yin == 1:
                    col = shade(tone, 1.25)
                elif yin == 7:
                    col = shade(tone, 0.72)
                elif xm == 15:
                    col = shade(tone, 0.82)
                elif xm == 1:
                    col = shade(tone, 1.08)
                r = rng.random()
                if r < 0.08:
                    col = shade(col, 0.84)
                elif r < 0.11:
                    col = shade(col, 1.14)
            cv.put(x, y, rgba(col))


def overhang_shadow(cv: Canvas) -> None:
    for y, f in enumerate((0.3, 0.45, 0.6, 0.75, 0.88)):
        darken_region(cv, 0, y, cv.w, 1, f)


def draw_plinth(cv: Canvas, rng: random.Random, ox: int = 0, width: int = T) -> None:
    for xl in range(width):
        x = ox + xl
        cv.put(x, 24, rgba(BRICK_MORTAR))
        cv.put(x, 25, rgba((66, 66, 79)))
        for y in range(26, 30):
            base = (38, 38, 47) if (x // 12) % 2 else (35, 35, 44)
            c = base if rng.random() > 0.1 else shade(base, 0.85)
            if x % 12 == 0:
                c = BRICK_MORTAR
            cv.put(x, y, rgba(c))
        cv.put(x, 30, rgba((22, 22, 28)))
        cv.put(x, 31, rgba((14, 14, 18)))


def tile_face(kind: str, seed: int) -> Canvas:
    cv = Canvas(T, T)
    rng = random.Random(seed)
    if kind in ("upper", "upper_cracked"):
        draw_bricks(cv, 0, rng)
        overhang_shadow(cv)
        if kind == "upper_cracked":
            # tijolo arrancado + rachadura
            for y in range(17, 24):
                for x in range(9, 24):
                    cv.put(x, y, rgba((20, 19, 25) if y > 17 else (12, 12, 15)))
            for x in range(9, 24):
                cv.put(x, 23, rgba((54, 52, 64)))
            draw_crack(cv, rng, 14, 5, 11, 1)
            draw_crack(cv, rng, 20, 24, 7, -1)
    else:
        draw_bricks(cv, 1, rng, 24)
        draw_plinth(cv, rng)
        if kind == "lower_grate":
            # bueiro de ferro em arco
            for y in range(9, 30):
                for x in range(9, 23):
                    dx = x - 15.5
                    if y < 14 and dx * dx + (y - 14) ** 2 > 42:
                        continue
                    edge = (dx * dx + (y - 14) ** 2 > 28 and y < 14) or x in (9, 22) or y == 29
                    cv.put(x, y, rgba((60, 60, 72) if edge else (5, 5, 8)))
            for bx in (12, 15, 18, 20):
                for y in range(10, 29):
                    if cv.get(bx, y)[0] < 10:
                        cv.put(bx, y, rgba(IRON))
                        if y % 4 == 0:
                            cv.put(bx, y, rgba(IRON_L))
            for x in range(10, 22):
                if cv.get(x, 20)[0] < 10 or cv.get(x, 20)[:3] == IRON:
                    cv.put(x, 20, rgba(IRON_D))
            # limo escorrendo
            for (x, y0, ln) in ((11, 29, 2), (17, 29, 3)):
                for y in range(y0, min(32, y0 + ln)):
                    cv.put(x, y, rgba((38, 58, 34)))
    return cv


# ---------------------------------------------------------------------------
# Porta / arco runico (2x2 tiles na face) + soleira (2 tiles de piso)
# ---------------------------------------------------------------------------

RUNE_GLYPHS = (
    ("010", "111", "010", "010", "101"),
    ("101", "010", "101", "010", "010"),
    ("110", "011", "010", "110", "011"),
    ("010", "101", "111", "001", "001"),
)


def draw_rune(cv: Canvas, x: int, y: int, glyph: Sequence[str], bright: bool) -> None:
    for ry, row in enumerate(glyph):
        for rx, bit in enumerate(row):
            if bit == "1":
                cv.put(x + rx, y + ry, rgba(RUNE if bright else RUNE_D))
    if bright:
        # nucleo quase branco no centro do glifo
        cv.put(x + 1, y + 2, rgba(RUNE_H)) if glyph[2][1] == "1" else None


def build_door() -> Canvas:
    W, H = 64, 64
    cv = Canvas(W, H)
    rng = random.Random(9101)
    up = Canvas(W, T)
    draw_bricks(up, 0, rng, T, 0, W)
    overhang_shadow(up)
    lo = Canvas(W, T)
    draw_bricks(lo, 1, rng, 24, 0, W)
    draw_plinth(lo, rng, 0, W)
    blit(cv, up, 0, 0)
    blit(cv, lo, 0, T)
    cx, cy = 31.5, 27.0
    r_in, r_out = 12.5, 20.0
    n_vous = 9
    for y in range(H):
        for x in range(W):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            r = math.hypot(dx, dy)
            in_open = (abs(dx) < r_in and y >= cy) or (r < r_in and y < cy)
            if in_open:
                depth = min(1.0, max(0.0, (y - 14) / 50))
                col = mix((3, 3, 6), (12, 12, 19), depth * 0.7)
                # degraus descendo na escuridao
                if y in (48, 55, 61) and abs(dx) < r_in - 1:
                    col = (22, 22, 30)
                if y in (49, 56, 62) and abs(dx) < r_in - 1:
                    col = (8, 8, 12)
                cv.put(x, y, rgba(col))
                continue
            in_ring = (r_in <= r < r_out and y < cy)
            in_jamb = (r_in <= abs(dx) < r_out - 1 and y >= cy)
            if in_ring:
                ang = math.atan2(dy, dx)  # -pi .. 0 na metade superior
                seg = (ang + math.pi) / math.pi * n_vous
                frac = seg - math.floor(seg)
                key = int(seg) == n_vous // 2
                base = (70, 70, 85) if key else ((60, 60, 73) if int(seg) % 2 else (55, 55, 67))
                if frac < 0.09 and not key:
                    col = BRICK_MORTAR
                elif r < r_in + 1.2:
                    col = shade(base, 1.3)
                elif r > r_out - 1.3:
                    col = shade(base, 0.62)
                else:
                    col = base if rng.random() > 0.1 else shade(base, 0.88)
                cv.put(x, y, rgba(col))
            elif in_jamb:
                block = int((y - cy) // 9)
                base = (58, 58, 71) if block % 2 else (53, 53, 65)
                if (y - int(cy)) % 9 == 0:
                    col = BRICK_MORTAR
                elif abs(dx) < r_in + 1.2:
                    col = shade(base, 1.28)
                elif abs(dx) > r_out - 2.2:
                    col = shade(base, 0.62)
                else:
                    col = base if rng.random() > 0.1 else shade(base, 0.88)
                cv.put(x, y, rgba(col))
            elif r_out <= r < r_out + 1.2 and y < cy or (r_out - 1 <= abs(dx) < r_out and y >= cy):
                cv.put(x, y, rgba((10, 10, 14)))
    # runas: pedra-chave e ombreiras
    draw_rune(cv, 30, 9, RUNE_GLYPHS[0], True)
    for i, gy in enumerate((31, 39, 47)):
        draw_rune(cv, 14, gy, RUNE_GLYPHS[(i + 1) % 4], i == 1)
        draw_rune(cv, 47, gy, RUNE_GLYPHS[(i + 2) % 4], i == 1)
    # brilho runico sutil vazando na abertura
    for y in range(30, 64):
        for x in (19, 44):
            if cv.get(x, y)[0] < 20:
                cv.put(x, y, rgba((10, 30, 44)))
    return cv


def build_threshold() -> Canvas:
    W = 64
    cv = Canvas(W, T)
    rng = random.Random(9202)
    # piso comum nas laterais
    left = tile_floor("a", 9301)
    right = tile_floor("b", 9302)
    blit(cv, left, 0, 0)
    blit(cv, right, 32, 0)
    # laje da soleira (degrau) sob a porta
    for y in range(0, 20):
        for x in range(13, 51):
            if y < 3:
                col = (6, 6, 9) if 19 <= x <= 44 else (14, 14, 18)
            elif y == 3:
                col = (58, 58, 70)
            elif y == 19 or x in (13, 50):
                col = MORTAR
            else:
                col = (36, 36, 45) if rng.random() > 0.1 else (31, 31, 39)
                if x == 14 or y == 4:
                    col = (46, 46, 57)
                if y == 18 or x == 49:
                    col = (26, 26, 33)
            cv.put(x, y, rgba(col))
    # inscricao runica gravada na laje
    for i, gx in enumerate(range(18, 46, 7)):
        draw_rune(cv, gx, 9, RUNE_GLYPHS[i % 4], i in (1, 2))
    for x in range(16, 48):
        if cv.get(x, 15)[0] > 30:
            cv.put(x, 15, rgba((14, 70, 98) if x % 3 else (2, 132, 199)))
    return cv


# ---------------------------------------------------------------------------
# Sombras projetadas (alfa sobre o piso)
# ---------------------------------------------------------------------------

def tile_shadow(kind: str) -> Canvas:
    cv = Canvas(T, T)
    bands_s = (165, 165, 165, 120, 120, 120, 120, 78, 78, 78, 78, 40, 40, 40, 40, 16, 16)
    bands_side = (120, 120, 72, 72, 72, 34, 34, 34, 12)
    for y in range(T):
        for x in range(T):
            a = 0
            if kind in ("s", "corner_l", "corner_r"):
                a = bands_s[y] if y < len(bands_s) else 0
            if kind in ("l", "corner_l"):
                a = max(a, bands_side[x] if x < len(bands_side) else 0)
            if kind in ("r", "corner_r"):
                xr = T - 1 - x
                a = max(a, bands_side[xr] if xr < len(bands_side) else 0)
            if a:
                cv.put(x, y, (0, 0, 4, a))
    return cv


# ---------------------------------------------------------------------------
# Props 32x32
# ---------------------------------------------------------------------------

def draw_sconce(cv: Canvas) -> None:
    body = Canvas(T, T)
    fill_rect(body, 13, 21, 6, 9, rgba(IRON))
    fill_rect(body, 14, 22, 1, 7, rgba(IRON_L))
    body.put(15, 23, rgba(IRON_H))
    body.put(15, 27, rgba(IRON_H))
    fill_rect(body, 15, 18, 2, 4, rgba(IRON_D))
    fill_rect(body, 11, 15, 10, 4, rgba(IRON))
    fill_rect(body, 11, 15, 10, 1, rgba(IRON_L))
    fill_rect(body, 12, 18, 8, 1, rgba(IRON_D))
    fill_rect(body, 13, 12, 6, 3, rgba(WOOD))
    fill_rect(body, 13, 12, 2, 3, rgba(WOOD_L))
    blit(cv, outline(body), 0, 0)


def draw_flame(cv: Canvas, frame: int) -> None:
    sway = (0, 1, 0, -1)[frame]
    height = (12, 10, 13, 11)[frame]
    width = (4.6, 5.2, 4.2, 5.0)[frame]
    base_y = 14
    for y in range(base_y - height - 1, base_y + 1):
        t = (base_y - y) / height  # 0 base .. 1 ponta
        if t > 1.05:
            continue
        half = width * (1 - t) ** 0.8 * (0.85 + 0.3 * math.sin(t * math.pi))
        cxf = 15.5 + sway * t * 1.6
        for x in range(8, 24):
            d = abs(x + 0.5 - cxf)
            if d > half + 0.25:
                continue
            rel = d / max(half, 0.6)
            heat = (1 - t) * 0.9 + (1 - rel) * 0.6
            if heat > 1.15:
                col = FLAME_W
            elif heat > 0.9:
                col = FLAME_Y
            elif heat > 0.62:
                col = FLAME_AM
            elif heat > 0.38:
                col = FLAME_OR
            else:
                col = FLAME_RED
            cv.put(x, y, rgba(col))
    # brasas
    embers = (((13, 3), (19, 5)), ((18, 2),), ((12, 1), (17, 0)), ((20, 3), (14, 4)))[frame]
    for (ex, ey) in embers:
        cv.put(ex, ey, rgba(FLAME_Y if (ex + ey) % 2 else FLAME_AM))


def prop_torch(frame: int) -> Canvas:
    cv = Canvas(T, T)
    draw_sconce(cv)
    draw_flame(cv, frame)
    return cv


def prop_chest() -> Canvas:
    body = Canvas(T, T)
    # tampa (vista de cima, mais clara)
    for y in range(9, 16):
        for x in range(4, 28):
            col = WOOD_L if y < 12 else WOOD
            if y in (9,):
                col = WOOD_H
            if x in (4, 27):
                col = WOOD_D
            body.put(x, y, rgba(col))
    for x in range(4, 28):
        if x % 6 == 3:
            for y in range(10, 15):
                body.put(x, y, rgba(WOOD_D))
    # frente
    for y in range(16, 29):
        for x in range(4, 28):
            col = WOOD if y < 22 else shade(WOOD, 0.82)
            if y in (19, 24):
                col = WOOD_D
            if x in (4, 27):
                col = WOOD_D
            body.put(x, y, rgba(col))
    # ferragens
    fill_rect(body, 4, 15, 24, 2, rgba(IRON))
    fill_rect(body, 4, 15, 24, 1, rgba(IRON_L))
    for bx in (7, 23):
        fill_rect(body, bx, 9, 2, 20, rgba(IRON))
        fill_rect(body, bx, 9, 1, 20, rgba(IRON_L))
        body.put(bx, 18, rgba(IRON_H))
        body.put(bx, 26, rgba(IRON_H))
    fill_rect(body, 4, 27, 24, 2, rgba(IRON_D))
    # fechadura dourada
    fill_rect(body, 14, 16, 4, 6, rgba(GOLD))
    fill_rect(body, 14, 16, 4, 1, rgba(GOLD_H))
    body.put(15, 18, rgba(OUT))
    body.put(15, 19, rgba(OUT))
    cv = outline(body)
    # sombra de contato
    for x in range(5, 28):
        cv.put(x, 30, (0, 0, 0, 110))
    return cv


def prop_barrel() -> Canvas:
    body = Canvas(T, T)
    for y in range(9, 29):
        bulge = 7.0 + 1.6 * math.sin((y - 9) / 19 * math.pi)
        for x in range(4, 28):
            d = (x + 0.5 - 16) / bulge
            if abs(d) > 1:
                continue
            light = 1.18 - 0.55 * (d + 1) / 2
            col = shade(WOOD, light)
            if int((x + 0.5 - 16) / bulge * 3.5 + 10) != int((x + 1.5 - 16) / bulge * 3.5 + 10):
                col = shade(WOOD_D, 1.1)
            body.put(x, y, rgba(col))
    for hy in (12, 24):
        for x in range(4, 28):
            if body.get(x, hy)[3]:
                body.put(x, hy, rgba(IRON_L if x < 15 else IRON))
                body.put(x, hy + 1, rgba(IRON_D))
    # tampo eliptico
    fill_ellipse(body, 16, 9, 7.2, 3.2,
                 lambda x, y, nx, ny: rgba(WOOD_D) if nx * nx + ny * ny > 0.62 else rgba(WOOD_L if (x % 4) else WOOD))
    cv = outline(body)
    for x in range(8, 25):
        cv.put(x, 30, (0, 0, 0, 100))
    return cv


def prop_urn() -> Canvas:
    body = Canvas(T, T)
    clay_d, clay, clay_l = (64, 34, 26), (98, 54, 38), (132, 78, 52)

    def urn_col(x: int, y: int, nx: float, ny: float) -> Color:
        light = 1.0 - 0.45 * nx - 0.15 * ny
        c = clay_l if light > 1.12 else (clay if light > 0.82 else clay_d)
        if y in (20, 21):
            c = (40, 22, 18) if (x // 2) % 2 else (150, 112, 62)
        return rgba(c)

    fill_ellipse(body, 16, 21, 8.2, 7.6, urn_col)
    fill_rect(body, 13, 9, 6, 6, rgba(clay))
    fill_rect(body, 13, 9, 2, 6, rgba(clay_l))
    fill_rect(body, 11, 7, 10, 3, rgba(clay_l))
    fill_rect(body, 11, 9, 10, 1, rgba(clay_d))
    fill_rect(body, 13, 7, 6, 1, rgba((24, 14, 12)))
    cv = outline(body)
    for x in range(9, 24):
        cv.put(x, 30, (0, 0, 0, 100))
    return cv


def prop_bones() -> Canvas:
    body = Canvas(T, T)

    def bone(x0: int, y0: int, x1: int, y1: int) -> None:
        line(body, x0, y0, x1, y1, rgba(BONE))
        line(body, x0, y0 + 1, x1, y1 + 1, rgba(BONE_D))
        for (bx, by) in ((x0, y0), (x1, y1)):
            body.put(bx - 1, by, rgba(BONE_L))
            body.put(bx + 1, by, rgba(BONE_L))
            body.put(bx, by - 1, rgba(BONE_L))

    bone(4, 22, 17, 27)
    bone(19, 19, 28, 26)
    bone(6, 28, 13, 23)
    # costelas
    for i in range(3):
        line(body, 20 + i * 2, 12, 23 + i * 2, 17, rgba(BONE_D if i == 1 else BONE))
    # cranio
    fill_ellipse(body, 11.5, 15.5, 4.6, 4.0,
                 lambda x, y, nx, ny: rgba(BONE_L if nx < -0.2 and ny < 0 else (BONE if ny < 0.4 else BONE_D)))
    fill_rect(body, 9, 18, 6, 2, rgba(BONE_D))
    body.put(10, 15, rgba(OUT))
    body.put(9, 15, rgba(OUT))
    body.put(13, 15, rgba(OUT))
    body.put(14, 15, rgba(OUT))
    body.put(12, 17, rgba((40, 38, 34)))
    return outline(body)


def prop_rubble() -> Canvas:
    body = Canvas(T, T)
    rng = random.Random(7707)
    rocks = ((10, 22, 6, 4), (20, 21, 5, 4), (15, 26, 4, 3), (24, 27, 3, 2), (6, 27, 3, 2), (17, 17, 3, 3))
    for (cx, cy, rx, ry) in rocks:
        fill_ellipse(body, cx, cy, rx, ry,
                     lambda x, y, nx, ny: rgba(shade((60, 60, 72), 1.25) if nx + ny < -0.7 else
                                               ((52, 52, 63) if nx + ny < 0.4 else (36, 36, 45))))
    for _ in range(14):
        x, y = rng.randint(4, 28), rng.randint(18, 30)
        if not body.get(x, y)[3]:
            body.put(x, y, rgba((44, 44, 54)))
    return outline(body)


def prop_chain() -> Canvas:
    body = Canvas(T, T)
    fill_rect(body, 12, 0, 8, 3, rgba(IRON))
    fill_rect(body, 12, 0, 8, 1, rgba(IRON_L))
    body.put(13, 1, rgba(IRON_H))
    body.put(18, 1, rgba(IRON_H))
    y = 3
    k = 0
    while y < 24:
        if k % 2 == 0:
            for (x, yy) in ((15, y), (16, y), (14, y + 1), (17, y + 1), (14, y + 2), (17, y + 2), (15, y + 3), (16, y + 3)):
                body.put(x, yy, rgba(IRON_L if x < 16 else IRON))
            body.put(14, y + 1, rgba(IRON_H))
        else:
            for yy in range(y - 1, y + 4):
                body.put(15, yy, rgba(IRON))
                body.put(16, yy, rgba(IRON_D))
        y += 3
        k += 1
    # grilhao aberto
    for ang in range(0, 300, 12):
        a = math.radians(ang + 120)
        body.put(int(round(16 + 4 * math.cos(a))), int(round(27 + 3 * math.sin(a))), rgba(IRON_L))
    body.put(19, 27, rgba(IRON_H))
    return outline(body)


def prop_skulls() -> Canvas:
    body = Canvas(T, T)
    for (cx, cy) in ((10.5, 24.5), (20.5, 25.0), (15.5, 19.5)):
        fill_ellipse(body, cx, cy, 4.2, 3.6,
                     lambda x, y, nx, ny: rgba(BONE_L if nx < -0.2 and ny < 0 else (BONE if ny < 0.45 else BONE_D)))
        ix, iy = int(cx), int(cy)
        body.put(ix - 2, iy, rgba(OUT))
        body.put(ix - 1, iy, rgba(OUT))
        body.put(ix + 1, iy, rgba(OUT))
        body.put(ix + 2, iy, rgba(OUT))
        body.put(ix, iy + 2, rgba((40, 38, 34)))
    cv = outline(body)
    # vela de cera sobre o cranio central (ponto de luz quente pequeno)
    fill_rect(cv, 15, 11, 2, 5, rgba((214, 200, 168)))
    cv.put(15, 10, rgba(FLAME_Y))
    cv.put(16, 9, rgba(FLAME_AM))
    cv.put(15, 9, rgba(FLAME_W))
    return cv


# ---------------------------------------------------------------------------
# Props altos 32x64
# ---------------------------------------------------------------------------

def pillar_shaft_col(x: int, half: float, cx: float = 15.5) -> float:
    d = (x + 0.5 - cx) / half
    return 1.3 - 0.75 * (d + 1) / 2


def prop_pillar(broken: bool = False) -> Canvas:
    W, H = 32, 64
    body = Canvas(W, H)
    rng = random.Random(4401 if not broken else 4402)
    stone = (56, 56, 68)
    top = 12 if not broken else 30
    # base
    for y in range(52, 61):
        for x in range(4, 28):
            col = shade(stone, pillar_shaft_col(x, 12.0))
            if y == 52 or y == 56:
                col = shade(stone, 1.35)
            if y == 55:
                col = BRICK_MORTAR
            body.put(x, y, rgba(col))
    # fuste
    for y in range(top, 52):
        for x in range(7, 25):
            col = shade(stone, pillar_shaft_col(x, 9.0))
            if (y - 2) % 10 == 0:
                col = BRICK_MORTAR
            elif x in (11, 20) and rng.random() < 0.5:
                col = shade(col, 0.88)
            if rng.random() < 0.07:
                col = shade(col, 0.85)
            body.put(x, y, rgba(col))
    if not broken:
        # capitel
        for y in range(3, 12):
            for x in range(4, 28):
                col = shade(stone, pillar_shaft_col(x, 12.0))
                if y == 3:
                    col = shade(stone, 1.45)
                if y in (7, 11):
                    col = BRICK_MORTAR
                if y == 8:
                    col = shade(stone, 1.25)
                body.put(x, y, rgba(col))
        # fissura
        draw_crack(body, rng, 13, 22, 9, 1)
    else:
        # topo quebrado irregular
        jag = (0, 2, 1, 3, 5, 4, 2, 1, 3, 6, 4, 2, 1, 2, 3, 1, 0, 2)
        for i, x in enumerate(range(7, 25)):
            for y in range(top, top + jag[i % len(jag)]):
                body.put(x, y, (0, 0, 0, 0))
            body.put(x, top + jag[i % len(jag)], rgba(shade(stone, 1.4)))
        for (cx, cy, rx, ry) in ((6, 59, 3.5, 2.5), (26, 60, 3, 2), (22, 57, 2, 1.5)):
            fill_ellipse(body, cx, cy, rx, ry,
                         lambda x, y, nx, ny: rgba(shade(stone, 1.2) if ny < 0 else shade(stone, 0.75)))
    cv = Canvas(W, H)
    for x in range(3, 30):
        for y in (61, 62):
            cv.put(x, y, (0, 0, 0, 120 if y == 61 else 70))
    blit(cv, outline(body), 0, 0)
    return cv


# ---------------------------------------------------------------------------
# Montagem das folhas
# ---------------------------------------------------------------------------

def build_tiles() -> List[Tuple[str, Canvas]]:
    door = build_door()
    thr = build_threshold()

    def sub(src: Canvas, x: int, y: int) -> Canvas:
        c = Canvas(T, T)
        for yy in range(T):
            for xx in range(T):
                c.put(xx, yy, src.get(x + xx, y + yy))
        return c

    return [
        ("floor_0", tile_floor("a", 101)),
        ("floor_1", tile_floor("b", 102)),
        ("floor_2", tile_floor("c", 103)),
        ("floor_cracked", tile_floor("a", 104, "cracked")),
        ("floor_moss", tile_floor("b", 105, "moss")),
        ("floor_blood", tile_floor("c", 106, "blood")),
        ("wall_top", tile_cap("fill", 201)),
        ("wall_top_s", tile_cap("s", 202)),
        ("wall_side_l", tile_cap("e", 203)),
        ("wall_side_r", tile_cap("w", 204)),
        ("wall_bottom", tile_cap("n", 205)),
        ("corner_in_tl", tile_cap("in_tl", 206)),
        ("corner_in_tr", tile_cap("in_tr", 207)),
        ("corner_in_bl", tile_cap("in_bl", 208)),
        ("corner_in_br", tile_cap("in_br", 209)),
        ("corner_out_tl", tile_cap("out_tl", 210)),
        ("corner_out_tr", tile_cap("out_tr", 211)),
        ("corner_out_bl", tile_cap("out_bl", 212)),
        ("corner_out_br", tile_cap("out_br", 213)),
        ("wall_face_upper", tile_face("upper", 301)),
        ("wall_face_lower", tile_face("lower", 302)),
        ("wall_face_upper_cracked", tile_face("upper_cracked", 303)),
        ("wall_face_lower_grate", tile_face("lower_grate", 304)),
        ("door_arch_l", sub(door, 0, 0)),
        ("door_arch_r", sub(door, 32, 0)),
        ("door_open_l", sub(door, 0, 32)),
        ("door_open_r", sub(door, 32, 32)),
        ("door_threshold_l", sub(thr, 0, 0)),
        ("door_threshold_r", sub(thr, 32, 0)),
        ("shadow_s", tile_shadow("s")),
        ("shadow_l", tile_shadow("l")),
        ("shadow_r", tile_shadow("r")),
        ("shadow_corner_l", tile_shadow("corner_l")),
        ("shadow_corner_r", tile_shadow("corner_r")),
    ]


def build_props() -> List[Tuple[str, Canvas]]:
    return [
        ("torch_0", prop_torch(0)),
        ("torch_1", prop_torch(1)),
        ("torch_2", prop_torch(2)),
        ("torch_3", prop_torch(3)),
        ("chest_closed", prop_chest()),
        ("barrel", prop_barrel()),
        ("urn", prop_urn()),
        ("bones", prop_bones()),
        ("rubble", prop_rubble()),
        ("chain", prop_chain()),
        ("skulls_candle", prop_skulls()),
    ]


def build_props_tall() -> List[Tuple[str, Canvas]]:
    return [("pillar", prop_pillar(False)), ("pillar_broken", prop_pillar(True))]


def assemble(frames: Sequence[Tuple[str, Canvas]], fw: int, fh: int) -> Canvas:
    sheet = Canvas(fw * len(frames), fh)
    for i, (_, c) in enumerate(frames):
        for y in range(fh):
            o_src = y * fw * 4
            o_dst = (y * sheet.w + i * fw) * 4
            sheet.buf[o_dst:o_dst + fw * 4] = c.buf[o_src:o_src + fw * 4]
    return sheet


def slice_sheet(sheet: Canvas, fw: int, fh: int) -> List[Canvas]:
    out = []
    for i in range(sheet.w // fw):
        c = Canvas(fw, fh)
        for y in range(fh):
            o_src = (y * sheet.w + i * fw) * 4
            c.buf[y * fw * 4:(y + 1) * fw * 4] = sheet.buf[o_src:o_src + fw * 4]
        out.append(c)
    return out


# ---------------------------------------------------------------------------
# Texto suave via PowerShell System.Drawing (rotulos da prancha e HUD do mockup)
# ---------------------------------------------------------------------------

POWERSHELL_TEXT = r'''
param([string]$SpecPath)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$spec = Get-Content -Raw -Encoding UTF8 $SpecPath | ConvertFrom-Json
$src = [System.Drawing.Bitmap]::FromFile($spec.inPath)
$bmp = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$g.DrawImage($src, 0, 0, $src.Width, $src.Height)
$src.Dispose()
$g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$fmt = [System.Drawing.StringFormat]::GenericTypographic
foreach ($it in $spec.items) {
  try { $fam = New-Object System.Drawing.FontFamily($it.font) } catch { $fam = New-Object System.Drawing.FontFamily("Georgia") }
  $style = if ($it.bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
  if (-not $fam.IsStyleAvailable($style)) { $style = [System.Drawing.FontStyle]::Regular }
  $size = [float]$it.size
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddString([string]$it.text, $fam, [int]$style, $size, (New-Object System.Drawing.PointF(0, 0)), $fmt)
  $b = $path.GetBounds()
  $asc = $size * $fam.GetCellAscent($style) / $fam.GetEmHeight($style)
  $w = $b.Width + $b.X
  $dx = [float]$it.x
  if ($it.align -eq "c") { $dx = $dx - $w / 2 } elseif ($it.align -eq "r") { $dx = $dx - $w }
  $dy = [float]$it.y - ($asc - 0.36 * $size)
  $m = New-Object System.Drawing.Drawing2D.Matrix
  $m.Translate($dx, $dy)
  $path.Transform($m)
  if ([float]$it.strokeW -gt 0) {
    $sc = $it.stroke
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb([int]$sc[3], [int]$sc[0], [int]$sc[1], [int]$sc[2]), [float]$it.strokeW)
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPath($pen, $path)
    $pen.Dispose()
  }
  $c = $it.color
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb([int]$c[3], [int]$c[0], [int]$c[1], [int]$c[2]))
  $g.FillPath($brush, $path)
  $brush.Dispose()
  $path.Dispose()
}
$g.Dispose()
$bmp.Save($spec.outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "OK"
'''


def text_item(text: str, x: float, y: float, size: float, color: Sequence[int],
              font: str = "Palatino Linotype", bold: bool = False, align: str = "l",
              stroke: Sequence[int] = (5, 7, 12, 230), stroke_w: float = 0.0) -> Dict[str, object]:
    col = list(color) + ([255] if len(color) == 3 else [])
    stc = list(stroke) + ([255] if len(stroke) == 3 else [])
    return {"text": text, "x": x, "y": y, "size": size, "color": col, "font": font,
            "bold": bold, "align": align, "stroke": stc, "strokeW": stroke_w}


def render_text_overlay(cv: Canvas, items: Sequence[Dict[str, object]], out_path: Path) -> None:
    """Grava `cv`, aplica os textos (antialias) com System.Drawing e salva em `out_path`."""
    with tempfile.TemporaryDirectory(prefix="submundo_dungeon_") as tmp_dir:
        tmp = Path(tmp_dir)
        base_png = tmp / "base.png"
        write_png(base_png, cv)
        spec = {"inPath": str(base_png), "outPath": str(tmp / "out.png"), "items": list(items)}
        (tmp / "spec.json").write_text(json.dumps(spec, ensure_ascii=False), encoding="utf-8")
        (tmp / "text.ps1").write_text(POWERSHELL_TEXT, encoding="utf-8-sig")
        res = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(tmp / "text.ps1"),
             "-SpecPath", str(tmp / "spec.json")],
            capture_output=True, text=True, encoding="utf-8", errors="replace")
        if res.returncode != 0 or "OK" not in res.stdout:
            raise RuntimeError(f"Falha no texto via System.Drawing:\n{res.stdout}\n{res.stderr}")
        # normaliza para o codec proprio (saida estavel byte a byte)
        write_png(out_path, read_png(tmp / "out.png"))


# ---------------------------------------------------------------------------
# Prancha 3x
# ---------------------------------------------------------------------------

def upscale(src: Canvas, k: int) -> Canvas:
    out = Canvas(src.w * k, src.h * k)
    for y in range(src.h):
        for x in range(src.w):
            c = src.get(x, y)
            if c[3]:
                for yy in range(k):
                    o = ((y * k + yy) * out.w + x * k) * 4
                    out.buf[o:o + 4 * k] = bytes(c) * k
    return out


def build_preview(tiles, props, tall) -> None:
    K = 3
    cell_w = T * K + 34
    pad = 24
    cols = 8
    bg = (18, 18, 24, 255)
    tile_rows = math.ceil(len(tiles) / cols)
    prop_rows = math.ceil(len(props) / cols)
    tiles_h = tile_rows * (T * K + 30)
    props_h = prop_rows * (T * K + 30)
    tall_h = max(64 * K + 30, 6 * T * 2 + 10)
    W = pad * 2 + cols * cell_w
    H = 56 + tiles_h + 40 + props_h + 40 + tall_h + pad
    cv = Canvas(W, H, bg)
    labels: List[Dict[str, object]] = []
    labels.append(text_item("SUBMUNDO · Masmorra Básica 2.5D (M8 piloto) — prancha 3×", pad, 22, 18,
                            (241, 210, 138), "Palatino Linotype", True))

    def checker(x0: int, y0: int, w: int, h: int) -> None:
        for y in range(h):
            for x in range(w):
                c = (30, 30, 38, 255) if ((x // 12) + (y // 12)) % 2 else (24, 24, 31, 255)
                cv.put(x0 + x, y0 + y, c)

    def place_group(items, y0: int, fh: int, title: str) -> int:
        labels.append(text_item(title, pad, y0 - 14, 13, (148, 163, 184), "Consolas", True))
        for i, (name, c) in enumerate(items):
            col, row = i % cols, i // cols
            x = pad + col * cell_w
            y = y0 + row * (fh * K + 30)
            checker(x, y, T * K, fh * K)
            blit(cv, upscale(c, K), x, y)
            labels.append(text_item(f"{i}: {name}", x, y + fh * K + 9, 8.6, (226, 232, 240), "Consolas"))
        return y0 + math.ceil(len(items) / cols) * (fh * K + 30)

    y = 56
    y = place_group(tiles, y, T, "dungeon_basic_tiles.png — 32×32 · %d frames" % len(tiles)) + 40
    y = place_group(props, y, T, "dungeon_basic_props.png — 32×32 · %d frames (torch_0..3 = animação 4f)" % len(props)) + 40
    place_group(tall, y, 64, "dungeon_basic_props_tall.png — 32×64 · %d frames" % len(tall))
    # amostra montada da sala (1x->2x) ao lado dos props altos
    sample = compose_sample(tiles, props, tall)
    sx = pad + 3 * cell_w
    labels.append(text_item("amostra montada (2×)", sx, y - 14, 13, (148, 163, 184), "Consolas", True))
    blit(cv, upscale(sample, 2), sx, y)
    render_text_overlay(cv, labels, PREVIEW_PNG)


def compose_sample(tiles, props, tall) -> Canvas:
    names = {n: c for n, c in tiles}
    pr = {n: c for n, c in props}
    cols, rows = 10, 3 + 0
    grid = [
        ["corner_in_tl"] + ["wall_top_s"] * 8 + ["corner_in_tr"],
        ["wall_side_l", "wall_face_upper", "wall_face_upper_cracked", "wall_face_upper", "door_arch_l", "door_arch_r",
         "wall_face_upper", "wall_face_upper", "wall_face_upper", "wall_side_r"],
        ["wall_side_l", "wall_face_lower", "wall_face_lower", "wall_face_lower", "door_open_l", "door_open_r",
         "wall_face_lower", "wall_face_lower_grate", "wall_face_lower", "wall_side_r"],
        ["wall_side_l", "floor_0", "floor_1", "floor_2", "door_threshold_l", "door_threshold_r", "floor_moss",
         "floor_0", "floor_1", "wall_side_r"],
        ["wall_side_l", "floor_1", "floor_cracked", "floor_0", "floor_2", "floor_1", "floor_0", "floor_blood",
         "floor_2", "wall_side_r"],
        ["corner_in_bl"] + ["wall_bottom"] * 8 + ["corner_in_br"],
    ]
    rows = len(grid)
    cv = Canvas(cols * T, rows * T, (9, 9, 11, 255))
    for r, row in enumerate(grid):
        for c, n in enumerate(row):
            blit(cv, names[n], c * T, r * T)
    blit(cv, names["shadow_corner_l"], 1 * T, 3 * T)
    for c in range(2, 8):
        blit(cv, names["shadow_s"], c * T, 3 * T)
    blit(cv, names["shadow_corner_r"], 8 * T, 3 * T)
    blit(cv, names["shadow_l"], 1 * T, 4 * T)
    blit(cv, names["shadow_r"], 8 * T, 4 * T)
    blit(cv, pr["torch_0"], 3 * T, 1 * T)
    blit(cv, pr["torch_2"], 6 * T, 1 * T)
    blit(cv, pr["chain"], 8 * T, 1 * T)
    blit(cv, pr["chest_closed"], 7 * T, 4 * T)
    blit(cv, pr["bones"], 2 * T, 4 * T)
    return cv


# ---------------------------------------------------------------------------
# BRF-135 / T-126 (Decisao #20): portas em todas as paredes, corredores com
# curva e salas nao retangulares -> sheet novo dungeon_basic_doors.png
# ---------------------------------------------------------------------------
#
# Autotile das tampas ("cap"): cada celula de parede que nao e face olha os
# 8 vizinhos. R = piso ou face (inclui porta norte). Uma borda recebe aro
# quando o vizinho ortogonal e R; um canto recebe "ponto" (aro de quina)
# quando so o vizinho diagonal e R. Nome = cap_<bordas em ordem n,e,s,w>
# [_d<diagonal>...]. Os casos que ja existem no sheet de tiles mantem o nome
# antigo (CAP_LOOKUP abaixo).

SEAL_FILL: RGB = (11, 6, 24)  # 0x0b0618 (selo da cena)
SEAL_RING: RGB = (192, 132, 252)  # #c084fc
SEAL_CORE: RGB = (233, 213, 255)  # #e9d5ff
SEAL_GLOW: RGB = (168, 85, 247)  # #a855f7
SLOT0, SLOT1 = 19, 45  # abertura das portas (igual ao vao do arco norte: x 19..44 em 64 px)

DOT_PATTERN = (((29, 29), SIDE_RIM_LO), ((30, 29), SIDE_RIM_LO), ((31, 29), SIDE_RIM_LO),
               ((29, 30), SIDE_RIM_LO), ((29, 31), SIDE_RIM_LO), ((30, 30), SIDE_RIM),
               ((31, 30), SIDE_RIM), ((30, 31), SIDE_RIM), ((31, 31), RIM))


def corner_dot(cv: Canvas, diag: str) -> None:
    for (x, y), c in DOT_PATTERN:
        xx = x if "e" in diag else T - 1 - x
        yy = y if "s" in diag else T - 1 - y
        cv.put(xx, yy, rgba(c))


def tile_cap_combo(edges: str, dots: Sequence[str], seed: int) -> Canvas:
    cv = cap_base(seed)
    for e in "nswe":  # mesma ordem dos corner_out_* existentes
        if e in edges:
            {"n": rim_n, "s": rim_s, "w": rim_w, "e": rim_e}[e](cv)
    for d in dots:
        corner_dot(cv, d)
    return cv


CAP_COMBOS: Sequence[Tuple[str, Sequence[str]]] = (
    ("ns", ()), ("ew", ()), ("nes", ()), ("esw", ()), ("nsw", ()), ("new", ()), ("nesw", ()),
    ("n", ("se",)), ("n", ("sw",)), ("s", ("ne",)), ("s", ("nw",)),
    ("e", ("nw",)), ("e", ("sw",)), ("w", ("ne",)), ("w", ("se",)),
    ("", ("ne", "nw")), ("", ("se", "sw")), ("", ("ne", "se")), ("", ("nw", "sw")),
)


def cap_name(edges: str, dots: Sequence[str]) -> str:
    return "cap_" + "_".join(([edges] if edges else []) + ["d" + d for d in dots])


# (bordas, pontos) -> (sheet, frame). Bordas na ordem n,e,s,w; pontos ordenados.
CAP_LOOKUP: Dict[Tuple[str, Tuple[str, ...]], Tuple[str, str]] = {
    ("", ()): ("tiles", "wall_top"),
    ("s", ()): ("tiles", "wall_top_s"),
    ("e", ()): ("tiles", "wall_side_l"),
    ("w", ()): ("tiles", "wall_side_r"),
    ("n", ()): ("tiles", "wall_bottom"),
    ("", ("se",)): ("tiles", "corner_in_tl"),
    ("", ("sw",)): ("tiles", "corner_in_tr"),
    ("", ("ne",)): ("tiles", "corner_in_bl"),
    ("", ("nw",)): ("tiles", "corner_in_br"),
    ("nw", ()): ("tiles", "corner_out_tl"),
    ("ne", ()): ("tiles", "corner_out_tr"),
    ("sw", ()): ("tiles", "corner_out_bl"),
    ("es", ()): ("tiles", "corner_out_br"),
}
for _e, _d in CAP_COMBOS:
    CAP_LOOKUP[(_e, tuple(sorted(_d)))] = ("doors", cap_name(_e, _d))


def rim_v(cv: Canvas, x_out: int, inward: int, y0: int, y1: int) -> None:
    """Aro vertical de 3 px (igual a rim_e/rim_w) na coluna x_out, voltado para fora."""
    for y in range(y0, y1):
        cv.put(x_out, y, rgba(SIDE_RIM_LO))
        cv.put(x_out + inward, y, rgba(SIDE_RIM if y % 11 else RIM))
        cv.put(x_out + 2 * inward, y, rgba(SIDE_RIM_LO))


def rim_h_n(cv: Canvas, y_out: int, x0: int, x1: int) -> None:
    """Aro horizontal fino (igual a rim_n) com a borda externa em y_out (voltado para cima)."""
    for x in range(x0, x1):
        cv.put(x, y_out, rgba(SIDE_RIM_LO))
        cv.put(x, y_out + 1, rgba(SIDE_RIM if x % 7 else RIM))
        cv.put(x, y_out + 2, rgba(SIDE_RIM_LO))


def floor_patch(w: int, h: int, seed: int) -> Canvas:
    cv = Canvas(w, h)
    variants = ("a", "b", "c")
    for ty in range(0, h, T):
        for tx in range(0, w, T):
            k = (tx // T) + (ty // T) * 3
            blit(cv, tile_floor(variants[k % 3], seed + k), tx, ty)
    return cv


def front_face(cv: Canvas, x0: int, x1: int, y0: int, y1: int, rng: random.Random) -> None:
    """Face frontal curta (2.5D) de um batente: tijolo miudo + aresta clara + base escura."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            yin = (y - y0) % 4
            xm = (x + (2 if ((y - y0) // 4) % 2 else 0)) % 8
            base = (50, 48, 60) if ((x // 8) + (y // 4)) % 2 else (45, 43, 55)
            col = BRICK_MORTAR if (yin == 0 or xm == 0) else base
            if y == y0:
                col = (70, 70, 84)
            elif y == y1 - 1:
                col = (14, 14, 18)
            elif col != BRICK_MORTAR and rng.random() < 0.1:
                col = shade(col, 0.86)
            cv.put(x, y, rgba(col))


def apply_seal(cv: Canvas, inside: Callable[[int, int], bool], cx: float, cy: float, r: float) -> None:
    """Selo runico roxo translucido (mesmo desenho do buildTestSeal da cena)."""
    for y in range(cv.h):
        for x in range(cv.w):
            if inside(x, y):
                cv.blend_pixel(x, y, rgba(SEAL_FILL, 205))
    for y in range(cv.h):
        for x in range(cv.w):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if inside(x, y) and d < r * 1.7:
                cv.blend_pixel(x, y, rgba(SEAL_GLOW, int(70 * (1 - d / (r * 1.7)))))
    for y in range(cv.h):
        for x in range(cv.w):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if abs(d - r) < 0.72:
                cv.put(x, y, rgba(SEAL_RING))
            elif abs(d - r) < 1.25:
                cv.blend_pixel(x, y, rgba(SEAL_GLOW, 120))
            elif abs(d - r * 0.6) < 0.6:
                cv.put(x, y, rgba(SEAL_CORE))
    for k in range(8):
        a = k * math.pi / 4
        for i in range(12):
            t = 0.7 + (1.15 - 0.7) * i / 11
            cv.put(int(math.floor(cx + math.cos(a) * r * t)), int(math.floor(cy + math.sin(a) * r * t)),
                   rgba(SEAL_CORE if t < 0.9 else SEAL_RING))
    for i in range(-int(r * 0.4), int(r * 0.4) + 1):
        cv.put(int(math.floor(cx + i)), int(math.floor(cy)), rgba(SEAL_CORE))
    for i in range(-int(r * 0.3), int(r * 0.5) + 1):
        cv.put(int(math.floor(cx)), int(math.floor(cy + i)), rgba(SEAL_CORE))
    cv.put(int(math.floor(cx)), int(math.floor(cy)), rgba((255, 255, 255)))


def door_opening(x: int, y: int) -> bool:
    dx = x + 0.5 - 31.5
    return (abs(dx) < 12.5 and y >= 27) or (math.hypot(dx, y + 0.5 - 27.0) < 12.5 and y < 27)


def build_door_sealed() -> Canvas:
    cv = build_door()
    apply_seal(cv, door_opening, 31.5, 38.0, 10.0)
    return cv


def build_door_n_link() -> Canvas:
    """Tampa sobre o arco norte quando um corredor continua para o norte (64x32)."""
    cv = Canvas(64, T)
    blit(cv, cap_base(9401), 0, 0)
    blit(cv, cap_base(9402), 32, 0)
    fl = floor_patch(64, T, 9403)
    for y in range(T):
        f = 0.92 - 0.55 * (y / (T - 1))  # escurece rumo ao vao do arco
        for x in range(SLOT0, SLOT1):
            c = fl.get(x, y)
            cv.put(x, y, rgba(shade(c[:3], f)))
    # sombra dos blocos sobre a passagem
    for y in range(T):
        for x, f in ((SLOT0, 0.45), (SLOT0 + 1, 0.7), (SLOT1 - 1, 0.6), (SLOT1 - 2, 0.82)):
            c = cv.get(x, y)
            cv.put(x, y, rgba(shade(c[:3], f)))
    rim_h_n(cv, 0, 0, SLOT0)
    rim_h_n(cv, 0, SLOT1, 64)
    for x0, x1 in ((0, SLOT0), (SLOT1, 64)):
        for x in range(x0, x1):
            cv.put(x, 28, rgba(shade(cv.get(x, 28)[:3], 0.8)))
            cv.put(x, 29, rgba(SIDE_RIM_LO))
            cv.put(x, 30, rgba(RIM if x % 9 else RIM_HI))
            cv.put(x, 31, rgba(RIM_LO))
    rim_v(cv, SLOT0 - 1, -1, 0, T)
    rim_v(cv, SLOT1, 1, 0, T)
    draw_rune(cv, 7, 12, RUNE_GLYPHS[1], False)
    draw_rune(cv, 54, 12, RUNE_GLYPHS[3], False)
    return cv


def build_door_s(sealed: bool) -> Canvas:
    """Porta na parede sul (abertura no wall_bottom, 64x32)."""
    cv = Canvas(64, T)
    rng = random.Random(9501)
    blit(cv, cap_base(9502), 0, 0)
    blit(cv, cap_base(9503), 32, 0)
    fl = floor_patch(64, T, 9504)
    for y in range(T):
        for x in range(SLOT0, SLOT1):
            c = fl.get(x, y)
            f = 0.62 if x in (SLOT0, SLOT1 - 1) else (0.8 if x in (SLOT0 + 1, SLOT1 - 2) else 0.95)
            cv.put(x, y, rgba(shade(c[:3], f)))
    rim_h_n(cv, 0, 0, SLOT0)
    rim_h_n(cv, 0, SLOT1, 64)
    rim_v(cv, SLOT0 - 1, -1, 0, 25)
    rim_v(cv, SLOT1, 1, 0, 25)
    # face sul dos batentes (vista 2.5D) com runas
    front_face(cv, 0, SLOT0, 25, 32, rng)
    front_face(cv, SLOT1, 64, 25, 32, rng)
    for x in (SLOT0 - 1, SLOT1):
        for y in range(25, 32):
            cv.put(x, y, rgba((12, 12, 16)))
    draw_rune(cv, 8, 10, RUNE_GLYPHS[2], True)
    draw_rune(cv, 53, 10, RUNE_GLYPHS[0], True)
    # soleira runica atravessando a passagem
    for x in range(SLOT0 + 2, SLOT1 - 2):
        cv.put(x, 4, rgba((58, 58, 70)))
        cv.put(x, 5, rgba((14, 70, 98) if x % 3 else RUNE_D))
        cv.put(x, 6, rgba((8, 8, 12)))
    if sealed:
        apply_seal(cv, lambda x, y: SLOT0 <= x < SLOT1, 31.5, 17.0, 10.0)
    return cv


def build_door_side(sealed: bool, east: bool) -> Canvas:
    """Porta na parede oeste (east=False) ou leste (east=True): coluna 32x64 com passagem."""
    cv = Canvas(T, 64)
    rng = random.Random(9601 + (7 if east else 0))
    blit(cv, cap_base(9602 + (7 if east else 0)), 0, 0)
    blit(cv, cap_base(9603 + (7 if east else 0)), 0, 32)
    fl = floor_patch(T, 64, 9604 + (7 if east else 0))
    for y in range(SLOT0, SLOT1):
        for x in range(T):
            c = fl.get(x, y)
            f = 0.55 if y == SLOT0 else (0.72 if y == SLOT0 + 1 else (0.86 if y < SLOT0 + 5 else 0.97))
            cv.put(x, y, rgba(shade(c[:3], f)))
    # batente de cima: tampa + face sul curta; batente de baixo: tampa com aro norte
    rim_v(cv, 0, 1, 0, 12)
    rim_v(cv, T - 1, -1, 0, 12)
    front_face(cv, 0, T, 12, SLOT0, rng)
    rim_v(cv, 0, 1, SLOT1, 64)
    rim_v(cv, T - 1, -1, SLOT1, 64)
    rim_h_n(cv, SLOT1, 0, T)
    cv.put(0, SLOT1, rgba(SIDE_RIM_LO))
    cv.put(T - 1, SLOT1, rgba(SIDE_RIM_LO))
    # filete runico no piso da passagem (lado da sala)
    fx = 6 if east else T - 7
    for y in range(SLOT0 + 3, SLOT1 - 1):
        cv.put(fx, y, rgba((14, 70, 98) if y % 3 else RUNE_D))
        cv.put(fx + (1 if east else -1), y, rgba((8, 8, 12)))
    draw_rune(cv, 14, 13, RUNE_GLYPHS[1 if east else 2], True)
    draw_rune(cv, 14, 52, RUNE_GLYPHS[3 if east else 0], False)
    if sealed:
        apply_seal(cv, lambda x, y: SLOT0 <= y < SLOT1, 15.5, 32.0, 10.0)
    return cv


def tile_face_end(kind: str, sides: str, seed: int) -> Canvas:
    """Face frontal que termina numa aresta (bloco convexo visto de frente)."""
    cv = tile_face(kind, seed)
    upper = kind == "upper"
    for side in sides:
        for y in range(T):
            gy = (0 if upper else T) + y
            course = gy // 8
            mortar = gy % 8 == 0
            quoin = 9 if course % 2 else 5  # pedras de cunhal alternadas (longa/curta)
            for i in range(quoin + 1):
                x = i if side == "l" else T - 1 - i
                if i == 0:
                    col = SIDE_RIM_LO
                elif i == 1:
                    col = (82, 82, 98) if not mortar else SIDE_RIM
                elif i == 2:
                    col = SIDE_RIM_LO if not mortar else BRICK_MORTAR
                elif i == quoin:
                    col = BRICK_MORTAR
                else:
                    col = BRICK_MORTAR if mortar else ((56, 55, 68) if i == 3 else (52, 51, 63))
                if not upper and y >= 24:  # rodape
                    col = {0: SIDE_RIM_LO, 1: (66, 66, 79), 2: (38, 38, 47)}.get(i, cv.get(x, y)[:3])
                    if y >= 30:
                        col = (14, 14, 18) if i else SIDE_RIM_LO
                cv.put(x, y, rgba(col))
    if upper:
        overhang_shadow(cv)
    return cv


def build_doors_sheet() -> List[Tuple[str, Canvas]]:
    def sub(src: Canvas, x: int, y: int) -> Canvas:
        c = Canvas(T, T)
        for yy in range(T):
            for xx in range(T):
                c.put(xx, yy, src.get(x + xx, y + yy))
        return c

    sealed = build_door_sealed()
    link = build_door_n_link()
    ds, dss = build_door_s(False), build_door_s(True)
    dw, dws = build_door_side(False, False), build_door_side(True, False)
    de, des = build_door_side(False, True), build_door_side(True, True)
    frames: List[Tuple[str, Canvas]] = [
        ("door_arch_sealed_l", sub(sealed, 0, 0)),
        ("door_arch_sealed_r", sub(sealed, 32, 0)),
        ("door_open_sealed_l", sub(sealed, 0, 32)),
        ("door_open_sealed_r", sub(sealed, 32, 32)),
        ("door_n_link_l", sub(link, 0, 0)),
        ("door_n_link_r", sub(link, 32, 0)),
        ("door_s_l", sub(ds, 0, 0)),
        ("door_s_r", sub(ds, 32, 0)),
        ("door_s_sealed_l", sub(dss, 0, 0)),
        ("door_s_sealed_r", sub(dss, 32, 0)),
        ("door_w_t", sub(dw, 0, 0)),
        ("door_w_b", sub(dw, 0, 32)),
        ("door_w_sealed_t", sub(dws, 0, 0)),
        ("door_w_sealed_b", sub(dws, 0, 32)),
        ("door_e_t", sub(de, 0, 0)),
        ("door_e_b", sub(de, 0, 32)),
        ("door_e_sealed_t", sub(des, 0, 0)),
        ("door_e_sealed_b", sub(des, 0, 32)),
        ("wall_face_upper_end_l", tile_face_end("upper", "l", 311)),
        ("wall_face_upper_end_r", tile_face_end("upper", "r", 312)),
        ("wall_face_upper_end_lr", tile_face_end("upper", "lr", 313)),
        ("wall_face_lower_end_l", tile_face_end("lower", "l", 314)),
        ("wall_face_lower_end_r", tile_face_end("lower", "r", 315)),
        ("wall_face_lower_end_lr", tile_face_end("lower", "lr", 316)),
    ]
    for i, (e, d) in enumerate(CAP_COMBOS):
        frames.append((cap_name(e, d), tile_cap_combo(e, d, 220 + i)))
    return frames


# ---------------------------------------------------------------------------
# Amostra montada por autotile (valida a convencao para a cena)
# ---------------------------------------------------------------------------

def sample_map() -> Tuple[int, int, set, Dict[Tuple[int, int], str], Dict[Tuple[int, int], str]]:
    """Retorna (W, H, piso, portas-piso, portas-face). Coordenadas em celulas."""
    W, H = 31, 31
    floor: set = set()

    def rect(x0: int, y0: int, x1: int, y1: int) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                floor.add((x + 1, y + 1))

    rect(14, 3, 19, 6)  # sala pequena B
    rect(2, 18, 12, 25)  # sala grande A
    rect(19, 22, 27, 26)  # sala em L (perna de baixo)
    rect(24, 13, 27, 21)  # sala em L (braco de cima)
    rect(4, 13, 5, 14)  # corredor: sobe da porta norte de A
    rect(4, 11, 17, 12)  # ... vira para a direita
    rect(16, 8, 17, 10)  # ... sobe de novo ate a porta sul de B
    rect(14, 23, 17, 24)  # corredor lateral A -> L
    rect(20, 28, 21, 29)  # corredor saindo pela porta sul de L
    # portas que sao "piso" para a regra de face/sombra (sul, oeste, leste)
    doors: Dict[Tuple[int, int], str] = {}
    for (x, y), n in (((16, 7), "door_s_l"), ((17, 7), "door_s_r"),
                      ((20, 27), "door_s_l"), ((21, 27), "door_s_r"),
                      ((13, 23), "door_e_t"), ((13, 24), "door_e_b"),
                      ((18, 23), "door_w_sealed_t"), ((18, 24), "door_w_sealed_b")):
        doors[(x + 1, y + 1)] = n
    # portas norte (substituem face/tampa)
    north: Dict[Tuple[int, int], str] = {}
    for (x, y), n in (((4, 16), "door_arch_l"), ((5, 16), "door_arch_r"),
                      ((4, 17), "door_open_l"), ((5, 17), "door_open_r"),
                      ((4, 15), "door_n_link_l"), ((5, 15), "door_n_link_r"),
                      ((16, 1), "door_arch_sealed_l"), ((17, 1), "door_arch_sealed_r"),
                      ((16, 2), "door_open_sealed_l"), ((17, 2), "door_open_sealed_r")):
        north[(x + 1, y + 1)] = n
    return W, H, floor, doors, north


def autotile_sample(W: int, H: int, floor: set, doors: Dict, north: Dict) -> Dict[Tuple[int, int], List[Tuple[str, str]]]:
    """Camadas por celula: lista de (sheet, frame). Implementa a convencao do guia 3.3."""
    def F(c):  # piso de verdade
        return c in floor

    face: Dict[Tuple[int, int], str] = {}
    for y in range(H):
        for x in range(W):
            c = (x, y)
            if F(c) or c in doors:
                continue
            if F((x, y + 1)):
                face[c] = "lower"
            elif not F((x, y + 1)) and (x, y + 1) not in doors and F((x, y + 2)):
                face[c] = "upper"

    def R(c):
        return F(c) or c in face

    def is_wall(c):  # bloqueia luz (gera sombra): nem piso nem porta
        return not F(c) and c not in doors

    out: Dict[Tuple[int, int], List[Tuple[str, str]]] = {}
    for y in range(H):
        for x in range(W):
            c = (x, y)
            layers: List[Tuple[str, str]] = []
            if c in north and north[c].startswith("door_n_link"):
                layers.append(("doors", north[c]))
            elif c in north:
                layers.append(("doors" if "sealed" in north[c] else "tiles", north[c]))
            elif c in doors:
                layers.append(("doors", doors[c]))
            elif F(c):
                h = (x * 73856093 ^ y * 19349663) & 0xFFFF
                fname = ("floor_0", "floor_1", "floor_2")[h % 3]
                if h % 23 == 0:
                    fname = "floor_cracked"
                elif h % 29 == 0:
                    fname = "floor_moss"
                elif h % 37 == 0:
                    fname = "floor_blood"
                above = (x, y - 1)
                if above in north and "open" in north[above]:
                    fname = "door_threshold_l" if north[above].endswith("_l") else "door_threshold_r"
                layers.append(("tiles", fname))
                n_face = above in face or above in north
                w_wall, e_wall = is_wall((x - 1, y)), is_wall((x + 1, y))
                if n_face and w_wall:
                    layers.append(("tiles", "shadow_corner_l"))
                elif n_face and e_wall:
                    layers.append(("tiles", "shadow_corner_r"))
                elif n_face:
                    layers.append(("tiles", "shadow_s"))
                elif w_wall:
                    layers.append(("tiles", "shadow_l"))
                elif e_wall:
                    layers.append(("tiles", "shadow_r"))
            elif c in face:
                kind = face[c]
                end = ("l" if F((x - 1, y)) else "") + ("r" if F((x + 1, y)) else "")
                if end:
                    layers.append(("doors", f"wall_face_{kind}_end_{end}"))
                else:
                    h = (x * 31 + y * 17) % 19
                    name = f"wall_face_{kind}"
                    if kind == "upper" and h == 3:
                        name = "wall_face_upper_cracked"
                    elif kind == "lower" and h == 7:
                        name = "wall_face_lower_grate"
                    layers.append(("tiles", name))
            else:
                n, e, s, w = R((x, y - 1)), R((x + 1, y)), R((x, y + 1)), R((x - 1, y))
                edges = "".join(k for k, v in (("n", n), ("e", e), ("s", s), ("w", w)) if v)
                dots = []
                for dname, dx, dy, a, b in (("ne", 1, -1, n, e), ("nw", -1, -1, n, w),
                                            ("se", 1, 1, s, e), ("sw", -1, 1, s, w)):
                    if R((x + dx, y + dy)) and not a and not b:
                        dots.append(dname)
                key = (edges, tuple(sorted(dots)))
                if key not in CAP_LOOKUP:
                    raise RuntimeError(f"combinacao de tampa sem frame em {c}: {key}")
                layers.append(CAP_LOOKUP[key])
            out[c] = layers
    return out


def compose_doors_sample(tiles, doors_frames, props) -> Canvas:
    W, H, floor, doors, north = sample_map()
    lay = autotile_sample(W, H, floor, doors, north)
    sheets = {"tiles": {n: c for n, c in tiles}, "doors": {n: c for n, c in doors_frames}}
    pr = {n: c for n, c in props}
    cv = Canvas(W * T, H * T, (9, 9, 11, 255))
    for (x, y), layers in lay.items():
        for sheet, name in layers:
            blit(cv, sheets[sheet][name], x * T, y * T)
    for (name, x, y) in (("torch_0", 3, 17), ("torch_2", 10, 17), ("torch_1", 8, 10), ("torch_3", 16, 22),
                         ("torch_0", 21, 21), ("torch_2", 26, 12), ("chain", 7, 17), ("torch_1", 15, 2),
                         ("torch_3", 19, 2)):
        blit(cv, pr[name], x * T, y * T)
    for (name, x, y) in (("chest_closed", 26, 15), ("bones", 9, 24), ("barrel", 3, 25), ("urn", 27, 26),
                         ("rubble", 12, 12), ("skulls_candle", 19, 5)):
        blit(cv, pr[name], x * T, y * T)
    return cv


def build_doors_preview(tiles, doors_frames, props) -> None:
    K = 3
    cell_w = T * K + 46
    pad = 24
    cols = 8
    bg = (18, 18, 24, 255)
    rows = math.ceil(len(doors_frames) / cols)
    grid_h = rows * (T * K + 30)
    sample = compose_doors_sample(tiles, doors_frames, props)
    SK = 2
    W = max(pad * 2 + cols * cell_w, pad * 2 + sample.w * SK)
    H = 56 + grid_h + 44 + sample.h * SK + pad
    cv = Canvas(W, H, bg)
    labels: List[Dict[str, object]] = []
    labels.append(text_item("SUBMUNDO · Masmorra Básica 2.5D — portas em todas as paredes, corredores com curva e "
                            "salas não retangulares (BRF-135) — prancha 3×", pad, 22, 18,
                            (241, 210, 138), "Palatino Linotype", True))
    labels.append(text_item("dungeon_basic_doors.png — 32×32 · %d frames" % len(doors_frames),
                            pad, 42, 13, (148, 163, 184), "Consolas", True))
    y0 = 56
    for i, (name, c) in enumerate(doors_frames):
        col, row = i % cols, i // cols
        x = pad + col * cell_w
        y = y0 + row * (T * K + 30)
        for yy in range(T * K):
            for xx in range(T * K):
                cv.put(x + xx, y + yy, (30, 30, 38, 255) if ((xx // 12) + (yy // 12)) % 2 else (24, 24, 31, 255))
        blit(cv, upscale(c, K), x, y)
        labels.append(text_item(f"{i}: {name}", x, y + T * K + 9, 8.6, (226, 232, 240), "Consolas"))
    sy = y0 + grid_h + 44
    labels.append(text_item("amostra montada por autotile (2×): sala em L, sala pequena, sala grande; corredor que "
                            "sobe, vira à direita e sobe de novo; porta lateral, porta sul e portas seladas",
                            pad, sy - 16, 13, (148, 163, 184), "Consolas", True))
    blit(cv, upscale(sample, SK), pad, sy)
    render_text_overlay(cv, labels, DOORS_PREVIEW_PNG)


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------

def update_manifest(entries: Sequence[Tuple[str, int, int, Sequence[str], Dict[str, object]]]) -> None:
    raw_bytes = MANIFEST_JSON.read_bytes()
    newline = "\r\n" if b"\r\n" in raw_bytes else "\n"
    manifest = json.loads(raw_bytes.decode("utf-8"))
    sprites = manifest.setdefault("sprites", {})
    for key, fw, fh, frames, extra in entries:
        entry: Dict[str, object] = {
            "key": key,
            "file": f"{key}.png",
            "width": fw * len(frames),
            "height": fh,
            "frameWidth": fw,
            "frameHeight": fh,
            "frames": list(frames),
        }
        entry.update(extra)
        sprites[key] = entry
    serialized = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    if newline == "\r\n":
        serialized = serialized.replace("\n", "\r\n")
    MANIFEST_JSON.write_bytes(serialized.encode("utf-8"))
    print(f"Atualizado: {MANIFEST_JSON}")


def main() -> None:
    tiles = build_tiles()
    props = build_props()
    tall = build_props_tall()
    write_png(TILES_PNG, assemble(tiles, T, T))
    write_png(PROPS_PNG, assemble(props, T, T))
    write_png(PROPS_TALL_PNG, assemble(tall, T, 64))
    doors = build_doors_sheet()
    write_png(DOORS_PNG, assemble(doors, T, T))
    for p in (TILES_PNG, PROPS_PNG, PROPS_TALL_PNG, DOORS_PNG):
        print(f"Gerado: {p}")
    update_manifest([
        ("dungeon_basic_tiles", T, T, [n for n, _ in tiles], {}),
        ("dungeon_basic_doors", T, T, [n for n, _ in doors], {}),
        ("dungeon_basic_props", T, T, [n for n, _ in props],
         {"animations": {"torch": {"frames": [0, 1, 2, 3], "frameRate": 8, "repeat": -1}}}),
        ("dungeon_basic_props_tall", T, 64, [n for n, _ in tall], {"origin": {"x": 0.5, "y": 0.95}}),
    ])
    build_preview(tiles, props, tall)
    print(f"Gerado: {PREVIEW_PNG}")
    build_doors_preview(tiles, doors, props)
    print(f"Gerado: {DOORS_PREVIEW_PNG}")


if __name__ == "__main__":
    main()
