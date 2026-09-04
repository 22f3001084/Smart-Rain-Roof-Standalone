"""Knock the studio backdrop out of a generated character render.

The image model returns each character on a flat studio sweep, and the two
renders do not agree on its colour. Rather than re-roll a render (which risks
losing the pose), the backdrop is removed here.

Keying on colour does not work on these images: the sweep carries a soft
vignette, so one global reference colour either stops partway across it or has to
be loosened until it eats the character — and the boy's dark grey trousers sit
inside a few units of the grey sweep either way.

So the fill keys on edge strength instead. It grows in from the border through
low-gradient pixels only, which lets it follow the vignette all the way across
while the character's silhouette — a strong edge whatever its colour — stops it
dead. Anything the fill cannot reach from the border is subject, so highlights
enclosed by the body survive automatically.

    python tools/cutout_character.py <in.png> <out.png> [edge] [dilate]
"""

import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter


def sobel_magnitude(gray):
    kx = np.array([[-1., 0., 1.], [-2., 0., 2.], [-1., 0., 1.]])
    ky = kx.T
    pad = np.pad(gray, 1, mode='edge')
    gx = np.zeros_like(gray)
    gy = np.zeros_like(gray)
    for dy in range(3):
        for dx in range(3):
            window = pad[dy:dy + gray.shape[0], dx:dx + gray.shape[1]]
            gx += kx[dy, dx] * window
            gy += ky[dy, dx] * window
    return np.sqrt(gx * gx + gy * gy)


def cutout(src, dst, edge=9.0, dilate=2, feather=1.2):
    img = Image.open(src).convert('RGBA')
    rgb = np.asarray(img, dtype=np.float32)[:, :, :3]
    gray = rgb.mean(axis=2)
    h, w = gray.shape

    flat = sobel_magnitude(gray) < edge

    seen = np.zeros((h, w), dtype=bool)
    queue = deque()
    # The renders are full-bleed sweeps and the character never touches the frame
    # edge, so every border pixel is backdrop by definition.
    for x in range(w):
        for y in (0, h - 1):
            if not seen[y, x]:
                seen[y, x] = True
                queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y, x]:
                seen[y, x] = True
                queue.append((y, x))

    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and flat[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))

    # The fill halts one pixel short of the silhouette, on the edge band itself.
    # Grow the backdrop back over that band so no grey rim survives.
    mask = Image.fromarray(np.where(seen, 255, 0).astype(np.uint8), mode='L')
    for _ in range(max(0, dilate)):
        mask = mask.filter(ImageFilter.MaxFilter(3))
    grown = np.asarray(mask) > 127

    alpha = Image.fromarray(np.where(grown, 0, 255).astype(np.uint8), mode='L')
    alpha = alpha.filter(ImageFilter.GaussianBlur(feather))

    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0))
    out.putalpha(alpha)
    out.save(dst, optimize=True)

    print('%s -> %s  subject %.1f%% of frame' % (src, dst, 100.0 * (1.0 - grown.mean())))


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    cutout(sys.argv[1], sys.argv[2],
           float(sys.argv[3]) if len(sys.argv) > 3 else 9.0,
           int(sys.argv[4]) if len(sys.argv) > 4 else 2)
