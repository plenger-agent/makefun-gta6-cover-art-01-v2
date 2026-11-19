// layouts.js — post sizes and multi-panel cover layouts for Sunset Press.
//
// Every layout returns panels in normalised 0..1 cover coordinates. A panel
// is either a rect {x, y, w, h} or a polygon {points: [[x, y], ...]}; the
// renderer clips the panel's photo to that shape, so a layout can never
// leave dead space: the shapes tile the whole cover by construction.

export const POST_SIZES = {
  wide: { key: 'wide', label: 'Wide 1920 × 1080', width: 1920, height: 1080 },
  portrait: { key: 'portrait', label: 'Portrait 1080 × 1350', width: 1080, height: 1350 },
  square: { key: 'square', label: 'Square 1080 × 1080', width: 1080, height: 1080 },
};

function rect(x, y, w, h) {
  return { x, y, w, h, points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] };
}

function poly(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    x: Math.min(...xs), y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys),
    points,
  };
}

export const COVER_LAYOUTS = [
  {
    id: 'hero-panels',
    name: 'Hero + Panels',
    build() {
      return [
        rect(0, 0, 0.58, 1),
        rect(0.58, 0, 0.42, 0.52),
        rect(0.58, 0.52, 0.21, 0.48),
        rect(0.79, 0.52, 0.21, 0.48),
      ];
    },
  },
  {
    id: 'comic-grid',
    name: 'Comic Grid',
    build() {
      return [
        rect(0, 0, 0.5, 0.42), rect(0.5, 0, 0.5, 0.42),
        rect(0, 0.42, 0.34, 0.30), rect(0.34, 0.42, 0.33, 0.30), rect(0.67, 0.42, 0.33, 0.30),
        rect(0, 0.72, 1, 0.28),
      ];
    },
  },
  {
    id: 'mosaic-nine',
    name: 'Mosaic Nine',
    build() {
      const panels = [];
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          panels.push(rect(col / 3, row / 3, 1 / 3, 1 / 3));
        }
      }
      return panels;
    },
  },
  {
    id: 'diagonal-slash',
    name: 'Diagonal Slash',
    build() {
      return [
        poly([[0, 0], [0.46, 0], [0.26, 1], [0, 1]]),
        poly([[0.46, 0], [0.76, 0], [0.56, 1], [0.26, 1]]),
        poly([[0.76, 0], [1, 0], [1, 1], [0.56, 1]]),
      ];
    },
  },
  {
    id: 'palm-strips',
    name: 'Palm Strips',
    build() {
      return [
        rect(0, 0, 0.30, 1), rect(0.30, 0, 0.18, 1),
        rect(0.48, 0, 0.24, 1), rect(0.72, 0, 0.28, 1),
      ];
    },
  },
  {
    id: 'full-bleed',
    name: 'Full Bleed + Inset',
    build() {
      return [rect(0, 0, 1, 1), rect(0.60, 0.55, 0.34, 0.36)];
    },
  },
  {
    id: 'newsstand',
    name: 'Newsstand',
    build() {
      return [
        rect(0, 0, 0.30, 0.55), rect(0, 0.55, 0.30, 0.45),
        rect(0.30, 0, 0.44, 1),
        rect(0.74, 0, 0.26, 0.45), rect(0.74, 0.45, 0.26, 0.55),
      ];
    },
  },
];

export function layoutById(id) {
  return COVER_LAYOUTS.find((layout) => layout.id === id) ?? COVER_LAYOUTS[0];
}

// The panel a normalised point falls in (last match wins, so an inset panel
// stacked over a full-bleed panel is the one selected).
export function panelIndexAt(panels, nx, ny) {
  for (let i = panels.length - 1; i >= 0; i -= 1) {
    if (pointInPolygon(nx, ny, panels[i].points)) return i;
  }
  return -1;
}

export function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
