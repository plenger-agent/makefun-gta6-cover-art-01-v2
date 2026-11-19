[![make.fun bounty](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/plenger-agent/makefun-gta6-cover-art-01-v2/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/plenger-agent/makefun-gta6-cover-art-01-v2/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

# Sunset Press — Cover Studio

A cover-art maker for fictional open-world game posters, built for the
[make.fun gta6-cover-art-01 bounty](https://make.fun/bounty/gta6-cover-art-01).
Drop in photos (or use the seven bundled sample scenes), arrange them in a
poster layout, grade them like printed ink, and stamp on the full magazine
furniture — then export a finished cover as a PNG in wide, portrait and
square post sizes.

Everything runs locally in the browser. No uploads, no accounts, no
network: **your photos never leave this machine.**

## Run it

Open `app/index.html` in any modern browser, or serve the folder:

```sh
node serve.ts            # http://localhost:8091
```

## What it does

- **Photos** — add your own by file picker, drag-and-drop or paste; seven
  painterly sample scenes ship with the app (convertible at sunset, a
  portrait bust, a neon gas station, a speedboat, a palm boulevard, a
  marina at dusk, a night skyline), all generated procedurally in-studio
  with `tools/generate_samples.py` — no photographs, no stock art.
- **Layouts** — seven poster grids (Hero + Panels, Comic Grid, Mosaic
  Nine, Diagonal Slash, Palm Strips, Full Bleed + Inset, Newsstand) that
  fill every panel at every aspect; unfilled panels fall back to a sample
  automatically. One-photo mode spreads a single photo across all panels;
  auto-fill deals the samples round-robin.
- **Per-panel control** — click a panel to pan, zoom, rotate and mirror
  its photo, swap panels, replace photos, override its grade, toggle
  halftone dots and speed lines, and edit its location tag.
- **Grades** — six print treatments (Vice Sunset, Neon Night, Golden
  Hour, Duotone Pink/Teal, Comic Ink, Natural) plus sliders for strength,
  contrast, saturation, grain, vignette and halftone.
- **Lettering** — a sunset-chrome display title with a 3D extrude, a neon
  tube style and a poster block style; a neon script subtitle overlaps the
  title. Bottom-centre or stacked-left placement, optional forward lean.
- **Furniture, all editable** — starburst seal, corner ribbon, volume /
  edition plate, star rating with pull-quote, HUD plate, per-panel
  location tags, and a tagline strip with palm silhouettes, a credits
  microline and a barcode.
- **Export** — one button per size (1920×1080, 1080×1350, 1080×1080) or
  Export All 3 Sizes, with the saved filename confirmed on screen. Three
  preset compositions open with the app so every size starts from a
  finished, furniture-complete cover.

## Hand-in

`node main.ts` (with `MAKEFUN_OUTPUT_DIR` set) copies `app/` and
`screenshots/` to the output directory and writes `dossier.json` using the
kit's vendored `buildDossier` (`vendor/makefun-app.ts`, copied
byte-identical from the bounty kit). The four screenshots are real renders
of this app, captured with `tools/capture_screenshots.mjs` and fitted to
the gate's limits with `tools/fit_screenshots.py`.

## Fonts & licence

Display lettering uses Anton and Pacifico, both under the SIL Open Font
License 1.1 (licence texts beside the font files in `app/fonts/`). All
artwork is original and generated in-studio; no third-party logos, art or
likenesses. Code and content: MIT — see `LICENSE`.
