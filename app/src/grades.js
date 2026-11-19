// grades.js — colour grades and print effects for Sunset Press panels.
//
// A panel photo is drawn once with its crop transform, then graded: a base
// CSS-filter pass (contrast / saturation / brightness from the grade plus
// the editor sliders), an optional pixel pass (duotone map or posterize,
// applied through a 256-entry lookup table), and finally the print overlays
// every cover shares — tint gradient, vignette, halftone dots and grain —
// so panels shot at different hours still read as one printed poster.

export const COVER_GRADES = [
  { id: 'vice-sunset', name: 'Vice Sunset', filter: 'contrast(1.07) saturate(1.18) brightness(1.02)', tint: ['#ff9a3c', '#7a1e6e'], tintAlpha: 0.34, warm: 0.25 },
  { id: 'neon-night', name: 'Neon Night', filter: 'contrast(1.10) saturate(1.22) brightness(0.96)', tint: ['#123a8f', '#ff2e9a'], tintAlpha: 0.38, warm: -0.10 },
  { id: 'golden-hour', name: 'Golden Hour', filter: 'contrast(1.03) saturate(1.10) brightness(1.06)', tint: ['#ffcf6e', '#b84a2e'], tintAlpha: 0.26, warm: 0.38 },
  { id: 'duotone-pink-teal', name: 'Duotone Pink/Teal', filter: 'contrast(1.05) saturate(0.9)', duotone: ['#0d2b52', '#2ee6c8', '#ff4f9a'], tint: null, tintAlpha: 0, warm: 0 },
  { id: 'comic-ink', name: 'Comic Ink', filter: 'contrast(1.16) saturate(1.30)', posterize: 5, tint: ['#ffd23e', '#28306e'], tintAlpha: 0.16, warm: 0.08 },
  { id: 'natural', name: 'Natural', filter: 'contrast(1.01) saturate(1.03)', tint: null, tintAlpha: 0, warm: 0.02 },
];

export function gradeById(id) {
  return COVER_GRADES.find((grade) => grade.id === id) ?? COVER_GRADES[0];
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function buildPixelLut(grade, strength) {
  // Returns a per-channel LUT array of 256 [r,g,b] triples, or null when the
  // grade needs no pixel pass at this strength.
  if (grade.duotone) {
    const [shadow, mid, highlight] = grade.duotone.map(hexToRgb);
    const lut = [];
    for (let i = 0; i < 256; i += 1) {
      const t = i / 255;
      const base = t < 0.5
        ? shadow.map((c, k) => c + (mid[k] - c) * (t * 2))
        : mid.map((c, k) => c + (highlight[k] - c) * ((t - 0.5) * 2));
      lut.push(base.map((c) => Math.round(i + (c - i) * strength)));
    }
    return lut;
  }
  if (grade.posterize) {
    const levels = grade.posterize;
    const lut = [];
    for (let i = 0; i < 256; i += 1) {
      const snapped = Math.round((i / 255) * (levels - 1)) * (255 / (levels - 1));
      const v = Math.round(i + (snapped - i) * Math.min(1, strength + 0.25));
      lut.push([v, v, v]);
    }
    return lut;
  }
  return null;
}

function applyPixelLut(canvas, lut) {
  const ctx = canvas.getContext('2d');
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = lut[data[i]];
    const g = lut[data[i + 1]];
    const b = lut[data[i + 2]];
    // For duotone the LUT is built from luminance; posterize LUTs are grey
    // and act per channel. Duotone entries differ per channel by design:
    // when all three channels of an entry agree it is a posterize LUT.
    if (r[0] === r[1] && r[1] === r[2]) {
      data[i] = r[0]; data[i + 1] = g[0]; data[i + 2] = b[0];
    } else {
      const lum = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
      const mapped = lut[lum];
      data[i] = mapped[0]; data[i + 1] = mapped[1]; data[i + 2] = mapped[2];
    }
  }
  ctx.putImageData(image, 0, 0);
}

let grainTile = null;
function getGrainTile() {
  if (grainTile) return grainTile;
  grainTile = document.createElement('canvas');
  grainTile.width = 180; grainTile.height = 180;
  const ctx = grainTile.getContext('2d');
  const image = ctx.createImageData(180, 180);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 96 + Math.random() * 64;
    image.data[i] = v; image.data[i + 1] = v; image.data[i + 2] = v; image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return grainTile;
}

let halftoneTile = null;
function getHalftoneTile() {
  if (halftoneTile) return halftoneTile;
  halftoneTile = document.createElement('canvas');
  halftoneTile.width = 9; halftoneTile.height = 9;
  const ctx = halftoneTile.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(4.5, 4.5, 2.1, 0, Math.PI * 2);
  ctx.fill();
  return halftoneTile;
}

