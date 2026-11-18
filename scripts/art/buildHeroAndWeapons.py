#!/usr/bin/env python3
"""
Gera os spritesheets finais 80x80 do heroi (hero_living.png, hero_wraith.png)
e 48x48 das armas (weapons.png) a partir das artes conceituais aprovadas em
assets/sprites_src/, removendo o fundo escuro via flood-fill conectado as bordas
e preservando os contornos pretos.
"""

from collections import deque
from pathlib import Path
import numpy as np
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = ROOT / "assets" / "sprites_src"
OUT_DIR = ROOT / "public" / "assets" / "sprites"
PREVIEW_DIR = ROOT / "assets" / "mockups"


def remove_dark_navy_bg(img: Image.Image, dist_thresh: float = 27.0) -> Image.Image:
    """
    Remove apenas o fundo escuro conectado as bordas da imagem via BFS flood-fill,
    preservando contornos pretos neutros e pixels internos fechados.
    """
    rgba = np.array(img.convert("RGBA"), dtype=np.uint8)
    h, w, _ = rgba.shape
    rgb = rgba[:, :, :3].astype(np.float32)

    # Cor de referencia do fundo: mediana dos 4 cantos
    corners = np.array([
        rgb[0, 0],
        rgb[0, w - 1],
        rgb[h - 1, 0],
        rgb[h - 1, w - 1],
    ])
    bg = np.median(corners, axis=0)

    dist = np.linalg.norm(rgb - bg, axis=-1)
    r = rgb[:, :, 0]
    g = rgb[:, :, 1]
    b = rgb[:, :, 2]

    # Fundo eh azul-marinho escuro (#11131f). Contornos pretos tem R~G~B <= 16.
    # Exige que ou esteja bem proximo do fundo (dist < 22) sem ser preto puro,
    # ou tenha tonalidade azulada (b - r >= 4) dentro do limiar.
    is_pure_black_outline = (r <= 14) & (g <= 14) & (b <= 16)
    candidate = (dist < dist_thresh) & (~is_pure_black_outline)

    visited = np.zeros((h, w), dtype=bool)
    bg_mask = np.zeros((h, w), dtype=bool)
    q = deque()

    # Semear todas as bordas
    for x in range(w):
        for y in (0, h - 1):
            if candidate[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if candidate[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))

    while q:
        cy, cx = q.popleft()
        bg_mask[cy, cx] = True
        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                if candidate[ny, nx]:
                    visited[ny, nx] = True
                    q.append((ny, nx))

    rgba[bg_mask, 3] = 0

    # Suavizar halo azulado fino na borda externa (pixels adjacentes ao fundo transparente)
    alpha = rgba[:, :, 3] > 0
    padded = np.pad(alpha, 1, mode="constant", constant_values=False)
    adj_transparent = (
        (~padded[:-2, 1:-1])
        | (~padded[2:, 1:-1])
        | (~padded[1:-1, :-2])
        | (~padded[1:-1, 2:])
    )
    halo_mask = (
        alpha
        & adj_transparent
        & (dist < dist_thresh + 14.0)
        & ((b - r) >= 5.0)
        & (r < 36)
        & (g < 40)
        & (b < 58)
    )
    rgba[halo_mask, 3] = 0

    return Image.fromarray(rgba, mode="RGBA")


def crop_to_content(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    if bbox is None:
        return img
    return img.crop(bbox)


def fit_sprite(img: Image.Image, target_h: int, max_w: int) -> Image.Image:
    scale = min(target_h / img.height, max_w / img.width)
    nw = max(1, int(round(img.width * scale)))
    nh = max(1, int(round(img.height * scale)))
    return img.resize((nw, nh), Image.Resampling.NEAREST)


def apply_flash(img: Image.Image, color=(255, 220, 220), strength: float = 0.55) -> Image.Image:
    arr = np.array(img, dtype=np.float32)
    mask = arr[:, :, 3] > 0
    for c in range(3):
        arr[mask, c] = arr[mask, c] * (1.0 - strength) + color[c] * strength
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), mode="RGBA")


