// furniture.js — the poster furniture layer for Sunset Press covers.
//
// The layer that makes a panel grid read as a printed poster: a gold seal,
// a star rating with a pull-quote, a corner ribbon, a volume tag, a HUD
// word with its own stars, per-panel location tags, and a bottom tagline
// strip with palm silhouettes, a credits microline and a barcode. Every
// string is editable in the editor; every element can be toggled off.

const DISPLAY_FONT = 'Anton, "Arial Black", sans-serif';
const SERIF_FONT = 'Georgia, "DejaVu Serif", serif';

function spacedText(ctx, text, x, y, spacing) {
  // Anton has no letter-spacing on every canvas, so tracked capitals are
  // drawn glyph by glyph when a spacing is asked for.
  if (!spacing) {
    ctx.fillText(text, x, y);
    return;
  }
  const align = ctx.textAlign;
  let cursor = x;
  if (align === 'center') {
    const total = [...text].reduce((sum, ch) => sum + ctx.measureText(ch).width + spacing, -spacing);
    cursor = x - total / 2;
  }
  const previous = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = previous;
}

export function drawStarRow(ctx, cx, cy, size, count, color = '#ffc93c') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${size}px ${SERIF_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = '★'.repeat(Math.max(0, Math.min(5, count)));
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = size * 0.18;
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

// Gold starburst seal with three short lines of type, top-right by default.
export function drawSealBadge(ctx, cover, lines, cx, cy, radius) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.21);
  ctx.beginPath();
  const spikes = 18;
  for (let i = 0; i < spikes * 2; i += 1) {
    const r = i % 2 === 0 ? radius : radius * 0.80;
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const grad = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
  grad.addColorStop(0, '#ffe98a');
  grad.addColorStop(0.75, '#ffc93c');
  grad.addColorStop(1, '#e8960f');
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(8,2,18,0.55)';
  ctx.shadowBlur = radius * 0.16;
  ctx.shadowOffsetY = radius * 0.06;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = radius * 0.045;
  ctx.strokeStyle = '#7a4a00';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.70, 0, Math.PI * 2);
  ctx.lineWidth = radius * 0.03;
  ctx.stroke();
  ctx.fillStyle = '#4a2a00';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const sizes = [0.30, 0.235, 0.20];
  lines.slice(0, 3).forEach((line, i) => {
    ctx.font = `${radius * sizes[i]}px ${DISPLAY_FONT}`;
    ctx.fillText(line, 0, (i - 1) * radius * 0.30);
  });
  ctx.restore();
}

