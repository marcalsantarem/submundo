"""
SUBMUNDO - Mockups 960x540 dos biomas subterraneos (BRF-137 / T-072, grupo `under_`)
=======================================================================================
Mesmo padrao do mockup aprovado da Masmorra Basica (buildMockupDungeonBasic.py, so
importado): mapa montado por autotile com os sheets publicados do bioma, camera do
DungeonScene (zoom 1.45, nearest), atores reais em escala de jogo (0.88; Karnak 1.06),
drop no chao com feixe, iluminacao do bioma, HUD paisagem por cima.
"""
from __future__ import annotations

import math
from typing import Dict, List, Optional, Sequence, Tuple

from under_kit import (Biome, Canvas, MapSpec, MOCKUPS_DIR, SPRITES_DIR, T, compose_map, place_props, read_png,
                       render_text_overlay, slice_sheet, text_item, sheet_paths)
import buildMockupDungeonBasic as bmd
from buildMockupDungeonBasic import (DF, FONT_BODY, FONT_TITLE, LightMap, TXT_GOLD, TXT_LIGHT, TXT_MUTED,
                                     TXT_PARCH, add_glow, apply_light, arc_fill, blend, chamfer_pts, disc,
                                     draw_image, draw_sprite_scaled, hexrgb, load_frame_index, metal_button,
                                     polygon, resize_area, ring, rounded_rect, stroke_poly)

SW, SH = bmd.SW, bmd.SH
ZOOM = bmd.ZOOM
ACTOR_SCALE = bmd.ACTOR_SCALE
LOOT_SCALE = bmd.LOOT_SCALE
SCALE_OVERRIDE = {"karnak": 1.06}


def load_sheet(path, fw: int, fh: int, names: Sequence[str]) -> Dict[str, Canvas]:
    frames = slice_sheet(read_png(path), fw, fh)
    return {n: frames[i] for i, n in enumerate(names)}


class Cam:
    def __init__(self, vx: float, vy: float) -> None:
        self.vx, self.vy = vx, vy

    def w2s(self, wx: float, wy: float) -> Tuple[float, float]:
        return ((wx - self.vx) * ZOOM, (wy - self.vy) * ZOOM)

    def to_screen(self, world: Canvas, fill=(6, 6, 8, 255)) -> Canvas:
        scr = Canvas(SW, SH, fill)
        xs = [int(math.floor(sx / ZOOM + self.vx)) for sx in range(SW)]
        for sy in range(SH):
            wy = int(math.floor(sy / ZOOM + self.vy))
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
# HUD (copia parametrizada de buildMockupDungeonBasic.draw_hud)
# ---------------------------------------------------------------------------

