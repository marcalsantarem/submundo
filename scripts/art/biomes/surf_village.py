"""
SUBMUNDO - Bioma `village` (Vila Natal, prologo antes da invasao) - BRF-138 / T-131
====================================================================================

Identidade (paleta 1.2 "Vila Natal / Prologo", tons quentes):
- piso: calcamento de paralelepipedos arredondados (#7e7467 / #4f4840 / #3b352f, escurecidos p/ leitura dos atores);
- "paredes" 2.5D = quarteiroes de casas: topo = telhado de telhas (terracota fosca), face = fachada em
  enxaimel (reboco #dfc5a4 sujo + vigas #7c4d2b / #2e1a0d) sobre embasamento de pedra; janelas acesas;
- portas: arco de pedra com portao de madeira aberto (rua iluminada ao fundo); passagens = becos entre casas
  com chamines nos telhados;
- luz do bioma (torch_0..3): lanterna de ferro de parede, vela tremulando.

Uso: python scripts/art/biomes/surf_village.py
"""
from __future__ import annotations

import math
import random
from typing import List, Tuple

from surf_common import (
    Canvas, SurfTheme, T, blit, build_theme, contact_shadow, ellipse_shadow, fill_ellipse, fill_rect, h01,
    leaf_blobs, line, mix, outline, put, rgba, shade, vnoise, voronoi_stones,
)
import buildDungeonBasic as DB

# --- paleta ---
COB_TONES = ((82, 74, 64), (76, 68, 59), (88, 79, 68), (72, 65, 57), (84, 73, 61))
COB_MORTAR = (38, 33, 29)
DIRT = ((70, 54, 40), (62, 47, 35), (80, 62, 45))
ROOF = ((80, 42, 34), (72, 38, 32), (88, 47, 36), (66, 36, 31), (76, 44, 38))
ROOF_SH = (28, 15, 15)
PL = (130, 112, 90)
PL_D = (112, 95, 77)
PL_L = (148, 129, 104)
W_D = (46, 26, 13)
W = (92, 58, 33)
W_L = (124, 77, 43)
W_H = (150, 98, 58)
ST = ((92, 86, 78), (84, 78, 70), (100, 93, 83), (78, 72, 65))
ST_CRACK = (40, 36, 33)
IRON_D = (34, 34, 40)
IRON = (63, 63, 70)
IRON_L = (113, 113, 122)
GOLD = (212, 169, 90)
GOLD_H = (241, 210, 138)
FL_R, FL_O, FL_A, FL_Y, FL_W = (185, 28, 28), (234, 88, 12), (245, 158, 11), (253, 224, 71), (254, 249, 195)
GRASS = ((46, 74, 38), (60, 92, 46), (78, 112, 56))

ROW_OFF = (0, 5, 2, 7)
ROW_B = (4, 3, 6, 2)


# ---------------------------------------------------------------------------
# Piso: calcamento
# ---------------------------------------------------------------------------

def cobble_layout(seed: int):
    """Lista de pedras (x0, largura, linha, tom). Pedras de borda tem tom fixo -> emenda sem costura."""
    rng = random.Random(seed)
    stones = []
    for row in range(4):
        off, b = ROW_OFF[row], ROW_B[row]
        fixed = COB_TONES[(row * 2 + 1) % len(COB_TONES)]
        stones.append((T - b, b + off, row, fixed))  # pedra que atravessa a borda
        x = off
        end = T - b
        while x < end:
            w = rng.randint(5, 9)
            if end - (x + w) < 4:
                w = end - x
            stones.append((x, w, row, rng.choice(COB_TONES)))
            x += w
    return stones


def draw_cobbles(cv: Canvas, seed: int) -> None:
    rng = random.Random(seed * 7 + 1)
    for (sx, w, row, tone) in cobble_layout(seed):
        y0 = row * 8
        j = rng.randint(-3, 3)
        tone = tuple(max(0, v + j) for v in tone)
        for yy in range(8):
            for k in range(w):
                x = (sx + k) % T
                y = y0 + yy
                if yy == 0 or k == 0:
                    col = COB_MORTAR
                else:
                    col = tone
                    corner = (k in (1, w - 1)) and (yy in (1, 7))
                    if corner:
                        col = shade(COB_MORTAR, 1.25)
                    elif yy == 1 or k == 1:
                        col = shade(tone, 1.2)
                    elif yy == 7 or k == w - 1:
                        col = shade(tone, 0.74)
                    elif yy == 2 and k == 2:
                        col = shade(tone, 1.32)
                    r = h01(x, y, seed)
                    if not corner and r < 0.09:
                        col = shade(col, 0.86)
                cv.put(x, y, rgba(col))


