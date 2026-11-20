"""
SUBMUNDO - Bioma `village_grotto` (Gruta da Cachoeira, stage_grotto) - BRF-138 / T-131
=======================================================================================

Identidade (paleta 1.1 Abismo esfriada para azul-petroleo + musgo e agua):
- piso: lajes de rocha molhada com reflexos, poças, musgo e crostas de enxofre (o "sinal de algo errado");
- "paredes" 2.5D = paredoes de rocha estratificada com franja de musgo, escorrimentos e base encharcada;
  veios de cristal brilhando e infiltracoes de agua como variacoes;
- portas: boca de caverna irregular com dentes de estalactite e um filete d'agua saindo; selos iguais;
- luz do bioma (torch_0..3): tufo de cogumelos luminescentes (ciano) pulsando, com esporos;
- elemento alto: cachoeira animada (waterfall_l/r, 3 frames) + topo do riacho e poça de espuma (props).

Uso: python scripts/art/biomes/surf_village_grotto.py
"""
from __future__ import annotations

import math
import random
from typing import Dict, List, Tuple

from surf_common import (
    Canvas, SurfTheme, T, blit, build_theme, contact_shadow, ellipse_shadow, fill_ellipse, fill_rect, h01,
    line, mix, outline, rgba, shade, vnoise, voronoi_stones,
)
import buildDungeonBasic as DB

ROCK = ((40, 46, 50), (35, 41, 45), (45, 51, 55), (31, 36, 40))
ROCK_CRACK = (11, 14, 17)
CAP = ((25, 28, 32), (22, 25, 29), (28, 31, 35), (20, 23, 27))
FACE = ((58, 64, 68), (52, 58, 62), (64, 70, 72), (48, 54, 58))
MOSS = ((26, 44, 32), (38, 62, 42), (54, 84, 54), (76, 110, 66))
WET_HI = (96, 128, 136)
WATER_D = (14, 30, 40)
WATER = (34, 74, 92)
WATER_L = (82, 150, 170)
FOAM = (196, 232, 240)
GLOW_D = (14, 110, 120)
GLOW = (52, 196, 200)
GLOW_L = (150, 246, 236)
GLOW_W = (226, 255, 250)
SULF = ((132, 124, 52), (170, 158, 66), (204, 190, 92))


def wet_glints(cv: Canvas, seed: int, n: int = 6) -> None:
    rng = random.Random(seed)
    for _ in range(n):
        x, y = rng.randint(1, 30), rng.randint(1, 30)
        c = cv.get(x, y)
        if c[0] > 44:
            cv.put(x, y, rgba(WET_HI))
            if rng.random() < 0.5:
                cv.put(x + 1, y, rgba(shade(WET_HI, 0.8)))


# ---------------------------------------------------------------------------
# Piso
# ---------------------------------------------------------------------------

_FLOOR_PTS: List = []


def floor_structure() -> List:
    """Mesma estrutura de lajes em todas as variantes; lajes que tocam a borda tem tom fixo -> sem costura."""
    if _FLOOR_PTS:
        return _FLOOR_PTS
    rng = random.Random(5000)
    pts = [(rng.uniform(0, T), rng.uniform(0, T)) for _ in range(9)]

    def nearest(px, py):
        best, bi = 1e9, 0
        for i, (qx, qy) in enumerate(pts):
            dx = min(abs(px - qx), T - abs(px - qx)) / 1.2
            dy = min(abs(py - qy), T - abs(py - qy))
            if dx * dx + dy * dy < best:
                best, bi = dx * dx + dy * dy, i
        return bi
    border = set()
    for k in range(T):
        for (x, y) in ((k, 0), (k, T - 1), (0, k), (T - 1, k)):
            border.add(nearest(x + 0.5, y + 0.5))
    _FLOOR_PTS.extend([(x, y, i in border) for i, (x, y) in enumerate(pts)])
    return _FLOOR_PTS


