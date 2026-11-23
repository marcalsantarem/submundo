"""
SUBMUNDO - Mockup estatico 960x540 da Vila Natal no Padrao M8 (M9, BRF-151 / T-135)
===================================================================================

Compoe `assets/mockups/mockup_m9_village_hub.png` (960x540) seguindo o pipeline exato de
`scripts/art/biomes/surf_mockup.py`, `scripts/art/biomes/surf_scenes.py` e
`scripts/art/buildMockupDungeonBasic.py`:

- Zoom e escala nativos: `ZOOM = 1.45` e `ACTOR_SCALE = 0.88` (`s_actor = 1.276`),
  preservando 100% da anatomia 80x80 de `hero_living`, `npc_weapon_master`,
  `npc_lyra` e `npc_gorran` (frame 6 `hammer2`, `flip=True`);
- Perimetro 2.5D denso e natural: copas de floresta e sebes 2.5D (`biome_herb_field_tiles`)
  por autotile (`DB.autotile_sample`), arvores (`tree_oak`, `tree_apple`), arbustos
  e rochas (`biome_herb_field_props`) + palicada alta 2.5D de toras apontadas
  (`palisade_tall_h` e `palisade_tall_v` de `village_hub_props_large.png`, incluindo
  a palicada em primeiro plano na borda sul com abertura central e tocha acesa);
- Terreno organico continuo (ZERO marca de grade 32x32): grama dark-fantasy nas bordas
  fundindo-se suavemente via mascara continua (`vnoise`) na clareira de terra batida,
  patio de pedras diante da Casa de Palha (`village_hub_house.png` 224x192), area de
  calcamento e cinzas na Forja (`forge_large_0`, `anvil_large` 64x64) e estrada de
  terra e paralelepipedos com trilhos sutis de roda de carroca atravessando o Portao
  de Pedra (`village_hub_gate.png` 192x160 com placa `"SAIDA"`);
- Iluminacao 2.5D real (`LightMap` + `apply_light` + `add_glow` de `surf_mockup.py`):
  `ambient = (0.48, 0.43, 0.46)`, `vignette_k = 0.68`, `sprite_mix = 0.42`;
- HUD enxuto da Vila (Decisao #23) e rotulos via `render_text_overlay` (`.NET
  System.Drawing` com `Cinzel` / Sans — ZERO fonte bitmap).

Uso: python scripts/art/buildVillageHubMockup.py
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

HERE = Path(__file__).resolve().parent
BIOMES_DIR = HERE / "biomes"
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(BIOMES_DIR))

from buildMonstersBase import Canvas, read_png  # noqa: E402
import buildDungeonBasic as DB  # noqa: E402
from buildDungeonBasic import (  # noqa: E402
    MOCKUPS_DIR,
    SPRITES_DIR,
    T,
    mix,
    render_text_overlay,
    rgba,
    shade,
    slice_sheet,
    text_item,
)
from buildMockupDungeonBasic import (  # noqa: E402
    DF,
    FONT_BODY,
    FONT_TITLE,
    TXT_GOLD,
    TXT_MUTED,
    TXT_PARCH,
    LightMap,
    add_glow,
    blend,
    chamfer_pts,
    disc,
    draw_image,
    draw_sprite_scaled,
    hexrgb,
    load_frame_index,
    metal_button,
    polygon,
    resize_area,
    ring,
    rounded_rect,
    stroke_poly,
)
from surf_common import OUT_DIR, h01, vnoise  # noqa: E402
from surf_mockup import apply_light, load_biome  # noqa: E402
import surf_village as SV  # noqa: E402

OUT_PNG = MOCKUPS_DIR / "mockup_m9_village_hub.png"
SW, SH = 960, 540
ZOOM = 1.45
ACTOR_SCALE = 0.88
VIEW_X, VIEW_Y = 40.0, 34.0

RGB = Tuple[int, int, int]

# Geometria 24x15 do perimetro 2.5D (mesma grade e camera de VillageScene em surf_scenes.py):
# - Recortes nao-retangulares nos 4 cantos;
# - Corredor de saida norte em cx=15..16 (atravessando o Portao de Pedra "SAIDA");
# - Abertura sul central em cx=11..12 na palicada de primeiro plano.
VILLAGE_HUB_ROWS: Sequence[str] = (
    "##############...#######",
    "##############...#######",
    "##############...#######",
    "###.........##...#######",
    "##....................##",
    "#.....................##",
    "#.....................##",
    "#.....................##",
    "#.....................##",
    "##....................##",
    "##...................###",
    "####................####",
    "###########..###########",
    "###########..###########",
    "########################",
)


def w2s(wx: float, wy: float) -> Tuple[float, float]:
    return ((wx - VIEW_X) * ZOOM, (wy - VIEW_Y) * ZOOM)


def world_to_screen(world: Canvas, bg: RGB = (14, 18, 14)) -> Canvas:
    scr = Canvas(SW, SH, (*bg, 255))
    xs = [int(math.floor(sx / ZOOM + VIEW_X)) for sx in range(SW)]
    for sy in range(SH):
        wy = int(math.floor(sy / ZOOM + VIEW_Y))
        if not (0 <= wy < world.h):
            continue
        row_o = wy * world.w * 4
        o = sy * SW * 4
        for sx in range(SW):
            wx = xs[sx]
            if 0 <= wx < world.w:
                p = row_o + wx * 4
                scr.buf[o + sx * 4:o + sx * 4 + 4] = world.buf[p:p + 4]
    return scr


def load_manifest_sheets(manifest_path: Path) -> Dict[str, Dict[str, Canvas]]:
    entries = json.loads(manifest_path.read_text(encoding="utf-8"))["sprites"]
    out: Dict[str, Dict[str, Canvas]] = {}
    for key, e in entries.items():
        frames = slice_sheet(read_png(SPRITES_DIR / e["file"]), e["frameWidth"], e["frameHeight"])
        out[key] = {name: frames[i] for i, name in enumerate(e["frames"])}
    return out


# ---------------------------------------------------------------------------
# Terreno Organico Continuo 2.5D (ZERO grade 32x32 + Estrada + Patio + Forja)
# ---------------------------------------------------------------------------

def road_center_x(wy: float) -> float:
    """Eixo curvo da estrada: sobe do centro da clareira (wy=255) ate o Portao Norte (wy=0..165)."""
    if wy <= 145.0:
        return 496.0
    t = min(1.0, (wy - 145.0) / 115.0)
    # Curva suave S da fogueira (wx~390) ate o centro do portao (wx=496)
    s = t * t * (3.0 - 2.0 * t)
    return 496.0 - s * 102.0


def build_organic_ground(
    W: int,
    H: int,
    floor: set,
    hub_tiles: Dict[str, Canvas],
    herb_sheets: Dict[str, Dict[str, Canvas]],
) -> Canvas:
    """
    Gera o terreno completo (W*32 x H*32):
    1) Aplica `DB.autotile_sample` com `biome_herb_field_tiles` para construir o perimetro
       denso 2.5D de sebes/copas de floresta com mureta de pedra seca e sombras projetadas;
    2) Nos pixels de piso, substitui qualquer repeticao em bloco por uma fusao organica
       continua pixel-a-pixel entre:
       - grama dark-fantasy nas bordas junto a floresta/palicada;
       - ampla clareira central de terra batida quente com variacao macro (`vnoise`);
       - patio de pedras (`dirt_cobble`) diante da Casa de Palha;
       - piso de pedras, fuligem e cinzas (`dirt_cobble` + `dirt_ash`) na Forja e Fogueira;
       - estrada de terra e paralelepipedos com trilhos sutis de roda de carroca subindo
         do centro e atravessando o Portao de Pedra (`"SAIDA"`).
    """
    world_w, world_h = W * T, H * T
    lay = DB.autotile_sample(W, H, floor, {}, {})
    world = Canvas(world_w, world_h, (12, 22, 14, 255))
    sheet_of = {"tiles": herb_sheets["tiles"], "doors": herb_sheets["doors"]}

    # Pré-renderiza um tile de paralelepipedos puros de surf_village.py para emenda 32x32
    pure_cobble = Canvas(T, T)
    SV.draw_cobbles(pure_cobble, 14)

    g0, g1 = hub_tiles["grass_0"], hub_tiles["grass_1"]
    d0, d1, d2 = hub_tiles["dirt_0"], hub_tiles["dirt_1"], hub_tiles["dirt_2"]
    d_trail = hub_tiles["dirt_trail"]
    d_cobble = hub_tiles["dirt_cobble"]
    d_ash = hub_tiles["dirt_ash"]

    # 1. Pinta o terreno continuo pixel a pixel em toda a area
    for y in range(world_h):
        ty = y % T
        rc_x = road_center_x(float(y))
        for x in range(world_w):
            tx = x % T
            # Ruido continuo multi-escala (periodos nao-multiplos visiveis de 32)
            n_macro = vnoise(x, y, 192, 901, 24.0)
            n_med = vnoise(x, y, 96, 919, 12.0)
            n_fine = vnoise(x, y, 48, 937, 6.0)
            jitter = (n_macro - 0.5) * 0.24 + (n_med - 0.5) * 0.14 + (n_fine - 0.5) * 0.08

            # A) Amostra continua de grama e de terra batida (sem salto em borda de 32px)
            g_col = g0.get(tx, ty)[:3] if n_med < 0.52 else g1.get(tx, ty)[:3]
            if n_fine < 0.36:
                d_base = d0.get(tx, ty)[:3]
            elif n_fine < 0.68:
                d_base = d1.get(tx, ty)[:3]
            else:
                d_base = d2.get(tx, ty)[:3]

            # Variacao organica macro de tom na terra batida (quente no centro, umida nas bordas)
            warm_shift = 0.93 + 0.14 * n_macro
            d_col = shade(d_base, warm_shift)

            # B) Distancia normalizada ao centro da clareira oval + corredor da estrada norte + saida sul
            dx_clear = (x - 364.0) / 252.0
            dy_clear = (y - 238.0) / 124.0
            d_clearing = math.hypot(dx_clear, dy_clear) + jitter

            # Estrada norte (sobe do centro ate wy=0 passando pelo portao em wx=496)
            road_half_w = 34.0 if y < 160 else (34.0 + (y - 160) * 0.12)
            d_road = abs(x - rc_x) / road_half_w + (n_med - 0.5) * 0.16
            if y > 265:
                d_road += (y - 265) / 45.0

            # Entrada sul na abertura da palicada (wx=384, wy=290..416)
            d_south = math.hypot((x - 384.0) / 36.0, max(0.0, y - 270.0) / 140.0) + (n_med - 0.5) * 0.15
            if y < 270:
                d_south = 9.0

            # Pátio da Casa de Palha a noroeste (wx=120..325, wy=135..225)
            d_house_yard = math.hypot((x - 232.0) / 105.0, (y - 182.0) / 52.0) + jitter * 0.8

            d_earth = min(d_clearing, d_road * 0.88, d_south * 0.92, d_house_yard * 0.95)

            # C) Fusao organica Grama <-> Terra Batida
            if d_earth > 1.03:
                col = g_col
            elif d_earth > 0.88:
                # Faixa de transicao organica com borda de terra escura e tufos de grama
                t_edge = (d_earth - 0.88) / 0.15
                earth_rim = shade(d_col, 0.78)
                col = mix(earth_rim, g_col, t_edge)
                if 0.91 < d_earth < 0.99 and h01(x, y, 955) < 0.24:
                    col = (72, 104, 54) if (y % 2 == 0) else (44, 70, 37)
            else:
                col = d_col

                # D) Estrada rumo ao Portao de Pedra ("SAIDA") + trilhos de roda de carroca
                if d_road < 1.05 and y < 275:
                    tr_col = d_trail.get(tx, ty)[:3]
                    cob_col = d_cobble.get(tx, ty)[:3]
                    k_road = max(0.0, min(1.0, (1.05 - d_road) / 0.55))
                    col = mix(col, tr_col, k_road * 0.75)
                    # Pedras de calcamento aflorando organicamente ao longo da estrada e sob o portao
                    cob_mask = vnoise(x, y, 64, 971, 8.0)
                    cob_thresh = 0.36 if y < 175 else 0.48
                    if d_road < 0.78 and cob_mask > cob_thresh:
                        col = mix(col, cob_col, min(1.0, (cob_mask - cob_thresh) * 2.4) * k_road)
                    # Dois trilhos paralelos sutis de roda de carroca (+/- 11.5 px do eixo da estrada)
                    wheel_dist = abs(abs(x - rc_x) - 11.5)
                    if wheel_dist < 2.3 and 36 < y < 255:
                        rut_k = (1.0 - wheel_dist / 2.3) * 0.24 * k_road
                        col = shade(col, 1.0 - rut_k)
                        if wheel_dist < 0.9 and h01(x, y, 977) < 0.18:
                            col = mix(col, (112, 102, 88), 0.35)

                # E) Patio de lajes de pedra diante da porta da Casa de Palha (Lyra + Braseiro)
                d_patio = math.hypot((x - 248.0) / 54.0, (y - 196.0) / 26.0) + (n_fine - 0.5) * 0.22
                if d_patio < 1.0:
                    pat_cob = d_cobble.get(tx, ty)[:3]
                    if n_med > 0.35:
                        pat_cob = mix(pat_cob, pure_cobble.get(tx, ty)[:3], 0.45)
                    k_pat = max(0.0, min(1.0, (1.0 - d_patio) / 0.42))
                    col = mix(col, pat_cob, k_pat * 0.85)

                # F) Piso de pedra, carvao e cinzas na area da Forja & Bigorna do Gorran (direita)
                d_forge_area = math.hypot((x - 524.0) / 56.0, (y - 252.0) / 30.0) + (n_fine - 0.5) * 0.20
                if d_forge_area < 1.0:
                    fg_cob = mix(d_cobble.get(tx, ty)[:3], d_ash.get(tx, ty)[:3], 0.55)
                    k_fg = max(0.0, min(1.0, (1.0 - d_forge_area) / 0.45))
                    col = mix(col, fg_cob, k_fg * 0.88)

                # G) Terra queimada e cinzas sob a Fogueira Central (wx=378, wy=252)
                d_fire = math.hypot((x - 378.0) / 36.0, (y - 252.0) / 20.0) + (n_fine - 0.5) * 0.15
                if d_fire < 1.0:
                    ash_col = d_ash.get(tx, ty)[:3]
                    k_ash = max(0.0, min(1.0, (1.0 - d_fire) / 0.55))
                    col = mix(col, ash_col, k_ash * 0.92)
                    if d_fire < 0.52:
                        col = shade(col, 0.82 + 0.18 * (d_fire / 0.52))

            world.put(x, y, rgba(col))

    # 2. Sobreponha as paredes/copas 2.5D de floresta (`biome_herb_field_tiles`) e suas sombras projetadas
    for (cx, cy), layers in lay.items():
        for i, (sheet, name) in enumerate(layers):
            if i == 0 and name.startswith("floor_"):
                # Preserva o terreno organico continuo que acabamos de pintar no piso!
                continue
            if i == 0 and name.startswith("wall_face_lower") and "_end_" not in name:
                # Alterna mureta de pedra seca e estacas de madeira na base da sebe 2.5D
                if (cx + cy) % 3 == 0:
                    name = "wall_face_lower_grate"
            if i == 0 and name == "wall_face_upper" and (cx * 3 + cy) % 5 == 0:
                name = "wall_face_upper_cracked"
            frame = sheet_of[sheet].get(name) or sheet_of["doors"].get(name) or sheet_of["tiles"][name]
            world.composite(frame, cx * T, cy * T)

    return world


# ---------------------------------------------------------------------------
# Emblema 2D Dark Fantasy do Botao "Interagir"
# ---------------------------------------------------------------------------

def draw_interact_emblem(cv: Canvas, cx: float, cy: float) -> None:
    """
    Emblema 2D Dark Fantasy metalico/dourado de Interacao (brasao de dialogo/acao em
    ouro e bronze chanfrado com contorno escuro — zero visual cartoon branco chapado).
    """
    bw, bh = 30.0, 20.0
    x0, y0 = cx - bw / 2.0, cy - bh / 2.0 - 1.0
    # Sombra profunda
    polygon(cv, chamfer_pts(x0 + 1.0, y0 + 2.0, bw, bh, 5.0), (6, 5, 8), 0.72)
    # Moldura externa de bronze escuro / obsidiana
    polygon(cv, chamfer_pts(x0, y0, bw, bh, 5.0), DF["metalDark"], 0.98)
    # Placa interna em ouro/bronze quente
    polygon(cv, chamfer_pts(x0 + 1.6, y0 + 1.6, bw - 3.2, bh - 3.2, 4.0), DF["bronzeDark"], 0.96)
    polygon(cv, chamfer_pts(x0 + 2.6, y0 + 2.4, bw - 5.2, (bh - 4.8) * 0.55, 3.0), DF["bronze"], 0.75)
    # Cauda chanfrada inferior do brasao de dialogo
    tail_out = [(cx - 6.5, y0 + bh - 1.0), (cx - 10.5, y0 + bh + 6.0), (cx - 0.5, y0 + bh - 1.0)]
    tail_in = [(cx - 5.5, y0 + bh - 1.8), (cx - 8.5, y0 + bh + 3.8), (cx - 1.5, y0 + bh - 1.8)]
    polygon(cv, tail_out, DF["metalDark"], 0.98)
    polygon(cv, tail_in, DF["gold"], 0.96)
    # Filete duplo dourado
    stroke_poly(cv, chamfer_pts(x0 + 1.2, y0 + 1.2, bw - 2.4, bh - 2.4, 4.2), DF["gold"], 1.5, 0.96)
    stroke_poly(cv, chamfer_pts(x0 + 2.4, y0 + 2.4, bw - 4.8, bh - 4.8, 3.2), DF["goldBright"], 0.9, 0.55)
    # 3 gemas/losangos dourados brilhantes no centro
    for dx in (-7.5, 0.0, 7.5):
        px, py = cx + dx, y0 + bh / 2.0
        r = 2.7
        polygon(cv, [(px, py - r), (px + r, py), (px, py + r), (px - r, py)], DF["metalDark"], 0.95)
        r2 = 2.0
        polygon(cv, [(px, py - r2), (px + r2, py), (px, py + r2), (px - r2, py)], DF["goldBright"], 0.98)


# ---------------------------------------------------------------------------
# HUD Enxuto da Vila Natal (Decisao #23 + Primitivas de surf_mockup.py)
# ---------------------------------------------------------------------------

def draw_village_hud(
    cv: Canvas,
    icons: List[Canvas],
    portraits: List[Canvas],
    texts: List[Dict[str, object]],
    floor: set,
    positions: Dict[str, Tuple[float, float]],
) -> None:
    ICON = {"bag": 6, "settings": 7, "audio_on": 8}

    # --- 1. Topo-Esquerda: Retrato circular + Nv. 1 + JOVEM GUERREIRO + HP + Barra secundaria + Tracker ---
    pcx, pcy, pr = 46, 44, 32
    disc(cv, pcx, pcy + 2, pr + 3, (0, 0, 0), 0.5)
    disc(cv, pcx, pcy, pr, DF["recess"], 0.96)
    draw_image(cv, resize_area(portraits[0], (pr - 1) * 2, (pr - 1) * 2), pcx, pcy + 1, 1.0, pr - 2)
    ring(cv, pcx, pcy, pr + 1.5, 3.5, DF["metalDark"])
    ring(cv, pcx, pcy, pr, 2.2, DF["bronze"], 0.98)
    ring(cv, pcx, pcy, pr - 2, 1.0, DF["gold"], 0.75)
    for (dx, dy) in ((0, -pr), (pr, 0), (-pr, 0)):
        disc(cv, pcx + dx, pcy + dy, 2, DF["gold"], 0.96)
    bw, bh, by = 46, 15, pcy + pr + 1
    rounded_rect(cv, pcx - bw / 2, by - bh / 2, bw, bh, 4, DF["obsidian"], 0.96)
    stroke_poly(cv, chamfer_pts(pcx - bw / 2, by - bh / 2, bw, bh, 0), DF["gold"], 1.3, 0.95)
    texts.append(text_item("Nv. 1", pcx, by, 10.5, TXT_GOLD, FONT_BODY, True, "c"))

    bar_x, hp_y, hp_w, hp_h = 86, 30, 188, 18
    texts.append(text_item("JOVEM GUERREIRO", 88, 17, 12.5, TXT_PARCH, FONT_TITLE, True, "l", (5, 7, 12, 220), 3))
    polygon(cv, chamfer_pts(bar_x, hp_y, hp_w, hp_h, 9), DF["recess"], 0.95)
    ratio = 1.0
    fw = hp_w * ratio
    polygon(cv, chamfer_pts(bar_x + 1, hp_y + 1, fw - 2, hp_h - 2, 9), hexrgb(0xB91C1C), 0.98)
    polygon(cv, chamfer_pts(bar_x + 2, hp_y + 2, fw - 6, 6, 4), hexrgb(0xEF4444), 0.55)
    stroke_poly(cv, chamfer_pts(bar_x, hp_y, hp_w, hp_h, 9), DF["bronze"], 1.6, 0.98)
    stroke_poly(cv, chamfer_pts(bar_x - 1, hp_y - 1, hp_w + 2, hp_h + 2, 9), DF["metalDark"], 1.0, 0.92)
    texts.append(text_item("100/100", bar_x + hp_w * 0.46, hp_y + hp_h / 2, 11, (255, 247, 237), FONT_BODY, True,
                           "c", (5, 7, 12, 230), 2.5))

    sec_y, sec_w, sec_h = 53, 154, 6
    polygon(cv, chamfer_pts(bar_x, sec_y, sec_w, sec_h, 4), DF["recess"], 0.92)
    polygon(cv, chamfer_pts(bar_x + 1, sec_y + 1, (sec_w - 2) * 0.45, sec_h - 2, 3), hexrgb(0xD97706), 0.95)
    stroke_poly(cv, chamfer_pts(bar_x, sec_y, sec_w, sec_h, 4), DF["metalBorder"], 1.0, 0.88)

    ox, oy = 16, 94
    dcx, dcy = ox + 10, oy + 10
    polygon(cv, [(dcx, dcy - 6.2), (dcx + 6.2, dcy), (dcx, dcy + 6.2), (dcx - 6.2, dcy)], DF["gold"], 0.96)
    polygon(cv, [(dcx, dcy - 5), (dcx + 5, dcy), (dcx, dcy + 5), (dcx - 5, dcy)], DF["bronzeDark"], 0.95)
    polygon(cv, [(dcx, dcy - 3), (dcx + 3, dcy), (dcx, dcy + 3), (dcx - 3, dcy)], DF["goldBright"], 0.98)
    texts.append(text_item("Vila Natal", ox + 24, oy + 10, 13, TXT_GOLD, FONT_TITLE, True, "l", (5, 7, 12, 220), 3))
    texts.append(text_item("Falar com o Mestre", ox + 24, oy + 26, 11.5, TXT_PARCH, FONT_BODY, False, "l",
                           (5, 7, 12, 220), 3))
    for x in range(ox, ox + 214):
        blend(cv, x, oy + 44, DF["gold"] if x < ox + 56 else DF["bronze"], 0.5)

    # --- 2. Topo-Direita: Minimapa circular (mesmo estilo de surf_mockup.py) ---
    mx, my, mr = SW - 60, 60, 46
    disc(cv, mx, my + 2, mr + 4, (0, 0, 0), 0.5)
    disc(cv, mx, my, mr, (10, 16, 26), 0.94)
    K = 3.0
    hx_, hy_ = positions["center_ref"]

    def mm(wx: float, wy: float) -> Tuple[float, float]:
        return (mx + (wx - hx_) / T * K, my + (wy - hy_) / T * K)

    def inside(px: float, py: float) -> bool:
        return math.hypot(px + 0.5 - mx, py + 0.5 - my) < mr - 3

    walk = set(floor)
    for (cx, cy) in walk:
        x0, y0 = mm(cx * T, cy * T)
        for yy in range(int(y0), int(y0 + K)):
            for xx in range(int(x0), int(x0 + K)):
                if inside(xx, yy):
                    blend(cv, xx, yy, (40, 54, 74), 0.92)
    for (cx, cy) in walk:
        for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (cx + dx, cy + dy)
            if n in walk:
                continue
            x0, y0 = mm(cx * T, cy * T)
            if dx:
                xx = int(x0 + (K if dx > 0 else -1))
                for yy in range(int(y0), int(y0 + K)):
                    if inside(xx, yy):
                        blend(cv, xx, yy, (100, 116, 139), 0.9)
            else:
                yy = int(y0 + (K if dy > 0 else -1))
                for xx in range(int(x0), int(x0 + K)):
                    if inside(xx, yy):
                        blend(cv, xx, yy, (100, 116, 139), 0.9)

    # Pontos no minimapa: Fogueira (laranja), Lyra e Gorran (verde/aliado), Mestre (ouro), Heroi (triangulo ciano)
    cf_x, cf_y = mm(*positions["campfire"])
    if inside(cf_x, cf_y):
        disc(cv, cf_x, cf_y, 2.0, (249, 115, 22), 0.98)
    for npc_key in ("lyra", "gorran"):
        nx_, ny_ = mm(*positions[npc_key])
        if inside(nx_, ny_):
            disc(cv, nx_, ny_, 2.1, (74, 222, 128), 0.96)
    wmx, wmy = mm(*positions["master"])
    if inside(wmx, wmy):
        disc(cv, wmx, wmy, 2.6, (250, 204, 21), 1.0)
    px, py = mm(*positions["hero"])
    polygon(cv, [(px, py - 4), (px + 3.5, py + 3), (px - 3.5, py + 3)], (56, 189, 248), 1.0)

    ring(cv, mx, my, mr + 1.5, 3.5, DF["metalDark"])
    ring(cv, mx, my, mr, 2.2, DF["bronze"], 0.98)
    ring(cv, mx, my, mr - 2, 1.0, DF["gold"], 0.6)
    for ang in (0, 90, 180, 270):
        a = math.radians(ang)
        disc(cv, mx + mr * math.cos(a), my + mr * math.sin(a), 2, DF["gold"], 0.96)
    texts.append(text_item("N", mx, my - mr + 8, 8, TXT_GOLD, FONT_TITLE, True, "c", (5, 7, 12, 220), 2))

    # --- 3. Abaixo do minimapa (row_y = 128): 3 botoes metal_button (Inventario, Audio, Config.) ---
    ur, row_y, right_x, gap = 18, 128, SW - 34, 50
    btns = [
        (right_x - gap * 2, "bag", "Inventário", DF["gold"]),
        (right_x - gap, "audio_on", "Áudio", DF["bronze"]),
        (right_x, "settings", "Config.", DF["bronze"]),
    ]
    for bx, ikey, label, accent in btns:
        metal_button(cv, bx, row_y, ur, accent)
        draw_image(cv, resize_area(icons[ICON[ikey]], 20, 20), bx, row_y)
        texts.append(text_item(label, bx, row_y + ur + 9, 9, TXT_MUTED, FONT_BODY, False, "c", (5, 7, 12, 220), 2.5))

    # --- 4. Inferior-Esquerda: D-Pad / joystick virtual translucido (codigo exato de surf_mockup.py) ---
    jx, jy, jr = 104, SH - 104, 54
    disc(cv, jx, jy, jr, (8, 10, 16), 0.38)
    ring(cv, jx, jy, jr, 2.0, (100, 116, 139), 0.42)
    ring(cv, jx, jy, jr - 4, 1.0, DF["bronze"], 0.25)
    ring(cv, jx, jy, round(jr * 0.44), 1.4, (100, 116, 139), 0.35)
    for (ddx, ddy) in ((0, -1), (1, 0), (0, 1), (-1, 0)):
        ax, ay = jx + ddx * 38, jy + ddy * 38
        px_, py_ = -ddy, ddx
        polygon(cv, [(ax + ddx * 6, ay + ddy * 6), (ax - ddx * 4 + px_ * 7, ay - ddy * 4 + py_ * 7),
                     (ax - ddx * 4 - px_ * 7, ay - ddy * 4 - py_ * 7)], (203, 213, 225), 0.55)
    disc(cv, jx, jy, 18, (30, 35, 46), 0.62)
    ring(cv, jx, jy, 18, 1.6, DF["bronze"], 0.7)
    ring(cv, jx, jy, 12, 1.0, (100, 116, 139), 0.4)

    # --- 5. Inferior-Direita: Apenas botao circular principal "Interagir" ---
    atk_x, atk_y, atk_r = SW - 92, SH - 104, 42
    add_glow(cv, atk_x, atk_y, atk_r + 22, (250, 190, 70), 0.28)
    disc(cv, atk_x, atk_y + 3, atk_r + 4, (0, 0, 0), 0.5)
    disc(cv, atk_x, atk_y, atk_r, DF["crimsonFill"], 0.94)
    disc(cv, atk_x, atk_y - 6, atk_r - 8, (88, 28, 34), 0.35)
    ring(cv, atk_x, atk_y, atk_r + 1.5, 3.5, DF["metalDark"])
    ring(cv, atk_x, atk_y, atk_r, 2.4, DF["crimsonBorder"], 0.98)
    ring(cv, atk_x, atk_y, atk_r - 3, 1.2, DF["gold"], 0.85)
    draw_interact_emblem(cv, atk_x, atk_y - 9)
    texts.append(text_item("Interagir", atk_x, atk_y + 20, 11.5, TXT_PARCH, FONT_TITLE, True, "c", (7, 9, 14, 240), 3))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    # 1. Carrega todos os sheets reais do projeto
    herb_sheets = load_biome("herb_field")
    village_sheets = load_biome("village")
    hub_sheets = load_manifest_sheets(OUT_DIR / "village_hub_assets.manifest.json")
    npc_sheets = load_manifest_sheets(OUT_DIR / "village_hub_npcs.manifest.json")

    hub_tiles = hub_sheets["village_hub_tiles"]
    hub_props = hub_sheets["village_hub_props"]
    hub_large = hub_sheets["village_hub_props_large"]
    house_spr = hub_sheets["village_hub_house"]["house"]
    gate_spr = hub_sheets["village_hub_gate"]["gate"]

    v_props = village_sheets["props"]
    v_tall = village_sheets["props_tall"]
    h_props = herb_sheets["props"]
    h_tall = herb_sheets["props_tall"]

    npc_master = npc_sheets["npc_weapon_master"]["idle0"]
    npc_lyra = npc_sheets["npc_lyra"]["idle0"]
    npc_gorran = npc_sheets["npc_gorran"]["hammer2"]
    hero_living = load_frame_index("hero_living", 0)

    # 2. Monta o mundo 1:1 (24x15 tiles = 768x480 px) com perimetro 2.5D e terreno organico
    H = len(VILLAGE_HUB_ROWS)
    W = max(len(r) for r in VILLAGE_HUB_ROWS)
    floor = {(x, y) for y, r in enumerate(VILLAGE_HUB_ROWS) for x, ch in enumerate(r) if ch == "."}
    world = build_organic_ground(W, H, floor, hub_tiles, herb_sheets)

    # Decalques e props planos de chao no mundo 1:1 antes do upscale nearest
    ground_props = [
        (h_props["flower_bush"], 88, 124),
        (h_props["rocks"], 338, 118),
        (h_props["flower_bush"], 568, 130),
        (h_props["rocks"], 604, 152),
        (h_props["flower_bush"], 604, 294),
        (h_props["rocks"], 142, 344),
        (h_props["flower_bush"], 546, 344),
    ]
    for spr_p, px, py in ground_props:
        world.composite(spr_p, px, py)

    scr = world_to_screen(world)

    # 3. Objetos 2.5D e Atores ordenados por Y da base (y_sort) e renderizados na tela com ZOOM = 1.45
    s_actor = ACTOR_SCALE * ZOOM
    actor_mask = Canvas(SW, SH)

    # Lista: (y_sort, spr, wx, wy, scale_mul, flip, shadow_rx, is_actor)
    # Obs: draw_sprite_scaled desenha centrado em (sx, sy) = w2s(wx, wy).
    items: List[Tuple[float, Canvas, float, float, float, bool, float, bool]] = []

    def add_world_item(
        y_sort: float,
        spr: Canvas,
        wx: float,
        wy: float,
        scale_mul: float = 1.0,
        flip: bool = False,
        shadow_rx: float = 0.0,
        is_actor: bool = False,
    ) -> None:
        items.append((y_sort, spr, wx, wy, scale_mul, flip, shadow_rx, is_actor))

    # --- A) Arvores e Palicada do Perimetro Norte (fundo) ---
    add_world_item(126, v_tall["tree_oak"], 104, 96)
    add_world_item(124, v_tall["tree_oak"], 354, 94)
    add_world_item(128, h_tall["tree_apple"], 388, 98)
    add_world_item(134, v_tall["tree_oak"], 606, 104)

    # Palicada alta 2.5D ao fundo entre a Casa de Palha e o Portao de Pedra
    add_world_item(138, hub_large["palisade_tall_h"], 358, 114)
    add_world_item(138, hub_large["palisade_tall_h"], 414, 114)
    # Palicada alta a direita do Portao de Pedra
    add_world_item(144, hub_large["palisade_tall_h"], 598, 120)

    # --- B) Estruturas Principais 2.5D: Portao de Pedra (192x160) e Casa de Palha (224x192) ---
    # Portao de Pedra com placa "SAIDA" sobre a estrada norte-direita (centro wx=492, wy=108 -> capiteis 100% visiveis!)
    add_world_item(176, gate_spr, 492, 108)
    # Casa de Palha 2.5D no fundo-esquerda (centro wx=228, wy=122 -> cumeeira 100% visivel!)
    add_world_item(208, house_spr, 228, 122)

    # Props junto a Casa de Palha e ao Portao
    add_world_item(166, hub_props["torch_post_0"], 378, 152, 1.0, False, 10.0)
    add_world_item(182, v_props["sacks"], 408, 170)
    # Carroca de Madeira 2.5D grande (64x64) estacionada logo a esquerda do pilar do portao (fiel a ref_m9!)
    add_world_item(196, hub_large["wooden_cart_large"], 436, 174)

    add_world_item(210, v_props["hay_bale"], 122, 196)
    add_world_item(216, v_props["firewood"], 144, 202)
    add_world_item(209, v_props["crate"], 314, 194)
    # Braseiro aceso logo a direita da porta da casa
    pos_brazier = (284.0, 204.0)
    add_world_item(218, hub_props["brazier_0"], pos_brazier[0], pos_brazier[1], 1.0, False, 12.0)

    # --- C) Perimetro Oeste (esquerda, atras do Mestre de Armas) e Leste (direita, atras da Forja) ---
    add_world_item(186, v_tall["tree_oak"], 66, 156)
    add_world_item(216, hub_large["palisade_tall_v"], 92, 190)
    add_world_item(256, v_tall["tree_oak"], 58, 226)
    add_world_item(268, hub_large["palisade_tall_v"], 98, 244)
    add_world_item(318, v_tall["tree_oak"], 68, 288)

    add_world_item(204, v_tall["tree_oak"], 644, 174)
    add_world_item(246, hub_large["palisade_tall_v"], 626, 222, 1.0, True)
    add_world_item(314, v_tall["tree_oak"], 638, 284)

    # --- D) Fogueira Central (64x64) e Area da Forja (64x64) ---
    pos_campfire = (378.0, 238.0)
    add_world_item(260, hub_large["campfire_large_0"], pos_campfire[0], pos_campfire[1])

    # Area do Ferreiro Gorran a direita:
    # Gorran (80x80 em ACTOR_SCALE=0.88, flip=True) em (526, 238):
    # - Pes de Gorran ficam em wx >= 518, wy = 238 + 30.8 = 268.8 (100% livres do cepo da bigorna);
    # - Barra incandescente e cabeca do martelo (hammer2, flip=True) ficam em:
    #   wx_impact = 526 - 21 * 0.88 = 507.5
    #   wy_impact = 238 + 8 * 0.88  = 245.0
    # - Posicionamos `anvil_large` (64x64 em scale_mul=0.84) em (499.0, 258.5):
    #   A mesa superior direita da bigorna fica em wx=499..514, wy=244..247!
    #   Assim a barra incandescente, o martelo e as faiscas de Gorran caem EXATAMENTE sobre o topo da bigorna!
    pos_gorran = (526.0, 238.0)
    pos_anvil = (499.0, 258.5)
    pos_forge = (576.0, 244.0)

    add_world_item(230, v_props["barrel"], 600, 214)
    add_world_item(263, hub_large["anvil_large"], pos_anvil[0], pos_anvil[1], 0.84)
    add_world_item(268, hub_large["forge_large_0"], pos_forge[0], pos_forge[1], 0.94)
    add_world_item(280, v_props["bucket"], 546, 268)
    add_world_item(286, v_props["cart_wheel"], 602, 272)

    # --- E) Personagens 80x80 Nativos (s_actor = ACTOR_SCALE * ZOOM = 0.88 * 1.45) ---
    pos_lyra = (244.0, 190.0)
    pos_master = (182.0, 234.0)
    pos_hero = (292.0, 240.0)

    add_world_item(pos_lyra[1] + 31, npc_lyra, pos_lyra[0], pos_lyra[1], ACTOR_SCALE, False, 15.0, True)
    add_world_item(pos_master[1] + 31, npc_master, pos_master[0], pos_master[1], ACTOR_SCALE, False, 18.0, True)
    add_world_item(pos_hero[1] + 31, hero_living, pos_hero[0], pos_hero[1], ACTOR_SCALE, False, 19.0, True)
    add_world_item(pos_gorran[1] + 31, npc_gorran, pos_gorran[0], pos_gorran[1], ACTOR_SCALE, True, 18.0, True)

    # --- F) Primeiro Plano Sul: Palicada Alta 2.5D com abertura central + Tocha Acesa (fiel a ref_m9!) ---
    # Ala esquerda da palicada frontal sul (wx=176..352)
    for px in (198, 258, 318):
        add_world_item(366, hub_large["palisade_tall_h"], px, 342)
    add_world_item(367, hub_props["palisade_end"], 350, 352, 1.1)

    # Tocha acesa em primeiro plano junto a palicada sul-esquerda (y_sort=370 p/ ficar na frente das toras!)
    pos_fg_torch = (246.0, 326.0)
    add_world_item(370, hub_props["torch_post_0"], pos_fg_torch[0], pos_fg_torch[1], 1.12, False, 12.0)

    # Ala direita da palicada frontal sul (wx=416..576)
    add_world_item(367, hub_props["palisade_end"], 418, 352, 1.1)
    for px in (450, 510):
        add_world_item(366, hub_large["palisade_tall_h"], px, 342)

    # Renderiza sombras de contato e sprites na ordem Y (2.5D Painter's Algorithm)
    for y_sort, spr, wx, wy, scale_mul, flip, shadow_rx, is_actor in sorted(items, key=lambda it: it[0]):
        if shadow_rx > 0:
            fx, fy = w2s(wx, wy + (31 if is_actor else 13))
            for y in range(int(fy - 6), int(fy + 7)):
                for x in range(int(fx - shadow_rx - 1), int(fx + shadow_rx + 2)):
                    d = math.hypot((x + 0.5 - fx) / shadow_rx, (y + 0.5 - fy) / 5.0)
                    if d < 1.0:
                        blend(scr, x, y, (0, 0, 0), 0.5 * (1.0 - d) ** 0.6)
        sx, sy = w2s(wx, wy)
        draw_sprite_scaled(scr, spr, sx, sy, scale_mul * ZOOM, flip, actor_mask if is_actor else None)

    # 4. Iluminacao 2.5D Real (`LightMap` + `apply_light` + `add_glow` de `surf_mockup.py`)
    ambient = (0.48, 0.43, 0.46)
    vignette_k = 0.68
    sprite_mix = 0.42
    lm = LightMap(ambient)

    # Ceu crepuscular suave vindo do topo e da saida norte do portao + luz na placa "SAIDA"
    lm.add(SW * 0.5, -110, 720, (0.52, 0.36, 0.32), 0.34, 0.62)
    gx_s, gy_s = w2s(492, 102)
    lm.add(gx_s, gy_s, 230, (0.76, 0.64, 0.52), 0.52, 0.85)
    sign_x, sign_y = w2s(554, 100)
    lm.add(sign_x, sign_y, 125, (0.95, 0.78, 0.52), 0.45, 0.85)

    # Fogueira central
    cfx, cfy = w2s(pos_campfire[0], pos_campfire[1] + 4)
    lm.add(cfx, cfy, 270, (1.0, 0.64, 0.26), 0.95, 0.82)

    # Forja acesa e faiscas da bigorna do Gorran
    fgx, fgy = w2s(pos_forge[0] - 4, pos_forge[1] - 4)
    lm.add(fgx, fgy, 230, (1.0, 0.56, 0.22), 0.90, 0.85)
    spx, spy = w2s(507.5, 245.0)
    lm.add(spx, spy, 130, (1.0, 0.72, 0.32), 0.52, 0.85)

    # Braseiro e janela acesa da Casa de Palha
    brx, bry = w2s(pos_brazier[0], pos_brazier[1] - 4)
    lm.add(brx, bry, 180, (1.0, 0.64, 0.26), 0.75, 0.85)
    winx, winy = w2s(186, 142)
    lm.add(winx, winy, 130, (1.0, 0.62, 0.25), 0.52, 0.75)

    # Tochas acesas (norte e primeiro plano sul)
    t1x, t1y = w2s(378, 142)
    t2x, t2y = w2s(pos_fg_torch[0], pos_fg_torch[1] - 10)
    lm.add(t1x, t1y + 12, 165, (1.0, 0.64, 0.26), 0.72, 0.85)
    lm.add(t2x, t2y + 12, 185, (1.0, 0.64, 0.26), 0.78, 0.85)

    # Luz suave de preenchimento no Heroi e no Mestre de Armas (leitura impecavel dos atores)
    hx_s, hy_s = w2s(pos_hero[0], pos_hero[1] + 6)
    lm.add(hx_s, hy_s, 220, (0.64, 0.64, 0.72), 0.52, 0.82)
    mx_s, my_s = w2s(pos_master[0], pos_master[1] + 6)
    lm.add(mx_s, my_s, 185, (0.72, 0.64, 0.54), 0.48, 0.82)

    apply_light(scr, lm, actor_mask, sprite_mix, vignette_k)

    # Halos aditivos quentes (`add_glow`)
    add_glow(scr, cfx, cfy - 10, 38, (255, 205, 95), 0.62)
    add_glow(scr, cfx, cfy - 2, 95, (245, 135, 38), 0.24, 0.78)

    add_glow(scr, fgx, fgy - 10, 32, (255, 180, 75), 0.58)
    add_glow(scr, fgx, fgy, 82, (240, 115, 32), 0.22, 0.80)

    # Brilho quente no impacto do martelo e barra incandescente do Gorran sobre a bigorna
    add_glow(scr, spx, spy, 24, (255, 230, 120), 0.58)
    add_glow(scr, spx, spy, 52, (250, 140, 40), 0.20)

    add_glow(scr, brx, bry - 6, 24, (255, 195, 85), 0.55)
    add_glow(scr, brx, bry, 60, (240, 130, 35), 0.18)
    add_glow(scr, winx, winy, 28, (255, 175, 75), 0.34)

    add_glow(scr, t1x, t1y - 4, 20, (255, 200, 95), 0.58)
    add_glow(scr, t1x, t1y + 4, 54, (245, 140, 40), 0.18)
    add_glow(scr, t2x, t2y - 4, 22, (255, 200, 95), 0.62)
    add_glow(scr, t2x, t2y + 4, 58, (245, 140, 40), 0.20)

    # Poeira dourada crepuscular sutil no ar
    for (px_d, py_d) in ((290, 210), (420, 180), (520, 290), (640, 220), (360, 340), (740, 260)):
        add_glow(scr, px_d, py_d, 3, (255, 228, 150), 0.48)

    # 5. Rotulos sobre os NPCs e "!" dourado via render_text_overlay (Cinzel / FONT_TITLE)
    texts: List[Dict[str, object]] = []

    msx, msy = w2s(pos_master[0], pos_master[1] - 34)
    add_glow(scr, msx, msy - 24, 26, (255, 204, 64), 0.48)
    texts.append(text_item("!", msx, msy - 24, 24, (255, 224, 92), FONT_TITLE, True, "c", (45, 20, 5, 245), 3.8))
    texts.append(text_item("Mestre de Armas", msx, msy, 11.5, TXT_GOLD, FONT_TITLE, True, "c", (5, 7, 12, 240), 3.0))

    lsx, lsy = w2s(pos_lyra[0], pos_lyra[1] - 32)
    texts.append(text_item("Lyra", lsx, lsy, 11.0, TXT_PARCH, FONT_TITLE, True, "c", (5, 7, 12, 240), 3.0))

    gsx, gsy = w2s(pos_gorran[0], pos_gorran[1] - 33)
    texts.append(text_item("Gorran", gsx, gsy, 11.0, TXT_PARCH, FONT_TITLE, True, "c", (5, 7, 12, 240), 3.0))

    # 6. HUD Enxuto da Vila Natal
    icons = slice_sheet(read_png(SPRITES_DIR / "ui_icons.png"), 64, 64)
    portraits = slice_sheet(read_png(SPRITES_DIR / "portraits.png"), 128, 128)
    positions = {
        "center_ref": (376.0, 224.0),
        "campfire": pos_campfire,
        "lyra": pos_lyra,
        "master": pos_master,
        "hero": pos_hero,
        "gorran": pos_gorran,
    }
    draw_village_hud(scr, icons, portraits, texts, floor, positions)

    for i in range(SW * SH):
        scr.buf[i * 4 + 3] = 255
    render_text_overlay(scr, texts, OUT_PNG)
    print(f"Gerado: {OUT_PNG} ({SW}x{SH})")


if __name__ == "__main__":
    main()
