// studio.js — the Sunset Press editor: state, wiring and export.
//
// The editor opens on a finished cover (composition one) built from the
// bundled sample scenes, so the first thing anyone sees is the product.
// Every control edits the same state object the cover renderer reads, and
// the PNG export runs the identical composeCover pipeline at full size.

import { COVER_GRADES, gradeById } from './grades.js';
import { LETTERING_STYLES } from './lettering.js';
import { COVER_LAYOUTS, POST_SIZES, layoutById, panelIndexAt } from './layouts.js';
import { composeCover } from './renderCover.js';

const SAMPLE_PHOTOS = [
  { src: 'samples/convertible-sunset.jpg', name: 'Convertible at sunset' },
  { src: 'samples/portrait-neon.jpg', name: 'Portrait, neon halo' },
  { src: 'samples/gas-station-night.jpg', name: 'Neon gas station' },
  { src: 'samples/speedboat-wake.jpg', name: 'Speedboat wake' },
  { src: 'samples/palm-boulevard.jpg', name: 'Palm boulevard' },
  { src: 'samples/marina-dusk.jpg', name: 'Marina at dusk' },
  { src: 'samples/night-skyline.jpg', name: 'Night skyline' },
];

const MAX_PANELS = 12;

function freshPanel(photoIndex = 0) {
  return {
    photoIndex, dx: 0, dy: 0, zoom: 1, rotate: 0, mirror: false,
    gradeOverride: 'auto', halftone: false, speedlines: false,
    tag: { place: '', time: '', sub: '' },
  };
}

const photos = [];
const panelStates = Array.from({ length: MAX_PANELS }, () => freshPanel());
let selectedPanel = 0;
let armedPhoto = -1;

const state = {
  sizeKey: 'wide',
  layoutId: 'hero-panels',
  gradeId: 'vice-sunset',
  sliders: { strength: 0.85, contrast: 1.06, saturation: 1.12, grain: 0.5, vignette: 0.45, halftone: 0.12 },
  gutter: 0.0075,
  letteringStyle: 'chrome',
  titlePlacement: 'bottom',
  titleLean: true,
  texts: {
    title: 'NEON HARBOR', script: 'midnight heat', tagline: 'Every sunset has a price',
    quote: 'A fever dream in neon', quoteSource: 'The Coast Herald',
    sealTop: 'ORIGINAL', sealMid: 'COVER ART', sealBot: 'EST. 2026',
    volume: 'VOL. 06', edition: 'EDITION 26', ribbon: "Collector's Edition",
    hudWord: 'WANTED', stars: 5,
  },
  furniture: { seal: true, quote: true, ribbon: true, volume: true, hud: true, taglineStrip: true, panelTags: true },
};

