"""
SUBMUNDO - Assets Pixel Art 2.5D da Vila Natal (M9 / BRF-147 / T-133)
=====================================================================

Gera os assets exclusivos do Hub da Vila Natal (prologo), alinhados a paleta
Dark Fantasy de `scripts/art/biomes/surf_village.py` e a composicao de
`assets/mockups/ref_m9_village_hub.jpg`:

- public/assets/sprites/village_hub_tiles.png   (10 frames 32x32)
- public/assets/sprites/village_hub_props.png   (28 frames 32x32, RGBA)
- public/assets/sprites/village_hub_house.png   (192x160, RGBA)
- public/assets/sprites/village_hub_gate.png    (160x128, RGBA)
- scripts/art/biomes/out/village_hub_assets.manifest.json
- assets/mockups/preview_m9_village_assets.png  (prancha rotulada + mini-cena)

Execucao (Python stdlib pura):
    python scripts/art/buildVillageHubAssets.py
"""
from __future__ import annotations

import json
import math
import random
import sys
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

HERE = Path(__file__).resolve().parent
BIOMES_DIR = HERE / "biomes"
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(BIOMES_DIR))

from buildMonstersBase import Canvas, write_png  # noqa: E402
from buildDungeonBasic import (  # noqa: E402
    MOCKUPS_DIR,
    SPRITES_DIR,
    T,
    assemble,
    blit,
    fill_ellipse,
    fill_rect,
    line,
    mix,
    outline,
    render_text_overlay,
    rgba,
    shade,
    text_item,
    upscale,
)
from surf_common import (  # noqa: E402
    OUT_DIR,
    contact_shadow,
    ellipse_shadow,
    h01,
    leaf_blobs,
    put,
    vnoise,
    voronoi_stones,
)

RGB = Tuple[int, int, int]

# ---------------------------------------------------------------------------
# Paleta Vila Natal Dark Fantasy (alinhada a surf_village.py + ref_m9)
# ---------------------------------------------------------------------------

# Terra batida
DIRT_D = (58, 45, 34)
DIRT_M = (78, 61, 45)
DIRT_L = (98, 78, 56)
DIRT_H = (118, 96, 70)
PEBBLE = ((108, 98, 86), (90, 82, 72), (126, 114, 98))

# Grama sombria
GRASS_D = (32, 46, 26)
GRASS_M = (44, 64, 34)
GRASS_L = (60, 84, 44)
GRASS_H = (78, 104, 54)

# Madeira envelhecida (vigas, porta, barril, placa)
W_DD = (30, 18, 11)
W_D = (48, 30, 18)
W = (82, 54, 34)
W_L = (112, 76, 48)
W_H = (138, 98, 62)

# Madeira acinzentada / rustica (palicada)
PAL_DD = (34, 28, 24)
PAL_D = (56, 46, 38)
PAL_M = (80, 66, 54)
PAL_L = (104, 86, 70)
PAL_H = (126, 106, 86)

# Pedra acinzentada (portao, forja, fundacao, fogueira)
ST_CRACK = (34, 31, 29)
ST_D = (62, 59, 55)
ST_M = (84, 80, 74)
ST_L = (106, 100, 92)
ST_H = (128, 121, 110)
ST_TONES = (ST_M, (78, 74, 69), (92, 87, 80), (70, 66, 62))

# Reboco / barro da casa
PL_D = (96, 82, 66)
PL_M = (118, 102, 82)
PL_L = (138, 120, 96)

# Palha / sape do telhado
TH_DD = (48, 38, 22)
TH_D = (78, 62, 34)
TH_M = (112, 90, 48)
TH_L = (144, 116, 62)
TH_H = (176, 146, 82)

# Ferro forjado
IRON_DD = (22, 22, 26)
IRON_D = (38, 38, 44)
IRON = (66, 66, 74)
IRON_L = (110, 112, 122)
IRON_H = (152, 156, 168)

# Fogo / brasa
FL_DR = (132, 24, 18)
FL_R = (188, 34, 24)
FL_O = (234, 92, 16)
FL_A = (246, 160, 18)
FL_Y = (253, 224, 71)
FL_W = (254, 249, 195)


# ---------------------------------------------------------------------------
# Utilitarios de desenho
# ---------------------------------------------------------------------------

def pixel_font_glyph(ch: str) -> List[str]:
    """Fonte pixel 4x5 (ou 3x5) nitida para placas em pixel art."""
    glyphs: Dict[str, List[str]] = {
        "S": ["0111", "1000", "0110", "0001", "1110"],
        "A": ["0110", "1001", "1111", "1001", "1001"],
        "I": ["111", "010", "010", "010", "111"],
        "Í": ["111", "010", "010", "010", "111"],
        "D": ["1110", "1001", "1001", "1001", "1110"],
        " ": ["00", "00", "00", "00", "00"],
    }
    return glyphs.get(ch, glyphs[" "])


def draw_pixel_word(cv: Canvas, text: str, x0: int, y0: int, fg: RGB, shadow: RGB) -> None:
    x = x0
    for ch in text:
        g = pixel_font_glyph(ch)
        w = len(g[0])
        if ch == "Í":
            # acento agudo acima do I
            cv.put(x + 1, y0 - 2, rgba(shadow))
            cv.put(x + 2, y0 - 2, rgba(fg))
            cv.put(x + 1, y0 - 1, rgba(fg))
        for ry, row in enumerate(g):
            for rx, bit in enumerate(row):
                if bit == "1":
                    cv.put(x + rx + 1, y0 + ry + 1, rgba(shadow))
        for ry, row in enumerate(g):
            for rx, bit in enumerate(row):
                if bit == "1":
                    cv.put(x + rx, y0 + ry, rgba(fg))
        x += w + 1


def draw_flame(
    cv: Canvas,
    cx: float,
    base_y: int,
    height: float,
    width: float,
    sway: float,
    seed: int,
) -> None:
    """Desenha lingua de fogo organica com nucleo branco/amarelo e borda laranja/vermelha."""
    y_min = max(0, int(base_y - height - 2))
    y_max = min(cv.h - 1, base_y + 1)
    for y in range(y_min, y_max + 1):
        t = (base_y - y) / max(height, 1.0)
        if t < -0.1 or t > 1.05:
            continue
        t_clamped = max(0.0, min(1.0, t))
        wobble = math.sin(t_clamped * math.pi * 2.2 + seed * 1.7) * 0.9
        cxf = cx + sway * (t_clamped ** 1.2) + wobble * t_clamped
        half = width * ((1.0 - t_clamped) ** 0.72) * (0.85 + 0.35 * math.sin(t_clamped * math.pi))
        if half < 0.35:
            continue
        for x in range(max(0, int(cxf - half - 2)), min(cv.w, int(cxf + half + 3))):
            d = abs(x + 0.5 - cxf)
            if d > half + 0.2:
                continue
            heat = (1.0 - t_clamped) * 0.95 + (1.0 - d / max(half, 0.5)) * 0.65
            if heat > 1.28:
                col = FL_W
            elif heat > 1.02:
                col = FL_Y
            elif heat > 0.76:
                col = FL_A
            elif heat > 0.48:
                col = FL_O
            else:
                col = FL_R
            cv.put(x, y, rgba(col))


def draw_warm_glow(cv: Canvas, cx: float, cy: float, rx: float, ry: float, col: RGB, max_a: int) -> None:
    """Aplica brilho quente sutil sobre pixels ja pintados (sem vazar halo no fundo transparente)."""
    for y in range(max(0, int(cy - ry) - 1), min(cv.h, int(cy + ry) + 2)):
        for x in range(max(0, int(cx - rx) - 1), min(cv.w, int(cx + rx) + 2)):
            cur = cv.get(x, y)
            if cur[3] < 200:
                continue
            d = math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
            if d < 1.0:
                k = ((1.0 - d) ** 1.6) * (max_a / 255.0)
                cv.put(x, y, rgba(mix(cur[:3], col, k), cur[3]))


