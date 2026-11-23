"""
SUBMUNDO - Bioma `village_mine` (Mina Iluminada, Missao 2) - BRF-137 / T-072
==============================================================================
Mina ativa e bem iluminada: chao de terra batida com pedras e cascalho, paredes de
rocha terrosa escoradas por vigas, rodape de tabuas, trilhos e carrinhos, lanternas a
oleo (luz quente). Paleta quente terrosa (guia 1.2 Madeira & Reboco / Luz Quente).
"""
from __future__ import annotations

import math
import random
from typing import Dict, List, Sequence, Tuple

from under_kit import (
    Biome, Canvas, Frames, MapSpec, RGB, T, blit, darken, fbm, fill_ellipse, fill_rect, flip_h, hash01, line,
    mix, outline, overlay_blood, overlay_patch, paint_cells, rgba, shade, shaded_blob, sub, tile_points,
    wrap_crack, contact_shadow, free_points, bdb, flip_v,
)

WOOD_D, WOOD, WOOD_L, WOOD_H = bdb.WOOD_D, bdb.WOOD, bdb.WOOD_L, bdb.WOOD_H
IRON_D, IRON, IRON_L, IRON_H = (40, 34, 31), (66, 58, 52), (106, 96, 86), (150, 140, 126)
GOLD, GOLD_H = bdb.GOLD, bdb.GOLD_H
COPPER, COPPER_H = (176, 98, 52), (222, 150, 92)
FLAME = (bdb.FLAME_W, bdb.FLAME_Y, bdb.FLAME_AM, bdb.FLAME_OR, bdb.FLAME_RED)

DIRT_D: RGB = (39, 30, 23)
DIRT_L: RGB = (63, 48, 35)
STONE: Sequence[RGB] = ((50, 45, 41), (66, 59, 52), (82, 74, 64), (100, 91, 78))
ROCK_TONES: Sequence[RGB] = ((64, 53, 44), (72, 60, 48), (57, 48, 40), (78, 65, 52))
ROCK_CRACK: RGB = (26, 20, 16)
RAIL_HI, RAIL, RAIL_LO = (176, 172, 166), (118, 114, 110), (62, 58, 56)