def floor_tile(name: str) -> Canvas:
    seeds = {"floor_0": 51, "floor_1": 52, "floor_2": 53, "floor_cracked": 54, "floor_moss": 55, "floor_blood": 56}
    seed = seeds[name]
    cv = Canvas(T, T)
    vr = random.Random(seed + 100)
    pts = [(x, y, ROCK[i % 4] if b else vr.choice(ROCK)) for i, (x, y, b) in enumerate(floor_structure())]
    voronoi_stones(cv, seed, 9, ROCK, (21, 25, 28), 1.13, 0.84, sx=1.2, fixed_pts=pts)
    if name in ("floor_1", "floor_2"):
        rr = random.Random(seed)
        x, y = rr.randint(8, 22), rr.randint(8, 22)
        for i in range(rr.randint(4, 7)):
            cv.put(x, y, rgba((17, 20, 23)))
            x += rr.choice((1, 1, 0))
            y += rr.choice((1, 0, 1))
    wet_glints(cv, seed, 3)
    rng = random.Random(seed)
    if name == "floor_cracked":
        pts = []
        x, y = 6.0, 4.0
        for i in range(30):
            pts.append((int(x), int(y)))
            x += 0.75 + rng.uniform(-0.3, 0.4)
            y += 0.8 + rng.uniform(-0.5, 0.5)
        for (px, py) in pts:
            for dy in range(-2, 3):
                for dx in range(-2, 3):
                    d = abs(dx) + abs(dy)
                    if d <= 2 and h01(px + dx, py + dy, 3) < 0.8 - 0.25 * d:
                        cv.put(px + dx, py + dy, rgba(SULF[0] if d == 2 else SULF[1]))
        for (px, py) in pts:
            cv.put(px, py, rgba((8, 8, 6)))
        for (px, py) in pts[::5]:
            cv.put(px + 1, py - 1, rgba(SULF[2]))
    elif name == "floor_moss":
        for y in range(T):
            for x in range(T):
                n = vnoise(x, y, 32, 61, 8)
                if n > 0.55:
                    k = min(3, int((n - 0.55) / 0.11) + (1 if h01(x, y, 4) < 0.3 else 0))
                    cv.put(x, y, rgba(MOSS[k]))
    elif name == "floor_blood":
        for y in range(T):
            for x in range(T):
                d = math.hypot((x + 0.5 - 16) / 12.5, (y + 0.5 - 16) / 8.5) + 0.2 * (vnoise(x, y, 32, 8, 6) - 0.5)
                if d < 1:
                    c = WATER_D if d < 0.8 else (20, 24, 28)
                    if d < 0.8 and h01(x, y, 5) < 0.08:
                        c = WATER
                    cv.put(x, y, rgba(c))
        for (x0, x1, y) in ((9, 15, 12), (17, 24, 15), (11, 14, 19), (19, 22, 20)):
            for x in range(x0, x1):
                cv.put(x, y, rgba(WATER_L if x < x1 - 1 else WATER))
        cv.put(13, 11, rgba(FOAM))
    return cv


# ---------------------------------------------------------------------------
# Topo e face do paredao
# ---------------------------------------------------------------------------

def rock_cap(seed: int) -> Canvas:
    cv = Canvas(T, T)
    voronoi_stones(cv, 7000 + seed, 8, CAP, (12, 14, 16), 1.16, 0.78, sx=1.0)
    for y in range(T):
        for x in range(T):
            n = vnoise(x, y, 32, 7100 + seed % 5, 8)
            if n > 0.74 and h01(x, y, seed) < 0.55:
                cv.put(x, y, rgba(MOSS[1] if n < 0.75 else MOSS[2]))
    return cv


_COLUMN: Dict[int, Canvas] = {}


