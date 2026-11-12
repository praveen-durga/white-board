import { BirthDetails } from '../../../shared/models';
import { CITY_LABELS, findCityByLabel } from '../../../shared/utils';
import { D1Chart, Graha } from '../../../shared/services';
import { REGION_POLYGONS_BY_STYLE } from '../../../shared/ui/organisms/rasi-chart/rasi-chart-coordinates';
import {
  ARROW_HEAD_LENGTH,
  ASPECT_ARROW_GAP,
  ASPECT_LABEL_AT,
  DOTTED_TOOLS,
  PG_ASPECT_COUNTS,
  PG_ASPECTS,
  PG_DEFAULT_CITY,
  PULL_IN_STEPS,
  RASI_ASPECT_COUNTS,
} from '../pg.data';
import {
  ChartPoint,
  PgAspectKind,
  PgAspectView,
  PgCell,
  PgChartStyle,
  PgShape,
  PgShapeTool,
  RenderedAspect,
  RenderedChartAspects,
  RenderedShape,
  SignPoint,
} from '../pg.model';

const distance = (a: ChartPoint, b: ChartPoint) => Math.hypot(b.x - a.x, b.y - a.y);

const format = (point: ChartPoint) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`;

function parsePolygon(points: string): ChartPoint[] {
  return points.split(' ').map((pair) => {
    const [x, y] = pair.split(',').map(Number);
    return { x, y };
  });
}

export function buildCells(style: PgChartStyle, ascendantRasi: number): PgCell[] {
  const polygons = REGION_POLYGONS_BY_STYLE[style];
  return Array.from({ length: 12 }, (_, rasi) => {
    const position = style === 'south' ? rasi : (ascendantRasi - rasi + 12) % 12;
    const polygon = parsePolygon(polygons[position]);
    const xs = polygon.map((point) => point.x);
    const ys = polygon.map((point) => point.y);
    return {
      polygon,
      centre: {
        x: xs.reduce((sum, x) => sum + x, 0) / xs.length,
        y: ys.reduce((sum, y) => sum + y, 0) / ys.length,
      },
      halfWidth: (Math.max(...xs) - Math.min(...xs)) / 2,
      halfHeight: (Math.max(...ys) - Math.min(...ys)) / 2,
    };
  });
}

function isInside(point: ChartPoint, polygon: ChartPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function toSignPoint(cells: PgCell[], point: ChartPoint): SignPoint {
  const rasi = cells.findIndex((cell) => isInside(point, cell.polygon));
  if (rasi < 0) {
    return { rasi: null, u: point.x, v: point.y };
  }
  const { centre, halfWidth, halfHeight } = cells[rasi];
  return { rasi, u: (point.x - centre.x) / halfWidth, v: (point.y - centre.y) / halfHeight };
}

// Offsets keep their direction; a point that lands outside a smaller house is pulled toward its centre.
export function toChartPoint(cells: PgCell[], point: SignPoint): ChartPoint {
  if (point.rasi === null) {
    return { x: point.u, y: point.v };
  }
  const { polygon, centre, halfWidth, halfHeight } = cells[point.rasi];
  const target = { x: centre.x + point.u * halfWidth, y: centre.y + point.v * halfHeight };
  if (isInside(target, polygon)) {
    return target;
  }

  let inside = 0;
  let outside = 1;
  for (let step = 0; step < PULL_IN_STEPS; step++) {
    const middle = (inside + outside) / 2;
    const probe = {
      x: centre.x + (target.x - centre.x) * middle,
      y: centre.y + (target.y - centre.y) * middle,
    };
    if (isInside(probe, polygon)) {
      inside = middle;
    } else {
      outside = middle;
    }
  }
  return {
    x: centre.x + (target.x - centre.x) * inside,
    y: centre.y + (target.y - centre.y) * inside,
  };
}

export function shapePoints(tool: PgShapeTool, start: ChartPoint, end: ChartPoint): ChartPoint[] {
  return tool === 'rect'
    ? [start, { x: end.x, y: start.y }, end, { x: start.x, y: end.y }]
    : [start, end];
}

export function shapePath(tool: PgShapeTool, points: ChartPoint[]): string {
  if (tool === 'circle') {
    const [centre, edge] = points;
    const radius = distance(centre, edge).toFixed(1);
    return `M${(centre.x - Number(radius)).toFixed(1)} ${centre.y.toFixed(1)} a${radius} ${radius} 0 1 0 ${
      Number(radius) * 2
    } 0 a${radius} ${radius} 0 1 0 ${-Number(radius) * 2} 0`;
  }
  if (tool === 'ellipse') {
    const [a, b] = points;
    const rx = Math.abs(b.x - a.x) / 2;
    const ry = Math.abs(b.y - a.y) / 2;
    const left = { x: Math.min(a.x, b.x), y: (a.y + b.y) / 2 };
    return `M${format(left)} a${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 0 ${(rx * 2).toFixed(1)} 0 a${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 0 ${(-rx * 2).toFixed(1)} 0`;
  }
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${format(point)}`).join(' ');
  return tool === 'rect' || tool === 'polygon' ? `${path} Z` : path;
}

