"""
SUBMUNDO - Bioma `herb_field` (Plantacao de Ervas, Missao 1) - BRF-138 / T-131
================================================================================

Identidade (paleta 1.2 "Grama & Trilha", fim de tarde):
- piso: grama viva com folhas desenhadas (#3d6b35 / #2f5229 / #5a8f49, um pouco olivada p/ separar dos slimes);
- "paredes" 2.5D = sebes altas: topo = copa de folhas vista de cima, face = sebe + mureta de pedra seca
  (ou cerca de estacas); borda organica (aro com jitter);
- portas: arco de sebe podada com pergolado de madeira e flores; passagens com moirao de madeira;
- luz do bioma (torch_0..3): lanterna de papel pendurada num galho;
- props: canteiros (manjericao, lavanda, mudas), trilhas de terra (decalques que emendam), cestos,
  regador, pedras, arbusto florido; altos: espantalho, poco, macieira, girassois.

Uso: python scripts/art/biomes/surf_herb_field.py
"""
from __future__ import annotations

import math
import random
from typing import List, Tuple

from surf_common import (
    Canvas, SurfTheme, T, blit, build_theme, contact_shadow, ellipse_shadow, fill_ellipse, fill_rect, h01,
    leaf_blobs, line, mix, outline, rgba, shade, vnoise, voronoi_stones,
)
import surf_village as SV

G_DARK = (34, 56, 30)
G_LO = (44, 70, 37)
G_MID = (54, 84, 44)
G_HI = (72, 104, 54)
G_TIP = (94, 126, 64)
HEDGE = ((18, 36, 22), (30, 56, 32), (44, 78, 40), (66, 104, 52))
HEDGE_TOP = ((24, 46, 26), (42, 76, 38), (62, 104, 48), (92, 136, 62))
STONE = ((112, 104, 86), (100, 93, 77), (122, 113, 94), (92, 86, 72))
ST_CRACK = (44, 40, 32)
DIRT = ((96, 72, 46), (86, 64, 41), (106, 80, 51))
DIRT_D = (66, 48, 32)
SOIL = ((60, 42, 28), (52, 36, 24), (70, 50, 32))
W_D, W, W_L, W_H = (46, 30, 18), (98, 70, 44), (128, 96, 62), (156, 124, 84)
FLOWERS = ((232, 232, 214), (236, 204, 84), (156, 116, 198), (214, 96, 120))


# ---------------------------------------------------------------------------
# Grama
# ---------------------------------------------------------------------------

def grass(cv: Canvas, seed: int, density: float = 0.14, tint: float = 1.0) -> None:
    for y in range(T):
        for x in range(T):
            n = vnoise(x, y, 32, seed, 8)
            c = mix(G_LO, G_MID, n)
            if (x + y) % 2 and h01(x, y, seed + 9) < 0.3:
                c = shade(c, 0.93)
            cv.put(x, y, rgba(shade(c, tint)))
    blades = [(x, y) for y in range(T) for x in range(T) if h01(x, y, seed + 1) < density]
    blades.sort(key=lambda p: p[1])
    for (x, y) in blades:
        ln = 2 + int(h01(x, y, seed + 2) * 2)
        lean = 1 if h01(x, y, seed + 3) < 0.25 else 0
        for i in range(ln):
            c = G_DARK if i == 0 else (G_TIP if i == ln - 1 else G_HI)
            cv.put((x + (lean if i == ln - 1 else 0)) % T, (y - i) % T, rgba(shade(c, tint)))


def flower(cv: Canvas, x: int, y: int, c, wrap: bool = True) -> None:
    pts = ((0, -1), (-1, 0), (1, 0), (0, 1))
    for (dx, dy) in pts:
        px, py = (x + dx, y + dy)
        cv.put(px % T if wrap else px, py % T if wrap else py, rgba(c if dy <= 0 else shade(c, 0.8)))
    cv.put(x % T if wrap else x, y % T if wrap else y, rgba((240, 196, 60) if c != FLOWERS[1] else (150, 90, 30)))