def cliff_column(variant: int) -> Canvas:
    """Paredao de 64 px (face superior + inferior) em estratos: bordas de laje iluminadas por cima,
    fendas verticais, sombra sob cada saliencia. Upper e lower vem da mesma coluna -> casam na vertical."""
    if variant in _COLUMN:
        return _COLUMN[variant]
    cv = Canvas(T, 64)
    bounds = (0, 9, 15, 25, 32, 41, 46, 55) if variant else (0, 7, 16, 23, 32, 39, 48, 56)
    rng = random.Random(8800 + variant)
    cracks = [sorted(rng.sample(range(T), rng.choice((2, 3)))) for _ in bounds]
    tones = [[rng.choice(FACE) for _ in range(3)] for _ in bounds]

    def top_of(k: int, x: int) -> int:
        if k == 0:
            return 0
        return bounds[k] + int(round(3.6 * (vnoise(x, k * 17, 32, 300 + k, 6) - 0.5) * 2))

    for x in range(T):
        tops = [top_of(k, x) for k in range(len(bounds))] + [64]
        for y in range(64):
            k = max(i for i in range(len(bounds)) if y >= tops[i])
            dy, hh = y - tops[k], tops[k + 1] - tops[k]
            drift = 1 if h01(k, y // 4, 5 + variant) < 0.3 else 0
            cx = [(c + drift) % T for c in cracks[k]]
            blk = sum(1 for c in cx if x >= c) % 3
            base = tones[k][blk]
            if dy == 0 and k > 0:
                c = (14, 16, 19)
            elif x in cx:
                c = (18, 21, 24)
            else:
                f = 1.0 - 0.28 * dy / max(1, hh)
                if dy == 1:
                    f = 1.38
                elif dy == 2:
                    f = 1.16
                elif dy >= hh - 1:
                    f = 0.62
                if (x - 1) % T in cx:
                    f *= 1.12
                c = shade(base, f)
                if dy == 1 and h01(x, y, 40 + variant) < 0.3:
                    c = MOSS[2]
                elif dy == 2 and h01(x, y, 41 + variant) < 0.2:
                    c = MOSS[1]
                elif h01(x, y, 42 + variant) < 0.06:
                    c = shade(c, 0.88)
            cv.put(x, y, rgba(shade(c, 1.04 - 0.36 * (y / 63))))
    # escorrimentos molhados
    for sx in (5, 22):
        for y in range(6, 58):
            if h01(sx, y // 5, variant) < 0.7:
                c = cv.get(sx, y)
                cv.put(sx, y, rgba(shade(c[:3], 0.72)))
                if y % 13 == 0:
                    cv.put(sx, y, rgba(WET_HI))
    # franja de musgo pendendo do topo
    for x in range(T):
        ln = 2 + int(vnoise(x, 0, 32, 81, 4) * 5) + (3 if h01(x, 1, 82) < 0.12 else 0)
        for y in range(ln):
            k = 3 if y == 0 else (2 if y < ln // 2 else 1)
            cv.put(x, y, rgba(MOSS[k]))
        cv.put(x, ln, rgba(MOSS[0]))
    # base encharcada
    for x in range(T):
        for y, c in ((58, (24, 30, 34)), (59, (18, 22, 26)), (60, (14, 20, 26)), (61, (12, 16, 20)),
                     (62, (10, 12, 15)), (63, (7, 8, 10))):
            cv.put(x, y, rgba(c))
        if h01(x, 60, 3) < 0.3:
            cv.put(x, 60, rgba((40, 84, 96)))
    _COLUMN[variant] = cv
    return cv


def face_tile(kind: str, seed: int) -> Canvas:
    col = cliff_column(seed % 2)
    upper = kind.startswith("upper")
    cv = Canvas(T, T)
    for y in range(T):
        for x in range(T):
            cv.put(x, y, col.get(x, y + (0 if upper else T)))
    if kind == "upper_cracked":
        # veio de cristal brilhante
        pts = [(4, 26), (9, 21), (13, 18), (17, 13), (22, 10), (27, 5)]
        for (a, b) in zip(pts, pts[1:]):
            line(cv, a[0], a[1], b[0], b[1], rgba(GLOW))
            line(cv, a[0], a[1] + 1, b[0], b[1] + 1, rgba(GLOW_D))
        for (px, py, h) in ((9, 21, 5), (17, 13, 6), (22, 10, 4), (13, 18, 3)):
            for i in range(h):
                c = GLOW_W if i == h - 1 else (GLOW_L if i > h // 2 else GLOW)
                cv.put(px, py - i, rgba(c))
                cv.put(px + 1, py - i + 1, rgba(GLOW_D))
    elif kind == "lower_grate":
        # infiltracao: filete d'agua caindo numa pocinha + cogumelos
        for y in range(0, 25):
            cv.put(15, y, rgba(WATER_L if y % 4 else FOAM))
            cv.put(16, y, rgba(WATER if y % 5 else WATER_L))
        for y in range(25, 31):
            for x in range(9, 23):
                d = math.hypot((x + 0.5 - 16) / 7, (y + 0.5 - 28) / 2.6)
                if d < 1:
                    cv.put(x, y, rgba(WATER_D if d > 0.5 else WATER))
        for (x, y) in ((14, 26), (17, 26), (13, 28), (18, 27)):
            cv.put(x, y, rgba(FOAM))
        for (mx, my) in ((5, 27), (25, 28), (27, 26)):
            fill_rect(cv, mx, my, 1, 3, rgba((150, 190, 180)))
            for dx in (-1, 0, 1):
                cv.put(mx + dx, my - 1, rgba(GLOW if dx else GLOW_L))
            cv.put(mx, my - 2, rgba(GLOW))
    if upper:
        DB.overhang_shadow(cv)
        for x in range(T):  # reaplica o brilho da franja de musgo (fica acima da sombra)
            if cv.get(x, 0)[1] > 20:
                cv.put(x, 0, rgba(MOSS[2]))
    return cv


# ---------------------------------------------------------------------------
# Tema
# ---------------------------------------------------------------------------

def mouth_jit(t: float) -> float:
    return 1.6 * (vnoise(t, 0, 64, 909, 4) - 0.5) * 2


class GrottoTheme(SurfTheme):
    id = "village_grotto"
    title = "Gruta da Cachoeira"
    rim_lo = (10, 14, 16)
    rim = (72, 98, 80)
    rim_hi = (104, 136, 98)
    side_rim = (54, 74, 64)
    side_rim_lo = (16, 22, 22)
    rim_jitter = 0.35
    bg = (6, 8, 10)
    torch_rate = 6

    def floor(self, name: str) -> Canvas:
        return floor_tile(name)

    def cap_base(self, seed: int) -> Canvas:
        return rock_cap(seed)

    def face(self, kind: str, seed: int) -> Canvas:
        return face_tile(kind, seed)

    def door_opening(self, x: int, y: int) -> bool:
        dx = x + 0.5 - 31.5
        if y >= 27:
            return abs(dx) < 12.0 + mouth_jit(y * 1.7)
        ang = math.atan2(y + 0.5 - 27.0, dx)
        return math.hypot(dx, y + 0.5 - 27.0) < 12.0 + mouth_jit(40 + ang * 9)

    def door_north(self) -> Canvas:
        cv = Canvas(64, 64)
        for (x0, y0, k) in ((0, 0, "upper"), (32, 0, "upper"), (0, 32, "lower"), (32, 32, "lower")):
            blit(cv, face_tile(k, 9101 + x0 // 32), x0, y0)
        cx, cy = 31.5, 27.0
        for y in range(64):
            for x in range(64):
                dx = x + 0.5 - cx
                if self.door_opening(x, y):
                    t = min(1.0, max(0.0, (y - 14) / 49))
                    c = mix((3, 4, 7), (10, 22, 30), t ** 1.6)
                    if abs(dx) < 3.5 and y > 44:  # riacho saindo da caverna
                        c = mix(WATER_D, WATER, (y - 44) / 19)
                        if (y + int(round(1.5 * math.sin(dx * 1.3)))) % 6 == 0 and abs(dx) < 2.5:
                            c = WATER_L
                    cv.put(x, y, rgba(c))
                else:
                    # borda da boca: rocha mais clara/musgosa nos 3 px em volta
                    near = any(self.door_opening(x + ddx, y + ddy) for ddx, ddy in
                               ((3, 0), (-3, 0), (0, 3), (2, 2), (-2, 2), (0, -3)))
                    if near:
                        c = cv.get(x, y)[:3]
                        adj = any(self.door_opening(x + ddx, y + ddy) for ddx, ddy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                        cv.put(x, y, rgba((8, 10, 12) if adj else shade(c, 1.25)))
        # dentes de estalactite pendendo no topo da boca
        for (sx, ln) in ((24, 5), (28, 3), (33, 6), (38, 4), (21, 3), (42, 2)):
            top = 0
            for y in range(64):
                if self.door_opening(sx, y):
                    top = y
                    break
            for i in range(ln):
                w = 1 if i < ln - 1 else 0
                for xx in range(sx - w, sx + w + 1):
                    cv.put(xx, top + i, rgba(FACE[2] if xx <= sx else FACE[3]))
            cv.put(sx, top + ln, rgba((30, 120, 130)))  # gota
        # cogumelos na base das ombreiras
        for (mx, my) in ((17, 60), (19, 62), (46, 61)):
            fill_rect(cv, mx, my, 1, 2, rgba((150, 190, 180)))
            for ddx in (-1, 0, 1):
                cv.put(mx + ddx, my - 1, rgba(GLOW if ddx else GLOW_L))
        return cv

    def threshold(self) -> Canvas:
        cv = Canvas(64, T)
        blit(cv, floor_tile("floor_0"), 0, 0)
        blit(cv, floor_tile("floor_1"), 32, 0)
        for y in range(T):
            half = 3.6 + y * 0.12 + 0.9 * (vnoise(y, 2, 32, 12, 4) - 0.5)
            mid = 32 + 1.5 * math.sin(y / 6.0)
            for x in range(64):
                d = abs(x + 0.5 - mid)
                if d < half + 1:
                    c = (12, 16, 20) if d >= half else mix(WATER, WATER_D, d / half)
                    if d < half - 1 and (y + int(round(0.7 * math.sin((x - mid) * 0.9)))) % 6 == 0:
                        c = WATER_L
                    cv.put(x, y, rgba(c))
            if y < 3:
                for x in range(19, 45):
                    cv.put(x, y, rgba(shade(cv.get(x, y)[:3], 0.4 + 0.2 * y)))
        for (x, y) in ((27, 6), (37, 14), (29, 22), (36, 27)):
            cv.put(x, y, rgba(FOAM))
        return cv

    def short_face(self, cv: Canvas, x0: int, x1: int, y0: int, y1: int, rng: random.Random) -> None:
        col = cliff_column(0)
        for y in range(y0, y1):
            for x in range(x0, x1):
                c = col.get(x % T, 20 + (y - y0) * 2)[:3]
                if y == y0:
                    c = MOSS[2] if h01(x, y, 2) < 0.6 else MOSS[1]
                elif y == y1 - 1:
                    c = (8, 10, 12)
                cv.put(x, y, rgba(c))

    def post_cap(self, cv: Canvas, x: int, y: int, lit: bool) -> None:
        for (mx, my, r) in ((x - 2, y + 1, 2), (x + 2, y, 1)):
            cv.put(mx, my + 1, rgba((150, 190, 180)))
            for ddx in range(-r, r + 1):
                cv.put(mx + ddx, my, rgba(GLOW if abs(ddx) < r else GLOW_D))
            cv.put(mx, my - 1, rgba(GLOW_L))

    def passage_strip(self, cv: Canvas, orient: str, a0: int, a1: int, pos: int, inward: int) -> None:
        for k in range(a0, a1):
            x, y = (k, pos) if orient == "h" else (pos, k)
            cv.put(x, y, rgba(WATER if k % 3 else WATER_L))
            x2, y2 = (k, pos + 1) if orient == "h" else (pos + inward, k)
            cv.put(x2, y2, rgba(WATER_D))

    def props(self) -> List[Tuple[str, Canvas]]:
        return ([(f"torch_{i}", prop_glow_mushrooms(i)) for i in range(4)] + [
            ("mushrooms_floor", prop_floor_mushrooms()), ("puddle", prop_puddle()), ("rocks_wet", prop_rocks()),
            ("stalagmite", prop_stalagmite()), ("crystal", prop_crystal()), ("sulfur_spring", prop_sulfur()),
            ("bones", DB.prop_bones()), ("fern", prop_fern()),
            ("stream_top_l", prop_stream_top(0)), ("stream_top_r", prop_stream_top(1)),
            ("falls_pool_l", prop_pool(0)), ("falls_pool_r", prop_pool(1)),
        ])

    def props_tall(self) -> List[Tuple[str, Canvas]]:
        out: List[Tuple[str, Canvas]] = []
        for f in range(3):
            wl, wr = waterfall(f)
            out += [(f"waterfall_l_{f}", wl), (f"waterfall_r_{f}", wr)]
        out += [("stalagmite_tall", tall_stalagmite()), ("giant_mushroom", tall_giant_mushroom()),
                ("rock_column", tall_column())]
        return out

    def tall_animations(self):
        return {"waterfall_l": {"frames": [0, 2, 4], "frameRate": 8, "repeat": -1},
                "waterfall_r": {"frames": [1, 3, 5], "frameRate": 8, "repeat": -1}}

    def sample_floor_props(self):
        return ("crystal", "puddle", "mushrooms_floor", "sulfur_spring", "rocks_wet", "bones", "fern", "stalagmite")


# ---------------------------------------------------------------------------
# Props
# ---------------------------------------------------------------------------

def mushroom(cv: Canvas, cx: float, cap_y: float, rx: float, ry: float, stem_h: int, lvl: float) -> None:
    for y in range(int(cap_y), int(cap_y) + stem_h):
        cv.put(int(cx), y, rgba((176, 204, 196)))
        cv.put(int(cx) + 1, y, rgba((120, 150, 146)))

    def col(x, y, nx, ny):
        if ny > 0.35:
            return rgba(shade(GLOW_D, lvl))
        lit = -0.5 * nx - 0.8 * ny
        c = GLOW_W if lit > 0.75 else (GLOW_L if lit > 0.3 else (GLOW if lit > -0.3 else GLOW_D))
        return rgba(shade(c, lvl) if c != GLOW_W else c)
    fill_ellipse(cv, cx + 0.5, cap_y, rx, ry, col)
    for (dx, dy) in ((-rx * 0.4, -ry * 0.2), (rx * 0.35, -ry * 0.35)):
        cv.put(int(cx + dx), int(cap_y + dy), rgba(GLOW_W))


def prop_glow_mushrooms(frame: int) -> Canvas:
    lvl = (1.0, 0.86, 1.1, 0.93)[frame]
    body = Canvas(T, T)
    fill_ellipse(body, 16, 22, 10, 4.2, lambda x, y, nx, ny: rgba(
        MOSS[3] if ny < -0.4 else (MOSS[2] if ny < 0.2 else MOSS[1])))
    for (x, y) in ((7, 24), (25, 24), (10, 25), (22, 25)):
        body.put(x, y + 1, rgba(MOSS[1]))
        body.put(x, y + 2, rgba(MOSS[0]))
    mushroom(body, 15, 11, 5.6, 3.4, 10, lvl)
    mushroom(body, 9, 16, 3.6, 2.3, 6, lvl)
    mushroom(body, 22, 17, 2.8, 1.9, 5, lvl)
    cv = outline(body)
    spores = (((12, 5), (20, 3), (25, 9)), ((13, 3), (21, 6), (7, 8)), ((11, 2), (19, 4), (26, 6)),
              ((14, 1), (23, 5), (8, 6)))[frame]
    for (sx, sy) in spores:
        cv.put(sx, sy, rgba(GLOW_L, 220))
    return cv


def prop_floor_mushrooms() -> Canvas:
    body = Canvas(T, T)
    for (cx, cy, rx, ry, st) in ((11, 20, 4.2, 2.6, 6), (19, 22, 3.2, 2.0, 5), (23, 17, 2.4, 1.6, 4),
                                 (8, 25, 2.2, 1.4, 3)):
        mushroom(body, cx, cy, rx, ry, st, 1.0)
    cv = outline(body)
    contact_shadow(cv, 6, 26, 28, 80)
    return cv


def prop_puddle() -> Canvas:
    cv = Canvas(T, T)
    for y in range(T):
        for x in range(T):
            d = math.hypot((x + 0.5 - 16) / 13, (y + 0.5 - 18) / 7.5) + 0.18 * (vnoise(x, y, 32, 14, 4) - 0.5)
            if d < 1:
                cv.put(x, y, rgba((22, 28, 34) if d > 0.84 else WATER_D, 230))
    for (x0, x1, y) in ((8, 14, 16), (17, 23, 19), (11, 15, 21), (20, 22, 14)):
        for x in range(x0, x1):
            cv.put(x, y, rgba(WATER_L, 220))
    cv.put(12, 15, rgba(FOAM))
    return cv


def prop_rocks() -> Canvas:
    body = Canvas(T, T)
    for (cx, cy, rx, ry) in ((11, 22, 7, 5), (22, 24, 5.5, 3.8), (18, 17, 3.6, 3.2)):
        fill_ellipse(body, cx, cy, rx, ry, lambda x, y, nx, ny: rgba(
            (88, 100, 104) if nx + ny < -0.8 else ((60, 68, 72) if nx + ny < 0.3 else (36, 42, 46))))
    for (x, y) in ((8, 18), (9, 18), (19, 21), (16, 15)):
        body.put(x, y, rgba(WET_HI))
    for (x, y) in ((12, 26), (13, 26), (14, 26), (24, 27), (25, 27)):
        body.put(x, y, rgba(MOSS[2]))
    return outline(body)


def prop_stalagmite() -> Canvas:
    body = Canvas(T, T)
    for (cx, base, h, w) in ((15, 28, 22, 5.5), (22, 29, 12, 3.6), (9, 29, 9, 3.0)):
        for y in range(base - h, base + 1):
            t = (base - y) / h
            half = w * (1 - t) ** 0.9
            for x in range(int(cx - half - 1), int(cx + half + 2)):
                d = (x + 0.5 - cx) / max(half, 0.5)
                if abs(d) > 1:
                    continue
                c = (86, 96, 100) if d < -0.35 else ((58, 66, 70) if d < 0.4 else (36, 42, 46))
                if (y + x) % 6 == 0:
                    c = shade(c, 0.9)
                body.put(x, y, rgba(c))
    cv = outline(body)
    contact_shadow(cv, 5, 28, 30)
    return cv


def prop_crystal() -> Canvas:
    body = Canvas(T, T)
    for (bx, by, h, w, lean) in ((15, 27, 18, 3, 0), (10, 28, 11, 2, -3), (21, 28, 13, 2, 4), (18, 29, 7, 2, 2)):
        for i in range(h):
            t = i / h
            x = bx + int(lean * t)
            ww = max(1, int(round(w * (1 - t * 0.6))))
            for k in range(-ww, ww + 1):
                c = GLOW_W if k == -ww + 1 and i > 2 else (GLOW_L if k < 0 else (GLOW if k == 0 else GLOW_D))
                body.put(x + k, by - i, rgba(c))
        body.put(bx + lean, by - h, rgba(GLOW_W))
    fill_ellipse(body, 15, 28, 8, 2.2, lambda x, y, nx, ny: rgba((50, 58, 62) if ny < 0 else (34, 40, 44)))
    return outline(body)


def prop_sulfur() -> Canvas:
    cv = Canvas(T, T)
    for y in range(T):
        for x in range(T):
            d = math.hypot((x + 0.5 - 16) / 12, (y + 0.5 - 18) / 7.5) + 0.2 * (vnoise(x, y, 32, 31, 4) - 0.5)
            if d < 1:
                if d > 0.78:
                    c = SULF[0] if h01(x, y, 2) < 0.6 else SULF[1]
                else:
                    c = mix((70, 76, 40), (40, 52, 36), d)
                cv.put(x, y, rgba(c))
    for (bx, by, r) in ((13, 17, 1.6), (19, 19, 1.2), (16, 20, 0.9), (21, 16, 0.8)):
        fill_ellipse(cv, bx, by, r + 0.5, r + 0.5, lambda x, y, nx, ny: rgba(SULF[2] if ny < 0 else SULF[1]))
    for (x, y) in ((9, 12), (24, 13), (7, 20), (26, 22)):
        cv.put(x, y, rgba(SULF[2]))
    return cv


def prop_fern() -> Canvas:
    body = Canvas(T, T)
    for (ang, ln) in ((-2.4, 12), (-1.9, 14), (-1.5, 13), (-1.1, 14), (-0.7, 12), (-2.8, 9), (-0.3, 9)):
        for i in range(ln):
            x = 16 + math.cos(ang) * i
            y = 27 + math.sin(ang) * i + (i * i) * 0.03
            body.put(int(x), int(y), rgba(MOSS[2]))
            if i % 2 == 0 and i > 2:
                body.put(int(x) - 1, int(y) + 1, rgba(MOSS[3]))
                body.put(int(x) + 1, int(y) + 1, rgba(MOSS[1]))
    return outline(body)


def flow_col(gx: int, y: int, frame: int, width: int = 64) -> Tuple[int, int, int]:
    """Agua corrente: filetes verticais (suaves em x) com tracos longos descendo a cada frame."""
    strand = vnoise(gx, 0, width, 61, 3)
    phase = int(h01(gx, 0, 62) * 20)
    flow = h01(gx, (y + phase - frame * 6) // 9, 63)
    v = 0.5 * strand + 0.5 * flow
    if v > 0.82 and flow > 0.8:
        return FOAM
    if v > 0.62:
        return WATER_L
    if v > 0.36:
        return WATER
    return shade(WATER, 0.78)


def prop_stream_top(side: int) -> Canvas:
    """Topo do riacho sobre o paredao (2 tiles: l + r), escorrendo para a borda sul."""
    cv = Canvas(T, T)
    for y in range(T):
        for xl in range(T):
            gx = xl + side * T
            half = 24.0 - 6.0 * (1 - y / 31) + 1.2 * (vnoise(y, side, 32, 3, 4) - 0.5)
            d = abs(gx + 0.5 - 32)
            if d < half:
                c = flow_col(gx, y, 0)
                if d > half - 1.5:
                    c = (24, 50, 60)
                if y >= 29:
                    c = FOAM if (gx + y) % 3 else WATER_L
                cv.put(xl, y, rgba(c))
            elif d < half + 1.5:
                cv.put(xl, y, rgba(MOSS[2] if h01(gx, y, 5) < 0.5 else MOSS[1]))
    return cv


def prop_pool(side: int) -> Canvas:
    """Poca de espuma ao pe da cachoeira (2 tiles: l + r)."""
    cv = Canvas(T, T)
    for y in range(T):
        for xl in range(T):
            gx = xl + side * T
            d = math.hypot((gx + 0.5 - 32) / 29, (y + 0.5 - 6) / 20) + 0.08 * (vnoise(gx, y, 64, 4, 4) - 0.5)
            if d >= 1:
                continue
            if d > 0.9:
                c = (20, 26, 30)
            else:
                foam = max(0.0, 1 - (y + 0.5) / 15) * (0.6 + 0.6 * h01(gx // 2, y // 2, 8))
                c = mix(mix(WATER, WATER_D, d), FOAM, min(1.0, foam))
                if abs(math.hypot((gx + 0.5 - 32) / 29, (y + 0.5 - 4) / 20) - 0.62) < 0.035:
                    c = WATER_L  # anel de onda
            cv.put(xl, y, rgba(c, 235))
    return cv


def waterfall(frame: int) -> Tuple[Canvas, Canvas]:
    W = 64
    cv = Canvas(W, 64)
    for y in range(64):
        for x in range(W):
            half = 25.0 + 1.0 * (vnoise(y, 0, 64, 7, 8) - 0.5)
            d = abs(x + 0.5 - 32)
            if d >= half:
                continue
            c = flow_col(x, y, frame)
            if d > half - 2.5:
                c = shade(c, 0.62)
            if y < 4:
                c = FOAM if y < 2 or (x + frame) % 3 else WATER_L
            elif y < 7:
                c = mix(c, FOAM, 0.4)
            a = 238
            if y > 50:
                mist = (y - 50) / 13
                c = mix(c, FOAM, mist * 0.85)
                a = int(238 - mist * 40)
            cv.put(x, y, rgba(c, a))
    return sub_c(cv, 0), sub_c(cv, 32)


def sub_c(cv: Canvas, x0: int) -> Canvas:
    out = Canvas(T, 64)
    for y in range(64):
        for x in range(T):
            out.put(x, y, cv.get(x0 + x, y))
    return out


def tall_stalagmite() -> Canvas:
    body = Canvas(T, 64)
    for (cx, base, h, w) in ((15, 60, 54, 9.0), (24, 61, 20, 4.0), (7, 61, 14, 3.4)):
        for y in range(base - h, base + 1):
            t = (base - y) / h
            half = w * (1 - t) ** 0.85
            wob = 0.8 * math.sin(y / 5.0)
            for x in range(int(cx - half - 2), int(cx + half + 3)):
                d = (x + 0.5 - cx - wob) / max(half, 0.5)
                if abs(d) > 1:
                    continue
                c = (90, 100, 104) if d < -0.4 else ((62, 70, 74) if d < 0.35 else (38, 44, 48))
                if (y // 4) % 3 == 0 and abs(d) < 0.9:
                    c = shade(c, 0.88)
                body.put(x, y, rgba(c))
    for (x, y) in ((12, 30), (13, 31), (11, 44), (17, 20)):
        body.put(x, y, rgba(WET_HI))
    for x in range(8, 24):
        if body.get(x, 56)[3] and h01(x, 1, 4) < 0.6:
            body.put(x, 56, rgba(MOSS[2]))
            body.put(x, 57, rgba(MOSS[1]))
    cv = Canvas(T, 64)
    ellipse_shadow(cv, 16, 61, 13, 2.6, 130)
    blit(cv, outline(body), 0, 0)
    return cv


def tall_giant_mushroom() -> Canvas:
    body = Canvas(T, 64)
    for y in range(20, 61):
        wob = int(round(1.5 * math.sin(y / 7.0)))
        for x in range(13 + wob, 19 + wob + (1 if y > 54 else 0)):
            c = (196, 220, 212) if x < 15 + wob else ((150, 180, 172) if x < 18 + wob else (98, 122, 118))
            body.put(x, y, rgba(c))
    for y in range(34, 38):
        for x in range(9, 23):
            if abs(x + 0.5 - 16) < 7 - (y - 34):
                body.put(x, y, rgba((120, 150, 144) if y > 34 else (176, 204, 196)))
    mushroom(body, 15.5, 16, 14.5, 9.0, 0, 1.0)
    for (x, y) in ((8, 15), (12, 10), (20, 11), (24, 16), (16, 8)):
        fill_ellipse(body, x, y, 1.4, 1.1, lambda xx, yy, nx, ny: rgba(GLOW_W))
    for x in range(3, 29, 3):
        body.put(x, 21, rgba(GLOW_D))
        body.put(x, 22, rgba((10, 70, 78)))
    cv = Canvas(T, 64)
    ellipse_shadow(cv, 16, 61, 9, 2.4, 120)
    blit(cv, outline(body), 0, 0)
    return cv


def tall_column() -> Canvas:
    body = Canvas(T, 64)
    for y in range(0, 61):
        half = 6.5 + 4.0 * (abs(y - 30) / 30) ** 2 + 0.8 * math.sin(y / 4.0)
        for x in range(int(16 - half), int(16 + half) + 1):
            d = (x + 0.5 - 16) / half
            c = (84, 94, 98) if d < -0.4 else ((58, 66, 70) if d < 0.4 else (36, 42, 46))
            if (y // 3 + x // 4) % 5 == 0:
                c = shade(c, 0.88)
            body.put(x, y, rgba(c))
    for y in range(4, 58, 9):
        body.put(11, y, rgba(WET_HI))
    for x in range(5, 28):
        if body.get(x, 57)[3]:
            body.put(x, 57, rgba(MOSS[2]))
            body.put(x, 58, rgba(MOSS[1]))
    cv = Canvas(T, 64)
    ellipse_shadow(cv, 16, 61, 13, 2.6, 130)
    blit(cv, outline(body), 0, 0)
    return cv


def main() -> None:
    build_theme(GrottoTheme())


if __name__ == "__main__":
    main()
