import { D1Chart, Graha } from '../../../shared/services';
import { GRAHA_ABBREVIATIONS, GRAHA_ORDER } from '../../../shared/utils';
import { ChartPoint, PgCell, WbChartMeta, WbChartRendered, WbSudarshanaHotspot } from '../pg.model';

// Sudarshana Chakra: three concentric rings of 12 houses, counted from the Lagna (inner), the Moon (middle)
// and the Sun (outer). Drawn on a 400x400 grid like the other charts.
export const SC_SIZE = 400;

const CENTRE = SC_SIZE / 2;

// Core, then the outer edge of the Lagna, Moon and Sun rings.
const RADII = [34, 104, 152, 198];

const RINGS = [
  { label: 'Lagna', fill: '#f3f0ff', ink: '#5f3dc4' },
  { label: 'Moon', fill: '#e7f5ff', ink: '#1864ab' },
  { label: 'Sun', fill: '#fff4e6', ink: '#d9480f' },
];

const ROW_HEIGHT = 12;
const COLUMN_WIDTH = 20;
const NUMBER_BAND = 13;
const ARC_STEPS = 6;
const DEG = Math.PI / 180;

// House 1 sits on the left (the eastern horizon) and houses run anticlockwise: the 4th at the bottom, the 10th on top.
const houseAngle = (house: number) => 180 + house * 30;

function polar(radius: number, degrees: number): ChartPoint {
  return {
    x: CENTRE + radius * Math.cos(degrees * DEG),
    y: CENTRE - radius * Math.sin(degrees * DEG),
  };
}

const xy = ({ x, y }: ChartPoint) => `${x.toFixed(1)} ${y.toFixed(1)}`;

function wedgePath(house: number, inner: number, outer: number): string {
  const start = houseAngle(house) - 15;
  const end = start + 30;
  return (
    `M${xy(polar(outer, start))} A${outer} ${outer} 0 0 0 ${xy(polar(outer, end))} ` +
    `L${xy(polar(inner, end))} A${inner} ${inner} 0 0 1 ${xy(polar(inner, start))} Z`
  );
}

// Whole-house wedges (all three rings), in house order, for hit-testing and aspect overlays.
export const SUDARSHANA_CELLS: PgCell[] = Array.from({ length: 12 }, (_, house) => {
  const start = houseAngle(house) - 15;
  const arc = (radius: number) =>
    Array.from({ length: ARC_STEPS + 1 }, (_, step) =>
      polar(radius, start + (30 * step) / ARC_STEPS),
    );
  const polygon = [...arc(RADII[3]), ...arc(RADII[0]).reverse()];
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  return {
    polygon,
    centre: polar((RADII[2] + RADII[1]) / 2, houseAngle(house)),
    halfWidth: (Math.max(...xs) - Math.min(...xs)) / 2,
    halfHeight: (Math.max(...ys) - Math.min(...ys)) / 2,
  };
});

function ringCell(ring: number, house: number): PgCell {
  const start = houseAngle(house) - 15;
  const arc = (radius: number) =>
    Array.from({ length: ARC_STEPS + 1 }, (_, step) =>
      polar(radius, start + (30 * step) / ARC_STEPS),
    );
  const polygon = [...arc(RADII[ring + 1]), ...arc(RADII[ring]).reverse()];
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  return {
    polygon,
    centre: polar(
      RADII[ring] + (RADII[ring + 1] - RADII[ring] - NUMBER_BAND) / 2,
      houseAngle(house),
    ),
    halfWidth: (Math.max(...xs) - Math.min(...xs)) / 2,
    halfHeight: (Math.max(...ys) - Math.min(...ys)) / 2,
  };
}

// One ring's house cells (index 0 = the 1st house of that ring), for a hovered planet's aspects.
export const SUDARSHANA_RING_CELLS: PgCell[][] = RINGS.map((_, ring) =>
  Array.from({ length: 12 }, (_, house) => ringCell(ring, house)),
);

// The planet label under a chart-grid point (400x400), if any.
export function sudarshanaHotspotAt(
  hotspots: WbSudarshanaHotspot[],
  point: ChartPoint,
): WbSudarshanaHotspot | null {
  return (
    hotspots.find(
      ({ x, y }) =>
        Math.abs(point.x - x) <= COLUMN_WIDTH / 2 && Math.abs(point.y - y) <= ROW_HEIGHT / 2,
    ) ?? null
  );
}

// 0-based house for a running year of life (1 = the year of birth); the Sudarshana dasha moves one house a year.
export const sudarshanaYearHouse = (year: number) => (((year - 1) % 12) + 12) % 12;

const text = (point: ChartPoint, value: string, attributes: string) =>
  `<text x="${point.x.toFixed(1)}" y="${point.y.toFixed(1)}" ${attributes}>${value}</text>`;

