"""
SUBMUNDO - Kit compartilhado dos biomas subterraneos (BRF-137 / T-072, grupo `under_`)
=======================================================================================

Reaproveita o codec PNG/Canvas (buildMonstersBase) e as primitivas, sombras, selo,
autotile e texto de `buildDungeonBasic.py` (apenas importados, nunca editados) e
implementa a mesma estrutura de frames da Masmorra Basica com materiais trocaveis:

- biome_<id>_tiles.png       34 frames, mesmos nomes/ordem de dungeon_basic_tiles
- biome_<id>_doors.png       43 frames, mesmos nomes/ordem de dungeon_basic_doors
- biome_<id>_props.png       32x32, torch_0..3 = fonte de luz animada do bioma
- biome_<id>_props_tall.png  32x64
- scripts/art/biomes/out/<id>.manifest.json  (entradas no formato do manifest)
- assets/mockups/preview_m8_<id>_sheets.png  (prancha 3x + amostra por autotile)

Cada bioma e uma subclasse de `Biome` (under_<id>.py) que define paleta, materiais
(piso, tampa, face, porta, soleira), props e o mapa do mockup.
"""
from __future__ import annotations

import json
import math
import random
import sys
from pathlib import Path
from typing import Callable, Dict, List, Optional, Sequence, Tuple

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from buildMonstersBase import Canvas, read_png, write_png  # noqa: E402
import buildDungeonBasic as bdb  # noqa: E402
from buildDungeonBasic import (  # noqa: E402
    CAP_COMBOS,
    OUT,
    SLOT0,
    SLOT1,
    T,
    apply_seal,
    assemble,
    autotile_sample,
    blit,
    cap_name,
    fill_ellipse,
    fill_rect,
    flip_h,
    flip_v,
    line,
    mix,
    outline,
    render_text_overlay,
    rgba,
    shade,
    slice_sheet,
    text_item,
    tile_shadow,
    upscale,
)

ROOT = bdb.ROOT
SPRITES_DIR = bdb.SPRITES_DIR
MOCKUPS_DIR = bdb.MOCKUPS_DIR
OUT_DIR = HERE / "out"

RGB = Tuple[int, int, int]
Color = Tuple[int, int, int, int]
Frames = List[Tuple[str, Canvas]]

__all__ = [
    "Canvas", "read_png", "write_png", "bdb", "CAP_COMBOS", "OUT", "SLOT0", "SLOT1", "T", "apply_seal",
    "assemble", "autotile_sample", "blit", "cap_name", "fill_ellipse", "fill_rect", "flip_h", "flip_v",
    "line", "mix", "outline", "render_text_overlay", "rgba", "shade", "slice_sheet", "text_item",
    "tile_shadow", "upscale",
]


# ---------------------------------------------------------------------------
# Contrato de frames (lido do manifest publicado; nunca escrito)
# ---------------------------------------------------------------------------

def contract_frames(key: str) -> List[str]:
    manifest = json.loads(bdb.MANIFEST_JSON.read_text(encoding="utf-8"))
    return list(manifest["sprites"][key]["frames"])


# ---------------------------------------------------------------------------
# Ruido / celulas deterministicas e periodicas
# ---------------------------------------------------------------------------

def hash01(seed: int, x: int, y: int) -> float:
    h = (x * 374761393 + y * 668265263 + seed * 1442695041) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0


def value_noise(seed: int, x: float, y: float, cell: int, px: int, py: int) -> float:
    """Ruido de valor suave, periodico em (px, py) (multiplos de `cell`)."""
    nx, ny = max(1, px // cell), max(1, py // cell)
    gx, gy = x / cell, y / cell
    ix, iy = int(math.floor(gx)), int(math.floor(gy))
    fx, fy = gx - ix, gy - iy
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)

    def v(a: int, b: int) -> float:
        return hash01(seed, a % nx, b % ny)

    top = v(ix, iy) + (v(ix + 1, iy) - v(ix, iy)) * fx
    bot = v(ix, iy + 1) + (v(ix + 1, iy + 1) - v(ix, iy + 1)) * fx
    return top + (bot - top) * fy


def fbm(seed: int, x: float, y: float, px: int = T, py: int = T) -> float:
    return (0.55 * value_noise(seed, x, y, 16, px, py) + 0.3 * value_noise(seed + 7, x, y, 8, px, py)
            + 0.15 * value_noise(seed + 13, x, y, 4, px, py))


Point = Tuple[float, float, RGB]