def floor_tile(name: str) -> Canvas:
    seeds = {"floor_0": 31, "floor_1": 32, "floor_2": 33, "floor_cracked": 34, "floor_moss": 35, "floor_blood": 36}
    seed = seeds[name]
    cv = Canvas(T, T)
    grass(cv, seed, 0.13 if name != "floor_2" else 0.17)
    rng = random.Random(seed)
    if name == "floor_1":
        for _ in range(2):
            flower(cv, rng.randint(2, 29), rng.randint(2, 29), FLOWERS[0])
    elif name == "floor_2":
        for (cx, cy) in ((9, 21), (23, 8)):
            for k in range(5):
                a = k * 1.3
                px, py = int(cx + math.cos(a) * 3), int(cy + math.sin(a) * 2)
                for (dx, dy) in ((0, 0), (1, 0), (0, 1)):
                    cv.put((px + dx) % T, (py + dy) % T, rgba((40, 76, 38) if dy else (60, 100, 50)))
    elif name == "floor_cracked":
        # trecho pisoteado de terra (rodeado de grama, nao encosta nas bordas)
        for y in range(T):
            for x in range(T):
                d = math.hypot((x + 0.5 - 16) / 10.5, (y + 0.5 - 17) / 7.5) + 0.3 * (vnoise(x, y, 32, 5, 6) - 0.5)
                if d < 1:
                    c = DIRT[int(h01(x, y, 6) * 3)]
                    if d > 0.85:
                        c = DIRT_D
                    elif h01(x, y, 7) < 0.06:
                        c = (130, 118, 98)
                    cv.put(x, y, rgba(c))
        for (x, y) in ((8, 12), (22, 23), (12, 24), (25, 13), (17, 10)):
            for i, c in enumerate((G_DARK, G_HI, G_TIP)):
                cv.put(x, y - i, rgba(c))
    elif name == "floor_moss":
        for _ in range(9):
            flower(cv, rng.randint(1, 30), rng.randint(1, 30), rng.choice(FLOWERS))
    elif name == "floor_blood":
        # trevos escuros + cogumelinhos
        for y in range(T):
            for x in range(T):
                if vnoise(x, y, 32, 77, 8) > 0.58:
                    cv.put(x, y, rgba(shade(cv.get(x, y)[:3], 0.82)))
        for (cx, cy) in ((10, 12), (21, 20), (14, 25)):
            fill_ellipse(cv, cx, cy, 2.2, 1.6, lambda x, y, nx, ny: rgba((200, 186, 160) if ny < 0 else (150, 132, 110)))
            cv.put(cx, cy + 2, rgba((220, 210, 190)))
    return cv


# ---------------------------------------------------------------------------
# Sebe
# ---------------------------------------------------------------------------

def hedge_cap(seed: int) -> Canvas:
    cv = Canvas(T, T, rgba(HEDGE_TOP[0]))
    rng = random.Random(seed)
    leaf_blobs(cv, rng, 74, 0, 0, T, T, HEDGE_TOP, 1.8, 3.4)
    for _ in range(8):
        x, y = rng.randint(0, 31), rng.randint(0, 31)
        cv.put(x, y, rgba((96, 134, 66)))
    return cv


def hedge_front(cv: Canvas, y0: int, y1: int, gy: int, seed: int) -> None:
    def fac(yy: int) -> float:
        g = gy + yy
        return max(0.42, 0.92 - 0.6 * g / 64)
    sub = Canvas(T, y1 - y0, rgba(shade(HEDGE[0], 0.8)))
    rng = random.Random(seed)
    leaf_blobs(sub, rng, int(2.3 * (y1 - y0)), 0, -2, T, y1 - y0 + 2, HEDGE, 1.7, 3.2,
               wrap=True, yfac=lambda yy: fac(yy + y0), sx=1.25)
    blit(cv, sub, 0, y0)


def drystone(cv: Canvas, y0: int, y1: int, seed: int) -> None:
    sub = Canvas(T, y1 - y0)
    voronoi_stones(sub, 6100 + seed % 2, 7, STONE, ST_CRACK, 1.2, 0.7, sx=1.6, sy=1.0, w=T, h=y1 - y0)
    blit(cv, sub, 0, y0)
    for x in range(T):  # pedras de capa
        cv.put(x, y0, rgba((146, 138, 116) if h01(x, y0, 3) > 0.15 else ST_CRACK))
        cv.put(x, y0 + 1, rgba(shade(cv.get(x, y0 + 1)[:3], 1.15)))


def ground(cv: Canvas, y0: int) -> None:
    for x in range(T):
        for i, c in enumerate(((40, 52, 30), (30, 40, 24), (22, 30, 18), (16, 22, 14))):
            cv.put(x, y0 + i, rgba(c))
    for x in range(1, T, 3):
        if h01(x, 7, 2) < 0.7:
            for i, c in enumerate((G_DARK, G_LO, G_HI)):
                cv.put(x, y0 + 3 - i, rgba(c))


def pickets(cv: Canvas, y_top: int, y_bot: int) -> None:
    for px in range(1, T, 6):
        for x in range(px, px + 4):
            for y in range(y_top - (1 if x in (px + 1, px + 2) else 0), y_bot):
                c = W_L if x == px else (W if x < px + 3 else W_D)
                if y <= y_top - 1 and x in (px, px + 3):
                    continue
                if h01(x, y, 4) < 0.1:
                    c = shade(c, 0.85)
                cv.put(x, y, rgba(c))
    for ry in (y_top + 5, y_bot - 6):
        for x in range(T):
            if cv.get(x, ry)[1] < 60 or True:
                cv.put(x, ry, rgba(W_L))
                cv.put(x, ry + 1, rgba(W_D))