def draw_stone_block(
    cv: Canvas, x0: int, y0: int, w: int, h: int, base: RGB, seed: int
) -> None:
    """Bloco de pedra chanfrado 2.5D com quina clara em cima-esquerda e rejunte escuro."""
    for yy in range(h):
        for xx in range(w):
            x, y = x0 + xx, y0 + yy
            if not (0 <= x < cv.w and 0 <= y < cv.h):
                continue
            if xx == 0 or yy == 0:
                c = ST_CRACK
            elif xx == 1 and yy == 1:
                c = shade(base, 1.32)
            elif yy == 1 or xx == 1:
                c = shade(base, 1.18)
            elif yy == h - 1 or xx == w - 1:
                c = shade(base, 0.72)
            else:
                c = base
                r = h01(x, y, seed)
                if r < 0.12:
                    c = shade(c, 0.86)
                elif r > 0.92:
                    c = shade(c, 1.12)
            cv.put(x, y, rgba(c))


# ---------------------------------------------------------------------------
# 1. Tiles de chao 32x32 (sem costuras)
# ---------------------------------------------------------------------------

def make_dirt_base(seed: int, warm_shift: float = 0.0) -> Canvas:
    cv = Canvas(T, T)
    for y in range(T):
        for x in range(T):
            n1 = vnoise(x, y, T, seed, 8.0)
            n2 = vnoise(x, y, T, seed + 19, 4.0)
            v = n1 * 0.65 + n2 * 0.35 + warm_shift
            if v < 0.38:
                c = mix(DIRT_D, DIRT_M, max(0.0, v / 0.38))
            elif v < 0.72:
                c = mix(DIRT_M, DIRT_L, (v - 0.38) / 0.34)
            else:
                c = mix(DIRT_L, DIRT_H, min(1.0, (v - 0.72) / 0.28))
            r = h01(x, y, seed + 41)
            if r < 0.09:
                c = shade(c, 0.84)
            elif r > 0.94:
                c = shade(c, 1.12)
            cv.put(x, y, rgba(c))
    return cv


def tile_dirt(idx: int) -> Canvas:
    seeds = (101, 207, 313)
    cv = make_dirt_base(seeds[idx], warm_shift=(idx - 1) * 0.03)
    rng = random.Random(seeds[idx] * 3)
    # pedrinhas sutis e graos
    for _ in range(7 + idx * 2):
        px, py = rng.randint(2, 29), rng.randint(2, 29)
        c = rng.choice(PEBBLE)
        cv.put(px, py, rgba(c))
        if rng.random() < 0.5:
            cv.put((px + 1) % T, py, rgba(shade(c, 0.74)))
        cv.put(px, (py + 1) % T, rgba(DIRT_D))
    if idx == 2:
        # pequeno tufo de erva seca na terra batida
        for (gx, gy) in ((8, 22), (23, 11)):
            cv.put(gx, gy, rgba(GRASS_D))
            cv.put(gx, gy - 1, rgba(GRASS_M))
            cv.put(gx + 1, gy, rgba(GRASS_M))
    return cv


def tile_dirt_trail() -> Canvas:
    cv = make_dirt_base(409, warm_shift=0.05)
    # sulcos sutis de trilha/carroca horizontais/diagonais e cascalho
    for y in range(T):
        for x in range(T):
            rut = math.sin((y + math.sin(x / T * math.tau) * 1.4) / T * math.tau * 2)
            if rut > 0.65:
                cv.put(x, y, rgba(shade(cv.get(x, y)[:3], 0.86)))
            elif rut < -0.7:
                cv.put(x, y, rgba(shade(cv.get(x, y)[:3], 1.08)))
    rng = random.Random(419)
    for _ in range(16):
        px, py = rng.randint(1, 30), rng.randint(1, 30)
        c = rng.choice(PEBBLE)
        cv.put(px, py, rgba(shade(c, 1.1)))
        cv.put((px + 1) % T, py, rgba(shade(c, 0.78)))
        if rng.random() < 0.45:
            cv.put(px, (py + 1) % T, rgba(shade(c, 0.65)))
    return cv


def tile_grass(idx: int) -> Canvas:
    seed = 501 + idx * 37
    cv = Canvas(T, T)
    for y in range(T):
        for x in range(T):
            n = vnoise(x, y, T, seed, 8.0) * 0.65 + vnoise(x, y, T, seed + 11, 4.0) * 0.35
            c = mix(GRASS_D, GRASS_M, n) if n < 0.55 else mix(GRASS_M, GRASS_L, (n - 0.55) / 0.45)
            r = h01(x, y, seed + 5)
            if r < 0.12:
                c = shade(c, 0.84)
            cv.put(x, y, rgba(c))
    rng = random.Random(seed)
    # laminas e tufos de grama pixel art
    for _ in range(28):
        gx, gy = rng.randint(0, 31), rng.randint(0, 31)
        cv.put(gx, gy, rgba(GRASS_D))
        cv.put(gx, (gy - 1) % T, rgba(GRASS_L))
        if rng.random() < 0.55:
            cv.put((gx + 1) % T, (gy - 2) % T, rgba(GRASS_H))
    if idx == 1:
        # pequenas folhas caidas / musgo seco
        for (fx, fy) in ((7, 10), (22, 18), (14, 27)):
            cv.put(fx, fy, rgba((124, 92, 52)))
            cv.put((fx + 1) % T, fy, rgba((94, 68, 38)))
    return cv


def tile_dirt_grass_transition(grass_top: bool) -> Canvas:
    """Transicao organica sem costura lateral: grama em cima (ou embaixo) invadindo a terra."""
    grass = tile_grass(0 if grass_top else 1)
    dirt = tile_dirt(0 if grass_top else 1)
    cv = Canvas(T, T)
    for y in range(T):
        for x in range(T):
            wave = 16.0 + math.sin(x / T * math.tau) * 3.2 + (vnoise(x, y, T, 611, 4.0) - 0.5) * 6.0
            in_grass = (y < wave) if grass_top else (y >= wave)
            if in_grass:
                cv.put(x, y, grass.get(x, y))
            else:
                c = dirt.get(x, y)[:3]
                dist = abs(y - wave)
                if dist < 2.2:
                    c = shade(c, 0.78)  # sombra sutil da borda da grama
                cv.put(x, y, rgba(c))
    # tufinhos extras cruzando a fronteira
    for x in range(0, T, 3):
        wave = int(16.0 + math.sin(x / T * math.tau) * 3.2)
        if h01(x, wave, 623) < 0.65:
            ty = wave + (1 if grass_top else -1)
            cv.put(x, ty % T, rgba(GRASS_L))
            cv.put(x, (ty - 1) % T, rgba(GRASS_H))
    return cv


def tile_dirt_ash() -> Canvas:
    """Mancha de cinzas, fuligem e pedrinhas ao redor da fogueira central."""
    cv = tile_dirt(0)
    for y in range(T):
        for x in range(T):
            d = math.hypot((x + 0.5 - 16) / 14.5, (y + 0.5 - 16) / 13.0)
            n = (vnoise(x, y, T, 701, 4.0) - 0.5) * 0.28
            if d + n < 1.0:
                k = max(0.0, min(1.0, (1.0 - (d + n)) * 1.15))
                ash = (42, 38, 36) if h01(x, y, 709) > 0.25 else (66, 62, 58)
                if d < 0.35 and h01(x, y, 719) < 0.14:
                    ash = (96, 54, 34)  # leve brasa apagada
                cv.put(x, y, rgba(mix(cv.get(x, y)[:3], ash, k * 0.82)))
    for (px, py) in ((9, 12), (22, 14), (13, 23), (20, 22), (16, 9)):
        cv.put(px, py, rgba(ST_M))
        cv.put(px + 1, py, rgba(ST_D))
    return cv


