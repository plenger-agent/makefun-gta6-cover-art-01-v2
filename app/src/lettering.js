// lettering.js — the cover's two-part lettering system for Sunset Press.
//
// A huge display title (Anton, shipped under the OFL) in one of three
// lettering styles — Sunset Chrome, Neon Tube, Poster Block — overlapped by
// a neon-glow script subtitle (Pacifico, also OFL). The title is sized to
// dominate the cover's lower third and is drawn over the panels, never
// inside a panel, which is what makes the page read as a poster.

export const LETTERING_STYLES = [
  { id: 'chrome', name: 'Sunset Chrome' },
  { id: 'neon', name: 'Neon Tube' },
  { id: 'block', name: 'Poster Block' },
];

const DISPLAY_FONT = 'Anton, "Arial Black", sans-serif';
const SCRIPT_FONT = 'Pacifico, "Comic Sans MS", cursive';

export function fitFontSize(ctx, text, fontFamily, maxWidth, startSize, minSize = 12) {
  let size = startSize;
  ctx.font = `${size}px ${fontFamily}`;
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size *= 0.94;
    ctx.font = `${size}px ${fontFamily}`;
  }
  return size;
}

function chromeGradient(ctx, x, y, size) {
  const grad = ctx.createLinearGradient(0, y - size, 0, y + size * 0.12);
  grad.addColorStop(0.0, '#fffbe8');
  grad.addColorStop(0.28, '#ffe066');
  grad.addColorStop(0.52, '#ff9e3c');
  grad.addColorStop(0.74, '#ff3d77');
  grad.addColorStop(1.0, '#8a3ffc');
  return grad;
}

