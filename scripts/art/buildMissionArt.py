#!/usr/bin/env python3
"""
SUBMUNDO - Arte das missoes do prologo (BRF-157 / T-144, Decisao #24).

Gera em public/assets/sprites/:

  quest_markers   16x24, 12 frames: "!" amarelo (disponivel), "?" cinza (em andamento),
                  "?" amarelo (pronta para entregar); 4 frames de pulso cada.
                  Origem (0.5, 1.0): a base do marcador fica logo acima da cabeca do NPC.
  mission_herb    32x32, 5 frames: erva medicinal colhivel com brilho (glow0..3) + colhida (toco).
  mission_tools   32x32, 5 frames: caixa de ferramentas do Gorran (martelo, tenaz) com
                  brilho de objetivo (glow0..3) + vazia.
  mission_strange 48x48, 6 frames: rachadura no chao do fundo da Mina Iluminada com brilho
                  vermelho pulsante e fumaca (prenuncio do Karnak).
  mission_icons   16x16, 2 frames: icon_herb, icon_tools (HUD/minimapa).

Tambem grava o fragmento scripts/art/out/mission_art.manifest.json (formato do
manifest.json) e a prancha assets/mockups/preview_m10_mission_art.png.

Deterministico. Requer numpy e Pillow.  Uso: py scripts/art/buildMissionArt.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "public" / "assets" / "sprites"
FRAG_PATH = ROOT / "scripts" / "art" / "out" / "mission_art.manifest.json"
PREVIEW_PATH = ROOT / "assets" / "mockups" / "preview_m10_mission_art.png"

RGB = Tuple[int, int, int]
OUTLINE: RGB = (9, 9, 11)

# Paleta (guia visual: Luz Quente / Inferno / Vila)
Y_DARK: RGB = (161, 98, 7)
Y_MID: RGB = (250, 204, 21)      # #facc15
Y_HI: RGB = (253, 230, 138)
Y_CORE: RGB = (254, 249, 195)    # #fef9c3
G_DARK: RGB = (82, 82, 91)
G_MID: RGB = (161, 161, 170)
G_HI: RGB = (212, 212, 216)
GLOW_Y: RGB = (253, 224, 71)     # #fde047


# ---------------------------------------------------------------------------
# Utilitarios
# ---------------------------------------------------------------------------

def blank(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def alpha_of(im: Image.Image) -> np.ndarray:
    return np.array(im)[:, :, 3] > 0


def _shift(m: np.ndarray, dx: int, dy: int) -> np.ndarray:
    out = np.zeros_like(m)
    h, w = m.shape
    ys0, ys1 = max(0, -dy), h - max(0, dy)
    xs0, xs1 = max(0, -dx), w - max(0, dx)
    out[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx] = m[ys0:ys1, xs0:xs1]
    return out


def grow(m: np.ndarray, diag: bool = False) -> np.ndarray:
    out = m.copy()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        out |= _shift(m, dx, dy)
    if diag:
        for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            out |= _shift(m, dx, dy)
    return out


def add_outline(im: Image.Image, diag: bool = False) -> Image.Image:
    a = np.array(im)
    m = a[:, :, 3] > 0
    ring = grow(m, diag) & ~m
    a[ring] = (*OUTLINE, 255)
    return Image.fromarray(a, "RGBA")


def glow_behind(im: Image.Image, col: RGB, alphas: Sequence[int]) -> Image.Image:
    """Halo em aneis concentricos atras do sprite (so em pixels vazios)."""
    a = np.array(im)
    m = a[:, :, 3] > 0
    cur = m.copy()
    out = blank(im.width, im.height)
    o = np.array(out)
    for al in alphas:
        nxt = grow(cur, diag=True)
        ring = nxt & ~cur
        o[ring] = (*col, al)
        cur = nxt
    o[m] = a[m]
    return Image.fromarray(o, "RGBA")


def put(im: Image.Image, x: int, y: int, col, a: int = 255) -> None:
    if 0 <= x < im.width and 0 <= y < im.height:
        if a >= 255:
            im.putpixel((x, y), (*col[:3], 255))
        else:
            base = im.getpixel((x, y))
            if base[3] == 0:
                im.putpixel((x, y), (*col[:3], a))
            else:
                t = a / 255
                im.putpixel((x, y), tuple(int(base[i] * (1 - t) + col[i] * t) for i in range(3)) + (max(base[3], a),))


def strip(frames: Sequence[Image.Image]) -> Image.Image:
    w, h = frames[0].size
    s = blank(w * len(frames), h)
    for i, f in enumerate(frames):
        s.alpha_composite(f, (i * w, 0))
    return s


def ground_shadow(im: Image.Image, cx: int, cy: int, rx: int, ry: int, a: int = 90) -> None:
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            if ((x - cx) / (rx + .5)) ** 2 + ((y - cy) / (ry + .5)) ** 2 <= 1 and im.getpixel((x, y))[3] == 0:
                im.putpixel((x, y), (0, 0, 0, a))


# ---------------------------------------------------------------------------
# (1) Marcadores de missao
# ---------------------------------------------------------------------------

GLYPH_EXCL = [
    ".##.",
    "####",
    "####",
    "####",
    "####",
    "####",
    ".##.",
    ".##.",
    ".##.",
    "....",
    "....",
    ".##.",
    "####",
    "####",
    ".##.",
]

GLYPH_QUEST = [
    "..#####..",
    ".#######.",
    "###...###",
    "###...###",
    "......###",
    ".....###.",
    "....###..",
    "...###...",
    "...###...",
    "...###...",
    ".........",
    ".........",
    "...###...",
    "...###...",
    "...###...",
]

MW, MH = 16, 24


def glyph_mask(g: List[str]) -> np.ndarray:
    return np.array([[c == "#" for c in row] for row in g], dtype=bool)


def marker_frame(glyph: List[str], ramp: Tuple[RGB, RGB, RGB, RGB], bob: int, glow: int, bright: int) -> Image.Image:
    """ramp = (dark, mid, hi, core). glow = indice de intensidade do halo (0..2)."""
    dark, mid, hi, core = ramp
    gm = glyph_mask(glyph)
    gh, gw = gm.shape
    ox = (MW - gw) // 2
    oy = MH - 2 - gh + bob  # 1px contorno + 1px folga no pe
    full = np.zeros((MH, MW), dtype=bool)
    full[oy:oy + gh, ox:ox + gw] = gm
    a = np.zeros((MH, MW, 4), dtype=np.uint8)
    # sombreamento: borda direita/baixo escura, borda esquerda/topo clara, nucleo
    right = full & ~_shift(full, -1, 0)
    bottom = full & ~_shift(full, 0, -1)
    left = full & ~_shift(full, 1, 0)
    top = full & ~_shift(full, 0, 1)
    a[full] = (*mid, 255)
    a[right | bottom] = (*dark, 255)
    a[(left | top) & ~(right | bottom)] = (*hi, 255)
    if bright:
        # brilho interno: pixels com luz sobem um tom
        inner = full & ~(right | bottom)
        a[inner & (left | top)] = (*core, 255)
        if bright > 1:
            a[inner & ~(left | top)] = (*hi, 255)
    # reflexo especular fixo no topo do glifo
    ys, xs = np.nonzero(full)
    ty = ys.min()
    tx = xs[ys == ty].min()
    a[ty, tx + 1 if full[ty, tx + 1] else tx] = (*core, 255) if ramp[1] != G_MID else (255, 255, 255, 255)
    im = Image.fromarray(a, "RGBA")
    im = add_outline(im, diag=True)
    if glow:
        al = [(70, 30), (110, 55)][glow - 1]
        im = glow_behind(im, GLOW_Y, al)
    return im


YELLOW = (Y_DARK, Y_MID, Y_HI, Y_CORE)
GREY = (G_DARK, G_MID, G_HI, (236, 236, 240))

# pulso: (bob, glow, bright)
PULSE_Y = [(0, 0, 0), (-1, 1, 1), (-1, 2, 2), (0, 1, 1)]
PULSE_G = [(0, 0, 0), (0, 0, 0), (-1, 0, 1), (-1, 0, 0)]  # cinza: so respira, sem halo


def build_markers() -> List[Image.Image]:
    frames = []
    for p in PULSE_Y:
        frames.append(marker_frame(GLYPH_EXCL, YELLOW, *p))
    for p in PULSE_G:
        frames.append(marker_frame(GLYPH_QUEST, GREY, *p))
    for p in PULSE_Y:
        frames.append(marker_frame(GLYPH_QUEST, YELLOW, *p))
    return frames


# ---------------------------------------------------------------------------
# (2) Erva medicinal (estilo herb_field: folhagem 4 tons, contorno escuro)
# ---------------------------------------------------------------------------

LEAF = ((28, 58, 34), (46, 96, 48), (82, 146, 64), (150, 200, 96))
STEM: RGB = (70, 98, 44)
SOIL = ((44, 30, 22), (74, 52, 36), (104, 76, 52))
FLOWER = ((150, 190, 210), (214, 240, 248), (255, 255, 255))  # petalas azul-palido
FLOWER_C: RGB = (250, 204, 21)

HW = 32


def _leaf(d: ImageDraw.ImageDraw, base: Tuple[float, float], ang: float, ln: float, wd: float, col: RGB) -> None:
    bx, by = base
    ca, sa = math.cos(ang), math.sin(ang)
    tip = (bx + ca * ln, by + sa * ln)
    mx, my = bx + ca * ln * .45, by + sa * ln * .45
    nx, ny = -sa * wd, ca * wd
    d.polygon([(bx, by), (mx + nx, my + ny), tip, (mx - nx, my - ny)], fill=col)


def herb_body(picked: bool) -> Image.Image:
    im = blank(HW, HW)
    d = ImageDraw.Draw(im)
    # monte de terra
    d.ellipse([9, 23, 22, 28], fill=SOIL[1])
    d.line([(10, 26), (21, 26)], fill=SOIL[0])
    d.point([(12, 24), (17, 24), (19, 25)], fill=SOIL[2])
    if picked:
        # toco: hastes cortadas + 2 folhinhas caidas
        for x, h in ((13, 4), (15, 6), (17, 5), (19, 3)):
            d.line([(x, 25), (x, 25 - h)], fill=STEM)
            d.point((x, 25 - h), fill=(170, 190, 110))
        _leaf(d, (11, 25), math.radians(200), 5, 1.6, LEAF[1])
        _leaf(d, (20, 25), math.radians(-20), 5, 1.6, LEAF[2])
        im = add_outline(im)
        return im
    # folhas largas em leque (de tras para a frente)
    back = [(-120, 11, 2.6), (-60, 11, 2.6), (-100, 13, 2.4), (-80, 13, 2.4)]
    for ang, ln, wd in back:
        _leaf(d, (15.5, 24), math.radians(ang), ln, wd, LEAF[1])
    front = [(-150, 9, 2.6), (-30, 9, 2.6), (-130, 8, 2.2), (-50, 8, 2.2)]
    for ang, ln, wd in front:
        _leaf(d, (15.5, 25), math.radians(ang), ln, wd, LEAF[2])
    # nervuras / luz
    arr = np.array(im)
    m = arr[:, :, 3] > 0
    leafm = m.copy()
    leafm[23:, :] = False
    top = leafm & ~_shift(leafm, 0, 1)
    rightb = leafm & ~_shift(leafm, -1, 0)
    arr[top] = (*LEAF[3], 255)
    arr[rightb & ~top] = (*LEAF[0], 255)
    im = Image.fromarray(arr, "RGBA")
    d = ImageDraw.Draw(im)
    for ang in (-100, -80):
        a = math.radians(ang)
        d.line([(15.5, 23), (15.5 + math.cos(a) * 9, 23 + math.sin(a) * 9)], fill=LEAF[0])
    # hastes com flores (cachos azul-palido com miolo dourado)
    for (sx, sy, tx, ty) in ((15, 22, 14, 8), (17, 22, 20, 10), (13, 22, 9, 12)):
        d.line([(sx, sy), (tx, ty)], fill=STEM)
    for (fx, fy) in ((14, 7), (20, 9), (9, 11)):
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            d.point((fx + dx, fy + dy), fill=FLOWER[1])
        d.point((fx - 1, fy - 1), fill=FLOWER[2])
        d.point((fx + 1, fy + 1), fill=FLOWER[0])
        d.point((fx, fy), fill=FLOWER_C)
    im = add_outline(im)
    return im


# motas de brilho subindo (x, y por frame)
SPARKS = [((8, 14), (23, 12), (16, 4)), ((8, 11), (23, 9), (17, 2)), ((9, 8), (22, 6), (11, 3)), ((22, 15), (9, 5), (12, 13))]


def glow_frames(body: Image.Image, glow_col: RGB, levels: Sequence[Tuple[int, int]], sparks, spark_col: RGB) -> List[Image.Image]:
    out = []
    for i, lv in enumerate(levels):
        f = glow_behind(body, glow_col, lv)
        for (sx, sy) in sparks[i]:
            put(f, sx, sy, spark_col, 230)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if f.getpixel((sx + dx, sy + dy))[3] == 0:
                    put(f, sx + dx, sy + dy, glow_col, 90)
        out.append(f)
    return out


GLOW_LEVELS = [(40, 18), (70, 32), (100, 50, 18), (70, 32)]


def finish_prop(f: Image.Image, shadow=(16, 28, 8, 2)) -> Image.Image:
    g = blank(f.width, f.height)
    ground_shadow(g, *shadow, a=80)
    g.alpha_composite(f)
    return g


def build_herb() -> List[Image.Image]:
    body = herb_body(False)
    frames = glow_frames(body, (220, 240, 150), GLOW_LEVELS, SPARKS, (255, 255, 220))
    frames.append(herb_body(True))
    return [finish_prop(f) for f in frames]


# ---------------------------------------------------------------------------
# (3) Ferramentas do Gorran (estilo village_mine: madeira escura, ferro)
# ---------------------------------------------------------------------------

WOOD = ((50, 33, 24), (84, 57, 38), (120, 85, 56), (150, 112, 75))
IRON = ((28, 30, 36), (54, 58, 66), (90, 94, 102), (160, 166, 172))
CLOTH = ((70, 48, 30), (110, 80, 52), (150, 116, 80))


def tools_body(empty: bool) -> Image.Image:
    im = blank(HW, HW)
    d = ImageDraw.Draw(im)
    if not empty:
        # tenaz (atras, inclinada para a direita)
        d.line([(15, 21), (23, 6)], fill=IRON[1], width=1)
        d.line([(17, 21), (25, 7)], fill=IRON[2], width=1)
        d.line([(23, 6), (25, 4)], fill=IRON[2])
        d.line([(25, 7), (26, 5)], fill=IRON[1])
        d.rectangle([23, 9, 24, 10], fill=IRON[3])  # rebite
        # martelo (cabo de madeira para a esquerda, cabeca de ferro no alto)
        d.line([(16, 21), (9, 8)], fill=WOOD[2], width=2)
        d.line([(15, 21), (8, 8)], fill=WOOD[1])
        d.polygon([(4, 7), (12, 3), (14, 6), (6, 10)], fill=IRON[2])
        d.line([(4, 7), (12, 3)], fill=IRON[3])
        d.line([(6, 10), (14, 6)], fill=IRON[0])
        d.point((12, 4), fill=(220, 224, 228))
    # caixa de madeira (frente)
    d.rectangle([6, 17, 25, 27], fill=WOOD[1])
    d.rectangle([6, 17, 25, 18], fill=WOOD[3])  # borda superior iluminada
    d.line([(6, 22), (25, 22)], fill=WOOD[0])    # tabua
    d.line([(7, 20), (24, 20)], fill=WOOD[2])
    d.line([(7, 24), (24, 24)], fill=WOOD[2])
    d.line([(25, 18), (25, 27)], fill=WOOD[0])
    d.line([(6, 27), (25, 27)], fill=WOOD[0])
    # cantoneiras de ferro
    for x in (6, 24):
        d.rectangle([x, 17, x + 1, 18], fill=IRON[2])
        d.rectangle([x, 26, x + 1, 27], fill=IRON[1])
    # alca de corda
    d.line([(13, 16), (15, 14), (17, 14), (19, 16)], fill=CLOTH[1])
    d.point((15, 14), fill=CLOTH[2])
    if empty:
        # interior escuro visivel
        d.rectangle([8, 17, 23, 18], fill=WOOD[0])
        d.line([(8, 17), (23, 17)], fill=(30, 20, 15))
    else:
        # trapo de couro enrolado para fora da caixa
        d.ellipse([18, 14, 24, 18], fill=CLOTH[1])
        d.point([(19, 15), (20, 14)], fill=CLOTH[2])
    return add_outline(im)


SPARKS_T = [((5, 13), (27, 11), (16, 2)), ((5, 10), (27, 8), (18, 1)), ((6, 6), (26, 4), (2, 12)), ((28, 15), (3, 4), (11, 13))]


def build_tools() -> List[Image.Image]:
    body = tools_body(False)
    frames = glow_frames(body, GLOW_Y, GLOW_LEVELS, SPARKS_T, (255, 251, 220))
    frames.append(tools_body(True))
    return [finish_prop(f, (16, 28, 11, 2)) for f in frames]


# ---------------------------------------------------------------------------
# (4) "Algo estranho": rachadura com brilho vermelho e fumaca
# ---------------------------------------------------------------------------

SW = SH = 48
CRACK_Y = 38
# rachadura principal + ramos (polilinhas)
CRACK = [
    [(8, 39), (13, 37), (17, 38), (21, 36), (25, 37), (29, 35), (34, 37), (39, 36)],
    [(17, 38), (16, 41)],
    [(25, 37), (27, 41), (26, 43)],
    [(29, 35), (31, 33)],
    [(13, 37), (11, 35)],
    [(34, 37), (37, 40)],
]
EMBER = ((69, 10, 10), (153, 27, 27), (239, 68, 68), (252, 165, 165))  # #450a0a #991b1b #ef4444 #fca5a5


def crack_mask() -> np.ndarray:
    im = Image.new("L", (SW, SH), 0)
    d = ImageDraw.Draw(im)
    for line in CRACK:
        d.line(line, fill=255, width=1)
    # alarga o trecho central (fenda principal)
    d.line([(15, 38), (21, 36), (25, 37), (30, 35)], fill=255, width=2)
    return np.array(im) > 0


PULSE_S = [0.35, 0.6, 1.0, 0.8, 0.5, 0.3]


def smoke_puffs(i: int) -> List[Tuple[float, float, float, int]]:
    """(x, y, raio, alfa) de 3 baforadas em fases diferentes."""
    puffs = []
    for k, (bx, ph) in enumerate(((20, 0), (27, 2), (24, 4))):
        t = ((i + ph) % 6) / 6.0
        y = CRACK_Y - 3 - t * 26
        x = bx + math.sin((t + k) * math.pi * 2) * 2.0
        r = 1.6 + t * 3.4
        a = int(130 * math.sin(t * math.pi))
        puffs.append((x, y, r, a))
    return puffs


def build_strange() -> List[Image.Image]:
    cm = crack_mask()
    rim = grow(cm, diag=True) & ~cm
    halo1 = grow(rim, diag=True) & ~rim & ~cm
    halo2 = grow(grow(halo1 | rim | cm, True), True) & ~(halo1 | rim | cm)
    frames = []
    for i, p in enumerate(PULSE_S):
        a = np.zeros((SH, SW, 4), dtype=np.uint8)
        # brilho difuso no chao (fica sob a rachadura)
        yy, xx = np.mgrid[0:SH, 0:SW]
        el = ((xx - 24) / 17.0) ** 2 + ((yy - 37.5) / 5.5) ** 2
        g = np.clip(1 - el, 0, 1) * 60 * p
        a[..., 0] = EMBER[2][0]
        a[..., 1] = EMBER[2][1]
        a[..., 2] = EMBER[2][2]
        a[..., 3] = g.astype(np.uint8)
        a[halo2] = (*EMBER[0], int(30 + 40 * p))
        a[halo1] = (*EMBER[1], int(90 + 80 * p))
        a[rim] = (*OUTLINE, 255)  # bordas escuras da fenda
        # interior: brasa que pulsa
        core = EMBER[3] if p > .9 else (EMBER[2] if p > .5 else EMBER[1])
        a[cm] = (*EMBER[1], 255)
        thick = cm & _shift(cm, 0, 1)
        inner = cm & (thick | _shift(thick, 0, -1))
        a[inner] = (*core, 255)
        if p > .9:
            a[cm & ~inner] = (*EMBER[2], 255)
        im = Image.fromarray(a, "RGBA")
        # fumaca escura avermelhada subindo
        sm = blank(SW, SH)
        sd = ImageDraw.Draw(sm)
        for (x, y, r, al) in smoke_puffs(i):
            if al <= 0:
                continue
            sd.ellipse([x - r, y - r * .8, x + r, y + r * .8], fill=(96, 62, 68, al))
            sd.ellipse([x - r * .5, y - r * .6, x + r * .3, y], fill=(130, 84, 86, int(al * .7)))
        im = Image.alpha_composite(im, sm)
        # faisca ocasional
        if i in (2, 3):
            sx, sy = (22, 33) if i == 2 else (27, 30)
            put(im, sx, sy, EMBER[3], 230)
        frames.append(im)
    return frames


# ---------------------------------------------------------------------------
# (5) Icones de objetivo 16x16
# ---------------------------------------------------------------------------

def icon_herb() -> Image.Image:
    im = blank(16, 16)
    d = ImageDraw.Draw(im)
    for ang, ln, wd, col in ((-125, 7, 2.2, LEAF[1]), (-55, 7, 2.2, LEAF[1]), (-90, 8, 2.2, LEAF[2]),
                             (-155, 5, 1.8, LEAF[2]), (-25, 5, 1.8, LEAF[2])):
        _leaf(d, (8, 13), math.radians(ang), ln, wd, col)
    d.line([(8, 13), (8, 6)], fill=LEAF[0])
    d.line([(7, 13), (9, 13)], fill=STEM)
    for (fx, fy) in ((8, 4), (4, 7), (12, 7)):
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            d.point((fx + dx, fy + dy), fill=FLOWER[1])
        d.point((fx, fy), fill=FLOWER_C)
    return add_outline(im)


def icon_tools() -> Image.Image:
    im = blank(16, 16)
    d = ImageDraw.Draw(im)
    # tenaz em X com o martelo
    d.line([(4, 13), (12, 3)], fill=IRON[2])
    d.line([(5, 13), (13, 4)], fill=IRON[1])
    d.point((8, 8), fill=IRON[3])
    # martelo
    d.line([(12, 13), (6, 5)], fill=WOOD[2], width=2)
    d.polygon([(2, 5), (7, 1), (9, 3), (4, 7)], fill=IRON[2])
    d.line([(2, 5), (7, 1)], fill=IRON[3])
    d.point((7, 2), fill=(230, 232, 236))
    return add_outline(im, diag=False)


# ---------------------------------------------------------------------------
# Manifest + prancha
# ---------------------------------------------------------------------------

def entry(key: str, fw: int, fh: int, frames: List[str], origin: Tuple[float, float], anims: Dict[str, dict], extra=None) -> dict:
    e = {
        "key": key,
        "file": f"{key}.png",
        "width": fw * len(frames),
        "height": fh,
        "frameWidth": fw,
        "frameHeight": fh,
        "frames": frames,
        "origin": {"x": origin[0], "y": origin[1]},
    }
    if anims:
        e["animations"] = anims
    if extra:
        e.update(extra)
    return e


def sheet_frame(path: Path, idx: int, fw: int, fh: int) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    return im.crop((idx * fw, 0, idx * fw + fw, fh))


def tile_floor(tiles: Path, idxs: Sequence[int], w: int, h: int, fs: int = 32) -> Image.Image:
    src = Image.open(tiles).convert("RGBA")
    out = blank(w, h)
    k = 0
    for y in range(0, h, fs):
        for x in range(0, w, fs):
            i = idxs[(x // fs * 7 + y // fs * 3 + k) % len(idxs)]
            out.alpha_composite(src.crop((i * fs, 0, i * fs + fs, fs)), (x, y))
    return out


def zoom(im: Image.Image, z: int) -> Image.Image:
    return im.resize((im.width * z, im.height * z), Image.NEAREST)


def build_preview(sh: Dict[str, List[Image.Image]]) -> Image.Image:
    W, H = 1180, 1240
    BG = (26, 25, 28, 255)
    TXT = (232, 222, 200)
    SUB = (170, 162, 146)
    im = Image.new("RGBA", (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((12, 8), "T-144 Arte das missoes (BRF-157) - quest_markers, mission_herb, mission_tools, mission_strange, mission_icons", fill=TXT)

    # --- 1. Marcadores: tiras 1:1 e 4x -----------------------------------
    y = 30
    d.text((12, y), "1) quest_markers 16x24 - frames 1:1 e 4x  (avail = '!' amarelo 0-3 | progress = '?' cinza 4-7 | ready = '?' amarelo 8-11)", fill=TXT)
    y += 16
    mk = sh["quest_markers"]
    for i, f in enumerate(mk):
        x = 12 + i * 22
        d.rectangle([x - 1, y - 1, x + 16, y + 24], fill=(60, 52, 44, 255))
        im.alpha_composite(f, (x, y))
    for i, f in enumerate(mk):
        x = 300 + i * 70
        if i % 4 == 0:
            d.text((x, y), ["avail", "progress", "ready"][i // 4], fill=SUB)
        d.rectangle([x, y + 12, x + 63, y + 12 + 95], fill=(60, 52, 44, 255))
        im.alpha_composite(zoom(f, 4), (x, y + 12))
    y += 118

    # --- 2. Vila 1:1 com os marcadores sobre os NPCs e o portao ----------
    d.text((12, y), "2) Vila Natal 1:1 (esq.) e 2x (dir.): Mestre '!', Lyra '?' cinza, Gorran '?' amarelo, portao '!'  (marcador 4px acima do topo da cabeca)", fill=TXT)
    y += 16
    vw, vh = 400, 230
    tiles = OUT_DIR / "village_hub_tiles.png"
    scene = tile_floor(tiles, [0, 1, 2, 3, 4, 6], vw, vh)
    gate = sheet_frame(OUT_DIR / "village_hub_gate.png", 0, 176, 152)
    scene.alpha_composite(gate.crop((24, 20, 152, 152)), (260, 34))
    npcs = [("village_npc_master", 50, 0), ("village_npc_lyra", 140, 4), ("village_npc_gorran", 230, 8)]
    hero = sheet_frame(OUT_DIR / "hero_living.png", 0, 80, 80)
    feet_y = 200
    labels = []
    for (key, cx, mi) in npcs:
        fr = sheet_frame(OUT_DIR / f"{key}.png", 0, 80, 80)
        top = fr.getbbox()[1]
        scene.alpha_composite(fr, (cx - 40, feet_y - 76))
        mf = mk[mi + 2]
        # origem (0.5, 1.0) 4px acima do topo da cabeca
        scene.alpha_composite(mf, (cx - 8, feet_y - 76 + top - 4 - 24))
        labels.append((key.split("_")[-1], cx))
    scene.alpha_composite(hero, (330 - 40, feet_y + 20 - 76))
    # portao: '!' sobre o arco
    scene.alpha_composite(mk[2], (260 + 64 - 8, 34 - 24 + 4))
    sx0 = 12
    im.alpha_composite(scene, (sx0, y))
    for name, cx in labels:
        d.text((sx0 + cx - 14, y + feet_y + 4), name, fill=TXT)
    im.alpha_composite(zoom(scene.crop((0, 40, 380, 230)), 2), (430, y))
    y += max(vh, 380) + 10

    # --- 3. Coletaveis sobre o chao dos biomas ---------------------------
    d.text((12, y), "3) mission_herb (Plantacao de Ervas) e mission_tools (Mina Iluminada) - glow0..3 + colhida/vazia; 1:1 sobre o bioma e 3x", fill=TXT)
    y += 16
    for row, (key, tiles_name, idxs, lab) in enumerate((
        ("mission_herb", "biome_herb_field_tiles.png", [0, 1, 2], ["glow0", "glow1", "glow2", "glow3", "picked"]),
        ("mission_tools", "biome_village_mine_tiles.png", [0, 1, 2], ["glow0", "glow1", "glow2", "glow3", "empty"]),
    )):
        frs = sh[key]
        floor = tile_floor(OUT_DIR / tiles_name, idxs, 5 * 40 + 8, 48)
        for i, f in enumerate(frs):
            floor.alpha_composite(f, (8 + i * 40, 10))
        im.alpha_composite(floor, (12, y))
        for i, f in enumerate(frs):
            x = 240 + i * 104
            fl = tile_floor(OUT_DIR / tiles_name, idxs, 32, 32)
            fl.alpha_composite(f)
            im.alpha_composite(zoom(fl, 3), (x, y))
            d.text((x, y + 98), lab[i], fill=SUB)
        d.text((12, y + 52), key, fill=TXT)
        y += 116

    # --- 4. Algo estranho --------------------------------------------------
    d.text((12, y), "4) mission_strange 48x48, 6 frames (pulse 0-5) no chao do fundo da Mina Iluminada - 1:1 (com heroi para escala) e 3x", fill=TXT)
    y += 16
    st = sh["mission_strange"]
    floor = tile_floor(OUT_DIR / "biome_village_mine_tiles.png", [0, 1, 2, 3], 6 * 52 + 120, 96)
    for i, f in enumerate(st):
        floor.alpha_composite(f, (4 + i * 52, 40))
    floor.alpha_composite(hero, (6 * 52 + 20, 10))
    dk = Image.new("RGBA", floor.size, (0, 0, 0, 70))
    floor = Image.alpha_composite(floor, dk)
    for i, f in enumerate(st):  # brilho por cima da camada de escuro
        floor.alpha_composite(f, (4 + i * 52, 40))
    floor.alpha_composite(hero, (6 * 52 + 20, 10))
    im.alpha_composite(floor, (12, y))
    y += 104
    for i, f in enumerate(st):
        x = 12 + i * 152
        fl = tile_floor(OUT_DIR / "biome_village_mine_tiles.png", [0, 1, 2], 48, 48)
        fl = Image.alpha_composite(fl, Image.new("RGBA", fl.size, (0, 0, 0, 70)))
        fl.alpha_composite(f)
        im.alpha_composite(zoom(fl, 3), (x, y))
        d.text((x, y + 146), f"pulse{i}", fill=SUB)
    y += 166

    # --- 5. Icones ---------------------------------------------------------
    d.text((12, y), "5) mission_icons 16x16 (icon_herb, icon_tools) - 1:1 sobre fundo de HUD e minimapa, e 4x", fill=TXT)
    y += 16
    ic = sh["mission_icons"]
    for i, f in enumerate(ic):
        x = 12 + i * 30
        d.rectangle([x - 4, y - 4, x + 19, y + 19], fill=(20, 22, 30, 255), outline=(150, 120, 60, 255))
        im.alpha_composite(f, (x, y))
        x2 = 90 + i * 30
        d.rectangle([x2 - 4, y - 4, x2 + 19, y + 19], fill=(40, 52, 70, 255))
        im.alpha_composite(f, (x2, y))
    for i, f in enumerate(ic):
        x = 180 + i * 80
        d.rectangle([x, y, x + 63, y + 63], fill=(20, 22, 30, 255))
        im.alpha_composite(zoom(f, 4), (x, y))
        d.text((x, y + 66), ["icon_herb", "icon_tools"][i], fill=SUB)
    y += 90
    return im.crop((0, 0, W, min(H, y + 10)))


def main() -> None:
    sheets = {
        "quest_markers": build_markers(),
        "mission_herb": build_herb(),
        "mission_tools": build_tools(),
        "mission_strange": build_strange(),
        "mission_icons": [icon_herb(), icon_tools()],
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for key, frs in sheets.items():
        strip(frs).save(OUT_DIR / f"{key}.png")

    g = [f"glow{i}" for i in range(4)]
    frag = {
        "sprites": {
            "quest_markers": entry(
                "quest_markers", MW, MH,
                [f"avail{i}" for i in range(4)] + [f"progress{i}" for i in range(4)] + [f"ready{i}" for i in range(4)],
                (0.5, 1.0),
                {
                    "avail": {"frames": [0, 1, 2, 3], "frameRate": 6, "repeat": -1},
                    "progress": {"frames": [4, 5, 6, 7], "frameRate": 4, "repeat": -1},
                    "ready": {"frames": [8, 9, 10, 11], "frameRate": 6, "repeat": -1},
                },
                {"headOffsetY": -4},
            ),
            "mission_herb": entry(
                "mission_herb", HW, HW, g + ["picked"], (0.5, 28 / 32),
                {"glow": {"frames": [0, 1, 2, 3], "frameRate": 6, "repeat": -1}},
            ),
            "mission_tools": entry(
                "mission_tools", HW, HW, g + ["empty"], (0.5, 28 / 32),
                {"glow": {"frames": [0, 1, 2, 3], "frameRate": 6, "repeat": -1}},
            ),
            "mission_strange": entry(
                "mission_strange", SW, SH, [f"pulse{i}" for i in range(6)], (0.5, CRACK_Y / SH),
                {"pulse": {"frames": [0, 1, 2, 3, 4, 5], "frameRate": 6, "repeat": -1}},
            ),
            "mission_icons": entry("mission_icons", 16, 16, ["icon_herb", "icon_tools"], (0.5, 0.5), {}),
        }
    }
    FRAG_PATH.parent.mkdir(parents=True, exist_ok=True)
    FRAG_PATH.write_text(json.dumps(frag, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    build_preview(sheets).save(PREVIEW_PATH)

    # conferencia: dimensoes do PNG == fragmento
    for key, e in frag["sprites"].items():
        w, h = Image.open(OUT_DIR / e["file"]).size
        ok = (w, h) == (e["width"], e["height"]) and w == e["frameWidth"] * len(e["frames"])
        print(f"{key}: {w}x{h} frame {e['frameWidth']}x{e['frameHeight']} x{len(e['frames'])} {'OK' if ok else 'MISMATCH'}")


if __name__ == "__main__":
    main()