def face_tile(kind: str, seed: int) -> Canvas:
    cv = Canvas(T, T)
    if kind.startswith("upper"):
        hedge_front(cv, 0, T, 0, 700 + (seed % 2))
        if kind == "upper_cracked":
            rng = random.Random(seed)
            for _ in range(11):
                x, y = rng.randint(3, 28), rng.randint(3, 27)
                c = (238, 234, 214) if rng.random() < 0.6 else (226, 132, 156)
                for (dx, dy) in ((0, 0), (1, 0), (0, 1), (1, 1), (-1, 0), (0, -1)):
                    cv.put(x + dx, y + dy, rgba(c if (dx, dy) != (1, 1) else shade(c, 0.75)))
                cv.put(x, y, rgba((250, 220, 110)))
        # topo ensolarado da sebe
        for x in range(T):
            for y in range(3):
                cv.put(x, y, rgba(shade(cv.get(x, y)[:3], 1.12 - 0.04 * y)))
    else:
        hedge_front(cv, 0, 16, 32, 710 + (seed % 2))
        # galhos/sombra na base da sebe
        for x in range(0, T, 5):
            for y in range(10, 16):
                if h01(x, y, 5) < 0.5:
                    cv.put(x, y, rgba((40, 28, 18)))
        if kind == "lower_grate":
            for y in range(16, 28):
                for x in range(T):
                    cv.put(x, y, rgba(shade(HEDGE[0], 0.7)))
            pickets(cv, 9, 28)
        else:
            drystone(cv, 15, 28, seed)
        ground(cv, 28)
    return cv


# ---------------------------------------------------------------------------
# Tema
# ---------------------------------------------------------------------------

