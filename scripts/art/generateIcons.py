#!/usr/bin/env python3
"""Gera os ícones oficiais do app SUBMUNDO a partir da arte-mestre."""

from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageFilter

ROOT_DIR = Path(__file__).resolve().parents[2]
MASTER_PATH = ROOT_DIR / "assets" / "icons" / "submundo_icon_master.png"
OUTPUT_DIR = ROOT_DIR / "public" / "icons"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"

ICON_SPECS: tuple[tuple[str, int, bool], ...] = (
    ("icon-512.png", 512, False),
    ("icon-192.png", 192, True),
    ("apple-touch-icon.png", 180, True),
)


def ensure_opaque_rgb(image: Image.Image) -> Image.Image:
    """Garante fundo opaco full-bleed (RGB) sem canal alfa."""
    if image.mode == "RGB":
        return image
    if image.mode in ("RGBA", "LA") or "transparency" in image.info:
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, (9, 9, 11))
        background.paste(rgba, mask=rgba.getchannel("A"))
        return background
    return image.convert("RGB")


def generate_icons() -> None:
    if not MASTER_PATH.exists():
        raise FileNotFoundError(f"Arte-mestre não encontrada: {MASTER_PATH}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with Image.open(MASTER_PATH) as src:
        master = ensure_opaque_rgb(src)
        if master.width != master.height:
            raise ValueError(
                f"Arte-mestre deve ser quadrada, recebido {master.width}x{master.height}"
            )

        for filename, size, sharpen in ICON_SPECS:
            resized = master.resize((size, size), Image.Resampling.LANCZOS)
            if sharpen:
                resized = resized.filter(
                    ImageFilter.UnsharpMask(radius=0.8, percent=45, threshold=3)
                )

            out_path = OUTPUT_DIR / filename
            resized.save(out_path, format="PNG", optimize=True)

            with out_path.open("rb") as fh:
                header = fh.read(8)
            if header != PNG_SIGNATURE:
                raise ValueError(f"Assinatura PNG inválida em {out_path}")

            with Image.open(out_path) as check:
                if check.size != (size, size) or check.mode != "RGB":
                    raise ValueError(
                        f"Dimensão/modo inválido em {out_path}: {check.size} {check.mode}"
                    )

            print(f"OK {out_path.relative_to(ROOT_DIR)} ({size}x{size} RGB, {out_path.stat().st_size} bytes)")


if __name__ == "__main__":
    generate_icons()
