"""
SUBMUNDO - Bioma `submundo_abyss` (Submundo / Abismo, Ato 1) - BRF-137 / T-072
=================================================================================
Rocha vulcanica escura: piso de basalto em celulas com juntas em brasa, paredes de
colunas basalticas, fissuras de lava, ossos e correntes. Contraste de luz: chamas
espirituais azuis (#38bdf8 / #e0f2fe) nas arandelas de cranio vs. brasas vermelhas.
"""
from __future__ import annotations

import math
import random
from typing import Dict, List, Sequence, Tuple

from under_kit import (
    Biome, Canvas, Frames, RGB, T, bdb, blit, contact_shadow, darken, draw_flame, fill_ellipse, fill_rect,
    hash01, line, mix, outline, overlay_patch, paint_cells, rgba, rock_edge, shade, shaded_blob, sub,
    tile_points, value_noise, free_points,
)

BASALT: Sequence[RGB] = ((28, 23, 28), (32, 26, 31), (25, 21, 26), (36, 29, 33))
BASALT_CRACK: RGB = (8, 6, 8)
EMBER_D: RGB = (92, 22, 10)
EMBER: RGB = (168, 48, 14)
EMBER_L: RGB = (234, 98, 20)
EMBER_Y: RGB = (250, 180, 60)
LAVA_W: RGB = (255, 236, 170)
COL_TONES: Sequence[RGB] = ((46, 37, 44), (52, 42, 49), (41, 33, 40), (57, 46, 52))
ROCK_PAL: Sequence[RGB] = ((26, 20, 25), (44, 35, 42), (64, 52, 58), (88, 72, 76))
IRON_D, IRON, IRON_L = (30, 26, 28), (54, 46, 48), (92, 80, 80)
BONE_D, BONE, BONE_L = bdb.BONE_D, bdb.BONE, bdb.BONE_L
SPIRIT = ((240, 250, 255), (224, 242, 254), (125, 211, 252), (56, 189, 248), (2, 132, 199))
FIRE = (bdb.FLAME_W, bdb.FLAME_Y, bdb.FLAME_AM, bdb.FLAME_OR, bdb.FLAME_RED)


def ember_glyph(cv: Canvas, x: int, y: int, idx: int, bright: bool) -> None:
    g = bdb.RUNE_GLYPHS[idx % 4]
    for ry, row in enumerate(g):
        for rx, bit in enumerate(row):
            if bit == "1":
                cv.put(x + rx, y + ry, rgba(EMBER_L if bright else EMBER_D))
    if bright and g[2][1] == "1":
        cv.put(x + 1, y + 2, rgba(EMBER_Y))


def skull(body: Canvas, cx: float, cy: float, r: float = 4.2) -> None:
    fill_ellipse(body, cx, cy, r, r * 0.86,
                 lambda x, y, nx, ny: rgba(BONE_L if nx < -0.2 and ny < 0 else (BONE if ny < 0.45 else BONE_D)))
    ix, iy = int(cx), int(cy)
    for dx in (-2, -1, 1, 2):
        body.put(ix + dx, iy, rgba((9, 9, 11)))
    body.put(ix, iy + 2, rgba((40, 30, 30)))


