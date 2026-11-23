"""
SUBMUNDO - Bioma `mine_depths` (Fundo da Mina, Missao 3) - BRF-137 / T-072
=============================================================================
Caverna de rocha natural e pouco iluminada: lajes irregulares frias, paredes de rocha
bruta com estalactites, cristais tenues verde-agua como unica luz, vigas quebradas e
restos da mina abandonada, morcegos e esqueletos.
"""
from __future__ import annotations

import math
import random
from typing import Dict, List, Sequence, Tuple

from under_kit import (
    Biome, Canvas, Frames, RGB, T, bdb, blit, contact_shadow, darken, fill_ellipse, fill_rect, free_points,
    hash01, line, mix, outline, overlay_blood, overlay_patch, paint_cells, rgba, rock_edge, shade, shaded_blob,
    sub, tile_points, value_noise, wrap_crack,
)

WOOD_D, WOOD, WOOD_L, WOOD_H = (34, 22, 14), (66, 44, 28), (88, 60, 38), (108, 76, 50)  # madeira podre
IRON_D, IRON, IRON_L = (34, 34, 38), (56, 56, 62), (92, 92, 100)
CRY_D: RGB = (22, 92, 96)
CRY: RGB = (64, 178, 172)
CRY_L: RGB = (132, 230, 214)
CRY_H: RGB = (224, 255, 246)
FLOOR_TONES: Sequence[RGB] = ((37, 40, 48), (42, 45, 54), (34, 37, 45), (47, 50, 59))
FLOOR_CRACK: RGB = (10, 11, 14)
FACE_TONES: Sequence[RGB] = ((45, 47, 58), (51, 53, 65), (40, 42, 52), (57, 59, 72))
FACE_CRACK: RGB = (13, 14, 18)
ROCK_PAL: Sequence[RGB] = ((30, 31, 39), (46, 48, 59), (62, 65, 79), (84, 88, 104))
BONE_D, BONE, BONE_L = bdb.BONE_D, bdb.BONE, bdb.BONE_L


def crystal(body: Canvas, x: int, base_y: int, h: int, w: int, lean: int, glow: float) -> None:
    """Prisma de cristal com faceta clara a esquerda e ponta."""
    for i in range(h):
        y = base_y - i
        t = i / max(1, h - 1)
        cx = x + lean * t
        half = w / 2 if t < 0.72 else w / 2 * (1 - (t - 0.72) / 0.28)
        for xx in range(int(cx - half), int(math.ceil(cx + half))):
            rel = (xx + 0.5 - (cx - half)) / max(0.5, 2 * half)
            if rel < 0.34:
                col = mix(CRY_L, CRY_H, glow * 0.6)
            elif rel < 0.7:
                col = mix(CRY, CRY_L, glow * 0.5)
            else:
                col = mix(CRY_D, CRY, glow * 0.4)
            body.put(xx, y, rgba(col))
    body.put(int(x + lean), base_y - h + 1, rgba(CRY_H))


