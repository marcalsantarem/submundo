"""
SUBMUNDO - Regera todos os biomas de superficie (BRF-138 / T-131): sheets, manifests parciais,
pranchas e mockups de village, herb_field e village_grotto. Deterministico.

Uso: python scripts/art/biomes/surf_build_all.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import surf_herb_field  # noqa: E402
import surf_mockup  # noqa: E402
import surf_village  # noqa: E402
import surf_village_grotto  # noqa: E402


def main() -> None:
    surf_village.main()
    surf_herb_field.main()
    surf_village_grotto.main()
    surf_mockup.main([])


if __name__ == "__main__":
    main()