def tile_dirt_cobble() -> Canvas:
    """Terra batida com pedras desgastadas esparsas (entrada do portao / porta da casa)."""
    cv = tile_dirt(1)
    stones = [
        (5, 5, 7, 5), (15, 4, 8, 5), (24, 7, 6, 5),
        (3, 14, 8, 6), (14, 13, 9, 6), (25, 16, 6, 5),
        (6, 23, 8, 6), (17, 22, 7, 6), (25, 24, 6, 5),
    ]
    for i, (sx, sy, sw, sh) in enumerate(stones):
        base = ST_TONES[i % len(ST_TONES)]
        for yy in range(sh):
            for xx in range(sw):
                if (xx in (0, sw - 1)) and (yy in (0, sh - 1)):
                    continue
                x, y = (sx + xx) % T, (sy + yy) % T
                if yy == 0 or xx == 0:
                    c = shade(base, 1.18)
                elif yy == sh - 1 or xx == sw - 1:
                    c = shade(base, 0.72)
                else:
                    c = base
                cv.put(x, y, rgba(c))
    return cv


def build_tiles() -> List[Tuple[str, Canvas]]:
    return [
        ("dirt_0", tile_dirt(0)),
        ("dirt_1", tile_dirt(1)),
        ("dirt_2", tile_dirt(2)),
        ("dirt_trail", tile_dirt_trail()),
        ("grass_0", tile_grass(0)),
        ("grass_1", tile_grass(1)),
        ("dirt_grass_n", tile_dirt_grass_transition(True)),
        ("dirt_grass_s", tile_dirt_grass_transition(False)),
        ("dirt_ash", tile_dirt_ash()),
        ("dirt_cobble", tile_dirt_cobble()),
    ]


# ---------------------------------------------------------------------------
# 2. Props 32x32 (RGBA transparente + sombra de contato)
# ---------------------------------------------------------------------------

def draw_stake(cv: Canvas, x0: int, y_top: int, y_bot: int, w: int, seed: int) -> None:
    """Estaca de madeira bem afiada no topo, com grao vertical e iluminacao esquerda."""
    mid = x0 + (w - 1) / 2.0
    tip_h = max(4, min(7, w))
    for y in range(y_top, y_bot + 1):
        dy = y - y_top
        for xx in range(w):
            x = x0 + xx
            if dy < tip_h:
                half_w = (dy + 0.5) / float(tip_h) * (w / 2.0)
                if abs(x - mid) > half_w:
                    continue
            if dy < tip_h:
                c = PAL_H if x < mid else (PAL_L if x <= mid + 0.5 else PAL_M)
            elif xx == 0:
                c = PAL_L
            elif xx == w - 1:
                c = PAL_D
            else:
                c = PAL_M
                if h01(x, y, seed) < 0.22:
                    c = PAL_D
            if y >= y_bot - 1:
                c = PAL_DD
            cv.put(x, y, rgba(c))


def prop_palisade_h() -> Canvas:
    body = Canvas(T, T)
    stakes = [(0, 4, 5), (5, 1, 6), (11, 5, 5), (16, 2, 5), (21, 1, 6), (27, 4, 5)]
    for i, (sx, yt, sw) in enumerate(stakes):
        draw_stake(body, sx, yt, 28, sw, 800 + i)
    # travessa horizontal amarrada
    for y in (14, 15, 16, 22, 23, 24):
        for x in range(T):
            c = W_L if y in (14, 22) else (W if y in (15, 23) else W_D)
            if x in (4, 15, 26):
                c = W_DD  # corda/prego
            body.put(x, y, rgba(c))
    cv = outline(body)
    contact_shadow(cv, 0, T, 29, 115)
    return cv


def prop_palisade_v(right_side: bool) -> Canvas:
    body = Canvas(T, T)
    x_base = 17 if right_side else 8
    # estacas em perspectiva empilhadas em Y (emendam sem fresta verticalmente)
    for i, yt in enumerate((-4, 4, 12, 20, 27)):
        sx = x_base + (i % 2)
        draw_stake(body, sx, max(0, yt), min(31, yt + 13), 7, 830 + i)
    # travessa vertical lateral continua de y=0..31
    tx = x_base - 2 if right_side else x_base + 7
    for y in range(T):
        body.put(tx, y, rgba(W_L if not right_side else W_D))
        body.put(tx + 1, y, rgba(W))
    cv = outline(body)
    # remove linha de contorno em y=0 e y=31 sobre a travessa/estaca para emenda continua em Y
    for x in range(T):
        if body.get(x, 0)[3]:
            cv.put(x, 0, body.get(x, 0))
        if body.get(x, 31)[3]:
            cv.put(x, 31, body.get(x, 31))
    return cv


def prop_palisade_corner(top: bool) -> Canvas:
    body = Canvas(T, T)
    if top:
        # estacas horizontais a direita + poste de canto + descida vertical
        draw_stake(body, 9, 2, 28, 7, 861)
        draw_stake(body, 16, 4, 27, 5, 862)
        draw_stake(body, 21, 2, 27, 6, 863)
        draw_stake(body, 27, 4, 27, 5, 864)
        for y in (13, 14, 15, 22, 23):
            for x in range(11, T):
                body.put(x, y, rgba(W_L if y in (13, 22) else (W if y == 14 else W_D)))
    else:
        draw_stake(body, 9, 0, 28, 7, 871)
        draw_stake(body, 16, 5, 28, 5, 872)
        draw_stake(body, 21, 3, 28, 6, 873)
        draw_stake(body, 27, 5, 28, 5, 874)
        for y in (15, 16, 17, 23, 24):
            for x in range(11, T):
                body.put(x, y, rgba(W_L if y in (15, 23) else (W if y == 16 else W_D)))
    cv = outline(body)
    contact_shadow(cv, 8, T, 29, 115)
    return cv


def prop_palisade_end() -> Canvas:
    body = Canvas(T, T)
    draw_stake(body, 11, 2, 28, 9, 881)
    # cinta de ferro na estaca terminal
    for y in (12, 13, 21, 22):
        for x in range(11, 20):
            body.put(x, y, rgba(IRON_L if y in (12, 21) and x < 16 else IRON_D))
    cv = outline(body)
    ellipse_shadow(cv, 15.5, 29.0, 6.5, 2.2, 115)
    return cv


def prop_campfire(frame: int) -> Canvas:
    body = Canvas(T, T)
    # cama de brasas no centro
    fill_ellipse(
        body, 16, 22, 8.5, 4.2,
        lambda x, y, nx, ny: rgba(
            FL_O if (nx * nx + ny * ny) < 0.35 else (FL_DR if (x + y + frame) % 3 else (46, 28, 22))
        ),
    )
    # pedras em circulo (parte de tras)
    back_stones = [(9, 19), (14, 18), (19, 18), (23, 19)]
    for i, (sx, sy) in enumerate(back_stones):
        fill_ellipse(body, sx, sy, 3.0, 2.2, lambda x, y, nx, ny, k=i: rgba(
            shade(ST_TONES[k % len(ST_TONES)], 1.15 if ny < 0 else 0.72)))
    # lenha cruzada
    for (x0, y0, x1, y1) in ((9, 24, 22, 19), (10, 19, 23, 24)):
        line(body, x0, y0, x1, y1, rgba(W_D))
        line(body, x0, y0 - 1, x1, y1 - 1, rgba(W))
    # pedras da frente
    front_stones = [(8, 23), (12, 26), (17, 26), (22, 25), (25, 22)]
    for i, (sx, sy) in enumerate(front_stones):
        fill_ellipse(body, sx, sy, 3.1, 2.2, lambda x, y, nx, ny, k=i: rgba(
            shade(ST_TONES[(k + 1) % len(ST_TONES)], 1.2 if ny < -0.1 else 0.7)))
    # brilho quente nas pedras
    draw_warm_glow(body, 16, 21, 10.5, 6.5, FL_O, 110 + (frame % 2) * 20)

    # chamas vivas com variacao real de silhueta por frame
    configs = [
        (14.5, 21, 13.5, 4.4, -1.2),
        (16.0, 21, 15.5, 4.0, 1.5),
        (15.5, 21, 12.5, 4.8, 0.4),
        (16.5, 21, 14.8, 4.2, -1.8),
    ]
    cx, by, fh, fw, sw = configs[frame]
    draw_flame(body, cx - 2.5, by, fh * 0.72, fw * 0.65, sw - 0.8, frame + 10)
    draw_flame(body, cx + 2.5, by, fh * 0.68, fw * 0.62, sw + 0.9, frame + 20)
    draw_flame(body, cx, by, fh, fw, sw, frame + 30)

    # faiscas subindo
    sparks = [
        [(13, 6, FL_Y), (20, 9, FL_A), (16, 4, FL_O)],
        [(18, 5, FL_Y), (12, 8, FL_A), (15, 2, FL_O)],
        [(14, 7, FL_Y), (21, 6, FL_A), (17, 3, FL_W)],
        [(11, 5, FL_Y), (19, 8, FL_A), (14, 3, FL_O)],
    ][frame]
    cv = Canvas(T, T)
    ellipse_shadow(cv, 16, 27.5, 11.5, 3.0, 125)
    blit(cv, outline(body), 0, 0)
    for (sx, sy, sc) in sparks:
        cv.put(sx, sy, rgba(sc))
    return cv


