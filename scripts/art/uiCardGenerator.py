#!/usr/bin/env python3
"""
Gerador dedicado de UI e Cards de Itens 2D Dark Fantasy (SUBMUNDO).

Renderizacao 100% reproduzivel no Windows usando apenas Python stdlib +
PowerShell/.NET System.Drawing (AntiAlias + HighQualityBicubic + AntiAliasGridFit),
sem depender de Pillow ou Node.

Le diretamente:
  - src/data/items.json
  - src/data/affixes.json
  - public/assets/sprites/ui_icons.png (18 frames 64x64; slots 12..17)

Exemplos de uso:
  python scripts/art/uiCardGenerator.py --showcase
  python scripts/art/uiCardGenerator.py --item-id cinder_greatsword --rarity legendary
  python scripts/art/uiCardGenerator.py --slot helm --rarity magic --out assets/mockups/card_helm.png
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

ROOT = Path(__file__).resolve().parents[2]
ITEMS_JSON = ROOT / "src" / "data" / "items.json"
AFFIXES_JSON = ROOT / "src" / "data" / "affixes.json"
UI_ICONS_PNG = ROOT / "public" / "assets" / "sprites" / "ui_icons.png"
DEFAULT_SHOWCASE_OUT = ROOT / "assets" / "mockups" / "preview_m7_ui_generator_cards.png"

SLOT_ICON_FRAME: Dict[str, int] = {
    "weapon": 12,
    "armor": 13,
    "amulet": 14,
    "ring": 15,
    "helm": 16,
    "boots": 17,
}

SLOT_LABELS: Dict[str, str] = {
    "weapon": "ARMA",
    "armor": "ARMADURA",
    "helm": "ELMO",
    "boots": "BOTA",
    "amulet": "AMULETO",
    "ring": "ANEL",
}

SLOT_SUBTYPE_PT: Dict[str, Tuple[str, str]] = {
    # (substantivo, genero 'm'|'f')
    "weapon": ("Arma", "f"),
    "armor": ("Armadura de Peito", "f"),
    "helm": ("Elmo", "m"),
    "boots": ("Botas", "f_pl"),
    "amulet": ("Amuleto", "m"),
    "ring": ("Anel", "m"),
}

FORCE_LABELS: Dict[str, str] = {
    "none": "",
    "inferno": "Inferno",
    "submundo": "Submundo",
    "empireo": "Empíreo",
}

FORCE_BADGE_COLORS: Dict[str, Dict[str, str]] = {
    "inferno": {"bg": "#6c240c", "border": "#f97316", "text": "#fed7aa"},
    "submundo": {"bg": "#4c1538", "border": "#e11d48", "text": "#fecdd3"},
    "empireo": {"bg": "#5a430b", "border": "#facc15", "text": "#fef08a"},
    "none": {"bg": "#2b3340", "border": "#94a3b8", "text": "#e2e8f0"},
}

RARITY_ALIASES: Dict[str, str] = {
    "common": "common",
    "comum": "common",
    "magic": "magic",
    "magico": "magic",
    "mágico": "magic",
    "rare": "rare",
    "raro": "rare",
    "legendary": "legendary",
    "lendario": "legendary",
    "lendário": "legendary",
}

RARITY_ADJ: Dict[str, Dict[str, str]] = {
    "common": {"m": "Comum", "f": "Comum", "f_pl": "Comuns"},
    "magic": {"m": "Mágico", "f": "Mágica", "f_pl": "Mágicas"},
    "rare": {"m": "Raro", "f": "Rara", "f_pl": "Raras"},
    "legendary": {"m": "Lendário", "f": "Lendária", "f_pl": "Lendárias"},
}

RARITY_ORDER: Dict[str, int] = {
    "common": 0,
    "magic": 1,
    "rare": 2,
    "legendary": 3,
}

RARITY_PALETTES: Dict[str, Dict[str, Any]] = {
    "legendary": {
        "name": "Lendário",
        "accent": "#f97316",
        "accentLight": "#fdba74",
        "accentBright": "#fb923c",
        "accentDark": "#9a3412",
        "borderOuter": "#c25418",
        "borderInner": "#f97316",
        "bgTop": "#5c2710",
        "bgMid": "#281a14",
        "bgBot": "#1a1310",
        "iconBgTop": "#4a1f0d",
        "iconBgBot": "#180d09",
        "titleColor": "#fb923c",
        "subtitleColor": "#f4b183",
        "emblem": "star",
        "gemColor": "ruby",
        "affixCount": 3,
        "hasLegendaryPower": True,
        "basePower": 640,
        "powerScale": 2.4,
        "defaultLevel": 45,
    },
    "rare": {
        "name": "Raro",
        "accent": "#facc15",
        "accentLight": "#fef08a",
        "accentBright": "#fde047",
        "accentDark": "#854d0e",
        "borderOuter": "#a17d18",
        "borderInner": "#facc15",
        "bgTop": "#4b3e12",
        "bgMid": "#252114",
        "bgBot": "#181711",
        "iconBgTop": "#3e3310",
        "iconBgBot": "#16140c",
        "titleColor": "#fde047",
        "subtitleColor": "#e7d079",
        "emblem": "skull",
        "gemColor": "sapphire",
        "affixCount": 3,
        "hasLegendaryPower": False,
        "basePower": 510,
        "powerScale": 1.85,
        "defaultLevel": 36,
    },
    "magic": {
        "name": "Mágico",
        "accent": "#60a5fa",
        "accentLight": "#bfdbfe",
        "accentBright": "#93c5fd",
        "accentDark": "#1e40af",
        "borderOuter": "#3b6ea8",
        "borderInner": "#60a5fa",
        "bgTop": "#1c3654",
        "bgMid": "#17202c",
        "bgBot": "#12171f",
        "iconBgTop": "#18304d",
        "iconBgBot": "#0e1520",
        "titleColor": "#7db8ff",
        "subtitleColor": "#a8ccf5",
        "emblem": "skull",
        "gemColor": "sapphire",
        "affixCount": 2,
        "hasLegendaryPower": False,
        "basePower": 350,
        "powerScale": 1.45,
        "defaultLevel": 24,
    },
    "common": {
        "name": "Comum",
        "accent": "#94a3b8",
        "accentLight": "#e2e8f0",
        "accentBright": "#cbd5e1",
        "accentDark": "#475569",
        "borderOuter": "#5b6778",
        "borderInner": "#94a3b8",
        "bgTop": "#2d3540",
        "bgMid": "#1d2128",
        "bgBot": "#15181e",
        "iconBgTop": "#262d36",
        "iconBgBot": "#12151a",
        "titleColor": "#e2e8f0",
        "subtitleColor": "#b8c4d4",
        "emblem": "crest",
        "gemColor": "empty",
        "affixCount": 0,
        "hasLegendaryPower": False,
        "basePower": 175,
        "powerScale": 1.0,
        "defaultLevel": 10,
    },
}

FORCE_GEM_OVERRIDE: Dict[str, str] = {
    "inferno": "ruby",
    "submundo": "amethyst",
    "empireo": "sapphire",
}


def load_game_data() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    if not ITEMS_JSON.exists():
        raise FileNotFoundError(f"Arquivo nao encontrado: {ITEMS_JSON}")
    if not AFFIXES_JSON.exists():
        raise FileNotFoundError(f"Arquivo nao encontrado: {AFFIXES_JSON}")
    if not UI_ICONS_PNG.exists():
        raise FileNotFoundError(f"Spritesheet de icones nao encontrado: {UI_ICONS_PNG}")

    items = json.loads(ITEMS_JSON.read_text(encoding="utf-8"))
    affix_doc = json.loads(AFFIXES_JSON.read_text(encoding="utf-8"))
    affixes = affix_doc.get("affixes", [])
    legendary_powers = affix_doc.get("legendaryPowers", [])
    return items, affixes, legendary_powers


def normalize_rarity(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    key = raw.strip().lower()
    if key not in RARITY_ALIASES:
        valid = ", ".join(["common", "magic", "rare", "legendary"])
        raise ValueError(f"Raridade invalida '{raw}'. Valores validos: {valid}")
    return RARITY_ALIASES[key]


def deterministic_index(seed_key: str, length: int) -> int:
    if length <= 1:
        return 0
    digest = hashlib.sha256(seed_key.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big") % length


def format_stat_line(stat_key: str, value: float) -> str:
    pct = round(value * 100)
    iv = int(round(value))
    mapping = {
        "attack": f"+{iv} de Ataque",
        "attackRange": f"+{iv} de Alcance de Ataque",
        "defense": f"+{iv} de Defesa",
        "maxHp": f"+{iv} de Vida Máxima",
        "moveSpeed": f"+{iv} de Velocidade de Movimento",
        "critChance": f"+{pct}% de Chance Crítica",
        "critMultiplier": f"+{pct}% de Dano Crítico",
        "lifeSteal": f"+{pct}% de Roubo de Vida",
        "cooldownReduction": f"+{pct}% de Redução de Recarga",
        "luck": f"+{pct}% de Sorte em Loot",
    }
    return mapping.get(stat_key, f"+{iv} de {stat_key}")


def format_pt_int(value: int) -> str:
    return f"{value:,}".replace(",", ".")


def select_affixes_for_item(
    item: Dict[str, Any],
    rarity: str,
    affixes: Sequence[Dict[str, Any]],
    seed: int,
) -> List[Dict[str, Any]]:
    palette = RARITY_PALETTES[rarity]
    target_count = int(palette["affixCount"])
    if target_count <= 0:
        return []

    slot = item["slot"]
    force = item.get("force", "none")
    rarity_rank = RARITY_ORDER[rarity]

    eligible = [
        af
        for af in affixes
        if slot in af.get("allowedSlots", [])
        and RARITY_ORDER.get(af.get("minRarity", "magic"), 1) <= rarity_rank
    ]

    # Prioriza afixos da mesma forca elemental e tambem afixos neutros variados
    matching_force = [af for af in eligible if force != "none" and af.get("force") == force]
    rare_tier = [af for af in matching_force if af.get("minRarity") == "rare"]
    magic_tier = [af for af in matching_force if af.get("minRarity") != "rare"]
    neutral_pool = [af for af in eligible if af.get("force") == "none"]
    other_pool = [af for af in eligible if af not in matching_force and af not in neutral_pool]

    ordered_pools = [rare_tier, magic_tier, neutral_pool, other_pool]
    chosen: List[Dict[str, Any]] = []
    used_ids = set()
    used_stat_keys = set()

    for pool_idx, pool in enumerate(ordered_pools):
        if len(chosen) >= target_count:
            break
        candidates = [af for af in pool if af["id"] not in used_ids]
        while candidates and len(chosen) < target_count:
            # Prefere candidatos que tragam pelo menos um atributo novo para evitar repeticao
            fresh = [
                af
                for af in candidates
                if any(k not in used_stat_keys for k in af.get("bonuses", {}).keys())
            ]
            active_list = fresh if fresh else candidates
            pick_idx = deterministic_index(
                f"{item['id']}:{rarity}:{seed}:{pool_idx}:{len(chosen)}",
                len(active_list),
            )
            picked = active_list[pick_idx]
            candidates.remove(picked)
            chosen.append(picked)
            used_ids.add(picked["id"])
            used_stat_keys.update(picked.get("bonuses", {}).keys())
            # Para variedade visual, pega no maximo 2 da mesma forca antes de misturar
            if pool_idx == 1 and len(chosen) >= min(2, target_count) and neutral_pool:
                break

    return chosen[:target_count]


def select_legendary_power(
    item: Dict[str, Any],
    legendary_powers: Sequence[Dict[str, Any]],
    seed: int,
) -> Optional[Dict[str, Any]]:
    if not legendary_powers:
        return None
    force = item.get("force", "none")
    matching = [lp for lp in legendary_powers if lp.get("force") == force]
    pool = matching if matching else list(legendary_powers)
    idx = deterministic_index(f"lp:{item['id']}:{seed}", len(pool))
    return pool[idx]


def compute_item_card_model(
    item: Dict[str, Any],
    rarity: str,
    affixes: Sequence[Dict[str, Any]],
    legendary_powers: Sequence[Dict[str, Any]],
    seed: int = 42,
    override_level: Optional[int] = None,
) -> Dict[str, Any]:
    palette = RARITY_PALETTES[rarity]
    slot = item["slot"]
    force = item.get("force", "none")
    base_bonuses: Dict[str, float] = dict(item.get("baseBonuses", {}))

    chosen_affixes = select_affixes_for_item(item, rarity, affixes, seed)
    totals: Dict[str, float] = dict(base_bonuses)
    for af in chosen_affixes:
        for k, v in af.get("bonuses", {}).items():
            totals[k] = totals.get(k, 0.0) + float(v)

    # Calcula Poder do Item coerente com os atributos reais (faixas RPG equilibradas)
    stat_score = (
        totals.get("attack", 0.0) * 6.5
        + totals.get("defense", 0.0) * 8.0
        + totals.get("maxHp", 0.0) * 1.1
        + totals.get("moveSpeed", 0.0) * 1.6
        + totals.get("attackRange", 0.0) * 1.3
        + totals.get("critChance", 0.0) * 210.0
        + totals.get("critMultiplier", 0.0) * 90.0
        + totals.get("lifeSteal", 0.0) * 220.0
        + totals.get("cooldownReduction", 0.0) * 170.0
        + totals.get("luck", 0.0) * 120.0
    )
    item_power = int(round(palette["basePower"] + stat_score * palette["powerScale"] * 0.22))
    item_power = max(90, min(880, item_power))

    # Atributo primario no formato Dark Fantasy (Dano por Segundo, Armadura, Vida Maxima, Chance Critica)
    if slot == "weapon":
        atk_val = totals.get("attack", 5.0)
        crit_bonus = 1.0 + totals.get("critChance", 0.0) * 1.8
        dps = int(round((atk_val * 26.0 + item_power * 0.42) * crit_bonus))
        primary_stat = f"{format_pt_int(dps)} de Dano por Segundo"
        primary_kind = "dps"
        primary_numeric = dps
    elif slot in ("armor", "helm", "boots"):
        def_val = totals.get("defense", 2.0)
        hp_val = totals.get("maxHp", 10.0)
        slot_factor = {"armor": 1.0, "helm": 0.68, "boots": 0.54}[slot]
        armor_val = int(round((def_val * 58.0 + hp_val * 3.8 + item_power * 0.62) * slot_factor))
        primary_stat = f"{format_pt_int(armor_val)} de Armadura"
        primary_kind = "armor"
        primary_numeric = armor_val
    elif slot == "amulet":
        hp_total = int(round(totals.get("maxHp", 16.0) * 6.0 + item_power * 0.36))
        primary_stat = f"+{format_pt_int(hp_total)} de Vida Máxima"
        primary_kind = "hp"
        primary_numeric = hp_total
    else:  # ring
        crit_pct = round((totals.get("critChance", 0.04) * 100.0) + (RARITY_ORDER[rarity] * 2.5 + 3.0), 1)
        crit_str = f"{crit_pct:.1f}".replace(".", ",").rstrip("0").rstrip(",")
        primary_stat = f"+{crit_str}% de Chance Crítica"
        primary_kind = "crit"
        primary_numeric = int(round(crit_pct * 10))

    # Monta linhas de afixos sem repeticao, combinando base + afixos sorteados
    affix_lines: List[str] = []
    if rarity == "common":
        for k, v in base_bonuses.items():
            affix_lines.append(format_stat_line(k, float(v)))
    else:
        # 1a linha opcional de bonus inato relevante + linhas dos afixos escolhidos
        seen_stats = set()
        for af in chosen_affixes:
            bonuses = af.get("bonuses", {})
            parts = [format_stat_line(k, float(v)) for k, v in bonuses.items()]
            seen_stats.update(bonuses.keys())
            if len(parts) == 1:
                affix_lines.append(parts[0])
            elif len(parts) == 2:
                affix_lines.append(f"{parts[0]} e {parts[1]}")
            else:
                affix_lines.append(", ".join(parts[:-1]) + f" e {parts[-1]}")
        # Adiciona bonus base distinto se houver espaco para manter ritmo visual equilibrado
        target_lines = 3 if rarity == "magic" else max(3, palette["affixCount"])
        for k, v in base_bonuses.items():
            if len(affix_lines) >= target_lines:
                break
            if k not in seen_stats:
                affix_lines.insert(0, format_stat_line(k, float(v)))
                seen_stats.add(k)

    # Limita a no maximo 4 linhas de afixo para manter leitura limpa
    affix_lines = affix_lines[:4]

    # Aspecto Lendario
    legendary_text = ""
    if palette["hasLegendaryPower"]:
        lp = select_legendary_power(item, legendary_powers, seed)
        if lp:
            legendary_text = f"Aspecto {lp['name']}: {lp['description']}"

    # Subtitulo elegante em portugues
    noun, gender = SLOT_SUBTYPE_PT[slot]
    rarity_adj = RARITY_ADJ[rarity][gender]
    force_label = FORCE_LABELS.get(force, "")
    subtitle = f"{noun} {rarity_adj}"
    if force_label:
        subtitle = f"{subtitle} · {force_label}"

    # Gema do engaste baseada em raridade e forca
    gem_color = palette["gemColor"]
    if rarity in ("legendary", "rare", "magic") and force in FORCE_GEM_OVERRIDE:
        gem_color = FORCE_GEM_OVERRIDE[force]

    req_level = override_level if override_level is not None else int(
        palette["defaultLevel"] + (item_power % 9)
    )

    return {
        "id": item["id"],
        "name": item["name"].upper(),
        "rawName": item["name"],
        "slot": slot,
        "slotLabel": SLOT_LABELS[slot],
        "subtitle": subtitle,
        "rarity": rarity,
        "rarityLabel": palette["name"],
        "force": force,
        "forceLabel": force_label,
        "forceBadge": FORCE_BADGE_COLORS.get(force, FORCE_BADGE_COLORS["none"]),
        "iconFrame": SLOT_ICON_FRAME[slot],
        "itemPower": item_power,
        "primaryStat": primary_stat,
        "primaryKind": primary_kind,
        "primaryNumeric": primary_numeric,
        "affixLines": affix_lines,
        "legendaryText": legendary_text,
        "flavorText": item.get("description", ""),
        "requiredLevel": req_level,
        "gemColor": gem_color,
        "palette": palette,
        "totals": totals,
    }


def build_showcase_spec(
    items: Sequence[Dict[str, Any]],
    affixes: Sequence[Dict[str, Any]],
    legendary_powers: Sequence[Dict[str, Any]],
    out_path: Path,
    seed: int = 42,
) -> Dict[str, Any]:
    by_id = {it["id"]: it for it in items}

    def pick(item_id: str, fallback_slot: str) -> Dict[str, Any]:
        if item_id in by_id:
            return by_id[item_id]
        for it in items:
            if it["slot"] == fallback_slot:
                return it
        return items[0]

    # 4 cards cobrindo as 4 raridades (Lendario, Raro, Magico, Comum) incluindo Elmo e Bota
    cards = [
        compute_item_card_model(
            pick("cinder_greatsword", "weapon"),
            "legendary",
            affixes,
            legendary_powers,
            seed=seed,
            override_level=50,
        ),
        compute_item_card_model(
            pick("corrupted_seraph_aegis", "armor"),
            "rare",
            affixes,
            legendary_powers,
            seed=seed + 1,
            override_level=42,
        ),
        compute_item_card_model(
            pick("destroyer_helm", "helm"),
            "magic",
            affixes,
            legendary_powers,
            seed=seed + 2,
            override_level=28,
        ),
        compute_item_card_model(
            pick("leather_boots", "boots"),
            "common",
            affixes,
            legendary_powers,
            seed=seed + 3,
            override_level=12,
        ),
    ]

    # Painel EQUIPAMENTO com 6 slots (2x3): ELMO | ARMA, ARMADURA | AMULETO, BOTA | ANEL
    panel_slots_defs = [
        ("helm", "destroyer_helm", "magic"),
        ("weapon", "cinder_greatsword", "legendary"),
        ("armor", "corrupted_seraph_aegis", "rare"),
        ("amulet", "pyre_ember_talisman", "legendary"),
        ("boots", "leather_boots", "common"),
        ("ring", "storm_judgment_ring", "rare"),
    ]
    panel_slots: List[Dict[str, Any]] = []
    total_attack_power = 420
    total_armor = 380
    total_hp = 1200

    for idx, (slot, item_id, rarity) in enumerate(panel_slots_defs):
        model = compute_item_card_model(
            pick(item_id, slot),
            rarity,
            affixes,
            legendary_powers,
            seed=seed + 10 + idx,
        )
        panel_slots.append(
            {
                "slot": slot,
                "label": SLOT_LABELS[slot],
                "rarity": rarity,
                "iconFrame": model["iconFrame"],
                "gemColor": model["gemColor"],
                "palette": model["palette"],
                "itemName": model["rawName"],
            }
        )
        totals = model["totals"]
        total_attack_power += int(round(totals.get("attack", 0.0) * 38 + model["itemPower"] * 0.25))
        total_armor += int(round(totals.get("defense", 0.0) * 65 + model["itemPower"] * 0.35))
        total_hp += int(round(totals.get("maxHp", 0.0) * 14 + model["itemPower"] * 0.48))

    return {
        "mode": "showcase",
        "outPath": str(out_path.resolve()),
        "iconsPath": str(UI_ICONS_PNG.resolve()),
        "panel": {
            "title": "EQUIPAMENTO",
            "slots": panel_slots,
            "stats": [
                f"Poder de Ataque: {format_pt_int(total_attack_power)}",
                f"Armadura: {format_pt_int(total_armor)}",
                f"Vida: {format_pt_int(total_hp)}",
            ],
        },
        "cards": cards,
    }


def build_single_card_spec(
    item: Dict[str, Any],
    rarity: str,
    affixes: Sequence[Dict[str, Any]],
    legendary_powers: Sequence[Dict[str, Any]],
    out_path: Path,
    seed: int = 42,
    override_level: Optional[int] = None,
) -> Dict[str, Any]:
    card = compute_item_card_model(
        item,
        rarity,
        affixes,
        legendary_powers,
        seed=seed,
        override_level=override_level,
    )
    return {
        "mode": "single",
        "outPath": str(out_path.resolve()),
        "iconsPath": str(UI_ICONS_PNG.resolve()),
        "cards": [card],
    }


POWERSHELL_RENDERER = r'''
param(
    [Parameter(Mandatory=$true)]
    [string]$SpecPath
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$rawJson = [System.IO.File]::ReadAllText($SpecPath, [System.Text.Encoding]::UTF8)
$spec = $rawJson | ConvertFrom-Json

function Parse-Color {
    param([string]$Hex, [int]$Alpha = 255)
    $h = $Hex.TrimStart('#')
    $r = [Convert]::ToInt32($h.Substring(0, 2), 16)
    $g = [Convert]::ToInt32($h.Substring(2, 2), 16)
    $b = [Convert]::ToInt32($h.Substring(4, 2), 16)
    return [System.Drawing.Color]::FromArgb($Alpha, $r, $g, $b)
}

function New-FontSafe {
    param(
        [string[]]$Candidates,
        [float]$Size,
        [System.Drawing.FontStyle]$Style = [System.Drawing.FontStyle]::Regular
    )
    $installed = (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }
    foreach ($name in $Candidates) {
        if ($installed -contains $name) {
            return New-Object System.Drawing.Font($name, $Size, $Style, [System.Drawing.GraphicsUnit]::Point)
        }
    }
    return New-Object System.Drawing.Font("Georgia", $Size, $Style, [System.Drawing.GraphicsUnit]::Point)
}

function New-ChamferPath {
    param([float]$X, [float]$Y, [float]$W, [float]$H, [float]$Cut)
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pts = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF(($X + $Cut), $Y)),
        (New-Object System.Drawing.PointF(($X + $W - $Cut), $Y)),
        (New-Object System.Drawing.PointF(($X + $W), ($Y + $Cut))),
        (New-Object System.Drawing.PointF(($X + $W), ($Y + $H - $Cut))),
        (New-Object System.Drawing.PointF(($X + $W - $Cut), ($Y + $H))),
        (New-Object System.Drawing.PointF(($X + $Cut), ($Y + $H))),
        (New-Object System.Drawing.PointF($X, ($Y + $H - $Cut))),
        (New-Object System.Drawing.PointF($X, ($Y + $Cut)))
    )
    $p.AddPolygon($pts)
    $p.CloseFigure()
    return $p
}

function Draw-DungeonBackdrop {
    param([System.Drawing.Graphics]$G, [int]$W, [int]$H)
    $bgRect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
    $baseBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $bgRect,
        (Parse-Color "#141920"),
        (Parse-Color "#0d1015"),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
    )
    $G.FillRectangle($baseBrush, $bgRect)
    $baseBrush.Dispose()

    # Pedras de masmorra sutis no plano de fundo
    $brickH = 44
    $brickW = 88
    $row = 0
    for ($y = -10; $y -lt $H + $brickH; $y += $brickH) {
        $offset = if (($row % 2) -eq 0) { 0 } else { -44 }
        $col = 0
        for ($x = $offset; $x -lt $W + $brickW; $x += $brickW) {
            $hash = (($row * 73 + $col * 37) % 13)
            $shade = 19 + $hash
            $stoneColor = [System.Drawing.Color]::FromArgb(145, $shade, ($shade + 4), ($shade + 9))
            $hiColor = [System.Drawing.Color]::FromArgb(30, 120, 140, 165)
            $mortColor = [System.Drawing.Color]::FromArgb(200, 8, 10, 14)

            $bx = $x + 2
            $by = $y + 2
            $bw = $brickW - 4
            $bh = $brickH - 4

            $sb = New-Object System.Drawing.SolidBrush($stoneColor)
            $G.FillRectangle($sb, $bx, $by, $bw, $bh)
            $sb.Dispose()

            $hp = New-Object System.Drawing.Pen($hiColor, 1)
            $G.DrawLine($hp, $bx + 1, $by + 1, $bx + $bw - 2, $by + 1)
            $G.DrawLine($hp, $bx + 1, $by + 1, $bx + 1, $by + $bh - 2)
            $hp.Dispose()

            $mp = New-Object System.Drawing.Pen($mortColor, 2)
            $G.DrawRectangle($mp, $x + 1, $y + 1, $brickW - 2, $brickH - 2)
            $mp.Dispose()
            $col++
        }
        $row++
    }

    # Vinheta radial suave para foco nos cards
    $vPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $vPath.AddEllipse(-$W * 0.12, -$H * 0.15, $W * 1.24, $H * 1.30)
    $vBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($vPath)
    $vBrush.CenterColor = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)
    $vBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(175, 5, 6, 9))
    $G.FillRectangle($vBrush, $bgRect)
    $vBrush.Dispose()
    $vPath.Dispose()
}

function Draw-DropShadow {
    param([System.Drawing.Graphics]$G, [float]$X, [float]$Y, [float]$W, [float]$H, [float]$Cut)
    for ($i = 5; $i -ge 1; $i--) {
        $spread = $i * 2.4
        $alpha = [int](18 + (6 - $i) * 14)
        $p = New-ChamferPath ($X - $spread + 2) ($Y - $spread + 5) ($W + $spread * 2) ($H + $spread * 2) ($Cut + 2)
        $b = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($alpha, 0, 0, 0))
        $G.FillPath($b, $p)
        $b.Dispose()
        $p.Dispose()
    }
}

function Draw-CornerFlourishes {
    param([System.Drawing.Graphics]$G, [float]$X, [float]$Y, [float]$W, [float]$H, [System.Drawing.Color]$Color)
    $pen = New-Object System.Drawing.Pen($Color, 1.4)
    $len = 13
    $in = 5

    # Top-Left
    $G.DrawLine($pen, $X + $in, $Y + $in + $len, $X + $in, $Y + $in)
    $G.DrawLine($pen, $X + $in, $Y + $in, $X + $in + $len, $Y + $in)
    $G.DrawLine($pen, $X + $in + 3, $Y + $in + 3, $X + $in + 7, $Y + $in + 7)

    # Top-Right
    $G.DrawLine($pen, $X + $W - $in - $len, $Y + $in, $X + $W - $in, $Y + $in)
    $G.DrawLine($pen, $X + $W - $in, $Y + $in, $X + $W - $in, $Y + $in + $len)
    $G.DrawLine($pen, $X + $W - $in - 3, $Y + $in + 3, $X + $W - $in - 7, $Y + $in + 7)

    # Bottom-Left
    $G.DrawLine($pen, $X + $in, $Y + $H - $in - $len, $X + $in, $Y + $H - $in)
    $G.DrawLine($pen, $X + $in, $Y + $H - $in, $X + $in + $len, $Y + $H - $in)
    $G.DrawLine($pen, $X + $in + 3, $Y + $H - $in - 3, $X + $in + 7, $Y + $H - $in - 7)

    # Bottom-Right
    $G.DrawLine($pen, $X + $W - $in - $len, $Y + $H - $in, $X + $W - $in, $Y + $H - $in)
    $G.DrawLine($pen, $X + $W - $in, $Y + $H - $in - $len, $X + $W - $in, $Y + $H - $in)
    $G.DrawLine($pen, $X + $W - $in - 3, $Y + $H - $in - 3, $X + $W - $in - 7, $Y + $H - $in - 7)

    $pen.Dispose()
}

function Draw-OrnateStarEmblem {
    param([System.Drawing.Graphics]$G, [float]$Cx, [float]$Cy, [float]$Radius = 21)

    # Glow suave atras do medalhao
    $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $gp.AddEllipse($Cx - $Radius * 1.65, $Cy - $Radius * 1.65, $Radius * 3.3, $Radius * 3.3)
    $gb = New-Object System.Drawing.Drawing2D.PathGradientBrush($gp)
    $gb.CenterColor = (Parse-Color "#f97316" 110)
    $gb.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 249, 115, 22))
    $G.FillEllipse($gb, $Cx - $Radius * 1.65, $Cy - $Radius * 1.65, $Radius * 3.3, $Radius * 3.3)
    $gb.Dispose()
    $gp.Dispose()

    # Base octogonal metalica chanfrada
    $outerPts = @()
    for ($i = 0; $i -lt 8; $i++) {
        $ang = ($i * [Math]::PI / 4.0) + ([Math]::PI / 8.0)
        $outerPts += New-Object System.Drawing.PointF(($Cx + [Math]::Cos($ang) * $Radius), ($Cy + [Math]::Sin($ang) * $Radius))
    }
    $medRect = New-Object System.Drawing.RectangleF(($Cx - $Radius), ($Cy - $Radius), ($Radius * 2), ($Radius * 2))
    $medBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $medRect, (Parse-Color "#6b3e24"), (Parse-Color "#241610"), 90
    )
    $G.FillPolygon($medBrush, [System.Drawing.PointF[]]$outerPts)
    $medBrush.Dispose()

    $pDark = New-Object System.Drawing.Pen((Parse-Color "#0d0907"), 2.0)
    $G.DrawPolygon($pDark, [System.Drawing.PointF[]]$outerPts)
    $pDark.Dispose()

    $pBronze = New-Object System.Drawing.Pen((Parse-Color "#c87941"), 1.3)
    $innerPts = @()
    for ($i = 0; $i -lt 8; $i++) {
        $ang = ($i * [Math]::PI / 4.0) + ([Math]::PI / 8.0)
        $innerPts += New-Object System.Drawing.PointF(($Cx + [Math]::Cos($ang) * ($Radius - 2.6)), ($Cy + [Math]::Sin($ang) * ($Radius - 2.6)))
    }
    $G.DrawPolygon($pBronze, [System.Drawing.PointF[]]$innerPts)
    $pBronze.Dispose()

    # Estrela de 8 pontas dourada/laranja
    $starPts = @()
    for ($i = 0; $i -lt 16; $i++) {
        $ang = ($i * [Math]::PI / 8.0) - ([Math]::PI / 2.0)
        if (($i % 4) -eq 0) {
            $r = $Radius * 0.74
        } elseif (($i % 2) -eq 0) {
            $r = $Radius * 0.54
        } else {
            $r = $Radius * 0.24
        }
        $starPts += New-Object System.Drawing.PointF(($Cx + [Math]::Cos($ang) * $r), ($Cy + [Math]::Sin($ang) * $r))
    }

    $sPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $sPath.AddPolygon([System.Drawing.PointF[]]$starPts)
    $sBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($sPath)
    $sBrush.CenterColor = (Parse-Color "#fff7d6")
    $sBrush.SurroundColors = @((Parse-Color "#f97316"))
    $G.FillPath($sBrush, $sPath)
    $sBrush.Dispose()

    $sPen = New-Object System.Drawing.Pen((Parse-Color "#7c2d12"), 1.0)
    $G.DrawPath($sPen, $sPath)
    $sPen.Dispose()
    $sPath.Dispose()

    # Brilho central
    $coreBrush = New-Object System.Drawing.SolidBrush((Parse-Color "#ffffff" 210))
    $G.FillEllipse($coreBrush, $Cx - 2.8, $Cy - 2.8, 5.6, 5.6)
    $coreBrush.Dispose()
}

function Draw-OrnateSkullEmblem {
    param(
        [System.Drawing.Graphics]$G,
        [float]$Cx,
        [float]$Cy,
        [float]$Scale = 1.0,
        [string]$WingTint = "#647080"
    )
    $s = $Scale

    # Suporte metalico com pequenas abas laterais
    $wingPts = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF(($Cx - 26 * $s), $Cy)),
        (New-Object System.Drawing.PointF(($Cx - 16 * $s), ($Cy - 8 * $s))),
        (New-Object System.Drawing.PointF(($Cx + 16 * $s), ($Cy - 8 * $s))),
        (New-Object System.Drawing.PointF(($Cx + 26 * $s), $Cy)),
        (New-Object System.Drawing.PointF(($Cx + 16 * $s), ($Cy + 8 * $s))),
        (New-Object System.Drawing.PointF(($Cx - 16 * $s), ($Cy + 8 * $s)))
    )
    $wb = New-Object System.Drawing.SolidBrush((Parse-Color "#232830"))
    $G.FillPolygon($wb, $wingPts)
    $wb.Dispose()
    $wp = New-Object System.Drawing.Pen((Parse-Color $WingTint 200), 1.2)
    $G.DrawPolygon($wp, $wingPts)
    $wp.Dispose()

    # Sombra do cranio
    $shBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(145, 0, 0, 0))
    $G.FillEllipse($shBrush, $Cx - 13 * $s, $Cy - 12 * $s, 26 * $s, 26 * $s)
    $shBrush.Dispose()

    # Calota craniana
    $craniumRect = New-Object System.Drawing.RectangleF(($Cx - 11.5 * $s), ($Cy - 13 * $s), (23 * $s), (19 * $s))
    $boneBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $craniumRect, (Parse-Color "#eee4cf"), (Parse-Color "#8e826d"), 90
    )
    $G.FillEllipse($boneBrush, $craniumRect)

    # Maxilar / mandibula
    $jawPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $jawPts = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF(($Cx - 8.2 * $s), ($Cy + 1.5 * $s))),
        (New-Object System.Drawing.PointF(($Cx + 8.2 * $s), ($Cy + 1.5 * $s))),
        (New-Object System.Drawing.PointF(($Cx + 6.5 * $s), ($Cy + 11.5 * $s))),
        (New-Object System.Drawing.PointF(($Cx - 6.5 * $s), ($Cy + 11.5 * $s)))
    )
    $jawPath.AddPolygon($jawPts)
    $G.FillPath($boneBrush, $jawPath)
    $boneBrush.Dispose()

    # Contorno do cranio
    $outPen = New-Object System.Drawing.Pen((Parse-Color "#181512"), 1.5)
    $G.DrawEllipse($outPen, $craniumRect)
    $G.DrawPath($outPen, $jawPath)
    $outPen.Dispose()
    $jawPath.Dispose()

    # Orbitas oculares
    $eyeBrush = New-Object System.Drawing.SolidBrush((Parse-Color "#14110f"))
    $G.FillEllipse($eyeBrush, $Cx - 7.4 * $s, $Cy - 4.2 * $s, 5.4 * $s, 5.0 * $s)
    $G.FillEllipse($eyeBrush, $Cx + 2.0 * $s, $Cy - 4.2 * $s, 5.4 * $s, 5.0 * $s)

    # Cavidade nasal
    $nosePts = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF($Cx, ($Cy + 0.4 * $s))),
        (New-Object System.Drawing.PointF(($Cx - 2.1 * $s), ($Cy + 4.3 * $s))),
        (New-Object System.Drawing.PointF(($Cx + 2.1 * $s), ($Cy + 4.3 * $s)))
    )
    $G.FillPolygon($eyeBrush, $nosePts)
    $eyeBrush.Dispose()

    # Dentes sutis
    $toothPen = New-Object System.Drawing.Pen((Parse-Color "#2a241e"), 1.1)
    for ($t = -2; $t -le 2; $t++) {
        $tx = $Cx + $t * 2.5 * $s
        $G.DrawLine($toothPen, $tx, $Cy + 7.2 * $s, $tx, $Cy + 11.2 * $s)
    }
    $G.DrawLine($toothPen, $Cx - 6.0 * $s, $Cy + 7.2 * $s, $Cx + 6.0 * $s, $Cy + 7.2 * $s)
    $toothPen.Dispose()

    # Brilho no topo da calota
    $hiBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(115, 255, 250, 235))
    $G.FillEllipse($hiBrush, $Cx - 5.5 * $s, $Cy - 10.6 * $s, 9.5 * $s, 4.2 * $s)
    $hiBrush.Dispose()
}

function Draw-CommonCrestEmblem {
    param([System.Drawing.Graphics]$G, [float]$Cx, [float]$Cy, [float]$Radius = 15)
    $pts = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF($Cx, ($Cy - $Radius))),
        (New-Object System.Drawing.PointF(($Cx + $Radius * 1.15), $Cy)),
        (New-Object System.Drawing.PointF($Cx, ($Cy + $Radius))),
        (New-Object System.Drawing.PointF(($Cx - $Radius * 1.15), $Cy))
    )
    $rect = New-Object System.Drawing.RectangleF(($Cx - $Radius * 1.2), ($Cy - $Radius), ($Radius * 2.4), ($Radius * 2))
    $b = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, (Parse-Color "#64748b"), (Parse-Color "#1e293b"), 90)
    $G.FillPolygon($b, $pts)
    $b.Dispose()

    $p1 = New-Object System.Drawing.Pen((Parse-Color "#0f172a"), 1.8)
    $G.DrawPolygon($p1, $pts)
    $p1.Dispose()

    $inR = $Radius * 0.56
    $inPts = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF($Cx, ($Cy - $inR))),
        (New-Object System.Drawing.PointF(($Cx + $inR * 1.08), $Cy)),
        (New-Object System.Drawing.PointF($Cx, ($Cy + $inR))),
        (New-Object System.Drawing.PointF(($Cx - $inR * 1.08), $Cy))
    )
    $b2 = New-Object System.Drawing.SolidBrush((Parse-Color "#cbd5e1"))
    $G.FillPolygon($b2, $inPts)
    $b2.Dispose()

    $p2 = New-Object System.Drawing.Pen((Parse-Color "#334155"), 1.0)
    $G.DrawPolygon($p2, $inPts)
    $p2.Dispose()
}

function Draw-GemSocket {
    param([System.Drawing.Graphics]$G, [float]$Cx, [float]$Cy, [float]$Radius, [string]$GemColor)

    # Anel metalico externo
    $ringRect = New-Object System.Drawing.RectangleF(($Cx - $Radius), ($Cy - $Radius), ($Radius * 2), ($Radius * 2))
    $ringBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $ringRect, (Parse-Color "#7c8594"), (Parse-Color "#1f242c"), 135
    )
    $G.FillEllipse($ringBrush, $ringRect)
    $ringBrush.Dispose()

    $darkPen = New-Object System.Drawing.Pen((Parse-Color "#0a0c10"), 1.4)
    $G.DrawEllipse($darkPen, $ringRect)
    $darkPen.Dispose()

    $innerR = $Radius * 0.72
    $innerRect = New-Object System.Drawing.RectangleF(($Cx - $innerR), ($Cy - $innerR), ($innerR * 2), ($innerR * 2))

    if ($GemColor -eq "empty") {
        $eb = New-Object System.Drawing.SolidBrush((Parse-Color "#141820"))
        $G.FillEllipse($eb, $innerRect)
        $eb.Dispose()
        $ep = New-Object System.Drawing.Pen((Parse-Color "#475569"), 1.0)
        $G.DrawEllipse($ep, $innerRect)
        $ep.Dispose()
        return
    }

    $gemPal = switch ($GemColor) {
        "ruby"     { @{ top = "#ff7878"; mid = "#dc2626"; bot = "#5c0b0b"; rim = "#fca5a5" } }
        "sapphire" { @{ top = "#93c5fd"; mid = "#2563eb"; bot = "#172554"; rim = "#bfdbfe" } }
        "amethyst" { @{ top = "#e879f9"; mid = "#9333ea"; bot = "#3b0764"; rim = "#f0abfc" } }
        default    { @{ top = "#fde047"; mid = "#ca8a04"; bot = "#422006"; rim = "#fef08a" } }
    }

    $gBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $innerRect, (Parse-Color $gemPal.top), (Parse-Color $gemPal.bot), 135
    )
    $G.FillEllipse($gBrush, $innerRect)
    $gBrush.Dispose()

    # Faceta octogonal interna
    $fR = $innerR * 0.62
    $fPts = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF($Cx, ($Cy - $fR))),
        (New-Object System.Drawing.PointF(($Cx + $fR), $Cy)),
        (New-Object System.Drawing.PointF($Cx, ($Cy + $fR))),
        (New-Object System.Drawing.PointF(($Cx - $fR), $Cy))
    )
    $fb = New-Object System.Drawing.SolidBrush((Parse-Color $gemPal.mid 210))
    $G.FillPolygon($fb, $fPts)
    $fb.Dispose()

    $fp = New-Object System.Drawing.Pen((Parse-Color $gemPal.rim 175), 0.9)
    $G.DrawPolygon($fp, $fPts)
    $fp.Dispose()

    # Reflexo especular
    $sp = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 255, 255, 255))
    $G.FillEllipse($sp, $Cx - $innerR * 0.45, $Cy - $innerR * 0.50, $innerR * 0.44, $innerR * 0.34)
    $sp.Dispose()
}

function Draw-OrnamentalDivider {
    param([System.Drawing.Graphics]$G, [float]$X, [float]$Y, [float]$Width, [string]$AccentHex)
    $midX = $X + $Width / 2.0
    $lineRectL = New-Object System.Drawing.RectangleF($X, ($Y - 1), ($Width / 2.0 - 14), 2)
    $lineRectR = New-Object System.Drawing.RectangleF(($midX + 14), ($Y - 1), ($Width / 2.0 - 14), 2)

    $bL = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $lineRectL, (Parse-Color $AccentHex 0), (Parse-Color $AccentHex 190), 0
    )
    $bR = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $lineRectR, (Parse-Color $AccentHex 190), (Parse-Color $AccentHex 0), 0
    )
    $G.FillRectangle($bL, $X, $Y - 0.7, $Width / 2.0 - 14, 1.4)
    $G.FillRectangle($bR, $midX + 14, $Y - 0.7, $Width / 2.0 - 14, 1.4)
    $bL.Dispose()
    $bR.Dispose()

    # Losango central ornamentado
    $dPts = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF($midX, ($Y - 5.5))),
        (New-Object System.Drawing.PointF(($midX + 7.5), $Y)),
        (New-Object System.Drawing.PointF($midX, ($Y + 5.5))),
        (New-Object System.Drawing.PointF(($midX - 7.5), $Y))
    )
    $db = New-Object System.Drawing.SolidBrush((Parse-Color "#181c22"))
    $G.FillPolygon($db, $dPts)
    $db.Dispose()
    $dp = New-Object System.Drawing.Pen((Parse-Color $AccentHex 220), 1.3)
    $G.DrawPolygon($dp, $dPts)
    $dp.Dispose()

    # Mini losangos laterais
    $dotBrush = New-Object System.Drawing.SolidBrush((Parse-Color $AccentHex 205))
    $G.FillEllipse($dotBrush, $midX - 2.0, $Y - 2.0, 4.0, 4.0)
    $G.FillEllipse($dotBrush, $midX - 13.0, $Y - 1.7, 3.4, 3.4)
    $G.FillEllipse($dotBrush, $midX + 9.6, $Y - 1.7, 3.4, 3.4)
    $dotBrush.Dispose()
}

function Draw-DiamondBullet {
    param([System.Drawing.Graphics]$G, [float]$Cx, [float]$Cy, [string]$AccentHex)
    $r = 4.6
    $pts = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF($Cx, ($Cy - $r))),
        (New-Object System.Drawing.PointF(($Cx + $r), $Cy)),
        (New-Object System.Drawing.PointF($Cx, ($Cy + $r))),
        (New-Object System.Drawing.PointF(($Cx - $r), $Cy))
    )
    $outB = New-Object System.Drawing.SolidBrush((Parse-Color "#0d1016"))
    $G.FillPolygon($outB, $pts)
    $outB.Dispose()

    $p = New-Object System.Drawing.Pen((Parse-Color $AccentHex 215), 1.2)
    $G.DrawPolygon($p, $pts)
    $p.Dispose()

    $ir = 2.4
    $inPts = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF($Cx, ($Cy - $ir))),
        (New-Object System.Drawing.PointF(($Cx + $ir), $Cy)),
        (New-Object System.Drawing.PointF($Cx, ($Cy + $ir))),
        (New-Object System.Drawing.PointF(($Cx - $ir), $Cy))
    )
    $inB = New-Object System.Drawing.SolidBrush((Parse-Color "#e2e8f0"))
    $G.FillPolygon($inB, $inPts)
    $inB.Dispose()
}

function Draw-StarBullet {
    param([System.Drawing.Graphics]$G, [float]$Cx, [float]$Cy)
    $pts = @()
    for ($i = 0; $i -lt 10; $i++) {
        $ang = ($i * [Math]::PI / 5.0) - ([Math]::PI / 2.0)
        $r = if (($i % 2) -eq 0) { 6.6 } else { 2.8 }
        $pts += New-Object System.Drawing.PointF(($Cx + [Math]::Cos($ang) * $r), ($Cy + [Math]::Sin($ang) * $r))
    }
    $rect = New-Object System.Drawing.RectangleF(($Cx - 7), ($Cy - 7), 14, 14)
    $b = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, (Parse-Color "#fef08a"), (Parse-Color "#ea580c"), 90)
    $G.FillPolygon($b, [System.Drawing.PointF[]]$pts)
    $b.Dispose()
    $p = New-Object System.Drawing.Pen((Parse-Color "#431407"), 1.0)
    $G.DrawPolygon($p, [System.Drawing.PointF[]]$pts)
    $p.Dispose()
}

function Draw-ShadowText {
    param(
        [System.Drawing.Graphics]$G,
        [string]$Text,
        [System.Drawing.Font]$Font,
        [System.Drawing.Color]$Color,
        [System.Drawing.RectangleF]$Rect,
        [System.Drawing.StringFormat]$Format,
        [float]$ShadowOffset = 1.5
    )
    $shRect = New-Object System.Drawing.RectangleF(($Rect.X + $ShadowOffset), ($Rect.Y + $ShadowOffset), $Rect.Width, $Rect.Height)
    $shBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(205, 6, 7, 10))
    $G.DrawString($Text, $Font, $shBrush, $shRect, $Format)
    $shBrush.Dispose()

    $fgBrush = New-Object System.Drawing.SolidBrush($Color)
    $G.DrawString($Text, $Font, $fgBrush, $Rect, $Format)
    $fgBrush.Dispose()
}

function Draw-IconFromSheet {
    param(
        [System.Drawing.Graphics]$G,
        [System.Drawing.Bitmap]$Sheet,
        [int]$FrameIndex,
        [System.Drawing.RectangleF]$DestRect
    )
    $srcRect = New-Object System.Drawing.Rectangle(($FrameIndex * 64), 0, 64, 64)
    $G.DrawImage($Sheet, $DestRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
}

function Draw-ItemCard {
    param(
        [System.Drawing.Graphics]$G,
        [System.Drawing.Bitmap]$IconSheet,
        $Card,
        [float]$X,
        [float]$Y,
        [float]$W,
        [float]$H
    )

    $pal = $Card.palette
    $cut = 8.0

    # 1) Sombra projetada
    Draw-DropShadow $G $X $Y $W $H $cut

    # 2) Moldura externa metalica chanfrada
    $outerPath = New-ChamferPath $X $Y $W $H $cut
    $outerRect = New-Object System.Drawing.RectangleF($X, $Y, $W, $H)
    $outerBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $outerRect, (Parse-Color "#3c434d"), (Parse-Color "#181c22"), 90
    )
    $G.FillPath($outerBrush, $outerPath)
    $outerBrush.Dispose()

    $pBlack = New-Object System.Drawing.Pen((Parse-Color "#090b0f"), 2.2)
    $G.DrawPath($pBlack, $outerPath)
    $pBlack.Dispose()

    $pSteelHi = New-Object System.Drawing.Pen((Parse-Color "#5d6674" 165), 1.0)
    $bevelPath = New-ChamferPath ($X + 2) ($Y + 2) ($W - 4) ($H - 4) ($cut - 1.5)
    $G.DrawPath($pSteelHi, $bevelPath)
    $pSteelHi.Dispose()
    $bevelPath.Dispose()
    $outerPath.Dispose()

    # 3) Corpo interno com gradiente vertical suave na cor da raridade
    $pad = 8.0
    $ix = $X + $pad
    $iy = $Y + $pad
    $iw = $W - $pad * 2
    $ih = $H - $pad * 2
    $innerPath = New-ChamferPath $ix $iy $iw $ih 4.0
    $innerRect = New-Object System.Drawing.RectangleF($ix, $iy, $iw, $ih)

    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $innerRect, (Parse-Color $pal.bgTop), (Parse-Color $pal.bgBot), 90
    )
    $blend = New-Object System.Drawing.Drawing2D.ColorBlend(3)
    $blend.Colors = @(
        (Parse-Color $pal.bgTop),
        (Parse-Color $pal.bgMid),
        (Parse-Color $pal.bgBot)
    )
    $blend.Positions = @(0.0, 0.36, 1.0)
    $bgBrush.InterpolationColors = $blend
    $G.FillPath($bgBrush, $innerPath)
    $bgBrush.Dispose()

    # Glow sutil superior no interior
    $G.SetClip($innerPath)
    $glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $glowPath.AddEllipse($ix - 30, $iy - 80, $iw + 60, 210)
    $glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath)
    $glowBrush.CenterColor = (Parse-Color $pal.accent 56)
    $glowBrush.SurroundColors = @((Parse-Color $pal.accent 0))
    $G.FillPath($glowBrush, $glowPath)
    $glowBrush.Dispose()
    $glowPath.Dispose()
    $G.ResetClip()

    # Borda dupla da raridade (externa escura + gradiente da raridade)
    $rarityGradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $innerRect, (Parse-Color $pal.accentBright), (Parse-Color $pal.accentDark), 90
    )
    $rarityPen = New-Object System.Drawing.Pen($rarityGradBrush, 2.4)
    $G.DrawPath($rarityPen, $innerPath)
    $rarityPen.Dispose()
    $rarityGradBrush.Dispose()

    $innerLinePath = New-ChamferPath ($ix + 3.5) ($iy + 3.5) ($iw - 7) ($ih - 7) 3.0
    $innerLinePen = New-Object System.Drawing.Pen((Parse-Color $pal.accentLight 95), 1.0)
    $G.DrawPath($innerLinePen, $innerLinePath)
    $innerLinePen.Dispose()
    $innerLinePath.Dispose()
    $innerPath.Dispose()

    # Cantoneiras ornamentais internas
    Draw-CornerFlourishes $G ($ix + 2) ($iy + 2) ($iw - 4) ($ih - 4) (Parse-Color $pal.accentLight 140)

    # 4) Fontes tipograficas 2D Dark Fantasy (serifada + Segoe UI suave)
    $serifCandidates = @("Palatino Linotype", "Georgia", "Cambria", "Constantia")
    $uiCandidates = @("Segoe UI", "Calibri", "Arial")

    $fTitle = New-FontSafe $serifCandidates 15.6 ([System.Drawing.FontStyle]::Bold)
    $fSub = New-FontSafe $serifCandidates 11.2 ([System.Drawing.FontStyle]::Regular)
    $fPowerNum = New-FontSafe $serifCandidates 27.5 ([System.Drawing.FontStyle]::Bold)
    $fPowerLbl = New-FontSafe $serifCandidates 10.6 ([System.Drawing.FontStyle]::Regular)
    $fPrimary = New-FontSafe $serifCandidates 14.8 ([System.Drawing.FontStyle]::Bold)
    $fAffix = New-FontSafe $uiCandidates 10.7 ([System.Drawing.FontStyle]::Regular)
    $fLeg = New-FontSafe $uiCandidates 10.2 ([System.Drawing.FontStyle]::Bold)
    $fFlavor = New-FontSafe $serifCandidates 9.9 ([System.Drawing.FontStyle]::Italic)
    $fFooter = New-FontSafe $uiCandidates 10.4 ([System.Drawing.FontStyle]::Bold)
    $fTag = New-FontSafe $uiCandidates 8.6 ([System.Drawing.FontStyle]::Bold)

    $sfCenter = New-Object System.Drawing.StringFormat
    $sfCenter.Alignment = [System.Drawing.StringAlignment]::Center
    $sfCenter.LineAlignment = [System.Drawing.StringAlignment]::Near

    $sfLeft = New-Object System.Drawing.StringFormat
    $sfLeft.Alignment = [System.Drawing.StringAlignment]::Near
    $sfLeft.LineAlignment = [System.Drawing.StringAlignment]::Near

    $sfRight = New-Object System.Drawing.StringFormat
    $sfRight.Alignment = [System.Drawing.StringAlignment]::Far
    $sfRight.LineAlignment = [System.Drawing.StringAlignment]::Near

    # 5) Cabecalho: Titulo + Subtitulo
    $contentX = $ix + 16
    $contentW = $iw - 32
    $curY = $iy + 22

    # Ajusta fonte do titulo caso nome seja muito longo
    $titleSize = $G.MeasureString($Card.name, $fTitle, [int]$contentW, $sfCenter)
    if ($titleSize.Height -gt 54) {
        $fTitle.Dispose()
        $fTitle = New-FontSafe $serifCandidates 13.8 ([System.Drawing.FontStyle]::Bold)
        $titleSize = $G.MeasureString($Card.name, $fTitle, [int]$contentW, $sfCenter)
    }

    $titleRect = New-Object System.Drawing.RectangleF($contentX, $curY, $contentW, ($titleSize.Height + 4))
    Draw-ShadowText $G $Card.name $fTitle (Parse-Color $pal.titleColor) $titleRect $sfCenter 1.8
    $curY += $titleSize.Height + 4

    $subRect = New-Object System.Drawing.RectangleF($contentX, $curY, $contentW, 24)
    Draw-ShadowText $G $Card.subtitle $fSub (Parse-Color $pal.subtitleColor) $subRect $sfCenter 1.2
    $curY += 26

    # 6) Caixa de Icone 2D + Poder do Item ao lado
    $iconBoxSize = 98.0
    $iconX = $contentX + 4
    $iconY = $curY + 2
    $iconRect = New-Object System.Drawing.RectangleF($iconX, $iconY, $iconBoxSize, $iconBoxSize)

    # Sombra da caixa do icone
    $icSh = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(145, 0, 0, 0))
    $G.FillRectangle($icSh, $iconX + 3, $iconY + 4, $iconBoxSize, $iconBoxSize)
    $icSh.Dispose()

    # Fundo gradiente da caixa do icone
    $icBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $iconRect, (Parse-Color $pal.iconBgTop), (Parse-Color $pal.iconBgBot), 90
    )
    $G.FillRectangle($icBg, $iconRect)
    $icBg.Dispose()

    # Halo radial suave atras do icone
    $ihPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $ihPath.AddEllipse($iconX + 4, $iconY + 4, $iconBoxSize - 8, $iconBoxSize - 8)
    $ihBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($ihPath)
    $ihBrush.CenterColor = (Parse-Color $pal.accent 92)
    $ihBrush.SurroundColors = @((Parse-Color $pal.accent 0))
    $G.FillPath($ihBrush, $ihPath)
    $ihBrush.Dispose()
    $ihPath.Dispose()

    # Sprite real recortado de ui_icons.png (HighQualityBicubic)
    $iconPad = 10.0
    $spriteDest = New-Object System.Drawing.RectangleF(
        ($iconX + $iconPad), ($iconY + $iconPad), ($iconBoxSize - $iconPad * 2), ($iconBoxSize - $iconPad * 2)
    )
    Draw-IconFromSheet $G $IconSheet ([int]$Card.iconFrame) $spriteDest

    # Borda metalica dupla da caixa do icone
    $icOuterPen = New-Object System.Drawing.Pen((Parse-Color "#0d1016"), 2.2)
    $G.DrawRectangle($icOuterPen, $iconX, $iconY, $iconBoxSize, $iconBoxSize)
    $icOuterPen.Dispose()

    $icRarityPen = New-Object System.Drawing.Pen((Parse-Color $pal.borderInner 220), 1.6)
    $G.DrawRectangle($icRarityPen, $iconX + 2, $iconY + 2, $iconBoxSize - 4, $iconBoxSize - 4)
    $icRarityPen.Dispose()

    # Engaste de gema no canto inferior direito
    Draw-GemSocket $G ($iconX + $iconBoxSize - 13.5) ($iconY + $iconBoxSize - 13.5) 10.2 $Card.gemColor

    # Bloco Poder do Item a direita da caixa de icone
    $powX = $iconX + $iconBoxSize + 14
    $powW = ($contentX + $contentW) - $powX
    $powNumRect = New-Object System.Drawing.RectangleF($powX, ($iconY + 6), $powW, 44)
    Draw-ShadowText $G ([string]$Card.itemPower) $fPowerNum (Parse-Color "#f8f4ec") $powNumRect $sfLeft 2.0

    $powLblRect = New-Object System.Drawing.RectangleF(($powX + 2), ($iconY + 48), $powW, 24)
    Draw-ShadowText $G "Poder do Item" $fPowerLbl (Parse-Color "#d8cebe") $powLblRect $sfLeft 1.2

    # Selo sutil de forca / raridade com cor propria da Forca
    $badgeText = if ($Card.forceLabel) { $Card.forceLabel.ToUpper() } else { $Card.rarityLabel.ToUpper() }
    $fb = $Card.forceBadge
    $badgeRect = New-Object System.Drawing.RectangleF(($powX + 2), ($iconY + 72), ($powW - 8), 20)
    $badgeBg = New-Object System.Drawing.SolidBrush((Parse-Color $fb.bg 165))
    $G.FillRectangle($badgeBg, $badgeRect)
    $badgeBg.Dispose()
    $badgePen = New-Object System.Drawing.Pen((Parse-Color $fb.border 195), 1.1)
    $G.DrawRectangle($badgePen, $badgeRect.X, $badgeRect.Y, $badgeRect.Width, $badgeRect.Height)
    $badgePen.Dispose()
    $sfBadge = New-Object System.Drawing.StringFormat
    $sfBadge.Alignment = [System.Drawing.StringAlignment]::Center
    $sfBadge.LineAlignment = [System.Drawing.StringAlignment]::Center
    Draw-ShadowText $G $badgeText $fTag (Parse-Color $fb.text) $badgeRect $sfBadge 1.0
    $sfBadge.Dispose()

    $curY = $iconY + $iconBoxSize + 18

    # 7) Divisor ornamental com losango central
    Draw-OrnamentalDivider $G $contentX $curY $contentW $pal.accent
    $curY += 15

    # 8) Atributo Primario em destaque
    $primRect = New-Object System.Drawing.RectangleF($contentX, $curY, $contentW, 30)
    Draw-ShadowText $G $Card.primaryStat $fPrimary (Parse-Color "#f7f1e5") $primRect $sfCenter 1.6
    $curY += 34

    # 9) Lista de Afixos com marcador losango vetorial
    $footerLimitY = $iy + $ih - 40
    $bulletX = $contentX + 7
    $textX = $contentX + 20
    $textW = $contentW - 22

    foreach ($line in $Card.affixLines) {
        $sz = $G.MeasureString($line, $fAffix, [int]$textW, $sfLeft)
        $lineH = [Math]::Max(20.0, [Math]::Ceiling($sz.Height))
        if (($curY + $lineH) -gt ($footerLimitY - 4)) { break }
        Draw-DiamondBullet $G $bulletX ($curY + 9.2) $pal.accentBright
        $r = New-Object System.Drawing.RectangleF($textX, $curY, $textW, ($lineH + 3))
        Draw-ShadowText $G $line $fAffix (Parse-Color "#ebe6dc") $r $sfLeft 1.2
        $curY += $lineH + 5
    }

    # 10) Aspecto Lendario com marcador estrela dourada vetorial
    if ($Card.legendaryText -and $Card.legendaryText.Length -gt 0) {
        $curY += 4
        # Linha divisoria sutil antes do aspecto lendario
        $subDivPen = New-Object System.Drawing.Pen((Parse-Color $pal.accent 90), 1.0)
        $G.DrawLine($subDivPen, $contentX + 10, $curY, $contentX + $contentW - 10, $curY)
        $subDivPen.Dispose()
        $curY += 8

        $availH = $footerLimitY - $curY
        if ($availH -gt 32) {
            $legSz = $G.MeasureString($Card.legendaryText, $fLeg, [int]$textW, $sfLeft)
            if ($legSz.Height -gt $availH) {
                $fLeg.Dispose()
                $fLeg = New-FontSafe $uiCandidates 9.1 ([System.Drawing.FontStyle]::Bold)
                $legSz = $G.MeasureString($Card.legendaryText, $fLeg, [int]$textW, $sfLeft)
            }
            Draw-StarBullet $G ($bulletX + 1) ($curY + 8.8)
            $legRect = New-Object System.Drawing.RectangleF($textX, $curY, $textW, ([Math]::Min($availH, $legSz.Height + 6)))
            Draw-ShadowText $G $Card.legendaryText $fLeg (Parse-Color "#fb923c") $legRect $sfLeft 1.3
            $curY += $legSz.Height + 6
        }
    } elseif ($Card.flavorText -and ($footerLimitY - $curY) -gt 54) {
        # Descricao flavor em italico sutil para enriquecer cards nao-lendarios
        $curY += 8
        $subDivPen = New-Object System.Drawing.Pen((Parse-Color $pal.accent 65), 1.0)
        $G.DrawLine($subDivPen, $contentX + 20, $curY, $contentX + $contentW - 20, $curY)
        $subDivPen.Dispose()
        $curY += 10

        $availH = $footerLimitY - $curY - 4
        $flRect = New-Object System.Drawing.RectangleF(($contentX + 4), $curY, ($contentW - 8), $availH)
        $quoted = '"' + $Card.flavorText + '"'
        Draw-ShadowText $G $quoted $fFlavor (Parse-Color "#9fa8b7") $flRect $sfCenter 1.0
    }

    # 11) Rodape: Nivel Requerido
    $reqText = "Nível Requerido: $($Card.requiredLevel)"
    $reqRect = New-Object System.Drawing.RectangleF($contentX, ($iy + $ih - 32), $contentW, 22)
    Draw-ShadowText $G $reqText $fFooter (Parse-Color "#dcd4c6") $reqRect $sfRight 1.3

    # 12) Emblema Superior + Cranio no Rodape
    $topCx = $X + $W / 2.0
    $topCy = $Y + 5.0
    if ($pal.emblem -eq "star") {
        Draw-OrnateStarEmblem $G $topCx $topCy 21.0
    } elseif ($pal.emblem -eq "skull") {
        Draw-OrnateSkullEmblem $G $topCx $topCy 0.96 $pal.accent
    } else {
        Draw-CommonCrestEmblem $G $topCx $topCy 15.0
    }

    # Cranio no rodape
    Draw-OrnateSkullEmblem $G $topCx ($Y + $H - 4.0) 0.88 $pal.borderOuter

    # Dispose fontes e formatos
    $fTitle.Dispose(); $fSub.Dispose(); $fPowerNum.Dispose(); $fPowerLbl.Dispose()
    $fPrimary.Dispose(); $fAffix.Dispose(); $fLeg.Dispose(); $fFlavor.Dispose()
    $fFooter.Dispose(); $fTag.Dispose()
    $sfCenter.Dispose(); $sfLeft.Dispose(); $sfRight.Dispose()
}

function Draw-EquipmentPanel {
    param(
        [System.Drawing.Graphics]$G,
        [System.Drawing.Bitmap]$IconSheet,
        $Panel,
        [float]$X,
        [float]$Y,
        [float]$W,
        [float]$H
    )

    $cut = 8.0
    Draw-DropShadow $G $X $Y $W $H $cut

    # Moldura externa metalica
    $outerPath = New-ChamferPath $X $Y $W $H $cut
    $outerRect = New-Object System.Drawing.RectangleF($X, $Y, $W, $H)
    $outerBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $outerRect, (Parse-Color "#3c434d"), (Parse-Color "#171b20"), 90
    )
    $G.FillPath($outerBrush, $outerPath)
    $outerBrush.Dispose()

    $pBlack = New-Object System.Drawing.Pen((Parse-Color "#080a0e"), 2.2)
    $G.DrawPath($pBlack, $outerPath)
    $pBlack.Dispose()
    $outerPath.Dispose()

    # Fundo interno ardosia sombria
    $pad = 8.0
    $ix = $X + $pad
    $iy = $Y + $pad
    $iw = $W - $pad * 2
    $ih = $H - $pad * 2
    $innerPath = New-ChamferPath $ix $iy $iw $ih 4.0
    $innerRect = New-Object System.Drawing.RectangleF($ix, $iy, $iw, $ih)
    $inBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $innerRect, (Parse-Color "#232a32"), (Parse-Color "#14181e"), 90
    )
    $G.FillPath($inBrush, $innerPath)
    $inBrush.Dispose()

    $inPen = New-Object System.Drawing.Pen((Parse-Color "#525c6b"), 1.6)
    $G.DrawPath($inPen, $innerPath)
    $inPen.Dispose()
    $innerPath.Dispose()

    # Header bar
    $hdrH = 44.0
    $hdrRect = New-Object System.Drawing.RectangleF(($ix + 2), ($iy + 2), ($iw - 4), $hdrH)
    $hdrBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $hdrRect, (Parse-Color "#2d343d"), (Parse-Color "#1a1f26"), 90
    )
    $G.FillRectangle($hdrBrush, $hdrRect)
    $hdrBrush.Dispose()

    $hdrBorder = New-Object System.Drawing.Pen((Parse-Color "#7c5838"), 1.6)
    $G.DrawRectangle($hdrBorder, $hdrRect.X, $hdrRect.Y, $hdrRect.Width, $hdrRect.Height)
    $hdrBorder.Dispose()

    # Fontes do painel
    $serifCandidates = @("Palatino Linotype", "Georgia", "Cambria")
    $uiCandidates = @("Segoe UI", "Calibri", "Arial")
    $fHdr = New-FontSafe $serifCandidates 16.0 ([System.Drawing.FontStyle]::Bold)
    $fSlot = New-FontSafe $serifCandidates 10.2 ([System.Drawing.FontStyle]::Bold)
    $fStat = New-FontSafe $uiCandidates 11.4 ([System.Drawing.FontStyle]::Bold)

    $sfCenter = New-Object System.Drawing.StringFormat
    $sfCenter.Alignment = [System.Drawing.StringAlignment]::Center
    $sfCenter.LineAlignment = [System.Drawing.StringAlignment]::Center

    # Titulo EQUIPAMENTO
    $titleRect = New-Object System.Drawing.RectangleF(($hdrRect.X + 8), $hdrRect.Y, ($hdrRect.Width - 40), $hdrRect.Height)
    Draw-ShadowText $G $Panel.title $fHdr (Parse-Color "#f3e3b8") $titleRect $sfCenter 1.6

    # Botao Fechar X
    $btnSize = 28.0
    $btnX = $hdrRect.Right - $btnSize - 7
    $btnY = $hdrRect.Y + ($hdrH - $btnSize) / 2.0
    $btnRect = New-Object System.Drawing.RectangleF($btnX, $btnY, $btnSize, $btnSize)
    $btnBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $btnRect, (Parse-Color "#8a2929"), (Parse-Color "#4b1212"), 90
    )
    $G.FillRectangle($btnBrush, $btnRect)
    $btnBrush.Dispose()
    $btnPen = New-Object System.Drawing.Pen((Parse-Color "#c77d63"), 1.3)
    $G.DrawRectangle($btnPen, $btnX, $btnY, $btnSize, $btnSize)
    $btnPen.Dispose()
    $xPen = New-Object System.Drawing.Pen((Parse-Color "#f8e8d8"), 2.2)
    $xPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $xPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $G.DrawLine($xPen, $btnX + 7.5, $btnY + 7.5, $btnX + $btnSize - 7.5, $btnY + $btnSize - 7.5)
    $G.DrawLine($xPen, $btnX + $btnSize - 7.5, $btnY + 7.5, $btnX + 7.5, $btnY + $btnSize - 7.5)
    $xPen.Dispose()

    # Floreio ornamental abaixo da barra de cabecalho
    $hMidX = $ix + $iw / 2.0
    $hBotY = $hdrRect.Bottom
    $flPts = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF(($hMidX - 24), $hBotY)),
        (New-Object System.Drawing.PointF(($hMidX - 8), ($hBotY + 5))),
        (New-Object System.Drawing.PointF($hMidX, ($hBotY + 10))),
        (New-Object System.Drawing.PointF(($hMidX + 8), ($hBotY + 5))),
        (New-Object System.Drawing.PointF(($hMidX + 24), $hBotY))
    )
    $flB = New-Object System.Drawing.SolidBrush((Parse-Color "#1e242c"))
    $G.FillPolygon($flB, $flPts)
    $flB.Dispose()
    $flP = New-Object System.Drawing.Pen((Parse-Color "#6b7788" 190), 1.1)
    $G.DrawPolygon($flP, $flPts)
    $flP.Dispose()

    # Cantoneiras internas do corpo
    Draw-CornerFlourishes $G ($ix + 4) ($iy + $hdrH + 6) ($iw - 8) ($ih - $hdrH - 10) (Parse-Color "#6b7788" 130)

    # Grade 2x3 de slots
    $slotBox = 84.0
    $colGap = 54.0
    $gridW = $slotBox * 2 + $colGap
    $startX = $ix + ($iw - $gridW) / 2.0
    $startY = $iy + $hdrH + 16
    $rowStep = 114.0

    for ($idx = 0; $idx -lt $Panel.slots.Count; $idx++) {
        $sl = $Panel.slots[$idx]
        $spal = $sl.palette
        $col = $idx % 2
        $row = [int][Math]::Floor($idx / 2)

        $sx = $startX + $col * ($slotBox + $colGap)
        $sy = $startY + $row * $rowStep

        # Rotulo do slot acima da caixa
        $lblRect = New-Object System.Drawing.RectangleF(($sx - 18), $sy, ($slotBox + 36), 20)
        Draw-ShadowText $G $sl.label $fSlot (Parse-Color $spal.titleColor) $lblRect $sfCenter 1.3

        $bx = $sx
        $by = $sy + 23
        $bRect = New-Object System.Drawing.RectangleF($bx, $by, $slotBox, $slotBox)

        # Sombra do slot
        $sSh = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(145, 0, 0, 0))
        $G.FillRectangle($sSh, $bx + 3, $by + 4, $slotBox, $slotBox)
        $sSh.Dispose()

        # Pequenos ornamentos laterais (losangos de engate como na referencia)
        $lugBrush = New-Object System.Drawing.SolidBrush((Parse-Color "#454f5e"))
        $midSlotY = $by + $slotBox / 2.0
        $lugL = [System.Drawing.PointF[]]@(
            (New-Object System.Drawing.PointF(($bx - 6), $midSlotY)),
            (New-Object System.Drawing.PointF($bx, ($midSlotY - 6))),
            (New-Object System.Drawing.PointF($bx, ($midSlotY + 6)))
        )
        $lugR = [System.Drawing.PointF[]]@(
            (New-Object System.Drawing.PointF(($bx + $slotBox + 6), $midSlotY)),
            (New-Object System.Drawing.PointF(($bx + $slotBox), ($midSlotY - 6))),
            (New-Object System.Drawing.PointF(($bx + $slotBox), ($midSlotY + 6)))
        )
        $G.FillPolygon($lugBrush, $lugL)
        $G.FillPolygon($lugBrush, $lugR)
        $lugBrush.Dispose()

        # Moldura externa metalica do slot
        $slotFrame = New-Object System.Drawing.SolidBrush((Parse-Color "#2a313b"))
        $G.FillRectangle($slotFrame, $bx - 3, $by - 3, $slotBox + 6, $slotBox + 6)
        $slotFrame.Dispose()
        $slotOutPen = New-Object System.Drawing.Pen((Parse-Color "#0c0f14"), 1.6)
        $G.DrawRectangle($slotOutPen, $bx - 3, $by - 3, $slotBox + 6, $slotBox + 6)
        $slotOutPen.Dispose()

        # Fundo gradiente da raridade
        $sBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
            $bRect, (Parse-Color $spal.bgTop), (Parse-Color $spal.iconBgBot), 90
        )
        $G.FillRectangle($sBg, $bRect)
        $sBg.Dispose()

        # Halo radial suave
        $shP = New-Object System.Drawing.Drawing2D.GraphicsPath
        $shP.AddEllipse($bx + 4, $by + 4, $slotBox - 8, $slotBox - 8)
        $shB = New-Object System.Drawing.Drawing2D.PathGradientBrush($shP)
        $shB.CenterColor = (Parse-Color $spal.accent 85)
        $shB.SurroundColors = @((Parse-Color $spal.accent 0))
        $G.FillPath($shB, $shP)
        $shB.Dispose()
        $shP.Dispose()

        # Sprite real recortado
        $ip = 9.0
        $dRect = New-Object System.Drawing.RectangleF(($bx + $ip), ($by + $ip), ($slotBox - $ip * 2), ($slotBox - $ip * 2))
        Draw-IconFromSheet $G $IconSheet ([int]$sl.iconFrame) $dRect

        # Borda da raridade
        $rPen = New-Object System.Drawing.Pen((Parse-Color $spal.borderInner 230), 2.0)
        $G.DrawRectangle($rPen, $bx + 1, $by + 1, $slotBox - 2, $slotBox - 2)
        $rPen.Dispose()

        # Engaste de gema no canto inferior direito
        Draw-GemSocket $G ($bx + $slotBox - 11.5) ($by + $slotBox - 11.5) 8.4 $sl.gemColor
    }

    # Caixa de resumo de atributos no rodape do painel
    $sumW = $iw - 34
    $sumH = 92.0
    $sumX = $ix + 17
    $sumY = $iy + $ih - $sumH - 20
    $sumRect = New-Object System.Drawing.RectangleF($sumX, $sumY, $sumW, $sumH)

    $sumBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $sumRect, (Parse-Color "#241d19"), (Parse-Color "#161311"), 90
    )
    $G.FillRectangle($sumBg, $sumRect)
    $sumBg.Dispose()

    $sumPenOut = New-Object System.Drawing.Pen((Parse-Color "#0a0b0e"), 2.0)
    $G.DrawRectangle($sumPenOut, $sumX - 2, $sumY - 2, $sumW + 4, $sumH + 4)
    $sumPenOut.Dispose()

    $sumPen = New-Object System.Drawing.Pen((Parse-Color "#7d593a"), 2.0)
    $G.DrawRectangle($sumPen, $sumX, $sumY, $sumW, $sumH)
    $sumPen.Dispose()

    $sumPenIn = New-Object System.Drawing.Pen((Parse-Color "#a67c52" 110), 1.0)
    $G.DrawRectangle($sumPenIn, $sumX + 3, $sumY + 3, $sumW - 6, $sumH - 6)
    $sumPenIn.Dispose()

    # Cranio ornamentado no topo da caixa de resumo
    Draw-OrnateSkullEmblem $G ($sumX + $sumW / 2.0) ($sumY - 1.0) 0.78 "#a67c52"

    # Linhas de atributos totais
    $statY = $sumY + 18
    foreach ($st in $Panel.stats) {
        $stRect = New-Object System.Drawing.RectangleF(($sumX + 8), $statY, ($sumW - 16), 24)
        Draw-ShadowText $G $st $fStat (Parse-Color "#efe8db") $stRect $sfCenter 1.3
        $statY += 24
    }

    # Barra de detalhe ornamental na base
    $barW = $iw * 0.48
    $barX = $ix + ($iw - $barW) / 2.0
    $barY = $iy + $ih - 11
    $barBg = New-Object System.Drawing.SolidBrush((Parse-Color "#141820"))
    $G.FillRectangle($barBg, $barX, $barY, $barW, 5)
    $barBg.Dispose()
    $barFill = New-Object System.Drawing.SolidBrush((Parse-Color "#7a8698"))
    $G.FillRectangle($barFill, $barX + 1, $barY + 1, $barW * 0.52, 3)
    $barFill.Dispose()
    $barPen = New-Object System.Drawing.Pen((Parse-Color "#475569"), 1.0)
    $G.DrawRectangle($barPen, $barX, $barY, $barW, 5)
    $barPen.Dispose()

    $fHdr.Dispose(); $fSlot.Dispose(); $fStat.Dispose(); $sfCenter.Dispose()
}

# Carrega spritesheet de icones 2D
$iconSheet = [System.Drawing.Bitmap]::FromFile($spec.iconsPath)

try {
    $cardW = 326
    $cardH = 546

    if ($spec.mode -eq "showcase") {
        $panelW = 330
        $panelH = 546
        $marginX = 28
        $topPad = 42
        $botPad = 36
        $panelGap = 24
        $cardGap = 18

        $numCards = $spec.cards.Count
        $canvasW = [int]($marginX * 2 + $panelW + $panelGap + ($cardW * $numCards) + ($cardGap * [Math]::Max(0, $numCards - 1)))
        $canvasH = [int]($topPad + $cardH + $botPad)

        $bmp = New-Object System.Drawing.Bitmap($canvasW, $canvasH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

        Draw-DungeonBackdrop $g $canvasW $canvasH

        # Painel EQUIPAMENTO a esquerda
        Draw-EquipmentPanel $g $iconSheet $spec.panel $marginX $topPad $panelW $panelH

        # 4 Cards lado a lado
        $cx = $marginX + $panelW + $panelGap
        foreach ($card in $spec.cards) {
            Draw-ItemCard $g $iconSheet $card $cx $topPad $cardW $cardH
            $cx += $cardW + $cardGap
        }
    } else {
        $marginX = 34
        $topPad = 42
        $botPad = 36
        $canvasW = [int]($cardW + $marginX * 2)
        $canvasH = [int]($cardH + $topPad + $botPad)

        $bmp = New-Object System.Drawing.Bitmap($canvasW, $canvasH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

        Draw-DungeonBackdrop $g $canvasW $canvasH
        Draw-ItemCard $g $iconSheet $spec.cards[0] $marginX $topPad $cardW $cardH
    }

    $outDir = [System.IO.Path]::GetDirectoryName($spec.outPath)
    if ($outDir -and -not (Test-Path $outDir)) {
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    }
    $bmp.Save($spec.outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Output "OK:$($spec.outPath):$($canvasW)x$($canvasH)"
}
finally {
    $iconSheet.Dispose()
}
'''


def render_with_powershell(spec: Dict[str, Any]) -> Tuple[Path, str]:
    with tempfile.TemporaryDirectory(prefix="submundo_uicard_") as tmp_dir:
        tmp = Path(tmp_dir)
        spec_path = tmp / "spec.json"
        ps_path = tmp / "render.ps1"

        spec_path.write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8")
        ps_path.write_text(POWERSHELL_RENDERER, encoding="utf-8-sig")

        cmd = [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(ps_path),
            "-SpecPath",
            str(spec_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if result.returncode != 0:
            raise RuntimeError(
                f"Falha ao renderizar via PowerShell System.Drawing (exit {result.returncode}):\n"
                f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
            )

        out_dims = ""
        for line in result.stdout.splitlines():
            if line.startswith("OK:"):
                out_dims = line.split(":")[-1].strip()
        return Path(spec["outPath"]), out_dims


def resolve_single_item(
    items: Sequence[Dict[str, Any]],
    item_id: Optional[str],
    slot: Optional[str],
) -> Dict[str, Any]:
    if item_id:
        for it in items:
            if it["id"] == item_id:
                if slot and it["slot"] != slot:
                    raise ValueError(
                        f"Item '{item_id}' pertence ao slot '{it['slot']}', nao a '{slot}'."
                    )
                return it
        available = ", ".join(it["id"] for it in items[:8]) + "..."
        raise ValueError(f"Item '{item_id}' nao encontrado em src/data/items.json (ex.: {available})")

    if slot:
        matches = [it for it in items if it["slot"] == slot]
        if not matches:
            raise ValueError(f"Nenhum item encontrado para o slot '{slot}'.")
        # Prefere um item elemental se existir para visual mais rico
        elemental = [it for it in matches if it.get("force", "none") != "none"]
        return elemental[0] if elemental else matches[0]

    return items[0]


def infer_default_rarity(item: Dict[str, Any]) -> str:
    force = item.get("force", "none")
    if force == "none":
        return "common"
    return "rare"


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Gerador 2D Dark Fantasy de UI (Painel Equipamento + Cards de Itens) do SUBMUNDO."
    )
    parser.add_argument(
        "--showcase",
        action="store_true",
        help="Gera a prancha completa com painel EQUIPAMENTO (6 slots 2x3) + 4 cards das 4 raridades.",
    )
    parser.add_argument(
        "--item-id",
        type=str,
        default=None,
        help="ID do item em src/data/items.json para gerar card individual.",
    )
    parser.add_argument(
        "--rarity",
        type=str,
        default=None,
        help="Forca a raridade do card: common | magic | rare | legendary.",
    )
    parser.add_argument(
        "--slot",
        type=str,
        choices=sorted(SLOT_ICON_FRAME.keys()),
        default=None,
        help="Filtra item por slot: weapon | armor | helm | boots | amulet | ring.",
    )
    parser.add_argument(
        "--out",
        type=str,
        default=None,
        help="Caminho PNG de saida customizado.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Semente deterministica para escolha de afixos (padrao: 42).",
    )
    parser.add_argument(
        "--level",
        type=int,
        default=None,
        help="Nivel requerido customizado para card individual.",
    )
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    items, affixes, legendary_powers = load_game_data()

    rarity = normalize_rarity(args.rarity)

    # Se nenhum modo/filtro foi informado, gera showcase por padrao
    is_showcase = args.showcase or (args.item_id is None and args.slot is None and rarity is None)

    if is_showcase:
        out_path = Path(args.out) if args.out else DEFAULT_SHOWCASE_OUT
        spec = build_showcase_spec(items, affixes, legendary_powers, out_path, seed=args.seed)
    else:
        item = resolve_single_item(items, args.item_id, args.slot)
        effective_rarity = rarity or infer_default_rarity(item)
        default_single_out = ROOT / "assets" / "mockups" / f"card_{item['id']}_{effective_rarity}.png"
        out_path = Path(args.out) if args.out else default_single_out
        spec = build_single_card_spec(
            item,
            effective_rarity,
            affixes,
            legendary_powers,
            out_path,
            seed=args.seed,
            override_level=args.level,
        )

    saved_path, dims = render_with_powershell(spec)
    print(f"[uiCardGenerator] Gerado: {saved_path} ({dims})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
