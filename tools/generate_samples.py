#!/usr/bin/env python3
"""Generate the bundled sample scenes for Sunset Press Cover Studio.

Every scene is drawn from scratch with PIL polygons, gradients and print
treatment (posterize + halftone + grain + vignette), so the app can ship
poster-art samples that are entirely our own work: no photographs, no real
people, no borrowed artwork. Run once at build time:

    python3 tools/generate_samples.py

Writes app/samples/*.jpg next to this repo's app/ folder.
"""

import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "app", "samples")
W, H = 1200, 900  # final sample size; scenes are drawn at 2x and downscaled
SS = 2
random.seed(20261120)


# ---------------------------------------------------------------- helpers

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vertical_gradient(w, h, stops):
    """stops: list of (position 0..1, (r,g,b)). Returns an RGB image."""
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    stops = sorted(stops)
    ys = np.linspace(0, 1, h)
    for i in range(len(stops) - 1):
        p0, c0 = stops[i]
        p1, c1 = stops[i + 1]
        mask = (ys >= p0) & (ys <= p1)
        t = (ys[mask] - p0) / max(p1 - p0, 1e-6)
        for ch in range(3):
            arr[mask, :, ch] = (c0[ch] + (c1[ch] - c0[ch]) * t)[:, None]
    arr[ys < stops[0][0]] = stops[0][1]
    arr[ys > stops[-1][0]] = stops[-1][1]
    return Image.fromarray(arr, "RGB")


