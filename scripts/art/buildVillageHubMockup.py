"""
SUBMUNDO - Mockup estatico 960x540 da Vila Natal (M9, BRF-151 / T-135)
======================================================================

Compoe `assets/mockups/mockup_m9_village_hub.png` (960x540) usando os assets
reais de T-133 e T-134 + heroi humano + HUD enxuto da Vila (Decisao #23):

- cenario: village_hub_tiles, village_hub_props, village_hub_house,
  village_hub_gate no zoom ingame 1.5x (pixel nearest);
- personagens reais: npc_lyra, npc_weapon_master, npc_gorran (hammer2 com
  faiscas) e hero_living escalado para casar com a altura real dos NPCs;
- iluminacao 2D crepuscular + halos quentes suaves na fogueira, forja,
  braseiro e tochas + vinheta sutil nas bordas;
- HUD enxuto da Vila (Arte 2D Dark Fantasy): retrato+HP+tracker "Falar com o
  Mestre" no topo esquerdo, joystick translucido no canto inferior esquerdo,
  minimapa circular + Inventario/Audio/Configuracoes no topo direito, botao
  circular "Interagir" com brilho dourado no canto inferior direito.

Python stdlib pura (reaproveita helpers de scripts/art/).
Uso: python scripts/art/buildVillageHubMockup.py
"""
from __future__ import annotations

import math
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))
from buildMonstersBase import Canvas, read_png  # noqa: E402
from buildDungeonBasic import (  # noqa: E402
    MOCKUPS_DIR,
    SPRITES_DIR,
    render_text_overlay,
    slice_sheet,
    text_item,
)
from buildMockupDungeonBasic import (  # noqa: E402
    DF,
    FONT_BODY,
    FONT_TITLE,
    TXT_GOLD,
    TXT_LIGHT,
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
    load_frames,
    metal_button,
    polygon,
    resize_area,
    ring,
    rounded_rect,
    stroke_poly,
)

OUT_PNG = MOCKUPS_DIR / "mockup_m9_village_hub.png"
SW, SH = 960, 540
ZOOM = 1.5
VIEW_X, VIEW_Y = 0.0, 12.0
T = 32
COLS, ROWS = 20, 12  # 640 x 384 px no mundo -> 960 x 540 na tela com zoom 1.5


def w2s(wx: float, wy: float) -> Tuple[float, float]:
    return ((wx - VIEW_X) * ZOOM, (wy - VIEW_Y) * ZOOM)


def visible_bbox_y(cv: Canvas) -> Tuple[int, int]:
    top, bot = cv.h, 0
    for y in range(cv.h):
        for x in range(cv.w):
            if cv.get(x, y)[3] > 20:
                if y < top:
                    top = y
                if y > bot:
                    bot = y
    return (top, bot) if bot >= top else (0, cv.h - 1)


def world_to_screen(world: Canvas) -> Canvas:
    scr = Canvas(SW, SH, (16, 18, 16, 255))
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


def village_vignette(x: int, y: int) -> float:
    nx = (x + 0.5 - SW / 2) / (SW / 2)
    ny = (y + 0.5 - SH * 0.52) / (SH / 2)
    d = math.sqrt(nx * nx * 0.82 + ny * ny * 1.05)
    t = min(1.0, max(0.0, (d - 0.58) / 0.58))
    return 1.0 - 0.40 * t * t * (3 - 2 * t)


def apply_village_light(scr: Canvas, lm: LightMap, mask: Optional[Canvas] = None,
                        sprite_mix: float = 0.55) -> None:
    buf = scr.buf
    for y in range(SH):
        for x in range(SW):
            i = y * SW + x
            o = i * 4
            lr, lg, lb = lm.r[i], lm.g[i], lm.b[i]
            if mask is not None and mask.buf[o + 3]:
                lr = 1.0 + (lr - 1.0) * sprite_mix if lr < 1.0 else 1.0 + (lr - 1.0) * 0.65
                lg = 1.0 + (lg - 1.0) * sprite_mix if lg < 1.0 else 1.0 + (lg - 1.0) * 0.65
                lb = 1.0 + (lb - 1.0) * sprite_mix if lb < 1.0 else 1.0 + (lb - 1.0) * 0.65
            v = village_vignette(x, y)
            buf[o] = min(255, int(buf[o] * lr * v))
            buf[o + 1] = min(255, int(buf[o + 1] * lg * v))
            buf[o + 2] = min(255, int(buf[o + 2] * lb * v))