def floor_tile(name: str) -> Canvas:
    seeds = {"floor_0": 11, "floor_1": 12, "floor_2": 13, "floor_cracked": 14, "floor_moss": 15, "floor_blood": 16}
    seed = seeds[name]
    cv = Canvas(T, T)
    draw_cobbles(cv, seed)
    rng = random.Random(seed)
    if name == "floor_cracked":
        # paralelepipedos arrancados: terra batida e cascalho
        for (cx, cy, rx, ry) in ((12, 13, 7.5, 5.2), (21, 22, 5.0, 3.6)):
            for y in range(T):
                for x in range(T):
                    d = math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
                    if d < 1 + 0.18 * (h01(x, y, 3) - 0.5):
                        c = DIRT[int(h01(x, y, 4) * 3)]
                        if d > 0.82:
                            c = shade(c, 0.7)
                        cv.put(x, y, rgba(c))
        for (px, py) in ((9, 12), (14, 15), (12, 10), (20, 21), (23, 23), (16, 13)):
            cv.put(px, py, rgba((104, 96, 86)))
            cv.put(px + 1, py, rgba((64, 58, 52)))
        # pedra solta tombada
        fill_ellipse(cv, 6, 25, 3.2, 2.2, lambda x, y, nx, ny: rgba(shade(COB_TONES[0], 1.25 if ny < 0 else 0.8)))
    elif name == "floor_moss":
        # tufos de grama brotando entre as pedras
        for (cx, cy, r) in ((8, 9, 5.0), (22, 19, 6.0), (13, 26, 3.6), (27, 5, 3.0)):
            pts = []
            for y in range(int(cy - r) - 1, int(cy + r) + 2):
                for x in range(int(cx - r) - 1, int(cx + r) + 2):
                    d = math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.3) / r
                    if d < 1 and h01(x, y, 9) < 1.15 - d:
                        pts.append((x, y))
            for (x, y) in pts:
                cv.put(x % T, y % T, rgba((34, 54, 30)))
            for (x, y) in sorted(pts, key=lambda p: p[1]):
                if h01(x, y, 10) < 0.45:
                    for i, c in enumerate((GRASS[0], GRASS[1], GRASS[2])):
                        cv.put(x % T, (y - i) % T, rgba(c))
    elif name == "floor_blood":
        # palha e folhas secas espalhadas (vespera de festa / colheita)
        for _ in range(26):
            x, y = rng.randint(1, 30), rng.randint(1, 30)
            ln = rng.randint(3, 6)
            dx = rng.choice((1, 1, -1))
            for i in range(ln):
                c = (176, 146, 74) if i % 3 else (132, 106, 52)
                cv.put(x + (i * dx) // 2 + i * (1 if dx > 0 else 0) // 2, y - i // 2 if rng.random() < 0.5 else y,
                       rgba(c))
        for (lx, ly, col) in ((7, 9, (150, 70, 30)), (21, 19, (170, 96, 36)), (14, 26, (128, 52, 28)),
                              (25, 6, (160, 84, 34))):
            fill_ellipse(cv, lx, ly, 2.2, 1.5, lambda x, y, nx, ny, c=col: rgba(shade(c, 1.15 if ny < 0 else 0.85)))
            cv.put(lx, ly, rgba(shade(col, 0.6)))
    return cv


# ---------------------------------------------------------------------------
# Telhado (topo das "paredes")
# ---------------------------------------------------------------------------

def roof_cap(seed: int) -> Canvas:
    """Telhas de escama (fiadas de 8 px, juntas alinhadas a grade -> emenda sem costura)."""
    cv = Canvas(T, T)
    rng = random.Random(seed)
    for row in range(4):
        y0 = row * 8
        off = 0 if row % 2 == 0 else 4
        for s in range(4):
            sx = off + s * 8
            straddle = sx + 8 > T
            tone = ROOF[(row + 1) % len(ROOF)] if straddle else rng.choice(ROOF)
            j = 0 if straddle else rng.randint(-3, 3)
            tone = tuple(max(0, v + j) for v in tone)
            for k in range(8):
                x = (sx + k) % T
                for yy in range(8):
                    y = y0 + yy
                    edge = abs(k - 3.5)
                    # base arredondada da telha (escama)
                    if yy == 7 and edge > 2.5 or yy == 6 and edge > 3.2:
                        col = ROOF_SH
                    elif yy == 0:
                        col = ROOF_SH
                    elif k == 0 and yy < 6:
                        col = shade(tone, 0.6)
                    elif yy == 1:
                        col = shade(tone, 0.74)
                    elif yy == 7 or (yy == 6 and edge > 2.4):
                        col = shade(tone, 1.22)
                    elif k == 1:
                        col = shade(tone, 1.07)
                    else:
                        col = tone
                    r = h01(x, y, seed)
                    if 1 < yy < 6 and r < 0.1:
                        col = shade(col, 0.86)
                    elif 1 < yy < 6 and r > 0.975:
                        col = (62, 66, 44)  # liquen
                    cv.put(x, y, rgba(col))
    return cv


# ---------------------------------------------------------------------------
# Fachada em enxaimel
# ---------------------------------------------------------------------------

def plaster(cv: Canvas, x0: int, y0: int, x1: int, y1: int, gy: int, seed: int) -> None:
    for y in range(y0, y1):
        for x in range(x0, x1):
            n = vnoise(x, y + gy, 32, seed, 6)
            c = mix(PL_D, PL_L, n)
            r = h01(x, y + gy, seed + 3)
            if r < 0.06:
                c = shade(c, 0.88)
            elif r > 0.975:
                c = shade(c, 1.08)
            cv.put(x, y, rgba(c))


def beam_h(cv: Canvas, x0: int, x1: int, y: int, h: int = 3) -> None:
    for x in range(x0, x1):
        for i in range(h):
            c = W_L if i == 0 else (W_D if i == h - 1 else W)
            if 0 < i < h - 1 and h01(x, y + i, 7) < 0.18:
                c = shade(W, 0.8)
            cv.put(x, y + i, rgba(c))


def post_v(cv: Canvas, x: int, y0: int, y1: int) -> None:
    for y in range(y0, y1):
        cv.put(x, y, rgba(W_L))
        cv.put(x + 1, y, rgba(W if h01(x, y, 8) > 0.2 else shade(W, 0.82)))
        cv.put(x + 2, y, rgba(W_D))


def brace(cv: Canvas, x0: int, y0: int, x1: int, y1: int) -> None:
    steps = max(abs(x1 - x0), abs(y1 - y0))
    for i in range(steps + 1):
        t = i / steps
        x = int(round(x0 + (x1 - x0) * t))
        y = int(round(y0 + (y1 - y0) * t))
        cv.put(x, y - 1, rgba(W_L))
        cv.put(x, y, rgba(W))
        cv.put(x, y + 1, rgba(W))
        cv.put(x, y + 2, rgba(W_D))