class HerbFieldTheme(SurfTheme):
    id = "herb_field"
    title = "Plantação de Ervas"
    rim_lo = (14, 28, 16)
    rim = (92, 136, 62)
    rim_hi = (116, 160, 74)
    side_rim = (70, 110, 52)
    side_rim_lo = (14, 30, 16)
    rim_jitter = 0.42
    bg = (12, 22, 14)

    def floor(self, name: str) -> Canvas:
        return floor_tile(name)

    def cap_base(self, seed: int) -> Canvas:
        return hedge_cap(seed)

    def face(self, kind: str, seed: int) -> Canvas:
        return face_tile(kind, seed)

    def face_end(self, kind: str, sides: str, seed: int) -> Canvas:
        cv = self.face(kind, seed)
        upper = kind == "upper"
        for side in sides:
            for y in range(T):
                bump = 1 if h01(y // 3, 5, seed) < 0.5 else 0
                for i in range(7):
                    x = i if side == "l" else T - 1 - i
                    c = cv.get(x, y)[:3]
                    in_stone = (not upper) and 15 <= y < 28
                    if i < bump:
                        c = self.bg
                    elif i == bump:
                        c = HEDGE[0] if not in_stone else ST_CRACK
                    elif i == bump + 1 and not in_stone:
                        c = HEDGE[3] if y % 4 else HEDGE[2]
                    elif in_stone and i == bump + 1:
                        c = (150, 140, 118)
                    else:
                        c = shade(c, 0.7 + 0.05 * i)
                    if (not upper) and y >= 28:
                        c = shade(cv.get(x, y)[:3], 0.8)
                    cv.put(x, y, rgba(c))
        return cv

    def door_north(self) -> Canvas:
        cv = Canvas(64, 64)
        blit(cv, face_tile("upper", 9101), 0, 0)
        blit(cv, face_tile("upper", 9102), 32, 0)
        blit(cv, face_tile("lower", 9103), 0, 32)
        blit(cv, face_tile("lower", 9104), 32, 32)
        cx, cy = 31.5, 27.0
        for y in range(64):
            for x in range(64):
                dx = x + 0.5 - cx
                if self.door_opening(x, y):
                    t = min(1.0, max(0.0, (y - 14) / 49))
                    # tunel de sebe que clareia rumo ao campo do outro lado
                    side = abs(dx) / 12.5
                    path = abs(dx) < 4 + t * 5
                    if path:
                        c = mix((26, 20, 14), DIRT[0], t ** 1.2)
                    else:
                        c = mix((10, 20, 12), G_LO, t ** 1.4)
                        if h01(x, y, 3) < 0.2:
                            c = shade(c, 1.2)
                    c = shade(c, 1 - 0.35 * side ** 3)
                    cv.put(x, y, rgba(c))
                else:
                    r = math.hypot(dx, y + 0.5 - cy)
                    near = (r < 15.5 and y < cy) or (abs(dx) < 15.5 and y >= cy)
                    if near:  # folhagem podada mais escura em volta do vao
                        cv.put(x, y, rgba(shade(cv.get(x, y)[:3], 0.72)))
        # pergolado de madeira acompanhando o arco
        for y in range(18, 64):
            for x in (17, 18, 19, 44, 45, 46):
                if y < 27:
                    continue
                k = x - (17 if x < 30 else 44)
                cv.put(x, y, rgba((W_L, W, W_D)[k]))
        for k in range(181):
            a = math.pi + k / 180 * math.pi
            for rr, c in ((14.0, W_L), (15.0, W), (16.0, W_D)):
                px = int(math.floor(cx + math.cos(a) * rr))
                py = int(math.floor(cy + math.sin(a) * rr))
                cv.put(px, py, rgba(c))
        # trepadeira com flores sobre o pergolado
        rng = random.Random(77)
        for k in range(30):
            a = math.pi + rng.random() * math.pi
            rr = 15 + rng.uniform(-1.5, 1.5)
            px, py = int(cx + math.cos(a) * rr), int(cy + math.sin(a) * rr)
            cv.put(px, py, rgba(HEDGE[3] if k % 3 else HEDGE[2]))
            if k % 3 == 0:
                c = FLOWERS[3] if k % 2 else FLOWERS[0]
                cv.put(px + 1, py, rgba(c))
                cv.put(px, py - 1, rgba(shade(c, 1.1)))
        for k in range(10):
            y = 30 + k * 3
            for x in (16 + (k % 2), 47 - (k % 2)):
                cv.put(x, y, rgba(HEDGE[3]))
                if k % 3 == 1:
                    cv.put(x, y + 1, rgba(FLOWERS[3]))
        return cv

    def threshold(self) -> Canvas:
        cv = Canvas(64, T)
        blit(cv, floor_tile("floor_0"), 0, 0)
        blit(cv, floor_tile("floor_1"), 32, 0)
        for y in range(T):
            for x in range(64):
                half = 10 - y * 0.06 + 1.2 * (vnoise(x, y, 64, 9, 6) - 0.5)
                if abs(x + 0.5 - 32) < half:
                    c = DIRT[int(h01(x, y, 2) * 3)]
                    if abs(x + 0.5 - 32) > half - 1.2:
                        c = DIRT_D
                    if y < 3:
                        c = shade(c, 0.55 + 0.15 * y)
                    cv.put(x, y, rgba(c))
        for (sx, sy) in ((28, 9), (36, 20)):
            fill_ellipse(cv, sx, sy, 4.6, 2.8, lambda x, y, nx, ny: rgba(
                (150, 142, 122) if nx + ny < -0.5 else ((124, 116, 98) if ny < 0.55 else (84, 78, 66))))
        return cv

    def short_face(self, cv: Canvas, x0: int, x1: int, y0: int, y1: int, rng: random.Random) -> None:
        for y in range(y0, y1):
            for x in range(x0, x1):
                yin = (y - y0) % 4
                xm = (x + (3 if ((y - y0) // 4) % 2 else 0)) % 7
                base = STONE[(x // 7 + (y - y0) // 4) % 4]
                col = ST_CRACK if (yin == 0 or xm == 0) else base
                if y == y0:
                    col = HEDGE[2] if h01(x, y, 3) < 0.6 else HEDGE[1]
                elif y == y1 - 1:
                    col = (22, 30, 18)
                elif col != ST_CRACK and rng.random() < 0.1:
                    col = shade(col, 0.86)
                cv.put(x, y, rgba(col))

    def post_cap(self, cv: Canvas, x: int, y: int, lit: bool) -> None:
        # topo de moirao de madeira saindo da sebe
        for yy in range(-3, 3):
            for xx in range(-2, 3):
                c = W_L if yy < -1 else (W if xx < 2 else W_D)
                if yy == -3:
                    c = W_H if xx < 1 else W_L
                cv.put(x + xx, y + yy, rgba(c))
        for xx in range(-2, 4):
            cv.put(x + xx, y + 3, rgba(HEDGE[0]))

    def props(self) -> List[Tuple[str, Canvas]]:
        return ([(f"torch_{i}", prop_paper_lantern(i)) for i in range(4)] + [
            ("herb_bed_basil", prop_bed("basil")), ("herb_bed_lavender", prop_bed("lavender")),
            ("herb_bed_sprouts", prop_bed("sprouts")), ("basket_herbs", prop_basket()),
            ("trail_ew", prop_trail("ew")), ("trail_ns", prop_trail("ns")), ("trail_ne", prop_trail("ne")),
            ("trail_nw", prop_trail("nw")), ("trail_se", prop_trail("se")), ("trail_sw", prop_trail("sw")),
            ("watering_can", prop_can()), ("rocks", prop_rocks()), ("flower_bush", prop_bush()),
            ("seed_sack", SV.prop_sacks()),
        ])

    def props_tall(self) -> List[Tuple[str, Canvas]]:
        return [("scarecrow", tall_scarecrow()), ("well", tall_well()), ("tree_apple", tall_apple_tree()),
                ("sunflowers", tall_sunflowers())]

    def sample_floor_props(self):
        return ("basket_herbs", "herb_bed_basil", "herb_bed_lavender", "watering_can", "herb_bed_sprouts",
                "rocks", "flower_bush", "seed_sack")


# ---------------------------------------------------------------------------
# Props
# ---------------------------------------------------------------------------

def prop_paper_lantern(frame: int) -> Canvas:
    lvl = (1.0, 0.88, 1.08, 0.94)[frame]
    sway = (0, 1, 0, -1)[frame]
    body = Canvas(T, T)
    # galho saindo da sebe
    for x in range(6, 24):
        y = 5 + (x - 6) // 7
        body.put(x, y, rgba(W))
        body.put(x, y + 1, rgba(W_D))
    for (x, y) in ((9, 4), (10, 3), (19, 6), (20, 5), (13, 4)):
        body.put(x, y, rgba(HEDGE[2]))
        body.put(x + 1, y, rgba(HEDGE[3]))
    cx = 16 + sway
    for y in range(7, 10):
        body.put(16 + (sway if y > 8 else 0), y, rgba((70, 50, 30)))
    fill_rect(body, cx - 3, 10, 7, 2, rgba((60, 40, 26)))
    for y in range(12, 24):
        t = (y - 12) / 11
        half = 6.2 * math.sin(math.pi * (0.12 + 0.76 * t))
        for x in range(int(cx + 0.5 - half - 1), int(cx + 0.5 + half + 1)):
            d = (x + 0.5 - (cx + 0.5)) / max(half, 0.5)
            if abs(d) > 1:
                continue
            core = 1 - min(1.0, math.hypot(d, (t - 0.55) * 1.8))
            c = mix((168, 62, 30), (255, 214, 120), core ** 0.8)
            c = shade(c, lvl)
            if y in (15, 19):
                c = shade(c, 0.78)
            body.put(x, y, rgba(c))
    fill_rect(body, cx - 3, 24, 7, 2, rgba((60, 40, 26)))
    body.put(cx, 26, rgba((200, 40, 40)))
    body.put(cx, 27, rgba((150, 30, 30)))
    return outline(body)


def prop_bed(kind: str) -> Canvas:
    body = Canvas(T, T)
    for y in range(9, 30):
        for x in range(2, 30):
            dx = max(0, abs(x + 0.5 - 16) - 11)
            dy = max(0, abs(y + 0.5 - 19.5) - 7.5)
            if dx * dx + dy * dy > 9:
                continue
            c = SOIL[int(h01(x, y, 4) * 3)]
            if (y - 10) % 5 == 0:
                c = shade(SOIL[0], 0.7)  # sulcos
            elif (y - 10) % 5 == 1:
                c = shade(SOIL[2], 1.15)
            body.put(x, y, rgba(c))
    rng = random.Random(len(kind))
    rows = (13, 19, 25)
    for ry in rows:
        for px in range(6, 28, 5):
            jx = px + rng.randint(-1, 1)
            if kind == "basil":
                leaf_blobs(body, rng, 6, jx - 3, ry - 5, 7, 6,
                           ((24, 52, 24), (44, 96, 40), (70, 134, 54), (112, 176, 76)), 1.4, 2.2, wrap=False)
            elif kind == "lavender":
                if px % 2 == 0 and ry != 19:
                    pass
                fill_ellipse(body, jx + 0.5, ry - 1.5, 3.0, 2.2, lambda x, y, nx, ny: rgba(
                    (128, 150, 112) if nx + ny < -0.6 else ((96, 118, 86) if nx + ny < 0.5 else (66, 84, 60))))
                for k in (-2, -1, 1, 2):
                    hgt = 3 + (abs(k) == 1)
                    for i in range(hgt):
                        c = (186, 160, 230) if i == hgt - 1 else ((150, 118, 206) if i % 2 else (116, 86, 172))
                        body.put(jx + k + (k // 2 if i == hgt - 1 else 0), ry - 3 - i, rgba(c))
            else:
                body.put(jx, ry - 1, rgba((70, 120, 50)))
                body.put(jx - 1, ry - 2, rgba((104, 160, 70)))
                body.put(jx + 1, ry - 2, rgba((104, 160, 70)))
                body.put(jx, ry - 2, rgba((80, 136, 56)))
    if kind == "sprouts":
        fill_rect(body, 25, 8, 4, 3, rgba((190, 170, 130)))
        for y in range(11, 16):
            body.put(26, y, rgba(W))
    cv = outline(body)
    return cv


def prop_basket() -> Canvas:
    body = Canvas(T, T)
    rng = random.Random(5)
    leaf_blobs(body, rng, 16, 7, 8, 18, 9, ((24, 52, 24), (44, 96, 40), (70, 134, 54), (112, 176, 76)), 1.5, 2.6,
               wrap=False)
    for (x, y) in ((10, 10), (19, 9), (22, 12), (14, 8)):
        body.put(x, y, rgba((150, 118, 206)))
        body.put(x, y - 1, rgba((186, 160, 230)))
    for y in range(15, 28):
        half = 10.5 - (y - 15) * 0.22
        for x in range(int(16 - half), int(16 + half)):
            c = (150, 112, 62) if ((x + (y // 2)) % 3) else (108, 78, 42)
            if y in (15, 16):
                c = (176, 136, 80)
            body.put(x, y, rgba(c))
    for x in range(8, 25):
        y = int(15 - 10 * math.sin((x - 7) / 18 * math.pi))
        body.put(x, y, rgba((150, 112, 62)))
        body.put(x, y + 1, rgba((108, 78, 42)))
    cv = outline(body)
    contact_shadow(cv, 6, 27, 28)
    return cv


def prop_trail(dirs: str) -> Canvas:
    """Decalque de trilha de terra: emenda com qualquer outra trilha na borda (largura periodica)."""
    cv = Canvas(T, T)

    def half_w(a: float) -> float:
        return 7.0 + 1.6 * (vnoise(a, 3, 32, 41, 8) - 0.5) * 2

    def inside(x: float, y: float) -> float:
        best = -9.0
        cx = cy = 15.5
        d = math.hypot(x - cx, y - cy)
        best = max(best, (7.2 + 1.2 * (vnoise(x, y, 32, 42, 6) - 0.5)) - d)
        if "e" in dirs and x >= cx:
            best = max(best, half_w(x) - abs(y - cy))
        if "w" in dirs and x <= cx:
            best = max(best, half_w(x) - abs(y - cy))
        if "n" in dirs and y <= cy:
            best = max(best, half_w(y) - abs(x - cx))
        if "s" in dirs and y >= cy:
            best = max(best, half_w(y) - abs(x - cx))
        return best

    for y in range(T):
        for x in range(T):
            v = inside(x + 0.5, y + 0.5)
            if v <= 0:
                continue
            c = DIRT[int(h01(x, y, 12) * 3)]
            if v < 1.2:
                c = DIRT_D
            # sulcos de roda/pegadas paralelos ao eixo
            horiz = ("e" in dirs or "w" in dirs) and abs(y + 0.5 - 15.5) < 7
            vert = ("n" in dirs or "s" in dirs) and abs(x + 0.5 - 15.5) < 7
            if (horiz and abs(abs(y + 0.5 - 15.5) - 3.5) < 0.6 and len(dirs) == 2 and dirs in ("ew",)) or \
               (vert and abs(abs(x + 0.5 - 15.5) - 3.5) < 0.6 and dirs == "ns"):
                c = shade(c, 0.86)
            if h01(x, y, 13) < 0.04:
                c = (132, 120, 100)
            cv.put(x, y, rgba(c))
    # tufos de grama invadindo a borda
    for y in range(T):
        for x in range(T):
            v = inside(x + 0.5, y + 0.5)
            if 0 < v < 1.6 and h01(x, y, 14) < 0.3:
                cv.put(x, y, rgba(G_HI))
                if y > 0 and inside(x + 0.5, y - 0.5) > 0:
                    cv.put(x, y - 1, rgba(G_TIP))
    return cv


def prop_can() -> Canvas:
    body = Canvas(T, T)
    metal = ((60, 78, 74), (84, 106, 100), (112, 138, 128), (150, 172, 160))
    for y in range(14, 28):
        for x in range(9, 21):
            d = (x + 0.5 - 15) / 6
            c = metal[3] if d < -0.6 else (metal[2] if d < -0.1 else (metal[1] if d < 0.6 else metal[0]))
            if y in (17, 25):
                c = metal[0]
            body.put(x, y, rgba(c))
    fill_ellipse(body, 15, 14, 6, 1.8, lambda x, y, nx, ny: rgba(metal[0] if nx * nx + ny * ny > 0.5 else (20, 30, 40)))
    line(body, 20, 24, 27, 15, rgba(metal[1]))
    line(body, 20, 23, 26, 15, rgba(metal[2]))
    fill_rect(body, 26, 13, 3, 3, rgba(metal[2]))
    for x in range(10, 21):
        y = int(14 - 6 * math.sin((x - 9) / 12 * math.pi))
        body.put(x, y, rgba(metal[1]))
    cv = outline(body)
    contact_shadow(cv, 9, 22, 29)
    return cv


def prop_rocks() -> Canvas:
    body = Canvas(T, T)
    for (cx, cy, rx, ry) in ((12, 22, 7, 5), (22, 24, 5, 3.6), (17, 18, 3.5, 3)):
        fill_ellipse(body, cx, cy, rx, ry, lambda x, y, nx, ny: rgba(
            (150, 142, 122) if nx + ny < -0.7 else ((118, 110, 92) if nx + ny < 0.4 else (80, 74, 62))))
    for (x, y) in ((8, 19), (9, 19), (10, 18), (13, 18)):
        body.put(x, y, rgba((70, 104, 52)))
    cv = outline(body)
    for (x, y) in ((5, 27), (27, 28), (7, 28)):
        for i, c in enumerate((G_DARK, G_HI, G_TIP)):
            cv.put(x, y - i, rgba(c))
    return cv


def prop_bush() -> Canvas:
    body = Canvas(T, T)
    rng = random.Random(23)
    pal = ((22, 44, 24), (36, 70, 36), (54, 98, 46), (80, 130, 60))
    for _ in range(26):
        a = rng.uniform(0, math.tau)
        rr = math.sqrt(rng.random())
        bx, by, r = 16 + math.cos(a) * rr * 9, 19 + math.sin(a) * rr * 6.5, rng.uniform(2.2, 3.4)
        fill_ellipse(body, bx, by, r, r, lambda x, y, nx, ny, bx=bx: rgba(
            pal[3] if nx + ny < -0.8 else (pal[2] if nx + ny < 0 else (pal[1] if nx + ny < 0.8 else pal[0]))))
    for _ in range(8):
        x, y = rng.randint(9, 23), rng.randint(14, 24)
        c = FLOWERS[3] if rng.random() < 0.5 else FLOWERS[0]
        body.put(x, y, rgba(c))
        body.put(x + 1, y, rgba(shade(c, 0.8)))
        body.put(x, y - 1, rgba(shade(c, 1.1)))
    cv = outline(body)
    ellipse_shadow(cv, 16, 27, 10, 2.5, 110)
    return cv


# ---------------------------------------------------------------------------
# Altos
# ---------------------------------------------------------------------------

def tall_scarecrow() -> Canvas:
    body = Canvas(T, 64)
    straw = ((150, 118, 52), (192, 160, 78), (226, 198, 110))
    for y in range(20, 62):
        body.put(15, y, rgba(W_L))
        body.put(16, y, rgba(W))
        body.put(17, y, rgba(W_D))
    for x in range(3, 29):
        body.put(x, 27, rgba(W_L))
        body.put(x, 28, rgba(W_D))
    # casaco remendado
    coat = ((70, 30, 28), (108, 44, 36), (136, 62, 46))
    for y in range(25, 47):
        half = 5 + (y - 25) * 0.18
        for x in range(int(16 - half), int(16 + half) + 1):
            c = coat[2] if x < 14 else (coat[1] if x < 19 else coat[0])
            if y > 43 and (x % 3 == 0):
                continue
            body.put(x, y, rgba(c))
    for y in range(24, 32):
        for x in range(4, 28):
            if abs(x - 16) < 5:
                continue
            c = coat[1] if y < 29 else coat[0]
            if y == 24:
                c = coat[2]
            body.put(x, y, rgba(c))
    fill_rect(body, 17, 33, 4, 4, rgba((60, 76, 110)))  # remendo azul
    for (x, y) in ((17, 33), (20, 36), (17, 36), (20, 33)):
        body.put(x, y, rgba((200, 190, 160)))
    fill_rect(body, 11, 39, 3, 3, rgba((150, 130, 70)))
    fill_rect(body, 10, 37, 12, 2, rgba((90, 60, 30)))  # cinto de corda
    # palha saindo das mangas e da barra
    for (x, y, dx) in ((3, 25, -1), (3, 28, -1), (28, 25, 1), (28, 29, 1)):
        for i in range(3):
            body.put(x + dx * i, y + (i % 2), rgba(straw[i % 3]))
    for x in range(11, 22, 2):
        for i in range(3):
            body.put(x, 47 + i, rgba(straw[(x + i) % 3]))
    # cabeca de saco
    fill_ellipse(body, 16, 19, 5.4, 5.6, lambda x, y, nx, ny: rgba(
        (196, 170, 120) if nx + ny < -0.5 else ((168, 142, 98) if nx + ny < 0.5 else (128, 106, 72))))
    for (x, y) in ((13, 18), (14, 19), (14, 18), (13, 19), (18, 18), (19, 19), (19, 18), (18, 19)):
        body.put(x, y, rgba((40, 26, 18)))
    for x in range(13, 20):
        body.put(x, 22, rgba((60, 36, 24) if x % 2 else (128, 106, 72)))
    # chapeu de palha
    fill_ellipse(body, 16, 14, 9.5, 2.4, lambda x, y, nx, ny: rgba(straw[2] if ny < 0 else straw[1]))
    for y in range(7, 14):
        for x in range(11, 21):
            c = straw[1] if x > 12 else straw[2]
            if y == 12:
                c = (150, 40, 34)
            body.put(x, y, rgba(c))
    # corvo
    fill_ellipse(body, 25, 24, 2.6, 2.0, lambda x, y, nx, ny: rgba((24, 22, 30) if ny > -0.3 else (44, 42, 56)))
    fill_ellipse(body, 27, 22, 1.5, 1.5, lambda x, y, nx, ny: rgba((30, 28, 38)))
    body.put(29, 22, rgba((200, 160, 60)))
    body.put(27, 21, rgba((230, 220, 120)))
    cv = Canvas(T, 64)
    ellipse_shadow(cv, 16, 61, 9, 2.4, 120)
    blit(cv, outline(body), 0, 0)
    return cv


def tall_well() -> Canvas:
    body = Canvas(T, 64)
    # telhado de duas aguas
    for y in range(3, 16):
        half = 2 + (y - 3) * 1.1
        for x in range(int(16 - half), int(16 + half) + 1):
            c = (90, 50, 34) if (y - 3) % 3 else (60, 32, 24)
            if x < 16 and (y - 3) % 3:
                c = (112, 64, 42)
            body.put(x, y, rgba(c))
    fill_rect(body, 2, 16, 28, 2, rgba(W_D))
    for x0 in (5, 25):
        for y in range(17, 44):
            body.put(x0, y, rgba(W_L))
            body.put(x0 + 1, y, rgba(W))
            body.put(x0 + 2, y, rgba(W_D))
    for x in range(7, 25):
        body.put(x, 22, rgba(W_L))
        body.put(x, 23, rgba(W_D))
    fill_rect(body, 26, 21, 4, 2, rgba((63, 63, 70)))
    for y in range(24, 33):
        body.put(15, y, rgba((150, 126, 84)))
    fill_rect(body, 13, 32, 5, 5, rgba(W))
    fill_rect(body, 13, 32, 5, 1, rgba(W_L))
    fill_rect(body, 13, 34, 5, 1, rgba((63, 63, 70)))
    # cilindro de pedra
    for y in range(40, 60):
        for x in range(3, 29):
            row = (y - 40) // 5
            xm = (x + (4 if row % 2 else 0)) % 8
            d = (x + 0.5 - 16) / 13
            base = STONE[(x // 8 + row) % 4]
            c = ST_CRACK if ((y - 40) % 5 == 0 or xm == 0) else shade(base, 1.15 - 0.45 * (d + 1) / 2)
            body.put(x, y, rgba(c))
    fill_ellipse(body, 16, 40, 13, 4, lambda x, y, nx, ny: rgba(
        (146, 138, 116) if nx * nx + ny * ny > 0.55 else ((22, 34, 44) if ny < 0.3 else (40, 66, 84))))
    for x in range(10, 16):
        body.put(x, 40, rgba((90, 140, 160)))
    cv = Canvas(T, 64)
    ellipse_shadow(cv, 16, 60, 14, 3, 130)
    blit(cv, outline(body), 0, 0)
    return cv


def tall_apple_tree() -> Canvas:
    cv = SV.tall_tree()
    rng = random.Random(9)
    for _ in range(14):
        x, y = rng.randint(6, 25), rng.randint(10, 34)
        c = cv.get(x, y)
        if c[3] and c[1] > c[0] + 15 and c[1] > 50:
            cv.put(x, y, rgba((196, 46, 40)))
            cv.put(x + 1, y, rgba((150, 30, 30)))
            cv.put(x, y - 1, rgba((240, 120, 100)))
            cv.put(x + 1, y + 1, rgba((110, 22, 24)))
    return cv


def tall_sunflowers() -> Canvas:
    body = Canvas(T, 64)
    for (sx, top, lean) in ((10, 10, -1), (21, 4, 1), (16, 18, 0)):
        for y in range(top + 4, 61):
            x = sx + int(lean * (60 - y) / 30)
            body.put(x, y, rgba((60, 100, 44)))
            body.put(x + 1, y, rgba((40, 72, 34)))
            if y % 9 == 0:
                for i in range(1, 5):
                    body.put(x + (i if y % 18 else -i), y - i // 2, rgba((70, 118, 50) if i < 3 else (50, 90, 40)))
        hx = sx + int(lean * (60 - top) / 30)
        fill_ellipse(body, hx + 0.5, top + 0.5, 5.2, 4.8, lambda x, y, nx, ny: rgba(
            (250, 214, 70) if nx + ny < -0.4 else ((226, 170, 40) if nx + ny < 0.6 else (180, 120, 30))))
        fill_ellipse(body, hx + 0.5, top + 0.5, 2.6, 2.4, lambda x, y, nx, ny: rgba(
            (110, 64, 30) if (x + y) % 2 else (72, 40, 22)))
    cv = Canvas(T, 64)
    ellipse_shadow(cv, 16, 61, 10, 2.4, 110)
    blit(cv, outline(body), 0, 0)
    return cv


def main() -> None:
    build_theme(HerbFieldTheme())


if __name__ == "__main__":
    main()
