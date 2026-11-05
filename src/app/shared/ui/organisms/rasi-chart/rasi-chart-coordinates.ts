import { ChartStyle } from '../../../models';
import { MarginAnchor, TextAnchor } from './rasi-chart.model';

export const NORTH_REGION_POLYGONS = [
  '200,0 300,100 200,200 100,100',
  '400,0 200,0 300,100',
  '400,0 400,200 300,100',
  '400,200 300,100 200,200 300,300',
  '400,200 400,400 300,300',
  '400,400 200,400 300,300',
  '200,400 300,300 200,200 100,300',
  '0,400 200,400 100,300',
  '0,200 0,400 100,300',
  '0,200 100,100 200,200 100,300',
  '0,0 0,200 100,100',
  '0,0 200,0 100,100',
];

// [x, y] — where each region's rasi number is placed.
export const NORTH_RASI_LABEL_POSITIONS: [number, number][] = [
  [200, 18],
  [370, 18],
  [385, 35],
  [385, 205],
  [385, 375],
  [305, 320],
  [200, 380],
  [30, 392],
  [15, 365],
  [15, 205],
  [15, 40],
  [30, 20],
];

// [x, y, stackDirection, textAnchor] — graha labels for a region start stacking from
// (x, y) toward the region's roomier center-facing side (+1 = downward, -1 = upward),
// independent of where that region's own rasi number sits.
export const NORTH_GRAHA_LABEL_POSITIONS: [number, number, number, TextAnchor][] = [
  [200, 55, 1, 'middle'],
  [320, 20, 1, 'end'],
  [395, 75, 1, 'end'],
  [330, 260, -1, 'end'],
  [395, 330, -1, 'end'],
  [325, 345, 1, 'end'],
  [200, 345, -1, 'middle'],
  [70, 390, -1, 'start'],
  [10, 335, -1, 'start'],
  [70, 165, -1, 'start'],
  [5, 75, 1, 'start'],
  [75, 20, 1, 'start'],
];

// South Indian chart: fixed 4x4 grid, center 2x2 merged/empty, 12 outer
// 100x100 cells. Array position here is NOT "relative to Ascendant" like
// north's — it's indexed directly by rasi (0=Aries..11=Pisces), since South
// Indian rasi positions are fixed and never rotate. Cell order below follows
// the standard clockwise-from-Aries convention (Aries at row 0 col 1, Pisces
// at row 0 col 0): https://en.wikipedia.org/wiki/Kundali_(astrology).
export const SOUTH_REGION_POLYGONS = [
  '100,0 200,0 200,100 100,100', // Aries
  '200,0 300,0 300,100 200,100', // Taurus
  '300,0 400,0 400,100 300,100', // Gemini
  '300,100 400,100 400,200 300,200', // Cancer
  '300,200 400,200 400,300 300,300', // Leo
  '300,300 400,300 400,400 300,400', // Virgo
  '200,300 300,300 300,400 200,400', // Libra
  '100,300 200,300 200,400 100,400', // Scorpio
  '0,300 100,300 100,400 0,400', // Sagittarius
  '0,200 100,200 100,300 0,300', // Capricorn
  '0,100 100,100 100,200 0,200', // Aquarius
  '0,0 100,0 100,100 0,100', // Pisces
];

// [x, y] per rasi (same fixed order as SOUTH_REGION_POLYGONS) — near each
// cell's top-left corner. Placeholder positions, meant to be fine-tuned.
export const SOUTH_RASI_LABEL_POSITIONS: [number, number][] = [
  [115, 18], // Aries
  [215, 18], // Taurus
  [315, 18], // Gemini
  [385, 118], // Cancer
  [385, 218], // Leo
  [385, 318], // Virgo
  [285, 388], // Libra
  [185, 388], // Scorpio
  [15, 388], // Sagittarius
  [15, 288], // Capricorn
  [15, 118], // Aquarius
  [15, 18], // Pisces
];

