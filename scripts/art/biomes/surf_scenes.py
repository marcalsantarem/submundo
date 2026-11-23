"""
SUBMUNDO - Cenas dos mockups dos biomas de superficie (BRF-138 / T-131). Usado por surf_mockup.py.

Cada cena define a mascara de piso (ASCII: '.' piso, '#' parede), portas, camera, props, atores,
luzes e textos. A camera mostra sempre parte de uma sala nao retangular + corredor que vira e/ou
porta lateral/selada (decisao #20).
"""
from __future__ import annotations

from surf_mockup import Scene, add_glow, dmg, slash_arc, T


# ---------------------------------------------------------------------------
# Vila Natal: praca em L entre casas, rua que sobe e vira a leste, arco norte; entardecer quente
# ---------------------------------------------------------------------------

class VillageScene(Scene):
    bid = "village"
    rows = (
        "########################",
        "########################",
        "########################",
        "###############.........",
        "#............##.........",
        "#............##..#######",
        "#............##..#######",
        "#............##..#######",
        "#.....................##",
        "#.....................##",
        "#.....................##",
        "#.....................##",
        "#.....................##",
        "########################",
        "########################",
    )
    north = {(8, 2): "door_arch_l", (9, 2): "door_arch_r", (8, 3): "door_open_l", (9, 3): "door_open_r"}
    doors = {}
    view = (40.0, 34.0)
    floor_weights = (("floor_0", 0.31), ("floor_1", 0.31), ("floor_2", 0.3), ("floor_moss", 0.04),
                     ("floor_cracked", 0.025), ("floor_blood", 0.015))
    floor_special = {(10, 11): "floor_blood", (11, 11): "floor_moss", (3, 9): "floor_cracked"}
    face_override = {
        (3, 2): "wall_face_upper_cracked", (5, 2): "wall_face_upper_cracked", (12, 2): "wall_face_upper_cracked",
        (14, 6): "wall_face_upper_cracked", (19, 6): "wall_face_upper_cracked", (21, 6): "wall_face_upper_cracked",
        (17, 1): "wall_face_upper_cracked", (20, 1): "wall_face_upper_cracked",
        (2, 3): "wall_face_lower_grate", (11, 3): "wall_face_lower_grate", (20, 7): "wall_face_lower_grate",
    }
    wall_props = (("torch_0", 7, 2), ("torch_2", 10, 2), ("torch_1", 13, 6), ("torch_3", 18, 6),
                  ("torch_2", 16, 1), ("torch_0", 22, 1))
    flat_props = (
        ("hay_bale", 64, 132), ("crate", 346, 128), ("sacks", 370, 132), ("apple_basket", 392, 140),
        ("flower_planter", 214, 124), ("barrel", 450, 250), ("firewood", 676, 252), ("bucket", 640, 254),
        ("puddle", 236, 304), ("bench", 560, 252), ("cart_wheel", 418, 240),
    )
    tall_props = (("tree_oak", 132, 196), ("notice_board", 470, 196), ("banner_pole", 528, 196),
                  ("lamp_post", 66, 256))
    hero = (330, 262)
    actors = (
        ("wolf", 436, 292, True, 4),
        ("wolf", 214, 318, False, 6),
        ("wolf_alpha", 362, 362, True, 0),
        ("wolf", 452, 194, True, 2),
    )
    loot = (2, 186, 236)
    loot_color = (250, 204, 21)
    loot_text = (250, 204, 21)
    loot_name = "[Lâmina do Ferreiro (Rara)]"
    title = "Vila Natal"
    subtitle = "Expulse a matilha da praça · 4 restantes"
    ambient = (0.5, 0.42, 0.47)
    vignette_k = 0.7
    sprite_mix = 0.4
    bg = (18, 12, 11)

    LANTERNS = ((7, 2), (10, 2), (13, 6), (18, 6), (16, 1), (22, 1))
    WINDOWS = ((3, 2), (5, 2), (12, 2), (14, 6), (19, 6), (21, 6), (17, 1), (20, 1))

    def lights(self, lm, w2s):
        for (cx, cy) in self.LANTERNS:
            sx, sy = w2s(cx * T + 16, cy * T + 16)
            lm.add(sx, sy + 40, 200, (1.0, 0.62, 0.28), 1.05, 0.85)
        for (cx, cy) in self.WINDOWS:
            sx, sy = w2s(cx * T + 16, cy * T + 20)
            lm.add(sx, sy + 46, 110, (1.0, 0.6, 0.25), 0.45, 0.7)
        sx, sy = w2s(66 + 16, 256 + 6)
        lm.add(sx, sy + 30, 220, (1.0, 0.62, 0.28), 1.0, 0.85)
        sx, sy = w2s(9 * T, 3 * T)
        lm.add(sx, sy, 90, (1.0, 0.55, 0.2), 0.45)
        # ceu de entardecer: luz rosada de cima
        lm.add(SWC, -120, 700, (0.55, 0.35, 0.3), 0.35, 0.6)

    def glows(self, scr, w2s):
        for (cx, cy) in self.LANTERNS:
            sx, sy = w2s(cx * T + 16, cy * T + 16)
            add_glow(scr, sx, sy, 20, (255, 200, 100), 0.7)
            add_glow(scr, sx, sy + 6, 60, (245, 140, 40), 0.2)
        for (cx, cy) in self.WINDOWS:
            sx, sy = w2s(cx * T + 16, cy * T + 16)
            add_glow(scr, sx, sy, 26, (255, 170, 70), 0.32)
        sx, sy = w2s(82, 256 + 6)
        add_glow(scr, sx, sy, 22, (255, 200, 100), 0.7)
        add_glow(scr, sx, sy + 8, 70, (245, 140, 40), 0.2)

    def hp(self):
        return {0: 0.35, 1: 0.8, 2: 0.65, 3: 1.0}

    def combat(self, scr, w2s, texts):
        hx, hy = w2s(self.hero[0] + 10, self.hero[1] - 2)
        slash_arc(scr, hx, hy, 34, -0.9, 0.9, (224, 242, 254))
        dmg(texts, w2s, 446, 292 - 52, "31")
        dmg(texts, w2s, 362, 362 - 66, "64", crit=True)