def draw_hud(cv: Canvas, icons: List[Canvas], portraits: List[Canvas], texts: List[Dict[str, object]], *,
             portrait_idx: int, hero_name: str, title: str, objective: str, spec: MapSpec,
             hero_w: Tuple[float, float], enemies_w: Sequence[Tuple[float, float]],
             loot_w: Tuple[float, float], hp_ratio: float = 0.78, accent=(56, 189, 248)) -> None:
    ICON = {"attack": 0, "dash": 1, "skill_inferno": 2, "skill_empireo": 3, "potion": 5, "bag": 6,
            "audio_on": 8, "souls": 10, "essence": 11}
    pcx, pcy, pr = 46, 44, 32
    disc(cv, pcx, pcy + 2, pr + 3, (0, 0, 0), 0.5)
    disc(cv, pcx, pcy, pr, DF["recess"], 0.96)
    portrait = resize_area(portraits[portrait_idx], (pr - 1) * 2, (pr - 1) * 2)
    draw_image(cv, portrait, pcx, pcy + 1, 1.0, pr - 2)
    ring(cv, pcx, pcy, pr + 1.5, 3.5, DF["metalDark"])
    ring(cv, pcx, pcy, pr, 2.2, DF["bronze"], 0.98)
    ring(cv, pcx, pcy, pr - 2, 1.0, DF["gold"], 0.75)
    for (dx, dy) in ((0, -pr), (pr, 0), (-pr, 0)):
        disc(cv, pcx + dx, pcy + dy, 2, DF["gold"], 0.96)
    bw, bh, by = 46, 15, pcy + pr + 1
    rounded_rect(cv, pcx - bw / 2, by - bh / 2, bw, bh, 4, DF["obsidian"], 0.96)
    stroke_poly(cv, chamfer_pts(pcx - bw / 2, by - bh / 2, bw, bh, 0), DF["gold"], 1.3, 0.95)
    texts.append(text_item("Nv. 7", pcx, by, 10.5, TXT_GOLD, FONT_BODY, True, "c"))

    bar_x, hp_y, hp_w, hp_h = 86, 30, 188, 18
    texts.append(text_item(hero_name, 88, 17, 12.5, TXT_PARCH, FONT_TITLE, True, "l", (5, 7, 12, 220), 3))
    polygon(cv, chamfer_pts(bar_x, hp_y, hp_w, hp_h, 9), DF["recess"], 0.95)
    fw = hp_w * hp_ratio
    polygon(cv, chamfer_pts(bar_x + 1, hp_y + 1, fw - 2, hp_h - 2, 9), hexrgb(0xB91C1C), 0.98)
    polygon(cv, chamfer_pts(bar_x + 2, hp_y + 2, fw - 6, 6, 4), hexrgb(0xEF4444), 0.55)
    stroke_poly(cv, chamfer_pts(bar_x, hp_y, hp_w, hp_h, 9), DF["bronze"], 1.6, 0.98)
    stroke_poly(cv, chamfer_pts(bar_x - 1, hp_y - 1, hp_w + 2, hp_h + 2, 9), DF["metalDark"], 1.0, 0.92)
    texts.append(text_item(f"{int(hp_ratio * 100)}/100", bar_x + hp_w * 0.46, hp_y + hp_h / 2, 11, (255, 247, 237),
                           FONT_BODY, True, "c", (5, 7, 12, 230), 2.5))
    sec_y, sec_w, sec_h = 53, 154, 6
    polygon(cv, chamfer_pts(bar_x, sec_y, sec_w, sec_h, 4), DF["recess"], 0.92)
    polygon(cv, chamfer_pts(bar_x + 1, sec_y + 1, (sec_w - 2) * 0.6, sec_h - 2, 3), hexrgb(0xD97706), 0.95)
    stroke_poly(cv, chamfer_pts(bar_x, sec_y, sec_w, sec_h, 4), DF["metalBorder"], 1.0, 0.88)

    ox, oy = 16, 94
    dcx, dcy = ox + 10, oy + 10
    polygon(cv, [(dcx, dcy - 6.2), (dcx + 6.2, dcy), (dcx, dcy + 6.2), (dcx - 6.2, dcy)], DF["gold"], 0.96)
    polygon(cv, [(dcx, dcy - 5), (dcx + 5, dcy), (dcx, dcy + 5), (dcx - 5, dcy)], DF["bronzeDark"], 0.95)
    polygon(cv, [(dcx, dcy - 3), (dcx + 3, dcy), (dcx, dcy + 3), (dcx - 3, dcy)], DF["goldBright"], 0.98)
    texts.append(text_item(title, ox + 24, oy + 10, 13, TXT_GOLD, FONT_TITLE, True, "l", (5, 7, 12, 220), 3))
    texts.append(text_item(objective, ox + 24, oy + 26, 11.5, TXT_PARCH, FONT_BODY, False, "l", (5, 7, 12, 220), 3))
    for x in range(ox, ox + 204):
        blend(cv, x, oy + 44, DF["gold"] if x < ox + 56 else DF["bronze"], 0.5)

    # --- minimapa: mascara real do mapa, centrada no heroi ---
    mx, my, mr = SW - 60, 60, 46
    disc(cv, mx, my + 2, mr + 4, (0, 0, 0), 0.5)
    disc(cv, mx, my, mr, (10, 16, 26), 0.94)
    cs = 3.0
    hcx, hcy = hero_w[0] / T, hero_w[1] / T

    def mm(wx: float, wy: float) -> Tuple[float, float]:
        return (mx + (wx / T - hcx) * cs, my + (wy / T - hcy) * cs)

    walk = set(spec.floor) | set(spec.doors) | {c for c, n in spec.north.items() if "open" in n or "link" in n}
    for (cx, cy) in walk:
        x0, y0 = mm(cx * T, cy * T)
        for yy in range(int(round(y0)), int(round(y0 + cs))):
            for xx in range(int(round(x0)), int(round(x0 + cs))):
                if math.hypot(xx + 0.5 - mx, yy + 0.5 - my) > mr - 4:
                    continue
                edge = any(n not in walk for n in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)))
                blend(cv, xx, yy, (100, 116, 139) if edge else (34, 46, 64), 0.9)
    for (wx, wy) in enemies_w:
        px, py = mm(wx, wy)
        disc(cv, px, py, 2.2, (239, 68, 68), 0.95)
    lx, ly = mm(*loot_w)
    disc(cv, lx, ly, 1.8, (249, 115, 22), 1.0)
    polygon(cv, [(mx, my - 4), (mx + 3.5, my + 3), (mx - 3.5, my + 3)], accent, 1.0)
    ring(cv, mx, my, mr + 1.5, 3.5, DF["metalDark"])
    ring(cv, mx, my, mr, 2.2, DF["bronze"], 0.98)
    ring(cv, mx, my, mr - 2, 1.0, DF["gold"], 0.6)
    for ang in (0, 90, 180, 270):
        a = math.radians(ang)
        disc(cv, mx + mr * math.cos(a), my + mr * math.sin(a), 2, DF["gold"], 0.96)
    texts.append(text_item("N", mx, my - mr + 8, 8, TXT_GOLD, FONT_TITLE, True, "c", (5, 7, 12, 220), 2))

    map_left = mx - mr
    souls_x, ess_x, res_y = map_left - 128, map_left - 52, 26
    draw_image(cv, resize_area(icons[ICON["souls"]], 18, 18), souls_x, res_y)
    draw_image(cv, resize_area(icons[ICON["essence"]], 18, 18), ess_x, res_y)
    texts.append(text_item("1.240", souls_x + 13, res_y, 13, TXT_LIGHT, FONT_TITLE, True, "l", (5, 7, 12, 230), 3))
    texts.append(text_item("36", ess_x + 13, res_y, 13, TXT_LIGHT, FONT_TITLE, True, "l", (5, 7, 12, 230), 3))

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
        accent_c = DF["gold"] if slot.startswith("active") else DF["bronze"]
        metal_button(cv, bx, by_, br, accent_c)
        draw_image(cv, resize_area(icons[ICON[icon]], round(br * 1.38), round(br * 1.38)), bx, by_)
    bx, by_, br, _ = slots["active_2"]
    arc_fill(cv, bx, by_, br - 2, 0.62, (5, 7, 12), 0.62)
    texts.append(text_item("3s", bx, by_, 16, (255, 247, 237), FONT_TITLE, True, "c", (5, 7, 12, 240), 3.5))
    bx, by_, br, _ = slots["potion"]
    disc(cv, bx + 17, by_ + 17, 7.5, DF["obsidian"], 0.98)
    ring(cv, bx + 17, by_ + 17, 7.5, 1.2, DF["gold"], 0.98)
    texts.append(text_item("3", bx + 17, by_ + 17, 10, (255, 247, 237), FONT_BODY, True, "c"))
    bx, by_, br, _ = slots["dash"]
    texts.append(text_item("Esquiva", bx - br - 8, by_, 12.5, TXT_PARCH, FONT_TITLE, True, "r", (7, 9, 14, 240), 3))


# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------

def actor_foot(key: str) -> float:
    return 46 if key == "cave_bat" else (40 if key == "karnak" else 31)


def render_mockup(b: Biome, tiles, doors, props, tall) -> Canvas:
    sc = b.scene()
    spec = MapSpec(sc["map"])
    world = compose_map(b, spec, tiles, doors, sc.get("void", (9, 9, 11, 255)), sc.get("overrides"))
    pmap = {n: c for n, c in props}
    tmap = {n: c for n, c in tall}
    place_props(world, pmap, tmap, sc["wall_props"], sc["floor_props"], [], sc.get("decals", ()))
    cam = Cam(*sc["view"])
    scr = cam.to_screen(world, sc.get("void", (6, 6, 8, 255)))
    # props altos ficam com os atores na ordenacao por profundidade
    actor_mask = Canvas(SW, SH)
    hero_key, hx_w, hy_w, hflip = sc["hero"]
    actors = list(sc["actors"]) + [(hero_key, hx_w, hy_w, hflip)]
    lw = sc["loot"]
    loot = load_frame_index("loot_drops", lw[2])
    lx, ly = cam.w2s(lw[0], lw[1])
    for key, wx, wy, _ in actors:
        fx, fy = cam.w2s(wx, wy + actor_foot(key))
        rx = 26 if key == "karnak" else (20 if key in ("wolf", "wolf_alpha", "hero_living", "hero_wraith", "skeleton_chief") else (14 if key != "cave_bat" else 11))
        for y in range(int(fy - 6), int(fy + 7)):
            for x in range(int(fx - rx - 1), int(fx + rx + 2)):
                d = math.hypot((x + 0.5 - fx) / rx, (y + 0.5 - fy) / 5.0)
                if d < 1:
                    blend(scr, x, y, (0, 0, 0), 0.5 * (1 - d) ** 0.6)
    draw_sprite_scaled(scr, loot, lx, ly, LOOT_SCALE * ZOOM, False, actor_mask)
    drawables = []
    for key, wx, wy, flip in actors:
        drawables.append((wy + actor_foot(key) + (40 if key == "cave_bat" else 0), "a", key, wx, wy, flip))
    for name, x, y in sc["tall_props"]:
        drawables.append((y + 61, "t", name, x, y, False))
    for _, kind, key, wx, wy, flip in sorted(drawables, key=lambda d: d[0]):
        if kind == "t":
            src = tmap[key]
            sx, sy = cam.w2s(wx + 16, wy + 32)
            draw_sprite_scaled(scr, src, sx, sy, ZOOM)
        else:
            frame = load_frame_index(key, 0)
            sx, sy = cam.w2s(wx, wy)
            draw_sprite_scaled(scr, frame, sx, sy, SCALE_OVERRIDE.get(key, ACTOR_SCALE) * ZOOM, flip, actor_mask)

    # --- luz ---
    lm = LightMap(sc["ambient"])
    torch_r = sc.get("torch_radius", 210)
    torch_p = sc.get("torch_power", 1.15)
    flames = [(x + b.torch_flame[0], y + b.torch_flame[1]) for (n, x, y) in sc["wall_props"] if n.startswith("torch_")]
    for (fx, fy) in flames:
        sx, sy = cam.w2s(fx, fy)
        lm.add(sx, sy + 40, torch_r, b.torch_light, torch_p, 0.85)
    hl = sc["hero_light"]
    hsx, hsy = cam.w2s(hx_w, hy_w + 8)
    lm.add(hsx, hsy, hl[3], hl[:3], 0.75, 0.8)
    lm.add(lx, ly, 90, (1.0, 0.5, 0.15) if lw[2] == 3 else (1.0, 0.85, 0.3), 0.8)
    for (wx, wy, rad, col, pw) in sc.get("extra_lights", ()):
        sx, sy = cam.w2s(wx, wy)
        lm.add(sx, sy, rad, col, pw, 0.85)
    apply_light(scr, lm, actor_mask, sc.get("sprite_mix", 0.45))

    for (fx, fy) in flames:
        sx, sy = cam.w2s(fx, fy)
        add_glow(scr, sx, sy, 22, b.torch_glow[0], 0.75)
        add_glow(scr, sx, sy + 6, 64, b.torch_glow[1], 0.22)
    for (wx, wy, rad, col, st) in sc.get("extra_glows", ()):
        sx, sy = cam.w2s(wx, wy)
        add_glow(scr, sx, sy, rad, col, st)
    if hasattr(b, "post_fx"):
        b.post_fx(scr, cam, sc)

    # feixe do drop
    beam_col = {0: (228, 228, 231), 1: (56, 189, 248), 2: (250, 204, 21), 3: (249, 115, 22)}[lw[2]]
    beam_h = 120
    for y in range(int(ly - beam_h), int(ly + 4)):
        t = min(1.0, (ly - y) / beam_h)
        for x in range(int(lx - 9), int(lx + 10)):
            d = abs(x + 0.5 - lx) / 9
            f = max(0.0, 1 - d) ** 1.6 * (1 - max(0.0, t)) ** 1.3 * 0.85
            o = (y * SW + x) * 4
            if 0 <= y < SH and f > 0:
                scr.buf[o] = min(255, int(scr.buf[o] + beam_col[0] * f))
                scr.buf[o + 1] = min(255, int(scr.buf[o + 1] + beam_col[1] * f))
                scr.buf[o + 2] = min(255, int(scr.buf[o + 2] + beam_col[2] * f))
    add_glow(scr, lx, ly + 8, 34, beam_col, 0.55, 0.45)

    tel = sc.get("telegraph")
    if tel:
        ax, ay = cam.w2s(*tel[0])
        tx, ty = cam.w2s(*tel[1])
        steps = int(math.hypot(tx - ax, ty - ay))
        for i in range(steps):
            t = i / steps
            px, py = ax + (tx - ax) * t, ay + (ty - ay) * t
            if (i // 6) % 2 == 0:
                for w in (-1, 0, 1):
                    blend(scr, int(px), int(py) + w, (239, 68, 68), 0.55 if w == 0 else 0.22)
        ring(scr, tx, ty + 30, 18, 1.6, (239, 68, 68), 0.55)

    texts: List[Dict[str, object]] = []
    hp = sc["hp"]
    for key, wx, wy, _ in sc["actors"]:
        big = key == "karnak"
        bwid = 52 if big else 34
        bx, by = cam.w2s(wx - bwid / 2, wy - (52 if big else 34))
        bw, bh = bwid * ZOOM, 4 * ZOOM
        for y in range(int(by - 1), int(by + bh + 1)):
            for x in range(int(bx - 1), int(bx + bw + 1)):
                inner = bx <= x < bx + bw and by <= y < by + bh
                col = (39, 39, 48) if inner else (9, 9, 11)
                if inner and x < bx + bw * hp.get(key, 1.0):
                    col = (239, 68, 68) if y > by + 1 else (252, 165, 165)
                blend(scr, x, y, col, 0.95)
    for (txt, wx, wy, crit) in sc.get("damage", ()):
        sx, sy = cam.w2s(wx, wy - 52)
        if crit:
            texts.append(text_item("CRÍTICO!", sx, sy - 16, 11, (253, 224, 71), FONT_TITLE, True, "c", (60, 20, 4, 240), 3))
            texts.append(text_item(txt, sx, sy + 2, 21, (250, 204, 21), FONT_TITLE, True, "c", (60, 20, 4, 245), 4))
        else:
            texts.append(text_item(txt, sx + 12, sy, 17, (255, 247, 237), FONT_TITLE, True, "c", (5, 7, 12, 240), 3.5))
    texts.append(text_item(lw[3], lx, ly - 34, 11, lw[4], FONT_BODY, True, "c", (5, 7, 12, 240), 3))

    icons = slice_sheet(read_png(SPRITES_DIR / "ui_icons.png"), 64, 64)
    portraits = slice_sheet(read_png(SPRITES_DIR / "portraits.png"), 128, 128)
    wraith = hero_key == "hero_wraith"
    draw_hud(scr, icons, portraits, texts, portrait_idx=1 if wraith else 0,
             hero_name="ESPECTRO" if wraith else "GUERREIRO", title=sc["hud_title"], objective=sc["hud_objective"],
             spec=spec, hero_w=(hx_w, hy_w), enemies_w=[(a[1], a[2]) for a in sc["actors"]],
             loot_w=(lw[0], lw[1]))
    for i in range(SW * SH):
        scr.buf[i * 4 + 3] = 255
    out = MOCKUPS_DIR / f"mockup_m8_{b.id}.png"
    render_text_overlay(scr, texts, out)
    print(f"Gerado: {out}")
    return scr


def render_sample(b: Biome, tiles, doors, props, tall) -> Canvas:
    sc = b.scene()
    spec = MapSpec(sc["map"])
    world = compose_map(b, spec, tiles, doors, overrides=sc.get("overrides"))
    pmap = {n: c for n, c in props}
    tmap = {n: c for n, c in tall}
    place_props(world, pmap, tmap, sc["wall_props"], sc["floor_props"], sc["tall_props"], sc.get("decals", ()))
    return world
