"""
SUBMUNDO - Bioma `ancient_seal` (Selo Antigo) - BRF-137 / T-072
==================================================================
Ruinas de pedra entalhada sob a mina: cantaria clara e fria com friso de runas
Empireas douradas, fendas que vazam luz azulada, colunas partidas, estatuas caidas e
um selo central rachado (4 props 32x32 = disco 64x64). Luz de arandelas douradas.
"""
from __future__ import annotations

import math
import random
from typing import Dict, List, Sequence, Tuple

from under_kit import (
    Biome, Canvas, Frames, RGB, T, bdb, blit, contact_shadow, darken, draw_flame, fill_ellipse, fill_rect,
    hash01, line, mix, outline, overlay_blood, rgba, shade, shaded_blob, sub, wrap_crack, flip_h,
)

GOLD_D: RGB = (120, 88, 40)
GOLD: RGB = (212, 169, 90)
GOLD_H: RGB = (241, 210, 138)
GOLD_W: RGB = (255, 244, 210)
RUNE_D, RUNE, RUNE_H = bdb.RUNE_D, bdb.RUNE, bdb.RUNE_H
FLOOR_TONES: Sequence[RGB] = ((46, 44, 51), (50, 48, 56), (42, 41, 48), (54, 51, 58))
MORTAR: RGB = (15, 14, 18)
CAP_TONES: Sequence[RGB] = ((29, 28, 34), (32, 31, 37), (27, 26, 31))
ASHLAR: Sequence[RGB] = ((66, 62, 66), (72, 68, 71), (60, 57, 62), (76, 71, 73))
ASHLAR_MORTAR: RGB = (18, 17, 21)
STONE_PAL: Sequence[RGB] = ((44, 42, 48), (66, 62, 67), (90, 85, 88), (118, 111, 110))
GOLD_FLAME = (GOLD_W, (253, 236, 160), GOLD_H, GOLD, GOLD_D)
GLYPHS = bdb.RUNE_GLYPHS


def glyph(cv: Canvas, x: int, y: int, idx: int, col: RGB, core: RGB = None) -> None:
    g = GLYPHS[idx % len(GLYPHS)]
    for ry, row in enumerate(g):
        for rx, bit in enumerate(row):
            if bit == "1":
                cv.put(x + rx, y + ry, rgba(col))
    if core is not None and g[2][1] == "1":
        cv.put(x + 1, y + 2, rgba(core))