def foundation(cv: Canvas, y0: int, y1: int, seed: int) -> None:
    sub = Canvas(T, y1 - y0)
    voronoi_stones(sub, 5100 + seed % 3, 7, ST, ST_CRACK, 1.2, 0.72, sx=1.5, sy=1.0, w=T, h=y1 - y0)
    blit(cv, sub, 0, y0)


def plinth(cv: Canvas, y0: int) -> None:
    for x in range(T):
        cv.put(x, y0, rgba((60, 54, 48)))
        cv.put(x, y0 + 1, rgba((38, 33, 29)))
        cv.put(x, y0 + 2, rgba((26, 22, 20)))
        cv.put(x, y0 + 3, rgba((17, 15, 14)))


def window(cv: Canvas, lit: float = 1.0) -> None:
    x0, x1, y0, y1 = 9, 23, 7, 25
    # postigos
    for (sx0, sx1) in ((4, 9), (23, 28)):
        for y in range(y0, y1):
            for x in range(sx0, sx1):
                c = (54, 78, 76)
                if x == sx0:
                    c = (72, 100, 96)
                if x == sx1 - 1 or (x - sx0) == 2:
                    c = (34, 50, 50)
                if y in (y0, y1 - 1):
                    c = (30, 42, 42)
                cv.put(x, y, rgba(c))
        for y in (y0 + 3, y1 - 4):
            cv.put(sx0 + (0 if sx0 > 20 else 4), y, rgba(IRON_L))
    for y in range(y0, y1):
        for x in range(x0, x1):
            if x in (x0, x1 - 1) or y in (y0, y1 - 1):
                cv.put(x, y, rgba(W_D))
            elif x in (x0 + 1, x1 - 2) or y in (y0 + 1, y1 - 2):
                cv.put(x, y, rgba(W))
            else:
                t = (y - y0) / (y1 - y0)
                c = mix((176, 104, 40), (240, 178, 84), t)
                cx = x - (x0 + 2)
                if cx < 3 and y > y0 + 9:
                    c = mix(c, (252, 216, 132), 0.6)
                cv.put(x, y, rgba(shade(c, lit)))
    for y in range(y0 + 2, y1 - 2):
        cv.put(15, y, rgba(W_D))
        cv.put(16, y, rgba(W))
    for x in range(x0 + 2, x1 - 2):
        cv.put(x, 15, rgba(W_D))
    # cortina
    for y in range(y0 + 2, y0 + 7):
        for x in (x0 + 2, x0 + 3, x1 - 3, x1 - 4):
            if y - y0 < 7 - abs(x - 15.5) / 3:
                cv.put(x, y, rgba((120, 42, 32)))
    # peitoril + floreira
    for x in range(x0 - 1, x1 + 1):
        cv.put(x, y1, rgba(W_H))
        cv.put(x, y1 + 1, rgba(W_D))
    for y in range(y1 + 2, y1 + 5):
        for x in range(x0, x1):
            cv.put(x, y, rgba(W if y < y1 + 4 else W_D))
    rng = random.Random(55)
    for i in range(9):
        fx = x0 + 1 + i * 1.5
        fy = y1 - 1 + rng.randint(-1, 1)
        cv.put(int(fx), fy, rgba((60, 96, 46)))
        cv.put(int(fx), fy - 1, rgba((196, 58, 52) if i % 3 else (232, 196, 80)))
        if i % 2:
            cv.put(int(fx) + 1, fy - 1, rgba((236, 120, 110) if i % 3 else (250, 230, 140)))


def face_tile(kind: str, seed: int) -> Canvas:
    cv = Canvas(T, T)
    if kind.startswith("upper"):
        plaster(cv, 0, 0, T, T, 0, 61)
        if kind == "upper":
            brace(cv, 3, 28, 31, 4)
        post_v(cv, 0, 0, T)
        beam_h(cv, 0, T, 0, 4)
        beam_h(cv, 0, T, 29, 3)
        if kind == "upper_cracked":
            window(cv)
        DB.overhang_shadow(cv)
    else:
        plaster(cv, 0, 0, T, 11, 32, 61)
        post_v(cv, 0, 0, 11)
        beam_h(cv, 0, T, 10, 3)
        foundation(cv, 13, 28, seed)
        for x in range(T):
            cv.put(x, 13, rgba(shade(cv.get(x, 13)[:3], 0.6)))
        plinth(cv, 28)
        if kind == "lower_grate":
            for y in range(15, 27):
                for x in range(9, 23):
                    dx = x + 0.5 - 16
                    if y < 18 and dx * dx + (y - 18) ** 2 > 40:
                        continue
                    edge = x in (9, 22) or (y < 18 and dx * dx + (y - 18) ** 2 > 26) or y == 26
                    cv.put(x, y, rgba((112, 104, 92) if edge else (14, 11, 10)))
            for bx in (12, 16, 19):
                for y in range(16, 26):
                    if cv.get(bx, y)[0] < 20:
                        cv.put(bx, y, rgba(IRON if y % 3 else IRON_L))
            # luz fraca do porao
            for x in range(10, 22):
                if cv.get(x, 24)[0] < 20:
                    cv.put(x, 24, rgba((52, 32, 16)))
            for (gx, gy) in ((8, 27), (23, 27), (24, 26)):
                cv.put(gx, gy, rgba(GRASS[1]))
                cv.put(gx, gy - 1, rgba(GRASS[2]))
        # manchas de umidade no reboco
        for x in range(4, T, 9):
            for y in range(6, 10):
                if h01(x, y, seed) < 0.5:
                    cv.put(x, y, rgba(PL_D))
    return cv


# ---------------------------------------------------------------------------
# Tema
# ---------------------------------------------------------------------------