// Three finished compositions, one per post size — the screenshot set and
// the studio's own starting points. Panels reference SAMPLE_PHOTOS indexes.
const COMPOSITIONS = [
  {
    sizeKey: 'wide', layoutId: 'hero-panels', gradeId: 'vice-sunset', letteringStyle: 'chrome',
    texts: {
      title: 'NEON HARBOR', script: 'midnight heat', tagline: 'Every sunset has a price',
      quote: 'A fever dream in neon', quoteSource: 'The Coast Herald',
      sealTop: 'ORIGINAL', sealMid: 'COVER ART', sealBot: 'EST. 2026',
      volume: 'VOL. 06', edition: 'EDITION 26', ribbon: "Collector's Edition",
      hudWord: 'WANTED', stars: 5,
    },
    panels: [
      { photo: 0, tag: ['Ocean Drive', '6:42 PM', 'Looking for trouble'] },
      { photo: 1, tag: ['Vice Beach', '7:15 PM', 'No witnesses'] },
      { photo: 3, tag: ['Marina Del Sol', '5:58 PM', 'Full throttle'] },
      { photo: 2, tag: ['Route 7', '11:47 PM', 'Last fuel for miles'] },
    ],
  },
  {
    sizeKey: 'portrait', layoutId: 'comic-grid', gradeId: 'neon-night', letteringStyle: 'chrome',
    texts: {
      title: 'VICE BLOOM', script: 'after dark', tagline: 'The city blooms at night',
      quote: 'Pure neon poetry', quoteSource: 'Nightbeat Weekly',
      sealTop: 'AFTER', sealMid: 'DARK', sealBot: 'SPECIAL',
      volume: 'VOL. 09', edition: 'NIGHT EDITION', ribbon: 'After Dark Special',
      hudWord: 'HEAT', stars: 5,
    },
    panels: [
      { photo: 1, tag: ['Neon District', '9:03 PM', 'Dressed to kill'] },
      { photo: 6, tag: ['The Skyline', '12:20 AM', 'City never sleeps'] },
      { photo: 2, tag: ['Route 7', '11:47 PM', 'Last fuel for miles'] },
      { photo: 0, tag: ['Ocean Drive', '8:15 PM', 'Top down, always'] },
      { photo: 5, tag: ['Marina Del Sol', '10:30 PM', 'Quiet money'] },
      { photo: 4, tag: ['Palm Boulevard', '9:40 PM', 'Everybody is somebody'] },
    ],
  },
  {
    sizeKey: 'square', layoutId: 'mosaic-nine', gradeId: 'golden-hour', letteringStyle: 'chrome',
    texts: {
      title: 'PALM ROYALE', script: 'golden hour heat', tagline: 'Royalty checks in at dusk',
      quote: 'Sunshine with a body count', quoteSource: 'The Palm Gazette',
      sealTop: 'GOLDEN', sealMid: 'HOUR', sealBot: 'ISSUE',
      volume: 'VOL. 03', edition: 'GOLD EDITION', ribbon: 'Golden Hour Issue',
      hudWord: 'ROYAL', stars: 4,
    },
    panels: [
      { photo: 4, tag: ['Palm Boulevard', '6:05 PM', ''] },
      { photo: 0, tag: ['Ocean Drive', '6:42 PM', ''] },
      { photo: 3, tag: ['The Marina', '5:58 PM', ''] },
      { photo: 5, tag: ['Harbour Lights', '7:30 PM', ''] },
      { photo: 1, tag: ['Vice Beach', '7:15 PM', 'The royale himself'] },
      { photo: 2, tag: ['Route 7', '8:50 PM', ''] },
      { photo: 6, tag: ['Downtown', '9:12 PM', ''] },
      { photo: 4, tag: ['Palm Boulevard', '6:20 PM', ''] },
      { photo: 0, tag: ['Ocean Drive', '6:44 PM', ''] },
    ],
  },
];

const canvas = document.getElementById('cover-canvas');
const ctx = canvas.getContext('2d');
const panelCache = new Map();
let renderQueued = false;

function currentSize() {
  return POST_SIZES[state.sizeKey];
}

function render() {
  const size = currentSize();
  if (canvas.width !== size.width || canvas.height !== size.height) {
    canvas.width = size.width;
    canvas.height = size.height;
  }
  composeCover(ctx, size, state, photos, panelStates, panelCache);
  if (selectedPanel !== null && selectedPanel !== undefined) {
    drawSelectionOutline(size);
  }
}

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