def apply_ghost_tint(img: Image.Image, alpha_scale: float = 0.72, cyan_boost: float = 0.35) -> Image.Image:
    arr = np.array(img, dtype=np.float32)
    mask = arr[:, :, 3] > 0
    cyan = (56.0, 189.0, 248.0)
    for c in range(3):
        arr[mask, c] = arr[mask, c] * (1.0 - cyan_boost) + cyan[c] * cyan_boost
    arr[:, :, 3] = arr[:, :, 3] * alpha_scale
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), mode="RGBA")


def paste_aligned(frame: Image.Image, sprite: Image.Image, cx: int = 40, foot_y: int = 76) -> None:
    x = cx - sprite.width // 2
    y = foot_y - sprite.height
    frame.alpha_composite(sprite, (x, y))


def shear_horizontal(img: Image.Image, shift_top_px: float) -> Image.Image:
    """Inclina levemente o topo do sprite para frente/tras preservando os pes."""
    if abs(shift_top_px) < 0.1:
        return img
    w, h = img.size
    arr = np.array(img)
    out = np.zeros_like(arr)
    for y in range(h):
        # t=0 no fundo (pes), t=1 no topo (cabeca)
        t = (h - 1 - y) / max(1, h - 1)
        dx = int(round(shift_top_px * t))
        if dx == 0:
            out[y] = arr[y]
        elif dx > 0:
            if dx < w:
                out[y, dx:] = arr[y, : w - dx]
        else:
            adx = -dx
            if adx < w:
                out[y, : w - adx] = arr[y, adx:]
    return Image.fromarray(out, mode="RGBA")


def build_hero_sheet(src_path: Path, out_path: Path, is_wraith: bool) -> None:
    raw = Image.open(src_path)
    clean = crop_to_content(remove_dark_navy_bg(raw))
    base = fit_sprite(clean, target_h=68, max_w=68)

    fw, fh = 80, 80
    sheet = Image.new("RGBA", (fw * 16, fh), (0, 0, 0, 0))

    # 0..3: idle (respiracao sutil: dy = 0, -1, -1, 0)
    idle_dy = [0, -1, -1, 0]
    for i, dy in enumerate(idle_dy):
        frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
        spr = base
        if dy != 0:
            spr = base.resize((base.width, max(1, base.height + dy)), Image.Resampling.NEAREST)
        paste_aligned(frame, spr, cx=40, foot_y=76)
        sheet.alpha_composite(frame, (i * fw, 0))

    # 4..7: walk (passo com leve inclinacao e oscilacao vertical)
    walk_cfg = [
        (0, -2, 1.5),
        (1, 0, 2.0),
        (0, -2, 1.5),
        (-1, 0, 1.0),
    ]
    for idx, (dx, dy, lean) in enumerate(walk_cfg):
        frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
        spr = shear_horizontal(base, lean)
        paste_aligned(frame, spr, cx=40 + dx, foot_y=76 + dy)
        sheet.alpha_composite(frame, ((4 + idx) * fw, 0))

    # 8..11: attack (antecipacao -2, golpe +5 e inclinacao, follow-through +3, retorno +1)
    atk_cfg = [
        (-2, 0, -2.0),
        (5, -1, 3.5),
        (3, 0, 2.0),
        (1, 0, 0.5),
    ]
    for idx, (dx, dy, lean) in enumerate(atk_cfg):
        frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
        spr = shear_horizontal(base, lean)
        paste_aligned(frame, spr, cx=40 + dx, foot_y=76 + dy)
        sheet.alpha_composite(frame, ((8 + idx) * fw, 0))

    # 12..13: dash (avanco +4, inclinacao forte e rastro/transparencia espectral)
    for idx in range(2):
        frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
        trail = apply_ghost_tint(
            shear_horizontal(base, 4.0),
            alpha_scale=0.35 if idx == 0 else 0.25,
            cyan_boost=0.55 if is_wraith else 0.25,
        )
        paste_aligned(frame, trail, cx=35, foot_y=76)
        main_spr = shear_horizontal(base, 4.0)
        if is_wraith:
            main_spr = apply_ghost_tint(main_spr, alpha_scale=0.78, cyan_boost=0.35)
        paste_aligned(frame, main_spr, cx=44, foot_y=75)
        sheet.alpha_composite(frame, ((12 + idx) * fw, 0))

    # 14..15: hit (recuo -3 e flash branco/avermelhado no frame 14)
    for idx in range(2):
        frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
        spr = shear_horizontal(base, -2.5 if idx == 0 else -1.5)
        if idx == 0:
            spr = apply_flash(spr, color=(255, 210, 210), strength=0.6)
        else:
            spr = ImageEnhance.Brightness(spr).enhance(1.1)
        paste_aligned(frame, spr, cx=37 if idx == 0 else 38, foot_y=76)
        sheet.alpha_composite(frame, ((14 + idx) * fw, 0))

    sheet.save(out_path, "PNG")
    print(f"Saved {out_path} ({sheet.size})")


