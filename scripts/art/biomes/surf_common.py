"""
SUBMUNDO - Motor comum dos biomas de superficie 2.5D (BRF-138 / T-131, grupo `surf_`)
=====================================================================================

Gera, para um tema (`SurfTheme`), os quatro sheets do contrato de frames dos biomas:

- public/assets/sprites/biome_<id>_tiles.png       (34 frames 32x32, mesmos nomes/ordem de dungeon_basic_tiles)
- public/assets/sprites/biome_<id>_doors.png       (43 frames 32x32, mesmos nomes/ordem de dungeon_basic_doors)
- public/assets/sprites/biome_<id>_props.png       (32x32; torch_0..3 = luz animada do bioma, depois props proprios)
- public/assets/sprites/biome_<id>_props_tall.png  (32x64; elementos altos)
- scripts/art/biomes/out/<id>.manifest.json        (entradas no formato do manifest; integracao pelo AG07)
- assets/mockups/preview_m8_<id>_sheets.png        (prancha 3x rotulada + amostra montada por autotile 2x)

A geometria (aros, cantos, portas em 4 paredes, fendas de passagem, sombras) replica a convencao
da Masmorra Basica aprovada (docs/guia_visual.md, secao 3.3); cada tema so troca texturas e decoracao.
Nao altera buildDungeonBasic.py: apenas importa funcoes dele. Tudo deterministico (stdlib).
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
import buildDungeonBasic as DB  # noqa: E402
from buildDungeonBasic import (  # noqa: E402
    CAP_COMBOS,
    SLOT0,
    SLOT1,
    T,
    apply_seal,
    assemble,
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

ROOT = DB.ROOT
SPRITES_DIR = DB.SPRITES_DIR
MOCKUPS_DIR = DB.MOCKUPS_DIR
OUT_DIR = HERE / "out"

RGB = Tuple[int, int, int]
Color = Tuple[int, int, int, int]
OUT: Color = (9, 9, 11, 255)


# ---------------------------------------------------------------------------
# Ruido deterministico e utilitarios
# ---------------------------------------------------------------------------

def h01(x: int, y: int, s: int = 0) -> float:
    n = (x * 374761393 + y * 668265263 + s * 982451653) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    n = (n ^ (n >> 16)) & 0xFFFFFFFF
    return (n & 0xFFFFFF) / float(0x1000000)


def vnoise(x: float, y: float, period: int, s: int, cell: float = 8.0) -> float:
    """Value noise suave, periodico em x e y (periodo em pixels, multiplo de `cell`)."""
    px, py = x / cell, y / cell
    n = max(1, int(round(period / cell)))
    x0, y0 = int(math.floor(px)), int(math.floor(py))
    fx, fy = px - x0, py - y0
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)

    def v(ix: int, iy: int) -> float:
        return h01(ix % n, iy % n, s)

    a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * fx
    b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * fx
    return a + (b - a) * fy


def put(cv: Canvas, x: int, y: int, c: RGB, a: int = 255) -> None:
    if a >= 255:
        cv.put(x, y, rgba(c))
    else:
        cv.blend_pixel(x, y, rgba(c, a))


def put_wrap(cv: Canvas, x: int, y: int, c: RGB, a: int = 255) -> None:
    put(cv, x % cv.w, y % cv.h, c, a)


def sub(src: Canvas, x: int, y: int, w: int = T, h: int = T) -> Canvas:
    c = Canvas(w, h)
    for yy in range(h):
        o_src = ((y + yy) * src.w + x) * 4
        c.buf[yy * w * 4:(yy + 1) * w * 4] = src.buf[o_src:o_src + w * 4]
    return c


def contact_shadow(cv: Canvas, x0: int, x1: int, y: int, a: int = 110) -> None:
    for x in range(x0, x1):
        if not cv.get(x, y)[3]:
            cv.put(x, y, (0, 0, 0, a))
        if not cv.get(x, y + 1)[3]:
            cv.put(x, y + 1, (0, 0, 0, a // 2))


def ellipse_shadow(cv: Canvas, cx: float, cy: float, rx: float, ry: float, a: int = 120) -> None:
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            d = math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
            if d < 1 and not cv.get(x, y)[3]:
                cv.put(x, y, (0, 0, 0, int(a * (1 - d * d) ** 0.5)))


def leaf_blobs(cv: Canvas, rng: random.Random, count: int, x0: int, y0: int, w: int, h: int,
               pal: Sequence[RGB], rmin: float = 1.8, rmax: float = 3.6, wrap: bool = True,
               yfac: Optional[Callable[[int], float]] = None, sx: float = 1.0) -> None:
    """Folhagem: bolhas pequenas sobrepostas (luz de cima-esquerda). pal = escuro..claro (4 tons)."""
    blobs = [(rng.uniform(x0, x0 + w), rng.uniform(y0, y0 + h), rng.uniform(rmin, rmax)) for _ in range(count)]
    blobs.sort(key=lambda b: b[1])
    for (bx, by, r) in blobs:
        rx, ry = r * sx, r
        for yy in range(int(by - ry) - 1, int(by + ry) + 2):
            for xx in range(int(bx - rx) - 1, int(bx + rx) + 2):
                nx, ny = (xx + 0.5 - bx) / rx, (yy + 0.5 - by) / ry
                d = nx * nx + ny * ny
                if d > 1.0:
                    continue
                lit = -0.55 * nx - 0.75 * ny
                if d > 0.72 and lit < 0.1:
                    c = pal[0]
                elif lit > 0.55:
                    c = pal[3]
                elif lit > 0.05:
                    c = pal[2]
                else:
                    c = pal[1]
                if yfac is not None:
                    c = shade(c, yfac(yy))
                tx, ty = (xx % cv.w, yy % cv.h) if wrap else (xx, yy)
                if not wrap and not (x0 <= xx < x0 + w and y0 <= yy < y0 + h):
                    continue
                cv.put(tx, ty, rgba(c))


def voronoi_stones(cv: Canvas, seed: int, n: int, tones: Sequence[RGB], crack: RGB, hi_f: float = 1.22,
                   lo_f: float = 0.72, sx: float = 1.0, sy: float = 1.0, x0: int = 0, y0: int = 0,
                   w: int = T, h: int = T, wrap: bool = True, fixed_pts: Optional[List] = None,
                   light: bool = True) -> List[Tuple[float, float, RGB]]:
    """Pedras irregulares (Voronoi com wrap): rachaduras escuras, quina clara em cima-esquerda."""
    rng = random.Random(seed)
    pts = fixed_pts if fixed_pts is not None else [
        (rng.uniform(0, w), rng.uniform(0, h), rng.choice(tones)) for _ in range(n)]

    def nearest(px: float, py: float) -> Tuple[float, float, int]:
        best = (1e9, 1e9, -1)
        for i, (qx, qy, _) in enumerate(pts):
            dx = abs(px - qx)
            dy = abs(py - qy)
            if wrap:
                dx = min(dx, w - dx)
                dy = min(dy, h - dy)
            d = (dx / sx) ** 2 + (dy / sy) ** 2
            if d < best[0]:
                best = (d, best[0], i)
            elif d < best[1]:
                best = (best[0], d, best[2])
        return best

    for yy in range(h):
        for xx in range(w):
            d1, d2, i = nearest(xx + 0.5, yy + 0.5)
            gap = math.sqrt(d2) - math.sqrt(d1)
            base = pts[i][2]
            if gap < 0.9:
                col = crack
            else:
                col = base
                if light:
                    # vizinho de cima/esquerda pertence a outra pedra -> quina clara
                    u = nearest(xx + 0.5, yy - 1.0)[2]
                    l_ = nearest(xx - 1.0, yy + 0.5)[2]
                    dd = nearest(xx + 0.5, yy + 2.0)[2]
                    if u != i or l_ != i:
                        col = shade(base, hi_f)
                    elif dd != i:
                        col = shade(base, lo_f)
                r = h01(xx + x0, yy + y0, seed)
                if r < 0.07:
                    col = shade(col, 0.88)
                elif r < 0.1:
                    col = shade(col, 1.1)
            cv.put(x0 + xx, y0 + yy, rgba(col))
    return pts


def save_sheet(path: Path, frames: Sequence[Tuple[str, Canvas]], fw: int, fh: int) -> None:
    write_png(path, assemble(frames, fw, fh))
    print(f"Gerado: {path}")


def contract_names() -> Tuple[List[str], List[str]]:
    manifest = json.loads(DB.MANIFEST_JSON.read_text(encoding="utf-8"))["sprites"]
    return list(manifest["dungeon_basic_tiles"]["frames"]), list(manifest["dungeon_basic_doors"]["frames"])


# ---------------------------------------------------------------------------
# Tema base
# ---------------------------------------------------------------------------

class SurfTheme:
    id = ""
    title = ""
    # aros (tampa das "paredes"): mesma geometria da Masmorra Basica, cores do tema
    rim_lo: RGB = (40, 40, 48)
    rim: RGB = (82, 82, 91)
    rim_hi: RGB = (100, 116, 139)
    side_rim: RGB = (64, 66, 80)
    side_rim_lo: RGB = (44, 44, 55)
    rim_jitter = 0.0  # >0: borda organica (sebe, rocha)
    bg: RGB = (9, 9, 11)
    seal_center_north = (31.5, 38.0)
    torch_rate = 8

    def __init__(self) -> None:
        self._floor_cache: Dict[str, Canvas] = {}

    # ---- texturas a implementar ----
    def floor(self, name: str) -> Canvas:
        raise NotImplementedError

    def cap_base(self, seed: int) -> Canvas:
        raise NotImplementedError

    def face(self, kind: str, seed: int) -> Canvas:
        raise NotImplementedError

    def door_north(self) -> Canvas:
        raise NotImplementedError

    def door_opening(self, x: int, y: int) -> bool:
        dx = x + 0.5 - 31.5
        return (abs(dx) < 12.5 and y >= 27) or (math.hypot(dx, y + 0.5 - 27.0) < 12.5 and y < 27)

    def threshold(self) -> Canvas:
        raise NotImplementedError

    def short_face(self, cv: Canvas, x0: int, x1: int, y0: int, y1: int, rng: random.Random) -> None:
        raise NotImplementedError

    def post_cap(self, cv: Canvas, x: int, y: int, lit: bool) -> None:
        """Marca decorativa sobre os batentes das passagens (no lugar das runas da masmorra)."""

    def passage_strip(self, cv: Canvas, orient: str, a0: int, a1: int, pos: int, inward: int) -> None:
        """Faixa no piso da passagem (soleira) - opcional."""

    def props(self) -> List[Tuple[str, Canvas]]:
        raise NotImplementedError

    def props_tall(self) -> List[Tuple[str, Canvas]]:
        raise NotImplementedError

    def props_animations(self) -> Dict[str, object]:
        return {"torch": {"frames": [0, 1, 2, 3], "frameRate": self.torch_rate, "repeat": -1}}

    def tall_animations(self) -> Dict[str, object]:
        return {}

    def sample_floor_props(self) -> Sequence[str]:
        return []

    # ---- piso ----
    def floor_c(self, name: str) -> Canvas:
        if name not in self._floor_cache:
            self._floor_cache[name] = self.floor(name)
        return self._floor_cache[name]

    def floor_patch(self, w: int, h: int, k0: int = 0) -> Canvas:
        cv = Canvas(w, h)
        for ty in range(0, h, T):
            for tx in range(0, w, T):
                k = (tx // T) + (ty // T) * 2 + k0
                blit(cv, self.floor_c(("floor_0", "floor_1", "floor_2")[k % 3]), tx, ty)
        return cv

    # ---- aros ----
    def rim_line(self, cv: Canvas, orient: str, outer: int, inward: int, a0: int, a1: int,
                 south: bool = False, acc: int = 7) -> None:
        for k in range(a0, a1):
            if south:
                cols = [self.rim_lo, self.rim_hi if k % 9 == 0 else self.rim, self.side_rim_lo, None]
            else:
                cols = [self.side_rim_lo, self.rim if k % acc == 0 else self.side_rim, self.side_rim_lo]
            skip = 0
            if self.rim_jitter:
                r = h01(k, outer * 7 + (3 if orient == "h" else 5), 991)
                if r < self.rim_jitter:
                    skip = 1
                elif r > 1 - self.rim_jitter * 0.5:
                    skip = -1  # protuberancia: aro avanca 1 px para dentro
            for i, c in enumerate(cols):
                if i < skip:
                    continue
                p = outer + inward * i
                x, y = (k, p) if orient == "h" else (p, k)
                if c is None:
                    cv.put(x, y, rgba(shade(cv.get(x, y)[:3], 0.8)))
                else:
                    cv.put(x, y, rgba(c))
            if skip == -1:
                p = outer + inward * len(cols)
                x, y = (k, p) if orient == "h" else (p, k)
                cv.put(x, y, rgba(self.side_rim_lo))

    def rim_n(self, cv: Canvas) -> None:
        self.rim_line(cv, "h", 0, 1, 0, T)

    def rim_s(self, cv: Canvas) -> None:
        self.rim_line(cv, "h", T - 1, -1, 0, T, south=True)

    def rim_e(self, cv: Canvas) -> None:
        self.rim_line(cv, "v", T - 1, -1, 0, T, acc=11)

    def rim_w(self, cv: Canvas) -> None:
        self.rim_line(cv, "v", 0, 1, 0, T, acc=11)

    def dot_pattern(self):
        return (((29, 29), self.side_rim_lo), ((30, 29), self.side_rim_lo), ((31, 29), self.side_rim_lo),
                ((29, 30), self.side_rim_lo), ((29, 31), self.side_rim_lo), ((30, 30), self.side_rim),
                ((31, 30), self.side_rim), ((30, 31), self.side_rim), ((31, 31), self.rim))

    def corner_dot(self, cv: Canvas, diag: str) -> None:
        for (x, y), c in self.dot_pattern():
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

    # ---- face terminando em aresta ----
    def face_end(self, kind: str, sides: str, seed: int) -> Canvas:
        cv = self.face(kind, seed)
        upper = kind == "upper"
        for side in sides:
            for y in range(T):
                for i in range(6):
                    x = i if side == "l" else T - 1 - i
                    if i == 0:
                        c = self.side_rim_lo
                    elif i == 1:
                        c = self.rim if (y + (0 if upper else T)) % 11 else self.rim_hi
                    elif i == 2:
                        c = self.side_rim
                    else:
                        c = shade(cv.get(x, y)[:3], (0.72, 0.82, 0.92)[i - 3])
                    if self.rim_jitter and i == 0 and h01(y, side == "l", seed) < self.rim_jitter:
                        c = self.bg
                    cv.put(x, y, rgba(c))
        return cv

    # ---- portas ----
    def door_n_link(self) -> Canvas:
        cv = Canvas(64, T)
        blit(cv, self.cap_base(9401), 0, 0)
        blit(cv, self.cap_base(9402), 32, 0)
        fl = self.floor_patch(64, T, 1)
        for y in range(T):
            f = 0.92 - 0.55 * (y / (T - 1))
            for x in range(SLOT0, SLOT1):
                cv.put(x, y, rgba(shade(fl.get(x, y)[:3], f)))
        for y in range(T):
            for x, f in ((SLOT0, 0.45), (SLOT0 + 1, 0.7), (SLOT1 - 1, 0.6), (SLOT1 - 2, 0.82)):
                cv.put(x, y, rgba(shade(cv.get(x, y)[:3], f)))
        self.rim_line(cv, "h", 0, 1, 0, SLOT0)
        self.rim_line(cv, "h", 0, 1, SLOT1, 64)
        self.rim_line(cv, "h", T - 1, -1, 0, SLOT0, south=True)
        self.rim_line(cv, "h", T - 1, -1, SLOT1, 64, south=True)
        self.rim_line(cv, "v", SLOT0 - 1, -1, 0, T, acc=11)
        self.rim_line(cv, "v", SLOT1, 1, 0, T, acc=11)
        self.post_cap(cv, 8, 12, False)
        self.post_cap(cv, 55, 12, False)
        return cv

    def door_s(self, sealed: bool) -> Canvas:
        cv = Canvas(64, T)
        rng = random.Random(9501)
        blit(cv, self.cap_base(9502), 0, 0)
        blit(cv, self.cap_base(9503), 32, 0)
        fl = self.floor_patch(64, T, 2)
        for y in range(T):
            for x in range(SLOT0, SLOT1):
                f = 0.62 if x in (SLOT0, SLOT1 - 1) else (0.8 if x in (SLOT0 + 1, SLOT1 - 2) else 0.95)
                cv.put(x, y, rgba(shade(fl.get(x, y)[:3], f)))
        self.rim_line(cv, "h", 0, 1, 0, SLOT0)
        self.rim_line(cv, "h", 0, 1, SLOT1, 64)
        self.rim_line(cv, "v", SLOT0 - 1, -1, 0, 25, acc=11)
        self.rim_line(cv, "v", SLOT1, 1, 0, 25, acc=11)
        self.short_face(cv, 0, SLOT0, 25, 32, rng)
        self.short_face(cv, SLOT1, 64, 25, 32, rng)
        for x in (SLOT0 - 1, SLOT1):
            for y in range(25, 32):
                cv.put(x, y, rgba(shade(self.side_rim_lo, 0.5)))
        self.post_cap(cv, 9, 11, True)
        self.post_cap(cv, 54, 11, True)
        self.passage_strip(cv, "h", SLOT0 + 2, SLOT1 - 2, 4, 1)
        if sealed:
            apply_seal(cv, lambda x, y: SLOT0 <= x < SLOT1, 31.5, 17.0, 10.0)
        return cv

    def door_side(self, sealed: bool, east: bool) -> Canvas:
        cv = Canvas(T, 64)
        k = 7 if east else 0
        rng = random.Random(9601 + k)
        blit(cv, self.cap_base(9602 + k), 0, 0)
        blit(cv, self.cap_base(9603 + k), 0, 32)
        fl = self.floor_patch(T, 64, 3 + k)
        for y in range(SLOT0, SLOT1):
            for x in range(T):
                f = 0.55 if y == SLOT0 else (0.72 if y == SLOT0 + 1 else (0.86 if y < SLOT0 + 5 else 0.97))
                cv.put(x, y, rgba(shade(fl.get(x, y)[:3], f)))
        self.rim_line(cv, "v", 0, 1, 0, 12, acc=11)
        self.rim_line(cv, "v", T - 1, -1, 0, 12, acc=11)
        self.short_face(cv, 0, T, 12, SLOT0, rng)
        self.rim_line(cv, "v", 0, 1, SLOT1, 64, acc=11)
        self.rim_line(cv, "v", T - 1, -1, SLOT1, 64, acc=11)
        self.rim_line(cv, "h", SLOT1, 1, 0, T)
        fx = 6 if east else T - 7
        self.passage_strip(cv, "v", SLOT0 + 3, SLOT1 - 1, fx, 1 if east else -1)
        self.post_cap(cv, 15, 5, True)
        self.post_cap(cv, 15, 54, False)
        if sealed:
            apply_seal(cv, lambda x, y: SLOT0 <= y < SLOT1, 15.5, 32.0, 10.0)
        return cv

    # ---- folhas ----
    def build_tiles(self, names: Sequence[str]) -> List[Tuple[str, Canvas]]:
        door = self.door_north()
        thr = self.threshold()
        frames: Dict[str, Canvas] = {}
        for n in ("floor_0", "floor_1", "floor_2", "floor_cracked", "floor_moss", "floor_blood"):
            frames[n] = self.floor_c(n)
        caps = {
            "wall_top": ("", (), 201), "wall_top_s": ("s", (), 202), "wall_side_l": ("e", (), 203),
            "wall_side_r": ("w", (), 204), "wall_bottom": ("n", (), 205),
            "corner_in_tl": ("", ("se",), 206), "corner_in_tr": ("", ("sw",), 207),
            "corner_in_bl": ("", ("ne",), 208), "corner_in_br": ("", ("nw",), 209),
            "corner_out_tl": ("nw", (), 210), "corner_out_tr": ("ne", (), 211),
            "corner_out_bl": ("sw", (), 212), "corner_out_br": ("es", (), 213),
        }
        for n, (e, d, s) in caps.items():
            frames[n] = self.tile_cap(e, d, s)
        frames["wall_face_upper"] = self.face("upper", 301)
        frames["wall_face_lower"] = self.face("lower", 302)
        frames["wall_face_upper_cracked"] = self.face("upper_cracked", 303)
        frames["wall_face_lower_grate"] = self.face("lower_grate", 304)
        frames["door_arch_l"] = sub(door, 0, 0)
        frames["door_arch_r"] = sub(door, 32, 0)
        frames["door_open_l"] = sub(door, 0, 32)
        frames["door_open_r"] = sub(door, 32, 32)
        frames["door_threshold_l"] = sub(thr, 0, 0)
        frames["door_threshold_r"] = sub(thr, 32, 0)
        for n, k in (("shadow_s", "s"), ("shadow_l", "l"), ("shadow_r", "r"),
                     ("shadow_corner_l", "corner_l"), ("shadow_corner_r", "corner_r")):
            frames[n] = tile_shadow(k)
        assert set(frames) == set(names), set(frames) ^ set(names)
        return [(n, frames[n]) for n in names]

    def build_doors(self, names: Sequence[str]) -> List[Tuple[str, Canvas]]:
        sealed = self.door_north()
        cx, cy = self.seal_center_north
        apply_seal(sealed, self.door_opening, cx, cy, 10.0)
        link = self.door_n_link()
        ds, dss = self.door_s(False), self.door_s(True)
        dw, dws = self.door_side(False, False), self.door_side(True, False)
        de, des = self.door_side(False, True), self.door_side(True, True)
        frames: Dict[str, Canvas] = {
            "door_arch_sealed_l": sub(sealed, 0, 0), "door_arch_sealed_r": sub(sealed, 32, 0),
            "door_open_sealed_l": sub(sealed, 0, 32), "door_open_sealed_r": sub(sealed, 32, 32),
            "door_n_link_l": sub(link, 0, 0), "door_n_link_r": sub(link, 32, 0),
            "door_s_l": sub(ds, 0, 0), "door_s_r": sub(ds, 32, 0),
            "door_s_sealed_l": sub(dss, 0, 0), "door_s_sealed_r": sub(dss, 32, 0),
            "door_w_t": sub(dw, 0, 0), "door_w_b": sub(dw, 0, 32),
            "door_w_sealed_t": sub(dws, 0, 0), "door_w_sealed_b": sub(dws, 0, 32),
            "door_e_t": sub(de, 0, 0), "door_e_b": sub(de, 0, 32),
            "door_e_sealed_t": sub(des, 0, 0), "door_e_sealed_b": sub(des, 0, 32),
            "wall_face_upper_end_l": self.face_end("upper", "l", 311),
            "wall_face_upper_end_r": self.face_end("upper", "r", 312),
            "wall_face_upper_end_lr": self.face_end("upper", "lr", 313),
            "wall_face_lower_end_l": self.face_end("lower", "l", 314),
            "wall_face_lower_end_r": self.face_end("lower", "r", 315),
            "wall_face_lower_end_lr": self.face_end("lower", "lr", 316),
        }
        for i, (e, d) in enumerate(CAP_COMBOS):
            frames[cap_name(e, d)] = self.tile_cap(e, d, 220 + i)
        assert set(frames) == set(names), set(frames) ^ set(names)
        return [(n, frames[n]) for n in names]


# ---------------------------------------------------------------------------
# Mapa por autotile (mesma regra de DB.autotile_sample) a partir de ASCII
# ---------------------------------------------------------------------------

def parse_ascii(rows: Sequence[str]):
    """'.' piso; '#' parede. Letras de porta: A/a arco norte (A aberto, S selado) sao tratadas a parte."""
    H = len(rows)
    W = max(len(r) for r in rows)
    floor = set()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == ".":
                floor.add((x, y))
    return W, H, floor


def compose_layers(theme_sheets: Dict[str, Dict[str, Canvas]], lay, W: int, H: int, bg: RGB) -> Canvas:
    cv = Canvas(W * T, H * T, rgba(bg))
    for (x, y), layers in lay.items():
        for sheet, name in layers:
            blit(cv, theme_sheets[sheet][name], x * T, y * T)
    return cv


# ---------------------------------------------------------------------------
# Prancha 3x + amostra montada
# ---------------------------------------------------------------------------

def checker(cv: Canvas, x0: int, y0: int, w: int, h: int) -> None:
    for y in range(h):
        for x in range(w):
            cv.put(x0 + x, y0 + y, (30, 30, 38, 255) if ((x // 12) + (y // 12)) % 2 else (24, 24, 31, 255))


def compose_sample(theme: SurfTheme, tiles, doors, props) -> Canvas:
    W, H, floor, dmap, north = DB.sample_map()
    lay = DB.autotile_sample(W, H, floor, dmap, north)
    sheets = {"tiles": dict(tiles), "doors": dict(doors)}
    cv = compose_layers(sheets, lay, W, H, theme.bg)
    pr = dict(props)
    for (name, x, y) in (("torch_0", 3, 17), ("torch_2", 10, 17), ("torch_1", 8, 10), ("torch_3", 16, 22),
                         ("torch_0", 21, 21), ("torch_2", 26, 12), ("torch_1", 15, 2), ("torch_3", 19, 2)):
        blit(cv, pr[name], x * T, y * T)
    fp = list(theme.sample_floor_props())
    spots = ((26, 15), (9, 24), (3, 25), (27, 26), (12, 12), (19, 5), (6, 20), (23, 24), (25, 19), (10, 21))
    for i, (x, y) in enumerate(spots[:len(fp)]):
        blit(cv, pr[fp[i]], x * T, y * T)
    return cv


def build_preview(theme: SurfTheme, tiles, doors, props, tall, out_path: Path) -> None:
    K = 3
    cols = 10
    cell_w = T * K + 42
    pad = 24
    sample = compose_sample(theme, tiles, doors, props)
    SK = 2

    def group_h(n: int, fh: int) -> int:
        return math.ceil(n / cols) * (fh * K + 30)

    W = max(pad * 2 + cols * cell_w, pad * 2 + sample.w * SK)
    H = (56 + group_h(len(tiles), T) + 40 + group_h(len(doors), T) + 40 + group_h(len(props), T) + 40
         + group_h(len(tall), 64) + 44 + sample.h * SK + pad)
    cv = Canvas(W, H, (18, 18, 24, 255))
    labels: List[Dict[str, object]] = [
        text_item(f"SUBMUNDO · {theme.title} 2.5D (BRF-138 / T-131) — prancha 3×", pad, 22, 18,
                  (241, 210, 138), "Palatino Linotype", True)]

    def place(items, y0: int, fh: int, title: str) -> int:
        labels.append(text_item(title, pad, y0 - 14, 13, (148, 163, 184), "Consolas", True))
        for i, (name, c) in enumerate(items):
            col, row = i % cols, i // cols
            x = pad + col * cell_w
            y = y0 + row * (fh * K + 30)
            checker(cv, x, y, T * K, fh * K)
            blit(cv, upscale(c, K), x, y)
            labels.append(text_item(f"{i}: {name}", x, y + fh * K + 9, 8.6, (226, 232, 240), "Consolas"))
        return y0 + group_h(len(items), fh)

    tid = theme.id
    y = 56
    y = place(tiles, y, T, f"biome_{tid}_tiles.png — 32×32 · {len(tiles)} frames (mesmos nomes/ordem de "
                           f"dungeon_basic_tiles)") + 40
    y = place(doors, y, T, f"biome_{tid}_doors.png — 32×32 · {len(doors)} frames (mesmos nomes/ordem de "
                           f"dungeon_basic_doors)") + 40
    y = place(props, y, T, f"biome_{tid}_props.png — 32×32 · {len(props)} frames (torch_0..3 = luz animada "
                           f"do bioma)") + 40
    y = place(tall, y, 64, f"biome_{tid}_props_tall.png — 32×64 · {len(tall)} frames") + 44
    labels.append(text_item("amostra montada por autotile (2×), mesmo mapa da prancha da Masmorra Básica: sala em "
                            "L, corredor com curvas, portas norte/sul/oeste/leste e seladas",
                            pad, y - 16, 13, (148, 163, 184), "Consolas", True))
    blit(cv, upscale(sample, SK), pad, y)
    render_text_overlay(cv, labels, out_path)
    print(f"Gerado: {out_path}")


# ---------------------------------------------------------------------------
# Pipeline completo de um tema
# ---------------------------------------------------------------------------

def manifest_entry(key: str, fw: int, fh: int, frames: Sequence[str], extra: Dict[str, object]) -> Dict[str, object]:
    e: Dict[str, object] = {"key": key, "file": f"{key}.png", "width": fw * len(frames), "height": fh,
                            "frameWidth": fw, "frameHeight": fh, "frames": list(frames)}
    e.update(extra)
    return e


def build_theme(theme: SurfTheme, preview: bool = True):
    tile_names, door_names = contract_names()
    tiles = theme.build_tiles(tile_names)
    doors = theme.build_doors(door_names)
    props = theme.props()
    tall = theme.props_tall()
    assert [n for n, _ in props][:4] == ["torch_0", "torch_1", "torch_2", "torch_3"]
    for _, c in props:
        assert (c.w, c.h) == (T, T)
    for _, c in tall:
        assert (c.w, c.h) == (T, 64)
    tid = theme.id
    save_sheet(SPRITES_DIR / f"biome_{tid}_tiles.png", tiles, T, T)
    save_sheet(SPRITES_DIR / f"biome_{tid}_doors.png", doors, T, T)
    save_sheet(SPRITES_DIR / f"biome_{tid}_props.png", props, T, T)
    save_sheet(SPRITES_DIR / f"biome_{tid}_props_tall.png", tall, T, 64)
    tall_extra: Dict[str, object] = {"origin": {"x": 0.5, "y": 0.95}}
    if theme.tall_animations():
        tall_extra["animations"] = theme.tall_animations()
    sprites = {
        f"biome_{tid}_tiles": manifest_entry(f"biome_{tid}_tiles", T, T, [n for n, _ in tiles], {}),
        f"biome_{tid}_doors": manifest_entry(f"biome_{tid}_doors", T, T, [n for n, _ in doors], {}),
        f"biome_{tid}_props": manifest_entry(f"biome_{tid}_props", T, T, [n for n, _ in props],
                                             {"animations": theme.props_animations()}),
        f"biome_{tid}_props_tall": manifest_entry(f"biome_{tid}_props_tall", T, 64, [n for n, _ in tall],
                                                  tall_extra),
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    mpath = OUT_DIR / f"{tid}.manifest.json"
    mpath.write_text(json.dumps({"sprites": sprites}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Gerado: {mpath}")
    if preview:
        build_preview(theme, tiles, doors, props, tall, MOCKUPS_DIR / f"preview_m8_{tid}_sheets.png")
    return tiles, doors, props, tall
