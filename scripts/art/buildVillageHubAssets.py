"""
SUBMUNDO - Assets Pixel Art 2.5D de Alta Qualidade da Vila Natal (M9 / BRF-147 / T-133)
=======================================================================================

Gera os assets exclusivos do Hub da Vila Natal (prologo), reutilizando as funcoes provadas
dos biomas aprovados no M8 (`surf_common.py`, `surf_village.py`, `surf_herb_field.py` e
`buildDungeonBasic.py`) e seguindo fielmente a composicao 2.5D de `ref_m9_village_hub.jpg`:

- public/assets/sprites/village_hub_tiles.png        (320x32, 10 frames 32x32, ZERO costura/grade)
- public/assets/sprites/village_hub_props.png        (896x32, 28 frames 32x32, RGBA)
- public/assets/sprites/village_hub_props_large.png  (768x64, 12 frames 64x64, RGBA escala heroi 80x80)
- public/assets/sprites/village_hub_house.png        (224x192, RGBA Casa de Palha 2.5D rica)
- public/assets/sprites/village_hub_gate.png         (192x160, RGBA Portao de Pedra e Madeira 2.5D)
- scripts/art/biomes/out/village_hub_assets.manifest.json
- assets/mockups/preview_m9_village_assets.png       (prancha de validacao + blocos 6x4 sem costura + cena)

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
import buildDungeonBasic as DB  # noqa: E402
from buildDungeonBasic import (  # noqa: E402
    MOCKUPS_DIR,
    SPRITES_DIR,
    T,
    assemble,
    blit,
    darken_region,
    fill_ellipse,
    fill_rect,
    line,
    mix,
    outline,
    overhang_shadow,
    render_text_overlay,
    rgba,
    shade,
    text_item,
    upscale,
)
from surf_common import (  # noqa: E402
    OUT_DIR,
    checker,
    contact_shadow,
    ellipse_shadow,
    h01,
    leaf_blobs,
    put,
    vnoise,
    voronoi_stones,
)
import surf_village as SV  # noqa: E402
import surf_herb_field as SHF  # noqa: E402

RGB = Tuple[int, int, int]

# ---------------------------------------------------------------------------
# Paleta Vila Natal Dark Fantasy (alinhada a surf_village.py + surf_herb_field.py)
# ---------------------------------------------------------------------------

# Terra batida (contraste controlado na base periodica p/ ZERO grade 32x32!)
DIRT_DARK: RGB = (54, 41, 30)
DIRT_LO: RGB = (68, 52, 38)
DIRT_MID: RGB = (78, 60, 44)
DIRT_HI: RGB = (90, 70, 51)
DIRT_SPECK: RGB = (104, 82, 60)
PEBBLE: Sequence[RGB] = ((106, 96, 84), (88, 79, 69), (120, 108, 94))

# Grama (de surf_herb_field.py)
G_DARK = SHF.G_DARK
G_LO = SHF.G_LO
G_MID = SHF.G_MID
G_HI = SHF.G_HI
G_TIP = SHF.G_TIP

# Madeira de carvalho e enxaimel (de surf_village.py)
W_DD: RGB = (28, 16, 9)
W_D: RGB = SV.W_D      # (46, 26, 13)
W: RGB = SV.W          # (92, 58, 33)
W_L: RGB = SV.W_L      # (124, 77, 43)
W_H: RGB = SV.W_H      # (150, 98, 58)

# Toras da palicada (madeira bruta com casca acinzentada/marrom)
PAL_DD: RGB = (30, 23, 18)
PAL_D: RGB = (52, 41, 32)
PAL_M: RGB = (78, 62, 48)
PAL_L: RGB = (104, 84, 65)
PAL_H: RGB = (132, 108, 82)
CUT_L: RGB = (164, 132, 92)
CUT_H: RGB = (192, 160, 114)

# Pedras e alvenaria (de surf_village.py)
ST_CRACK: RGB = SV.ST_CRACK  # (40, 36, 33)
ST_TONES: Sequence[RGB] = SV.ST  # ((92, 86, 78), (84, 78, 70), (100, 93, 83), (78, 72, 65))
ST_D: RGB = (64, 59, 54)
ST_M: RGB = (86, 80, 72)
ST_L: RGB = (110, 102, 92)
ST_H: RGB = (134, 125, 112)

# Reboco envelhecido (de surf_village.py)
PL_D: RGB = SV.PL_D
PL: RGB = SV.PL
PL_L: RGB = SV.PL_L

# Sape / palha em camadas organicas
TH_VOID: RGB = (28, 20, 12)
TH_DD: RGB = (52, 39, 22)
TH_D: RGB = (82, 64, 35)
TH_M: RGB = (116, 92, 49)
TH_L: RGB = (148, 120, 64)
TH_H: RGB = (182, 150, 84)
TH_TIP: RGB = (206, 174, 102)

# Ferro forjado
IRON_DD: RGB = (20, 20, 24)
IRON_D: RGB = SV.IRON_D
IRON: RGB = SV.IRON
IRON_L: RGB = SV.IRON_L
IRON_H: RGB = (156, 160, 172)

# Fogo (4 camadas do briefing: #b91c1c -> #ea580c -> #f59e0b -> #fef08a)
FL_DR: RGB = (128, 20, 16)
FL_R: RGB = (185, 28, 28)    # #b91c1c
FL_O: RGB = (234, 88, 12)    # #ea580c
FL_A: RGB = (245, 158, 11)   # #f59e0b
FL_Y: RGB = (254, 240, 138)  # #fef08a
FL_W: RGB = (255, 251, 214)


# ---------------------------------------------------------------------------
# Utilitarios de texto pixel-art, chamas, pedras e madeira
# ---------------------------------------------------------------------------

def pixel_font_glyph(ch: str, large: bool = False) -> List[str]:
    """Fonte pixel-art nitida (normal 4x5 p/ prop 32x32; large 5x7 p/ portao 192x160)."""
    if large:
        glyphs_lg: Dict[str, List[str]] = {
            "S": [
                "01111",
                "11000",
                "11000",
                "01110",
                "00011",
                "00011",
                "11110",
            ],
            "A": [
                "01110",
                "11011",
                "11011",
                "11111",
                "11011",
                "11011",
                "11011",
            ],
            "I": [
                "1111",
                "0110",
                "0110",
                "0110",
                "0110",
                "0110",
                "1111",
            ],
            "Í": [
                "1111",
                "0110",
                "0110",
                "0110",
                "0110",
                "0110",
                "1111",
            ],
            "D": [
                "11110",
                "11011",
                "11011",
                "11011",
                "11011",
                "11011",
                "11110",
            ],
            " ": ["00", "00", "00", "00", "00", "00", "00"],
        }
        return glyphs_lg.get(ch, glyphs_lg[" "])
    glyphs_sm: Dict[str, List[str]] = {
        "S": ["0111", "1000", "0110", "0001", "1110"],
        "A": ["0110", "1001", "1111", "1001", "1001"],
        "I": ["111", "010", "010", "010", "111"],
        "Í": ["111", "010", "010", "010", "111"],
        "D": ["1110", "1001", "1001", "1001", "1110"],
        " ": ["00", "00", "00", "00", "00"],
    }
    return glyphs_sm.get(ch, glyphs_sm[" "])


def draw_pixel_word(
    cv: Canvas, text: str, x0: int, y0: int, fg: RGB, shadow: RGB, large: bool = False
) -> None:
    x = x0
    hi = shade(fg, 1.08)
    lo = shade(fg, 0.88)
    for ch in text:
        g = pixel_font_glyph(ch, large=large)
        w = len(g[0])
        if ch == "Í":
            if large:
                cv.put(x + 2, y0 - 3, rgba(shadow))
                cv.put(x + 3, y0 - 3, rgba(shadow))
                cv.put(x + 1, y0 - 2, rgba(shadow))
                cv.put(x + 2, y0 - 3, rgba(hi))
                cv.put(x + 1, y0 - 2, rgba(fg))
            else:
                cv.put(x + 1, y0 - 2, rgba(shadow))
                cv.put(x + 2, y0 - 2, rgba(fg))
                cv.put(x + 1, y0 - 1, rgba(fg))
        for ry, row in enumerate(g):
            for rx, bit in enumerate(row):
                if bit == "1":
                    cv.put(x + rx + 1, y0 + ry + 1, rgba(shadow))
                    if large:
                        cv.put(x + rx, y0 + ry + 1, rgba(shadow))
        for ry, row in enumerate(g):
            for rx, bit in enumerate(row):
                if bit == "1":
                    col = hi if ry == 0 else (lo if ry == len(g) - 1 else fg)
                    cv.put(x + rx, y0 + ry, rgba(col))
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
    """Desenha labareda em 4 camadas (#b91c1c -> #ea580c -> #f59e0b -> #fef08a)."""
    y_min = max(0, int(base_y - height - 2))
    y_max = min(cv.h - 1, base_y + 1)
    for y in range(y_min, y_max + 1):
        t = (base_y - y) / max(height, 1.0)
        if t < -0.08 or t > 1.04:
            continue
        tc = max(0.0, min(1.0, t))
        wobble = math.sin(tc * math.pi * 2.3 + seed * 1.7) * (0.85 + width * 0.08)
        cxf = cx + sway * (tc ** 1.15) + wobble * tc
        half = width * ((1.0 - tc) ** 0.70) * (0.85 + 0.35 * math.sin(tc * math.pi))
        if half < 0.35:
            continue
        for x in range(max(0, int(cxf - half - 2)), min(cv.w, int(cxf + half + 3))):
            d = abs(x + 0.5 - cxf)
            if d > half + 0.2:
                continue
            heat = (1.0 - tc) * 0.95 + (1.0 - d / max(half, 0.5)) * 0.65
            if heat > 1.12:
                col = FL_Y
            elif heat > 0.80:
                col = FL_A
            elif heat > 0.50:
                col = FL_O
            else:
                col = FL_R
            cv.put(x, y, rgba(col))


def draw_warm_glow(cv: Canvas, cx: float, cy: float, rx: float, ry: float, col: RGB, max_a: int) -> None:
    """Brilho quente sobre superficies solidas adjacentes ao fogo (sem sujar alpha=0)."""
    for y in range(max(0, int(cy - ry) - 1), min(cv.h, int(cy + ry) + 2)):
        for x in range(max(0, int(cx - rx) - 1), min(cv.w, int(cx + rx) + 2)):
            cur = cv.get(x, y)
            if cur[3] < 200:
                continue
            d = math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
            if d < 1.0:
                k = ((1.0 - d) ** 1.55) * (max_a / 255.0)
                cv.put(x, y, rgba(mix(cur[:3], col, k), cur[3]))


def draw_voronoi_region(
    cv: Canvas,
    x0: int,
    y0: int,
    w: int,
    h: int,
    seed: int,
    n_stones: int,
    tones: Sequence[RGB] = ST_TONES,
    crack: RGB = ST_CRACK,
    hi_f: float = 1.22,
    lo_f: float = 0.72,
    sx: float = 1.4,
    sy: float = 1.0,
    brightness: float = 1.0,
) -> None:
    """Renderiza alvenaria irregular voronoi_stones com pontos estratificados (sem manchas pretas)."""
    sub = Canvas(w, h)
    shaded_tones = [shade(t, brightness) for t in tones]
    rng = random.Random(seed)
    # Grade estratificada garante que dois centros de pedra nunca colidam (< 1px),
    # evitando cunhas pretas de argamassa e mantendo pedras de tamanho medieval uniforme.
    aspect = max(0.25, (w / max(1.0, float(h))) * (sy / max(0.5, sx)))
    cols = max(1, int(round(math.sqrt(n_stones * aspect))))
    rows = max(1, int(round(n_stones / float(cols))))
    cell_w = w / float(cols)
    cell_h = h / float(rows)
    fixed_pts = []
    for r in range(rows):
        for c in range(cols):
            px = (c + rng.uniform(0.22, 0.78)) * cell_w
            py = (r + rng.uniform(0.22, 0.78)) * cell_h
            tone = shaded_tones[(r * 3 + c * 2 + rng.randint(0, len(shaded_tones) - 1)) % len(shaded_tones)]
            fixed_pts.append((px, py, tone))
    voronoi_stones(
        sub, seed, len(fixed_pts), shaded_tones, shade(crack, min(1.0, brightness)),
        hi_f=hi_f, lo_f=lo_f, sx=sx, sy=sy, w=w, h=h, wrap=False, fixed_pts=fixed_pts,
    )
    blit(cv, sub, x0, y0)


# ---------------------------------------------------------------------------
# 1. Tiles de Chao 32x32 (`village_hub_tiles.png`, 10 frames, ZERO costura)
# ---------------------------------------------------------------------------
# Segredo para ZERO costura e ZERO grade aparente quando `dirt_0..2` sao combinados:
# 1) O campo periodico base (`vnoise` modulo 32) usa a MESMA semente portadora (SEED=100)
#    com amplitude sutil (apenas ~10 unidades RGB entre DIRT_LO e DIRT_MID), exatamente
#    como `grass()` de `surf_herb_field.py` faz com `G_LO` e `G_MID`.
# 2) Isso garante que a borda de `dirt_0`, `dirt_1`, `dirt_2`, `dirt_trail`, `dirt_ash`
#    e `dirt_cobble` case 100% em qualquer combinacao lado a lado, sem salto de brilho
#    por tile e sem mancha repetitiva nos cantos!
# 3) A riqueza visual vem do micro-grao de solo e pedrinhas distribuidas uniformemente.

DIRT_CARRIER_SEED = 105


def paint_seamless_dirt(cv: Canvas, variant_seed: int) -> None:
    for y in range(T):
        for x in range(T):
            # Campo base 100% periodico modulo 32 e compartilhado entre variantes
            n8 = vnoise(x, y, 32, DIRT_CARRIER_SEED, 8.0)
            n4 = vnoise(x, y, 32, DIRT_CARRIER_SEED + 7, 4.0)
            c = mix(DIRT_LO, DIRT_MID, n8 * 0.65 + n4 * 0.35)
            # Micro-textura de terra batida (alta frequencia, sem formar manchas 32x32)
            if (x + y) % 2 == 0 and h01(x, y, DIRT_CARRIER_SEED + 13) < 0.32:
                c = shade(c, 0.94)
            # Nas bordas (distancia <= 1px da costura), usa semente fixa p/ emenda perfeita entre dirt_0..2
            on_edge = (x <= 1 or x >= T - 2 or y <= 1 or y >= T - 2)
            r = h01(x, y, DIRT_CARRIER_SEED + 29 if on_edge else variant_seed)
            if r < 0.08:
                c = DIRT_DARK
            elif r > 0.92:
                c = DIRT_HI
            elif r > 0.86:
                c = shade(c, 1.06)
            cv.put(x, y, rgba(c))


def tile_dirt(idx: int) -> Canvas:
    v_seeds = (211, 317, 423)
    cv = Canvas(T, T)
    paint_seamless_dirt(cv, v_seeds[idx])
    # Pedrinhas pequenas bem espalhadas (coordenadas diferentes em cada variante, longe de formar grade)
    pebble_sets = (
        ((5, 7, 0), (14, 4, 1), (25, 9, 2), (9, 17, 1), (20, 15, 0), (4, 26, 2), (16, 25, 0), (27, 23, 1)),
        ((7, 5, 1), (18, 8, 0), (26, 6, 2), (6, 15, 2), (15, 19, 1), (24, 18, 0), (10, 27, 0), (22, 26, 1)),
        ((4, 9, 2), (12, 6, 0), (23, 7, 1), (8, 18, 0), (19, 14, 2), (27, 17, 1), (7, 25, 1), (18, 24, 0)),
    )[idx]
    for (px, py, p_idx) in pebble_sets:
        col = PEBBLE[p_idx]
        cv.put(px % T, py % T, rgba(col))
        cv.put((px + 1) % T, py % T, rgba(shade(col, 0.76)))
    if idx == 1:
        # Fios sutis de palha seca no chao
        for (sx, sy) in ((11, 11), (21, 22)):
            cv.put(sx, sy, rgba((134, 108, 62)))
            cv.put(sx + 1, sy, rgba((112, 88, 48)))
    elif idx == 2:
        # Minúsculos brotos rasteiros
        for (gx, gy) in ((13, 12), (21, 20)):
            cv.put(gx, gy, rgba(G_LO))
            cv.put(gx, gy - 1, rgba(G_HI))
    return cv


def tile_dirt_trail() -> Canvas:
    """Trilha pisoteada / caminho de cascalho com emenda periodica modulo 32 em todas as direcoes."""
    cv = Canvas(T, T)
    paint_seamless_dirt(cv, 509)
    for y in range(T):
        for x in range(T):
            # Textura isotropica periodica modulo 32 (emenda tanto N-S quanto L-O sem faixas!)
            n = vnoise(x, y, 32, 521, 8.0) * 0.6 + vnoise(x, y, 32, 529, 4.0) * 0.4
            if n > 0.58:
                cv.put(x, y, rgba(mix(cv.get(x, y)[:3], DIRT_HI, 0.35)))
            elif n < 0.36:
                cv.put(x, y, rgba(shade(cv.get(x, y)[:3], 0.94)))
    # Cascalho compacto e pequenas pedras pisoteadas ao longo da trilha
    pebbles = (
        (3, 5, 0), (10, 3, 2), (18, 6, 1), (26, 4, 0),
        (6, 12, 1), (14, 11, 0), (22, 13, 2), (29, 10, 1),
        (4, 20, 2), (12, 18, 1), (20, 21, 0), (27, 19, 2),
        (8, 28, 0), (16, 26, 2), (24, 29, 1), (30, 25, 0),
    )
    for (px, py, p_idx) in pebbles:
        c = PEBBLE[p_idx]
        cv.put(px % T, py % T, rgba(shade(c, 1.05)))
        cv.put((px + 1) % T, py % T, rgba(shade(c, 0.78)))
        cv.put(px % T, (py + 1) % T, rgba(DIRT_DARK))
    return cv


def tile_grass(idx: int) -> Canvas:
    """Grama dark-fantasy rica reutilizando `grass()` de `surf_herb_field.py` sem costura."""
    cv = Canvas(T, T)
    # Mesma semente base (31) para o campo vnoise de fundo -> grass_0 e grass_1 emendam com ZERO costura!
    for y in range(T):
        for x in range(T):
            n = vnoise(x, y, 32, 31, 8)
            c = mix(G_LO, G_MID, n)
            if (x + y) % 2 and h01(x, y, 40) < 0.3:
                c = shade(c, 0.93)
            cv.put(x, y, rgba(c))
    seed = 31 + idx * 17
    density = 0.14 if idx == 0 else 0.16
    blades = [(x, y) for y in range(T) for x in range(T) if h01(x, y, seed + 1) < density]
    blades.sort(key=lambda p: p[1])
    for (x, y) in blades:
        ln = 2 + int(h01(x, y, seed + 2) * 2)
        lean = 1 if h01(x, y, seed + 3) < 0.25 else 0
        for i in range(ln):
            c = G_DARK if i == 0 else (G_TIP if i == ln - 1 else G_HI)
            cv.put((x + (lean if i == ln - 1 else 0)) % T, (y - i) % T, rgba(c))
    if idx == 1:
        # Trevos / folhinhas sutis de surf_herb_field.py
        for (cx, cy) in ((9, 21), (23, 8)):
            for (dx, dy) in ((0, 0), (1, 0), (0, 1)):
                cv.put((cx + dx) % T, (cy + dy) % T, rgba((40, 76, 38) if dy else (64, 102, 52)))
    return cv


def tile_dirt_grass_transition(grass_top: bool) -> Canvas:
    """Transicao organica grama <-> terra batida, periodica em X (sem costura lateral)."""
    g_cv = tile_grass(0 if grass_top else 1)
    d_cv = tile_dirt(0 if grass_top else 1)
    cv = Canvas(T, T)
    for y in range(T):
        for x in range(T):
            wave = 15.5 + math.sin(x / T * math.tau) * 2.8 + (vnoise(x, y, 32, 611, 8.0) - 0.5) * 5.5
            in_grass = (y < wave) if grass_top else (y >= wave)
            if in_grass:
                cv.put(x, y, g_cv.get(x, y))
            else:
                c = d_cv.get(x, y)[:3]
                dist = abs(y - wave)
                if dist < 1.8:
                    c = shade(c, 0.80)
                cv.put(x, y, rgba(c))
    # Laminas de grama invadindo a borda da terra
    for x in range(T):
        if h01(x, 1, 619) < 0.55:
            wave = int(round(15.5 + math.sin(x / T * math.tau) * 2.8))
            by = wave + (1 if grass_top else -1)
            for i, col in enumerate((G_DARK, G_HI, G_TIP)):
                cv.put(x, (by - i) % T, rgba(col))
    return cv


def tile_dirt_ash() -> Canvas:
    """Terra batida com cinzas, carvao e brasas dormentes (emenda 100% com dirt_0..2 nas bordas)."""
    cv = tile_dirt(0)
    for y in range(T):
        for x in range(T):
            d = math.hypot((x + 0.5 - 16.0) / 14.0, (y + 0.5 - 16.0) / 13.0)
            n = (vnoise(x, y, 32, 701, 4.0) - 0.5) * 0.28
            if d + n < 0.92:
                k = max(0.0, min(1.0, (0.92 - (d + n)) / 0.85))
                ash = (46, 40, 36) if h01(x, y, 709) > 0.35 else (62, 54, 48)
                if d < 0.38 and h01(x, y, 719) < 0.14:
                    ash = (142, 58, 26)
                cv.put(x, y, rgba(mix(cv.get(x, y)[:3], ash, k * 0.62)))
    return cv


def tile_dirt_cobble() -> Canvas:
    """Terra batida combinada com pedras de calcamento (`cobble_layout` / `COB_TONES` de `surf_village.py`)."""
    cv = tile_dirt(1)
    # Desenha as pedras de calcamento de surf_village.py que atravessam as bordas sem costura,
    # deixando algumas frestas de terra batida entre elas para integrar ao chao do Hub.
    cob_cv = Canvas(T, T)
    SV.draw_cobbles(cob_cv, 14)
    for y in range(T):
        for x in range(T):
            # Mascara periodica suave para mesclar calcamento e terra batida
            m = vnoise(x, y, 32, 811, 8.0)
            cob_col = cob_cv.get(x, y)[:3]
            if cob_col == SV.COB_MORTAR:
                # Argamassa vira terra batida escura nas juntas
                cv.put(x, y, rgba(shade(cv.get(x, y)[:3], 0.78)))
            elif m > 0.22:
                cv.put(x, y, rgba(cob_col))
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
# 2. Props 32x32 (`village_hub_props.png`, 28 frames 32x32)
# ---------------------------------------------------------------------------

def draw_pointed_log(
    cv: Canvas, x0: int, y_top: int, y_bot: int, w: int, seed: int
) -> None:
    """Tora rolica vertical 2.5D com casca texturizada e ponta conica chanfrada a machado."""
    mid = x0 + (w - 1) / 2.0
    tip_h = max(5, int(w * 1.15))
    for y in range(y_top, y_bot + 1):
        dy = y - y_top
        for xx in range(w):
            x = x0 + xx
            if not (0 <= x < cv.w and 0 <= y < cv.h):
                continue
            if dy < tip_h:
                half_w = (dy + 0.6) / float(tip_h) * (w / 2.0)
                if abs(x - mid) > half_w:
                    continue
                # Chanfro de madeira clara cortada na ponta conica
                nx = (x - mid) / max(0.5, half_w)
                c = CUT_H if nx < -0.25 else (CUT_L if nx < 0.35 else PAL_L)
                if dy == tip_h - 1 and abs(x - mid) > half_w - 1.1:
                    c = PAL_M
            else:
                nx = (xx - (w - 1) / 2.0) / max(1.0, w / 2.0)
                if xx == 0:
                    c = PAL_D
                elif nx < -0.35:
                    c = PAL_H if h01(x, y, seed) > 0.2 else PAL_L
                elif nx < 0.25:
                    c = PAL_L if h01(x, y, seed + 1) > 0.35 else PAL_M
                elif nx < 0.7:
                    c = PAL_M if h01(x, y, seed + 2) > 0.3 else PAL_D
                else:
                    c = PAL_DD
                # Veios verticais de casca
                if (xx + int(h01(xx, y // 6, seed + 5) * 2)) % 3 == 0 and h01(x, y, seed + 9) < 0.28:
                    c = shade(c, 0.82)
            if y >= y_bot - 1:
                c = shade(c, 0.65)
            cv.put(x, y, rgba(c))


def prop_palisade_h() -> Canvas:
    body = Canvas(T, T)
    logs = [(0, 3, 6), (5, 1, 6), (11, 4, 6), (16, 1, 6), (21, 3, 6), (26, 2, 6)]
    for i, (lx, yt, lw) in enumerate(logs):
        draw_pointed_log(body, lx, yt, 29, lw, 800 + i * 7)
    for ry in (14, 23):
        SV.beam_h(body, 0, T, ry, 3)
        for rx in (4, 15, 26):
            body.put(rx, ry + 1, rgba(TH_L))
            body.put(rx + 1, ry + 1, rgba(W_DD))
    cv = outline(body)
    contact_shadow(cv, 0, T, 30, 120)
    return cv


def prop_palisade_v(right_side: bool) -> Canvas:
    body = Canvas(T, T)
    x_base = 16 if right_side else 7
    for i, yt in enumerate((-5, 3, 11, 19, 26)):
        sx = x_base + (i % 2)
        draw_pointed_log(body, sx, max(0, yt), min(31, yt + 14), 8, 830 + i * 5)
    tx = x_base - 2 if right_side else x_base + 8
    SV.post_v(body, tx, 0, T)
    cv = outline(body)
    for x in range(T):
        if body.get(x, 0)[3]:
            cv.put(x, 0, body.get(x, 0))
        if body.get(x, 31)[3]:
            cv.put(x, 31, body.get(x, 31))
    return cv


def prop_palisade_corner(top: bool) -> Canvas:
    body = Canvas(T, T)
    y_off = 1 if top else 0
    for i, (lx, yt, lw) in enumerate(((8, 1 + y_off, 8), (15, 4, 6), (21, 2, 6), (26, 3, 6))):
        draw_pointed_log(body, lx, yt, 29, lw, 860 + i + y_off * 10)
    SV.beam_h(body, 10, T, 14, 3)
    SV.beam_h(body, 10, T, 23, 3)
    cv = outline(body)
    contact_shadow(cv, 8, T, 30, 120)
    return cv


def prop_palisade_end() -> Canvas:
    body = Canvas(T, T)
    draw_pointed_log(body, 10, 1, 29, 12, 881)
    for hy in (13, 22):
        for x in range(10, 22):
            body.put(x, hy, rgba(IRON_L if x < 16 else IRON))
            body.put(x, hy + 1, rgba(IRON_D))
    cv = outline(body)
    ellipse_shadow(cv, 16.0, 29.5, 7.5, 2.2, 120)
    return cv


def prop_campfire(frame: int) -> Canvas:
    body = Canvas(T, T)
    fill_ellipse(
        body, 16, 23, 11.0, 5.2,
        lambda x, y, nx, ny: rgba(
            FL_A if (nx * nx + ny * ny) < 0.25 else (FL_O if (nx * nx + ny * ny) < 0.5 else FL_DR)
        ),
    )
    back_stones = [(6, 20), (11, 18), (16, 17), (21, 18), (26, 20)]
    for i, (sx, sy) in enumerate(back_stones):
        fill_ellipse(body, sx, sy, 3.3, 2.3, lambda x, y, nx, ny, k=i: rgba(
            shade(ST_TONES[k % len(ST_TONES)], 1.18 if ny < 0 else 0.72)))
    for (x0, y0, x1, y1) in ((8, 25, 24, 19), (9, 19, 23, 25)):
        SV.brace(body, x0, y0, x1, y1)
    front_stones = [(6, 24), (11, 27), (16, 28), (21, 27), (26, 24)]
    for i, (sx, sy) in enumerate(front_stones):
        fill_ellipse(body, sx, sy, 3.4, 2.4, lambda x, y, nx, ny, k=i: rgba(
            shade(ST_TONES[(k + 1) % len(ST_TONES)], 1.22 if ny < -0.1 else 0.68)))
    draw_warm_glow(body, 16, 22, 12.5, 7.0, FL_O, 115 + (frame % 2) * 20)
    configs = [
        (15.0, 22, 15.5, 5.4, -1.2),
        (16.2, 22, 17.0, 5.0, 1.4),
        (15.6, 22, 14.5, 5.8, 0.4),
        (16.5, 22, 16.2, 5.2, -1.6),
    ]
    cx, by, fh, fw, sw = configs[frame]
    draw_flame(body, cx - 3.0, by, fh * 0.74, fw * 0.68, sw - 0.8, frame + 10)
    draw_flame(body, cx + 3.0, by, fh * 0.70, fw * 0.64, sw + 0.9, frame + 20)
    draw_flame(body, cx, by, fh, fw, sw, frame + 30)
    sparks = [
        [(13, 4, FL_Y), (20, 7, FL_A), (16, 2, FL_O)],
        [(18, 3, FL_Y), (12, 6, FL_A), (15, 1, FL_O)],
        [(14, 5, FL_Y), (21, 4, FL_A), (17, 2, FL_Y)],
        [(11, 4, FL_Y), (19, 6, FL_A), (14, 2, FL_O)],
    ][frame]
    cv = Canvas(T, T)
    ellipse_shadow(cv, 16, 28.5, 13.0, 3.2, 130)
    blit(cv, outline(body), 0, 0)
    for (sx, sy, sc) in sparks:
        cv.put(sx, sy, rgba(sc))
    return cv


def prop_brazier(frame: int) -> Canvas:
    body = Canvas(T, T)
    for (x0, y0, x1, y1) in ((10, 19, 6, 29), (21, 19, 25, 29)):
        line(body, x0, y0, x1, y1, rgba(IRON_L))
        line(body, x0 + 1, y0, x1 + 1, y1, rgba(IRON_D))
    fill_rect(body, 15, 20, 2, 9, rgba(IRON_D))
    fill_rect(body, 9, 24, 14, 2, rgba(IRON))
    for y in range(13, 21):
        half = 9.5 - (y - 13) * 0.6
        for x in range(int(16 - half), int(16 + half) + 1):
            c = IRON_L if x < 13 else (IRON if x < 19 else IRON_D)
            if y == 13:
                c = IRON_H if x < 16 else IRON_L
            elif y == 20:
                c = IRON_DD
            body.put(x, y, rgba(c))
    fill_ellipse(body, 16, 13, 8.0, 2.5, lambda x, y, nx, ny: rgba(
        FL_Y if (nx * nx + ny * ny) < 0.25 else (FL_O if (x + frame) % 2 else FL_R)))
    fh = (11.0, 12.5, 10.0, 11.8)[frame]
    sw = (-1.0, 1.2, 0.3, -1.4)[frame]
    draw_flame(body, 16.0, 13, fh, 4.8, sw, frame + 50)
    draw_warm_glow(body, 16, 14, 10.0, 5.5, FL_A, 100)
    cv = Canvas(T, T)
    ellipse_shadow(cv, 16, 29.0, 10.5, 2.6, 120)
    blit(cv, outline(body), 0, 0)
    spark_xy = [(14, 1), (18, 2), (15, 1), (19, 2)][frame]
    cv.put(spark_xy[0], spark_xy[1], rgba(FL_Y))
    return cv


def prop_torch_post(frame: int) -> Canvas:
    body = Canvas(T, T)
    for y in range(11, 29):
        body.put(14, y, rgba(W_L))
        body.put(15, y, rgba(W))
        body.put(16, y, rgba(W))
        body.put(17, y, rgba(W_D))
    fill_rect(body, 11, 9, 10, 3, rgba(IRON))
    fill_rect(body, 11, 9, 10, 1, rgba(IRON_L))
    fill_rect(body, 13, 12, 6, 2, rgba(IRON_D))
    fh = (8.5, 9.8, 7.8, 9.2)[frame]
    sw = (-1.1, 1.3, 0.2, -0.9)[frame]
    draw_flame(body, 15.8, 9, fh, 3.6, sw, frame + 70)
    draw_warm_glow(body, 16, 11, 6.0, 4.5, FL_A, 95)
    cv = Canvas(T, T)
    ellipse_shadow(cv, 15.5, 29.0, 6.5, 2.2, 120)
    blit(cv, outline(body), 0, 0)
    spx = (14, 18, 16, 13)[frame]
    cv.put(spx, 1, rgba(FL_Y))
    return cv


def prop_forge(frame: int) -> Canvas:
    body = Canvas(T, T)
    draw_voronoi_region(body, 2, 12, 28, 17, 901, 14, ST_TONES, ST_CRACK, sx=1.5, sy=1.0)
    fill_rect(body, 2, 8, 28, 4, rgba(ST_L))
    fill_rect(body, 2, 8, 28, 1, rgba(ST_H))
    fill_rect(body, 5, 9, 22, 3, rgba((40, 18, 12)))
    for x in range(6, 26):
        for y in (9, 10, 11):
            v = h01(x, y, 950 + frame)
            c = FL_Y if v > 0.72 else (FL_A if v > 0.42 else (FL_O if v > 0.18 else FL_R))
            body.put(x, y, rgba(c))
    fill_rect(body, 11, 21, 10, 7, rgba((22, 12, 10)))
    fill_rect(body, 12, 23, 8, 5, rgba(FL_R if frame % 2 == 0 else FL_O))
    fill_rect(body, 14, 24, 4, 3, rgba(FL_A if frame % 2 else FL_Y))
    draw_flame(body, 13.0, 10, (6.5, 8.0, 6.0, 7.5)[frame], 3.5, (-0.8, 0.9, 0.2, -0.6)[frame], frame + 90)
    draw_flame(body, 19.5, 10, (5.8, 6.8, 7.2, 6.0)[frame], 3.2, (0.6, -0.5, 0.9, -0.7)[frame], frame + 95)
    draw_warm_glow(body, 16, 12, 13.0, 7.0, FL_O, 110)
    cv = Canvas(T, T)
    contact_shadow(cv, 2, 30, 29, 125)
    blit(cv, outline(body), 0, 0)
    for (sx, sy, sc) in ([(10, 2, FL_Y), (22, 1, FL_A)] if frame % 2 == 0 else [(12, 1, FL_Y), (24, 3, FL_O)]):
        cv.put(sx, sy, rgba(sc))
    return cv


def prop_anvil() -> Canvas:
    body = Canvas(T, T)
    for y in range(17, 29):
        for x in range(7, 25):
            d = (x - 15.5) / 9.0
            c = W_L if d < -0.35 else (W if d < 0.35 else W_D)
            if (x + y * 2) % 5 == 0:
                c = shade(c, 0.82)
            body.put(x, y, rgba(c))
    fill_rect(body, 7, 22, 18, 2, rgba(IRON))
    fill_ellipse(body, 16, 17, 9.0, 2.5, lambda x, y, nx, ny: rgba(CUT_H if ny < 0 else CUT_L))
    fill_rect(body, 9, 14, 14, 3, rgba(IRON_D))
    fill_rect(body, 11, 11, 10, 3, rgba(IRON))
    fill_rect(body, 8, 6, 19, 5, rgba(IRON))
    fill_rect(body, 8, 6, 19, 2, rgba(IRON_H))
    for x in range(2, 9):
        h = max(1, int((x - 1) * 0.72))
        for dy in range(h):
            body.put(x, 7 + dy, rgba(IRON_H if dy == 0 else (IRON_L if dy == 1 else IRON_D)))
    cv = Canvas(T, T)
    ellipse_shadow(cv, 16, 29.0, 10.5, 2.6, 125)
    blit(cv, outline(body), 0, 0)
    return cv


def prop_sign_exit() -> Canvas:
    body = Canvas(T, T)
    for y in range(15, 29):
        body.put(14, y, rgba(W_L))
        body.put(15, y, rgba(W))
        body.put(16, y, rgba(W))
        body.put(17, y, rgba(W_D))
    for y in range(5, 17):
        for x in range(1, 31):
            if y in (5, 16) or x in (1, 30):
                c = IRON_D
            elif y == 6 or x == 2:
                c = W_L
            else:
                c = W if (y % 3) else W_D
            body.put(x, y, rgba(c))
    draw_pixel_word(body, "SAÍDA", 4, 9, (244, 228, 188), W_DD, large=False)
    cv = Canvas(T, T)
    ellipse_shadow(cv, 16, 29.0, 7.0, 2.2, 115)
    blit(cv, outline(body), 0, 0)
    return cv


def prop_wooden_cart() -> Canvas:
    body = Canvas(T, T)
    line(body, 1, 23, 8, 19, rgba(W_L))
    line(body, 1, 24, 8, 20, rgba(W_D))
    for y in range(8, 22):
        for x in range(7, 29):
            c = W_H if y == 8 else (W_L if y < 11 else (W if (y - 8) % 4 else W_D))
            if x in (7, 14, 21, 28):
                c = W_D
            body.put(x, y, rgba(c))
    fill_ellipse(body, 18, 8, 8.5, 3.2, lambda x, y, nx, ny: rgba(TH_H if ny < 0 else TH_M))
    cx, cy = 19, 23
    for y in range(16, 30):
        for x in range(12, 27):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if 4.2 <= d < 6.4:
                body.put(x, y, rgba(IRON_L if d >= 5.4 else W_L))
    for k in range(8):
        a = k * math.pi / 4
        line(body, cx, cy, int(round(cx + math.cos(a) * 5.0)), int(round(cy + math.sin(a) * 5.0)), rgba(W))
    fill_ellipse(body, cx, cy, 1.8, 1.8, lambda x, y, nx, ny: rgba(IRON_H))
    cv = Canvas(T, T)
    ellipse_shadow(cv, 17, 29.0, 13.0, 2.5, 125)
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
        ("firewood", SV.prop_firewood()),
        ("barrel", DB.prop_barrel()),
        ("cart_wheel", SV.prop_wheel()),
        ("wooden_cart", prop_wooden_cart()),
    ]
    return frames


# ---------------------------------------------------------------------------
# 2B. Props Monumentais 64x64 (`village_hub_props_large.png`, 12 frames 64x64)
# Escala 2.5D proporcional ao heroi 80x80 (~68px de altura), fiel a ref_m9!
# ---------------------------------------------------------------------------

def prop_campfire_large(frame: int) -> Canvas:
    """Fogueira central 64x64 com anel de pedras voronoi_stones, toras e labaredas em 4 camadas."""
    W64 = 64
    body = Canvas(W64, W64)

    # Leito circular de cinzas, carvao e brasa incandescente
    def coal_col(x: int, y: int, nx: float, ny: float):
        d = math.hypot(nx, ny)
        n = vnoise(x, y, 32, 3100 + frame, 4.0)
        if d < 0.42 + (n - 0.5) * 0.2:
            return rgba(FL_Y if d < 0.2 and (x + y + frame) % 2 == 0 else FL_A)
        if d < 0.72:
            return rgba(FL_O if (x + y) % 2 == 0 else FL_R)
        return rgba((44, 34, 30) if h01(x, y, 3105) > 0.3 else (68, 42, 32))

    fill_ellipse(body, 32.0, 46.0, 21.0, 8.5, coal_col)

    # Pedras de rio traseiras esculpidas via voronoi_stones
    back_ring = [
        (12, 42, 9, 6), (19, 38, 9, 6), (27, 36, 10, 6),
        (36, 37, 9, 6), (44, 39, 9, 6), (50, 43, 8, 6),
    ]
    for i, (sx, sy, sw, sh) in enumerate(back_ring):
        st = Canvas(sw, sh)
        voronoi_stones(st, 3120 + i, 3, ST_TONES, ST_CRACK, sx=1.3, sy=1.0, w=sw, h=sh, wrap=False)
        for yy in range(sh):
            for xx in range(sw):
                nx = (xx + 0.5 - sw / 2.0) / (sw / 2.0)
                ny = (yy + 0.5 - sh / 2.0) / (sh / 2.0)
                if nx * nx + ny * ny <= 1.0:
                    c = st.get(xx, yy)[:3]
                    if ny > 0.2:
                        c = mix(c, FL_O, 0.35)  # reflexo quente interno
                    body.put(sx + xx, sy + yy, rgba(c))

    # Toras grossas de lenha cruzadas e carbonizadas no centro
    logs = [
        (16, 49, 46, 39),
        (48, 49, 18, 39),
        (23, 51, 35, 36),
        (41, 51, 29, 36),
    ]
    for idx_l, (x0, y0, x1, y1) in enumerate(logs):
        steps = max(abs(x1 - x0), abs(y1 - y0))
        for s in range(steps + 1):
            t = s / float(max(1, steps))
            lx = int(round(x0 + (x1 - x0) * t))
            ly = int(round(y0 + (y1 - y0) * t))
            dist_center = math.hypot(lx - 32.0, (ly - 44.0) * 1.6)
            for dy in range(-2, 3):
                for dx in range(-1, 2):
                    if dist_center < 7.5 and (lx + ly + frame + idx_l) % 3 == 0:
                        col = FL_O if dy >= 0 else FL_A
                    elif dy == -2:
                        col = W_L if dist_center > 9.0 else W
                    elif dy <= 0:
                        col = W if dist_center > 8.0 else W_D
                    else:
                        col = W_DD
                    body.put(lx + dx, ly + dy, rgba(col))

    # Anel frontal de pedras de rio (voronoi_stones + reflexo da fogueira)
    front_ring = [
        (9, 46, 10, 7), (16, 50, 11, 7), (26, 52, 12, 7),
        (37, 51, 11, 7), (46, 47, 10, 7),
    ]
    for i, (sx, sy, sw, sh) in enumerate(front_ring):
        st = Canvas(sw, sh)
        voronoi_stones(st, 3150 + i, 4, ST_TONES, ST_CRACK, sx=1.4, sy=1.0, w=sw, h=sh, wrap=False)
        for yy in range(sh):
            for xx in range(sw):
                nx = (xx + 0.5 - sw / 2.0) / (sw / 2.0)
                ny = (yy + 0.5 - sh / 2.0) / (sh / 2.0)
                if nx * nx + ny * ny <= 1.0:
                    c = st.get(xx, yy)[:3]
                    if ny < -0.15:
                        c = mix(shade(c, 1.18), FL_A, 0.38)
                    elif ny > 0.45:
                        c = shade(c, 0.68)
                    body.put(sx + xx, sy + yy, rgba(c))

    draw_warm_glow(body, 32, 44, 24.0, 13.0, FL_O, 120 + (frame % 2) * 20)

    # Labaredas monumentais em 4 camadas com movimento vivo entre os 4 frames
    flame_sets = [
        [(26.0, 44, 22.0, 6.5, -1.8), (37.5, 44, 20.0, 6.0, 1.4), (31.5, 45, 31.0, 9.2, -1.5)],
        [(25.5, 44, 19.5, 6.2, 1.2), (38.0, 44, 23.5, 6.6, 1.9), (32.5, 45, 33.0, 8.6, 1.8)],
        [(26.5, 44, 24.0, 6.8, -0.8), (37.0, 44, 18.5, 5.8, -1.2), (31.8, 45, 29.0, 9.8, 0.5)],
        [(25.0, 44, 21.0, 6.0, -2.0), (38.5, 44, 22.0, 6.4, 1.0), (32.2, 45, 32.0, 9.0, -2.1)],
    ][frame]
    for j, (fcx, fby, ffh, ffw, fsw) in enumerate(flame_sets):
        draw_flame(body, fcx, fby, ffh, ffw, fsw, frame * 17 + j * 11)

    # Fagulhas subindo
    sparks = [
        [(24, 16, FL_Y), (38, 12, FL_A), (30, 7, FL_Y), (35, 19, FL_O), (21, 23, FL_R)],
        [(28, 11, FL_Y), (40, 16, FL_A), (33, 5, FL_Y), (23, 18, FL_O), (42, 22, FL_R)],
        [(26, 14, FL_Y), (36, 9, FL_A), (31, 8, FL_Y), (39, 18, FL_O), (22, 20, FL_R)],
        [(29, 10, FL_Y), (37, 14, FL_A), (27, 6, FL_Y), (24, 19, FL_O), (41, 21, FL_R)],
    ][frame]

    cv = Canvas(W64, W64)
    ellipse_shadow(cv, 32.0, 53.0, 25.0, 7.0, 140)
    blit(cv, outline(body), 0, 0)
    for (sx, sy, sc) in sparks:
        cv.put(sx, sy, rgba(sc))
        if sc == FL_Y:
            cv.put(sx, sy + 1, rgba(FL_A))
    return cv


def prop_forge_large(frame: int) -> Canvas:
    """Forja robusta 64x64 de alvenaria voronoi_stones em 2.5D com brasa viva, fornalha e ferramentas."""
    W64 = 64
    body = Canvas(W64, W64)

    # 1) Face frontal da forja (x=6..46, y=28..57) em voronoi_stones
    draw_voronoi_region(body, 6, 28, 40, 29, 3201, 22, ST_TONES, ST_CRACK, sx=1.5, sy=1.0, brightness=1.0)
    # 2) Face lateral direita 2.5D em perspectiva (x=46..58, y=20..57)
    for xx in range(12):
        y_shift = int(xx * 0.65)
        col_strip = Canvas(1, 29)
        draw_voronoi_region(col_strip, 0, 0, 1, 29, 3210 + xx, 5, ST_TONES, ST_CRACK, brightness=0.72)
        for yy in range(29):
            body.put(46 + xx, 28 - y_shift + yy, col_strip.get(0, yy))

    # 3) Bancada superior 2.5D em perspectiva (paralelogramo de lajes de pedra)
    for ty in range(18, 29):
        t = (28 - ty) / 10.0
        x_shift = int(round(t * 11))
        for tx in range(6 + x_shift, 47 + x_shift):
            c = ST_H if ty in (18, 28) or tx in (6 + x_shift, 46 + x_shift) else ST_L
            if (tx + ty) % 11 == 0:
                c = ST_CRACK
            elif h01(tx, ty, 3220) < 0.15:
                c = ST_M
            body.put(tx, ty, rgba(c))
    # Chanfro frontal da bancada
    fill_rect(body, 5, 28, 42, 3, rgba(ST_L))
    fill_rect(body, 5, 28, 42, 1, rgba(ST_H))
    fill_rect(body, 5, 30, 42, 1, rgba(ST_CRACK))

    # 4) Leito de carvao e brasa viva no topo da bancada
    for ty in range(20, 27):
        t = (27 - ty) / 7.0
        xs = int(round(t * 7))
        for tx in range(12 + xs, 40 + xs):
            d = math.hypot((tx - (26 + xs)) / 13.0, (ty - 23.5) / 3.8)
            n = h01(tx, ty, 3250 + frame)
            if d < 0.45 and n > 0.35:
                c = FL_Y if n > 0.72 else FL_A
            elif d < 0.78:
                c = FL_O if n > 0.3 else FL_R
            else:
                c = (36, 22, 18) if n > 0.25 else FL_DR
            body.put(tx, ty, rgba(c))

    # Barra de ferro/lamina incandescente aquecendo nas brasas + tenaz apoiada a esquerda
    line(body, 22, 24, 35, 22, rgba(FL_Y))
    line(body, 22, 25, 35, 23, rgba(FL_O))
    line(body, 8, 27, 21, 24, rgba(IRON_L))
    line(body, 8, 28, 21, 25, rgba(IRON_D))

    # 5) Boca de fornalha em arco acesa na base frontal (x=17..35, y=38..56)
    cx_arch, cy_arch = 26.0, 44.0
    for y in range(36, 57):
        for x in range(15, 38):
            dx, dy = x - cx_arch, y - cy_arch
            r = math.hypot(dx, dy)
            in_open = (abs(dx) < 7.5 and y >= cy_arch) or (r < 7.5 and y < cy_arch)
            in_stone_arch = (7.5 <= r < 10.5 and y < cy_arch) or (7.5 <= abs(dx) < 10.5 and y >= cy_arch)
            if in_open:
                heat_y = (y - 37) / 19.0
                c = mix((24, 12, 10), FL_R, heat_y ** 1.3)
                if y >= 51:
                    v = h01(x, y, 3280 + frame)
                    c = FL_Y if v > 0.75 else (FL_A if v > 0.4 else FL_O)
                body.put(x, y, rgba(c))
            elif in_stone_arch:
                c = ST_L if (x + y) % 5 else ST_CRACK
                if r < 8.5 or abs(dx) < 8.5:
                    c = mix(c, FL_O, 0.35)
                body.put(x, y, rgba(c))

    # Plinto escuro na base da forja
    fill_rect(body, 5, 55, 42, 3, rgba(ST_D))
    fill_rect(body, 5, 57, 42, 1, rgba(ST_CRACK))

    # 6) Chamas vivas no topo da forja + brilho quente nas pedras
    f_cfg = [
        ((23.0, 23, 14.0, 5.2, -1.0), (32.0, 22, 12.0, 4.6, 0.8)),
        ((23.5, 23, 16.0, 4.8, 1.2), (31.5, 22, 13.5, 5.0, -0.7)),
        ((22.5, 23, 12.5, 5.5, 0.3), (32.5, 22, 15.0, 4.5, 1.1)),
        ((23.2, 23, 15.0, 5.0, -1.2), (31.8, 22, 11.5, 4.8, -0.9)),
    ][frame]
    for j, (fcx, fby, ffh, ffw, fsw) in enumerate(f_cfg):
        draw_flame(body, fcx, fby, ffh, ffw, fsw, 3300 + frame * 7 + j)
    draw_warm_glow(body, 28, 24, 22.0, 12.0, FL_O, 115)
    draw_warm_glow(body, 26, 50, 14.0, 9.0, FL_O, 100)

    cv = Canvas(W64, W64)
    ellipse_shadow(cv, 31.0, 57.0, 27.0, 5.5, 140)
    blit(cv, outline(body), 0, 0)
    sparks = [
        [(19, 6, FL_Y), (28, 4, FL_A), (35, 8, FL_O)],
        [(22, 4, FL_Y), (31, 6, FL_A), (26, 2, FL_Y)],
        [(18, 7, FL_A), (29, 3, FL_Y), (36, 6, FL_O)],
        [(21, 5, FL_Y), (33, 4, FL_A), (25, 3, FL_O)],
    ][frame]
    for (sx, sy, sc) in sparks:
        cv.put(sx, sy, rgba(sc))
    return cv


def prop_anvil_large() -> Canvas:
    """Bigorna pesada 64x64 de ferro escuro sobre cepo grosso de carvalho com cinta de ferro."""
    W64 = 64
    body = Canvas(W64, W64)

    # 1) Cepo grosso de tronco de carvalho (x=16..48, y=31..57)
    for y in range(32, 57):
        root_flare = max(0.0, (y - 49) * 0.45)
        half = 14.5 + root_flare
        for x in range(int(32 - half), int(32 + half) + 1):
            nx = (x - 32.0) / half
            if nx < -0.45:
                c = W_L
            elif nx < 0.25:
                c = W
            elif nx < 0.72:
                c = W_D
            else:
                c = W_DD
            # Sulcos verticais de casca de carvalho
            if (x + int(h01(x, y // 5, 3401) * 2)) % 4 == 0:
                c = shade(c, 0.80)
            if y >= 55:
                c = shade(c, 0.70)
            body.put(x, y, rgba(c))

    # Cinta de ferro com rebites ao redor do cepo
    for y in range(42, 46):
        for x in range(17, 48):
            if body.get(x, y)[3]:
                c = IRON_L if y == 42 and x < 32 else (IRON if x < 38 else IRON_D)
                body.put(x, y, rgba(c))
    for rx in (21, 28, 36, 43):
        body.put(rx, 43, rgba(IRON_H))

    # Topo do cepo com aneis de madeira clara
    def stump_top(x: int, y: int, nx: float, ny: float):
        r = math.hypot(nx, ny)
        if r > 0.86:
            return rgba(W_D)
        if abs(r - 0.55) < 0.1 or abs(r - 0.28) < 0.08:
            return rgba(W_L)
        return rgba(CUT_H if nx + ny < -0.2 else CUT_L)

    fill_ellipse(body, 32.0, 32.0, 14.5, 4.2, stump_top)

    # 2) Base chanfrada e cintura da bigorna (x=20..45, y=21..33)
    fill_rect(body, 20, 29, 25, 4, rgba(IRON_D))
    fill_rect(body, 21, 29, 14, 1, rgba(IRON_L))
    fill_rect(body, 20, 32, 25, 1, rgba(IRON_DD))
    for y in range(22, 29):
        waist_half = 8.0 + abs(y - 25.5) * 0.9
        for x in range(int(32.5 - waist_half), int(32.5 + waist_half) + 1):
            nx = (x - 32.5) / waist_half
            c = IRON_L if nx < -0.35 else (IRON if nx < 0.35 else IRON_D)
            body.put(x, y, rgba(c))

    # 3) Mesa superior polida 2.5D da bigorna (x=19..49, y=13..22)
    # Plano superior 2.5D com highlight metalico
    for y in range(13, 17):
        s = (16 - y)
        for x in range(19 + s, 49 + s):
            c = IRON_H if y == 13 or x < 32 else IRON_L
            body.put(x, y, rgba(c))
    # Furo hardy na mesa superior
    fill_rect(body, 43, 14, 2, 2, rgba(IRON_DD))
    # Face lateral da mesa
    for y in range(17, 22):
        for x in range(19, 50):
            c = IRON_L if x < 28 else (IRON if x < 42 else IRON_D)
            if y == 17:
                c = IRON_H if x < 36 else IRON_L
            elif y == 21:
                c = IRON_DD
            body.put(x, y, rgba(c))

    # 4) Chifre conico longo a esquerda (x=7..19, y=14..22)
    for x in range(7, 20):
        t = (x - 7) / 12.0
        half_h = 0.8 + t * 3.4
        cy_h = 17.5 - (1.0 - t) * 1.2
        for y in range(int(cy_h - half_h), int(cy_h + half_h) + 1):
            ny = (y - cy_h) / max(0.8, half_h)
            c = IRON_H if ny < -0.35 else (IRON_L if ny < 0.2 else (IRON_D if ny < 0.65 else IRON_DD))
            body.put(x, y, rgba(c))

    # Martelo de ferreiro encostado na base direita do cepo
    line(body, 45, 56, 50, 41, rgba(W_L))
    line(body, 46, 56, 51, 41, rgba(W_D))
    fill_rect(body, 47, 39, 7, 4, rgba(IRON_L))
    fill_rect(body, 47, 41, 7, 2, rgba(IRON_D))

    cv = Canvas(W64, W64)
    ellipse_shadow(cv, 32.0, 56.5, 19.5, 5.0, 140)
    blit(cv, outline(body), 0, 0)
    return cv


def prop_wooden_cart_large() -> Canvas:
    """Carroca medieval 64x64 em 2.5D completa (cacamba, fardos/sacos, 2 rodas grandes e varais)."""
    W64 = 64
    body = Canvas(W64, W64)

    def draw_wheel_64(cx: int, cy: int, rx: float, ry: float, dark_mul: float = 1.0) -> None:
        # Raios da roda
        for k in range(8):
            a = k * math.pi / 4 + 0.18
            x1 = int(round(cx + math.cos(a) * (rx - 1.5)))
            y1 = int(round(cy + math.sin(a) * (ry - 1.5)))
            line(body, cx, cy, x1, y1, rgba(shade(W, dark_mul)))
            line(body, cx + 1, cy, x1 + 1, y1, rgba(shade(W_D, dark_mul)))
        # Aro de madeira + pneu externo de ferro
        for y in range(int(cy - ry) - 2, int(cy + ry) + 3):
            for x in range(int(cx - rx) - 2, int(cx + rx) + 3):
                d = math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
                if 0.74 <= d <= 1.06:
                    lit = (x - cx) + (y - cy) < 0
                    if d >= 0.94:
                        c = IRON_L if lit else IRON_D
                    else:
                        c = W_L if lit else W_D
                    body.put(x, y, rgba(shade(c, dark_mul)))
        # Cubo central saliente
        fill_ellipse(
            body, cx, cy, 3.2, 3.2,
            lambda x, y, nx, ny: rgba(shade(IRON_H if nx + ny < 0 else IRON_D, dark_mul)),
        )

    # 1) Roda traseira em segundo plano
    draw_wheel_64(18, 39, 10.0, 10.5, dark_mul=0.78)

    # 2) Varais frontais inclinados para frente-direita (como em ref_m9_village_hub.jpg)
    for (x0, y0, x1, y1) in ((38, 37, 58, 49), (44, 33, 61, 44)):
        SV.brace(body, x0, y0, x1, y1)
    # Travessa entre os varais
    line(body, 48, 43, 53, 39, rgba(W_L))
    line(body, 48, 44, 53, 40, rgba(W_D))

    # 3) Carga interna da cacamba (fardos de palha dourada + sacos de estopa)
    # Fardo de palha a esquerda
    for y in range(13, 27):
        for x in range(11, 29):
            d = math.hypot((x - 20.0) / 9.5, (y - 20.0) / 7.0)
            if d <= 1.0:
                r = h01(x, y, 3501)
                c = TH_H if y < 17 and r > 0.4 else (TH_L if r > 0.35 else TH_M)
                if (x + y * 2) % 5 == 0:
                    c = TH_D
                body.put(x, y, rgba(c))
    # Sacos de graos a direita
    bur = ((92, 74, 48), (126, 102, 68), (156, 128, 88), (182, 154, 108))
    for (scx, scy, srx, sry) in ((32.0, 21.0, 7.5, 6.5), (40.0, 23.0, 6.5, 5.5)):
        fill_ellipse(
            body, scx, scy, srx, sry,
            lambda x, y, nx, ny: rgba(
                bur[3] if -0.6 * nx - 0.5 * ny > 0.45 else (bur[2] if -0.6 * nx - 0.5 * ny > 0 else bur[1])
            ),
        )

    # 4) Cacamba de tabuas de madeira 2.5D (lateral + traseira/frontal com fueiros)
    # Painel frontal-direito em perspectiva 2.5D (x=38..50, y=20..38)
    for xx in range(12):
        ys = int(xx * 0.45)
        for yy in range(16):
            x, y = 38 + xx, 23 - ys + yy
            c = W_D if yy % 4 == 0 else shade(W, 0.82)
            if yy == 0:
                c = W_L
            body.put(x, y, rgba(c))

    # Painel lateral principal da cacamba (x=8..39, y=21..39)
    for y in range(21, 39):
        for x in range(8, 39):
            plank_row = (y - 21) % 5
            if y == 21:
                c = W_H
            elif plank_row == 0:
                c = W_DD
            elif plank_row == 1:
                c = W_L
            else:
                c = W if h01(x, y, 3510) > 0.2 else shade(W, 0.86)
            body.put(x, y, rgba(c))

    # Fueiros verticais (estacas da cacamba) e cantoneiras de ferro
    for sx in (8, 18, 28, 37):
        SV.post_v(body, sx, 18, 40)
        fill_rect(body, sx, 21, 3, 2, rgba(IRON_L))
        fill_rect(body, sx, 36, 3, 2, rgba(IRON))

    # 5) Roda dianteira grande em primeiro plano (cx=28, cy=44, r=11.5)
    draw_wheel_64(28, 44, 11.5, 11.5, dark_mul=1.0)

    cv = Canvas(W64, W64)
    ellipse_shadow(cv, 31.0, 54.0, 26.0, 6.0, 140)
    blit(cv, outline(body), 0, 0)
    return cv


def prop_palisade_tall_h() -> Canvas:
    """Trecho largo 64x64 de palicada alta 2.5D (~54px altura) de toras rolicas apontadas."""
    W64 = 64
    body = Canvas(W64, W64)
    # 9 toras rolicas grossas ocupando x=0..64 sem fresta lateral
    logs = [
        (0, 7, 8), (7, 3, 8), (14, 9, 7), (20, 4, 8), (27, 6, 8),
        (34, 2, 8), (41, 8, 7), (47, 4, 9), (55, 6, 9),
    ]
    for i, (lx, yt, lw) in enumerate(logs):
        draw_pointed_log(body, lx, yt, 58, lw, 3600 + i * 11)

    # Duas travessas horizontais grossas com amarracoes de corda em X
    for ry in (26, 44):
        SV.beam_h(body, 0, W64, ry, 5)
        for lx, _, lw in logs:
            cx = lx + lw // 2
            for d in range(-2, 3):
                body.put((cx + d) % W64, ry + 2 + d // 2, rgba(TH_L))
                body.put((cx - d) % W64, ry + 2 + d // 2, rgba(TH_M))
            body.put(cx % W64, ry + 2, rgba(IRON_L))

    cv = outline(body)
    # Remove contorno vertical em x=0 e x=63 sobre as travessas/toras para emenda horizontal continua!
    for y in range(W64):
        if body.get(0, y)[3]:
            cv.put(0, y, body.get(0, y))
        if body.get(W64 - 1, y)[3]:
            cv.put(W64 - 1, y, body.get(W64 - 1, y))
    contact_shadow(cv, 0, W64, 59, 135)
    return cv


def prop_palisade_tall_v() -> Canvas:
    """Trecho lateral/canto 64x64 de palicada alta 2.5D com escora diagonal e cerca."""
    W64 = 64
    body = Canvas(W64, W64)
    # Toras altas em perspectiva lateral (x=6..36)
    logs = [
        (6, 2, 8, 52), (13, 5, 8, 55), (20, 3, 9, 57), (28, 7, 8, 58),
    ]
    for i, (lx, yt, lw, yb) in enumerate(logs):
        draw_pointed_log(body, lx, yt, yb, lw, 3700 + i * 13)

    # Escora diagonal pesada de madeira (brace) apoiada no chao a direita
    for d in range(-1, 2):
        SV.brace(body, 28, 25 + d, 55, 56 + d)
    # Estaca de ancoragem da escora no chao
    draw_pointed_log(body, 52, 45, 58, 6, 3755)

    # Cerca rustica frontal conectada (como no canto esquerdo de ref_m9_village_hub.jpg)
    for px in (10, 22, 34, 46):
        SV.post_v(body, px, 35, 58)
    SV.beam_h(body, 8, 52, 39, 4)
    SV.beam_h(body, 8, 52, 49, 4)

    cv = Canvas(W64, W64)
    ellipse_shadow(cv, 32.0, 58.5, 26.0, 4.5, 135)
    blit(cv, outline(body), 0, 0)
    return cv


def build_props_large() -> List[Tuple[str, Canvas]]:
    frames: List[Tuple[str, Canvas]] = []
    frames += [(f"campfire_large_{i}", prop_campfire_large(i)) for i in range(4)]
    frames += [(f"forge_large_{i}", prop_forge_large(i)) for i in range(4)]
    frames += [
        ("anvil_large", prop_anvil_large()),
        ("wooden_cart_large", prop_wooden_cart_large()),
        ("palisade_tall_h", prop_palisade_tall_h()),
        ("palisade_tall_v", prop_palisade_tall_v()),
    ]
    return frames


# ---------------------------------------------------------------------------
# 3. Casa de Palha 2.5D Rica e Detalhada (`village_hub_house.png`, 224x192 RGBA)
# ---------------------------------------------------------------------------

def build_house() -> Canvas:
    W_IMG, H_IMG = 224, 192
    body = Canvas(W_IMG, H_IMG)

    # Arquitetura 2.5D fiel a ref_m9_village_hub.jpg + surf_village.py:
    # - Ala esquerda sob a agua principal do telhado de sape (x=28..112, y=96..178)
    # - Ala direita com empena triangular frontal em enxaimel (x=112..198, y=24..180)
    # - Fundacao alta de pedra voronoi_stones na metade inferior (y=138..178)
    # - Janela acesa detalhada de surf_village.py a esquerda (x=54..86, y=104..136)
    # - Porta pesada recuada em 2.5D com degrau de pedra a direita (x=134..176, y=104..180)
    # - Tonel e lenha integrados na base esquerda (x=8..44, y=144..182)

    wall_x0, wall_x1 = 28, 198
    wall_y0, wall_y1 = 96, 178
    found_y0 = 140

    # 1) Parede de reboco envelhecido (`SV.plaster`) na fachada e na empena direita
    SV.plaster(body, wall_x0, wall_y0, wall_x1, found_y0, 0, 61)
    # Empena triangular direita (acima de y=96, de y=24 ate y=96, centrada em x=155)
    gable_cx = 155
    gable_top_y = 24
    for y in range(gable_top_y, wall_y0):
        t = (y - gable_top_y) / float(wall_y0 - gable_top_y)
        half_w = int(round(t * 46))
        SV.plaster(body, gable_cx - half_w, y, gable_cx + half_w, y + 1, y, 63)
        # Tabuas verticais / enxaimel escuro no timpano da empena (como em ref_m9)
        for x in range(gable_cx - half_w, gable_cx + half_w):
            c = body.get(x, y)[:3]
            c = mix(c, W_D if (x - gable_cx) % 7 == 0 else W, 0.55)
            if y < gable_top_y + 18:
                c = shade(c, 0.72)
            body.put(x, y, rgba(c))

    # Escurece levemente a ala esquerda para dar volume 2.5D entre os dois planos da parede
    darken_region(body, wall_x0, wall_y0, 84, found_y0 - wall_y0, 0.90)

    # 2) Embasamento alto de pedras irregulares (`voronoi_stones`) na metade inferior
    draw_voronoi_region(
        body, wall_x0, found_y0, 84, wall_y1 - found_y0 - 4,
        5101, 24, ST_TONES, ST_CRACK, sx=1.5, sy=1.0, brightness=0.92,
    )
    draw_voronoi_region(
        body, 112, found_y0, wall_x1 - 112, wall_y1 - found_y0 - 4,
        5102, 26, ST_TONES, ST_CRACK, sx=1.5, sy=1.0, brightness=1.02,
    )
    # Sombra sob a viga divisoria do embasamento + plinto escuro na base
    for x in range(wall_x0, wall_x1):
        body.put(x, found_y0, rgba(shade(body.get(x, found_y0)[:3], 0.58)))
        body.put(x, wall_y1 - 4, rgba((60, 54, 48)))
        body.put(x, wall_y1 - 3, rgba((38, 33, 29)))
        body.put(x, wall_y1 - 2, rgba((26, 22, 20)))
        body.put(x, wall_y1 - 1, rgba((17, 15, 14)))

    # Musgo e manchas de umidade no embasamento e reboco
    for (mx, my) in ((34, 173), (48, 174), (96, 173), (120, 174), (188, 173), (192, 172)):
        body.put(mx, my, rgba(SV.GRASS[0]))
        body.put(mx, my - 1, rgba(SV.GRASS[1]))
        body.put(mx + 1, my, rgba(SV.GRASS[2]))

    # 3) Madeiramento em enxaimel (`beam_h`, `post_v`, `brace` de `surf_village.py`)
    # Maos-francesas diagonais nos paineis
    SV.brace(body, 32, 134, 52, 102)
    SV.brace(body, 108, 134, 88, 102)
    SV.brace(body, 116, 94, 138, 62)
    SV.brace(body, 192, 94, 170, 62)
    # Postes verticais grossos
    for px in (28, 30, 110, 112, 194, 196):
        SV.post_v(body, px, wall_y0 if px < 110 else 64, wall_y1 - 2)
    SV.post_v(body, 154, 28, 96)
    # Vigas horizontais
    SV.beam_h(body, wall_x0, wall_x1, wall_y0, 4)
    SV.beam_h(body, wall_x0, wall_x1, found_y0 - 3, 4)
    SV.beam_h(body, 122, 188, 64, 4)
    # Fresta/respiro medieval de sotao no timpano da empena direita
    for (lx0, lx1) in ((144, 150), (160, 166)):
        fill_rect(body, lx0, 46, lx1 - lx0, 12, rgba(W_DD))
        fill_rect(body, lx0 + 1, 47, lx1 - lx0 - 2, 10, rgba((24, 16, 12)))
        for ly in (49, 52, 55):
            fill_rect(body, lx0 + 1, ly, lx1 - lx0 - 2, 1, rgba(W_L))

    # 4) Janela acesa detalhada a esquerda (reutilizando `SV.window` de `surf_village.py`!)
    win_cv = Canvas(T, T)
    SV.window(win_cv, lit=1.05)
    blit(body, win_cv, 54, 100)
    draw_warm_glow(body, 70, 116, 22.0, 18.0, SV.GOLD, 70)

    # 5) Porta pesada de tabuas com batente recuado em 2.5D, ferragens e degrau de pedra (a direita)
    dx0, dy0, dw, dh = 134, 102, 42, 74
    # Batente externo de madeira macica + ombreira de pedra
    for y in range(dy0 - 5, dy0 + dh):
        for x in range(dx0 - 6, dx0 + dw + 6):
            if dx0 <= x < dx0 + dw and y >= dy0:
                continue
            if y < dy0:
                c = W_H if y == dy0 - 5 else (W_L if y == dy0 - 4 else (W if y < dy0 - 1 else W_DD))
            else:
                c = W_L if x in (dx0 - 6, dx0 + dw + 1) else (W if x in (dx0 - 5, dx0 - 4, dx0 + dw + 2, dx0 + dw + 3) else W_D)
            body.put(x, y, rgba(c))
    # Recuo 2.5D interno do batente esquerdo e superior (mostra espessura 3D da parede!)
    fill_rect(body, dx0, dy0, 5, dh, rgba(W_DD))
    fill_rect(body, dx0 + 5, dy0, 2, dh, rgba(W_D))
    fill_rect(body, dx0, dy0, dw, 4, rgba(W_DD))

    # Folha da porta de tabuas verticais de carvalho
    for y in range(dy0 + 4, dy0 + dh):
        for x in range(dx0 + 6, dx0 + dw):
            plank = (x - (dx0 + 6)) // 6
            px = (x - (dx0 + 6)) % 6
            base = shade(W, 0.94 + (plank % 2) * 0.08)
            if px == 0:
                c = W_DD
            elif px == 1:
                c = shade(base, 1.18)
            elif px == 5:
                c = shade(base, 0.76)
            else:
                c = base
                if h01(x, y, 4101) < 0.16:
                    c = shade(c, 0.84)
            if y < dy0 + 8:
                c = shade(c, 0.72)
            body.put(x, y, rgba(c))

    # Travessas de madeira e dobradicas longas de ferro forjado com rebites
    for ty in (dy0 + 14, dy0 + 54):
        SV.beam_h(body, dx0 + 6, dx0 + dw, ty, 4)
        fill_rect(body, dx0 + 6, ty + 1, 16, 2, rgba(IRON))
        fill_rect(body, dx0 + 6, ty + 1, 16, 1, rgba(IRON_L))
        for rx in (dx0 + 8, dx0 + 13, dx0 + 19):
            body.put(rx, ty + 1, rgba(IRON_H))
    # Argola de ferro a direita
    fill_rect(body, dx0 + dw - 9, dy0 + 34, 5, 6, rgba(IRON_D))
    fill_rect(body, dx0 + dw - 8, dy0 + 35, 3, 4, rgba(IRON_H))
    fill_rect(body, dx0 + dw - 7, dy0 + 36, 1, 2, rgba(W_DD))

    # Degrau largo de pedra esculpida 2.5D na soleira da porta
    draw_voronoi_region(body, dx0 - 8, dy0 + dh - 2, dw + 16, 9, 4150, 8, ST_TONES, ST_CRACK, sx=1.8, sy=1.0, brightness=1.12)
    fill_rect(body, dx0 - 8, dy0 + dh - 2, dw + 16, 1, rgba(ST_H))
    fill_rect(body, dx0 - 8, dy0 + dh + 6, dw + 16, 2, rgba(ST_CRACK))

    # 6) Sombra forte projetada pelo beiral do telhado sobre a fachada (`overhang_shadow`)
    for dy, f in enumerate((0.32, 0.45, 0.58, 0.70, 0.82, 0.90)):
        darken_region(body, wall_x0, wall_y0 + dy, 86, 1, f)
    # Sombra projetada pelos caibros da empena triangular sobre a parede direita
    for y in range(gable_top_y + 4, wall_y0 + 10):
        t = (y - gable_top_y) / float(wall_y0 - gable_top_y)
        half_w = int(round(t * 48))
        for dy, f in enumerate((0.35, 0.50, 0.65, 0.80, 0.90)):
            yy = y + dy
            if yy < H_IMG:
                for xx in (gable_cx - half_w, gable_cx - half_w + 1, gable_cx + half_w - 1, gable_cx + half_w):
                    if wall_x0 <= xx < wall_x1 and body.get(xx, yy)[3]:
                        body.put(xx, yy, rgba(shade(body.get(xx, yy)[:3], f)))

    # 7) Telhado de Sape 2.5D Volumoso (`y=6..108`)
    # Agua principal esquerda (de x_ridge=44..155 em y=16 ate o beiral frontal x=12..112 em y=102)
    # + Aba da empena frontal direita (cobrindo as duas aguas da empena de x=104..212)
    ridge_y = 16
    eave_y = 102
    tiers = (32, 46, 60, 74, 88, 102)  # fiadas sobrepostas de feixes de palha

    for y in range(ridge_y, eave_y + 6):
        t = (y - ridge_y) / float(eave_y - ridge_y)
        x_left = int(round(44 - t * 32))
        # A agua esquerda encontra o vale (rincon) da empena direita em x_valley
        x_valley = int(round(155 - t * 47))
        for x in range(x_left, x_valley + 1):
            eave_drop = int((h01(x // 2, 3, 4201) - 0.45) * 6)
            if y > eave_y + eave_drop:
                continue
            # Encontra a fiada atual de sape
            tier_bot = eave_y
            for tb in tiers:
                j_tb = tb + int((vnoise(x, tb, 32, 4205, 6.0) - 0.5) * 3.0)
                if y <= j_tb:
                    tier_bot = j_tb
                    break
            dist_tier = tier_bot - y
            # Fios direcionais de palha inclinados acompanhando a caida do telhado
            slope_u = x + int((y - ridge_y) * 0.35)
            strand = h01(slope_u, y // 3, 4211)
            n = vnoise(x, y, 32, 4219, 6.0)
            lit = 1.06 - t * 0.24 - (x - x_left) / max(1.0, (160 - x_left)) * 0.16

            if dist_tier == 0:
                c = TH_VOID if strand < 0.75 else TH_DD
            elif dist_tier == 1:
                c = TH_DD if strand < 0.5 else TH_D
            elif strand > 0.80 and lit > 0.78:
                c = TH_TIP if dist_tier < 5 else TH_H
            elif strand > 0.50 or n > 0.58:
                c = TH_H if lit > 0.86 else (TH_L if lit > 0.68 else TH_M)
            elif strand > 0.20:
                c = TH_M if lit > 0.62 else TH_D
            else:
                c = TH_D if lit > 0.55 else TH_DD

            # Borda esquerda chanfrada com espessura 2.5D de feixes de sape
            if x < x_left + 5:
                c = TH_H if x < x_left + 2 else TH_L
            # Sombra no vale onde a agua esquerda encontra a empena direita
            if x > x_valley - 5:
                c = shade(c, 0.72)
            if y >= eave_y - 2 + eave_drop:
                c = TH_VOID if y == eave_y + eave_drop else shade(c, 0.68)
            body.put(x, y, rgba(c))

    # Remendo de tabuas de madeira escura pregadas na agua esquerda do telhado (fiel a ref_m9!)
    px0, py0, pw, ph = 50, 50, 34, 24
    for ry in range(py0, py0 + ph):
        shift = -int((ry - py0) * 0.32)
        for rx in range(px0 + shift, px0 + shift + pw):
            plank_idx = (ry - py0) // 5
            in_gap = (ry - py0) % 5 == 0
            if in_gap or rx in (px0 + shift, px0 + shift + pw - 1):
                c = W_DD
            else:
                c = (56, 44, 36) if plank_idx % 2 == 0 else (44, 34, 28)
                if (ry - py0) % 5 == 1:
                    c = (74, 58, 46)
                if h01(rx, ry, 4255) < 0.18:
                    c = shade(c, 0.82)
            body.put(rx, ry, rgba(c))
        # Pregos de ferro nas extremidades de cada tabua do remendo
        if (ry - py0) % 5 == 2:
            body.put(px0 + shift + 3, ry, rgba(IRON_H))
            body.put(px0 + shift + pw - 4, ry, rgba(IRON_L))
    # Sombra embaixo do remendo sobre a palha
    for rx in range(px0 - 8, px0 - 8 + pw):
        body.put(rx, py0 + ph, rgba(TH_VOID))

    # Tufos sutis de musgo esverdeado nas dobras do sape
    rng_moss = random.Random(4277)
    for (mx, my, mr) in ((38, 74, 5), (88, 60, 6), (72, 87, 5), (112, 45, 4)):
        leaf_blobs(body, rng_moss, 8, mx, my, mr * 2, mr, (SV.GRASS[0], SV.GRASS[0], SV.GRASS[1], SV.GRASS[2]), 1.2, 2.0, wrap=False)

    # Beiral espesso de sape e caibros de madeira da empena triangular direita (x=104..214, y=16..104)
    for y in range(ridge_y, eave_y + 3):
        t = (y - ridge_y) / float(eave_y - ridge_y)
        xl_g = int(round(gable_cx - t * 50))
        xr_g = int(round(gable_cx + t * 57))
        # Aba esquerda da empena (iluminada de cima-esquerda: sape + caibro escuro abaixo)
        for dx in range(-5, 6):
            xx = xl_g + dx
            if dx < 0:
                c = TH_H if dx == -5 else (TH_L if dx < -2 else TH_M)
            elif dx == 0:
                c = TH_DD
            else:
                c = W_L if dx == 1 else (W if dx < 4 else W_DD)
            body.put(xx, y, rgba(c))
        # Aba direita da empena (caibro + espessura de sape a direita)
        for dx in range(-5, 9):
            xx = xr_g + dx
            if dx < 0:
                c = W_DD if dx == -5 else (W_D if dx < -1 else W_L)
            elif dx < 6:
                c = TH_M if (y + dx) % 3 else TH_D
            else:
                c = TH_DD
            body.put(xx, y, rgba(c))

    # Cumeeira volumosa de sape + caibros de madeira cruzados em X no topo (`y=6..24`)
    for x in range(42, gable_cx + 3):
        for dy, col in enumerate((TH_TIP, TH_H, TH_L, TH_M, TH_D, TH_DD)):
            if h01(x, dy, 4290) > 0.15:
                body.put(x, ridge_y - 2 + dy, rgba(col))

    for cx in (54, 84, 114, 144):
        SV.brace(body, cx - 7, ridge_y - 8, cx + 6, ridge_y + 4)
        SV.brace(body, cx + 7, ridge_y - 8, cx - 6, ridge_y + 4)

    # 8) Detalhes integrados na base/lateral esquerda: barril + pilha de lenha + vegetacao
    barrel_cv = DB.prop_barrel()
    blit(body, barrel_cv, 6, 150)
    firewood_cv = SV.prop_firewood()
    blit(body, firewood_cv, 22, 154)

    # Sombra eliptica/projetada no chao (`y=176..190`)
    cv = Canvas(W_IMG, H_IMG)
    ellipse_shadow(cv, 114.0, 180.0, 98.0, 10.0, 145)
    blit(cv, outline(body), 0, 0)
    return cv


# ---------------------------------------------------------------------------
# 4. Portao de Pedra e Madeira 2.5D (`village_hub_gate.png`, 192x160 RGBA)
# ---------------------------------------------------------------------------

def build_gate() -> Canvas:
    W_G, H_G = 192, 160
    body = Canvas(W_G, H_G)

    # 1) Viga dupla superior de madeira escura e maos-francesas (`y=20..76`)
    # Desenhamos as vigas e maos-francesas primeiro na zona central, e depois os pilares
    # cobrem os engastes com sombra projetada realista!
    # Viga superior principal (x=48..144, y=22..36) com topo 2.5D visivel
    for y in range(22, 37):
        for x in range(48, 144):
            if y < 25:
                c = W_H if y == 22 else W_L  # topo 2.5D da viga
            elif y == 25:
                c = W_DD
            elif y >= 35:
                c = W_DD
            else:
                c = W if h01(x, y, 4501) > 0.22 else W_D
                if (y - 25) == 5:
                    c = W_DD
            body.put(x, y, rgba(c))

    # Segunda viga horizontal inferior (x=54..138, y=42..53)
    for y in range(42, 54):
        for x in range(54, 138):
            if y < 44:
                c = W_L
            elif y >= 52:
                c = W_DD
            else:
                c = shade(W, 0.90) if h01(x, y, 4507) > 0.25 else W_D
            body.put(x, y, rgba(c))

    # Montantes verticais curtos e cintas de ferro forjado com rebites unindo a viga dupla
    for bx in (64, 93, 122):
        fill_rect(body, bx, 36, 6, 7, rgba(W_D))
        for (y0, yh) in ((22, 15), (42, 12)):
            fill_rect(body, bx, y0, 6, yh, rgba(IRON))
            fill_rect(body, bx, y0, 2, yh, rgba(IRON_L))
            fill_rect(body, bx + 5, y0, 1, yh, rgba(IRON_DD))
            body.put(bx + 2, y0 + 3, rgba(IRON_H))
            body.put(bx + 2, y0 + yh - 4, rgba(IRON_H))

    # 2) Folhas do portao entreabertas em perspectiva 2.5D (`x=60..84` e `x=110..130`, `y=52..146`)
    # Folha esquerda (entreaberta para dentro)
    for x in range(60, 84):
        t = (x - 60) / 23.0
        y_top = 52
        y_bot = int(round(146 - t * 8))
        plank = (x - 60) // 5
        px = (x - 60) % 5
        for y in range(y_top, y_bot):
            base = shade(W, (0.95 - t * 0.15) + (plank % 2) * 0.07)
            c = W_DD if px == 0 else (shade(base, 1.15) if px == 1 else base)
            if x >= 81:
                c = W_L if x == 82 else W_D  # espessura lateral da folha do portao
            if y in (64, 65, 98, 99, 128, 129):
                c = IRON_L if y % 2 == 0 else IRON_D
                if px == 2 and y % 2 == 0:
                    c = IRON_H
            if y < 58:
                c = shade(c, 0.65)
            body.put(x, y, rgba(c))

    # Folha direita (entreaberta para dentro)
    for x in range(110, 130):
        t = (129 - x) / 19.0
        y_top = 52
        y_bot = int(round(146 - t * 8))
        plank = (x - 110) // 5
        px = (x - 110) % 5
        for y in range(y_top, y_bot):
            base = shade(W, (0.92 - t * 0.15) + (plank % 2) * 0.07)
            c = W_DD if px == 0 else (shade(base, 1.12) if px == 1 else base)
            if x <= 112:
                c = W_L if x == 111 else W_DD  # espessura lateral
            if y in (64, 65, 98, 99, 128, 129):
                c = IRON_L if y % 2 == 0 else IRON_D
                if px == 2 and y % 2 == 0:
                    c = IRON_H
            if y < 58:
                c = shade(c, 0.65)
            body.put(x, y, rgba(c))

    # Maos-francesas diagonais grossas (`brace`) em primeiro plano entre os pilares e a viga inferior,
    # projetando sombra real sobre as folhas do portao!
    for i in range(25):
        # Sombra projetada pela mao-francesa sobre a folha do portao logo abaixo
        for sdy in range(3, 7):
            for (sx, sy) in ((62 + i, 74 - i + sdy), (130 - i, 74 - i + sdy)):
                cur = body.get(sx, sy)
                if cur[3]:
                    body.put(sx, sy, rgba(shade(cur[:3], 0.58)))
    for d in range(-2, 3):
        SV.brace(body, 60, 74 + d, 84, 50 + d)
        SV.brace(body, 132, 74 + d, 108, 50 + d)
    # Chapas/rebites de ferro nos engastes das maos-francesas
    for (rx, ry) in ((65, 70), (81, 53), (127, 70), (111, 53)):
        fill_rect(body, rx - 1, ry - 1, 3, 3, rgba(IRON))
        body.put(rx, ry, rgba(IRON_H))

    # 3) Dois pilares macicos de alvenaria de pedra (`x=14..64` e `x=128..178`, `y=14..152`)
    # Cada pilar tem:
    # - Topo 2.5D visivel (lajes chanfradas vistas de cima com luz superior)
    # - Face frontal em voronoi_stones + pedras de cantaria nas quinas
    # - Face lateral interna mostrando espessura 3D real!
    # - Plinto escalonado de pedra na base com rachaduras e musgo

    def build_pillar_3d(x_front0: int, w_front: int, x_side0: int, w_side: int, is_left: bool, seed: int) -> None:
        p_x0 = min(x_front0, x_side0)
        p_x1 = max(x_front0 + w_front, x_side0 + w_side)
        p_w = p_x1 - p_x0

        # A) Capitel superior com topo 2.5D (`y=14..31`)
        cap_x0, cap_w = p_x0 - 3, p_w + 6
        # Plano horizontal superior 2.5D (`y=14..21`, chanfrado em perspectiva)
        draw_voronoi_region(body, cap_x0, 14, cap_w, 8, seed + 1, 8, ST_TONES, ST_CRACK, sx=1.8, sy=1.0, brightness=1.26)
        fill_rect(body, cap_x0, 14, cap_w, 1, rgba(ST_H))
        fill_rect(body, cap_x0, 21, cap_w, 1, rgba(shade(ST_H, 1.12)))
        # Face frontal do capitel (`y=22..29`)
        cf_x0 = x_front0 - 3 if is_left else x_front0
        cf_w = w_front + 3
        draw_voronoi_region(body, cf_x0, 22, cf_w, 8, seed + 2, 6, ST_TONES, ST_CRACK, sx=1.8, sy=1.0, brightness=1.06)
        fill_rect(body, cf_x0, 22, cf_w, 1, rgba(ST_H))
        # Face lateral interna 3D do capitel
        cs_x0 = x_side0 if is_left else x_side0 - 3
        cs_w = w_side + 3
        draw_voronoi_region(body, cs_x0, 22, cs_w, 8, seed + 3, 3, ST_TONES, ST_CRACK, sx=1.2, sy=1.0, brightness=0.70)
        fill_rect(body, cap_x0, 29, cap_w, 2, rgba(ST_CRACK))

        # B) Corpo do pilar: Face frontal (`y=31..140`) em voronoi_stones estratificado
        draw_voronoi_region(
            body, x_front0, 31, w_front, 109,
            seed + 10, 36, ST_TONES, ST_CRACK, sx=1.5, sy=1.0, brightness=1.04,
        )
        # C) Corpo do pilar: Face lateral interna 3D (`y=31..140`) mostrando espessura real!
        draw_voronoi_region(
            body, x_side0, 31, w_side, 109,
            seed + 20, 16, ST_TONES, ST_CRACK, sx=1.2, sy=1.0, brightness=0.68,
        )
        # Quina 3D entre a face frontal e a face lateral interna (highlight organico na aresta 3D)
        seam_x = x_side0 if is_left else x_front0
        for y in range(31, 140):
            c_left = body.get(seam_x - 1, y)[:3]
            c_right = body.get(seam_x, y)[:3]
            if c_left != ST_CRACK:
                body.put(seam_x - 1, y, rgba(shade(c_left, 1.14 if is_left else 0.80)))
            if c_right != ST_CRACK:
                body.put(seam_x, y, rgba(shade(c_right, 0.80 if is_left else 1.16)))

        # Sombra projetada pelo capitel sobre o topo do fuste
        for dy, f in enumerate((0.45, 0.62, 0.78, 0.90)):
            darken_region(body, p_x0, 31 + dy, p_w, 1, f)

        # D) Plinto escalonado de pedra na base (`y=140..152`)
        pl_x0, pl_w = p_x0 - 2, p_w + 4
        draw_voronoi_region(body, pl_x0, 140, pl_w, 11, seed + 30, 10, ST_TONES, ST_CRACK, sx=1.7, sy=1.0, brightness=0.92)
        if is_left:
            darken_region(body, x_side0, 140, w_side + 2, 11, 0.75)
        else:
            darken_region(body, pl_x0, 140, w_side + 2, 11, 0.75)
        fill_rect(body, pl_x0, 140, pl_w, 1, rgba(ST_H))
        fill_rect(body, pl_x0, 150, pl_w, 2, rgba(ST_CRACK))

        # Musgo na base de pedra
        rng_m = random.Random(seed + 99)
        for mx in (p_x0 + 4, p_x0 + 18, p_x0 + 34):
            leaf_blobs(body, rng_m, 6, mx, 144, 9, 6, (SV.GRASS[0], SV.GRASS[0], SV.GRASS[1], SV.GRASS[2]), 1.2, 2.0, wrap=False)

    # Pilar Esquerdo: face frontal x=14..51 (37px), face lateral interna 3D x=51..64 (13px)
    build_pillar_3d(14, 37, 51, 13, True, 4600)
    # Pilar Direito: face lateral interna 3D x=128..141 (13px), face frontal x=141..178 (37px)
    build_pillar_3d(141, 37, 128, 13, False, 4700)

    # Sombra projetada pelas vigas sobre as faces laterais internas dos pilares
    darken_region(body, 51, 37, 13, 6, 0.55)
    darken_region(body, 128, 37, 13, 6, 0.55)
    darken_region(body, 51, 54, 13, 5, 0.62)
    darken_region(body, 128, 54, 13, 5, 0.62)

    # 4) Placa rustica `"SAIDA"` fixada no pilar direito (`x=130..188, y=58..84`)
    # Suporte de madeira e argolas de ferro no topo da placa
    SV.beam_h(body, 136, 186, 56, 3)
    for cx_chain in (144, 178):
        fill_rect(body, cx_chain, 58, 2, 4, rgba(IRON_L))
    sx0, sy0, sw, sh = 132, 61, 56, 22
    for y in range(sy0, sy0 + sh):
        for x in range(sx0, sx0 + sw):
            if x in (sx0, sx0 + sw - 1) or y in (sy0, sy0 + sh - 1):
                c = IRON_D
            elif x in (sx0 + 1, sx0 + sw - 2) or y in (sy0 + 1, sy0 + sh - 2):
                c = IRON if (x + y) % 2 else W_L
            else:
                plank_row = (y - sy0) % 5
                c = W_DD if plank_row == 0 else (W_L if plank_row == 1 else W_D)
                if h01(x, y, 4801) < 0.2:
                    c = shade(c, 0.85)
            body.put(x, y, rgba(c))
    # Cantoneiras e rebites de ferro nos 4 cantos da placa
    for (rx, ry) in ((sx0 + 2, sy0 + 2), (sx0 + sw - 3, sy0 + 2), (sx0 + 2, sy0 + sh - 3), (sx0 + sw - 3, sy0 + sh - 3)):
        body.put(rx, ry, rgba(IRON_H))
    # Palavra "SAÍDA" grande, nitida e legivel em ouro-palido/pergaminho
    draw_pixel_word(body, "SAÍDA", sx0 + 14, sy0 + 8, (244, 228, 188), (20, 12, 8), large=True)

    # Sombra sob os dois pilares (mantendo o vao central x=65..127 transparente!)
    cv = Canvas(W_G, H_G)
    ellipse_shadow(cv, 39.0, 152.0, 29.0, 6.0, 145)
    ellipse_shadow(cv, 153.0, 152.0, 29.0, 6.0, 145)
    blit(cv, outline(body), 0, 0)
    return cv


# ---------------------------------------------------------------------------
# 5. Manifesto Parcial (`scripts/art/biomes/out/village_hub_assets.manifest.json`)
# ---------------------------------------------------------------------------

def build_manifest(
    tiles: Sequence[Tuple[str, Canvas]],
    props: Sequence[Tuple[str, Canvas]],
    props_large: Sequence[Tuple[str, Canvas]],
    house: Canvas,
    gate: Canvas,
) -> Dict:
    prop_names = [n for n, _ in props]
    large_names = [n for n, _ in props_large]

    def idx_range(names: List[str], prefix: str, count: int) -> List[int]:
        return [names.index(f"{prefix}_{i}") for i in range(count)]

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
                    "campfire": {"frames": idx_range(prop_names, "campfire", 4), "frameRate": 8, "repeat": -1},
                    "brazier": {"frames": idx_range(prop_names, "brazier", 4), "frameRate": 8, "repeat": -1},
                    "torch_post": {"frames": idx_range(prop_names, "torch_post", 4), "frameRate": 8, "repeat": -1},
                    "forge": {"frames": idx_range(prop_names, "forge", 4), "frameRate": 7, "repeat": -1},
                },
            },
            "village_hub_props_large": {
                "key": "village_hub_props_large",
                "file": "village_hub_props_large.png",
                "width": len(props_large) * 64,
                "height": 64,
                "frameWidth": 64,
                "frameHeight": 64,
                "frames": large_names,
                "origin": {"x": 0.5, "y": 0.88},
                "animations": {
                    "campfire_large": {"frames": idx_range(large_names, "campfire_large", 4), "frameRate": 8, "repeat": -1},
                    "forge_large": {"frames": idx_range(large_names, "forge_large", 4), "frameRate": 7, "repeat": -1},
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
                "origin": {"x": 0.5, "y": 0.9},
            },
            "village_hub_gate": {
                "key": "village_hub_gate",
                "file": "village_hub_gate.png",
                "width": gate.w,
                "height": gate.h,
                "frameWidth": gate.w,
                "frameHeight": gate.h,
                "frames": ["gate"],
                "origin": {"x": 0.5, "y": 0.92},
            },
        }
    }


# ---------------------------------------------------------------------------
# 6. Prancha de Validacao (`assets/mockups/preview_m9_village_assets.png`)
# ---------------------------------------------------------------------------

def build_preview(
    tiles: Sequence[Tuple[str, Canvas]],
    props: Sequence[Tuple[str, Canvas]],
    props_large: Sequence[Tuple[str, Canvas]],
    house: Canvas,
    gate: Canvas,
    out_path: Path,
) -> Tuple[int, int]:
    W_P, H_P = 1280, 1480
    cv = Canvas(W_P, H_P, (18, 18, 24, 255))
    c_title = (241, 210, 138)
    c_head = (148, 163, 184)
    c_lbl = (226, 232, 240)
    labels = [
        text_item(
            "SUBMUNDO · Vila Natal Hub Assets 2.5D (BRF-147 / T-133) — Prancha de Validação",
            24, 18, 17, c_title, "Palatino Linotype", True,
        ),
    ]

    tmap = dict(tiles)
    pmap = dict(props)
    lmap = dict(props_large)

    # --- Secao 1: Tiles 32x32 (2x) + Teste de Repeticao 6x4 (ZERO grade aparente) ---
    labels.append(text_item(
        "1. village_hub_tiles.png — 32×32 · 10 frames (2×) + Teste de Repetição Contínua 6×4 (1× e 2×, ZERO costura)",
        24, 52, 12, c_head, "Consolas", True,
    ))
    for i, (name, tile) in enumerate(tiles):
        col, row = i % 5, i // 5
        x = 24 + col * 92
        y = 74 + row * 92
        checker(cv, x, y, 64, 64)
        blit(cv, upscale(tile, 2), x, y)
        labels.append(text_item(f"{i}: {name}", x, y + 68, 8.8, c_lbl, "Consolas"))

    # Bloco 6x4 de dirt_0..2 (ampliado 1.5x / 1x) e bloco 6x4 de grass_0..1 + transicao + dirt_cobble
    patch_dirt = Canvas(6 * T, 4 * T)
    for ty in range(4):
        for tx in range(6):
            tn = ("dirt_0", "dirt_1", "dirt_2")[(tx * 3 + ty * 5) % 3]
            blit(patch_dirt, tmap[tn], tx * T, ty * T)
    fill_rect(cv, 510, 72, patch_dirt.w + 4, patch_dirt.h + 4, (40, 36, 34, 255))
    blit(cv, patch_dirt, 512, 74)
    labels.append(text_item("Bloco 6×4 dirt_0..2 (1×: zero grade 32×32)", 512, 74 + patch_dirt.h + 8, 9, c_lbl, "Consolas"))

    patch_grass = Canvas(6 * T, 4 * T)
    for ty in range(4):
        for tx in range(6):
            if ty < 2:
                tn = "grass_0" if (tx + ty) % 2 == 0 else "grass_1"
            elif ty == 2:
                tn = "dirt_grass_n"
            else:
                tn = "dirt_cobble" if tx >= 3 else "dirt_trail"
            blit(patch_grass, tmap[tn], tx * T, ty * T)
    fill_rect(cv, 734, 72, patch_grass.w + 4, patch_grass.h + 4, (40, 36, 34, 255))
    blit(cv, patch_grass, 736, 74)
    labels.append(text_item("Bloco 6×4 grass_0..1 + dirt_grass_n + cobble", 736, 74 + patch_grass.h + 8, 9, c_lbl, "Consolas"))

    # Amostra 2x de 4x2 tiles de dirt_0..2 para inspecao de pixels da costura
    patch_zoom = Canvas(4 * T, 2 * T)
    for ty in range(2):
        for tx in range(4):
            tn = ("dirt_0", "dirt_1", "dirt_2")[(tx + ty * 2) % 3]
            blit(patch_zoom, tmap[tn], tx * T, ty * T)
    pz2 = upscale(patch_zoom, 2)
    fill_rect(cv, 960, 72, pz2.w + 4, pz2.h + 4, (40, 36, 34, 255))
    blit(cv, pz2, 962, 74)
    labels.append(text_item("Zoom 2× (4×2 tiles dirt_0..2)", 962, 74 + pz2.h + 8, 9, c_lbl, "Consolas"))

    # --- Secao 2: Props 32x32 (28 frames, 2x) ---
    sec2_y = 276
    labels.append(text_item(
        "2. village_hub_props.png — 32×32 · 28 frames (2×)",
        24, sec2_y, 12, c_head, "Consolas", True,
    ))
    for i, (name, prop) in enumerate(props):
        col, row = i % 10, i // 10
        x = 24 + col * 122
        y = sec2_y + 22 + row * 86
        checker(cv, x, y, 64, 64)
        blit(cv, upscale(prop, 2), x, y)
        labels.append(text_item(f"{i}: {name}", x, y + 66, 8.5, c_lbl, "Consolas"))

    # --- Secao 3: Props Monumentais 64x64 (`village_hub_props_large.png`, 12 frames, 2x) ---
    sec3_y = 568
    labels.append(text_item(
        "3. village_hub_props_large.png — 64×64 · 12 frames em escala herói 80×80 (2× = 128×128)",
        24, sec3_y, 12, c_head, "Consolas", True,
    ))
    for i, (name, prop_lg) in enumerate(props_large):
        col, row = i % 6, i // 6
        x = 24 + col * 206
        y = sec3_y + 22 + row * 154
        checker(cv, x, y, 128, 128)
        blit(cv, upscale(prop_lg, 2), x, y)
        labels.append(text_item(f"{i}: {name}", x, y + 131, 8.8, c_lbl, "Consolas"))

    # --- Secao 4: Estruturas 2.5D Dedicadas + Mini-Cena Montada com Escala Monumental ---
    sec4_y = 908
    labels.append(text_item(
        "4. Estruturas 2.5D (village_hub_house 224×192 + village_hub_gate 192×160) & Composição Completa 2.5D",
        24, sec4_y, 12, c_head, "Consolas", True,
    ))

    # House (1x + 2x ou 1x sobre checker)
    hx, hy = 24, sec4_y + 24
    checker(cv, hx, hy, house.w, house.h)
    blit(cv, house, hx, hy)
    labels.append(text_item(f"village_hub_house.png ({house.w}×{house.h} 1×)", hx, hy + house.h + 6, 9.5, c_lbl, "Consolas"))

    gx, gy = hx + house.w + 24, sec4_y + 24
    checker(cv, gx, gy, gate.w, gate.h)
    blit(cv, gate, gx, gy)
    labels.append(text_item(f"village_hub_gate.png ({gate.w}×{gate.h} 1×)", gx, gy + gate.h + 6, 9.5, c_lbl, "Consolas"))

    # Amostra ampliada 2x de recorte da Casa e do Portao logo abaixo para inspecao de textura
    house_2x = upscale(house, 2)
    # Mostra a casa 1.5x/2x ou lado a lado se couber: temos espaco y=1136..1460 (324px de altura!)
    # Vamos colocar um recorte/zoom 2x da fachada da casa e do portao com a placa SAIDA!
    crop_h = Canvas(224, 152)
    blit(crop_h, house, 0, -32)
    blit(cv, upscale(crop_h, 1), hx, hy + house.h + 28)
    # Na verdade, vamos exibir o Portao 2x (384x320) em x=24, y=1140!
    gate_2x = upscale(gate, 2)
    checker(cv, 24, 1140, gate_2x.w, gate_2x.h)
    blit(cv, gate_2x, 24, 1140)
    labels.append(text_item("village_hub_gate (zoom 2× — 384×320)", 24, 1140 + gate_2x.h + 4, 9, c_lbl, "Consolas"))

    # --- Composicao completa da Vila Natal (24x16 tiles = 768x512) a direita ---
    mx, my = 480, sec4_y + 24
    mw, mh = 768, 512  # 24x16 tiles
    scene = Canvas(mw, mh)

    for ty in range(16):
        for tx in range(24):
            if ty <= 1 or tx == 0 or tx == 23 or ty == 15:
                tn = "grass_0" if (tx + ty) % 2 == 0 else "grass_1"
            elif ty == 2:
                tn = "dirt_grass_n"
            elif ty == 14:
                tn = "dirt_grass_s"
            elif tx in (16, 17, 18) and ty <= 8:
                tn = "dirt_trail"
            elif tx == 11 and ty == 9:
                tn = "dirt_ash"
            elif (4 <= tx <= 8 and ty in (6, 7)) or (16 <= tx <= 18 and ty == 5):
                tn = "dirt_cobble"
            else:
                tn = ("dirt_0", "dirt_1", "dirt_2")[(tx * 3 + ty * 5) % 3]
            blit(scene, tmap[tn], tx * T, ty * T)

    # Casa de Palha 2.5D (224x192) no quadrante superior esquerdo
    blit(scene, house, 48, 22)
    # Portao de Pedra 2.5D (192x160) no quadrante superior direito
    blit(scene, gate, 468, 18)
    # Carroca 64x64 em frente ao pilar esquerdo do portao (como na ref_m9!)
    blit(scene, lmap["wooden_cart_large"], 442, 134)
    # Braseiro aceso ao lado da porta da casa (onde Lyra fica)
    blit(scene, pmap["brazier_1"], 234, 188)
    # Fogueira central 64x64
    blit(scene, lmap["campfire_large_1"], 348, 256)
    # Forja 64x64 + Bigorna 64x64 + Barril na area do Ferreiro Gorran a direita
    blit(scene, lmap["anvil_large"], 514, 266)
    blit(scene, lmap["forge_large_1"], 582, 272)
    blit(scene, pmap["barrel"], 648, 248)
    # Palicada alta 64x64 na lateral esquerda e na borda inferior (fiel a ref_m9!)
    blit(scene, lmap["palisade_tall_v"], 12, 196)
    blit(scene, lmap["palisade_tall_v"], 12, 260)
    for px in range(24, 700, 64):
        if 310 <= px <= 400:
            continue
        blit(scene, lmap["palisade_tall_h"], px, 428)
    blit(scene, pmap["torch_post_1"], 248, 412)
    blit(scene, pmap["torch_post_2"], 384, 122)

    fill_rect(cv, mx - 2, my - 2, mw + 4, mh + 4, (54, 46, 40, 255))
    blit(cv, scene, mx, my)
    labels.append(text_item(
        "Composição Vila Natal 2.5D (768×512, 1×): chão contínuo sem grade + casa 224×192 + portão 192×160 + props_large 64×64",
        mx, my + mh + 6, 9, c_lbl, "Consolas",
    ))

    render_text_overlay(cv, labels, out_path)
    return (W_P, H_P)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    tiles = build_tiles()
    props = build_props()
    props_large = build_props_large()
    house = build_house()
    gate = build_gate()

    assert len(tiles) == 10
    assert len(props) == 28
    assert len(props_large) == 12
    assert (house.w, house.h) == (224, 192)
    assert (gate.w, gate.h) == (192, 160)

    SPRITES_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    MOCKUPS_DIR.mkdir(parents=True, exist_ok=True)

    p_tiles = SPRITES_DIR / "village_hub_tiles.png"
    p_props = SPRITES_DIR / "village_hub_props.png"
    p_props_large = SPRITES_DIR / "village_hub_props_large.png"
    p_house = SPRITES_DIR / "village_hub_house.png"
    p_gate = SPRITES_DIR / "village_hub_gate.png"
    p_manifest = OUT_DIR / "village_hub_assets.manifest.json"
    p_preview = MOCKUPS_DIR / "preview_m9_village_assets.png"

    write_png(p_tiles, assemble(tiles, T, T))
    write_png(p_props, assemble(props, T, T))
    write_png(p_props_large, assemble(props_large, 64, 64))
    write_png(p_house, house)
    write_png(p_gate, gate)

    manifest = build_manifest(tiles, props, props_large, house, gate)
    p_manifest.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    pw, ph = build_preview(tiles, props, props_large, house, gate, p_preview)

    print(f"Gerado: {p_tiles} ({len(tiles) * T}x{T}, {len(tiles)} frames 32x32)")
    print(f"Gerado: {p_props} ({len(props) * T}x{T}, {len(props)} frames 32x32)")
    print(f"Gerado: {p_props_large} ({len(props_large) * 64}x64, {len(props_large)} frames 64x64)")
    print(f"Gerado: {p_house} ({house.w}x{house.h})")
    print(f"Gerado: {p_gate} ({gate.w}x{gate.h})")
    print(f"Gerado: {p_manifest}")
    print(f"Gerado: {p_preview} ({pw}x{ph})")


if __name__ == "__main__":
    main()
