// renderCover.js — composes a finished cover on a canvas context.
//
// Order of the stack, back to front: white keyline ground, the graded photo
// panels (each clipped to its layout shape, inset by the gutter so the
// ground shows through as keylines), per-panel location tags, the lettering
// (chrome/neon/block title + neon script), then the poster furniture and
// the tagline strip. The editor preview and the PNG export run this exact
// same function, so what the editor shows is what the export writes.

import { gradeById, renderGradedPanel, drawSpeedLines } from './grades.js';
import { drawCoverTitle, drawScriptSubtitle } from './lettering.js';
import {
  drawCornerRibbon, drawHudPlate, drawPanelTag, drawQuoteBlock,
  drawSealBadge, drawTaglineStrip, drawVolumeTag,
} from './furniture.js';
import { layoutById } from './layouts.js';

function panelPath(ctx, panel, cover, insetPx) {
  const cx = (panel.x + panel.w / 2) * cover.width;
  const cy = (panel.y + panel.h / 2) * cover.height;
  ctx.beginPath();
  panel.points.forEach(([nx, ny], i) => {
    let px = nx * cover.width;
    let py = ny * cover.height;
    if (insetPx > 0) {
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const pull = Math.min(insetPx, dist * 0.4);
      px -= (dx / dist) * pull;
      py -= (dy / dist) * pull;
    }
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

function panelCacheKey(panelState, w, h, gradeId, sliders) {
  const t = panelState;
  return [
    t.photoIndex, w, h, gradeId,
    t.zoom.toFixed(3), t.dx.toFixed(1), t.dy.toFixed(1), t.rotate.toFixed(1), t.mirror ? 1 : 0,
    sliders.strength.toFixed(2), sliders.contrast.toFixed(2), sliders.saturation.toFixed(2),
    sliders.grain.toFixed(2), sliders.vignette.toFixed(2),
    (t.halftone ? Math.max(sliders.halftone, 0.55) : sliders.halftone).toFixed(2),
  ].join('|');
}

// state: the editor state (see studio.js). photos: [{img}] in rail order.
// panelStates: one entry per layout panel. cache: a Map kept by the caller.
export function composeCover(ctx, cover, state, photos, panelStates, cache) {
  const layout = layoutById(state.layoutId);
  const panels = layout.build();
  const grade = gradeById(state.gradeId);
  const gutterPx = state.gutter * cover.height;

  ctx.save();
  ctx.fillStyle = '#f4efe6';
  ctx.fillRect(0, 0, cover.width, cover.height);

  panels.forEach((panel, i) => {
    const ps = panelStates[i];
    if (!ps || photos.length === 0) return;
    const photo = photos[ps.photoIndex % photos.length];
    if (!photo || !photo.img || !photo.img.naturalWidth) return;
    const pw = Math.max(2, Math.round(panel.w * cover.width));
    const ph = Math.max(2, Math.round(panel.h * cover.height));
    const panelGrade = ps.gradeOverride && ps.gradeOverride !== 'auto'
      ? gradeById(ps.gradeOverride) : grade;
    const panelSliders = { ...state.sliders, halftone: ps.halftone ? Math.max(state.sliders.halftone, 0.55) : state.sliders.halftone };
    const key = panelCacheKey(ps, pw, ph, panelGrade.id, panelSliders);
    let tile = cache.get(key);
    if (!tile) {
      tile = renderGradedPanel(photo.img, pw, ph, ps, panelGrade, panelSliders);
      cache.set(key, tile);
    }
    ctx.save();
    panelPath(ctx, panel, cover, gutterPx / 2);
    ctx.clip();
    ctx.drawImage(tile, panel.x * cover.width, panel.y * cover.height, pw, ph);
    if (ps.speedlines) {
      drawSpeedLines(ctx, panel.x * cover.width, panel.y * cover.height, pw, ph, state.sliders.strength);
    }
    ctx.restore();
    // A hairline shade inside each panel edge keeps light photos separated.
    ctx.save();
    panelPath(ctx, panel, cover, gutterPx / 2);
    ctx.lineWidth = Math.max(1, cover.height * 0.0016);
    ctx.strokeStyle = 'rgba(10,2,20,0.35)';
    ctx.stroke();
    ctx.restore();
  });

  if (state.furniture.panelTags) {
    panels.forEach((panel, i) => {
      const ps = panelStates[i];
      if (!(ps && panel.w * cover.width > cover.width * 0.16 && panel.h * cover.height > cover.height * 0.16)) return;
      const opts = {};
      if (panel.x === 0 && panel.y === 0) {
        // The corner panel shares its corner with the ribbon and the
        // volume plate: a small panel anchors its tag to its bottom-left,
        // a wide one shifts the tag past the ribbon band's reach (the band
        // sits at perpendicular distance ~0.105h from the corner, so its
        // outer edge crosses x + y ≈ 0.177h in pixel space).
        if (state.furniture.ribbon && panel.w < 0.4) opts.anchorBottom = true;
        else if (state.furniture.ribbon) {
          opts.dx = Math.max(0, cover.height * 0.177 - cover.height * 0.012 + cover.height * 0.012);
        } else if (state.furniture.volume) opts.dx = cover.width * 0.148;
      }
      drawPanelTag(ctx, panel, cover, ps.tag, opts);
    });
  }

  const stripHeight = state.furniture.taglineStrip ? cover.height * 0.088 : 0;
  const titleTop = drawCoverTitle(
    ctx,
    { ...cover, titleLift: stripHeight * 0.42 },
    state.texts.title,
    state.letteringStyle,
    state.titlePlacement,
    state.titleLean,
  );
  drawScriptSubtitle(ctx, cover, state.texts.script, titleTop, state.letteringStyle);

  if (state.furniture.volume) {
    drawVolumeTag(
      ctx, cover, state.texts.volume, state.texts.edition,
      state.furniture.ribbon ? cover.height * 0.165 : null,
    );
  }
  if (state.furniture.seal) {
    drawSealBadge(
      ctx, cover,
      [state.texts.sealTop, state.texts.sealMid, state.texts.sealBot],
      cover.width * 0.905, cover.height * 0.115, cover.height * 0.082,
    );
  }
  if (state.furniture.ribbon) drawCornerRibbon(ctx, cover, state.texts.ribbon);
  if (state.furniture.quote) {
    drawQuoteBlock(
      ctx, cover, state.texts.quote, state.texts.quoteSource, state.texts.stars,
      cover.width * 0.028, titleTop - cover.height * 0.128,
    );
  }
  if (state.furniture.hud) {
    drawHudPlate(ctx, cover, state.texts.hudWord, state.texts.stars, cover.width * 0.972, titleTop - cover.height * 0.098);
  }
  if (state.furniture.taglineStrip) {
    drawTaglineStrip(ctx, cover, state.texts.tagline, stripHeight);
  }
  ctx.restore();
}
