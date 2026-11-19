"""
SUBMUNDO - Mockup estatico da Masmorra Basica 2.5D (M8 piloto, BRF-126 / T-117)
=================================================================================

Monta `assets/mockups/mockup_m8_dungeon_basic.png` (960x540) simulando uma captura
real do jogo com os assets publicados:

- cenario: dungeon_basic_tiles / dungeon_basic_props / dungeon_basic_props_tall
  (escala de mundo 1:1, tile 32 px = TILE_DISPLAY_SIZE) vistos pela camera do
  DungeonScene (zoom 1.45, nearest-neighbor, sem antialias);
- herois e monstros reais (hero_living idle0, slime, cave_bat, wolf, skeleton,
  skeleton_archer idle0) com setScale(0.88) do DungeonScene -> 0.88 x 1.45 na tela;
- drop lendario (loot_drops, setScale 1.5) com feixe de luz;
- iluminacao: ambiente frio + tochas quentes (#f59e0b / #fde047) + luz do heroi, vinheta;
- HUD paisagem aproximando DungeonHud.ts (retrato circular + HP, tracker, minimapa,
  recursos, trio utilitario, D-pad translucido, cluster Ataque/Esquiva/Skills/Pocao)
  com ui_icons.png e portraits.png; textos suaves via System.Drawing.

Requer os sheets gerados por `python scripts/art/buildDungeonBasic.py`.
Uso: python scripts/art/buildMockupDungeonBasic.py
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))
from buildMonstersBase import Canvas, read_png  # noqa: E402
from buildDungeonBasic import (  # noqa: E402
    MANIFEST_JSON,
    MOCKUPS_DIR,
    SPRITES_DIR,
    render_text_overlay,
    slice_sheet,
    text_item,
)

OUT_PNG = MOCKUPS_DIR / "mockup_m8_dungeon_basic.png"
SW, SH = 960, 540
ZOOM = 1.45  # DungeonScene.getWorldZoom()
ACTOR_SCALE = 0.88  # DungeonScene: heroi e monstros animados 80x80
LOOT_SCALE = 1.5  # DungeonScene: loot_drops
VIEW_X, VIEW_Y = -11.0, 6.0  # origem da camera no mundo (sala 640x384 < viewport 662x372)
T = 32
COLS, ROWS = 20, 12

Color = Tuple[int, int, int, int]


# ---------------------------------------------------------------------------
# Carregamento
# ---------------------------------------------------------------------------

def load_frames(key: str) -> Dict[str, Canvas]:
    manifest = json.loads(MANIFEST_JSON.read_text(encoding="utf-8"))
    entry = manifest["sprites"][key]
    sheet = read_png(SPRITES_DIR / entry["file"])
    frames = slice_sheet(sheet, entry["frameWidth"], entry["frameHeight"])
    return {name: frames[i] for i, name in enumerate(entry["frames"])}


def load_frame_index(key: str, index: int) -> Canvas:
    manifest = json.loads(MANIFEST_JSON.read_text(encoding="utf-8"))
    entry = manifest["sprites"][key]
    sheet = read_png(SPRITES_DIR / entry["file"])
    return slice_sheet(sheet, entry["frameWidth"], entry["frameHeight"])[index]


# ---------------------------------------------------------------------------
# Mundo 1:1
# ---------------------------------------------------------------------------

def build_world(tiles: Dict[str, Canvas], props: Dict[str, Canvas], tall: Dict[str, Canvas]) -> Canvas:
    world = Canvas(COLS * T, ROWS * T, (9, 9, 11, 255))
    door_cols = (9, 10)
    floor_cycle = ("floor_0", "floor_1", "floor_2", "floor_0", "floor_1", "floor_2", "floor_1")
    special = {(1, 4): "floor_moss", (18, 7): "floor_moss", (17, 8): "floor_moss", (5, 9): "floor_blood",
               (12, 6): "floor_cracked", (6, 5): "floor_cracked", (14, 9): "floor_blood"}
    grid: List[List[str]] = []
    for r in range(ROWS):
        row: List[str] = []
        for c in range(COLS):
            last_c, last_r = COLS - 1, ROWS - 1
            if r == 0:
                n = "corner_in_tl" if c == 0 else ("corner_in_tr" if c == last_c else "wall_top_s")
            elif r == last_r:
                n = "corner_in_bl" if c == 0 else ("corner_in_br" if c == last_c else "wall_bottom")
            elif c == 0:
                n = "wall_side_l"
            elif c == last_c:
                n = "wall_side_r"
            elif r == 1:
                if c in door_cols:
                    n = "door_arch_l" if c == door_cols[0] else "door_arch_r"
                else:
                    n = "wall_face_upper_cracked" if c in (4, 15) else "wall_face_upper"
            elif r == 2:
                if c in door_cols:
                    n = "door_open_l" if c == door_cols[0] else "door_open_r"
                else:
                    n = "wall_face_lower_grate" if c in (3, 16) else "wall_face_lower"
            elif r == 3 and c in door_cols:
                n = "door_threshold_l" if c == door_cols[0] else "door_threshold_r"
            else:
                n = special.get((c, r)) or floor_cycle[(c * 31 + r * 17 + 13) % 7 if (c * 7 + r * 3) % 5 else 0]
            row.append(n)
        grid.append(row)
    for r, row in enumerate(grid):
        for c, n in enumerate(row):
            world.composite(tiles[n], c * T, r * T)
    # sombras projetadas das paredes sobre o piso
    for c in range(1, COLS - 1):
        n = "shadow_corner_l" if c == 1 else ("shadow_corner_r" if c == COLS - 2 else "shadow_s")
        world.composite(tiles[n], c * T, 3 * T)
    for r in range(4, ROWS - 1):
        world.composite(tiles["shadow_l"], 1 * T, r * T)
        world.composite(tiles["shadow_r"], (COLS - 2) * T, r * T)
    # props de parede
    for c, fr in ((6, "torch_0"), (8, "torch_2"), (11, "torch_1"), (13, "torch_3")):
        world.composite(props[fr], c * T, 1 * T)
    for c in (2, 17):
        world.composite(props["chain"], c * T, 1 * T + 2)
    # props de chao (ordem por y)
    floor_props = [
        ("skulls_candle", 40, 104), ("rubble", 520, 106), ("barrel", 548, 118), ("urn", 576, 124),
        ("bones", 150, 300), ("rubble", 300, 330), ("chest_closed", 440, 316),
    ]
    for name, x, y in sorted(floor_props, key=lambda p: p[2]):
        world.composite(props[name], x, y)
    for name, x, y in (("pillar", 96, 98), ("pillar", 512, 98), ("pillar_broken", 64, 262)):
        world.composite(tall[name], x, y)
    return world


TORCH_FLAMES_WORLD = [(c * T + 15.5, 1 * T + 9.0) for c in (6, 8, 11, 13)]


def w2s(wx: float, wy: float) -> Tuple[float, float]:
    return ((wx - VIEW_X) * ZOOM, (wy - VIEW_Y) * ZOOM)


def world_to_screen(world: Canvas) -> Canvas:
    scr = Canvas(SW, SH, (9, 9, 11, 255))
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


# ---------------------------------------------------------------------------
# Iluminacao
# ---------------------------------------------------------------------------

class LightMap:
    def __init__(self, ambient: Tuple[float, float, float]) -> None:
        n = SW * SH
        self.r = [ambient[0]] * n
        self.g = [ambient[1]] * n
        self.b = [ambient[2]] * n

    def add(self, cx: float, cy: float, radius: float, col: Tuple[float, float, float], power: float,
            squash: float = 1.0) -> None:
        x0, x1 = max(0, int(cx - radius)), min(SW, int(cx + radius) + 1)
        y0, y1 = max(0, int(cy - radius * squash)), min(SH, int(cy + radius * squash) + 1)
        cr, cg, cb = col[0] * power, col[1] * power, col[2] * power
        for y in range(y0, y1):
            dy = (y + 0.5 - cy) / squash
            base = y * SW
            for x in range(x0, x1):
                dx = x + 0.5 - cx
                d = math.sqrt(dx * dx + dy * dy) / radius
                if d >= 1.0:
                    continue
                f = (1.0 - d) ** 2
                i = base + x
                self.r[i] += cr * f
                self.g[i] += cg * f
                self.b[i] += cb * f


def vignette(x: int, y: int) -> float:
    nx = (x + 0.5 - SW / 2) / (SW / 2)
    ny = (y + 0.5 - SH * 0.56) / (SH / 2)
    d = math.sqrt(nx * nx * 0.85 + ny * ny * 1.1)
    t = min(1.0, max(0.0, (d - 0.55) / 0.6))
    return 1.0 - 0.72 * t * t * (3 - 2 * t)


def apply_light(scr: Canvas, lm: LightMap, mask: Optional[Canvas] = None, sprite_mix: float = 0.5) -> None:
    buf = scr.buf
    for y in range(SH):
        for x in range(SW):
            i = y * SW + x
            o = i * 4
            lr, lg, lb = lm.r[i], lm.g[i], lm.b[i]
            if mask is not None and mask.buf[o + 3]:
                # atores recebem a luz atenuada (leitura garantida, como sprites sem Light2D)
                lr = 1.0 + (lr - 1.0) * sprite_mix if lr < 1.0 else lr
                lg = 1.0 + (lg - 1.0) * sprite_mix if lg < 1.0 else lg
                lb = 1.0 + (lb - 1.0) * sprite_mix if lb < 1.0 else lb
            v = vignette(x, y)
            buf[o] = min(255, int(buf[o] * lr * v))
            buf[o + 1] = min(255, int(buf[o + 1] * lg * v))
            buf[o + 2] = min(255, int(buf[o + 2] * lb * v))


def add_glow(scr: Canvas, cx: float, cy: float, radius: float, col: Tuple[int, int, int], strength: float,
             squash: float = 1.0) -> None:
    x0, x1 = max(0, int(cx - radius)), min(SW, int(cx + radius) + 1)
    y0, y1 = max(0, int(cy - radius * squash)), min(SH, int(cy + radius * squash) + 1)
    for y in range(y0, y1):
        dy = (y + 0.5 - cy) / squash
        for x in range(x0, x1):
            dx = x + 0.5 - cx
            d = math.sqrt(dx * dx + dy * dy) / radius
            if d >= 1:
                continue
            f = strength * (1 - d) ** 2.2
            o = (y * SW + x) * 4
            scr.buf[o] = min(255, int(scr.buf[o] + col[0] * f))
            scr.buf[o + 1] = min(255, int(scr.buf[o + 1] + col[1] * f))
            scr.buf[o + 2] = min(255, int(scr.buf[o + 2] + col[2] * f))


# ---------------------------------------------------------------------------
# Desenho na tela (atores com nearest; HUD com antialias analitico)
# ---------------------------------------------------------------------------

def blend(cv: Canvas, x: int, y: int, col: Tuple[int, int, int], a: float) -> None:
    if a <= 0 or not (0 <= x < cv.w and 0 <= y < cv.h):
        return
    a = min(1.0, a)
    o = (y * cv.w + x) * 4
    b = cv.buf
    b[o] = int(b[o] + (col[0] - b[o]) * a)
    b[o + 1] = int(b[o + 1] + (col[1] - b[o + 1]) * a)
    b[o + 2] = int(b[o + 2] + (col[2] - b[o + 2]) * a)
    b[o + 3] = max(b[o + 3], int(255 * a))


def draw_sprite_scaled(dst: Canvas, src: Canvas, cx: float, cy: float, scale: float, flip: bool = False,
                       mask: Optional[Canvas] = None) -> None:
    w, h = src.w * scale, src.h * scale
    x0, y0 = int(round(cx - w / 2)), int(round(cy - h / 2))
    for ty in range(int(math.ceil(h))):
        sy = int(ty / scale)
        if sy >= src.h:
            continue
        for tx in range(int(math.ceil(w))):
            sx = int(tx / scale)
            if sx >= src.w:
                continue
            c = src.get(src.w - 1 - sx if flip else sx, sy)
            if c[3]:
                blend(dst, x0 + tx, y0 + ty, c[:3], c[3] / 255)
                if mask is not None:
                    mask.put(x0 + tx, y0 + ty, (255, 255, 255, 255))


def resize_area(src: Canvas, dw: int, dh: int) -> Canvas:
    """Reducao com filtro de area (premultiplicado) para icones/retrato do HUD."""
    out = Canvas(dw, dh)
    fx, fy = src.w / dw, src.h / dh
    for y in range(dh):
        sy0, sy1 = y * fy, (y + 1) * fy
        for x in range(dw):
            sx0, sx1 = x * fx, (x + 1) * fx
            acc = [0.0, 0.0, 0.0, 0.0]
            wsum = 0.0
            for yy in range(int(sy0), min(src.h, int(math.ceil(sy1)))):
                wy = min(sy1, yy + 1) - max(sy0, yy)
                for xx in range(int(sx0), min(src.w, int(math.ceil(sx1)))):
                    wx = min(sx1, xx + 1) - max(sx0, xx)
                    wgt = wx * wy
                    r, g, b, a = src.get(xx, yy)
                    af = a / 255 * wgt
                    acc[0] += r * af
                    acc[1] += g * af
                    acc[2] += b * af
                    acc[3] += af
                    wsum += wgt
            if acc[3] > 0:
                out.put(x, y, (int(acc[0] / acc[3]), int(acc[1] / acc[3]), int(acc[2] / acc[3]),
                               int(255 * acc[3] / wsum)))
    return out


def draw_image(dst: Canvas, src: Canvas, cx: float, cy: float, alpha: float = 1.0,
               clip_r: Optional[float] = None) -> None:
    x0, y0 = int(round(cx - src.w / 2)), int(round(cy - src.h / 2))
    for y in range(src.h):
        for x in range(src.w):
            c = src.get(x, y)
            if not c[3]:
                continue
            a = c[3] / 255 * alpha
            if clip_r is not None:
                d = math.hypot(x0 + x + 0.5 - cx, y0 + y + 0.5 - cy)
                a *= max(0.0, min(1.0, clip_r - d + 0.5))
            blend(dst, x0 + x, y0 + y, c[:3], a)


def disc(cv: Canvas, cx: float, cy: float, r: float, col: Tuple[int, int, int], alpha: float = 1.0) -> None:
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            blend(cv, x, y, col, alpha * max(0.0, min(1.0, r - d + 0.5)))


def ring(cv: Canvas, cx: float, cy: float, r: float, width: float, col: Tuple[int, int, int],
         alpha: float = 1.0) -> None:
    for y in range(int(cy - r - width - 1), int(cy + r + width + 2)):
        for x in range(int(cx - r - width - 1), int(cx + r + width + 2)):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            blend(cv, x, y, col, alpha * max(0.0, min(1.0, width / 2 - abs(d - r) + 0.5)))


def arc_fill(cv: Canvas, cx: float, cy: float, r: float, frac: float, col: Tuple[int, int, int],
             alpha: float) -> None:
    """Setor de cooldown radial (do topo, sentido horario), cobrindo `frac` do circulo."""
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            ang = (math.atan2(dx, -dy) + 2 * math.pi) % (2 * math.pi) / (2 * math.pi)
            if ang <= frac:
                blend(cv, x, y, col, alpha * max(0.0, min(1.0, r - d + 0.5)))


def polygon(cv: Canvas, pts: Sequence[Tuple[float, float]], col: Tuple[int, int, int], alpha: float = 1.0,
            ss: int = 4) -> None:
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    n = len(pts)

    def inside(px: float, py: float) -> bool:
        c = False
        j = n - 1
        for i in range(n):
            xi, yi = pts[i]
            xj, yj = pts[j]
            if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi:
                c = not c
            j = i
        return c

    for y in range(int(min(ys)) - 1, int(max(ys)) + 2):
        for x in range(int(min(xs)) - 1, int(max(xs)) + 2):
            hits = 0
            for sy in range(ss):
                for sx in range(ss):
                    if inside(x + (sx + 0.5) / ss, y + (sy + 0.5) / ss):
                        hits += 1
            if hits:
                blend(cv, x, y, col, alpha * hits / (ss * ss))


def chamfer_pts(x: float, y: float, w: float, h: float, bevel: float) -> List[Tuple[float, float]]:
    return [(x + bevel, y), (x + w, y), (x + w - bevel, y + h), (x, y + h)]


def stroke_poly(cv: Canvas, pts: Sequence[Tuple[float, float]], col: Tuple[int, int, int], width: float,
                alpha: float = 1.0) -> None:
    n = len(pts)
    for i in range(n):
        (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
        length = math.hypot(x1 - x0, y1 - y0)
        steps = max(1, int(length * 2))
        nx, ny = -(y1 - y0) / length * width / 2, (x1 - x0) / length * width / 2
        quad = [(x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)]
        polygon(cv, quad, col, alpha, 3)
        _ = steps


def rounded_rect(cv: Canvas, x: float, y: float, w: float, h: float, r: float, col: Tuple[int, int, int],
                 alpha: float = 1.0) -> None:
    for yy in range(int(y) - 1, int(y + h) + 2):
        for xx in range(int(x) - 1, int(x + w) + 2):
            px, py = xx + 0.5, yy + 0.5
            qx = max(x + r - px, 0, px - (x + w - r))
            qy = max(y + r - py, 0, py - (y + h - r))
            d = math.hypot(qx, qy) - r
            inside_box = x <= px <= x + w and y <= py <= y + h
            cov = max(0.0, min(1.0, 0.5 - d)) if inside_box or d < 1 else 0.0
            if px < x - 0.5 or px > x + w + 0.5 or py < y - 0.5 or py > y + h + 0.5:
                cov = 0.0
            blend(cv, xx, yy, col, alpha * cov)


def hexrgb(v: int) -> Tuple[int, int, int]:
    return ((v >> 16) & 255, (v >> 8) & 255, v & 255)


DF = {
    "obsidian": hexrgb(0x0C0E14), "inner": hexrgb(0x141822), "recess": hexrgb(0x090B10),
    "metalBorder": hexrgb(0x4B5563), "metalDark": hexrgb(0x262D3A), "bronze": hexrgb(0x8A7048),
    "bronzeDark": hexrgb(0x5C4A30), "gold": hexrgb(0xD4A95A), "goldBright": hexrgb(0xF1D28A),
    "crimsonFill": hexrgb(0x45171D), "crimsonBorder": hexrgb(0xC9414F),
}
TXT_PARCH = (243, 230, 204)
TXT_GOLD = (231, 196, 122)
TXT_LIGHT = (226, 232, 240)
TXT_MUTED = (148, 163, 184)
FONT_TITLE = "Perpetua Titling MT"
FONT_BODY = "Palatino Linotype"


def metal_button(cv: Canvas, cx: float, cy: float, r: float, accent: Tuple[int, int, int],
                 fill: Tuple[int, int, int] = DF["inner"], alpha: float = 0.92) -> None:
    disc(cv, cx, cy + 2, r + 2, (0, 0, 0), 0.45)
    disc(cv, cx, cy, r, fill, alpha)
    ring(cv, cx, cy, r + 1, 2.4, DF["metalDark"], 0.96)
    ring(cv, cx, cy, r, 1.6, accent, 0.95)
    ring(cv, cx, cy, r - 2.5, 1.0, DF["metalDark"], 0.85)


# ---------------------------------------------------------------------------
# HUD
# ---------------------------------------------------------------------------

def draw_hud(cv: Canvas, icons: List[Canvas], portraits: List[Canvas], texts: List[Dict[str, object]]) -> None:
    ICON = {"attack": 0, "dash": 1, "skill_inferno": 2, "skill_empireo": 3, "potion": 5, "bag": 6,
            "audio_on": 8, "souls": 10, "essence": 11}

    # --- Retrato + HP (HERO_FRAME) ---
    pcx, pcy, pr = 46, 44, 32
    disc(cv, pcx, pcy + 2, pr + 3, (0, 0, 0), 0.5)
    disc(cv, pcx, pcy, pr, DF["recess"], 0.96)
    portrait = resize_area(portraits[0], (pr - 1) * 2, (pr - 1) * 2)
    draw_image(cv, portrait, pcx, pcy + 1, 1.0, pr - 2)
    ring(cv, pcx, pcy, pr + 1.5, 3.5, DF["metalDark"])
    ring(cv, pcx, pcy, pr, 2.2, DF["bronze"], 0.98)
    ring(cv, pcx, pcy, pr - 2, 1.0, DF["gold"], 0.75)
    for (dx, dy) in ((0, -pr), (pr, 0), (-pr, 0)):
        disc(cv, pcx + dx, pcy + dy, 2, DF["gold"], 0.96)
    bw, bh, by = 46, 15, pcy + pr + 1
    rounded_rect(cv, pcx - bw / 2, by - bh / 2, bw, bh, 4, DF["obsidian"], 0.96)
    stroke_rr_pts = chamfer_pts(pcx - bw / 2, by - bh / 2, bw, bh, 0)
    stroke_poly(cv, stroke_rr_pts, DF["gold"], 1.3, 0.95)
    texts.append(text_item("Nv. 7", pcx, by, 10.5, TXT_GOLD, FONT_BODY, True, "c"))

    bar_x, hp_y, hp_w, hp_h = 86, 30, 188, 18
    texts.append(text_item("GUERREIRO", 88, 17, 12.5, TXT_PARCH, FONT_TITLE, True, "l", (5, 7, 12, 220), 3))
    polygon(cv, chamfer_pts(bar_x, hp_y, hp_w, hp_h, 9), DF["recess"], 0.95)
    ratio = 0.78
    fw = hp_w * ratio
    polygon(cv, chamfer_pts(bar_x + 1, hp_y + 1, fw - 2, hp_h - 2, 9), hexrgb(0xB91C1C), 0.98)
    polygon(cv, chamfer_pts(bar_x + 2, hp_y + 2, fw - 6, 6, 4), hexrgb(0xEF4444), 0.55)
    stroke_poly(cv, chamfer_pts(bar_x, hp_y, hp_w, hp_h, 9), DF["bronze"], 1.6, 0.98)
    stroke_poly(cv, chamfer_pts(bar_x - 1, hp_y - 1, hp_w + 2, hp_h + 2, 9), DF["metalDark"], 1.0, 0.92)
    texts.append(text_item("78/100", bar_x + hp_w * 0.46, hp_y + hp_h / 2, 11, (255, 247, 237), FONT_BODY, True,
                           "c", (5, 7, 12, 230), 2.5))
    sec_y, sec_w, sec_h = 53, 154, 6
    polygon(cv, chamfer_pts(bar_x, sec_y, sec_w, sec_h, 4), DF["recess"], 0.92)
    polygon(cv, chamfer_pts(bar_x + 1, sec_y + 1, (sec_w - 2) * 0.6, sec_h - 2, 3), hexrgb(0xD97706), 0.95)
    stroke_poly(cv, chamfer_pts(bar_x, sec_y, sec_w, sec_h, 4), DF["metalBorder"], 1.0, 0.88)

    # --- Tracker de objetivo (16, 94) ---
    ox, oy = 16, 94
    dcx, dcy = ox + 10, oy + 10
    polygon(cv, [(dcx, dcy - 6.2), (dcx + 6.2, dcy), (dcx, dcy + 6.2), (dcx - 6.2, dcy)], DF["gold"], 0.96)
    polygon(cv, [(dcx, dcy - 5), (dcx + 5, dcy), (dcx, dcy + 5), (dcx - 5, dcy)], DF["bronzeDark"], 0.95)
    polygon(cv, [(dcx, dcy - 3), (dcx + 3, dcy), (dcx, dcy + 3), (dcx - 3, dcy)], DF["goldBright"], 0.98)
    texts.append(text_item("Masmorra Básica", ox + 24, oy + 10, 13, TXT_GOLD, FONT_TITLE, True, "l",
                           (5, 7, 12, 220), 3))
    texts.append(text_item("Derrote as criaturas · 5 restantes", ox + 24, oy + 26, 11.5, TXT_PARCH, FONT_BODY,
                           False, "l", (5, 7, 12, 220), 3))
    for x in range(ox, ox + 204):
        blend(cv, x, oy + 44, DF["gold"] if x < ox + 56 else DF["bronze"], 0.5)

    # --- Minimapa circular (w-60, 60, r 46) ---
    mx, my, mr = SW - 60, 60, 46
    disc(cv, mx, my + 2, mr + 4, (0, 0, 0), 0.5)
    disc(cv, mx, my, mr, (10, 16, 26), 0.94)
    # sala no minimapa
    sx0, sy0, sw_, sh_ = mx - 30, my - 18, 60, 36
    for y in range(int(sy0), int(sy0 + sh_)):
        for x in range(int(sx0), int(sx0 + sw_)):
            edge = x in (int(sx0), int(sx0 + sw_) - 1) or y in (int(sy0), int(sy0 + sh_) - 1)
            blend(cv, x, y, (100, 116, 139) if edge else (34, 46, 64), 0.9)
    for y in range(int(sy0) - 8, int(sy0)):
        for x in range(mx - 4, mx + 4):
            blend(cv, x, y, (34, 46, 64) if x not in (mx - 4, mx + 3) else (100, 116, 139), 0.9)
    disc(cv, mx - 12, sy0 - 14, 3, (56, 189, 248), 0.6)
    ring(cv, mx, sy0 - 14, 9, 1, (100, 116, 139), 0.5)
    # heroi e inimigos
    def mm(wx: float, wy: float) -> Tuple[float, float]:
        return (sx0 + wx / (COLS * T) * sw_, sy0 + wy / (ROWS * T) * sh_)
    for (wx, wy) in ((232, 196), (470, 150), (402, 262), (250, 300), (372, 158)):
        px, py = mm(wx, wy)
        disc(cv, px, py, 2.2, (239, 68, 68), 0.95)
    hx, hy = mm(320, 228)
    polygon(cv, [(hx, hy - 4), (hx + 3.5, hy + 3), (hx - 3.5, hy + 3)], (56, 189, 248), 1.0)
    lx, ly = mm(178, 262)
    disc(cv, lx, ly, 1.8, (249, 115, 22), 1.0)
    ring(cv, mx, my, mr + 1.5, 3.5, DF["metalDark"])
    ring(cv, mx, my, mr, 2.2, DF["bronze"], 0.98)
    ring(cv, mx, my, mr - 2, 1.0, DF["gold"], 0.6)
    for ang in (0, 90, 180, 270):
        a = math.radians(ang)
        disc(cv, mx + mr * math.cos(a), my + mr * math.sin(a), 2, DF["gold"], 0.96)
    texts.append(text_item("N", mx, my - mr + 8, 8, TXT_GOLD, FONT_TITLE, True, "c", (5, 7, 12, 220), 2))

    # --- Recursos (y = 26) ---
    map_left = mx - mr
    souls_x, ess_x, res_y = map_left - 128, map_left - 52, 26
    draw_image(cv, resize_area(icons[ICON["souls"]], 18, 18), souls_x, res_y)
    draw_image(cv, resize_area(icons[ICON["essence"]], 18, 18), ess_x, res_y)
    texts.append(text_item("1.240", souls_x + 13, res_y, 13, TXT_LIGHT, FONT_TITLE, True, "l", (5, 7, 12, 230), 3))
    texts.append(text_item("36", ess_x + 13, res_y, 13, TXT_LIGHT, FONT_TITLE, True, "l", (5, 7, 12, 230), 3))

    # --- Trio utilitario (y = 128, r = 18) ---
    ur, row_y, right_x, gap = 18, 128, SW - 34, 50
    metal_button(cv, right_x, row_y, ur, DF["bronze"])
    draw_image(cv, resize_area(icons[ICON["audio_on"]], 20, 20), right_x, row_y)
    metal_button(cv, right_x - gap, row_y, ur, DF["gold"])
    draw_image(cv, resize_area(icons[ICON["bag"]], 20, 20), right_x - gap, row_y)
    disc(cv, right_x - gap + 13, row_y - 13, 7.5, (185, 28, 28), 0.98)
    ring(cv, right_x - gap + 13, row_y - 13, 7.5, 1.2, DF["gold"], 0.98)
    texts.append(text_item("2", right_x - gap + 13, row_y - 13, 9.5, (255, 247, 237), FONT_BODY, True, "c"))
    metal_button(cv, right_x - gap * 2, row_y, ur, DF["gold"])
    texts.append(text_item("AUTO", right_x - gap * 2, row_y, 8.5, TXT_GOLD, FONT_TITLE, True, "c"))
    for label, x in (("Inventário", right_x - gap), ("Áudio", right_x)):
        texts.append(text_item(label, x, row_y + ur + 9, 9, TXT_MUTED, FONT_BODY, False, "c", (5, 7, 12, 220), 2.5))

    # --- D-pad translucido (104, h - 104) ---
    jx, jy, jr = 104, SH - 104, 54
    disc(cv, jx, jy, jr, (8, 10, 16), 0.38)
    ring(cv, jx, jy, jr, 2.0, (100, 116, 139), 0.42)
    ring(cv, jx, jy, jr - 4, 1.0, DF["bronze"], 0.25)
    ring(cv, jx, jy, round(jr * 0.44), 1.4, (100, 116, 139), 0.35)
    for (ddx, ddy) in ((0, -1), (1, 0), (0, 1), (-1, 0)):
        ax, ay = jx + ddx * 38, jy + ddy * 38
        px_, py_ = -ddy, ddx
        tip = (ax + ddx * 6, ay + ddy * 6)
        b1 = (ax - ddx * 4 + px_ * 7, ay - ddy * 4 + py_ * 7)
        b2 = (ax - ddx * 4 - px_ * 7, ay - ddy * 4 - py_ * 7)
        polygon(cv, [tip, b1, b2], (203, 213, 225), 0.55)
    disc(cv, jx, jy, 18, (30, 35, 46), 0.62)
    ring(cv, jx, jy, 18, 1.6, DF["bronze"], 0.7)
    ring(cv, jx, jy, 12, 1.0, (100, 116, 139), 0.4)

    # --- Cluster de combate (direita) ---
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
    # cooldown radial na skill 2
    bx, by_, br, _ = slots["active_2"]
    arc_fill(cv, bx, by_, br - 2, 0.62, (5, 7, 12), 0.62)
    texts.append(text_item("3s", bx, by_, 16, (255, 247, 237), FONT_TITLE, True, "c", (5, 7, 12, 240), 3.5))
    # cargas da pocao
    bx, by_, br, _ = slots["potion"]
    disc(cv, bx + 17, by_ + 17, 7.5, DF["obsidian"], 0.98)
    ring(cv, bx + 17, by_ + 17, 7.5, 1.2, DF["gold"], 0.98)
    texts.append(text_item("3", bx + 17, by_ + 17, 10, (255, 247, 237), FONT_BODY, True, "c"))
    bx, by_, br, _ = slots["dash"]
    texts.append(text_item("Esquiva", bx - br - 8, by_, 12.5, TXT_PARCH, FONT_TITLE, True, "r", (7, 9, 14, 240), 3))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    tiles = load_frames("dungeon_basic_tiles")
    props = load_frames("dungeon_basic_props")
    tall = load_frames("dungeon_basic_props_tall")
    world = build_world(tiles, props, tall)
    scr = world_to_screen(world)

    # --- atores (escala do jogo: 0.88 no mundo x zoom 1.45) ---
    s_actor = ACTOR_SCALE * ZOOM
    actors = [
        ("skeleton_archer", 470, 150, True),
        ("cave_bat", 372, 152, True),
        ("skeleton", 232, 196, False),
        ("hero_living", 320, 228, False),
        ("wolf", 402, 262, True),
        ("slime", 250, 300, False),
    ]
    actor_mask = Canvas(SW, SH)
    loot = load_frame_index("loot_drops", 3)  # legendary
    lx, ly = w2s(178, 262)
    # sombras de contato sob os atores (antes dos sprites)
    for key, wx, wy, _ in actors:
        fx, fy = w2s(wx, wy + 31 if key != "cave_bat" else wy + 46)
        rx = 20 if key in ("wolf", "hero_living") else (14 if key != "cave_bat" else 11)
        for y in range(int(fy - 6), int(fy + 7)):
            for x in range(int(fx - rx - 1), int(fx + rx + 2)):
                d = math.hypot((x + 0.5 - fx) / rx, (y + 0.5 - fy) / 5.0)
                if d < 1:
                    blend(scr, x, y, (0, 0, 0), 0.5 * (1 - d) ** 0.6)
    draw_sprite_scaled(scr, loot, lx, ly, LOOT_SCALE * ZOOM, False, actor_mask)
    for key, wx, wy, flip in sorted(actors, key=lambda a: a[2] + (60 if a[0] == "cave_bat" else 0)):
        frame = load_frame_index(key, 0)
        sx, sy = w2s(wx, wy)
        draw_sprite_scaled(scr, frame, sx, sy, s_actor, flip, actor_mask)

    # --- luz ---
    lm = LightMap((0.36, 0.37, 0.46))
    for (fx, fy) in TORCH_FLAMES_WORLD:
        sx, sy = w2s(fx, fy)
        lm.add(sx, sy + 40, 210, (1.0, 0.62, 0.26), 1.15, 0.85)
    hx, hy = w2s(320, 236)
    lm.add(hx, hy, 230, (0.62, 0.64, 0.72), 0.75, 0.8)
    lm.add(lx, ly, 90, (1.0, 0.5, 0.15), 0.8)
    dx_, dy_ = w2s(320, 70)
    lm.add(dx_, dy_, 70, (0.25, 0.7, 1.0), 0.45)
    cx_, cy_ = w2s(56, 112)
    lm.add(cx_, cy_, 70, (1.0, 0.65, 0.3), 0.6)
    apply_light(scr, lm, actor_mask, 0.45)

    # --- brilhos aditivos ---
    for (fx, fy) in TORCH_FLAMES_WORLD:
        sx, sy = w2s(fx, fy)
        add_glow(scr, sx, sy, 22, (255, 200, 90), 0.75)
        add_glow(scr, sx, sy + 6, 64, (245, 140, 40), 0.22)
    add_glow(scr, *w2s(56, 113), 14, (255, 190, 90), 0.5)
    # feixe do drop lendario
    beam_h = 120
    for y in range(int(ly - beam_h), int(ly + 4)):
        t = min(1.0, (ly - y) / beam_h)
        for x in range(int(lx - 9), int(lx + 10)):
            d = abs(x + 0.5 - lx) / 9
            f = max(0.0, 1 - d) ** 1.6 * (1 - max(0.0, t)) ** 1.3 * 0.85
            o = (y * SW + x) * 4
            if 0 <= y < SH and f > 0:
                scr.buf[o] = min(255, int(scr.buf[o] + 249 * f))
                scr.buf[o + 1] = min(255, int(scr.buf[o + 1] + 115 * f))
                scr.buf[o + 2] = min(255, int(scr.buf[o + 2] + 22 * f))
    add_glow(scr, lx, ly + 8, 34, (249, 115, 22), 0.55, 0.45)
    add_glow(scr, *w2s(320, 64), 30, (56, 189, 248), 0.18)

    # --- telegrafia do arqueiro (linha de mira vermelha ate o heroi) ---
    ax, ay = w2s(456, 146)
    tx, ty = w2s(326, 222)
    steps = int(math.hypot(tx - ax, ty - ay))
    for i in range(steps):
        t = i / steps
        px, py = ax + (tx - ax) * t, ay + (ty - ay) * t
        if (i // 6) % 2 == 0:
            for w in (-1, 0, 1):
                blend(scr, int(px), int(py) + w, (239, 68, 68), 0.55 if w == 0 else 0.22)
    ring(scr, tx, ty + 30, 18, 1.6, (239, 68, 68), 0.55)

    # --- barras de HP dos monstros (34x4 no mundo, offset 34) ---
    texts: List[Dict[str, object]] = []
    hp = {"skeleton": 0.55, "skeleton_archer": 1.0, "wolf": 0.3, "slime": 0.85, "cave_bat": 1.0}
    for key, wx, wy, _ in actors:
        if key == "hero_living":
            continue
        bx, by = w2s(wx - 17, wy - 34)
        bw, bh = 34 * ZOOM, 4 * ZOOM
        for y in range(int(by - 1), int(by + bh + 1)):
            for x in range(int(bx - 1), int(bx + bw + 1)):
                inner = bx <= x < bx + bw and by <= y < by + bh
                col = (39, 39, 48) if inner else (9, 9, 11)
                if inner and x < bx + bw * hp[key]:
                    col = (239, 68, 68) if y > by + 1 else (252, 165, 165)
                blend(scr, x, y, col, 0.95)

    # --- numeros de combate (Cinzel-like, T-116) ---
    wx_, wy_ = w2s(402, 262 - 48)
    texts.append(text_item("47", wx_ + 10, wy_ - 4, 17, (255, 247, 237), FONT_TITLE, True, "c", (5, 7, 12, 240), 3.5))
    kx, ky = w2s(232, 196 - 58)
    texts.append(text_item("CRÍTICO!", kx, ky - 12, 11, (253, 224, 71), FONT_TITLE, True, "c", (60, 20, 4, 240), 3))
    texts.append(text_item("128", kx, ky + 6, 21, (250, 204, 21), FONT_TITLE, True, "c", (60, 20, 4, 245), 4))
    texts.append(text_item("[Elmo do Abismo (Lendário)]", lx, ly - 34, 11, (249, 115, 22), FONT_BODY, True, "c",
                           (5, 7, 12, 240), 3))

    # --- HUD ---
    icons = slice_sheet(read_png(SPRITES_DIR / "ui_icons.png"), 64, 64)
    portraits = slice_sheet(read_png(SPRITES_DIR / "portraits.png"), 128, 128)
    draw_hud(scr, icons, portraits, texts)

    for i in range(SW * SH):
        scr.buf[i * 4 + 3] = 255
    render_text_overlay(scr, texts, OUT_PNG)
    print(f"Gerado: {OUT_PNG}")


if __name__ == "__main__":
    main()
