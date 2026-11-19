#!/usr/bin/env python3
"""
Gera os spritesheets 2D estilizados de UI (icones 64x64 e retratos 128x128)
a partir das artes-fonte em assets/sprites_src/ui/ e monta a prancha de
aprovacao em assets/mockups/preview_m7_ui_assets.png.

100% Python stdlib pura (sem Pillow/NumPy). Converte os .jpg fonte para .png
temporario via PowerShell System.Drawing (Windows) mantendo reproducibilidade.

Saidas:
  - assets/sprites_src/ui/ui_icons_64.png       (1024x64,  16 frames 64x64)
  - assets/sprites_src/ui/portraits_128.png     (1024x128,  8 frames 128x128)
  - assets/mockups/preview_m7_ui_assets.png     (prancha de aprovacao M7)
  - public/assets/sprites/ui_icons.png          (1024x64,  16 frames 64x64)
  - public/assets/sprites/portraits.png         (1024x128,  8 frames 128x128)
  - public/assets/sprites/manifest.json         (entradas ui_icons e portraits)
"""

from __future__ import annotations

import argparse
from collections import deque
import json
import math
import shutil
import struct
import subprocess
import tempfile
import zlib
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

ROOT = Path(__file__).resolve().parents[2]
UI_SRC_DIR = ROOT / "assets" / "sprites_src" / "ui"
MOCKUPS_DIR = ROOT / "assets" / "mockups"
PUBLIC_SPRITES_DIR = ROOT / "public" / "assets" / "sprites"

ICONS_RAW_JPG = UI_SRC_DIR / "ui_icons_raw.jpg"
PORTRAITS_RAW_JPG = UI_SRC_DIR / "portraits_raw.jpg"

ICONS_OUT_PNG = UI_SRC_DIR / "ui_icons_64.png"
PORTRAITS_OUT_PNG = UI_SRC_DIR / "portraits_128.png"
PREVIEW_OUT_PNG = MOCKUPS_DIR / "preview_m7_ui_assets.png"

PUBLIC_ICONS_PNG = PUBLIC_SPRITES_DIR / "ui_icons.png"
PUBLIC_PORTRAITS_PNG = PUBLIC_SPRITES_DIR / "portraits.png"
MANIFEST_JSON = PUBLIC_SPRITES_DIR / "manifest.json"

ICON_NAMES: Tuple[str, ...] = (
    "attack",
    "dash",
    "skill_inferno",
    "skill_empireo",
    "skill_submundo",
    "potion",
    "bag",
    "settings",
    "audio_on",
    "audio_off",
    "souls",
    "essence",
    "slot_weapon",
    "slot_armor",
    "slot_amulet",
    "slot_ring",
)

PORTRAIT_NAMES: Tuple[str, ...] = (
    "hero_living",
    "hero_wraith",
    "weapon_master",
    "village_blacksmith",
    "emissary",
    "spectral_blacksmith",
    "infernal_warden",
    "system",
)

# Sementes normalizadas (fx, fy) para buracos internos genuinos de fundo escuro
# verificados nas artes-fonte (evita falsos positivos em metal/tecido escuro).
ICON_HOLE_SEEDS: Dict[str, List[Tuple[float, float]]] = {
    "bag": [(0.539, 0.191)],
    "settings": [(0.496, 0.496)],
    "audio_on": [(0.395, 0.688)],
    "audio_off": [(0.488, 0.699)],
    "slot_ring": [(0.512, 0.543)],
}

PORTRAIT_HOLE_SEEDS: Dict[str, List[Tuple[float, float]]] = {
    "hero_living": [(0.380, 0.473)],
}

# Perfil de preservacao de glow por asset:
# Tuple: (mode, glow_hue, max_depth, core_depth)
#   mode:
#     "solid"     -> objeto com contorno escuro completo (AA limpo curto)
#     "rim_glow"  -> objeto solido + aura/brilho externo filtrado por matiz
#     "full_glow" -> objeto puramente energetico (chama/raio/vortice/espectro)
#   glow_hue: "any" | "cyan" | "warm"
#   max_depth: alcance maximo (px) da zona de glow a partir do fundo puro
#   core_depth: profundidade (px) a partir da qual o miolo interno vira opaco (0 = desativado)
GlowSpec = Tuple[str, str, int, int]

ICON_GLOW_SPEC: Dict[str, GlowSpec] = {
    "attack": ("solid", "any", 4, 0),
    "dash": ("rim_glow", "cyan", 80, 0),
    "skill_inferno": ("full_glow", "any", 90, 42),
    "skill_empireo": ("full_glow", "any", 90, 44),
    "skill_submundo": ("full_glow", "any", 90, 34),
    "potion": ("solid", "any", 4, 0),
    "bag": ("solid", "any", 4, 0),
    "settings": ("solid", "any", 4, 0),
    "audio_on": ("rim_glow", "warm", 65, 0),
    "audio_off": ("solid", "any", 4, 0),
    "souls": ("full_glow", "any", 90, 46),
    "essence": ("full_glow", "any", 55, 18),
    "slot_weapon": ("solid", "any", 4, 0),
    "slot_armor": ("solid", "any", 4, 0),
    "slot_amulet": ("solid", "any", 4, 0),
    "slot_ring": ("rim_glow", "warm", 26, 0),
}

PORTRAIT_GLOW_SPEC: Dict[str, GlowSpec] = {
    "hero_living": ("solid", "any", 4, 0),
    "hero_wraith": ("rim_glow", "cyan", 34, 0),
    "weapon_master": ("solid", "any", 4, 0),
    "village_blacksmith": ("solid", "any", 4, 0),
    "emissary": ("full_glow", "any", 60, 0),
    "spectral_blacksmith": ("full_glow", "any", 110, 42),
    "infernal_warden": ("solid", "any", 4, 0),
    "system": ("rim_glow", "cyan", 14, 0),
}

Color = Tuple[int, int, int, int]
RGB = Tuple[int, int, int]


# ---------------------------------------------------------------------------
# Pure-Python RGBA Canvas & PNG Codec
# ---------------------------------------------------------------------------