// Diagonal ribbon across the top-left corner: in the rotated frame the
// band runs along x at a fixed distance d from the corner, which puts its
// centre on the corner's 45-degree diagonal in screen space.
export function drawCornerRibbon(ctx, cover, text) {
  if (!text.trim()) return;
  const h = cover.height;
  const bandH = h * 0.040;
  const d = h * 0.105;
  ctx.save();
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = '#d81b60';
  ctx.shadowColor = 'rgba(8,2,18,0.5)';
  ctx.shadowBlur = h * 0.008;
  ctx.fillRect(-cover.width * 0.30, d - bandH / 2, cover.width * 0.60, bandH);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#ffe9f4';
  ctx.font = `${bandH * 0.47}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  spacedText(ctx, text.toUpperCase(), 0, d + bandH * 0.03, bandH * 0.05);
  ctx.restore();
}

// Volume / edition tag: a small dark plate with a gold keyline, top-left.
// yTop lets the renderer drop it below the corner ribbon's sweep.
export function drawVolumeTag(ctx, cover, volumeLine, editionLine, yTop = null) {
  const w = cover.width;
  const h = cover.height;
  const boxW = w * 0.118;
  const boxH = h * 0.078;
  const x = w * 0.022;
  const y = yTop ?? h * 0.022;
  ctx.save();
  ctx.fillStyle = 'rgba(10,4,24,0.88)';
  ctx.fillRect(x, y, boxW, boxH);
  ctx.lineWidth = Math.max(2, h * 0.0022);
  ctx.strokeStyle = '#ffc93c';
  ctx.strokeRect(x, y, boxW, boxH);
  ctx.fillStyle = '#ffd76a';
  ctx.textAlign = 'center';
  // Both lines shrink to the plate: on narrow covers the box is only ~120px
  // wide and an unshrunk EDITION line would spill past its keyline.
  let volSize = boxH * 0.40;
  ctx.font = `${volSize}px ${DISPLAY_FONT}`;
  while (volSize > 8 && ctx.measureText(volumeLine).width > boxW * 0.90) {
    volSize *= 0.92;
    ctx.font = `${volSize}px ${DISPLAY_FONT}`;
  }
  ctx.fillText(volumeLine, x + boxW / 2, y + boxH * 0.44);
  ctx.fillStyle = '#f5e9ff';
  let edSize = boxH * 0.27;
  ctx.font = `${edSize}px ${DISPLAY_FONT}`;
  // The target is 0.78, not 0.88: spacedText adds letterspacing on top of
  // the measured width, and the line must stay inside the keyline.
  while (edSize > 7 && ctx.measureText(editionLine).width > boxW * 0.78) {
    edSize *= 0.92;
    ctx.font = `${edSize}px ${DISPLAY_FONT}`;
  }
  spacedText(ctx, editionLine, x + boxW / 2, y + boxH * 0.76, boxH * 0.04);
  ctx.restore();
}

// Star rating + pull-quote block, set over the panels' lower-left.
export function drawQuoteBlock(ctx, cover, quote, source, stars, x, y) {
  const h = cover.height;
  ctx.save();
  drawStarRow(ctx, x + h * 0.082, y, h * 0.034, stars);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(5,0,14,0.85)';
  ctx.shadowBlur = h * 0.010;
  ctx.textAlign = 'left';
  ctx.font = `italic 700 ${h * 0.027}px ${SERIF_FONT}`;
  const quoteText = `“${quote}”`;
  ctx.fillText(quoteText, x, y + h * 0.040);
  ctx.font = `${h * 0.0165}px ${DISPLAY_FONT}`;
  ctx.fillStyle = '#ffd76a';
  spacedText(ctx, `— ${source}`.toUpperCase(), x + 2, y + h * 0.066, h * 0.002);
  ctx.restore();
}

// HUD word + stars in a stencil plate, lower-right.
export function drawHudPlate(ctx, cover, word, stars, rightX, y) {
  const h = cover.height;
  ctx.save();
  ctx.font = `${h * 0.034}px ${DISPLAY_FONT}`;
  const wordWidth = ctx.measureText(word.toUpperCase()).width;
  const boxW = wordWidth + h * 0.115;
  const boxH = h * 0.062;
  const x = rightX - boxW;
  ctx.fillStyle = 'rgba(10,4,24,0.82)';
  ctx.fillRect(x, y, boxW, boxH);
  ctx.lineWidth = Math.max(2, h * 0.002);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.strokeRect(x, y, boxW, boxH);
  ctx.fillStyle = '#ff5252';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(word.toUpperCase(), x + h * 0.016, y + boxH * 0.54);
  drawStarRow(ctx, x + boxW - h * 0.043, y + boxH * 0.5, h * 0.024, stars, '#ffffff');
  ctx.restore();
}

function drawPalmSilhouette(ctx, x, baseY, height, flip) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(flip, 1);
  ctx.strokeStyle = '#0a0416';
  ctx.lineCap = 'round';
  ctx.lineWidth = height * 0.045;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(height * 0.10, -height * 0.55, height * 0.30, -height * 0.98);
  ctx.stroke();
  ctx.lineWidth = height * 0.030;
  for (let i = 0; i < 6; i += 1) {
    const a = Math.PI * (0.12 + (i / 5) * 0.76);
    const len = height * (0.34 + 0.08 * Math.sin(i * 2.4));
    const ex = height * 0.30 + Math.cos(a) * len;
    const ey = -height * 0.98 - Math.sin(a) * len * 0.38 + len * 0.30;
    ctx.beginPath();
    ctx.moveTo(height * 0.30, -height * 0.98);
    ctx.quadraticCurveTo(height * 0.30 + Math.cos(a) * len * 0.6, -height * 0.98 - Math.sin(a) * len * 0.55, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBarcode(ctx, x, y, w, h, seedText) {
  ctx.save();
  ctx.fillStyle = '#f7f3ea';
  ctx.fillRect(x, y, w, h);
  let seed = 7;
  for (const ch of seedText) seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
  ctx.fillStyle = '#14100c';
  let cursor = x + w * 0.06;
  const innerW = w * 0.88;
  while (cursor < x + innerW) {
    seed = (seed * 137 + 71) % 9973;
    const barW = (1 + (seed % 4)) * (w / 64);
    if (seed % 3 !== 0) ctx.fillRect(cursor, y + h * 0.10, barW, h * 0.66);
    cursor += barW + w / 72;
  }
  ctx.font = `${h * 0.20}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('SP-2026-VC', x + w / 2, y + h * 0.94);
  ctx.restore();
}

