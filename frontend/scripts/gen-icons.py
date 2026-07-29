#!/usr/bin/env python3
"""Generate the app icon set (VI.1) from one molecule definition.

    python3 scripts/gen-icons.py          # needs numpy + pillow, ~2 min

VI.1 wants an icon "in accordance with the theme (molecular/scientific)" at every
resolution the platform needs. The subject is a ball-and-stick viewer, so the mark
is a ball-and-stick molecule: a six-membered aromatic ring, tilted just enough to
read as an object rather than a diagram, in CPK colours over the app's own navy.

Why a ring, and not the free-standing atom cluster this file used to draw:

  * It survives 48px. `favicon.png` is a LANCZOS downscale of the 1024px icon, and
    a closed loop keeps its silhouette where radiating bonds turn to mush.
  * It is near-square, so it fills Android's circular adaptive mask instead of
    leaving margins down both sides.
  * The hole is the signature. Lit from behind in the app's cyan, it is what makes
    the icon findable in a grid of other apps.

Everything derives from RING below, so the launcher icon, the Android adaptive
layers, the splash mark and the favicon can never drift apart. Atom colours are
CPK (the same convention the viewer renders with); the glow, the bonds and the
background are the app's palette from src/theme/theme.ts, which is what makes the
native launch screen and the in-app splash read as one app.

Rendering is a small orthographic ray-tracer rather than a painter: spheres and
bond cylinders are intersected per pixel into a z-buffer, so they occlude each
other correctly at any tilt. Shading is diffuse + Blinn-Phong specular + a cyan
fresnel rim, with a cheap analytic ambient occlusion so the atoms sit in the ring
instead of floating over it. Edges come from supersampling, not a coverage fudge.

Android masks adaptive icons to an unknown shape and only guarantees the middle
~66%, so the foreground and monochrome layers are drawn smaller than the square
launcher icon rather than being cropped by the mask.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

SIZE = 1024
SS = 3  # supersampling factor; the 48px favicon is what needs it

# CPK, as used by src/data/elements.ts.
CPK = {
    'C': (0x90, 0x90, 0x90),
    'N': (0x30, 0x50, 0xF8),
    'O': (0xFF, 0x0D, 0x0D),
}

# src/theme/theme.ts
BG = np.array([0x0A, 0x0E, 0x17], dtype=np.float32)
CYAN = np.array([0x22, 0xD3, 0xEE], dtype=np.float32)
BOND = (0x5A, 0x6A, 0x8C)

# The mark: an aromatic ring, two nitrogens for the cool pair and one oxygen as a
# warm anchor at the bottom. Symmetric about the vertical axis, so it reads as
# drawn rather than arbitrary.
RING = ['C', 'N', 'C', 'O', 'C', 'N']
RING_RADIUS = 1.0
ATOM_RADIUS = 0.40
BOND_RADIUS = 0.13
TILT_DEG = 22.0  # enough to be an object, not so much that the ring squashes

# Toward the light, in world coordinates: +y is up, +z is toward the viewer.
LIGHT = np.array([-0.45, 0.62, 0.64], dtype=np.float32)
LIGHT /= np.linalg.norm(LIGHT)

# The ray origin sits well in front of the mark; every ray runs along -z.
CAMERA_Z = 60.0


def molecule():
    """The ring, tilted, as (atoms, bonds) in world space."""
    n = len(RING)
    ang = np.pi / 2 + np.arange(n) * 2 * np.pi / n
    pts = np.stack([RING_RADIUS * np.cos(ang), RING_RADIUS * np.sin(ang), np.zeros(n)], axis=1)
    t = np.deg2rad(TILT_DEG)
    rx = np.array([[1, 0, 0], [0, np.cos(t), -np.sin(t)], [0, np.sin(t), np.cos(t)]])
    pts = pts @ rx.T
    atoms = [(pts[i], ATOM_RADIUS, np.array(CPK[e], dtype=np.float32)) for i, e in enumerate(RING)]
    bonds = [(i, (i + 1) % n) for i in range(n)]
    return atoms, bonds


def _trace(atoms, bonds, S, fill):
    """Intersect every primitive into a z-buffer. Returns position/normal/colour."""
    xs, ys = [], []
    for p, r, _ in atoms:
        xs += [p[0] - r, p[0] + r]
        ys += [p[1] - r, p[1] + r]
    span = max(max(xs) - min(xs), max(ys) - min(ys))
    scale = S * fill / span
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2

    col_i, row_i = np.meshgrid(np.arange(S, dtype=np.float32), np.arange(S, dtype=np.float32))
    wx = (col_i + 0.5 - S / 2) / scale + cx
    wy = -((row_i + 0.5 - S / 2) / scale) + cy  # image y runs down, world y runs up
    del col_i, row_i

    zbuf = np.full((S, S), -1e9, dtype=np.float32)
    nrm = np.zeros((S, S, 3), dtype=np.float32)
    col = np.zeros((S, S, 3), dtype=np.float32)
    spc = np.zeros((S, S), dtype=np.float32)
    hit = np.zeros((S, S), dtype=bool)

    def commit(mask, z, normal, colour, spec_strength):
        nonlocal zbuf, hit
        take = mask & (z > zbuf)
        zbuf = np.where(take, z, zbuf)
        for k in range(3):
            nrm[..., k] = np.where(take, normal[k], nrm[..., k])
            col[..., k] = np.where(take, colour[k], col[..., k])
        spc[...] = np.where(take, spec_strength, spc)
        hit |= take

    # Bond cylinders. For a ray (o, d) and a cylinder (a, axis A, radius r), the
    # components perpendicular to A give a quadratic in t; the near root is the
    # only one that can be visible on an opaque surface.
    for i, j in bonds:
        pa, pb = atoms[i][0], atoms[j][0]
        axis = pb - pa
        length = float(np.linalg.norm(axis))
        A = (axis / length).astype(np.float32)
        d = np.array([0.0, 0.0, -1.0], dtype=np.float32)
        d_par = float(np.dot(d, A))
        d_perp = d - d_par * A
        mx, my = wx - pa[0], wy - pa[1]
        mz = np.float32(CAMERA_Z - pa[2])
        m_par = mx * A[0] + my * A[1] + mz * A[2]
        p0 = mx - m_par * A[0]
        p1 = my - m_par * A[1]
        p2 = mz - m_par * A[2]
        qa = float(np.dot(d_perp, d_perp))
        qb = 2 * (p0 * d_perp[0] + p1 * d_perp[1] + p2 * d_perp[2])
        qc = p0 ** 2 + p1 ** 2 + p2 ** 2 - BOND_RADIUS ** 2
        disc = qb ** 2 - 4 * qa * qc
        root = np.sqrt(np.maximum(disc, 0))
        t = (-qb - root) / (2 * qa)
        along = m_par + t * d_par
        inside = (disc > 0) & (along >= 0) & (along <= length)
        pz = CAMERA_Z - t
        fx = wx - pa[0] - along * A[0]
        fy = wy - pa[1] - along * A[1]
        fz = pz - pa[2] - along * A[2]
        fn = np.sqrt(fx ** 2 + fy ** 2 + fz ** 2) + 1e-9
        # Bonds stay a cool neutral with a dull highlight, so the CPK atoms keep
        # the colour story to themselves.
        commit(inside, pz, (fx / fn, fy / fn, fz / fn), BOND, 0.22)

    # Atom spheres. With an orthographic ray along -z this collapses to a disc
    # test, and the normal falls straight out of the offset from the centre.
    for p, r, colour in atoms:
        dx, dy = wx - p[0], wy - p[1]
        disc = r * r - dx * dx - dy * dy
        front = np.sqrt(np.maximum(disc, 0))
        commit(disc > 0, p[2] + front, (dx / r, dy / r, front / r), colour, 1.0)

    return np.stack([wx, wy, zbuf], axis=2), nrm, col, spc, hit


def _shade(atoms, pos, nrm, col, spc, mono, tinted=False):
    if mono:
        # Themed icons are a flat silhouette; the system tints them.
        return np.ones_like(col) * 255.0

    view = np.array([0.0, 0.0, 1.0], dtype=np.float32)
    half = LIGHT + view
    half /= np.linalg.norm(half)
    diffuse = np.clip((nrm * LIGHT).sum(axis=2), 0, 1)
    specular = np.clip((nrm * half).sum(axis=2), 0, 1) ** 46
    fresnel = (1 - np.clip((nrm * view).sum(axis=2), 0, 1)) ** 3.2

    # Ambient occlusion: how much of each point's hemisphere the other atoms take.
    # Six spheres, so the exact form matters less than that contact points darken.
    occlusion = np.zeros_like(diffuse)
    for p, r, _ in atoms:
        vx = p[0] - pos[..., 0]
        vy = p[1] - pos[..., 1]
        vz = p[2] - pos[..., 2]
        dist2 = vx ** 2 + vy ** 2 + vz ** 2
        dist = np.sqrt(dist2) + 1e-6
        facing = np.clip((nrm[..., 0] * vx + nrm[..., 1] * vy + nrm[..., 2] * vz) / dist, 0, 1)
        occlusion += facing * (r * r) / (r * r + dist2) * (dist > r * 1.02)
    ao = np.clip(1.0 - 0.9 * occlusion, 0.22, 1.0)

    rgb = col * (0.26 * ao + 0.92 * diffuse * (0.35 + 0.65 * ao))[..., None]
    rgb += 255.0 * (specular * spc * 0.8)[..., None]
    rgb += CYAN * (fresnel * 0.6)[..., None]  # rim light, in the brand accent
    rgb = np.clip(rgb, 0, 255)

    if tinted:
        # iOS 18 tints a greyscale icon with the user's chosen hue, so hand it
        # luminance and let the shading carry the form.
        lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
        # CPK blue and red are dark by luminance (~85 and ~64 against carbon's
        # 144), so a straight desaturation leaves the ring nearly black once the
        # system dims it. Lift the midtones with gamma, which brightens the mark
        # without flattening carbon and nitrogen into the same grey.
        lum = 255.0 * np.clip(lum / 255.0, 0, 1) ** 0.55
        rgb = np.repeat(lum[..., None], 3, axis=2)
    return rgb


def render(size, fill, opaque, mono=False, molecule_only=True, halo=True, tinted=False):
    """Render one asset. `opaque` paints the navy field; otherwise alpha is kept."""
    S = size * SS

    if molecule_only:
        atoms, bonds = molecule()
        pos, nrm, col, spc, hit = _trace(atoms, bonds, S, fill)
        rgb = _shade(atoms, pos, nrm, col, spc, mono, tinted)
        alpha = hit.astype(np.float32)
    else:
        rgb = np.zeros((S, S, 3), dtype=np.float32)
        alpha = np.zeros((S, S), dtype=np.float32)

    glow = None
    if halo and not mono and molecule_only:
        source = Image.fromarray((np.clip(alpha, 0, 1) * 255).astype(np.uint8))
        glow = np.asarray(source.filter(ImageFilter.GaussianBlur(S * 0.04)), dtype=np.float32) / 255.0

    if opaque:
        col_i, row_i = np.meshgrid(np.arange(S, dtype=np.float32), np.arange(S, dtype=np.float32))
        radius = np.hypot(col_i - S / 2, row_i - S / 2)
        base = BG + (CYAN - BG) * (np.clip(1 - radius / (S * 0.55), 0, 1) ** 2.4 * 0.13)[..., None]
        # The hole in the ring is the mark's signature -- light it from behind.
        # Sized off `fill` so the background layer lines up with the foreground.
        base = base + CYAN * (np.exp(-(radius / (S * fill * 0.16)) ** 2) * 0.55)[..., None]
        if glow is not None:
            base = base + CYAN * (glow * 0.40)[..., None]
        out_rgb = base * (1 - alpha[..., None]) + rgb * alpha[..., None]
        out_a = np.ones_like(alpha)
    elif glow is not None:
        # Transparent, but keep the halo: it composites over the same navy that
        # app.json gives the splash screen, and over whatever iOS puts behind a
        # dark or tinted icon.
        halo_rgb = np.array([210.0, 210.0, 210.0], dtype=np.float32) if tinted else CYAN
        out_a = np.clip(alpha + glow * 0.45, 0, 1)
        out_rgb = np.where(alpha[..., None] > 0, rgb, halo_rgb)
    else:
        out_rgb, out_a = rgb, alpha

    arr = np.concatenate([np.clip(out_rgb, 0, 255), (np.clip(out_a, 0, 1) * 255)[..., None]], axis=2)
    img = Image.fromarray(arr.astype(np.uint8), mode='RGBA')
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    assets = Path(__file__).resolve().parent.parent / 'assets'

    # The opaque layers drop their alpha channel: iOS rejects an app icon that
    # has one, and the launcher icon is this file.
    icon = render(SIZE, fill=0.78, opaque=True).convert('RGB')
    icon.save(assets / 'icon.png')
    icon.resize((48, 48), Image.LANCZOS).save(assets / 'favicon.png')

    # iOS 18 appearance variants (ios.icon in app.json). Both are transparent:
    # the system supplies the dark backdrop and, for `tinted`, the hue.
    render(SIZE, fill=0.78, opaque=False).save(assets / 'ios-icon-dark.png')
    render(SIZE, fill=0.78, opaque=False, tinted=True).save(assets / 'ios-icon-tinted.png')

    # expo-splash-screen draws this over its own backgroundColor (app.json).
    render(SIZE, fill=0.80, opaque=False).save(assets / 'splash-icon.png')

    # Adaptive layers: the mask can crop to a circle, so keep the mark well
    # inside the guaranteed-visible middle and let the background carry the glow.
    render(SIZE, fill=0.56, opaque=False, halo=False).save(assets / 'android-icon-foreground.png')
    render(SIZE, fill=0.56, opaque=True, molecule_only=False).convert('RGB').save(
        assets / 'android-icon-background.png'
    )
    render(SIZE, fill=0.56, opaque=False, mono=True).save(assets / 'android-icon-monochrome.png')

    for f in sorted(assets.glob('*.png')):
        im = Image.open(f)
        print(f'{f.name}: {im.size[0]}px {im.mode} {f.stat().st_size // 1024}KB')


if __name__ == '__main__':
    main()
