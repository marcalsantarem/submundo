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
    droplets: Sequence[Tuple[float, float, float, float]] = ((17.5, 73.5, 2.8, 2.0),),
    trail_drops: Sequence[Tuple[float, float, float, float]] = (),
    alpha_fade: float = 1.0,
) -> Canvas:
    body = Canvas(FW, FH)
    iy_top = max(2, int(math.floor(top_y)))
    iy_base = min(FH - 2, int(math.ceil(base_y)))
    h_span = max(3.0, base_y - top_y)

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
                if py >= wave_y - 2.0:
                    col = PAL_SLIME[0]
                elif py >= wave_y - 5.0 and shade < 0.05:
                    col = PAL_SLIME[1]
                else:
                    col = pick_tone(shade, PAL_SLIME)
                body.put(px, py, rgba(col))

    for dx, dy, rx, ry in droplets:
        draw_ellipse(body, dx, dy, rx, ry, PAL_SLIME)
    for dx, dy, rx, ry in trail_drops:
        draw_ellipse(body, dx, dy, rx, ry, PAL_SLIME)

    # Reflexos especulares proporcionais ao domo
    spec_hi = (210, 255, 195, 255)
    spec_bright = (255, 255, 255, 255)
    if h_span >= 12.0:
        sx0 = int(round(cx + tilt_x * 0.8 - half_w * 0.45))
        sy0 = int(round(top_y + h_span * 0.12))
        for ox, oy in ((0, 0), (1, -1), (2, -1), (3, -1), (4, 0), (-2, 2), (-1, 1), (0, 1)):
            body.put(sx0 + ox, sy0 + oy, spec_hi)
        for ox, oy in ((1, 0), (2, 0), (3, 0)):
            body.put(sx0 + ox, sy0 + oy, spec_bright)
    else:
        sx0 = int(round(cx - half_w * 0.35))
        sy0 = int(round(top_y + 1))
        for ox in range(4):
            body.put(sx0 + ox, sy0, spec_hi)

    # Bolhas internas
    if h_span >= 16.0:
        bx1 = int(round(cx - half_w * 0.55))
        bx2 = int(round(cx + half_w * 0.50))
        by = int(round(top_y + h_span * 0.58))
        for bx in (bx1, bx2):
            body.put(bx, by, rgba(PAL_SLIME[3]))
            body.put(bx + 1, by, rgba(PAL_SLIME[3]))
            body.put(bx, by + 1, rgba(PAL_SLIME[2]))

    # Rosto
    eye_dark = (10, 22, 12, 255)
    if eye_mode != "none":
        ex_l = int(round(cx - 4 + face_dx + tilt_x * 0.4))
        ex_r = int(round(cx + 7 + face_dx + tilt_x * 0.4))
        ey = int(round(top_y + h_span * 0.46 + face_dy))
        if eye_mode == "normal":
            for ex in (ex_l, ex_r):
                for dy in range(-2, 3):
                    for dx in range(-1, 2):
                        if abs(dx) + abs(dy) <= 2:
                            body.put(ex + dx, ey + dy, eye_dark)
                body.put(ex - 1, ey - 1, spec_bright)
        elif eye_mode == "angry":
            for ex in (ex_l, ex_r):
                for dy in range(-1, 2):
                    for dx in range(-1, 2):
                        body.put(ex + dx, ey + dy, eye_dark)
                body.put(ex, ey - 1, (255, 220, 120, 255))
        elif eye_mode == "x":
            draw_x_eye(body, ex_l, ey, eye_dark)
            draw_x_eye(body, ex_r, ey, eye_dark)

        my = ey + 7
        mx0 = int(round(cx - 2 + face_dx + tilt_x * 0.4))
        if mouth_mode == "frown":
            for i, oy in enumerate((1, 0, -1, -1, -1, -1, 0, 1)):
                body.put(mx0 + i, my + oy, eye_dark)
        elif mouth_mode == "open":
            for dy in range(-1, 2):
                for dx in range(0, 7):
                    body.put(mx0 + dx, my + dy, eye_dark)
            body.put(mx0 + 1, my - 1, (220, 255, 210, 255))
            body.put(mx0 + 5, my - 1, (220, 255, 210, 255))

    out = remove_isolated_pixels(add_outline(body, OUTLINE))
    if alpha_fade < 1.0:
        for i in range(0, len(out.buf), 4):
            if out.buf[i + 3] > 0:
                out.buf[i + 3] = int(out.buf[i + 3] * alpha_fade)
    return out