def draw_contact_shadow(scr: Canvas, sx: float, sy: float, rx: float, ry: float, alpha: float = 0.46) -> None:
    for y in range(int(sy - ry - 1), int(sy + ry + 2)):
        for x in range(int(sx - rx - 1), int(sx + rx + 2)):
            d = math.hypot((x + 0.5 - sx) / rx, (y + 0.5 - sy) / ry)
            if d < 1.0:
                blend(scr, x, y, (8, 7, 10), alpha * (1.0 - d) ** 0.7)


# ---------------------------------------------------------------------------
# Terreno base 1:1 (640 x 384)
# ---------------------------------------------------------------------------

def build_ground(tiles: Dict[str, Canvas]) -> Canvas:
    world = Canvas(COLS * T, ROWS * T, (26, 36, 22, 255))
    dirt_cycle = ("dirt_0", "dirt_1", "dirt_2", "dirt_0", "dirt_1")
    trail_cells = {
        (11, 6), (12, 6), (12, 5), (13, 5), (13, 4), (14, 4),
        (13, 3), (14, 3), (13, 2), (14, 2), (13, 1), (14, 1), (13, 0), (14, 0),
    }
    cobble_cells = {(13, 4), (14, 3), (13, 2), (6, 5), (7, 5), (10, 6)}
    ash_cells = {(10, 7), (11, 7), (15, 7), (16, 7)}

    for r in range(ROWS):
        for c in range(COLS):
            h = (c * 31 + r * 17 + 7) % 5
            if (c, r) in ash_cells:
                name = "dirt_ash"
            elif (c, r) in cobble_cells:
                name = "dirt_cobble"
            elif (c, r) in trail_cells:
                name = "dirt_trail"
            elif r <= 1:
                name = "grass_0" if (c + r) % 2 == 0 else "grass_1"
            elif r == 2:
                if 13 <= c <= 14:
                    name = "dirt_trail"
                elif 4 <= c <= 16:
                    name = "dirt_grass_n"
                else:
                    name = "grass_0" if (c + r) % 2 == 0 else "grass_1"
            elif r == 10:
                if 3 <= c <= 16:
                    name = "dirt_grass_s"
                else:
                    name = "grass_1" if (c + r) % 2 == 0 else "grass_0"
            elif r == 11:
                name = "grass_0" if (c + r) % 2 == 0 else "grass_1"
            elif c <= 1 or c >= 18:
                name = "grass_0" if (c + r) % 2 == 0 else "grass_1"
            else:
                name = dirt_cycle[h]
            world.composite(tiles[name], c * T, r * T)
    return world


# ---------------------------------------------------------------------------
# Icones 2D extras (Exclamacao dourada e balao de dialogo do Interagir)
# ---------------------------------------------------------------------------

def draw_quest_exclamation(cv: Canvas, cx: float, cy: float) -> None:
    # Halo dourado suave atras do "!"
    add_glow(cv, cx, cy, 24, (255, 200, 70), 0.36)
    # Corpo do "!" (trapezio arredondado) com contorno escuro
    body_out = [(cx - 5.2, cy - 17.5), (cx + 5.2, cy - 17.5), (cx + 3.2, cy + 2.5), (cx - 3.2, cy + 2.5)]
    body_in = [(cx - 3.6, cy - 15.8), (cx + 3.6, cy - 15.8), (cx + 2.0, cy + 1.0), (cx - 2.0, cy + 1.0)]
    body_hi = [(cx - 2.1, cy - 14.2), (cx + 0.6, cy - 14.2), (cx + 0.1, cy - 2.0), (cx - 1.1, cy - 2.0)]
    polygon(cv, body_out, (42, 20, 6), 0.96)
    polygon(cv, body_in, (245, 185, 42), 1.0)
    polygon(cv, body_hi, (255, 240, 150), 0.92)
    # Ponto inferior
    disc(cv, cx, cy + 9.2, 4.4, (42, 20, 6), 0.96)
    disc(cv, cx, cy + 9.2, 2.9, (245, 185, 42), 1.0)
    disc(cv, cx - 0.7, cy + 8.5, 1.1, (255, 242, 165), 0.92)


