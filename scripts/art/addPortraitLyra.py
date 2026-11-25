"""T-154 (BRF-167) - Retrato 2D da Lyra (curandeira da Vila) como frame 8 de portraits.png.

Os frames 0-7 de `public/assets/sprites/portraits.png` vem de arte pintada (pipeline de
`buildUiAssets.py`, a partir de `assets/sprites_src/ui/portraits_raw.jpg`). Este script
pinta a Lyra por codigo no mesmo estilo (busto 2D sem fundo, contorno escuro, luz vinda
de cima/esquerda, rosto na mesma escala), coerente com o sprite in-game: ruiva de trancas,
vestido verde, avental claro e frasco vermelho.

Idempotente: le apenas os frames 0-7 (os primeiros 1024 px) da folha atual, anexa o
frame 8 (`village_healer`) e grava a folha com 1152x128. Atualiza a entrada `portraits`
do manifest e gera a prancha `assets/mockups/preview_m10_portrait_lyra.png`.

Atencao: `buildUiAssets.py --publish` regrava a folha com 1024x128 (8 frames); depois
dele, rode este script de novo.

Uso: py scripts/art/addPortraitLyra.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SHEET = ROOT / "public" / "assets" / "sprites" / "portraits.png"
MANIFEST = ROOT / "public" / "assets" / "sprites" / "manifest.json"
PREVIEW = ROOT / "assets" / "mockups" / "preview_m10_portrait_lyra.png"

BASE_FRAMES = [
    "hero_living",
    "hero_wraith",
    "weapon_master",
    "village_blacksmith",
    "emissary",
    "spectral_blacksmith",
    "infernal_warden",
    "system",
]
LYRA_FRAME = "village_healer"
FRAME = 128
SS = 4  # supersampling
N = FRAME * SS

INK = (30, 18, 15)


# ---------------------------------------------------------------------------
# Primitivas de pintura (canvas float RGBA em N x N)
# ---------------------------------------------------------------------------

def P(pts):
    return [(x * SS, y * SS) for x, y in pts]


def mask_poly(pts) -> np.ndarray:
    im = Image.new("L", (N, N), 0)
    ImageDraw.Draw(im).polygon(P(pts), fill=255)
    return np.asarray(im, dtype=np.float32) / 255.0


def mask_ellipse(x0, y0, x1, y1) -> np.ndarray:
    im = Image.new("L", (N, N), 0)
    ImageDraw.Draw(im).ellipse((x0 * SS, y0 * SS, x1 * SS, y1 * SS), fill=255)
    return np.asarray(im, dtype=np.float32) / 255.0


def mask_lines(paths, width) -> np.ndarray:
    im = Image.new("L", (N, N), 0)
    d = ImageDraw.Draw(im)
    for pts in paths:
        d.line(P(pts), fill=255, width=max(1, int(round(width * SS))), joint="curve")
        r = width * SS / 2
        for x, y in (pts[0], pts[-1]):
            d.ellipse((x * SS - r, y * SS - r, x * SS + r, y * SS + r), fill=255)
    return np.asarray(im, dtype=np.float32) / 255.0


def blur(m: np.ndarray, r: float) -> np.ndarray:
    im = Image.fromarray(np.clip(m * 255, 0, 255).astype(np.uint8), "L")
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r * SS)), dtype=np.float32) / 255.0


def shift(m: np.ndarray, dx: float, dy: float) -> np.ndarray:
    dx, dy = int(round(dx * SS)), int(round(dy * SS))
    out = np.zeros_like(m)
    h, w = m.shape
    xs0, xs1 = max(0, -dx), min(w, w - dx)
    ys0, ys1 = max(0, -dy), min(h, h - dy)
    out[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx] = m[ys0:ys1, xs0:xs1]
    return out


def bez(p0, p1, p2, n=24):
    pts = []
    for i in range(n + 1):
        t = i / n
        a = (1 - t) ** 2
        b = 2 * (1 - t) * t
        c = t * t
        pts.append((a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]))
    return pts


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


class Canvas:
    def __init__(self) -> None:
        self.rgb = np.zeros((N, N, 3), np.float32)
        self.a = np.zeros((N, N), np.float32)

    def paint(self, mask: np.ndarray, color, opacity: float = 1.0) -> None:
        m = np.clip(mask * opacity, 0, 1)
        col = np.asarray(color, np.float32)
        if col.ndim == 1:
            col = col[None, None, :]
        self.rgb = self.rgb * (1 - m[..., None]) + col * m[..., None]
        self.a = self.a + m * (1 - self.a)

    def volume(self, mask, dark, base, light, *, soft=4.0, off=5.0, rim=2.0, clip=None):
        """Preenche `mask` com sombreamento de volume (luz de cima/esquerda)."""
        lit = blur(shift(mask, -off * 0.7, -off), soft)  # longe da borda inferior-direita
        t = smoothstep(0.25, 0.85, lit)
        hl = mask * (1 - blur(shift(mask, rim * 0.8, rim), soft * 0.35))
        hl = smoothstep(0.2, 0.9, hl) * 0.55
        dark = np.asarray(dark, np.float32)
        base = np.asarray(base, np.float32)
        light = np.asarray(light, np.float32)
        col = dark * (1 - t[..., None]) + base * t[..., None]
        col = col * (1 - hl[..., None]) + light * hl[..., None]
        m = mask if clip is None else mask * clip
        self.paint(m, col)

    def tone(self, mask, color, opacity, clip=None) -> None:
        m = mask if clip is None else mask * clip
        self.paint(m, color, opacity)

    def ink(self, paths, width=1.0, color=INK, opacity=1.0, clip=None) -> None:
        m = mask_lines(paths, width)
        if clip is not None:
            m = m * clip
        self.paint(m, color, opacity)


# ---------------------------------------------------------------------------
# Lyra
# ---------------------------------------------------------------------------

SKIN = ((176, 112, 86), (234, 186, 152), (252, 220, 192))
HAIR = ((92, 30, 16), (168, 68, 32), (224, 126, 64))
DRESS = ((26, 44, 30), (60, 92, 58), (104, 140, 88))
APRON = ((140, 124, 98), (206, 192, 160), (236, 228, 204))
EYE = (66, 128, 70)


def paint_lyra() -> Image.Image:
    cv = Canvas()

    # --- cabelo de tras (aparece entre pescoco e trancas) ----------------------
    back_hair = mask_poly([(42, 34), (38, 52), (37, 72), (40, 84), (88, 84), (91, 72), (90, 52), (86, 34)])
    cv.volume(back_hair, (60, 20, 12), (120, 46, 22), (170, 80, 40), soft=5, off=6)

    # --- corpo: vestido verde --------------------------------------------------
    body_pts = [
        (6, 116), (7, 106), (11, 96), (19, 88), (31, 82), (44, 78), (54, 75),
        (74, 75), (84, 78), (97, 82), (109, 88), (117, 96), (121, 106), (122, 116),
        (104, 120), (84, 124), (64, 125.5), (44, 124), (24, 120),
    ]
    body = mask_poly(body_pts)
    cv.volume(body, *DRESS, soft=7, off=10, rim=2.5)
    # dobras e costura da manga bufante
    for side in (1, -1):
        def X(x):
            return x if side == 1 else 128 - x
        cv.ink([bez((X(24), 85), (X(30), 98), (X(28), 112))], 1.0, DRESS[0], 0.9, clip=body)
        cv.ink([bez((X(14), 100), (X(20), 108), (X(18), 120))], 0.9, DRESS[0], 0.8, clip=body)
        cv.ink([bez((X(33), 84), (X(37), 92), (X(36), 104))], 0.7, DRESS[2], 0.55, clip=body)
    cv.ink([bez((12, 98), (16, 92), (22, 88))], 0.8, DRESS[2], 0.6, clip=body)
    # sombra do cabelo/cabeca sobre os ombros e lado direito mais escuro
    cv.tone(blur(mask_poly([(34, 78), (94, 78), (98, 92), (30, 92)]), 3.0), DRESS[0], 0.55, clip=body)
    cv.tone(blur(mask_poly([(84, 76), (124, 96), (124, 126), (90, 126)]), 6.0), DRESS[0], 0.45, clip=body)

    # --- pescoco e decote ---------------------------------------------------------
    skin_body = mask_poly([(56, 54), (72, 54), (73, 72), (80, 76), (70, 86), (64, 89), (58, 86), (48, 76), (55, 72)])
    cv.volume(skin_body, *SKIN, soft=3, off=3)
    # sombra do queixo no pescoco
    cv.tone(blur(mask_ellipse(52, 56, 76, 70), 1.5), SKIN[0], 0.75, clip=skin_body)
    cv.tone(blur(mask_poly([(66, 60), (73, 58), (73, 76), (68, 78)]), 1.5), SKIN[0], 0.45, clip=skin_body)
    # clavicula
    cv.ink([bez((55, 78), (59, 79), (62, 81))], 0.6, SKIN[0], 0.7)
    cv.ink([bez((73, 78), (69, 79), (66, 81))], 0.6, SKIN[0], 0.7)
    # gola do vestido (barra mais escura)
    cv.ink([[(47, 76), (56, 85), (64, 89.5), (72, 85), (81, 76)]], 2.0, DRESS[0], 1.0)
    cv.ink([[(47, 76), (56, 85), (64, 89.5), (72, 85), (81, 76)]], 0.7, INK, 1.0)

    # --- avental claro: peitilho + alcas ------------------------------------------
    straps = mask_lines([[(50, 95), (52, 86), (55, 76.5)], [(78, 95), (76, 86), (73, 76.5)]], 4.2)
    cv.volume(straps, *APRON, soft=1.5, off=2, rim=1)
    cv.ink([[(48, 95), (50, 86), (53, 76.5)]], 0.6, APRON[0], 0.8)
    cv.ink([[(80, 95), (78, 86), (75, 76.5)]], 0.6, APRON[0], 0.8)
    bib = mask_poly([(48, 94), (80, 94), (82.5, 126), (45.5, 126)]) * body
    cv.volume(bib, *APRON, soft=4, off=6, rim=1.5)
    cv.ink([[(48, 94), (80, 94)]], 0.9, INK)
    cv.ink([[(48, 94), (45.5, 126)]], 0.9, INK, clip=body)
    cv.ink([[(80, 94), (82.5, 126)]], 0.9, INK, clip=body)
    cv.ink([[(48.5, 96.5), (79.5, 96.5)]], 0.45, APRON[0], 0.8)  # costura
    cv.ink([bez((56, 100), (58, 112), (56, 125))], 0.7, APRON[0], 0.55, clip=bib)
    cv.ink([bez((73, 100), (71, 113), (73, 125))], 0.7, APRON[0], 0.55, clip=bib)
    # bolso do avental
    pocket = mask_poly([(52, 113), (76, 113), (75.5, 126), (52.5, 126)]) * body
    cv.tone(pocket, APRON[0], 0.35)
    cv.ink([[(52, 113), (76, 113)]], 0.8, INK, 0.9)
    cv.ink([[(64, 113), (64, 126)]], 0.5, APRON[0], 0.7, clip=body)

    # --- cordao + frasco vermelho ----------------------------------------------
    cv.ink([bez((57, 80), (59, 90), (64, 94))], 0.6, (70, 44, 26))
    cv.ink([bez((71, 80), (69, 90), (64, 94))], 0.6, (70, 44, 26))
    glow = blur(mask_ellipse(55, 95, 73, 113), 3.0)
    cv.tone(glow, (255, 70, 60), 0.35)
    flask_body = mask_ellipse(58, 98.5, 70, 110.5)
    flask_neck = mask_poly([(62.2, 94.5), (65.8, 94.5), (65.8, 99.5), (62.2, 99.5)])
    cork = mask_poly([(61.6, 92.4), (66.4, 92.4), (66, 95.2), (62, 95.2)])
    cv.paint(mask_ellipse(57.2, 97.7, 70.8, 111.3), INK)
    cv.paint(mask_poly([(61.4, 93.8), (66.6, 93.8), (66.6, 100), (61.4, 100)]), INK)
    cv.volume(flask_neck, (150, 170, 175), (205, 225, 228), (245, 255, 255), soft=0.6, off=1, rim=0.5)
    cv.volume(flask_body, (120, 10, 22), (212, 34, 44), (255, 120, 110), soft=2, off=3, rim=1.2)
    cv.tone(mask_ellipse(59, 104.5, 69, 110.3), (150, 14, 26), 0.6)  # liquido assentado
    cv.paint(mask_ellipse(60.2, 100.4, 62.8, 103.6), (255, 236, 230), 0.95)  # reflexo
    cv.paint(mask_ellipse(66.3, 106, 67.6, 107.6), (255, 190, 180), 0.7)
    cv.volume(cork, (90, 56, 30), (150, 102, 60), (196, 148, 96), soft=0.6, off=1, rim=0.4)
    cv.ink([[(61.6, 92.4), (66.4, 92.4)]], 0.45, INK)

    # --- trancas (sobre os ombros) ------------------------------------------------
    def braid(path, n=8, w0=7.0, w1=5.4):
        pts = bez(*path, n=n)
        under = mask_lines([pts], w1 + 0.8)
        cv.paint(blur(under, 0.2), INK)
        cv.paint(mask_lines([pts], w1 - 0.6), HAIR[0])
        for i, (x, y) in enumerate(pts[:-1]):
            w = w0 + (w1 - w0) * i / n
            nx, ny = pts[i + 1]
            ang = math.atan2(ny - y, nx - x)
            sgn = 1 if i % 2 == 0 else -1
            ox, oy = -math.sin(ang) * 1.1 * sgn, math.cos(ang) * 1.1 * sgn
            cx, cy = x + ox, y + oy
            lobe = mask_ellipse(cx - w / 2 - 0.35, cy - w * 0.5 - 0.35, cx + w / 2 + 0.35, cy + w * 0.5 + 0.35)
            cv.paint(blur(lobe, 0.15) * 1.0, INK)
            inner = mask_ellipse(cx - w / 2, cy - w * 0.5, cx + w / 2, cy + w * 0.5)
            cv.volume(inner, *HAIR, soft=1.0, off=1.8, rim=0.8)
            cv.ink([[(cx - w * 0.32 * sgn, cy - w * 0.3), (cx + w * 0.2 * sgn, cy + w * 0.28)]], 0.5, HAIR[0], 0.7)
            cv.ink([[(cx - w * 0.28 * sgn, cy - w * 0.36), (cx + w * 0.05 * sgn, cy - w * 0.02)]], 0.45, HAIR[2], 0.7)
        ex, ey = pts[-1]
        # laco verde + ponta
        cv.paint(mask_ellipse(ex - 2.6, ey - 1.6, ex + 2.6, ey + 1.6), INK)
        cv.volume(mask_ellipse(ex - 2.1, ey - 1.1, ex + 2.1, ey + 1.1), *DRESS, soft=0.5, off=0.8, rim=0.4)
        tip = mask_poly([(ex - 2.2, ey + 1.2), (ex + 2.2, ey + 1.2), (ex + 1.2, ey + 6), (ex, ey + 7.5), (ex - 1.4, ey + 6)])
        cv.paint(blur(tip, 0.2), INK)
        cv.volume(mask_poly([(ex - 1.5, ey + 1.6), (ex + 1.5, ey + 1.6), (ex + 0.7, ey + 5.6), (ex, ey + 6.6), (ex - 0.8, ey + 5.6)]),
                  *HAIR, soft=0.6, off=1, rim=0.4)

    braid(((46, 56), (40, 76), (38, 101)), n=10)
    braid(((82, 56), (88, 76), (90, 101)), n=10)

    # --- rosto ----------------------------------------------------------------------
    face_pts = [(48, 28), (47.2, 40), (48.5, 50), (52, 58), (57, 63.5), (64, 66), (71, 63.5), (76, 58),
                (79.5, 50), (80.8, 40), (80, 28), (72, 20), (64, 18.5), (56, 20)]
    face = mask_poly(face_pts)
    cv.paint(blur(mask_poly([(x + (0.6 if x > 64 else -0.6), y + 0.8) for x, y in face_pts]), 0.2), INK)
    cv.volume(face, *SKIN, soft=4, off=4.5, rim=1.5)
    # modelagem: orbitas, lateral do nariz, bochechas, sombra direita
    cv.tone(blur(mask_ellipse(51, 37.5, 61.5, 45.5), 1.4), SKIN[0], 0.35, clip=face)
    cv.tone(blur(mask_ellipse(66.5, 37.5, 77, 45.5), 1.4), SKIN[0], 0.42, clip=face)
    cv.tone(blur(mask_poly([(65, 42), (67.5, 50), (66.5, 53.5), (64.5, 53)]), 0.9), SKIN[0], 0.5, clip=face)
    cv.tone(blur(mask_ellipse(50.5, 47.5, 58.5, 54.5), 2.0), (232, 120, 110), 0.38, clip=face)
    cv.tone(blur(mask_ellipse(70, 47.5, 78, 54.5), 2.0), (220, 110, 100), 0.33, clip=face)
    cv.tone(blur(mask_poly([(74, 30), (81, 30), (80, 52), (72, 62), (76, 46)]), 2.0), SKIN[0], 0.45, clip=face)
    cv.tone(blur(mask_ellipse(59, 62, 69, 66), 1.0), SKIN[0], 0.35, clip=face)  # sob o queixo/labio
    cv.tone(blur(mask_poly([(76, 40), (82, 40), (80, 52), (71, 64), (64, 67), (70, 60), (76, 52)]), 1.6), SKIN[0], 0.62, clip=face)
    cv.tone(blur(mask_poly([(48, 46), (50, 54), (56, 62), (52, 62), (46, 52)]), 1.4), SKIN[0], 0.35, clip=face)
    cv.paint(blur(mask_ellipse(52, 45.5, 57, 48.5), 1.0), SKIN[2], 0.45)  # maca do rosto
    cv.paint(blur(mask_ellipse(62.4, 44, 64.4, 51), 0.8), SKIN[2], 0.55)  # dorso do nariz
    cv.paint(blur(mask_ellipse(52, 29, 60, 34), 1.5), SKIN[2], 0.35)  # testa

    # sobrancelhas
    cv.ink([bez((51.5, 38.4), (55.5, 35.6), (60.6, 37.2))], 1.25, (110, 40, 22))
    cv.ink([bez((67.4, 37.2), (72.5, 35.6), (76.5, 38.4))], 1.25, (100, 36, 20))

    # olhos
    for cx, mirror in ((56.2, -1), (71.8, 1)):
        white = mask_poly([(cx - 4.0, 42.1), (cx - 2, 40.3), (cx + 1.2, 40.1), (cx + 4.0, 41.6),
                           (cx + 2, 43.6), (cx - 1.5, 43.9)] if mirror == 1 else
                          [(cx + 4.0, 42.1), (cx + 2, 40.3), (cx - 1.2, 40.1), (cx - 4.0, 41.6),
                           (cx - 2, 43.6), (cx + 1.5, 43.9)])
        cv.paint(white, (236, 226, 214))
        iris = mask_ellipse(cx - 1.95, 40.0, cx + 1.95, 43.9) * white
        cv.volume(mask_ellipse(cx - 1.95, 40.0, cx + 1.95, 43.9), (30, 70, 40), EYE, (130, 190, 110), soft=0.5,
                  off=0.8, rim=0.3, clip=white)
        cv.paint(mask_ellipse(cx - 0.9, 41.1, cx + 0.9, 42.9) * white, (16, 18, 14))
        cv.paint(mask_ellipse(cx - 0.9, 40.6, cx - 0.1, 41.4), (255, 255, 250), 0.95)
        cv.tone(mask_poly([(cx - 4, 40), (cx + 4, 40), (cx + 4, 41.2), (cx - 4, 41.2)]), (60, 40, 30), 0.35, clip=white)
        _ = iris
        # palpebra superior + cilio externo
        if mirror == 1:
            lid = [(cx - 4.2, 42.2), (cx - 2, 40.0), (cx + 1.4, 39.8), (cx + 4.3, 41.4)]
            lash = [(cx + 3.8, 41.0), (cx + 5.4, 40.0)]
        else:
            lid = [(cx + 4.2, 42.2), (cx + 2, 40.0), (cx - 1.4, 39.8), (cx - 4.3, 41.4)]
            lash = [(cx - 3.8, 41.0), (cx - 5.4, 40.0)]
        cv.ink([lid], 0.95, INK)
        cv.ink([lash], 0.7, INK)
        cv.ink([[(cx - 2.6, 44.3), (cx + 2.6, 44.3)]], 0.4, SKIN[0], 0.8)
        # dobra da palpebra
        cv.ink([[(cx - 3, 39.0), (cx, 38.4), (cx + 3, 38.8)]], 0.4, SKIN[0], 0.7)

    # nariz
    cv.ink([bez((65.2, 46), (66.6, 51), (65.4, 53.4))], 0.5, SKIN[0], 0.75)
    cv.ink([bez((61.8, 53.6), (64, 54.8), (66.4, 53.6))], 0.6, (140, 80, 64), 0.9)
    cv.paint(mask_ellipse(61.9, 52.9, 63.1, 54.0), (120, 66, 52), 0.7)
    cv.paint(mask_ellipse(64.9, 52.9, 66.1, 54.0), (120, 66, 52), 0.7)

    # boca (sorriso leve)
    lower = mask_ellipse(60.6, 57.8, 67.6, 61.2)
    cv.volume(lower, (160, 70, 64), (204, 106, 96), (236, 160, 148), soft=0.6, off=0.8, rim=0.4)
    upper = mask_poly([(59.8, 58.4), (62, 57.1), (64, 57.6), (66, 57.1), (68.4, 58.2), (64, 58.9)])
    cv.paint(upper, (176, 82, 74))
    cv.ink([bez((59.6, 58.2), (64, 59.6), (68.6, 57.9))], 0.6, (96, 40, 34))
    cv.ink([[(68.3, 57.9), (69.2, 57.2)]], 0.45, (96, 40, 34), 0.8)
    cv.paint(mask_ellipse(62.6, 59.2, 64.8, 60.3), (250, 200, 190), 0.6)

    # sardas
    rng = np.random.default_rng(154)
    for _ in range(14):
        side = rng.choice([-1, 1])
        x = 64 + side * rng.uniform(3.5, 11)
        y = rng.uniform(45.5, 51.5)
        r = rng.uniform(0.28, 0.42)
        cv.paint(mask_ellipse(x - r, y - r, x + r, y + r), (176, 100, 66), 0.32)

    # --- cabelo da frente (repartido ao meio, emoldura o rosto e vira trancas) --------
    hair_pts = [(44, 60), (41.5, 46), (41, 32), (44, 20), (52, 11), (64, 7.5), (76, 11), (84, 20), (87, 32),
                (86.5, 46), (84, 60), (80.5, 56), (80, 44), (78.4, 32), (73.5, 24), (67, 19.6), (64, 21),
                (61, 19.6), (54.5, 24), (49.6, 32), (48, 44), (47.5, 56)]
    hair = mask_poly(hair_pts)
    cv.paint(blur(mask_poly([(x + (0.7 if x > 64 else -0.7), y - 0.7 if y < 30 else y) for x, y in hair_pts]), 0.25), INK)
    cv.volume(hair, *HAIR, soft=4, off=7, rim=2)
    cv.tone(blur(mask_poly([(74, 14), (90, 30), (88, 60), (80, 58), (80, 30)]), 2.5), HAIR[0], 0.5, clip=hair)
    # mechas escuras e claras
    strands_dark = []
    strands_light = []
    for i in range(7):
        t = i / 6
        strands_dark.append(bez((63 - t * 2, 9), (46 - t * 3, 14 + t * 6), (44 + t * 3, 42 + t * 16)))
        strands_dark.append(bez((65 + t * 2, 9), (82 + t * 3, 14 + t * 6), (84 - t * 3, 42 + t * 16)))
    for i in range(5):
        t = i / 4
        strands_light.append(bez((62 - t * 2, 10), (50 - t * 3, 13 + t * 4), (45 + t * 2, 30 + t * 10)))
        strands_light.append(bez((66 + t * 2, 10), (78 + t * 2, 13 + t * 4), (82 - t * 2, 30 + t * 10)))
    cv.ink(strands_dark, 0.55, HAIR[0], 0.7, clip=hair)
    cv.ink(strands_light[0::2], 0.5, HAIR[2], 0.65, clip=hair)
    cv.ink(strands_light[1::2], 0.5, HAIR[2], 0.4, clip=hair)
    # risca e brilho do topo
    cv.ink([[(64, 8), (64, 20.6)]], 0.7, HAIR[0], 0.9)
    cv.paint(blur(mask_ellipse(49, 11, 60, 18), 1.5), (240, 150, 84), 0.45, )
    # sombra do cabelo na testa
    cv.tone(blur(mask_poly([(50, 31), (56, 23.5), (64, 21.5), (72, 23.5), (78, 31), (72, 27), (64, 25), (56, 27)]), 1.2),
            SKIN[0], 0.55, clip=face)

    # --- reducao para 128 e contorno ----------------------------------------------------
    rgba = np.dstack([cv.rgb * cv.a[..., None], cv.a * 255]).clip(0, 255).astype(np.uint8)
    # reduz em premultiplicado
    big = Image.fromarray(rgba, "RGBA")
    small = big.resize((FRAME, FRAME), Image.LANCZOS)
    arr = np.asarray(small, np.float32)
    a = arr[..., 3:4] / 255.0
    rgb = np.where(a > 0.003, arr[..., :3] / np.maximum(a, 1e-3), 0)
    rgb = rgb.clip(0, 255)
    a2 = a[..., 0]

    # contorno escuro externo (~1.5 px), como na arte pintada
    alpha_img = Image.fromarray((a2 * 255).astype(np.uint8), "L")
    hard = alpha_img.point(lambda v: 255 if v > 90 else 0)
    dil = hard.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.45))
    dil = np.asarray(dil, np.float32) / 255.0
    out_a = a2 + dil * (1 - a2)
    ink = np.asarray(INK, np.float32)
    out_rgb = (rgb * a2[..., None] + ink * (dil * (1 - a2))[..., None]) / np.maximum(out_a[..., None], 1e-3)
    out = np.dstack([out_rgb, out_a * 255]).clip(0, 255).astype(np.uint8)
    img = Image.fromarray(out, "RGBA")
    # nitidez leve no RGB (as outras imagens tem bordas bem marcadas)
    r, g, b, al = img.split()
    sharp = Image.merge("RGB", (r, g, b)).filter(ImageFilter.UnsharpMask(radius=1.0, percent=60, threshold=2))
    img = Image.merge("RGBA", (*sharp.split(), al))
    return img


# ---------------------------------------------------------------------------
# Folha, manifest e prancha
# ---------------------------------------------------------------------------

def build_sheet(lyra: Image.Image) -> Image.Image:
    src = Image.open(SHEET).convert("RGBA")
    if src.height != FRAME or src.width < FRAME * len(BASE_FRAMES):
        raise ValueError(f"portraits.png inesperado: {src.size}")
    base = src.crop((0, 0, FRAME * len(BASE_FRAMES), FRAME))
    sheet = Image.new("RGBA", (FRAME * (len(BASE_FRAMES) + 1), FRAME), (0, 0, 0, 0))
    sheet.paste(base, (0, 0))
    sheet.paste(lyra, (FRAME * len(BASE_FRAMES), 0))
    # garante que os frames 0-7 ficaram identicos
    assert sheet.crop((0, 0, base.width, FRAME)).tobytes() == base.tobytes()
    return sheet


def update_manifest(width: int) -> None:
    raw = MANIFEST.read_bytes()
    nl = "\r\n" if b"\r\n" in raw else "\n"
    manifest = json.loads(raw.decode("utf-8"))
    entry = manifest["sprites"]["portraits"]
    entry["width"] = width
    entry["frames"] = BASE_FRAMES + [LYRA_FRAME]
    text = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    if nl == "\r\n":
        text = text.replace("\n", "\r\n")
    MANIFEST.write_bytes(text.encode("utf-8"))


def _font(size: int):
    for name in ("segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def build_preview(sheet: Image.Image) -> Image.Image:
    names = BASE_FRAMES + [LYRA_FRAME]
    cell = 160
    pad = 16
    w = pad * 2 + cell * len(names)
    big = 320
    h = 40 + cell + 30 + 30 + big + 40
    board = Image.new("RGBA", (w, h), (34, 31, 30, 255))
    d = ImageDraw.Draw(board)
    f = _font(14)
    fb = _font(16)
    d.text((pad, 12), "T-154 Retrato da Lyra - portraits.png 1152x128 (9 frames 128x128); frame 8 = village_healer", font=fb,
           fill=(220, 210, 190))
    y0 = 40
    for i, name in enumerate(names):
        x = pad + i * cell
        bg = (60, 48, 40, 255) if i == 8 else (46, 42, 40, 255)
        d.rectangle((x + 4, y0, x + cell - 4, y0 + cell - 8), fill=bg)
        fr = sheet.crop((i * FRAME, 0, (i + 1) * FRAME, FRAME))
        board.alpha_composite(fr, (x + (cell - FRAME) // 2, y0 + 8))
        d.text((x + 8, y0 + cell - 2), f"{i} {name}", font=f, fill=(255, 200, 120) if i == 8 else (190, 180, 165))
    y1 = y0 + cell + 40
    d.text((pad, y1 - 4), "2x: Mestre de Armas (2) x Lyra (8) - fundo escuro e claro", font=f, fill=(190, 180, 165))
    y1 += 20
    x = pad
    for idx in (2, 8):
        for bg in ((24, 22, 22, 255), (210, 204, 196, 255)):
            d.rectangle((x, y1, x + big - 8, y1 + big - 8), fill=bg)
            fr = sheet.crop((idx * FRAME, 0, (idx + 1) * FRAME, FRAME)).resize((256, 256), Image.LANCZOS)
            board.alpha_composite(fr, (x + 28, y1 + 28))
            x += big
    return board


def main() -> None:
    lyra = paint_lyra()
    sheet = build_sheet(lyra)
    sheet.save(SHEET)
    update_manifest(sheet.width)
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    build_preview(sheet).convert("RGB").save(PREVIEW)
    print(f"Publicado: {SHEET} {sheet.size} ({sheet.width // FRAME} frames)")
    print(f"Atualizado: {MANIFEST} (portraits)")
    print(f"Prancha: {PREVIEW}")


if __name__ == "__main__":
    main()
