#!/usr/bin/env python3
"""
BRF-171 / T-159 - Recorta as pecas da prancha ref_m11_ui_assets.png (fundo preto -> alfa),
gera fundos 960x540 e 844x390, registra no manifest.json (chaves menu_*) e monta a
prancha de conferencia assets/mockups/preview_m11_menu_assets.png.
Requer Pillow e NumPy.  Uso: python scripts/art/buildMenuAssets.py
"""
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "assets/mockups/ref_m11_ui_assets.png"
BG = ROOT / "assets/mockups/ref_m11_background.png"
OUT = ROOT / "public/assets/ui/menu"
MANIFEST = ROOT / "public/assets/sprites/manifest.json"
PREVIEW = ROOT / "assets/mockups/preview_m11_menu_assets.png"

# caixas de busca (x0,y0,x1,y1) na prancha 1024x572
BOXES = {
    "panel_frame_tall": (28, 50, 345, 560),
    "compass_logo": (440, 8, 600, 142),
    "btn_normal": (380, 148, 665, 218),
    "btn_selected": (378, 220, 668, 296),
    "btn_gold": (380, 374, 665, 448),
    "slot_dashed": (385, 458, 662, 540),
    "panel_frame_wide": (708, 48, 1000, 232),
    "panel_frame_wide_glow": (700, 240, 1006, 432),
    "icon_souls": (738, 432, 860, 556),
    "icon_essence": (872, 440, 958, 552),
}
THR = 10  # preto de fundo: max(canal) <= THR
GLOW = ("icon_souls", "icon_essence", "panel_frame_wide_glow", "btn_selected")
# margens 9-slice (left, top, right, bottom)
NINE = {
    "panel_frame_tall": (72, 72, 72, 72),
    "panel_frame_wide": (56, 56, 56, 56),
    "panel_frame_wide_glow": (64, 64, 64, 64),
    "btn_normal": (28, 14, 28, 14),
    "btn_selected": (36, 18, 36, 18),
    "btn_gold": (28, 14, 28, 14),
    "btn_locked": (28, 14, 28, 14),
    "slot_dashed": (20, 20, 20, 20),
}


def cut(src, box, key):
    a = np.array(src.crop(box).convert("RGB")).astype(np.float32)
    mx = a.max(2)
    dark = mx <= (34 if key in GLOW else THR)  # halos tem anel escuro assado na fonte
    h, w = dark.shape
    bg = np.zeros_like(dark)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if dark[y, x] and not bg[y, x]:
                bg[y, x] = True
                dq.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if dark[y, x] and not bg[y, x]:
                bg[y, x] = True
                dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and dark[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                dq.append((ny, nx))
    if key == "slot_dashed":  # tracejado tem falhas: mascara retangular arredondada
        m = Image.new("L", (w, h), 0)
        ys, xs = np.where(mx > 25)
        ImageDraw.Draw(m).rounded_rectangle((xs.min(), ys.min(), xs.max(), ys.max()), 14, fill=255)
        alpha = np.array(m).astype(np.float32) / 255
    else:
        # halo: alfa = brilho/160 (equivale a brilho aditivo sobre preto, sem anel escuro)
        soft = np.clip((mx - 16) / 150.0, 0, 1)
        if key not in GLOW:
            soft = np.where(mx > 20, np.clip((mx - 3) / 45.0, 0, 1), 0.0)
        alpha = np.where(bg, soft, 1.0)
    rgb = np.where(bg[..., None] & (alpha[..., None] > 0), np.clip(a / np.maximum(alpha[..., None], 0.05), 0, 255), a)
    im = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), "RGBA")
    bb = Image.fromarray((alpha > 0.03).astype(np.uint8) * 255).getbbox()
    return im.crop(bb)


