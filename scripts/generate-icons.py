#!/usr/bin/env python3
"""Generate Sugar Coat Bakers logo assets.

- In-app / favicon: transparent background (black corners removed)
- Home-screen / install icons: white background + padding (iOS needs opaque icons)
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "assets"
SOURCE = ROOT / "logo.jpg"
BLACK_THRESHOLD = 40


def load_logo_rgba() -> Image.Image:
    return Image.open(SOURCE).convert("RGBA")


def strip_black_corners(img: Image.Image) -> Image.Image:
    out = img.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if r <= BLACK_THRESHOLD and g <= BLACK_THRESHOLD and b <= BLACK_THRESHOLD:
                px[x, y] = (0, 0, 0, 0)
    return out


def fit_with_padding(
    logo: Image.Image,
    size: int,
    padding_ratio: float,
    background: str | None,
) -> Image.Image:
    """background=None → transparent canvas; background='#ffffff' → white canvas."""
    pad = int(round(size * padding_ratio))
    inner = max(size - pad * 2, 1)
    fitted = logo.copy()
    fitted.thumbnail((inner, inner), Image.Resampling.LANCZOS)

    if background:
        canvas = Image.new("RGB", (size, size), background)
        layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    else:
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        layer = canvas

    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    layer.paste(fitted, (x, y), fitted)

    if background:
        canvas.paste(layer, (0, 0), layer)
        return canvas
    return layer


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=True)
    print(f"  {path.name} ({img.width}x{img.height})")


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Missing source logo: {SOURCE}")

    logo = strip_black_corners(load_logo_rgba())
    save_png(logo, ROOT / "logo.png")

    # Browser favicons — transparent, slight padding
    for size in (16, 32, 48):
        save_png(fit_with_padding(logo, size, 0.08, None), ROOT / f"favicon-{size}.png")

    # Install / home-screen icons — white + padding (iOS treats transparency as black)
    install_specs = [
        ("apple-touch-icon.png", 180, 0.14),
        ("icon-192.png", 192, 0.14),
        ("icon-512.png", 512, 0.14),
        ("icon-maskable-512.png", 512, 0.20),
    ]
    for name, size, pad in install_specs:
        save_png(fit_with_padding(logo, size, pad, "#ffffff"), ROOT / name)

    print("Done.")


if __name__ == "__main__":
    main()