class MineDepths(Biome):
    id = "mine_depths"
    title = "Fundo da Mina"
    subtitle = "Missão 3 · caverna natural escura, estalactites, cristais tênues, vigas quebradas"
    side_rim_lo = (36, 39, 49)
    side_rim = (60, 66, 80)
    rim = (76, 84, 100)
    rim_hi = (108, 122, 142)
    rim_lo = (30, 33, 42)
    cap_tones = ((16, 17, 22), (18, 19, 25), (14, 15, 20))
    cap_crack = (7, 7, 10)
    gap_dark = (8, 8, 11)
    shadow_tint = (0, 1, 6)
    torch_flame = (16.0, 17.0)
    torch_light = (0.40, 0.95, 0.88)
    torch_glow = ((150, 255, 230), (40, 160, 150))

    # ------------------------------------------------------------------ piso
    def base_floor(self, var: int) -> Canvas:
        cv = Canvas(T, T)
        pts = tile_points(8801, var, FLOOR_TONES, spacing=10, inner_n=3, margin=11)
        paint_cells(cv, pts, FLOOR_CRACK, edge_w=1.1, bevel_w=1.7, hi_f=1.26, lo_f=0.72, speck_seed=8802,
                    speck=0.1, dome=0.2)
        return cv

    def pebbles(self, cv: Canvas, seed: int, n: int) -> None:
        rng = random.Random(seed)
        for _ in range(n):
            x, y = rng.randint(3, T - 4), rng.randint(3, T - 4)
            cv.put(x, y, rgba(ROCK_PAL[2]))
            cv.put(x + 1, y, rgba(ROCK_PAL[1]))
            cv.put(x, y + 1, rgba(FLOOR_CRACK))

    def floor(self, name: str) -> Canvas:
        if name == "floor_0":
            cv = self.base_floor(1)
            self.pebbles(cv, 11, 4)
        elif name == "floor_1":
            cv = self.base_floor(2)
            self.pebbles(cv, 12, 6)
        elif name == "floor_2":
            cv = self.base_floor(3)
            self.pebbles(cv, 13, 3)
        elif name == "floor_cracked":
            cv = self.base_floor(4)
            # fenda funda
            pts = [(6, 3), (10, 8), (12, 13), (17, 17), (19, 22), (24, 27), (26, 30)]
            for (a, b), (c, d) in zip(pts, pts[1:]):
                for o in (-1, 0, 1):
                    line(cv, a + o, b, c + o, d, rgba((4, 4, 6)))
                line(cv, a - 2, b, c - 2, d, rgba(ROCK_PAL[2]))
                line(cv, a + 2, b, c + 2, d, rgba(ROCK_PAL[0]))
            wrap_crack(cv, 41, 22, 5, 7, 1, FLOOR_CRACK, ROCK_PAL[1], False)
        elif name == "floor_moss":
            cv = self.base_floor(5)

            def pick(d: float, n: float, old) -> RGB:
                # poca rasa refletindo o cristal
                if d < 0.55:
                    return (14, 30, 36) if n < 0.85 else (40, 96, 98)
                return mix(old[:3], (18, 26, 30), 0.5)
            overlay_patch(cv, 51, [(14, 18, 8.0), (21, 13, 5.0)], pick)
            for (x, y) in ((10, 16), (11, 16), (17, 20), (19, 12)):
                cv.put(x, y, rgba((96, 190, 184)))
        else:
            cv = self.base_floor(6)
            overlay_blood(cv, 61, (36, 9, 11), (54, 12, 15), (76, 20, 22))
        return cv

    # ------------------------------------------------------------------ face
    def rock_slab(self) -> Canvas:
        if "slab" not in self._cache:
            cv = Canvas(T, 64)
            pts = free_points(8811, 10, T, 64, FACE_TONES)
            paint_cells(cv, pts, FACE_CRACK, wrap_x=True, wrap_y=False, aniso=1.15, edge_w=1.0, bevel_w=2.0,
                        hi_f=1.3, lo_f=0.7, speck_seed=8812, speck=0.1, dome=0.28)
            # estratos horizontais sutis
            for y in range(64):
                f = 0.92 + 0.1 * value_noise(8813, 0, y, 8, 8, 64)
                for x in range(T):
                    darken(cv, x, y, f)
            self._cache["slab"] = cv
        return self._cache["slab"].copy()

    def drips(self, cv: Canvas) -> None:
        """Estalactites pequenas pendendo do teto (topo da face superior)."""
        for (x, ln) in ((3, 7), (9, 4), (14, 9), (21, 5), (27, 8)):
            for i in range(ln):
                half = max(0, int((ln - i) / ln * 2.2))
                for dx in range(-half, half + 1):
                    col = ROCK_PAL[2] if dx < 0 else (ROCK_PAL[1] if dx == 0 else ROCK_PAL[0])
                    cv.put(x + dx, i, rgba(col))
            cv.put(x, ln, rgba((70, 110, 120)))  # gota

    def face(self, kind: str) -> Canvas:
        slab = self.rock_slab()
        if kind.startswith("upper"):
            cv = sub(slab, 0, 0)
            self.overhang(cv)
            self.drips(cv)
            if kind == "upper_cracked":
                pts = [(2, 30), (7, 24), (11, 22), (15, 17), (20, 15), (26, 10), (30, 9)]
                for (a, b), (c, d) in zip(pts, pts[1:]):
                    line(cv, a, b, c, d, rgba(CRY_D))
                    line(cv, a, b + 1, c, d + 1, rgba((8, 22, 26)))
                body = Canvas(T, T)
                crystal(body, 12, 24, 7, 3, -1, 0.5)
                crystal(body, 15, 23, 9, 3, 1, 0.8)
                crystal(body, 18, 24, 5, 2, 2, 0.4)
                crystal(body, 25, 13, 5, 2, 1, 0.5)
                blit(cv, outline(body, (6, 14, 16, 255)), 0, 0)
            return cv
        cv = sub(slab, 0, 32)
        if kind == "lower_grate":
            # toca/galeria desmoronada com restos de tabua
            for y in range(6, 30):
                for x in range(5, 27):
                    nx, ny = (x + 0.5 - 16) / 10.5, (y + 0.5 - 22) / 14
                    d = nx * nx + ny * ny
                    if d < 1 and y < 29:
                        cv.put(x, y, rgba(mix((3, 3, 5), (14, 15, 19), max(0.0, (y - 8) / 22))))
                    elif d < 1.22 and ny < 0.5:
                        cv.put(x, y, rgba(ROCK_PAL[3] if nx < 0 and ny < -0.3 else ROCK_PAL[1]))
            for o in range(3):
                line(cv, 7, 14 + o, 14, 27 + o, rgba(WOOD_L if o == 0 else (WOOD if o == 1 else WOOD_D)))
            for (x, y) in ((19, 20), (20, 20), (21, 21)):
                cv.put(x, y, rgba((180, 170, 150)))  # osso esquecido na toca
        # talude de cascalho na base
        rng = random.Random(8821)
        for y in range(25, 32):
            for x in range(T):
                if hash01(8822, x, y) < 0.35 + (y - 25) * 0.08:
                    cv.put(x, y, rgba(shade(FACE_TONES[2], 0.62 + 0.1 * hash01(8823, x, y))))
        for _ in range(9):
            x, y = rng.randint(1, T - 3), rng.randint(26, 30)
            cv.put(x, y, rgba(ROCK_PAL[2]))
            cv.put(x + 1, y, rgba(ROCK_PAL[1]))
            cv.put(x, y - 1, rgba(ROCK_PAL[3]))
        for x in range(T):
            cv.put(x, 31, rgba((10, 10, 13)))
        return cv

    def face_end(self, kind: str, sides: str) -> Canvas:
        cv = self.face(kind).copy()
        for side in sides:
            rock_edge(cv, side, 8830 + (1 if side == "r" else 0) + (5 if kind == "upper" else 0),
                      (14, 15, 19), (92, 98, 116), (60, 63, 77), 3, 3)
        if kind == "upper":
            for y, f in enumerate((0.45, 0.6, 0.75, 0.88)):
                for x in range(T):
                    darken(cv, x, y, f)
        return cv

    def jamb(self, cv: Canvas, x0: int, x1: int, y0: int, y1: int, rng: random.Random) -> None:
        slab = self.rock_slab()
        for y in range(y0, y1):
            for x in range(x0, x1):
                c = slab.get(x % T, 36 + (y - y0) * 2)[:3]
                if y == y0:
                    c = self.rim
                elif y == y1 - 1:
                    c = (10, 10, 13)
                cv.put(x, y, rgba(c))

    def mark(self, cv: Canvas, x: int, y: int, idx: int, bright: bool) -> None:
        body = Canvas(T, T)
        crystal(body, 2, 6, 5 if bright else 4, 2, 0, 0.6 if bright else 0.1)
        crystal(body, 4, 6, 3, 2, 1, 0.3 if bright else 0.0)
        o = outline(body, (6, 14, 16, 255))
        blit(cv, o, x - 1, y - 1)

    def sill_h(self, cv: Canvas, x0: int, x1: int, y: int) -> None:
        rng = random.Random(x0 * 7 + y)
        for _ in range(6):
            x = rng.randint(x0, x1 - 2)
            yy = y + rng.randint(-1, 3)
            cv.put(x, yy, rgba(ROCK_PAL[2]))
            cv.put(x + 1, yy, rgba(ROCK_PAL[1]))
            cv.put(x, yy + 1, rgba(FLOOR_CRACK))

    def sill_v(self, cv: Canvas, x: int, y0: int, y1: int, east: bool) -> None:
        rng = random.Random(x * 13 + y0)
        for _ in range(5):
            yy = rng.randint(y0, y1 - 2)
            xx = x + rng.randint(-2, 2)
            cv.put(xx, yy, rgba(ROCK_PAL[2]))
            cv.put(xx, yy + 1, rgba(FLOOR_CRACK))

    # ------------------------------------------------------------------ porta (boca de caverna)
    def door_open(self, x: int, y: int) -> bool:
        dx = x + 0.5 - 31.5
        half = 12.0 + 1.6 * value_noise(8841, 0, y, 8, 8, 64)
        if y >= 24:
            return abs(dx) < half
        return (dx / 12.5) ** 2 + ((y + 0.5 - 24) / 13.5) ** 2 < 1.0

    def door_big(self) -> Canvas:
        if "door" in self._cache:
            return self._cache["door"]
        cv = Canvas(64, 64)
        for i in (0, 32):
            blit(cv, self.face("upper"), i, 0)
            blit(cv, self.face("lower"), i, 32)
        # aro de rocha em volta da boca (luz de cima/esquerda)
        for y in range(64):
            for x in range(64):
                if self.door_open(x, y):
                    continue
                near = [self.door_open(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (2, 0), (-2, 0), (0, 2))]
                if any(near[:4]):
                    cv.put(x, y, rgba((12, 13, 16)))
                elif any(near[4:]):
                    cv.put(x, y, rgba((96, 104, 122) if (x < 31 or y < 18) else (64, 68, 82)))
        for y in range(64):
            for x in range(64):
                if self.door_open(x, y):
                    d = max(0.0, (y - 12) / 52)
                    col = mix((3, 3, 5), (12, 14, 18), d)
                    # brilho tenue de cristais la no fundo
                    g = max(0.0, 1 - math.hypot(x + 0.5 - 35, (y + 0.5 - 44) * 1.6) / 9)
                    col = mix(col, (24, 70, 72), g * 0.7)
                    cv.put(x, y, rgba(col))
        for (x, y) in ((34, 43), (36, 44), (33, 45), (37, 42)):
            cv.put(x, y, rgba(CRY_L if (x + y) % 2 else CRY))
        # vigas quebradas do antigo escoramento
        for (x0, top, bot) in ((12, 30, 64), (46, 41, 64)):
            for y in range(top, bot):
                for x in range(x0, x0 + 6):
                    i = x - x0
                    col = WOOD_D if i in (0, 5) else (WOOD_H if i == 1 else (WOOD_L if i < 3 else WOOD))
                    cv.put(x, y, rgba(col))
            jag = (0, 3, 1, 4, 2, 0)
            for i in range(6):
                for y in range(top, top + jag[i]):
                    cv.put(x0 + i, y, cv.get(x0 + i, y - 8) if y - 8 >= 0 else (0, 0, 0, 0))
                cv.put(x0 + i, top + jag[i], rgba((150, 120, 84)))  # lasca clara
        # verga caida, diagonal
        for o in range(5):
            col = WOOD_H if o == 0 else (WOOD_L if o < 2 else (WOOD if o < 4 else WOOD_D))
            line(cv, 8, 14 + o, 27, 24 + o, rgba(col))
        for (x, y) in ((27, 24), (28, 25), (28, 27)):
            cv.put(x, y, rgba((150, 120, 84)))
        # estalactites sobre a boca
        for (x, ln) in ((24, 6), (29, 10), (35, 7), (40, 4)):
            for i in range(ln):
                yy = 10 + int(3 * math.cos((x - 31.5) / 12)) + i
                half = max(0, int((ln - i) / ln * 2.0))
                for dx in range(-half, half + 1):
                    cv.put(x + dx, yy, rgba(ROCK_PAL[2] if dx < 0 else ROCK_PAL[1]))
        self._cache["door"] = cv
        return cv

    def threshold(self) -> Canvas:
        cv = Canvas(64, T)
        blit(cv, self.floor("floor_0"), 0, 0)
        blit(cv, self.floor("floor_2"), 32, 0)
        for y in range(T):
            for x in range(14, 50):
                f = 0.55 + 0.45 * min(1.0, y / 14)
                darken(cv, x, y, f)
        rng = random.Random(8851)
        body = Canvas(64, T)
        for (cx, cy, rx) in ((16, 6, 3.2), (46, 9, 3.6), (22, 14, 2.2), (41, 20, 2.0), (12, 18, 2.4), (52, 15, 1.8)):
            shaded_blob(body, cx, cy, rx, rx * 0.7, ROCK_PAL)
        blit(cv, outline(body, (8, 8, 11, 255)), 0, 0)
        for _ in range(14):
            x, y = rng.randint(14, 50), rng.randint(2, 28)
            cv.put(x, y, rgba(ROCK_PAL[2]))
        return cv

    # ------------------------------------------------------------------ props
    def crystal_light(self, frame: int) -> Canvas:
        g = (0.55, 0.8, 1.0, 0.75)[frame]
        body = Canvas(T, T)
        shaded_blob(body, 16, 25, 9, 4.5, ROCK_PAL)
        shaded_blob(body, 10, 24, 4, 3, ROCK_PAL)
        crystal(body, 12, 24, 10, 4, -2, g * 0.8)
        crystal(body, 16, 25, 16, 5, 1, g)
        crystal(body, 21, 25, 11, 4, 3, g * 0.85)
        crystal(body, 9, 25, 6, 3, -2, g * 0.6)
        crystal(body, 24, 26, 6, 2, 3, g * 0.5)
        cv = outline(body, (6, 12, 14, 255))
        # cintilacao
        sp = ((16, 12), (13, 16), (20, 17), (17, 14))[frame]
        cv.put(sp[0], sp[1], rgba(CRY_H))
        cv.put(sp[0] - 1, sp[1], rgba(CRY_L))
        cv.put(sp[0] + 1, sp[1], rgba(CRY_L))
        cv.put(sp[0], sp[1] - 1, rgba(CRY_L))
        return cv

    def stalagmite(self, h: int, w: float, seed: int, H: int = T) -> Canvas:
        body = Canvas(T, H)
        base = H - 3
        for i in range(h):
            y = base - i
            t = i / h
            half = w * (1 - t) ** 0.9 + 0.6
            cx = 16 + 1.2 * math.sin(t * 3 + seed)
            for x in range(int(cx - half), int(math.ceil(cx + half))):
                rel = (x + 0.5 - (cx - half)) / (2 * half)
                band = value_noise(seed, 0, y, 4, 4, H) * 0.25
                if rel < 0.3:
                    col = ROCK_PAL[3]
                elif rel < 0.6:
                    col = ROCK_PAL[2]
                else:
                    col = ROCK_PAL[1]
                col = shade(col, 0.88 + band)
                body.put(x, y, rgba(col))
        for (cx, cy, rx) in ((16 - w - 1, base - 1, 2.5), (16 + w + 1, base, 2.2)):
            shaded_blob(body, cx, cy, rx, rx * 0.7, ROCK_PAL)
        cv = Canvas(T, H)
        contact_shadow(cv, int(16 - w - 3), int(16 + w + 4), H - 2, 120)
        blit(cv, outline(body, (8, 8, 11, 255)), 0, 0)
        return cv

    def rocks(self) -> Canvas:
        body = Canvas(T, T)
        for (cx, cy, rx, ry) in ((10, 23, 6, 4.2), (21, 22, 5, 3.6), (15, 27, 4, 2.8), (25, 27, 3, 2), (6, 28, 2.6, 1.8)):
            shaded_blob(body, cx, cy, rx, ry, ROCK_PAL)
        cv = outline(body, (8, 8, 11, 255))
        contact_shadow(cv, 4, 29, 30, 100)
        return cv

    def broken_beam(self) -> Canvas:
        body = Canvas(T, T)
        for o in range(6):
            col = WOOD_H if o == 0 else (WOOD_L if o < 3 else (WOOD if o < 5 else WOOD_D))
            line(body, 3, 14 + o, 26, 22 + o, rgba(col))
        for (x, y) in ((26, 21), (27, 22), (28, 24), (27, 26), (28, 27)):
            body.put(x, y, rgba((150, 120, 84)))
        for (x, y) in ((24, 14), (25, 15), (22, 13)):
            body.put(x, y, rgba(WOOD_L))  # lascas soltas
        body.put(9, 17, rgba(IRON_L))
        cv = outline(body, (8, 6, 5, 255))
        for x in range(4, 28):
            for y in (29,):
                if not cv.get(x, y)[3]:
                    cv.put(x, y, (0, 0, 0, 80))
        return cv

    def miner_remains(self) -> Canvas:
        cv = bdb.prop_bones()
        body = Canvas(T, T)
        # capacete de mineiro com lampada apagada
        fill_ellipse(body, 9, 12, 5, 3.4, lambda x, y, nx, ny: rgba((122, 102, 54) if nx + ny < -0.3 else ((94, 78, 42) if ny < 0.5 else (60, 50, 28))))
        fill_rect(body, 3, 14, 12, 1, rgba((70, 58, 30)))
        fill_rect(body, 8, 9, 3, 2, rgba(IRON_L))
        # picareta cravada
        for o in range(2):
            line(body, 22 + o, 8, 26 + o, 26, rgba(WOOD_L if o == 0 else WOOD_D))
        line(body, 17, 9, 28, 6, rgba(IRON_L))
        line(body, 17, 10, 28, 7, rgba(IRON))
        blit(cv, outline(body, (8, 8, 11, 255)), 0, 0)
        return cv

    def puddle(self) -> Canvas:
        cv = Canvas(T, T)
        for y in range(T):
            for x in range(T):
                d = math.hypot((x + 0.5 - 16) / 12, (y + 0.5 - 21) / 6.5) - 0.12 * hash01(8861, x, y)
                if d < 1:
                    col = (14, 30, 36) if d < 0.82 else (30, 40, 46)
                    if d < 0.82 and abs(y - 18) < 1 and 9 < x < 20:
                        col = (70, 150, 150)
                    if d < 0.82 and abs(y - 22) < 1 and 14 < x < 23:
                        col = (36, 84, 88)
                    cv.put(x, y, rgba(col, 235))
        return cv

    def mushrooms(self) -> Canvas:
        body = Canvas(T, T)
        cap_l, cap, cap_d = (226, 214, 244), (170, 150, 200), (104, 86, 138)
        for (x, y, r, h) in ((10, 22, 4.0, 6), (17, 19, 5.0, 8), (23, 24, 3.0, 4), (14, 26, 2.5, 3)):
            fill_rect(body, x - 1, y, 2, h, rgba((180, 170, 160)))
            fill_rect(body, x, y, 1, h, rgba((130, 122, 116)))
            fill_ellipse(body, x, y, r, r * 0.55, lambda xx, yy, nx, ny: rgba(cap_l if ny < -0.3 and nx < 0.3 else (cap if ny < 0.4 else cap_d)))
        cv = outline(body, (10, 8, 14, 255))
        for (x, y) in ((15, 17), (9, 21), (22, 23)):
            cv.put(x, y, rgba((250, 244, 255)))
        return cv

    def floor_crystals(self) -> Canvas:
        body = Canvas(T, T)
        shaded_blob(body, 15, 26, 6, 2.6, ROCK_PAL)
        crystal(body, 12, 26, 6, 3, -2, 0.3)
        crystal(body, 16, 26, 9, 3, 1, 0.5)
        crystal(body, 20, 27, 5, 2, 2, 0.2)
        cv = outline(body, (6, 12, 14, 255))
        return cv

    def cart_wreck(self) -> Canvas:
        body = Canvas(T, T)
        pal = ((40, 36, 36), (58, 52, 50), (78, 70, 64), (100, 90, 80))
        # carrinho tombado de lado
        for y in range(12, 25):
            for x in range(4, 26):
                sk = (y - 12) // 3
                col = pal[2] if y < 15 else (pal[1] if y < 22 else pal[0])
                if x in (4, 25) or y in (12, 24):
                    col = pal[0]
                if (x - 4) % 7 == 0:
                    col = pal[0]
                body.put(x + sk // 2, y, rgba(col))
        for y in range(13, 24):
            for x in range(25, 29):
                body.put(x, y, rgba((10, 10, 12)))
        fill_ellipse(body, 9, 10, 3, 3, lambda x, y, nx, ny: rgba((22, 22, 24) if nx * nx + ny * ny > 0.45 else IRON_L))
        fill_ellipse(body, 21, 10, 3, 3, lambda x, y, nx, ny: rgba((22, 22, 24) if nx * nx + ny * ny > 0.45 else IRON_L))
        # rodinha solta
        fill_ellipse(body, 26, 28, 2.4, 2.4, lambda x, y, nx, ny: rgba((22, 22, 24) if nx * nx + ny * ny > 0.4 else IRON))
        cv = outline(body, (8, 8, 11, 255))
        contact_shadow(cv, 4, 28, 26, 110)
        return cv

    def dead_lantern(self) -> Canvas:
        body = Canvas(T, T)
        # lanterna caida de lado, vidro quebrado
        fill_rect(body, 9, 20, 13, 7, rgba(IRON))
        fill_rect(body, 9, 20, 13, 1, rgba(IRON_L))
        for x in (9, 14, 21):
            fill_rect(body, x, 20, 1, 7, rgba(IRON_D))
        fill_rect(body, 10, 21, 4, 5, rgba((40, 46, 50)))
        fill_rect(body, 15, 21, 6, 5, rgba((34, 40, 44)))
        body.put(16, 22, rgba((120, 140, 150)))
        fill_rect(body, 22, 21, 2, 5, rgba(IRON_D))
        line(body, 5, 18, 9, 22, rgba(IRON_L))
        for (x, y) in ((7, 27), (11, 28), (25, 26)):
            body.put(x, y, rgba((120, 140, 150)))
        cv = outline(body, (8, 8, 11, 255))
        contact_shadow(cv, 8, 25, 28, 100)
        return cv

    def props(self) -> Frames:
        return [
            ("torch_0", self.crystal_light(0)),
            ("torch_1", self.crystal_light(1)),
            ("torch_2", self.crystal_light(2)),
            ("torch_3", self.crystal_light(3)),
            ("stalagmite_small", self.stalagmite(16, 4.5, 3)),
            ("rocks", self.rocks()),
            ("broken_beam", self.broken_beam()),
            ("miner_remains", self.miner_remains()),
            ("puddle", self.puddle()),
            ("glow_mushrooms", self.mushrooms()),
            ("floor_crystals", self.floor_crystals()),
            ("cart_wreck", self.cart_wreck()),
            ("bones", bdb.prop_bones()),
            ("dead_lantern", self.dead_lantern()),
        ]

    # ------------------------------------------------------------------ altos
    def stalactite(self) -> Canvas:
        body = Canvas(T, 64)
        for (x, ln, w) in ((16, 46, 5.5), (9, 26, 3.0), (23, 32, 3.5)):
            for i in range(ln):
                t = i / ln
                half = w * (1 - t) ** 1.1 + 0.4
                for xx in range(int(x - half), int(math.ceil(x + half))):
                    rel = (xx + 0.5 - (x - half)) / (2 * half)
                    col = ROCK_PAL[3] if rel < 0.3 else (ROCK_PAL[2] if rel < 0.6 else ROCK_PAL[1])
                    body.put(xx, i, rgba(shade(col, 0.9 + 0.2 * value_noise(41 + x, 0, i, 4, 4, 64))))
            body.put(x, ln, rgba((90, 150, 160)))
        return outline(body, (8, 8, 11, 255))

    def crystal_column(self) -> Canvas:
        body = Canvas(T, 64)
        shaded_blob(body, 16, 58, 11, 4.5, ROCK_PAL)
        crystal(body, 16, 58, 44, 8, 1, 0.75)
        crystal(body, 9, 58, 24, 5, -3, 0.5)
        crystal(body, 23, 58, 30, 5, 3, 0.6)
        crystal(body, 12, 59, 12, 3, -1, 0.3)
        cv = Canvas(T, 64)
        contact_shadow(cv, 3, 30, 62, 120)
        blit(cv, outline(body, (6, 12, 14, 255)), 0, 0)
        for (x, y) in ((15, 20), (10, 40), (22, 33)):
            cv.put(x, y, rgba(CRY_H))
        return cv

    def snapped_post(self) -> Canvas:
        body = Canvas(T, 64)
        for y in range(26, 60):
            for x in range(12, 19):
                i = x - 12
                col = WOOD_D if i in (0, 6) else (WOOD_H if i == 1 else (WOOD_L if i < 4 else WOOD))
                if hash01(8871, x, y // 3) < 0.15:
                    col = shade(col, 0.8)
                body.put(x, y, rgba(col))
        jag = (4, 0, 6, 2, 7, 1, 3)
        for i, j in enumerate(jag):
            for y in range(26, 26 + j):
                body.put(12 + i, y, (0, 0, 0, 0))
            body.put(12 + i, 26 + j, rgba((150, 120, 84)))
        # parte de cima tombada, encostada
        for o in range(6):
            col = WOOD_H if o == 0 else (WOOD_L if o < 3 else (WOOD if o < 5 else WOOD_D))
            line(body, 19, 30 + o, 28, 6 + o, rgba(col))
        fill_rect(body, 11, 44, 9, 2, rgba(IRON))
        fill_rect(body, 11, 44, 9, 1, rgba(IRON_L))
        for y in range(57, 61):
            for x in range(9, 22):
                body.put(x, y, rgba(ROCK_PAL[2] if y == 57 else ROCK_PAL[1]))
        cv = Canvas(T, 64)
        contact_shadow(cv, 6, 30, 61, 120)
        blit(cv, outline(body, (8, 6, 5, 255)), 0, 0)
        return cv

    def props_tall(self) -> Frames:
        return [("stalagmite_tall", self.stalagmite(48, 7.5, 5, 64)), ("stalactite", self.stalactite()),
                ("crystal_column", self.crystal_column()), ("snapped_post", self.snapped_post())]

    # ------------------------------------------------------------------ mockup
    MAP = [
        "##########..###########",
        "##########LL###########",
        "##########nn###########",
        "##########nn###########",
        "#######.........#######",
        "#######.........#######",
        "###..................##",
        "..W..................##",
        "..W..................##",
        "###..................##",
        "###..................##",
        "#######.........#######",
        "#######.........#######",
        "#######################",
    ]

    def scene(self) -> Dict[str, object]:
        P = 32
        return {
            "map": self.MAP,
            "view": (40.0, 30.0),
            "void": (6, 6, 8, 255),
            "torch_radius": 200,
            "torch_power": 1.0,
            "decals": [("puddle", 13 * P, 9 * P + 6), ("puddle", 4 * P + 8, 6 * P + 10)],
            "wall_props": [("torch_1", 8 * P, 2 * P + 4), ("torch_3", 15 * P, 2 * P + 4),
                           ("torch_0", 4 * P, 4 * P + 4), ("torch_2", 19 * P, 4 * P + 4)],
            "floor_props": [("rocks", 7 * P + 4, 4 * P + 4), ("broken_beam", 14 * P, 4 * P + 8),
                            ("miner_remains", 5 * P, 9 * P + 6), ("glow_mushrooms", 18 * P + 6, 6 * P + 4),
                            ("floor_crystals", 3 * P + 4, 9 * P + 10), ("cart_wreck", 17 * P, 9 * P + 6),
                            ("bones", 9 * P, 11 * P + 8), ("dead_lantern", 12 * P + 8, 5 * P + 4),
                            ("stalagmite_small", 19 * P + 6, 9 * P + 2), ("glow_mushrooms", 8 * P - 4, 11 * P + 20),
                            ("rocks", 15 * P - 4, 11 * P + 22)],
            "tall_props": [("stalactite", 6 * P + 4, 4 * P - 6), ("stalactite", 16 * P - 4, 4 * P - 6),
                           ("crystal_column", 3 * P + 2, 5 * P + 18), ("snapped_post", 9 * P + 4, 2 * P + 30),
                           ("stalagmite_tall", 20 * P - 4, 6 * P + 6)],
            "actors": [("cave_bat", 300, 150, False), ("cave_bat", 488, 186, True), ("skeleton", 540, 300, True),
                       ("slime", 230, 300, False)],
            "hero": ("hero_living", 380, 262, False),
            "hp": {"cave_bat": 0.8, "skeleton": 0.55, "slime": 1.0},
            "loot": (430, 352, 1, "[Amuleto de Cristal (Mágico)]", (56, 189, 248)),
            "ambient": (0.40, 0.43, 0.52),
            "hero_light": (0.70, 0.66, 0.60, 230),
            "extra_lights": [(3 * P + 18, 6 * P + 10, 120, (0.40, 0.95, 0.88), 0.55),
                             (18 * P + 22, 6 * P + 22, 60, (0.7, 0.6, 1.0), 0.35),
                             (3 * P + 20, 9 * P + 30, 70, (0.40, 0.95, 0.88), 0.35),
                             (11 * P, 1 * P, 110, (0.30, 0.7, 0.7), 0.3),
                             (11 * P, 3 * P + 24, 90, (0.30, 0.8, 0.8), 0.45)],
            "extra_glows": [(3 * P + 18, 6 * P + 2, 26, (90, 220, 200), 0.35),
                            (18 * P + 22, 6 * P + 20, 12, (200, 180, 255), 0.35)],
            "hud_title": "Fundo da Mina",
            "hud_objective": "Sobreviva às profundezas · 4 restantes",
            "damage": [("31", 488, 186, False), ("96", 540, 300, True)],
            "telegraph": None,
        }


BIOME = MineDepths