def prop_brazier(frame: int) -> Canvas:
    body = Canvas(T, T)
    # pernas do tripe de ferro
    line(body, 11, 19, 8, 28, rgba(IRON))
    line(body, 12, 19, 9, 28, rgba(IRON_D))
    line(body, 20, 19, 23, 28, rgba(IRON))
    line(body, 21, 19, 24, 28, rgba(IRON_D))
    fill_rect(body, 15, 20, 2, 8, rgba(IRON_D))
    # aro transversal
    fill_rect(body, 10, 23, 12, 2, rgba(IRON))
    # bacia de ferro
    for y in range(13, 21):
        half = 8.5 - (y - 13) * 0.55
        for x in range(int(16 - half), int(16 + half) + 1):
            c = IRON_L if x < 13 else (IRON if x < 19 else IRON_D)
            if y == 13:
                c = IRON_H if x < 16 else IRON_L
            elif y == 20:
                c = IRON_DD
            body.put(x, y, rgba(c))
    # brasas na boca
    fill_ellipse(body, 16, 13, 7.0, 2.2, lambda x, y, nx, ny: rgba(
        FL_Y if (nx * nx + ny * ny) < 0.25 else (FL_O if (x + frame) % 2 else FL_R)))
    # chama animada
    fh = (10.5, 12.0, 9.5, 11.2)[frame]
    sw = (-1.0, 1.2, 0.3, -1.4)[frame]
    draw_flame(body, 16.0, 13, fh, 4.4, sw, frame + 50)
    draw_warm_glow(body, 16, 14, 9.0, 5.0, FL_A, 95)

    cv = Canvas(T, T)
    ellipse_shadow(cv, 16, 28.5, 9.0, 2.5, 115)
    blit(cv, outline(body), 0, 0)
    spark_xy = [(14, 2), (18, 3), (15, 1), (19, 2)][frame]
    cv.put(spark_xy[0], spark_xy[1], rgba(FL_Y))
    return cv


def prop_torch_post(frame: int) -> Canvas:
    body = Canvas(T, T)
    # poste de madeira rustico
    for y in range(12, 29):
        body.put(14, y, rgba(W_L))
        body.put(15, y, rgba(W if h01(15, y, 3) > 0.2 else W_D))
        body.put(16, y, rgba(W))
        body.put(17, y, rgba(W_D))
    # suporte/cesto de ferro no topo
    fill_rect(body, 12, 10, 8, 3, rgba(IRON))
    fill_rect(body, 12, 10, 8, 1, rgba(IRON_L))
    fill_rect(body, 13, 13, 6, 2, rgba(IRON_D))
    # chama tremulante
    fh = (8.5, 9.8, 7.8, 9.2)[frame]
    sw = (-1.1, 1.3, 0.2, -0.9)[frame]
    draw_flame(body, 15.8, 10, fh, 3.3, sw, frame + 70)
    draw_warm_glow(body, 16, 12, 5.5, 4.5, FL_A, 90)

    cv = Canvas(T, T)
    ellipse_shadow(cv, 15.5, 29.0, 5.5, 2.0, 115)
    blit(cv, outline(body), 0, 0)
    spx = (14, 18, 16, 13)[frame]
    cv.put(spx, 1 + (frame % 2), rgba(FL_Y))
    return cv


def prop_forge(frame: int) -> Canvas:
    """Forja de pedra 2.5D com brasa acesa, fogo e faiscas (4 frames)."""
    body = Canvas(T, T)
    # corpo de alvenaria (blocos de pedra 2.5D)
    draw_stone_block(body, 3, 13, 9, 6, ST_M, 901)
    draw_stone_block(body, 12, 13, 10, 6, ST_L, 902)
    draw_stone_block(body, 22, 13, 7, 6, ST_D, 903)
    draw_stone_block(body, 3, 19, 7, 5, ST_D, 904)
    draw_stone_block(body, 10, 19, 10, 5, ST_M, 905)
    draw_stone_block(body, 20, 19, 9, 5, ST_D, 906)
    draw_stone_block(body, 3, 24, 9, 5, ST_M, 907)
    draw_stone_block(body, 12, 24, 8, 5, ST_D, 908)
    draw_stone_block(body, 20, 24, 9, 5, ST_D, 909)
    # topo da forja (borda de pedra + leito de brasa)
    fill_rect(body, 3, 9, 26, 4, rgba(ST_L))
    fill_rect(body, 3, 9, 26, 1, rgba(ST_H))
    fill_rect(body, 6, 10, 20, 3, rgba((44, 20, 14)))
    # brasas pulsantes
    for x in range(7, 25):
        for y in (10, 11, 12):
            v = h01(x, y, 950 + frame)
            if v > 0.72:
                c = FL_W if frame in (1, 3) else FL_Y
            elif v > 0.42:
                c = FL_A
            elif v > 0.18:
                c = FL_O
            else:
                c = FL_DR
            body.put(x, y, rgba(c))
    # abertura inferior da fornalha (respiro de brasa)
    fill_rect(body, 12, 22, 8, 5, rgba((28, 14, 12)))
    fill_rect(body, 13, 24, 6, 3, rgba(FL_R if frame % 2 == 0 else FL_O))
    fill_rect(body, 14, 25, 4, 2, rgba(FL_A if frame % 2 else FL_O))

    # chamas curtas e fumaca/faiscas saindo da brasa
    draw_flame(body, 13.5, 11, (6.0, 7.5, 5.5, 7.0)[frame], 3.2, (-0.8, 0.9, 0.2, -0.6)[frame], frame + 90)
    draw_flame(body, 19.5, 11, (5.2, 6.2, 6.8, 5.4)[frame], 2.8, (0.6, -0.5, 0.9, -0.7)[frame], frame + 95)
    draw_warm_glow(body, 16, 13, 12.0, 6.5, FL_O, 105)

    cv = Canvas(T, T)
    contact_shadow(cv, 3, 29, 29, 120)
    blit(cv, outline(body), 0, 0)
    # fumaca sutil + faiscas voando
    smoke_y = 3 - (frame % 2)
    cv.blend_pixel(16, smoke_y, (110, 104, 100, 110))
    cv.blend_pixel(17, smoke_y - 1, (110, 104, 100, 80))
    sparks = [
        [(10, 4, FL_Y), (22, 3, FL_A)],
        [(12, 2, FL_W), (24, 5, FL_O)],
        [(9, 3, FL_A), (21, 2, FL_Y)],
        [(13, 4, FL_O), (23, 3, FL_Y)],
    ][frame]
    for (sx, sy, sc) in sparks:
        cv.put(sx, sy, rgba(sc))
    return cv


