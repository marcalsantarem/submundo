"""
SUBMUNDO - Mockups 960x540 dos biomas de superficie (BRF-138 / T-131, grupo `surf_`)
=====================================================================================

Monta `assets/mockups/mockup_m8_<id>.png` para village, herb_field e village_grotto no mesmo padrao do
mockup aprovado da Masmorra Basica (buildMockupDungeonBasic.py): captura simulada do DungeonScene com
zoom 1.45 (nearest), atores reais (setScale 0.88), drop no chao, iluminacao do bioma e HUD paisagem.

Diferenca: o cenario e montado por AUTOTILE a partir de uma mascara de piso (mesma regra de
DB.autotile_sample / guia 3.3), mostrando a estrutura nova de mapa da decisao #20 (salas nao
retangulares, corredor que vira, portas laterais/seladas). Le os sheets `biome_<id>_*` gerados pelos
scripts surf_<id>.py (frames na ordem do contrato).

Uso: python scripts/art/biomes/surf_mockup.py [village|herb_field|village_grotto ...]
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Callable, Dict, List, Optional, Sequence, Tuple

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))
from buildMonstersBase import Canvas, read_png  # noqa: E402
import buildDungeonBasic as DB  # noqa: E402
import buildMockupDungeonBasic as MB  # noqa: E402
from buildMockupDungeonBasic import (  # noqa: E402
    DF, FONT_BODY, FONT_TITLE, TXT_GOLD, TXT_LIGHT, TXT_MUTED, TXT_PARCH, LightMap, add_glow, arc_fill, blend,
    chamfer_pts, disc, draw_image, draw_sprite_scaled, hexrgb, load_frame_index, metal_button, polygon,
    resize_area, ring, rounded_rect, stroke_poly,
)
from surf_common import OUT_DIR, h01  # noqa: E402

SW, SH = 960, 540
ZOOM = 1.45
ACTOR_SCALE = 0.88
LOOT_SCALE = 1.5
T = 32
SPRITES = DB.SPRITES_DIR
MOCKUPS = DB.MOCKUPS_DIR

RGB = Tuple[int, int, int]


# ---------------------------------------------------------------------------
# Carregamento dos sheets do bioma (pelo manifest gerado em out/<id>.manifest.json)
# ---------------------------------------------------------------------------

def load_biome(bid: str) -> Dict[str, Dict[str, Canvas]]:
    entries = json.loads((OUT_DIR / f"{bid}.manifest.json").read_text(encoding="utf-8"))["sprites"]
    out: Dict[str, Dict[str, Canvas]] = {}
    for kind in ("tiles", "doors", "props", "props_tall"):
        e = entries[f"biome_{bid}_{kind}"]
        frames = DB.slice_sheet(read_png(SPRITES / e["file"]), e["frameWidth"], e["frameHeight"])
        assert len(frames) == len(e["frames"])
        out[kind] = {n: frames[i] for i, n in enumerate(e["frames"])}
    return out


# ---------------------------------------------------------------------------
# Cena
# ---------------------------------------------------------------------------

class Scene:
    bid = ""
    rows: Sequence[str] = ()
    doors: Dict[Tuple[int, int], str] = {}
    north: Dict[Tuple[int, int], str] = {}
    view = (0.0, 0.0)
    floor_weights: Sequence[Tuple[str, float]] = (("floor_0", 1.0),)
    floor_special: Dict[Tuple[int, int], str] = {}
    face_override: Dict[Tuple[int, int], str] = {}
    wall_props: Sequence[Tuple[str, int, int]] = ()  # (frame, celula x, celula y) na linha da face
    flat_props: Sequence[Tuple[str, int, int]] = ()  # decalques/props de chao (px do mundo, canto sup-esq)
    tall_props: Sequence[Tuple[str, int, int]] = ()
    actors: Sequence[Tuple[str, int, int, bool, int]] = ()  # key, wx, wy (centro), flip, frame
    hero = (320, 240)
    loot = (2, 200, 300)  # frame, wx, wy
    loot_color: RGB = (249, 115, 22)
    loot_name = ""
    loot_text: RGB = (249, 115, 22)
    title = ""
    subtitle = ""
    ambient = (0.36, 0.37, 0.46)
    vignette_k = 0.72
    sprite_mix = 0.45
    bg: RGB = (9, 9, 11)

    def lights(self, lm: LightMap, w2s: Callable) -> None:
        pass

    def glows(self, scr: Canvas, w2s: Callable) -> None:
        pass

    def post(self, scr: Canvas, w2s: Callable) -> None:
        pass

    def combat(self, scr: Canvas, w2s: Callable, texts: List) -> None:
        pass

    def hp(self) -> Dict[int, float]:
        return {}


def pick_floor(scene: Scene, x: int, y: int) -> str:
    if (x, y) in scene.floor_special:
        return scene.floor_special[(x, y)]
    r = h01(x, y, 4242)
    acc = 0.0
    for name, w in scene.floor_weights:
        acc += w
        if r < acc:
            return name
    return scene.floor_weights[0][0]


def build_world(scene: Scene, sheets) -> Tuple[Canvas, set]:
    H = len(scene.rows)
    W = max(len(r) for r in scene.rows)
    floor = {(x, y) for y, r in enumerate(scene.rows) for x, ch in enumerate(r) if ch == "."}
    lay = DB.autotile_sample(W, H, floor, dict(scene.doors), dict(scene.north))
    world = Canvas(W * T, H * T, (*scene.bg, 255))
    sheet_of = {"tiles": sheets["tiles"], "doors": sheets["doors"]}
    for (x, y), layers in lay.items():
        for i, (sheet, name) in enumerate(layers):
            if i == 0 and name in ("floor_0", "floor_1", "floor_2", "floor_cracked", "floor_moss", "floor_blood"):
                name = pick_floor(scene, x, y)
            if i == 0 and (x, y) in scene.face_override and name.startswith("wall_face_") and "_end_" not in name:
                name = scene.face_override[(x, y)]
            frame = sheet_of[sheet].get(name) or sheet_of["doors"].get(name) or sheet_of["tiles"][name]
            world.composite(frame, x * T, y * T)
    for name, cx, cy in scene.wall_props:
        world.composite(sheets["props"][name], cx * T, cy * T)
    for name, x, y in scene.flat_props:
        world.composite(sheets["props"][name], x, y)
    for name, x, y in sorted(scene.tall_props, key=lambda p: p[2]):
        world.composite(sheets["props_tall"][name], x, y)
    return world, floor


def make_w2s(scene: Scene):
    vx, vy = scene.view

    def w2s(wx: float, wy: float) -> Tuple[float, float]:
        return ((wx - vx) * ZOOM, (wy - vy) * ZOOM)
    return w2s


def world_to_screen(world: Canvas, scene: Scene) -> Canvas:
    vx, vy = scene.view
    scr = Canvas(SW, SH, (*scene.bg, 255))
    xs = [int(math.floor(sx / ZOOM + vx)) for sx in range(SW)]
    for sy in range(SH):
        wy = int(math.floor(sy / ZOOM + vy))
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


def vignette(x: int, y: int, k: float) -> float:
    nx = (x + 0.5 - SW / 2) / (SW / 2)
    ny = (y + 0.5 - SH * 0.56) / (SH / 2)
    d = math.sqrt(nx * nx * 0.85 + ny * ny * 1.1)
    t = min(1.0, max(0.0, (d - 0.55) / 0.6))
    return 1.0 - k * t * t * (3 - 2 * t)


def apply_light(scr: Canvas, lm: LightMap, mask: Canvas, sprite_mix: float, vk: float) -> None:
    buf = scr.buf
    for y in range(SH):
        for x in range(SW):
            i = y * SW + x
            o = i * 4
            lr, lg, lb = lm.r[i], lm.g[i], lm.b[i]
            if mask.buf[o + 3]:
                lr = 1.0 + (lr - 1.0) * sprite_mix if lr < 1.0 else lr
                lg = 1.0 + (lg - 1.0) * sprite_mix if lg < 1.0 else lg
                lb = 1.0 + (lb - 1.0) * sprite_mix if lb < 1.0 else lb
            v = vignette(x, y, vk)
            buf[o] = min(255, int(buf[o] * lr * v))
            buf[o + 1] = min(255, int(buf[o + 1] * lg * v))
            buf[o + 2] = min(255, int(buf[o + 2] * lb * v))


def beam(scr: Canvas, lx: float, ly: float, col: RGB, height: int = 120, half: float = 9.0) -> None:
    for y in range(int(ly - height), int(ly + 4)):
        t = min(1.0, (ly - y) / height)
        for x in range(int(lx - half), int(lx + half + 1)):
            d = abs(x + 0.5 - lx) / half
            f = max(0.0, 1 - d) ** 1.6 * (1 - max(0.0, t)) ** 1.3 * 0.85
            if 0 <= y < SH and 0 <= x < SW and f > 0:
                o = (y * SW + x) * 4
                scr.buf[o] = min(255, int(scr.buf[o] + col[0] * f))
                scr.buf[o + 1] = min(255, int(scr.buf[o + 1] + col[1] * f))
                scr.buf[o + 2] = min(255, int(scr.buf[o + 2] + col[2] * f))


# ---------------------------------------------------------------------------
# HUD (mesmo layout do mockup aprovado; titulo, objetivo e minimapa por cena)
# ---------------------------------------------------------------------------

def draw_hud(cv: Canvas, icons: List[Canvas], portraits: List[Canvas], texts: List, scene: Scene,
             floor: set) -> None:
    from buildDungeonBasic import text_item
    ICON = {"attack": 0, "dash": 1, "skill_inferno": 2, "skill_empireo": 3, "potion": 5, "bag": 6,
            "audio_on": 8, "souls": 10, "essence": 11}
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
    ratio = 0.84
    fw = hp_w * ratio
    polygon(cv, chamfer_pts(bar_x + 1, hp_y + 1, fw - 2, hp_h - 2, 9), hexrgb(0xB91C1C), 0.98)
    polygon(cv, chamfer_pts(bar_x + 2, hp_y + 2, fw - 6, 6, 4), hexrgb(0xEF4444), 0.55)
    stroke_poly(cv, chamfer_pts(bar_x, hp_y, hp_w, hp_h, 9), DF["bronze"], 1.6, 0.98)
    stroke_poly(cv, chamfer_pts(bar_x - 1, hp_y - 1, hp_w + 2, hp_h + 2, 9), DF["metalDark"], 1.0, 0.92)
    texts.append(text_item("84/100", bar_x + hp_w * 0.46, hp_y + hp_h / 2, 11, (255, 247, 237), FONT_BODY, True,
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
    texts.append(text_item(scene.title, ox + 24, oy + 10, 13, TXT_GOLD, FONT_TITLE, True, "l", (5, 7, 12, 220), 3))
    texts.append(text_item(scene.subtitle, ox + 24, oy + 26, 11.5, TXT_PARCH, FONT_BODY, False, "l",
                           (5, 7, 12, 220), 3))
    for x in range(ox, ox + 214):
        blend(cv, x, oy + 44, DF["gold"] if x < ox + 56 else DF["bronze"], 0.5)

    # --- minimapa circular com a forma real do mapa (mascara de piso) ---
    mx, my, mr = SW - 60, 60, 46
    disc(cv, mx, my + 2, mr + 4, (0, 0, 0), 0.5)
    disc(cv, mx, my, mr, (10, 16, 26), 0.94)
    K = 3.0
    hx_, hy_ = scene.hero

    def mm(wx: float, wy: float) -> Tuple[float, float]:
        return (mx + (wx - hx_) / T * K, my + (wy - hy_) / T * K)

    def inside(px: float, py: float) -> bool:
        return math.hypot(px + 0.5 - mx, py + 0.5 - my) < mr - 3
    walk = set(floor) | set(scene.doors) | {c for c, n in scene.north.items() if "open" in n}
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
    for c, n in list(scene.doors.items()) + list(scene.north.items()):
        if "sealed" in n:
            px, py = mm(c[0] * T + 16, c[1] * T + 16)
            if inside(px, py):
                disc(cv, px, py, 1.6, (192, 132, 252), 0.95)
    for key, wx, wy, _, _ in scene.actors:
        px, py = mm(wx, wy)
        if inside(px, py):
            disc(cv, px, py, 2.0, (239, 68, 68), 0.95)
    lx, ly = mm(scene.loot[1], scene.loot[2])
    if inside(lx, ly):
        disc(cv, lx, ly, 1.7, scene.loot_color, 1.0)
    polygon(cv, [(mx, my - 4), (mx + 3.5, my + 3), (mx - 3.5, my + 3)], (56, 189, 248), 1.0)
    ring(cv, mx, my, mr + 1.5, 3.5, DF["metalDark"])
    ring(cv, mx, my, mr, 2.2, DF["bronze"], 0.98)
    ring(cv, mx, my, mr - 2, 1.0, DF["gold"], 0.6)
    for ang in (0, 90, 180, 270):
        a = math.radians(ang)
        disc(cv, mx + mr * math.cos(a), my + mr * math.sin(a), 2, DF["gold"], 0.96)
    texts.append(text_item("N", mx, my - mr + 8, 8, TXT_GOLD, FONT_TITLE, True, "c", (5, 7, 12, 220), 2))

    map_left = mx - mr
    souls_x, ess_x, res_y = map_left - 128, map_left - 52, 26
    draw_image(cv, resize_area(icons[ICON["souls"]], 18, 18), souls_x, res_y)
    draw_image(cv, resize_area(icons[ICON["essence"]], 18, 18), ess_x, res_y)
    texts.append(text_item("215", souls_x + 13, res_y, 13, TXT_LIGHT, FONT_TITLE, True, "l", (5, 7, 12, 230), 3))
    texts.append(text_item("4", ess_x + 13, res_y, 13, TXT_LIGHT, FONT_TITLE, True, "l", (5, 7, 12, 230), 3))

    ur, row_y, right_x, gap = 18, 128, SW - 34, 50
    metal_button(cv, right_x, row_y, ur, DF["bronze"])
    draw_image(cv, resize_area(icons[ICON["audio_on"]], 20, 20), right_x, row_y)
    metal_button(cv, right_x - gap, row_y, ur, DF["gold"])
    draw_image(cv, resize_area(icons[ICON["bag"]], 20, 20), right_x - gap, row_y)
    disc(cv, right_x - gap + 13, row_y - 13, 7.5, (185, 28, 28), 0.98)
    ring(cv, right_x - gap + 13, row_y - 13, 7.5, 1.2, DF["gold"], 0.98)
    texts.append(text_item("1", right_x - gap + 13, row_y - 13, 9.5, (255, 247, 237), FONT_BODY, True, "c"))
    metal_button(cv, right_x - gap * 2, row_y, ur, DF["gold"])
    texts.append(text_item("AUTO", right_x - gap * 2, row_y, 8.5, TXT_GOLD, FONT_TITLE, True, "c"))
    for label, x in (("Inventário", right_x - gap), ("Áudio", right_x)):
        texts.append(text_item(label, x, row_y + ur + 9, 9, TXT_MUTED, FONT_BODY, False, "c", (5, 7, 12, 220), 2.5))

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

    atk_x, atk_y, atk_r = SW - 92, SH - 104, 42
    disc(cv, atk_x, atk_y + 3, atk_r + 4, (0, 0, 0), 0.5)
    disc(cv, atk_x, atk_y, atk_r, DF["crimsonFill"], 0.94)
    disc(cv, atk_x, atk_y - 6, atk_r - 8, (88, 28, 34), 0.35)
    ring(cv, atk_x, atk_y, atk_r + 1.5, 3.5, DF["metalDark"])
    ring(cv, atk_x, atk_y, atk_r, 2.4, DF["crimsonBorder"], 0.98)
    ring(cv, atk_x, atk_y, atk_r - 3, 1.2, DF["gold"], 0.8)
    draw_image(cv, resize_area(icons[ICON["attack"]], 50, 50), atk_x, atk_y - 8)
    texts.append(text_item("Ataque", atk_x, atk_y + 22, 13, TXT_PARCH, FONT_TITLE, True, "c", (7, 9, 14, 240), 3))
    slots = {
        "dash": (SW - 42, SH - 38, 22, "dash"),
        "potion": (atk_x - 88, atk_y + 38, 24, "potion"),
        "active_1": (atk_x - 94, atk_y - 30, 26, "skill_inferno"),
        "active_2": (atk_x - 38, atk_y - 94, 26, "skill_empireo"),
    }
    for slot, (bx, by_, br, icon) in slots.items():
        accent = DF["gold"] if slot.startswith("active") else DF["bronze"]
        metal_button(cv, bx, by_, br, accent)
        draw_image(cv, resize_area(icons[ICON[icon]], round(br * 1.38), round(br * 1.38)), bx, by_)
    bx, by_, br, _ = slots["active_1"]
    arc_fill(cv, bx, by_, br - 2, 0.35, (5, 7, 12), 0.62)
    texts.append(text_item("2s", bx, by_, 16, (255, 247, 237), FONT_TITLE, True, "c", (5, 7, 12, 240), 3.5))
    bx, by_, br, _ = slots["potion"]
    disc(cv, bx + 17, by_ + 17, 7.5, DF["obsidian"], 0.98)
    ring(cv, bx + 17, by_ + 17, 7.5, 1.2, DF["gold"], 0.98)
    texts.append(text_item("2", bx + 17, by_ + 17, 10, (255, 247, 237), FONT_BODY, True, "c"))
    bx, by_, br, _ = slots["dash"]
    texts.append(text_item("Esquiva", bx - br - 8, by_, 12.5, TXT_PARCH, FONT_TITLE, True, "r", (7, 9, 14, 240), 3))


# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------

def render(scene: Scene) -> Path:
    from buildDungeonBasic import render_text_overlay, text_item
    sheets = load_biome(scene.bid)
    world, floor = build_world(scene, sheets)
    scr = world_to_screen(world, scene)
    w2s = make_w2s(scene)
    s_actor = ACTOR_SCALE * ZOOM
    mask = Canvas(SW, SH)
    loot = load_frame_index("loot_drops", scene.loot[0])
    lx, ly = w2s(scene.loot[1], scene.loot[2])
    for key, wx, wy, _, _ in scene.actors + ((("hero_living",) + tuple(scene.hero) + (False, 0)),):
        fx, fy = w2s(wx, wy + 31 if key != "cave_bat" else wy + 46)
        rx = 20 if key in ("wolf", "hero_living", "wolf_alpha") else (14 if key != "cave_bat" else 11)
        if key == "wolf_alpha":
            rx = 24
        for y in range(int(fy - 6), int(fy + 7)):
            for x in range(int(fx - rx - 1), int(fx + rx + 2)):
                d = math.hypot((x + 0.5 - fx) / rx, (y + 0.5 - fy) / 5.0)
                if d < 1:
                    blend(scr, x, y, (0, 0, 0), 0.5 * (1 - d) ** 0.6)
    draw_sprite_scaled(scr, loot, lx, ly, LOOT_SCALE * ZOOM, False, mask)
    allact = list(scene.actors) + [("hero_living", scene.hero[0], scene.hero[1], False, 0)]
    for key, wx, wy, flip, fr in sorted(allact, key=lambda a: a[2] + (60 if a[0] == "cave_bat" else 0)):
        frame = load_frame_index(key, fr)
        sx, sy = w2s(wx, wy)
        draw_sprite_scaled(scr, frame, sx, sy, s_actor, flip, mask)

    lm = LightMap(scene.ambient)
    scene.lights(lm, w2s)
    hx, hy = w2s(scene.hero[0], scene.hero[1] + 8)
    lm.add(hx, hy, 230, (0.62, 0.64, 0.72), 0.6, 0.8)
    lm.add(lx, ly, 90, tuple(c / 255 for c in scene.loot_color), 0.8)
    apply_light(scr, lm, mask, scene.sprite_mix, scene.vignette_k)
    scene.glows(scr, w2s)
    beam(scr, lx, ly, scene.loot_color)
    add_glow(scr, lx, ly + 8, 34, scene.loot_color, 0.55, 0.45)
    scene.post(scr, w2s)

    texts: List = []
    hp = scene.hp()
    for i, (key, wx, wy, _, _) in enumerate(scene.actors):
        bx, by = w2s(wx - 17, wy - 34 - (6 if key == "wolf_alpha" else 0))
        bw, bh = 34 * ZOOM, 4 * ZOOM
        for y in range(int(by - 1), int(by + bh + 1)):
            for x in range(int(bx - 1), int(bx + bw + 1)):
                inner = bx <= x < bx + bw and by <= y < by + bh
                col = (39, 39, 48) if inner else (9, 9, 11)
                if inner and x < bx + bw * hp.get(i, 1.0):
                    col = (239, 68, 68) if y > by + 1 else (252, 165, 165)
                blend(scr, x, y, col, 0.95)
    scene.combat(scr, w2s, texts)
    texts.append(text_item(scene.loot_name, lx, ly - 34, 11, scene.loot_text, FONT_BODY, True, "c",
                           (5, 7, 12, 240), 3))
    icons = DB.slice_sheet(read_png(SPRITES / "ui_icons.png"), 64, 64)
    portraits = DB.slice_sheet(read_png(SPRITES / "portraits.png"), 128, 128)
    draw_hud(scr, icons, portraits, texts, scene, floor)
    for i in range(SW * SH):
        scr.buf[i * 4 + 3] = 255
    out = MOCKUPS / f"mockup_m8_{scene.bid}.png"
    render_text_overlay(scr, texts, out)
    print(f"Gerado: {out}")
    return out


def dmg(texts: List, w2s, wx: float, wy: float, value: str, crit: bool = False) -> None:
    from buildDungeonBasic import text_item
    x, y = w2s(wx, wy)
    if crit:
        texts.append(text_item("CRÍTICO!", x, y - 12, 11, (253, 224, 71), FONT_TITLE, True, "c", (60, 20, 4, 240), 3))
        texts.append(text_item(value, x, y + 6, 21, (250, 204, 21), FONT_TITLE, True, "c", (60, 20, 4, 245), 4))
    else:
        texts.append(text_item(value, x, y, 17, (255, 247, 237), FONT_TITLE, True, "c", (5, 7, 12, 240), 3.5))


def slash_arc(scr: Canvas, cx: float, cy: float, r: float, a0: float, a1: float, col: RGB) -> None:
    """Arco do golpe do heroi (telegrafia #e0f2fe), aditivo."""
    for k in range(120):
        t = k / 119
        a = a0 + (a1 - a0) * t
        for w in range(-3, 4):
            rr = r + w * 0.9
            x, y = cx + math.cos(a) * rr, cy + math.sin(a) * rr
            f = (1 - abs(w) / 4) * math.sin(t * math.pi) * 0.9
            blend(scr, int(x), int(y), col, f)


# ---------------------------------------------------------------------------
# Cenas
# ---------------------------------------------------------------------------

def scenes() -> Dict[str, Scene]:
    from surf_scenes import GrottoScene, HerbFieldScene, VillageScene
    return {"village": VillageScene(), "herb_field": HerbFieldScene(), "village_grotto": GrottoScene()}


def main(argv: Sequence[str]) -> None:
    all_s = scenes()
    for bid in (argv or list(all_s)):
        render(all_s[bid])


if __name__ == "__main__":
    main(sys.argv[1:])