def draw_chat_bubble_icon(cv: Canvas, cx: float, cy: float) -> None:
    """Icone 2D estilizado de balao de dialogo com 3 pontos (Interagir)."""
    bw, bh = 34, 23
    x0, y0 = cx - bw / 2, cy - bh / 2 - 2
    # Sombra
    rounded_rect(cv, x0 + 1, y0 + 2, bw, bh, 7, (12, 8, 6), 0.55)
    # Cauda do balao
    tail = [(cx - 8, y0 + bh - 2), (cx - 13, y0 + bh + 7), (cx - 1, y0 + bh - 1)]
    polygon(cv, [(p[0] + 1, p[1] + 2) for p in tail], (12, 8, 6), 0.55)
    polygon(cv, tail, (244, 224, 188), 0.98)
    # Corpo principal
    rounded_rect(cv, x0, y0, bw, bh, 7, (244, 224, 188), 0.98)
    # Brilho superior suave
    rounded_rect(cv, x0 + 2, y0 + 2, bw - 4, 6, 3, (255, 248, 232), 0.55)
    # 3 pontinhos internos
    for dx in (-8, 0, 8):
        disc(cv, cx + dx, y0 + bh / 2 + 0.5, 2.6, (58, 30, 22), 0.95)


# ---------------------------------------------------------------------------
# HUD Enxuto da Vila (Decisao #23)
# ---------------------------------------------------------------------------

