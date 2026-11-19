#!/usr/bin/env python3
"""Fit the raw captures into screenshots/ inside the gate's limits.

Each screenshot must be a whole PNG of at most 256 KiB, long side at most
1280 px and short side at least 480 px. The exported covers arrive at full
post size; they are scaled to the largest fitting size and palette-fitted
(the covers are poster art, so an adaptive palette is invisible), stepping
the palette down until the byte cap is met.
"""

import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "shots-raw")
OUT = os.path.join(HERE, "..", "screenshots")
MAX_BYTES = 262144

# name -> (max long side, palette steps to try)
SHOTS = {
    "1-cover-wide.png": 1280,
    "2-editor.png": 1280,
    "3-cover-portrait.png": 1280,
    "4-cover-square.png": 1280,
}


def fit(path, target_long_side):
    img = Image.open(path).convert("RGB")
    long_side = max(img.size)
    if long_side > target_long_side:
        scale = target_long_side / long_side
        img = img.resize((round(img.size[0] * scale), round(img.size[1] * scale)), Image.LANCZOS)
    for colors in (256, 224, 192, 160, 128, 96):
        pal = img.quantize(colors=colors, method=Image.FASTOCTREE)
        out_path = os.path.join(OUT, os.path.basename(path))
        pal.save(out_path, "PNG", optimize=True)
        size = os.path.getsize(out_path)
        if size <= MAX_BYTES:
            return img.size, colors, size
    return img.size, colors, size


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, long_side in SHOTS.items():
        dims, colors, size = fit(os.path.join(RAW, name), long_side)
        status = "OK " if size <= MAX_BYTES else "OVER"
        print(f"{status} {name}: {dims[0]}x{dims[1]}, palette {colors}, {size // 1024} KiB")