def _paeth(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    return b if pb <= pc else c


class Canvas:
    __slots__ = ("w", "h", "buf")

    def __init__(self, w: int, h: int, fill: Color = (0, 0, 0, 0)) -> None:
        self.w = w
        self.h = h
        if fill == (0, 0, 0, 0):
            self.buf = bytearray(w * h * 4)
        else:
            self.buf = bytearray(bytes(fill) * (w * h))

    def get(self, x: int, y: int) -> Color:
        if 0 <= x < self.w and 0 <= y < self.h:
            o = (y * self.w + x) * 4
            b = self.buf
            return (b[o], b[o + 1], b[o + 2], b[o + 3])
        return (0, 0, 0, 0)

    def put(self, x: int, y: int, col: Color) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            o = (y * self.w + x) * 4
            b = self.buf
            b[o], b[o + 1], b[o + 2], b[o + 3] = col

    def blend_pixel(self, x: int, y: int, col: Color) -> None:
        if not (0 <= x < self.w and 0 <= y < self.h):
            return
        sa = col[3]
        if sa == 0:
            return
        o = (y * self.w + x) * 4
        b = self.buf
        if sa == 255 or b[o + 3] == 0:
            b[o], b[o + 1], b[o + 2], b[o + 3] = col
            return
        da = b[o + 3]
        inv_sa = 255 - sa
        out_a = sa + (da * inv_sa + 127) // 255
        if out_a == 0:
            return
        dr, dg, db = b[o], b[o + 1], b[o + 2]
        sr, sg, sb = col[0], col[1], col[2]
        # Porter-Duff source-over
        r = (sr * sa * 255 + dr * da * inv_sa + (out_a * 255) // 2) // (out_a * 255)
        g = (sg * sa * 255 + dg * da * inv_sa + (out_a * 255) // 2) // (out_a * 255)
        bl = (sb * sa * 255 + db * da * inv_sa + (out_a * 255) // 2) // (out_a * 255)
        b[o] = 255 if r > 255 else r
        b[o + 1] = 255 if g > 255 else g
        b[o + 2] = 255 if bl > 255 else bl
        b[o + 3] = 255 if out_a > 255 else out_a

    def fill_rect(self, x0: int, y0: int, w: int, h: int, col: Color) -> None:
        x1 = min(self.w, x0 + w)
        y1 = min(self.h, y0 + h)
        x0 = max(0, x0)
        y0 = max(0, y0)
        if x0 >= x1 or y0 >= y1:
            return
        if col[3] == 255:
            row_bytes = bytes(col) * (x1 - x0)
            stride = self.w * 4
            for y in range(y0, y1):
                o = y * stride + x0 * 4
                self.buf[o:o + len(row_bytes)] = row_bytes
        else:
            for y in range(y0, y1):
                for x in range(x0, x1):
                    self.blend_pixel(x, y, col)

    def blit(self, src: "Canvas", dx: int, dy: int, blend: bool = True) -> None:
        sw, sh = src.w, src.h
        sb = src.buf
        for sy in range(sh):
            ty = dy + sy
            if ty < 0 or ty >= self.h:
                continue
            row_off = sy * sw * 4
            for sx in range(sw):
                tx = dx + sx
                if tx < 0 or tx >= self.w:
                    continue
                so = row_off + sx * 4
                sa = sb[so + 3]
                if sa == 0:
                    continue
                col = (sb[so], sb[so + 1], sb[so + 2], sa)
                if blend:
                    self.blend_pixel(tx, ty, col)
                else:
                    self.put(tx, ty, col)

    def crop(self, x0: int, y0: int, x1: int, y1: int) -> "Canvas":
        cw, ch = x1 - x0, y1 - y0
        out = Canvas(cw, ch)
        stride_s = self.w * 4
        stride_d = cw * 4
        for y in range(ch):
            so = (y0 + y) * stride_s + x0 * 4
            do = y * stride_d
            out.buf[do:do + stride_d] = self.buf[so:so + stride_d]
        return out


def read_png(path: Path) -> Canvas:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"PNG invalido: {path}")
    pos = 8
    w = h = color_type = 0
    idat = bytearray()
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        ctype = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        pos += 12 + length
        if ctype == b"IHDR":
            w, h, bit_depth, color_type, _, _, interlace = struct.unpack(">IIBBBBB", chunk)
            if bit_depth != 8 or interlace != 0:
                raise ValueError(f"PNG nao suportado: {path}")
        elif ctype == b"IDAT":
            idat.extend(chunk)
        elif ctype == b"IEND":
            break
    raw = zlib.decompress(bytes(idat))
    bpp = {6: 4, 2: 3}[color_type]
    stride = w * bpp
    recon = bytearray(h * stride)
    in_pos = 0
    for y in range(h):
        ftype = raw[in_pos]
        in_pos += 1
        rs = y * stride
        ps = (y - 1) * stride
        for x in range(stride):
            v = raw[in_pos + x]
            a = recon[rs + x - bpp] if x >= bpp else 0
            b = recon[ps + x] if y > 0 else 0
            c = recon[ps + x - bpp] if (y > 0 and x >= bpp) else 0
            if ftype == 0:
                val = v
            elif ftype == 1:
                val = (v + a) & 0xFF
            elif ftype == 2:
                val = (v + b) & 0xFF
            elif ftype == 3:
                val = (v + ((a + b) >> 1)) & 0xFF
            elif ftype == 4:
                val = (v + _paeth(a, b, c)) & 0xFF
            else:
                raise ValueError(f"Filtro PNG invalido: {ftype}")
            recon[rs + x] = val
        in_pos += stride

    cv = Canvas(w, h)
    if color_type == 6:
        cv.buf[:] = recon
    elif color_type == 2:
        dst = cv.buf
        for i in range(w * h):
            si = i * 3
            di = i * 4
            dst[di] = recon[si]
            dst[di + 1] = recon[si + 1]
            dst[di + 2] = recon[si + 2]
            dst[di + 3] = 255
    return cv


def write_png(path: Path, cv: Canvas) -> None:
    def chunk(ctype: bytes, payload: bytes) -> bytes:
        crc = zlib.crc32(ctype + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + ctype + payload + struct.pack(">I", crc)

    raw = bytearray()
    stride = cv.w * 4
    for y in range(cv.h):
        raw.append(0)
        raw.extend(cv.buf[y * stride:(y + 1) * stride])
    ihdr = struct.pack(">IIBBBBB", cv.w, cv.h, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def load_jpg_as_canvas(jpg_path: Path) -> Canvas:
    """Converte .jpg para .png temporario via PowerShell System.Drawing e carrega."""
    if not jpg_path.exists():
        raise FileNotFoundError(f"Arquivo fonte nao encontrado: {jpg_path}")
    with tempfile.TemporaryDirectory() as td:
        tmp_png = Path(td) / "converted.png"
        ps = (
            "Add-Type -AssemblyName System.Drawing; "
            f"$img = [System.Drawing.Image]::FromFile('{jpg_path}'); "
            f"$img.Save('{tmp_png}', [System.Drawing.Imaging.ImageFormat]::Png); "
            "$img.Dispose()"
        )
        subprocess.run(["powershell", "-NoProfile", "-Command", ps], check=True)
        return read_png(tmp_png)


# ---------------------------------------------------------------------------
# Recorte Inteligente por Vales de Projecao
# ---------------------------------------------------------------------------

def estimate_border_bg(cv: Canvas) -> RGB:
    """Estima a cor de fundo predominante a partir das bordas da imagem/celula."""
    rs: List[int] = []
    gs: List[int] = []
    bs: List[int] = []
    step_x = max(1, cv.w // 64)
    step_y = max(1, cv.h // 64)
    for x in range(0, cv.w, step_x):
        for y in (0, 1, cv.h - 2, cv.h - 1):
            r, g, b, _ = cv.get(x, y)
            rs.append(r)
            gs.append(g)
            bs.append(b)
    for y in range(0, cv.h, step_y):
        for x in (0, 1, cv.w - 2, cv.w - 1):
            r, g, b, _ = cv.get(x, y)
            rs.append(r)
            gs.append(g)
            bs.append(b)
    rs.sort()
    gs.sort()
    bs.sort()
    mid = len(rs) // 2
    return (rs[mid], gs[mid], bs[mid])


def _find_clean_valley(profile: Sequence[int], approx: int, radius: int) -> int:
    lo = max(1, approx - radius)
    hi = min(len(profile) - 2, approx + radius)
    min_val = min(profile[lo:hi + 1])
    # Escolhe o centro da maior faixa continua dentro de [min_val, min_val + 4]
    thresh = max(min_val + 4, 8)
    best_span = (approx, approx)
    cur_start: Optional[int] = None
    for i in range(lo, hi + 1):
        if profile[i] <= thresh:
            if cur_start is None:
                cur_start = i
        else:
            if cur_start is not None:
                if (i - 1 - cur_start) > (best_span[1] - best_span[0]):
                    best_span = (cur_start, i - 1)
                cur_start = None
    if cur_start is not None:
        if (hi - cur_start) > (best_span[1] - best_span[0]):
            best_span = (cur_start, hi)
    if best_span[1] > best_span[0]:
        return (best_span[0] + best_span[1]) // 2
    return min(range(lo, hi + 1), key=lambda i: profile[i])


def split_grid_smart(cv: Canvas, cols: int, rows: int) -> List[Canvas]:
    """Divide a grade cols x rows ajustando divisores nos vales limpos de fundo."""
    br, bg, bb = estimate_border_bg(cv)
    buf = cv.buf
    w, h = cv.w, cv.h

    # 1. Divisores horizontais
    row_max = [0] * h
    for y in range(h):
        md = 0
        ro = y * w * 4
        for x in range(w):
            o = ro + x * 4
            d = max(abs(buf[o] - br), abs(buf[o + 1] - bg), abs(buf[o + 2] - bb))
            if d > md:
                md = d
        row_max[y] = md

    y_cuts = [0]
    cell_h_nom = h // rows
    for r in range(1, rows):
        y_cuts.append(_find_clean_valley(row_max, r * cell_h_nom, cell_h_nom // 5))
    y_cuts.append(h)

    # 2. Divisores verticais independentes por linha
    cells: List[Canvas] = []
    cell_w_nom = w // cols
    for r in range(rows):
        y0, y1 = y_cuts[r], y_cuts[r + 1]
        col_max = [0] * w
        for x in range(w):
            md = 0
            for y in range(y0, y1):
                o = (y * w + x) * 4
                d = max(abs(buf[o] - br), abs(buf[o + 1] - bg), abs(buf[o + 2] - bb))
                if d > md:
                    md = d
            col_max[x] = md
        x_cuts = [0]
        for c in range(1, cols):
            x_cuts.append(_find_clean_valley(col_max, c * cell_w_nom, cell_w_nom // 5))
        x_cuts.append(w)

        for c in range(cols):
            cells.append(cv.crop(x_cuts[c], y0, x_cuts[c + 1], y1))

    return cells


# ---------------------------------------------------------------------------
# Remocao de Fundo com Alpha Suave, Preservacao de Glows e Descontaminacao
# ---------------------------------------------------------------------------

def _clamp(v: float, lo: float, hi: float) -> float:
    return lo if v < lo else (hi if v > hi else v)


def _smoothstep(edge0: float, edge1: float, x: float) -> float:
    if edge1 <= edge0:
        return 1.0 if x >= edge1 else 0.0
    t = _clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def remove_background_with_glow(
    cell: Canvas,
    glow_spec: GlowSpec = ("full_glow", "any", 90, 40),
    hole_seeds: Sequence[Tuple[float, float]] = (),
) -> Canvas:
    """
    Remove fundo escuro (#141824 / #161a26) preservando 100% do corpo opaco
    (protegido pelos contornos escuros e filtro de matiz/profundidade) e
    reconstruindo glows/auras com alpha suave e descontaminacao de cor.
    """
    mode, glow_hue, max_depth, core_depth = glow_spec
    w, h = cell.w, cell.h
    br, bg, bb = estimate_border_bg(cell)
    bg_luma = 0.299 * br + 0.587 * bg + 0.114 * bb
    buf = cell.buf

    n = w * h
    dist_arr = [0.0] * n
    luma_arr = [0.0] * n
    for i in range(n):
        o = i * 4
        r, g, b = buf[o], buf[o + 1], buf[o + 2]
        dr, dg, db = r - br, g - bg, b - bb
        dist_arr[i] = math.sqrt(dr * dr + dg * dg + db * db)
        luma_arr[i] = 0.299 * r + 0.587 * g + 0.114 * b

    # --- Passo 1: BFS #1 — Fundo puro a partir das bordas + sementes de buracos ---
    bg_pure = bytearray(n)
    q: deque[Tuple[int, int]] = deque()
    # Aceita leve vinheta escura do fundo sem comer brilhos saturados
    bg_thresh = 17.5

    def is_pure_bg(idx: int) -> bool:
        d = dist_arr[idx]
        if d <= 13.0:
            return True
        if d <= bg_thresh:
            o = idx * 4
            r, g, b = buf[o], buf[o + 1], buf[o + 2]
            # Mantem o matiz azulado-neutro do fundo (nao engole glow colorido sutil)
            if abs((r - br) - (g - bg)) <= 7 and abs((b - bb) - (g - bg)) <= 9:
                return True
        return False

    def try_seed(sx: int, sy: int) -> None:
        if 0 <= sx < w and 0 <= sy < h:
            idx = sy * w + sx
            if not bg_pure[idx] and is_pure_bg(idx):
                bg_pure[idx] = 1
                q.append((sx, sy))

    for x in range(w):
        try_seed(x, 0)
        try_seed(x, h - 1)
    for y in range(h):
        try_seed(0, y)
        try_seed(w - 1, y)

    for fx, fy in hole_seeds:
        cx = int(round(fx * (w - 1)))
        cy = int(round(fy * (h - 1)))
        for dy in range(-4, 5):
            for dx in range(-4, 5):
                try_seed(cx + dx, cy + dy)

    while q:
        x, y = q.popleft()
        if x > 0:
            ni = y * w + (x - 1)
            if not bg_pure[ni] and is_pure_bg(ni):
                bg_pure[ni] = 1
                q.append((x - 1, y))
        if x + 1 < w:
            ni = y * w + (x + 1)
            if not bg_pure[ni] and is_pure_bg(ni):
                bg_pure[ni] = 1
                q.append((x + 1, y))
        if y > 0:
            ni = (y - 1) * w + x
            if not bg_pure[ni] and is_pure_bg(ni):
                bg_pure[ni] = 1
                q.append((x, y - 1))
        if y + 1 < h:
            ni = (y + 1) * w + x
            if not bg_pure[ni] and is_pure_bg(ni):
                bg_pure[ni] = 1
                q.append((x, y + 1))

    # --- Passo 2: BFS #2 — Zona de glow/aura com distancia geodesica e filtro de matiz ---
    glow_depth = [0] * n  # 0 = fora da zona de glow; >= 1 = profundidade em px desde bg_pure
    gq: deque[Tuple[int, int, int]] = deque()
    glow_max_dist = 245.0 if mode != "solid" else 32.0

    def is_ink_barrier(idx: int) -> bool:
        o = idx * 4
        r, g, b = buf[o], buf[o + 1], buf[o + 2]
        if luma_arr[idx] <= bg_luma - 5.5:
            return True
        if r <= br - 7 and g <= bg - 7 and b <= bb - 7:
            return True
        return False

    def matches_glow_hue(idx: int, depth: int) -> bool:
        if glow_hue == "any" or depth <= 2:
            return True
        o = idx * 4
        r, g, b = buf[o], buf[o + 1], buf[o + 2]
        dr, dg, db = r - br, g - bg, b - bb
        if glow_hue == "cyan":
            # Aura ciano: excesso em G/B claramente acima de R (bloqueia tecido/pedra cinza)
            return (dg >= dr + 7) or (db >= dr + 9)
        if glow_hue == "warm":
            # Aura dourada/fogo/carmesim: excesso em R acima de B (bloqueia aco cinza)
            return (dr >= db + 10 and dr >= 12) or (dr >= 24 and dg >= 18 and (dr + dg) >= 2 * db + 20)
        return True

    def is_glow_candidate(idx: int, next_depth: int) -> bool:
        if next_depth > max_depth:
            return False
        if bg_pure[idx] or glow_depth[idx] != 0:
            return False
        if is_ink_barrier(idx):
            return False
        if dist_arr[idx] > glow_max_dist:
            return False
        if not matches_glow_hue(idx, next_depth):
            return False
        return True

    for y in range(h):
        row = y * w
        for x in range(w):
            if not bg_pure[row + x]:
                continue
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < w and 0 <= ny < h:
                    ni = ny * w + nx
                    if is_glow_candidate(ni, 1):
                        glow_depth[ni] = 1
                        gq.append((nx, ny, 1))

    while gq:
        x, y, dp = gq.popleft()
        ndp = dp + 1
        if ndp > max_depth:
            continue
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                ni = ny * w + nx
                if is_glow_candidate(ni, ndp):
                    glow_depth[ni] = ndp
                    gq.append((nx, ny, ndp))

    # --- Passo 3: Anel de AA na borda entre bg_pure e corpo/contorno solido ---
    aa_ring = bytearray(n)
    for y in range(h):
        row = y * w
        for x in range(w):
            idx = row + x
            if bg_pure[idx] or glow_depth[idx] != 0:
                continue
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < w and 0 <= ny < h and bg_pure[ny * w + nx]:
                    aa_ring[idx] = 1
                    break

    # --- Passo 4: Composicao final de alpha e descontaminacao de cor ---
    out = Canvas(w, h)
    obuf = out.buf

    for i in range(n):
        o = i * 4
        if bg_pure[i]:
            continue

        r, g, b = buf[o], buf[o + 1], buf[o + 2]
        d = dist_arr[i]
        dp = glow_depth[i]

        if dp != 0:
            ar = (r - br) / (255.0 - br) if r > br else (br - r) / max(1.0, float(br))
            ag = (g - bg) / (255.0 - bg) if g > bg else (bg - g) / max(1.0, float(bg))
            ab = (b - bb) / (255.0 - bb) if b > bb else (bb - b) / max(1.0, float(bb))
            a_min = _clamp(max(ar, ag, ab), 0.0, 1.0)

            if mode != "solid":
                a_dist = _smoothstep(10.0, 110.0, d)
                a = max(a_min, a_dist)
                a = _clamp(math.pow(a, 0.85), 0.0, 1.0)
                a *= _smoothstep(9.5, 22.0, d)
                # Em modos full_glow, o miolo interno profundo torna-se solido/opaco
                if core_depth > 0 and dp > core_depth * 0.55:
                    a_core = _smoothstep(core_depth * 0.55, float(core_depth), float(dp))
                    a = max(a, a_core)
            else:
                a = max(a_min, _smoothstep(10.0, 28.0, d))

            if a <= 0.012:
                continue

            # Descontaminacao de cor contra o fundo B (reduzida no miolo solido)
            eff_a = max(a, 0.16)
            fr = _clamp((r - (1.0 - a) * br) / eff_a, 0.0, 255.0)
            fg = _clamp((g - (1.0 - a) * bg) / eff_a, 0.0, 255.0)
            fb = _clamp((b - (1.0 - a) * bb) / eff_a, 0.0, 255.0)

            obuf[o] = int(round(fr))
            obuf[o + 1] = int(round(fg))
            obuf[o + 2] = int(round(fb))
            obuf[o + 3] = int(round(a * 255.0))

        elif aa_ring[i]:
            darkness = _clamp((bg_luma - luma_arr[i]) / max(1.0, bg_luma - 7.0), 0.0, 1.0)
            a_dist = _smoothstep(8.0, 22.0, d)
            a = max(darkness, a_dist)
            if a <= 0.02:
                continue
            eff_a = max(a, 0.25)
            fr = _clamp((r - (1.0 - a) * br) / eff_a, 0.0, 255.0)
            fg = _clamp((g - (1.0 - a) * bg) / eff_a, 0.0, 255.0)
            fb = _clamp((b - (1.0 - a) * bb) / eff_a, 0.0, 255.0)
            obuf[o] = int(round(fr))
            obuf[o + 1] = int(round(fg))
            obuf[o + 2] = int(round(fb))
            obuf[o + 3] = int(round(a * 255.0))
        else:
            obuf[o] = r
            obuf[o + 1] = g
            obuf[o + 2] = b
            obuf[o + 3] = 255

    # Remove eventuais pixels isolados de ruido JPEG nas bordas da celula
    for x in range(w):
        for y in (0, 1, h - 2, h - 1):
            o = (y * w + x) * 4
            if obuf[o + 3] < 64:
                obuf[o] = obuf[o + 1] = obuf[o + 2] = obuf[o + 3] = 0
    for y in range(h):
        for x in (0, 1, w - 2, w - 1):
            o = (y * w + x) * 4
            if obuf[o + 3] < 64:
                obuf[o] = obuf[o + 1] = obuf[o + 2] = obuf[o + 3] = 0

    return out


# ---------------------------------------------------------------------------
# Downscale Suavizado (Area Sampling em Premultiplied Alpha) & Enquadramento
# ---------------------------------------------------------------------------

def alpha_bbox(cv: Canvas, min_alpha: int = 10) -> Tuple[int, int, int, int]:
    w, h = cv.w, cv.h
    buf = cv.buf
    x0, y0, x1, y1 = w, h, -1, -1
    for y in range(h):
        ro = y * w * 4
        for x in range(w):
            if buf[ro + x * 4 + 3] >= min_alpha:
                if x < x0:
                    x0 = x
                if x > x1:
                    x1 = x
                if y < y0:
                    y0 = y
                if y > y1:
                    y1 = y
    if x1 < x0:
        return (0, 0, w, h)
    return (x0, y0, x1 + 1, y1 + 1)


def resize_area_premult(src: Canvas, dst_w: int, dst_h: int) -> Canvas:
    """
    Downscale/resample de alta qualidade por integracao de area exata (box filter
    continuo) em Premultiplied Alpha. Elimina aliasing e halos escuros em glows.
    """
    sw, sh = src.w, src.h
    sbuf = src.buf
    out = Canvas(dst_w, dst_h)
    obuf = out.buf

    scale_x = sw / dst_w
    scale_y = sh / dst_h

    # Pre-calcula intervalos de cobertura em X para velocidade
    x_spans: List[List[Tuple[int, float]]] = []
    for dx in range(dst_w):
        sx0 = dx * scale_x
        sx1 = (dx + 1) * scale_x
        ix0 = max(0, int(math.floor(sx0)))
        ix1 = min(sw - 1, int(math.floor(sx1 - 1e-9)))
        span: List[Tuple[int, float]] = []
        for ix in range(ix0, ix1 + 1):
            ov = min(sx1, ix + 1.0) - max(sx0, float(ix))
            if ov > 0.0:
                span.append((ix, ov))
        x_spans.append(span)

    for dy in range(dst_h):
        sy0 = dy * scale_y
        sy1 = (dy + 1) * scale_y
        iy0 = max(0, int(math.floor(sy0)))
        iy1 = min(sh - 1, int(math.floor(sy1 - 1e-9)))
        y_span: List[Tuple[int, float]] = []
        for iy in range(iy0, iy1 + 1):
            ov = min(sy1, iy + 1.0) - max(sy0, float(iy))
            if ov > 0.0:
                y_span.append((iy, ov))

        do_row = dy * dst_w * 4
        for dx in range(dst_w):
            x_span = x_spans[dx]
            sum_r = sum_g = sum_b = sum_a = sum_w = 0.0
            for iy, wy in y_span:
                srow = iy * sw * 4
                for ix, wx in x_span:
                    wt = wx * wy
                    so = srow + ix * 4
                    a = sbuf[so + 3] / 255.0
                    wa = wt * a
                    sum_r += sbuf[so] * wa
                    sum_g += sbuf[so + 1] * wa
                    sum_b += sbuf[so + 2] * wa
                    sum_a += wa
                    sum_w += wt
            if sum_w <= 0.0 or sum_a <= 1e-6:
                continue
            out_a = sum_a / sum_w
            if out_a <= 0.002:
                continue
            r = sum_r / sum_a
            g = sum_g / sum_a
            b = sum_b / sum_a
            do = do_row + dx * 4
            obuf[do] = int(_clamp(round(r), 0, 255))
            obuf[do + 1] = int(_clamp(round(g), 0, 255))
            obuf[do + 2] = int(_clamp(round(b), 0, 255))
            obuf[do + 3] = int(_clamp(round(out_a * 255.0), 0, 255))

    return out


def fit_centered_frame(
    clean_cell: Canvas,
    frame_size: int,
    max_extent: int,
    glow_margin: int = 2,
) -> Canvas:
    """
    Enquadra e centraliza a arte limpa em um frame quadrado `frame_size x frame_size`:
    - O corpo visivel (alpha >= 24) busca ocupar `max_extent` px;
    - A extensao total incluindo glows sutis (alpha >= 8) e garantida dentro de
      `frame_size - 2 * glow_margin` para nunca cortar brilhos na borda.
    """
    # Bbox total (com glows) e bbox visual principal
    gx0, gy0, gx1, gy1 = alpha_bbox(clean_cell, min_alpha=8)
    vx0, vy0, vx1, vy1 = alpha_bbox(clean_cell, min_alpha=28)

    # Usa a bbox total recortada como janela de resample para nao cortar glow
    gw, gh = gx1 - gx0, gy1 - gy0
    vw, vh = max(1, vx1 - vx0), max(1, vy1 - vy0)

    # Escala ideal pelo corpo visual, limitada para o glow total caber sem corte
    s_visual = max_extent / max(vw, vh)
    s_glow = (frame_size - 2 * glow_margin) / max(gw, gh)
    scale = min(s_visual, s_glow)

    cropped = clean_cell.crop(gx0, gy0, gx1, gy1)
    dw = max(1, int(round(gw * scale)))
    dh = max(1, int(round(gh * scale)))
    resized = resize_area_premult(cropped, dw, dh)

    # Centraliza pelo centro visual dentro do crop, ajustando para nao estourar margem
    vcx = ((vx0 + vx1) * 0.5 - gx0) * scale
    vcy = ((vy0 + vy1) * 0.5 - gy0) * scale
    dx = int(round(frame_size * 0.5 - vcx))
    dy = int(round(frame_size * 0.5 - vcy))

    dx = max(glow_margin, min(frame_size - glow_margin - dw, dx))
    dy = max(glow_margin, min(frame_size - glow_margin - dh, dy))

    frame = Canvas(frame_size, frame_size)
    frame.blit(resized, dx, dy, blend=False)
    return frame


# ---------------------------------------------------------------------------
# Fonte Bitmap 5x7 & Primitivas para a Prancha de Aprovacao
# ---------------------------------------------------------------------------

FONT_3X5: Dict[str, Tuple[str, ...]] = {
    " ": ("000", "000", "000", "000", "000"),
    "_": ("000", "000", "000", "000", "111"),
    "-": ("000", "000", "111", "000", "000"),
    "+": ("000", "010", "111", "010", "000"),
    ",": ("000", "000", "000", "010", "100"),
    ":": ("000", "010", "000", "010", "000"),
    "/": ("001", "001", "010", "100", "100"),
    "(": ("010", "100", "100", "100", "010"),
    ")": ("010", "001", "001", "001", "010"),
    ".": ("000", "000", "000", "000", "010"),
    "0": ("111", "101", "101", "101", "111"),
    "1": ("010", "110", "010", "010", "111"),
    "2": ("111", "001", "111", "100", "111"),
    "3": ("111", "001", "111", "001", "111"),
    "4": ("101", "101", "111", "001", "001"),
    "5": ("111", "100", "111", "001", "111"),
    "6": ("111", "100", "111", "101", "111"),
    "7": ("111", "001", "010", "010", "010"),
    "8": ("111", "101", "111", "101", "111"),
    "9": ("111", "101", "111", "001", "111"),
    "A": ("010", "101", "111", "101", "101"),
    "B": ("110", "101", "110", "101", "110"),
    "C": ("111", "100", "100", "100", "111"),
    "D": ("110", "101", "101", "101", "110"),
    "E": ("111", "100", "110", "100", "111"),
    "F": ("111", "100", "110", "100", "100"),
    "G": ("111", "100", "101", "101", "111"),
    "H": ("101", "101", "111", "101", "101"),
    "I": ("111", "010", "010", "010", "111"),
    "J": ("001", "001", "001", "101", "111"),
    "K": ("101", "101", "110", "101", "101"),
    "L": ("100", "100", "100", "100", "111"),
    "M": ("101", "111", "111", "101", "101"),
    "N": ("111", "101", "101", "101", "101"),
    "O": ("111", "101", "101", "101", "111"),
    "P": ("111", "101", "111", "100", "100"),
    "Q": ("111", "101", "101", "111", "001"),
    "R": ("110", "101", "110", "101", "101"),
    "S": ("111", "100", "111", "001", "111"),
    "T": ("111", "010", "010", "010", "010"),
    "U": ("101", "101", "101", "101", "111"),
    "V": ("101", "101", "101", "101", "010"),
    "W": ("101", "101", "111", "111", "101"),
    "X": ("101", "101", "010", "101", "101"),
    "Y": ("101", "101", "010", "010", "010"),
    "Z": ("111", "001", "010", "100", "111"),
}


def draw_text(
    cv: Canvas,
    x: int,
    y: int,
    text: str,
    col: Color = (232, 236, 246, 255),
    scale: int = 2,
) -> None:
    cx = x
    for ch in text.upper():
        glyph = FONT_3X5.get(ch, FONT_3X5[" "])
        for ry, row in enumerate(glyph):
            for rx, bit in enumerate(row):
                if bit == "1":
                    cv.fill_rect(cx + rx * scale, y + ry * scale, scale, scale, col)
        cx += 4 * scale


def text_width(text: str, scale: int = 2) -> int:
    return max(0, len(text) * 4 * scale - scale)


def draw_checker(
    cv: Canvas,
    x0: int,
    y0: int,
    w: int,
    h: int,
    tile: int = 8,
    c1: Color = (48, 53, 68, 255),
    c2: Color = (68, 74, 92, 255),
) -> None:
    for y in range(0, h, tile):
        th = min(tile, h - y)
        for x in range(0, w, tile):
            tw = min(tile, w - x)
            col = c1 if ((x // tile + y // tile) & 1) == 0 else c2
            cv.fill_rect(x0 + x, y0 + y, tw, th, col)


def draw_border(cv: Canvas, x0: int, y0: int, w: int, h: int, col: Color, t: int = 1) -> None:
    cv.fill_rect(x0, y0, w, t, col)
    cv.fill_rect(x0, y0 + h - t, w, t, col)
    cv.fill_rect(x0, y0, t, h, col)
    cv.fill_rect(x0 + w - t, y0, t, h, col)


def upscale_nearest(src: Canvas, factor: int) -> Canvas:
    out = Canvas(src.w * factor, src.h * factor)
    sbuf = src.buf
    obuf = out.buf
    sw, sh = src.w, src.h
    ow = out.w
    for sy in range(sh):
        srow = sy * sw * 4
        for sx in range(sw):
            so = srow + sx * 4
            px = sbuf[so:so + 4]
            if px[3] == 0:
                continue
            for fy in range(factor):
                do = ((sy * factor + fy) * ow + sx * factor) * 4
                for fx in range(factor):
                    obuf[do + fx * 4:do + fx * 4 + 4] = px
    return out


def draw_metallic_circle_frame(
    cv: Canvas,
    cx: int,
    cy: int,
    outer_r: int,
    rim_w: int,
    inner_col_top: RGB,
    inner_col_bot: RGB,
    rim_gold: bool = False,
) -> None:
    """Desenha moldura circular metalica dark fantasy com gradiente e sombra."""
    inner_r = outer_r - rim_w
    for dy in range(-outer_r - 3, outer_r + 4):
        py = cy + dy
        if py < 0 or py >= cv.h:
            continue
        for dx in range(-outer_r - 3, outer_r + 4):
            px = cx + dx
            if px < 0 or px >= cv.w:
                continue
            dist = math.hypot(dx, dy)
            if dist > outer_r + 2.5:
                continue
            if dist > outer_r:
                # Sombra projetada externa suave
                sa = int(round((1.0 - (dist - outer_r) / 2.5) * 140))
                cv.blend_pixel(px, py, (4, 5, 10, sa))
            elif dist >= inner_r:
                # Anel metalico chanfrado (iluminacao vinda do topo-esquerda)
                ang = math.atan2(dy, dx)
                light = 0.5 - 0.5 * math.cos(ang + 2.35)
                ring_t = (dist - inner_r) / max(1.0, float(rim_w))
                bevel = 1.0 - abs(ring_t - 0.45) * 1.4
                bevel = _clamp(bevel, 0.25, 1.0)
                if rim_gold:
                    base = (128, 102, 58)
                    hi = (228, 194, 118)
                else:
                    base = (68, 76, 94)
                    hi = (164, 178, 204)
                k = _clamp(0.35 + 0.65 * light * bevel, 0.15, 1.0)
                r = int(round(base[0] * (1 - k) + hi[0] * k))
                g = int(round(base[1] * (1 - k) + hi[1] * k))
                b = int(round(base[2] * (1 - k) + hi[2] * k))
                # Linhas finas de contorno escuro nos extremos do aro
                if dist > outer_r - 1.2 or dist < inner_r + 1.1:
                    r, g, b = r // 3, g // 3, b // 3
                cv.put(px, py, (r, g, b, 255))
            else:
                # Fundo interno radial/vertical escuro
                t = _clamp((dy + inner_r) / (2.0 * inner_r), 0.0, 1.0)
                vig = 1.0 - 0.28 * (dist / max(1.0, float(inner_r))) ** 2
                r = int(round((inner_col_top[0] * (1 - t) + inner_col_bot[0] * t) * vig))
                g = int(round((inner_col_top[1] * (1 - t) + inner_col_bot[1] * t) * vig))
                b = int(round((inner_col_top[2] * (1 - t) + inner_col_bot[2] * t) * vig))
                cv.put(px, py, (r, g, b, 255))


def blit_circular_clipped(cv: Canvas, src: Canvas, cx: int, cy: int, clip_r: float) -> None:
    """Blita `src` centralizado em (cx, cy) com recorte circular suave (AA 1.5px)."""
    dx0 = cx - src.w // 2
    dy0 = cy - src.h // 2
    sbuf = src.buf
    for sy in range(src.h):
        py = dy0 + sy
        if py < 0 or py >= cv.h:
            continue
        for sx in range(src.w):
            px = dx0 + sx
            if px < 0 or px >= cv.w:
                continue
            dist = math.hypot(px - cx, py - cy)
            if dist >= clip_r + 0.75:
                continue
            so = (sy * src.w + sx) * 4
            sa = sbuf[so + 3]
            if sa == 0:
                continue
            mask = _clamp((clip_r + 0.75 - dist) / 1.5, 0.0, 1.0)
            eff_a = int(round(sa * mask))
            if eff_a > 0:
                cv.blend_pixel(px, py, (sbuf[so], sbuf[so + 1], sbuf[so + 2], eff_a))


# ---------------------------------------------------------------------------
# Construcao da Prancha de Aprovacao
# ---------------------------------------------------------------------------

def build_approval_sheet(icon_frames: List[Canvas], portrait_frames: List[Canvas]) -> Canvas:
    """
    Prancha M7 legivel e completa:
      Secao 1: 16 icones 64x64 em 2x (128x128) sobre xadrez de transparencia
               (8x2 grade com rotulos + indices).
      Secao 2: Faixa de simulacao em botoes circulares metalicos dark fantasy
               (16 botoes com os icones 64x64 em tamanho real 1x).
      Secao 3: 8 retratos 128x128 em 1x sobre xadrez de transparencia com rotulos.
      Secao 4: 8 retratos em molduras circulares metalicas simulando o HUD.
    """
    margin = 24
    # 8 colunas para icones 2x (128px + 14px gap)
    col_w = 142
    W = margin * 2 + 8 * col_w - 14  # ~1170 px
    H = 980

    sheet = Canvas(W, H, (14, 16, 24, 255))

    # Cabecalho
    sheet.fill_rect(0, 0, W, 52, (20, 23, 36, 255))
    sheet.fill_rect(0, 51, W, 2, (98, 80, 48, 255))
    draw_text(sheet, margin, 14, "SUBMUNDO M7 - APROVACAO DE ICONES 2D (64X64) E RETRATOS 2D (128X128)", (238, 214, 148, 255), scale=2)
    draw_text(sheet, margin, 34, "ALPHA SUAVE + PRESERVACAO DE GLOWS + DOWNSCALE AREA PREMULTIPLIED", (156, 174, 206, 255), scale=1)

    # ---- Secao 1: 16 Icones 64x64 em 2x sobre xadrez ----
    y = 66
    draw_text(sheet, margin, y, "1. ICONES 2D (16 FRAMES 64X64 EXIBIDOS EM 2X SOBRE FUNDO XADREZ CLARO/ESCURO)", (216, 224, 240, 255), scale=2)
    y += 20

    for idx, (name, frame) in enumerate(zip(ICON_NAMES, icon_frames)):
        r, c = divmod(idx, 8)
        bx = margin + c * col_w
        by = y + r * 156
        # Metade esquerda xadrez escuro, metade direita xadrez claro (revela halos escuros E brancos!)
        draw_checker(sheet, bx, by, 64, 128, tile=8, c1=(32, 36, 48, 255), c2=(46, 52, 68, 255))
        draw_checker(sheet, bx + 64, by, 64, 128, tile=8, c1=(168, 174, 188, 255), c2=(204, 210, 222, 255))
        draw_border(sheet, bx, by, 128, 128, (76, 84, 108, 255), 1)
        up2 = upscale_nearest(frame, 2)
        sheet.blit(up2, bx, by, blend=True)
        label = f"{idx}:{name}"
        if len(label) > 16:
            label = label[:16]
        tw = text_width(label, 1)
        draw_text(sheet, bx + (128 - tw) // 2, by + 134, label, (206, 214, 232, 255), scale=1)

    # ---- Secao 2: Botoes Circulares Metalicos Dark Fantasy (1x nativo 64x64) ----
    y += 2 * 156 + 14
    sheet.fill_rect(margin, y - 8, W - margin * 2, 1, (48, 54, 74, 255))
    draw_text(sheet, margin, y, "2. SIMULACAO IN-GAME: BOTOES CIRCULARES METALICOS DARK FANTASY (ESCALA 1X NATIVA 64X64)", (216, 224, 240, 255), scale=2)
    y += 22

    # Fundo de barra HUD sombria para os 16 botoes em 1 linha
    sheet.fill_rect(margin, y, W - margin * 2, 92, (20, 22, 32, 255))
    draw_border(sheet, margin, y, W - margin * 2, 92, (62, 68, 88, 255), 1)
    # 16 botoes espacados igualmente
    avail_w = W - margin * 2 - 24
    step_btn = avail_w / 16.0
    for idx, frame in enumerate(icon_frames):
        cx = int(round(margin + 12 + (idx + 0.5) * step_btn))
        cy = y + 46
        is_gold = idx in (2, 3, 4, 10, 11)
        draw_metallic_circle_frame(
            sheet, cx, cy, outer_r=34, rim_w=5,
            inner_col_top=(32, 36, 52), inner_col_bot=(14, 16, 26),
            rim_gold=is_gold,
        )
        # Icone 64x64 reduzido levemente (52x52) ou 1x (64x64) dentro do botao de raio interno 29 -> 54x54 cabe com folga linda!
        btn_icon = resize_area_premult(frame, 52, 52)
        sheet.blit(btn_icon, cx - 26, cy - 26, blend=True)

    # ---- Secao 3: 8 Retratos 128x128 em 1x sobre xadrez ----
    y += 108
    sheet.fill_rect(margin, y - 8, W - margin * 2, 1, (48, 54, 74, 255))
    draw_text(sheet, margin, y, "3. RETRATOS 2D (8 FRAMES 128X128 EM 1X NATIVO SOBRE XADREZ CLARO/ESCURO)", (216, 224, 240, 255), scale=2)
    y += 20

    for idx, (name, frame) in enumerate(zip(PORTRAIT_NAMES, portrait_frames)):
        bx = margin + idx * col_w
        by = y
        draw_checker(sheet, bx, by, 64, 128, tile=8, c1=(32, 36, 48, 255), c2=(46, 52, 68, 255))
        draw_checker(sheet, bx + 64, by, 64, 128, tile=8, c1=(168, 174, 188, 255), c2=(204, 210, 222, 255))
        draw_border(sheet, bx, by, 128, 128, (76, 84, 108, 255), 1)
        sheet.blit(frame, bx, by, blend=True)
        label = f"{idx}:{name}"
        tw = text_width(label, 1)
        draw_text(sheet, bx + (128 - tw) // 2, by + 134, label, (206, 214, 232, 255), scale=1)

    # ---- Secao 4: Retratos em Molduras Circulares de HUD ----
    y += 156
    sheet.fill_rect(margin, y - 8, W - margin * 2, 1, (48, 54, 74, 255))
    draw_text(sheet, margin, y, "4. SIMULACAO IN-GAME: MOLDURA CIRCULAR DE HUD (RETRATOS 128X128)", (216, 224, 240, 255), scale=2)
    y += 20

    for idx, (name, frame) in enumerate(zip(PORTRAIT_NAMES, portrait_frames)):
        bx = margin + idx * col_w
        cx = bx + 64
        cy = y + 66
        is_gold = idx in (1, 4, 6, 7)
        draw_metallic_circle_frame(
            sheet, cx, cy, outer_r=60, rim_w=7,
            inner_col_top=(34, 38, 56), inner_col_bot=(14, 16, 26),
            rim_gold=is_gold,
        )
        hud_p = resize_area_premult(frame, 106, 106)
        blit_circular_clipped(sheet, hud_p, cx, cy, clip_r=52.5)
        tw = text_width(name, 1)
        draw_text(sheet, bx + (128 - tw) // 2, y + 134, name, (182, 192, 214, 255), scale=1)

    return sheet


# ---------------------------------------------------------------------------
# Publicacao Oficial em public/assets/sprites/ & Manifest
# ---------------------------------------------------------------------------

def read_png_ihdr(path: Path) -> Tuple[int, int, int, int]:
    """Retorna (width, height, bit_depth, color_type) a partir do chunk IHDR."""
    data = path.read_bytes()
    if len(data) < 33 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError(f"PNG/IHDR invalido: {path}")
    w, h, bit_depth, color_type = struct.unpack(">IIBB", data[16:26])
    return (w, h, bit_depth, color_type)


def update_manifest() -> None:
    """Atualiza as entradas `portraits` e `ui_icons` em public/assets/sprites/manifest.json."""
    raw_bytes = MANIFEST_JSON.read_bytes()
    newline = "\r\n" if b"\r\n" in raw_bytes else "\n"
    manifest = json.loads(raw_bytes.decode("utf-8"))
    sprites = manifest.setdefault("sprites", {})

    sprites["portraits"] = {
        "key": "portraits",
        "file": "portraits.png",
        "width": 1024,
        "height": 128,
        "frameWidth": 128,
        "frameHeight": 128,
        "frames": list(PORTRAIT_NAMES),
    }
    sprites["ui_icons"] = {
        "key": "ui_icons",
        "file": "ui_icons.png",
        "width": 1024,
        "height": 64,
        "frameWidth": 64,
        "frameHeight": 64,
        "frames": list(ICON_NAMES),
    }

    serialized = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    if newline == "\r\n":
        serialized = serialized.replace("\n", "\r\n")
    MANIFEST_JSON.write_bytes(serialized.encode("utf-8"))
    print(f"Atualizado: {MANIFEST_JSON}")


def publish_assets() -> None:
    """Publica ui_icons.png (1024x64) e portraits.png (1024x128) em public/assets/sprites/."""
    for src, dst, exp_w, exp_h in (
        (ICONS_OUT_PNG, PUBLIC_ICONS_PNG, 1024, 64),
        (PORTRAITS_OUT_PNG, PUBLIC_PORTRAITS_PNG, 1024, 128),
    ):
        if not src.exists():
            raise FileNotFoundError(f"PNG fonte nao encontrado para publicacao: {src}")
        w, h, bd, ct = read_png_ihdr(src)
        if (w, h, bd, ct) != (exp_w, exp_h, 8, 6):
            raise ValueError(
                f"IHDR inesperado em {src}: {w}x{h} bd={bd} ct={ct} "
                f"(esperado {exp_w}x{exp_h} bd=8 ct=6)"
            )
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
        pw, ph, pbd, pct = read_png_ihdr(dst)
        print(f"Publicado: {dst} ({pw}x{ph}, {pbd}-bit RGBA, ct={pct})")

    update_manifest()


# ---------------------------------------------------------------------------
# Pipeline Principal
# ---------------------------------------------------------------------------

def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Gera e publica ui_icons.png (1024x64) e portraits.png (1024x128)."
    )
    parser.add_argument(
        "--publish-only",
        action="store_true",
        help="Publica em public/assets/sprites/ e atualiza manifest.json a partir dos PNGs aprovados em assets/sprites_src/ui/.",
    )
    parser.add_argument(
        "--no-publish",
        action="store_true",
        help="Gera apenas os PNGs e a prancha de aprovacao em assets/, sem publicar em public/assets/sprites/.",
    )
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> None:
    args = parse_args(argv)

    if not args.publish_only:
        print("Carregando fontes JPG via PowerShell System.Drawing...")
        icons_raw = load_jpg_as_canvas(ICONS_RAW_JPG)
        portraits_raw = load_jpg_as_canvas(PORTRAITS_RAW_JPG)
        print(f"  ui_icons_raw: {icons_raw.w}x{icons_raw.h}")
        print(f"  portraits_raw: {portraits_raw.w}x{portraits_raw.h}")

        # 1. Processar 16 icones 64x64 -> 1024x64
        icon_cells = split_grid_smart(icons_raw, cols=4, rows=4)
        icon_frames: List[Canvas] = []
        icons_sheet = Canvas(16 * 64, 64)
        for idx, (name, cell) in enumerate(zip(ICON_NAMES, icon_cells)):
            clean = remove_background_with_glow(
                cell,
                glow_spec=ICON_GLOW_SPEC[name],
                hole_seeds=ICON_HOLE_SEEDS.get(name, ()),
            )
            frame = fit_centered_frame(clean, frame_size=64, max_extent=56, glow_margin=2)
            icon_frames.append(frame)
            icons_sheet.blit(frame, idx * 64, 0, blend=False)
        write_png(ICONS_OUT_PNG, icons_sheet)
        print(f"Gerado: {ICONS_OUT_PNG} ({icons_sheet.w}x{icons_sheet.h})")

        # 2. Processar 8 retratos 128x128 -> 1024x128
        portrait_cells = split_grid_smart(portraits_raw, cols=4, rows=2)
        portrait_frames: List[Canvas] = []
        portraits_sheet = Canvas(8 * 128, 128)
        for idx, (name, cell) in enumerate(zip(PORTRAIT_NAMES, portrait_cells)):
            clean = remove_background_with_glow(
                cell,
                glow_spec=PORTRAIT_GLOW_SPEC[name],
                hole_seeds=PORTRAIT_HOLE_SEEDS.get(name, ()),
            )
            frame = fit_centered_frame(clean, frame_size=128, max_extent=118, glow_margin=3)
            portrait_frames.append(frame)
            portraits_sheet.blit(frame, idx * 128, 0, blend=False)
        write_png(PORTRAITS_OUT_PNG, portraits_sheet)
        print(f"Gerado: {PORTRAITS_OUT_PNG} ({portraits_sheet.w}x{portraits_sheet.h})")

        # 3. Gerar prancha de aprovacao M7
        preview = build_approval_sheet(icon_frames, portrait_frames)
        write_png(PREVIEW_OUT_PNG, preview)
        print(f"Gerado: {PREVIEW_OUT_PNG} ({preview.w}x{preview.h})")

    if not args.no_publish:
        publish_assets()


if __name__ == "__main__":
    main()