class SubmundoAbyss(Biome):
    id = "submundo_abyss"
    title = "Submundo · Abismo"
    subtitle = "Ato 1 · basalto vulcânico, fissuras de lava, ossos e correntes, chamas espirituais azuis vs. brasas"
    side_rim_lo = (44, 32, 37)
    side_rim = (72, 52, 55)
    rim = (96, 64, 61)
    rim_hi = (206, 90, 38)
    rim_lo = (36, 26, 31)
    cap_tones = ((18, 15, 19), (21, 17, 21), (16, 13, 17))
    cap_crack = (6, 4, 6)
    gap_dark = (8, 5, 7)
    shadow_tint = (4, 0, 2)
    torch_flame = (16.0, 9.0)
    torch_light = (0.32, 0.70, 1.0)
    torch_glow = ((200, 240, 255), (40, 150, 240))

    def rim_accent(self, cv: Canvas, edge: str) -> None:
        # brasas ocasionais no aro superior
        if edge == "s":
            for x in (5, 19, 27):
                cv.put(x, 29, rgba(EMBER_D))

    # ------------------------------------------------------------------ piso
    def basalt(self, var: int) -> Canvas:
        cv = Canvas(T, T)
        pts = tile_points(5501, var, BASALT, spacing=8, inner_n=5, margin=10)
        paint_cells(cv, pts, BASALT_CRACK, edge_w=1.0, bevel_w=1.5, hi_f=1.32, lo_f=0.7, speck_seed=5502,
                    speck=0.08, dome=0.16)
        # juntas em brasa (determinadas pela posicao: bordas casam entre variantes)
        for y in range(T):
            for x in range(T):
                if cv.get(x, y)[:3] in (BASALT_CRACK, shade(BASALT_CRACK, 1.35)):
                    n = value_noise(5503, x, y, 8, T, T)
                    if n > 0.8 and hash01(5504, x, y) < 0.7:
                        cv.put(x, y, rgba(EMBER if n > 0.9 else EMBER_D))
        return cv

    def floor(self, name: str) -> Canvas:
        if name in ("floor_0", "floor_1", "floor_2"):
            return self.basalt({"floor_0": 1, "floor_1": 2, "floor_2": 3}[name])
        if name == "floor_cracked":
            cv = self.basalt(4)
            # fissura de lava de canto a canto (encadeia na diagonal)
            pts = [(0, 0), (5, 4), (9, 10), (14, 13), (18, 18), (23, 21), (27, 27), (31, 31)]
            for (a, b), (c, d) in zip(pts, pts[1:]):
                for o, col in ((-3, ROCK_PAL[2]), (-2, EMBER_D), (-1, EMBER), (0, EMBER_L), (1, EMBER_Y),
                               (2, EMBER_L), (3, EMBER_D)):
                    line(cv, a + o, b - o // 2, c + o, d - o // 2, rgba(col))
            for (a, b), (c, d) in zip(pts, pts[1:]):
                line(cv, a, b, c, d, rgba(EMBER_Y))
                line(cv, a + 1, b, c + 1, d, rgba(LAVA_W))
            return cv
        if name == "floor_moss":
            cv = self.basalt(5)

            def pick(d: float, n: float, old) -> RGB:
                c = mix(old[:3], (86, 80, 82), 0.65 if d < 0.6 else 0.35)
                if n > 0.95:
                    return EMBER_L
                if n > 0.8:
                    return (120, 112, 112)
                return c
            overlay_patch(cv, 5511, [(12, 18, 9.0), (22, 11, 6.0)], pick)
            return cv
        cv = self.basalt(6)

        def ichor(d: float, n: float, old) -> RGB:
            if d < 0.6:
                return (40, 6, 10) if n < 0.9 else (90, 16, 20)
            return mix(old[:3], (30, 6, 8), 0.6)
        overlay_patch(cv, 5521, [(15, 17, 8.0), (21, 12, 4.0), (9, 22, 3.5)], ichor)
        for (x, y) in ((24, 24), (25, 23), (6, 8), (7, 8)):
            cv.put(x, y, rgba(BONE))
        return cv

    def cap_base(self, seed: int) -> Canvas:
        cv = Canvas(T, T)
        pts = tile_points(self.cap_seed(), seed, self.cap_tones, spacing=8, inner_n=5, margin=10)
        paint_cells(cv, pts, self.cap_crack, edge_w=0.9, bevel_w=1.2, hi_f=1.28, lo_f=0.8,
                    speck_seed=self.cap_seed() + 5, speck=0.06, dome=0.12)
        return cv

    # ------------------------------------------------------------------ face (colunas basalticas)
    def columns(self) -> Canvas:
        if "cols" in self._cache:
            return self._cache["cols"].copy()
        cv = Canvas(T, 64)
        rng = random.Random(5601)
        for ci in range(4):
            x0 = ci * 8
            tone = COL_TONES[ci % len(COL_TONES)]
            cuts = sorted(rng.sample(range(8, 60), 3))
            for y in range(64):
                for i in range(8):
                    x = x0 + i
                    if i == 0:
                        col = BASALT_CRACK
                    elif i == 1:
                        col = shade(tone, 1.38)
                    elif i == 2:
                        col = shade(tone, 1.15)
                    elif i < 6:
                        col = tone
                    elif i == 6:
                        col = shade(tone, 0.78)
                    else:
                        col = shade(tone, 0.6)
                    if y in cuts:
                        col = BASALT_CRACK
                    elif y - 1 in cuts and 0 < i < 7:
                        col = shade(tone, 1.25)
                    if hash01(5602, x, y) < 0.06:
                        col = shade(col, 0.85)
                    cv.put(x, y, rgba(col))
            # brasa nas juntas verticais
            for y in range(64):
                if value_noise(5603 + ci, 0, y, 8, 8, 64) > 0.7:
                    cv.put(x0, y, rgba(EMBER_D if hash01(5604, ci, y) < 0.7 else EMBER))
        self._cache["cols"] = cv
        return cv.copy()

    def face(self, kind: str) -> Canvas:
        cols = self.columns()
        if kind.startswith("upper"):
            cv = sub(cols, 0, 0)
            # topos escalonados das colunas
            for ci, h in enumerate((0, 3, 1, 4)):
                for y in range(h):
                    for x in range(ci * 8, ci * 8 + 8):
                        cv.put(x, y, rgba((14, 11, 14)))
                for x in range(ci * 8 + 1, ci * 8 + 7):
                    cv.put(x, h, rgba((92, 74, 78)))
            self.overhang(cv)
            if kind == "upper_cracked":
                # lava escorrendo pela parede
                for y in range(4, T):
                    w = 1.5 + 1.2 * math.sin(y * 0.4)
                    cx = 15 + 2 * math.sin(y * 0.19)
                    for x in range(int(cx - w - 2), int(cx + w + 3)):
                        d = abs(x + 0.5 - cx)
                        if d < w * 0.5:
                            col = LAVA_W if y % 7 else EMBER_Y
                        elif d < w:
                            col = EMBER_Y
                        elif d < w + 1:
                            col = EMBER_L
                        elif d < w + 2:
                            col = EMBER_D
                        else:
                            continue
                        cv.put(x, y, rgba(col))
            return cv
        cv = sub(cols, 0, 32)
        if kind == "lower_grate":
            for y in range(6, 27):
                for x in range(8, 24):
                    dx = x + 0.5 - 16
                    if y < 13 and dx * dx + (y - 13) ** 2 > 64:
                        continue
                    edge = (dx * dx + (y - 13) ** 2 > 44 and y < 13) or x in (8, 23)
                    g = max(0.0, 1 - abs(y - 24) / 14)
                    cv.put(x, y, rgba((70, 56, 60) if edge else mix((10, 4, 4), (150, 40, 12), g)))
            for (x, y) in ((12, 23), (15, 24), (19, 23), (17, 22)):
                cv.put(x, y, rgba(EMBER_Y))
            for bx in (11, 14, 17, 20):
                for y in range(7, 26):
                    if cv.get(bx, y)[0] > 5 and not (cv.get(bx, y)[:3] == (70, 56, 60)):
                        cv.put(bx, y, rgba(IRON if y % 4 else IRON_L))
            for x in range(9, 23):
                cv.put(x, 15, rgba(IRON_D))
        # base: entulho de obsidiana + brilho rubro rente ao chao
        for y in range(24, 32):
            for x in range(T):
                if hash01(5611, x, y) < 0.3 + (y - 24) * 0.09:
                    cv.put(x, y, rgba(shade(ROCK_PAL[1], 0.6 + 0.3 * hash01(5612, x, y))))
        for x in range(T):
            cv.put(x, 30, rgba(EMBER_D if value_noise(5613, x, 0, 8, T, 8) > 0.55 else (16, 10, 12)))
            cv.put(x, 31, rgba((8, 5, 7)))
        for (x, y) in ((5, 27), (21, 26)):
            cv.put(x, y, rgba(BONE))
            cv.put(x + 1, y, rgba(BONE_D))
        return cv

    def face_end(self, kind: str, sides: str) -> Canvas:
        cv = self.face(kind).copy()
        for side in sides:
            rock_edge(cv, side, 5620 + (1 if side == "r" else 0) + (5 if kind == "upper" else 0),
                      (8, 6, 8), (104, 82, 84), (62, 50, 56), 3, 2)
        if kind == "upper":
            for y, f in enumerate((0.45, 0.6, 0.75, 0.88)):
                for x in range(T):
                    darken(cv, x, y, f)
        return cv

    def jamb(self, cv: Canvas, x0: int, x1: int, y0: int, y1: int, rng: random.Random) -> None:
        cols = self.columns()
        for y in range(y0, y1):
            for x in range(x0, x1):
                c = cols.get(x % T, 40 + (y - y0))[:3]
                if y == y0:
                    c = (92, 74, 78)
                elif y == y1 - 1:
                    c = (8, 5, 7)
                cv.put(x, y, rgba(c))

    def mark(self, cv: Canvas, x: int, y: int, idx: int, bright: bool) -> None:
        ember_glyph(cv, x, y, idx, bright)

    def sill_h(self, cv: Canvas, x0: int, x1: int, y: int) -> None:
        for x in range(x0, x1):
            cv.put(x, y, rgba((92, 74, 78)))
            cv.put(x, y + 1, rgba(EMBER if x % 3 else EMBER_L))
            cv.put(x, y + 2, rgba((8, 5, 7)))

    def sill_v(self, cv: Canvas, x: int, y0: int, y1: int, east: bool) -> None:
        for y in range(y0, y1):
            cv.put(x, y, rgba(EMBER if y % 3 else EMBER_L))
            cv.put(x + (1 if east else -1), y, rgba((8, 5, 7)))

    # ------------------------------------------------------------------ porta (arco ogival de obsidiana)
    def door_open(self, x: int, y: int) -> bool:
        px, py = x + 0.5, y + 0.5
        if py >= 26:
            return abs(px - 31.5) < 12
        return math.hypot(px - 24.5, py - 26) < 19 and math.hypot(px - 38.5, py - 26) < 19

    def in_frame(self, x: int, y: int) -> bool:
        px, py = x + 0.5, y + 0.5
        if py >= 26:
            return abs(px - 31.5) < 19
        return math.hypot(px - 24.5, py - 26) < 26 and math.hypot(px - 38.5, py - 26) < 26

    def door_big(self) -> Canvas:
        if "door" in self._cache:
            return self._cache["door"]
        cv = Canvas(64, 64)
        for i in (0, 32):
            blit(cv, self.face("upper"), i, 0)
            blit(cv, self.face("lower"), i, 32)
        obs = ((22, 17, 24), (34, 26, 36), (50, 40, 52), (78, 64, 80))
        for y in range(64):
            for x in range(64):
                if self.door_open(x, y):
                    t = min(1.0, max(0.0, (y - 8) / 56))
                    col = mix((4, 2, 4), (70, 14, 8), t ** 1.6)
                    if (y - 40) % 8 == 0 and y > 36 and abs(x - 31.5) < 11:
                        col = mix(col, (130, 40, 14), 0.5)
                    cv.put(x, y, rgba(col))
                elif self.in_frame(x, y):
                    edge_in = self.door_open(x + 1, y) or self.door_open(x - 1, y) or self.door_open(x, y + 1) or self.door_open(x, y - 1)
                    edge_out = not (self.in_frame(x + 1, y) and self.in_frame(x - 1, y) and self.in_frame(x, y - 1))
                    if edge_out:
                        col = (8, 5, 8)
                    elif edge_in:
                        col = obs[3] if x < 32 else obs[2]
                    else:
                        side = -1 if x < 32 else 1
                        col = obs[2] if side < 0 else obs[1]
                        if (y + (x // 4)) % 9 == 0:
                            col = (10, 7, 10)
                        if hash01(5701, x, y) < 0.08:
                            col = obs[0]
                    cv.put(x, y, rgba(col))
        # veios de brasa no arco
        for pts in (((14, 60), (15, 48), (13, 38), (16, 28), (20, 18)), ((49, 60), (48, 50), (50, 40), (47, 30), (42, 18))):
            for (a, b), (c, d) in zip(pts, pts[1:]):
                line(cv, a, b, c, d, rgba(EMBER))
            for (a, b) in pts[1:-1]:
                cv.put(a, b, rgba(EMBER_Y))
        # chifres/espigoes no topo e cranio na chave
        for (bx, dirx) in ((22, -1), (41, 1)):
            for i in range(9):
                cv.put(bx + dirx * (i // 2), 7 - i // 1 + 2, rgba(obs[3] if i < 4 else obs[2]))
                cv.put(bx + dirx * (i // 2) + 1, 7 - i + 2, rgba(obs[1]))
        body = Canvas(64, 64)
        skull(body, 31.5, 6.5, 4.0)
        blit(cv, outline(body), 0, 0)
        cv.put(30, 6, rgba(EMBER_L))
        cv.put(33, 6, rgba(EMBER_L))
        for i, gy in enumerate((34, 44)):
            ember_glyph(cv, 15, gy, i, True)
            ember_glyph(cv, 46, gy, i + 2, True)
        self._cache["door"] = cv
        return cv

    def threshold(self) -> Canvas:
        cv = Canvas(64, T)
        blit(cv, self.floor("floor_0"), 0, 0)
        blit(cv, self.floor("floor_2"), 32, 0)
        for y in range(0, 18):
            for x in range(12, 52):
                if y < 3:
                    col = (40, 8, 6) if 20 <= x <= 43 else (12, 8, 10)
                elif y == 3:
                    col = (92, 74, 78)
                elif y == 17 or x in (12, 51):
                    col = (8, 5, 7)
                else:
                    col = (34, 27, 34) if hash01(5711, x, y) > 0.1 else (28, 22, 28)
                    if x == 13 or y == 4:
                        col = (56, 45, 56)
                cv.put(x, y, rgba(col))
        for x in range(15, 49):
            cv.put(x, 10, rgba(EMBER_L if x % 4 else EMBER_Y))
            cv.put(x, 11, rgba(EMBER_D))
        body = Canvas(64, T)
        skull(body, 9, 24, 3.4)
        skull(body, 56, 22, 3.0)
        blit(cv, outline(body), 0, 0)
        return cv

    # ------------------------------------------------------------------ props
    def spirit_sconce(self, frame: int) -> Canvas:
        body = Canvas(T, T)
        fill_rect(body, 13, 22, 6, 8, rgba(IRON))
        fill_rect(body, 14, 23, 1, 6, rgba(IRON_L))
        fill_rect(body, 15, 19, 2, 4, rgba(IRON_D))
        # cranio-taca
        fill_ellipse(body, 16, 15, 5.2, 4.4, lambda x, y, nx, ny: rgba(BONE_L if nx < -0.2 and ny < 0 else (BONE if ny < 0.5 else BONE_D)))
        for x in (13, 14, 18, 19):
            body.put(x, 16, rgba((9, 9, 11)))
        body.put(16, 18, rgba((40, 30, 30)))
        cv = outline(body)
        draw_flame(cv, 16, 11, frame, SPIRIT, height=(11, 9, 12, 10), width=(4.4, 5.0, 4.0, 4.8),
                   ember_cols=((224, 242, 254), (125, 211, 252)))
        for (x, y) in ((14, 16), (18, 16)):
            cv.put(x, y, rgba((56, 189, 248)))
        return cv

    def ember_vent(self) -> Canvas:
        cv = Canvas(T, T)
        body = Canvas(T, T)
        shaded_blob(body, 16, 20, 11, 6.5, ROCK_PAL)
        blit(cv, outline(body, (6, 4, 6, 255)), 0, 0)
        for y in range(T):
            for x in range(T):
                d = math.hypot((x + 0.5 - 16) / 6.5, (y + 0.5 - 20) / 3.2) - 0.15 * hash01(5721, x, y)
                if d < 1:
                    col = LAVA_W if d < 0.3 else (EMBER_Y if d < 0.55 else (EMBER_L if d < 0.8 else EMBER))
                    cv.put(x, y, rgba(col))
        for (x, y) in ((14, 19), (18, 21), (12, 20)):
            cv.put(x, y, rgba((60, 20, 12)))  # crosta
        for (x, y) in ((12, 10), (19, 7), (16, 4)):
            cv.put(x, y, rgba(EMBER_L))
        return cv

    def bone_pile(self) -> Canvas:
        cv = bdb.prop_bones()
        body = Canvas(T, T)
        skull(body, 22, 23, 3.6)
        blit(cv, outline(body), 0, 0)
        return cv

    def skull_pile(self) -> Canvas:
        body = Canvas(T, T)
        for (cx, cy) in ((9.5, 25), (16, 26), (22.5, 25), (12.5, 20), (19.5, 20), (16, 15)):
            skull(body, cx, cy, 3.9)
        cv = outline(body)
        contact_shadow(cv, 5, 28, 29, 110)
        return cv

    def chain(self) -> Canvas:
        cv = bdb.prop_chain()
        for y in range(T):
            for x in range(T):
                c = cv.get(x, y)
                if c[3] and c[:3] != bdb.OUT[:3]:
                    cv.put(x, y, rgba(mix(c[:3], (110, 50, 34), 0.35)))
        return cv

    def obsidian_shards(self) -> Canvas:
        body = Canvas(T, T)
        obs = ((14, 10, 18), (34, 26, 40), (62, 50, 72), (120, 104, 140))
        for (x, base, h, w, lean) in ((10, 27, 10, 4, -2), (16, 28, 14, 5, 1), (22, 27, 8, 4, 3), (13, 29, 5, 3, 0)):
            for i in range(h):
                t = i / h
                half = w / 2 * (1 - t) + 0.4
                cx = x + lean * t
                for xx in range(int(cx - half), int(math.ceil(cx + half))):
                    rel = (xx + 0.5 - (cx - half)) / (2 * half)
                    body.put(xx, base - i, rgba(obs[3] if rel < 0.25 else (obs[2] if rel < 0.55 else obs[1])))
        cv = outline(body, (4, 2, 6, 255))
        contact_shadow(cv, 6, 27, 30, 100)
        return cv

    def ember_brazier(self) -> Canvas:
        body = Canvas(T, T)
        for (a, b) in ((9, 29), (23, 29), (16, 30)):
            line(body, 16, 22, a, b, rgba(IRON))
        for y in range(15, 22):
            w = 10 - (y - 15)
            for x in range(16 - w, 16 + w):
                body.put(x, y, rgba(IRON_L if y == 15 else (IRON if x < 18 else IRON_D)))
        cv = outline(body)
        for (cx, cy, r) in ((11, 13, 3), (16, 12, 3.5), (21, 13, 3), (14, 14, 2.2), (19, 14, 2.2)):
            fill_ellipse(cv, cx, cy, r, r * 0.6, lambda x, y, nx, ny: rgba(EMBER_Y if nx + ny < -0.6 else (EMBER_L if ny < 0.2 else EMBER)))
        for (x, y) in ((13, 8), (18, 6), (16, 9), (20, 9)):
            cv.put(x, y, rgba(EMBER_L if (x + y) % 2 else EMBER_Y))
        return cv

    def ribcage(self) -> Canvas:
        body = Canvas(T, T)
        line(body, 3, 22, 28, 20, rgba(BONE))
        line(body, 3, 23, 28, 21, rgba(BONE_D))
        for i, x in enumerate(range(6, 27, 4)):
            h = 9 + (2 if i in (2, 3) else 0)
            for t in range(h):
                xx = x + int(2.5 * math.sin(t / h * math.pi))
                body.put(xx, 21 - t, rgba(BONE_L if t < 3 else BONE))
                body.put(xx + 1, 21 - t, rgba(BONE_D))
        cv = outline(body)
        contact_shadow(cv, 3, 29, 24, 100)
        return cv

    def spikes(self) -> Canvas:
        body = Canvas(T, T)
        for (x, base, h) in ((7, 27, 9), (13, 25, 12), (19, 27, 10), (25, 26, 8), (10, 30, 6), (22, 30, 6)):
            for i in range(h):
                half = int((h - i) / h * 2.2)
                for dx in range(-half, half + 1):
                    body.put(x + dx, base - i, rgba(IRON_L if dx < 0 else (IRON if dx == 0 else IRON_D)))
            body.put(x, base - h + 1, rgba((150, 60, 50)))
        cv = outline(body)
        return cv

    def soul_candle(self) -> Canvas:
        body = Canvas(T, T)
        skull(body, 16, 24, 5.0)
        fill_rect(body, 15, 16, 3, 5, rgba((200, 196, 186)))
        fill_rect(body, 17, 16, 1, 5, rgba((150, 146, 136)))
        cv = outline(body)
        for (x, y, c) in ((16, 15, SPIRIT[3]), (16, 14, SPIRIT[1]), (16, 13, SPIRIT[0]), (17, 14, SPIRIT[3]),
                          (15, 14, SPIRIT[4]), (16, 12, SPIRIT[2])):
            cv.put(x, y, rgba(c))
        return cv

    def ash_pile(self) -> Canvas:
        body = Canvas(T, T)
        ash = ((58, 52, 54), (84, 78, 80), (112, 106, 106), (140, 134, 132))
        shaded_blob(body, 14, 24, 9, 4.5, ash)
        shaded_blob(body, 22, 26, 5, 2.8, ash)
        cv = outline(body, (12, 10, 12, 255))
        for (x, y) in ((12, 22), (18, 25), (22, 25), (9, 25)):
            cv.put(x, y, rgba(EMBER_L if (x + y) % 2 else EMBER))
        return cv

    def props(self) -> Frames:
        return [
            ("torch_0", self.spirit_sconce(0)),
            ("torch_1", self.spirit_sconce(1)),
            ("torch_2", self.spirit_sconce(2)),
            ("torch_3", self.spirit_sconce(3)),
            ("ember_vent", self.ember_vent()),
            ("bone_pile", self.bone_pile()),
            ("skull_pile", self.skull_pile()),
            ("chain", self.chain()),
            ("obsidian_shards", self.obsidian_shards()),
            ("ember_brazier", self.ember_brazier()),
            ("ribcage", self.ribcage()),
            ("spikes", self.spikes()),
            ("soul_candle", self.soul_candle()),
            ("ash_pile", self.ash_pile()),
        ]

    # ------------------------------------------------------------------ altos
    def spire(self) -> Canvas:
        body = Canvas(T, 64)
        for (x, h, w, lean) in ((16, 52, 7.5, 2), (9, 28, 4.0, -2), (23, 34, 4.5, 3)):
            for i in range(h):
                t = i / h
                half = w * (1 - t) ** 0.85 + 0.5
                cx = x + lean * t + 0.8 * math.sin(i * 0.3)
                for xx in range(int(cx - half), int(math.ceil(cx + half))):
                    rel = (xx + 0.5 - (cx - half)) / (2 * half)
                    col = ROCK_PAL[3] if rel < 0.25 else (ROCK_PAL[2] if rel < 0.55 else ROCK_PAL[1])
                    body.put(xx, 60 - i, rgba(col))
        cv = Canvas(T, 64)
        contact_shadow(cv, 3, 30, 61, 120)
        blit(cv, outline(body, (6, 4, 6, 255)), 0, 0)
        pts = [(15, 58), (16, 48), (15, 40), (17, 30), (16, 22), (18, 14)]
        for (a, b), (c, d) in zip(pts, pts[1:]):
            line(cv, a, b, c, d, rgba(EMBER))
        for (a, b) in pts[1:]:
            cv.put(a, b, rgba(EMBER_Y))
        return cv

    def chained_pillar(self) -> Canvas:
        body = Canvas(T, 64)
        for y in range(6, 60):
            for x in range(8, 24):
                i = x - 8
                tone = COL_TONES[(i // 4) % 4]
                col = shade(tone, 1.3 - 0.04 * i)
                if i % 4 == 0:
                    col = BASALT_CRACK
                if (y + i * 3) % 17 == 0:
                    col = BASALT_CRACK
                body.put(x, y, rgba(col))
        for x in range(8, 24):
            body.put(x, 6, rgba((92, 74, 78)))
        cv = Canvas(T, 64)
        contact_shadow(cv, 4, 28, 61, 120)
        blit(cv, outline(body, (6, 4, 6, 255)), 0, 0)
        # correntes cruzadas e grilhao
        for (a, b, c, d) in ((6, 18, 26, 34), (26, 20, 6, 38)):
            n = int(math.hypot(c - a, d - b))
            for k in range(n):
                t = k / n
                x, y = int(a + (c - a) * t), int(b + (d - b) * t)
                cv.put(x, y, rgba(IRON_L if k % 3 == 0 else (IRON if k % 3 == 1 else IRON_D)))
                cv.put(x, y + 1, rgba((8, 6, 8)))
        for ang in range(0, 300, 12):
            a = math.radians(ang + 120)
            cv.put(int(round(16 + 4 * math.cos(a))), int(round(46 + 3 * math.sin(a))), rgba(IRON_L))
        for y in range(38, 44):
            cv.put(16, y, rgba(IRON))
        ember_glyph(cv, 14, 24, 1, True)
        return cv

    def bone_totem(self) -> Canvas:
        body = Canvas(T, 64)
        for y in range(10, 60):
            body.put(15, y, rgba(BONE_D))
            body.put(16, y, rgba(BONE))
        for (cy, r) in ((52, 4.4), (42, 4.2), (32, 4.0), (22, 3.8)):
            skull(body, 16, cy, r)
        for (a, b) in ((9, 27), (23, 27)):
            line(body, 16, 25, a, b - 6, rgba(BONE_L))
        cv = Canvas(T, 64)
        contact_shadow(cv, 8, 25, 61, 120)
        blit(cv, outline(body), 0, 0)
        draw_flame(cv, 16, 14, 1, SPIRIT, height=(11, 10, 12, 11), width=(4.0, 4.6, 3.8, 4.4),
                   ember_cols=((224, 242, 254), (125, 211, 252)))
        for cy in (52, 42, 32, 22):
            cv.put(14, cy, rgba(SPIRIT[3]))
            cv.put(18, cy, rgba(SPIRIT[3]))
        return cv

    def brazier_tall(self) -> Canvas:
        body = Canvas(T, 64)
        for y in range(30, 58):
            body.put(15, y, rgba(IRON_L))
            body.put(16, y, rgba(IRON))
            body.put(17, y, rgba(IRON_D))
        for (a, b) in ((8, 60), (24, 60)):
            line(body, 16, 50, a, b, rgba(IRON))
        for y in range(22, 31):
            w = 11 - (y - 22)
            for x in range(16 - w, 17 + w):
                body.put(x, y, rgba(IRON_L if y == 22 else (IRON if x < 18 else IRON_D)))
        for x in range(5, 28, 4):
            body.put(x, 21, rgba(IRON_L))
            body.put(x, 20, rgba(IRON))
        cv = Canvas(T, 64)
        contact_shadow(cv, 6, 27, 61, 120)
        blit(cv, outline(body), 0, 0)
        draw_flame(cv, 16, 21, 2, FIRE, height=(16, 14, 17, 15), width=(7.0, 7.6, 6.6, 7.2))
        draw_flame(cv, 11, 21, 0, FIRE, height=(9, 8, 10, 9), width=(3.6, 4.0, 3.4, 3.8), embers=False)
        draw_flame(cv, 21, 21, 3, FIRE, height=(9, 8, 10, 9), width=(3.6, 4.0, 3.4, 3.8), embers=False)
        return cv

    def props_tall(self) -> Frames:
        return [("obsidian_spire", self.spire()), ("chained_pillar", self.chained_pillar()),
                ("bone_totem", self.bone_totem()), ("brazier_tall", self.brazier_tall())]

    # ------------------------------------------------------------------ mockup
    MAP = [
        "#########.......##########",
        "#########.......##########",
        "#########..###############",
        "#########LL###############",
        "#########nn###############",
        "#########nn###############",
        "###................#######",
        "###................#######",
        "###....................###",
        "###....................###",
        "###....................###",
        "###....................###",
        "######.................###",
        "######.................###",
        "######.................###",
        "##########################",
    ]
    LAVA = ((5, 8), (6, 9), (7, 10), (8, 11), (9, 12), (10, 13), (17, 9), (18, 10), (19, 11), (20, 12))

    def scene(self) -> Dict[str, object]:
        P = 32
        lava_lights = [(c * P + 16, r * P + 16, 95, (1.0, 0.36, 0.10), 0.85) for (c, r) in self.LAVA]
        return {
            "map": self.MAP,
            "view": (60.0, 22.0),
            "void": (5, 3, 5, 255),
            "overrides": {cell: "floor_cracked" for cell in self.LAVA},
            "torch_radius": 190,
            "torch_power": 1.05,
            "decals": [],
            "wall_props": [("torch_0", 5 * P, 4 * P + 2), ("torch_2", 13 * P, 4 * P + 2),
                           ("torch_1", 20 * P + 16, 6 * P + 2), ("torch_3", 13 * P, 0), ("chain", 7 * P, 4 * P + 4), ("chain", 16 * P, 4 * P + 4)],
            "floor_props": [("skull_pile", 3 * P + 6, 6 * P + 6), ("ember_vent", 15 * P, 12 * P + 10),
                            ("bone_pile", 12 * P, 7 * P), ("ribcage", 17 * P + 10, 13 * P + 8),
                            ("obsidian_shards", 4 * P, 10 * P + 20), ("soul_candle", 9 * P + 20, 6 * P + 6),
                            ("ember_brazier", 21 * P, 9 * P + 2), ("spikes", 22 * P, 12 * P), ("ash_pile", 14 * P, 10 * P),
                            ("soul_candle", 12 * P, 0 * P + 14), ("bone_pile", 14 * P, 0 * P + 10),
                            ("soul_candle", 22 * P + 4, 8 * P + 4)],
            "tall_props": [("obsidian_spire", 3 * P + 4, 7 * P + 14), ("chained_pillar", 15 * P + 8, 4 * P + 30),
                           ("bone_totem", 7 * P + 14, 4 * P + 32), ("brazier_tall", 19 * P - 6, 4 * P + 30),
                           ("obsidian_spire", 22 * P, 10 * P + 10)],
            "actors": [("skeleton_archer", 520, 214, True), ("skeleton", 470, 330, True), ("cave_bat", 250, 200, False),
                       ("slime", 290, 246, False)],
            "hero": ("hero_wraith", 352, 290, False),
            "hp": {"skeleton_archer": 0.9, "skeleton": 0.4, "cave_bat": 1.0, "slime": 0.7},
            "loot": (320, 352, 3, "[Lâmina Ceifadora (Lendário)]", (249, 115, 22)),
            "ambient": (0.30, 0.21, 0.26),
            "hero_light": (0.30, 0.55, 0.80, 210),
            "extra_lights": lava_lights + [(15 * P + 16, 12 * P + 22, 110, (1.0, 0.4, 0.1), 1.0),
                                           (21 * P + 16, 9 * P + 14, 130, (1.0, 0.45, 0.12), 0.9),
                                           (19 * P + 10, 5 * P + 22, 170, (1.0, 0.45, 0.12), 0.95),
                                           (7 * P + 30, 4 * P + 40, 120, (0.3, 0.7, 1.0), 0.7),
                                           (10 * P, 5 * P + 20, 90, (1.0, 0.3, 0.1), 0.6),
                                           (12 * P + 16, 1 * P + 8, 150, (0.3, 0.7, 1.0), 0.8)],
            "extra_glows": [(12 * P + 16, 0 * P + 26, 12, (150, 220, 255), 0.6), (19 * P + 10, 5 * P + 12, 28, (255, 150, 60), 0.5), (7 * P + 30, 4 * P + 44, 18, (150, 220, 255), 0.55),
                            (21 * P + 16, 9 * P + 14, 16, (255, 160, 60), 0.45)],
            "hud_title": "Submundo · Abismo",
            "hud_objective": "Purgue o abismo · 4 restantes",
            "damage": [("61", 470, 330, False), ("187", 250, 200, True)],
            "telegraph": ((506, 208), (358, 282)),
        }


BIOME = SubmundoAbyss