class VillageTheme(SurfTheme):
    id = "village"
    title = "Vila Natal"
    rim_lo = (34, 20, 12)
    rim = (118, 76, 44)
    rim_hi = (156, 104, 62)
    side_rim = (96, 60, 34)
    side_rim_lo = (44, 26, 14)
    bg = (18, 12, 11)

    def floor(self, name: str) -> Canvas:
        return floor_tile(name)

    def cap_base(self, seed: int) -> Canvas:
        return roof_cap(seed)

    def face(self, kind: str, seed: int) -> Canvas:
        return face_tile(kind, seed)

    def face_end(self, kind: str, sides: str, seed: int) -> Canvas:
        cv = self.face(kind, seed)
        upper = kind == "upper"
        for side in sides:
            for y in range(T):
                for i in range(5):
                    x = i if side == "l" else T - 1 - i
                    in_found = (not upper) and 13 <= y < 28
                    if not upper and y >= 28:
                        c = shade(cv.get(x, y)[:3], 0.8) if i else (14, 12, 11)
                    elif in_found:
                        course = (y - 13) // 5
                        depth = 7 if course % 2 else 4
                        c = (124, 116, 104) if (y - 13) % 5 else ST_CRACK
                        if i == 0:
                            c = (54, 48, 44)
                        if i == 1 and (y - 13) % 5:
                            c = (146, 138, 124)
                        cv.put(x, y, rgba(c))
                        for k in range(5, depth):
                            xx = k if side == "l" else T - 1 - k
                            cv.put(xx, y, rgba(ST_CRACK if k == depth - 1 or (y - 13) % 5 == 0 else (112, 105, 94)))
                        continue
                    else:
                        c = (W_D, W_H, W_L, W, W_D)[i]
                    cv.put(x, y, rgba(c))
        if upper:
            DB.overhang_shadow(cv)
        return cv

    def door_north(self) -> Canvas:
        cv = Canvas(64, 64)
        blit(cv, face_tile("upper", 9101), 0, 0)
        blit(cv, face_tile("upper", 9102), 32, 0)
        blit(cv, face_tile("lower", 9103), 0, 32)
        blit(cv, face_tile("lower", 9104), 32, 32)
        rng = random.Random(9105)
        cx, cy, r_in, r_out = 31.5, 27.0, 12.5, 19.5
        nv = 9
        for y in range(64):
            for x in range(64):
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                r = math.hypot(dx, dy)
                if self.door_opening(x, y):
                    t = min(1.0, max(0.0, (y - 14) / 49))
                    col = mix((9, 7, 8), (40, 30, 24), t ** 1.3)
                    # rua ao fundo: fiadas de pedra em perspectiva
                    if y in (41, 47, 52, 56, 60, 63):
                        col = shade(col, 1.45)
                    # brilho de uma lanterna distante
                    g = math.hypot(dx * 0.9, y + 0.5 - 33) / 9.0
                    if g < 1:
                        col = mix(col, (122, 74, 30), (1 - g) ** 2 * 0.8)
                    cv.put(x, y, rgba(col))
                    continue
                in_ring = r_in <= r < r_out and y < cy
                in_jamb = r_in <= abs(dx) < r_out - 1 and y >= cy
                if in_ring:
                    ang = math.atan2(dy, dx)
                    seg = (ang + math.pi) / math.pi * nv
                    frac = seg - math.floor(seg)
                    key = int(seg) == nv // 2
                    base = (138, 124, 104) if key else ((122, 110, 94) if int(seg) % 2 else (112, 100, 86))
                    if frac < 0.1 and not key:
                        col = (54, 46, 40)
                    elif r < r_in + 1.2:
                        col = shade(base, 1.25)
                    elif r > r_out - 1.3:
                        col = shade(base, 0.6)
                    else:
                        col = base if rng.random() > 0.12 else shade(base, 0.88)
                    cv.put(x, y, rgba(col))
                elif in_jamb:
                    block = int((y - cy) // 8)
                    base = (118, 106, 90) if block % 2 else (108, 97, 83)
                    if (y - int(cy)) % 8 == 0:
                        col = (54, 46, 40)
                    elif abs(dx) < r_in + 1.2:
                        col = shade(base, 1.25)
                    elif abs(dx) > r_out - 2.2:
                        col = shade(base, 0.62)
                    else:
                        col = base if rng.random() > 0.12 else shade(base, 0.88)
                    cv.put(x, y, rgba(col))
                elif (r_out <= r < r_out + 1.2 and y < cy) or (r_out - 1 <= abs(dx) < r_out and y >= cy):
                    cv.put(x, y, rgba((24, 18, 15)))
        # folhas do portao abertas contra as ombreiras
        for (x0, x1) in ((19, 23), (41, 45)):
            for y in range(29, 64):
                for x in range(x0, x1):
                    c = W if (x - x0) % 2 == 0 else shade(W, 0.84)
                    if x == x0 and x0 > 30:
                        c = W_D
                    if x == x1 - 1 and x0 < 30:
                        c = W_L
                    if y in (35, 36, 52, 53):
                        c = IRON if y % 2 else IRON_L
                    if y == 63:
                        c = W_D
                    cv.put(x, y, rgba(c))
        # sol da vila na pedra-chave
        for (px, py) in ((31, 10), (32, 10), (31, 11), (32, 11)):
            cv.put(px, py, rgba(GOLD_H))
        for (px, py) in ((31, 8), (32, 8), (29, 10), (34, 10), (29, 11), (34, 11), (31, 13), (32, 13),
                         (30, 9), (33, 9), (30, 12), (33, 12)):
            cv.put(px, py, rgba(GOLD))
        return cv

    def threshold(self) -> Canvas:
        cv = Canvas(64, T)
        blit(cv, floor_tile("floor_0"), 0, 0)
        blit(cv, floor_tile("floor_2"), 32, 0)
        rng = random.Random(9202)
        for y in range(0, 18):
            for x in range(13, 51):
                if y < 3:
                    col = (12, 9, 9) if 19 <= x <= 44 else (30, 26, 23)
                elif y == 3:
                    col = (146, 132, 112)
                elif y == 17 or x in (13, 50):
                    col = COB_MORTAR
                else:
                    col = (112, 100, 86) if rng.random() > 0.1 else (100, 89, 77)
                    if x == 14 or y == 4:
                        col = (128, 115, 98)
                    if y == 16 or x == 49:
                        col = (82, 73, 63)
                    if 22 <= x <= 41 and 6 <= y <= 13 and h01(x, y, 4) < 0.5:
                        col = (120, 108, 92)  # desgaste no meio do degrau
                cv.put(x, y, rgba(col))
        for x in range(13, 51):
            cv.put(x, 18, rgba((22, 18, 16)))
        return cv

    def short_face(self, cv: Canvas, x0: int, x1: int, y0: int, y1: int, rng: random.Random) -> None:
        for y in range(y0, y1):
            for x in range(x0, x1):
                yin = (y - y0) % 4
                xm = (x + (3 if ((y - y0) // 4) % 2 else 0)) % 7
                base = ST[(x // 7 + (y - y0) // 4) % 4]
                col = ST_CRACK if (yin == 0 or xm == 0) else base
                if y == y0:
                    col = (150, 138, 120)
                elif y == y1 - 1:
                    col = (20, 17, 15)
                elif col != ST_CRACK and rng.random() < 0.1:
                    col = shade(col, 0.86)
                cv.put(x, y, rgba(col))

    def post_cap(self, cv: Canvas, x: int, y: int, lit: bool) -> None:
        # chamine de tijolo no telhado
        for yy in range(-6, 3):
            for xx in range(-3, 4):
                c = (118, 60, 44) if (yy + 6) % 3 else (70, 36, 28)
                if xx == -3:
                    c = shade(c, 1.2)
                if xx == 3:
                    c = shade(c, 0.6)
                if yy <= -5:
                    c = (24, 16, 14) if abs(xx) < 2 and yy == -5 else (140, 122, 104)
                cv.put(x + xx, y + yy, rgba(c))
        for xx in range(-3, 5):
            cv.put(x + xx, y + 3, rgba(ROOF_SH))
        if lit:
            cv.put(x, y - 7, (120, 112, 108, 150))
            cv.put(x + 1, y - 9, (120, 112, 108, 100))

    def passage_strip(self, cv: Canvas, orient: str, a0: int, a1: int, pos: int, inward: int) -> None:
        for k in range(a0, a1):
            for i, c in enumerate(((150, 138, 120), (112, 102, 90), (30, 26, 23))):
                x, y = (k, pos + i) if orient == "h" else (pos + i * inward, k)
                cv.put(x, y, rgba(c))

    def props(self) -> List[Tuple[str, Canvas]]:
        return ([(f"torch_{i}", prop_lantern(i)) for i in range(4)] + [
            ("barrel", DB.prop_barrel()), ("crate", prop_crate()), ("sacks", prop_sacks()),
            ("apple_basket", prop_apple_basket()), ("flower_planter", prop_planter()), ("hay_bale", prop_hay()),
            ("firewood", prop_firewood()), ("bench", prop_bench()), ("cart_wheel", prop_wheel()),
            ("bucket", prop_bucket()), ("puddle", prop_puddle()),
        ])

    def props_tall(self) -> List[Tuple[str, Canvas]]:
        return [("lamp_post", tall_lamp_post()), ("tree_oak", tall_tree()), ("notice_board", tall_board()),
                ("banner_pole", tall_banner())]

    def sample_floor_props(self):
        return ("crate", "sacks", "barrel", "apple_basket", "hay_bale", "flower_planter", "bench", "bucket")


# ---------------------------------------------------------------------------
# Props 32x32
# ---------------------------------------------------------------------------

def draw_candle_flame(cv: Canvas, cx: float, base_y: int, height: int, width: float, sway: int) -> None:
    for y in range(base_y - height - 1, base_y + 1):
        t = (base_y - y) / height
        if t > 1.05:
            continue
        half = width * (1 - t) ** 0.8 * (0.85 + 0.3 * math.sin(t * math.pi))
        cxf = cx + sway * t
        for x in range(int(cx - 6), int(cx + 7)):
            d = abs(x + 0.5 - cxf)
            if d > half + 0.25:
                continue
            heat = (1 - t) * 0.9 + (1 - d / max(half, 0.6)) * 0.6
            col = FL_W if heat > 1.15 else (FL_Y if heat > 0.9 else (FL_A if heat > 0.62 else FL_O))
            cv.put(x, y, rgba(col))


def prop_lantern(frame: int) -> Canvas:
    lvl = (1.0, 0.9, 1.08, 0.95)[frame]
    body = Canvas(T, T)
    # suporte de ferro na parede
    fill_rect(body, 13, 1, 7, 4, rgba(IRON))
    fill_rect(body, 13, 1, 7, 1, rgba(IRON_L))
    body.put(14, 2, rgba(IRON_D))
    body.put(18, 2, rgba(IRON_D))
    for (x, y) in ((16, 5), (16, 6), (16, 7)):
        body.put(x, y, rgba(IRON_D))
    # chapeu
    for y in range(8, 12):
        half = 1 + (y - 8) * 1.4
        for x in range(int(15.5 - half), int(16.5 + half)):
            body.put(x, y, rgba(IRON_L if x < 16 and y > 8 else IRON))
    fill_rect(body, 10, 11, 12, 1, rgba(IRON_D))
    # vidro aceso
    for y in range(12, 22):
        for x in range(11, 21):
            if x in (11, 20) or y == 12:
                c = IRON if x != 11 else IRON_L
            elif x in (15, 16) and y < 14:
                c = IRON_D
            else:
                d = math.hypot(x + 0.5 - 16, (y + 0.5 - 18) * 1.2) / 6.5
                c = mix((255, 222, 140), (214, 128, 40), min(1.0, d))
                c = shade(c, lvl)
            body.put(x, y, rgba(c))
    draw_candle_flame(body, 15.6, 19, (5, 4, 6, 5)[frame], (2.0, 2.4, 1.8, 2.2)[frame], (0, 1, 0, -1)[frame])
    fill_rect(body, 14, 20, 4, 2, rgba((230, 220, 190)))
    fill_rect(body, 10, 22, 12, 2, rgba(IRON))
    fill_rect(body, 10, 22, 12, 1, rgba(IRON_L))
    fill_rect(body, 15, 24, 2, 2, rgba(IRON_D))
    return outline(body)


def prop_crate() -> Canvas:
    body = Canvas(T, T)
    for y in range(8, 29):
        for x in range(5, 27):
            if y < 14:
                c = W_L if (y - 8) % 3 else W
                if x in (5, 26):
                    c = W_D
            else:
                c = W if (y - 14) % 5 else W_D
                if x in (5, 6, 25, 26):
                    c = W_L if x in (5, 6) else shade(W, 0.75)
            body.put(x, y, rgba(c))
    for i in range(0, 15):
        for w_ in (0, 1):
            body.put(7 + int(i * 17 / 14) + w_, 14 + i, rgba(W_L if w_ == 0 else W_D))
    fill_rect(body, 5, 13, 22, 1, rgba(W_D))
    for (x, y) in ((6, 15), (25, 15), (6, 27), (25, 27)):
        body.put(x, y, rgba(IRON_L))
    cv = outline(body)
    contact_shadow(cv, 5, 28, 30)
    return cv


def prop_sacks() -> Canvas:
    body = Canvas(T, T)
    bur = ((92, 74, 48), (126, 102, 68), (156, 128, 88), (182, 154, 108))

    def sack(cx: float, cy: float, rx: float, ry: float) -> None:
        def col(x, y, nx, ny):
            lit = -0.6 * nx - 0.5 * ny
            c = bur[3] if lit > 0.55 else (bur[2] if lit > 0.05 else (bur[1] if lit > -0.45 else bur[0]))
            if (x + y) % 3 == 0 and lit < 0.5:
                c = shade(c, 0.92)
            return rgba(c)
        fill_ellipse(body, cx, cy, rx, ry, col)
        fill_rect(body, int(cx) - 2, int(cy - ry) - 3, 4, 3, rgba(bur[1]))
        fill_rect(body, int(cx) - 2, int(cy - ry) - 1, 4, 1, rgba((70, 44, 24)))
        body.put(int(cx) - 1, int(cy - ry) - 4, rgba(bur[2]))
        body.put(int(cx) + 1, int(cy - ry) - 4, rgba(bur[2]))

    sack(11, 21, 7, 7.5)
    sack(21, 23, 6.5, 6)
    # graos derramados
    cv = outline(body)
    for (x, y) in ((26, 29), (28, 28), (25, 30), (27, 30), (29, 30)):
        cv.put(x, y, rgba((200, 176, 110)))
    contact_shadow(cv, 4, 28, 30, 90)
    return cv


def prop_apple_basket() -> Canvas:
    body = Canvas(T, T)
    for y in range(15, 28):
        half = 11 - (y - 15) * 0.25
        for x in range(int(16 - half), int(16 + half)):
            c = (128, 92, 50) if ((x + (y // 2)) % 3) else (92, 64, 34)
            if y in (15, 16):
                c = (156, 116, 66)
            body.put(x, y, rgba(c))
    rng = random.Random(81)
    for (ax, ay) in ((9, 13), (14, 12), (19, 13), (23, 13), (11, 10), (17, 9), (21, 10), (15, 14)):
        fill_ellipse(body, ax, ay, 2.8, 2.6, lambda x, y, nx, ny: rgba(
            (220, 84, 64) if nx + ny < -0.6 else ((176, 38, 34) if nx + ny < 0.5 else (112, 22, 24))))
        body.put(ax - 1, ay - 1, rgba((246, 170, 140)))
        body.put(ax, ay - 3, rgba((70, 44, 20)))
        if rng.random() < 0.5:
            body.put(ax + 1, ay - 3, rgba((80, 120, 50)))
    cv = outline(body)
    contact_shadow(cv, 5, 28, 28)
    return cv


def prop_planter() -> Canvas:
    body = Canvas(T, T)
    rng = random.Random(82)
    leaf_blobs(body, rng, 22, 4, 9, 24, 11, ((30, 56, 30), (44, 80, 40), (62, 104, 50), (86, 132, 64)),
               1.6, 3.0, wrap=False)
    for (fx, fy, c) in ((7, 11, (214, 60, 58)), (12, 9, (240, 210, 96)), (17, 11, (214, 60, 58)),
                        (22, 9, (236, 236, 220)), (25, 12, (240, 210, 96)), (10, 15, (236, 236, 220)),
                        (20, 15, (214, 60, 58))):
        for (dx, dy) in ((0, 0), (1, 0), (0, 1), (1, 1)):
            body.put(fx + dx, fy + dy, rgba(c if (dx + dy) else shade(c, 1.15)))
        body.put(fx, fy, rgba((250, 230, 150)))
    for y in range(19, 29):
        for x in range(4, 28):
            c = W if (y - 19) % 4 else W_D
            if y == 19:
                c = W_H
            if x in (4, 27):
                c = W_D
            body.put(x, y, rgba(c))
    cv = outline(body)
    contact_shadow(cv, 4, 28, 30)
    return cv


def prop_hay() -> Canvas:
    body = Canvas(T, T)
    hay = ((110, 88, 40), (150, 122, 58), (176, 146, 74), (198, 170, 96))
    for y in range(9, 29):
        for x in range(4, 28):
            top = y < 15
            r = h01(x, y, 91)
            c = hay[3] if top and r > 0.5 else (hay[2] if top or r > 0.6 else hay[1])
            if not top and (x + y * 3) % 5 == 0:
                c = hay[0]
            if top and (x * 2 + y) % 7 == 0:
                c = hay[1]
            if x in (4, 27) or y == 28:
                c = shade(c, 0.75)
            body.put(x, y, rgba(c))
    for bx in (10, 21):
        for y in range(9, 29):
            body.put(bx, y, rgba((86, 54, 30)))
            body.put(bx + 1, y, rgba((60, 36, 20)))
    for (x, y) in ((3, 12), (28, 18), (6, 8), (24, 8), (29, 25)):
        body.put(x, y, rgba(hay[2]))
    cv = outline(body)
    contact_shadow(cv, 4, 29, 30)
    return cv


def prop_firewood() -> Canvas:
    body = Canvas(T, T)
    logs = [(8, 25), (16, 25), (24, 25), (12, 18), (20, 18), (16, 11)]
    for (cx, cy) in logs:
        def col(x, y, nx, ny):
            d = math.hypot(nx, ny)
            if d > 0.78:
                return rgba((60, 38, 22) if nx + ny > -0.4 else (96, 62, 34))
            if abs(d - 0.45) < 0.12:
                return rgba((142, 104, 62))
            return rgba((178, 138, 86) if d < 0.3 else (160, 120, 74))
        fill_ellipse(body, cx, cy, 4.4, 4.0, col)
    cv = outline(body)
    contact_shadow(cv, 3, 29, 30)
    return cv


def prop_bench() -> Canvas:
    body = Canvas(T, T)
    for (x0, x1) in ((6, 9), (23, 26)):
        fill_rect(body, x0, 17, x1 - x0, 11, rgba(W))
        fill_rect(body, x0, 17, 1, 11, rgba(W_L))
    for y in range(12, 18):
        for x in range(3, 29):
            c = W_H if y == 12 else (W_L if y < 15 else (W if y < 17 else W_D))
            if h01(x, y, 3) < 0.12 and 12 < y < 17:
                c = shade(c, 0.85)
            body.put(x, y, rgba(c))
    cv = outline(body)
    contact_shadow(cv, 4, 28, 29, 90)
    return cv


def prop_wheel() -> Canvas:
    body = Canvas(T, T)
    cx, cy = 16, 17
    for y in range(4, 31):
        for x in range(3, 30):
            d = math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.05)
            if 9.5 <= d < 12.5:
                c = W_L if (x + 0.5 - cx) + (y + 0.5 - cy) < -3 else (W if d < 11.5 else W_D)
                if d >= 11.8:
                    c = IRON
                body.put(x, y, rgba(c))
    for k in range(8):
        a = k * math.pi / 4 + 0.2
        line(body, cx, cy, int(round(cx + math.cos(a) * 10)), int(round(cy + math.sin(a) * 10)), rgba(W))
    fill_ellipse(body, cx, cy, 2.6, 2.6, lambda x, y, nx, ny: rgba(IRON_L if nx + ny < 0 else IRON))
    return outline(body)


def prop_bucket() -> Canvas:
    body = Canvas(T, T)
    for y in range(13, 28):
        half = 7 - (y - 13) * 0.12
        for x in range(int(16 - half), int(16 + half) + 1):
            d = (x + 0.5 - 16) / half
            c = shade(W, 1.2 - 0.5 * (d + 1) / 2)
            if (x - 9) % 3 == 0:
                c = shade(c, 0.8)
            body.put(x, y, rgba(c))
    for hy in (16, 24):
        for x in range(8, 25):
            if body.get(x, hy)[3]:
                body.put(x, hy, rgba(IRON_L if x < 16 else IRON))
    fill_ellipse(body, 16, 13, 7.2, 2.6, lambda x, y, nx, ny: rgba(
        W_D if nx * nx + ny * ny > 0.62 else ((70, 110, 140) if nx < 0.2 else (46, 78, 104))))
    for x in range(10, 23):
        y = int(13 - 7 * math.sin((x - 9) / 13 * math.pi))
        body.put(x, y, rgba(IRON_L))
    cv = outline(body)
    contact_shadow(cv, 9, 24, 29)
    return cv


def prop_puddle() -> Canvas:
    cv = Canvas(T, T)
    for y in range(T):
        for x in range(T):
            d = math.hypot((x + 0.5 - 16) / 12, (y + 0.5 - 19) / 6.5) + 0.12 * (vnoise(x, y, 32, 4, 4) - 0.5)
            if d < 1:
                c = (34, 40, 52) if d > 0.82 else (44, 54, 70)
                cv.put(x, y, rgba(c, 210))
    for (x0, x1, y) in ((9, 14, 17), (17, 22, 20), (11, 13, 22)):
        for x in range(x0, x1):
            cv.put(x, y, rgba((150, 140, 150), 200))
    cv.put(20, 17, rgba((240, 200, 120), 230))
    return cv


# ---------------------------------------------------------------------------
# Props altos 32x64
# ---------------------------------------------------------------------------

def tall_lamp_post() -> Canvas:
    body = Canvas(T, 64)
    for y in range(18, 58):
        body.put(15, y, rgba(IRON_L))
        body.put(16, y, rgba(IRON))
        body.put(17, y, rgba(IRON_D))
    for y in (26, 27, 44):
        fill_rect(body, 14, y, 5, 1, rgba(IRON_L if y != 27 else IRON_D))
    for y in range(55, 61):
        half = 2 + (y - 55)
        for x in range(16 - half, 17 + half):
            body.put(x, y, rgba(IRON if x > 16 else IRON_L))
    fill_rect(body, 11, 60, 11, 1, rgba(IRON_D))
    lamp = prop_lantern(2)
    # reaproveita a lanterna (sem o suporte) no topo do poste
    for y in range(8, 26):
        for x in range(T):
            c = lamp.get(x, y)
            if c[3]:
                body.put(x, y - 4, c)
    fill_rect(body, 14, 2, 4, 2, rgba(IRON))
    cv = Canvas(T, 64)
    ellipse_shadow(cv, 16.5, 61, 8, 2.2, 120)
    blit(cv, outline(body), 0, 0)
    return cv


def tall_tree() -> Canvas:
    body = Canvas(T, 64)
    bark = ((44, 30, 20), (70, 48, 30), (96, 66, 40))
    for y in range(34, 61):
        half = 2.6 + max(0, (y - 52)) * 0.55
        for x in range(int(16 - half), int(16 + half) + 1):
            d = (x + 0.5 - 16) / max(half, 1)
            c = bark[2] if d < -0.4 else (bark[1] if d < 0.45 else bark[0])
            if (y + x * 3) % 7 == 0:
                c = bark[0]
            body.put(x, y, rgba(c))
    rng = random.Random(4501)
    pal = ((26, 48, 28), (38, 68, 36), (56, 94, 46), (82, 124, 58))
    canopy = Canvas(T, 64)
    blobs = []
    for _ in range(70):
        a = rng.uniform(0, math.tau)
        rr = math.sqrt(rng.random())
        blobs.append((16 + math.cos(a) * rr * 12.5, 22 + math.sin(a) * rr * 14.5, rng.uniform(2.4, 4.0)))
    blobs.sort(key=lambda b: b[1])
    for (bx, by, r) in blobs:
        for yy in range(int(by - r) - 1, int(by + r) + 2):
            for xx in range(int(bx - r) - 1, int(bx + r) + 2):
                nx, ny = (xx + 0.5 - bx) / r, (yy + 0.5 - by) / r
                d = nx * nx + ny * ny
                if d > 1 or not (0 <= xx < T):
                    continue
                gl = -0.5 * (xx - 16) / 13 - 0.6 * (yy - 22) / 15
                lit = -0.55 * nx - 0.75 * ny + gl * 0.8
                c = pal[0] if (d > 0.7 and lit < 0.1) else (pal[3] if lit > 0.75 else (pal[2] if lit > 0.1 else pal[1]))
                canopy.put(xx, yy, rgba(c))
    blit(body, canopy, 0, 0)
    cv = Canvas(T, 64)
    ellipse_shadow(cv, 16, 60, 12, 3, 130)
    blit(cv, outline(body), 0, 0)
    return cv


def tall_board() -> Canvas:
    body = Canvas(T, 64)
    for x0 in (6, 24):
        for y in range(16, 61):
            body.put(x0, y, rgba(W_L))
            body.put(x0 + 1, y, rgba(W))
            body.put(x0 + 2, y, rgba(W_D))
    # telhadinho
    for y in range(10, 16):
        half = 9 + (y - 10) * 1.5
        for x in range(int(16 - half), int(17 + half)):
            c = ROOF[0] if (y - 10) % 2 else shade(ROOF[0], 1.3)
            if y == 15:
                c = ROOF_SH
            body.put(x, y, rgba(c))
    for y in range(16, 38):
        for x in range(4, 29):
            c = W if (x - 4) % 6 else W_D
            if y in (16, 37):
                c = W_D
            body.put(x, y, rgba(c))
    for (px, py, pw, ph) in ((7, 19, 8, 9), (17, 18, 9, 7), (16, 27, 8, 8), (8, 30, 6, 5)):
        for y in range(py, py + ph):
            for x in range(px, px + pw):
                c = (206, 190, 156) if x > px else (180, 164, 130)
                if y > py and (y - py) % 2 == 0 and px < x < px + pw - 1:
                    c = (120, 104, 84)
                body.put(x, y, rgba(c))
        body.put(px + pw // 2, py, rgba((180, 40, 40)))
    cv = Canvas(T, 64)
    ellipse_shadow(cv, 16, 61, 13, 2.5, 110)
    blit(cv, outline(body), 0, 0)
    return cv


def tall_banner() -> Canvas:
    body = Canvas(T, 64)
    for y in range(4, 61):
        body.put(8, y, rgba(W_L))
        body.put(9, y, rgba(W))
        body.put(10, y, rgba(W_D))
    fill_rect(body, 7, 2, 5, 3, rgba(GOLD))
    body.put(8, 2, rgba(GOLD_H))
    fill_rect(body, 10, 8, 18, 2, rgba(W))
    for y in range(10, 40):
        wav = int(round(math.sin(y / 5.0) * 0.8))
        tail = y > 33
        for x in range(11, 27):
            if tail and abs(x - 19) < (y - 33) * 1.4:
                continue
            c = (150, 34, 34) if x < 25 else (104, 22, 24)
            if x == 11:
                c = (184, 60, 52)
            body.put(x + wav, y, rgba(c))
    for (px, py) in ((18, 20), (19, 20), (18, 21), (19, 21)):
        body.put(px, py, rgba(GOLD_H))
    for (px, py) in ((18, 17), (19, 17), (15, 20), (22, 20), (15, 21), (22, 21), (18, 24), (19, 24),
                     (16, 18), (21, 18), (16, 23), (21, 23)):
        body.put(px, py, rgba(GOLD))
    for x in range(11, 27):
        body.put(x, 12, rgba(GOLD))
    cv = Canvas(T, 64)
    ellipse_shadow(cv, 9.5, 61, 5, 2, 110)
    blit(cv, outline(body), 0, 0)
    return cv


def main() -> None:
    build_theme(VillageTheme())


if __name__ == "__main__":
    main()