def prop_anvil() -> Canvas:
    """Bigorna de ferro 3/4 sobre toco de madeira."""
    body = Canvas(T, T)
    # toco de madeira robusto
    for y in range(18, 29):
        for x in range(8, 24):
            d = (x - 15.5) / 8.0
            c = W_L if d < -0.35 else (W if d < 0.4 else W_D)
            if (x + y * 2) % 6 == 0:
                c = W_D
            if y == 28:
                c = W_DD
            body.put(x, y, rgba(c))
    # topo do toco
    fill_ellipse(body, 16, 18, 8.0, 2.4, lambda x, y, nx, ny: rgba(W_H if ny < 0 else W_L))
    # pe da bigorna
    fill_rect(body, 10, 15, 12, 3, rgba(IRON_D))
    fill_rect(body, 11, 15, 10, 1, rgba(IRON))
    # cintura da bigorna
    fill_rect(body, 12, 12, 8, 3, rgba(IRON_D))
    fill_rect(body, 13, 12, 4, 3, rgba(IRON))
    # mesa superior da bigorna + chifre a esquerda
    fill_rect(body, 9, 7, 17, 5, rgba(IRON))
    fill_rect(body, 9, 7, 17, 2, rgba(IRON_H))
    fill_rect(body, 9, 11, 17, 1, rgba(IRON_DD))
    # chifre afunilado a esquerda (x=4..9)
    for x in range(4, 10):
        h = max(1, int((x - 3) * 0.7))
        for dy in range(h):
            c = IRON_H if dy == 0 else (IRON_L if dy == 1 else IRON_D)
            body.put(x, 8 + dy, rgba(c))
    # cauda a direita
    fill_rect(body, 25, 8, 3, 3, rgba(IRON_L))
    body.put(27, 10, rgba(IRON_D))

    cv = Canvas(T, T)
    ellipse_shadow(cv, 16, 29.0, 9.5, 2.5, 120)
    blit(cv, outline(body), 0, 0)
    return cv


def prop_sign_exit() -> Canvas:
    """Placa de madeira em poste com texto SAIDA."""
    body = Canvas(T, T)
    # poste
    for y in range(16, 29):
        body.put(15, y, rgba(W_L))
        body.put(16, y, rgba(W))
        body.put(17, y, rgba(W_D))
    # tabua da placa
    for y in range(6, 17):
        for x in range(2, 30):
            if y in (6, 16) or x in (2, 29):
                c = W_DD
            elif y == 7 or x == 3:
                c = W_L
            else:
                c = W if (y % 3) else shade(W, 0.88)
            body.put(x, y, rgba(c))
    draw_pixel_word(body, "SAÍDA", 4, 9, (236, 220, 182), W_DD)
    cv = Canvas(T, T)
    ellipse_shadow(cv, 16, 29.0, 6.0, 2.0, 110)
    blit(cv, outline(body), 0, 0)
    return cv


def prop_firewood() -> Canvas:
    body = Canvas(T, T)
    logs = [(8, 25), (16, 25), (24, 25), (12, 19), (20, 19), (16, 13)]
    for (cx, cy) in logs:
        def col(x, y, nx, ny):
            d = math.hypot(nx, ny)
            if d > 0.76:
                return rgba(W_D if nx + ny > -0.3 else W)
            if abs(d - 0.45) < 0.13:
                return rgba(W_L)
            return rgba((178, 142, 90) if d < 0.32 else (152, 116, 72))
        fill_ellipse(body, cx, cy, 4.4, 3.8, col)
    cv = Canvas(T, T)
    contact_shadow(cv, 4, 28, 29, 115)
    blit(cv, outline(body), 0, 0)
    return cv


def prop_barrel() -> Canvas:
    body = Canvas(T, T)
    for y in range(7, 28):
        ny = (y - 17.5) / 10.5
        half = 9.0 - ny * ny * 2.2
        for x in range(int(16 - half), int(16 + half) + 1):
            nx = (x + 0.5 - 16) / max(half, 1.0)
            c = shade(W, 1.25 - 0.55 * (nx + 1) / 2)
            if (x - 8) % 3 == 0:
                c = shade(c, 0.78)
            body.put(x, y, rgba(c))
    # tampa
    fill_ellipse(body, 16, 8, 7.2, 2.6, lambda x, y, nx, ny: rgba(
        W_D if nx * nx + ny * ny > 0.72 else (W_H if ny < 0 else W_L)))
    # aros de ferro
    for hy in (12, 22):
        for x in range(6, 26):
            if body.get(x, hy)[3]:
                body.put(x, hy, rgba(IRON_L if x < 15 else IRON))
                body.put(x, hy + 1, rgba(IRON_D))
    cv = Canvas(T, T)
    ellipse_shadow(cv, 16, 28.5, 9.5, 2.6, 120)
    blit(cv, outline(body), 0, 0)
    return cv


def prop_cart_wheel() -> Canvas:
    body = Canvas(T, T)
    cx, cy = 16, 17
    for y in range(4, 30):
        for x in range(3, 29):
            d = math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.05)
            if 9.2 <= d < 12.2:
                c = W_L if (x - cx) + (y - cy) < -3 else (W if d < 11.3 else IRON)
                if d >= 11.4:
                    c = IRON_L if (x - cx) + (y - cy) < 0 else IRON_D
                body.put(x, y, rgba(c))
    for k in range(8):
        a = k * math.pi / 4 + 0.2
        line(body, cx, cy, int(round(cx + math.cos(a) * 9.8)), int(round(cy + math.sin(a) * 9.8)), rgba(W))
    fill_ellipse(body, cx, cy, 2.8, 2.8, lambda x, y, nx, ny: rgba(IRON_L if nx + ny < 0 else IRON_D))
    cv = Canvas(T, T)
    ellipse_shadow(cv, 16, 29.0, 9.5, 2.2, 110)
    blit(cv, outline(body), 0, 0)
    return cv


def prop_wooden_cart() -> Canvas:
    """Pequena carroca de madeira 3/4 (referencia proxima ao portao)."""
    body = Canvas(T, T)
    # varais a esquerda
    line(body, 2, 22, 9, 19, rgba(W_L))
    line(body, 2, 23, 9, 20, rgba(W_D))
    # cacamba de madeira
    for y in range(10, 22):
        for x in range(8, 28):
            c = W_L if y == 10 else (W if (y - 10) % 4 else W_D)
            if x in (8, 14, 21, 27):
                c = W_D
            body.put(x, y, rgba(c))
    # feno/sacos dentro da cacamba
    fill_ellipse(body, 18, 10, 7.0, 2.8, lambda x, y, nx, ny: rgba(TH_L if ny < 0 else TH_M))
    # roda em primeiro plano
    cx, cy = 19, 23
    for y in range(17, 30):
        for x in range(13, 26):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if 4.0 <= d < 6.0:
                body.put(x, y, rgba(IRON if d >= 5.2 else W_L))
    for k in range(6):
        a = k * math.pi / 3
        line(body, cx, cy, int(round(cx + math.cos(a) * 4.5)), int(round(cy + math.sin(a) * 4.5)), rgba(W))
    fill_ellipse(body, cx, cy, 1.6, 1.6, lambda x, y, nx, ny: rgba(IRON_L))

    cv = Canvas(T, T)
    ellipse_shadow(cv, 17, 29.0, 12.0, 2.4, 120)
    blit(cv, outline(body), 0, 0)
    return cv


def build_props() -> List[Tuple[str, Canvas]]:
    frames: List[Tuple[str, Canvas]] = [
        ("palisade_h", prop_palisade_h()),
        ("palisade_v_l", prop_palisade_v(False)),
        ("palisade_v_r", prop_palisade_v(True)),
        ("palisade_corner_t", prop_palisade_corner(True)),
        ("palisade_corner_b", prop_palisade_corner(False)),
        ("palisade_end", prop_palisade_end()),
    ]
    frames += [(f"campfire_{i}", prop_campfire(i)) for i in range(4)]
    frames += [(f"brazier_{i}", prop_brazier(i)) for i in range(4)]
    frames += [(f"torch_post_{i}", prop_torch_post(i)) for i in range(4)]
    frames += [(f"forge_{i}", prop_forge(i)) for i in range(4)]
    frames += [
        ("anvil", prop_anvil()),
        ("sign_exit", prop_sign_exit()),
        ("firewood", prop_firewood()),
        ("barrel", prop_barrel()),
        ("cart_wheel", prop_cart_wheel()),
        ("wooden_cart", prop_wooden_cart()),
    ]
    return frames


# ---------------------------------------------------------------------------
# 3. Estrutura 2.5D: Casa de Palha (192x160)
# ---------------------------------------------------------------------------