// Draws `image` into a w x h offscreen canvas under the panel transform
// (cover-fit plus the editor's pan / zoom / rotate / mirror), grades it and
// returns the canvas. The caller clips it to the panel shape.
export function renderGradedPanel(image, w, h, transform, grade, sliders) {
  const raw = document.createElement('canvas');
  raw.width = Math.max(2, Math.round(w));
  raw.height = Math.max(2, Math.round(h));
  const rctx = raw.getContext('2d');
  const coverScale = Math.max(raw.width / image.naturalWidth, raw.height / image.naturalHeight);
  const scale = coverScale * (transform.zoom || 1);
  const dw = image.naturalWidth * scale;
  const dh = image.naturalHeight * scale;
  rctx.save();
  rctx.translate(raw.width / 2 + (transform.dx || 0), raw.height / 2 + (transform.dy || 0));
  rctx.rotate(((transform.rotate || 0) * Math.PI) / 180);
  if (transform.mirror) rctx.scale(-1, 1);
  rctx.drawImage(image, -dw / 2, -dh / 2, dw, dh);
  rctx.restore();

  const out = document.createElement('canvas');
  out.width = raw.width; out.height = raw.height;
  const octx = out.getContext('2d');
  const strength = sliders.strength;
  octx.filter = grade.filter
    + ` contrast(${sliders.contrast}) saturate(${sliders.saturation})`;
  octx.drawImage(raw, 0, 0);
  octx.filter = 'none';

  const lut = buildPixelLut(grade, strength);
  if (lut) applyPixelLut(out, lut);

  if (grade.tint && grade.tintAlpha > 0) {
    const grad = octx.createLinearGradient(0, 0, raw.width * 0.35, raw.height);
    grad.addColorStop(0, grade.tint[0]);
    grad.addColorStop(1, grade.tint[1]);
    octx.globalCompositeOperation = 'soft-light';
    octx.globalAlpha = grade.tintAlpha * (0.4 + strength * 0.6);
    octx.fillStyle = grad;
    octx.fillRect(0, 0, raw.width, raw.height);
    octx.globalAlpha = 1;
    octx.globalCompositeOperation = 'source-over';
  }
  if (grade.warm) {
    octx.globalCompositeOperation = grade.warm > 0 ? 'overlay' : 'soft-light';
    octx.globalAlpha = Math.abs(grade.warm) * 0.35;
    octx.fillStyle = grade.warm > 0 ? '#ff8c2e' : '#2e5cff';
    octx.fillRect(0, 0, raw.width, raw.height);
    octx.globalAlpha = 1;
    octx.globalCompositeOperation = 'source-over';
  }
  if (sliders.halftone > 0.01) {
    octx.globalCompositeOperation = 'overlay';
    octx.globalAlpha = sliders.halftone * 0.5;
    octx.fillStyle = octx.createPattern(getHalftoneTile(), 'repeat');
    octx.fillRect(0, 0, raw.width, raw.height);
    octx.globalAlpha = 1;
    octx.globalCompositeOperation = 'source-over';
  }
  if (sliders.grain > 0.01) {
    octx.globalCompositeOperation = 'overlay';
    octx.globalAlpha = sliders.grain * 0.30;
    octx.fillStyle = octx.createPattern(getGrainTile(), 'repeat');
    octx.fillRect(0, 0, raw.width, raw.height);
    octx.globalAlpha = 1;
    octx.globalCompositeOperation = 'source-over';
  }
  if (sliders.vignette > 0.01) {
    const rad = octx.createRadialGradient(
      raw.width / 2, raw.height / 2, Math.min(raw.width, raw.height) * 0.42,
      raw.width / 2, raw.height / 2, Math.max(raw.width, raw.height) * 0.78);
    rad.addColorStop(0, 'rgba(8,2,16,0)');
    rad.addColorStop(1, `rgba(8,2,16,${0.55 * sliders.vignette})`);
    octx.fillStyle = rad;
    octx.fillRect(0, 0, raw.width, raw.height);
  }
  return out;
}

// Speed-lines overlay for a single panel (drawn by the cover renderer when
// the panel's speed-lines toggle is on): white rays from the top corner.
export function drawSpeedLines(ctx, x, y, w, h, strength) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.16 * strength;
  ctx.strokeStyle = '#fff';
  const cx = x + w * 0.85;
  const cy = y + h * 0.1;
  for (let i = 0; i < 26; i += 1) {
    const angle = Math.PI * (0.55 + i * 0.028);
    ctx.lineWidth = 1 + (i % 3);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * w * 1.2, cy + Math.sin(angle) * h * 1.2);
    ctx.stroke();
  }
  ctx.restore();
}