def draw_village_hud(
    cv: Canvas,
    icons: List[Canvas],
    portraits: List[Canvas],
    texts: List[Dict[str, object]],
    positions: Dict[str, Tuple[float, float]],
) -> None:
    ICON = {"bag": 6, "settings": 7, "audio_on": 8}

    # --- 1. Canto superior esquerdo: Retrato + Nome + Nivel + HP ---
    pcx, pcy, pr = 46, 44, 32
    disc(cv, pcx, pcy + 2, pr + 3, (0, 0, 0), 0.52)
    disc(cv, pcx, pcy, pr, DF["recess"], 0.96)
    portrait = resize_area(portraits[0], (pr - 1) * 2, (pr - 1) * 2)
    draw_image(cv, portrait, pcx, pcy + 1, 1.0, pr - 2)
    ring(cv, pcx, pcy, pr + 1.5, 3.5, DF["metalDark"])
    ring(cv, pcx, pcy, pr, 2.2, DF["bronze"], 0.98)
    ring(cv, pcx, pcy, pr - 2, 1.0, DF["gold"], 0.78)
    for (dx, dy) in ((0, -pr), (pr, 0), (-pr, 0)):
        disc(cv, pcx + dx, pcy + dy, 2, DF["gold"], 0.96)
    bw, bh, by = 46, 15, pcy + pr + 1
    rounded_rect(cv, pcx - bw / 2, by - bh / 2, bw, bh, 4, DF["obsidian"], 0.96)
    stroke_poly(cv, chamfer_pts(pcx - bw / 2, by - bh / 2, bw, bh, 0), DF["gold"], 1.3, 0.95)
    texts.append(text_item("Nv. 1", pcx, by, 10.5, TXT_GOLD, FONT_BODY, True, "c"))

    bar_x, hp_y, hp_w, hp_h = 86, 32, 184, 18
    texts.append(text_item("GUERREIRO", 88, 18, 12.5, TXT_PARCH, FONT_TITLE, True, "l", (5, 7, 12, 230), 3))
    polygon(cv, chamfer_pts(bar_x, hp_y, hp_w, hp_h, 9), DF["recess"], 0.95)
    polygon(cv, chamfer_pts(bar_x + 1, hp_y + 1, hp_w - 2, hp_h - 2, 9), hexrgb(0xB91C1C), 0.98)
    polygon(cv, chamfer_pts(bar_x + 2, hp_y + 2, hp_w - 6, 6, 4), hexrgb(0xEF4444), 0.55)
    stroke_poly(cv, chamfer_pts(bar_x, hp_y, hp_w, hp_h, 9), DF["bronze"], 1.6, 0.98)
    stroke_poly(cv, chamfer_pts(bar_x - 1, hp_y - 1, hp_w + 2, hp_h + 2, 9), DF["metalDark"], 1.0, 0.92)
    texts.append(text_item("100/100", bar_x + hp_w * 0.48, hp_y + hp_h / 2, 11, (255, 247, 237), FONT_BODY, True,
                           "c", (5, 7, 12, 230), 2.5))

    # --- 2. Tracker de missao (abaixo do retrato) ---
    ox, oy = 16, 94
    # Fundo translucido bem sutil para garantir contraste sobre a palicada/grama
    rounded_rect(cv, ox - 4, oy - 3, 178, 46, 6, (10, 12, 18), 0.45)
    dcx, dcy = ox + 10, oy + 10
    polygon(cv, [(dcx, dcy - 6.2), (dcx + 6.2, dcy), (dcx, dcy + 6.2), (dcx - 6.2, dcy)], DF["gold"], 0.96)
    polygon(cv, [(dcx, dcy - 5), (dcx + 5, dcy), (dcx, dcy + 5), (dcx - 5, dcy)], DF["bronzeDark"], 0.95)
    polygon(cv, [(dcx, dcy - 3), (dcx + 3, dcy), (dcx, dcy + 3), (dcx - 3, dcy)], DF["goldBright"], 0.98)
    texts.append(text_item("Missão", ox + 24, oy + 10, 13, TXT_GOLD, FONT_TITLE, True, "l", (5, 7, 12, 230), 3))
    texts.append(text_item("Falar com o Mestre", ox + 24, oy + 27, 12, TXT_PARCH, FONT_BODY, False, "l",
                           (5, 7, 12, 235), 3))
    for x in range(ox, ox + 166):
        blend(cv, x, oy + 42, DF["gold"] if x < ox + 48 else DF["bronze"], 0.55)

    # --- 3. Canto superior direito: Minimapa circular da Vila ---
    mx, my, mr = SW - 58, 58, 45
    disc(cv, mx, my + 2, mr + 4, (0, 0, 0), 0.52)
    disc(cv, mx, my, mr, (18, 28, 22), 0.95)  # fundo floresta/grama

    # Clareira de terra no minimapa (recortada dentro do circulo)
    for y in range(int(my - mr + 2), int(my + mr - 1)):
        for x in range(int(mx - mr + 2), int(mx + mr - 1)):
            d = math.hypot(x + 0.5 - mx, y + 0.5 - my)
            if d > mr - 2:
                continue
            nx = (x - mx) / (mr * 0.78)
            ny = (y - my) / (mr * 0.72)
            # clareira oval + caminho para nordeste (portao)
            in_clearing = (nx * nx + ny * ny) < 0.92
            in_path = (nx > 0.15 and ny < 0.15 and abs((nx - 0.55) + (ny + 0.48)) < 0.32)
            if in_clearing or in_path:
                blend(cv, x, y, (68, 56, 44), 0.88)

    def mm(wx: float, wy: float) -> Tuple[float, float]:
        return (mx - 33 + (wx / (COLS * T)) * 66, my - 26 + (wy / (ROWS * T)) * 52)

    # Casa no minimapa
    hx0, hy0 = mm(155, 92)
    rounded_rect(cv, hx0, hy0, 14, 10, 1.5, (118, 92, 62), 0.92)
    # Portao no minimapa (nordeste)
    gx, gy = mm(456, 86)
    rounded_rect(cv, gx - 6, gy - 4, 12, 6, 1.0, (148, 163, 184), 0.95)
    # Fogueira
    fx, fy = mm(*positions["campfire"])
    disc(cv, fx, fy, 2.5, (249, 115, 22), 1.0)
    # NPCs
    for npc_key in ("lyra", "gorran"):
        nx_, ny_ = mm(*positions[npc_key])
        disc(cv, nx_, ny_, 2.3, (74, 222, 128), 0.95)
    # Mestre (missao ativa = dourado)
    wmx, wmy = mm(*positions["master"])
    disc(cv, wmx, wmy, 3.0, (250, 204, 21), 1.0)
    # Heroi
    px, py = mm(*positions["hero"])
    polygon(cv, [(px, py - 4.0), (px + 3.4, py + 3.0), (px - 3.4, py + 3.0)], (56, 189, 248), 1.0)

    ring(cv, mx, my, mr + 1.5, 3.5, DF["metalDark"])
    ring(cv, mx, my, mr, 2.2, DF["bronze"], 0.98)
    ring(cv, mx, my, mr - 2, 1.0, DF["gold"], 0.65)
    for ang in (0, 90, 180, 270):
        a = math.radians(ang)
        disc(cv, mx + mr * math.cos(a), my + mr * math.sin(a), 2, DF["gold"], 0.96)
    texts.append(text_item("N", mx, my - mr + 8, 8, TXT_GOLD, FONT_TITLE, True, "c", (5, 7, 12, 220), 2))

    # --- 4. 3 botoes circulares compactos: Inventario, Audio e Configuracoes ---
    ur, row_y, right_x, gap = 17, 126, SW - 32, 54
    btns = [
        (right_x - gap * 2, "bag", "Inventário", DF["gold"]),
        (right_x - gap, "audio_on", "Áudio", DF["bronze"]),
        (right_x, "settings", "Config.", DF["bronze"]),
    ]
    for bx, ikey, label, accent in btns:
        metal_button(cv, bx, row_y, ur, accent)
        draw_image(cv, resize_area(icons[ICON[ikey]], 20, 20), bx, row_y)
        texts.append(text_item(label, bx, row_y + ur + 9, 9.2, TXT_PARCH, FONT_BODY, False, "c",
                               (5, 7, 12, 235), 2.8))

    # --- 5. Canto inferior esquerdo: Joystick virtual translucido ---
    jx, jy, jr = 96, SH - 96, 52
    disc(cv, jx, jy, jr, (8, 10, 16), 0.36)
    ring(cv, jx, jy, jr, 2.0, (110, 124, 145), 0.45)
    ring(cv, jx, jy, jr - 4, 1.0, DF["bronze"], 0.28)
    ring(cv, jx, jy, round(jr * 0.44), 1.4, (110, 124, 145), 0.36)
    for (ddx, ddy) in ((0, -1), (1, 0), (0, 1), (-1, 0)):
        ax, ay = jx + ddx * 36, jy + ddy * 36
        px_, py_ = -ddy, ddx
        tip = (ax + ddx * 6, ay + ddy * 6)
        b1 = (ax - ddx * 4 + px_ * 6.5, ay - ddy * 4 + py_ * 6.5)
        b2 = (ax - ddx * 4 - px_ * 6.5, ay - ddy * 4 - py_ * 6.5)
        polygon(cv, [tip, b1, b2], (203, 213, 225), 0.55)
    disc(cv, jx, jy, 17, (30, 35, 46), 0.62)
    ring(cv, jx, jy, 17, 1.6, DF["bronze"], 0.72)
    ring(cv, jx, jy, 11, 1.0, (100, 116, 139), 0.42)

    # --- 6. Canto inferior direito: Apenas botao circular principal "Interagir" ---
    ix, iy, ir = SW - 84, SH - 88, 42
    # Brilho dourado suave indicando NPC/ponto interativo por perto
    add_glow(cv, ix, iy, ir + 26, (250, 195, 78), 0.34)
    disc(cv, ix, iy + 3, ir + 4, (0, 0, 0), 0.52)
    disc(cv, ix, iy, ir, hexrgb(0x4A1D19), 0.95)
    disc(cv, ix, iy - 6, ir - 8, hexrgb(0x7A3224), 0.42)
    ring(cv, ix, iy, ir + 1.8, 3.6, DF["metalDark"], 0.98)
    ring(cv, ix, iy, ir, 2.6, DF["gold"], 0.98)
    ring(cv, ix, iy, ir - 3.2, 1.3, DF["goldBright"], 0.85)
    draw_chat_bubble_icon(cv, ix, iy - 10)
    texts.append(text_item("Interagir", ix, iy + 20, 10.8, TXT_PARCH, FONT_TITLE, True, "c", (7, 9, 14, 245), 3.0))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    tiles = load_frames("village_hub_tiles")
    props = load_frames("village_hub_props")
    house = load_frames("village_hub_house")["house"]
    gate = load_frames("village_hub_gate")["gate"]
    npc_master = load_frames("npc_weapon_master")["idle0"]
    npc_lyra = load_frames("npc_lyra")["idle0"]
    npc_gorran = load_frames("npc_gorran")["hammer2"]
    hero_living = load_frame_index("hero_living", 0)

    # Calcula escala exata do heroi (80x80) para casar com a altura dos NPCs (48x48)
    m_top, m_bot = visible_bbox_y(npc_master)
    h_top, h_bot = visible_bbox_y(hero_living)
    npc_world_scale = 1.15
    hero_world_scale = npc_world_scale * ((m_bot - m_top) / max(1, (h_bot - h_top)))

    # 1. Terreno 1:1 -> tela 960x540 (nearest)
    world = build_ground(tiles)
    scr = world_to_screen(world)

    # 2. Lista de objetos de cena ordenados por Y da base (y_sort)
    # Formato: (y_sort, kind, sprite, wx, wy, world_scale, flip, shadow_params, is_actor)
    scene_items: List[Tuple[float, str, Canvas, float, float, float, bool, Optional[Tuple[float, float, float]], bool]] = []

    # Palicada ao fundo-norte (entre a casa e o portao, continua ate o pilar do portao)
    for col in range(9, 12):
        wx = col * T + 16
        scene_items.append((102, "prop", props["palisade_h"], wx, 86, 1.0, False, None, False))

    # Palicada lado esquerdo (atras do Mestre de Armas)
    for row in range(4, 10):
        wy = row * T + 16
        fr = "palisade_corner_b" if row == 9 else "palisade_v_l"
        scene_items.append((wy + 14, "prop", props[fr], 44, wy, 1.0, False, None, False))

    # Palicada lado direito (abaixo do portao)
    for row in range(5, 10):
        wy = row * T + 16
        scene_items.append((wy + 14, "prop", props["palisade_v_r"], 596, wy, 1.0, False, None, False))

    # Palicada em primeiro plano (borda inferior central, continua sem vaos)
    for col in range(6, 14):
        wx = col * T + 16
        scene_items.append((354, "prop", props["palisade_h"], wx, 340, 1.08, False, None, False))
    scene_items.append((354, "prop", props["palisade_end"], 6 * T - 6, 340, 1.08, False, None, False))
    scene_items.append((354, "prop", props["palisade_end"], 14 * T + 6, 340, 1.08, False, None, False))

    # Casa de palha (fundo-esquerda)
    scene_items.append((178, "house", house, 198, 108, 1.02, False, None, False))

    # Portao de pedra com placa "SAIDA" (topo-direito, livre do minimapa)
    scene_items.append((160, "gate", gate, 444, 104, 1.0, False, None, False))

    # Props de ambiente
    scene_items.append((136, "prop", props["torch_post_1"], 348, 120, 1.05, False, (10, 4, 0.38), False))
    scene_items.append((174, "prop", props["wooden_cart"], 396, 158, 1.15, False, (18, 6, 0.42), False))
    scene_items.append((182, "prop", props["firewood"], 114, 170, 1.05, False, (14, 5, 0.40), False))
    scene_items.append((196, "prop", props["brazier_1"], 248, 180, 1.08, False, (12, 4.5, 0.42), False))
    scene_items.append((224, "prop", props["barrel"], 534, 208, 1.08, False, (12, 4.5, 0.42), False))
    scene_items.append((256, "prop", props["campfire_1"], 340, 238, 1.32, False, (22, 8, 0.45), False))
    scene_items.append((266, "prop", props["anvil"], 445, 250, 1.20, False, (15, 5.5, 0.45), False))
    scene_items.append((270, "prop", props["forge_1"], 514, 248, 1.38, False, (22, 7.5, 0.46), False))
    scene_items.append((288, "prop", props["cart_wheel"], 546, 276, 1.05, False, (12, 4.5, 0.36), False))
    scene_items.append((322, "prop", props["torch_post_2"], 226, 306, 1.12, False, (11, 4.5, 0.40), False))

    # Personagens
    pos_lyra = (206.0, 180.0)
    pos_master = (164.0, 234.0)
    pos_hero = (268.0, 240.0)
    pos_gorran = (464.0, 236.0)

    scene_items.append((pos_lyra[1] + 24, "npc", npc_lyra, pos_lyra[0], pos_lyra[1],
                        npc_world_scale, False, (15, 5.0, 0.46), True))
    scene_items.append((pos_master[1] + 24, "npc", npc_master, pos_master[0], pos_master[1],
                        npc_world_scale, False, (17, 5.5, 0.48), True))
    scene_items.append((pos_hero[1] + 24, "hero", hero_living, pos_hero[0], pos_hero[1] - 4,
                        hero_world_scale, True, (18, 5.8, 0.50), True))
    scene_items.append((pos_gorran[1] + 24, "npc", npc_gorran, pos_gorran[0], pos_gorran[1],
                        npc_world_scale, True, (17, 5.5, 0.48), True))

    actor_mask = Canvas(SW, SH)
    for y_sort, kind, spr, wx, wy, wscale, flip, shadow, is_actor in sorted(scene_items, key=lambda it: it[0]):
        sx, sy = w2s(wx, wy)
        if shadow is not None:
            srx, sry, sa = shadow
            foot_y = w2s(wx, y_sort)[1] - 2
            draw_contact_shadow(scr, sx, foot_y, srx, sry, sa)
        draw_sprite_scaled(scr, spr, sx, sy, wscale * ZOOM, flip, actor_mask if is_actor else None)

    # 3. Iluminacao 2D crepuscular + fontes quentes
    lm = LightMap((0.64, 0.62, 0.70))
    # Fogueira central
    cfx, cfy = w2s(340, 234)
    lm.add(cfx, cfy + 8, 250, (1.0, 0.64, 0.24), 0.72, 0.80)
    # Forja acesa
    fgx, fgy = w2s(514, 240)
    lm.add(fgx, fgy, 200, (1.0, 0.52, 0.18), 0.68, 0.85)
    # Braseiro junto a casa
    brx, bry = w2s(248, 174)
    lm.add(brx, bry, 140, (1.0, 0.62, 0.25), 0.50, 0.85)
    # Tochas
    t1x, t1y = w2s(348, 110)
    t2x, t2y = w2s(226, 296)
    lm.add(t1x, t1y + 10, 125, (1.0, 0.62, 0.25), 0.48, 0.85)
    lm.add(t2x, t2y + 10, 130, (1.0, 0.62, 0.25), 0.50, 0.85)
    apply_village_light(scr, lm, actor_mask, 0.52)

    # 4. Halos aditivos suaves nas chamas e faiscas do Gorran
    add_glow(scr, cfx, cfy - 4, 34, (255, 205, 95), 0.55)
    add_glow(scr, cfx, cfy + 2, 95, (245, 135, 38), 0.22, 0.78)
    add_glow(scr, fgx, fgy - 6, 30, (255, 175, 65), 0.50)
    add_glow(scr, fgx, fgy, 78, (240, 110, 30), 0.20, 0.80)
    # Faiscas do martelo do Gorran sobre a bigorna
    spx, spy = w2s(449, 240)
    add_glow(scr, spx, spy, 20, (255, 225, 110), 0.45)
    add_glow(scr, brx, bry - 6, 22, (255, 195, 85), 0.45)
    add_glow(scr, brx, bry, 54, (240, 130, 35), 0.16)
    add_glow(scr, t1x, t1y - 4, 18, (255, 200, 90), 0.48)
    add_glow(scr, t2x, t2y - 4, 20, (255, 200, 90), 0.52)

    # 5. Icone "!" dourado acima do Mestre de Armas + rotulos dos NPCs
    texts: List[Dict[str, object]] = []
    msx, msy = w2s(pos_master[0], pos_master[1] - 35)
    draw_quest_exclamation(scr, msx, msy - 28)
    texts.append(text_item("Mestre de Armas", msx, msy + 1, 11.5, TXT_GOLD, FONT_BODY, True, "c",
                           (5, 7, 12, 240), 3.0))

    lsx, lsy = w2s(pos_lyra[0], pos_lyra[1] - 31)
    texts.append(text_item("Lyra", lsx, lsy + 2, 11.5, TXT_PARCH, FONT_BODY, True, "c",
                           (5, 7, 12, 240), 3.0))

    gsx, gsy = w2s(pos_gorran[0], pos_gorran[1] - 32)
    texts.append(text_item("Gorran", gsx, gsy + 2, 11.5, TXT_PARCH, FONT_BODY, True, "c",
                           (5, 7, 12, 240), 3.0))

    # 6. HUD Enxuto da Vila
    icons = slice_sheet(read_png(SPRITES_DIR / "ui_icons.png"), 64, 64)
    portraits = slice_sheet(read_png(SPRITES_DIR / "portraits.png"), 128, 128)
    positions = {
        "campfire": (340.0, 238.0),
        "lyra": pos_lyra,
        "master": pos_master,
        "hero": pos_hero,
        "gorran": pos_gorran,
    }
    draw_village_hud(scr, icons, portraits, texts, positions)

    for i in range(SW * SH):
        scr.buf[i * 4 + 3] = 255
    render_text_overlay(scr, texts, OUT_PNG)
    print(f"Gerado: {OUT_PNG} ({SW}x{SH})")


if __name__ == "__main__":
    main()
