#!/usr/bin/env python3
"""
SUBMUNDO - NPCs da Vila Natal no padrao do heroi (BRF-148 / T-134, Decisao #23).

Gera uma folha por NPC em public/assets/sprites/ com frames 80x80, pes em y=76 e
centro do corpo em x=40 (mesma ancoragem de hero_living), contorno #09090b de 1px,
sombreamento volumetrico de 4 tons por material (luz de cima/esquerda) e as mesmas
rampas de pele/couro/tecido do heroi:

  village_npc_master  - Mestre de Armas: idle (6)
  village_npc_lyra    - Lyra, curandeira:  idle (6)
  village_npc_gorran  - Gorran, ferreiro:  idle (6) + hammer (8, impacto no frame 5)

Tambem grava o fragmento scripts/art/out/village_npcs.manifest.json (formato do
manifest.json) e a prancha assets/mockups/preview_m9_village_npcs.png com os 3 ao
lado do heroi em 1:1 e ampliados, mais as animacoes em tira.

Deterministico. Requer numpy e Pillow.  Uso: py scripts/art/buildVillageNpcs.py
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, List, Optional, Sequence, Tuple

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "public" / "assets" / "sprites"
FRAG_PATH = ROOT / "scripts" / "art" / "out" / "village_npcs.manifest.json"
PREVIEW_PATH = ROOT / "assets" / "mockups" / "preview_m9_village_npcs.png"
HERO_PATH = OUT_DIR / "hero_living.png"

FW = FH = 80
FOOT_Y = 76
CENTER_X = 40
SS = 4  # supersampling das mascaras

RGB = Tuple[int, int, int]
Ramp = Tuple[RGB, RGB, RGB, RGB]  # (dark, shadow, mid, hi)

OUTLINE: RGB = (9, 9, 13)

# --- Rampas (pele/couro/calca/tecido iguais as do heroi) ---------------------
SKIN: Ramp = ((146, 98, 82), (186, 128, 106), (226, 166, 134), (242, 192, 154))
SKIN_OLD: Ramp = ((126, 84, 72), (170, 116, 96), (210, 152, 122), (234, 182, 148))
SKIN_TAN: Ramp = ((108, 66, 52), (148, 94, 72), (188, 128, 96), (216, 160, 122))
LEATHER: Ramp = ((52, 32, 29), (84, 57, 46), (118, 89, 71), (156, 126, 104))
LEATHER_DK: Ramp = ((42, 30, 29), (66, 48, 41), (92, 72, 58), (114, 94, 78))
PANTS: Ramp = ((28, 27, 36), (44, 43, 50), (68, 63, 64), (86, 78, 75))
MAIL: Ramp = ((36, 40, 48), (64, 70, 80), (100, 106, 116), (146, 152, 160))
STEEL: Ramp = ((46, 50, 58), (84, 90, 100), (136, 142, 150), (196, 202, 208))
BRASS: Ramp = ((84, 58, 30), (134, 96, 44), (182, 142, 70), (224, 194, 118))
CAPE: Ramp = ((38, 17, 21), (64, 27, 31), (94, 40, 42), (124, 60, 56))
HAIR_GREY: Ramp = ((62, 62, 68), (100, 98, 104), (142, 140, 142), (184, 182, 180))
HAIR_AUB: Ramp = ((58, 25, 23), (96, 43, 33), (138, 68, 46), (178, 102, 66))
DRESS: Ramp = ((32, 44, 40), (50, 68, 56), (74, 94, 72), (100, 120, 88))
APRON: Ramp = ((104, 90, 74), (148, 132, 108), (190, 174, 144), (222, 210, 182))
GREEN: Ramp = ((30, 54, 28), (52, 88, 40), (84, 128, 54), (130, 168, 78))
POTION: Ramp = ((88, 14, 26), (158, 28, 42), (222, 60, 64), (255, 156, 140))
GLASS: Ramp = ((70, 86, 98), (112, 132, 144), (164, 186, 196), (226, 238, 242))
BEARD_DK: Ramp = ((22, 17, 17), (40, 29, 27), (62, 45, 39), (86, 63, 52))
APRON_G: Ramp = ((46, 27, 23), (76, 45, 35), (108, 69, 51), (138, 97, 71))
SHIRT_G: Ramp = ((30, 30, 34), (46, 46, 50), (64, 62, 64), (82, 78, 78))
WOOD: Ramp = ((50, 33, 24), (84, 57, 38), (120, 85, 56), (150, 112, 75))
IRON: Ramp = ((28, 30, 36), (54, 58, 66), (90, 94, 102), (142, 146, 152))

LIGHT = np.array([-0.52, -0.62, 0.59])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


# ---------------------------------------------------------------------------
# Mascaras (supersampled e binarizadas -> silhueta limpa de pixel art)
# ---------------------------------------------------------------------------

def _new_ss() -> Tuple[Image.Image, ImageDraw.ImageDraw]:
    im = Image.new("L", (FW * SS, FH * SS), 0)
    return im, ImageDraw.Draw(im)


def _finish(im: Image.Image) -> np.ndarray:
    small = im.resize((FW, FH), Image.BOX)
    return np.asarray(small) >= 128


def m_poly(pts: Sequence[Tuple[float, float]]) -> np.ndarray:
    im, d = _new_ss()
    d.polygon([(x * SS, y * SS) for x, y in pts], fill=255)
    return _finish(im)


def m_ellipse(cx: float, cy: float, rx: float, ry: float) -> np.ndarray:
    im, d = _new_ss()
    d.ellipse([(cx - rx) * SS, (cy - ry) * SS, (cx + rx) * SS, (cy + ry) * SS], fill=255)
    return _finish(im)


def m_capsule(x0: float, y0: float, x1: float, y1: float, r0: float, r1: Optional[float] = None) -> np.ndarray:
    r1 = r0 if r1 is None else r1
    im, d = _new_ss()
    n = max(2, int(math.hypot(x1 - x0, y1 - y0) * 3) + 1)
    for i in range(n + 1):
        t = i / n
        x, y, r = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 + (r1 - r0) * t
        d.ellipse([(x - r) * SS, (y - r) * SS, (x + r) * SS, (y + r) * SS], fill=255)
    return _finish(im)


def m_rect(x0: int, y0: int, x1: int, y1: int) -> np.ndarray:
    """Retangulo inclusivo em pixels."""
    m = np.zeros((FH, FW), bool)
    m[max(0, y0):min(FH, y1 + 1), max(0, x0):min(FW, x1 + 1)] = True
    return m


def m_rot_rect(cx: float, cy: float, w: float, h: float, ang: float) -> np.ndarray:
    """Retangulo w (ao longo de ang) x h, centrado, ang em radianos."""
    ux, uy = math.cos(ang), math.sin(ang)
    vx, vy = -uy, ux
    pts = []
    for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        pts.append((cx + ux * w / 2 * sx + vx * h / 2 * sy, cy + uy * w / 2 * sx + vy * h / 2 * sy))
    return m_poly(pts)


def shift(m: np.ndarray, dx: int, dy: int) -> np.ndarray:
    out = np.zeros_like(m)
    h, w = m.shape
    xs0, xs1 = max(0, -dx), min(w, w - dx)
    ys0, ys1 = max(0, -dy), min(h, h - dy)
    out[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx] = m[ys0:ys1, xs0:xs1]
    return out


# ---------------------------------------------------------------------------
# Partes, sombreamento e composicao
# ---------------------------------------------------------------------------

TexFn = Callable[[np.ndarray, np.ndarray, np.ndarray], np.ndarray]


@dataclass
class Part:
    mask: np.ndarray
    ramp: Ramp
    z: float
    line: Optional[str] = "hard"  # 'hard' (#09090b), 'soft' (tom escuro) ou None
    sigma: float = 1.6
    bias: float = 0.0
    vgrad: float = 0.18  # escurece de cima para baixo dentro da parte
    tex: Optional[TexFn] = None
    casts: bool = True


def _blur(a: np.ndarray, sigma: float) -> np.ndarray:
    rad = max(1, int(sigma * 3))
    xs = np.arange(-rad, rad + 1)
    k = np.exp(-(xs ** 2) / (2 * sigma * sigma))
    k /= k.sum()
    p = np.pad(a, rad, mode="constant")
    p = np.apply_along_axis(lambda r: np.convolve(r, k, mode="same"), 1, p)
    p = np.apply_along_axis(lambda c: np.convolve(c, k, mode="same"), 0, p)
    return p[rad:-rad, rad:-rad]


THRESH = (-0.05, 0.42, 0.80)


def shade_part(p: Part) -> np.ndarray:
    m = p.mask.astype(float)
    s = _blur(m, p.sigma)
    gy, gx = np.gradient(s)
    k = 3.2
    nx, ny, nz = -gx * k, -gy * k, np.full_like(s, 0.55)
    nl = np.sqrt(nx * nx + ny * ny + nz * nz)
    inten = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / nl
    ys = np.nonzero(p.mask)[0]
    if len(ys):
        y0, y1 = ys.min(), ys.max()
        yy = np.arange(FH)[:, None].repeat(FW, 1)
        inten = inten - p.vgrad * np.clip((yy - y0) / max(1, y1 - y0), 0, 1)
    inten = inten + p.bias
    tone = np.zeros(m.shape, int)
    for t in THRESH:
        tone += (inten > t).astype(int)
    if p.tex is not None:
        yy, xx = np.mgrid[0:FH, 0:FW]
        tone = p.tex(tone, xx, yy)
    return np.clip(tone, 0, 3)


@dataclass
class Figure:
    parts: List[Part] = field(default_factory=list)
    details: List[Tuple[int, int, RGB]] = field(default_factory=list)

    def add(self, *a, **kw) -> Part:
        p = Part(*a, **kw)
        self.parts.append(p)
        return p

    def px(self, x: int, y: int, col: RGB) -> None:
        self.details.append((int(x), int(y), col))

    def hline(self, x0: int, x1: int, y: int, col: RGB) -> None:
        for x in range(min(x0, x1), max(x0, x1) + 1):
            self.px(x, y, col)

    def vline(self, x: int, y0: int, y1: int, col: RGB) -> None:
        for y in range(min(y0, y1), max(y0, y1) + 1):
            self.px(x, y, col)


def render(fig: Figure) -> Image.Image:
    parts = sorted(fig.parts, key=lambda p: p.z)
    owner = np.full((FH, FW), -1, int)
    tones = np.zeros((FH, FW), int)
    shaded = [shade_part(p) for p in parts]
    for i, p in enumerate(parts):
        owner[p.mask] = i
        tones[p.mask] = shaded[i][p.mask]
    # Sombra projetada de 1px (luz de cima/esquerda) das partes de cima nas de baixo
    above = np.zeros((FH, FW), bool)
    cast = np.zeros((FH, FW), bool)
    for i in range(len(parts) - 1, -1, -1):
        p = parts[i]
        own = owner == i
        drop = (shift(above, 1, 1) | shift(above, 0, 1)) & own & ~above
        cast |= drop
        if p.casts:
            above = above | (p.mask & (owner >= i))
    tones = np.where(cast, np.maximum(tones - 1, 0), tones)

    rgb = np.zeros((FH, FW, 3), np.uint8)
    alpha = owner >= 0
    for i, p in enumerate(parts):
        own = owner == i
        ramp = np.array(p.ramp, np.uint8)
        rgb[own] = ramp[tones[own]]
    # Linhas internas (sel-out) na borda da parte de cima
    for i, p in enumerate(parts):
        if not p.line:
            continue
        own = owner == i
        edge = np.zeros_like(own)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            o2 = np.full_like(owner, -2)
            h, w = owner.shape
            xs0, xs1 = max(0, dx), min(w, w + dx)
            ys0, ys1 = max(0, dy), min(h, h + dy)
            o2[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx] = owner[ys0:ys1, xs0:xs1]
            edge |= own & (o2 >= 0) & (o2 < i)
        col = OUTLINE if p.line == "hard" else p.ramp[0]
        rgb[edge] = col
    for x, y, col in fig.details:
        if 0 <= x < FW and 0 <= y < FH:
            rgb[y, x] = col
            alpha[y, x] = True
    # Contorno externo 1px (4-vizinhanca), como add_outline do heroi
    ring = np.zeros_like(alpha)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ring |= shift(alpha, dx, dy)
    ring &= ~alpha
    rgb[ring] = OUTLINE
    a = np.where(alpha | ring, 255, 0).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb, a]), "RGBA")


# ---------------------------------------------------------------------------
# Texturas
# ---------------------------------------------------------------------------

def tex_mail(tone, xx, yy):
    # aneis: linhas alternadas com pixel claro/escuro defasado
    ring = ((xx + (yy // 2) % 2) % 2 == 0) & (yy % 2 == 0)
    gap = (yy % 2 == 1) & ((xx + (yy // 2)) % 2 == 0)
    return tone + ring.astype(int) - gap.astype(int)


def tex_leather_stitch(cols: Sequence[int]):
    def f(tone, xx, yy):
        st = np.isin(xx, cols) & (yy % 2 == 0)
        return tone - st.astype(int)
    return f


def tex_folds(cols: Sequence[int], start_y: int = 0):
    def f(tone, xx, yy):
        fold = np.isin(xx, cols) & (yy >= start_y)
        return tone - fold.astype(int)
    return f


def tex_hair(seed: int = 0):
    def f(tone, xx, yy):
        strand = ((xx * 3 + yy + seed) % 5 == 0)
        return tone - strand.astype(int)
    return f


# ---------------------------------------------------------------------------
# Rosto
# ---------------------------------------------------------------------------

EYE: RGB = (33, 23, 23)
EYE_W: RGB = (230, 222, 210)


# ---------------------------------------------------------------------------
# Mestre de Armas (3/4 para a direita, mao no punho da espada)
# ---------------------------------------------------------------------------

def build_master(b: int, arm: int, sway: int) -> Figure:
    f = Figure()
    U = b  # deslocamento do tronco (respiracao)
    # Capa atras de tudo
    f.add(m_poly([(31, 29 + U), (49, 29 + U), (53, 46), (54, 63), (48, 67), (33, 67),
                  (25 + sway, 65), (26, 46)]), CAPE, 0, sigma=2.2, vgrad=0.35,
          tex=tex_folds([28, 33, 51], 50))
    # Bainha (lado de tras do quadril esquerdo da tela)
    f.add(m_capsule(31, 51, 22, 68, 1.6, 1.4), LEATHER_DK, 1.5, sigma=1.0)
    f.px(22, 69, BRASS[2]); f.px(23, 69, BRASS[1]); f.px(23, 68, BRASS[2])
    # Pernas
    f.add(m_capsule(45, 54, 45.5, 64, 3.3, 3.0), PANTS, 1, vgrad=0.3)
    f.add(m_poly([(42.5, 63), (48.5, 63), (48.5, 69), (52, 71), (52, 75), (42.5, 75)]),
          LEATHER_DK, 1.2, sigma=1.2, bias=-0.05)
    f.add(m_capsule(35, 54, 34, 64, 3.5, 3.2), PANTS, 2, vgrad=0.3)
    f.add(m_poly([(30.5, 63), (37.5, 63), (37.5, 69), (41, 71), (41, 75), (30.5, 75)]),
          LEATHER_DK, 2.2, sigma=1.2)
    # dobras das botas
    f.hline(31, 37, 65, LEATHER[0]); f.hline(43, 48, 65, LEATHER[0])
    f.hline(31, 37, 64, LEATHER[3]); f.hline(43, 48, 64, LEATHER[2])
    # Saia de cota de malha + tronco de malha
    f.add(m_poly([(30, 47 + U), (50, 47 + U), (52, 59), (28.5, 59)]), MAIL, 3, sigma=1.8, tex=tex_mail)
    f.add(m_poly([(29, 31 + U), (51, 31 + U), (50.5, 50 + U), (29.5, 50 + U)]), MAIL, 4, tex=tex_mail)
    # Braco de tras (direita da tela) parcialmente atras do torso
    f.add(m_capsule(50, 34 + U, 52, 43 + U, 3.2, 3.0), MAIL, 3.5, tex=tex_mail)
    f.add(m_capsule(52, 43 + U, 52.5, 50 + arm, 3.1, 2.8), LEATHER, 3.6, tex=tex_leather_stitch([52]))
    f.add(m_ellipse(52.5, 52.5 + arm, 2.7, 2.6), SKIN_OLD, 3.7, sigma=1.0)
    # Couraca de couro
    f.add(m_poly([(31, 33 + U), (49, 32 + U), (48.5, 49 + U), (31.5, 49 + U)]), LEATHER, 5,
          sigma=2.0, tex=tex_leather_stitch([35, 45]))
    # placa peitoral (reforco) e tachas
    f.hline(33, 47, 41 + U, LEATHER[0])
    for x in (34, 40, 46):
        f.px(x, 35 + U, BRASS[3]); f.px(x, 44 + U, BRASS[2])
    # Cinto + fivela
    f.add(m_rect(30, 48 + U, 50, 51 + U), LEATHER_DK, 6, sigma=0.8, vgrad=0.0)
    f.add(m_rect(38, 48 + U, 41, 51 + U), BRASS, 6.5, sigma=0.7, vgrad=0.0)
    f.px(39, 49 + U, BRASS[0]); f.px(40, 50 + U, BRASS[0])
    # Espada: guarda + punho + pomo (apontando para frente/cima)
    f.add(m_rect(29, 47 + U, 35, 48 + U), STEEL, 6.8, sigma=0.7, vgrad=0.0)
    f.add(m_capsule(33, 46 + U, 36, 42 + U, 1.1), WOOD, 6.9, sigma=0.8, line="soft")
    f.add(m_ellipse(36.5, 41.5 + U, 1.6, 1.6), BRASS, 7.0, sigma=0.7)
    # Ombreiras de couro
    f.add(m_ellipse(49.5, 33 + U, 4.2, 3.6), LEATHER, 7.5, sigma=1.4)
    f.add(m_ellipse(30, 33.5 + U, 5.2, 4.2), LEATHER, 8, sigma=1.5)
    f.hline(26, 33, 35 + U, LEATHER[1]); f.px(29, 32 + U, BRASS[3])
    # Braco da frente (esquerda da tela) com a mao no pomo
    f.add(m_capsule(28.5, 36 + U, 28, 43 + U, 3.2, 3.0), MAIL, 8.5, tex=tex_mail)
    f.add(m_capsule(28, 43 + U, 33, 46 + arm, 3.0, 2.8), LEATHER, 9, tex=tex_leather_stitch([30]))
    f.add(m_ellipse(35.5, 44.5 + arm, 2.7, 2.5), SKIN_OLD, 9.5, sigma=1.0)
    f.px(36, 43 + arm, SKIN_OLD[1]); f.px(37, 44 + arm, SKIN_OLD[1])
    # Cabeca (3/4 direita)
    H = U
    f.add(m_ellipse(40.5, 18 + H, 9.0, 10.0), SKIN_OLD, 10, sigma=2.0, bias=0.05)
    f.add(m_ellipse(35.5, 20 + H, 2.0, 2.6), SKIN_OLD, 10.5, sigma=0.9, line="soft")  # orelha
    hair = m_ellipse(40.2, 17.4 + H, 9.7, 10.4) & ~m_ellipse(42.2, 20.6 + H, 8.4, 9.4)
    hair |= m_poly([(32, 15 + H), (35.5, 15 + H), (36, 22 + H), (32.5, 22 + H)]) & m_ellipse(40.2, 17.4 + H, 9.7, 10.4)
    hair &= ~m_ellipse(35.5, 20 + H, 2.0, 2.6)
    f.add(hair, HAIR_GREY, 11, sigma=1.3, tex=tex_hair(1))
    # Barba grisalha curta + bigode
    f.add(m_poly([(37.5, 22 + H), (40, 24 + H), (45, 25 + H), (49, 22.5 + H), (49.5, 25 + H),
                  (46.5, 29.5 + H), (40.5, 30 + H), (37, 26.5 + H)]), HAIR_GREY, 11.5, sigma=1.3,
          line="soft", tex=tex_hair(3))
    f.hline(43, 48, 24 + H, HAIR_GREY[1]); f.hline(44, 47, 25 + H, SKIN_OLD[0])
    # Olhos, sobrancelhas grossas e cicatriz
    for ex in (41, 46):
        f.px(ex, 19 + H, EYE); f.px(ex + 1, 19 + H, EYE); f.px(ex, 20 + H, (70, 46, 40))
        f.px(ex + 1, 20 + H, SKIN_OLD[1])
        f.hline(ex - 1, ex + 1, 17 + H, HAIR_GREY[0])
    f.px(42, 18 + H, HAIR_GREY[0])
    f.px(48, 18 + H, (150, 86, 80)); f.px(47, 21 + H, (150, 86, 80)); f.px(48, 22 + H, (150, 86, 80))
    # Nariz
    f.px(49, 20 + H, SKIN_OLD[2]); f.px(49, 21 + H, SKIN_OLD[1]); f.px(50, 21 + H, SKIN_OLD[1])
    f.px(48, 22 + H, SKIN_OLD[0])
    return f


# ---------------------------------------------------------------------------
# Lyra (frente, frasco na mao, bolsa de ervas)
# ---------------------------------------------------------------------------

def build_lyra(b: int, arm: int, sway: int, glint: int) -> Figure:
    f = Figure()
    U = b
    # Cabelo de tras (longo)
    f.add(m_poly([(31, 14 + U), (49, 14 + U), (51, 30 + U), (50, 41 + U), (30 + sway, 41 + U), (29, 30 + U)]),
          HAIR_AUB, 0, sigma=1.8, tex=tex_hair(2), vgrad=0.35)
    # Saia do vestido (longa, abre para baixo)
    f.add(m_poly([(32, 47 + U), (48, 47 + U), (51.5, 62), (53 + sway, 72.5), (27 + sway, 72.5), (28.5, 62)]),
          DRESS, 1, sigma=2.0, vgrad=0.3, tex=tex_folds([31, 37, 44, 49], 56))
    # Sapatos
    f.add(m_ellipse(35, 73.2, 3.4, 1.8), LEATHER_DK, 0.5, sigma=0.8)
    f.add(m_ellipse(45, 73.2, 3.4, 1.8), LEATHER_DK, 0.5, sigma=0.8)
    # Corpete
    f.add(m_poly([(33, 30 + U), (47, 30 + U), (46.5, 48 + U), (33.5, 48 + U)]), DRESS, 2, sigma=1.8)
    # Avental (peito + saia)
    f.add(m_poly([(35.5, 35 + U), (44.5, 35 + U), (44.5, 47 + U), (35.5, 47 + U)]), APRON, 3, sigma=1.4, line="soft")
    f.add(m_poly([(34, 47 + U), (46, 47 + U), (47.5, 60), (48, 70), (32, 70), (32.5, 60)]), APRON, 3.2,
          sigma=1.8, line="soft", tex=tex_folds([36, 43], 54))
    # Alcas do avental e cordao da cintura
    f.vline(36, 30 + U, 34 + U, APRON[1]); f.vline(43, 30 + U, 34 + U, APRON[1])
    f.add(m_rect(33, 46 + U, 47, 47 + U), LEATHER, 3.5, sigma=0.6, vgrad=0.0)
    # Bolsa de ervas no quadril direito da tela (com folhas)
    f.add(m_ellipse(48.5, 54 + U, 3.6, 4.0), LEATHER, 4, sigma=1.2, tex=tex_leather_stitch([48]))
    f.add(m_poly([(46, 49 + U), (48, 46 + U), (50, 48 + U), (52, 45 + U), (52.5, 50 + U), (46.5, 51 + U)]),
          GREEN, 3.9, sigma=0.9, line="soft")
    f.px(48, 52 + U, BRASS[2])
    f.vline(47, 47 + U, 50 + U, LEATHER[1])
    # Braco de tras (direita da tela): mao na bolsa
    f.add(m_capsule(47.5, 32 + U, 49.5, 41 + U, 2.9, 2.6), DRESS, 2.5)
    f.add(m_capsule(49.5, 41 + U, 50, 49 + arm, 2.4, 2.1), SKIN, 4.5)
    f.add(m_ellipse(50, 50 + arm, 2.3, 2.2), SKIN, 4.6, sigma=1.0)
    # Braco da frente (esquerda da tela): levanta o frasco na altura do peito
    f.add(m_capsule(32.5, 32 + U, 30.5, 41 + U, 2.9, 2.6), DRESS, 5)
    f.add(m_capsule(30.5, 41 + U, 33, 45 + arm, 2.4, 2.2), SKIN, 5.2)
    # Frasco (vidro + pocao vermelha + rolha)
    fx, fy = 33, 39 + arm
    f.add(m_ellipse(fx + 0.5, fy + 1.5, 2.9, 3.0), POTION, 5.4, sigma=1.0, bias=0.1)
    f.add(m_rect(fx - 1, fy - 4, fx + 1, fy - 2), GLASS, 5.5, sigma=0.6, vgrad=0.0)
    f.add(m_rect(fx - 1, fy - 6, fx + 1, fy - 5), WOOD, 5.6, sigma=0.6, vgrad=0.0)
    f.px(fx - 1 + glint, fy, POTION[3]); f.px(fx - 1 + glint, fy + 1, (255, 214, 200))
    f.add(m_ellipse(33.5, 45 + arm, 2.4, 2.3), SKIN, 5.8, sigma=1.0)
    f.px(32, 44 + arm, SKIN[1]); f.px(33, 44 + arm, SKIN[1])
    # Cabeca (frente)
    H = U
    f.add(m_capsule(40, 27 + H, 40, 30 + H, 2.2), SKIN, 6, sigma=0.8, bias=-0.25)  # pescoco
    f.add(m_ellipse(40, 19 + H, 8.4, 9.4), SKIN, 7, sigma=2.0, bias=0.05)
    # Franja / laterais / topo
    top = m_ellipse(40, 16 + H, 9.6, 8.4) & ~m_poly([(33.5, 18 + H), (37, 15.5 + H), (41, 17 + H),
                                                       (45, 15 + H), (47, 18 + H), (47, 30 + H), (33, 30 + H)])
    f.add(top, HAIR_AUB, 8, sigma=1.6, tex=tex_hair(4))
    # Mecha lateral esquerda e tranca sobre o ombro direito da tela
    f.add(m_poly([(31, 17 + H), (34, 17 + H), (34, 26 + H), (32.5, 31 + H), (30.5, 28 + H)]), HAIR_AUB, 8.1,
          sigma=1.2, tex=tex_hair(5))
    braid = m_poly([(46, 17 + H), (49.5, 17 + H), (50, 27 + H), (48.5, 33 + H)])
    for i, by in enumerate(range(31, 45, 3)):
        braid |= m_ellipse(48 + (i % 2) * 0.5 + (sway if by > 38 else 0), by + H, 2.0, 1.8)
    f.add(braid, HAIR_AUB, 8.2, sigma=1.1, line="soft")
    f.px(48, 45 + H, (110, 160, 90)); f.px(49, 45 + H, (84, 128, 54))  # fita verde
    # Olhos (frente), boca, bochechas
    for ex in (36, 42):
        f.px(ex, 19 + H, EYE); f.px(ex + 1, 19 + H, EYE)
        f.px(ex, 20 + H, (78, 104, 60)); f.px(ex + 1, 20 + H, EYE)
        f.hline(ex - 1 if ex == 36 else ex, ex + 1 if ex == 36 else ex + 2, 17 + H, HAIR_AUB[1])
    f.px(39, 22 + H, SKIN[1]); f.px(40, 23 + H, SKIN[1])
    f.hline(39, 41, 25 + H, (170, 96, 88))
    f.px(35, 22 + H, (232, 150, 130)); f.px(44, 22 + H, (232, 150, 130))
    return f


# ---------------------------------------------------------------------------
# Gorran (3/4 para a esquerda, martelo na mao da frente)
# ---------------------------------------------------------------------------

def solve_ik(sx, sy, hx, hy, l1, l2, bend):
    dx, dy = hx - sx, hy - sy
    d = max(1e-3, min(math.hypot(dx, dy), l1 + l2 - 1e-3))
    a = math.atan2(dy, dx)
    cos_b = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
    bang = math.acos(max(-1.0, min(1.0, cos_b)))
    ang = a + bend * bang
    return sx + math.cos(ang) * l1, sy + math.sin(ang) * l1


def build_gorran(b: int, hand: Tuple[float, float], hang: float, lean: int, crouch: int, arm2: int) -> Figure:
    """hand = posicao do punho do martelo; hang = angulo do cabo (0 = para cima, graus, horario)."""
    f = Figure()
    U = b + crouch
    L = lean
    # Pernas largas
    f.add(m_capsule(46, 54, 47.5, 65, 4.4, 3.8), PANTS, 1, vgrad=0.3)
    f.add(m_poly([(43, 64), (52, 64), (52, 75), (42.5, 75)]), LEATHER_DK, 1.2, sigma=1.2, bias=-0.05)
    f.add(m_capsule(35, 54, 33, 65, 4.6, 4.0), PANTS, 2, vgrad=0.3)
    f.add(m_poly([(29, 64), (38.5, 64), (38.5, 75), (25.5, 75), (25.5, 72), (29, 70)]), LEATHER_DK, 2.2, sigma=1.2)
    f.hline(30, 38, 66, LEATHER[0]); f.hline(43, 51, 66, LEATHER[0])
    f.hline(30, 38, 65, LEATHER[2]); f.hline(43, 51, 65, LEATHER[2])
    # Tronco nu largo
    f.add(m_poly([(26 + L, 31 + U), (54 + L, 31 + U), (52 + L, 44 + U), (50.5, 55), (29.5, 55), (28 + L, 44 + U)]),
          SKIN_TAN, 3, sigma=2.4, bias=0.05, line='soft')
    # Braco de tras (direita da tela): punho na cintura
    sx2, sy2 = 53 + L, 34 + U
    f.add(m_capsule(sx2, sy2, 55 + L, 43 + U, 4.0, 3.5), SKIN_TAN, 2.6, sigma=1.8, line='soft')
    f.add(m_capsule(55 + L, 43 + U, 54.5 + L, 51 + arm2, 3.4, 3.0), SKIN_TAN, 4.8, sigma=1.6, line='soft')
    f.add(m_rect(51 + L, 47 + arm2, 58 + L, 49 + arm2) & m_capsule(55 + L, 43 + U, 54.5 + L, 51 + arm2, 3.5), LEATHER, 4.85,
          sigma=0.7, line=None)
    f.add(m_ellipse(54.5 + L, 52.5 + arm2, 2.9, 2.7), SKIN_TAN, 4.9, sigma=1.0)
    # Avental de couro (peito ao joelho)
    f.add(m_poly([(32 + L, 34 + U), (46 + L, 34 + U), (47 + L, 44 + U), (50, 52), (51, 63), (29, 63), (30, 52),
                  (31 + L, 44 + U)]), APRON_G, 4, sigma=2.0, vgrad=0.25, tex=tex_folds([34, 45], 54))
    f.hline(30, 50, 63, APRON_G[0])
    # bolso + rebites
    f.add(m_rect(35, 53, 44, 58), APRON_G, 4.2, sigma=0.8, line="soft", bias=-0.1)
    for x in (35, 44):
        f.px(x, 53, BRASS[3])
    # Alcas do avental pelos ombros e cinto
    f.add(m_poly([(32 + L, 34 + U), (34 + L, 34 + U), (31 + L, 30 + U), (29 + L, 30.5 + U)]), APRON_G, 4.1, sigma=0.6, line="soft")
    f.add(m_poly([(44 + L, 34 + U), (46 + L, 34 + U), (49 + L, 30.5 + U), (47 + L, 30 + U)]), APRON_G, 4.1, sigma=0.6, line="soft")
    f.add(m_rect(29, 50 + min(U, 1), 51, 52 + min(U, 1)), LEATHER_DK, 4.5, sigma=0.6, vgrad=0.0)
    f.add(m_rect(38, 50 + min(U, 1), 41, 52 + min(U, 1)), IRON, 4.6, sigma=0.6, vgrad=0.0)
    # Peitoral / clavicula visivel acima do avental
    f.hline(34 + L, 44 + L, 33 + U, SKIN_TAN[1])
    # Cabeca (3/4 esquerda, careca, barba cheia)
    H = U
    hx0 = 39 + L
    f.add(m_ellipse(hx0, 19 + H, 8.8, 9.6), SKIN_TAN, 6, sigma=2.0, bias=0.08)
    f.add(m_ellipse(hx0 + 6, 20 + H, 1.9, 2.5), SKIN_TAN, 6.5, sigma=0.9, line="soft")  # orelha
    # cabelo curto escuro nas laterais/nuca
    side = m_ellipse(hx0 + 1, 18 + H, 9.3, 9.0) & ~m_ellipse(hx0 - 1, 15 + H, 9.0, 7.2) & ~m_ellipse(hx0 - 3, 24 + H, 7, 8)
    f.add(side & ~m_ellipse(hx0 + 6, 20 + H, 1.9, 2.5), BEARD_DK, 6.4, sigma=1.0, line="soft")
    # Barba cheia
    f.add(m_poly([(hx0 + 4, 21 + H), (hx0 + 3, 24 + H), (hx0 - 2, 23.5 + H), (hx0 - 8, 22 + H), (hx0 - 8.5, 26 + H),
                  (hx0 - 5, 32 + H), (hx0 + 1, 33 + H), (hx0 + 5, 29 + H)]), BEARD_DK, 7, sigma=1.4,
          line="soft", tex=tex_hair(6))
    f.hline(hx0 - 7, hx0 - 2, 23 + H, BEARD_DK[2])
    f.hline(hx0 - 6, hx0 - 3, 24 + H, (96, 56, 48))
    # Olhos (3/4 esquerda) e sobrancelhas
    for ex in (hx0 - 7, hx0 - 2):
        f.px(ex, 18 + H, EYE); f.px(ex + 1, 18 + H, EYE); f.px(ex, 19 + H, (60, 40, 34)); f.px(ex + 1, 19 + H, SKIN_TAN[1])
        f.hline(ex - 1, ex + 1, 16 + H, BEARD_DK[1])
    f.px(hx0 - 9, 19 + H, SKIN_TAN[2]); f.px(hx0 - 9, 20 + H, SKIN_TAN[1]); f.px(hx0 - 10, 20 + H, SKIN_TAN[1])
    f.px(hx0 - 2, 12 + H, SKIN_TAN[3]); f.px(hx0 - 3, 12 + H, SKIN_TAN[3]); f.px(hx0 - 2, 13 + H, SKIN_TAN[3])

    # Braco da frente (esquerda da tela) com o martelo: IK ombro->cotovelo->mao
    sx, sy = 27 + L, 34 + U
    hxp, hyp = hand
    ex, ey = solve_ik(sx, sy, hxp, hyp, 9.5, 9.0, bend=-1 if hxp < sx + 2 else 1)
    a = math.radians(hang)
    ux, uy = math.sin(a), -math.cos(a)
    # cabo
    tail = (hxp - ux * 3, hyp - uy * 3)
    head_c = (hxp + ux * 13, hyp + uy * 13)
    f.add(m_capsule(tail[0], tail[1], head_c[0], head_c[1], 1.15), WOOD, 8.5, sigma=0.8, line="hard", vgrad=0.0)
    hang_r = math.atan2(uy, ux)
    f.add(m_rot_rect(head_c[0], head_c[1], 6.5, 10.5, hang_r), IRON, 8.6, sigma=1.0, vgrad=0.0)
    # bracos grossos
    f.add(m_capsule(sx, sy, ex, ey, 4.4, 3.8), SKIN_TAN, 8.0, sigma=1.8, line='soft')
    f.add(m_capsule(ex, ey, hxp, hyp, 3.7, 3.2), SKIN_TAN, 8.8, sigma=1.6, line='soft')
    # munhequeira de couro
    wx, wy = ex + (hxp - ex) * 0.72, ey + (hyp - ey) * 0.72
    f.add(m_capsule(wx, wy, ex + (hxp - ex) * 0.9, ey + (hyp - ey) * 0.9, 3.4) & m_capsule(ex, ey, hxp, hyp, 3.3),
          LEATHER, 8.9, sigma=0.8, line=None)
    f.add(m_ellipse(hxp, hyp, 3.0, 2.9), SKIN_TAN, 9.0, sigma=1.0)
    # ombro largo por cima do tronco
    f.add(m_ellipse(sx + 1, sy, 4.8, 4.2), SKIN_TAN, 7.9, sigma=1.6, line=None)
    return f


# ---------------------------------------------------------------------------
# Animacoes
# ---------------------------------------------------------------------------

BREATH = (0, 0, 1, 1, 1, 0)      # tronco/cabeca
ARM_LAG = (0, 0, 0, 1, 1, 1)     # bracos acompanham com atraso
SWAY = (0, 0, 0, -1, -1, 0)      # barra de capa/saia/tranca


def master_frames() -> List[Image.Image]:
    return [render(build_master(BREATH[i], ARM_LAG[i], SWAY[i])) for i in range(6)]


def lyra_frames() -> List[Image.Image]:
    glint = (0, 0, 1, 1, 0, 0)
    return [render(build_lyra(BREATH[i], ARM_LAG[i], SWAY[i], glint[i])) for i in range(6)]


GORRAN_REST = ((24.0, 49.0), -150.0)

# (mao, angulo do cabo, inclinacao, agachamento)
HAMMER_POSES = (
    ((24.0, 48.0), -150.0, 0, 0),   # 0 pronto
    ((23.0, 39.0), -75.0, 0, 0),    # 1 ergue
    ((24.0, 29.0), -30.0, 0, 0),    # 2 alto
    ((24.0, 25.0), -8.0, 1, 0),     # 3 topo (carrega)
    ((21.0, 37.0), -95.0, -1, 0),   # 4 desce
    ((19.0, 47.0), -125.0, -1, 1),  # 5 IMPACTO
    ((20.0, 45.0), -112.0, -1, 1),  # 6 rebote
    ((23.0, 47.0), -140.0, 0, 0),   # 7 volta
)
HAMMER_IMPACT = 5


def gorran_idle_frames() -> List[Image.Image]:
    (hx, hy), ang = GORRAN_REST
    return [render(build_gorran(BREATH[i], (hx, hy + ARM_LAG[i]), ang, 0, 0, ARM_LAG[i])) for i in range(6)]


def hammer_head_point(hand, ang) -> Tuple[float, float]:
    a = math.radians(ang)
    ux, uy = math.sin(a), -math.cos(a)
    cx, cy = hand[0] + ux * 13, hand[1] + uy * 13
    # face de batida: borda do bloco de ferro no sentido do golpe (perpendicular ao cabo, para baixo)
    px_, py_ = -uy, ux
    if py_ < 0:
        px_, py_ = -px_, -py_
    return cx + px_ * 5.2, cy + py_ * 5.2


def gorran_hammer_frames() -> List[Image.Image]:
    out = []
    for hand, ang, lean, crouch in HAMMER_POSES:
        out.append(render(build_gorran(0, hand, ang, lean, crouch, crouch)))
    return out


# ---------------------------------------------------------------------------
# Saida: folhas, manifesto e prancha
# ---------------------------------------------------------------------------

def strip(frames: Sequence[Image.Image]) -> Image.Image:
    im = Image.new("RGBA", (FW * len(frames), FH), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        im.paste(fr, (i * FW, 0))
    return im


def sheet_entry(key: str, frames: List[str], anims: Dict[str, dict], extra: Optional[dict] = None) -> dict:
    e = {
        "key": key,
        "file": f"{key}.png",
        "width": FW * len(frames),
        "height": FH,
        "frameWidth": FW,
        "frameHeight": FH,
        "frames": frames,
        "origin": {"x": CENTER_X / FW, "y": FOOT_Y / FH},
        "animations": anims,
    }
    if extra:
        e.update(extra)
    return e


def build_preview(sheets: Dict[str, List[Image.Image]], hero: Image.Image) -> Image.Image:
    BG = (34, 32, 30, 255)
    GROUND = (52, 46, 40, 255)
    hero_idle = hero.crop((0, 0, FW, FH))
    lineup = [hero_idle, sheets["village_npc_master"][0], sheets["village_npc_lyra"][0], sheets["village_npc_gorran"][0]]
    names = ["heroi", "mestre", "lyra", "gorran"]
    Z = 4
    W = max(4 * FW * Z + 40, 40 + 8 * (FW * 2 + 4))
    one_h = FH + 20
    big_h = FH * Z + 20
    strips = [("mestre idle", sheets["village_npc_master"]), ("lyra idle", sheets["village_npc_lyra"]),
              ("gorran idle", sheets["village_npc_gorran"][:6]), ("gorran hammer (impacto = 5)", sheets["village_npc_gorran"][6:])]
    SZ = 2
    strip_h = sum(FH * SZ + 18 for _ in strips)
    H = 30 + one_h + big_h + strip_h + 20
    im = Image.new("RGBA", (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((10, 8), "T-134 NPCs da Vila - 1:1 e 4x ao lado do heroi (pes em y=76, linha marrom)", fill=(230, 220, 200))
    # 1:1
    y = 30
    for i, fr in enumerate(lineup):
        x = 20 + i * 90
        d.rectangle([x, y + FOOT_Y, x + FW - 1, y + FOOT_Y + 3], fill=GROUND)
        im.alpha_composite(fr, (x, y))
        d.text((x + 4, y + FH + 4), names[i], fill=(200, 190, 170))
    # 4x
    y += one_h
    for i, fr in enumerate(lineup):
        x = 20 + i * FW * Z
        d.rectangle([x, y + FOOT_Y * Z, x + FW * Z - 1, y + FOOT_Y * Z + 3], fill=GROUND)
        im.alpha_composite(fr.resize((FW * Z, FH * Z), Image.NEAREST), (x, y))
    y += big_h
    for label, frs in strips:
        d.text((10, y), label, fill=(200, 190, 170))
        y += 14
        for i, fr in enumerate(frs):
            x = 20 + i * (FW * SZ + 4)
            box = (60, 40, 36, 255) if ("hammer" in label and i == HAMMER_IMPACT) else (44, 41, 38, 255)
            d.rectangle([x, y, x + FW * SZ - 1, y + FH * SZ - 1], fill=box)
            im.alpha_composite(fr.resize((FW * SZ, FH * SZ), Image.NEAREST), (x, y))
        y += FH * SZ + 4
    return im


def main() -> None:
    master = master_frames()
    lyra = lyra_frames()
    g_idle = gorran_idle_frames()
    g_ham = gorran_hammer_frames()
    sheets = {
        "village_npc_master": master,
        "village_npc_lyra": lyra,
        "village_npc_gorran": g_idle + g_ham,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for key, frs in sheets.items():
        strip(frs).save(OUT_DIR / f"{key}.png")

    idle_names = [f"idle{i}" for i in range(6)]
    ham_names = [f"hammer{i}" for i in range(8)]
    idle_anim = {"frames": list(range(6)), "frameRate": 5, "repeat": -1}
    hp = HAMMER_POSES[HAMMER_IMPACT]
    ix, iy = hammer_head_point(hp[0], hp[1])
    frag = {
        "sprites": {
            "village_npc_master": sheet_entry("village_npc_master", idle_names, {"idle": idle_anim}),
            "village_npc_lyra": sheet_entry("village_npc_lyra", idle_names, {"idle": idle_anim}),
            "village_npc_gorran": sheet_entry(
                "village_npc_gorran",
                idle_names + ham_names,
                {
                    "idle": idle_anim,
                    "hammer": {"frames": list(range(6, 14)), "frameRate": 10, "repeat": -1, "repeatDelay": 400},
                },
                {
                    "hammerImpact": {
                        "frame": 6 + HAMMER_IMPACT,
                        "frameName": f"hammer{HAMMER_IMPACT}",
                        "dx": round(ix - CENTER_X, 1),
                        "dy": round(iy - FOOT_Y, 1),
                    }
                },
            ),
        }
    }
    FRAG_PATH.parent.mkdir(parents=True, exist_ok=True)
    FRAG_PATH.write_text(json.dumps(frag, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    hero = Image.open(HERO_PATH).convert("RGBA")
    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    build_preview(sheets, hero).save(PREVIEW_PATH)
    for key, frs in sheets.items():
        bb = [fr.getbbox() for fr in frs]
        print(key, len(frs), "frames, bbox idle0:", bb[0])
    print("impacto:", frag["sprites"]["village_npc_gorran"]["hammerImpact"])


if __name__ == "__main__":
    main()
