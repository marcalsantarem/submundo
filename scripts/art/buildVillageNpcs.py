#!/usr/bin/env python3
"""
Gera os 3 NPCs da Vila Natal no padrao real 80x80 do heroi (T-134 / BRF-148):
  - public/assets/sprites/npc_weapon_master.png (320x80, 4 frames 80x80: idle0..3)
  - public/assets/sprites/npc_lyra.png          (320x80, 4 frames 80x80: idle0..3)
  - public/assets/sprites/npc_gorran.png        (640x80, 8 frames 80x80: idle0..3 + hammer0..3)
  - scripts/art/biomes/out/village_hub_npcs.manifest.json (frameWidth: 80, frameHeight: 80)
  - assets/mockups/preview_m9_village_npcs.png  (prancha 3x com comparacao 1:1 ao hero_living)

Reutiliza a anatomia facial 3/4 real de assets/sprites_src/hero_living_base.png e o pipeline
2-bone IK de scripts/art/buildHeroAndWeapons.py.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from buildHeroAndWeapons import (  # noqa: E402
    CENTER_X,
    FH,
    FOOT_Y,
    FW,
    LIVING_THEME,
    OUTLINE,
    ROOT,
    SRC_DIR,
    Canvas,
    Color,
    ExtractedParts,
    HeroTheme,
    RGB,
    add_outline,
    clamp,
    dim_palette,
    draw_arm,
    draw_capsule,
    draw_disc,
    draw_leg,
    draw_polygon_shaded,
    extract_hero_parts,
    read_png,
    remove_isolated_pixels,
    rgba,
    shear_canvas,
    solve_2bone_ik,
    write_png,
)

OUT_SPRITES = ROOT / "public" / "assets" / "sprites"
OUT_MANIFEST = ROOT / "scripts" / "art" / "biomes" / "out" / "village_hub_npcs.manifest.json"
OUT_PREVIEW = ROOT / "assets" / "mockups" / "preview_m9_village_npcs.png"
HERO_BASE_PATH = SRC_DIR / "hero_living_base.png"
HERO_SHEET_PATH = OUT_SPRITES / "hero_living.png"

Pal4 = Tuple[RGB, RGB, RGB, RGB]  # (dark, shadow, mid, hi)


# ---------------------------------------------------------------------------
# Paletas Dark Fantasy 80x80 (fieis a portraits_128.png e ref_m9_village_hub)
# ---------------------------------------------------------------------------

# Mestre de Armas (Veterano grisalho em armadura de placas escura + capa ardosia)
HAIR_GRAY: Pal4 = ((78, 84, 96), (122, 130, 142), (170, 178, 190), (214, 220, 230))
STEEL_PLATE: Pal4 = ((38, 44, 56), (68, 76, 92), (112, 124, 142), (166, 178, 196))
STEEL_DARK: Pal4 = ((26, 30, 40), (46, 52, 66), (74, 84, 100), (114, 126, 144))
CAPE_SLATE: Pal4 = ((20, 26, 38), (34, 44, 62), (52, 66, 90), (76, 94, 122))
LEATHER_BALDRIC: Pal4 = ((46, 28, 18), (78, 48, 32), (114, 72, 48), (148, 98, 66))
GOLD_TRIM: Pal4 = ((72, 50, 22), (124, 88, 38), (178, 132, 58), (232, 188, 96))
WOOD_HAFT: Pal4 = ((42, 24, 16), (72, 44, 28), (106, 66, 42), (142, 92, 58))

MASTER_THEME = HeroTheme(
    name="npc_weapon_master",
    is_wraith=False,
    base_shift_x=0,
    pants=((24, 28, 36), (38, 44, 56), (56, 64, 78), (76, 86, 102)),
    boot_cuff=STEEL_PLATE,
    boot=((28, 32, 42), (48, 54, 68), (74, 82, 98), (108, 118, 136)),
    tunic=STEEL_DARK,
    sleeve=((28, 34, 46), (44, 52, 68), (64, 74, 92), (86, 98, 118)),
    skin=((140, 92, 76), (180, 122, 100), (218, 158, 126), (238, 184, 150)),
    bracer=STEEL_PLATE,
    cape=CAPE_SLATE,
    bandana=None,
    dash_tint=(180, 200, 220),
    hit_flash=(255, 215, 215),
)

# Lyra (Mercadora/Curandeira: pele clara quente, cabelo castanho-avela, vestido oliva e linho creme)
SKIN_LYRA: Pal4 = ((158, 108, 90), (198, 142, 118), (234, 178, 146), (248, 206, 174))
HAIR_HAZEL: Pal4 = ((44, 26, 18), (76, 46, 32), (114, 72, 50), (156, 104, 72))
BODICE_OLIVE: Pal4 = ((30, 48, 34), (48, 74, 50), (72, 102, 68), (96, 130, 88))
LINEN_CREAM: Pal4 = ((148, 136, 116), (180, 168, 146), (210, 198, 176), (232, 222, 202))
POTION_EMERALD: Pal4 = ((5, 110, 78), (5, 150, 105), (16, 185, 129), (110, 231, 183))

LYRA_THEME = HeroTheme(
    name="npc_lyra",
    is_wraith=False,
    base_shift_x=0,
    pants=BODICE_OLIVE,
    boot_cuff=((48, 32, 22), (76, 50, 34), (106, 72, 50), (136, 96, 68)),
    boot=((38, 24, 16), (64, 42, 28), (92, 62, 42), (120, 82, 56)),
    tunic=BODICE_OLIVE,
    sleeve=LINEN_CREAM,
    skin=SKIN_LYRA,
    bracer=BODICE_OLIVE,
    cape=None,
    bandana=None,
    dash_tint=(180, 240, 210),
    hit_flash=(255, 215, 215),
)

# Gorran (Ferreiro: pele bronzeada pela forja, cabelo carvao escuro, barba castanho-avermelhada, avental de couro)
SKIN_GORRAN: Pal4 = ((138, 84, 64), (178, 114, 86), (216, 148, 112), (238, 178, 138))
HAIR_GORRAN: Pal4 = ((28, 18, 16), (48, 30, 24), (74, 46, 34), (102, 64, 46))
BEARD_GORRAN: Pal4 = ((52, 26, 18), (86, 42, 26), (124, 62, 36), (158, 84, 48))
APRON_LEATHER: Pal4 = ((42, 25, 17), (70, 42, 28), (102, 64, 42), (134, 88, 58))
SHIRT_CHARCOAL: Pal4 = ((22, 24, 30), (36, 40, 48), (52, 58, 68), (70, 78, 90))

GORRAN_THEME = HeroTheme(
    name="npc_gorran",
    is_wraith=False,
    base_shift_x=0,
    pants=((24, 24, 30), (38, 38, 46), (56, 56, 66), (74, 74, 86)),
    boot_cuff=((42, 26, 18), (68, 44, 30), (98, 64, 44), (128, 86, 60)),
    boot=((30, 20, 14), (52, 34, 24), (78, 52, 38), (104, 72, 52)),
    tunic=APRON_LEATHER,
    sleeve=SKIN_GORRAN,
    skin=SKIN_GORRAN,
    bracer=((36, 22, 16), (62, 38, 26), (92, 58, 40), (124, 80, 56)),
    cape=None,
    bandana=None,
    dash_tint=(255, 180, 120),
    hit_flash=(255, 215, 215),
)


# ---------------------------------------------------------------------------
# Utilitarios de Sombra de Contato e Limpeza de Contorno Base
# ---------------------------------------------------------------------------

def draw_ground_shadow(cv: Canvas, cx: float, cy: float = 75.0, rx: float = 14.0, ry: float = 3.2) -> None:
    """Sombra eliptica suave sob os pes (mesmo padrao visual de hero/monstros 80x80)."""
    x0 = max(0, int(math.floor(cx - rx - 1)))
    x1 = min(cv.w - 1, int(math.ceil(cx + rx + 1)))
    y0 = max(0, int(math.floor(cy - ry - 1)))
    y1 = min(cv.h - 1, int(math.ceil(cy + ry + 1)))
    for y in range(y0, y1 + 1):
        dy = (y - cy) / max(0.5, ry)
        for x in range(x0, x1 + 1):
            dx = (x - cx) / max(0.5, rx)
            d2 = dx * dx + dy * dy
            if d2 <= 0.48:
                cv.blend_pixel(x, y, (6, 6, 12, 95))
            elif d2 <= 1.0:
                cv.blend_pixel(x, y, (8, 8, 14, 55))


def strip_all_outlines(src: Canvas, keep_eyes: bool = False) -> Canvas:
    """
    Remove tanto o contorno adicionado (9,9,13) quanto os pixels quase-pretos de contorno original
    do sprite base (r<18, g<18, b<22), preservando apenas as pupilas dos olhos em y=19 se keep_eyes=True.
    Isso evita manchas pretas residuais ao re-esculpir cabelos, coque e barbas.
    """
    out = Canvas(src.w, src.h)
    for y in range(src.h):
        for x in range(src.w):
            c = src.get(x, y)
            if c[3] == 0:
                continue
            r, g, b, _ = c
            if keep_eyes and y == 19 and x in (41, 45):
                out.put(x, y, c)
                continue
            if r < 18 and g < 18 and b < 22:
                continue
            out.put(x, y, c)
    return out


def map_luma_to_pal(r: int, g: int, b: int, pal: Pal4, thresholds: Tuple[float, float, float] = (38.0, 58.0, 76.0)) -> RGB:
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    if luma < thresholds[0]:
        return pal[0]
    if luma < thresholds[1]:
        return pal[1]
    if luma < thresholds[2]:
        return pal[2]
    return pal[3]


# ---------------------------------------------------------------------------
# NPC 1: Mestre de Armas (npc_weapon_master.png — 320x80, 4 frames 80x80)
# ---------------------------------------------------------------------------

def build_master_parts(base_parts: ExtractedParts) -> Tuple[Canvas, Canvas, Canvas, Canvas]:
    """
    Adapta head, torso e pauldron de hero_living_base.png para o Mestre de Armas:
      - Head: rosto 3/4 real preservado, cabelo grisalho penteado para tras, cicatriz no olho esquerdo e barba grisalha cheia.
      - Torso: couraca de placas de aco polido/escuro + correia diagonal de couro (baldric) + cinto com fivela dourada.
      - Pauldron L e R: ombreiras de placas de aco rebitadas.
    """
    raw_head = strip_all_outlines(base_parts.head, keep_eyes=True)
    head = Canvas(FW, FH)

    for y in range(9, 26):
        for x in range(34, 48):
            c = raw_head.get(x, y)
            if c[3] == 0:
                continue
            r, g, b, _ = c
            if y <= 14:
                col = map_luma_to_pal(r, g, b, HAIR_GRAY, (32.0, 50.0, 68.0))
                head.put(x, y, rgba(col))
            elif y in (15, 16):
                # Em y=15..16, x=40..45: substitui a bandana por testa veterana alta com entradas grisalhas nas temporas
                if y == 16 and 40 <= x <= 45:
                    shade = MASTER_THEME.skin[2] if x in (40, 41, 44) else MASTER_THEME.skin[1]
                    head.put(x, y, rgba(shade))
                elif y == 15 and 41 <= x <= 44:
                    head.put(x, y, rgba(HAIR_GRAY[2] if x in (41, 42) else HAIR_GRAY[1]))
                else:
                    col = map_luma_to_pal(r, g, b, HAIR_GRAY, (32.0, 50.0, 68.0))
                    head.put(x, y, rgba(col))
            else:
                # y >= 17: preserva olhos (esclera/iris), nariz, orelha, mas recolore cabelo na nuca/temporas
                is_hair_region = (x <= 38 and not (x == 36 and y in (18, 19, 20))) or (x >= 46 and y <= 18)
                if is_hair_region and r < 95 and g < 75:
                    col = map_luma_to_pal(r, g, b, HAIR_GRAY, (30.0, 48.0, 66.0))
                    head.put(x, y, rgba(col))
                elif y == 18 and x in (40, 41, 42, 44, 45):
                    # Sobrancelhas grisalhas espessas e franzidas
                    head.put(x, y, rgba(HAIR_GRAY[3] if x in (41, 44) else HAIR_GRAY[1]))
                else:
                    head.put(x, y, c)

    # Garante nitidez total do olho direito em perspectiva 3/4 (x=44..45, y=19) sem mancha escura ao lado
    head.put(44, 19, (205, 198, 196, 255))  # toque de esclera no olho direito
    head.put(45, 19, (24, 16, 20, 255))     # pupila direita
    head.put(46, 18, (0, 0, 0, 0))
    head.put(46, 19, (0, 0, 0, 0))

    # Cicatriz vertical sutil passando pelo olho esquerdo (x=40, y=17..20, fiel ao retrato 2 de portraits_128.png)
    head.put(40, 17, rgba(MASTER_THEME.skin[0]))
    head.put(40, 18, rgba((132, 78, 68)))
    head.put(40, 20, rgba((142, 84, 72)))

    # Esculpe bigode e barba grisalha cheia e aparada sobre maxilar/queixo (y=20..26, x=37..45)
    beard_map: Dict[Tuple[int, int], RGB] = {
        (37, 19): HAIR_GRAY[1],
        (37, 20): HAIR_GRAY[2],
        (38, 20): HAIR_GRAY[1],
        # Bigode farto arqueado (y=21..22)
        (37, 21): HAIR_GRAY[1],
        (38, 21): HAIR_GRAY[2],
        (40, 21): HAIR_GRAY[2],
        (41, 21): HAIR_GRAY[3],
        (42, 21): HAIR_GRAY[3],
        (43, 21): HAIR_GRAY[2],
        (44, 21): HAIR_GRAY[2],
        (45, 21): HAIR_GRAY[1],
        (37, 22): HAIR_GRAY[0],
        (38, 22): HAIR_GRAY[1],
        (39, 22): HAIR_GRAY[2],
        (40, 22): HAIR_GRAY[3],
        (41, 22): HAIR_GRAY[2],
        (42, 22): (96, 62, 58),  # sombra do labio sob o bigode
        (43, 22): HAIR_GRAY[1],
        (44, 22): HAIR_GRAY[2],
        (45, 22): HAIR_GRAY[1],
        # Corpo cheio da barba (y=23..24)
        (37, 23): HAIR_GRAY[0],
        (38, 23): HAIR_GRAY[1],
        (39, 23): HAIR_GRAY[2],
        (40, 23): HAIR_GRAY[3],
        (41, 23): HAIR_GRAY[3],
        (42, 23): HAIR_GRAY[2],
        (43, 23): HAIR_GRAY[2],
        (44, 23): HAIR_GRAY[1],
        (45, 23): HAIR_GRAY[0],
        (38, 24): HAIR_GRAY[0],
        (39, 24): HAIR_GRAY[1],
        (40, 24): HAIR_GRAY[2],
        (41, 24): HAIR_GRAY[3],
        (42, 24): HAIR_GRAY[2],
        (43, 24): HAIR_GRAY[1],
        (44, 24): HAIR_GRAY[1],
        (45, 24): HAIR_GRAY[0],
        # Ponta aparada da barba sobre o colarinho (y=25..26)
        (39, 25): HAIR_GRAY[0],
        (40, 25): HAIR_GRAY[1],
        (41, 25): HAIR_GRAY[2],
        (42, 25): HAIR_GRAY[2],
        (43, 25): HAIR_GRAY[1],
        (44, 25): HAIR_GRAY[0],
        (40, 26): HAIR_GRAY[0],
        (41, 26): HAIR_GRAY[1],
        (42, 26): HAIR_GRAY[1],
        (43, 26): HAIR_GRAY[0],
    }
    for (bx, by), bcol in beard_map.items():
        head.put(bx, by, rgba(bcol))

    head = add_outline(remove_isolated_pixels(head))

    # --- Torso: Couraca de Placas de Aco + Baldric de Couro + Fivela Dourada ---
    raw_torso = strip_all_outlines(base_parts.torso)
    torso = Canvas(FW, FH)
    for y in range(25, 45):
        for x in range(31, 46):
            c = raw_torso.get(x, y)
            if c[3] == 0:
                continue
            r, g, b, _ = c
            if y <= 27:
                col = CAPE_SLATE[1] if y == 25 else STEEL_PLATE[2]
                torso.put(x, y, rgba(col))
            elif y <= 39:
                col = map_luma_to_pal(r, g, b, STEEL_PLATE, (48.0, 74.0, 96.0))
                if 29 <= y <= 33 and 36 <= x <= 39 and col == STEEL_PLATE[2]:
                    col = STEEL_PLATE[3]
                torso.put(x, y, rgba(col))
            elif y in (40, 41):
                torso.put(x, y, rgba(STEEL_DARK[1] if (x + y) % 2 == 0 else STEEL_DARK[0]))
            else:
                if 38 <= x <= 40 and y in (42, 43):
                    col = GOLD_TRIM[3] if (x == 38 and y == 42) else GOLD_TRIM[2]
                else:
                    col = map_luma_to_pal(r, g, b, LEATHER_BALDRIC, (50.0, 78.0, 108.0))
                torso.put(x, y, rgba(col))

    # Vinco central da couraca e divisao da placa abdominal (y=35)
    for y in range(28, 39):
        if torso.get(40, y)[3] > 0:
            torso.put(40, y, rgba(STEEL_PLATE[0]))
    for x in range(35, 44):
        if torso.get(x, 35)[3] > 0:
            torso.put(x, 35, rgba(STEEL_PLATE[0]))

    # Correia diagonal de couro marrom (baldric) cruzando o peito + fivela dourada
    for step in range(12):
        bx = 34 + (step * 9) // 11
        by = 28 + step
        for dx, col in ((0, LEATHER_BALDRIC[2]), (1, LEATHER_BALDRIC[3]), (2, LEATHER_BALDRIC[1])):
            if torso.get(bx + dx, by)[3] > 0:
                torso.put(bx + dx, by, rgba(col))
    torso.put(38, 32, rgba(GOLD_TRIM[3]))
    torso.put(39, 32, rgba(GOLD_TRIM[2]))
    torso.put(38, 33, rgba(GOLD_TRIM[2]))

    torso = add_outline(torso)

    # --- Pauldron esquerdo (near) recolorido para placa de aco com rebite dourado ---
    raw_pauldron = strip_all_outlines(base_parts.pauldron)
    pauldron_near = Canvas(FW, FH)
    for y in range(23, 32):
        for x in range(28, 38):
            c = raw_pauldron.get(x, y)
            if c[3] == 0:
                continue
            r, g, b, _ = c
            col = map_luma_to_pal(r, g, b, STEEL_PLATE, (105.0, 155.0, 192.0))
            pauldron_near.put(x, y, rgba(col))
    pauldron_near.put(32, 26, rgba(GOLD_TRIM[3]))
    pauldron_near.put(35, 27, rgba(GOLD_TRIM[2]))
    pauldron_near = add_outline(pauldron_near)

    # --- Pauldron direito (far) sobre o ombro direito ---
    pauldron_far = Canvas(FW, FH)
    draw_disc(pauldron_far, (45.5, 27.5), radius=4.0, pal=dim_palette(STEEL_PLATE, 0.90), squareness=0.35)
    pauldron_far.put(46, 26, rgba(GOLD_TRIM[2]))
    pauldron_far = add_outline(pauldron_far)

    return head, torso, pauldron_near, pauldron_far


def draw_master_cape(sh_x: float, sh_y: float, sway: float) -> Canvas:
    """Desenha capa veterana azul-ardosia escura ampla caindo atras das costas (y=25..65)."""
    layer = Canvas(FW, FH)
    pts = [
        (sh_x - 2.0, sh_y - 4.0),
        (sh_x + 13.5, sh_y - 3.0),
        (sh_x + 12.0 - sway * 0.3, sh_y + 34.0),
        (sh_x + 3.0 - sway * 0.6, sh_y + 36.5),
        (sh_x - 6.5 - sway * 0.9, sh_y + 35.5),
        (sh_x - 7.5 - sway * 0.5, sh_y + 14.0),
    ]
    folds = (sh_x - 2.0 - sway * 0.5, sh_x + 5.0 - sway * 0.3)
    draw_polygon_shaded(layer, pts, CAPE_SLATE, fold_xs=folds, rim_left=False)
    return add_outline(layer)


def draw_master_tassets(pelvis_cx: float, belt_y: float, sway_dx: float) -> Canvas:
    """Desenha saiote de batalha (tassets de placas de aco sobre couro escuro)."""
    layer = Canvas(FW, FH)
    top_y = belt_y - 0.5
    hem_y = belt_y + 9.5
    pts = [
        (pelvis_cx - 7.5, top_y),
        (pelvis_cx + 7.0, top_y),
        (pelvis_cx + 8.8 + sway_dx * 0.3, hem_y - 0.5),
        (pelvis_cx + 2.8 + sway_dx * 0.2, hem_y + 0.8),
        (pelvis_cx - 2.8 + sway_dx * 0.2, hem_y + 0.8),
        (pelvis_cx - 8.8 + sway_dx * 0.3, hem_y - 0.5),
    ]
    draw_polygon_shaded(layer, pts, STEEL_DARK, fold_xs=(pelvis_cx - 2.5, pelvis_cx + 2.5))
    for side_x in (int(round(pelvis_cx - 6)), int(round(pelvis_cx + 3))):
        for py in range(int(round(top_y + 1)), int(round(hem_y - 1))):
            for px in range(side_x, side_x + 3):
                col = STEEL_PLATE[2] if px == side_x else STEEL_PLATE[1]
                layer.put(px, py, rgba(col))
        layer.put(side_x + 1, int(round(top_y + 2)), rgba(GOLD_TRIM[2]))
        layer.put(side_x + 1, int(round(hem_y - 3)), rgba(GOLD_TRIM[2]))
    return add_outline(layer)


def draw_master_halberd(wx: int, bob_y: int, glint: bool) -> Canvas:
    """Desenha alabarda de aco detalhada na vertical (y=4..75) com haste de madeira e lamina chanfrada."""
    layer = Canvas(FW, FH)
    draw_capsule(layer, (wx + 0.5, 14.0 + bob_y), (wx + 0.5, 74.0), r0=1.35, r1=1.35, pal=WOOD_HAFT)
    for ry in (17 + bob_y, 27 + bob_y, 42 + bob_y, 58, 72):
        for dx, col in ((0, GOLD_TRIM[3]), (1, GOLD_TRIM[2]), (2, GOLD_TRIM[1])):
            layer.put(wx - 1 + dx, ry, rgba(col))

    spear_pts = [
        (wx + 0.5, 4.0 + bob_y),
        (wx + 2.4, 10.5 + bob_y),
        (wx + 1.6, 16.0 + bob_y),
        (wx - 0.6, 16.0 + bob_y),
        (wx - 1.4, 10.5 + bob_y),
    ]
    draw_polygon_shaded(layer, spear_pts, STEEL_PLATE)
    for py in range(6 + bob_y, 15 + bob_y):
        layer.put(wx, py, rgba(STEEL_PLATE[3]))

    axe_pts = [
        (wx + 1.5, 13.5 + bob_y),
        (wx + 6.5, 11.5 + bob_y),
        (wx + 8.5, 15.5 + bob_y),
        (wx + 8.2, 20.5 + bob_y),
        (wx + 5.8, 24.5 + bob_y),
        (wx + 1.5, 21.0 + bob_y),
    ]
    draw_polygon_shaded(layer, axe_pts, STEEL_PLATE)
    for py in range(13 + bob_y, 24 + bob_y):
        edge_x = wx + 8 if 15 + bob_y <= py <= 20 + bob_y else wx + 7
        layer.put(edge_x, py, rgba((224, 234, 246) if glint else STEEL_PLATE[3]))
        layer.put(edge_x - 1, py, rgba(STEEL_PLATE[2]))

    spike_pts = [
        (wx - 0.5, 15.5 + bob_y),
        (wx - 4.5, 17.5 + bob_y),
        (wx - 0.5, 19.5 + bob_y),
    ]
    draw_polygon_shaded(layer, spike_pts, STEEL_DARK)

    for py in range(16 + bob_y, 20 + bob_y):
        layer.put(wx, py, rgba(GOLD_TRIM[3]))
        layer.put(wx + 1, py, rgba(GOLD_TRIM[2]))

    outlined = add_outline(layer)
    for y in range(FOOT_Y, FH):
        for x in range(FW):
            outlined.put(x, y, (0, 0, 0, 0))
    return outlined


def render_weapon_master_frame(
    frame_idx: int,
    master_parts: Tuple[Canvas, Canvas, Canvas, Canvas],
) -> Canvas:
    head, torso, pauldron_near, pauldron_far = master_parts
    bob_y = [0, -1, -1, 0][frame_idx]
    cape_sway = [0.0, 1.2, 2.2, 1.0][frame_idx]
    weapon_bob = [0, 0, -1, 0][frame_idx]

    frame = Canvas(FW, FH)
    draw_ground_shadow(frame, CENTER_X - 1.0, cy=75.0, rx=14.5, ry=3.2)
    draw_ground_shadow(frame, 55.5, cy=75.0, rx=3.5, ry=1.5)

    pelvis_cx = 39.0
    hip_y = 49.5 + bob_y * 0.5
    belt_y = 43.5 + bob_y
    near_sh = (32.5, 29.0 + bob_y)
    far_sh = (45.0, 29.5 + bob_y)

    # 1. Capa veterana atras
    frame.composite(draw_master_cape(near_sh[0], near_sh[1], cape_sway))

    # 2. Braco direito (far_arm) + ombreira direita
    far_arm, _ = draw_arm(far_sh, (54.5, 36.5 + bob_y), bend_sign=-1, theme=MASTER_THEME, is_far=True)
    frame.composite(far_arm)
    frame.composite(pauldron_far, 0, bob_y)

    # 3. Pernas com grevas de aco e joelheiras contornadas (FOOT_Y = 76)
    far_leg, far_knee, _ = draw_leg((pelvis_cx + 2.5, hip_y - 0.5), (47.5, 71.0), 0.0, MASTER_THEME, is_far=True)
    near_leg, near_knee, _ = draw_leg((pelvis_cx - 3.0, hip_y), (27.5, 72.0), 0.0, MASTER_THEME, is_far=False)
    frame.composite(far_leg)
    knee_far_cv = Canvas(FW, FH)
    draw_disc(knee_far_cv, (far_knee[0] + 0.5, far_knee[1]), radius=2.1, pal=dim_palette(STEEL_PLATE, 0.85), squareness=0.4)
    frame.composite(add_outline(knee_far_cv))

    frame.composite(near_leg)
    knee_near_cv = Canvas(FW, FH)
    draw_disc(knee_near_cv, (near_knee[0] + 0.5, near_knee[1]), radius=2.2, pal=STEEL_PLATE, squareness=0.4)
    frame.composite(add_outline(knee_near_cv))

    # 4. Saiote de placas (tassets) + Torso + Cabeca
    frame.composite(draw_master_tassets(pelvis_cx, belt_y, cape_sway * 0.25))
    frame.composite(torso, 0, bob_y)
    frame.composite(head, 0, bob_y)

    # 5. Alabarda vertical na mao direita
    frame.composite(draw_master_halberd(wx=55, bob_y=weapon_bob, glint=(frame_idx == 2)))

    # 6. Braco esquerdo (near_arm) firme junto ao cinto + ombreira esquerda
    near_arm, _ = draw_arm(near_sh, (29.5, 47.5 + bob_y), bend_sign=-1, theme=MASTER_THEME, is_far=False)
    frame.composite(near_arm)
    frame.composite(pauldron_near, 0, bob_y)

    return remove_isolated_pixels(frame)


# ---------------------------------------------------------------------------
# NPC 2: Lyra (npc_lyra.png — 320x80, 4 frames 80x80)
# ---------------------------------------------------------------------------

def build_lyra_parts(base_parts: ExtractedParts) -> Tuple[Canvas, Canvas]:
    """
    Constroi a cabeca (y=11..27) e o corpete medieval (y=27..42) de Lyra partindo de hero_living_base.png:
      - Rosto 3/4 real deslocado +2px em Y, pele clara quente, maxilar feminino suavizado, labios suaves,
        cabelo castanho-avela integrado organicamente ao coque trancado atras da nuca (sem linha preta divisoria!).
      - Corpete verde-oliva acinturado com gola/decote de linho creme e amarracao frontal.
    """
    raw_head = strip_all_outlines(base_parts.head, keep_eyes=True)
    head = Canvas(FW, FH)
    dy = 2  # Lyra levemente mais baixa (~63px de altura total)

    # 1. Coque trancado preso atras da nuca (x=30..35, y=14..20), fundido diretamente ao cabelo
    draw_disc(head, (32.8, 17.2), radius=3.0, pal=HAIR_HAZEL, squareness=0.15)
    # Textura de tranca no coque + fita de linho creme na base do coque
    head.put(31, 16, rgba(HAIR_HAZEL[3]))
    head.put(32, 18, rgba(HAIR_HAZEL[0]))
    for py in range(15, 19):
        head.put(34, py, rgba(LINEN_CREAM[2] if py < 17 else LINEN_CREAM[1]))

    # 2. Transfere rosto e cabelo de hero_living_base (+2px em Y) sem contornos internos escuros
    for y in range(9, 26):
        ty = y + dy
        for x in range(34, 48):
            c = raw_head.get(x, y)
            if c[3] == 0:
                continue
            r, g, b, _ = c
            # Suaviza topo arrepiado masculino e afina 1px o maxilar direito para rosto feminino delicado
            if y == 9 and x in (35, 36, 44, 45):
                continue
            if y >= 22 and x >= 45:
                continue

            if y <= 14:
                col = map_luma_to_pal(r, g, b, HAIR_HAZEL, (30.0, 48.0, 66.0))
                head.put(x, ty, rgba(col))
            elif y in (15, 16):
                if y == 16 and 41 <= x <= 44:
                    head.put(x, ty, rgba(SKIN_LYRA[3] if x in (41, 42) else SKIN_LYRA[2]))
                else:
                    col = map_luma_to_pal(r, g, b, HAIR_HAZEL, (30.0, 48.0, 66.0))
                    head.put(x, ty, rgba(col))
            else:
                if y == 19 and x == 40:
                    head.put(x, ty, (238, 236, 240, 255))  # esclera clara e nitida
                elif y == 19 and x in (41, 45):
                    head.put(x, ty, (24, 38, 28, 255))     # iris verde-escura expressiva
                elif y == 18 and x in (41, 42, 44, 45):
                    head.put(x, ty, rgba(HAIR_HAZEL[1]))   # sobrancelhas femininas arqueadas
                elif x <= 38 and r < 95 and g < 75 and not (x == 36 and y in (18, 19, 20)):
                    col = map_luma_to_pal(r, g, b, HAIR_HAZEL, (28.0, 46.0, 64.0))
                    head.put(x, ty, rgba(col))
                else:
                    col = map_luma_to_pal(r, g, b, SKIN_LYRA, (130.0, 160.0, 185.0))
                    head.put(x, ty, rgba(col))

    # Garante olho direito feminino limpo em perspectiva 3/4 (ty=21)
    head.put(44, 21, (232, 228, 232, 255))
    head.put(45, 21, (24, 38, 28, 255))

    # Labios suaves definidos (ty=25, x=42..43)
    head.put(42, 25, (176, 98, 92, 255))
    head.put(43, 25, (194, 116, 106, 255))

    # Mechas laterais longas castanho-avela emoldurando a face (x=36..38, y=19..27 e x=46, y=18..23)
    for py, col in ((19, HAIR_HAZEL[2]), (20, HAIR_HAZEL[2]), (21, HAIR_HAZEL[3]), (22, HAIR_HAZEL[2]), (23, HAIR_HAZEL[2]), (24, HAIR_HAZEL[1]), (25, HAIR_HAZEL[1]), (26, HAIR_HAZEL[0])):
        head.put(37, py, rgba(col))
        if py <= 24:
            head.put(35, py, rgba(HAIR_HAZEL[1]))
            head.put(36, py, rgba(HAIR_HAZEL[2]))
    for py, col in ((18, HAIR_HAZEL[2]), (19, HAIR_HAZEL[2]), (20, HAIR_HAZEL[1]), (21, HAIR_HAZEL[1]), (22, HAIR_HAZEL[0])):
        head.put(46, py, rgba(col))

    head = add_outline(remove_isolated_pixels(head))

    # --- Corpete Medieval Verde-Oliva com Decote de Linho Creme e Cinto de Couro ---
    torso = Canvas(FW, FH)
    bodice_pts = [
        (34.0, 27.5),
        (45.0, 27.5),
        (44.0, 35.0),
        (43.5, 41.5),
        (34.5, 41.5),
        (34.0, 35.0),
    ]
    draw_polygon_shaded(torso, bodice_pts, BODICE_OLIVE)

    for py in range(27, 33):
        x_lo = 37 + (py - 27) // 2
        x_hi = 43 - (py - 27) // 3
        for px in range(x_lo, x_hi + 1):
            col = LINEN_CREAM[3] if px <= 39 else (LINEN_CREAM[2] if px <= 41 else LINEN_CREAM[1])
            torso.put(px, py, rgba(col))
    for py in range(33, 40):
        torso.put(40, py, rgba(LINEN_CREAM[2] if py % 2 == 1 else BODICE_OLIVE[0]))
        torso.put(41, py, rgba(BODICE_OLIVE[0] if py % 2 == 1 else LINEN_CREAM[1]))

    for py in range(40, 43):
        for px in range(34, 45):
            col = LEATHER_BALDRIC[2] if py == 40 else (LEATHER_BALDRIC[1] if py == 41 else LEATHER_BALDRIC[0])
            torso.put(px, py, rgba(col))
    torso.put(40, 41, rgba(GOLD_TRIM[3]))
    torso.put(41, 41, rgba(GOLD_TRIM[2]))

    torso = add_outline(torso)
    return head, torso


def draw_lyra_arm(
    shoulder: Tuple[float, float],
    hand_target: Tuple[float, float],
    bend_sign: int,
    is_far: bool,
) -> Tuple[Canvas, Tuple[float, float]]:
    """Desenha braco feminino delicado de Lyra com manga bufante de linho creme e antebraco suave."""
    layer = Canvas(FW, FH)
    dim = 0.88 if is_far else 1.0
    sleeve = dim_palette(LINEN_CREAM, dim)
    cuff = dim_palette(BODICE_OLIVE, dim)
    skin = dim_palette(SKIN_LYRA, 0.94 if is_far else 1.0)

    elbow, hand = solve_2bone_ik(shoulder, hand_target, l1=7.8, l2=7.8, bend_sign=bend_sign)

    # Manga bufante de linho creme ate o cotovelo
    draw_capsule(layer, shoulder, elbow, r0=2.8, r1=2.5, pal=sleeve)
    # Punho verde-oliva da manga logo abaixo do cotovelo
    f_dx, f_dy = hand[0] - elbow[0], hand[1] - elbow[1]
    cuff_end = (elbow[0] + f_dx * 0.25, elbow[1] + f_dy * 0.25)
    draw_capsule(layer, elbow, cuff_end, r0=2.3, r1=2.1, pal=cuff)
    # Antebraco e mao delicada
    draw_capsule(layer, cuff_end, hand, r0=1.9, r1=1.7, pal=skin)
    draw_disc(layer, hand, radius=2.1, pal=skin, squareness=0.35)

    return add_outline(layer), hand


def draw_lyra_skirt_and_apron(pelvis_cx: float, belt_y: float, sway_dx: float, potion_glow: bool) -> Canvas:
    """
    Desenha pontas das botas (com contorno proprio), saia longa pregueada verde-oliva (y=42..72),
    avental frontal creme/pergaminho (x=34..47, y=41..69), bolsa de ervas e frasco de pocao esmeralda.
    """
    out = Canvas(FW, FH)

    # 1. Pontas das botas de couro sob a barra da saia (y=71..74, contorno fecha em y=75 < FOOT_Y=76)
    boots_layer = Canvas(FW, FH)
    draw_capsule(boots_layer, (32.5, 72.5), (36.8, 73.2), r0=2.0, r1=1.7, pal=LYRA_THEME.boot)
    draw_capsule(boots_layer, (42.2, 72.0), (47.2, 72.8), r0=2.0, r1=1.7, pal=LYRA_THEME.boot)
    out.composite(add_outline(boots_layer))

    # 2. Saia longa pregueada verde-oliva ate os tornozelos (y=42..71) + Avental frontal creme
    layer = Canvas(FW, FH)
    skirt_pts = [
        (pelvis_cx - 5.5, belt_y),
        (pelvis_cx + 5.5, belt_y),
        (pelvis_cx + 9.2 + sway_dx * 0.5, 57.0),
        (pelvis_cx + 11.0 + sway_dx, 71.0),
        (pelvis_cx - 10.5 + sway_dx, 71.0),
        (pelvis_cx - 8.8 + sway_dx * 0.5, 57.0),
    ]
    folds = (
        pelvis_cx - 6.2 + sway_dx * 0.6,
        pelvis_cx - 2.5 + sway_dx * 0.5,
        pelvis_cx + 6.2 + sway_dx * 0.6,
    )
    draw_polygon_shaded(layer, skirt_pts, BODICE_OLIVE, fold_xs=folds)
    for px in range(int(round(pelvis_cx - 10 + sway_dx)), int(round(pelvis_cx + 11 + sway_dx))):
        if layer.get(px, 69)[3] > 0:
            layer.put(px, 69, rgba(GOLD_TRIM[1] if px % 2 == 0 else BODICE_OLIVE[0]))
        if layer.get(px, 70)[3] > 0:
            layer.put(px, 70, rgba(BODICE_OLIVE[0]))

    apron_pts = [
        (pelvis_cx - 3.8, belt_y + 0.5),
        (pelvis_cx + 4.8, belt_y + 0.5),
        (pelvis_cx + 6.5 + sway_dx * 0.85, 67.5),
        (pelvis_cx - 4.5 + sway_dx * 0.85, 67.5),
    ]
    draw_polygon_shaded(
        layer,
        apron_pts,
        LINEN_CREAM,
        fold_xs=(pelvis_cx + 0.5 + sway_dx * 0.5, pelvis_cx + 3.6 + sway_dx * 0.6),
    )
    for px in range(int(round(pelvis_cx - 4 + sway_dx * 0.8)), int(round(pelvis_cx + 6 + sway_dx * 0.8))):
        if layer.get(px, 66)[3] > 0:
            layer.put(px, 66, rgba(LINEN_CREAM[0]))

    # 3. Bolsa de couro de ervas a esquerda do cinto (x=31..35, y=42..47)
    pouch_pts = [
        (31.0, belt_y + 0.5),
        (35.0, belt_y + 0.5),
        (35.5, belt_y + 5.5),
        (30.5, belt_y + 5.5),
    ]
    draw_polygon_shaded(layer, pouch_pts, LEATHER_BALDRIC)
    layer.put(33, int(round(belt_y + 2)), rgba(GOLD_TRIM[3]))

    # 4. Frasco de vidro de pocao verde-esmeralda brilhante no quadril (x=45..50, y=42..49)
    vy = int(round(belt_y))
    layer.put(46, vy, rgba(WOOD_HAFT[3]))
    layer.put(47, vy, rgba(WOOD_HAFT[2]))
    layer.put(46, vy + 1, (190, 230, 220, 255))
    layer.put(47, vy + 1, (150, 200, 190, 255))
    draw_disc(layer, (46.8, vy + 4.2), radius=2.5, pal=POTION_EMERALD)
    layer.put(45, vy + 3, (255, 255, 255, 255))
    if potion_glow:
        layer.put(46, vy + 4, (220, 255, 240, 255))

    out.composite(add_outline(layer))
    for y in range(FOOT_Y, FH):
        for x in range(FW):
            out.put(x, y, (0, 0, 0, 0))
    return out


def render_lyra_frame(frame_idx: int, lyra_parts: Tuple[Canvas, Canvas]) -> Canvas:
    head, torso = lyra_parts
    bob_y = [0, -1, -1, 0][frame_idx]
    skirt_sway = [0.0, 0.5, 1.0, 0.4][frame_idx]
    potion_glow = frame_idx in (1, 2)

    frame = Canvas(FW, FH)
    draw_ground_shadow(frame, CENTER_X, cy=75.0, rx=13.5, ry=3.0)

    pelvis_cx = 39.5
    belt_y = 42.0 + bob_y
    near_sh = (34.0, 30.5 + bob_y)
    far_sh = (43.5, 30.5 + bob_y)

    # 1. Braco direito (far_arm) delicado junto ao corpo
    far_arm, _ = draw_lyra_arm(far_sh, (42.5, 42.5 + bob_y), bend_sign=1, is_far=True)
    frame.composite(far_arm)

    # 2. Saia longa + avental + pocao esmeralda + pontas das botas
    frame.composite(draw_lyra_skirt_and_apron(pelvis_cx, belt_y, skirt_sway, potion_glow))

    # 3. Corpete e Cabeca
    frame.composite(torso, 0, bob_y)
    frame.composite(head, 0, bob_y)

    # 4. Braco esquerdo (near_arm) com maos postas a frente do avental segurando ramo de ervas
    near_arm, hand_pos = draw_lyra_arm(near_sh, (39.5, 42.8 + bob_y), bend_sign=-1, is_far=False)
    herb = Canvas(FW, FH)
    hx, hy = int(round(hand_pos[0])), int(round(hand_pos[1]))
    herb.put(hx + 2, hy - 1, rgba(POTION_EMERALD[2]))
    herb.put(hx + 3, hy - 2, rgba(POTION_EMERALD[3]))
    herb.put(hx + 4, hy - 3, rgba(GOLD_TRIM[3]))
    herb.put(hx + 2, hy - 2, rgba(POTION_EMERALD[1]))
    frame.composite(near_arm)
    frame.composite(add_outline(herb))

    return remove_isolated_pixels(frame)


# ---------------------------------------------------------------------------
# NPC 3: Gorran (npc_gorran.png — 640x80, 8 frames 80x80: idle0..3 + hammer0..3)
# ---------------------------------------------------------------------------

def build_gorran_parts(base_parts: ExtractedParts) -> Tuple[Canvas, Canvas]:
    """
    Constroi a cabeca (y=9..28) e o torso largo com avental de couro de ferreiro (y=25..44) de Gorran:
      - Rosto 3/4 real com pele bronzeada pela forja, cabelo curto escuro carvao/castanho-escuro
        e barba cheia e larga de ferreiro descendo sobre o peito (fiel ao retrato 3 de portraits_128.png).
      - Torso musculoso (+2px mais largo nos ombros/peito) com avental pesado de couro marrom-queimado,
        alcas nos ombros com rebites metalicos, bolso peitoral costurado e cinto de ferramentas.
    """
    raw_head = strip_all_outlines(base_parts.head, keep_eyes=True)
    head = Canvas(FW, FH)

    for y in range(9, 26):
        for x in range(34, 48):
            c = raw_head.get(x, y)
            if c[3] == 0:
                continue
            r, g, b, _ = c
            if y == 9 and x in (35, 36, 44, 45):
                continue
            if y <= 14:
                col = map_luma_to_pal(r, g, b, HAIR_GORRAN, (30.0, 50.0, 70.0))
                head.put(x, y, rgba(col))
            elif y in (15, 16):
                if y == 16 and 40 <= x <= 45:
                    head.put(x, y, rgba(SKIN_GORRAN[2] if x in (41, 42, 43) else SKIN_GORRAN[1]))
                else:
                    col = map_luma_to_pal(r, g, b, HAIR_GORRAN, (30.0, 50.0, 70.0))
                    head.put(x, y, rgba(col))
            else:
                if y == 19 and x == 40:
                    head.put(x, y, (224, 214, 206, 255))
                elif y == 19 and x in (41, 45):
                    head.put(x, y, (26, 14, 12, 255))
                elif y == 18 and x in (40, 41, 42, 44, 45):
                    head.put(x, y, rgba(HAIR_GORRAN[0] if x in (41, 45) else HAIR_GORRAN[1]))
                elif x <= 38 and r < 95 and g < 75 and not (x == 36 and y in (18, 19, 20)):
                    col = map_luma_to_pal(r, g, b, HAIR_GORRAN, (28.0, 48.0, 68.0))
                    head.put(x, y, rgba(col))
                else:
                    col = map_luma_to_pal(r, g, b, SKIN_GORRAN, (130.0, 160.0, 185.0))
                    head.put(x, y, rgba(col))

    # Garante olho direito nitido em 3/4 sem mancha preta lateral
    head.put(44, 19, (210, 198, 190, 255))
    head.put(45, 19, (26, 14, 12, 255))

    # Esculpe a barba cheia, espessa e larga de Gorran (y=20..27, x=36..46 — fiel ao retrato 3)
    for py in range(20, 28):
        x_lo = 36 if py <= 24 else (37 if py == 25 else (38 if py == 26 else 40))
        x_hi = 46 if py <= 24 else (45 if py == 25 else (44 if py == 26 else 43))
        for px in range(x_lo, x_hi + 1):
            if py == 20 and px in (39, 40, 43, 44):
                continue
            if py == 21 and 40 <= px <= 45:
                col = BEARD_GORRAN[3] if px in (41, 42, 43) else BEARD_GORRAN[2]
            elif py == 22 and px in (42, 43):
                col = BEARD_GORRAN[0]
            else:
                if px <= x_lo + 1 or py >= 26:
                    col = BEARD_GORRAN[0]
                elif px >= x_hi:
                    col = BEARD_GORRAN[1]
                elif 40 <= px <= 43 and py in (23, 24):
                    col = BEARD_GORRAN[3]
                else:
                    col = BEARD_GORRAN[2]
            head.put(px, py, rgba(col))

    head = add_outline(remove_isolated_pixels(head))

    # --- Torso Musculoso (+2px de largura) com Avental de Couro Pesado, Alcas e Bolso Peitoral ---
    torso = Canvas(FW, FH)
    chest_pts = [
        (31.0, 26.0),
        (46.0, 26.0),
        (45.5, 41.0),
        (31.5, 41.0),
    ]
    draw_polygon_shaded(torso, chest_pts, SKIN_GORRAN)

    for py in range(27, 34):
        for px in range(33, 45):
            if py >= 29 or px in (34, 35, 43, 44):
                torso.put(px, py, rgba(SHIRT_CHARCOAL[1] if px < 40 else SHIRT_CHARCOAL[0]))

    for py in range(30, 42):
        for px in range(33, 46):
            if px <= 34 or py == 41:
                col = APRON_LEATHER[1]
            elif px <= 39 and py <= 35:
                col = APRON_LEATHER[3]
            elif px >= 44:
                col = APRON_LEATHER[0]
            else:
                col = APRON_LEATHER[2]
            torso.put(px, py, rgba(col))

    for py in range(26, 31):
        torso.put(34, py, rgba(APRON_LEATHER[2]))
        torso.put(35, py, rgba(APRON_LEATHER[3]))
        torso.put(43, py, rgba(APRON_LEATHER[2]))
        torso.put(44, py, rgba(APRON_LEATHER[1]))
    torso.put(35, 31, rgba(GOLD_TRIM[3]))
    torso.put(43, 31, rgba(GOLD_TRIM[3]))

    for px in range(36, 43):
        torso.put(px, 33, rgba(APRON_LEATHER[0]))
        torso.put(px, 38, rgba(APRON_LEATHER[0]))
    for py in range(33, 39):
        torso.put(36, py, rgba(APRON_LEATHER[0]))
        torso.put(42, py, rgba(APRON_LEATHER[0]))
    for px in range(37, 42):
        torso.put(px, 34, rgba(APRON_LEATHER[3]))

    for py in range(41, 45):
        for px in range(31, 47):
            col = LEATHER_BALDRIC[1] if py == 42 else LEATHER_BALDRIC[0]
            torso.put(px, py, rgba(col))
    for py in (42, 43):
        for px in (38, 39, 40):
            torso.put(px, py, rgba(STEEL_PLATE[3] if px == 38 else STEEL_PLATE[2]))

    torso = add_outline(torso)
    return head, torso


def draw_gorran_apron_skirt(pelvis_cx: float, belt_y: float, sway_dx: float) -> Canvas:
    """Desenha a parte inferior do avental pesado de couro de ferreiro descendo ate y=61."""
    layer = Canvas(FW, FH)
    top_y = belt_y + 0.5
    hem_y = 61.0
    pts = [
        (pelvis_cx - 7.8, top_y),
        (pelvis_cx + 7.2, top_y),
        (pelvis_cx + 8.5 + sway_dx * 0.4, hem_y - 0.5),
        (pelvis_cx + 1.0 + sway_dx * 0.3, hem_y + 0.8),
        (pelvis_cx - 7.2 + sway_dx * 0.4, hem_y - 0.5),
    ]
    draw_polygon_shaded(
        layer,
        pts,
        APRON_LEATHER,
        fold_xs=(pelvis_cx - 3.0 + sway_dx * 0.2, pelvis_cx + 3.2 + sway_dx * 0.25),
    )
    for ry in (int(round(top_y + 2)), int(round(hem_y - 3))):
        layer.put(int(round(pelvis_cx - 6)), ry, rgba(GOLD_TRIM[2]))
        layer.put(int(round(pelvis_cx + 5)), ry, rgba(GOLD_TRIM[2]))
    return add_outline(layer)


def draw_gorran_arm(
    shoulder: Tuple[float, float],
    hand_target: Tuple[float, float],
    bend_sign: int,
    is_far: bool,
) -> Tuple[Canvas, Tuple[float, float]]:
    """
    Desenha braco nu musculoso de Gorran com IK 2-bones (r0=3.5, r1=2.9) + munhequeira de couro escuro.
    """
    layer = Canvas(FW, FH)
    skin = dim_palette(SKIN_GORRAN, 0.90 if is_far else 1.0)
    bracer = dim_palette(GORRAN_THEME.bracer, 0.88 if is_far else 1.0)

    l1, l2 = (10.6, 10.6) if not is_far else (10.2, 10.4)
    elbow, hand = solve_2bone_ik(shoulder, hand_target, l1=l1, l2=l2, bend_sign=bend_sign)

    draw_disc(layer, shoulder, radius=3.5, pal=skin)
    draw_capsule(layer, shoulder, elbow, r0=3.5, r1=2.9, pal=skin)
    draw_disc(layer, elbow, radius=2.8, pal=skin)

    f_dx, f_dy = hand[0] - elbow[0], hand[1] - elbow[1]
    bracer_start = (elbow[0] + f_dx * 0.42, elbow[1] + f_dy * 0.42)
    wrist = (elbow[0] + f_dx * 0.86, elbow[1] + f_dy * 0.86)
    draw_capsule(layer, elbow, bracer_start, r0=2.9, r1=2.65, pal=skin)
    draw_capsule(layer, bracer_start, wrist, r0=2.8, r1=2.55, pal=bracer)

    draw_disc(layer, hand, radius=2.9, pal=skin, squareness=0.45)
    fx, fy = int(round(hand[0])), int(round(hand[1]))
    layer.put(fx + (1 if not is_far else -1), fy + 1, rgba(skin[0]))
    layer.put(fx, fy - 1, rgba(skin[3]))

    return add_outline(layer), hand


def draw_smith_hammer(
    hand: Tuple[float, float],
    angle_deg: float,
    haft_len: float = 10.5,
) -> Tuple[Canvas, Tuple[float, float]]:
    """
    Desenha o martelo pesado de forja a partir da mao (hand) no angulo especificado.
    Retorna (layer_com_contorno, centro_da_cabeca_do_martelo).
    """
    layer = Canvas(FW, FH)
    hx, hy = hand
    rad = math.radians(angle_deg)
    dx, dy = math.cos(rad), math.sin(rad)

    tail = (hx - dx * 3.0, hy - dy * 3.0)
    head_c = (hx + dx * haft_len, hy + dy * haft_len)
    draw_capsule(layer, tail, head_c, r0=1.25, r1=1.35, pal=WOOD_HAFT)

    px, py = -dy, dx
    hw, hh = 4.6, 2.7
    pts = [
        (head_c[0] - px * hw - dx * hh, head_c[1] - py * hw - dy * hh),
        (head_c[0] + px * hw - dx * hh, head_c[1] + py * hw - dy * hh),
        (head_c[0] + px * hw + dx * hh, head_c[1] + py * hw + dy * hh),
        (head_c[0] - px * hw + dx * hh, head_c[1] - py * hw + dy * hh),
    ]
    draw_polygon_shaded(layer, pts, STEEL_PLATE)
    draw_disc(layer, head_c, radius=1.8, pal=GOLD_TRIM, squareness=0.5)
    return add_outline(layer), head_c


def draw_tongs_and_hot_iron(hand: Tuple[float, float], is_heating: bool, is_impact: bool) -> Canvas:
    """Desenha tenaz de ferro na mao esquerda segurando barra de ferro incandescente (#b91c1c -> #f97316 -> #fef08a)."""
    layer = Canvas(FW, FH)
    hx, hy = hand
    if not is_heating:
        draw_capsule(layer, (hx, hy), (hx + 5.5, hy + 8.5), r0=1.1, r1=1.0, pal=STEEL_DARK)
        draw_capsule(layer, (hx + 4.5, hy + 7.5), (hx + 7.0, hy + 10.5), r0=1.2, r1=0.9, pal=STEEL_PLATE)
        return add_outline(layer)

    tongs_end = (hx + 7.0, hy + 0.5)
    draw_capsule(layer, (hx - 1.0, hy), tongs_end, r0=1.2, r1=1.1, pal=STEEL_DARK)
    bar_x0 = int(round(tongs_end[0]))
    bar_y0 = int(round(tongs_end[1] - 1))
    for py in range(bar_y0, bar_y0 + 3):
        for px in range(bar_x0, min(FW - 3, bar_x0 + 9)):
            t = (px - bar_x0) / 8.0
            if py == bar_y0 + 1 and t > 0.25:
                col = (254, 240, 138, 255) if (is_impact or t > 0.55) else (249, 115, 22, 255)
            elif t > 0.45:
                col = (249, 115, 22, 255)
            else:
                col = (185, 28, 28, 255)
            layer.put(px, py, col)
    return add_outline(layer)


def render_gorran_frame(frame_idx: int, gorran_parts: Tuple[Canvas, Canvas]) -> Canvas:
    head, torso = gorran_parts
    is_hammer = frame_idx >= 4
    sub = frame_idx - 4 if is_hammer else frame_idx

    if not is_hammer:
        body_dx = 0.0
        body_dy = [0.0, -1.0, -1.0, 0.0][sub]
        torso_lean = 0.0
        head_dx, head_dy = 0.0, body_dy
        far_hand_target = (50.5, 45.5 + body_dy)
        near_hand_target = (29.5, 46.5 + body_dy)
        near_bend = -1
        hammer_angle = -42.0 + [0.0, -2.0, -4.0, -2.0][sub]
        haft_len = 10.5
    else:
        # Ciclo hammer0..3 articulado por IK (BRF-148):
        # hammer0: braco erguido acima do ombro (hand=(34, 19)), martelo armado no alto
        # hammer1: descida rapida (hand=(44, 28))
        # hammer2: IMPACTO sobre a barra incandescente (hand=(50, 41), cabeca do martelo em (57, 46)), +1px compressao
        # hammer3: recuo/rebote (hand=(45, 32)) com faiscas residuais
        specs = [
            # (body_dx, body_dy, lean, head_dx, head_dy, near_hand, near_bend, hammer_deg, haft_len)
            (-1.0, -1.0, -1.5, -1.0, -1.0, (31.0, 17.5),  1, -120.0, 9.2),
            (0.5,   0.0,  1.2,  1.0,  0.0, (46.0, 28.0), -1,  -32.0, 9.5),
            (1.5,   1.0,  2.4,  2.2,  1.0, (50.0, 41.0),  1,   35.0, 8.6),
            (0.5,   0.0,  1.0,  0.8,  0.0, (45.5, 32.5), -1,  -16.0, 9.2),
        ]
        body_dx, body_dy, torso_lean, head_dx, head_dy, near_hand_target, near_bend, hammer_angle, haft_len = specs[sub]
        far_hand_target = (48.0 + body_dx * 0.5, 47.0 + (1.0 if sub == 2 else 0.0))

    frame = Canvas(FW, FH)
    draw_ground_shadow(frame, CENTER_X - 1.0, cy=75.0, rx=15.0, ry=3.3)

    pelvis_cx = 39.0 + body_dx
    hip_y = 49.5 + body_dy
    belt_y = 43.5 + body_dy
    sh_shift = torso_lean * 0.75
    near_sh = (31.0 + body_dx + sh_shift, 29.0 + body_dy)
    far_sh = (46.0 + body_dx + sh_shift, 29.5 + body_dy)

    # 1. Braco esquerdo (far_arm) + tenaz com barra de ferro incandescente
    far_arm, actual_far_hand = draw_gorran_arm(far_sh, far_hand_target, bend_sign=-1, is_far=True)
    tongs_layer = draw_tongs_and_hot_iron(actual_far_hand, is_heating=is_hammer, is_impact=(is_hammer and sub == 2))
    frame.composite(far_arm)
    frame.composite(tongs_layer)

    # 2. Pernas robustas e botas pesadas (FOOT_Y = 76)
    far_leg, _, _ = draw_leg((pelvis_cx + 2.8, hip_y - 0.5), (48.5, 71.0), 0.0, GORRAN_THEME, is_far=True)
    near_leg, _, _ = draw_leg((pelvis_cx - 3.2, hip_y), (27.0, 72.0), 0.0, GORRAN_THEME, is_far=False)
    frame.composite(far_leg)
    frame.composite(near_leg)

    # 3. Saia do avental de couro pesado (ate y=61) + Torso + Cabeca
    frame.composite(draw_gorran_apron_skirt(pelvis_cx, belt_y, torso_lean * 0.35))
    torso_sheared = shear_canvas(torso, torso_lean, pivot_y=44.0, height_span=19.0)
    frame.composite(torso_sheared, int(round(body_dx)), int(round(body_dy)))
    frame.composite(head, int(round(head_dx)), int(round(head_dy)))

    # 4. Braco direito musculoso (near_arm) + Martelo de Forja
    near_arm, actual_near_hand = draw_gorran_arm(near_sh, near_hand_target, bend_sign=near_bend, is_far=False)
    hammer_layer, hammer_head_pos = draw_smith_hammer(actual_near_hand, hammer_angle, haft_len=haft_len)
    frame.composite(hammer_layer)
    frame.composite(near_arm)

    # 5. VFX de forja nos frames hammer1..3 (arco de velocidade + explosao de faiscas no impacto hammer2)
    if is_hammer and sub == 1:
        for ax, ay, al in ((36, 10, 90), (41, 12, 130), (46, 15, 170), (50, 19, 200)):
            frame.blend_pixel(ax, ay, (240, 245, 255, al))
            frame.blend_pixel(ax - 1, ay + 1, (200, 215, 235, al // 2))
    elif is_hammer and sub == 2:
        ix, iy = int(round(hammer_head_pos[0])), int(round(hammer_head_pos[1]))
        for dy_s in range(-2, 3):
            for dx_s in range(-2, 3):
                if abs(dx_s) + abs(dy_s) <= 2:
                    frame.blend_pixel(ix + dx_s, iy + dy_s, (255, 244, 160, 230))
        frame.put(ix, iy, (255, 255, 240, 255))
        sparks = [
            (-7, -6, (254, 240, 138, 255)),
            (-4, -9, (249, 115, 22, 255)),
            (0, -10, (254, 240, 138, 255)),
            (4, -8, (251, 146, 60, 255)),
            (8, -5, (254, 240, 138, 255)),
            (9, -1, (249, 115, 22, 255)),
            (6, 4, (234, 88, 12, 255)),
            (-5, 3, (249, 115, 22, 255)),
            (-8, -2, (251, 146, 60, 255)),
            (2, -5, (255, 255, 255, 255)),
            (5, -3, (254, 240, 138, 255)),
        ]
        for sdx, sdy, scol in sparks:
            sx, sy = ix + sdx, iy + sdy
            if 0 <= sx < FW and 0 <= sy < FOOT_Y:
                frame.put(sx, sy, scol)
                frame.blend_pixel(ix + sdx // 2, iy + sdy // 2, (251, 191, 36, 200))
    elif is_hammer and sub == 3:
        ix, iy = 57, 46
        for sdx, sdy, scol in (
            (-5, -8, (249, 115, 22, 210)),
            (1, -11, (254, 240, 138, 220)),
            (6, -7, (234, 88, 12, 200)),
            (4, -3, (251, 146, 60, 180)),
            (-2, -5, (254, 240, 138, 190)),
        ):
            sx, sy = ix + sdx, iy + sdy
            if 0 <= sx < FW and 0 <= sy < FOOT_Y:
                frame.blend_pixel(sx, sy, scol)

    return remove_isolated_pixels(frame)


# ---------------------------------------------------------------------------
# Fonte Bitmap 5x7 e Prancha de Validacao 3x (preview_m9_village_npcs.png)
# ---------------------------------------------------------------------------

FONT_5X7: Dict[str, List[str]] = {
    "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "B": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
    "C": [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
    "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    "F": ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
    "G": [".####", "#....", "#....", "#.###", "#...#", "#...#", ".####"],
    "H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "I": [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
    "K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    "L": ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    "M": ["#...#", "##.##", "#.#.#", "#...#", "#...#", "#...#", "#...#"],
    "N": ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
    "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
    "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    "S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    "U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "V": ["#...#", "#...#", "#...#", "#...#", ".#.#.", ".#.#.", "..#.."],
    "W": ["#...#", "#...#", "#...#", "#...#", "#.#.#", "##.##", "#...#"],
    "X": ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
    "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
    "0": [".###.", "#..##", "#.#.#", "#.#.#", "##..#", "#...#", ".###."],
    "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
    "2": [".###.", "#...#", "....#", "..##.", ".#...", "#....", "#####"],
    "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
    "4": ["#...#", "#...#", "#...#", "#####", "....#", "....#", "....#"],
    "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
    "6": [".###.", "#....", "####.", "#...#", "#...#", "#...#", ".###."],
    "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
    "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
    "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
    ":": [".....", "..#..", "..#..", ".....", "..#..", "..#..", "....."],
    "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
    "_": [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
    ".": [".....", ".....", ".....", ".....", ".....", "..##.", "..##."],
    ",": [".....", ".....", ".....", ".....", "..##.", "..#..", ".#..."],
    "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
    ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
    "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
    " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
}


def fill_rect(cv: Canvas, x0: int, y0: int, x1: int, y1: int, col: Color) -> None:
    for y in range(max(0, y0), min(cv.h, y1 + 1)):
        for x in range(max(0, x0), min(cv.w, x1 + 1)):
            cv.blend_pixel(x, y, col)


def draw_text(cv: Canvas, x: int, y: int, text: str, col: Color = (232, 236, 245, 255), scale: int = 2) -> None:
    cx = x
    for ch in text.upper():
        glyph = FONT_5X7.get(ch, FONT_5X7[" "])
        for ry, row in enumerate(glyph):
            for rx, bit in enumerate(row):
                if bit == "#":
                    for sy in range(scale):
                        for sx in range(scale):
                            cv.put(cx + rx * scale + sx, y + ry * scale + sy, col)
        cx += 6 * scale


def build_sheet(frames: Sequence[Canvas]) -> Canvas:
    sheet = Canvas(FW * len(frames), FH)
    for idx, fr in enumerate(frames):
        sheet.composite(fr, idx * FW, 0)
    return sheet


def load_hero_living_frame0() -> Canvas:
    """Carrega o frame 0 (80x80) de hero_living.png em escala real 1:1 (SEM redimensionar!)."""
    if HERO_SHEET_PATH.exists():
        sheet = read_png(HERO_SHEET_PATH)
        return sheet.crop(0, 0, FW, FH)
    return read_png(HERO_BASE_PATH)


def build_preview(
    master_frames: Sequence[Canvas],
    lyra_frames: Sequence[Canvas],
    gorran_frames: Sequence[Canvas],
) -> Canvas:
    scale = 3
    cell_w = FW * scale
    cell_h = FH * scale
    hdr_h = 24
    sec_h = 28
    pad = 10
    cols = 4

    hero_f0 = load_hero_living_frame0()

    rows_spec: List[Tuple[str, List[Tuple[str, Canvas]]]] = [
        (
            "MESTRE DE ARMAS - NPC_WEAPON_MASTER (320X80, 4F 80X80 IDLE)",
            [(f"0{i}:IDLE{i}", master_frames[i]) for i in range(4)],
        ),
        (
            "LYRA - NPC_LYRA (320X80, 4F 80X80 IDLE)",
            [(f"0{i}:IDLE{i}", lyra_frames[i]) for i in range(4)],
        ),
        (
            "GORRAN - NPC_GORRAN (640X80, FRAMES 0..3 IDLE)",
            [(f"0{i}:IDLE{i}", gorran_frames[i]) for i in range(4)],
        ),
        (
            "GORRAN - NPC_GORRAN (640X80, FRAMES 4..7 HAMMER IK)",
            [(f"0{i + 4}:HAMMER{i}", gorran_frames[i + 4]) for i in range(4)],
        ),
        (
            "COMPARACAO 1:1 COM HERO_LIVING (80X80 REAL, FOOT_Y=76)",
            [
                ("HERO_LIVING (80X80)", hero_f0),
                ("MESTRE (80X80)", master_frames[0]),
                ("LYRA (80X80)", lyra_frames[0]),
                ("GORRAN (80X80)", gorran_frames[0]),
            ],
        ),
    ]

    total_w = cols * cell_w + (cols + 1) * pad
    row_block_h = sec_h + hdr_h + cell_h + pad
    total_h = len(rows_spec) * row_block_h + pad

    cv = Canvas(total_w, total_h, (16, 18, 26, 255))

    for r_idx, (sec_title, items) in enumerate(rows_spec):
        y_sec = pad + r_idx * row_block_h
        fill_rect(cv, pad, y_sec, total_w - pad - 1, y_sec + sec_h - 4, (28, 33, 46, 255))
        draw_text(cv, pad + 10, y_sec + 6, sec_title, (240, 208, 138, 255), scale=2)

        y_hdr = y_sec + sec_h
        y_cell = y_hdr + hdr_h

        for c_idx, (label, frame) in enumerate(items):
            x_cell = pad + c_idx * (cell_w + pad)
            fill_rect(cv, x_cell, y_hdr, x_cell + cell_w - 1, y_cell - 1, (24, 28, 40, 255))
            draw_text(cv, x_cell + 8, y_hdr + 5, label, (224, 232, 244, 255), scale=2)

            for ty in range(0, cell_h, 24):
                for tx in range(0, cell_w, 24):
                    chk = ((tx // 24) + (ty // 24)) % 2 == 0
                    col = (34, 40, 54, 255) if chk else (42, 49, 66, 255)
                    fill_rect(cv, x_cell + tx, y_cell + ty, min(x_cell + cell_w - 1, x_cell + tx + 23), min(y_cell + cell_h - 1, y_cell + ty + 23), col)

            # Linha guia dourada de base dos pes (FOOT_Y = 76)
            foot_line_y = y_cell + FOOT_Y * scale
            fill_rect(cv, x_cell, foot_line_y, x_cell + cell_w - 1, foot_line_y + 1, (204, 164, 74, 160))

            cv.composite(frame.scale_nearest(scale), x_cell, y_cell)

    return cv


def write_manifest() -> None:
    manifest = {
        "sprites": {
            "npc_weapon_master": {
                "key": "npc_weapon_master",
                "file": "npc_weapon_master.png",
                "width": FW * 4,
                "height": FH,
                "frameWidth": FW,
                "frameHeight": FH,
                "frames": ["idle0", "idle1", "idle2", "idle3"],
            },
            "npc_lyra": {
                "key": "npc_lyra",
                "file": "npc_lyra.png",
                "width": FW * 4,
                "height": FH,
                "frameWidth": FW,
                "frameHeight": FH,
                "frames": ["idle0", "idle1", "idle2", "idle3"],
            },
            "npc_gorran": {
                "key": "npc_gorran",
                "file": "npc_gorran.png",
                "width": FW * 8,
                "height": FH,
                "frameWidth": FW,
                "frameHeight": FH,
                "frames": [
                    "idle0",
                    "idle1",
                    "idle2",
                    "idle3",
                    "hammer0",
                    "hammer1",
                    "hammer2",
                    "hammer3",
                ],
            },
        }
    }
    OUT_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    OUT_MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    base_cv = read_png(HERO_BASE_PATH)
    base_parts = extract_hero_parts(base_cv, LIVING_THEME)

    master_parts = build_master_parts(base_parts)
    lyra_parts = build_lyra_parts(base_parts)
    gorran_parts = build_gorran_parts(base_parts)

    master_frames = [render_weapon_master_frame(i, master_parts) for i in range(4)]
    lyra_frames = [render_lyra_frame(i, lyra_parts) for i in range(4)]
    gorran_frames = [render_gorran_frame(i, gorran_parts) for i in range(8)]

    master_sheet = build_sheet(master_frames)
    lyra_sheet = build_sheet(lyra_frames)
    gorran_sheet = build_sheet(gorran_frames)

    write_png(OUT_SPRITES / "npc_weapon_master.png", master_sheet)
    write_png(OUT_SPRITES / "npc_lyra.png", lyra_sheet)
    write_png(OUT_SPRITES / "npc_gorran.png", gorran_sheet)
    write_manifest()

    preview = build_preview(master_frames, lyra_frames, gorran_frames)
    write_png(OUT_PREVIEW, preview)

    print(f"OK npc_weapon_master.png: {master_sheet.w}x{master_sheet.h} (4f {FW}x{FH})")
    print(f"OK npc_lyra.png:          {lyra_sheet.w}x{lyra_sheet.h} (4f {FW}x{FH})")
    print(f"OK npc_gorran.png:        {gorran_sheet.w}x{gorran_sheet.h} (8f {FW}x{FH})")
    print(f"OK manifest:              {OUT_MANIFEST.relative_to(ROOT)}")
    print(f"OK preview:               {OUT_PREVIEW.relative_to(ROOT)} ({preview.w}x{preview.h})")


if __name__ == "__main__":
    main()
