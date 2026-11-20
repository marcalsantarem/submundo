"""
SUBMUNDO - Gera os 4 biomas subterraneos (BRF-137 / T-072, grupo `under_`).

Uso:
  python scripts/art/biomes/under_build.py                 # todos
  python scripts/art/biomes/under_build.py village_mine    # um ou mais ids
  python scripts/art/biomes/under_build.py --no-mockup ... # so sheets + prancha

Saidas por bioma <id>: public/assets/sprites/biome_<id>_{tiles,doors,props,props_tall}.png,
scripts/art/biomes/out/<id>.manifest.json, assets/mockups/preview_m8_<id>_sheets.png e
assets/mockups/mockup_m8_<id>.png. Deterministico (sem aleatoriedade fora de seeds fixas).
"""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from under_kit import MOCKUPS_DIR, build_preview, write_outputs  # noqa: E402
from under_mockup import render_mockup, render_sample  # noqa: E402

BIOMES = ("village_mine", "mine_depths", "ancient_seal", "submundo_abyss")


def build(biome_id: str, mockup: bool = True) -> None:
    mod = importlib.import_module(f"under_{biome_id}")
    b = mod.BIOME()
    tiles, doors, props, tall = write_outputs(b)
    sample = render_sample(b, tiles, doors, props, tall)
    out = MOCKUPS_DIR / f"preview_m8_{b.id}_sheets.png"
    build_preview(b, tiles, doors, props, tall, sample, out)
    print(f"Gerado: {out}")
    if mockup:
        render_mockup(b, tiles, doors, props, tall)


def main(argv) -> None:
    mockup = "--no-mockup" not in argv
    ids = [a for a in argv if not a.startswith("--")] or list(BIOMES)
    for i in ids:
        if i not in BIOMES:
            raise SystemExit(f"bioma desconhecido: {i}")
        build(i, mockup)


if __name__ == "__main__":
    main(sys.argv[1:])
