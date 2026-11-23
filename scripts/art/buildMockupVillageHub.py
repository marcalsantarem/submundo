"""
SUBMUNDO - Mockup estatico da Vila Natal / hub do prologo (M9, T-135)
======================================================================

Monta `assets/mockups/mockup_m9_village.png` (960x540) simulando uma captura do jogo,
seguindo a composicao de `assets/mockups/ref_m9_village_hub.jpg` (decisao #23):

- cenario: folhas `village_hub_*` (scripts/art/buildVillageHub.py), tile 32 px 1:1 no mundo,
  camera com zoom 1.45 e nearest (como buildMockupDungeonBasic.py). Mapa de 32x13 tiles
  (~1,5 tela de largura); a camera mostra a metade direita (encostada na borda leste).
- atores: hero_living frame 0 e NPCs da T-134 (village_npc_*), setScale 0.88 -> 0.88 x 1.45 na tela;
  Gorran no frame de impacto do `hammer` (11) sobre a bigorna, com faisca.
- luz quente de fim de tarde + halos da fogueira, forja, braseiro, tochas e janelas; vinheta.
- HUD da vila: retrato + HP, tracker "Falar com o Mestre", minimapa, AUTO/Inventario/Audio/Configuracoes,
  joystick e o botao grande "Interagir" (sem skills, pocoes, esquiva, moedas, Loja, Passe ou chat).

Uso: py scripts/art/buildMockupVillageHub.py   (requer Pillow; textos via System.Drawing como no M8)
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from buildMonstersBase import Canvas, read_png  # noqa: E402
from buildDungeonBasic import render_text_overlay, slice_sheet, text_item  # noqa: E402
import buildMockupDungeonBasic as MD  # noqa: E402
from buildMockupDungeonBasic import (  # noqa: E402
    DF, FONT_BODY, FONT_TITLE, TXT_GOLD, TXT_LIGHT, TXT_MUTED, TXT_PARCH,
    LightMap, add_glow, apply_light, blend, chamfer_pts, disc, draw_image, hexrgb, metal_button,
    polygon, resize_area, ring, rounded_rect, stroke_poly,
)
import buildVillageHub as VH  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SPRITES = ROOT / "public" / "assets" / "sprites"
OUT_PNG = ROOT / "assets" / "mockups" / "mockup_m9_village.png"
NPC_MANIFEST = Path(__file__).resolve().parent / "out" / "village_npcs.manifest.json"
HUB_MANIFEST = Path(__file__).resolve().parent / "out" / "village_hub.manifest.json"

SW, SH = 960, 540
ZOOM = 1.45
ACTOR_SCALE = 0.88
T = 32
COLS, ROWS = 32, 13
MAP_W, MAP_H = COLS * T, ROWS * T
VIEW_W, VIEW_H = SW / ZOOM, SH / ZOOM
VIEW_X, VIEW_Y = MAP_W - VIEW_W, 10.0

# Layout no mundo (px). Palicada: topo y=144, leste x=1008, base y=380.
TOP_Y, EAST_X, BOT_Y = 144, 1008, 380
GATE_X = 831
HERO = (672, 244)
MASTER = (524, 251)
LYRA = (569, 207)
GORRAN = (886, 231)
CAMPFIRE = (752, 262)
FORGE = (945, 217)
BRAZIER = (614, 195)
HOUSE = (590, 165)


def w2s(wx: float, wy: float) -> Tuple[float, float]:
    return ((wx - VIEW_X) * ZOOM, (wy - VIEW_Y) * ZOOM)


def load_sheet(manifest: Path, key: str) -> Tuple[Image.Image, Dict]:
    e = json.loads(manifest.read_text(encoding="utf-8"))["sprites"][key]
    return Image.open(SPRITES / e["file"]).convert("RGBA"), e


def frame(manifest: Path, key: str, name_or_idx) -> Tuple[Image.Image, Dict]:
    img, e = load_sheet(manifest, key)
    i = e["frames"].index(name_or_idx) if isinstance(name_or_idx, str) else name_or_idx
    fw, fh = e["frameWidth"], e["frameHeight"]
    return img.crop((i * fw, 0, i * fw + fw, fh)), e


# ---------------------------------------------------------------------------
# Chao (tiles por Wang de cantos)
# ---------------------------------------------------------------------------

def build_ground() -> Image.Image:
    tiles, e = load_sheet(HUB_MANIFEST, "village_hub_tiles")
    idx = {n: i for i, n in enumerate(e["frames"])}
    V = [[1] * (COLS + 1) for _ in range(ROWS + 1)]
    for r in range(ROWS + 1):
        for c in range(COLS + 1):
            if 5 <= r <= 11 and 1 <= c <= 31:
                V[r][c] = 0
            if r == 4 and 3 <= c <= 30 and VH.h01(c, r, 5) > 0.3:
                V[r][c] = 0
            if r == 12 and 6 <= c <= 28 and VH.h01(c, r, 6) > 0.35:
                V[r][c] = 0
    for (r, c) in ((5, 14), (5, 15), (11, 17), (11, 18), (10, 18), (6, 30), (7, 30), (10, 22)):
        V[r][c] = 1
    for r in range(0, 6):                       # caminho saindo pelo portao
        for c in (25, 26, 27):
            V[r][c] = 0
    img = Image.new("RGBA", (MAP_W, MAP_H))
    for r in range(ROWS):
        for c in range(COLS):
            b = (V[r][c], V[r][c + 1], V[r + 1][c], V[r + 1][c + 1])
            if b == (0, 0, 0, 0):
                hs = VH.h01(c, r, 77)
                if c in (25, 26) and r <= 5:
                    n = "path_v"
                else:
                    n = ("dirt_0", "dirt_1", "dirt_2", "dirt_3", "dirt_0", "dirt_2", "dirt_pebbles",
                         "dirt_tufts", "dirt_cracks", "dirt_damp", "dirt_tufts", "dirt_1")[int(hs * 12)]
            elif b == (1, 1, 1, 1):
                n = ("grass_0", "grass_1", "grass_2", "grass_0", "grass_flowers", "grass_tall",
                     "grass_tall")[int(VH.h01(c, r, 78) * 7)]
            else:
                n = "edge_%d%d%d%d" % b
            i = idx[n]
            img.alpha_composite(tiles.crop((i * T, 0, i * T + T, T)), (c * T, r * T))
    return img


# ---------------------------------------------------------------------------
# Objetos (mundo) -> desenhados direto na tela, ordenados pelos pes
# ---------------------------------------------------------------------------

def scene_objects() -> List[Tuple[str, str, object, float, float]]:
    """(manifest, key, frame, x_mundo, y_mundo_dos_pes)"""
    H = HUB_MANIFEST
    o: List[Tuple[str, str, object, float, float]] = []
    for c in range(0, COLS):
        x = c * T + 16
        if 24 <= c <= 27 or c == 31:
            continue
        o.append((H, "village_hub_palisade", ("h_0", "h_1", "h_1", "h_broken", "h_0")[c % 5], x, TOP_Y))
    o.append((H, "village_hub_palisade", "corner", EAST_X, TOP_Y))
    for y in range(TOP_Y + 32, BOT_Y, 32):
        o.append((H, "village_hub_palisade", "v_0" if (y // 32) % 2 else "v_1", EAST_X, y))
    for c in range(11, 31):
        o.append((H, "village_hub_palisade", ("h_1", "h_0", "h_broken", "h_0")[c % 4], c * T + 16, BOT_Y))
    o.append((H, "village_hub_palisade", "corner", EAST_X, BOT_Y))
    o.append((H, "village_hub_palisade", "post", 10 * T + 22, BOT_Y))
    for (x, y) in ((392, 330), (412, 342), (436, 352)):   # estacas afiadas no primeiro plano (esquerda)
        o.append((H, "village_hub_palisade", "spikes", x, y))
    o.append((H, "village_hub_gate", "gate_open", GATE_X, TOP_Y + 4))
    o.append((H, "village_hub_house", "house", *HOUSE))
    o.append((H, "village_hub_campfire", "campfire_2", *CAMPFIRE))
    o.append((H, "village_hub_forge", "forge_2", *FORGE))
    o.append((H, "village_hub_brazier", "brazier_1", *BRAZIER))
    for i, (x, y) in enumerate(((500, TOP_Y + 6), (686, TOP_Y + 6), (744, TOP_Y + 8), (918, TOP_Y + 8),
                                (520, 352), (760, 362))):
        o.append((H, "village_hub_torch", "torch_%d" % (i % 4), x, y))
    o.append((H, "village_hub_cart", "cart", 714, 160))
    o.append((H, "village_hub_props", "crate", 668, 150))
    o.append((H, "village_hub_props", "sacks", 770, 168))
    o.append((H, "village_hub_props", "firewood", 412, 190))
    o.append((H, "village_hub_props", "weapon_rack", 462, 238))
    o.append((H, "village_hub_props", "herb_rack", 478, 186))
    o.append((H, "village_hub_props", "pots", 655, 174))
    o.append((H, "village_hub_props", "barrel", 978, 252))
    o.append((H, "village_hub_props", "barrel", 990, 270))
    o.append((H, "village_hub_props", "bucket", 912, 290))
    o.append((H, "village_hub_props", "bench", 700, 316))
    # bigorna sob o ponto de impacto do martelo do Gorran (face da bigorna = 36 px acima dos pes)
    _, ge = frame(NPC_MANIFEST, "village_npc_gorran", 11)
    imp = ge["hammerImpact"]
    ix, iy = GORRAN[0] + imp["dx"] * ACTOR_SCALE, GORRAN[1] + imp["dy"] * ACTOR_SCALE
    o.append((H, "village_hub_props", "anvil", ix + 1, iy + 36))
    return o


def actors() -> List[Tuple[str, Path, str, int, float, float, bool]]:
    hero_path = SPRITES / "hero_living.png"
    return [
        ("hero", hero_path, "", 0, *HERO, False),
        ("master", NPC_MANIFEST, "village_npc_master", 0, *MASTER, False),
        ("lyra", NPC_MANIFEST, "village_npc_lyra", 2, *LYRA, False),
        ("gorran", NPC_MANIFEST, "village_npc_gorran", 11, *GORRAN, False),
    ]


def paste_scaled(scr: Image.Image, im: Image.Image, ox: float, oy: float, fx: float, fy: float, k: float,
                 mask: Image.Image = None) -> None:
    """Desenha `im` com o ponto (fx, fy) do frame no ponto de tela (ox, oy), escala k, nearest."""
    w, h = max(1, round(im.width * k)), max(1, round(im.height * k))
    big = im.resize((w, h), Image.NEAREST)
    x, y = round(ox - fx * k), round(oy - fy * k)
    if x >= SW or y >= SH or x + w <= 0 or y + h <= 0:
        return
    layer = Image.new("RGBA", scr.size)
    layer.paste(big, (x, y))
    scr.alpha_composite(layer)
    if mask is not None:
        a = big.getchannel("A").point(lambda v: 255 if v else 0)
        mask.paste(255, (x, y), a)


def contact_shadow(scr: Image.Image, sx: float, sy: float, rx: float, ry: float, a: float = 0.5) -> None:
    px = scr.load()
    for y in range(int(sy - ry), int(sy + ry) + 1):
        for x in range(int(sx - rx), int(sx + rx) + 1):
            d = math.hypot((x + 0.5 - sx) / rx, (y + 0.5 - sy) / ry)
            if d < 1 and 0 <= x < SW and 0 <= y < SH:
                r, g, b, al = px[x, y]
                f = a * (1 - d) ** 0.6
                px[x, y] = (int(r * (1 - f)), int(g * (1 - f)), int(b * (1 - f)), al)


def build_scene() -> Tuple[Image.Image, Image.Image, Dict[str, Tuple[float, float]]]:
    ground = build_ground()
    scr = ground.resize((SW, SH), Image.NEAREST, box=(VIEW_X, VIEW_Y, VIEW_X + VIEW_W, VIEW_Y + VIEW_H))
    scr = scr.convert("RGBA")
    mask = Image.new("L", (SW, SH), 0)
    items = []
    for (man, key, fr, x, y) in scene_objects():
        im, e = frame(man, key, fr)
        o = e.get("origin", {"x": 0.5, "y": 0.95})
        items.append((y, "obj", im, x, y, o["x"] * e["frameWidth"], o["y"] * e["frameHeight"], ZOOM))
    heads: Dict[str, Tuple[float, float]] = {}
    for (name, path, key, idx, x, y, flip) in actors():
        if key:
            im, _ = frame(path, key, idx)
        else:
            sheet = Image.open(path).convert("RGBA")
            im = sheet.crop((idx * 80, 0, idx * 80 + 80, 80))
        if flip:
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        bb = im.getbbox()
        heads[name] = (x, y - (76 - bb[1]) * ACTOR_SCALE)
        items.append((y + 0.1, "actor", im, x, y, 40, 76, ACTOR_SCALE * ZOOM))
    for (_, kind, im, x, y, fx, fy, k) in sorted(items, key=lambda t: t[0]):
        sx, sy = w2s(x, y)
        if kind == "actor":
            contact_shadow(scr, sx + 2, sy - 1, 19, 5.5, 0.55)
            paste_scaled(scr, im, sx, sy, fx, fy, k, mask)
        else:
            paste_scaled(scr, im, sx, sy, fx, fy, k)
    return scr, mask, heads


# ---------------------------------------------------------------------------
# HUD da vila
# ---------------------------------------------------------------------------

def speech_icon(cv: Canvas, cx: float, cy: float, s: float) -> None:
    rounded_rect(cv, cx - 15 * s, cy - 11 * s, 30 * s, 20 * s, 6 * s, (60, 46, 40), 0.9)
    rounded_rect(cv, cx - 14 * s, cy - 12 * s, 28 * s, 19 * s, 6 * s, TXT_PARCH, 0.97)
    polygon(cv, [(cx - 7 * s, cy + 5 * s), (cx - 1 * s, cy + 5 * s), (cx - 9 * s, cy + 13 * s)], TXT_PARCH, 0.97)
    for k in (-1, 0, 1):
        disc(cv, cx + k * 7 * s, cy - 2.5 * s, 2.2 * s, (92, 56, 40), 0.95)


def gear_icon(cv: Canvas, cx: float, cy: float, r: float) -> None:
    for k in range(8):
        a = k * math.pi / 4
        polygon(cv, [(cx + math.cos(a - 0.22) * r * 0.7, cy + math.sin(a - 0.22) * r * 0.7),
                     (cx + math.cos(a - 0.16) * r, cy + math.sin(a - 0.16) * r),
                     (cx + math.cos(a + 0.16) * r, cy + math.sin(a + 0.16) * r),
                     (cx + math.cos(a + 0.22) * r * 0.7, cy + math.sin(a + 0.22) * r * 0.7)], (203, 213, 225), 0.95)
    disc(cv, cx, cy, r * 0.72, (203, 213, 225), 0.95)
    disc(cv, cx, cy, r * 0.32, DF["inner"], 1.0)


def draw_hud(cv: Canvas, icons: List[Canvas], portraits: List[Canvas], texts: List[Dict[str, object]],
             heads: Dict[str, Tuple[float, float]]) -> None:
    ICON = {"bag": 6, "settings": 7, "audio_on": 8}
    # --- Retrato + HP ---
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
    texts.append(text_item("Nv. 3", pcx, by, 10.5, TXT_GOLD, FONT_BODY, True, "c"))
    bar_x, hp_y, hp_w, hp_h = 86, 30, 188, 18
    texts.append(text_item("JOVEM GUERREIRO", 88, 17, 12.5, TXT_PARCH, FONT_TITLE, True, "l", (5, 7, 12, 220), 3))
    polygon(cv, chamfer_pts(bar_x, hp_y, hp_w, hp_h, 9), DF["recess"], 0.95)
    polygon(cv, chamfer_pts(bar_x + 1, hp_y + 1, hp_w - 2, hp_h - 2, 9), hexrgb(0xB91C1C), 0.98)
    polygon(cv, chamfer_pts(bar_x + 2, hp_y + 2, hp_w - 6, 6, 4), hexrgb(0xEF4444), 0.55)
    stroke_poly(cv, chamfer_pts(bar_x, hp_y, hp_w, hp_h, 9), DF["bronze"], 1.6, 0.98)
    stroke_poly(cv, chamfer_pts(bar_x - 1, hp_y - 1, hp_w + 2, hp_h + 2, 9), DF["metalDark"], 1.0, 0.92)
    texts.append(text_item("100/100", bar_x + hp_w * 0.46, hp_y + hp_h / 2, 11, (255, 247, 237), FONT_BODY, True,
                           "c", (5, 7, 12, 230), 2.5))
    sec_y, sec_w, sec_h = 53, 154, 6
    polygon(cv, chamfer_pts(bar_x, sec_y, sec_w, sec_h, 4), DF["recess"], 0.92)
    polygon(cv, chamfer_pts(bar_x + 1, sec_y + 1, (sec_w - 2) * 0.35, sec_h - 2, 3), hexrgb(0xD97706), 0.95)
    stroke_poly(cv, chamfer_pts(bar_x, sec_y, sec_w, sec_h, 4), DF["metalBorder"], 1.0, 0.88)

    # --- Tracker da missao ---
    ox, oy = 16, 94
    dcx, dcy = ox + 10, oy + 10
    polygon(cv, [(dcx, dcy - 6.2), (dcx + 6.2, dcy), (dcx, dcy + 6.2), (dcx - 6.2, dcy)], DF["gold"], 0.96)
    polygon(cv, [(dcx, dcy - 5), (dcx + 5, dcy), (dcx, dcy + 5), (dcx - 5, dcy)], DF["bronzeDark"], 0.95)
    polygon(cv, [(dcx, dcy - 3), (dcx + 3, dcy), (dcx, dcy + 3), (dcx - 3, dcy)], DF["goldBright"], 0.98)
    texts.append(text_item("Vila Natal", ox + 24, oy + 10, 13, TXT_GOLD, FONT_TITLE, True, "l", (5, 7, 12, 220), 3))
    texts.append(text_item("Falar com o Mestre", ox + 24, oy + 26, 12, TXT_PARCH, FONT_BODY, False, "l",
                           (5, 7, 12, 220), 3))
    for x in range(ox, ox + 204):
        blend(cv, x, oy + 44, DF["gold"] if x < ox + 56 else DF["bronze"], 0.5)

    # --- Minimapa da vila ---
    mx, my, mr = SW - 60, 60, 46
    disc(cv, mx, my + 2, mr + 4, (0, 0, 0), 0.5)
    disc(cv, mx, my, mr, (10, 16, 26), 0.94)
    sx0, sy0, sw_, sh_ = mx - 34, my - 15, 68, 30

    def mm(wx: float, wy: float) -> Tuple[float, float]:
        return (sx0 + wx / MAP_W * sw_, sy0 + (wy - 100) / (BOT_Y - 100) * sh_)
    for y in range(int(sy0), int(sy0 + sh_)):
        for x in range(int(sx0), int(sx0 + sw_)):
            if math.hypot(x + 0.5 - mx, y + 0.5 - my) > mr - 3:
                continue
            edge = x in (int(sx0), int(sx0 + sw_) - 1) or y in (int(sy0), int(sy0 + sh_) - 1)
            blend(cv, x, y, (120, 96, 64) if edge else (52, 46, 40), 0.9)
    gx, gy = mm(GATE_X, TOP_Y)
    for y in range(int(gy) - 9, int(gy) + 1):
        for x in range(int(gx) - 3, int(gx) + 3):
            blend(cv, x, y, (70, 62, 52), 0.9)
    polygon(cv, [(gx - 4, gy - 1), (gx + 4, gy - 1), (gx, gy - 5)], (148, 163, 184), 0.8)
    hx_, hy_ = mm(*HOUSE)
    for y in range(int(hy_) - 3, int(hy_) + 1):
        for x in range(int(hx_) - 5, int(hx_) + 5):
            blend(cv, x, y, (170, 140, 80), 0.9)
    disc(cv, *mm(*CAMPFIRE), 1.8, (249, 115, 22), 1.0)
    disc(cv, *mm(*LYRA), 1.8, (134, 239, 172), 0.95)
    disc(cv, *mm(*GORRAN), 1.8, (134, 239, 172), 0.95)
    mxm, mym = mm(*MASTER)
    disc(cv, mxm, mym, 2.6, (250, 204, 21), 1.0)
    hx, hy = mm(*HERO)
    polygon(cv, [(hx + 4, hy), (hx - 3, hy - 3.5), (hx - 3, hy + 3.5)], (56, 189, 248), 1.0)
    ring(cv, mx, my, mr + 1.5, 3.5, DF["metalDark"])
    ring(cv, mx, my, mr, 2.2, DF["bronze"], 0.98)
    ring(cv, mx, my, mr - 2, 1.0, DF["gold"], 0.6)
    for ang in (0, 90, 180, 270):
        a = math.radians(ang)
        disc(cv, mx + mr * math.cos(a), my + mr * math.sin(a), 2, DF["gold"], 0.96)
    texts.append(text_item("N", mx, my - mr + 8, 8, TXT_GOLD, FONT_TITLE, True, "c", (5, 7, 12, 220), 2))
    texts.append(text_item("!", mxm, mym - 7, 9, (250, 204, 21), FONT_TITLE, True, "c", (5, 7, 12, 230), 2))

    # --- Botoes utilitarios: AUTO, Inventario, Audio, Configuracoes ---
    ur, row_y, right_x, gap = 18, 128, SW - 30, 48
    xs = [right_x - gap * 3, right_x - gap * 2, right_x - gap, right_x]
    metal_button(cv, xs[0], row_y, ur, DF["gold"])
    texts.append(text_item("AUTO", xs[0], row_y, 8.5, TXT_GOLD, FONT_TITLE, True, "c"))
    metal_button(cv, xs[1], row_y, ur, DF["gold"])
    draw_image(cv, resize_area(icons[ICON["bag"]], 20, 20), xs[1], row_y)
    metal_button(cv, xs[2], row_y, ur, DF["bronze"])
    draw_image(cv, resize_area(icons[ICON["audio_on"]], 20, 20), xs[2], row_y)
    metal_button(cv, xs[3], row_y, ur, DF["bronze"])
    draw_image(cv, resize_area(icons[ICON["settings"]], 20, 20), xs[3], row_y)
    for label, x in (("Inventário", xs[1]), ("Áudio", xs[2]), ("Config.", xs[3])):
        texts.append(text_item(label, x, row_y + ur + 9, 9, TXT_MUTED, FONT_BODY, False, "c", (5, 7, 12, 220), 2.5))

    # --- Joystick ---
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

    # --- Botao Interagir (no lugar do Ataque) ---
    ax, ay, ar = SW - 92, SH - 104, 42
    disc(cv, ax, ay, ar + 12, (249, 115, 22), 0.10)        # pulso: NPC ao alcance
    disc(cv, ax, ay + 3, ar + 4, (0, 0, 0), 0.5)
    disc(cv, ax, ay, ar, DF["crimsonFill"], 0.94)
    disc(cv, ax, ay - 6, ar - 8, (98, 36, 30), 0.35)
    ring(cv, ax, ay, ar + 1.5, 3.5, DF["metalDark"])
    ring(cv, ax, ay, ar, 2.4, hexrgb(0xE0763A), 0.98)
    ring(cv, ax, ay, ar - 3, 1.2, DF["gold"], 0.8)
    speech_icon(cv, ax, ay - 9, 1.0)
    texts.append(text_item("Interagir", ax, ay + 22, 13, TXT_PARCH, FONT_TITLE, True, "c", (7, 9, 14, 240), 3))

    # --- nomes sobre os NPCs e "!" do Mestre ---
    for key, label in (("master", "Mestre de Armas"), ("lyra", "Lyra"), ("gorran", "Gorran")):
        x, y = w2s(*heads[key])
        texts.append(text_item(label, x, y - 9, 12, (243, 230, 204), FONT_BODY, True, "c", (5, 7, 12, 235), 3))
    x, y = w2s(*heads["master"])
    ex, ey = x, y - 30                      # "!" amarelo de missao (desenhado, bem visivel)
    disc(cv, ex, ey, 22, (250, 204, 21), 0.12)
    for (grow, col) in ((2.2, (40, 22, 6)), (0.0, (250, 204, 21))):
        polygon(cv, [(ex - 5 - grow, ey - 20 - grow), (ex + 5 + grow, ey - 20 - grow), (ex + 2.4 + grow, ey + 4 + grow),
                     (ex - 2.4 - grow, ey + 4 + grow)], col, 1.0)
        disc(cv, ex, ey + 11, 3.6 + grow, col, 1.0)
    polygon(cv, [(ex - 3.5, ey - 18.5), (ex - 1, ey - 18.5), (ex - 1.2, ey + 1), (ex - 2, ey + 1)], (255, 241, 160), 0.9)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def pil_to_canvas(im: Image.Image) -> Canvas:
    cv = Canvas(im.width, im.height)
    cv.buf[:] = im.convert("RGBA").tobytes()
    return cv


def main() -> None:
    scr_img, mask_img, heads = build_scene()
    scr = pil_to_canvas(scr_img)
    mask = Canvas(SW, SH)
    mb = mask_img.tobytes()
    for i, v in enumerate(mb):
        if v:
            mask.buf[i * 4 + 3] = 255

    # --- luz de fim de tarde ---
    lm = LightMap((0.90, 0.79, 0.67))
    lm.add(SW * 0.25, -60, 620, (0.32, 0.22, 0.10), 1.0, 0.7)      # sol baixo vindo do alto a esquerda
    fx, fy = w2s(CAMPFIRE[0], CAMPFIRE[1] - 14)
    lm.add(fx, fy + 10, 250, (1.0, 0.58, 0.22), 0.95, 0.75)
    gx, gy = w2s(FORGE[0], FORGE[1] - 30)
    lm.add(gx, gy + 20, 170, (1.0, 0.5, 0.18), 0.8, 0.8)
    bx, by = w2s(BRAZIER[0], BRAZIER[1] - 26)
    lm.add(bx, by + 18, 140, (1.0, 0.6, 0.24), 0.7, 0.8)
    torches = [(500, TOP_Y + 6), (686, TOP_Y + 6), (744, TOP_Y + 8), (918, TOP_Y + 8), (520, 352), (760, 362)]
    for (tx, ty) in torches:
        sx, sy = w2s(tx, ty - 62)
        lm.add(sx, sy + 40, 120, (1.0, 0.62, 0.26), 0.6, 0.85)
    sx, sy = w2s(GATE_X, TOP_Y - 110)                                 # placa SAIDA (tochas do portao)
    lm.add(sx, sy, 130, (0.9, 0.6, 0.3), 0.55, 0.8)
    apply_light(scr, lm, mask, 0.55)

    # --- brilhos aditivos ---
    add_glow(scr, fx, fy - 6, 30, (255, 200, 90), 0.6)
    add_glow(scr, fx, fy + 8, 110, (245, 140, 40), 0.2, 0.7)
    add_glow(scr, gx, gy + 10, 26, (255, 180, 80), 0.45)
    add_glow(scr, gx, gy + 40, 26, (255, 150, 60), 0.35)
    add_glow(scr, bx, by - 6, 22, (255, 200, 90), 0.55)
    for (tx, ty) in torches:
        sx, sy = w2s(tx, ty - 62)
        add_glow(scr, sx, sy, 18, (255, 200, 90), 0.6)
        add_glow(scr, sx, sy + 6, 50, (245, 140, 40), 0.16)
    for wxo in (34 + 9, 124 + 9):                                     # janelas da casa
        sx, sy = w2s(HOUSE[0] - 88 + wxo, HOUSE[1] - 152 + 122)
        add_glow(scr, sx, sy, 26, (255, 170, 70), 0.3)
    # faisca do martelo do Gorran na bigorna
    _, ge = frame(NPC_MANIFEST, "village_npc_gorran", 11)
    imp = ge["hammerImpact"]
    ix, iy = w2s(GORRAN[0] + imp["dx"] * ACTOR_SCALE, GORRAN[1] + imp["dy"] * ACTOR_SCALE)
    add_glow(scr, ix, iy, 20, (255, 210, 120), 0.75)
    for k in range(9):
        a = math.radians(-160 + k * 20 + (7 if k % 2 else -5))
        L = 10 + (k * 7) % 13
        for s in range(int(L)):
            t = s / L
            px, py = ix + math.cos(a) * s, iy + math.sin(a) * s * 0.8 - 2
            blend(scr, int(px), int(py), (255, 244, 196) if t < 0.5 else (253, 186, 70), 0.95 * (1 - t * 0.6))
    disc(scr, ix, iy - 1, 2.5, (255, 250, 220), 1.0)

    # --- HUD ---
    texts: List[Dict[str, object]] = []
    icons = slice_sheet(read_png(SPRITES / "ui_icons.png"), 64, 64)
    portraits = slice_sheet(read_png(SPRITES / "portraits.png"), 128, 128)
    draw_hud(scr, icons, portraits, texts, heads)
    for i in range(SW * SH):
        scr.buf[i * 4 + 3] = 255
    render_text_overlay(scr, texts, OUT_PNG)
    print(f"Gerado: {OUT_PNG}")


if __name__ == "__main__":
    main()