SWC = 480


# ---------------------------------------------------------------------------
# Plantacao de Ervas: campo aberto com sebe saliente, canteiros, trilha que vira, portao leste; fim de tarde
# ---------------------------------------------------------------------------

class HerbFieldScene(Scene):
    bid = "herb_field"
    rows = (
        "########################",
        "########################",
        "#####################..#",
        "#####################..#",
        "#........####.......#..#",
        "#........####.......#..#",
        "#........####.......#..#",
        "#...................#..#",
        "#...................####",
        "#...................####",
        "#...................####",
        "#...................####",
        "#...................####",
        "########################",
        "########################",
    )
    north = {(15, 2): "door_arch_sealed_l", (16, 2): "door_arch_sealed_r",
             (15, 3): "door_open_sealed_l", (16, 3): "door_open_sealed_r"}
    doors = {(20, 6): "door_e_t", (20, 7): "door_e_b"}
    view = (78.0, 30.0)
    floor_weights = (("floor_0", 0.34), ("floor_1", 0.3), ("floor_2", 0.26), ("floor_moss", 0.06),
                     ("floor_cracked", 0.02), ("floor_blood", 0.02))
    floor_special = {}
    face_override = {
        (5, 2): "wall_face_upper_cracked", (13, 2): "wall_face_upper_cracked", (18, 2): "wall_face_upper_cracked",
        (11, 5): "wall_face_upper_cracked", (22, 0): "wall_face_upper_cracked",
        (3, 3): "wall_face_lower_grate", (4, 3): "wall_face_lower_grate", (17, 3): "wall_face_lower_grate",
        (18, 3): "wall_face_lower_grate", (19, 3): "wall_face_lower_grate",
    }
    wall_props = (("torch_0", 7, 2), ("torch_2", 14, 2), ("torch_1", 17, 2), ("torch_3", 10, 5))
    flat_props = (
        # trilha: do portao selado (norte) desce e vira a leste ate o portao lateral
        ("trail_ns", 496, 144), ("trail_ns", 496, 176), ("trail_ne", 496, 208),
        ("trail_ew", 528, 208), ("trail_ew", 560, 208), ("trail_ew", 592, 208), ("trail_ew", 624, 208),
        # canteiros (fileiras)
        ("herb_bed_basil", 104, 186), ("herb_bed_lavender", 136, 186), ("herb_bed_basil", 168, 186),
        ("herb_bed_sprouts", 104, 226), ("herb_bed_lavender", 136, 226), ("herb_bed_sprouts", 168, 226),
        ("herb_bed_lavender", 400, 268), ("herb_bed_basil", 432, 268), ("herb_bed_lavender", 464, 268),
        ("herb_bed_sprouts", 400, 308), ("herb_bed_basil", 432, 308), ("herb_bed_sprouts", 464, 308),
        ("herb_bed_basil", 560, 290), ("herb_bed_lavender", 592, 290),
        ("basket_herbs", 504, 300), ("watering_can", 204, 232), ("seed_sack", 96, 140),
        ("rocks", 610, 140), ("flower_bush", 252, 128), ("flower_bush", 560, 132), ("rocks", 300, 392),
    )
    tall_props = (("well", 432, 140), ("sunflowers", 214, 120),
                  ("scarecrow", 280, 228))
    hero = (360, 236)
    actors = (
        ("slime", 470, 222, True, 1),
        ("slime", 250, 316, False, 3),
        ("slime", 540, 332, True, 6),
        ("slime", 392, 356, False, 2),
        ("slime", 600, 246, True, 0),
    )
    loot = (1, 330, 332)
    loot_color = (96, 165, 250)
    loot_text = (125, 180, 252)
    loot_name = "[Foice de Colheita (Mágica)]"
    title = "Plantação de Ervas"
    subtitle = "Limpe a plantação · 5 slimes restantes"
    ambient = (0.94, 0.79, 0.62)
    vignette_k = 0.55
    sprite_mix = 0.2
    bg = (12, 22, 14)

    LANTERNS = ((7, 2), (14, 2), (17, 2), (10, 5))

    def lights(self, lm, w2s):
        # sol baixo de fim de tarde vindo do noroeste
        lm.add(-80, -60, 900, (0.5, 0.34, 0.14), 0.55, 0.8)
        for (cx, cy) in self.LANTERNS:
            sx, sy = w2s(cx * T + 16, cy * T + 18)
            lm.add(sx, sy + 30, 130, (1.0, 0.6, 0.3), 0.4, 0.85)
        sx, sy = w2s(15.5 * T + 16, 3 * T + 10)
        lm.add(sx, sy, 120, (0.75, 0.45, 1.0), 0.35)

    def glows(self, scr, w2s):
        for (cx, cy) in self.LANTERNS:
            sx, sy = w2s(cx * T + 16, cy * T + 18)
            add_glow(scr, sx, sy, 18, (255, 190, 110), 0.55)
        sx, sy = w2s(15.5 * T + 16, 3 * T + 6)
        add_glow(scr, sx, sy, 50, (168, 85, 247), 0.22)
        # poeira dourada no ar
        for (x, y) in ((120, 160), (210, 90), (330, 140), (560, 120), (700, 200), (420, 80), (260, 230)):
            add_glow(scr, x, y, 3, (255, 230, 150), 0.6)

    def hp(self):
        return {0: 0.4, 1: 1.0, 2: 0.7, 3: 1.0, 4: 0.9}

    def combat(self, scr, w2s, texts):
        hx, hy = w2s(self.hero[0] + 12, self.hero[1] - 4)
        slash_arc(scr, hx, hy, 32, -1.4, 0.4, (224, 242, 254))
        dmg(texts, w2s, 470, 222 - 46, "52", crit=True)
        dmg(texts, w2s, 540, 332 - 46, "18")


