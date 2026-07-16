#!/usr/bin/env python3
"""Generate the app icon set (VI.1) from one molecule definition.

    python3 scripts/gen-icons.py

VI.1 wants an icon "in accordance with the theme (molecular/scientific)" at every
resolution the platform needs. The subject is a ball-and-stick viewer, so the mark
is a ball-and-stick molecule: a central atom bonded to three others, lit from the
top-left and shaded the same way the viewer shades its spheres.

Everything derives from ATOMS/BONDS below, so the launcher icon, the Android
adaptive layers, the splash mark and the favicon can never drift apart. Colours
are the app's own palette (src/theme/theme.ts), which is what makes the native
launch screen and the in-app splash read as one app.

Android masks adaptive icons to an unknown shape and only guarantees the middle
~66%, so the foreground and monochrome layers are drawn smaller than the square
launcher icon rather than being cropped by the mask.
"""

from pathlib import Path

import numpy as np
from PIL import Image

SIZE = 1024

# src/theme/theme.ts
BG = np.array([0x0A, 0x0E, 0x17], dtype=float)
CYAN = np.array([0x22, 0xD3, 0xEE], dtype=float)
VIOLET = np.array([0x8B, 0x7C, 0xF6], dtype=float)
WHITE = np.array([0xE8, 0xED, 0xF6], dtype=float)
BOND_COLOR = np.array([0x3B, 0x4A, 0x6B], dtype=float)

# Normalised molecule: a central atom with three bonded atoms at 120 degrees.
# Positioned and scaled to the canvas at render time, so these are pure geometry.
ATOMS = [
    ((0.0, 0.0), 0.215, CYAN),
    ((0.0, -0.46), 0.14, VIOLET),
    ((-0.398, 0.23), 0.14, WHITE),
    ((0.398, 0.23), 0.14, VIOLET),
]
BONDS = [(0, 1), (0, 2), (0, 3)]
BOND_RADIUS = 0.043

# Toward the light, in image coordinates: -y is up, +z is toward the viewer.
LIGHT = np.array([-0.40, -0.50, 0.77])
LIGHT /= np.linalg.norm(LIGHT)


def _place(size: int, fill: float):
    """Scale/offset the normalised molecule so it fills `fill` of a `size` canvas."""
    xs = [x for (x, _), r, _ in ATOMS for x in (x - r, x + r)]
    ys = [y for (_, y), r, _ in ATOMS for y in (y - r, y + r)]
    span = max(max(xs) - min(xs), max(ys) - min(ys))
    scale = size * fill / span
    cx = (max(xs) + min(xs)) / 2
    cy = (max(ys) + min(ys)) / 2
    return scale, size / 2 - cx * scale, size / 2 - cy * scale


def _over(dst_rgb, dst_a, src_rgb, src_a):
    """Composite src over dst; both alphas are (h, w), both colours (h, w, 3)."""
    out_a = src_a + dst_a * (1 - src_a)
    sa = src_a[..., None]
    da = dst_a[..., None]
    out_rgb = (src_rgb * sa + dst_rgb * da * (1 - sa)) / np.maximum(out_a[..., None], 1e-6)
    return out_rgb, out_a


def render(size: int, fill: float, opaque: bool, mono: bool = False, molecule: bool = True) -> Image.Image:
    scale, ox, oy = _place(size, fill)
    py, px = np.mgrid[0:size, 0:size].astype(float)
    px += 0.5
    py += 0.5

    def to_px(p):
        return p[0] * scale + ox, p[1] * scale + oy

    if opaque:
        # A faint cyan bloom behind the mark, so the icon is not a flat block.
        d = np.hypot(px - size / 2, py - size / 2) / (size * 0.55)
        glow = np.clip(1 - d, 0, 1) ** 2.2 * 0.10
        rgb = BG + (CYAN - BG) * glow[..., None]
        alpha = np.ones((size, size))
    else:
        rgb = np.zeros((size, size, 3))
        alpha = np.zeros((size, size))

    if not molecule:
        return Image.fromarray(
            np.concatenate([np.clip(rgb, 0, 255), (alpha * 255)[..., None]], axis=2).astype(np.uint8),
            mode="RGBA",
        )

    # Bonds first: the spheres are drawn over their ends.
    for i, j in BONDS:
        ax, ay = to_px(ATOMS[i][0])
        bx, by = to_px(ATOMS[j][0])
        dx, dy = bx - ax, by - ay
        t = np.clip(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1)
        dist = np.hypot(px - (ax + t * dx), py - (ay + t * dy))
        # +0.5 gives a one-pixel coverage ramp -- antialiasing without supersampling.
        bond_a = np.clip(BOND_RADIUS * scale - dist + 0.5, 0, 1)
        bond_rgb = np.ones((size, size, 3)) * (255.0 if mono else BOND_COLOR)
        rgb, alpha = _over(rgb, alpha, bond_rgb, bond_a)

    for (cx, cy), r, color in ATOMS:
        cx, cy = to_px((cx, cy))
        rp = r * scale
        nx = (px - cx) / rp
        ny = (py - cy) / rp
        nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0, 1))
        sphere_a = np.clip(rp - np.hypot(px - cx, py - cy) + 0.5, 0, 1)
        if mono:
            # Themed icons are a flat silhouette; the system tints them.
            sphere_rgb = np.ones((size, size, 3)) * 255.0
        else:
            ndotl = np.clip(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2], 0, 1)
            shade = 0.30 + 0.78 * ndotl
            spec = 0.85 * ndotl**28
            sphere_rgb = np.clip(color * shade[..., None] + 255.0 * spec[..., None], 0, 255)
        rgb, alpha = _over(rgb, alpha, sphere_rgb, sphere_a)

    out = np.concatenate([np.clip(rgb, 0, 255), (alpha * 255)[..., None]], axis=2)
    return Image.fromarray(out.astype(np.uint8), mode="RGBA")


def main() -> None:
    assets = Path(__file__).resolve().parent.parent / "assets"

    # The opaque layers drop their alpha channel: iOS rejects an app icon that
    # has one, and the launcher icon is this file.
    icon = render(SIZE, fill=0.74, opaque=True).convert("RGB")
    icon.save(assets / "icon.png")
    icon.resize((48, 48), Image.LANCZOS).save(assets / "favicon.png")

    # expo-splash-screen draws this over its own backgroundColor (app.json).
    render(SIZE, fill=0.82, opaque=False).save(assets / "splash-icon.png")

    # Adaptive layers: the mask can crop to a circle, so keep the mark well
    # inside the guaranteed-visible middle and let the background carry the rest.
    render(SIZE, fill=0.58, opaque=False).save(assets / "android-icon-foreground.png")
    render(SIZE, fill=0.58, opaque=True, molecule=False).convert("RGB").save(
        assets / "android-icon-background.png"
    )
    render(SIZE, fill=0.58, opaque=False, mono=True).save(assets / "android-icon-monochrome.png")

    for f in sorted(assets.glob("*.png")):
        print(f"{f.name}: {Image.open(f).size[0]}px")


if __name__ == "__main__":
    main()