function drawChromeLine(ctx, text, cx, baseline, size, align = 'center') {
  ctx.save();
  ctx.font = `${size}px ${DISPLAY_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  // 3D extrude: a staircase of dark copies stepping down-left.
  ctx.fillStyle = '#170726';
  const depth = Math.max(3, size * 0.055);
  const steps = 7;
  for (let i = steps; i >= 1; i -= 1) {
    ctx.fillText(text, cx - (i * depth) / steps, baseline + (i * depth) / steps + size * 0.02);
  }
  // Thick black outline.
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = '#0b0316';
  ctx.lineWidth = size * 0.17;
  ctx.strokeText(text, cx, baseline);
  // Sunset-chrome face with a soft drop shadow.
  ctx.shadowColor = 'rgba(10, 2, 24, 0.55)';
  ctx.shadowBlur = size * 0.10;
  ctx.shadowOffsetY = size * 0.05;
  ctx.fillStyle = chromeGradient(ctx, cx, baseline, size);
  ctx.fillText(text, cx, baseline);
  ctx.shadowColor = 'transparent';
  // A hard white sheen across the top of the letters.
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - size * 10, baseline - size * 1.05, size * 20, size * 0.42);
  ctx.clip();
  ctx.globalAlpha = 0.20;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, cx, baseline);
  ctx.restore();
  ctx.restore();
}

function drawNeonLine(ctx, text, cx, baseline, size, align = 'center') {
  ctx.save();
  ctx.font = `${size}px ${DISPLAY_FONT}`;
  ctx.textAlign = align;
  ctx.lineJoin = 'round';
  // Outer glow pass, then a magenta tube, then a near-white core.
  ctx.shadowColor = '#ff2e9a';
  ctx.shadowBlur = size * 0.34;
  ctx.strokeStyle = '#ff2e9a';
  ctx.lineWidth = size * 0.115;
  ctx.strokeText(text, cx, baseline);
  ctx.strokeText(text, cx, baseline);
  ctx.shadowColor = '#37c8ff';
  ctx.shadowBlur = size * 0.16;
  ctx.strokeStyle = '#ff7ac0';
  ctx.lineWidth = size * 0.055;
  ctx.strokeText(text, cx, baseline);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fdf4ff';
  ctx.globalAlpha = 0.92;
  ctx.fillText(text, cx, baseline);
  ctx.restore();
}

function drawBlockLine(ctx, text, cx, baseline, size, align = 'center') {
  ctx.save();
  ctx.font = `${size}px ${DISPLAY_FONT}`;
  ctx.textAlign = align;
  ctx.lineJoin = 'round';
  // Hard offset shadow block, thick outline, cream face.
  ctx.fillStyle = '#12041f';
  ctx.fillText(text, cx + size * 0.055, baseline + size * 0.065);
  ctx.strokeStyle = '#0b0316';
  ctx.lineWidth = size * 0.15;
  ctx.strokeText(text, cx, baseline);
  ctx.fillStyle = '#fff3d0';
  ctx.fillText(text, cx, baseline);
  // A coral underline bar that ties the block to the poster.
  const width = ctx.measureText(text).width;
  const left = align === 'left' ? cx : cx - width / 2;
  ctx.fillStyle = '#ff3d5e';
  ctx.fillRect(left, baseline + size * 0.13, width, size * 0.075);
  ctx.restore();
}

const LINE_DRAWERS = { chrome: drawChromeLine, neon: drawNeonLine, block: drawBlockLine };

// Draws the title (one or two lines) and returns the top y it reached, so
// the script subtitle can overlap it. placement: 'bottom' centres the title
// across the lower third; 'stacked' left-aligns two lines up the left edge.
export function drawCoverTitle(ctx, cover, title, styleId, placement, lean) {
  const drawLine = LINE_DRAWERS[styleId] ?? drawChromeLine;
  const words = title.trim().split(/\s+/).filter(Boolean);
  const lines = placement === 'stacked' && words.length > 1
    ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')]
    : [title.trim()];
  const maxWidth = cover.width * (placement === 'stacked' ? 0.80 : 0.94);
  let size = cover.height * (lines.length > 1 ? 0.155 : 0.185);
  for (const line of lines) {
    size = Math.min(size, fitFontSize(ctx, line, DISPLAY_FONT, maxWidth, size));
  }
  ctx.save();
  if (lean) {
    ctx.translate(cover.width / 2, cover.height / 2);
    ctx.transform(1, 0, -0.06, 1, 0, 0);
    ctx.translate(-cover.width / 2, -cover.height / 2);
  }
  const lineHeight = size * 1.04;
  let baseline = placement === 'stacked'
    ? cover.height * 0.60 + lineHeight * (lines.length - 1)
    : cover.height * 0.895;
  // The tagline strip owns the bottom ~9% when present; the renderer moves
  // the title up by passing a baseline offset through cover.titleLift.
  baseline -= cover.titleLift || 0;
  const stacked = placement === 'stacked';
  const anchorX = stacked ? cover.width * 0.055 : cover.width / 2;
  lines.forEach((line, i) => {
    const y = baseline - (lines.length - 1 - i) * lineHeight;
    drawLine(ctx, line, anchorX, y, size, stacked ? 'left' : 'center');
  });
  ctx.restore();
  return baseline - lines.length * lineHeight;
}

// The neon script subtitle, overlapping the title's top-right shoulder.
export function drawScriptSubtitle(ctx, cover, script, titleTop, styleId) {
  if (!script.trim()) return;
  const size = fitFontSize(ctx, script, SCRIPT_FONT, cover.width * 0.52, cover.height * 0.062);
  ctx.save();
  ctx.font = `${size}px ${SCRIPT_FONT}`;
  ctx.textAlign = 'center';
  const cx = cover.width * 0.635;
  const cy = titleTop + size * 0.72;
  ctx.translate(cx, cy);
  ctx.rotate(-0.045);
  ctx.shadowColor = styleId === 'neon' ? '#37c8ff' : '#ff2e9a';
  ctx.shadowBlur = size * 0.5;
  ctx.fillStyle = styleId === 'neon' ? '#aef3ff' : '#ffd7f2';
  ctx.fillText(script, 0, 0);
  ctx.fillText(script, 0, 0);
  ctx.shadowBlur = size * 0.12;
  ctx.fillStyle = '#fff7fd';
  ctx.fillText(script, 0, 0);
  ctx.restore();
}
