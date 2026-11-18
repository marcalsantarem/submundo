#!/usr/bin/env python3
"""
Gera os 5 spritesheets animados (1600x80, 20 frames 80x80) dos monstros em
public/assets/sprites/:
  - slime.png
  - cave_bat.png
  - wolf.png
  - skeleton.png
  - skeleton_archer.png

Indices:
  0..3  : idle0..idle3 (4f)
  4..9  : walk0..walk5 (6f)
  10..15: attack0..attack5 (6f)
  16..19: death0..death3 (4f)

Tambem gera a previa em grade assets/mockups/preview_monsters_5_20f.png
e atualiza public/assets/sprites/manifest.json.

100% Python stdlib pura (sem Pillow/NumPy).
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

ART_DIR = Path(__file__).resolve().parent
if str(ART_DIR) not in sys.path:
    sys.path.insert(0, str(ART_DIR))

import buildMonstersBase as base  # noqa: E402
from buildMonstersBase import (  # noqa: E402
    Canvas,
    Color,
    FH,
    FOOT_Y,
    FW,
    OUTLINE,
    Pal4,
    add_outline,
    clamp,
    dim_palette,
    draw_capsule,
    draw_ellipse,
    draw_line,
    draw_polygon_shaded,
    draw_text,
    pick_tone,
    remove_isolated_pixels,
    rgba,
    write_png,
)

ROOT = ART_DIR.parents[1]
OUT_SPRITES_DIR = ROOT / "public" / "assets" / "sprites"
MANIFEST_PATH = OUT_SPRITES_DIR / "manifest.json"
PREVIEW_PATH = ROOT / "assets" / "mockups" / "preview_monsters_5_20f.png"

FRAME_NAMES: List[str] = (
    [f"idle{i}" for i in range(4)]
    + [f"walk{i}" for i in range(6)]
    + [f"attack{i}" for i in range(6)]
    + [f"death{i}" for i in range(4)]
)
NUM_FRAMES = 20  # 1600x80


# ---------------------------------------------------------------------------
# Helpers geometricos
# ---------------------------------------------------------------------------

def rot_pt(
    origin: Tuple[float, float],
    offset: Tuple[float, float],
    angle_rad: float,
) -> Tuple[float, float]:
    ox, oy = origin
    dx, dy = offset
    c = math.cos(angle_rad)
    s = math.sin(angle_rad)
    return (ox + dx * c - dy * s, oy + dx * s + dy * c)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def draw_x_eye(cv: Canvas, cx: int, cy: int, col: Color) -> None:
    cv.put(cx - 1, cy - 1, col)
    cv.put(cx + 1, cy - 1, col)
    cv.put(cx, cy, col)
    cv.put(cx - 1, cy + 1, col)
    cv.put(cx + 1, cy + 1, col)


# ---------------------------------------------------------------------------
# 1. SLIME (20 frames)
# ---------------------------------------------------------------------------

PAL_SLIME: Pal4 = (
    (16, 94, 30),
    (32, 146, 44),
    (64, 206, 66),
    (126, 240, 92),
)


def render_slime_frame(
    cx: float,
    base_y: float,
    top_y: float,
    half_w: float,
    tilt_x: float = 0.0,
    face_dx: float = 0.0,
    face_dy: float = 0.0,
    eye_mode: str = "normal",
    mouth_mode: str = "frown",
    droplets: Sequence[Tuple[float, float, float, float]] = ((28.0, 74.5, 1.5, 1.1),),
    trail_drops: Sequence[Tuple[float, float, float, float]] = (),
    alpha_fade: float = 1.0,
) -> Canvas:
    body = Canvas(FW, FH)
    iy_top = max(2, int(math.floor(top_y)))
    iy_base = min(FH - 2, int(math.ceil(base_y)))
    h_span = max(2.0, base_y - top_y)

    for py in range(iy_top, iy_base + 1):
        t_y = clamp((py - top_y) / h_span, 0.0, 1.0)
        profile = math.sin(t_y * math.pi * 0.56 + 0.14)
        cur_hw = half_w * (profile ** 0.72)
        if t_y > 0.85:
            cur_hw *= 1.0 - 0.10 * ((t_y - 0.85) / 0.15) ** 2
        row_cx = cx + tilt_x * (1.0 - t_y)
        for px in range(max(2, int(row_cx - cur_hw - 1)), min(FW - 2, int(row_cx + cur_hw + 2))):
            dx = px - row_cx
            wave_y = base_y - (1.0 if abs(dx) > cur_hw * 0.78 else 0.0)
            if abs(dx) <= cur_hw and py <= wave_y:
                nx = dx / max(1.0, cur_hw)
                ny = (t_y - 0.38) * 1.35
                shade = (-0.48 * nx - 0.82 * ny) + 0.22 * (1.0 - abs(nx))
                if py >= wave_y - 1.0:
                    col = PAL_SLIME[0]
                elif py >= wave_y - 3.0 and shade < 0.05:
                    col = PAL_SLIME[1]
                else:
                    col = pick_tone(shade, PAL_SLIME)
                body.put(px, py, rgba(col))

    for dx, dy, rx, ry in droplets:
        draw_ellipse(body, dx, dy, rx, ry, PAL_SLIME)
    for dx, dy, rx, ry in trail_drops:
        draw_ellipse(body, dx, dy, rx, ry, PAL_SLIME)

    # Reflexos especulares proporcionais ao domo 50%
    spec_hi = (210, 255, 195, 255)
    spec_bright = (255, 255, 255, 255)
    if h_span >= 7.0:
        sx0 = int(round(cx + tilt_x * 0.75 - half_w * 0.45))
        sy0 = int(round(top_y + h_span * 0.18))
        for ox, oy in ((0, 0), (1, -1), (2, -1), (3, -1), (-1, 1), (-1, 2)):
            body.put(sx0 + ox, sy0 + oy, spec_hi)
        body.put(sx0 + 1, sy0, spec_bright)
        body.put(sx0 + 2, sy0, spec_bright)
    else:
        sx0 = int(round(cx - half_w * 0.30))
        sy0 = int(round(top_y + 1))
        for ox in range(3):
            body.put(sx0 + ox, sy0, spec_hi)

    # Rosto nitido na escala 50%
    eye_dark = (10, 22, 12, 255)
    if eye_mode != "none":
        ex_l = int(round(cx - 2 + face_dx + tilt_x * 0.4))
        ex_r = int(round(cx + 4 + face_dx + tilt_x * 0.4))
        ey = int(round(top_y + h_span * 0.50 + face_dy))
        if eye_mode == "normal":
            for ex in (ex_l, ex_r):
                body.put(ex, ey, spec_bright)
                body.put(ex + 1, ey, eye_dark)
                body.put(ex, ey + 1, eye_dark)
                body.put(ex + 1, ey + 1, eye_dark)
        elif eye_mode == "angry":
            for ex in (ex_l, ex_r):
                body.put(ex, ey, (255, 220, 120, 255))
                body.put(ex + 1, ey, eye_dark)
                body.put(ex, ey + 1, eye_dark)
                body.put(ex + 1, ey + 1, eye_dark)
        elif eye_mode == "x":
            draw_x_eye(body, ex_l, ey, eye_dark)
            draw_x_eye(body, ex_r, ey, eye_dark)

        my = ey + 4
        mx0 = int(round(cx - 1 + face_dx + tilt_x * 0.4))
        if mouth_mode == "frown":
            for i, oy in enumerate((0, -1, -1, -1, 0)):
                body.put(mx0 + i, my + oy, eye_dark)
        elif mouth_mode == "open":
            for dy in range(-1, 1):
                for dx in range(0, 5):
                    body.put(mx0 + dx, my + dy, eye_dark)
            body.put(mx0 + 1, my - 1, (220, 255, 210, 255))
            body.put(mx0 + 3, my - 1, (220, 255, 210, 255))

    out = remove_isolated_pixels(add_outline(body, OUTLINE))
    if alpha_fade < 1.0:
        for i in range(0, len(out.buf), 4):
            if out.buf[i + 3] > 0:
                out.buf[i + 3] = int(out.buf[i + 3] * alpha_fade)
    return out


def build_slime_frames() -> List[Canvas]:
    frames: List[Canvas] = []
    # 0..3 idle (escala 50%, base fixa em y=76, altura ~16px)
    idle_params = [
        (40.0, 76.0, 60.0, 11.0, 0.0, 0.0),
        (40.0, 76.0, 61.5, 11.8, 0.0, 0.4),
        (40.0, 76.0, 59.0, 10.3, 0.0, -0.4),
        (40.0, 76.0, 60.8, 11.4, 0.0, 0.0),
    ]
    for cx, by, ty, hw, tx, fdy in idle_params:
        frames.append(render_slime_frame(cx, by, ty, hw, tilt_x=tx, face_dy=fdy))

    # 4..9 walk (compressao -> impulso -> salto em arco -> descida -> pouso -> rebote)
    walk_params = [
        (39.5, 76.0, 63.0, 12.5, -1.0, 0.6, ((26.5, 74.5, 1.5, 1.0),), ()),
        (40.0, 71.0, 54.0, 9.0, 1.5, -0.6, (), ((31.0, 74.0, 1.3, 0.9), (36.0, 75.0, 1.4, 0.9))),
        (40.5, 67.0, 51.0, 10.0, 1.8, -0.8, (), ((30.0, 71.0, 1.2, 0.9), (35.0, 73.0, 1.1, 0.8))),
        (40.5, 72.0, 56.0, 9.5, 1.2, 0.4, (), ((32.0, 74.5, 1.1, 0.8),)),
        (40.0, 76.0, 64.0, 13.5, 0.6, 0.8, ((25.5, 74.5, 1.4, 1.0), (53.5, 74.5, 1.3, 0.9)), ()),
        (40.0, 76.0, 59.5, 10.5, 0.0, -0.3, ((28.5, 74.5, 1.4, 1.0),), ()),
    ]
    for cx, by, ty, hw, tx, fdy, dr, tr in walk_params:
        frames.append(render_slime_frame(cx, by, ty, hw, tilt_x=tx, face_dy=fdy, droplets=dr, trail_drops=tr))

    # 10..15 attack (encolhe atras -> projecao frontal em golpe gelatinoso)
    attack_params = [
        (37.0, 76.0, 62.0, 10.5, -2.0, 0.5, "angry", "frown", ((25.5, 74.5, 1.4, 1.0),), ()),
        (35.0, 76.0, 63.5, 11.5, -3.0, 0.8, "angry", "frown", ((23.5, 74.5, 1.4, 1.0),), ()),
        (44.5, 74.0, 58.0, 12.0, 4.0, -0.4, "angry", "open", (), ((30.0, 74.0, 1.4, 0.9), (34.0, 75.0, 1.2, 0.8))),
        (47.0, 75.0, 59.0, 12.5, 4.8, 0.0, "angry", "open", ((56.5, 74.0, 1.3, 0.9),), ((32.0, 75.0, 1.5, 0.9),)),
        (43.0, 76.0, 62.0, 11.8, 1.8, 0.4, "normal", "frown", ((29.0, 74.5, 1.4, 1.0),), ()),
        (40.5, 76.0, 60.5, 11.0, 0.4, 0.0, "normal", "frown", ((28.0, 74.5, 1.5, 1.1),), ()),
    ]
    for cx, by, ty, hw, tx, fdy, em, mm, dr, tr in attack_params:
        frames.append(
            render_slime_frame(
                cx, by, ty, hw, tilt_x=tx, face_dx=1.0, face_dy=fdy,
                eye_mode=em, mouth_mode=mm, droplets=dr, trail_drops=tr
            )
        )

    # 16..19 death (achatamento progressivo ate virar poca verde no chao)
    death_params = [
        (40.0, 76.0, 63.0, 12.0, -1.0, "x", "open", ((26.5, 74.5, 1.4, 1.0),), 1.0),
        (40.0, 76.0, 67.5, 14.0, 0.0, "x", "none", ((24.5, 74.5, 1.3, 0.9), (55.0, 74.5, 1.2, 0.9)), 1.0),
        (40.0, 76.0, 71.0, 15.5, 0.0, "none", "none", ((23.0, 75.0, 1.2, 0.8), (56.5, 75.0, 1.1, 0.8)), 0.92),
        (40.0, 76.0, 73.5, 16.5, 0.0, "none", "none", ((22.0, 75.2, 1.1, 0.7), (57.5, 75.2, 1.0, 0.7)), 0.85),
    ]
    for cx, by, ty, hw, tx, em, mm, dr, af in death_params:
        frames.append(
            render_slime_frame(
                cx, by, ty, hw, tilt_x=tx, eye_mode=em, mouth_mode=mm, droplets=dr, alpha_fade=af
            )
        )
    return frames


# ---------------------------------------------------------------------------
# 2. CAVE BAT (20 frames)
# ---------------------------------------------------------------------------

PAL_BAT_FUR: Pal4 = ((30, 22, 48), (52, 38, 80), (82, 62, 118), (120, 96, 160))
PAL_BAT_BONE: Pal4 = ((44, 30, 62), (72, 52, 98), (106, 80, 138), (144, 116, 176))
PAL_BAT_MEMB: Pal4 = ((34, 16, 44), (56, 26, 70), (84, 42, 100), (114, 60, 132))
PAL_BAT_EAR: Pal4 = ((92, 48, 88), (134, 72, 124), (178, 102, 158), (210, 140, 190))


def render_bat_frame(
    cx: float,
    cy: float,
    wing_tip_dy: float,
    wing_span: float = 1.0,
    wing_fold: float = 0.0,
    body_tilt: float = 0.0,
    mouth_open: bool = False,
    eye_mode: str = "normal",
    dead_pose: bool = False,
) -> Canvas:
    wings = Canvas(FW, FH)
    # Ombros das asas (escala 50%, ~30x20px total)
    ls = (cx - 3.0, cy - 0.5)
    rs = (cx + 3.0, cy - 0.5)

    if dead_pose:
        # Asas fechadas/caidas sobre o chao
        l_pts = [(cx - 3, cy - 1), (cx - 10, cy + 1), (cx - 12, cy + 5), (cx - 4, cy + 5)]
        r_pts = [(cx + 3, cy - 1), (cx + 10, cy + 1), (cx + 12, cy + 5), (cx + 4, cy + 5)]
        draw_polygon_shaded(wings, l_pts, PAL_BAT_MEMB)
        draw_polygon_shaded(wings, r_pts, dim_palette(PAL_BAT_MEMB, 0.85))
        draw_capsule(wings, (cx - 3, cy - 1), (cx - 10, cy + 1), 1.0, 0.7, PAL_BAT_BONE)
        draw_capsule(wings, (cx + 3, cy - 1), (cx + 10, cy + 1), 1.0, 0.7, dim_palette(PAL_BAT_BONE, 0.88))
    else:
        # Asa esquerda (frente 3/4)
        l_elbow = (
            cx - (8.0 * wing_span - 2.5 * wing_fold),
            cy - 6.0 + wing_tip_dy * 0.72,
        )
        l_tip = (
            cx - (15.0 * wing_span - 5.5 * wing_fold),
            cy - 8.0 + wing_tip_dy,
        )
        l_bot1 = (l_tip[0] + 2.0, l_tip[1] + 9.0 - wing_tip_dy * 0.15)
        l_bot2 = (l_elbow[0] + 1.0, l_elbow[1] + 10.5 - wing_tip_dy * 0.15)
        l_pts = [
            ls, l_elbow, l_tip,
            (l_tip[0], l_tip[1] + 4.5),
            l_bot1,
            (l_bot1[0] + 3.0, l_bot1[1] - 2.0),
            l_bot2,
            (l_bot2[0] + 3.0, l_bot2[1] - 2.0),
            (ls[0] - 1.0, ls[1] + 3.5),
        ]
        draw_polygon_shaded(wings, l_pts, PAL_BAT_MEMB)

        # Asa direita (atras)
        r_elbow = (
            cx + (8.0 * wing_span - 2.5 * wing_fold),
            cy - 6.0 + wing_tip_dy * 0.72,
        )
        r_tip = (
            cx + (15.0 * wing_span - 5.5 * wing_fold),
            cy - 8.0 + wing_tip_dy,
        )
        r_bot1 = (r_tip[0] - 2.0, r_tip[1] + 9.0 - wing_tip_dy * 0.15)
        r_bot2 = (r_elbow[0] - 1.0, r_elbow[1] + 10.5 - wing_tip_dy * 0.15)
        r_pts = [
            rs, r_elbow, r_tip,
            (r_tip[0], r_tip[1] + 4.5),
            r_bot1,
            (r_bot1[0] - 3.0, r_bot1[1] - 2.0),
            r_bot2,
            (r_bot2[0] - 3.0, r_bot2[1] - 2.0),
            (rs[0] + 1.0, rs[1] + 3.5),
        ]
        draw_polygon_shaded(wings, r_pts, dim_palette(PAL_BAT_MEMB, 0.85))

        # Ossos finos das asas
        draw_capsule(wings, ls, l_elbow, 1.0, 0.8, PAL_BAT_BONE)
        draw_capsule(wings, l_elbow, l_tip, 0.9, 0.6, PAL_BAT_BONE)
        draw_line(wings, (int(round(l_elbow[0])), int(round(l_elbow[1]))), (int(round(l_bot1[0])), int(round(l_bot1[1] - 1))), rgba(PAL_BAT_BONE[2]))
        draw_line(wings, (int(round(l_elbow[0])), int(round(l_elbow[1]))), (int(round(l_bot2[0])), int(round(l_bot2[1] - 1))), rgba(PAL_BAT_BONE[1]))

        bone_r = dim_palette(PAL_BAT_BONE, 0.88)
        draw_capsule(wings, rs, r_elbow, 1.0, 0.8, bone_r)
        draw_capsule(wings, r_elbow, r_tip, 0.9, 0.6, bone_r)
        draw_line(wings, (int(round(r_elbow[0])), int(round(r_elbow[1]))), (int(round(r_bot1[0])), int(round(r_bot1[1] - 1))), rgba(bone_r[2]))
        draw_line(wings, (int(round(r_elbow[0])), int(round(r_elbow[1]))), (int(round(r_bot2[0])), int(round(r_bot2[1] - 1))), rgba(bone_r[1]))

        claw = (218, 212, 198, 255)
        wings.put(int(round(l_elbow[0])), int(round(l_elbow[1] - 1)), claw)
        wings.put(int(round(r_elbow[0])), int(round(r_elbow[1] - 1)), claw)

    wings_out = add_outline(wings, OUTLINE)

    body = Canvas(FW, FH)
    bx = cx
    by = cy + 2.5
    hx = cx + body_tilt * 2.0
    hy = cy - 3.5 + abs(body_tilt) * 0.8

    # Pes/garras inferiores
    if not dead_pose:
        draw_line(body, (int(round(bx - 2)), int(round(by + 3.5))), (int(round(bx - 3)), int(round(by + 6.5))), rgba(PAL_BAT_BONE[2]))
        draw_line(body, (int(round(bx + 2)), int(round(by + 3.5))), (int(round(bx + 3)), int(round(by + 6.5))), rgba(PAL_BAT_BONE[2]))

    # Tronco peludo
    draw_ellipse(body, bx, by, 4.0, 4.3, PAL_BAT_FUR)

    # Orelhas pontudas
    draw_polygon_shaded(body, [(hx - 4, hy - 0.5), (hx - 6, hy - 7.5), (hx - 1, hy - 3.5)], PAL_BAT_FUR)
    draw_polygon_shaded(body, [(hx + 1, hy - 3.5), (hx + 6, hy - 7.5), (hx + 4, hy - 0.5)], PAL_BAT_FUR)
    body.put(int(round(hx - 4)), int(round(hy - 3.5)), rgba(PAL_BAT_EAR[2]))
    body.put(int(round(hx + 4)), int(round(hy - 3.5)), rgba(PAL_BAT_EAR[2]))

    # Cabeca
    draw_ellipse(body, hx, hy, 4.0, 3.2, PAL_BAT_FUR)

    # Olhos (2x1 cada)
    ex1, ex2 = int(round(hx - 3)), int(round(hx + 2))
    ey = int(round(hy - 0.5))
    if eye_mode == "x":
        draw_x_eye(body, ex1 + 1, ey, (18, 12, 24, 255))
        draw_x_eye(body, ex2 + 1, ey, (18, 12, 24, 255))
    else:
        body.put(ex1, ey, (220, 30, 30, 255))
        body.put(ex1 + 1, ey, (255, 200, 70, 255))
        body.put(ex2, ey, (255, 200, 70, 255))
        body.put(ex2 + 1, ey, (220, 30, 30, 255))

    # Focinho e presinhas
    fx = int(round(hx))
    fy = int(round(hy + 1.5))
    body.put(fx, fy, (28, 18, 40, 255))
    if mouth_open:
        for mx in range(fx - 1, fx + 2):
            body.put(mx, fy + 1, (120, 22, 34, 255))
            body.put(mx, fy + 2, (80, 14, 22, 255))
        body.put(fx - 1, fy + 1, (245, 242, 236, 255))
        body.put(fx + 1, fy + 1, (245, 242, 236, 255))
    else:
        body.put(fx - 1, fy + 1, (245, 242, 236, 255))
        body.put(fx + 1, fy + 1, (245, 242, 236, 255))

    body_out = add_outline(body, OUTLINE)
    res = Canvas(FW, FH)
    res.composite(wings_out)
    res.composite(body_out)
    return remove_isolated_pixels(res)


def build_cave_bat_frames() -> List[Canvas]:
    frames: List[Canvas] = []
    # 0..3 idle (flutuacao suave na escala 50%)
    idle_params = [
        (40.0, 44.0, 0.0, 1.0),
        (40.0, 43.2, 3.2, 1.0),
        (40.0, 42.5, 6.0, 0.96),
        (40.0, 43.2, 2.8, 1.0),
    ]
    for cx, cy, wdy, ws in idle_params:
        frames.append(render_bat_frame(cx, cy, wdy, wing_span=ws))

    # 4..9 walk (ciclo completo de batida de asas cima -> meio -> baixo -> retorno)
    walk_params = [
        (40.0, 45.0, -4.0, 0.95, 0.1),
        (40.0, 44.0, 2.5, 1.06, 0.0),
        (40.0, 41.5, 11.5, 0.92, 0.0),
        (40.0, 42.5, 8.0, 0.96, 0.05),
        (40.0, 44.0, 1.5, 1.02, 0.05),
        (40.0, 45.0, -3.0, 0.96, 0.1),
    ]
    for cx, cy, wdy, ws, wf in walk_params:
        frames.append(render_bat_frame(cx, cy, wdy, wing_span=ws, wing_fold=wf))

    # 10..15 attack (fecha asas atras e mergulha em rasante com presas)
    attack_params = [
        (37.0, 42.0, -2.5, 0.85, 0.45, -0.3, False),
        (35.0, 41.0, 1.5, 0.72, 0.75, -0.4, True),
        (45.0, 45.0, 4.5, 0.90, 0.40, 0.9, True),
        (48.0, 46.5, 6.5, 0.95, 0.25, 1.0, True),
        (43.5, 44.5, 3.5, 1.0, 0.10, 0.4, False),
        (40.5, 44.0, 0.5, 1.0, 0.0, 0.1, False),
    ]
    for cx, cy, wdy, ws, wf, bt, mo in attack_params:
        frames.append(render_bat_frame(cx, cy, wdy, wing_span=ws, wing_fold=wf, body_tilt=bt, mouth_open=mo))

    # 16..19 death (desequilibrio, queda e asas fechadas no chao y=76)
    frames.append(render_bat_frame(39.0, 46.0, -2.0, wing_span=0.88, wing_fold=0.35, body_tilt=-0.4, eye_mode="x"))
    frames.append(render_bat_frame(39.5, 55.0, 4.5, wing_span=0.75, wing_fold=0.60, body_tilt=-0.2, eye_mode="x"))
    frames.append(render_bat_frame(40.0, 64.0, 7.5, wing_span=0.65, wing_fold=0.80, body_tilt=0.1, eye_mode="x"))
    frames.append(render_bat_frame(40.0, 70.0, 0.0, eye_mode="x", dead_pose=True))
    return frames


# ---------------------------------------------------------------------------
# 3. WOLF (20 frames)
# ---------------------------------------------------------------------------

PAL_WOLF_FUR: Pal4 = ((42, 46, 56), (72, 78, 92), (114, 122, 138), (164, 174, 192))
PAL_WOLF_BACK: Pal4 = dim_palette(PAL_WOLF_FUR, 0.72)
PAL_WOLF_LIGHT: Pal4 = ((96, 102, 114), (136, 144, 158), (178, 186, 200), (216, 222, 234))


def _draw_wolf_leg(
    cv: Canvas,
    hip: Tuple[float, float],
    upper_ang: float,
    lower_ang: float,
    pal_leg: Pal4,
    pal_paw: Pal4,
    upper_len: float = 10.5,
    lower_len: float = 9.5,
    r_top: float = 3.6,
    r_knee: float = 2.2,
    r_ankle: float = 1.8,
) -> None:
    knee = rot_pt(hip, (0.0, upper_len), upper_ang)
    ankle = rot_pt(knee, (0.0, lower_len), lower_ang)
    # Garantir que nao ultrapasse FOOT_Y
    if ankle[1] > FOOT_Y - 1.5:
        ankle = (ankle[0], FOOT_Y - 1.5)
    draw_capsule(cv, hip, knee, r_top, r_knee, pal_leg)
    draw_capsule(cv, knee, ankle, r_knee, r_ankle, pal_leg)
    draw_ellipse(cv, ankle[0] + 1.5, min(FOOT_Y - 1.5, ankle[1] + 0.5), 2.8, 1.6, pal_paw)


def render_wolf_frame(
    dx: float = 0.0,
    dy: float = 0.0,
    body_pitch: float = 0.0,
    head_dx: float = 0.0,
    head_dy: float = 0.0,
    tail_ang: float = 0.0,
    fl: Tuple[float, float] = (-0.18, 0.14),   # front left (frontal)
    fr: Tuple[float, float] = (-0.25, 0.16),   # front right (fundo)
    bl: Tuple[float, float] = (0.36, -0.20),   # back left (frontal)
    br: Tuple[float, float] = (0.28, -0.22),   # back right (fundo)
    jaw_open: float = 0.0,
    eye_mode: str = "normal",
    dead_pose: bool = False,
) -> Canvas:
    if dead_pose:
        # Lobo estendido de lado no chao (y=76)
        back = Canvas(FW, FH)
        draw_capsule(back, (20, 71), (10, 68), 3.0, 2.0, PAL_WOLF_BACK)
        draw_capsule(back, (26, 73), (36, 74), 2.4, 1.7, PAL_WOLF_BACK)
        draw_capsule(back, (48, 73), (58, 74), 2.2, 1.6, PAL_WOLF_BACK)
        back_out = add_outline(back, OUTLINE)

        front = Canvas(FW, FH)
        draw_capsule(front, (22, 68), (46, 68), 6.2, 7.0, PAL_WOLF_FUR)
        draw_ellipse(front, 47.0, 68.5, 5.8, 5.5, PAL_WOLF_LIGHT)
        draw_capsule(front, (24, 71), (34, 74), 2.6, 1.8, PAL_WOLF_FUR)
        draw_capsule(front, (46, 71), (56, 74), 2.4, 1.8, PAL_WOLF_FUR)
        draw_ellipse(front, 55.0, 69.0, 6.4, 5.2, PAL_WOLF_FUR)
        draw_polygon_shaded(front, [(49, 65), (46, 59), (53, 63)], PAL_WOLF_FUR)
        draw_capsule(front, (58, 69), (66, 71), 3.0, 1.9, PAL_WOLF_LIGHT)
        front.put(67, 71, (16, 16, 22, 255))
        draw_x_eye(front, 56, 67, (24, 20, 28, 255))
        front_out = add_outline(front, OUTLINE)
        res = Canvas(FW, FH)
        res.composite(back_out)
        res.composite(front_out)
        return remove_isolated_pixels(res)

    hip = (24.0 + dx, 54.0 + dy - body_pitch * 3.0)
    shoulder = (47.0 + dx, 50.0 + dy + body_pitch * 3.0)

    back = Canvas(FW, FH)
    # Cauda felpuda
    t_mid = rot_pt((hip[0] - 2.0, hip[1] - 4.0), (-8.0, -7.0), tail_ang)
    t_tip = rot_pt(t_mid, (-5.0, -7.0), tail_ang * 1.3)
    draw_capsule(back, (hip[0] - 2.0, hip[1] - 4.0), t_mid, 3.6, 2.8, PAL_WOLF_FUR)
    draw_capsule(back, t_mid, t_tip, 2.8, 1.4, PAL_WOLF_LIGHT)

    # Patas de fundo
    _draw_wolf_leg(back, (hip[0] + 4.0, hip[1] + 2.0), br[0], br[1], PAL_WOLF_BACK, PAL_WOLF_BACK, 10.0, 9.5, 3.3, 2.1, 1.7)
    _draw_wolf_leg(back, (shoulder[0] + 4.0, shoulder[1] + 5.0), fr[0], fr[1], PAL_WOLF_BACK, PAL_WOLF_BACK, 10.0, 9.5, 2.9, 1.9, 1.6)
    back_out = add_outline(back, OUTLINE)

    front = Canvas(FW, FH)
    # Torso
    draw_capsule(front, (hip[0] + 1.0, hip[1] - 2.0), (shoulder[0], shoulder[1] - 2.0), 7.1, 8.4, PAL_WOLF_FUR)
    # Peito e juba
    draw_ellipse(front, shoulder[0] + 1.0, shoulder[1] - 1.0, 6.6, 7.0, PAL_WOLF_LIGHT)
    draw_polygon_shaded(
        front,
        [
            (shoulder[0] - 10, shoulder[1] - 7),
            (shoulder[0] - 3, shoulder[1] - 17),
            (shoulder[0] + 6, shoulder[1] - 11),
            (shoulder[0] - 1, shoulder[1] - 2),
        ],
        PAL_WOLF_FUR,
    )
    draw_polygon_shaded(
        front,
        [
            (shoulder[0] - 5, shoulder[1] - 7),
            (shoulder[0] + 1, shoulder[1] - 14),
            (shoulder[0] + 8, shoulder[1] - 8),
            (shoulder[0] + 1, shoulder[1] - 1),
        ],
        PAL_WOLF_LIGHT,
    )

    # Patas frontais
    _draw_wolf_leg(front, (hip[0] - 1.0, hip[1]), bl[0], bl[1], PAL_WOLF_FUR, PAL_WOLF_LIGHT, 10.5, 9.8, 3.8, 2.3, 1.8)
    _draw_wolf_leg(front, (shoulder[0] - 1.0, shoulder[1] + 4.0), fl[0], fl[1], PAL_WOLF_FUR, PAL_WOLF_LIGHT, 10.5, 9.5, 3.3, 2.1, 1.7)

    # Cabeca
    hx = shoulder[0] + 6.5 + head_dx
    hy = shoulder[1] - 12.0 + head_dy
    draw_ellipse(front, hx, hy, 6.9, 5.9, PAL_WOLF_FUR)
    draw_polygon_shaded(front, [(hx - 6.5, hy - 4), (hx - 8.5, hy - 14), (hx - 2.5, hy - 7)], PAL_WOLF_FUR)
    draw_polygon_shaded(front, [(hx - 0.5, hy - 6), (hx + 1.5, hy - 15), (hx + 4.5, hy - 6)], PAL_WOLF_FUR)
    front.put(int(round(hx - 6)), int(round(hy - 10)), (145, 110, 120, 255))
    front.put(int(round(hx + 1.5)), int(round(hy - 11)), (145, 110, 120, 255))

    # Focinho + mandibula
    draw_capsule(front, (hx + 2.5, hy), (hx + 12.5, hy + 1.0), 3.3, 2.0, PAL_WOLF_LIGHT)
    draw_capsule(front, (hx + 2.5, hy + 3.5 + jaw_open * 1.5), (hx + 10.5, hy + 4.8 + jaw_open * 3.0), 2.0, 1.4, PAL_WOLF_LIGHT)
    nx = int(round(hx + 13.5))
    ny = int(round(hy + 0.5))
    front.put(nx, ny, (16, 16, 22, 255))
    front.put(nx, ny + 1, (16, 16, 22, 255))
    front.put(nx - 1, ny, (28, 28, 36, 255))

    # Boca e presas
    mx0 = int(round(hx + 5.5))
    my0 = int(round(hy + 3.0 + jaw_open * 0.8))
    for mx in range(mx0, mx0 + 6):
        front.put(mx, my0, (120, 28, 36, 255))
        if jaw_open > 0.5:
            front.put(mx, my0 + 1, (90, 18, 26, 255))
    front.put(mx0 + 2, my0 - 1, (245, 244, 236, 255))
    front.put(mx0 + 5, my0 - 1, (245, 244, 236, 255))

    ex = int(round(hx + 1.5))
    ey = int(round(hy - 3.0))
    if eye_mode == "x":
        draw_x_eye(front, ex, ey, (20, 18, 26, 255))
    else:
        front.put(ex, ey, (235, 145, 25, 255))
        front.put(ex + 1, ey, (255, 220, 80, 255))
        front.put(ex, ey + 1, (250, 185, 40, 255))
        front.put(ex + 1, ey + 1, (255, 245, 160, 255))

    front_out = add_outline(front, OUTLINE)
    res = Canvas(FW, FH)
    res.composite(back_out)
    res.composite(front_out)
    return remove_isolated_pixels(res)


def build_wolf_frames() -> List[Canvas]:
    frames: List[Canvas] = []
    # 0..3 idle (respiracao/alerta com cauda oscilando)
    frames.append(render_wolf_frame(dy=0.0, tail_ang=0.0, jaw_open=0.0))
    frames.append(render_wolf_frame(dy=0.8, head_dy=0.8, tail_ang=0.12, jaw_open=0.2))
    frames.append(render_wolf_frame(dy=1.4, head_dy=1.2, tail_ang=0.20, jaw_open=0.4))
    frames.append(render_wolf_frame(dy=0.7, head_dy=0.6, tail_ang=0.10, jaw_open=0.2))

    # 4..9 walk (ciclo real de trote/galope com alternancia clara das patas)
    walk_cfg = [
        (-1.0, 0.12, (-0.52, 0.25), (0.38, -0.10), (0.55, -0.25), (-0.35, 0.20), -0.20),
        (0.5, 0.05, (-0.22, 0.12), (0.15, 0.15), (0.20, -0.15), (-0.10, 0.25), -0.05),
        (-2.2, -0.08, (0.20, 0.45), (-0.18, 0.35), (-0.25, 0.30), (0.25, 0.10), 0.15),
        (-1.0, -0.12, (0.38, -0.10), (-0.52, 0.25), (-0.35, 0.20), (0.55, -0.25), 0.22),
        (0.5, -0.05, (0.15, 0.15), (-0.22, 0.12), (-0.10, 0.25), (0.20, -0.15), 0.08),
        (-2.0, 0.06, (-0.18, 0.35), (0.20, 0.45), (0.25, 0.10), (-0.25, 0.30), -0.10),
    ]
    for dy, bp, fl, fr, bl, br, tang in walk_cfg:
        frames.append(render_wolf_frame(dy=dy, body_pitch=bp, fl=fl, fr=fr, bl=bl, br=br, tail_ang=tang, jaw_open=0.2))

    # 10..15 attack (agacha e da bote longo com mandibula aberta)
    frames.append(render_wolf_frame(dx=-3.5, dy=3.5, body_pitch=0.3, head_dx=-1.0, head_dy=2.0, fl=(-0.45, 0.55), fr=(-0.50, 0.60), bl=(0.60, -0.45), br=(0.55, -0.40), tail_ang=0.35, jaw_open=0.4))
    frames.append(render_wolf_frame(dx=-6.0, dy=5.5, body_pitch=0.4, head_dx=-1.5, head_dy=3.0, fl=(-0.60, 0.80), fr=(-0.65, 0.85), bl=(0.75, -0.60), br=(0.70, -0.55), tail_ang=0.45, jaw_open=0.7))
    frames.append(render_wolf_frame(dx=5.5, dy=-4.5, body_pitch=-0.35, head_dx=2.0, head_dy=-1.0, fl=(-0.85, -0.20), fr=(-0.75, -0.15), bl=(0.85, 0.25), br=(0.78, 0.20), tail_ang=0.55, jaw_open=1.2))
    frames.append(render_wolf_frame(dx=8.5, dy=-2.0, body_pitch=-0.20, head_dx=2.5, head_dy=0.5, fl=(-0.70, 0.10), fr=(-0.62, 0.12), bl=(0.72, 0.10), br=(0.65, 0.08), tail_ang=0.40, jaw_open=1.3))
    frames.append(render_wolf_frame(dx=4.0, dy=1.5, body_pitch=0.10, head_dx=1.0, head_dy=1.0, fl=(-0.35, 0.25), fr=(-0.30, 0.22), bl=(0.40, -0.20), br=(0.35, -0.18), tail_ang=0.15, jaw_open=0.5))
    frames.append(render_wolf_frame(dx=1.0, dy=0.5, body_pitch=0.0, fl=(-0.20, 0.16), fr=(-0.25, 0.16), bl=(0.36, -0.20), br=(0.28, -0.22), tail_ang=0.0, jaw_open=0.1))

    # 16..19 death (tombando de lado e repousando imovel no chao)
    frames.append(render_wolf_frame(dx=-2.0, dy=2.5, body_pitch=-0.3, head_dy=2.5, fl=(-0.10, 0.30), fr=(-0.15, 0.35), bl=(0.25, -0.10), br=(0.20, -0.10), eye_mode="x"))
    frames.append(render_wolf_frame(dx=-1.0, dy=7.0, body_pitch=0.1, head_dy=5.0, fl=(-0.45, 0.85), fr=(-0.50, 0.90), bl=(0.55, -0.55), br=(0.50, -0.50), eye_mode="x"))
    frames.append(render_wolf_frame(dx=0.0, dy=11.5, body_pitch=0.25, head_dy=7.0, fl=(-0.75, 1.15), fr=(-0.80, 1.20), bl=(0.80, -0.80), br=(0.75, -0.75), eye_mode="x"))
    frames.append(render_wolf_frame(dead_pose=True))
    return frames


# ---------------------------------------------------------------------------
# 3B. WOLF ALPHA (20 frames, 80x80, Boss maior marrom/vermelho com juba e cicatriz)
# ---------------------------------------------------------------------------

PAL_ALPHA_FUR: Pal4 = ((48, 18, 16), (86, 30, 24), (132, 50, 34), (176, 80, 50))
PAL_ALPHA_BACK: Pal4 = dim_palette(PAL_ALPHA_FUR, 0.70)
PAL_ALPHA_MANE: Pal4 = ((72, 24, 20), (120, 44, 30), (168, 72, 46), (212, 114, 72))
PAL_ALPHA_CLAW: Pal4 = ((90, 82, 78), (135, 126, 120), (185, 176, 168), (226, 218, 210))


def _draw_alpha_leg(
    cv: Canvas,
    hip: Tuple[float, float],
    upper_ang: float,
    lower_ang: float,
    pal_leg: Pal4,
    pal_paw: Pal4,
    upper_len: float = 13.0,
    lower_len: float = 12.0,
    r_top: float = 4.4,
    r_knee: float = 2.7,
    r_ankle: float = 2.1,
    has_claw: bool = True,
) -> None:
    knee = rot_pt(hip, (0.0, upper_len), upper_ang)
    ankle = rot_pt(knee, (0.0, lower_len), lower_ang)
    if ankle[1] > FOOT_Y - 1.5:
        ankle = (ankle[0], FOOT_Y - 1.5)
    draw_capsule(cv, hip, knee, r_top, r_knee, pal_leg)
    draw_capsule(cv, knee, ankle, r_knee, r_ankle, pal_leg)
    paw_y = min(FOOT_Y - 1.5, ankle[1] + 0.5)
    draw_ellipse(cv, ankle[0] + 1.5, paw_y, 3.3, 1.9, pal_paw)
    if has_claw:
        draw_ellipse(cv, ankle[0] + 4.0, paw_y + 0.5, 1.2, 0.9, PAL_ALPHA_CLAW)


def render_wolf_alpha_frame(
    dx: float = 0.0,
    dy: float = 0.0,
    body_pitch: float = 0.0,
    head_dx: float = 0.0,
    head_dy: float = 0.0,
    tail_ang: float = 0.0,
    fl: Tuple[float, float] = (-0.18, 0.14),
    fr: Tuple[float, float] = (-0.25, 0.16),
    bl: Tuple[float, float] = (0.36, -0.20),
    br: Tuple[float, float] = (0.28, -0.22),
    jaw_open: float = 0.0,
    eye_mode: str = "normal",
    dead_pose: bool = False,
) -> Canvas:
    if dead_pose:
        back = Canvas(FW, FH)
        draw_capsule(back, (16, 70), (6, 66), 3.6, 2.2, PAL_ALPHA_BACK)
        draw_capsule(back, (24, 73), (36, 74), 2.8, 2.0, PAL_ALPHA_BACK)
        draw_capsule(back, (50, 73), (62, 74), 2.6, 1.9, PAL_ALPHA_BACK)
        back_out = add_outline(back, OUTLINE)

        front = Canvas(FW, FH)
        draw_capsule(front, (19, 67), (48, 67), 7.4, 8.4, PAL_ALPHA_FUR)
        draw_ellipse(front, 49.0, 67.5, 7.0, 6.5, PAL_ALPHA_MANE)
        draw_capsule(front, (21, 71), (33, 74), 3.0, 2.1, PAL_ALPHA_FUR)
        draw_capsule(front, (47, 71), (59, 74), 2.8, 2.1, PAL_ALPHA_FUR)
        draw_ellipse(front, 58.0, 68.0, 7.4, 6.0, PAL_ALPHA_FUR)
        draw_polygon_shaded(front, [(51, 63), (47, 56), (55, 61)], PAL_ALPHA_FUR)
        draw_capsule(front, (61, 68), (71, 70), 3.5, 2.2, PAL_ALPHA_MANE)
        front.put(72, 70, (16, 12, 14, 255))
        draw_x_eye(front, 59, 65, (24, 18, 22, 255))
        front_out = add_outline(front, OUTLINE)
        res = Canvas(FW, FH)
        res.composite(back_out)
        res.composite(front_out)
        return remove_isolated_pixels(res)

    hip = (21.0 + dx, 48.0 + dy - body_pitch * 3.5)
    shoulder = (48.0 + dx, 44.0 + dy + body_pitch * 3.5)

    back = Canvas(FW, FH)
    t_mid = rot_pt((hip[0] - 3.0, hip[1] - 3.0), (-8.0, -11.0), tail_ang)
    t_tip = rot_pt(t_mid, (-4.0, -11.0), tail_ang * 1.3)
    draw_capsule(back, (hip[0] - 3.0, hip[1] - 3.0), t_mid, 4.6, 3.6, PAL_ALPHA_FUR)
    draw_capsule(back, t_mid, t_tip, 3.6, 1.8, PAL_ALPHA_MANE)

    _draw_alpha_leg(back, (hip[0] + 4.0, hip[1] + 2.0), br[0], br[1], PAL_ALPHA_BACK, PAL_ALPHA_BACK, 12.5, 12.0, 4.0, 2.6, 2.0, has_claw=False)
    _draw_alpha_leg(back, (shoulder[0] + 4.0, shoulder[1] + 5.0), fr[0], fr[1], PAL_ALPHA_BACK, PAL_ALPHA_BACK, 12.0, 11.5, 3.6, 2.4, 1.9, has_claw=False)
    back_out = add_outline(back, OUTLINE)

    front = Canvas(FW, FH)
    # Torso robusto
    draw_capsule(front, (hip[0], hip[1] - 2.0), (shoulder[0], shoulder[1] - 2.0), 8.6, 10.2, PAL_ALPHA_FUR)
    # Peito e juba ericada
    draw_ellipse(front, shoulder[0] + 1.0, shoulder[1] - 1.0, 8.2, 8.6, PAL_ALPHA_MANE)
    draw_polygon_shaded(front, [(shoulder[0] - 16, shoulder[1] - 5), (shoulder[0] - 10, shoulder[1] - 16), (shoulder[0] - 1, shoulder[1] - 10), (shoulder[0] - 8, shoulder[1] - 1)], PAL_ALPHA_FUR)
    draw_polygon_shaded(front, [(shoulder[0] - 11, shoulder[1] - 7), (shoulder[0] - 5, shoulder[1] - 20), (shoulder[0] + 6, shoulder[1] - 13), (shoulder[0] - 1, shoulder[1] - 2)], PAL_ALPHA_FUR)
    draw_polygon_shaded(front, [(shoulder[0] - 7, shoulder[1] - 6), (shoulder[0], shoulder[1] - 18), (shoulder[0] + 9, shoulder[1] - 10), (shoulder[0] + 1, shoulder[1])], PAL_ALPHA_MANE)
    draw_polygon_shaded(front, [(shoulder[0] - 4, shoulder[1] + 2), (shoulder[0] + 5, shoulder[1] + 8), (shoulder[0] + 9, shoulder[1] - 2)], PAL_ALPHA_MANE)

    # Patas frontais
    _draw_alpha_leg(front, (hip[0] - 2.0, hip[1] + 1.0), bl[0], bl[1], PAL_ALPHA_FUR, PAL_ALPHA_MANE, 13.0, 12.2, 4.5, 2.8, 2.2)
    _draw_alpha_leg(front, (shoulder[0] - 2.0, shoulder[1] + 5.0), fl[0], fl[1], PAL_ALPHA_FUR, PAL_ALPHA_MANE, 12.5, 11.8, 4.0, 2.6, 2.0)

    # Cabeca grande 3/4 para a direita
    hx = shoulder[0] + 8.5 + head_dx
    hy = shoulder[1] - 15.0 + head_dy
    draw_ellipse(front, hx, hy, 8.2, 7.0, PAL_ALPHA_FUR)
    draw_polygon_shaded(front, [(hx - 7.5, hy - 4), (hx - 10.5, hy - 15), (hx - 2.5, hy - 8)], PAL_ALPHA_FUR)
    draw_polygon_shaded(front, [(hx - 0.5, hy - 6), (hx + 1.5, hy - 16), (hx + 5.5, hy - 6)], PAL_ALPHA_FUR)
    front.put(int(round(hx - 7.5)), int(round(hy - 10)), (180, 96, 86, 255))
    front.put(int(round(hx + 1.5)), int(round(hy - 11)), (180, 96, 86, 255))

    # Focinho + mandibula
    draw_capsule(front, (hx + 2.5, hy), (hx + 15.5, hy + 1.0), 4.0, 2.4, PAL_ALPHA_MANE)
    draw_capsule(front, (hx + 2.5, hy + 4.5 + jaw_open * 1.6), (hx + 13.5, hy + 5.8 + jaw_open * 3.2), 2.3, 1.6, PAL_ALPHA_MANE)
    nx = int(round(hx + 16.5))
    ny = int(round(hy + 0.5))
    for ox, oy in ((0, 0), (0, 1), (-1, 0)):
        front.put(nx + ox, ny + oy, (16, 12, 14, 255))

    # Boca e presas maiores
    mx0 = int(round(hx + 5.5))
    my0 = int(round(hy + 3.0 + jaw_open * 0.9))
    for mx in range(mx0, mx0 + 9):
        front.put(mx, my0, (130, 22, 28, 255))
        if jaw_open > 0.3:
            front.put(mx, my0 + 1, (95, 16, 22, 255))
    for fx in (mx0 + 2, mx0 + 5, mx0 + 8):
        front.put(fx, my0 - 1, (248, 244, 236, 255))
        front.put(fx, my0, (248, 244, 236, 255))

    ex = int(round(hx + 1.5))
    ey = int(round(hy - 3.0))
    if eye_mode == "x":
        draw_x_eye(front, ex, ey, (20, 14, 18, 255))
    else:
        front.put(ex, ey, (220, 36, 24, 255))
        front.put(ex + 1, ey, (255, 190, 50, 255))
        front.put(ex, ey + 1, (255, 95, 30, 255))
        front.put(ex + 1, ey + 1, (255, 240, 140, 255))

    # Cicatriz de batalha
    scar_col = (232, 168, 152, 255)
    front.put(int(round(hx - 0.5)), int(round(hy - 6.0)), scar_col)
    front.put(int(round(hx + 0.5)), int(round(hy - 5.0)), scar_col)
    front.put(int(round(hx + 4.5)), int(round(hy)), scar_col)
    front.put(int(round(hx + 5.5)), int(round(hy + 1.0)), scar_col)

    front_out = add_outline(front, OUTLINE)
    res = Canvas(FW, FH)
    res.composite(back_out)
    res.composite(front_out)
    return remove_isolated_pixels(res)


def build_wolf_alpha_frames() -> List[Canvas]:
    frames: List[Canvas] = []
    # 0..3 idle
    frames.append(render_wolf_alpha_frame(dy=0.0, tail_ang=0.0, jaw_open=0.0))
    frames.append(render_wolf_alpha_frame(dy=0.8, head_dy=0.8, tail_ang=0.12, jaw_open=0.2))
    frames.append(render_wolf_alpha_frame(dy=1.4, head_dy=1.2, tail_ang=0.20, jaw_open=0.4))
    frames.append(render_wolf_alpha_frame(dy=0.7, head_dy=0.6, tail_ang=0.10, jaw_open=0.2))

    # 4..9 walk
    walk_cfg = [
        (-1.0, 0.12, (-0.52, 0.25), (0.38, -0.10), (0.55, -0.25), (-0.35, 0.20), -0.20),
        (0.5, 0.05, (-0.22, 0.12), (0.15, 0.15), (0.20, -0.15), (-0.10, 0.25), -0.05),
        (-2.2, -0.08, (0.20, 0.45), (-0.18, 0.35), (-0.25, 0.30), (0.25, 0.10), 0.15),
        (-1.0, -0.12, (0.38, -0.10), (-0.52, 0.25), (-0.35, 0.20), (0.55, -0.25), 0.22),
        (0.5, -0.05, (0.15, 0.15), (-0.22, 0.12), (-0.10, 0.25), (0.20, -0.15), 0.08),
        (-2.0, 0.06, (-0.18, 0.35), (0.20, 0.45), (0.25, 0.10), (-0.25, 0.30), -0.10),
    ]
    for dy, bp, fl, fr, bl, br, tang in walk_cfg:
        frames.append(render_wolf_alpha_frame(dy=dy, body_pitch=bp, fl=fl, fr=fr, bl=bl, br=br, tail_ang=tang, jaw_open=0.2))

    # 10..15 attack
    frames.append(render_wolf_alpha_frame(dx=-3.5, dy=3.5, body_pitch=0.3, head_dx=-1.0, head_dy=2.0, fl=(-0.45, 0.55), fr=(-0.50, 0.60), bl=(0.60, -0.45), br=(0.55, -0.40), tail_ang=0.35, jaw_open=0.4))
    frames.append(render_wolf_alpha_frame(dx=-6.0, dy=5.5, body_pitch=0.4, head_dx=-1.5, head_dy=3.0, fl=(-0.60, 0.80), fr=(-0.65, 0.85), bl=(0.75, -0.60), br=(0.70, -0.55), tail_ang=0.45, jaw_open=0.7))
    frames.append(render_wolf_alpha_frame(dx=5.5, dy=-4.5, body_pitch=-0.35, head_dx=2.0, head_dy=-1.0, fl=(-0.85, -0.20), fr=(-0.75, -0.15), bl=(0.85, 0.25), br=(0.78, 0.20), tail_ang=0.55, jaw_open=1.2))
    frames.append(render_wolf_alpha_frame(dx=7.0, dy=-2.0, body_pitch=-0.20, head_dx=2.0, head_dy=0.5, fl=(-0.70, 0.10), fr=(-0.62, 0.12), bl=(0.72, 0.10), br=(0.65, 0.08), tail_ang=0.40, jaw_open=1.3))
    frames.append(render_wolf_alpha_frame(dx=3.5, dy=1.5, body_pitch=0.10, head_dx=1.0, head_dy=1.0, fl=(-0.35, 0.25), fr=(-0.30, 0.22), bl=(0.40, -0.20), br=(0.35, -0.18), tail_ang=0.15, jaw_open=0.5))
    frames.append(render_wolf_alpha_frame(dx=1.0, dy=0.5, body_pitch=0.0, fl=(-0.20, 0.16), fr=(-0.25, 0.16), bl=(0.36, -0.20), br=(0.28, -0.22), tail_ang=0.0, jaw_open=0.1))

    # 16..19 death
    frames.append(render_wolf_alpha_frame(dx=-2.0, dy=2.5, body_pitch=-0.3, head_dy=2.5, fl=(-0.10, 0.30), fr=(-0.15, 0.35), bl=(0.25, -0.10), br=(0.20, -0.10), eye_mode="x"))
    frames.append(render_wolf_alpha_frame(dx=-1.0, dy=7.0, body_pitch=0.1, head_dy=5.0, fl=(-0.45, 0.85), fr=(-0.50, 0.90), bl=(0.55, -0.55), br=(0.50, -0.50), eye_mode="x"))
    frames.append(render_wolf_alpha_frame(dx=0.0, dy=11.5, body_pitch=0.25, head_dy=7.0, fl=(-0.75, 1.15), fr=(-0.80, 1.20), bl=(0.80, -0.80), br=(0.75, -0.75), eye_mode="x"))
    frames.append(render_wolf_alpha_frame(dead_pose=True))
    return frames


# ---------------------------------------------------------------------------
# 4. SKELETON (20 frames)
# ---------------------------------------------------------------------------

PAL_BONE: Pal4 = ((94, 84, 68), (148, 136, 110), (202, 190, 158), (238, 230, 206))
PAL_BONE_BACK: Pal4 = dim_palette(PAL_BONE, 0.74)
PAL_CLOTH: Pal4 = ((28, 24, 34), (48, 42, 58), (72, 64, 86), (98, 88, 114))
PAL_WOOD: Pal4 = ((56, 34, 20), (92, 56, 32), (130, 82, 46), (166, 112, 66))
PAL_STEEL: Pal4 = ((58, 66, 78), (96, 108, 124), (148, 162, 180), (212, 224, 238))


def _draw_skel_leg(
    cv: Canvas,
    hip: Tuple[float, float],
    thigh_ang: float,
    shin_ang: float,
    pal: Pal4,
    boot_pal: Optional[Pal4] = None,
) -> None:
    knee = rot_pt(hip, (0.0, 12.0), thigh_ang)
    ankle = rot_pt(knee, (0.0, 11.0), shin_ang)
    if ankle[1] > FOOT_Y - 1.5:
        ankle = (ankle[0], FOOT_Y - 1.5)
    draw_capsule(cv, hip, knee, 2.1, 1.7, pal)
    draw_capsule(cv, knee, ankle, 1.8 if boot_pal is None else 2.2, 1.5 if boot_pal is None else 1.8, boot_pal or pal)
    draw_ellipse(cv, ankle[0] + 2.0, min(FOOT_Y - 1.5, ankle[1] + 0.5), 3.1, 1.5, boot_pal or pal)


def render_skeleton_frame(
    dx: float = 0.0,
    dy: float = 0.0,
    leg_l: Tuple[float, float] = (0.25, -0.15),
    leg_r: Tuple[float, float] = (-0.22, 0.10),
    sword_arm_ang: float = -0.55,
    sword_fore_ang: float = -1.15,
    sword_blade_ang: float = -0.82,
    shield_dx: float = 0.0,
    shield_dy: float = 0.0,
    slash_arc: bool = False,
    eye_mode: str = "normal",
    dead_pose: bool = False,
) -> Canvas:
    if dead_pose:
        # Monte de ossos, cranio, escudo e espada caidos no chao (y=76)
        back = Canvas(FW, FH)
        draw_polygon_shaded(back, [(46, 73), (66, 71), (67, 73), (47, 75)], PAL_STEEL)
        draw_capsule(back, (44, 71), (48, 76), 1.3, 1.3, PAL_WOOD)
        draw_ellipse(back, 27.0, 72.5, 7.5, 3.5, PAL_STEEL)
        draw_ellipse(back, 27.0, 72.5, 5.5, 2.3, PAL_WOOD)
        back_out = add_outline(back, OUTLINE)

        body = Canvas(FW, FH)
        draw_polygon_shaded(body, [(30, 70), (48, 70), (50, 75), (29, 75)], PAL_CLOTH)
        for rx in (33, 37, 41):
            draw_capsule(body, (rx, 68), (rx + 2, 74), 1.4, 1.4, PAL_BONE)
        draw_capsule(body, (16, 73), (25, 74), 1.8, 1.5, PAL_BONE_BACK)
        draw_capsule(body, (50, 73), (59, 74), 1.8, 1.5, PAL_BONE)
        draw_ellipse(body, 39.0, 65.5, 5.8, 5.2, PAL_BONE)
        body.put(37, 65, (18, 14, 18, 255))
        body.put(42, 65, (18, 14, 18, 255))
        body_out = add_outline(body, OUTLINE)

        res = Canvas(FW, FH)
        res.composite(back_out)
        res.composite(body_out)
        return remove_isolated_pixels(res)

    cx = 40.0 + dx
    pelvis_y = 50.0 + dy
    sh_y = 33.0 + dy

    # Back: perna direita + braco direito com espada
    back = Canvas(FW, FH)
    _draw_skel_leg(back, (cx + 4.0, pelvis_y + 1.0), leg_r[0], leg_r[1], PAL_BONE_BACK)

    r_sh = (cx + 7.0, sh_y + 1.0)
    r_elb = rot_pt(r_sh, (0.0, 10.5), sword_arm_ang)
    r_hand = rot_pt(r_elb, (0.0, 6.0), sword_fore_ang)
    draw_capsule(back, r_sh, r_elb, 1.8, 1.5, PAL_BONE_BACK)
    draw_capsule(back, r_elb, r_hand, 1.6, 1.5, PAL_BONE_BACK)

    # Espada a partir da mao
    b_dir = (math.cos(sword_blade_ang), math.sin(sword_blade_ang))
    b_perp = (-b_dir[1], b_dir[0])
    tip = (r_hand[0] + b_dir[0] * 21.0, r_hand[1] + b_dir[1] * 21.0)
    guard_a = (r_hand[0] + b_perp[0] * 3.5, r_hand[1] + b_perp[1] * 3.5)
    guard_b = (r_hand[0] - b_perp[0] * 3.5, r_hand[1] - b_perp[1] * 3.5)
    pommel = (r_hand[0] - b_dir[0] * 4.5, r_hand[1] - b_dir[1] * 4.5)
    blade_pts = [
        (r_hand[0] + b_perp[0] * 1.4, r_hand[1] + b_perp[1] * 1.4),
        (tip[0] + b_perp[0] * 1.1, tip[1] + b_perp[1] * 1.1),
        (tip[0] + b_dir[0] * 2.5, tip[1] + b_dir[1] * 2.5),
        (tip[0] - b_perp[0] * 1.1, tip[1] - b_perp[1] * 1.1),
        (r_hand[0] - b_perp[0] * 1.4, r_hand[1] - b_perp[1] * 1.4),
    ]
    draw_polygon_shaded(back, blade_pts, PAL_STEEL)
    draw_capsule(back, guard_a, guard_b, 1.3, 1.3, PAL_WOOD)
    draw_capsule(back, pommel, r_hand, 1.2, 1.2, PAL_WOOD)
    back_out = add_outline(back, OUTLINE)

    # Body: perna esquerda + pelvis + costelas + cranio
    body = Canvas(FW, FH)
    _draw_skel_leg(body, (cx - 5.0, pelvis_y + 1.0), leg_l[0], leg_l[1], PAL_BONE)
    draw_ellipse(body, cx, pelvis_y, 6.2, 2.8, PAL_BONE)
    draw_polygon_shaded(
        body,
        [(cx - 7, pelvis_y - 1), (cx + 7, pelvis_y - 1), (cx + 8, pelvis_y + 7), (cx + 3, pelvis_y + 5), (cx - 2, pelvis_y + 8), (cx - 8, pelvis_y + 6)],
        PAL_CLOTH,
    )
    draw_capsule(body, (cx, sh_y - 1), (cx, pelvis_y - 1), 2.2, 2.0, PAL_BONE_BACK)
    for ry in (sh_y + 1, sh_y + 5, sh_y + 9):
        draw_capsule(body, (cx - 7, ry), (cx + 6, ry), 1.5, 1.5, PAL_BONE)
        body.put(int(round(cx)), int(round(ry + 1)), (38, 32, 30, 255))
        body.put(int(round(cx + 1)), int(round(ry + 1)), (38, 32, 30, 255))
    draw_ellipse(body, cx + 7.0, sh_y, 3.8, 3.2, PAL_STEEL)

    # Cranio
    skull_y = sh_y - 12.5
    draw_ellipse(body, cx + 1.0, skull_y, 6.8, 6.6, PAL_BONE)
    draw_ellipse(body, cx + 2.0, skull_y + 6.5, 4.3, 2.7, PAL_BONE)
    ex1, ex2 = int(round(cx - 1)), int(round(cx + 5))
    ey = int(round(skull_y - 0.5))
    if eye_mode == "x":
        draw_x_eye(body, ex1, ey, (24, 18, 18, 255))
        draw_x_eye(body, ex2, ey, (24, 18, 18, 255))
    else:
        for ex in (ex1, ex2):
            for o_y in (-1, 0, 1):
                for o_x in (-1, 0, 1):
                    body.put(ex + o_x, ey + o_y, (18, 14, 18, 255))
            body.put(ex, ey, (240, 75, 42, 255))
    body.put(int(round(cx + 3)), int(round(skull_y + 2.5)), (28, 22, 22, 255))
    for tx in (int(round(cx - 1)), int(round(cx + 1)), int(round(cx + 3)), int(round(cx + 5))):
        body.put(tx, int(round(skull_y + 6.5)), (74, 64, 52, 255))
        body.put(tx, int(round(skull_y + 7.5)), (236, 228, 202, 255))
    body_out = add_outline(body, OUTLINE)

    # Shield: braco esquerdo + escudo
    shield = Canvas(FW, FH)
    l_sh = (cx - 7.0, sh_y + 1.0)
    scx = cx - 12.5 + shield_dx
    scy = sh_y + 11.0 + shield_dy
    draw_capsule(shield, l_sh, (scx + 1.5, scy - 2.0), 1.9, 1.6, PAL_BONE)
    draw_ellipse(shield, scx, scy, 5.8, 8.8, PAL_STEEL)
    draw_ellipse(shield, scx, scy, 4.2, 6.8, PAL_WOOD)
    draw_ellipse(shield, scx + 0.5, scy, 2.0, 2.5, PAL_STEEL)
    shield_out = add_outline(shield, OUTLINE)

    res = Canvas(FW, FH)
    res.composite(back_out)
    res.composite(body_out)
    res.composite(shield_out)

    if slash_arc:
        # Arco de corte metalico continuo na frente da espada
        pts_outer: List[Tuple[int, int]] = []
        pts_inner: List[Tuple[int, int]] = []
        for ang_deg in range(-58, 48, 8):
            a = math.radians(ang_deg)
            pts_outer.append((int(round(cx + 12 + math.cos(a) * 21)), int(round(sh_y + 4 + math.sin(a) * 20))))
            pts_inner.append((int(round(cx + 12 + math.cos(a) * 19)), int(round(sh_y + 4 + math.sin(a) * 18))))
        for i in range(len(pts_outer) - 1):
            draw_line(res, pts_inner[i], pts_inner[i + 1], (165, 205, 235, 190))
            draw_line(res, pts_outer[i], pts_outer[i + 1], (240, 248, 255, 235))

    return remove_isolated_pixels(res)


def build_skeleton_frames() -> List[Canvas]:
    frames: List[Canvas] = []
    # 0..3 idle
    frames.append(render_skeleton_frame(dy=0.0))
    frames.append(render_skeleton_frame(dy=1.0, sword_arm_ang=-0.48, shield_dy=1.0))
    frames.append(render_skeleton_frame(dy=1.5, sword_arm_ang=-0.44, shield_dy=1.5))
    frames.append(render_skeleton_frame(dy=0.8, sword_arm_ang=-0.50, shield_dy=0.8))

    # 4..9 walk (pernas alternadas, balanco de espada e escudo)
    walk_cfg = [
        (0.0, (0.48, -0.10), (-0.42, 0.25), -0.30, -0.95, -0.65, -2.5, 0.0),
        (1.5, (0.20, 0.10), (-0.15, 0.35), -0.45, -1.05, -0.75, -1.0, 1.0),
        (-1.5, (-0.15, 0.20), (0.18, 0.15), -0.60, -1.15, -0.85, 1.0, -1.0),
        (0.0, (-0.42, 0.25), (0.48, -0.10), -0.80, -1.35, -1.05, 2.5, 0.0),
        (1.5, (-0.15, 0.35), (0.20, 0.10), -0.65, -1.20, -0.90, 1.0, 1.0),
        (-1.5, (0.18, 0.15), (-0.15, 0.20), -0.45, -1.05, -0.75, -1.0, -1.0),
    ]
    for dy, ll, lr, sa, sf, sb, sdx, sdy in walk_cfg:
        frames.append(render_skeleton_frame(dy=dy, leg_l=ll, leg_r=lr, sword_arm_ang=sa, sword_fore_ang=sf, sword_blade_ang=sb, shield_dx=sdx, shield_dy=sdy))

    # 10..15 attack (ergue espada, corte amplo para frente protegendo com escudo)
    frames.append(render_skeleton_frame(dx=-2.0, dy=0.5, sword_arm_ang=-2.15, sword_fore_ang=-2.35, sword_blade_ang=-2.0, shield_dx=3.0, shield_dy=-2.0))
    frames.append(render_skeleton_frame(dx=-3.0, dy=1.0, sword_arm_ang=-2.65, sword_fore_ang=-2.75, sword_blade_ang=-2.55, shield_dx=4.5, shield_dy=-2.5))
    frames.append(render_skeleton_frame(dx=4.0, dy=1.5, leg_l=(0.45, -0.25), leg_r=(-0.40, 0.15), sword_arm_ang=-0.95, sword_fore_ang=-1.15, sword_blade_ang=-0.10, shield_dx=2.0, shield_dy=-1.0, slash_arc=True))
    frames.append(render_skeleton_frame(dx=5.5, dy=2.0, leg_l=(0.50, -0.28), leg_r=(-0.45, 0.18), sword_arm_ang=-0.35, sword_fore_ang=-0.55, sword_blade_ang=0.45, shield_dx=1.5, shield_dy=0.0, slash_arc=True))
    frames.append(render_skeleton_frame(dx=2.5, dy=1.0, leg_l=(0.35, -0.18), leg_r=(-0.30, 0.12), sword_arm_ang=-0.45, sword_fore_ang=-0.85, sword_blade_ang=0.15, shield_dx=0.5, shield_dy=0.5))
    frames.append(render_skeleton_frame(dx=0.5, dy=0.5, sword_arm_ang=-0.52, sword_fore_ang=-1.08, sword_blade_ang=-0.65))

    # 16..19 death (desabando e espalhando ossos/escudo no chao)
    frames.append(render_skeleton_frame(dx=-2.0, dy=3.5, leg_l=(0.35, -0.55), leg_r=(-0.30, 0.45), sword_arm_ang=-0.20, sword_fore_ang=-0.50, sword_blade_ang=0.20, shield_dy=3.0, eye_mode="x"))
    frames.append(render_skeleton_frame(dx=-1.0, dy=10.5, leg_l=(0.75, -1.20), leg_r=(-0.60, 1.00), sword_arm_ang=0.25, sword_fore_ang=0.10, sword_blade_ang=0.75, shield_dx=-2.0, shield_dy=7.0, eye_mode="x"))
    frames.append(render_skeleton_frame(dx=0.0, dy=17.5, leg_l=(1.10, -1.40), leg_r=(-0.95, 1.30), sword_arm_ang=0.55, sword_fore_ang=0.35, sword_blade_ang=1.10, shield_dx=-4.0, shield_dy=10.0, eye_mode="x"))
    frames.append(render_skeleton_frame(dead_pose=True))
    return frames


# ---------------------------------------------------------------------------
# 5. SKELETON ARCHER (20 frames)
# ---------------------------------------------------------------------------

PAL_HOOD: Pal4 = ((26, 36, 30), (42, 58, 48), (64, 86, 70), (94, 120, 98))
PAL_LEATHER: Pal4 = ((54, 34, 22), (88, 54, 32), (124, 78, 46), (158, 104, 62))
PAL_BOW: Pal4 = ((62, 36, 18), (104, 62, 30), (144, 90, 46), (182, 122, 68))


def render_archer_frame(
    dx: float = 0.0,
    dy: float = 0.0,
    leg_l: Tuple[float, float] = (0.25, -0.15),
    leg_r: Tuple[float, float] = (-0.22, 0.10),
    bow_dx: float = 0.0,
    bow_dy: float = 0.0,
    draw_pull: float = 0.0,       # 0 = repouso, >0 = corda puxada para tras
    arrow_x_offset: float = 0.0,  # >0 = flecha voando para direita
    has_arrow: bool = True,
    eye_mode: str = "normal",
    dead_pose: bool = False,
) -> Canvas:
    if dead_pose:
        # Ossos, capuz caido e arco no chao (y=76)
        back = Canvas(FW, FH)
        draw_capsule(back, (50, 72), (62, 68), 1.4, 1.3, PAL_BOW)
        draw_capsule(back, (62, 68), (68, 74), 1.4, 1.3, PAL_BOW)
        draw_line(back, (51, 72), (67, 74), (205, 200, 185, 255))
        back_out = add_outline(back, OUTLINE)

        body = Canvas(FW, FH)
        draw_polygon_shaded(body, [(22, 70), (45, 70), (47, 75), (21, 75)], PAL_HOOD)
        draw_capsule(body, (14, 73), (24, 74), 2.0, 1.6, PAL_LEATHER)
        draw_capsule(body, (44, 73), (54, 74), 2.0, 1.6, PAL_LEATHER)
        draw_ellipse(body, 34.0, 66.5, 5.6, 5.0, PAL_BONE)
        draw_polygon_shaded(body, [(25, 69), (28, 61), (36, 60), (39, 64), (31, 66)], PAL_HOOD)
        body.put(36, 66, (14, 18, 14, 255))
        body_out = add_outline(body, OUTLINE)

        res = Canvas(FW, FH)
        res.composite(back_out)
        res.composite(body_out)
        return remove_isolated_pixels(res)

    cx = 40.0 + dx
    pelvis_y = 50.0 + dy
    sh_y = 33.0 + dy

    # Back: aljava + perna direita + braco direito segurando arco
    back = Canvas(FW, FH)
    draw_capsule(back, (cx - 11, sh_y - 8), (cx - 5, sh_y + 9), 3.0, 2.4, PAL_LEATHER)
    for fx, fy in ((int(round(cx - 13)), int(round(sh_y - 12))), (int(round(cx - 11)), int(round(sh_y - 13))), (int(round(cx - 9)), int(round(sh_y - 12)))):
        back.put(fx, fy, (210, 68, 56, 255))
        back.put(fx, fy + 1, (235, 225, 195, 255))

    _draw_skel_leg(back, (cx + 3.0, pelvis_y + 1.0), leg_r[0], leg_r[1], PAL_BONE_BACK, PAL_LEATHER)

    bow_x = cx + 21.0 + bow_dx
    bow_y = sh_y + 6.0 + bow_dy
    draw_capsule(back, (cx + 6.0, sh_y + 2.0), (bow_x - 3.0, bow_y), 1.8, 1.5, PAL_BONE_BACK)
    back_out = add_outline(back, OUTLINE)

    # Body: perna esquerda + tunica + costelas + cranio + capuz
    body = Canvas(FW, FH)
    _draw_skel_leg(body, (cx - 5.0, pelvis_y + 1.0), leg_l[0], leg_l[1], PAL_BONE, PAL_LEATHER)
    draw_polygon_shaded(
        body,
        [(cx - 7, sh_y), (cx + 6, sh_y), (cx + 9, pelvis_y + 5), (cx + 2, pelvis_y + 3), (cx - 4, pelvis_y + 6), (cx - 9, pelvis_y + 4)],
        PAL_HOOD,
    )
    for ry in (sh_y + 3, sh_y + 6, sh_y + 9):
        draw_capsule(body, (cx - 3, ry), (cx + 4, ry), 1.2, 1.2, PAL_BONE)
    draw_capsule(body, (cx - 7, pelvis_y - 2), (cx + 7, pelvis_y - 2), 1.6, 1.6, PAL_LEATHER)

    skull_y = sh_y - 11.5
    draw_ellipse(body, cx + 0.5, skull_y, 6.4, 6.0, PAL_BONE)
    draw_ellipse(body, cx + 1.5, skull_y + 5.5, 4.0, 2.4, PAL_BONE)
    draw_polygon_shaded(
        body,
        [(cx - 12, skull_y + 9.5), (cx - 10, skull_y - 3.5), (cx - 3, skull_y - 10.5), (cx + 7, skull_y - 7.5), (cx + 8, skull_y - 1.5), (cx, skull_y - 3.5), (cx - 5, skull_y + 0.5), (cx - 6, skull_y + 11.5)],
        PAL_HOOD,
    )
    ex1, ex2 = int(round(cx - 1)), int(round(cx + 4))
    ey = int(round(skull_y - 0.5))
    if eye_mode == "x":
        draw_x_eye(body, ex1, ey, (18, 22, 18, 255))
        draw_x_eye(body, ex2, ey, (18, 22, 18, 255))
    else:
        for ex in (ex1, ex2):
            for o_y in (-1, 0, 1):
                for o_x in (-1, 0, 1):
                    body.put(ex + o_x, ey + o_y, (14, 18, 14, 255))
            body.put(ex, ey, (125, 245, 95, 255))
    body.put(int(round(cx + 2)), int(round(skull_y + 2.5)), (24, 20, 20, 255))
    for tx in (int(round(cx - 1)), int(round(cx + 1)), int(round(cx + 3))):
        body.put(tx, int(round(skull_y + 5.5)), (236, 228, 202, 255))
    body_out = add_outline(body, OUTLINE)

    # Bow + braco esquerdo puxando corda
    bow = Canvas(FW, FH)
    bend = draw_pull * 0.35
    p_top = (bow_x - 6.0 - bend, bow_y - 16.0 + bend * 0.5)
    p_mid_t = (bow_x, bow_y - 8.0)
    p_mid_b = (bow_x, bow_y + 8.0)
    p_bot = (bow_x - 6.0 - bend, bow_y + 15.0 - bend * 0.5)
    draw_capsule(bow, p_top, p_mid_t, 1.5, 1.6, PAL_BOW)
    draw_capsule(bow, p_mid_t, (bow_x + 1.0, bow_y), 1.7, 1.7, PAL_BOW)
    draw_capsule(bow, (bow_x + 1.0, bow_y), p_mid_b, 1.7, 1.6, PAL_BOW)
    draw_capsule(bow, p_mid_b, p_bot, 1.6, 1.5, PAL_BOW)

    pull_x = int(round(bow_x - 7.0 - draw_pull))
    pull_y = int(round(bow_y))
    draw_line(bow, (int(round(p_top[0])), int(round(p_top[1] + 1))), (pull_x, pull_y), (205, 200, 185, 255))
    draw_line(bow, (pull_x, pull_y), (int(round(p_bot[0])), int(round(p_bot[1] - 1))), (205, 200, 185, 255))

    if has_arrow:
        ax0 = int(round(pull_x + arrow_x_offset))
        ax1 = min(FW - 3, int(round(bow_x + 7.0 + arrow_x_offset)))
        if ax1 > ax0 + 3:
            draw_line(bow, (ax0, pull_y), (ax1, pull_y), (195, 160, 110, 255))
            bow.put(ax1, pull_y - 1, (190, 205, 220, 255))
            bow.put(min(FW - 2, ax1 + 1), pull_y, (230, 240, 250, 255))
            bow.put(ax1, pull_y + 1, (190, 205, 220, 255))
            bow.put(max(1, ax0 - 1), pull_y - 1, (210, 68, 56, 255))
            bow.put(max(1, ax0 - 1), pull_y + 1, (210, 68, 56, 255))

    # Braco esquerdo articulado do ombro -> cotovelo -> mao na corda
    l_sh = (cx - 8.0, sh_y + 1.0)
    hand_pt = (float(pull_x), float(pull_y))
    elb_pt = (lerp(l_sh[0], hand_pt[0], 0.48), max(l_sh[1], hand_pt[1]) + 2.5)
    draw_capsule(bow, l_sh, elb_pt, 1.8, 1.5, PAL_BONE)
    draw_capsule(bow, elb_pt, hand_pt, 1.6, 1.4, PAL_BONE)
    bow_out = add_outline(bow, OUTLINE)

    res = Canvas(FW, FH)
    res.composite(back_out)
    res.composite(body_out)
    res.composite(bow_out)
    return remove_isolated_pixels(res)


def build_skeleton_archer_frames() -> List[Canvas]:
    frames: List[Canvas] = []
    # 0..3 idle
    frames.append(render_archer_frame(dy=0.0, draw_pull=6.0))
    frames.append(render_archer_frame(dy=0.9, bow_dy=0.8, draw_pull=5.5))
    frames.append(render_archer_frame(dy=1.4, bow_dy=1.2, draw_pull=5.0))
    frames.append(render_archer_frame(dy=0.7, bow_dy=0.6, draw_pull=5.5))

    # 4..9 walk (pernas alternadas, capuz/aljava/arco acompanhando)
    walk_cfg = [
        (0.0, (0.45, -0.10), (-0.40, 0.25), 1.0, 0.0),
        (1.5, (0.18, 0.10), (-0.15, 0.32), 0.5, 1.0),
        (-1.5, (-0.15, 0.20), (0.18, 0.12), -0.5, -1.0),
        (0.0, (-0.40, 0.25), (0.45, -0.10), -1.0, 0.0),
        (1.5, (-0.15, 0.32), (0.18, 0.10), -0.5, 1.0),
        (-1.5, (0.18, 0.12), (-0.15, 0.20), 0.5, -1.0),
    ]
    for dy, ll, lr, bdx, bdy in walk_cfg:
        frames.append(render_archer_frame(dy=dy, leg_l=ll, leg_r=lr, bow_dx=bdx, bow_dy=bdy, draw_pull=4.5))

    # 10..15 attack (puxa corda -> solta flecha -> recua braco)
    frames.append(render_archer_frame(dx=-1.0, dy=0.5, bow_dx=0.0, bow_dy=-1.0, draw_pull=9.0))
    frames.append(render_archer_frame(dx=-2.0, dy=1.0, bow_dx=0.5, bow_dy=-1.5, draw_pull=13.0))
    frames.append(render_archer_frame(dx=1.5, dy=0.5, bow_dx=1.5, bow_dy=-1.0, draw_pull=1.0, arrow_x_offset=9.0))
    frames.append(render_archer_frame(dx=2.0, dy=0.5, bow_dx=1.5, bow_dy=-0.5, draw_pull=-2.0, arrow_x_offset=18.0))
    frames.append(render_archer_frame(dx=0.5, dy=0.5, bow_dx=0.5, bow_dy=1.0, draw_pull=1.5, has_arrow=False))
    frames.append(render_archer_frame(dx=0.0, dy=0.0, bow_dx=0.0, bow_dy=0.0, draw_pull=5.0, has_arrow=True))

    # 16..19 death (desabando e espalhando ossos/capuz/arco no chao)
    frames.append(render_archer_frame(dx=-2.0, dy=3.5, leg_l=(0.35, -0.55), leg_r=(-0.30, 0.45), bow_dy=3.0, draw_pull=2.0, has_arrow=False, eye_mode="x"))
    frames.append(render_archer_frame(dx=-1.0, dy=10.5, leg_l=(0.75, -1.20), leg_r=(-0.60, 1.00), bow_dx=2.0, bow_dy=8.0, draw_pull=0.0, has_arrow=False, eye_mode="x"))
    frames.append(render_archer_frame(dx=0.0, dy=17.5, leg_l=(1.10, -1.40), leg_r=(-0.95, 1.30), bow_dx=4.0, bow_dy=12.0, draw_pull=0.0, has_arrow=False, eye_mode="x"))
    frames.append(render_archer_frame(dead_pose=True))
    return frames


# ---------------------------------------------------------------------------
# 6. KARNAK (20 frames, 96x96, Boss Demonio com machado duplo)
# ---------------------------------------------------------------------------

KARNAK_W = 96
KARNAK_H = 96
KARNAK_FOOT_Y = 92
KARNAK_BASE_PATH = ROOT / "assets" / "sprites_src" / "monsters" / "karnak_base.png"


def _load_karnak_base() -> Canvas:
    if KARNAK_BASE_PATH.exists():
        return base.read_png(KARNAK_BASE_PATH)
    return base.build_karnak_base()


def _rotate_canvas_nn(
    src: Canvas,
    pivot_x: float,
    pivot_y: float,
    angle_rad: float,
    dst_x: float,
    dst_y: float,
    out_w: int = KARNAK_W,
    out_h: int = KARNAK_H,
) -> Canvas:
    dst = Canvas(out_w, out_h)
    ca = math.cos(-angle_rad)
    sa = math.sin(-angle_rad)
    for y in range(out_h):
        dy = y - dst_y
        for x in range(out_w):
            dx = x - dst_x
            sx = int(round(pivot_x + dx * ca - dy * sa))
            sy = int(round(pivot_y + dx * sa + dy * ca))
            if 0 <= sx < src.w and 0 <= sy < src.h:
                col = src.get(sx, sy)
                if col[3] > 0:
                    dst.put(x, y, col)
    return dst


def _boost_karnak_glow(cv: Canvas, boost: float, dim_eyes: bool = False) -> None:
    if boost == 0.0 and not dim_eyes:
        return
    for y in range(cv.h):
        for x in range(cv.w):
            r, g, b, a = cv.get(x, y)
            if a == 0:
                continue
            is_eye = (48 <= x <= 62 and 20 <= y <= 28 and r > 150 and g > 60)
            if dim_eyes and is_eye:
                cv.put(x, y, (65, 18, 18, a))
                continue
            # Runas/brasas no machado (esquerda) ou olhos
            if (x <= 34 or is_eye) and r >= 130 and r > g + 35 and r > b + 45:
                nr = int(clamp(r + 55 * boost, 0, 255))
                ng = int(clamp(g + 70 * boost, 0, 255))
                nb = int(clamp(b + 25 * boost, 0, 255))
                cv.put(x, y, (nr, ng, nb, a))


def _draw_crimson_slash(cv: Canvas, phase: float) -> None:
    """Desenha rastro de corte vermelho carmesim amplo na frente do Karnak (esquerda)."""
    cx, cy = 42.0, 52.0
    radius = 33.0
    # Sentido anti-horario: cima (-1.85) -> esquerda (-pi) -> baixo (-4.45)
    start_a = -1.85 - phase * 0.35
    end_a = -4.25 - phase * 0.25
    steps = 100
    for i in range(steps + 1):
        t = i / steps
        ang = start_a + (end_a - start_a) * t
        thickness = 4.0 * math.sin(t * math.pi) + 0.8
        px = cx + math.cos(ang) * radius
        py = cy + math.sin(ang) * radius
        for oy in range(-5, 6):
            for ox in range(-5, 6):
                d = math.hypot(ox, oy)
                if d <= thickness:
                    ix = int(round(px + ox))
                    iy = int(round(py + oy))
                    if 1 <= ix < KARNAK_W - 1 and 1 <= iy < KARNAK_H - 1:
                        if d <= thickness * 0.35 and t > 0.25:
                            col = (255, 220, 130, 255)
                        elif d <= thickness * 0.7:
                            col = (245, 72, 42, 255)
                        else:
                            col = (165, 20, 30, 255)
                        cv.put(ix, iy, col)


def _draw_raised_axe(cv: Canvas, base_cv: Canvas, dst_x: float, dst_y: float, angle_rad: float) -> None:
    """Recorta o machado duplo original do Karnak e o rotaciona erguido sobre o ombro."""
    axe_src = Canvas(KARNAK_W, KARNAK_H)
    for y in range(36, 70):
        for x in range(0, 42):
            col = base_cv.get(x, y)
            if col[3] > 0:
                axe_src.put(x, y, col)
    # Rotaciona em torno do punho do machado (x=32, y=54)
    rot_axe = _rotate_canvas_nn(axe_src, 32.0, 54.0, angle_rad, dst_x, dst_y)
    # Adiciona brilho nas runas da lamina erguida
    _boost_karnak_glow(rot_axe, 0.8)
    cv.composite(rot_axe)


def _render_karnak_posed(
    base_cv: Canvas,
    upper_dx: int = 0,
    upper_dy: int = 0,
    leg_l_dx: int = 0,
    leg_l_dy: int = 0,
    leg_r_dx: int = 0,
    leg_r_dy: int = 0,
    cape_dx: int = 0,
    cape_dy: int = 0,
    axe_dx: int = 0,
    axe_dy: int = 0,
    hide_front_axe: bool = False,
    rune_boost: float = 0.0,
) -> Canvas:
    out = Canvas(KARNAK_W, KARNAK_H)

    # 1. Capa esfarrapada (fundo direito: x >= 66, y >= 45)
    for y in range(45, 88):
        for x in range(66, KARNAK_W):
            col = base_cv.get(x, y)
            if col[3] == 0:
                continue
            nx = clamp(x + cape_dx + upper_dx, 0, KARNAK_W - 1)
            ny = clamp(y + cape_dy + upper_dy, 0, KARNAK_FOOT_Y - 1)
            out.put(nx, ny, col)

    # 2. Pernas abaixo da cintura (y >= 62), com cascos limitados a y <= 91
    for y in range(62, KARNAK_H):
        for x in range(KARNAK_W):
            if x >= 68 and y < 86:
                continue  # ja desenhado na capa
            if x < 35 and y < 68:
                continue  # lamina do machado
            col = base_cv.get(x, y)
            if col[3] == 0:
                continue
            if x < 52:
                nx = clamp(x + leg_l_dx, 0, KARNAK_W - 1)
                ny = min(KARNAK_FOOT_Y - 1, max(0, y + leg_l_dy))
            else:
                nx = clamp(x + leg_r_dx, 0, KARNAK_W - 1)
                ny = min(KARNAK_FOOT_Y - 1, max(0, y + leg_r_dy))
            out.put(nx, ny, col)

    # 3. Tronco, ombros, bracos e cabeca (y < 66)
    for y in range(0, 66):
        for x in range(KARNAK_W):
            if x >= 68 and y >= 45:
                continue  # capa
            is_axe_head = (x <= 34 and y >= 36)
            if is_axe_head:
                continue
            col = base_cv.get(x, y)
            if col[3] == 0:
                continue
            nx = clamp(x + upper_dx, 0, KARNAK_W - 1)
            ny = clamp(y + upper_dy, 0, KARNAK_FOOT_Y - 1)
            out.put(nx, ny, col)

    # Preenche eventual fenda de 1-2px na cintura quando o tronco sobe
    if upper_dy < 0:
        for y in range(61 + upper_dy, 64):
            for x in range(40, 66):
                if out.get(x, y)[3] == 0 and out.get(x, y - 1)[3] > 0 and out.get(x, y + 2)[3] > 0:
                    out.put(x, y, (34, 30, 34, 255))

    # 4. Cabeca do machado duplo (x <= 34, y >= 36)
    if not hide_front_axe:
        for y in range(36, 70):
            for x in range(0, 36):
                col = base_cv.get(x, y)
                if col[3] == 0:
                    continue
                nx = clamp(x + upper_dx + axe_dx, 0, KARNAK_W - 1)
                ny = clamp(y + upper_dy + axe_dy, 0, KARNAK_FOOT_Y - 1)
                out.put(nx, ny, col)

    _boost_karnak_glow(out, rune_boost)
    return remove_isolated_pixels(out)


def build_karnak_frames() -> List[Canvas]:
    base_cv = _load_karnak_base()
    frames: List[Canvas] = []

    # 0..3 idle (respiracao imponente, pulsar de runas e leve ondulacao da capa)
    idle_cfg = [
        (0, 0, 0, 0.0),
        (1, 1, 0, 0.45),
        (1, 1, 1, 0.90),
        (0, 0, 1, 0.40),
    ]
    for udy, cdy, cdx, glow in idle_cfg:
        frames.append(_render_karnak_posed(base_cv, upper_dy=udy, cape_dx=cdx, cape_dy=cdy, rune_boost=glow))

    # 4..9 walk (passos pesados alternando pernas/cascos, bounce vertical e balanco de machado/capa)
    walk_cfg = [
        # (udy, l_dx, l_dy, r_dx, r_dy, cdx, cdy, ady)
        (-1, -2, -3, 1, 0, 1, -1, -1),
        (0, -1, -1, 2, -1, 1, 0, 0),
        (-1, 1, 0, 0, -2, 0, -1, 1),
        (-1, 2, 0, -2, -3, -1, -1, 0),
        (0, 1, -1, -1, -1, 0, 0, -1),
        (0, 0, -2, 0, 0, 1, 0, 0),
    ]
    for udy, ldx, ldy, rdx, rdy, cdx, cdy, ady in walk_cfg:
        frames.append(
            _render_karnak_posed(
                base_cv,
                upper_dy=udy,
                leg_l_dx=ldx,
                leg_l_dy=ldy,
                leg_r_dx=rdx,
                leg_r_dy=rdy,
                cape_dx=cdx,
                cape_dy=cdy,
                axe_dy=ady,
                rune_boost=0.25,
            )
        )

    # 10..15 attack (antecipacao erguendo machado -> golpe descendente com rastro carmesim -> retorno)
    # 10: inicio da antecipacao
    f10 = _render_karnak_posed(base_cv, upper_dx=3, upper_dy=-1, leg_l_dx=2, leg_r_dx=3, cape_dx=2, hide_front_axe=True, rune_boost=0.7)
    _draw_raised_axe(f10, base_cv, 58.0, 32.0, 1.35)
    frames.append(remove_isolated_pixels(f10))

    # 11: pico da antecipacao (machado erguido atras)
    f11 = _render_karnak_posed(base_cv, upper_dx=5, upper_dy=-2, leg_l_dx=3, leg_r_dx=4, cape_dx=3, cape_dy=-1, hide_front_axe=True, rune_boost=1.0)
    _draw_raised_axe(f11, base_cv, 62.0, 26.0, 1.85)
    frames.append(remove_isolated_pixels(f11))

    # 12: golpe amplo descendente com rastro vermelho carmesim
    f12 = _render_karnak_posed(base_cv, upper_dx=-4, upper_dy=1, leg_l_dx=-4, leg_r_dx=-2, cape_dx=-2, axe_dx=-2, axe_dy=5, rune_boost=1.0)
    _draw_crimson_slash(f12, phase=0.0)
    frames.append(remove_isolated_pixels(f12))

    # 13: impacto baixo do golpe com rastro carmesim estendido
    f13 = _render_karnak_posed(base_cv, upper_dx=-6, upper_dy=2, leg_l_dx=-5, leg_r_dx=-3, cape_dx=-3, axe_dx=-3, axe_dy=9, rune_boost=1.0)
    _draw_crimson_slash(f13, phase=0.65)
    frames.append(remove_isolated_pixels(f13))

    # 14: follow-through
    frames.append(_render_karnak_posed(base_cv, upper_dx=-3, upper_dy=1, leg_l_dx=-2, leg_r_dx=-1, axe_dx=-1, axe_dy=4, rune_boost=0.5))

    # 15: retorno a guarda
    frames.append(_render_karnak_posed(base_cv, upper_dx=-1, upper_dy=0, leg_l_dx=-1, rune_boost=0.2))

    # 16..19 death (recuo -> joelhos cedendo -> tombando -> caido no chao com machado)
    # 16: recuo
    f16 = _render_karnak_posed(base_cv, upper_dx=3, upper_dy=2, leg_l_dx=1, leg_r_dx=2, cape_dx=2)
    _boost_karnak_glow(f16, 0.0, dim_eyes=True)
    frames.append(f16)

    # 17: joelhos cedendo
    f17 = _render_karnak_posed(base_cv, upper_dx=4, upper_dy=10, leg_l_dx=-1, leg_l_dy=8, leg_r_dx=3, leg_r_dy=8, axe_dy=12, cape_dy=8)
    _boost_karnak_glow(f17, 0.0, dim_eyes=True)
    frames.append(f17)

    # 18: tombando para tras
    f18 = _rotate_canvas_nn(base_cv, 52.0, 70.0, 0.80, 44.0, 74.0)
    _boost_karnak_glow(f18, 0.0, dim_eyes=True)
    frames.append(remove_isolated_pixels(f18))

    # 19: caido no chao (100% dentro de 96x96, ate y=91)
    f19 = _rotate_canvas_nn(base_cv, 52.0, 56.0, 1.48, 36.0, 70.0)
    _boost_karnak_glow(f19, 0.0, dim_eyes=True)
    frames.append(remove_isolated_pixels(f19))

    return frames


# ---------------------------------------------------------------------------
# 7. SKELETON CHIEF (20 frames, 80x80, Boss Esqueleto Chefe)
# ---------------------------------------------------------------------------

CHIEF_W = FW  # 80
CHIEF_H = FH  # 80
CHIEF_FOOT_Y = FOOT_Y  # 76
SKELETON_CHIEF_TURNAROUND_PATH = ROOT / "assets" / "sprites_src" / "monsters" / "skeleton_chief_turnaround.png"
SKELETON_CHIEF_BASE_PATH = ROOT / "assets" / "sprites_src" / "monsters" / "skeleton_chief_base.png"
PREVIEW_SKELETON_CHIEF_PATH = ROOT / "assets" / "mockups" / "preview_skeleton_chief_20f.png"


def _ensure_skeleton_chief_base() -> Canvas:
    """Extrai a pose 1 (3/4 direita) do turnaround e escala com NEAREST para 80x80."""
    if SKELETON_CHIEF_BASE_PATH.exists():
        return base.read_png(SKELETON_CHIEF_BASE_PATH)
    src = base.read_png(SKELETON_CHIEF_TURNAROUND_PATH)
    pose = Canvas(64, 64)
    for y in range(64):
        for x in range(64):
            pose.put(x, y, src.get(64 + x, y))
    xs = [x for y in range(64) for x in range(64) if pose.get(x, y)[3] > 0]
    ys = [y for y in range(64) for x in range(64) if pose.get(x, y)[3] > 0]
    min_x, max_x, min_y, max_y = min(xs), max(xs), min(ys), max(ys)
    sw, sh = max_x - min_x + 1, max_y - min_y + 1
    target_h = 72
    scale = target_h / sh
    target_w = int(round(sw * scale))
    dst_x0 = 40 - target_w // 2
    dst_y0 = CHIEF_FOOT_Y - target_h + 1
    out = Canvas(CHIEF_W, CHIEF_H)
    for dy in range(target_h):
        sy = min_y + int(dy / scale)
        for dx in range(target_w):
            sx = min_x + int(dx / scale)
            col = pose.get(sx, sy)
            if col[3] > 0:
                out.put(dst_x0 + dx, dst_y0 + dy, col)
    write_png(SKELETON_CHIEF_BASE_PATH, out)
    return out


def _boost_chief_eyes(cv: Canvas, boost: float, dim_eyes: bool = False) -> None:
    if boost == 0.0 and not dim_eyes:
        return
    for y in range(14, 30):
        for x in range(32, 52):
            r, g, b, a = cv.get(x, y)
            if a == 0:
                continue
            if r >= 140 and r > g + 40 and r > b + 40:
                if dim_eyes:
                    cv.put(x, y, (65, 16, 16, a))
                else:
                    nr = int(clamp(r + 50 * boost, 0, 255))
                    ng = int(clamp(g + 60 * boost, 0, 255))
                    nb = int(clamp(b + 20 * boost, 0, 255))
                    cv.put(x, y, (nr, ng, nb, a))


def _is_chief_sword_region(x: int, y: int) -> bool:
    """Regiao da mao direita + espada dentada (frente-esquerda no frame base 80x80)."""
    if 15 <= x <= 29 and 42 <= y <= 55:
        return True
    if 16 <= x <= 28 and 56 <= y <= 73:
        # Evita pegar a perna direita (x >= 28 nessa altura)
        return x <= 27 or y <= 63
    return False


def _is_chief_shield_region(x: int, y: int) -> bool:
    """Regiao do braco esquerdo + escudo redondo (direita no frame base 80x80)."""
    return x >= 47 and 28 <= y <= 55


def _render_chief_posed(
    base_cv: Canvas,
    upper_dx: int = 0,
    upper_dy: int = 0,
    leg_l_dx: int = 0,
    leg_l_dy: int = 0,
    leg_r_dx: int = 0,
    leg_r_dy: int = 0,
    sword_dx: int = 0,
    sword_dy: int = 0,
    shield_dx: int = 0,
    shield_dy: int = 0,
    hide_sword: bool = False,
    eye_boost: float = 0.0,
    dim_eyes: bool = False,
) -> Canvas:
    out = Canvas(CHIEF_W, CHIEF_H)

    # 1. Escudo redondo ao fundo (atras do tronco)
    for y in range(28, 56):
        for x in range(47, CHIEF_W):
            col = base_cv.get(x, y)
            if col[3] == 0:
                continue
            nx = clamp(x + upper_dx + shield_dx, 0, CHIEF_W - 1)
            ny = clamp(y + upper_dy + shield_dy, 0, CHIEF_FOOT_Y)
            out.put(nx, ny, col)

    # 2. Pernas abaixo da cintura (y >= 54), pes limitados a y <= 76
    for y in range(54, CHIEF_H):
        for x in range(CHIEF_W):
            if _is_chief_sword_region(x, y):
                continue
            if _is_chief_shield_region(x, y):
                continue
            col = base_cv.get(x, y)
            if col[3] == 0:
                continue
            if x < 37:
                nx = clamp(x + leg_l_dx, 0, CHIEF_W - 1)
                ny = min(CHIEF_FOOT_Y, max(0, y + leg_l_dy))
            else:
                nx = clamp(x + leg_r_dx, 0, CHIEF_W - 1)
                ny = min(CHIEF_FOOT_Y, max(0, y + leg_r_dy))
            out.put(nx, ny, col)

    # 3. Tronco, saiote, costelas e cabeca/elmo (y < 58)
    for y in range(0, 58):
        for x in range(CHIEF_W):
            if _is_chief_shield_region(x, y):
                continue
            if _is_chief_sword_region(x, y):
                continue
            col = base_cv.get(x, y)
            if col[3] == 0:
                continue
            nx = clamp(x + upper_dx, 0, CHIEF_W - 1)
            ny = clamp(y + upper_dy, 0, CHIEF_FOOT_Y)
            out.put(nx, ny, col)

    # Preenche eventual fenda de 1-2px na cintura quando o tronco sobe
    if upper_dy < 0:
        for y in range(52 + upper_dy, 57):
            for x in range(25, 48):
                if (
                    0 < y < CHIEF_H - 2
                    and out.get(x, y)[3] == 0
                    and out.get(x, y - 1)[3] > 0
                    and out.get(x, y + 2)[3] > 0
                ):
                    out.put(x, y, (98, 28, 22, 255))

    # 4. Mao direita + espada dentada (camada frontal)
    if not hide_sword:
        for y in range(42, 74):
            for x in range(15, 30):
                if not _is_chief_sword_region(x, y):
                    continue
                col = base_cv.get(x, y)
                if col[3] == 0:
                    continue
                nx = clamp(x + upper_dx + sword_dx, 0, CHIEF_W - 1)
                ny = clamp(y + upper_dy + sword_dy, 0, CHIEF_FOOT_Y)
                out.put(nx, ny, col)

    _boost_chief_eyes(out, eye_boost, dim_eyes=dim_eyes)
    return remove_isolated_pixels(out)


def _draw_chief_sword_rotated(
    cv: Canvas,
    base_cv: Canvas,
    dst_x: float,
    dst_y: float,
    angle_rad: float,
) -> None:
    """Recorta a espada dentada do base_cv e rotaciona em torno do punho (x=22, y=49)."""
    sword_src = Canvas(CHIEF_W, CHIEF_H)
    for y in range(42, 74):
        for x in range(15, 30):
            if _is_chief_sword_region(x, y):
                col = base_cv.get(x, y)
                if col[3] > 0:
                    sword_src.put(x, y, col)
    rot_sw = _rotate_canvas_nn(sword_src, 22.0, 49.0, angle_rad, dst_x, dst_y, CHIEF_W, CHIEF_H)
    cv.composite(rot_sw)


def _draw_chief_slash_arc(cv: Canvas, phase: float) -> None:
    """Desenha rastro amplo de corte da lamina para frente-direita (x=44, y=46)."""
    cx, cy = 42.0, 46.0
    radius = 27.0
    # Sentido horario: cima (-1.25) -> frente-direita (0.0) -> baixo (1.05)
    start_a = -1.25 + phase * 0.35
    end_a = 1.05 + phase * 0.25
    steps = 80
    for i in range(steps + 1):
        t = i / steps
        ang = start_a + (end_a - start_a) * t
        thickness = 3.2 * math.sin(t * math.pi) + 0.6
        px = cx + math.cos(ang) * radius
        py = cy + math.sin(ang) * radius
        for oy in range(-4, 5):
            for ox in range(-4, 5):
                d = math.hypot(ox, oy)
                if d <= thickness:
                    ix = int(round(px + ox))
                    iy = int(round(py + oy))
                    if 1 <= ix < CHIEF_W - 1 and 1 <= iy < CHIEF_H - 1:
                        if d <= thickness * 0.35 and t > 0.25:
                            col = (245, 250, 255, 255)
                        elif d <= thickness * 0.72:
                            col = (195, 220, 240, 255)
                        else:
                            col = (110, 140, 175, 255)
                        cv.put(ix, iy, col)


def build_skeleton_chief_frames() -> List[Canvas]:
    base_cv = _ensure_skeleton_chief_base()
    frames: List[Canvas] = []

    # 0..3 idle (guarda firme com respiracao e pulso nos olhos)
    idle_cfg = [
        (0, 0, 0, 0.0),
        (1, 1, 0, 0.35),
        (1, 1, 1, 0.75),
        (0, 0, 1, 0.35),
    ]
    for udy, sw_dy, sh_dy, boost in idle_cfg:
        frames.append(
            _render_chief_posed(
                base_cv,
                upper_dy=udy,
                sword_dy=sw_dy,
                shield_dy=sh_dy,
                eye_boost=boost,
            )
        )

    # 4..9 walk (ciclo de passos com oscilacao vertical e balanco de espada/escudo)
    walk_cfg = [
        # (udx, udy, l_dx, l_dy, r_dx, r_dy, sw_dx, sw_dy, sh_dx, sh_dy)
        (1, -1, 2, -2, -1, 0, -1, -1, 1, 0),
        (0, 0, 1, -1, -2, -1, 0, 0, 1, 1),
        (0, -1, -1, 0, 1, -2, 1, -1, 0, 0),
        (1, -1, -2, 0, 2, -2, 2, -1, -1, 0),
        (0, 0, -1, -1, 1, -1, 1, 0, 0, 1),
        (0, -1, 0, -2, 0, 0, 0, -1, 1, 0),
    ]
    for udx, udy, ldx, ldy, rdx, rdy, swdx, swdy, shdx, shdy in walk_cfg:
        frames.append(
            _render_chief_posed(
                base_cv,
                upper_dx=udx,
                upper_dy=udy,
                leg_l_dx=ldx,
                leg_l_dy=ldy,
                leg_r_dx=rdx,
                leg_r_dy=rdy,
                sword_dx=swdx,
                sword_dy=swdy,
                shield_dx=shdx,
                shield_dy=shdy,
                eye_boost=0.25,
            )
        )

    # 10..15 attack (antecipacao erguendo espada -> corte amplo para frente -> retorno)
    # 10: inicio da antecipacao
    f10 = _render_chief_posed(
        base_cv, upper_dx=-2, upper_dy=-1, leg_l_dx=-1, leg_r_dx=-2, shield_dx=1, hide_sword=True, eye_boost=0.6
    )
    _draw_chief_sword_rotated(f10, base_cv, 17.0, 38.0, -2.15)
    frames.append(remove_isolated_pixels(f10))

    # 11: pico da antecipacao (espada erguida acima do ombro, sem cobrir o rosto)
    f11 = _render_chief_posed(
        base_cv, upper_dx=-3, upper_dy=-2, leg_l_dx=-2, leg_r_dx=-3, shield_dx=2, shield_dy=-1, hide_sword=True, eye_boost=1.0
    )
    _draw_chief_sword_rotated(f11, base_cv, 16.0, 29.0, -2.75)
    frames.append(remove_isolated_pixels(f11))

    # 12: corte amplo para frente com rastro de lamina
    f12 = _render_chief_posed(
        base_cv, upper_dx=4, upper_dy=1, leg_l_dx=3, leg_r_dx=2, shield_dx=-2, hide_sword=True, eye_boost=1.0
    )
    _draw_chief_sword_rotated(f12, base_cv, 44.0, 43.0, -1.25)
    _draw_chief_slash_arc(f12, phase=0.0)
    frames.append(remove_isolated_pixels(f12))

    # 13: extensao maxima do corte
    f13 = _render_chief_posed(
        base_cv, upper_dx=5, upper_dy=2, leg_l_dx=4, leg_r_dx=2, shield_dx=-3, hide_sword=True, eye_boost=0.85
    )
    _draw_chief_sword_rotated(f13, base_cv, 45.0, 50.0, -0.75)
    _draw_chief_slash_arc(f13, phase=0.55)
    frames.append(remove_isolated_pixels(f13))

    # 14: follow-through
    f14 = _render_chief_posed(
        base_cv, upper_dx=3, upper_dy=1, leg_l_dx=2, leg_r_dx=1, shield_dx=-1, sword_dx=3, sword_dy=1, eye_boost=0.45
    )
    frames.append(f14)

    # 15: retorno a guarda
    f15 = _render_chief_posed(
        base_cv, upper_dx=1, upper_dy=0, leg_l_dx=1, sword_dx=1, eye_boost=0.2
    )
    frames.append(f15)

    # 16..19 death (recuo -> joelhos cedendo -> tombando -> desabado no chao)
    # 16: recuo
    frames.append(
        _render_chief_posed(
            base_cv, upper_dx=-2, upper_dy=2, leg_l_dx=-1, leg_r_dx=-1, shield_dx=-1, dim_eyes=True
        )
    )

    # 17: joelhos cedendo (espada e escudo descem junto com upper_dy=8)
    frames.append(
        _render_chief_posed(
            base_cv,
            upper_dx=-2,
            upper_dy=8,
            leg_l_dx=-2,
            leg_l_dy=5,
            leg_r_dx=2,
            leg_r_dy=5,
            sword_dy=0,
            shield_dy=0,
            dim_eyes=True,
        )
    )

    # 18: tombando para tras
    f18 = _rotate_canvas_nn(base_cv, 40.0, 60.0, -0.78, 36.0, 58.0, CHIEF_W, CHIEF_H)
    _boost_chief_eyes(f18, 0.0, dim_eyes=True)
    frames.append(remove_isolated_pixels(f18))

    # 19: desabado no chao (100% dentro de 80x80, ate y=76)
    f19 = _rotate_canvas_nn(base_cv, 40.0, 50.0, -1.48, 38.0, 60.0, CHIEF_W, CHIEF_H)
    _boost_chief_eyes(f19, 0.0, dim_eyes=True)
    frames.append(remove_isolated_pixels(f19))

    return frames


# ---------------------------------------------------------------------------
# Montagem dos Spritesheets, Preview 20f e Manifest
# ---------------------------------------------------------------------------

def assemble_strip(frames: Sequence[Canvas], fw: int = FW, fh: int = FH) -> Canvas:
    sheet = Canvas(fw * len(frames), fh)
    for i, fr in enumerate(frames):
        sheet.composite(fr, dx=i * fw, dy=0)
    return sheet


def build_preview_grid(
    all_monsters: Sequence[Tuple[str, Sequence[Canvas], int, int, int]],
    scale: int = 2,
    title: str = "SUBMUNDO BOSSES AND RESIZE 20F",
) -> Canvas:
    base.FONT_3X5.update({
        "0": ("111", "101", "101", "101", "111"),
        "1": ("010", "110", "010", "010", "111"),
        "2": ("111", "001", "111", "100", "111"),
        "3": ("111", "001", "111", "001", "111"),
        "4": ("101", "101", "111", "001", "001"),
        "6": ("111", "100", "111", "101", "111"),
        "7": ("111", "001", "001", "010", "010"),
        "8": ("111", "101", "111", "101", "111"),
        "9": ("111", "101", "111", "001", "111"),
        "-": ("000", "000", "111", "000", "000"),
    })
    cols = NUM_FRAMES
    max_fw = max(fw for _, _, fw, _, _ in all_monsters)
    cell_w = max_fw * scale
    label_w = 180
    pad_x = 12
    pad_y = 26
    header_h = 44

    total_w = label_w + cols * cell_w + pad_x * 2
    total_h = header_h + sum(fh * scale + pad_y for _, _, _, fh, _ in all_monsters) + 16
    grid = Canvas(total_w, total_h, (20, 22, 30, 255))

    draw_text(grid, pad_x, 10, title, (235, 225, 195, 255), scale=2)
    sections = [
        (0, "IDLE 0-3", (120, 210, 240, 255)),
        (4, "WALK 4-9", (140, 230, 150, 255)),
        (10, "ATTACK 10-15", (245, 165, 95, 255)),
        (16, "DEATH 16-19", (230, 110, 120, 255)),
    ]
    for fidx, sec_title, col in sections:
        draw_text(grid, label_w + fidx * cell_w + 4, 28, sec_title, col, scale=2)

    y_cursor = header_h
    for name, frames, fw, fh, foot_y in all_monsters:
        row_cell_w = fw * scale
        row_cell_h = fh * scale
        draw_text(grid, pad_x, y_cursor + row_cell_h // 2 - 6, name.upper(), (220, 230, 245, 255), scale=2)

        for c, fr in enumerate(frames):
            bx0 = label_w + c * cell_w
            by0 = y_cursor
            for py in range(row_cell_h):
                for px in range(row_cell_w):
                    checker = ((px // (8 * scale)) + (py // (8 * scale))) % 2 == 0
                    bg = (50, 54, 64, 255) if checker else (40, 44, 54, 255)
                    grid.put(bx0 + px, by0 + py, bg)

            gy = by0 + foot_y * scale
            for px in range(row_cell_w):
                grid.put(bx0 + px, gy, (95, 155, 105, 255))

            if c in (4, 10, 16):
                for py in range(row_cell_h):
                    grid.put(bx0, by0 + py, (200, 180, 120, 255))

            for sy in range(fh):
                for sx in range(fw):
                    col = fr.get(sx, sy)
                    if col[3] == 0:
                        continue
                    for dy in range(scale):
                        for dx in range(scale):
                            grid.blend_pixel(bx0 + sx * scale + dx, by0 + sy * scale + dy, col)

        y_cursor += row_cell_h + pad_y

    return grid


def update_manifest(entries: Sequence[Tuple[str, int, int]]) -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    sprites = manifest.setdefault("sprites", {})
    for key, fw, fh in entries:
        sprites[key] = {
            "key": key,
            "file": f"{key}.png",
            "width": fw * NUM_FRAMES,
            "height": fh,
            "frameWidth": fw,
            "frameHeight": fh,
            "frames": list(FRAME_NAMES),
        }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


PREVIEW_BOSSES_PATH = ROOT / "assets" / "mockups" / "preview_bosses_20f.png"


def main() -> None:
    OUT_SPRITES_DIR.mkdir(parents=True, exist_ok=True)
    builders = [
        ("slime", build_slime_frames, FW, FH, FOOT_Y),
        ("cave_bat", build_cave_bat_frames, FW, FH, FOOT_Y),
        ("wolf_alpha", build_wolf_alpha_frames, FW, FH, FOOT_Y),
        ("karnak", build_karnak_frames, KARNAK_W, KARNAK_H, KARNAK_FOOT_Y),
        ("skeleton_chief", build_skeleton_chief_frames, CHIEF_W, CHIEF_H, CHIEF_FOOT_Y),
    ]

    preview_rows: List[Tuple[str, List[Canvas], int, int, int]] = []
    manifest_entries: List[Tuple[str, int, int]] = []
    chief_row: List[Tuple[str, List[Canvas], int, int, int]] = []
    for key, fn, fw, fh, foot_y in builders:
        frames = fn()
        assert len(frames) == NUM_FRAMES, f"{key}: esperado {NUM_FRAMES} frames, obteve {len(frames)}"
        sheet = assemble_strip(frames, fw=fw, fh=fh)
        out_path = OUT_SPRITES_DIR / f"{key}.png"
        write_png(out_path, sheet)
        print(f"Gerado: {out_path} ({sheet.w}x{sheet.h}, {len(frames)} frames {fw}x{fh})")
        row = (key, frames, fw, fh, foot_y)
        if key == "skeleton_chief":
            chief_row.append(row)
        else:
            preview_rows.append(row)
        manifest_entries.append((key, fw, fh))

    update_manifest(manifest_entries)
    print(f"Atualizado: {MANIFEST_PATH}")

    preview = build_preview_grid(preview_rows, scale=2, title="SUBMUNDO BOSSES AND RESIZE 20F")
    write_png(PREVIEW_BOSSES_PATH, preview)
    print(f"Preview: {PREVIEW_BOSSES_PATH} ({preview.w}x{preview.h})")

    if chief_row:
        chief_preview = build_preview_grid(chief_row, scale=2, title="SKELETON CHIEF 20F")
        write_png(PREVIEW_SKELETON_CHIEF_PATH, chief_preview)
        print(f"Preview: {PREVIEW_SKELETON_CHIEF_PATH} ({chief_preview.w}x{chief_preview.h})")


if __name__ == "__main__":
    main()