def build_house() -> Canvas:
    W_H_IMG, H_IMG = 192, 160
    body = Canvas(W_H_IMG, H_IMG)

    # Coordenadas principais da casa 2.5D (frente voltada p/ frente-direita como na ref_m9)
    wall_x0, wall_x1 = 28, 166
    wall_y0, wall_y1 = 78, 144

    # 1) Parede de barro/reboco envelhecido
    for y in range(wall_y0, wall_y1 - 18):
        for x in range(wall_x0, wall_x1):
            n = vnoise(x, y, 64, 1101, 8.0)
            c = mix(PL_D, PL_L, n)
            if x < 64:
                c = shade(c, 0.84)  # lateral esquerda um pouco mais sombria
            r = h01(x, y, 1107)
            if r < 0.08:
                c = shade(c, 0.88)
            body.put(x, y, rgba(c))

    # 2) Embasamento de pedra na base da parede
    found_h = 20
    sub_found = Canvas(wall_x1 - wall_x0, found_h)
    voronoi_stones(
        sub_found, 1121, 24, ST_TONES, ST_CRACK, 1.2, 0.72,
        sx=1.6, sy=1.0, w=wall_x1 - wall_x0, h=found_h, wrap=False,
    )
    blit(body, sub_found, wall_x0, wall_y1 - found_h)
    # linha de contato escura na base
    fill_rect(body, wall_x0, wall_y1 - 2, wall_x1 - wall_x0, 2, rgba((26, 22, 20)))

    # 3) Vigas de madeira escura (enxaimel rustico)
    for vx in (wall_x0, 62, 100, 142, wall_x1 - 5):
        for y in range(wall_y0, wall_y1):
            for dx in range(5):
                c = W_L if dx == 0 else (W_D if dx >= 3 else W)
                if dx == 4:
                    c = W_DD
                body.put(vx + dx, y, rgba(c))
    # travessas horizontais
    for vy in (wall_y0, wall_y1 - found_h - 3):
        for x in range(wall_x0, wall_x1):
            for dy in range(4):
                c = W_L if dy == 0 else (W if dy < 3 else W_DD)
                body.put(x, vy + dy, rgba(c))

    # 4) Janela rustica a esquerda da porta
    jx0, jy0, jw, jh = 39, 94, 18, 18
    fill_rect(body, jx0, jy0, jw, jh, rgba(W_DD))
    fill_rect(body, jx0 + 2, jy0 + 2, jw - 4, jh - 4, rgba((32, 22, 18)))
    # brilho morno interno discreto
    for y in range(jy0 + 3, jy0 + jh - 3):
        for x in range(jx0 + 3, jx0 + jw - 3):
            t = (y - jy0) / float(jh)
            body.put(x, y, rgba(mix((82, 48, 24), (146, 94, 42), t)))
    fill_rect(body, jx0 + jw // 2 - 1, jy0 + 2, 2, jh - 4, rgba(W_D))
    fill_rect(body, jx0 + 2, jy0 + jh // 2 - 1, jw - 4, 2, rgba(W_D))
    fill_rect(body, jx0 - 2, jy0 + jh, jw + 4, 3, rgba(W_L))
    fill_rect(body, jx0 - 2, jy0 + jh + 2, jw + 4, 1, rgba(W_DD))

    # 5) Porta de madeira frontal bem definida (para posicionar Lyra)
    dx0, dy0, dw, dh = 105, 86, 36, 56
    # batente
    fill_rect(body, dx0 - 3, dy0 - 3, dw + 6, dh + 3, rgba(W_D))
    fill_rect(body, dx0 - 3, dy0 - 3, dw + 6, 2, rgba(W_L))
    fill_rect(body, dx0 - 2, dy0 - 2, 2, dh + 2, rgba(W_L))
    # folha de tabuas verticais
    for y in range(dy0, dy0 + dh):
        for x in range(dx0, dx0 + dw):
            plank = (x - dx0) // 6
            px = (x - dx0) % 6
            base = shade(W, 0.92 + (plank % 2) * 0.1)
            if px == 0:
                c = W_DD
            elif px == 1:
                c = shade(base, 1.15)
            elif px == 5:
                c = shade(base, 0.78)
            else:
                c = base
                if h01(x, y, 1141) < 0.14:
                    c = shade(c, 0.85)
            body.put(x, y, rgba(c))
    # travessas horizontais da porta + dobradicas de ferro + macaneta
    for ty in (dy0 + 10, dy0 + 42):
        fill_rect(body, dx0, ty, dw, 4, rgba(W_D))
        fill_rect(body, dx0, ty, dw, 1, rgba(W_L))
        # dobradica esquerda
        fill_rect(body, dx0 + 1, ty + 1, 9, 2, rgba(IRON))
        body.put(dx0 + 3, ty + 1, rgba(IRON_H))
        body.put(dx0 + 7, ty + 1, rgba(IRON_H))
    # argola / macaneta a direita
    fill_rect(body, dx0 + dw - 7, dy0 + 27, 4, 5, rgba(IRON_L))
    fill_rect(body, dx0 + dw - 6, dy0 + 29, 2, 2, rgba(W_DD))
    # degrau de pedra na soleira
    draw_stone_block(body, dx0 - 4, dy0 + dh, dw + 8, 6, ST_L, 1155)

    # 6) Sombra projetada pelo beiral do telhado sobre a parede
    for y in range(wall_y0, wall_y0 + 10):
        k = (10 - (y - wall_y0)) / 10.0 * 0.55
        for x in range(wall_x0, wall_x1):
            cur = body.get(x, y)
            if cur[3]:
                body.put(x, y, rgba(shade(cur[:3], 1.0 - k)))

    # 7) Telhado de sape / palha inclinado 2.5D
    # Geometria: cumeeira inclinada levemente de (48, 20) ate (138, 22),
    # beiral frontal em y=84..90 de x=14..180, empena triangular a direita
    ridge_y = 22
    eave_y = 86
    for y in range(ridge_y, eave_y + 4):
        t = (y - ridge_y) / float(eave_y - ridge_y)
        x_left = int(46 - t * 32)
        x_right = int(142 + t * 38)
        for x in range(x_left, x_right):
            # borda irregular de feixes de palha no beiral inferior
            eave_drop = int((h01(x // 2, 1, 1201) - 0.5) * 6)
            if y > eave_y + eave_drop:
                continue
            # textura direcional de feixes de palha (fios inclinados)
            slope_x = x - int((y - ridge_y) * 0.25)
            strand = h01(slope_x, y // 2, 1213)
            layer = (y - ridge_y) % 11
            n = vnoise(x, y, 64, 1223, 6.0)
            # luz de cima-esquerda, sombra na parte inferior de cada camada de sape
            lit = 1.0 - t * 0.22 - (x - x_left) / max(1.0, (x_right - x_left)) * 0.18
            if layer >= 9:
                c = TH_DD if strand < 0.7 else TH_D
            elif strand > 0.78 and lit > 0.65:
                c = TH_H
            elif strand > 0.45 or n > 0.58:
                c = TH_L if lit > 0.6 else TH_M
            elif strand > 0.18:
                c = TH_M if lit > 0.52 else TH_D
            else:
                c = TH_D
            if y >= eave_y - 2 + eave_drop:
                c = shade(c, 0.68)
            body.put(x, y, rgba(c))

    # Remendo de tabuas escuras no telhado (detalhe caracteristico da ref_m9)
    for y in range(44, 62):
        for x in range(44, 68):
            if (x - 44) % 6 == 0:
                c = W_DD
            else:
                c = W_D if (y % 4) else W
            body.put(x, y, rgba(c))

    # Cumeeira e toras cruzadas no topo do telhado (como na referencia)
    for x in range(44, 144):
        body.put(x, ridge_y - 1, rgba(TH_H))
        body.put(x, ridge_y, rgba(TH_L))
        body.put(x, ridge_y + 1, rgba(TH_D))
    for cx in (54, 96, 134):
        line(body, cx - 7, ridge_y - 7, cx + 6, ridge_y + 5, rgba(W_D))
        line(body, cx - 6, ridge_y - 7, cx + 7, ridge_y + 5, rgba(W_L))
        line(body, cx + 7, ridge_y - 7, cx - 6, ridge_y + 5, rgba(W_D))
        line(body, cx + 6, ridge_y - 7, cx - 7, ridge_y + 5, rgba(W_L))

    # Bordas de madeira nas empenas esquerda e direita (caibros aparentes)
    for t_i in range(eave_y - ridge_y + 4):
        y = ridge_y + t_i
        t = t_i / float(eave_y - ridge_y)
        xl = int(46 - t * 32)
        xr = int(142 + t * 38)
        for dx in range(0, 4):
            body.put(xl + dx, y, rgba(W_L if dx == 0 else (W if dx < 3 else W_DD)))
        for dx in range(-4, 1):
            body.put(xr + dx, y, rgba(W_L if dx == -4 else (W if dx < -1 else W_DD)))

    # Composicao final com sombra de contato suave no chao + contorno nitido
    cv = Canvas(W_H_IMG, H_IMG)
    ellipse_shadow(cv, 98, 147, 78, 9.5, 130)
    blit(cv, outline(body), 0, 0)
    return cv


# ---------------------------------------------------------------------------
# 4. Estrutura 2.5D: Portao de Pedra com placa "SAIDA" (160x128)
# ---------------------------------------------------------------------------

def build_gate() -> Canvas:
    W_G, H_G = 160, 128
    body = Canvas(W_G, H_G)

    # Pilar esquerdo (x=14..46, y=22..116) e pilar direito (x=104..136, y=22..116)
    def draw_pillar(x0: int, seed_base: int) -> None:
        pw = 32
        # capitel superior saliente
        draw_stone_block(body, x0 - 4, 14, pw + 8, 9, ST_H, seed_base)
        fill_rect(body, x0 - 4, 23, pw + 8, 2, rgba(ST_CRACK))
        # fiadas de alvenaria alternadas
        y = 25
        row = 0
        while y < 116:
            bh = min(11, 116 - y)
            if row % 2 == 0:
                draw_stone_block(body, x0, y, 18, bh, ST_TONES[row % 4], seed_base + row * 3)
                draw_stone_block(body, x0 + 18, y, 14, bh, ST_TONES[(row + 2) % 4], seed_base + row * 3 + 1)
            else:
                draw_stone_block(body, x0, y, 12, bh, ST_TONES[(row + 1) % 4], seed_base + row * 3)
                draw_stone_block(body, x0 + 12, y, 20, bh, ST_TONES[(row + 3) % 4], seed_base + row * 3 + 1)
            y += bh
            row += 1
        # musgo sutil na base do pilar
        for (mx, my) in ((x0 + 3, 112), (x0 + 4, 111), (x0 + 25, 113), (x0 + 26, 112)):
            body.put(mx, my, rgba(GRASS_M))
            body.put(mx, my - 1, rgba(GRASS_L))

    draw_pillar(16, 1400)
    draw_pillar(104, 1500)

    # Folha de portao de madeira entreaberta encostada no pilar esquerdo (x=46..58, y=44..114)
    for y in range(44, 115):
        for x in range(46, 58):
            c = W if (x - 46) % 3 else W_D
            if x == 57:
                c = W_L
            if y in (58, 59, 96, 97):
                c = IRON_L if y % 2 == 0 else IRON_D
            body.put(x, y, rgba(c))

    # Viga superior de madeira escura unindo os pilares (x=42..112, y=26..40)
    for y in range(26, 40):
        for x in range(42, 112):
            if y == 26:
                c = W_H
            elif y == 27:
                c = W_L
            elif y >= 38:
                c = W_DD
            else:
                c = W if h01(x, y, 1601) > 0.16 else W_D
            body.put(x, y, rgba(c))
    # reforcos de ferro na viga superior
    for bx in (46, 74, 102):
        fill_rect(body, bx, 26, 6, 14, rgba(IRON))
        fill_rect(body, bx, 26, 2, 14, rgba(IRON_L))
        fill_rect(body, bx + 5, 26, 1, 14, rgba(IRON_DD))
        body.put(bx + 2, 29, rgba(IRON_H))
        body.put(bx + 2, 36, rgba(IRON_H))

    # Maos-francesas diagonais (suportes de madeira entre viga e pilares)
    for i in range(16):
        # esquerda
        for dy in range(4):
            body.put(46 + i, 54 - i + dy, rgba(W_L if dy == 0 else (W if dy < 3 else W_DD)))
        # direita
        for dy in range(4):
            body.put(105 - i, 54 - i + dy, rgba(W_L if dy == 0 else (W if dy < 3 else W_DD)))

    # Sombra projetada pela viga superior sobre a parte interna dos pilares
    for y in range(40, 46):
        k = (46 - y) / 6.0 * 0.42
        for x in list(range(38, 48)) + list(range(104, 114)):
            cur = body.get(x, y)
            if cur[3]:
                body.put(x, y, rgba(shade(cur[:3], 1.0 - k)))

    # Placa legivel "SAIDA" presa a direita do pilar direito (x=118..156, y=54..72)
    # suporte de madeira fixado no pilar
    fill_rect(body, 134, 58, 4, 10, rgba(W_D))
    sx0, sy0, sw, sh = 116, 54, 40, 17
    for y in range(sy0, sy0 + sh):
        for x in range(sx0, sx0 + sw):
            if x in (sx0, sx0 + sw - 1) or y in (sy0, sy0 + sh - 1):
                c = W_DD
            elif x == sx0 + 1 or y == sy0 + 1:
                c = W_L
            else:
                c = W_D if (y - sy0) % 4 == 0 else W
            body.put(x, y, rgba(c))
    # pregos nos cantos da placa
    for (px, py) in ((sx0 + 2, sy0 + 2), (sx0 + sw - 3, sy0 + 2), (sx0 + 2, sy0 + sh - 3), (sx0 + sw - 3, sy0 + sh - 3)):
        body.put(px, py, rgba(IRON_L))
    # texto "SAIDA" bem legivel
    draw_pixel_word(body, "SAÍDA", sx0 + 9, sy0 + 6, (244, 228, 188), W_DD)

    # Sombra de contato sob os dois pilares (deixando a passagem central livre/transparente!)
    cv = Canvas(W_G, H_G)
    ellipse_shadow(cv, 32, 117, 22, 5.5, 130)
    ellipse_shadow(cv, 120, 117, 22, 5.5, 130)
    blit(cv, outline(body), 0, 0)
    return cv


# ---------------------------------------------------------------------------
# 5. Manifesto parcial JSON
# ---------------------------------------------------------------------------

def build_manifest(
    tiles: Sequence[Tuple[str, Canvas]],
    props: Sequence[Tuple[str, Canvas]],
    house: Canvas,
    gate: Canvas,
) -> Dict:
    prop_names = [n for n, _ in props]

    def idx_range(prefix: str, count: int) -> List[int]:
        return [prop_names.index(f"{prefix}_{i}") for i in range(count)]

    return {
        "sprites": {
            "village_hub_tiles": {
                "key": "village_hub_tiles",
                "file": "village_hub_tiles.png",
                "width": len(tiles) * T,
                "height": T,
                "frameWidth": T,
                "frameHeight": T,
                "frames": [n for n, _ in tiles],
            },
            "village_hub_props": {
                "key": "village_hub_props",
                "file": "village_hub_props.png",
                "width": len(props) * T,
                "height": T,
                "frameWidth": T,
                "frameHeight": T,
                "frames": prop_names,
                "animations": {
                    "campfire": {"frames": idx_range("campfire", 4), "frameRate": 8, "repeat": -1},
                    "brazier": {"frames": idx_range("brazier", 4), "frameRate": 8, "repeat": -1},
                    "torch_post": {"frames": idx_range("torch_post", 4), "frameRate": 8, "repeat": -1},
                    "forge": {"frames": idx_range("forge", 4), "frameRate": 7, "repeat": -1},
                },
            },
            "village_hub_house": {
                "key": "village_hub_house",
                "file": "village_hub_house.png",
                "width": house.w,
                "height": house.h,
                "frameWidth": house.w,
                "frameHeight": house.h,
                "frames": ["house"],
                "origin": {"x": 0.5, "y": 0.88},
            },
            "village_hub_gate": {
                "key": "village_hub_gate",
                "file": "village_hub_gate.png",
                "width": gate.w,
                "height": gate.h,
                "frameWidth": gate.w,
                "frameHeight": gate.h,
                "frames": ["gate"],
                "origin": {"x": 0.5, "y": 0.9},
            },
        }
    }


# ---------------------------------------------------------------------------
# 6. Prancha de aprovacao rotulada + mini-composicao da Vila Natal
# ---------------------------------------------------------------------------

def build_preview(
    tiles: Sequence[Tuple[str, Canvas]],
    props: Sequence[Tuple[str, Canvas]],
    house: Canvas,
    gate: Canvas,
    out_path: Path,
) -> Tuple[int, int]:
    W_P, H_P = 1120, 920
    cv = Canvas(W_P, H_P)
    fill_rect(cv, 0, 0, W_P, H_P, (20, 17, 16, 255))
    c_title = (244, 228, 188)
    c_head = (216, 196, 154)
    c_lbl = (207, 197, 180)
    labels = [
        text_item("SUBMUNDO M9 (T-133) - VILA NATAL HUB ASSETS 2.5D", 24, 14, 16, c_title, "Consolas", True),
    ]

    # --- Secao 1: Tiles 32x32 (ampliados 2x) ---
    labels.append(text_item("1. TILES DE CHAO 32x32 (2x)", 24, 44, 12, c_head, "Consolas", True))
    for i, (name, tile) in enumerate(tiles):
        x = 24 + i * 96
        y = 66
        fill_rect(cv, x - 2, y - 2, 68, 68, (40, 34, 30, 255))
        blit(cv, upscale(tile, 2), x, y)
        labels.append(text_item(name, x, y + 70, 10, c_lbl, "Consolas", False))

    # --- Secao 2: Props 32x32 (ampliados 2x em 3 linhas) ---
    labels.append(text_item("2. PROPS E ANIMACOES 32x32 (2x sobre fundo neutro)", 24, 166, 12, c_head, "Consolas", True))
    cols = 10
    for i, (name, prop) in enumerate(props):
        r, c = divmod(i, cols)
        x = 24 + c * 106
        y = 188 + r * 92
        fill_rect(cv, x - 2, y - 2, 68, 68, (46, 40, 36, 255))
        blit(cv, upscale(prop, 2), x, y)
        labels.append(text_item(name, x, y + 70, 9, c_lbl, "Consolas", False))

    # --- Secao 3: Estruturas 2.5D (1x real + caixa) ---
    sec3_y = 480
    labels.append(text_item("3. ESTRUTURAS 2.5D DEDICADAS (1x real)", 24, sec3_y, 12, c_head, "Consolas", True))
    fill_rect(cv, 22, sec3_y + 22, house.w + 4, house.h + 4, (46, 40, 36, 255))
    blit(cv, house, 24, sec3_y + 24)
    labels.append(text_item(f"village_hub_house ({house.w}x{house.h})", 24, sec3_y + 24 + house.h + 6, 10, c_lbl, "Consolas", False))

    gx = 24 + house.w + 30
    fill_rect(cv, gx - 2, sec3_y + 22, gate.w + 4, gate.h + 4, (46, 40, 36, 255))
    blit(cv, gate, gx, sec3_y + 24)
    labels.append(text_item(f"village_hub_gate ({gate.w}x{gate.h})", gx, sec3_y + 24 + gate.h + 6, 10, c_lbl, "Consolas", False))

    # --- Secao 4: Mini-composicao da Vila Natal (escala 1x real) ---
    mx, my = 440, sec3_y + 22
    mw, mh = 640, 384  # 20x12 tiles de 32x32
    labels.append(text_item("4. COMPOSICAO DE REFERENCIA (20x12 tiles, 1x real)", mx, sec3_y, 12, c_head, "Consolas", True))
    scene = Canvas(mw, mh)
    tmap = dict(tiles)
    pmap = dict(props)

    # piso: grama nas bordas, transicao e clareira de terra batida
    for ty in range(12):
        for tx in range(20):
            if ty == 0 or (ty == 1 and tx < 11) or tx == 0 or tx == 19 or ty == 11:
                tname = "grass_0" if (tx + ty) % 2 == 0 else "grass_1"
            elif ty == 1 and tx >= 11:
                tname = "dirt_grass_n"
            elif ty == 10:
                tname = "dirt_grass_s"
            elif tx in (13, 14, 15) and ty <= 5:
                tname = "dirt_trail"
            elif 8 <= tx <= 10 and 5 <= ty <= 7:
                tname = "dirt_ash" if (tx == 9 and ty == 6) else "dirt_0"
            elif 3 <= tx <= 6 and ty == 5:
                tname = "dirt_cobble"
            else:
                tname = ("dirt_0", "dirt_1", "dirt_2")[(tx * 3 + ty * 5) % 3]
            blit(scene, tmap[tname], tx * T, ty * T)

    # casa ao fundo-esquerda e portao no canto superior direito
    blit(scene, house, 36, 12)
    blit(scene, gate, 430, 8)
    # braseiro ao lado da porta da curandeira
    blit(scene, pmap["brazier_1"], 194, 134)
    # fogueira central
    blit(scene, pmap["campfire_1"], 288, 192)
    # carroca perto do portao
    blit(scene, pmap["wooden_cart"], 384, 118)
    # forja + bigorna + barril a direita
    blit(scene, pmap["anvil"], 448, 206)
    blit(scene, pmap["forge_1"], 488, 208)
    blit(scene, pmap["barrel"], 532, 178)
    blit(scene, pmap["firewood"], 72, 162)
    # palicada na borda inferior e esquerda
    for tx in range(1, 19):
        if tx in (8, 9):
            continue
        blit(scene, pmap["palisade_h"], tx * T, 326)
    blit(scene, pmap["palisade_end"], 7 * T, 326)
    blit(scene, pmap["palisade_end"], 10 * T, 326)
    for ty in range(4, 10):
        blit(scene, pmap["palisade_v_l"], 6, ty * T)
    blit(scene, pmap["torch_post_2"], 160, 294)
    blit(scene, pmap["torch_post_0"], 344, 108)

    fill_rect(cv, mx - 2, my - 2, mw + 4, mh + 4, (54, 46, 40, 255))
    blit(cv, scene, mx, my)

    render_text_overlay(cv, labels, out_path)
    return (W_P, H_P)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    tiles = build_tiles()
    props = build_props()
    house = build_house()
    gate = build_gate()

    SPRITES_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    MOCKUPS_DIR.mkdir(parents=True, exist_ok=True)

    p_tiles = SPRITES_DIR / "village_hub_tiles.png"
    p_props = SPRITES_DIR / "village_hub_props.png"
    p_house = SPRITES_DIR / "village_hub_house.png"
    p_gate = SPRITES_DIR / "village_hub_gate.png"
    p_manifest = OUT_DIR / "village_hub_assets.manifest.json"
    p_preview = MOCKUPS_DIR / "preview_m9_village_assets.png"

    write_png(p_tiles, assemble(tiles, T, T))
    write_png(p_props, assemble(props, T, T))
    write_png(p_house, house)
    write_png(p_gate, gate)

    manifest = build_manifest(tiles, props, house, gate)
    p_manifest.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    pw, ph = build_preview(tiles, props, house, gate, p_preview)

    print(f"Gerado: {p_tiles} ({len(tiles)} frames 32x32)")
    print(f"Gerado: {p_props} ({len(props)} frames 32x32)")
    print(f"Gerado: {p_house} ({house.w}x{house.h})")
    print(f"Gerado: {p_gate} ({gate.w}x{gate.h})")
    print(f"Gerado: {p_manifest}")
    print(f"Gerado: {p_preview} ({pw}x{ph})")


if __name__ == "__main__":
    main()