// The bottom strip: palms, tagline, credits microline and barcode.
export function drawTaglineStrip(ctx, cover, tagline, stripHeight) {
  const w = cover.width;
  const h = cover.height;
  const y = h - stripHeight;
  ctx.save();
  const grad = ctx.createLinearGradient(0, y, 0, h);
  grad.addColorStop(0, 'rgba(16,5,32,0.96)');
  grad.addColorStop(1, 'rgba(8,2,18,0.98)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, y, w, stripHeight);
  ctx.fillStyle = '#ff3d77';
  ctx.fillRect(0, y, w, Math.max(2, h * 0.0035));
  drawPalmSilhouette(ctx, w * 0.020, h - stripHeight * 0.10, stripHeight * 0.86, 1);
  drawPalmSilhouette(ctx, w * 0.062, h - stripHeight * 0.06, stripHeight * 0.62, 1);
  drawPalmSilhouette(ctx, w * 0.978, h - stripHeight * 0.10, stripHeight * 0.86, -1);
  // tagline centred
  ctx.fillStyle = '#ffe9a8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${stripHeight * 0.30}px ${DISPLAY_FONT}`;
  spacedText(ctx, tagline.toUpperCase(), w / 2, y + stripHeight * 0.36, stripHeight * 0.028);
  // credits microline
  ctx.fillStyle = 'rgba(240,230,255,0.78)';
  ctx.font = `${stripHeight * 0.135}px ${DISPLAY_FONT}`;
  spacedText(
    ctx,
    'COVER MADE WITH SUNSET PRESS STUDIO · ART GENERATED IN-STUDIO · PHOTOS NEVER LEAVE YOUR MACHINE',
    w / 2, y + stripHeight * 0.74, stripHeight * 0.012);
  drawBarcode(ctx, w * 0.905, y + stripHeight * 0.16, w * 0.070, stripHeight * 0.68, tagline);
  ctx.restore();
}

// Per-panel location tag: place · time over a sub-line, set into a panel
// corner. opts.dx shifts it right (clear of the volume plate / ribbon on
// the corner panel); opts.anchorBottom sets it into the panel's bottom-left
// instead, for small corner panels the ribbon would otherwise swallow.
export function drawPanelTag(ctx, panel, cover, tag, opts = {}) {
  if (!tag.place && !tag.time) return;
  const h = cover.height;
  const px = panel.x * cover.width + (opts.dx || 0);
  const py = panel.y * cover.height;
  const inset = h * 0.012;
  const fontSize = Math.max(11, h * 0.0195);
  const subSize = fontSize * 0.68;
  ctx.save();
  ctx.font = `${fontSize}px ${DISPLAY_FONT}`;
  const line1 = `${tag.place} · ${tag.time}`.toUpperCase();
  const line2 = (tag.sub || '').toUpperCase();
  const width = Math.max(ctx.measureText(line1).width, line2 ? ctx.measureText(line2) * 1.0 : 0)
    + fontSize * 1.1;
  const boxH = line2 ? fontSize * 2.15 : fontSize * 1.45;
  const topY = opts.anchorBottom
    ? py + panel.h * cover.height - boxH - inset
    : py + inset;
  ctx.fillStyle = 'rgba(8,3,20,0.78)';
  ctx.fillRect(px + inset, topY, width, boxH);
  ctx.fillStyle = '#ff3d77';
  ctx.fillRect(px + inset, topY, Math.max(3, h * 0.0035), boxH);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(line1, px + inset + fontSize * 0.45, topY + fontSize * 1.02);
  if (line2) {
    ctx.font = `${subSize}px ${DISPLAY_FONT}`;
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(line2, px + inset + fontSize * 0.45, topY + fontSize * 1.02 + subSize * 1.25);
  }
  ctx.restore();
}