# ---------------------------------------------------------------------------
# Gruta da Cachoeira: camara em cruz com braco norte da cachoeira, tunel norte (arco + link),
# porta leste selada e corredor que sobe; luz fria + cogumelos
# ---------------------------------------------------------------------------

class GrottoScene(Scene):
    bid = "village_grotto"
    rows = (
        "##############..########",
        "##############..########",
        "########################",
        "#######.....######..####",
        "#######.....######..####",
        "##...............#..####",
        "##...............#..####",
        "##...............#..####",
        "##...............#..####",
        "##...............#######",
        "##...............#######",
        "##...............#######",
        "########################",
        "########################",
    )
    north = {(14, 3): "door_arch_l", (15, 3): "door_arch_r", (14, 4): "door_open_l", (15, 4): "door_open_r",
             (14, 2): "door_n_link_l", (15, 2): "door_n_link_r"}
    doors = {(17, 7): "door_e_sealed_t", (17, 8): "door_e_sealed_b"}
    view = (34.0, 14.0)
    floor_weights = (("floor_0", 0.31), ("floor_1", 0.31), ("floor_2", 0.29), ("floor_moss", 0.05),
                     ("floor_blood", 0.025), ("floor_cracked", 0.015))
    floor_special = {(4, 7): "floor_cracked", (5, 8): "floor_moss", (12, 10): "floor_blood", (3, 10): "floor_moss"}
    face_override = {(4, 3): "wall_face_upper_cracked", (16, 3): "wall_face_upper_cracked",
                     (10, 1): "wall_face_upper_cracked", (5, 4): "wall_face_lower_grate",
                     (19, 2): "wall_face_lower_grate"}
    wall_props = (("torch_0", 3, 3), ("torch_2", 13, 3), ("torch_1", 7, 1), ("torch_3", 11, 1),
                  ("torch_0", 18, 1))
    flat_props = (
        ("stream_top_l", 256, 0), ("stream_top_r", 288, 0),
        ("falls_pool_l", 256, 96), ("falls_pool_r", 288, 96),
        ("puddle", 300, 150), ("puddle", 116, 318), ("mushrooms_floor", 470, 170), ("mushrooms_floor", 500, 330),
        ("crystal", 230, 112), ("crystal", 520, 168), ("rocks_wet", 360, 104), ("sulfur_spring", 150, 220),
        ("bones", 410, 330), ("fern", 70, 300), ("stalagmite", 216, 340), ("rocks_wet", 600, 250),
    )
    tall_props = (("waterfall_l_1", 256, 32), ("waterfall_r_1", 288, 32), ("stalagmite_tall", 66, 168),
                  ("giant_mushroom", 118, 150), ("rock_column", 590, 120))
    hero = (330, 246)
    actors = (
        ("slime", 228, 284, False, 2),
        ("slime", 432, 296, True, 5),
        ("cave_bat", 396, 180, True, 3),
        ("cave_bat", 230, 186, False, 6),
    )
    loot = (3, 160, 280)
    loot_color = (249, 115, 22)
    loot_text = (249, 115, 22)
    loot_name = "[Amuleto da Nascente (Lendário)]"
    title = "Gruta da Cachoeira"
    subtitle = "Derrote as criaturas · 4 restantes"
    ambient = (0.34, 0.41, 0.5)
    vignette_k = 0.74
    sprite_mix = 0.42
    bg = (6, 8, 10)

    MUSH = ((3, 3), (13, 3), (7, 1), (11, 1), (18, 1))

    def lights(self, lm, w2s):
        for (cx, cy) in self.MUSH:
            sx, sy = w2s(cx * T + 16, cy * T + 14)
            lm.add(sx, sy + 30, 170, (0.35, 0.95, 1.0), 0.75, 0.85)
        sx, sy = w2s(134, 168)
        lm.add(sx, sy + 20, 200, (0.35, 0.95, 1.0), 0.8, 0.85)
        # cachoeira: luz do dia filtrada de cima + reflexo da agua
        sx, sy = w2s(288, 70)
        lm.add(sx, sy, 260, (0.75, 0.9, 1.0), 0.9, 0.9)
        sx, sy = w2s(288, 120)
        lm.add(sx, sy, 140, (0.6, 0.9, 1.0), 0.5)
        for (x, y) in ((246, 128), (536, 184)):
            sx, sy = w2s(x, y)
            lm.add(sx, sy, 90, (0.3, 0.9, 1.0), 0.45)
        sx, sy = w2s(17 * T + 16, 8 * T)
        lm.add(sx, sy, 110, (0.66, 0.33, 0.97), 0.5)

    def glows(self, scr, w2s):
        for (cx, cy) in self.MUSH:
            sx, sy = w2s(cx * T + 16, cy * T + 12)
            add_glow(scr, sx, sy, 24, (90, 230, 230), 0.45)
        sx, sy = w2s(134, 168)
        add_glow(scr, sx, sy, 40, (90, 230, 230), 0.35)
        for (x, y) in ((246, 126), (536, 182)):
            sx, sy = w2s(x, y)
            add_glow(scr, sx, sy, 18, (120, 240, 240), 0.5)
        # nevoa da queda d'agua
        sx, sy = w2s(288, 104)
        add_glow(scr, sx, sy, 70, (170, 220, 235), 0.22, 0.5)

    def post(self, scr, w2s):
        # raio de luz do dia descendo sobre a cachoeira (aditivo, diagonal)
        import math
        x0, y0 = w2s(300, -10)
        for y in range(0, int(w2s(0, 120)[1])):
            t = y / max(1.0, w2s(0, 120)[1])
            cx = x0 + (y - y0) * 0.25
            half = 36 + 30 * t
            for x in range(int(cx - half), int(cx + half)):
                if 0 <= x < 960:
                    d = abs(x + 0.5 - cx) / half
                    f = max(0.0, 1 - d) ** 1.5 * 0.14 * (1 - t * 0.6)
                    o = (y * 960 + x) * 4
                    scr.buf[o] = min(255, int(scr.buf[o] + 200 * f))
                    scr.buf[o + 1] = min(255, int(scr.buf[o + 1] + 235 * f))
                    scr.buf[o + 2] = min(255, int(scr.buf[o + 2] + 255 * f))
        _ = math

    def hp(self):
        return {0: 0.55, 1: 1.0, 2: 0.25, 3: 1.0}

    def combat(self, scr, w2s, texts):
        hx, hy = w2s(self.hero[0] + 12, self.hero[1] - 6)
        slash_arc(scr, hx, hy, 34, -1.6, 0.2, (224, 242, 254))
        dmg(texts, w2s, 396, 180 - 40, "88", crit=True)
        dmg(texts, w2s, 228, 284 - 46, "23")