def timber_h(cv: Canvas, x0: int, x1: int, y0: int, y1: int, seed: int, end_l: bool = False,
             end_r: bool = False) -> None:
    """Viga horizontal com veio, aresta clara em cima e base escura."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            t = (y - y0) / max(1, y1 - y0 - 1)
            col = WOOD_L if t < 0.45 else WOOD
            n = hash01(seed, x // 3, y)
            if n < 0.18:
                col = shade(col, 0.82)
            elif n > 0.9:
                col = shade(col, 1.1)
            if y == y0:
                col = WOOD_H
            elif y == y1 - 1:
                col = WOOD_D
            elif y == y1 - 2:
                col = shade(WOOD, 0.8)
            cv.put(x, y, rgba(col))
    for (ex, flag) in ((x0, end_l), (x1 - 1, end_r)):
        if flag:
            for y in range(y0, y1):
                cv.put(ex, y, rgba(WOOD_D))
    # nos da madeira
    rng = random.Random(seed)
    for _ in range(max(1, (x1 - x0) // 14)):
        kx, ky = rng.randint(x0 + 2, x1 - 3), rng.randint(y0 + 2, max(y0 + 2, y1 - 3))
        cv.put(kx, ky, rgba(WOOD_D))
        cv.put(kx + 1, ky, rgba(shade(WOOD, 0.7)))


def timber_v(cv: Canvas, x0: int, x1: int, y0: int, y1: int, seed: int) -> None:
    """Poste vertical (luz pela esquerda)."""
    w = x1 - x0
    for y in range(y0, y1):
        for x in range(x0, x1):
            i = x - x0
            if i == 0:
                col = WOOD_D
            elif i == 1:
                col = WOOD_H
            elif i < w * 0.55:
                col = WOOD_L
            elif i < w - 1:
                col = WOOD
            else:
                col = WOOD_D
            n = hash01(seed, x, y // 3)
            if 1 < i < w - 1 and n < 0.16:
                col = shade(col, 0.82)
            cv.put(x, y, rgba(col))
    rng = random.Random(seed)
    for _ in range(max(1, (y1 - y0) // 16)):
        ky = rng.randint(y0 + 3, y1 - 3)
        kx = rng.randint(x0 + 2, x1 - 2)
        cv.put(kx, ky, rgba(WOOD_D))
        cv.put(kx, ky + 1, rgba(shade(WOOD, 0.7)))


def nail(cv: Canvas, x: int, y: int) -> None:
    cv.put(x, y, rgba(IRON_L))
    cv.put(x + 1, y + 1, rgba(IRON_D))


def draw_rail_pair_v(cv: Canvas, xa: int, xb: int, y0: int, y1: int, tie_phase: int = 0) -> None:
    for y in range(y0, y1):
        if (y + tie_phase) % 8 in (0, 1, 2):
            for x in range(xa - 3, xb + 5):
                col = WOOD if (y + tie_phase) % 8 == 1 else (WOOD_L if (y + tie_phase) % 8 == 0 else WOOD_D)
                cv.put(x, y, rgba(col))
    for y in range(y0, y1):
        for xr in (xa, xb):
            cv.put(xr, y, rgba(RAIL_HI))
            cv.put(xr + 1, y, rgba(RAIL))
            cv.put(xr + 2, y, rgba(RAIL_LO))


class VillageMine(Biome):
    id = "village_mine"
    title = "Mina Iluminada"
    subtitle = "Missão 2 · terra batida, rocha terrosa, vigas, trilhos e lanternas a óleo"
    side_rim_lo = (54, 42, 32)
    side_rim = (92, 74, 56)
    rim = (118, 95, 70)
    rim_hi = (156, 124, 88)
    rim_lo = (46, 35, 27)
    cap_tones = ((35, 29, 24), (39, 32, 26), (31, 26, 22))
    cap_crack = (15, 11, 9)
    quoin_hi = (110, 92, 72)
    quoin_tones = ((74, 62, 50), (68, 57, 46))
    face_mortar = ROCK_CRACK
    jamb_tones = (WOOD, shade(WOOD, 0.9))
    jamb_top = WOOD_H
    gap_dark = (14, 10, 8)
    shadow_tint = (6, 3, 1)
    torch_flame = (16.0, 18.0)  # centro da luz no frame do prop
    torch_light = (1.0, 0.66, 0.30)
    torch_glow = ((255, 205, 110), (245, 140, 40))

    # ------------------------------------------------------------------ piso
    def earth(self) -> Canvas:
        if "earth" not in self._cache:
            cv = Canvas(T, T)
            for y in range(T):
                for x in range(T):
                    n = fbm(611, x, y)
                    col = mix(DIRT_D, DIRT_L, min(1.0, max(0.0, (n - 0.25) * 1.6)))
                    r = hash01(612, x, y)
                    if r < 0.07:
                        col = shade(col, 0.82)
                    elif r < 0.11:
                        col = shade(col, 1.14)
                    cv.put(x, y, rgba(col))
            self._cache["earth"] = cv
        return self._cache["earth"].copy()

    def stones(self, cv: Canvas, seed: int, n: int, rmin: float, rmax: float) -> None:
        rng = random.Random(seed)
        placed: List[Tuple[float, float, float]] = []
        tries = 0
        while len(placed) < n and tries < 200:
            tries += 1
            rx = rng.uniform(rmin, rmax)
            ry = rx * rng.uniform(0.55, 0.75)
            cx, cy = rng.uniform(rx + 2, T - rx - 2), rng.uniform(ry + 2, T - ry - 3)
            if any(math.hypot(cx - a, cy - b) < r + rx + 1.5 for a, b, r in placed):
                continue
            placed.append((cx, cy, rx))
            # sombra embaixo
            fill_ellipse(cv, cx + 0.6, cy + 1.2, rx, ry, lambda x, y, nx, ny: rgba(shade(DIRT_D, 0.7)))
            shaded_blob(cv, cx, cy, rx, ry, STONE)
        for _ in range(n * 4 + 6):
            x, y = rng.randint(2, T - 3), rng.randint(2, T - 3)
            if cv.get(x, y)[0] < 70:
                cv.put(x, y, rgba(STONE[2] if rng.random() < 0.6 else STONE[3]))
                cv.put(x, y + 1, rgba(shade(DIRT_D, 0.75)))

    def floor(self, name: str) -> Canvas:
        cv = self.earth()
        if name == "floor_0":
            self.stones(cv, 101, 3, 2.6, 4.2)
        elif name == "floor_1":
            self.stones(cv, 102, 1, 5.5, 6.5)
            self.stones(cv, 112, 2, 1.6, 2.4)
        elif name == "floor_2":
            self.stones(cv, 103, 5, 1.8, 3.2)
        elif name == "floor_cracked":
            wrap_crack(cv, 104, 9, 3, 22, 1, (22, 16, 12), (70, 55, 40))
            wrap_crack(cv, 105, 24, 12, 11, -1, (22, 16, 12), (70, 55, 40))
            self.stones(cv, 106, 1, 2.4, 3.0)
        elif name == "floor_moss":
            def pick(d: float, n: float, old) -> RGB:
                base = mix(old[:3], (24, 22, 16), 0.55)
                if n > 0.72:
                    return (52, 66, 34) if n < 0.9 else (74, 88, 44)
                return base
            overlay_patch(cv, 107, [(9, 22, 8.5), (22, 9, 6.0), (17, 15, 4.0)], pick)
            self.stones(cv, 108, 2, 2.0, 2.8)
        elif name == "floor_blood":
            self.stones(cv, 109, 2, 2.0, 3.0)
            overlay_blood(cv, 110, (46, 12, 10), (70, 16, 14), (98, 26, 22))
        return cv

    def cap_base(self, seed: int) -> Canvas:
        cv = Canvas(T, T)
        pts = tile_points(self.cap_seed(), seed, self.cap_tones, spacing=8, inner_n=4, margin=9)
        paint_cells(cv, pts, self.cap_crack, edge_w=0.9, bevel_w=1.3, hi_f=1.2, lo_f=0.8,
                    speck_seed=self.cap_seed() + 5, speck=0.08, dome=0.18)
        return cv

    # ------------------------------------------------------------------ face
    def rock_slab(self) -> Canvas:
        if "slab" not in self._cache:
            cv = Canvas(T, 64)
            pts = free_points(9911, 13, T, 64, ROCK_TONES)
            paint_cells(cv, pts, ROCK_CRACK, wrap_x=True, wrap_y=False, aniso=1.35, edge_w=1.0, bevel_w=1.8,
                        hi_f=1.28, lo_f=0.72, speck_seed=9912, speck=0.1, dome=0.22)
            self._cache["slab"] = cv
        return self._cache["slab"].copy()

    def face(self, kind: str) -> Canvas:
        slab = self.rock_slab()
        if kind.startswith("upper"):
            cv = sub(slab, 0, 0)
            if kind == "upper_cracked":
                # veio de minerio (ouro/cobre) cortando a rocha
                pts = [(3, 25), (8, 21), (13, 19), (17, 15), (22, 13), (27, 9), (31, 8)]
                for (a, b), (c, d) in zip(pts, pts[1:]):
                    line(cv, a, b, c, d, rgba((30, 22, 14)))
                    line(cv, a, b - 1, c, d - 1, rgba((88, 64, 36)))
                for (gx, gy, g) in ((7, 20, GOLD_H), (12, 18, GOLD), (16, 14, COPPER_H), (21, 12, GOLD),
                                    (26, 8, GOLD_H), (10, 23, COPPER), (19, 17, GOLD), (24, 14, COPPER)):
                    cv.put(gx, gy, rgba(g))
                    cv.put(gx + 1, gy, rgba(shade(g, 0.7)))
                    cv.put(gx, gy + 1, rgba(shade(g, 0.6)))
            # viga-mestra de escoramento
            timber_h(cv, 0, T, 2, 10, 3101)
            for x in range(T):
                darken(cv, x, 10, 0.55)
                darken(cv, x, 11, 0.75)
            for nx in (4, 20):
                nail(cv, nx, 5)
            self.overhang(cv)
            return cv
        cv = sub(slab, 0, 32)
        if kind == "lower_grate":
            # galeria lateral tapada com tabuas
            for y in range(4, 30):
                for x in range(7, 25):
                    dx = x + 0.5 - 16
                    if y < 12 and dx * dx + (y - 12) ** 2 * 1.6 > 81:
                        continue
                    edge = (dx * dx + (y - 12) ** 2 * 1.6 > 56 and y < 12) or x in (7, 24)
                    cv.put(x, y, rgba((70, 58, 46) if edge else mix((5, 4, 3), (16, 12, 9), (y - 4) / 26)))
            for (a, b, c, d, s) in ((8, 9, 23, 23, 31), (8, 22, 23, 11, 32)):
                for o in range(3):
                    line(cv, a, b + o, c, d + o, rgba(WOOD_L if o == 0 else (WOOD if o == 1 else WOOD_D)))
                nail(cv, a + 1, b + 1)
                nail(cv, c - 2, d + 1)
        # rodape de tabuas (madeira envelhecida, menos saturada que as vigas)
        def aged(c: RGB) -> RGB:
            return mix(c, (64, 56, 48), 0.38)
        for y in range(19, 32):
            for x in range(T):
                if y == 19:
                    col = (20, 14, 10)
                elif y in (20, 26):
                    col = WOOD_H if x % 13 else WOOD_L
                elif y in (25, 31):
                    col = WOOD_D
                else:
                    col = WOOD_L if (y < 23 or 26 < y < 29) else WOOD
                    if hash01(3201, x // 3, y) < 0.16:
                        col = shade(col, 0.84)
                board = 0 if y < 26 else 1
                if (x + (0 if board else 16)) % 32 in (9, 10):
                    col = WOOD_D if (x + (0 if board else 16)) % 32 == 9 else shade(WOOD, 0.75)
                if kind == "lower_grate" and 7 <= x <= 24 and y < 26:
                    continue
                cv.put(x, y, rgba(aged(col)))
        for nx, ny in ((7, 22), (12, 22), (23, 28), (28, 28)):
            if not (kind == "lower_grate" and 7 <= nx <= 24 and ny < 26):
                nail(cv, nx, ny)
        return cv

    def face_end(self, kind: str, sides: str) -> Canvas:
        """Quina convexa = poste de escoramento."""
        cv = self.face(kind).copy()
        for side in sides:
            x0 = 0 if side == "l" else T - 7
            timber_v(cv, x0, x0 + 7, 0, T, 3300 + (0 if side == "l" else 1) + (10 if kind == "upper" else 0))
            if kind == "upper":
                # consola onde a viga-mestra apoia
                for y in range(2, 11):
                    cv.put(x0 + (6 if side == "l" else 0), y, rgba(WOOD_D))
                nail(cv, x0 + 3, 6)
            else:
                for y in range(28, 32):
                    for x in range(x0, x0 + 7):
                        cv.put(x, y, rgba(STONE[1] if y == 28 else STONE[0]))
                nail(cv, x0 + 3, 14)
        if kind == "upper":
            self.overhang(cv)
        return cv

    # ------------------------------------------------------------------ porta
    def door_open(self, x: int, y: int) -> bool:
        return 20 <= x <= 43 and y >= 15

    def door_big(self) -> Canvas:
        if "door" in self._cache:
            return self._cache["door"]
        cv = Canvas(64, 64)
        up, lo = self.face("upper"), self.face("lower")
        for i in (0, 32):
            blit(cv, up, i, 0)
            blit(cv, lo, i, 32)
        # tunel
        for y in range(15, 64):
            for x in range(20, 44):
                d = (y - 15) / 48
                col = mix((5, 4, 3), (22, 17, 12), d ** 1.4)
                if x in (20, 43):
                    col = shade(col, 0.6)
                cv.put(x, y, rgba(col))
        # escoramentos internos em perspectiva (aneis de madeira no fundo)
        for (iy, inset) in ((24, 6), (33, 4)):
            for x in range(20 + inset, 44 - inset):
                cv.put(x, iy, rgba(shade(WOOD, 0.45 if inset == 6 else 0.6)))
            for y in range(iy, 64 if inset == 4 else 46):
                pass
            for y in range(iy, iy + (14 if inset == 6 else 20)):
                cv.put(20 + inset, y, rgba(shade(WOOD, 0.4 if inset == 6 else 0.55)))
                cv.put(43 - inset, y, rgba(shade(WOOD, 0.35 if inset == 6 else 0.5)))
        # trilhos convergindo para o fundo
        for y in range(36, 64):
            t = (y - 36) / 27
            xl = 28.5 - 5.5 * t
            xr = 35.5 + 4.5 * t
            if (y - 36) % max(2, int(3 + 4 * t)) == 0:
                for x in range(int(xl) - 1, int(xr) + 3):
                    cv.put(x, y, rgba(shade(WOOD, 0.5 + 0.5 * t)))
            cv.put(int(xl), y, rgba(shade(RAIL_HI, 0.45 + 0.55 * t)))
            cv.put(int(xr), y, rgba(shade(RAIL_HI, 0.45 + 0.55 * t)))
            cv.put(int(xl) + 1, y, rgba(shade(RAIL_LO, 0.6 + 0.4 * t)))
            cv.put(int(xr) + 1, y, rgba(shade(RAIL_LO, 0.6 + 0.4 * t)))
        # portal de madeira (postes + verga + maos-francesas)
        timber_v(cv, 13, 20, 12, 64, 3401)
        timber_v(cv, 44, 51, 12, 64, 3402)
        timber_h(cv, 10, 54, 6, 15, 3403, True, True)
        for (a, b, c, d) in ((20, 22, 26, 15), (43, 22, 37, 15)):
            for o in range(3):
                line(cv, a, b + o, c, d + o, rgba(WOOD_L if o == 0 else (WOOD if o == 1 else WOOD_D)))
        for x in range(13, 21):
            cv.put(x, 15, rgba(shade(WOOD_D, 0.8)))
        for x in range(44, 52):
            cv.put(x, 15, rgba(shade(WOOD_D, 0.8)))
        for (nx, ny) in ((12, 9), (51, 9), (15, 18), (47, 18), (15, 50), (47, 50)):
            nail(cv, nx, ny)
        # placa com picareta acima da verga
        for y in range(0, 6):
            for x in range(25, 39):
                cv.put(x, y, rgba(WOOD_L if y == 0 else (WOOD if y < 5 else WOOD_D)))
        line(cv, 28, 4, 35, 1, rgba((230, 214, 170)))
        line(cv, 29, 1, 34, 4, rgba((230, 214, 170)))
        cv.put(25, 2, rgba(IRON_L))
        cv.put(38, 2, rgba(IRON_L))
        # base de pedra dos postes
        for (x0, x1) in ((12, 21), (43, 52)):
            for y in range(60, 64):
                for x in range(x0, x1):
                    cv.put(x, y, rgba(STONE[2] if y == 60 else STONE[1] if y < 62 else STONE[0]))
        self._cache["door"] = cv
        return cv

    def threshold(self) -> Canvas:
        cv = Canvas(64, T)
        blit(cv, self.floor("floor_0"), 0, 0)
        blit(cv, self.floor("floor_2"), 32, 0)
        # piso de terra mais pisado sob o portal
        for y in range(0, T):
            for x in range(16, 48):
                c = cv.get(x, y)[:3]
                cv.put(x, y, rgba(mix(c, DIRT_D, 0.35 * (1 - y / T))))
        for x in range(13, 51):
            cv.put(x, 0, rgba((10, 8, 6)))
            cv.put(x, 1, rgba((24, 18, 13)))
        draw_rail_pair_v(cv, 23, 39, 0, T, 5)
        return cv

    def jamb(self, cv: Canvas, x0: int, x1: int, y0: int, y1: int, rng: random.Random) -> None:
        timber_h(cv, x0, x1, y0, y1, 3500 + x0 + y0)

    def mark(self, cv: Canvas, x: int, y: int, idx: int, bright: bool) -> None:
        # chapa de ferro aparafusada (escoramento)
        for yy in range(y, y + 5):
            for xx in range(x, x + 4):
                cv.put(xx, yy, rgba(IRON if yy > y else IRON_L))
        cv.put(x + 1, y + 1, rgba(IRON_H))
        cv.put(x + 2, y + 3, rgba(IRON_H))
        cv.put(x + 3, y + 4, rgba(IRON_D))

    def sill_h(self, cv: Canvas, x0: int, x1: int, y: int) -> None:
        for x in range(x0, x1):
            cv.put(x, y, rgba(WOOD_L))
            cv.put(x, y + 1, rgba(WOOD))
            cv.put(x, y + 2, rgba(WOOD_D))

    def sill_v(self, cv: Canvas, x: int, y0: int, y1: int, east: bool) -> None:
        for y in range(y0, y1):
            cv.put(x, y, rgba(WOOD_L))
            cv.put(x + (1 if east else -1), y, rgba(WOOD_D))

    # ------------------------------------------------------------------ props
    def lantern(self, frame: int) -> Canvas:
        cv = Canvas(T, T)
        body = Canvas(T, T)
        # suporte na parede + braco
        fill_rect(body, 6, 3, 3, 8, rgba(IRON))
        fill_rect(body, 6, 3, 1, 8, rgba(IRON_L))
        fill_rect(body, 6, 4, 13, 2, rgba(IRON))
        fill_rect(body, 6, 4, 13, 1, rgba(IRON_L))
        line(body, 8, 10, 14, 6, rgba(IRON_D))
        fill_rect(body, 16, 6, 1, 3, rgba(IRON_L))
        # lanterna
        fill_rect(body, 13, 9, 7, 2, rgba(IRON))
        fill_rect(body, 14, 8, 5, 1, rgba(IRON_L))
        fill_rect(body, 12, 11, 9, 1, rgba(IRON_D))
        fill_rect(body, 12, 12, 9, 10, rgba((120, 62, 18)))
        fill_rect(body, 12, 22, 9, 2, rgba(IRON))
        fill_rect(body, 13, 24, 7, 1, rgba(IRON_D))
        for x in (12, 20):
            fill_rect(body, x, 12, 1, 10, rgba(IRON_D))
        fill_rect(body, 16, 12, 1, 10, rgba(IRON_D))
        cv = outline(body)
        # vidro aceso (cor muda com a chama)
        glow = ((254, 236, 160), (253, 224, 120), (255, 240, 170), (250, 214, 110))[frame]
        for y in range(12, 22):
            for x in (13, 14, 15, 17, 18, 19):
                t = abs(y - 17.5) / 5
                cv.put(x, y, rgba(mix(glow, (214, 120, 30), min(1.0, t * 0.9 + abs(x - 16) * 0.08))))
        hgt = (5, 4, 6, 5)[frame]
        for i in range(hgt):
            yy = 20 - i
            cv.put(16 + ((0, 0, 1, 0)[frame] if i > 2 else 0), yy, rgba(FLAME[0] if i < 2 else FLAME[1]))
        cv.put(15, 20, rgba(FLAME[1]))
        cv.put(17, 20, rgba(FLAME[2]))
        # reflexo no metal
        cv.put(13, 9, rgba(IRON_H))
        cv.put(12, 22, rgba(IRON_H))
        return cv

    def cart(self, ore: bool, tipped: bool = False) -> Canvas:
        body = Canvas(T, T)
        pal = ((52, 42, 38), (78, 64, 54), (104, 86, 70), (138, 116, 92))
        # rodas
        for wx in (7, 24):
            fill_ellipse(body, wx, 26.5, 3.2, 3.2, lambda x, y, nx, ny: rgba((24, 22, 22) if nx * nx + ny * ny > 0.45 else IRON_L))
        # caixa: frente trapezoidal
        for y in range(12, 26):
            t = (y - 12) / 13
            inset = int(1 + t * 2)
            for x in range(3 + inset, 29 - inset):
                col = pal[2] if y < 15 else (pal[1] if y < 23 else pal[0])
                if y in (14, 22):
                    col = pal[3]
                if x in (3 + inset, 28 - inset):
                    col = pal[0]
                body.put(x, y, rgba(col))
        for x in (9, 16, 23):
            for y in range(13, 25):
                body.put(x, y, rgba(pal[0]))
                body.put(x + 1, y, rgba(pal[3] if y % 4 == 0 else pal[2]))
        # borda de cima (vista de cima) e interior
        for y in range(7, 12):
            for x in range(3, 29):
                inner = 5 <= x <= 26 and 8 <= y <= 11
                col = pal[3] if y == 7 else (pal[2] if not inner else (20, 15, 12))
                body.put(x, y, rgba(col))
        if ore:
            rng = random.Random(4401)
            for (cx, cy, rx) in ((9, 9, 3.4), (14, 7.5, 3.8), (20, 8, 3.5), (24.5, 9, 3.0), (17, 10, 3.0), (12, 10.5, 2.6)):
                shaded_blob(body, cx, cy, rx, rx * 0.8, STONE)
            for (gx, gy, g) in ((13, 6, GOLD_H), (19, 7, GOLD), (10, 8, COPPER_H), (23, 8, GOLD_H), (16, 9, COPPER)):
                body.put(gx, gy, rgba(g))
                body.put(gx + 1, gy + 1, rgba(shade(g, 0.6)))
            _ = rng
        cv = outline(body)
        contact_shadow(cv, 4, 29, 30, 120)
        contact_shadow(cv, 6, 27, 31, 70)
        return cv

    def crate(self) -> Canvas:
        body = Canvas(T, T)
        for y in range(8, 14):
            for x in range(5, 27):
                body.put(x, y, rgba(WOOD_H if y == 8 else (WOOD_L if (x - 5) % 7 else WOOD_D)))
        for y in range(14, 29):
            for x in range(5, 27):
                col = WOOD if (y - 14) % 5 else WOOD_D
                if x in (5, 26) or y in (14, 28):
                    col = shade(WOOD_L, 0.95)
                body.put(x, y, rgba(col))
        line(body, 6, 15, 25, 27, rgba(WOOD_L))
        line(body, 6, 16, 25, 28, rgba(WOOD_D))
        for (nx, ny) in ((6, 15), (25, 15), (6, 27), (25, 27)):
            body.put(nx, ny, rgba(IRON_L))
        cv = outline(body)
        contact_shadow(cv, 5, 28, 30, 110)
        return cv

    def ore_pile(self) -> Canvas:
        body = Canvas(T, T)
        for (cx, cy, rx, ry) in ((10, 24, 6, 4.5), (21, 24, 6.5, 4.5), (15.5, 19, 6, 4.5), (25, 27, 3.5, 2.6),
                                 (6, 27, 3, 2.2), (16, 26, 4, 3)):
            shaded_blob(body, cx, cy, rx, ry, STONE)
        for (gx, gy, g) in ((13, 17, GOLD_H), (18, 18, GOLD), (8, 22, COPPER_H), (22, 22, GOLD_H), (15, 24, COPPER),
                            (25, 25, GOLD), (11, 25, GOLD_H)):
            body.put(gx, gy, rgba(g))
            body.put(gx + 1, gy, rgba(shade(g, 0.7)))
        cv = outline(body)
        contact_shadow(cv, 4, 28, 30, 90)
        return cv

    def tools(self) -> Canvas:
        body = Canvas(T, T)
        for o in range(2):
            line(body, 5, 27 + o, 25, 11 + o, rgba(WOOD_L if o == 0 else WOOD_D))
        for o in range(2):
            line(body, 8, 10 + o, 26, 26 + o, rgba(WOOD_L if o == 0 else WOOD_D))
        # cabeca da picareta
        pts = [(19, 9), (22, 10), (24, 12), (25, 14), (27, 15)]
        for (a, b), (c, d) in zip(pts, pts[1:]):
            line(body, a, b, c, d, rgba(IRON_L))
            line(body, a, b + 1, c, d + 1, rgba(IRON))
        line(body, 23, 9, 20, 6, rgba(IRON_L))
        line(body, 24, 9, 21, 6, rgba(IRON))
        # pa
        fill_ellipse(body, 27, 27.5, 3.2, 2.4, lambda x, y, nx, ny: rgba(IRON_H if nx + ny < -0.4 else (IRON_L if nx + ny < 0.5 else IRON)))
        cv = outline(body)
        return cv

    def rope(self) -> Canvas:
        body = Canvas(T, T)
        tan, tan_l, tan_d = (150, 118, 72), (186, 152, 98), (96, 72, 42)
        for i, (rx, ry) in enumerate(((9, 5.5), (7, 4.2), (5, 3.0), (3, 1.8))):
            for a in range(0, 360, 4):
                t = math.radians(a)
                x, y = 16 + rx * math.cos(t), 22 + ry * math.sin(t)
                col = tan_l if math.sin(t) < -0.3 else (tan if math.sin(t) < 0.5 else tan_d)
                if (a // 12) % 2:
                    col = shade(col, 0.85)
                body.put(int(x), int(y), rgba(col))
                body.put(int(x), int(y) + 1, rgba(tan_d))
        line(body, 25, 22, 29, 28, rgba(tan))
        cv = outline(body)
        contact_shadow(cv, 7, 26, 29, 90)
        return cv

    def sacks(self) -> Canvas:
        body = Canvas(T, T)
        bur = ((92, 74, 50), (122, 100, 68), (150, 126, 88), (176, 152, 108))
        shaded_blob(body, 11, 21, 7, 7.5, bur)
        shaded_blob(body, 21, 23, 6.5, 6, bur)
        for (cx, ty) in ((11, 13), (21, 17)):
            fill_rect(body, cx - 2, ty - 2, 4, 3, rgba(bur[1]))
            fill_rect(body, cx - 2, ty, 4, 1, rgba(bur[0]))
        for y in range(16, 27, 3):
            body.put(8, y, rgba(bur[0]))
        cv = outline(body)
        contact_shadow(cv, 4, 28, 30, 100)
        return cv

    def rail(self, kind: str) -> Canvas:
        cv = Canvas(T, T)
        if kind == "v":
            draw_rail_pair_v(cv, 7, 23, 0, T, 5)
        elif kind == "h":
            v = Canvas(T, T)
            draw_rail_pair_v(v, 7, 23, 0, T, 5)
            for y in range(T):
                for x in range(T):
                    c = v.get(y, x)
                    if c[3]:
                        # rotaciona e refaz a luz (aresta clara em cima)
                        col = c[:3]
                        if col == RAIL_HI:
                            col = RAIL_HI
                        cv.put(x, y, c)
        elif kind == "bend":
            # curva sul -> leste (centro no canto inferior direito)
            for y in range(T):
                for x in range(T):
                    r = math.hypot(x + 0.5 - 32, y + 0.5 - 32)
                    ang = math.degrees(math.atan2(32 - (y + 0.5), 32 - (x + 0.5)))
                    if 4 <= r <= 28 and int(ang + 2) % 11 in (0, 1, 2) and 0 <= ang <= 90:
                        k = int(ang + 2) % 11
                        cv.put(x, y, rgba(WOOD_L if k == 0 else (WOOD if k == 1 else WOOD_D)))
            for y in range(T):
                for x in range(T):
                    r = math.hypot(x + 0.5 - 32, y + 0.5 - 32)
                    for rr in (8.5, 24.5):
                        if rr - 1.5 <= r < rr - 0.5:
                            cv.put(x, y, rgba(RAIL_HI))
                        elif rr - 0.5 <= r < rr + 0.5:
                            cv.put(x, y, rgba(RAIL))
                        elif rr + 0.5 <= r < rr + 1.5:
                            cv.put(x, y, rgba(RAIL_LO))
        elif kind == "stop":
            draw_rail_pair_v(cv, 7, 23, 12, T, 5)
            body = Canvas(T, T)
            fill_rect(body, 3, 7, 26, 6, rgba(WOOD_L))
            fill_rect(body, 3, 7, 26, 1, rgba(WOOD_H))
            fill_rect(body, 3, 12, 26, 2, rgba(WOOD_D))
            fill_rect(body, 5, 13, 4, 3, rgba(WOOD))
            fill_rect(body, 23, 13, 4, 3, rgba(WOOD))
            for x in (8, 24):
                body.put(x, 9, rgba(IRON_L))
            fill_rect(body, 13, 9, 6, 2, rgba((150, 38, 30)))
            blit(cv, outline(body), 0, 0)
        return cv

    def props(self) -> Frames:
        return [
            ("torch_0", self.lantern(0)),
            ("torch_1", self.lantern(1)),
            ("torch_2", self.lantern(2)),
            ("torch_3", self.lantern(3)),
            ("mine_cart", self.cart(False)),
            ("mine_cart_ore", self.cart(True)),
            ("crate", self.crate()),
            ("ore_pile", self.ore_pile()),
            ("pick_shovel", self.tools()),
            ("rope_coil", self.rope()),
            ("sacks", self.sacks()),
            ("barrel", bdb.prop_barrel()),
            ("rail_v", self.rail("v")),
            ("rail_h", self.rail("h")),
            ("rail_bend_se", self.rail("bend")),
            ("rail_bend_sw", flip_h(self.rail("bend"))),
            ("rail_bend_ne", flip_v(self.rail("bend"))),
            ("rail_bend_nw", flip_h(flip_v(self.rail("bend")))),
            ("rail_stop", self.rail("stop")),
        ]

    # ------------------------------------------------------------------ altos
    def support_post(self) -> Canvas:
        body = Canvas(T, 64)
        timber_v(body, 12, 20, 8, 60, 3601)
        timber_h(body, 6, 26, 3, 9, 3602, True, True)
        for (a, b, c, d) in ((19, 18, 25, 9), (12, 18, 7, 9)):
            for o in range(2):
                line(body, a + (o if a > c else -o), b, c + (o if a > c else -o), d, rgba(WOOD_L if o == 0 else WOOD_D))
        fill_rect(body, 11, 30, 10, 2, rgba(IRON))
        fill_rect(body, 11, 30, 10, 1, rgba(IRON_L))
        for (nx, ny) in ((15, 5), (16, 31), (14, 50)):
            nail(body, nx, ny)
        for y in range(57, 61):
            for x in range(9, 23):
                body.put(x, y, rgba(STONE[2] if y == 57 else STONE[1] if y < 59 else STONE[0]))
        cv = Canvas(T, 64)
        for x in range(6, 27):
            cv.put(x, 61, (0, 0, 0, 120))
            cv.put(x, 62, (0, 0, 0, 60))
        blit(cv, outline(body), 0, 0)
        return cv

    def lantern_post(self) -> Canvas:
        body = Canvas(T, 64)
        timber_v(body, 8, 13, 6, 60, 3701)
        timber_h(body, 8, 26, 6, 10, 3702, False, True)
        line(body, 12, 18, 19, 10, rgba(WOOD_L))
        line(body, 12, 19, 19, 11, rgba(WOOD_D))
        for y in range(56, 61):
            for x in range(5, 17):
                body.put(x, y, rgba(STONE[2] if y == 56 else STONE[1] if y < 59 else STONE[0]))
        cv = Canvas(T, 64)
        for x in range(4, 26):
            cv.put(x, 61, (0, 0, 0, 110))
        blit(cv, outline(body), 0, 0)
        lan = self.lantern(0)
        # so a lanterna (sem o suporte de parede): recorta x>=11
        for y in range(7, 27):
            for x in range(11, 23):
                c = lan.get(x, y)
                if c[3]:
                    cv.put(x + 6, y + 4, c)
        for y in range(10, 13):
            cv.put(22, y, rgba(IRON_L))
        return cv

    def crate_stack(self) -> Canvas:
        cv = Canvas(T, 64)
        c = self.crate()
        small = Canvas(T, T)
        for y in range(T):
            for x in range(T):
                small.put(x, y, c.get(x, y))
        blit(cv, c, 0, 32)
        top = Canvas(T, T)
        blit(top, c, 0, 0)
        blit(cv, top, 2, 11)
        sk = self.sacks()
        blit(cv, sk, -2, 2)
        _ = small
        return cv

    def rock_column(self) -> Canvas:
        body = Canvas(T, 64)
        pts = free_points(3801, 9, T, 64, ROCK_TONES)

        def inside(x: int, y: int) -> bool:
            half = 10 + 2 * math.sin(y * 0.21) + (3 if y > 52 else 0) + (2 if y < 8 else 0)
            return abs(x + 0.5 - 16) < half and 3 <= y < 61
        paint_cells(body, pts, ROCK_CRACK, wrap_x=False, wrap_y=False, aniso=1.2, edge_w=1.0, bevel_w=1.6,
                    hi_f=1.28, lo_f=0.72, speck_seed=3802, mask=inside, dome=0.3)
        for y in range(3, 61):
            for x in range(T):
                if body.get(x, y)[3]:
                    l = (x - 6) / 20
                    darken(body, x, y, 1.12 - 0.42 * l)
        # cinta de madeira e ferro
        timber_h(body, 5, 27, 26, 32, 3803, True, True)
        for x in range(5, 27):
            if not inside(x, 26):
                pass
        cv = Canvas(T, 64)
        for x in range(3, 30):
            cv.put(x, 61, (0, 0, 0, 120))
        blit(cv, outline(body), 0, 0)
        return cv

    def props_tall(self) -> Frames:
        return [("support_post", self.support_post()), ("lantern_post", self.lantern_post()),
                ("crate_stack", self.crate_stack()), ("rock_column", self.rock_column())]

    # ------------------------------------------------------------------ mockup
    MAP = [
        "#####################..#",
        "#####################..#",
        "########nn###########..#",
        "########nn###########..#",
        "###..........########..#",
        "###..........########..#",
        "###..........########..#",
        "###................e...#",
        "###................e...#",
        "###................#####",
        "###................#####",
        "###................#####",
        "###................#####",
        "########################",
    ]

    def scene(self) -> Dict[str, object]:
        P = 32
        X, YB = 9 * P - 16, 241
        decals: List[Tuple[str, int, int]] = [("rail_v", X, y) for y in (145, 177, 209)]
        decals.append(("rail_bend_ne", X, YB))
        decals += [("rail_h", x, YB) for x in range(X + 32, 688, 32)]
        decals.append(("rail_bend_nw", 688, YB))
        decals += [("rail_v", 688, y) for y in (209, 177, 145, 113, 81, 49, 17, -15)]
        return {
            "map": self.MAP,
            "view": (80.0, 42.0),
            "torch_radius": 200,
            "torch_power": 0.95,
            "decals": decals,
            "wall_props": [("torch_0", 5 * P, 2 * P + 2), ("torch_2", 11 * P, 2 * P + 2),
                           ("torch_1", 14 * P + 16, 5 * P + 2), ("torch_3", 17 * P + 16, 5 * P + 2)],
            "floor_props": [("mine_cart_ore", 430, YB - 9), ("ore_pile", 352, 132), ("crate", 100, 134),
                            ("barrel", 100, 166), ("pick_shovel", 196, 150), ("sacks", 118, 376),
                            ("rope_coil", 560, 372), ("crate", 384, 140), ("ore_pile", 540, 388)],
            "tall_props": [("support_post", 3 * P + 2, 70), ("support_post", 12 * P - 2, 70),
                           ("crate_stack", 590, 310), ("lantern_post", 214, 312)],
            "actors": [("wolf_alpha", 512, 316, True), ("wolf", 466, 372, True), ("wolf", 214, 228, False),
                       ("slime", 150, 262, False)],
            "hero": ("hero_living", 336, 300, False),
            "hp": {"wolf_alpha": 0.7, "wolf": 0.45, "slime": 0.9},
            "loot": (258, 384, 2, "[Picareta do Capataz (Raro)]", (250, 204, 21)),
            "ambient": (0.60, 0.52, 0.43),
            "hero_light": (0.5, 0.45, 0.36, 220),
            "extra_lights": [(238, 334, 170, (1.0, 0.66, 0.30), 0.9)],
            "extra_glows": [(237, 335, 14, (255, 205, 120), 0.6)],
            "hud_title": "Mina Iluminada",
            "hud_objective": "Expulse a matilha · 4 restantes",
            "damage": [("47", 466, 372, False), ("128", 512, 316, True)],
            "telegraph": None,
        }


BIOME = VillageMine