export function arrowHead(points: ChartPoint[]): string | null {
  const tip = points[points.length - 1];
  const base = [...points].reverse().find((point) => distance(point, tip) > 1);
  if (!tip || !base) {
    return null;
  }
  const angle = Math.atan2(tip.y - base.y, tip.x - base.x);
  const wing = (offset: number) => ({
    x: tip.x - ARROW_HEAD_LENGTH * Math.cos(angle + offset),
    y: tip.y - ARROW_HEAD_LENGTH * Math.sin(angle + offset),
  });
  return `M${format(wing(Math.PI / 7))} L${format(tip)} L${format(wing(-Math.PI / 7))}`;
}

export function renderShape(cells: PgCell[], shape: PgShape): RenderedShape {
  const points = shape.points.map((point) => toChartPoint(cells, point));
  return {
    id: shape.id,
    path: shape.tool === 'text' ? '' : shapePath(shape.tool, points),
    arrowHead: shape.tool === 'arrow' ? arrowHead(points) : null,
    color: shape.color,
    width: shape.width,
    isDotted: DOTTED_TOOLS.includes(shape.tool),
    text: shape.tool === 'text' ? { ...points[0], value: shape.text ?? '' } : null,
  };
}

export function buildAspectView(chart: D1Chart, graha: Graha): PgAspectView {
  const fromRasi = chart.grahas.find((position) => position.graha === graha)!.rasi;
  return {
    graha,
    fromRasi,
    aspects: PG_ASPECTS[graha].map((aspect) => {
      const rasi = (fromRasi + aspect - 1) % 12;
      return {
        rasi,
        aspect,
        grahas: chart.grahas
          .filter((position) => position.rasi === rasi)
          .map((position) => position.graha),
      };
    }),
  };
}

// sign = the zodiac sign aspecting (only rasi aspects depend on it); counts are inclusive, 7 = the 7th from it.
export function aspectCounts(kind: PgAspectKind, sign: number): number[] {
  return kind === 'rasi' ? RASI_ASPECT_COUNTS[sign % 3] : PG_ASPECT_COUNTS[kind];
}

const cellPoints = (cell: PgCell) => cell.polygon.map((point) => `${point.x},${point.y}`).join(' ');

// from indexes cells; counts step forward through the same index, so cells must be in zodiac/house order.
export function renderChartAspects(
  cells: PgCell[],
  from: number,
  counts: number[],
): RenderedChartAspects {
  const aspects = counts.map((aspect) => ({ rasi: (from + aspect - 1) % 12, aspect, grahas: [] }));
  return {
    source: cellPoints(cells[from]),
    lines: renderAspects(cells, { fromRasi: from, aspects }),
  };
}

export function renderAspects(
  cells: PgCell[],
  view: Pick<PgAspectView, 'fromRasi' | 'aspects'>,
): RenderedAspect[] {
  const from = cells[view.fromRasi].centre;
  return view.aspects.map(({ rasi, aspect }) => {
    const to = cells[rasi].centre;
    const length = distance(from, to);
    const end = {
      x: to.x - ((to.x - from.x) / length) * ASPECT_ARROW_GAP,
      y: to.y - ((to.y - from.y) / length) * ASPECT_ARROW_GAP,
    };
    return {
      aspect,
      path: `M${format(from)} L${format(end)}`,
      arrowHead: arrowHead([from, end]),
      label: {
        x: from.x + (to.x - from.x) * ASPECT_LABEL_AT,
        y: from.y + (to.y - from.y) * ASPECT_LABEL_AT,
      },
      cell: cellPoints(cells[rasi]),
    };
  });
}

export function buildDefaultPgDetails(now: Date): BirthDetails {
  const cityLabel = CITY_LABELS.find((label) => label.startsWith(`${PG_DEFAULT_CITY},`)) ?? '';
  const city = findCityByLabel(cityLabel)!;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: city.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );

  return {
    name: 'Today',
    dob: `${parts['year']}-${parts['month']}-${parts['day']}`,
    tob: `${parts['hour']}:${parts['minute']}:${parts['second']}`,
    cityLabel,
    lat: city.lat,
    lng: city.lng,
    timezone: city.timezone,
    ayanamsa: 'lahiri',
  };
}