def build_slime_frames() -> List[Canvas]:
    frames: List[Canvas] = []
    # 0..3 idle (respiracao gelatinosa, base fixa em y=76)
    idle_params = [
        (40.0, 76.0, 43.0, 22.0, 0.0, 0.0),
        (40.0, 76.0, 45.0, 23.5, 0.0, 0.5),
        (40.0, 76.0, 41.0, 20.5, 0.0, -0.5),
        (40.0, 76.0, 44.0, 22.8, 0.0, 0.0),
    ]
    for cx, by, ty, hw, tx, fdy in idle_params:
        frames.append(render_slime_frame(cx, by, ty, hw, tilt_x=tx, face_dy=fdy))

    # 4..9 walk (compressao -> impulso -> salto em arco -> descida -> pouso -> rebote)
    walk_params = [
        (39.0, 76.0, 50.0, 25.0, -1.5, 1.0, ((15.5, 73.5, 2.8, 1.8),), ()),
        (40.0, 68.0, 32.0, 17.5, 2.5, -1.0, (), ((24.0, 72.0, 2.0, 1.5), (34.0, 74.0, 2.4, 1.4))),
        (41.0, 60.0, 28.0, 19.5, 3.0, -1.5, (), ((22.0, 66.0, 2.0, 1.4), (32.0, 69.0, 1.8, 1.3))),
        (41.0, 69.0, 36.0, 18.5, 2.0, 0.5, (), ((26.0, 73.0, 1.8, 1.2),)),
        (40.0, 76.0, 52.0, 26.5, 1.0, 1.5, ((13.5, 73.5, 2.6, 1.6), (65.0, 73.5, 2.2, 1.5)), ()),
        (40.0, 76.0, 42.0, 21.0, 0.0, -0.5, ((18.0, 73.5, 2.5, 1.8),), ()),
    ]
    for cx, by, ty, hw, tx, fdy, dr, tr in walk_params:
        frames.append(render_slime_frame(cx, by, ty, hw, tilt_x=tx, face_dy=fdy, droplets=dr, trail_drops=tr))

    # 10..15 attack (encolhe atras -> projecao frontal em golpe gelatinoso)
    attack_params = [
        (35.0, 76.0, 47.0, 21.0, -3.5, 1.0, "angry", "frown", ((14.0, 73.5, 2.6, 1.8),), ()),
        (32.0, 76.0, 50.0, 23.0, -5.0, 1.5, "angry", "frown", ((11.0, 73.5, 2.6, 1.8),), ()),
        (47.0, 73.0, 40.0, 23.5, 7.0, -0.5, "angry", "open", (), ((21.0, 72.0, 2.5, 1.5), (27.0, 74.0, 2.0, 1.2))),
        (52.0, 75.0, 42.0, 24.5, 8.5, 0.0, "angry", "open", ((69.0, 72.5, 2.4, 1.6),), ((24.0, 74.0, 2.8, 1.5),)),
        (45.0, 76.0, 47.0, 23.5, 3.0, 0.5, "normal", "frown", ((19.0, 73.5, 2.6, 1.8),), ()),
        (41.0, 76.0, 44.0, 22.0, 0.5, 0.0, "normal", "frown", ((17.5, 73.5, 2.8, 2.0),), ()),
    ]
    for cx, by, ty, hw, tx, fdy, em, mm, dr, tr in attack_params:
        frames.append(
            render_slime_frame(
                cx, by, ty, hw, tilt_x=tx, face_dx=2.0, face_dy=fdy,
                eye_mode=em, mouth_mode=mm, droplets=dr, trail_drops=tr
            )
        )

    # 16..19 death (achatamento progressivo ate virar poca verde no chao)
    death_params = [
        (40.0, 76.0, 50.0, 24.0, -2.0, "x", "open", ((15.0, 73.5, 2.8, 1.8),), 1.0),
        (40.0, 76.0, 59.0, 28.0, 0.0, "x", "none", ((12.0, 73.5, 2.6, 1.6), (67.0, 73.5, 2.2, 1.5)), 1.0),
        (40.0, 76.0, 67.0, 31.0, 0.0, "none", "none", ((9.0, 74.0, 2.4, 1.4), (70.0, 74.0, 2.0, 1.3)), 0.92),
        (40.0, 76.0, 71.5, 33.0, 0.0, "none", "none", ((7.0, 74.5, 2.2, 1.2), (72.0, 74.5, 1.8, 1.1)), 0.85),
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
    # Ombros das asas
    ls = (cx - 6.0, cy - 1.0)
    rs = (cx + 6.0, cy - 1.0)

    if dead_pose:
        # Asas fechadas/caidas sobre o chao
        l_pts = [(cx - 5, cy - 2), (cx - 18, cy + 2), (cx - 22, cy + 8), (cx - 8, cy + 8)]
        r_pts = [(cx + 5, cy - 2), (cx + 18, cy + 2), (cx + 22, cy + 8), (cx + 8, cy + 8)]
        draw_polygon_shaded(wings, l_pts, PAL_BAT_MEMB)
        draw_polygon_shaded(wings, r_pts, dim_palette(PAL_BAT_MEMB, 0.85))
        draw_capsule(wings, (cx - 5, cy - 2), (cx - 18, cy + 2), 1.6, 1.1, PAL_BAT_BONE)
        draw_capsule(wings, (cx + 5, cy - 2), (cx + 18, cy + 2), 1.6, 1.1, dim_palette(PAL_BAT_BONE, 0.88))
    else:
        # Asa esquerda (frente 3/4)
        l_elbow = (
            cx - (16.0 * wing_span - 5.0 * wing_fold),
            cy - 12.0 + wing_tip_dy * 0.72,
        )
        l_tip = (
            cx - (29.0 * wing_span - 11.0 * wing_fold),
            cy - 16.0 + wing_tip_dy,
        )
        l_bot1 = (l_tip[0] + 4.0, l_tip[1] + 13.0 - wing_tip_dy * 0.15)
        l_bot2 = (l_elbow[0] - 1.0, l_elbow[1] + 19.0 - wing_tip_dy * 0.15)
        l_pts = [
            ls, l_elbow, l_tip,
            (l_tip[0] - 2.0, l_tip[1] + 8.0),
            l_bot1,
            (l_bot1[0] + 5.0, l_bot1[1] - 4.0),
            l_bot2,
            (l_bot2[0] + 5.0, l_bot2[1] - 4.0),
            (ls[0], ls[1] + 9.0),
        ]
        draw_polygon_shaded(wings, l_pts, PAL_BAT_MEMB)

        # Asa direita (atras)
        r_elbow = (
            cx + (15.5 * wing_span - 6.0 * wing_fold),
            cy - 13.0 + wing_tip_dy * 0.72,
        )
        r_tip = (
            cx + (27.5 * wing_span - 12.0 * wing_fold),
            cy - 16.0 + wing_tip_dy,
        )
        r_bot1 = (r_tip[0] - 4.0, r_tip[1] + 13.0 - wing_tip_dy * 0.15)
        r_bot2 = (r_elbow[0] + 1.0, r_elbow[1] + 19.0 - wing_tip_dy * 0.15)
        r_pts = [
            rs, r_elbow, r_tip,
            (r_tip[0] + 2.0, r_tip[1] + 8.0),
            r_bot1,
            (r_bot1[0] - 5.0, r_bot1[1] - 4.0),
            r_bot2,
            (r_bot2[0] - 5.0, r_bot2[1] - 4.0),
            (rs[0], rs[1] + 9.0),
        ]
        draw_polygon_shaded(wings, r_pts, dim_palette(PAL_BAT_MEMB, 0.85))

        # Ossos das asas
        draw_capsule(wings, ls, l_elbow, 1.9, 1.4, PAL_BAT_BONE)
        draw_capsule(wings, l_elbow, l_tip, 1.4, 1.0, PAL_BAT_BONE)
        draw_capsule(wings, l_elbow, l_bot1, 1.1, 0.75, PAL_BAT_BONE)
        draw_capsule(wings, l_elbow, l_bot2, 1.1, 0.75, PAL_BAT_BONE)

        bone_r = dim_palette(PAL_BAT_BONE, 0.88)
        draw_capsule(wings, rs, r_elbow, 1.9, 1.4, bone_r)
        draw_capsule(wings, r_elbow, r_tip, 1.4, 1.0, bone_r)
        draw_capsule(wings, r_elbow, r_bot1, 1.1, 0.75, bone_r)
        draw_capsule(wings, r_elbow, r_bot2, 1.1, 0.75, bone_r)

        claw = (218, 212, 198, 255)
        wings.put(int(round(l_elbow[0])), int(round(l_elbow[1] - 2)), claw)
        wings.put(int(round(r_elbow[0])), int(round(r_elbow[1] - 2)), claw)

    wings_out = add_outline(wings, OUTLINE)

    body = Canvas(FW, FH)
    bx = cx
    by = cy + 4.0
    hx = cx + 0.5 + body_tilt * 3.5
    hy = cy - 7.0 + abs(body_tilt) * 1.5

    # Garras inferiores
    if not dead_pose:
        draw_capsule(body, (bx - 3, by + 7), (bx - 5, by + 13), 1.3, 1.0, PAL_BAT_BONE)
        draw_capsule(body, (bx + 3, by + 7), (bx + 5, by + 13), 1.3, 1.0, PAL_BAT_BONE)

    # Tronco peludo
    draw_ellipse(body, bx, by, 7.6, 8.4, PAL_BAT_FUR)
    draw_ellipse(body, bx + 0.5, by - 2.0, 4.5, 4.0, (PAL_BAT_FUR[1], PAL_BAT_FUR[2], PAL_BAT_FUR[3], (148, 124, 186)))

    # Orelhas
    draw_polygon_shaded(body, [(hx - 7, hy - 1), (hx - 11, hy - 15), (hx - 2, hy - 8)], PAL_BAT_FUR)
    draw_polygon_shaded(body, [(hx - 6, hy - 3), (hx - 9, hy - 12), (hx - 3, hy - 7)], PAL_BAT_EAR)
    draw_polygon_shaded(body, [(hx + 3, hy - 8), (hx + 11, hy - 15), (hx + 7, hy - 1)], PAL_BAT_FUR)
    draw_polygon_shaded(body, [(hx + 4, hy - 7), (hx + 9, hy - 12), (hx + 6, hy - 3)], PAL_BAT_EAR)

    # Cabeca
    draw_ellipse(body, hx, hy, 7.4, 6.2, PAL_BAT_FUR)

    # Olhos
    ex1, ex2 = int(round(hx - 3)), int(round(hx + 3))
    ey = int(round(hy - 1))
    if eye_mode == "x":
        draw_x_eye(body, ex1, ey, (18, 12, 24, 255))
        draw_x_eye(body, ex2, ey, (18, 12, 24, 255))
    else:
        for ex in (ex1, ex2):
            body.put(ex, ey, (215, 28, 28, 255))
            body.put(ex + 1, ey, (255, 78, 36, 255))
            body.put(ex, ey + 1, (255, 195, 70, 255))
            body.put(ex + 1, ey + 1, (255, 235, 130, 255))

    # Focinho e presas
    fx = int(round(hx))
    fy = int(round(hy + 3))
    body.put(fx, fy, (28, 18, 40, 255))
    body.put(fx + 1, fy, (28, 18, 40, 255))
    if mouth_open:
        for mx in range(fx - 2, fx + 4):
            body.put(mx, fy + 2, (120, 22, 34, 255))
            body.put(mx, fy + 3, (80, 14, 22, 255))
        for px in (fx - 2, fx + 3):
            body.put(px, fy + 2, (245, 242, 236, 255))
            body.put(px, fy + 3, (245, 242, 236, 255))
    else:
        body.put(fx - 2, fy + 2, (245, 242, 236, 255))
        body.put(fx + 3, fy + 2, (245, 242, 236, 255))

    body_out = add_outline(body, OUTLINE)
    res = Canvas(FW, FH)
    res.composite(wings_out)
    res.composite(body_out)
    return remove_isolated_pixels(res)


def build_cave_bat_frames() -> List[Canvas]:
    frames: List[Canvas] = []
    # 0..3 idle (flutuacao suave)
    idle_params = [
        (40.0, 43.0, 0.0, 1.0),
        (40.0, 42.0, 6.0, 1.0),
        (40.0, 41.0, 11.0, 0.96),
        (40.0, 42.0, 5.0, 1.0),
    ]
    for cx, cy, wdy, ws in idle_params:
        frames.append(render_bat_frame(cx, cy, wdy, wing_span=ws))

    # 4..9 walk (ciclo completo de batida de asas cima -> meio -> baixo -> retorno)
    walk_params = [
        (40.0, 45.0, -7.0, 0.95, 0.1),
        (40.0, 43.0, 4.0, 1.06, 0.0),
        (40.0, 39.0, 22.0, 0.92, 0.0),
        (40.0, 41.0, 15.0, 0.96, 0.05),
        (40.0, 43.0, 2.0, 1.02, 0.05),
        (40.0, 45.0, -5.0, 0.96, 0.1),
    ]
    for cx, cy, wdy, ws, wf in walk_params:
        frames.append(render_bat_frame(cx, cy, wdy, wing_span=ws, wing_fold=wf))

    # 10..15 attack (fecha asas atras e mergulha em rasante com presas)
    attack_params = [
        (35.0, 40.0, -4.0, 0.85, 0.45, -0.3, False),
        (32.0, 38.0, 2.0, 0.72, 0.75, -0.4, True),
        (48.0, 45.0, 8.0, 0.90, 0.40, 0.9, True),
        (53.0, 47.0, 12.0, 0.95, 0.25, 1.0, True),
        (46.0, 44.0, 6.0, 1.0, 0.10, 0.4, False),
        (41.0, 43.0, 1.0, 1.0, 0.0, 0.1, False),
    ]
    for cx, cy, wdy, ws, wf, bt, mo in attack_params:
        frames.append(render_bat_frame(cx, cy, wdy, wing_span=ws, wing_fold=wf, body_tilt=bt, mouth_open=mo))

    # 16..19 death (desequilibrio, queda e asas fechadas no chao y=76)
    frames.append(render_bat_frame(38.0, 45.0, -3.0, wing_span=0.88, wing_fold=0.35, body_tilt=-0.4, eye_mode="x"))
    frames.append(render_bat_frame(39.0, 56.0, 8.0, wing_span=0.75, wing_fold=0.60, body_tilt=-0.2, eye_mode="x"))
    frames.append(render_bat_frame(40.0, 66.0, 14.0, wing_span=0.65, wing_fold=0.80, body_tilt=0.1, eye_mode="x"))
    frames.append(render_bat_frame(40.0, 67.0, 0.0, eye_mode="x", dead_pose=True))
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
# Montagem dos Spritesheets, Preview 20f e Manifest
# ---------------------------------------------------------------------------

def assemble_strip(frames: Sequence[Canvas]) -> Canvas:
    sheet = Canvas(FW * len(frames), FH)
    for i, fr in enumerate(frames):
        sheet.composite(fr, dx=i * FW, dy=0)
    return sheet


def build_preview_grid(all_monsters: Sequence[Tuple[str, Sequence[Canvas]]], scale: int = 2) -> Canvas:
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
    rows = len(all_monsters)
    cell_w = FW * scale
    cell_h = FH * scale
    label_w = 180
    pad_x = 12
    pad_y = 26
    header_h = 44

    total_w = label_w + cols * cell_w + pad_x * 2
    total_h = header_h + rows * (cell_h + pad_y) + 16
    grid = Canvas(total_w, total_h, (20, 22, 30, 255))

    draw_text(grid, pad_x, 10, "SUBMUNDO 5 MONSTERS 20F", (235, 225, 195, 255), scale=2)
    sections = [
        (0, "IDLE 0-3", (120, 210, 240, 255)),
        (4, "WALK 4-9", (140, 230, 150, 255)),
        (10, "ATTACK 10-15", (245, 165, 95, 255)),
        (16, "DEATH 16-19", (230, 110, 120, 255)),
    ]
    for fidx, title, col in sections:
        draw_text(grid, label_w + fidx * cell_w + 4, 28, title, col, scale=2)

    for r, (name, frames) in enumerate(all_monsters):
        y0 = header_h + r * (cell_h + pad_y)
        draw_text(grid, pad_x, y0 + cell_h // 2 - 6, name.upper(), (220, 230, 245, 255), scale=2)

        for c, fr in enumerate(frames):
            bx0 = label_w + c * cell_w
            by0 = y0
            for py in range(cell_h):
                for px in range(cell_w):
                    checker = ((px // (8 * scale)) + (py // (8 * scale))) % 2 == 0
                    bg = (50, 54, 64, 255) if checker else (40, 44, 54, 255)
                    grid.put(bx0 + px, by0 + py, bg)

            # Linha guia do chao (y = 76)
            gy = by0 + FOOT_Y * scale
            for px in range(cell_w):
                grid.put(bx0 + px, gy, (95, 155, 105, 255))

            # Separador de grupo
            if c in (4, 10, 16):
                for py in range(cell_h):
                    grid.put(bx0, by0 + py, (200, 180, 120, 255))

            for sy in range(FH):
                for sx in range(FW):
                    col = fr.get(sx, sy)
                    if col[3] == 0:
                        continue
                    for dy in range(scale):
                        for dx in range(scale):
                            grid.blend_pixel(bx0 + sx * scale + dx, by0 + sy * scale + dy, col)

    return grid


def update_manifest(keys: Sequence[str]) -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    sprites = manifest.setdefault("sprites", {})
    for key in keys:
        sprites[key] = {
            "key": key,
            "file": f"{key}.png",
            "width": FW * NUM_FRAMES,
            "height": FH,
            "frameWidth": FW,
            "frameHeight": FH,
            "frames": list(FRAME_NAMES),
        }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    OUT_SPRITES_DIR.mkdir(parents=True, exist_ok=True)
    builders = [
        ("slime", build_slime_frames),
        ("cave_bat", build_cave_bat_frames),
        ("wolf", build_wolf_frames),
        ("skeleton", build_skeleton_frames),
        ("skeleton_archer", build_skeleton_archer_frames),
    ]

    all_monsters: List[Tuple[str, List[Canvas]]] = []
    for key, fn in builders:
        frames = fn()
        assert len(frames) == NUM_FRAMES, f"{key}: esperado {NUM_FRAMES} frames, obteve {len(frames)}"
        sheet = assemble_strip(frames)
        out_path = OUT_SPRITES_DIR / f"{key}.png"
        write_png(out_path, sheet)
        print(f"Gerado: {out_path} ({sheet.w}x{sheet.h}, {len(frames)} frames)")
        all_monsters.append((key, frames))

    update_manifest([k for k, _ in builders])
    print(f"Atualizado: {MANIFEST_PATH}")

    preview = build_preview_grid(all_monsters, scale=2)
    write_png(PREVIEW_PATH, preview)
    print(f"Preview: {PREVIEW_PATH} ({preview.w}x{preview.h})")


if __name__ == "__main__":
    main()