def tile_points(shared_seed: int, var_seed: int, tones: Sequence[RGB], spacing: int = 10, inner_n: int = 4,
                margin: int = 11, w: int = T, h: int = T) -> List[Point]:
    """Pontos de Voronoi: faixa de borda compartilhada entre variantes (bordas casam) + miolo variavel."""
    rng = random.Random(shared_seed)
    pts: List[Point] = []
    for i in range(max(1, w // spacing)):
        x = i * spacing + rng.uniform(1, spacing - 1)
        pts.append((x % w, rng.uniform(-2.5, 2.5) % h, rng.choice(tones)))
    for j in range(max(1, h // spacing)):
        y = j * spacing + rng.uniform(1, spacing - 1)
        pts.append((rng.uniform(-2.5, 2.5) % w, y % h, rng.choice(tones)))
    rv = random.Random(var_seed)
    for _ in range(inner_n):
        pts.append((rv.uniform(margin, w - margin), rv.uniform(margin, h - margin), rv.choice(tones)))
    return pts


def free_points(seed: int, n: int, w: int, h: int, tones: Sequence[RGB]) -> List[Point]:
    rng = random.Random(seed)
    return [(rng.uniform(0, w), rng.uniform(0, h), rng.choice(tones)) for _ in range(n)]


def lattice_points(seed: int, w: int, h: int, sx: float, sy: float, jitter: float,
                   tones: Sequence[RGB]) -> List[Point]:
    """Grade hexagonal com jitter (basalto)."""
    rng = random.Random(seed)
    pts: List[Point] = []
    rows = int(round(h / sy))
    cols = int(round(w / sx))
    for r in range(rows):
        for c in range(cols):
            x = (c + (0.5 if r % 2 else 0.0)) * sx + rng.uniform(-jitter, jitter)
            y = r * sy + rng.uniform(-jitter, jitter)
            pts.append((x % w, y % h, rng.choice(tones)))
    return pts


def paint_cells(cv: Canvas, pts: Sequence[Point], crack: RGB, *, ox: int = 0, oy: int = 0,
                w: Optional[int] = None, h: Optional[int] = None, wrap_x: bool = True, wrap_y: bool = True,
                aniso: float = 1.0, edge_w: float = 1.0, bevel_w: float = 1.6, hi_f: float = 1.22,
                lo_f: float = 0.74, speck_seed: int = 1, speck: float = 0.09, dome: float = 0.10,
                mask: Optional[Callable[[int, int], bool]] = None) -> None:
    """Pinta celulas de Voronoi com junta escura e chanfro (luz do alto-esquerda)."""
    w = cv.w if w is None else w
    h = cv.h if h is None else h
    for y in range(h):
        for x in range(w):
            if mask is not None and not mask(x, y):
                continue
            px, py = x + 0.5, y + 0.5
            best = [(1e9, None, 0.0, 0.0), (1e9, None, 0.0, 0.0)]
            for (qx, qy, tone) in pts:
                dx = px - qx
                dy = py - qy
                if wrap_x:
                    if dx > w / 2:
                        dx -= w
                    elif dx < -w / 2:
                        dx += w
                if wrap_y:
                    if dy > h / 2:
                        dy -= h
                    elif dy < -h / 2:
                        dy += h
                d = math.sqrt(dx * dx + (dy * aniso) ** 2)
                if d < best[0][0]:
                    best[1] = best[0]
                    best[0] = (d, tone, dx, dy)
                elif d < best[1][0]:
                    best[1] = (d, tone, dx, dy)
            d1, tone, vx, vy = best[0]
            e = best[1][0] - d1
            if e < edge_w:
                col = crack
                if hash01(speck_seed + 3, x + ox, y + oy) < 0.15:
                    col = shade(crack, 1.35)
            else:
                lit = -(vx * 0.65 + vy) / (d1 + 3.0)
                col = shade(tone, 1.0 + dome * lit)
                if e < edge_w + bevel_w:
                    col = shade(tone, hi_f) if (vx * 0.65 + vy) < 0 else shade(tone, lo_f)
                r = hash01(speck_seed, x + ox, y + oy)
                if r < speck * 0.6:
                    col = shade(col, 0.84)
                elif r < speck:
                    col = shade(col, 1.12)
            cv.put(x + ox, y + oy, rgba(col))


def wrap_crack(cv: Canvas, seed: int, x: int, y: int, steps: int, dirx: int, dark: RGB, lit: RGB,
               branch: bool = True) -> None:
    rng = random.Random(seed)
    for i in range(steps):
        cv.put(x, y, rgba(dark))
        if cv.get(x + 1, y + 1)[:3] != dark:
            cv.put(x + 1, y + 1, rgba(lit))
        y += 1
        x += dirx if rng.random() < 0.6 else 0
        if rng.random() < 0.18:
            x -= dirx
        if branch and i == steps // 2:
            bx, by = x, y
            for _ in range(4):
                bx -= dirx
                by += 1 if rng.random() < 0.5 else 0
                cv.put(bx, by, rgba(dark))


def blob_mask(seed: int, blobs: Sequence[Tuple[float, float, float, float]], x: int, y: int,
              jitter: float = 0.3) -> float:
    inside = 9.0
    for (cx, cy, rx, ry) in blobs:
        inside = min(inside, math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry))
    return inside - jitter * hash01(seed, x, y)


def overlay_blood(cv: Canvas, seed: int, dark: RGB = (44, 10, 12), mid: RGB = (62, 14, 16),
                  hi: RGB = (86, 22, 22)) -> None:
    blobs = [(15, 17, 6.5, 4.5), (20, 13, 3.5, 3.0), (10, 21, 3.0, 2.5)]
    for y in range(T):
        for x in range(T):
            m = blob_mask(seed, blobs, x, y, 0.25)
            if m < 0.85:
                col = dark if m < 0.45 else mid
                if hash01(seed + 1, x, y) > 0.94:
                    col = hi
                cv.put(x, y, rgba(col))
    for (dx, dy) in ((26, 8), (5, 12), (24, 25), (7, 27), (28, 20)):
        cv.put(dx, dy, rgba(mid))
        cv.put(dx + 1, dy, rgba(dark))


def overlay_patch(cv: Canvas, seed: int, centers: Sequence[Tuple[float, float, float]],
                  pick: Callable[[float, float, Color], Optional[RGB]]) -> None:
    """Mancha organica (musgo, cinza, agua): pick(dist_norm, ruido, cor_antiga) -> cor."""
    for y in range(T):
        for x in range(T):
            best = 9.0
            for (cx, cy, r) in centers:
                best = min(best, math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r)
            n = hash01(seed, x, y)
            if best < 0.75 + 0.4 * n:
                c = pick(best, n, cv.get(x, y))
                if c is not None:
                    cv.put(x, y, rgba(c))


def darken(cv: Canvas, x: int, y: int, f: float) -> None:
    c = cv.get(x, y)
    if c[3]:
        cv.put(x, y, (int(c[0] * f), int(c[1] * f), int(c[2] * f), c[3]))


def tint_px(cv: Canvas, x: int, y: int, col: RGB, a: float) -> None:
    c = cv.get(x, y)
    if c[3]:
        cv.put(x, y, rgba(mix(c[:3], col, a), c[3]))


def sub(src: Canvas, x: int, y: int, w: int = T, h: int = T) -> Canvas:
    c = Canvas(w, h)
    for yy in range(h):
        for xx in range(w):
            c.put(xx, yy, src.get(x + xx, y + yy))
    return c


def contact_shadow(cv: Canvas, x0: int, x1: int, y: int, a: int = 110) -> None:
    for x in range(x0, x1):
        if not cv.get(x, y)[3]:
            cv.put(x, y, (0, 0, 0, a))


def shaded_blob(body: Canvas, cx: float, cy: float, rx: float, ry: float, pal: Sequence[RGB]) -> None:
    """Elipse com 4 tons (luz do alto-esquerda). pal = (escuro, medio, claro, brilho)."""
    def col(x: int, y: int, nx: float, ny: float) -> Color:
        l = -(nx * 0.7 + ny)
        if l > 0.85:
            return rgba(pal[3])
        if l > 0.2:
            return rgba(pal[2])
        if l > -0.6:
            return rgba(pal[1])
        return rgba(pal[0])
    fill_ellipse(body, cx, cy, rx, ry, col)


def draw_flame(cv: Canvas, cx: float, base_y: int, frame: int, heat_cols: Sequence[RGB],
               height: Sequence[int] = (12, 10, 13, 11), width: Sequence[float] = (4.6, 5.2, 4.2, 5.0),
               embers: bool = True, ember_cols: Tuple[RGB, RGB] = ((253, 224, 71), (245, 158, 11))) -> None:
    """Chama 4f parametrizada (heat_cols do mais quente ao mais frio, 5 cores)."""
    sway = (0, 1, 0, -1)[frame]
    hgt = height[frame]
    wid = width[frame]
    for y in range(base_y - hgt - 1, base_y + 1):
        t = (base_y - y) / hgt
        if t > 1.05:
            continue
        half = wid * (1 - t) ** 0.8 * (0.85 + 0.3 * math.sin(t * math.pi))
        cxf = cx + sway * t * 1.6
        for x in range(int(cx) - 9, int(cx) + 10):
            d = abs(x + 0.5 - cxf)
            if d > half + 0.25:
                continue
            rel = d / max(half, 0.6)
            heat = (1 - t) * 0.9 + (1 - rel) * 0.6
            if heat > 1.15:
                c = heat_cols[0]
            elif heat > 0.9:
                c = heat_cols[1]
            elif heat > 0.62:
                c = heat_cols[2]
            elif heat > 0.38:
                c = heat_cols[3]
            else:
                c = heat_cols[4]
            cv.put(x, y, rgba(c))
    if embers:
        pts = (((-3, -11), (3, -9)), ((2, -12),), ((-4, -13), (1, -14)), ((4, -11), (-2, -10)))[frame]
        for (ex, ey) in pts:
            cv.put(int(cx) + ex, base_y + ey, rgba(ember_cols[(ex + ey) % 2]))


def rock_edge(cv: Canvas, side: str, seed: int, outline_c: RGB, hi: RGB, mid: RGB, base_w: int = 4,
              var: int = 3) -> None:
    """Aresta convexa natural (rocha) numa face: borda irregular clara com contorno escuro."""
    for y in range(cv.h):
        w = base_w + int(var * value_noise(seed, 0, y, 8, 8, 64))
        for i in range(w + 2):
            x = i if side == "l" else cv.w - 1 - i
            if i == 0:
                col = outline_c
            elif i == 1:
                col = hi
            elif i <= w // 2 + 1:
                col = mix(hi, mid, 0.5)
            elif i <= w:
                col = mid
            else:
                c = cv.get(x, y)
                col = shade(c[:3], 0.7)
            cv.put(x, y, rgba(col))


# ---------------------------------------------------------------------------
# Bioma base
# ---------------------------------------------------------------------------

class Biome:
    id = "base"
    title = "Bioma"
    subtitle = ""
    # aros das tampas (vista de cima)
    side_rim_lo: RGB = (44, 44, 55)
    side_rim: RGB = (64, 66, 80)
    rim: RGB = (82, 82, 91)
    rim_hi: RGB = (100, 116, 139)
    rim_lo: RGB = (58, 58, 70)
    # tampa
    cap_tones: Sequence[RGB] = ((21, 21, 28), (24, 23, 31), (19, 19, 25))
    cap_crack: RGB = (9, 9, 12)
    # quinas de face (bloco convexo)
    quoin_hi: RGB = (82, 82, 98)
    quoin_tones: Tuple[RGB, RGB] = ((56, 55, 68), (52, 51, 63))
    face_mortar: RGB = (13, 13, 17)
    jamb_tones: Tuple[RGB, RGB] = ((50, 48, 60), (45, 43, 55))
    jamb_top: RGB = (70, 70, 84)
    gap_dark: RGB = (12, 12, 16)
    shadow_tint: RGB = (0, 0, 4)

    def __init__(self) -> None:
        self._cache: Dict[str, Canvas] = {}

    # ---- hooks obrigatorios ----
    def floor(self, name: str) -> Canvas:
        raise NotImplementedError

    def face(self, kind: str) -> Canvas:
        raise NotImplementedError

    def door_big(self) -> Canvas:
        raise NotImplementedError

    def door_open(self, x: int, y: int) -> bool:
        return bdb.door_opening(x, y)

    def threshold(self) -> Canvas:
        raise NotImplementedError

    def props(self) -> Frames:
        raise NotImplementedError

    def props_tall(self) -> Frames:
        raise NotImplementedError

    # ---- hooks com padrao ----
    def cap_base(self, seed: int) -> Canvas:
        cv = Canvas(T, T)
        pts = tile_points(self.cap_seed(), seed, self.cap_tones, spacing=9, inner_n=3, margin=10)
        paint_cells(cv, pts, self.cap_crack, edge_w=0.9, bevel_w=1.2, hi_f=1.14, lo_f=0.84,
                    speck_seed=self.cap_seed() + 5, speck=0.07)
        return cv

    def cap_seed(self) -> int:
        return 7100 + sum(ord(ch) for ch in self.id)

    def mark(self, cv: Canvas, x: int, y: int, idx: int, bright: bool) -> None:
        """Marca decorativa nas tampas ao lado das portas (runa na Masmorra Basica)."""

    def sill_h(self, cv: Canvas, x0: int, x1: int, y: int) -> None:
        pass

    def sill_v(self, cv: Canvas, x: int, y0: int, y1: int, east: bool) -> None:
        pass

    def rim_accent(self, cv: Canvas, edge: str) -> None:
        pass

    def jamb(self, cv: Canvas, x0: int, x1: int, y0: int, y1: int, rng: random.Random) -> None:
        for y in range(y0, y1):
            for x in range(x0, x1):
                yin = (y - y0) % 4
                xm = (x + (2 if ((y - y0) // 4) % 2 else 0)) % 8
                base = self.jamb_tones[0] if ((x // 8) + (y // 4)) % 2 else self.jamb_tones[1]
                col = self.face_mortar if (yin == 0 or xm == 0) else base
                if y == y0:
                    col = self.jamb_top
                elif y == y1 - 1:
                    col = shade(self.gap_dark, 1.1)
                elif col != self.face_mortar and rng.random() < 0.1:
                    col = shade(col, 0.86)
                cv.put(x, y, rgba(col))

    def face_end(self, kind: str, sides: str) -> Canvas:
        """Padrao: cunhal de pedras alternadas (igual a Masmorra Basica, cores do bioma)."""
        cv = self.face(kind).copy()
        upper = kind == "upper"
        for side in sides:
            for y in range(T):
                gy = (0 if upper else T) + y
                course = gy // 8
                mortar = gy % 8 == 0
                quoin = 9 if course % 2 else 5
                for i in range(quoin + 1):
                    x = i if side == "l" else T - 1 - i
                    if i == 0:
                        col = self.side_rim_lo
                    elif i == 1:
                        col = self.quoin_hi if not mortar else self.side_rim
                    elif i == 2:
                        col = self.side_rim_lo if not mortar else self.face_mortar
                    elif i == quoin:
                        col = self.face_mortar
                    else:
                        col = self.face_mortar if mortar else (self.quoin_tones[0] if i == 3 else self.quoin_tones[1])
                    if not upper and y >= 24:
                        col = {0: self.side_rim_lo, 1: shade(self.quoin_hi, 0.85), 2: shade(self.quoin_tones[1], 0.75)}.get(
                            i, cv.get(x, y)[:3])
                        if y >= 30:
                            col = shade(self.gap_dark, 1.1) if i else self.side_rim_lo
                    cv.put(x, y, rgba(col))
        if upper:
            self.overhang(cv)
        return cv

    # ---- utilitarios do bioma ----
    def overhang(self, cv: Canvas) -> None:
        for y, f in enumerate((0.3, 0.45, 0.6, 0.75, 0.88)):
            for x in range(cv.w):
                darken(cv, x, y, f)

    def floor_patch(self, w: int, h: int) -> Canvas:
        cv = Canvas(w, h)
        names = ("floor_0", "floor_1", "floor_2")
        for ty in range(0, h, T):
            for tx in range(0, w, T):
                k = (tx // T) + (ty // T) * 3
                blit(cv, self.floor(names[k % 3]), tx, ty)
        return cv

    def rim_s(self, cv: Canvas) -> None:
        for x in range(T):
            cv.put(x, 28, rgba(shade(cv.get(x, 28)[:3], 0.8)))
            cv.put(x, 29, rgba(self.side_rim_lo))
            cv.put(x, 30, rgba(self.rim if x % 9 else self.rim_hi))
            cv.put(x, 31, rgba(self.rim_lo))
        self.rim_accent(cv, "s")

    def rim_n(self, cv: Canvas) -> None:
        for x in range(T):
            cv.put(x, 0, rgba(self.side_rim_lo))
            cv.put(x, 1, rgba(self.side_rim if x % 7 else self.rim))
            cv.put(x, 2, rgba(self.side_rim_lo))
        self.rim_accent(cv, "n")

    def rim_e(self, cv: Canvas) -> None:
        for y in range(T):
            cv.put(31, y, rgba(self.side_rim_lo))
            cv.put(30, y, rgba(self.side_rim if y % 11 else self.rim))
            cv.put(29, y, rgba(self.side_rim_lo))
        self.rim_accent(cv, "e")

    def rim_w(self, cv: Canvas) -> None:
        for y in range(T):
            cv.put(0, y, rgba(self.side_rim_lo))
            cv.put(1, y, rgba(self.side_rim if y % 11 else self.rim))
            cv.put(2, y, rgba(self.side_rim_lo))
        self.rim_accent(cv, "w")

    def rim_v(self, cv: Canvas, x_out: int, inward: int, y0: int, y1: int) -> None:
        for y in range(y0, y1):
            cv.put(x_out, y, rgba(self.side_rim_lo))
            cv.put(x_out + inward, y, rgba(self.side_rim if y % 11 else self.rim))
            cv.put(x_out + 2 * inward, y, rgba(self.side_rim_lo))

    def rim_h_n(self, cv: Canvas, y_out: int, x0: int, x1: int) -> None:
        for x in range(x0, x1):
            cv.put(x, y_out, rgba(self.side_rim_lo))
            cv.put(x, y_out + 1, rgba(self.side_rim if x % 7 else self.rim))
            cv.put(x, y_out + 2, rgba(self.side_rim_lo))

    def corner_dot(self, cv: Canvas, diag: str) -> None:
        pat = (((29, 29), self.side_rim_lo), ((30, 29), self.side_rim_lo), ((31, 29), self.side_rim_lo),
               ((29, 30), self.side_rim_lo), ((29, 31), self.side_rim_lo), ((30, 30), self.side_rim),
               ((31, 30), self.side_rim), ((30, 31), self.side_rim), ((31, 31), self.rim))
        for (x, y), c in pat:
            xx = x if "e" in diag else T - 1 - x
            yy = y if "s" in diag else T - 1 - y
            cv.put(xx, yy, rgba(c))

    def tile_cap(self, edges: str, dots: Sequence[str], seed: int) -> Canvas:
        cv = self.cap_base(seed)
        for e in "nswe":
            if e in edges:
                {"n": self.rim_n, "s": self.rim_s, "w": self.rim_w, "e": self.rim_e}[e](cv)
        for d in dots:
            self.corner_dot(cv, d)
        return cv

    def shadow(self, kind: str) -> Canvas:
        cv = tile_shadow(kind)
        for y in range(T):
            for x in range(T):
                a = cv.get(x, y)[3]
                if a:
                    cv.put(x, y, rgba(self.shadow_tint, a))
        return cv


# ---------------------------------------------------------------------------
# Portas genericas (estrutura identica a Masmorra Basica)
# ---------------------------------------------------------------------------

def door_sealed(b: Biome) -> Canvas:
    cv = b.door_big().copy()
    apply_seal(cv, b.door_open, 31.5, 38.0, 10.0)
    return cv


def door_n_link(b: Biome) -> Canvas:
    cv = Canvas(64, T)
    blit(cv, b.cap_base(9401), 0, 0)
    blit(cv, b.cap_base(9402), 32, 0)
    fl = b.floor_patch(64, T)
    for y in range(T):
        f = 0.92 - 0.55 * (y / (T - 1))
        for x in range(SLOT0, SLOT1):
            cv.put(x, y, rgba(shade(fl.get(x, y)[:3], f)))
    for y in range(T):
        for x, f in ((SLOT0, 0.45), (SLOT0 + 1, 0.7), (SLOT1 - 1, 0.6), (SLOT1 - 2, 0.82)):
            darken(cv, x, y, f)
    b.rim_h_n(cv, 0, 0, SLOT0)
    b.rim_h_n(cv, 0, SLOT1, 64)
    for x0, x1 in ((0, SLOT0), (SLOT1, 64)):
        for x in range(x0, x1):
            cv.put(x, 28, rgba(shade(cv.get(x, 28)[:3], 0.8)))
            cv.put(x, 29, rgba(b.side_rim_lo))
            cv.put(x, 30, rgba(b.rim if x % 9 else b.rim_hi))
            cv.put(x, 31, rgba(b.rim_lo))
    b.rim_v(cv, SLOT0 - 1, -1, 0, T)
    b.rim_v(cv, SLOT1, 1, 0, T)
    b.mark(cv, 7, 12, 1, False)
    b.mark(cv, 54, 12, 3, False)
    return cv


def door_s(b: Biome, sealed: bool) -> Canvas:
    cv = Canvas(64, T)
    rng = random.Random(9501)
    blit(cv, b.cap_base(9502), 0, 0)
    blit(cv, b.cap_base(9503), 32, 0)
    fl = b.floor_patch(64, T)
    for y in range(T):
        for x in range(SLOT0, SLOT1):
            f = 0.62 if x in (SLOT0, SLOT1 - 1) else (0.8 if x in (SLOT0 + 1, SLOT1 - 2) else 0.95)
            cv.put(x, y, rgba(shade(fl.get(x, y)[:3], f)))
    b.rim_h_n(cv, 0, 0, SLOT0)
    b.rim_h_n(cv, 0, SLOT1, 64)
    b.rim_v(cv, SLOT0 - 1, -1, 0, 25)
    b.rim_v(cv, SLOT1, 1, 0, 25)
    b.jamb(cv, 0, SLOT0, 25, 32, rng)
    b.jamb(cv, SLOT1, 64, 25, 32, rng)
    for x in (SLOT0 - 1, SLOT1):
        for y in range(25, 32):
            cv.put(x, y, rgba(b.gap_dark))
    b.mark(cv, 8, 10, 2, True)
    b.mark(cv, 53, 10, 0, True)
    b.sill_h(cv, SLOT0 + 2, SLOT1 - 2, 4)
    if sealed:
        apply_seal(cv, lambda x, y: SLOT0 <= x < SLOT1, 31.5, 17.0, 10.0)
    return cv


def door_side(b: Biome, sealed: bool, east: bool) -> Canvas:
    cv = Canvas(T, 64)
    k = 7 if east else 0
    rng = random.Random(9601 + k)
    blit(cv, b.cap_base(9602 + k), 0, 0)
    blit(cv, b.cap_base(9603 + k), 0, 32)
    fl = b.floor_patch(T, 64)
    for y in range(SLOT0, SLOT1):
        for x in range(T):
            f = 0.55 if y == SLOT0 else (0.72 if y == SLOT0 + 1 else (0.86 if y < SLOT0 + 5 else 0.97))
            cv.put(x, y, rgba(shade(fl.get(x, y)[:3], f)))
    b.rim_v(cv, 0, 1, 0, 12)
    b.rim_v(cv, T - 1, -1, 0, 12)
    b.jamb(cv, 0, T, 12, SLOT0, rng)
    b.rim_v(cv, 0, 1, SLOT1, 64)
    b.rim_v(cv, T - 1, -1, SLOT1, 64)
    b.rim_h_n(cv, SLOT1, 0, T)
    cv.put(0, SLOT1, rgba(b.side_rim_lo))
    cv.put(T - 1, SLOT1, rgba(b.side_rim_lo))
    b.sill_v(cv, 6 if east else T - 7, SLOT0 + 3, SLOT1 - 1, east)
    b.mark(cv, 14, 4, 1 if east else 2, True)
    b.mark(cv, 14, 52, 3 if east else 0, False)
    if sealed:
        apply_seal(cv, lambda x, y: SLOT0 <= y < SLOT1, 15.5, 32.0, 10.0)
    return cv


# ---------------------------------------------------------------------------
# Folhas
# ---------------------------------------------------------------------------

def build_tiles(b: Biome) -> Frames:
    door = b.door_big()
    thr = b.threshold()
    frames: Frames = [
        ("floor_0", b.floor("floor_0")),
        ("floor_1", b.floor("floor_1")),
        ("floor_2", b.floor("floor_2")),
        ("floor_cracked", b.floor("floor_cracked")),
        ("floor_moss", b.floor("floor_moss")),
        ("floor_blood", b.floor("floor_blood")),
        ("wall_top", b.tile_cap("", (), 201)),
        ("wall_top_s", b.tile_cap("s", (), 202)),
        ("wall_side_l", b.tile_cap("e", (), 203)),
        ("wall_side_r", b.tile_cap("w", (), 204)),
        ("wall_bottom", b.tile_cap("n", (), 205)),
        ("corner_in_tl", b.tile_cap("", ("se",), 206)),
        ("corner_in_tr", b.tile_cap("", ("sw",), 207)),
        ("corner_in_bl", b.tile_cap("", ("ne",), 208)),
        ("corner_in_br", b.tile_cap("", ("nw",), 209)),
        ("corner_out_tl", b.tile_cap("nw", (), 210)),
        ("corner_out_tr", b.tile_cap("ne", (), 211)),
        ("corner_out_bl", b.tile_cap("sw", (), 212)),
        ("corner_out_br", b.tile_cap("es", (), 213)),
        ("wall_face_upper", b.face("upper")),
        ("wall_face_lower", b.face("lower")),
        ("wall_face_upper_cracked", b.face("upper_cracked")),
        ("wall_face_lower_grate", b.face("lower_grate")),
        ("door_arch_l", sub(door, 0, 0)),
        ("door_arch_r", sub(door, 32, 0)),
        ("door_open_l", sub(door, 0, 32)),
        ("door_open_r", sub(door, 32, 32)),
        ("door_threshold_l", sub(thr, 0, 0)),
        ("door_threshold_r", sub(thr, 32, 0)),
        ("shadow_s", b.shadow("s")),
        ("shadow_l", b.shadow("l")),
        ("shadow_r", b.shadow("r")),
        ("shadow_corner_l", b.shadow("corner_l")),
        ("shadow_corner_r", b.shadow("corner_r")),
    ]
    expected = contract_frames("dungeon_basic_tiles")
    if [n for n, _ in frames] != expected:
        raise RuntimeError("ordem de frames de tiles difere do contrato dungeon_basic_tiles")
    return frames


def build_doors(b: Biome) -> Frames:
    sealed = door_sealed(b)
    link = door_n_link(b)
    ds, dss = door_s(b, False), door_s(b, True)
    dw, dws = door_side(b, False, False), door_side(b, True, False)
    de, des = door_side(b, False, True), door_side(b, True, True)
    frames: Frames = [
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
        ("wall_face_upper_end_l", b.face_end("upper", "l")),
        ("wall_face_upper_end_r", b.face_end("upper", "r")),
        ("wall_face_upper_end_lr", b.face_end("upper", "lr")),
        ("wall_face_lower_end_l", b.face_end("lower", "l")),
        ("wall_face_lower_end_r", b.face_end("lower", "r")),
        ("wall_face_lower_end_lr", b.face_end("lower", "lr")),
    ]
    for i, (e, d) in enumerate(CAP_COMBOS):
        frames.append((cap_name(e, d), b.tile_cap(e, d, 220 + i)))
    expected = contract_frames("dungeon_basic_doors")
    if [n for n, _ in frames] != expected:
        raise RuntimeError("ordem de frames de portas difere do contrato dungeon_basic_doors")
    return frames


# ---------------------------------------------------------------------------
# Mapa ASCII -> mascara de piso + portas (convencao do guia 3.3)
# ---------------------------------------------------------------------------
# '.' piso | '#' parede | 'n'/'N' porta norte 2x2 (arco em cima, abertura embaixo; N = selada)
# 'L' tampa de ligacao acima do arco | 's'/'S' porta sul (2 colunas) | 'w'/'W' porta oeste
# 'e'/'E' porta leste (2 linhas). Maiuscula = selada.

class MapSpec:
    def __init__(self, ascii_rows: Sequence[str]) -> None:
        rows = [r.rstrip("\n") for r in ascii_rows]
        self.H = len(rows)
        self.W = max(len(r) for r in rows)
        grid = [r.ljust(self.W, "#") for r in rows]
        self.grid = grid
        self.floor: set = set()
        self.doors: Dict[Tuple[int, int], str] = {}
        self.north: Dict[Tuple[int, int], str] = {}

        def ch(x: int, y: int) -> str:
            if 0 <= y < self.H and 0 <= x < self.W:
                return grid[y][x]
            return "#"

        for y in range(self.H):
            for x in range(self.W):
                c = grid[y][x]
                if c == ".":
                    self.floor.add((x, y))
                elif c in "nN":
                    sealed = "_sealed" if c == "N" else ""
                    lr = "l" if ch(x - 1, y) != c else "r"
                    row = "open" if ch(x, y - 1) == c else "arch"
                    self.north[(x, y)] = f"door_{row}{sealed}_{lr}"
                elif c == "L":
                    lr = "l" if ch(x - 1, y) != "L" else "r"
                    self.north[(x, y)] = f"door_n_link_{lr}"
                elif c in "sS":
                    lr = "l" if ch(x - 1, y) != c else "r"
                    self.doors[(x, y)] = f"door_s{'_sealed' if c == 'S' else ''}_{lr}"
                elif c in "wWeE":
                    tb = "t" if ch(x, y - 1) != c else "b"
                    self.doors[(x, y)] = f"door_{c.lower()}{'_sealed' if c.isupper() else ''}_{tb}"

    def layers(self) -> Dict[Tuple[int, int], List[Tuple[str, str]]]:
        lay = autotile_sample(self.W, self.H, self.floor, self.doors, self.north)
        # porta norte nao selada: o autotile de referencia aponta para "tiles"; selada/link para "doors"
        return lay


def compose_map(b: Biome, spec: MapSpec, tiles: Frames, doors: Frames,
                fill: Color = (9, 9, 11, 255), overrides: Optional[Dict[Tuple[int, int], str]] = None) -> Canvas:
    """overrides: celula -> frame de piso (ex.: fissuras de lava encadeadas), mantendo as sombras."""
    sheets = {"tiles": {n: c for n, c in tiles}, "doors": {n: c for n, c in doors}}
    lay = spec.layers()
    for cell, name in (overrides or {}).items():
        if cell in lay and lay[cell] and lay[cell][0][1].startswith("floor_"):
            lay[cell][0] = ("tiles", name)
    cv = Canvas(spec.W * T, spec.H * T, fill)
    for (x, y), layers in lay.items():
        for sheet, name in layers:
            if name.startswith("shadow_"):
                continue
            blit(cv, sheets[sheet][name], x * T, y * T)
    for (x, y), layers in lay.items():
        for sheet, name in layers:
            if name.startswith("shadow_"):
                blit(cv, sheets[sheet][name], x * T, y * T)
    return cv


def place_props(cv: Canvas, props: Dict[str, Canvas], tall: Dict[str, Canvas],
                wall_props: Sequence[Tuple[str, int, int]], floor_props: Sequence[Tuple[str, int, int]],
                tall_props: Sequence[Tuple[str, int, int]], decals: Sequence[Tuple[str, int, int]] = ()) -> None:
    """decals: props planos de chao (trilhos, selo) desenhados antes de tudo; os demais por y."""
    for name, x, y in decals:
        blit(cv, props[name], x, y)
    for name, x, y in wall_props:
        blit(cv, props[name], x, y)
    items = [(y + 32, "p", name, x, y) for name, x, y in floor_props]
    items += [(y + 61, "t", name, x, y) for name, x, y in tall_props]
    for _, kind, name, x, y in sorted(items):
        blit(cv, props[name] if kind == "p" else tall[name], x, y)


# ---------------------------------------------------------------------------
# Saidas: PNGs, manifest parcial, prancha
# ---------------------------------------------------------------------------

def sheet_paths(b: Biome) -> Dict[str, Path]:
    base = f"biome_{b.id}"
    return {
        "tiles": SPRITES_DIR / f"{base}_tiles.png",
        "doors": SPRITES_DIR / f"{base}_doors.png",
        "props": SPRITES_DIR / f"{base}_props.png",
        "props_tall": SPRITES_DIR / f"{base}_props_tall.png",
    }


def manifest_entries(b: Biome, tiles: Frames, doors: Frames, props: Frames, tall: Frames) -> Dict[str, object]:
    def entry(key: str, fw: int, fh: int, frames: Frames, extra: Optional[Dict[str, object]] = None) -> Dict[str, object]:
        e: Dict[str, object] = {"key": key, "file": f"{key}.png", "width": fw * len(frames), "height": fh,
                                "frameWidth": fw, "frameHeight": fh, "frames": [n for n, _ in frames]}
        if extra:
            e.update(extra)
        return e

    base = f"biome_{b.id}"
    return {
        f"{base}_tiles": entry(f"{base}_tiles", T, T, tiles),
        f"{base}_doors": entry(f"{base}_doors", T, T, doors),
        f"{base}_props": entry(f"{base}_props", T, T, props,
                               {"animations": {"torch": {"frames": [0, 1, 2, 3], "frameRate": 8, "repeat": -1}}}),
        f"{base}_props_tall": entry(f"{base}_props_tall", T, 64, tall, {"origin": {"x": 0.5, "y": 0.95}}),
    }


def build_preview(b: Biome, tiles: Frames, doors: Frames, props: Frames, tall: Frames, sample: Canvas,
                  out_path: Path) -> None:
    K = 3
    cols = 8
    cell_w = T * K + 46
    pad = 24
    bg = (18, 18, 24, 255)
    groups = [
        (f"biome_{b.id}_tiles.png — 32×32 · {len(tiles)} frames (mesma ordem de dungeon_basic_tiles)", tiles, T),
        (f"biome_{b.id}_doors.png — 32×32 · {len(doors)} frames (mesma ordem de dungeon_basic_doors)", doors, T),
        (f"biome_{b.id}_props.png — 32×32 · {len(props)} frames (torch_0..3 = luz animada do bioma)", props, T),
        (f"biome_{b.id}_props_tall.png — 32×64 · {len(tall)} frames", tall, 64),
    ]
    heights = [math.ceil(len(f) / cols) * (fh * K + 30) for _, f, fh in groups]
    SK = 2
    W = max(pad * 2 + cols * cell_w, pad * 2 + sample.w * SK)
    H = 64 + sum(h + 44 for h in heights) + 30 + sample.h * SK + pad
    cv = Canvas(W, H, bg)
    labels: List[Dict[str, object]] = []
    labels.append(text_item(f"SUBMUNDO · {b.title} ({b.id}) — prancha 3× · {b.subtitle}", pad, 22, 18,
                            (241, 210, 138), "Palatino Linotype", True))
    y = 64
    for (title, frames, fh), gh in zip(groups, heights):
        labels.append(text_item(title, pad, y - 14, 13, (148, 163, 184), "Consolas", True))
        for i, (name, c) in enumerate(frames):
            col, row = i % cols, i // cols
            x = pad + col * cell_w
            yy = y + row * (fh * K + 30)
            for py in range(fh * K):
                for px in range(T * K):
                    cv.put(x + px, yy + py, (30, 30, 38, 255) if ((px // 12) + (py // 12)) % 2 else (24, 24, 31, 255))
            blit(cv, upscale(c, K), x, yy)
            labels.append(text_item(f"{i}: {name}", x, yy + fh * K + 9, 8.6, (226, 232, 240), "Consolas"))
        y += gh + 44
    labels.append(text_item("amostra montada por autotile (2×, sem iluminação): mesmo mapa do mockup", pad, y - 4, 13,
                            (148, 163, 184), "Consolas", True))
    blit(cv, upscale(sample, SK), pad, y + 10)
    render_text_overlay(cv, labels, out_path)


def write_outputs(b: Biome) -> Tuple[Frames, Frames, Frames, Frames]:
    tiles = build_tiles(b)
    doors = build_doors(b)
    props = b.props()
    tall = b.props_tall()
    if [n for n, _ in props][:4] != ["torch_0", "torch_1", "torch_2", "torch_3"]:
        raise RuntimeError("props precisam comecar com torch_0..3")
    paths = sheet_paths(b)
    write_png(paths["tiles"], assemble(tiles, T, T))
    write_png(paths["doors"], assemble(doors, T, T))
    write_png(paths["props"], assemble(props, T, T))
    write_png(paths["props_tall"], assemble(tall, T, 64))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    man = manifest_entries(b, tiles, doors, props, tall)
    (OUT_DIR / f"{b.id}.manifest.json").write_text(json.dumps(man, indent=2, ensure_ascii=False) + "\n",
                                                   encoding="utf-8", newline="\n")
    for p in paths.values():
        print(f"Gerado: {p}")
    return tiles, doors, props, tall