function drawSelectionOutline(size) {
  const panels = layoutById(state.layoutId).build();
  const panel = panels[selectedPanel];
  if (!panel) return;
  ctx.save();
  ctx.beginPath();
  panel.points.forEach(([nx, ny], i) => {
    if (i === 0) ctx.moveTo(nx * size.width, ny * size.height);
    else ctx.lineTo(nx * size.width, ny * size.height);
  });
  ctx.closePath();
  ctx.setLineDash([size.height * 0.012, size.height * 0.008]);
  ctx.lineWidth = Math.max(2, size.height * 0.0035);
  ctx.strokeStyle = '#ffb03a';
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffb03a';
  const badgeR = size.height * 0.020;
  ctx.beginPath();
  ctx.arc(panel.x * size.width + badgeR * 1.2, panel.y * size.height + badgeR * 1.2, badgeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c0530';
  ctx.font = `${badgeR * 1.15}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(selectedPanel + 1), panel.x * size.width + badgeR * 1.2, panel.y * size.height + badgeR * 1.25);
  ctx.restore();
}

function applyComposition(index) {
  const comp = COMPOSITIONS[index];
  if (!comp) return;
  const oldHeight = currentSize().height;
  state.sizeKey = comp.sizeKey;
  state.layoutId = comp.layoutId;
  state.gradeId = comp.gradeId;
  state.letteringStyle = comp.letteringStyle;
  state.texts = { ...comp.texts };
  state.furniture = { seal: true, quote: true, ribbon: true, volume: true, hud: true, taglineStrip: true, panelTags: true };
  for (let i = 0; i < MAX_PANELS; i += 1) panelStates[i] = freshPanel();
  comp.panels.forEach((entry, i) => {
    panelStates[i].photoIndex = entry.photo;
    panelStates[i].tag = { place: entry.tag[0], time: entry.tag[1], sub: entry.tag[2] };
  });
  selectedPanel = 0;
  const ratio = currentSize().height / oldHeight;
  if (ratio !== 1) {
    panelStates.forEach((ps) => { ps.dx *= ratio; ps.dy *= ratio; });
  }
  panelCache.clear();
  syncControlsFromState();
  render();
}

// ---------------------------------------------------------------- controls

const $ = (id) => document.getElementById(id);

function buildChipList(container, items, currentId, onPick) {
  container.innerHTML = '';
  items.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = item.name;
    btn.classList.toggle('active', item.id === currentId);
    btn.addEventListener('click', () => onPick(item.id));
    container.appendChild(btn);
  });
}

function refreshPanelControls() {
  const ps = panelStates[selectedPanel ?? 0];
  if (!ps) return;
  $('panel-name').textContent = `Panel ${(selectedPanel ?? 0) + 1}`;
  $('panel-zoom').value = ps.zoom;
  $('panel-rotate').value = ps.rotate;
  $('panel-panx').value = ps.dx;
  $('panel-pany').value = ps.dy;
  $('panel-halftone').checked = ps.halftone;
  $('panel-speedlines').checked = ps.speedlines;
  $('tag-place').value = ps.tag.place;
  $('tag-time').value = ps.tag.time;
  $('tag-sub').value = ps.tag.sub;
  const panels = layoutById(state.layoutId).build();
  const swap = $('panel-swap');
  swap.innerHTML = '<option value="">Choose a panel…</option>';
  panels.forEach((_, i) => {
    if (i === selectedPanel) return;
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `Panel ${i + 1}`;
    swap.appendChild(opt);
  });
  const replace = $('panel-replace');
  replace.innerHTML = '<option value="">Choose a photo…</option>';
  photos.forEach((photo, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = photo.name;
    replace.appendChild(opt);
  });
  const gradeSel = $('panel-grade');
  gradeSel.innerHTML = '<option value="auto">Use cover grade</option>';
  COVER_GRADES.forEach((grade) => {
    const opt = document.createElement('option');
    opt.value = grade.id;
    opt.textContent = grade.name;
    gradeSel.appendChild(opt);
  });
  gradeSel.value = ps.gradeOverride;
}

function syncControlsFromState() {
  document.querySelectorAll('[data-size]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.size === state.sizeKey);
  });
  buildChipList($('layout-grid'), COVER_LAYOUTS, state.layoutId, (id) => {
    state.layoutId = id;
    panelCache.clear();
    syncControlsFromState();
    scheduleRender();
  });
  buildChipList($('grade-list'), COVER_GRADES, state.gradeId, (id) => {
    state.gradeId = id;
    panelCache.clear();
    syncControlsFromState();
    scheduleRender();
  });
  buildChipList($('lettering-styles'), LETTERING_STYLES, state.letteringStyle, (id) => {
    state.letteringStyle = id;
    syncControlsFromState();
    scheduleRender();
  });
  document.querySelectorAll('[data-slider]').forEach((input) => {
    const key = input.dataset.slider;
    input.value = key === 'gutter' ? state.gutter : state.sliders[key];
  });
  $('title-placement').value = state.titlePlacement;
  $('title-lean').checked = state.titleLean;
  const textMap = {
    'text-title': 'title', 'text-script': 'script', 'text-tagline': 'tagline',
    'text-quote': 'quote', 'text-quote-source': 'quoteSource',
    'text-seal-top': 'sealTop', 'text-seal-mid': 'sealMid', 'text-seal-bot': 'sealBot',
    'text-volume': 'volume', 'text-edition': 'edition', 'text-ribbon': 'ribbon',
    'text-hud': 'hudWord',
  };
  Object.entries(textMap).forEach(([id, key]) => { $(id).value = state.texts[key]; });
  $('text-stars').value = state.texts.stars;
  document.querySelectorAll('[data-furniture]').forEach((box) => {
    box.checked = state.furniture[box.dataset.furniture];
  });
  refreshPanelControls();
  refreshPhotoRail();
}

function refreshPhotoRail() {
  const list = $('photo-list');
  list.innerHTML = '';
  photos.forEach((photo, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'photo-thumb' + (i === armedPhoto ? ' armed' : '');
    btn.draggable = true;
    const img = document.createElement('img');
    img.src = photo.img.src;
    img.alt = '';
    const label = document.createElement('span');
    label.textContent = photo.name;
    btn.append(img, label);
    btn.addEventListener('click', () => {
      armedPhoto = armedPhoto === i ? -1 : i;
      refreshPhotoRail();
    });
    btn.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', String(i));
    });
    list.appendChild(btn);
  });
}

// ---------------------------------------------------------------- wiring

document.querySelectorAll('[data-size]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const oldHeight = currentSize().height;
    state.sizeKey = btn.dataset.size;
    const ratio = currentSize().height / oldHeight;
    panelStates.forEach((ps) => { ps.dx *= ratio; ps.dy *= ratio; });
    panelCache.clear();
    syncControlsFromState();
    scheduleRender();
  });
});

document.querySelectorAll('[data-slider]').forEach((input) => {
  input.addEventListener('input', () => {
    const key = input.dataset.slider;
    if (key === 'gutter') state.gutter = Number(input.value);
    else state.sliders[key] = Number(input.value);
    panelCache.clear();
    scheduleRender();
  });
});

$('title-placement').addEventListener('change', () => {
  state.titlePlacement = $('title-placement').value;
  scheduleRender();
});
$('title-lean').addEventListener('change', () => {
  state.titleLean = $('title-lean').checked;
  scheduleRender();
});

const textBindings = {
  'text-title': 'title', 'text-script': 'script', 'text-tagline': 'tagline',
  'text-quote': 'quote', 'text-quote-source': 'quoteSource',
  'text-seal-top': 'sealTop', 'text-seal-mid': 'sealMid', 'text-seal-bot': 'sealBot',
  'text-volume': 'volume', 'text-edition': 'edition', 'text-ribbon': 'ribbon',
  'text-hud': 'hudWord',
};
Object.entries(textBindings).forEach(([id, key]) => {
  $(id).addEventListener('input', () => {
    state.texts[key] = $(id).value;
    scheduleRender();
  });
});
$('text-stars').addEventListener('input', () => {
  state.texts.stars = Number($('text-stars').value);
  scheduleRender();
});
document.querySelectorAll('[data-furniture]').forEach((box) => {
  box.addEventListener('change', () => {
    state.furniture[box.dataset.furniture] = box.checked;
    scheduleRender();
  });
});

// Selected-panel controls
function selectedPanelState() {
  return panelStates[selectedPanel ?? 0];
}
$('panel-zoom').addEventListener('input', () => { selectedPanelState().zoom = Number($('panel-zoom').value); scheduleRender(); });
$('panel-rotate').addEventListener('input', () => { selectedPanelState().rotate = Number($('panel-rotate').value); scheduleRender(); });
$('panel-panx').addEventListener('input', () => { selectedPanelState().dx = Number($('panel-panx').value); scheduleRender(); });
$('panel-pany').addEventListener('input', () => { selectedPanelState().dy = Number($('panel-pany').value); scheduleRender(); });
$('panel-mirror').addEventListener('click', () => { const ps = selectedPanelState(); ps.mirror = !ps.mirror; scheduleRender(); });
$('panel-reset').addEventListener('click', () => {
  const ps = selectedPanelState();
  Object.assign(ps, { dx: 0, dy: 0, zoom: 1, rotate: 0, mirror: false });
  refreshPanelControls();
  scheduleRender();
});
$('panel-swap').addEventListener('change', () => {
  const other = Number($('panel-swap').value);
  if (Number.isNaN(other) || $('panel-swap').value === '') return;
  const mine = selectedPanel ?? 0;
  [panelStates[mine], panelStates[other]] = [panelStates[other], panelStates[mine]];
  refreshPanelControls();
  scheduleRender();
});
$('panel-replace').addEventListener('change', () => {
  if ($('panel-replace').value === '') return;
  selectedPanelState().photoIndex = Number($('panel-replace').value);
  scheduleRender();
});
$('panel-grade').addEventListener('change', () => {
  selectedPanelState().gradeOverride = $('panel-grade').value;
  scheduleRender();
});
$('panel-halftone').addEventListener('change', () => { selectedPanelState().halftone = $('panel-halftone').checked; scheduleRender(); });
$('panel-speedlines').addEventListener('change', () => { selectedPanelState().speedlines = $('panel-speedlines').checked; scheduleRender(); });
[['tag-place', 'place'], ['tag-time', 'time'], ['tag-sub', 'sub']].forEach(([id, key]) => {
  $(id).addEventListener('input', () => {
    selectedPanelState().tag[key] = $(id).value;
    scheduleRender();
  });
});

// Photo modes
$('mode-one-photo').addEventListener('click', () => {
  const source = armedPhoto >= 0 ? armedPhoto : (selectedPanelState()?.photoIndex ?? 0);
  panelStates.forEach((ps) => { ps.photoIndex = source; });
  scheduleRender();
});
$('mode-auto-fill').addEventListener('click', () => {
  const panels = layoutById(state.layoutId).build();
  panels.forEach((_, i) => { panelStates[i].photoIndex = i % photos.length; });
  scheduleRender();
});

// Adding photos: picker, drag-and-drop, paste.
function addPhotoFromUrl(url, name) {
  const img = new Image();
  img.addEventListener('load', () => {
    photos.push({ img, name });
    panelCache.clear();
    refreshPhotoRail();
    refreshPanelControls();
    scheduleRender();
  });
  img.src = url;
}
$('photo-input').addEventListener('change', () => {
  [...$('photo-input').files].forEach((file) => {
    addPhotoFromUrl(URL.createObjectURL(file), file.name.replace(/\.[^.]+$/, ''));
  });
  $('photo-input').value = '';
});
window.addEventListener('dragover', (event) => event.preventDefault());
window.addEventListener('drop', (event) => {
  event.preventDefault();
  [...(event.dataTransfer?.files ?? [])].forEach((file) => {
    if (file.type.startsWith('image/')) {
      addPhotoFromUrl(URL.createObjectURL(file), file.name.replace(/\.[^.]+$/, ''));
    }
  });
});
window.addEventListener('paste', (event) => {
  [...(event.clipboardData?.files ?? [])].forEach((file) => {
    if (file.type.startsWith('image/')) addPhotoFromUrl(URL.createObjectURL(file), 'Pasted photo');
  });
});

// Canvas interaction: select, pan by dragging, zoom by wheel, drop a photo.
function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}
let drag = null;
canvas.addEventListener('pointerdown', (event) => {
  const point = canvasPoint(event);
  const size = currentSize();
  const panels = layoutById(state.layoutId).build();
  const hit = panelIndexAt(panels, point.x / size.width, point.y / size.height);
  if (hit === -1) return;
  if (armedPhoto >= 0) {
    panelStates[hit].photoIndex = armedPhoto;
    armedPhoto = -1;
    selectedPanel = hit;
    refreshPhotoRail();
    refreshPanelControls();
    scheduleRender();
    return;
  }
  selectedPanel = hit;
  refreshPanelControls();
  drag = { x: point.x, y: point.y, dx: panelStates[hit].dx, dy: panelStates[hit].dy };
  canvas.setPointerCapture(event.pointerId);
  scheduleRender();
});
canvas.addEventListener('pointermove', (event) => {
  if (!drag || selectedPanel === null) return;
  const point = canvasPoint(event);
  const ps = panelStates[selectedPanel];
  ps.dx = drag.dx + (point.x - drag.x);
  ps.dy = drag.dy + (point.y - drag.y);
  $('panel-panx').value = ps.dx;
  $('panel-pany').value = ps.dy;
  scheduleRender();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (event) => {
  if (selectedPanel === null) return;
  event.preventDefault();
  const ps = panelStates[selectedPanel];
  ps.zoom = Math.min(4, Math.max(1, ps.zoom * Math.exp(-event.deltaY * 0.0012)));
  $('panel-zoom').value = ps.zoom;
  scheduleRender();
}, { passive: false });
canvas.addEventListener('dragover', (event) => event.preventDefault());
canvas.addEventListener('drop', (event) => {
  event.preventDefault();
  const raw = event.dataTransfer.getData('text/plain');
  if (raw === '') return;
  const point = canvasPoint(event);
  const size = currentSize();
  const panels = layoutById(state.layoutId).build();
  const hit = panelIndexAt(panels, point.x / size.width, point.y / size.height);
  if (hit >= 0) {
    panelStates[hit].photoIndex = Number(raw);
    selectedPanel = hit;
    refreshPanelControls();
    scheduleRender();
  }
});

// ---------------------------------------------------------------- export

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cover';
}

function renderCoverCanvas(sizeKey) {
  const size = POST_SIZES[sizeKey];
  const scale = size.height / currentSize().height;
  const scaledPanels = panelStates.map((ps) => ({ ...ps, dx: ps.dx * scale, dy: ps.dy * scale, tag: { ...ps.tag } }));
  const off = document.createElement('canvas');
  off.width = size.width;
  off.height = size.height;
  composeCover(off.getContext('2d'), size, state, photos, scaledPanels, new Map());
  return off;
}

function exportSize(sizeKey, quiet = false) {
  const size = POST_SIZES[sizeKey];
  const filename = `${slugify(state.texts.title)}-${size.width}x${size.height}.png`;
  const link = document.createElement('a');
  link.download = filename;
  link.href = renderCoverCanvas(sizeKey).toDataURL('image/png');
  link.click();
  if (!quiet) $('saved-note').textContent = `Saved ${filename}`;
  return filename;
}

document.querySelectorAll('[data-export]').forEach((btn) => {
  btn.addEventListener('click', () => exportSize(btn.dataset.export));
});
$('export-all').addEventListener('click', () => {
  const names = ['wide', 'portrait', 'square'].map((key) => exportSize(key, true));
  $('saved-note').textContent = `Saved ${names.join(' · ')}`;
});

// ---------------------------------------------------------------- boot

async function boot() {
  await Promise.all([
    document.fonts.load('80px Anton'),
    document.fonts.load('40px Pacifico'),
  ]).catch(() => {});
  const loaded = await Promise.all(SAMPLE_PHOTOS.map((sample) => new Promise((resolve) => {
    const img = new Image();
    img.addEventListener('load', () => resolve({ img, name: sample.name }));
    img.addEventListener('error', () => resolve(null));
    img.src = sample.src;
  })));
  // Rail order is SAMPLE_PHOTOS order, never load-completion order: the
  // compositions address samples by index.
  loaded.forEach((entry) => { if (entry) photos.push(entry); });
  applyComposition(0);
  selectedPanel = null; // the studio opens on the finished cover, no outline
  render();
}

window.__sunsetPress = {
  applyComposition,
  exportDataURL: (sizeKey) => renderCoverCanvas(sizeKey).toDataURL('image/png'),
  clearSelection: () => { selectedPanel = null; render(); },
  selectPanel: (i) => { selectedPanel = i; render(); },
  getState: () => state,
};

boot();