def horizontal_glow(img, cx, cy, radius, color, strength=0.55):
    """Soft radial light bloom pasted over img."""
    glow = Image.new("RGB", img.size, (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=color)
    glow = glow.filter(ImageFilter.GaussianBlur(radius * 0.55))
    arr = np.asarray(img).astype(np.int16) + (np.asarray(glow).astype(np.int16) * strength).astype(np.int16)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def print_treatment(img, poster_bits=5, grain=13, halftone_alpha=26, dot=7, vig=0.32):
    """The unifying poster-print finish: posterize, halftone dots in the
    shadows, film grain and a soft vignette."""
    img = ImageOps.posterize(img.convert("RGB"), poster_bits)
    # halftone dots, denser where the image is dark
    lum = np.asarray(img.convert("L")).astype(np.float32) / 255.0
    dots = Image.new("L", img.size, 0)
    dd = ImageDraw.Draw(dots)
    for gy in range(0, img.size[1], dot):
        for gx in range(0, img.size[0], dot):
            darkness = 1.0 - float(lum[gy, gx])
            r = (dot * 0.5) * max(0.0, darkness - 0.25)
            if r > 0.6:
                dd.ellipse([gx - r, gy - r, gx + r, gy + r], fill=halftone_alpha)
    black = Image.new("RGB", img.size, (8, 4, 12))
    img = Image.composite(black, img, dots.point(lambda v: v))
    # grain
    noise = Image.effect_noise(img.size, grain).convert("L")
    img = Image.blend(img, ImageOps.colorize(noise, (10, 6, 14), (245, 240, 235)), 0.07)
    # vignette
    vw, vh = img.size
    mask = Image.new("L", (vw, vh), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse([-vw * 0.25, -vh * 0.25, vw * 1.25, vh * 1.25], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(120))
    dark = Image.new("RGB", img.size, (5, 3, 10))
    return Image.composite(img, Image.blend(img, dark, vig), mask)


def palm(draw, x, y, scale, color, lean=0.25, fronds=9):
    """A palm silhouette: curved trunk of stacked segments + fronds that arc
    up and droop at the tips, drawn as tapered polylines."""
    top_x = x + lean * 160 * scale
    top_y = y - 300 * scale
    steps = 14
    px, py = x, y
    for i in range(1, steps + 1):
        t = i / steps
        nx = x + (top_x - x) * t + math.sin(t * 2.2) * 6 * scale
        ny = y + (top_y - y) * t
        wdt = max(2.0, (1 - t) * 13 * scale + 2)
        draw.line([px, py, nx, ny], fill=color, width=int(wdt))
        px, py = nx, ny
    for k in range(fronds):
        # fan from ~12 degrees (right, low) through vertical to ~168 (left, low)
        ang = math.pi * (0.07 + 0.86 * k / max(fronds - 1, 1))
        length = (105 + 45 * math.sin(k * 2.35 + 1.0)) * scale
        segs = 7
        fx, fy = top_x, top_y
        for s in range(1, segs + 1):
            t = s / segs
            nx = top_x + math.cos(ang) * length * t
            ny = top_y - math.sin(ang) * length * t + length * 0.52 * t * t
            wdt = max(1, int((4.6 - 3.2 * t) * scale))
            draw.line([fx, fy, nx, ny], fill=color, width=wdt)
            fx, fy = nx, ny
    # two dead fronds hanging from the crown
    for sgn in (-1, 1):
        draw.line([top_x, top_y, top_x + sgn * 16 * scale, top_y + 44 * scale],
                  fill=color, width=max(1, int(3 * scale)))
    draw.ellipse([top_x - 7 * scale, top_y - 4 * scale, top_x + 7 * scale, top_y + 10 * scale], fill=color)


def retro_sun(draw, cx, cy, r, top, bottom, stripe_color=None, horizon=None):
    """Big banded sunset disc: horizontal colour bands clipped to the circle,
    with widening sky-coloured gaps cut into the lower half."""
    steps = 120
    for i in range(steps):
        t0 = i / steps
        y0 = cy - r + 2 * r * t0
        y1 = cy - r + 2 * r * (i + 1) / steps
        ymid = (y0 + y1) / 2
        dy = ymid - cy
        half = math.sqrt(max(r * r - dy * dy, 0.0))
        draw.rectangle([cx - half, y0, cx + half, y1 + 1], fill=lerp(top, bottom, t0))
    if stripe_color and horizon:
        gap = r * 0.035
        y = cy + r * 0.10
        while y < min(horizon, cy + r):
            dy = y - cy
            half = math.sqrt(max(r * r - dy * dy, 0.0))
            draw.rectangle([cx - half, y, cx + half, y + gap], fill=stripe_color)
            y += gap * 3.4
            gap *= 1.4


def figure_head(draw, cx, cy, r, skin, hair, hair_style="cap", beard=False):
    """Stylised head: face, optional jaw beard, hair mass, sunglasses."""
    draw.ellipse([cx - r, cy - r, cx + r, cy + r * 1.12], fill=skin)
    if beard:
        draw.chord([cx - r, cy - r * 0.52, cx + r, cy + r * 1.12], 0, 180, fill=(36, 24, 22, 110))
    if hair_style == "cap":
        draw.chord([cx - r * 1.02, cy - r * 1.1, cx + r * 1.02, cy + r * 0.55], 180, 360, fill=hair)
        draw.rectangle([cx - r * 1.02, cy - r * 0.42, cx + r * 1.02, cy - r * 0.18], fill=hair)
    elif hair_style == "bun":
        draw.chord([cx - r * 1.02, cy - r * 1.08, cx + r * 1.02, cy + r * 0.5], 180, 360, fill=hair)
        draw.ellipse([cx - r * 0.34, cy - r * 1.5, cx + r * 0.34, cy - r * 0.95], fill=hair)
        draw.rectangle([cx - r, cy - r * 0.3, cx - r * 0.82, cy + r * 0.9], fill=hair)
        draw.rectangle([cx + r * 0.82, cy - r * 0.3, cx + r, cy + r * 0.9], fill=hair)
    elif hair_style == "short":
        draw.chord([cx - r * 1.02, cy - r * 1.12, cx + r * 1.02, cy + r * 0.42], 180, 360, fill=hair)
    # sunglasses: two rounded lenses + bridge + temple arms
    lw, lh = r * 0.62, r * 0.44
    for sgn in (-1, 1):
        lx = cx + sgn * r * 0.48
        draw.rounded_rectangle([lx - lw / 2, cy - lh * 0.28, lx + lw / 2, cy + lh * 0.72],
                               radius=lh * 0.32, fill=(12, 10, 16))
        draw.line([lx - lw * 0.28, cy + lh * 0.05, lx + lw * 0.05, cy + lh * 0.05],
                  fill=(255, 190, 120), width=max(2, int(r * 0.07)))
    draw.line([cx - r * 0.14, cy + lh * 0.1, cx + r * 0.14, cy + lh * 0.1], fill=(12, 10, 16),
              width=max(2, int(r * 0.08)))
    # nose + mouth hints, kept graphic
    draw.line([cx, cy + r * 0.42, cx - r * 0.07, cy + r * 0.62], fill=lerp(skin, (0, 0, 0), 0.25),
              width=max(2, int(r * 0.06)))
    draw.arc([cx - r * 0.3, cy + r * 0.55, cx + r * 0.3, cy + r * 0.95], 15, 165,
             fill=lerp(skin, (60, 0, 10), 0.45), width=max(2, int(r * 0.07)))


def save(img, name):
    path = os.path.join(OUT, name)
    img.save(path, "JPEG", quality=86)
    print("wrote", path, os.path.getsize(path) // 1024, "KiB")


# ---------------------------------------------------------------- scenes

def scene_convertible():
    w, h = W * SS, H * SS
    img = vertical_gradient(w, h, [
        (0.0, (46, 16, 84)), (0.34, (148, 44, 116)), (0.55, (238, 96, 84)),
        (0.68, (255, 166, 88)), (0.72, (255, 196, 110)), (1.0, (30, 10, 40))])
    d = ImageDraw.Draw(img, "RGBA")
    retro_sun(d, int(w * 0.60), int(h * 0.60), int(h * 0.30), (255, 214, 130), (255, 92, 96),
              stripe_color=(238, 96, 84), horizon=int(h * 0.72))
    # sea band + sun glitter
    d.rectangle([0, int(h * 0.70), w, int(h * 0.78)], fill=(64, 20, 74))
    for _ in range(90):
        gx = random.gauss(w * 0.60, w * 0.13)
        gy = random.uniform(h * 0.705, h * 0.775)
        ln = random.uniform(8, 46) * SS
        d.line([gx, gy, gx + ln, gy], fill=(255, 178, 105, 190), width=int(2 * SS))
    # far headland + palms
    d.polygon([(0, h * 0.72), (w * 0.20, h * 0.66), (w * 0.34, h * 0.72)], fill=(38, 14, 52))
    ink = (26, 10, 36)
    palm(d, int(w * 0.055), int(h * 0.76), 1.05 * SS, ink, lean=0.3)
    palm(d, int(w * 0.93), int(h * 0.78), 1.25 * SS, ink, lean=-0.35)
    palm(d, int(w * 0.985), int(h * 0.74), 0.8 * SS, ink, lean=-0.2)
    # road
    d.polygon([(0, h), (w * 0.30, h * 0.775), (w * 0.78, h * 0.775), (w, h)], fill=(24, 14, 30))
    d.polygon([(w * 0.515, h), (w * 0.545, h * 0.78), (w * 0.565, h * 0.78), (w * 0.60, h)],
              fill=(255, 205, 120))
    # convertible, side profile facing left, driver aboard
    gy = h * 0.845
    body = (178, 30, 52)
    body_hi = (232, 64, 84)
    body_lo = (110, 16, 38)
    d.polygon([(w * 0.16, gy), (w * 0.20, gy - h * 0.055), (w * 0.34, gy - h * 0.075),
               (w * 0.40, gy - h * 0.135), (w * 0.60, gy - h * 0.135), (w * 0.68, gy - h * 0.07),
               (w * 0.86, gy - h * 0.05), (w * 0.90, gy)], fill=body)
    d.polygon([(w * 0.16, gy), (w * 0.90, gy), (w * 0.90, gy - h * 0.018), (w * 0.16, gy - h * 0.018)],
              fill=body_lo)
    d.polygon([(w * 0.20, gy - h * 0.055), (w * 0.34, gy - h * 0.075), (w * 0.40, gy - h * 0.135),
               (w * 0.60, gy - h * 0.135), (w * 0.58, gy - h * 0.075), (w * 0.36, gy - h * 0.055)],
              fill=body_hi)
    # cockpit + windshield raked up from the door line
    d.polygon([(w * 0.462, gy - h * 0.132), (w * 0.512, gy - h * 0.215), (w * 0.542, gy - h * 0.215),
               (w * 0.508, gy - h * 0.132)], fill=(165, 224, 238))
    d.rectangle([w * 0.47, gy - h * 0.145, w * 0.63, gy - h * 0.075], fill=(52, 14, 30))
    # driver figure: torso + head above the door line
    skin = (198, 132, 92)
    d.polygon([(w * 0.515, gy - h * 0.085), (w * 0.53, gy - h * 0.185), (w * 0.575, gy - h * 0.185),
               (w * 0.585, gy - h * 0.085)], fill=(240, 238, 230))
    d.polygon([(w * 0.53, gy - h * 0.185), (w * 0.575, gy - h * 0.185), (w * 0.585, gy - h * 0.085),
               (w * 0.56, gy - h * 0.085)], fill=(214, 210, 200))
    figure_head(d, w * 0.552, gy - h * 0.225, h * 0.036, skin, (30, 18, 22), "bun")
    d.line([w * 0.575, gy - h * 0.15, w * 0.615, gy - h * 0.115], fill=skin, width=int(h * 0.016))
    # wheels + chrome
    for wx in (0.265, 0.775):
        d.ellipse([w * (wx - 0.052), gy - h * 0.052, w * (wx + 0.052), gy + h * 0.052], fill=(10, 8, 14))
        d.ellipse([w * (wx - 0.028), gy - h * 0.028, w * (wx + 0.028), gy + h * 0.028], fill=(205, 205, 215))
        d.ellipse([w * (wx - 0.010), gy - h * 0.010, w * (wx + 0.010), gy + h * 0.010], fill=(90, 90, 105))
    d.line([w * 0.17, gy - h * 0.045, w * 0.89, gy - h * 0.045], fill=(255, 214, 150), width=int(3 * SS))
    img = img.resize((W, H), Image.LANCZOS)
    return print_treatment(img, poster_bits=5, grain=12)


def scene_portrait():
    w, h = W * SS, H * SS
    img = vertical_gradient(w, h, [
        (0.0, (16, 8, 44)), (0.45, (88, 18, 92)), (0.75, (196, 44, 110)), (1.0, (24, 10, 40))])
    d = ImageDraw.Draw(img, "RGBA")
    # neon backdrop: sun grid + glow rings
    retro_sun(d, int(w * 0.5), int(h * 0.40), int(h * 0.30), (255, 120, 160), (255, 84, 60),
              stripe_color=(150, 34, 100), horizon=int(h * 0.42))
    for i in range(9):
        gx = w * (0.06 + i * 0.11)
        d.line([gx, h * 0.98, w * 0.5 + (gx - w * 0.5) * 0.3, h * 0.70], fill=(40, 220, 220, 120),
               width=int(2 * SS))
    for i in range(5):
        gy = h * (0.74 + i * 0.055)
        d.line([0, gy, w, gy], fill=(40, 220, 220, 90), width=int(2 * SS))
    palm(d, int(w * 0.04), int(h * 0.99), 1.5 * SS, (10, 6, 22), lean=0.4)
    palm(d, int(w * 0.99), int(h * 0.99), 1.6 * SS, (10, 6, 22), lean=-0.45)
    # bust: shoulders + open shirt + tee
    skin = (176, 112, 74)
    skin_hi = (206, 146, 100)
    d.polygon([(w * 0.16, h), (w * 0.24, h * 0.70), (w * 0.40, h * 0.615), (w * 0.60, h * 0.615),
               (w * 0.76, h * 0.70), (w * 0.84, h)], fill=(238, 234, 226))
    d.polygon([(w * 0.40, h * 0.615), (w * 0.50, h * 0.78), (w * 0.60, h * 0.615),
               (w * 0.575, h), (w * 0.425, h)], fill=(22, 20, 30))
    d.polygon([(w * 0.16, h), (w * 0.24, h * 0.70), (w * 0.40, h * 0.615), (w * 0.425, h),
               (w * 0.30, h)], fill=(206, 200, 190))
    # floral shirt pattern dots on the lit side
    for _ in range(46):
        fx = random.uniform(w * 0.20, w * 0.40)
        fy = random.uniform(h * 0.72, h * 0.99)
        d.ellipse([fx, fy, fx + 9 * SS, fy + 9 * SS], fill=(226, 84, 96, 160))
    # neck + gold chain
    d.rectangle([w * 0.455, h * 0.50, w * 0.545, h * 0.64], fill=lerp(skin, (0, 0, 0), 0.14))
    d.arc([w * 0.415, h * 0.545, w * 0.585, h * 0.72], 20, 160, fill=(255, 196, 84), width=int(6 * SS))
    d.ellipse([w * 0.488, h * 0.685, w * 0.512, h * 0.715], fill=(255, 214, 110))
    # head with short hair and a graphic beard along the jaw
    figure_head(d, w * 0.50, h * 0.36, h * 0.115, skin, (24, 16, 18), "short", beard=True)
    img2 = img.resize((W, H), Image.LANCZOS)
    return print_treatment(img2, poster_bits=5, grain=12)


def scene_gas_station():
    w, h = W * SS, H * SS
    img = vertical_gradient(w, h, [
        (0.0, (6, 8, 34)), (0.5, (14, 20, 58)), (0.72, (30, 26, 66)), (1.0, (8, 8, 20))])
    img = horizontal_glow(img, int(w * 0.5), int(h * 0.34), int(h * 0.34), (120, 40, 90), 0.5)
    d = ImageDraw.Draw(img, "RGBA")
    # stars + moon
    for _ in range(120):
        sx, sy = random.uniform(0, w), random.uniform(0, h * 0.4)
        d.point((sx, sy), fill=(220, 230, 255))
    d.ellipse([w * 0.84, h * 0.06, w * 0.90, h * 0.135], fill=(232, 236, 240))
    d.ellipse([w * 0.855, h * 0.05, w * 0.905, h * 0.125], fill=(10, 12, 40))
    # distant skyline strip
    for bx in range(0, w, int(w * 0.07)):
        bh = random.uniform(h * 0.06, h * 0.16)
        d.rectangle([bx, h * 0.52 - bh, bx + w * 0.055, h * 0.52], fill=(10, 12, 34))
    # station building + canopy
    d.rectangle([w * 0.06, h * 0.40, w * 0.34, h * 0.62], fill=(24, 26, 48))
    d.rectangle([w * 0.09, h * 0.45, w * 0.20, h * 0.55], fill=(255, 196, 92))
    d.rectangle([w * 0.23, h * 0.45, w * 0.31, h * 0.55], fill=(120, 220, 235))
    d.polygon([(w * 0.30, h * 0.30), (w * 0.97, h * 0.30), (w * 0.93, h * 0.38), (w * 0.34, h * 0.38)],
              fill=(30, 30, 56))
    d.rectangle([w * 0.30, h * 0.355, w * 0.97, h * 0.385], fill=(255, 64, 150))
    d.rectangle([w * 0.30, h * 0.385, w * 0.97, h * 0.40], fill=(64, 224, 235))
    for px in (0.40, 0.60, 0.80, 0.90):
        d.rectangle([w * px, h * 0.40, w * px + w * 0.012, h * 0.64], fill=(16, 16, 34))
    # pumps
    for px in (0.46, 0.66, 0.84):
        d.rounded_rectangle([w * px, h * 0.50, w * px + w * 0.045, h * 0.635], radius=8 * SS,
                            fill=(38, 40, 66))
        d.rectangle([w * px + w * 0.008, h * 0.515, w * px + w * 0.037, h * 0.555], fill=(170, 240, 250))
        d.rectangle([w * px, h * 0.565, w * px + w * 0.045, h * 0.578], fill=(255, 64, 150))
    # parked coupe silhouette under the canopy
    gy = h * 0.66
    d.polygon([(w * 0.50, gy), (w * 0.53, gy - h * 0.045), (w * 0.63, gy - h * 0.055),
               (w * 0.68, gy - h * 0.10), (w * 0.80, gy - h * 0.10), (w * 0.86, gy - h * 0.04),
               (w * 0.90, gy)], fill=(14, 14, 28))
    d.polygon([(w * 0.685, gy - h * 0.098), (w * 0.795, gy - h * 0.098), (w * 0.83, gy - h * 0.045),
               (w * 0.70, gy - h * 0.045)], fill=(90, 160, 190))
    for wx in (0.575, 0.835):
        d.ellipse([w * (wx - 0.030), gy - h * 0.030, w * (wx + 0.030), gy + h * 0.030], fill=(4, 4, 8))
        d.ellipse([w * (wx - 0.016), gy - h * 0.016, w * (wx + 0.016), gy + h * 0.016], fill=(120, 125, 140))
    # wet pavement: light pools + reflections
    d.rectangle([0, h * 0.665, w, h], fill=(10, 10, 24))
    for cx, col in ((0.63, (255, 64, 150)), (0.35, (255, 196, 92)), (0.80, (64, 224, 235))):
        for i in range(7):
            yy = h * (0.70 + i * 0.038)
            ln = w * (0.05 + i * 0.012)
            d.line([w * cx - ln / 2, yy, w * cx + ln / 2, yy], fill=col + (110,), width=int(3 * SS))
    img = img.resize((W, H), Image.LANCZOS)
    return print_treatment(img, poster_bits=5, grain=14, halftone_alpha=30)


def scene_speedboat():
    w, h = W * SS, H * SS
    img = vertical_gradient(w, h, [
        (0.0, (58, 20, 92)), (0.30, (196, 62, 116)), (0.46, (255, 130, 84)),
        (0.52, (64, 178, 190)), (0.75, (30, 140, 175)), (1.0, (16, 84, 130))])
    d = ImageDraw.Draw(img, "RGBA")
    retro_sun(d, int(w * 0.30), int(h * 0.40), int(h * 0.20), (255, 220, 140), (255, 100, 90),
              stripe_color=(196, 62, 116), horizon=int(h * 0.52))
    # far shore skyline
    for bx in range(0, w, int(w * 0.055)):
        bh = random.uniform(h * 0.03, h * 0.10)
        d.rectangle([bx, h * 0.52 - bh, bx + w * 0.04, h * 0.52], fill=(52, 22, 66))
    palm(d, int(w * 0.965), int(h * 0.545), 0.75 * SS, (40, 16, 54), lean=-0.3)
    # water sparkle
    for _ in range(160):
        gx, gy = random.uniform(0, w), random.uniform(h * 0.54, h * 0.97)
        ln = random.uniform(6, 30) * SS
        d.line([gx, gy, gx + ln, gy], fill=(190, 240, 245, 130), width=int(1.6 * SS))
    # speedboat, side profile planing to the right
    gy = h * 0.66
    hull = (240, 240, 244)
    d.polygon([(w * 0.14, gy - h * 0.02), (w * 0.80, gy - h * 0.02), (w * 0.90, gy - h * 0.085),
               (w * 0.88, gy - h * 0.115), (w * 0.30, gy - h * 0.115), (w * 0.17, gy - h * 0.075)],
              fill=hull)
    d.polygon([(w * 0.14, gy - h * 0.02), (w * 0.80, gy - h * 0.02), (w * 0.84, gy - h * 0.05),
               (w * 0.20, gy - h * 0.05)], fill=(206, 30, 64))
    d.polygon([(w * 0.52, gy - h * 0.115), (w * 0.60, gy - h * 0.185), (w * 0.635, gy - h * 0.185),
               (w * 0.60, gy - h * 0.115)], fill=(150, 220, 235))
    d.rectangle([w * 0.30, gy - h * 0.16, w * 0.52, gy - h * 0.115], fill=(24, 40, 66))
    # driver + passenger figures
    skin = (188, 122, 82)
    figure_head(d, w * 0.435, gy - h * 0.205, h * 0.030, skin, (26, 16, 20), "cap")
    d.polygon([(w * 0.415, gy - h * 0.115), (w * 0.42, gy - h * 0.175), (w * 0.45, gy - h * 0.175),
               (w * 0.455, gy - h * 0.115)], fill=(255, 120, 60))
    figure_head(d, w * 0.345, gy - h * 0.20, h * 0.028, (206, 146, 100), (16, 12, 16), "bun")
    d.polygon([(w * 0.328, gy - h * 0.115), (w * 0.332, gy - h * 0.17), (w * 0.36, gy - h * 0.17),
               (w * 0.362, gy - h * 0.115)], fill=(64, 224, 235))
    # wake foam: scattered dashes trailing the stern, widening as they fade
    for i in range(46):
        t = random.random()
        wx = w * (0.14 - t * 0.11) + random.uniform(-w * 0.012, w * 0.012)
        wy = gy + h * (0.004 + t * 0.055) + random.uniform(-h * 0.004, h * 0.004)
        ln = w * (0.008 + t * 0.03)
        d.line([wx - ln / 2, wy, wx + ln / 2, wy], fill=(235, 250, 252, 190), width=int(2.6 * SS))
    d.polygon([(w * 0.80, gy - h * 0.01), (w * 0.97, gy - h * 0.045), (w * 0.82, gy + h * 0.015)],
              fill=(235, 250, 252))
    img = img.resize((W, H), Image.LANCZOS)
    return print_treatment(img, poster_bits=5, grain=11)


def scene_boulevard():
    w, h = W * SS, H * SS
    img = vertical_gradient(w, h, [
        (0.0, (52, 18, 88)), (0.36, (172, 52, 118)), (0.58, (250, 116, 82)),
        (0.68, (255, 178, 96)), (1.0, (26, 12, 38))])
    d = ImageDraw.Draw(img, "RGBA")
    retro_sun(d, int(w * 0.5), int(h * 0.55), int(h * 0.26), (255, 216, 130), (255, 96, 92),
              stripe_color=(250, 116, 82), horizon=int(h * 0.68))
    vx, vy = w * 0.5, h * 0.665  # vanishing point
    # deco buildings left and right, converging
    def building(x0, x1, top, base, tone, lit):
        d.polygon([(x0, base), (x0, top), (x1, top + (base - top) * 0.22), (x1, base)], fill=tone)
        cols = 3
        for cx in range(cols):
            for ry in range(5):
                wx = x0 + (x1 - x0) * (0.18 + cx * 0.3)
                wy = top + (base - top) * (0.16 + ry * 0.16)
                if random.random() < lit:
                    d.rectangle([wx, wy, wx + (x1 - x0) * 0.13, wy + (base - top) * 0.08],
                                fill=(255, 205, 110))
    building(0, w * 0.235, h * 0.16, h * 0.70, (44, 18, 62), 0.55)
    building(w * 0.075, w * 0.315, h * 0.30, h * 0.685, (66, 24, 78), 0.4)
    building(w * 0.765, w, h * 0.16, h * 0.70, (44, 18, 62), 0.5)
    building(w * 0.685, w * 0.925, h * 0.30, h * 0.685, (66, 24, 78), 0.45)
    # road + sidewalks converging
    d.polygon([(w * 0.315, h), (vx, vy), (w * 0.685, h)], fill=(30, 16, 40))
    d.polygon([(0, h), (w * 0.315, h), (vx, vy), (w * 0.235, h * 0.70), (0, h * 0.72)], fill=(52, 26, 56))
    d.polygon([(w, h), (w * 0.685, h), (vx, vy), (w * 0.765, h * 0.70), (w, h * 0.72)], fill=(52, 26, 56))
    d.line([w * 0.5, h * 0.995, vx, vy], fill=(255, 205, 120), width=int(5 * SS))
    # palm rows converging to the vanishing point
    for i, t in enumerate((0.0, 0.22, 0.45, 0.68, 0.86)):
        sc = (1.45 - t * 0.95) * SS
        lx = w * 0.285 - t * w * 0.19
        rx = w * 0.715 + t * w * 0.19
        by = h * (0.99 - t * 0.30)
        palm(d, int(lx), int(by), sc, (22, 10, 34), lean=0.22)
        palm(d, int(rx), int(by), sc, (22, 10, 34), lean=-0.22)
    # hero car from behind, centre foreground
    gy = h * 0.965
    d.polygon([(w * 0.335, gy), (w * 0.35, gy - h * 0.10), (w * 0.42, gy - h * 0.115),
               (w * 0.45, gy - h * 0.185), (w * 0.55, gy - h * 0.185), (w * 0.58, gy - h * 0.115),
               (w * 0.65, gy - h * 0.10), (w * 0.665, gy)], fill=(150, 24, 48))
    d.polygon([(w * 0.455, gy - h * 0.178), (w * 0.545, gy - h * 0.178), (w * 0.565, gy - h * 0.12),
               (w * 0.435, gy - h * 0.12)], fill=(120, 200, 220))
    for tx in (0.375, 0.585):
        d.rounded_rectangle([w * tx, gy - h * 0.075, w * tx + w * 0.045, gy - h * 0.045],
                            radius=6 * SS, fill=(255, 60, 70))
    d.rectangle([w * 0.465, gy - h * 0.062, w * 0.535, gy - h * 0.038], fill=(240, 240, 235))
    for wx in (0.345, 0.615):
        d.ellipse([w * wx, gy - h * 0.045, w * wx + w * 0.045, gy + h * 0.005], fill=(8, 6, 12))
    img = img.resize((W, H), Image.LANCZOS)
    return print_treatment(img, poster_bits=5, grain=12)


def scene_marina():
    w, h = W * SS, H * SS
    img = vertical_gradient(w, h, [
        (0.0, (24, 14, 62)), (0.34, (96, 34, 102)), (0.52, (216, 84, 104)),
        (0.60, (255, 156, 92)), (0.64, (36, 60, 96)), (1.0, (12, 22, 48))])
    d = ImageDraw.Draw(img, "RGBA")
    retro_sun(d, int(w * 0.42), int(h * 0.55), int(h * 0.17), (255, 206, 120), (255, 110, 90),
              stripe_color=(216, 84, 104), horizon=int(h * 0.635))
    # water shimmer under the sun
    for _ in range(110):
        gx = random.gauss(w * 0.42, w * 0.10)
        gy = random.uniform(h * 0.65, h * 0.96)
        ln = random.uniform(10, 60) * SS
        d.line([gx, gy, gx + ln, gy], fill=(255, 170, 105, 170), width=int(2 * SS))
    for _ in range(80):
        gx, gy = random.uniform(0, w), random.uniform(h * 0.66, h * 0.97)
        ln = random.uniform(6, 26) * SS
        d.line([gx, gy, gx + ln, gy], fill=(140, 190, 225, 110), width=int(1.6 * SS))

    def yacht(cx, base, s, hull_col, sail=True):
        d.polygon([(cx - 0.11 * w * s, base), (cx + 0.12 * w * s, base), (cx + 0.085 * w * s,
                   base - 0.035 * h * s), (cx - 0.075 * w * s, base - 0.035 * h * s)], fill=hull_col)
        d.line([cx, base - 0.03 * h * s, cx, base - 0.34 * h * s], fill=(18, 16, 30),
               width=max(2, int(3.4 * SS * s)))
        if sail:
            d.polygon([(cx + 0.006 * w * s, base - 0.33 * h * s), (cx + 0.006 * w * s,
                        base - 0.05 * h * s), (cx + 0.085 * w * s, base - 0.05 * h * s)],
                      fill=(238, 236, 228))
            d.polygon([(cx - 0.006 * w * s, base - 0.30 * h * s), (cx - 0.006 * w * s,
                        base - 0.05 * h * s), (cx - 0.07 * w * s, base - 0.05 * h * s)],
                      fill=(214, 210, 200))
        # masthead light + reflection
        d.ellipse([cx - 3 * SS, base - 0.35 * h * s, cx + 3 * SS, base - 0.335 * h * s],
                  fill=(255, 220, 130))
        for i in range(4):
            yy = base + h * (0.015 + i * 0.02) * s
            d.line([cx - w * 0.03 * s, yy, cx + w * 0.03 * s, yy], fill=(200, 160, 120, 120),
                   width=int(2 * SS))

    yacht(w * 0.16, h * 0.70, 0.9, (20, 22, 44))
    yacht(w * 0.86, h * 0.72, 1.05, (16, 18, 38))
    yacht(w * 0.60, h * 0.665, 0.62, (26, 26, 52), sail=False)
    yacht(w * 0.335, h * 0.655, 0.5, (26, 26, 52))
    # foreground dock + posts + string lights
    d.polygon([(0, h), (0, h * 0.86), (w * 0.30, h * 0.80), (w * 0.36, h)], fill=(14, 10, 24))
    d.polygon([(w, h), (w, h * 0.84), (w * 0.78, h * 0.795), (w * 0.72, h)], fill=(14, 10, 24))
    pts = [(0, h * 0.80), (w * 0.25, h * 0.735), (w * 0.52, h * 0.715), (w * 0.78, h * 0.73),
           (w, h * 0.79)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        for t in np.linspace(0, 1, 26):
            sx = x0 + (x1 - x0) * t
            sy = y0 + (y1 - y0) * t + math.sin(t * math.pi) * h * 0.018
            if t in (0.0,):
                continue
            d.ellipse([sx - 4 * SS, sy - 4 * SS, sx + 4 * SS, sy + 4 * SS], fill=(255, 196, 96))
        d.line([x0, y0, x1, y1], fill=(30, 24, 40), width=int(2 * SS))
    img = img.resize((W, H), Image.LANCZOS)
    return print_treatment(img, poster_bits=5, grain=12)


def scene_skyline():
    w, h = W * SS, H * SS
    img = vertical_gradient(w, h, [
        (0.0, (4, 6, 26)), (0.42, (10, 14, 48)), (0.62, (26, 20, 62)), (1.0, (6, 8, 24))])
    img = horizontal_glow(img, int(w * 0.24), int(h * 0.60), int(h * 0.30), (150, 30, 90), 0.45)
    img = horizontal_glow(img, int(w * 0.78), int(h * 0.58), int(h * 0.26), (20, 110, 130), 0.45)
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(170):
        sx, sy = random.uniform(0, w), random.uniform(0, h * 0.45)
        r = random.uniform(0.8, 2.2) * SS
        d.ellipse([sx, sy, sx + r, sy + r], fill=(225, 232, 255))
    d.ellipse([w * 0.80, h * 0.07, w * 0.865, h * 0.155], fill=(236, 238, 242))
    d.ellipse([w * 0.815, h * 0.09, w * 0.84, h * 0.115], fill=(200, 204, 214))
    # tower layers, back to front
    def tower_row(base, tone, seed, win_col, density):
        rnd = random.Random(seed)
        x = -int(w * 0.02)
        while x < w:
            tw = rnd.uniform(w * 0.05, w * 0.11)
            th = rnd.uniform(h * 0.16, h * 0.46)
            d.rectangle([x, base - th, x + tw, base], fill=tone)
            if rnd.random() < 0.4:
                d.polygon([(x + tw * 0.3, base - th), (x + tw * 0.5, base - th - h * 0.05),
                           (x + tw * 0.7, base - th)], fill=tone)
            cols = max(2, int(tw / (w * 0.016)))
            rows = max(3, int(th / (h * 0.045)))
            for cx in range(cols):
                for ry in range(rows):
                    if rnd.random() < density:
                        wx = x + tw * (0.12 + cx * 0.72 / max(cols - 1, 1))
                        wy = base - th + th * (0.08 + ry * 0.84 / max(rows - 1, 1))
                        d.rectangle([wx, wy, wx + w * 0.008, wy + h * 0.014], fill=win_col)
            x += tw + rnd.uniform(w * 0.004, w * 0.02)
    tower_row(h * 0.66, (16, 18, 44), 7, (150, 190, 220), 0.30)
    tower_row(h * 0.70, (10, 11, 32), 21, (255, 196, 96), 0.38)
    # neon signs on the front row: cocktail glasses and suns, pure line shapes
    def neon_glass(cx, cy, s, col):
        d.polygon([(cx - 0.030 * w * s, cy - 0.030 * h * s), (cx + 0.030 * w * s, cy - 0.030 * h * s),
                   (cx, cy + 0.012 * h * s)], outline=col, width=int(3.4 * SS))
        d.line([cx, cy + 0.012 * h * s, cx, cy + 0.052 * h * s], fill=col, width=int(3.4 * SS))
        d.line([cx - 0.020 * w * s, cy + 0.056 * h * s, cx + 0.020 * w * s, cy + 0.056 * h * s],
               fill=col, width=int(3.4 * SS))
        d.line([cx - 0.030 * w * s, cy - 0.030 * h * s, cx + 0.012 * w * s, cy - 0.052 * h * s],
               fill=col, width=int(2.6 * SS))

    def neon_sun(cx, cy, s, col):
        r = 0.020 * w * s
        d.ellipse([cx - r, cy - r * 0.75, cx + r, cy + r * 0.75], outline=col, width=int(3.4 * SS))
        for a in range(0, 360, 45):
            x0 = cx + math.cos(math.radians(a)) * r * 1.35
            y0 = cy + math.sin(math.radians(a)) * r * 1.0
            x1 = cx + math.cos(math.radians(a)) * r * 1.8
            y1 = cy + math.sin(math.radians(a)) * r * 1.35
            d.line([x0, y0, x1, y1], fill=col, width=int(3 * SS))

    neon_glass(w * 0.155, h * 0.475, 1.0, (255, 64, 150))
    neon_sun(w * 0.325, h * 0.42, 1.0, (64, 224, 235))
    neon_glass(w * 0.605, h * 0.465, 1.0, (255, 150, 60))
    neon_sun(w * 0.765, h * 0.40, 1.0, (255, 64, 150))
    neon_glass(w * 0.905, h * 0.50, 1.0, (120, 255, 170))
    palm(d, int(w * 0.03), int(h * 0.72), 0.95 * SS, (6, 6, 16), lean=0.3)
    palm(d, int(w * 0.985), int(h * 0.72), 1.05 * SS, (6, 6, 16), lean=-0.3)
    # water: reflection smears
    d.rectangle([0, h * 0.705, w, h], fill=(6, 10, 26))
    for _ in range(210):
        gx, gy = random.uniform(0, w), random.uniform(h * 0.72, h * 0.98)
        col = random.choice([(255, 120, 170), (110, 220, 240), (255, 190, 100), (170, 200, 235)])
        ln = random.uniform(8, 42) * SS
        d.line([gx, gy, gx + ln, gy], fill=col + (120,), width=int(2 * SS))
    img = img.resize((W, H), Image.LANCZOS)
    return print_treatment(img, poster_bits=5, grain=13, halftone_alpha=30)


SCENES = [
    ("convertible-sunset.jpg", scene_convertible),
    ("portrait-neon.jpg", scene_portrait),
    ("gas-station-night.jpg", scene_gas_station),
    ("speedboat-wake.jpg", scene_speedboat),
    ("palm-boulevard.jpg", scene_boulevard),
    ("marina-dusk.jpg", scene_marina),
    ("night-skyline.jpg", scene_skyline),
]

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, fn in SCENES:
        save(fn(), name)
    print("done:", len(SCENES), "scenes")