function ringLabels(
  chart: D1Chart | null,
  ring: number,
  base: number,
  lagna: number | null,
  hidePlanets: boolean,
  hotspots: WbSudarshanaHotspot[],
): string {
  const inner = RADII[ring];
  const outer = RADII[ring + 1];
  // The sign number sits centred along the outer edge; planets fill the band beneath it.
  const depth = outer - inner - NUMBER_BAND;
  const middle = inner + depth / 2;
  const span = (middle * Math.PI) / 6;
  const labels: string[] = [];

  for (let house = 0; house < 12; house++) {
    const rasi = (base + house) % 12;
    const angle = houseAngle(house);
    labels.push(
      text(
        polar(outer - NUMBER_BAND / 2 - 1, angle),
        String(rasi + 1),
        'font-size="9" fill="#868e96"',
      ),
    );
    // The Lagna is marked "As" in its sign on every ring, and stays shown when planets are hidden.
    const planets: (Graha | null)[] =
      chart && !hidePlanets
        ? GRAHA_ORDER.filter((graha) =>
            chart.grahas.some((position) => position.graha === graha && position.rasi === rasi),
          )
        : [];
    const names = [...(rasi === lagna ? [null] : []), ...planets];
    if (!names.length) {
      continue;
    }
    // Upright grid centred in the planet band, shaped to the band's on-screen width and height.
    const cos = Math.abs(Math.cos(angle * DEG));
    const sin = Math.abs(Math.sin(angle * DEG));
    const width = (depth * cos + span * sin) * 0.8;
    const height = (depth * sin + span * cos) * 0.8;
    const fit = (cols: number) =>
      Math.max(
        (cols * COLUMN_WIDTH) / width,
        (Math.ceil(names.length / cols) * ROW_HEIGHT) / height,
      );
    const columns = Array.from({ length: names.length }, (_, index) => index + 1).reduce(
      (best, cols) => (fit(cols) < fit(best) ? cols : best),
      1,
    );
    const rows = Math.ceil(names.length / columns);
    const centre = polar(middle, angle);
    names.forEach((graha, index) => {
      const row = Math.floor(index / columns);
      const inRow = Math.min(columns, names.length - row * columns);
      const point = {
        x: centre.x + ((index % columns) - (inRow - 1) / 2) * COLUMN_WIDTH,
        y: centre.y + (row - (rows - 1) / 2) * ROW_HEIGHT,
      };
      if (graha) {
        hotspots.push({ graha, ring, house, x: point.x, y: point.y });
      }
      labels.push(
        text(
          point,
          graha ? GRAHA_ABBREVIATIONS[graha] : 'As',
          `font-size="11" font-weight="600" fill="${RINGS[ring].ink}"`,
        ),
      );
    });
  }
  return labels.join('');
}

export function sudarshanaChart(
  chart: D1Chart | null,
  meta: WbChartMeta,
  size: number,
): WbChartRendered {
  const lagna = meta.lagnaRasi ?? chart?.ascendantRasi ?? null;
  const moon = chart?.grahas.find(({ graha }) => graha === 'Moon')?.rasi ?? null;
  const sun = chart?.grahas.find(({ graha }) => graha === 'Sun')?.rasi ?? null;
  const bases = [lagna, moon, sun];
  const hidePlanets = !!meta.hidePlanets;

  const fills = RINGS.map((ring, index) =>
    Array.from({ length: 12 }, (_, house) => wedgePath(house, RADII[index], RADII[index + 1])).join(
      ' ',
    ),
  ).map((d, index) => `<path d="${d}" fill="${RINGS[index].fill}" />`);

  const highlights = (meta.highlights ?? [])
    .map(
      (house) =>
        `<path d="${wedgePath(house, RADII[0], RADII[3])}" fill="#ffe066" opacity="0.55" />`,
    )
    .join('');

  const year =
    meta.year === undefined
      ? ''
      : `<path d="${wedgePath(sudarshanaYearHouse(meta.year), RADII[0], RADII[3])}" fill="#ffc078" opacity="0.6" stroke="#d9480f" stroke-width="3" />`;

  const circles = RADII.map(
    (radius) => `<circle cx="${CENTRE}" cy="${CENTRE}" r="${radius}" />`,
  ).join('');
  const spokes = Array.from({ length: 12 }, (_, house) => {
    const angle = houseAngle(house) - 15;
    return `<path d="M${xy(polar(RADII[0], angle))} L${xy(polar(RADII[3], angle))}" />`;
  }).join('');

  const hotspots: WbSudarshanaHotspot[] = [];
  const labels = bases
    .map((base, ring) =>
      base === null ? '' : ringLabels(chart, ring, base, lagna, hidePlanets, hotspots),
    )
    .join('');

  const legend = [
    ...(meta.year === undefined ? [] : [{ value: `Year ${meta.year}`, ink: '#212529' }]),
    ...[...RINGS].reverse().map(({ label, ink }) => ({ value: label, ink })),
  ];
  const core = legend
    .map(({ value, ink }, index) =>
      text(
        { x: CENTRE, y: CENTRE + (index - (legend.length - 1) / 2) * 11 },
        value,
        `font-size="9" font-weight="600" fill="${ink}"`,
      ),
    )
    .join('');

  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${SC_SIZE} ${SC_SIZE}">` +
    `<rect x="1" y="1" width="398" height="398" fill="#ffffff" />` +
    fills.join('') +
    highlights +
    year +
    `<g fill="none" stroke="#555555" stroke-width="1.5">${circles}${spokes}</g>` +
    `<g font-family="sans-serif" text-anchor="middle" dominant-baseline="central">${labels}${core}</g>` +
    `</svg>`;

  return {
    href: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`,
    resolvedLagna: lagna,
    resolvedMoon: moon,
    resolvedSun: sun,
    hotspots,
  };
}