def ashlar(cv: Canvas, gy0: int, y0: int, y1: int, seed: int) -> None:
    """Cantaria em fiadas de 16 px; blocos de 24/20 px alternados (coordenada global y)."""
    for y in range(y0, y1):
        gy = gy0 + y
        course = gy // 16
        yin = gy % 16
        off = (0, 12, 6, 18)[course % 4]
        for x in range(T):
            xm = (x + off) % 24
            bi = ((x + off) // 24 + course * 3) % len(ASHLAR)
            tone = ASHLAR[bi]
            if yin == 0 or xm == 0:
                col = ASHLAR_MORTAR
            else:
                col = tone
                if yin == 1:
                    col = shade(tone, 1.22)
                elif yin == 15:
                    col = shade(tone, 0.66)
                elif yin == 14:
                    col = shade(tone, 0.82)
                elif xm == 1:
                    col = shade(tone, 1.1)
                elif xm == 23:
                    col = shade(tone, 0.78)
                r = hash01(seed, x, gy)
                if r < 0.07:
                    col = shade(col, 0.86)
                elif r < 0.1:
                    col = shade(col, 1.1)
            cv.put(x, y, rgba(col))


class AncientSeal(Biome):
    id = "ancient_seal"
    title = "Selo Antigo"
    subtitle = "ruínas de pedra entalhada, runas Empíreas douradas/azuladas, colunas partidas, selo central"
    side_rim_lo = (52, 50, 57)
    side_rim = (86, 82, 87)
    rim = (108, 102, 101)
    rim_hi = (200, 162, 94)
    rim_lo = (42, 40, 47)
    cap_tones = CAP_TONES
    cap_crack = (11, 10, 13)
    quoin_hi = (112, 106, 106)
    quoin_tones = ((80, 75, 77), (74, 70, 72))
    face_mortar = ASHLAR_MORTAR
    jamb_tones = ((70, 66, 69), (63, 60, 64))
    jamb_top = (118, 110, 106)
    gap_dark = (12, 11, 15)
    shadow_tint = (2, 1, 6)
    torch_flame = (16.0, 10.0)
    torch_light = (1.0, 0.80, 0.48)
    torch_glow = ((255, 236, 170), (230, 170, 70))

    # ------------------------------------------------------------------ piso
    def floor(self, name: str) -> Canvas:
        cv = Canvas(T, T)
        lay = {"floor_0": "a", "floor_1": "b", "floor_2": "c", "floor_cracked": "a", "floor_moss": "b",
               "floor_blood": "c"}[name]
        seed = {"floor_0": 601, "floor_1": 602, "floor_2": 603, "floor_cracked": 604, "floor_moss": 605,
                "floor_blood": 606}[name]
        rng = random.Random(seed)
        bdb.draw_stones(cv, bdb.FLOOR_LAYOUTS[lay], rng, FLOOR_TONES, MORTAR, 1.24, 0.74)
        if name == "floor_cracked":
            wrap_crack(cv, 611, 9, 3, 22, 1, (6, 8, 14), (60, 58, 66))
            wrap_crack(cv, 612, 25, 14, 9, -1, (6, 8, 14), (60, 58, 66))
            # luz azulada vazando da fenda
            for y in range(T):
                for x in range(T):
                    if cv.get(x, y)[:3] == (6, 8, 14) and hash01(613, x, y) < 0.45:
                        cv.put(x, y, rgba(RUNE_D if hash01(614, x, y) < 0.7 else RUNE))
        elif name == "floor_moss":
            # laje com inscricao circular dourada (fragmento de selo)
            for y in range(T):
                for x in range(T):
                    d = math.hypot(x + 0.5 - 16, y + 0.5 - 16)
                    if 11.2 <= d < 12.2:
                        cv.put(x, y, rgba(GOLD_D))
                    elif 12.2 <= d < 12.9:
                        cv.put(x, y, rgba((22, 20, 22)))
            for i, (gx, gy) in enumerate(((14, 6), (22, 13), (14, 21), (6, 13))):
                glyph(cv, gx, gy, i, GOLD if i % 2 else GOLD_D)
            cv.put(16, 16, rgba(GOLD_H))
        elif name == "floor_blood":
            overlay_blood(cv, 615)
        return cv

    def cap_base(self, seed: int) -> Canvas:
        cv = Canvas(T, T)
        bdb.draw_stones(cv, bdb.FLOOR_LAYOUTS["cap"], random.Random(seed), CAP_TONES, self.cap_crack, 1.15, 0.82)
        return cv

    # ------------------------------------------------------------------ face
    def face(self, kind: str) -> Canvas:
        cv = Canvas(T, T)
        if kind.startswith("upper"):
            ashlar(cv, 0, 0, T, 701)
            # friso entalhado com runas Empireas (dourado apagado; algumas acesas)
            for x in range(T):
                cv.put(x, 17, rgba((122, 114, 108)))
                cv.put(x, 18, rgba((28, 26, 30)))
                for y in range(19, 27):
                    cv.put(x, y, rgba((50, 47, 52) if y < 26 else (36, 34, 39)))
                cv.put(x, 27, rgba((96, 90, 90)))
                cv.put(x, 28, rgba((20, 19, 23)))
            for i, gx in enumerate((2, 10, 18, 26)):
                lit = i == 1
                glyph(cv, gx, 20, i + (2 if kind == "upper_cracked" else 0), GOLD if lit else GOLD_D,
                      GOLD_W if lit else None)
            if kind == "upper_cracked":
                # bloco partido com fenda de luz azulada
                pts = [(13, 0), (15, 5), (14, 9), (17, 13), (16, 17), (19, 22), (18, 27), (21, 31)]
                for (a, b), (c, d) in zip(pts, pts[1:]):
                    line(cv, a - 1, b, c - 1, d, rgba((8, 10, 18)))
                    line(cv, a, b, c, d, rgba(RUNE))
                    line(cv, a + 1, b, c + 1, d, rgba(RUNE_D))
                for (x, y) in ((15, 5), (16, 13), (19, 22)):
                    cv.put(x, y, rgba(RUNE_H))
                for y in range(2, 8):
                    for x in range(22, 30):
                        cv.put(x, y, rgba((24, 22, 27)))
                for x in range(22, 30):
                    cv.put(x, 8, rgba((96, 90, 92)))
            self.overhang(cv)
            return cv
        ashlar(cv, T, 0, 22, 702)
        # embasamento moldurado
        for x in range(T):
            cv.put(x, 22, rgba((24, 22, 26)))
            cv.put(x, 23, rgba((126, 118, 112)))
            cv.put(x, 24, rgba((96, 90, 90)))
            for y in range(25, 29):
                c = (66, 62, 66) if (x // 16) % 2 else (62, 58, 63)
                cv.put(x, y, rgba(ASHLAR_MORTAR if x % 16 == 0 else c))
            cv.put(x, 29, rgba((44, 41, 46)))
            cv.put(x, 30, rgba((24, 22, 27)))
            cv.put(x, 31, rgba((14, 13, 17)))
            if x % 8 == 4:
                cv.put(x, 26, rgba(GOLD_D))
        if kind == "lower_grate":
            # nicho com emblema Empireo (sol/olho) em relevo dourado
            for y in range(3, 22):
                for x in range(8, 24):
                    dx = x + 0.5 - 16
                    if y < 10 and dx * dx + (y - 10) ** 2 > 64:
                        continue
                    edge = (dx * dx + (y - 10) ** 2 > 42 and y < 10) or x in (8, 23)
                    cv.put(x, y, rgba((104, 98, 98) if edge else mix((10, 10, 16), (28, 26, 32), (y - 3) / 19)))
            for a in range(0, 360, 30):
                t = math.radians(a)
                for r in (4, 5, 6):
                    cv.put(int(round(16 + r * math.cos(t))), int(round(13 + r * math.sin(t))), rgba(GOLD_D if r == 6 else GOLD))
            fill_ellipse(cv, 16, 13, 3.2, 2.0, lambda x, y, nx, ny: rgba(GOLD_H if ny < 0 else GOLD))
            cv.put(16, 13, rgba(RUNE))
            cv.put(15, 13, rgba(RUNE_D))
        return cv

    # ------------------------------------------------------------------ porta (arco entalhado)
    def door_big(self) -> Canvas:
        if "door" in self._cache:
            return self._cache["door"]
        W, H = 64, 64
        cv = Canvas(W, H)
        for i in (0, 32):
            blit(cv, self.face("upper"), i, 0)
            blit(cv, self.face("lower"), i, 32)
        cx, cy = 31.5, 27.0
        r_in, r_out = 12.5, 20.0
        n_vous = 9
        rng = random.Random(7101)
        for y in range(H):
            for x in range(W):
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                r = math.hypot(dx, dy)
                in_open = (abs(dx) < r_in and y >= cy) or (r < r_in and y < cy)
                if in_open:
                    depth = min(1.0, max(0.0, (y - 14) / 50))
                    col = mix((4, 6, 14), (10, 22, 44), depth)
                    g = max(0.0, 1 - math.hypot(dx, (y - 50) * 1.3) / 14)
                    col = mix(col, (40, 110, 170), g * 0.55)
                    if y in (48, 55, 61) and abs(dx) < r_in - 1:
                        col = mix(col, (60, 70, 90), 0.6)
                    if y in (49, 56, 62) and abs(dx) < r_in - 1:
                        col = shade(col, 0.6)
                    cv.put(x, y, rgba(col))
                    continue
                in_ring = r_in <= r < r_out and y < cy
                in_jamb = r_in <= abs(dx) < r_out - 1 and y >= cy
                if in_ring:
                    ang = math.atan2(dy, dx)
                    seg = (ang + math.pi) / math.pi * n_vous
                    frac = seg - math.floor(seg)
                    key = int(seg) == n_vous // 2
                    base = (104, 98, 98) if key else ((86, 81, 84) if int(seg) % 2 else (80, 75, 79))
                    if frac < 0.09 and not key:
                        col = ASHLAR_MORTAR
                    elif r < r_in + 1.2:
                        col = shade(base, 1.3)
                    elif r > r_out - 1.3:
                        col = shade(base, 0.6)
                    else:
                        col = base if rng.random() > 0.1 else shade(base, 0.9)
                    cv.put(x, y, rgba(col))
                elif in_jamb:
                    block = int((y - cy) // 9)
                    base = (84, 79, 82) if block % 2 else (78, 74, 77)
                    if (y - int(cy)) % 9 == 0:
                        col = ASHLAR_MORTAR
                    elif abs(dx) < r_in + 1.2:
                        col = shade(base, 1.28)
                    elif abs(dx) > r_out - 2.2:
                        col = shade(base, 0.6)
                    else:
                        col = base if rng.random() > 0.1 else shade(base, 0.9)
                    cv.put(x, y, rgba(col))
                elif (r_out <= r < r_out + 1.2 and y < cy) or (r_out - 1 <= abs(dx) < r_out and y >= cy):
                    cv.put(x, y, rgba((12, 11, 15)))
        # filete dourado no intradorso e runas nas aduelas
        for a in range(0, 181, 3):
            t = math.radians(180 + a)
            cv.put(int(cx + (r_in + 2.2) * math.cos(t)), int(cy + (r_in + 2.2) * math.sin(t)), rgba(GOLD_D))
        for i, a in enumerate((200, 235, 305, 340)):
            t = math.radians(a)
            glyph(cv, int(cx + 16.5 * math.cos(t)) - 1, int(cy + 16.5 * math.sin(t)) - 2, i, GOLD if i in (1, 2) else GOLD_D)
        # pedra-chave: olho Empireo
        fill_ellipse(cv, 31.5, 10.5, 3.6, 2.2, lambda x, y, nx, ny: rgba(GOLD_H if ny < 0 else GOLD))
        cv.put(31, 10, rgba(RUNE_H))
        cv.put(32, 10, rgba(RUNE))
        for (x, y) in ((27, 7), (36, 7), (31, 6), (26, 11), (37, 11)):
            cv.put(x, y, rgba(GOLD_D))
        for i, gy in enumerate((31, 40, 49)):
            glyph(cv, 14, gy, i + 1, GOLD if i == 1 else GOLD_D, GOLD_W if i == 1 else None)
            glyph(cv, 47, gy, i + 2, GOLD if i == 1 else GOLD_D, GOLD_W if i == 1 else None)
        for y in range(30, 64):
            for x in (19, 44):
                if cv.get(x, y)[2] < 60:
                    cv.put(x, y, rgba((20, 44, 70)))
        self._cache["door"] = cv
        return cv

    def threshold(self) -> Canvas:
        cv = Canvas(64, T)
        blit(cv, self.floor("floor_0"), 0, 0)
        blit(cv, self.floor("floor_1"), 32, 0)
        rng = random.Random(7201)
        for y in range(0, 20):
            for x in range(13, 51):
                if y < 3:
                    col = (6, 8, 14) if 19 <= x <= 44 else (16, 15, 19)
                elif y == 3:
                    col = (118, 110, 106)
                elif y == 19 or x in (13, 50):
                    col = MORTAR
                else:
                    col = (62, 59, 64) if rng.random() > 0.1 else (56, 53, 58)
                    if x == 14 or y == 4:
                        col = (80, 76, 80)
                    if y == 18 or x == 49:
                        col = (40, 38, 44)
                cv.put(x, y, rgba(col))
        for i, gx in enumerate(range(18, 46, 7)):
            glyph(cv, gx, 9, i, GOLD if i in (1, 2) else GOLD_D, GOLD_W if i in (1, 2) else None)
        for x in range(16, 48):
            cv.put(x, 15, rgba(GOLD_D if x % 3 else GOLD))
        return cv

    def mark(self, cv: Canvas, x: int, y: int, idx: int, bright: bool) -> None:
        glyph(cv, x, y, idx, GOLD if bright else GOLD_D, GOLD_W if bright else None)

    def sill_h(self, cv: Canvas, x0: int, x1: int, y: int) -> None:
        for x in range(x0, x1):
            cv.put(x, y, rgba((118, 110, 106)))
            cv.put(x, y + 1, rgba(GOLD_D if x % 3 else GOLD))
            cv.put(x, y + 2, rgba((14, 13, 17)))

    def sill_v(self, cv: Canvas, x: int, y0: int, y1: int, east: bool) -> None:
        for y in range(y0, y1):
            cv.put(x, y, rgba(GOLD_D if y % 3 else GOLD))
            cv.put(x + (1 if east else -1), y, rgba((14, 13, 17)))

    # ------------------------------------------------------------------ props
    def sconce(self, frame: int) -> Canvas:
        body = Canvas(T, T)
        # mao-francesa de pedra entalhada
        for y in range(16, 30):
            w = max(1, int((30 - y) * 0.55))
            for x in range(16 - w, 16 + w):
                col = STONE_PAL[2] if x < 15 else (STONE_PAL[1] if x < 17 else STONE_PAL[0])
                body.put(x, y, rgba(col))
        glyph(body, 15, 21, 0, GOLD_D)
        # taca dourada
        for y in range(11, 16):
            w = 6 - (y - 11)
            for x in range(16 - w - 1, 16 + w + 1):
                body.put(x, y, rgba(GOLD_H if x < 14 else (GOLD if x < 18 else GOLD_D)))
        fill_rect(body, 9, 11, 14, 1, rgba(GOLD_H))
        cv = outline(body)
        draw_flame(cv, 16, 11, frame, GOLD_FLAME, height=(10, 8, 11, 9), width=(4.0, 4.6, 3.8, 4.4),
                   ember_cols=(GOLD_H, (240, 250, 255)))
        # base azulada da chama (runa acesa)
        for x in range(13, 19):
            cv.put(x, 10, rgba(RUNE if x % 2 else RUNE_H))
        return cv

    def rune_plaque(self) -> Canvas:
        cv = Canvas(T, T)
        for y in range(8, 28):
            for x in range(5, 27):
                col = (60, 57, 62)
                if y == 8 or x == 5:
                    col = (92, 86, 88)
                elif y == 27 or x == 26:
                    col = (30, 28, 33)
                cv.put(x, y, rgba(col))
        for y in range(10, 26):
            for x in range(7, 25):
                d = math.hypot(x + 0.5 - 16, y + 0.5 - 18)
                if 6.3 <= d < 7.3:
                    cv.put(x, y, rgba(GOLD))
        glyph(cv, 15, 15, 2, GOLD_H, GOLD_W)
        for (x, y) in ((9, 11), (22, 11), (9, 24), (22, 24)):
            cv.put(x, y, rgba(RUNE))
        for x in range(6, 27):
            cv.put(x, 28, (0, 0, 0, 100))
        return cv

    def column_drum(self) -> Canvas:
        body = Canvas(T, T)
        for y in range(15, 27):
            for x in range(4, 26):
                t = (y - 15) / 11
                col = STONE_PAL[3] if t < 0.2 else (STONE_PAL[2] if t < 0.55 else (STONE_PAL[1] if t < 0.85 else STONE_PAL[0]))
                if (y - 15) % 3 == 2:
                    col = shade(col, 0.8)
                body.put(x, y, rgba(col))
        fill_ellipse(body, 26, 21, 3.4, 6.2, lambda x, y, nx, ny: rgba(STONE_PAL[2] if nx * nx + ny * ny < 0.5 else STONE_PAL[1]))
        for y in range(16, 26):
            body.put(26, y, rgba(STONE_PAL[3]) if y % 3 == 0 else rgba(STONE_PAL[2]))
        for x in range(8, 12):
            body.put(x, 20, rgba(GOLD_D))
        cv = outline(body)
        contact_shadow(cv, 4, 30, 28, 110)
        return cv

    def statue_head(self) -> Canvas:
        body = Canvas(T, T)
        fill_ellipse(body, 15, 18, 8, 8.5, lambda x, y, nx, ny: rgba(STONE_PAL[3] if nx * 0.7 + ny < -0.6 else (STONE_PAL[2] if nx * 0.7 + ny < 0.2 else STONE_PAL[1])))
        # olhos fechados e nariz
        for x in (11, 12, 17, 18):
            body.put(x, 17, rgba(STONE_PAL[0]))
        body.put(15, 19, rgba(STONE_PAL[0]))
        body.put(15, 20, rgba(STONE_PAL[1]))
        for x in (13, 14, 15, 16):
            body.put(x, 23, rgba(STONE_PAL[0]))
        # coroa/aureola dourada partida
        for a in range(200, 345, 6):
            t = math.radians(a)
            body.put(int(15 + 10 * math.cos(t)), int(17 + 10 * math.sin(t)), rgba(GOLD if a % 12 else GOLD_H))
        # fratura no pescoco
        for y in range(22, 28):
            body.put(22, y, rgba(STONE_PAL[0]))
        cv = outline(body)
        contact_shadow(cv, 6, 26, 28, 110)
        return cv

    def candles(self) -> Canvas:
        cv = Canvas(T, T)
        body = Canvas(T, T)
        shaded_blob(body, 16, 26, 10, 3.2, STONE_PAL)
        wax, wax_d = (232, 224, 204), (176, 166, 146)
        for (x, top) in ((10, 17), (14, 13), (18, 15), (22, 19), (16, 20)):
            fill_rect(body, x, top, 2, 26 - top, rgba(wax))
            fill_rect(body, x + 1, top, 1, 26 - top, rgba(wax_d))
            body.put(x, top + 3, rgba(wax))
        blit(cv, outline(body), 0, 0)
        for (x, top) in ((10, 17), (14, 13), (18, 15), (22, 19), (16, 20)):
            cv.put(x, top - 1, rgba(GOLD_H))
            cv.put(x, top - 2, rgba(GOLD_W))
            cv.put(x + 1, top - 1, rgba(GOLD))
        return cv

    def offering_bowl(self) -> Canvas:
        body = Canvas(T, T)
        for (a, b) in ((9, 28), (16, 29), (23, 28)):
            line(body, 16, 20, a, b, rgba(GOLD_D))
        for y in range(14, 21):
            w = 9 - (y - 14)
            for x in range(16 - w, 16 + w):
                body.put(x, y, rgba(GOLD_H if x < 12 else (GOLD if x < 19 else GOLD_D)))
        fill_ellipse(body, 16, 14, 9, 2.2, lambda x, y, nx, ny: rgba((18, 40, 66) if nx * nx + ny * ny < 0.6 else GOLD_H))
        cv = outline(body)
        for (x, y) in ((13, 13), (17, 14), (20, 13), (15, 14)):
            cv.put(x, y, rgba(RUNE if (x + y) % 2 else RUNE_H))
        return cv

    def debris(self) -> Canvas:
        body = Canvas(T, T)
        for (x0, y0, w, h) in ((5, 20, 9, 6), (15, 22, 10, 6), (11, 15, 7, 5), (22, 18, 6, 4)):
            for y in range(y0, y0 + h):
                for x in range(x0, x0 + w):
                    col = STONE_PAL[3] if y == y0 else (STONE_PAL[2] if x == x0 else (STONE_PAL[0] if y == y0 + h - 1 else STONE_PAL[1]))
                    body.put(x, y, rgba(col))
        glyph(body, 17, 23, 1, GOLD_D)
        body.put(7, 22, rgba(GOLD))
        cv = outline(body)
        contact_shadow(cv, 4, 28, 28, 100)
        return cv

    def urn(self) -> Canvas:
        body = Canvas(T, T)
        pal = ((44, 48, 62), (66, 72, 92), (92, 100, 124), (130, 140, 164))
        shaded_blob(body, 16, 20, 7.5, 7.5, pal)
        fill_rect(body, 13, 8, 6, 6, rgba(pal[1]))
        fill_rect(body, 13, 8, 2, 6, rgba(pal[2]))
        fill_rect(body, 11, 6, 10, 3, rgba(pal[2]))
        for x in range(9, 24):
            if body.get(x, 19)[3]:
                body.put(x, 19, rgba(GOLD if x % 3 else GOLD_H))
                body.put(x, 20, rgba(GOLD_D))
        cv = outline(body)
        contact_shadow(cv, 9, 24, 28, 100)
        return cv

    def seal_disc(self) -> Canvas:
        """Selo central rachado (64x64) dividido em 4 props."""
        cv = Canvas(64, 64)
        c = 31.5
        for y in range(64):
            for x in range(64):
                d = math.hypot(x + 0.5 - c, y + 0.5 - c)
                if d >= 31.5:
                    continue
                if d >= 29.5:
                    col = (24, 22, 28)
                elif d >= 28.3:
                    col = (110, 104, 104)
                elif d >= 21.5:
                    col = (58, 55, 62)
                    if d < 22.6:
                        col = GOLD_D
                elif d >= 20.3:
                    col = (16, 22, 40)
                elif d >= 13:
                    col = (46, 44, 52)
                elif d >= 11.8:
                    col = RUNE_D
                else:
                    col = (38, 36, 44)
                cv.put(x, y, rgba(col))
        # anel de runas douradas
        for i in range(12):
            a = i / 12 * 2 * math.pi - math.pi / 2
            gx, gy = c + 25 * math.cos(a), c + 25 * math.sin(a)
            glyph(cv, int(gx) - 1, int(gy) - 2, i, GOLD_H if i % 3 == 0 else GOLD, GOLD_W if i % 3 == 0 else None)
        # anel interno de runas azuis
        for i in range(8):
            a = i / 8 * 2 * math.pi
            gx, gy = c + 16.5 * math.cos(a), c + 16.5 * math.sin(a)
            glyph(cv, int(gx) - 1, int(gy) - 2, i + 1, RUNE, RUNE_H)
        # estrela Empirea de 8 pontas no centro
        for k in range(8):
            a = k * math.pi / 4
            ln = 10 if k % 2 == 0 else 6
            for i in range(ln):
                for w in (-1, 0, 1):
                    if w and i > ln - 3:
                        continue
                    px = c + math.cos(a) * i - math.sin(a) * w * 0.8
                    py = c + math.sin(a) * i + math.cos(a) * w * 0.8
                    cv.put(int(px), int(py), rgba(GOLD_H if w == 0 else GOLD))
        fill_ellipse(cv, c, c, 2.6, 2.6, lambda x, y, nx, ny: rgba(RUNE_H))
        # rachaduras do selo rompido vazando luz azul
        for pts in (((32, 32), (40, 26), (47, 24), (55, 14), (59, 10)),
                    ((31, 33), (24, 40), (20, 47), (12, 52), (7, 57)),
                    ((33, 32), (42, 38), (50, 44), (56, 50))):
            for (a, b), (cc, d) in zip(pts, pts[1:]):
                line(cv, a, b, cc, d, rgba(RUNE_H))
                line(cv, a + 1, b, cc + 1, d, rgba(RUNE))
                line(cv, a, b + 1, cc, d + 1, rgba((6, 10, 22)))
        return cv

    def props(self) -> Frames:
        seal = self.seal_disc()
        return [
            ("torch_0", self.sconce(0)),
            ("torch_1", self.sconce(1)),
            ("torch_2", self.sconce(2)),
            ("torch_3", self.sconce(3)),
            ("rune_plaque", self.rune_plaque()),
            ("column_drum", self.column_drum()),
            ("statue_head", self.statue_head()),
            ("candles", self.candles()),
            ("offering_bowl", self.offering_bowl()),
            ("carved_debris", self.debris()),
            ("urn", self.urn()),
            ("bones", bdb.prop_bones()),
            ("seal_tl", sub(seal, 0, 0)),
            ("seal_tr", sub(seal, 32, 0)),
            ("seal_bl", sub(seal, 0, 32)),
            ("seal_br", sub(seal, 32, 32)),
        ]

    # ------------------------------------------------------------------ altos
    def column(self, broken: bool) -> Canvas:
        body = Canvas(T, 64)
        top = 12 if not broken else 28
        stone = (78, 74, 78)

        def lit(x: int, half: float) -> float:
            d = (x + 0.5 - 15.5) / half
            return 1.32 - 0.72 * (d + 1) / 2

        for y in range(52, 61):
            for x in range(4, 28):
                col = shade(stone, lit(x, 12))
                if y in (52, 56):
                    col = shade(stone, 1.38)
                if y == 55:
                    col = ASHLAR_MORTAR
                body.put(x, y, rgba(col))
        for y in range(top, 52):
            for x in range(7, 25):
                col = shade(stone, lit(x, 9))
                if (x - 7) % 4 == 3:
                    col = shade(col, 0.78)  # caneluras
                if 32 <= y <= 36:
                    col = GOLD_D if y in (32, 36) else (mix(col, GOLD, 0.5))
                body.put(x, y, rgba(col))
        glyph(body, 14, 33, 0, GOLD_H)
        if not broken:
            for y in range(3, 12):
                for x in range(3, 29):
                    col = shade(stone, lit(x, 13))
                    if y == 3:
                        col = shade(stone, 1.45)
                    if y in (7, 11):
                        col = ASHLAR_MORTAR
                    if y == 9:
                        col = GOLD_D if x % 2 else GOLD
                    body.put(x, y, rgba(col))
        else:
            jag = (0, 2, 1, 4, 6, 3, 1, 2, 5, 7, 4, 2, 1, 3, 2, 0, 1, 2)
            for i, x in enumerate(range(7, 25)):
                for y in range(top, top + jag[i]):
                    body.put(x, y, (0, 0, 0, 0))
                body.put(x, top + jag[i], rgba(shade(stone, 1.45)))
            for (cx, cy, rx, ry) in ((5, 59, 3.5, 2.5), (27, 60, 3, 2), (23, 57, 2, 1.5)):
                shaded_blob(body, cx, cy, rx, ry, STONE_PAL)
        cv = Canvas(T, 64)
        for x in range(3, 30):
            cv.put(x, 61, (0, 0, 0, 120))
            cv.put(x, 62, (0, 0, 0, 70))
        blit(cv, outline(body), 0, 0)
        return cv

    def obelisk(self) -> Canvas:
        body = Canvas(T, 64)
        for y in range(6, 56):
            t = (y - 6) / 50
            half = 5 + 3 * t
            for x in range(int(16 - half), int(math.ceil(16 + half))):
                rel = (x + 0.5 - (16 - half)) / (2 * half)
                col = STONE_PAL[3] if rel < 0.25 else (STONE_PAL[2] if rel < 0.6 else STONE_PAL[1])
                body.put(x, y, rgba(col))
        for y in range(1, 7):
            w = y - 1
            for x in range(16 - w, 16 + w + 1):
                body.put(x, y, rgba(STONE_PAL[3] if x <= 16 else STONE_PAL[1]))
        for y in range(54, 61):
            for x in range(6, 27):
                body.put(x, y, rgba(STONE_PAL[2] if y == 54 else (STONE_PAL[1] if y < 59 else STONE_PAL[0])))
        cv = Canvas(T, 64)
        for x in range(4, 29):
            cv.put(x, 61, (0, 0, 0, 120))
        blit(cv, outline(body), 0, 0)
        for i, gy in enumerate((12, 20, 28, 36, 44)):
            glyph(cv, 15, gy, i, RUNE if i % 2 else GOLD_H, RUNE_H if i % 2 else GOLD_W)
        return cv

    def angel(self) -> Canvas:
        body = Canvas(T, 64)
        # pedestal
        for y in range(50, 61):
            for x in range(6, 26):
                body.put(x, y, rgba(STONE_PAL[3] if y == 50 else (STONE_PAL[2] if y < 53 else (STONE_PAL[1] if y < 59 else STONE_PAL[0]))))
        glyph(body, 15, 54, 1, GOLD)
        # asas fechadas
        for side in (-1, 1):
            for y in range(10, 48):
                t = (y - 10) / 38
                w = int(7 * math.sin(min(1.0, t * 1.3) * math.pi * 0.85) + 2)
                for i in range(w):
                    x = 16 + side * (5 + i)
                    col = STONE_PAL[2] if side < 0 else STONE_PAL[1]
                    if (y + i * 2) % 5 == 0:
                        col = shade(col, 0.8)
                    body.put(x, y, rgba(col))
        # manto
        for y in range(16, 50):
            half = 4 + (y - 16) * 0.12
            for x in range(int(16 - half), int(math.ceil(16 + half))):
                rel = (x + 0.5 - (16 - half)) / (2 * half)
                col = STONE_PAL[3] if rel < 0.3 else (STONE_PAL[2] if rel < 0.65 else STONE_PAL[1])
                if (x - 12) % 3 == 0 and y > 30:
                    col = shade(col, 0.82)
                body.put(x, y, rgba(col))
        # capuz e cabeca
        fill_ellipse(body, 16, 12, 4.2, 5, lambda x, y, nx, ny: rgba(STONE_PAL[3] if nx < -0.2 else STONE_PAL[2]))
        fill_ellipse(body, 16.5, 13, 2.2, 2.8, lambda x, y, nx, ny: rgba(STONE_PAL[0]))
        # espada apoiada, dourada
        for y in range(22, 49):
            body.put(16, y, rgba(GOLD_H if y < 26 else (GOLD if y % 4 else GOLD_H)))
            body.put(17, y, rgba(GOLD_D))
        fill_rect(body, 13, 26, 7, 1, rgba(GOLD))
        cv = Canvas(T, 64)
        for x in range(4, 29):
            cv.put(x, 61, (0, 0, 0, 120))
        blit(cv, outline(body), 0, 0)
        # aureola
        for a in range(0, 360, 10):
            t = math.radians(a)
            cv.put(int(16.5 + 5.5 * math.cos(t)), int(8 + 2 * math.sin(t)), rgba(GOLD_H))
        return cv

    def props_tall(self) -> Frames:
        return [("column", self.column(False)), ("column_broken", self.column(True)), ("rune_obelisk", self.obelisk()),
                ("angel_statue", self.angel())]

    # ------------------------------------------------------------------ mockup
    MAP = [
        "########################",
        "########################",
        "###########nn###########",
        "###########nn###########",
        "#######..........#######",
        "#######..........#######",
        "###..................###",
        "###..................E..",
        "###..................E..",
        "###..................###",
        "###..................###",
        "###..................###",
        "#######..........#######",
        "#######..........#######",
        "########################",
    ]

    def scene(self) -> Dict[str, object]:
        P = 32
        sx, sy = 12 * P - 32, 9 * P - 32 + 8
        return {
            "map": self.MAP,
            "view": (70.0, 46.0),
            "torch_radius": 190,
            "torch_power": 1.0,
            "decals": [("seal_tl", sx, sy), ("seal_tr", sx + 32, sy), ("seal_bl", sx, sy + 32),
                       ("seal_br", sx + 32, sy + 32), ("rune_plaque", 4 * P, 9 * P + 4), ("rune_plaque", 18 * P, 6 * P + 8)],
            "wall_props": [("torch_0", 9 * P, 2 * P + 2), ("torch_2", 14 * P, 2 * P + 2),
                           ("torch_1", 4 * P + 16, 4 * P + 2), ("torch_3", 18 * P + 16, 4 * P + 2)],
            "floor_props": [("column_drum", 5 * P, 10 * P + 8), ("statue_head", 16 * P + 16, 10 * P + 20),
                            ("candles", 8 * P - 4, 4 * P + 6), ("candles", 15 * P + 8, 4 * P + 6),
                            ("offering_bowl", 12 * P + 16, 4 * P + 10), ("carved_debris", 19 * P, 10 * P + 6),
                            ("urn", 3 * P + 4, 6 * P + 6), ("bones", 13 * P, 12 * P + 2)],
            "tall_props": [("column", 7 * P + 6, 4 * P + 18), ("column_broken", 16 * P - 6, 4 * P + 18),
                           ("rune_obelisk", 10 * P + 6, 2 * P + 38), ("angel_statue", 20 * P - 2, 5 * P + 14),
                           ("column_broken", 3 * P + 4, 9 * P + 4)],
            "actors": [("karnak", 384, 250, True), ("skeleton_chief", 552, 300, True), ("skeleton_archer", 210, 210, False),
                       ("skeleton", 528, 380, True)],
            "hero": ("hero_living", 300, 352, False),
            "hp": {"karnak": 1.0, "skeleton_chief": 0.62, "skeleton_archer": 1.0, "skeleton": 0.35},
            "loot": (440, 352, 3, "[Fragmento do Selo (Lendário)]", (249, 115, 22)),
            "ambient": (0.30, 0.31, 0.42),
            "hero_light": (0.6, 0.6, 0.7, 210),
            "extra_lights": [(12 * P, 9 * P + 8, 230, (0.35, 0.65, 1.0), 0.95),
                             (10 * P + 22, 3 * P + 30, 80, (0.35, 0.7, 1.0), 0.45),
                             (12 * P, 2 * P + 48, 70, (0.3, 0.6, 1.0), 0.5)],
            "extra_glows": [(12 * P, 9 * P + 8, 46, (80, 170, 255), 0.35), (12 * P, 9 * P + 8, 16, (200, 235, 255), 0.4)],
            "hud_title": "Selo Antigo",
            "hud_objective": "Detenha a vanguarda · 4 restantes",
            "damage": [("52", 528, 380, False), ("143", 552, 300, True)],
            "telegraph": ((222, 206), (300, 346)),
        }


BIOME = AncientSeal