def build_weapons_sheet(src_path: Path, out_path: Path) -> None:
    raw = Image.open(src_path)
    w, h = raw.size
    hw, hh = w // 2, h // 2
    quadrants = [
        (0, 0, hw, hh),       # 0: Espada de Ferro
        (hw, 0, w, hh),       # 1: Espada Runica Ciano
        (0, hh, hw, h),       # 2: Machado Flamejante (Inferno)
        (hw, hh, w, h),       # 3: Adaga Carmesim (Submundo)
    ]

    fw, fh = 48, 48
    sheet = Image.new("RGBA", (fw * 4, fh), (0, 0, 0, 0))

    for i, box in enumerate(quadrants):
        quad = raw.crop(box)
        clean = crop_to_content(remove_dark_navy_bg(quad, dist_thresh=22.0))
        spr = fit_sprite(clean, target_h=40, max_w=40)
        frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
        # Centraliza com leve deslocamento para cima-direita para o cabo ficar proximo ao centro-inferior esquerdo
        x = (fw - spr.width) // 2 + 1
        y = (fh - spr.height) // 2 - 1
        frame.alpha_composite(spr, (max(0, min(fw - spr.width, x)), max(0, min(fh - spr.height, y))))
        sheet.alpha_composite(frame, (i * fw, 0))

    sheet.save(out_path, "PNG")
    print(f"Saved {out_path} ({sheet.size})")


def make_preview(path: Path, scale: int = 3) -> Path:
    img = Image.open(path).convert("RGBA")
    pw, ph = img.width * scale, img.height * scale
    # Fundo xadrez neutro para inspecionar transparencia e contornos
    bg = Image.new("RGBA", (pw, ph), (42, 48, 62, 255))
    arr = np.array(bg)
    cell = 12
    yy, xx = np.indices((ph, pw))
    checker = ((yy // cell) + (xx // cell)) % 2 == 0
    arr[checker] = [62, 70, 88, 255]
    bg = Image.fromarray(arr, mode="RGBA")

    up = img.resize((pw, ph), Image.Resampling.NEAREST)
    bg.alpha_composite(up, (0, 0))

    out = PREVIEW_DIR / f"preview_{path.stem}.png"
    bg.save(out, "PNG")
    return out


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

    living_out = OUT_DIR / "hero_living.png"
    wraith_out = OUT_DIR / "hero_wraith.png"
    weapons_out = OUT_DIR / "weapons.png"

    build_hero_sheet(SRC_DIR / "hero_villager_unarmed.jpg", living_out, is_wraith=False)
    build_hero_sheet(SRC_DIR / "hero_wraith_simple.jpg", wraith_out, is_wraith=True)
    build_weapons_sheet(SRC_DIR / "weapons_concept.jpg", weapons_out)

    for p in (living_out, wraith_out, weapons_out):
        prev = make_preview(p, scale=3)
        print(f"Preview saved: {prev}")


if __name__ == "__main__":
    main()
