"""
SUBMUNDO - Gerador dos assets 2.5D da Vila Natal / hub do prologo (M9, BRF-147 / T-133)
=======================================================================================

Pixel art 2.5D (top-down 3/4) no padrao do heroi e dos biomas, luz quente de fim de tarde
vinda do alto a esquerda (sombras curtas para baixo/direita). Gera de forma deterministica:

- public/assets/sprites/village_hub_tiles.png     32x32  terra batida, grama, transicoes (Wang de cantos),
                                                         caminho ate o portao, calcamento (de biome_village_tiles)
- public/assets/sprites/village_hub_house.png     176x160 casa de palha (curandeira)
- public/assets/sprites/village_hub_palisade.png  32x80  trechos da palicada (h, v, canto, ponta, espeto)
- public/assets/sprites/village_hub_gate.png      176x152 portao de pedra com viga e placa "SAIDA" (fechado/aberto)
- public/assets/sprites/village_hub_campfire.png  64x64  fogueira com pedras (6f animada)
- public/assets/sprites/village_hub_forge.png     64x80  forja de pedra com brasa (4f animada)
- public/assets/sprites/village_hub_brazier.png   32x64  braseiro (4f animado)
- public/assets/sprites/village_hub_torch.png     32x80  tocha de poste da palicada (4f animada)
- public/assets/sprites/village_hub_cart.png      112x80 carroca
- public/assets/sprites/village_hub_props.png     64x64  bigorna, lenha, barril, caixote, sacos, potes, ervas,
                                                         armas, banco, balde
- public/assets/sprites/village_hub_light.png     128x128 halo de luz quente (blend ADD, opcional)
- scripts/art/out/village_hub.manifest.json       fragmento no formato do manifest.json
- assets/mockups/preview_m9_village_sheets.png    prancha rotulada + amostra montada

Convencoes:
- Objetos grandes tem origem nos pes (`origin` em fracao do frame, como `props_tall`).
- `footprints[frame]` = lista de retangulos de colisao em px, RELATIVOS AO PONTO DE ORIGEM
  (x/y do canto superior esquerdo; y negativo = para cima da linha dos pes).
- Transicoes terra<->grama: `edge_<nw><ne><sw><se>` (1 = grama naquele canto do tile; Wang de cantos).
  Para montar, defina um grid de vertices (linhas+1 x colunas+1) com 1=grama; o tile (r,c) usa os
  vertices (r,c),(r,c+1),(r+1,c),(r+1,c+1). Todos-0 = `dirt_*`, todos-1 = `grass_*`.

Uso: py scripts/art/buildVillageHub.py   (requer Pillow)
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Callable, Dict, List, Optional, Sequence, Tuple

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SPRITES = ROOT / "public" / "assets" / "sprites"
MOCKUPS = ROOT / "assets" / "mockups"
OUT_DIR = Path(__file__).resolve().parent / "out"

RGB = Tuple[int, int, int]
OUTLINE: RGB = (9, 9, 11)
T = 32


# ---------------------------------------------------------------------------
# Ruido e cor
# ---------------------------------------------------------------------------

def h01(x: int, y: int, s: int = 0) -> float:
    n = (x * 374761393 + y * 668265263 + s * 982451653) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    n = (n ^ (n >> 16)) & 0xFFFFFFFF
    return (n & 0xFFFFFF) / float(0x1000000)


def vnoise(x: float, y: float, period: int, s: int, cell: float = 8.0) -> float:
    px, py = x / cell, y / cell
    n = max(1, int(round(period / cell)))
    x0, y0 = int(math.floor(px)), int(math.floor(py))
    fx, fy = px - x0, py - y0
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)

    def v(ix: int, iy: int) -> float:
        return h01(ix % n, iy % n, s)

    a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * fx
    b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * fx
    return a + (b - a) * fy


def mix(a: RGB, b: RGB, t: float) -> RGB:
    t = max(0.0, min(1.0, t))
    return (int(round(a[0] + (b[0] - a[0]) * t)), int(round(a[1] + (b[1] - a[1]) * t)),
            int(round(a[2] + (b[2] - a[2]) * t)))


WARM: RGB = (255, 226, 168)
COOL: RGB = (22, 16, 30)


def sh(c: RGB, k: float) -> RGB:
    """k>0 clareia puxando para a luz quente; k<0 escurece puxando para sombra fria."""
    return mix(c, WARM, k) if k >= 0 else mix(c, COOL, -k)


def ramp(r: Sequence[RGB], i: int) -> RGB:
    return r[max(0, min(len(r) - 1, i))]


# Paletas (fim de tarde, terra/madeira quentes, sombras puxando para roxo-frio)
DIRT = [(48, 39, 35), (64, 53, 45), (80, 67, 55), (97, 81, 65), (115, 97, 77), (136, 116, 92), (160, 139, 111)]
PATH = [(60, 50, 42), (78, 66, 54), (98, 84, 68), (118, 101, 81), (138, 119, 95), (160, 140, 112), (184, 164, 132)]
GRASS = [(26, 34, 24), (36, 48, 28), (48, 63, 33), (63, 80, 39), (84, 99, 46), (112, 122, 56), (148, 148, 72)]
WOOD = [(34, 23, 20), (56, 38, 28), (82, 57, 38), (110, 78, 50), (140, 102, 64), (174, 134, 86), (204, 168, 112)]
WOOD_GREY = [(36, 30, 30), (56, 48, 44), (78, 68, 58), (102, 90, 74), (128, 114, 92), (156, 140, 112), (186, 170, 136)]
THATCH = [(54, 40, 24), (80, 60, 32), (110, 84, 44), (140, 108, 58), (170, 134, 74), (200, 164, 98), (226, 196, 130)]
STONE = [(34, 32, 38), (52, 50, 56), (72, 70, 74), (94, 91, 92), (118, 113, 110), (144, 137, 128), (172, 163, 148)]
IRON = [(16, 16, 20), (30, 30, 36), (46, 46, 54), (66, 66, 76), (92, 92, 102), (128, 126, 132), (176, 170, 166)]
ROPE = [(70, 54, 36), (110, 88, 56), (150, 124, 82), (186, 160, 110)]
MOSS = [(40, 52, 30), (58, 72, 36), (80, 94, 44)]
FIRE = [(110, 28, 14), (176, 54, 18), (232, 102, 26), (250, 160, 46), (253, 214, 96), (255, 244, 196)]
CLOTH = [(52, 40, 34), (84, 66, 50), (118, 96, 70), (150, 126, 92)]
BURLAP = [(70, 54, 38), (112, 90, 60), (150, 124, 84), (184, 158, 110), (208, 186, 136)]
CLAY = [(66, 36, 28), (100, 56, 38), (136, 80, 52), (170, 108, 70), (198, 140, 96)]


# ---------------------------------------------------------------------------
# Canvas
# ---------------------------------------------------------------------------

class Cv:
    def __init__(self, w: int, h: int) -> None:
        self.w, self.h = w, h
        self.a: List[List[Tuple[int, int, int, int]]] = [[(0, 0, 0, 0)] * w for _ in range(h)]

    def get(self, x: int, y: int) -> Tuple[int, int, int, int]:
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.a[y][x]
        return (0, 0, 0, 0)

    def alpha(self, x: int, y: int) -> int:
        return self.get(x, y)[3]

    def set(self, x: int, y: int, c: RGB, a: int = 255) -> None:
        x, y = int(x), int(y)
        if not (0 <= x < self.w and 0 <= y < self.h):
            return
        if a >= 255:
            self.a[y][x] = (c[0], c[1], c[2], 255)
            return
        if a <= 0:
            return
        r, g, b, A = self.a[y][x]
        if A == 0:
            self.a[y][x] = (c[0], c[1], c[2], a)
            return
        al, Al = a / 255.0, A / 255.0
        oa = al + Al * (1 - al)
        self.a[y][x] = (int(round((c[0] * al + r * Al * (1 - al)) / oa)),
                        int(round((c[1] * al + g * Al * (1 - al)) / oa)),
                        int(round((c[2] * al + b * Al * (1 - al)) / oa)), int(round(oa * 255)))

    def under(self, x: int, y: int, c: RGB, a: int) -> None:
        """Pinta so onde esta vazio (sombras projetadas)."""
        if self.alpha(x, y) == 0:
            self.set(x, y, c, a)

    def img(self) -> Image.Image:
        im = Image.new("RGBA", (self.w, self.h))
        im.putdata([p for row in self.a for p in row])
        return im

    @staticmethod
    def from_img(im: Image.Image) -> "Cv":
        im = im.convert("RGBA")
        cv = Cv(im.width, im.height)
        b = im.tobytes()
        data = [tuple(b[i:i + 4]) for i in range(0, len(b), 4)]
        cv.a = [data[y * im.width:(y + 1) * im.width] for y in range(im.height)]
        return cv

    def paste(self, src: "Cv", ox: int, oy: int) -> None:
        for y in range(src.h):
            for x in range(src.w):
                p = src.a[y][x]
                if p[3]:
                    self.set(ox + x, oy + y, p[:3], p[3])


def mask(w: int, h: int, draw: Callable[[ImageDraw.ImageDraw], None]):
    m = Image.new("L", (w, h), 0)
    draw(ImageDraw.Draw(m))
    return m


def fill(cv: Cv, m: Image.Image, fn: Callable[[int, int], Optional[RGB]], a: int = 255) -> None:
    bb = m.getbbox()
    if not bb:
        return
    px = m.load()
    for y in range(bb[1], bb[3]):
        for x in range(bb[0], bb[2]):
            if px[x, y] > 127:
                c = fn(x, y)
                if c is not None:
                    cv.set(x, y, c, a)


def fill_poly(cv: Cv, pts, fn, a: int = 255) -> None:
    fill(cv, mask(cv.w, cv.h, lambda d: d.polygon(pts, fill=255)), fn, a)


def fill_ellipse(cv: Cv, box, fn, a: int = 255) -> None:
    fill(cv, mask(cv.w, cv.h, lambda d: d.ellipse(box, fill=255)), fn, a)


def fill_rect(cv: Cv, x0: int, y0: int, x1: int, y1: int, fn, a: int = 255) -> None:
    for y in range(y0, y1):
        for x in range(x0, x1):
            c = fn(x, y) if callable(fn) else fn
            if c is not None:
                cv.set(x, y, c, a)


def line(cv: Cv, x0: int, y0: int, x1: int, y1: int, c, a: int = 255) -> None:
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        cv.set(x0, y0, c(x0, y0) if callable(c) else c, a)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def outline(cv: Cv, c: RGB = OUTLINE, thr: int = 160, a: int = 255) -> None:
    pts = []
    for y in range(cv.h):
        for x in range(cv.w):
            if cv.a[y][x][3] == 0:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if cv.alpha(x + dx, y + dy) >= thr:
                        pts.append((x, y))
                        break
    for x, y in pts:
        cv.set(x, y, c, a)


def drop_shadow(cv: Cv, cx: float, cy: float, rx: float, ry: float, a: int = 90, skew: float = 0.0) -> None:
    """Sombra eliptica no chao (so em pixels vazios). skew desloca para a direita conforme sobe."""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx - abs(skew) * ry) - 1, int(cx + rx + abs(skew) * ry) + 2):
            ox = cx + skew * (cy - y)
            d = ((x + 0.5 - ox) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
            if d <= 1.0:
                k = 1.0 if d < 0.55 else (1.0 - d) / 0.45
                cv.under(x, y, (18, 12, 22), int(a * (0.55 + 0.45 * k)))


# ---------------------------------------------------------------------------
# Terreno (tiles 32x32, todos periodicos em 32 px)
# ---------------------------------------------------------------------------

def dirt_idx(x: int, y: int) -> int:
    n = 0.3 * vnoise(x, y, 32, 11, 8) + 0.7 * vnoise(x, y, 32, 12, 4)
    g = h01(x % 32, y % 32, 13)
    v = n + (g - 0.5) * 0.35
    i = 3 + int(round((v - 0.5) * 2.5))
    if g > 0.965:
        i += 1
    elif g < 0.03:
        i -= 1
    return max(1, min(5, i))


def grass_px(x: int, y: int) -> RGB:
    x, y = x % 32, y % 32
    n = 0.6 * vnoise(x, y, 32, 21, 8) + 0.4 * vnoise(x, y, 32, 22, 4)
    i = 2 + int(round((n - 0.45) * 3.0))
    # laminas: ponta clara com sombra embaixo (leitura 2.5D)
    if h01(x, y, 23) < 0.16:
        i += 2
    elif h01(x, (y - 1) % 32, 23) < 0.16:
        i -= 1
    elif h01(x, (y + 1) % 32, 23) < 0.16:
        i += 1
    if h01(x, y, 24) < 0.025:
        i -= 2
    return ramp(GRASS, max(1, min(5, i)))


def tile_mask(corners: Tuple[int, int, int, int]) -> Callable[[int, int], bool]:
    nw, ne, sw, se = corners

    def m(x: int, y: int) -> bool:
        u, v = (x + 0.5) / 32.0, (y + 0.5) / 32.0
        top = nw + (ne - nw) * u
        bot = sw + (se - sw) * u
        val = top + (bot - top) * v
        val += 0.42 * (vnoise(x % 32, y % 32, 32, 31, 8) - 0.5) + 0.2 * (vnoise(x % 32, y % 32, 32, 32, 4) - 0.5)
        return val > 0.5
    return m


def terrain_tile(corners: Tuple[int, int, int, int], dirt_fn: Callable[[int, int], RGB] = None) -> Cv:
    cv = Cv(T, T)
    m = tile_mask(corners)
    dfn = dirt_fn or (lambda x, y: ramp(DIRT, dirt_idx(x, y)))
    for y in range(T):
        for x in range(T):
            if m(x, y):
                c = grass_px(x, y)
                if not m(x, y + 1):            # borda inferior da grama: pontas ao sol
                    c = ramp(GRASS, 4 if h01(x, y, 41) < 0.6 else 5)
                elif not m(x, y + 2):
                    c = sh(c, 0.12)
                elif not m(x, y - 1) or not m(x - 1, y) or not m(x + 1, y):
                    c = sh(c, -0.18)
                cv.set(x, y, c)
            else:
                c = dfn(x, y)
                if m(x, y - 1):                # sombra da grama sobre a terra
                    c = ramp(GRASS, 2) if h01(x, y, 42) < 0.4 else sh(c, -0.42)
                elif m(x, y - 2):
                    c = sh(c, -0.28)
                elif m(x, y - 3):
                    c = sh(c, -0.12)
                elif m(x - 1, y) or m(x + 1, y):
                    c = sh(c, -0.15)
                cv.set(x, y, c)
    return cv


def pebble(cv: Cv, x: int, y: int, w: int = 3, h: int = 2, tone: Sequence[RGB] = STONE) -> None:
    for yy in range(h):
        for xx in range(w):
            i = 5 if (xx == 0 or yy == 0) and not (xx == w - 1 and yy == h - 1) else 3
            if xx == w - 1 and yy == h - 1:
                i = 2
            cv.set(x + xx, y + yy, tone[i])
    for xx in range(1, w + 1):
        cv.set(x + xx, y + h, (20, 14, 18), 110)


def tuft(cv: Cv, x: int, y: int, s: int) -> None:
    """Tufo de grama 2.5D sobre a terra (base em y)."""
    w = 3 + int(h01(x, y, s) * 3)
    for xx in range(-1, w + 1):
        cv.set(x + xx, y + 1, (20, 14, 18), 90)
    for xx in range(w):
        hgt = 2 + int(h01(x + xx, y, s + 1) * 3)
        for k in range(hgt):
            i = 2 if k == 0 else (5 if k == hgt - 1 else 4 if k == hgt - 2 else 3)
            lean = 1 if (k == hgt - 1 and h01(xx, y, s + 2) < 0.3) else 0
            cv.set(x + xx + lean, y - k, GRASS[i])


def build_tiles() -> Tuple[Image.Image, List[str]]:
    frames: List[Tuple[str, Cv]] = []
    D = (0, 0, 0, 0)

    def dirt_var(seed: int, deco: Callable[[Cv], None] = None) -> Cv:
        cv = terrain_tile(D)
        for y in range(4, 28):
            for x in range(4, 28):
                if h01(x, y, seed) < 0.03:
                    cv.set(x, y, ramp(DIRT, dirt_idx(x, y) + (1 if h01(x, y, seed + 1) < 0.5 else -1)))
        if deco:
            deco(cv)
        return cv

    frames.append(("dirt_0", dirt_var(101)))
    frames.append(("dirt_1", dirt_var(102, lambda cv: (pebble(cv, 22, 9), pebble(cv, 7, 22, 2, 2)))))
    frames.append(("dirt_2", dirt_var(103, lambda cv: (pebble(cv, 12, 14, 2, 1), tuft(cv, 21, 25, 7)))))
    frames.append(("dirt_3", dirt_var(104, lambda cv: pebble(cv, 17, 20, 3, 2))))

    def pebbles(cv: Cv) -> None:
        for i, (px, py, w, h) in enumerate(((5, 6, 3, 2), (20, 4, 2, 2), (13, 13, 4, 3), (24, 18, 3, 2),
                                            (6, 22, 2, 1), (17, 25, 3, 2), (27, 9, 2, 1))):
            pebble(cv, px, py, w, h)
    frames.append(("dirt_pebbles", dirt_var(105, pebbles)))

    def cracks(cv: Cv) -> None:
        x, y = 6, 9
        for k in range(22):
            cv.set(x, y, DIRT[0])
            cv.set(x, y + 1, DIRT[5])
            x += 1
            y += (1 if h01(k, 0, 9) < 0.3 else -1 if h01(k, 0, 9) > 0.8 else 0)
            y = max(4, min(26, y))
            if k == 9:
                bx, by = x, y
        for k in range(8):
            cv.set(bx, by + k, DIRT[0])
            cv.set(bx + 1, by + k, DIRT[4])
            bx += 1 if k % 3 == 2 else 0
    frames.append(("dirt_cracks", dirt_var(106, cracks)))

    def tufts(cv: Cv) -> None:
        for i, (px, py) in enumerate(((6, 9), (19, 7), (11, 21), (24, 25), (26, 14))):
            tuft(cv, px, py, 60 + i)
    frames.append(("dirt_tufts", dirt_var(107, tufts)))

    def stain(cv: Cv) -> None:
        for y in range(5, 27):
            for x in range(5, 27):
                d = math.hypot((x - 16) / 10.0, (y - 16) / 7.0) + (vnoise(x, y, 32, 77, 4) - 0.5) * 0.6
                if d < 1.0:
                    p = cv.get(x, y)
                    cv.set(x, y, sh(p[:3], -0.28 if d < 0.7 else -0.14))
        for px, py in ((12, 13), (19, 17)):
            pebble(cv, px, py, 2, 1)
    frames.append(("dirt_damp", dirt_var(108, stain)))

    G = (1, 1, 1, 1)

    def grass_var(seed: int, deco: Callable[[Cv], None] = None) -> Cv:
        cv = terrain_tile(G)
        if deco:
            deco(cv)
        return cv

    frames.append(("grass_0", grass_var(201)))

    def g1(cv: Cv) -> None:
        for px, py in ((8, 10), (22, 20)):
            for k in range(4):
                cv.set(px + k % 2, py - k, GRASS[4 + (k == 3)])
    frames.append(("grass_1", grass_var(202, g1)))

    def g2(cv: Cv) -> None:
        pebble(cv, 15, 12, 4, 3)
        pebble(cv, 24, 24, 2, 2)
    frames.append(("grass_2", grass_var(203, g2)))

    def flowers(cv: Cv) -> None:
        cols = [(236, 222, 170), (222, 150, 70), (196, 120, 160), (240, 200, 90)]
        for i, (px, py) in enumerate(((6, 7), (14, 5), (24, 10), (9, 18), (20, 21), (27, 27), (4, 27), (16, 13))):
            c = cols[i % 4]
            cv.set(px, py + 1, GRASS[1])
            cv.set(px, py, c)
            cv.set(px + 1, py, sh(c, -0.3))
            cv.set(px, py - 1, sh(c, 0.3))
    frames.append(("grass_flowers", grass_var(204, flowers)))

    def tall(cv: Cv) -> None:
        for i, (px, py) in enumerate(((5, 14), (16, 9), (21, 26), (10, 28), (26, 17))):
            hgt = 6 + int(h01(px, py, 5) * 4)
            for xx in range(4):
                for k in range(hgt - abs(xx - 1) * 2):
                    lean = (k * (1 if xx >= 2 else -1)) // 5
                    i2 = 2 if k < 2 else 5 if k >= hgt - abs(xx - 1) * 2 - 1 else 4 if xx < 2 else 3
                    cv.set(px + xx + lean, py - k, GRASS[i2])
            for xx in range(-1, 5):
                cv.set(px + xx, py + 1, (16, 12, 16), 110)
    frames.append(("grass_tall", grass_var(205, tall)))

    for bits in range(1, 15):
        c = ((bits >> 3) & 1, (bits >> 2) & 1, (bits >> 1) & 1, bits & 1)
        frames.append(("edge_%d%d%d%d" % c, terrain_tile(c)))

    # caminho batido ate o portao: clareia para o centro e volta ao tom da terra nas bordas
    def path_fn(axis: str) -> Callable[[int, int], RGB]:
        def f(x: int, y: int) -> RGB:
            a = x if axis == "v" else y
            b = y if axis == "v" else x
            if axis == "x":
                t = max(0.0, 1.0 - math.hypot(x - 15.5, y - 15.5) / 16.0)
            else:
                t = max(0.0, 1.0 - abs(a - 15.5) / 16.0)
            t = t * t * (3 - 2 * t)
            i = dirt_idx(x, y)
            c = mix(ramp(DIRT, i), ramp(PATH, i + (1 if h01(x % 32, y % 32, 51) < 0.5 else 0)), min(1.0, t * 1.6))
            if axis != "x":
                for r in (9, 22):            # sulcos de roda
                    if a in (r, r + 1):
                        c = sh(c, -0.3) if a == r else sh(c, -0.18)
                    elif a == r + 2:
                        c = sh(c, 0.12)
                    elif a == r - 1:
                        c = sh(c, -0.1)
            return c
        return f

    for name, ax in (("path_v", "v"), ("path_h", "h"), ("path_x", "x")):
        cv = terrain_tile(D, path_fn(ax))
        for i in range(7):
            px, py = int(h01(i, 3, ord(ax)) * 24) + 4, int(h01(i, 4, ord(ax)) * 24) + 4
            if ax == "x" or i % 2 == 0:
                pebble(cv, px, py, 2, 1)
        frames.append((name, cv))

    # calcamento reaproveitado da Vila aprovada (soleira do portao)
    src = Image.open(SPRITES / "biome_village_tiles.png").convert("RGBA")
    for i, name in ((0, "cobble_0"), (1, "cobble_1")):
        frames.append((name, Cv.from_img(src.crop((i * T, 0, i * T + T, T)))))

    sheet = Image.new("RGBA", (T * len(frames), T))
    for i, (_, cv) in enumerate(frames):
        sheet.paste(cv.img(), (i * T, 0))
    return sheet, [n for n, _ in frames]


# ---------------------------------------------------------------------------
# Madeira / pedra
# ---------------------------------------------------------------------------

def log_px(xx: int, x0: int, w: int, yy: int, seed: int, pal: Sequence[RGB] = WOOD) -> RGB:
    t = (xx - x0 + 0.5) / w
    i = 5 if t < 0.18 else 4 if t < 0.42 else 3 if t < 0.68 else 2 if t < 0.88 else 1
    n = h01(xx * 3 + seed, yy // 3, seed)
    if n < 0.2:
        i -= 1
    elif n > 0.93:
        i += 1
    if h01(xx, yy, seed + 5) < 0.04:
        i -= 1
    return ramp(pal, i)


def stake(cv: Cv, x: int, base: int, h: int, w: int = 7, seed: int = 0, tip: int = 7,
          broken: bool = False, pal: Sequence[RGB] = WOOD) -> None:
    top = base - h
    cx = x + w / 2.0
    for yy in range(top, base + 1):
        r = yy - top
        for xx in range(x, x + w):
            if broken:
                if r < int(h01(xx, seed, 3) * 5):
                    continue
                c = log_px(xx, x, w, yy, seed, pal)
                if r < int(h01(xx, seed, 3) * 5) + 2:
                    c = pal[6] if xx < cx else pal[4]
            elif r < tip:
                half = (r + 1) / tip * w / 2.0
                if abs(xx + 0.5 - cx) > half:
                    continue
                c = pal[6] if xx + 0.5 < cx - 0.5 else pal[5] if xx + 0.5 < cx + 0.5 else pal[3]
                if h01(xx, yy, seed + 9) < 0.15:
                    c = sh(c, -0.15)
            else:
                c = log_px(xx, x, w, yy, seed, pal)
            if base - yy < 4:
                c = sh(c, -0.25)
            cv.set(xx, yy, c)


def rope_band(cv: Cv, x0: int, x1: int, y: int, solid_only: bool = True) -> None:
    for xx in range(x0, x1):
        for k in range(2):
            if solid_only and cv.alpha(xx, y + k) < 200:
                continue
            c = ROPE[3 - k] if (xx + k) % 3 else ROPE[0]
            cv.set(xx, y + k, c)
        if not solid_only or cv.alpha(xx, y + 2) >= 200:
            cv.set(xx, y + 2, (20, 14, 18), 120)


def stone_block(cv: Cv, x0: int, y0: int, w: int, h: int, seed: int, pal: Sequence[RGB] = STONE,
                moss: float = 0.0, base: int = 3) -> None:
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            # cantos arredondados
            if (x in (x0, x0 + w - 1)) and (y in (y0, y0 + h - 1)):
                continue
            n = vnoise(x, y, 64, seed, 3)
            i = base + (1 if n > 0.62 else -1 if n < 0.3 else 0)
            if y == y0 or x == x0:
                i = base + 2
            elif y == y0 + 1 and x < x0 + w - 2:
                i = max(i, base + 1)
            if y == y0 + h - 1 or x == x0 + w - 1:
                i = base - 1
            if h01(x, y, seed) < 0.05:
                i -= 1
            c = ramp(pal, i)
            if moss and y > y0 + h - 4 and vnoise(x, y, 64, seed + 3, 3) < moss:
                c = ramp(MOSS, 1 + (y == y0 + h - 2))
            cv.set(x, y, c)


# ---------------------------------------------------------------------------
# Palicada (32x80, origem nos pes: 0.5, 76/80)
# ---------------------------------------------------------------------------

PAL_W, PAL_H, PAL_BASE = 32, 80, 76


def palisade_mound(cv: Cv, x0: int, x1: int, base: int) -> None:
    for x in range(x0, x1):
        hgt = 1 + int(vnoise(x, 0, 32, 5, 4) * 3)
        for k in range(hgt):
            cv.set(x, base + 1 - k, ramp(DIRT, 2 + (k == hgt - 1) * 2 - (k == 0)))


def palisade_h(seed: int, broken_at: int = -1) -> Cv:
    cv = Cv(PAL_W, PAL_H)
    b = PAL_BASE
    # trilho de tras (aparece nas frestas)
    for x in range(PAL_W):
        for y, i in ((b - 36, 2), (b - 35, 1), (b - 34, 1), (b - 16, 2), (b - 15, 1), (b - 14, 1)):
            cv.set(x, y, WOOD[i])
    for k in range(4):
        hgt = 52 + int(h01(k, seed, 7) * 9)
        stake(cv, k * 8, b, hgt, 7, seed * 10 + k, broken=(k == broken_at),
              pal=WOOD if h01(k, seed, 8) > 0.25 else WOOD_GREY)
        if k == broken_at:
            pass
    rope_band(cv, 0, PAL_W, b - 38)
    rope_band(cv, 0, PAL_W, b - 18)
    outline(cv)
    palisade_mound(cv, 0, PAL_W, b)
    for x in range(PAL_W):          # sombra curta projetada para baixo
        cv.under(x, b + 2, (18, 12, 22), 120)
        cv.under(x, b + 3, (18, 12, 22), 70)
    return cv


def palisade_v(seed: int) -> Cv:
    cv = Cv(PAL_W, PAL_H)
    for i, bb in enumerate((PAL_BASE - 24, PAL_BASE - 16, PAL_BASE - 8, PAL_BASE)):
        hgt = 52 + int(h01(i, seed, 17) * 8)
        x = 12 + (1 if h01(i, seed, 18) < 0.4 else 0)
        stake(cv, x, bb, hgt, 8, seed * 10 + i, pal=WOOD if h01(i, seed, 19) > 0.25 else WOOD_GREY)
        for yy in range(bb - hgt + 9, bb + 1):     # face de tras na sombra (lado direito)
            cv.set(x + 7, yy, WOOD[1])
        cv.set(x + 8, bb, (18, 12, 22), 140)
    for y in range(PAL_BASE - 44, PAL_BASE - 4, 2):  # amarracao diagonal
        if cv.alpha(13, y) >= 200:
            cv.set(13 + (y // 2) % 6, y, ROPE[2])
    outline(cv)
    for y in range(0, PAL_H):
        if cv.alpha(20, y) == 255 and cv.get(20, y)[:3] == OUTLINE:
            cv.under(21, y, (18, 12, 22), 110)
            cv.under(22, y, (18, 12, 22), 60)
    palisade_mound(cv, 9, 23, PAL_BASE)
    return cv


def palisade_corner() -> Cv:
    cv = Cv(PAL_W, PAL_H)
    stake(cv, 5, PAL_BASE - 8, 54, 7, 301, pal=WOOD_GREY)
    stake(cv, 20, PAL_BASE - 6, 52, 7, 302)
    stake(cv, 10, PAL_BASE, 66, 12, 303, tip=9)
    rope_band(cv, 4, 28, PAL_BASE - 40)
    rope_band(cv, 4, 28, PAL_BASE - 20)
    outline(cv)
    palisade_mound(cv, 3, 30, PAL_BASE)
    drop_shadow(cv, 18, PAL_BASE + 2, 13, 3, 110)
    return cv


def palisade_post() -> Cv:
    cv = Cv(PAL_W, PAL_H)
    stake(cv, 17, PAL_BASE - 3, 44, 7, 311, pal=WOOD_GREY)
    stake(cv, 9, PAL_BASE, 60, 9, 312, tip=8)
    rope_band(cv, 9, 18, PAL_BASE - 30)
    outline(cv)
    palisade_mound(cv, 7, 26, PAL_BASE)
    drop_shadow(cv, 16, PAL_BASE + 2, 10, 3, 110)
    return cv


def palisade_spikes() -> Cv:
    """Estacas afiadas inclinadas para fora (defesa), como na referencia."""
    cv = Cv(PAL_W, PAL_H)
    for k, (x0, y0, x1, y1) in enumerate(((4, 76, 24, 34), (14, 76, 30, 42), (20, 76, 6, 40))):
        n = 40
        for s in range(n + 1):
            t = s / n
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t
            w = 2 if t > 0.82 else 3 if t > 0.6 else 4
            for d in range(-w // 2, w - w // 2):
                c = WOOD[6] if t > 0.88 else log_px(int(x) + d, int(x) - w // 2, w, int(y), 320 + k)
                cv.set(int(x) + d, int(y), c)
    rope_band(cv, 6, 26, 58, True)
    outline(cv)
    palisade_mound(cv, 2, 30, PAL_BASE)
    drop_shadow(cv, 17, PAL_BASE + 2, 13, 3, 110)
    return cv


def build_palisade():
    frames = [
        ("h_0", palisade_h(1)), ("h_1", palisade_h(2)), ("h_broken", palisade_h(3, broken_at=2)),
        ("v_0", palisade_v(4)), ("v_1", palisade_v(5)),
        ("corner", palisade_corner()), ("post", palisade_post()), ("spikes", palisade_spikes()),
    ]
    fp = {
        "h_0": [[-16, -6, 32, 6]], "h_1": [[-16, -6, 32, 6]], "h_broken": [[-16, -6, 32, 6]],
        "v_0": [[-5, -32, 10, 32]], "v_1": [[-5, -32, 10, 32]],
        "corner": [[-10, -10, 20, 10]], "post": [[-6, -6, 12, 6]], "spikes": [[-12, -6, 24, 6]],
    }
    return frames, fp


# ---------------------------------------------------------------------------
# Fogo (animacoes com loop perfeito)
# ---------------------------------------------------------------------------

def flame(cv: Cv, cx: float, base: int, w: float, h: int, f: int, nf: int, seed: int,
          strength: float = 1.0) -> None:
    P = 48
    for y in range(base - h - 2, base + 1):
        v = (base - y) / float(h)
        if v < 0:
            continue
        sway = math.sin(2 * math.pi * f / nf + v * 3.2) * v * w * 0.35
        for x in range(int(cx - w - 3), int(cx + w + 4)):
            dx = (x + 0.5 - cx - sway) / (w * (1.0 - 0.55 * v))
            n = vnoise(x * 1.0 + 100, y + f * (P / nf), P, seed, 4)
            n2 = vnoise(x * 1.0 + 300, y + f * (2 * P / nf), P, seed + 1, 3)
            I = (1.0 - abs(dx) ** 1.6) * strength - v * 0.95 + (n - 0.5) * 0.9 + (n2 - 0.5) * 0.35 * v + 0.15
            if I > 0.9:
                c = FIRE[5]
            elif I > 0.66:
                c = FIRE[4]
            elif I > 0.42:
                c = FIRE[3]
            elif I > 0.22:
                c = FIRE[2]
            elif I > 0.08:
                c = FIRE[1]
            else:
                continue
            cv.set(x, y, c)


def sparks(cv: Cv, cx: float, base: int, h: int, w: float, f: int, nf: int, seed: int, n: int = 4) -> None:
    for k in range(n):
        span = h
        ph = (h01(k, 0, seed) + f / float(nf)) % 1.0
        y = base - int(ph * span) - 4
        x = cx + (h01(k, 1, seed) - 0.5) * w * 2 + math.sin(ph * 6.28 + k) * 2
        cv.set(int(x), y, FIRE[4] if ph < 0.6 else FIRE[2])


def glow_disc(cv: Cv, cx: float, cy: float, rx: float, ry: float, a: int) -> None:
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
            if d < 1:
                cv.under(x, y, (255, 150, 60), int(a * (1 - d) ** 1.5))


def build_campfire() -> List[Tuple[str, Cv]]:
    out = []
    nf = 6
    cx, cy = 32, 50
    stones = []
    for k in range(11):
        ang = 2 * math.pi * k / 11 + 0.2
        stones.append((cx + math.cos(ang) * 19, cy + math.sin(ang) * 8.5, k))
    for f in range(nf):
        cv = Cv(64, 64)
        # cinzas e brasa no chao
        fill_ellipse(cv, (cx - 15, cy - 6, cx + 15, cy + 6),
                     lambda x, y: (40, 32, 34) if h01(x, y, 5) > 0.2 else (70, 60, 58))
        for x in range(cx - 10, cx + 11):
            for y in range(cy - 4, cy + 4):
                if h01(x, y, 6 + f // 2) < 0.18 and ((x - cx) / 10) ** 2 + ((y - cy) / 4) ** 2 < 1:
                    cv.set(x, y, FIRE[2] if h01(x, y, 7 + f) < 0.5 else FIRE[1])
        # pedras de tras
        for sx, sy, k in sorted(stones, key=lambda s: s[1]):
            if sy < cy:
                stone_block(cv, int(sx) - 4, int(sy) - 3, 8, 6, 40 + k, base=3)
        # lenha cruzada
        for (x0, y0, x1, y1, s) in ((cx - 13, cy + 3, cx + 9, cy - 5, 1), (cx + 13, cy + 3, cx - 9, cy - 5, 2),
                                    (cx - 3, cy + 5, cx + 4, cy - 7, 3)):
            n = 30
            for i in range(n + 1):
                t = i / n
                x = x0 + (x1 - x0) * t
                y = y0 + (y1 - y0) * t
                for d in range(-1, 3):
                    c = ramp(WOOD, (3 if d <= 0 else 2 if d == 1 else 1))
                    if t > 0.55:
                        c = sh(c, -0.55) if h01(int(x), int(y) + d, 8) > 0.3 else FIRE[1]
                    cv.set(int(x), int(y) + d, c)
            cv.set(x0, y0, WOOD[5])
            cv.set(x0, y0 + 1, WOOD[4])
        flame(cv, cx, cy, 10, 34, f, nf, 61)
        sparks(cv, cx, cy - 20, 22, 7, f, nf, 62, 5)
        for sx, sy, k in sorted(stones, key=lambda s: s[1]):
            if sy >= cy:
                stone_block(cv, int(sx) - 4, int(sy) - 3, 8, 6, 40 + k, base=3)
                # brilho quente do fogo na face voltada para dentro
                for xx in range(int(sx) - 3, int(sx) + 3):
                    p = cv.get(xx, int(sy) - 3)
                    if p[3]:
                        cv.set(xx, int(sy) - 3, mix(p[:3], FIRE[3], 0.35 + 0.1 * (f % 2)))
        outline(cv)
        drop_shadow(cv, cx + 1, cy + 3, 24, 8, 80)
        glow_disc(cv, cx, cy, 30, 13, 70 + 12 * ((f * 5) % 3))
        out.append(("campfire_%d" % f, cv))
    return out


def build_brazier() -> List[Tuple[str, Cv]]:
    out = []
    nf = 4
    for f in range(nf):
        cv = Cv(32, 64)
        # tripe de ferro
        for (x0, x1) in ((9, 13), (23, 19), (16, 16)):
            line(cv, x0, 61, x1, 40, IRON[3] if x0 < 16 else IRON[2])
            line(cv, x0 + (1 if x0 < 16 else -1 if x0 > 16 else 1), 61, x1 + 1, 40, IRON[1])
        for x in range(10, 23):
            cv.set(x, 50, IRON[2])
        # bacia
        fill_ellipse(cv, (5, 33, 27, 44), lambda x, y: ramp(IRON, 4 if x < 11 else 3 if x < 18 else 2) if y > 37 else IRON[1])
        for x in range(6, 27):
            cv.set(x, 35 + (1 if x in (6, 26) else 0), IRON[5] if x < 16 else IRON[4])
        for x in range(8, 25):                     # carvao em brasa
            for y in range(32, 36):
                if ((x - 16) / 8.5) ** 2 + ((y - 35) / 2.2) ** 2 < 1:
                    cv.set(x, y, FIRE[2] if h01(x, y, 70 + f) < 0.45 else (50, 30, 26))
        for x in (7, 25):
            cv.set(x, 34, IRON[5])
        flame(cv, 16, 35, 7, 26, f, nf, 71, 0.95)
        sparks(cv, 16, 20, 14, 5, f, nf, 72, 3)
        outline(cv)
        drop_shadow(cv, 17, 61, 9, 3, 100)
        out.append(("brazier_%d" % f, cv))
    return out


def build_torch() -> List[Tuple[str, Cv]]:
    out = []
    nf = 4
    for f in range(nf):
        cv = Cv(32, 80)
        for y in range(26, 77):
            for x in range(14, 18):
                cv.set(x, y, log_px(x, 14, 4, y, 81))
        for y in range(18, 28):                    # cabeca enrolada em pano
            for x in range(12, 20):
                if (x in (12, 19)) and y in (18, 27):
                    continue
                band = (y - 18) // 3 % 2
                cv.set(x, y, ramp(CLOTH, (3 if x < 15 else 2 if x < 18 else 1) - band))
        for y in (20, 24):
            for x in range(12, 20):
                cv.set(x, y, ROPE[1])
        flame(cv, 16, 19, 5, 18, f, nf, 83, 1.0)
        sparks(cv, 16, 8, 8, 4, f, nf, 84, 2)
        outline(cv)
        palisade_mound(cv, 12, 20, 76)
        drop_shadow(cv, 17, 77, 5, 2, 110)
        out.append(("torch_%d" % f, cv))
    return out


# ---------------------------------------------------------------------------
# Forja e bigorna
# ---------------------------------------------------------------------------

def build_forge() -> List[Tuple[str, Cv]]:
    out = []
    nf = 4
    for f in range(nf):
        cv = Cv(64, 80)
        pulse = [0.0, 0.35, 0.7, 0.35][f]
        # chamine (atras)
        for row, y in enumerate(range(6, 34, 7)):
            off = 0 if row % 2 == 0 else 4
            for bx in range(34 + off - 4, 54, 9):
                x0 = max(34, bx)
                x1 = min(54, bx + 9)
                if x1 - x0 >= 3:
                    stone_block(cv, x0, y, x1 - x0, 7, 500 + row * 5 + bx, base=2)
        for x in range(33, 55):
            cv.set(x, 5, STONE[4])
            cv.set(x, 4, STONE[3])
        # fumaca/brilho saindo da chamine
        for k in range(3):
            y = 2 - k
            cv.set(42 + (f + k) % 3, y, (90, 84, 88), 120)
        # corpo da forja: tampo (visto de cima) e face frontal
        for row, y in enumerate(range(44, 76, 8)):
            off = 0 if row % 2 == 0 else 6
            for bx in range(6 + off - 12, 58, 12):
                x0 = max(6, bx)
                x1 = min(58, bx + 12)
                if x1 - x0 >= 3:
                    stone_block(cv, x0, y, x1 - x0, 8, 600 + row * 7 + bx, base=3, moss=0.35 if row == 3 else 0)
        # tampo
        for y in range(30, 44):
            for x in range(4, 60):
                if (x in (4, 59)) and y in (30, 43):
                    continue
                i = 4 if y < 33 else 3
                if y == 43:
                    i = 1
                if x == 4:
                    i = 5
                if x == 59:
                    i = 2
                cv.set(x, y, ramp(STONE, i - (1 if h01(x, y, 610) < 0.12 else 0)))
        # leito de carvao em brasa no tampo
        for y in range(32, 41):
            for x in range(14, 50):
                d = ((x - 32) / 17.0) ** 2 + ((y - 36.5) / 4.6) ** 2
                if d < 1:
                    n = vnoise(x, y + f * 4, 16, 620, 3)
                    hot = n + (1 - d) * 0.6 + pulse * 0.25
                    c = FIRE[4] if hot > 1.25 else FIRE[3] if hot > 1.0 else FIRE[2] if hot > 0.8 else FIRE[1] if hot > 0.6 else (44, 30, 30)
                    cv.set(x, y, c)
        flame(cv, 32, 37, 7, 10, f, nf, 630, 0.7)
        # boca da fornalha na face frontal
        for y in range(50, 70):
            for x in range(22, 42):
                dx = (x + 0.5 - 32) / 10.0
                top = 50 + int((1 - math.sqrt(max(0.0, 1 - dx * dx))) * 6)
                if y < top:
                    continue
                if y == top or x in (22, 41):
                    cv.set(x, y, STONE[1])
                    continue
                d = y - top
                n = vnoise(x, y + f * 4, 16, 640, 3)
                hot = 0.15 + d / 26.0 + n * 0.55 + pulse * 0.2 - abs(x + 0.5 - 32) / 30.0
                cv.set(x, y, FIRE[4] if hot > 1.25 else FIRE[3] if hot > 1.0 else FIRE[2] if hot > 0.75 else FIRE[1] if hot > 0.55 else (30, 18, 20))
        for x in range(21, 43):
            cv.set(x, 70, STONE[5])
            cv.set(x, 71, STONE[3])
        # fole a esquerda
        fill_poly(cv, [(0, 58), (10, 52), (12, 54), (12, 66), (10, 68), (0, 64)],
                  lambda x, y: ramp(CLOTH, 3 if y < 58 else 2 if (y - 52) % 4 else 1))
        for y in range(56, 66):
            cv.set(12, y, WOOD[3])
            cv.set(13, y, WOOD[2])
        line(cv, 0, 60, -2, 72, WOOD[3])
        # tenaz encostada a direita
        line(cv, 58, 74, 62, 50, IRON[4])
        line(cv, 59, 74, 63, 50, IRON[2])
        sparks(cv, 32, 30, 22, 8, f, nf, 650, 4)
        outline(cv)
        drop_shadow(cv, 34, 76, 30, 4, 100)
        glow_disc(cv, 32, 74, 22, 6, 50 + 25 * pulse)
        out.append(("forge_%d" % f, cv))
    return out


def prop_anvil(cv: Cv) -> None:
    # toco
    for y in range(40, 60):
        for x in range(20, 44):
            if (x in (20, 43)) and y > 57:
                continue
            cv.set(x, y, log_px(x, 20, 24, y, 701))
    fill_ellipse(cv, (19, 36, 44, 44), lambda x, y: WOOD[5] if ((x - 31.5) ** 2 / 100 + (y - 40) ** 2 / 9) % 0.35 > 0.1 else WOOD[4])
    # bigorna
    fill_poly(cv, [(10, 24), (22, 24), (24, 28), (44, 28), (46, 24), (52, 24), (52, 30), (44, 32), (38, 33),
                   (40, 40), (24, 40), (26, 33), (18, 31)],
              lambda x, y: ramp(IRON, 5 if y < 26 else 4 if y < 28 and x < 30 else 3 if x < 32 else 2))
    for x in range(12, 51):
        cv.set(x, 24, IRON[6] if x < 40 else IRON[5])
    for x in range(26, 39):
        cv.set(x, 38, IRON[1])
    # martelo sobre a bigorna
    for x in range(30, 46):
        cv.set(x, 21, WOOD[4])
        cv.set(x, 22, WOOD[2])
    fill_rect(cv, 44, 17, 50, 24, lambda x, y: IRON[5] if y < 19 else IRON[3])


def prop_firewood(cv: Cv) -> None:
    rows = [(54, 6, 6), (45, 5, 6), (36, 4, 6), (27, 2, 6)]
    for (y, n, r) in rows:
        x0 = 30 - n * 5
        for k in range(n):
            cx = x0 + k * 10 + 4 + (1 if h01(k, y, 1) < 0.5 else 0)
            # casca
            fill_ellipse(cv, (cx - r, y - r, cx + r - 1, y + r - 2),
                         lambda x, yy, cx=cx: ramp(WOOD, 2 if x < cx else 1))
            # topo cortado (aneis)
            fill_ellipse(cv, (cx - r + 1, y - r + 1, cx + r - 2, y + r - 3),
                         lambda x, yy, cx=cx, cy=y - 1: ramp(WOOD, 6 if math.hypot(x - cx, yy - cy) < 1.5 else 5 if int(math.hypot(x - cx, yy - cy)) % 2 == 0 else 4))
    # cepo com machado
    for y in range(46, 60):
        for x in range(50, 62):
            cv.set(x, y, log_px(x, 50, 12, y, 711))
    fill_ellipse(cv, (49, 43, 62, 49), lambda x, y: WOOD[5])
    line(cv, 55, 46, 60, 30, WOOD[4])
    line(cv, 56, 46, 61, 30, WOOD[2])
    fill_poly(cv, [(56, 40), (52, 44), (50, 41), (54, 37)], lambda x, y: IRON[5] if x < 52 else IRON[3])


def prop_barrel(cv: Cv) -> None:
    for y in range(28, 60):
        bulge = 1.0 - ((y - 44) / 17.0) ** 2
        half = 11 + int(bulge * 3)
        for x in range(32 - half, 32 + half):
            t = (x - (32 - half)) / (2.0 * half)
            i = 5 if t < 0.2 else 4 if t < 0.45 else 3 if t < 0.72 else 2 if t < 0.9 else 1
            if (x - (32 - half)) % 5 == 0:
                i -= 1
            c = ramp(WOOD, i)
            if y in (32, 33, 54, 55):
                c = ramp(IRON, i - 1)
            cv.set(x, y, c)
    fill_ellipse(cv, (21, 24, 43, 33), lambda x, y: ramp(WOOD, 4 if (x // 4) % 2 else 5))
    fill_ellipse(cv, (22, 25, 42, 32), lambda x, y: ramp(WOOD, 4 if (x // 4) % 2 else 5))
    for x in range(22, 42):
        cv.set(x, 25, WOOD[6])


def prop_crate(cv: Cv) -> None:
    fill_rect(cv, 14, 24, 50, 34, lambda x, y: ramp(WOOD, 5 if (y - 24) % 5 else 3))
    fill_rect(cv, 14, 34, 50, 58, lambda x, y: ramp(WOOD, (4 if x < 32 else 3) - (1 if (y - 34) % 6 == 5 else 0)))
    for x in range(14, 50):
        cv.set(x, 34, WOOD[6])
    for k in range(24):
        cv.set(15 + int(k * 34 / 24), 57 - k, WOOD[5])
        cv.set(16 + int(k * 34 / 24), 57 - k, WOOD[2])
    for (x, y) in ((15, 35), (48, 35), (15, 56), (48, 56)):
        cv.set(x, y, IRON[5])


def prop_sacks(cv: Cv) -> None:
    for (cx, cy, rx, ry, s) in ((22, 48, 12, 11, 1), (42, 50, 11, 9, 2), (31, 36, 10, 9, 3)):
        def sack(x, y, cx=cx, cy=cy, rx=rx, ry=ry, s=s):
            u, v = (x - cx) / rx, (y - cy) / ry
            i = 3 if (u + v) < -0.5 else 2 if (u + v) < 0.5 else 1
            if (x + 2 * y) % 5 == 0 and h01(x, y, s) < 0.5:
                i -= 1
            if v > 0.75:
                i = 1
            return ramp(BURLAP, i)
        fill_ellipse(cv, (cx - rx, cy - ry + 3, cx + rx, cy + ry), sack)
        # pescoco amarrado com abas
        fill_poly(cv, [(cx - 4, cy - ry + 4), (cx - 2, cy - ry - 1), (cx - 5, cy - ry - 5), (cx, cy - ry - 2),
                       (cx + 5, cy - ry - 5), (cx + 2, cy - ry - 1), (cx + 4, cy - ry + 4)],
                  lambda x, y, cx=cx: BURLAP[3] if x < cx else BURLAP[2])
        for x in range(cx - 3, cx + 4):
            cv.set(x, cy - ry, ROPE[1])
            cv.set(x, cy - ry + 1, ROPE[2])
    for k in range(6):                                  # graos derramados
        cv.set(44 + k * 2, 59 + (k % 2), (200, 170, 100))


def prop_pots(cv: Cv) -> None:
    for (cx, base, r, hgt, pal) in ((20, 58, 9, 20, CLAY), (37, 58, 7, 15, CLAY), (49, 58, 5, 11, STONE), (30, 46, 5, 10, CLAY)):
        for y in range(base - hgt, base):
            t = (y - (base - hgt)) / float(hgt)
            half = int(r * (0.55 + 0.55 * math.sin(t * math.pi * 0.9 + 0.2)))
            if t < 0.15:
                half = int(r * 0.6)
            for x in range(cx - half, cx + half):
                u = (x - (cx - half)) / max(1.0, 2.0 * half)
                i = 4 if u < 0.25 else 3 if u < 0.6 else 2 if u < 0.85 else 1
                cv.set(x, y, ramp(pal, i))
        for x in range(cx - int(r * 0.6), cx + int(r * 0.6)):
            cv.set(x, base - hgt, sh(pal[1], -0.4))
            cv.set(x, base - hgt - 1, pal[4])
    # cordao de ervas secas num pote
    for k in range(5):
        line(cv, 28 + k, 36, 26 + k * 2, 28, GRASS[3 + (k % 2)])


def prop_herb_rack(cv: Cv) -> None:
    for x0 in (8, 54):
        for y in range(14, 60):
            for x in range(x0, x0 + 4):
                cv.set(x, y, log_px(x, x0, 4, y, 721 + x0))
    for x in range(6, 60):
        cv.set(x, 16, WOOD[4])
        cv.set(x, 17, WOOD[2])
        cv.set(x, 38, WOOD[4])
        cv.set(x, 39, WOOD[2])
    cols = [(GRASS[4], GRASS[2]), ((150, 110, 150), (98, 70, 104)), ((190, 160, 80), (130, 100, 50)), (GRASS[5], GRASS[3])]
    for k in range(7):
        x = 13 + k * 6
        a, b = cols[k % 4]
        cv.set(x + 1, 18, ROPE[2])
        cv.set(x + 1, 19, ROPE[1])
        for y in range(20, 20 + 9 + (k % 3)):
            w = 1 + (y - 20) // 3
            for d in range(-w // 2, w - w // 2 + 1):
                cv.set(x + 1 + d, y, a if d <= 0 else b)
    # prateleira com frascos
    for k, c in enumerate(((180, 60, 60), (70, 140, 170), (120, 170, 80), (200, 150, 60), (150, 90, 170))):
        x = 14 + k * 8
        fill_rect(cv, x, 31, x + 5, 38, lambda xx, yy, c=c: sh(c, 0.25) if xx == x else c if xx < x + 3 else sh(c, -0.35))
        cv.set(x + 2, 30, (200, 190, 170))
        cv.set(x + 1, 32, (255, 255, 230))


def prop_weapon_rack(cv: Cv) -> None:
    for x0 in (8, 52):
        for y in range(26, 60):
            for x in range(x0, x0 + 4):
                cv.set(x, y, log_px(x, x0, 4, y, 731 + x0))
    for x in range(6, 58):
        for y, i in ((30, 4), (31, 2), (50, 4), (51, 2)):
            cv.set(x, y, WOOD[i])
    # lancas e espadas apoiadas
    for k, x in enumerate((15, 23, 31, 39, 46)):
        top = 6 if k % 2 == 0 else 14
        if k % 2 == 0:                       # lanca
            line(cv, x, 58, x + 1, top + 6, WOOD[4])
            fill_poly(cv, [(x, top + 6), (x + 2, top + 6), (x + 1, top)], lambda xx, yy: IRON[6] if xx <= x else IRON[4])
        else:                                # espada
            for y in range(top, 46):
                cv.set(x, y, IRON[6])
                cv.set(x + 1, y, IRON[4])
            cv.set(x, top - 1, IRON[5])
            for xx in range(x - 2, x + 4):
                cv.set(xx, 46, IRON[3])
            for y in range(47, 52):
                cv.set(x, y, (90, 50, 36))
                cv.set(x + 1, y, (60, 34, 28))
    # escudo redondo encostado
    fill_ellipse(cv, (40, 40, 58, 58), lambda x, y: ramp(WOOD, 4 if (x + y) < 96 else 2) if math.hypot(x - 49, y - 49) > 3 else IRON[5])
    for a in range(0, 360, 6):
        cv.set(int(49 + math.cos(math.radians(a)) * 8.5), int(49 + math.sin(math.radians(a)) * 8.5), IRON[3])


def prop_bench(cv: Cv) -> None:
    for x0 in (10, 48):
        for y in range(44, 58):
            for x in range(x0, x0 + 5):
                cv.set(x, y, log_px(x, x0, 5, y, 741 + x0))
    for y in range(38, 45):
        for x in range(6, 58):
            cv.set(x, y, ramp(WOOD, 6 if y == 38 else 5 if y < 41 else 3 if y < 44 else 1))


def prop_bucket(cv: Cv) -> None:
    for y in range(40, 58):
        half = 8 - (y - 40) // 6
        for x in range(32 - half, 32 + half):
            u = (x - (32 - half)) / (2.0 * half)
            c = ramp(WOOD, 5 if u < 0.25 else 4 if u < 0.6 else 2)
            if y in (43, 53):
                c = IRON[3]
            cv.set(x, y, c)
    fill_ellipse(cv, (24, 37, 40, 43), lambda x, y: (60, 80, 92) if y > 38 else (130, 160, 170))
    for a in range(180, 361, 8):
        cv.set(int(32 + math.cos(math.radians(a)) * 9), int(40 + math.sin(math.radians(a)) * 9), IRON[4])


PROP_DEFS = [
    ("anvil", prop_anvil, [-13, -6, 26, 6]),
    ("firewood", prop_firewood, [-28, -8, 58, 8]),
    ("barrel", prop_barrel, [-12, -6, 24, 6]),
    ("crate", prop_crate, [-18, -8, 36, 8]),
    ("sacks", prop_sacks, [-20, -8, 38, 8]),
    ("pots", prop_pots, [-18, -6, 36, 6]),
    ("herb_rack", prop_herb_rack, [-25, -4, 50, 4]),
    ("weapon_rack", prop_weapon_rack, [-25, -4, 50, 4]),
    ("bench", prop_bench, [-26, -4, 52, 4]),
    ("bucket", prop_bucket, [-8, -4, 16, 4]),
]
PROP_W, PROP_H, PROP_BASE = 64, 64, 60


def build_props():
    frames, fp = [], {}
    for name, fn, rect in PROP_DEFS:
        cv = Cv(PROP_W, PROP_H)
        fn(cv)
        outline(cv)
        bb = cv.img().getbbox()
        rx = max(6, (bb[2] - bb[0]) / 2.0) if bb else 12
        drop_shadow(cv, 34, PROP_BASE - 1, rx, 3.5, 100)
        frames.append((name, cv))
        fp[name] = [rect]
    return frames, fp


# ---------------------------------------------------------------------------
# Carroca
# ---------------------------------------------------------------------------

def build_cart() -> Cv:
    cv = Cv(112, 80)
    # varais (frente a esquerda, apoiados no chao)
    for (y0, y1, i) in ((44, 72, 3), (40, 66, 4)):
        line(cv, 26, y0, 2, y1, WOOD[i])
        line(cv, 26, y0 + 1, 2, y1 + 1, WOOD[1])
    # roda de tras (parcial)
    for y in range(34, 66):                       # roda de tras (aro escuro, parcialmente escondido)
        for x in range(54, 90):
            d = math.hypot(x + 0.5 - 72, y + 0.5 - 50)
            if 12 <= d <= 15:
                cv.set(x, y, WOOD[1] if d > 13 else WOOD[2])
    # fundo/caixa: interior visto de cima
    fill_rect(cv, 22, 26, 100, 34, lambda x, y: ramp(WOOD, 2 if (x - 22) % 9 == 0 else 3))
    # carga: sacos e barril
    fill_ellipse(cv, (30, 12, 52, 34), lambda x, y: ramp(BURLAP, 3 if x < 40 and y < 22 else 2 if x < 46 else 1))
    for x in range(37, 45):
        cv.set(x, 14, ROPE[2])
    fill_ellipse(cv, (48, 16, 66, 34), lambda x, y: ramp(BURLAP, 3 if x < 55 and y < 24 else 2 if x < 60 else 1))
    for y in range(8, 32):
        for x in range(70, 90):
            u = (x - 70) / 20.0
            c = ramp(WOOD, 5 if u < 0.2 else 4 if u < 0.5 else 3 if u < 0.8 else 1)
            if y in (12, 13, 26, 27):
                c = IRON[3]
            cv.set(x, y, c)
    fill_ellipse(cv, (70, 5, 89, 12), lambda x, y: ramp(WOOD, 5 if (x // 3) % 2 else 4))
    for x in range(92, 100):                        # feno
        for y in range(18, 34):
            if h01(x, y, 801) < 0.7:
                cv.set(x, y, ramp(THATCH, 4 + (h01(x, y, 802) < 0.3)))
    # lateral da caixa (frente)
    for y in range(32, 50):
        for x in range(20, 102):
            i = 4 if (y - 32) % 6 else 2
            if y == 32:
                i = 6
            if x in (20, 21, 100, 101) or (x - 20) % 27 in (0, 1):
                i = 3 if x % 2 == 0 else 2
            if h01(x, y, 803) < 0.05:
                i -= 1
            cv.set(x, y, ramp(WOOD, i))
    for x in range(20, 102):
        cv.set(x, 49, WOOD[1])
    # roda da frente com raios
    cx, cy, R = 62, 56, 15
    for y in range(cy - R, cy + R + 1):
        for x in range(cx - R, cx + R + 1):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if R - 3 <= d <= R:
                cv.set(x, y, ramp(WOOD, 5 if (x < cx and y < cy) else 3 if d > R - 1.5 else 2))
            elif d <= 3:
                cv.set(x, y, IRON[4] if d < 1.5 else WOOD[2])
    for k in range(8):
        a = k * math.pi / 4 + 0.2
        line(cv, cx, cy, int(cx + math.cos(a) * (R - 2)), int(cy + math.sin(a) * (R - 2)), WOOD[4])
    for a in range(0, 360, 4):
        cv.set(int(cx + math.cos(math.radians(a)) * R), int(cy + math.sin(math.radians(a)) * R), IRON[3])
    outline(cv)
    drop_shadow(cv, 60, 72, 46, 6, 100, skew=0.0)
    return cv


# ---------------------------------------------------------------------------
# Casa de palha (176x160, origem 88,152)
# ---------------------------------------------------------------------------

HOUSE_W, HOUSE_H = 176, 160
HOUSE_OX, HOUSE_OY = 88, 152


def build_house() -> Cv:
    cv = Cv(HOUSE_W, HOUSE_H)
    wx0, wx1, wy0, wy1 = 18, 158, 100, 152      # parede frontal
    # parede de tabuas
    for y in range(wy0, wy1):
        for x in range(wx0, wx1):
            plank = (x - wx0) // 6
            px_ = (x - wx0) % 6
            base = 4 if plank % 3 == 0 else 3 if plank % 3 == 1 else 4
            i = base
            if px_ == 0:
                i = 1
            elif px_ == 1:
                i = base + 1
            n = h01(plank, y // 4, 901)
            if n < 0.15:
                i -= 1
            if h01(x, y, 902) < 0.03:
                i -= 1
            # luz: mais clara a esquerda
            c = ramp(WOOD, i)
            c = sh(c, 0.08 * (1 - (x - wx0) / (wx1 - wx0)) - 0.06)
            cv.set(x, y, c)
    # vigas horizontais e postes de canto
    for y, i in ((wy0 + 22, 5), (wy0 + 23, 3), (wy0 + 24, 2)):
        for x in range(wx0, wx1):
            cv.set(x, y, ramp(WOOD, i))
    for x0 in (wx0 - 2, wx1 - 5):
        for y in range(wy0 - 4, wy1):
            for x in range(x0, x0 + 7):
                cv.set(x, y, log_px(x, x0, 7, y, 903 + x0))
    # fundacao de pedra
    for k, x in enumerate(range(wx0 - 4, wx1 + 4, 9)):
        stone_block(cv, x, wy1 - 6 + (k % 2), 9, 7 - (k % 2), 910 + k, base=3, moss=0.4)
    # porta (centro)
    dx0, dx1, dy0 = 76, 100, 112
    for y in range(dy0 - 3, wy1 - 5):
        for x in range(dx0 - 3, dx1 + 3):
            if x < dx0 or x >= dx1 or y < dy0:
                cv.set(x, y, ramp(WOOD, 5 if (x < dx0 or y < dy0) and x < dx1 else 2))
                continue
            i = 2 if (x - dx0) % 6 == 0 else 3
            if y in (dy0 + 6, dy0 + 26):
                i = 1
            c = ramp(WOOD, i)
            if x >= dx1 - 7:                     # entreaberta: luz interna
                c = mix((255, 176, 80), (200, 110, 40), (y - dy0) / 40.0) if x > dx1 - 5 else (40, 24, 20)
            cv.set(x, y, c)
    for y in (dy0 + 6, dy0 + 26):
        for x in range(dx0 + 1, dx1 - 8):
            cv.set(x, y, IRON[3])
            if x % 5 == 0:
                cv.set(x, y, IRON[5])
    cv.set(dx1 - 10, dy0 + 17, IRON[6])
    # degrau
    for x in range(dx0 - 4, dx1 + 4):
        cv.set(x, wy1 - 5, STONE[5])
        for y in range(wy1 - 4, wy1):
            cv.set(x, y, STONE[3] if y < wy1 - 1 else STONE[1])
    # janelas com luz quente e postigos
    for wxa in (34, 124):
        for y in range(114, 130):
            for x in range(wxa, wxa + 18):
                if x in (wxa, wxa + 17) or y in (114, 129):
                    cv.set(x, y, WOOD[1])
                elif x in (wxa + 8, wxa + 9) or y == 121:
                    cv.set(x, y, WOOD[2])
                else:
                    t = (y - 114) / 15.0
                    cv.set(x, y, mix((255, 214, 130), (214, 120, 46), t))
        for x in range(wxa - 7, wxa):               # postigos abertos
            for y in range(113, 131):
                cv.set(x, y, ramp(WOOD, 4 if (x - wxa) % 3 else 2))
        for x in range(wxa + 18, wxa + 25):
            for y in range(113, 131):
                cv.set(x, y, ramp(WOOD, 3 if (x - wxa) % 3 else 1))
        for x in range(wxa - 2, wxa + 20):          # parapeito
            cv.set(x, 130, WOOD[5])
            cv.set(x, 131, WOOD[2])
    # telhado de palha: trapezio (beiral largo) + cumeeira
    ry0, ry1 = 34, 108
    ex0, ex1 = 2, 174
    tx0, tx1 = 44, 132

    def roof_x(y: float) -> Tuple[float, float]:
        t = (y - ry0) / float(ry1 - ry0)
        return tx0 + (ex0 - tx0) * t, tx1 + (ex1 - tx1) * t

    for y in range(ry0, ry1 + 6):
        lx, rx = roof_x(min(y, ry1))
        course = (y - ry0) // 9
        r = (y - ry0) % 9
        for x in range(int(lx), int(math.ceil(rx))):
            # franja irregular no beiral
            if y >= ry1:
                if y - ry1 > int(h01(x, 7, 920) * 6):
                    continue
            strand = h01(x, course, 921)
            i = 3 + (1 if strand > 0.62 else -1 if strand < 0.2 else 0)
            if r <= 1:
                i = 1 if r == 0 else 2
            elif r >= 7:
                i = 5 if h01(x, y, 922) < 0.7 else 4
            if y >= ry1:
                i = 2 + (1 if strand > 0.5 else 0)
            # luz: lado esquerdo do telhado mais claro, direita na sombra; borda das aguas
            u = (x - lx) / max(1.0, rx - lx)
            c = ramp(THATCH, i)
            c = sh(c, 0.14 * (1 - u) - 0.2 * max(0.0, u - 0.55) * 2)
            if x - lx < 3 and y < ry1:
                c = sh(c, 0.18)
            if rx - x < 4 and y < ry1:
                c = sh(c, -0.3)
            # remendos de musgo/palha velha
            mn = vnoise(x, y, 176, 923, 10)
            if mn < 0.22 and r > 1:
                c = mix(c, MOSS[1], 0.45)
            cv.set(x, y, c)
    # cumeeira enrolada
    for y in range(ry0 - 7, ry0 + 2):
        for x in range(tx0 + 2, tx1 - 2):
            t = (y - (ry0 - 7)) / 8.0
            i = 5 if t < 0.3 else 4 if t < 0.6 else 2
            if (x - tx0) % 14 in (0, 1):
                i = 1 if t > 0.2 else 2
            cv.set(x, y, sh(ramp(THATCH, i), 0.1 * (1 - (x - tx0) / (tx1 - tx0))))
    for x in range(tx0 + 4, tx1 - 4, 14):          # amarracoes de corda
        for y in range(ry0 - 7, ry0 + 2):
            cv.set(x, y, ROPE[1])
            cv.set(x + 1, y, ROPE[2])
    # buraco de fumaca
    for y in range(ry0 + 4, ry0 + 9):
        for x in range(96, 108):
            cv.set(x, y, (30, 22, 20) if y > ry0 + 5 else THATCH[1])
    for k in range(4):
        cv.set(100 + k % 2, ry0 + 1 - k * 2, (110, 104, 108), 90 - k * 18)
    # ervas penduradas no beiral (curandeira)
    for k, x in enumerate((26, 31, 36, 142, 148)):
        a, b = ((GRASS[4], GRASS[2]), ((150, 110, 150), (98, 70, 104)), ((190, 160, 80), (130, 100, 50)))[k % 3]
        for y in range(ry1 + 2, ry1 + 12):
            w = 1 + (y - ry1 - 2) // 4
            for d in range(w + 1):
                cv.set(x + d - w // 2, y, a if d == 0 else b)
    # lanterna ao lado da porta
    fill_rect(cv, 106, 118, 112, 126, lambda x, y: (255, 210, 110) if 107 <= x <= 110 and 119 <= y <= 124 else IRON[2])
    cv.set(108, 116, IRON[4])
    cv.set(108, 117, IRON[3])
    outline(cv)
    # sombra do beiral sobre a parede (depois do contorno)
    for x in range(wx0 - 2, wx1 + 2):
        fr = int(h01(x, 7, 920) * 6)
        for y in range(ry1 + fr + 1, ry1 + fr + 8):
            p = cv.get(x, y)
            if p[3] == 255 and p[:3] != OUTLINE:
                cv.set(x, y, sh(p[:3], -0.45 + 0.05 * (y - ry1 - fr)))
    drop_shadow(cv, HOUSE_OX + 6, HOUSE_OY + 1, 78, 5, 110)
    return cv


# ---------------------------------------------------------------------------
# Portao de pedra (176x176, origem 88,168)
# ---------------------------------------------------------------------------

GATE_W, GATE_H = 176, 152
GATE_OX, GATE_OY = 88, 144
GATE_TRIM = 24          # desenhado em 176 de altura e recortado no topo (vazio)

FONT5 = {
    "S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "I": ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
    "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
}


def draw_sign(cv: Cv, x0: int, y0: int) -> None:
    w, h = 41, 16
    # cordas ate a viga
    for (ax, bx) in ((x0 + 6, x0 + 4), (x0 + w - 7, x0 + w - 5)):
        line(cv, ax, y0 - 9, bx, y0, ROPE[2])
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if (x in (x0, x0 + w - 1)) and (y in (y0, y0 + h - 1)):
                continue
            i = 4 if (y - y0) % 5 else 2
            if y == y0:
                i = 5
            if y == y0 + h - 1 or x == x0 + w - 1:
                i = 1
            if x == x0:
                i = 5
            if h01(x, y, 950) < 0.06:
                i -= 1
            cv.set(x, y, ramp(WOOD, i))
    text = "SAIDA"
    cx = x0 + 6
    ty = y0 + 6
    for ch in text:
        g = FONT5[ch]
        for gy, row in enumerate(g):
            for gx, v in enumerate(row):
                if v == "#":
                    cv.set(cx + gx + 1, ty + gy + 1, (40, 24, 18))
                    cv.set(cx + gx, ty + gy, (238, 222, 180))
        if ch == "I":                             # acento agudo do I (SAIDA -> SAÍDA)
            cv.set(cx + 1, ty - 2, (238, 222, 180))
            cv.set(cx + 2, ty - 3, (238, 222, 180))
        cx += len(g[0]) + 1


def build_gate(open_: bool) -> Cv:
    cv = Cv(GATE_W, GATE_H + GATE_TRIM)
    base = GATE_OY + GATE_TRIM
    pillars = ((8, 40), (136, 168))
    # portas (atras dos pilares)
    if not open_:
        for y in range(84, base):
            for x in range(40, 136):
                left = x < 88
                rel = (x - 40) if left else (x - 88)
                i = 4 if rel % 8 not in (0, 7) else 2
                if rel % 8 == 1:
                    i = 5
                if x in (87, 88):
                    i = 1
                if h01(rel // 8 + (0 if left else 20), y // 5, 960) < 0.2:
                    i -= 1
                c = ramp(WOOD, i)
                c = sh(c, 0.06 if left else -0.08)
                if base - y < 6:
                    c = sh(c, -0.3)
                cv.set(x, y, c)
        for y in (96, 130, 156):                  # ferragens
            for x in range(42, 134):
                if x in (87, 88):
                    continue
                cv.set(x, y, IRON[3])
                cv.set(x, y + 1, IRON[1])
                if x % 7 == 3:
                    cv.set(x, y, IRON[6])
        for x in (82, 93):                        # argolas
            for a in range(0, 360, 30):
                cv.set(int(x + math.cos(math.radians(a)) * 2.5), int(118 + math.sin(math.radians(a)) * 2.5), IRON[5])
        # diagonais de travamento
        for k in range(30):
            for (sx, dirx) in ((44, 1), (131, -1)):
                x = sx + dirx * int(k * 1.4)
                y = 152 - k
                cv.set(x, y, WOOD[5])
                cv.set(x, y + 1, WOOD[2])
    else:
        # folhas abertas para fora do mapa (vistas de lado, finas)
        for (xa, xb, sgn) in ((40, 52, 1), (124, 136, -1)):
            for y in range(84, base):
                for x in range(xa, xb):
                    rel = x - xa if sgn > 0 else xb - 1 - x
                    yy = y - rel // 2
                    if yy < 84:
                        continue
                    i = 3 if rel % 4 else 2
                    if rel == 0:
                        i = 4
                    cv.set(x, yy, sh(ramp(WOOD, i), -0.1 if sgn > 0 else -0.25))
    # pilares de pedra
    for (px0, px1) in pillars:
        for row, y in enumerate(range(54, base, 10)):
            off = 0 if row % 2 == 0 else 7
            xs = [px0] + [x for x in range(px0 + 9 + off - 7, px1, 14) if px0 < x < px1 - 3] + [px1]
            xs = sorted(set(xs))
            for a, b in zip(xs, xs[1:]):
                if b - a >= 3:
                    stone_block(cv, a, y, b - a, min(10, base - y), 1000 + px0 + row * 13 + a,
                                base=3, moss=0.45 if y > base - 22 else 0.0)
        # lateral interna mais escura (profundidade do vao)
        inner = px1 - 1 if px0 < 88 else px0
        for y in range(54, base):
            p = cv.get(inner, y)
            if p[3]:
                cv.set(inner, y, sh(p[:3], -0.35))
        # capitel
        for y in range(46, 54):
            for x in range(px0 - 3, px1 + 3):
                i = 5 if y < 48 else 4 if y < 51 else 2
                if x == px0 - 3:
                    i += 1
                if h01(x, y, 1100) < 0.08:
                    i -= 1
                cv.set(x, y, ramp(STONE, i))
    # viga de madeira sobre os pilares
    for y in range(30, 46):
        for x in range(0, GATE_W):
            t = (y - 30) / 15.0
            i = 6 if y == 30 else 5 if t < 0.25 else 4 if t < 0.55 else 3 if t < 0.85 else 1
            n = h01(x // 3, y, 1200)
            if n < 0.12:
                i -= 1
            if x < 3 or x > GATE_W - 4:              # pontas cortadas (aneis)
                i = 5 if (x + y) % 3 else 4
            cv.set(x, y, ramp(WOOD, i))
    # cavilhas e amarracoes
    for x in (18, 22, 150, 154):
        for y in range(29, 47):
            cv.set(x, y, ROPE[2] if (y % 3) else ROPE[0])
    # placa SAIDA pendurada
    draw_sign(cv, 67, 56)
    # tochas nos pilares (suporte de ferro, sem chama: as tochas animadas ficam em village_hub_torch)
    outline(cv)
    # sombra dos pilares no chao (para baixo/direita)
    for (px0, px1) in pillars:
        for y in range(base, base + 6):
            for x in range(px0 + 2, px1 + 6):
                cv.under(x, y, (18, 12, 22), 120 - (y - base) * 15)
    if not open_:
        for y in range(base, base + 3):
            for x in range(40, 136):
                cv.under(x, y, (18, 12, 22), 90 - (y - base) * 25)
    out = Cv(GATE_W, GATE_H)
    out.a = cv.a[GATE_TRIM:]
    return out


# ---------------------------------------------------------------------------
# Halo de luz (blend ADD)
# ---------------------------------------------------------------------------

def build_light() -> Cv:
    cv = Cv(128, 128)
    for y in range(128):
        for x in range(128):
            d = math.hypot((x + 0.5 - 64) / 64.0, (y + 0.5 - 64) / 64.0)
            if d < 1:
                a = (1 - d) ** 2
                # aneis discretos (leitura pixel art, sem pontilhado que "chia" no blend ADD)
                lvl = math.floor(a * 8) / 8.0
                if lvl > 0:
                    c = mix((200, 90, 30), (255, 200, 110), lvl)
                    # cor ja multiplicada pela intensidade: funciona em ADD com ou sem alfa
                    cv.set(x, y, (int(c[0] * lvl), int(c[1] * lvl), int(c[2] * lvl)), int(255 * lvl))
    return cv


# ---------------------------------------------------------------------------
# Saida
# ---------------------------------------------------------------------------

def sheet_of(frames: Sequence[Tuple[str, Cv]], fw: int, fh: int) -> Image.Image:
    im = Image.new("RGBA", (fw * len(frames), fh))
    for i, (_, cv) in enumerate(frames):
        assert cv.w == fw and cv.h == fh, (cv.w, cv.h, fw, fh)
        im.paste(cv.img(), (i * fw, 0))
    return im


def entry(key: str, frames: Sequence[str], fw: int, fh: int, origin=None, anims=None, footprints=None) -> Dict:
    e: Dict = {"key": key, "file": key + ".png", "width": fw * len(frames), "height": fh,
               "frameWidth": fw, "frameHeight": fh, "frames": list(frames)}
    if origin:
        e["origin"] = {"x": round(origin[0] / fw, 6), "y": round(origin[1] / fh, 6)}
    if anims:
        e["animations"] = anims
    if footprints:
        e["footprints"] = {k: [{"x": r[0], "y": r[1], "w": r[2], "h": r[3]} for r in v] for k, v in footprints.items()}
    return e


def build_all():
    sheets: Dict[str, Tuple[Image.Image, Dict, List[Tuple[str, Cv]], int, int]] = {}

    tiles_img, tile_names = build_tiles()
    sheets["village_hub_tiles"] = (tiles_img, entry("village_hub_tiles", tile_names, T, T), None, T, T)

    house = build_house()
    sheets["village_hub_house"] = (house.img(), entry(
        "village_hub_house", ["house"], HOUSE_W, HOUSE_H, (HOUSE_OX, HOUSE_OY),
        footprints={"house": [[-72, -44, 144, 44]]}), [("house", house)], HOUSE_W, HOUSE_H)

    pal, pal_fp = build_palisade()
    sheets["village_hub_palisade"] = (sheet_of(pal, PAL_W, PAL_H), entry(
        "village_hub_palisade", [n for n, _ in pal], PAL_W, PAL_H, (16, PAL_BASE), footprints=pal_fp), pal, PAL_W, PAL_H)

    gates = [("gate_closed", build_gate(False)), ("gate_open", build_gate(True))]
    sheets["village_hub_gate"] = (sheet_of(gates, GATE_W, GATE_H), entry(
        "village_hub_gate", [n for n, _ in gates], GATE_W, GATE_H, (GATE_OX, GATE_OY),
        footprints={"gate_closed": [[-80, -14, 32, 14], [48, -14, 32, 14], [-48, -6, 96, 6]],
                    "gate_open": [[-80, -14, 32, 14], [48, -14, 32, 14]]}), gates, GATE_W, GATE_H)

    camp = build_campfire()
    sheets["village_hub_campfire"] = (sheet_of(camp, 64, 64), entry(
        "village_hub_campfire", [n for n, _ in camp], 64, 64, (32, 56),
        anims={"campfire": {"frames": list(range(6)), "frameRate": 10, "repeat": -1}},
        footprints={n: [[-20, -14, 40, 14]] for n, _ in camp}), camp, 64, 64)

    forge = build_forge()
    sheets["village_hub_forge"] = (sheet_of(forge, 64, 80), entry(
        "village_hub_forge", [n for n, _ in forge], 64, 80, (32, 76),
        anims={"forge": {"frames": list(range(4)), "frameRate": 6, "repeat": -1}},
        footprints={n: [[-28, -16, 56, 16]] for n, _ in forge}), forge, 64, 80)

    braz = build_brazier()
    sheets["village_hub_brazier"] = (sheet_of(braz, 32, 64), entry(
        "village_hub_brazier", [n for n, _ in braz], 32, 64, (16, 61),
        anims={"brazier": {"frames": list(range(4)), "frameRate": 8, "repeat": -1}},
        footprints={n: [[-7, -4, 14, 4]] for n, _ in braz}), braz, 32, 64)

    torch = build_torch()
    sheets["village_hub_torch"] = (sheet_of(torch, 32, 80), entry(
        "village_hub_torch", [n for n, _ in torch], 32, 80, (16, 76),
        anims={"torch": {"frames": list(range(4)), "frameRate": 8, "repeat": -1}},
        footprints={n: [[-3, -3, 6, 3]] for n, _ in torch}), torch, 32, 80)

    cart = build_cart()
    sheets["village_hub_cart"] = (cart.img(), entry(
        "village_hub_cart", ["cart"], 112, 80, (56, 72),
        footprints={"cart": [[-38, -14, 84, 14]]}), [("cart", cart)], 112, 80)

    props, props_fp = build_props()
    sheets["village_hub_props"] = (sheet_of(props, PROP_W, PROP_H), entry(
        "village_hub_props", [n for n, _ in props], PROP_W, PROP_H, (32, PROP_BASE), footprints=props_fp),
        props, PROP_W, PROP_H)

    light = build_light()
    sheets["village_hub_light"] = (light.img(), entry("village_hub_light", ["light_warm"], 128, 128, (64, 64)),
                                   [("light_warm", light)], 128, 128)
    return sheets


def write_outputs(sheets) -> Dict:
    SPRITES.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    man = {"sprites": {}}
    for key, (img, e, _, _, _) in sheets.items():
        img.save(SPRITES / (key + ".png"))
        assert img.width == e["width"] and img.height == e["height"], key
        man["sprites"][key] = e
    (OUT_DIR / "village_hub.manifest.json").write_text(json.dumps(man, indent=2, ensure_ascii=False) + "\n",
                                                       encoding="utf-8")
    return man


# ---------------------------------------------------------------------------
# Amostra montada + prancha
# ---------------------------------------------------------------------------

def compose_sample(sheets) -> Image.Image:
    """Amostra de montagem (sem NPCs) para conferir emendas, escala e clima: 30x17 tiles."""
    cols, rows = 30, 19
    OY = 2 * T          # margem no topo para o portao/viga
    W, H = cols * T, rows * T
    tiles_img = sheets["village_hub_tiles"][0]
    names = sheets["village_hub_tiles"][1]["frames"]
    idx = {n: i for i, n in enumerate(names)}

    def tile(n: str) -> Image.Image:
        i = idx[n]
        return tiles_img.crop((i * T, 0, i * T + T, T))

    # vertices: 1 = grama. Clareira de terra dentro da palicada, com manchas de grama e caminho.
    V = [[1] * (cols + 1) for _ in range(rows + 1)]
    for r in range(rows + 1):
        for c in range(cols + 1):
            rr = r - 2
            if 2 <= rr <= 15 and 2 <= c <= 27:
                V[r][c] = 0
            # cantos arredondados / manchas de grama dentro
            if (rr, c) in ((2, 2), (2, 27), (15, 2), (15, 27), (3, 2), (2, 3), (14, 27), (15, 26)):
                V[r][c] = 1
            if 11 <= rr <= 13 and 3 <= c <= 5:
                V[r][c] = 1
            if 12 <= rr <= 13 and 23 <= c <= 25:
                V[r][c] = 1
            if rr == 2 and 8 <= c <= 10:
                V[r][c] = 1
    # caminho para fora pelo portao (alto a direita, colunas 22..26)
    for r in range(0, 5):
        for c in range(23, 26):
            V[r][c] = 0
    img = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    for r in range(rows):
        for c in range(cols):
            b = (V[r][c], V[r][c + 1], V[r + 1][c], V[r + 1][c + 1])
            if b == (0, 0, 0, 0):
                hsh = h01(c, r, 99)
                if 23 <= c <= 24 and r <= 5:
                    n = "path_v"
                else:
                    n = ("dirt_0", "dirt_1", "dirt_2", "dirt_3", "dirt_0", "dirt_1", "dirt_pebbles", "dirt_tufts",
                         "dirt_cracks", "dirt_damp")[int(hsh * 10)]
            elif b == (1, 1, 1, 1):
                n = ("grass_0", "grass_1", "grass_2", "grass_0", "grass_flowers", "grass_tall")[int(h01(c, r, 98) * 6)]
            else:
                n = "edge_%d%d%d%d" % b
            img.alpha_composite(tile(n), (c * T, r * T))

    objs: List[Tuple[float, Image.Image, int, int]] = []

    def frame(key: str, name: str) -> Tuple[Image.Image, Dict]:
        sh_img, e = sheets[key][0], sheets[key][1]
        i = e["frames"].index(name)
        fw, fh = e["frameWidth"], e["frameHeight"]
        return sh_img.crop((i * fw, 0, i * fw + fw, fh)), e

    def place(key: str, name: str, x: float, y: float) -> None:
        im, e = frame(key, name)
        o = e.get("origin", {"x": 0.5, "y": 0.95})
        y += OY
        objs.append((y, im, int(round(x - o["x"] * im.width)), int(round(y - o["y"] * im.height))))

    # palicada: linha de cima (y=2 tiles), laterais, linha de baixo; portao no alto a direita
    top_y = 2 * T + 6
    gate_cx = 24 * T + 16
    for c in range(1, 29):
        x = c * T + 16
        if abs(x - gate_cx) < 92:
            continue
        place("village_hub_palisade", ("h_0", "h_1", "h_broken", "h_1")[c % 4] if c != 6 else "h_broken", x, top_y)
    for r in range(3, 16):
        place("village_hub_palisade", "v_0" if r % 2 else "v_1", 1 * T + 16, r * T + 6)
        place("village_hub_palisade", "v_1" if r % 2 else "v_0", 28 * T + 16, r * T + 6)
    for c in range(1, 29):
        if 13 <= c <= 15:
            continue
        place("village_hub_palisade", ("h_1", "h_0")[c % 2], c * T + 16, 16 * T + 6)
    for (x, y) in ((1 * T + 16, top_y), (28 * T + 16, top_y), (1 * T + 16, 16 * T + 6), (28 * T + 16, 16 * T + 6)):
        place("village_hub_palisade", "corner", x, y)
    place("village_hub_palisade", "post", 12 * T + 16, 16 * T + 6)
    place("village_hub_palisade", "post", 16 * T + 16, 16 * T + 6)
    for x in (2 * T + 16, 3 * T + 10):
        place("village_hub_palisade", "spikes", x, 9 * T)
    place("village_hub_gate", "gate_open", gate_cx, top_y + 4)
    place("village_hub_house", "house", 9 * T + 16, 5 * T + 24)
    place("village_hub_campfire", "campfire_2", 15 * T, 9 * T + 8)
    place("village_hub_forge", "forge_1", 23 * T, 9 * T + 4)
    place("village_hub_props", "anvil", 21 * T, 11 * T)
    place("village_hub_brazier", "brazier_1", 13 * T + 20, 6 * T + 6)
    for (x, y) in ((4 * T, 3 * T + 4), (20 * T, 3 * T + 4), (2 * T + 20, 13 * T), (27 * T + 12, 13 * T), (12 * T + 6, 16 * T + 2)):
        place("village_hub_torch", "torch_%d" % (int(x) % 4), x, y)
    place("village_hub_cart", "cart", 19 * T, 5 * T + 4)
    place("village_hub_props", "firewood", 26 * T, 6 * T)
    place("village_hub_props", "barrel", 25 * T + 8, 11 * T + 4)
    place("village_hub_props", "barrel", 26 * T + 4, 11 * T + 14)
    place("village_hub_props", "crate", 17 * T, 4 * T + 10)
    place("village_hub_props", "sacks", 3 * T + 16, 6 * T)
    place("village_hub_props", "pots", 5 * T + 4, 5 * T + 26)
    place("village_hub_props", "herb_rack", 14 * T + 12, 4 * T + 24)
    place("village_hub_props", "weapon_rack", 4 * T + 8, 9 * T)
    place("village_hub_props", "bench", 12 * T, 11 * T + 10)
    place("village_hub_props", "bucket", 24 * T + 20, 12 * T + 8)
    for y, im, x, yy in sorted(objs, key=lambda o: o[0]):
        img.alpha_composite(im, (x, yy)) if x >= 0 and yy >= 0 else img.paste(im, (x, yy), im)
    # luz quente: tom de fim de tarde + halos das fontes (ADD)
    tone = Image.new("RGBA", (W, H), (255, 170, 90, 16))
    img.alpha_composite(tone)
    light = sheets["village_hub_light"][0].convert("RGB")
    import PIL.ImageChops as IC
    rgb = img.convert("RGB")
    for (x, y, s) in ((15 * T, 9 * T, 2.2), (23 * T, 8 * T + 16, 1.4), (13 * T + 20, 5 * T + 10, 1.0),
                      (4 * T, 1 * T + 20, 0.8), (20 * T, 1 * T + 20, 0.8), (2 * T + 20, 11 * T + 10, 0.8),
                      (27 * T + 12, 11 * T + 10, 0.8)):
        y += OY
        L = light.resize((int(128 * s), int(128 * s)), Image.NEAREST)
        L = L.point(lambda v: int(v * 0.6))
        layer = Image.new("RGB", (W, H), (0, 0, 0))
        layer.paste(L, (int(x - L.width / 2), int(y - L.height / 2)))
        rgb = IC.add(rgb, layer)
    return rgb.convert("RGBA")


def build_preview(sheets, out_path: Path) -> None:
    try:
        font = ImageFont.truetype("consola.ttf", 13)
        fontb = ImageFont.truetype("consolab.ttf", 16)
    except OSError:
        font = fontb = ImageFont.load_default()
    BG = (18, 17, 24, 255)
    CELL = (30, 28, 38, 255)
    blocks = []
    pad = 16
    width = 1960
    y = 40
    layout = []
    for key, (img, e, frames, fw, fh) in sheets.items():
        k = 3 if fw <= 32 and fh <= 32 else 2
        if key == "village_hub_light":
            k = 1
        lab = max(len("%d: %s" % (i, nm)) for i, nm in enumerate(e["frames"]))
        cw, ch = max(fw * k + 8, lab * 7 + 12), fh * k + 22
        per_row = max(1, (width - 2 * pad) // cw)
        n = len(e["frames"])
        nrows = (n + per_row - 1) // per_row
        layout.append((key, img, e, k, cw, ch, per_row, y))
        y += 22 + nrows * ch + 14
    sample = compose_sample(sheets)
    sample2 = sample.resize((sample.width * 2, sample.height * 2), Image.NEAREST)
    total_h = y + 30 + sample2.height + pad
    W = max(width, sample2.width + 2 * pad)
    out = Image.new("RGBA", (W, total_h), BG)
    d = ImageDraw.Draw(out)
    d.text((pad, 10), "SUBMUNDO · Vila Natal (hub do prólogo) · assets 2.5D (BRF-147 / T-133) — prancha", font=fontb,
           fill=(240, 200, 120))
    for key, img, e, k, cw, ch, per_row, y0 in layout:
        info = "%s.png — %dx%d · %d frame(s)" % (key, e["frameWidth"], e["frameHeight"], len(e["frames"]))
        if "origin" in e:
            info += " · origem (%.3f, %.3f)" % (e["origin"]["x"], e["origin"]["y"])
        if "animations" in e:
            info += " · anim " + ", ".join("%s %dfps" % (a, v["frameRate"]) for a, v in e["animations"].items())
        d.text((pad, y0), info, font=font, fill=(200, 200, 210))
        fw, fh = e["frameWidth"], e["frameHeight"]
        for i, name in enumerate(e["frames"]):
            cx = pad + (i % per_row) * cw
            cy = y0 + 20 + (i // per_row) * ch
            d.rectangle((cx, cy, cx + fw * k + 3, cy + fh * k + 3), fill=CELL)
            fr = img.crop((i * fw, 0, i * fw + fw, fh)).resize((fw * k, fh * k), Image.NEAREST)
            out.alpha_composite(fr, (cx + 2, cy + 2))
            if "origin" in e:
                ox = cx + 2 + int(e["origin"]["x"] * fw * k)
                oy = cy + 2 + int(e["origin"]["y"] * fh * k)
                d.line((ox - 3, oy, ox + 3, oy), fill=(80, 220, 255))
                d.line((ox, oy - 3, ox, oy + 3), fill=(80, 220, 255))
                for r in e.get("footprints", {}).get(name, []):
                    d.rectangle((ox + r["x"] * k, oy + r["y"] * k, ox + (r["x"] + r["w"]) * k - 1,
                                 oy + (r["y"] + r["h"]) * k - 1), outline=(255, 80, 120))
            d.text((cx + 2, cy + fh * k + 5), "%d: %s" % (i, name), font=font, fill=(150, 150, 165))
    sy = total_h - pad - sample2.height
    d.text((pad, sy - 24), "amostra montada 1x (ampliada 2x, sem NPCs): terra/grama por Wang de cantos, palicada, portão aberto, "
           "objetos ordenados pelos pés, halos ADD de village_hub_light · ciano = origem, rosa = footprint",
           font=font, fill=(200, 200, 210))
    out.alpha_composite(sample2, (pad, sy))
    out.convert("RGB").save(out_path)


def main() -> None:
    sheets = build_all()
    man = write_outputs(sheets)
    MOCKUPS.mkdir(parents=True, exist_ok=True)
    build_preview(sheets, MOCKUPS / "preview_m9_village_sheets.png")
    for k, e in man["sprites"].items():
        print("%-22s %5dx%-4d frame %dx%d x%d" % (k, e["width"], e["height"], e["frameWidth"], e["frameHeight"], len(e["frames"])))


if __name__ == "__main__":
    main()