// [x, y, stackDirection, textAnchor] per rasi (same fixed order) — labels
// stack downward from just below the rasi number, centered in each cell.
// Placeholder positions, meant to be fine-tuned.
export const SOUTH_GRAHA_LABEL_POSITIONS: [number, number, number, TextAnchor][] = [
  [150, 45, 1, 'middle'], // Aries
  [250, 45, 1, 'middle'], // Taurus
  [350, 45, 1, 'middle'], // Gemini
  [350, 145, 1, 'middle'], // Cancer
  [350, 245, 1, 'middle'], // Leo
  [350, 345, 1, 'middle'], // Virgo
  [250, 345, 1, 'middle'], // Libra
  [150, 345, 1, 'middle'], // Scorpio
  [50, 345, 1, 'middle'], // Sagittarius
  [50, 245, 1, 'middle'], // Capricorn
  [50, 145, 1, 'middle'], // Aquarius
  [50, 45, 1, 'middle'], // Pisces
];

// When an outer transit chart is overlaid, it's drawn in a thin margin band
// surrounding the normal 400x400 chart (see rasi-chart.component.html's
// expanded viewBox) rather than sharing house-box interiors with the natal
// ring - matching reference software (JHora / Parashara's Light), which
// keeps an overlaid transit ring in its own outer band rather than cramming
// both rings' text into the same house box. Each natal anchor is snapped to
// the margin by projecting it onto whichever of the four box edges it's
// already closest to, at a fixed depth beyond that edge - a push along the
// center-to-anchor vector was tried first, but it put edge-midpoint anchors
// (which must travel further to clear the box) and corner anchors (already
// almost at the edge) at wildly different, uneven depths.
//
// text-anchor points AWAY from the chart - e.g. a right-edge anchor uses
// 'start' (grows further right, off into the margin) rather than 'end'
// (which would grow the text leftward, back over the natal chart it's
// supposed to stay clear of). When a house has more than one transiting
// planet, each gets its own line stacked vertically - away from the chart
// (upward) for a top-edge anchor, downward for the other three edges, which
// all have room below without re-entering the box - instead of joining them
// onto one long line that could run past a neighboring house's margin space.
const MARGIN_DEPTH = 30;
export const MARGIN_LINE_STEP = 13;

function snapToMargin([x, y]: [number, number, number, TextAnchor]): MarginAnchor {
  const top = y;
  const bottom = 400 - y;
  const left = x;
  const right = 400 - x;
  const nearest = Math.min(top, bottom, left, right);

  if (nearest === top) {
    return { x, y: -MARGIN_DEPTH, textAnchor: 'middle', stackDirection: -1 };
  }
  if (nearest === bottom) {
    return { x, y: 400 + MARGIN_DEPTH, textAnchor: 'middle', stackDirection: 1 };
  }
  if (nearest === left) {
    return { x: -MARGIN_DEPTH, y, textAnchor: 'end', stackDirection: 1 };
  }
  return { x: 400 + MARGIN_DEPTH, y, textAnchor: 'start', stackDirection: 1 };
}

export const NORTH_MARGIN_GRAHA_POSITIONS: MarginAnchor[] = NORTH_GRAHA_LABEL_POSITIONS.map(snapToMargin);

export const SOUTH_MARGIN_GRAHA_POSITIONS: MarginAnchor[] = SOUTH_GRAHA_LABEL_POSITIONS.map(snapToMargin);

// east geometry is not designed yet (awaiting reference images) — it
// temporarily aliases north's layout so the chartStyle input has something
// to render rather than being unusable.
export const REGION_POLYGONS_BY_STYLE: Record<ChartStyle, string[]> = {
  north: NORTH_REGION_POLYGONS,
  south: SOUTH_REGION_POLYGONS,
  east: NORTH_REGION_POLYGONS,
};

export const RASI_LABEL_POSITIONS_BY_STYLE: Record<ChartStyle, [number, number][]> = {
  north: NORTH_RASI_LABEL_POSITIONS,
  south: SOUTH_RASI_LABEL_POSITIONS,
  east: NORTH_RASI_LABEL_POSITIONS,
};

export const GRAHA_LABEL_POSITIONS_BY_STYLE: Record<ChartStyle, [number, number, number, TextAnchor][]> = {
  north: NORTH_GRAHA_LABEL_POSITIONS,
  south: SOUTH_GRAHA_LABEL_POSITIONS,
  east: NORTH_GRAHA_LABEL_POSITIONS,
};

export const MARGIN_GRAHA_POSITIONS_BY_STYLE: Record<ChartStyle, MarginAnchor[]> = {
  north: NORTH_MARGIN_GRAHA_POSITIONS,
  south: SOUTH_MARGIN_GRAHA_POSITIONS,
  east: NORTH_MARGIN_GRAHA_POSITIONS,
};