def make_lock():
    S = 4
    im = Image.new("RGBA", (44 * S, 56 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    steel = (150, 140, 120, 255)
    d.arc((9 * S, 2 * S, 35 * S, 34 * S), 180, 360, fill=steel, width=5 * S)
    d.line((11 * S, 18 * S, 11 * S, 28 * S), fill=steel, width=5 * S)
    d.line((33 * S, 18 * S, 33 * S, 28 * S), fill=steel, width=5 * S)
    d.rounded_rectangle((4 * S, 26 * S, 40 * S, 54 * S), 4 * S, fill=(120, 96, 52, 255), outline=(40, 32, 22, 255), width=2 * S)
    d.rounded_rectangle((7 * S, 29 * S, 37 * S, 51 * S), 3 * S, fill=(88, 72, 44, 255))
    d.rectangle((7 * S, 29 * S, 37 * S, 33 * S), fill=(168, 132, 70, 255))
    d.ellipse((19 * S, 35 * S, 25 * S, 41 * S), fill=(18, 14, 10, 255))
    d.polygon([(20.5 * S, 40 * S), (23.5 * S, 40 * S), (24.5 * S, 47 * S), (19.5 * S, 47 * S)], fill=(18, 14, 10, 255))
    return im.resize((44, 56), Image.LANCZOS)


def make_locked(btn):
    a = np.array(btn).astype(np.float32)
    g = a[..., :3].mean(2, keepdims=True)
    a[..., :3] = (a[..., :3] * 0.4 + g * 0.2) * 0.75
    im = Image.fromarray(a.astype(np.uint8), "RGBA")
    h = im.height
    sock = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sock).ellipse((34 - 15, h // 2 - 15, 34 + 15, h // 2 + 15), fill=(8, 8, 10, 150))
    return Image.alpha_composite(im, sock)


def background():
    bg = Image.open(BG).convert("RGB")
    W, H = bg.size
    cw = round(H * 16 / 9)
    x0 = (W - cw) // 2
    d = bg.crop((x0, 0, x0 + cw, H)).resize((960, 540), Image.LANCZOS)
    mh = round(W * 390 / 844)
    m = bg.crop((0, 60, W, 60 + mh)).resize((844, 390), Image.LANCZOS)

    def vignette(im):
        w, h = im.size
        y, x = np.ogrid[:h, :w]
        r = np.sqrt(((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2)
        f = 1 - 0.38 * np.clip((r - 0.55) / 0.85, 0, 1) ** 1.5
        return Image.fromarray((np.array(im).astype(np.float32) * f[..., None]).astype(np.uint8))

    return vignette(d), vignette(m)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    src = Image.open(SRC)
    pieces = {k: cut(src, b, k) for k, b in BOXES.items()}
    pieces["btn_locked"] = make_locked(pieces["btn_normal"])
    pieces["icon_lock"] = make_lock()
    bgd, bgm = background()
    bgd.save(OUT / "menu_bg.png")
    bgm.save(OUT / "menu_bg_mobile.png")
    entries = {}
    for k, im in pieces.items():
        im.save(OUT / f"{k}.png")
        e = {"key": f"menu_{k}", "file": f"../ui/menu/{k}.png", "width": im.width, "height": im.height}
        if k in NINE:
            l, t, r, b = NINE[k]
            e["nineSlice"] = {"left": l, "top": t, "right": r, "bottom": b}
        entries[f"menu_{k}"] = e
    entries["menu_bg"] = {"key": "menu_bg", "file": "../ui/menu/menu_bg.png", "width": 960, "height": 540}
    entries["menu_bg_mobile"] = {"key": "menu_bg_mobile", "file": "../ui/menu/menu_bg_mobile.png", "width": 844, "height": 390}
    man = json.loads(MANIFEST.read_text(encoding="utf-8"))
    man["sprites"] = {k: v for k, v in man["sprites"].items() if not k.startswith("menu_")}
    man["sprites"].update(entries)
    MANIFEST.write_text(json.dumps(man, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    P = bgd.convert("RGBA")

    def put(k, x, y, size=None):
        im = pieces[k]
        if size:
            im = im.resize(size, Image.LANCZOS)
        P.alpha_composite(im, (x, y))

    t = pieces["panel_frame_tall"]
    put("panel_frame_tall", 20, 20, (t.width * 500 // t.height, 500))
    put("compass_logo", 260, 14)
    for i, k in enumerate(["btn_normal", "btn_selected", "btn_gold", "btn_locked", "slot_dashed"]):
        put(k, 240, 120 + i * 70)
    put("panel_frame_wide", 560, 20)
    put("panel_frame_wide_glow", 540, 210)
    put("icon_souls", 560, 420)
    put("icon_essence", 700, 420)
    put("icon_lock", 790, 420)
    P.convert("RGB").save(PREVIEW)
    print({k: v.size for k, v in pieces.items()})


if __name__ == "__main__":
    main()
