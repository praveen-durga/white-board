import {
  DOTTED_TOOLS,
  HOUSE_ORDINALS,
  PG_ASPECTS,
  WB_EXPORT_SCALE,
  WB_IMAGE_MAX,
  WB_INLINE_STYLES,
  WB_MIN_SIZE,
  WB_TEXT_WIDTH_RATIO,
} from '../pg.data';
import {
  RASI_LABEL_POSITIONS_BY_STYLE,
  REGION_POLYGONS_BY_STYLE,
} from '../../../shared/ui/organisms/rasi-chart/rasi-chart-coordinates';
import {
  ChartPoint,
  PgCell,
  PgChartStyle,
  PgShape,
  WbBox,
  WbChartStyle,
  WbDrag,
  WbHoverAspect,
  WbImage,
  WbItem,
  WbRenderedItem,
  WbSudarshanaHotspot,
} from '../pg.model';
import {
  arrowHead,
  aspectCounts,
  buildCells,
  renderChartAspects,
  shapePath,
  toChartPoint,
  toSignPoint,
} from './pg.util';
import { SUDARSHANA_CELLS, SUDARSHANA_RING_CELLS, sudarshanaHotspotAt } from './pg-sudarshana.util';

// With Lagna = Aries the rasi-indexed North cells are in house order: HOUSE_CELLS[0] is the 1st house.
const HOUSE_CELLS = buildCells('north', 0);

const CHART_SIZE = 400;

// Both cell sets are in house order (index 0 = the 1st house) on the same 400x400 grid.
const houseCells = (style: WbChartStyle) =>
  style === 'sudarshana' ? SUDARSHANA_CELLS : HOUSE_CELLS;

// 0-based house of a North or Sudarshana chart image under a board point, or null when outside it.
const toChartGrid = (box: WbBox, point: ChartPoint): ChartPoint => ({
  x: ((point.x - box.x) / box.width) * CHART_SIZE,
  y: ((point.y - box.y) / box.height) * CHART_SIZE,
});

const chartTransform = ({ x, y, width, height }: WbBox) =>
  `translate(${x} ${y}) scale(${width / CHART_SIZE} ${height / CHART_SIZE})`;

export function chartHouseAt(style: WbChartStyle, box: WbBox, point: ChartPoint): number | null {
  return toSignPoint(houseCells(style), toChartGrid(box, point)).rasi;
}

// The Sudarshana planet label under a board point, if the item is a Sudarshana Chakra.
export function sudarshanaPlanetAt(item: WbItem, point: ChartPoint): WbSudarshanaHotspot | null {
  if (item.kind !== 'image' || item.chart?.style !== 'sudarshana' || !item.chart.hotspots) {
    return null;
  }
  return sudarshanaHotspotAt(item.chart.hotspots, toChartGrid(item.box, point));
}

// A hovered planet's Parashari aspects, counted within its own ring, plus a caption for under (or over) the chart.
export function renderHoverAspects(item: WbItem, hover: WbHoverAspect, boardHeight: number) {
  if (item.kind !== 'image') {
    return null;
  }
  const counts = PG_ASPECTS[hover.graha];
  const { box } = item;
  const below = box.y + box.height + 18;
  return {
    ...renderChartAspects(SUDARSHANA_RING_CELLS[hover.ring], hover.house, counts),
    transform: chartTransform(box),
    caption: {
      x: box.x + box.width / 2,
      y: below <= boardHeight - 4 ? below : box.y - 8,
      value: `${hover.graha} aspects ${counts.map((count) => HOUSE_ORDINALS[count - 1]).join(', ')}`,
    },
  };
}

function renderWbChartAspects(item: WbItem): WbRenderedItem['chartAspects'] {
  const aspect = item.kind === 'image' ? item.chart?.aspect : undefined;
  if (item.kind !== 'image' || !item.chart || !aspect) {
    return null;
  }
  const lagna = item.chart.resolvedLagna ?? null;
  // A Sudarshana house holds three different signs, so sign-based (rasi) aspects don't apply.
  if (aspect.kind === 'rasi' && (lagna === null || item.chart.style === 'sudarshana')) {
    return null;
  }
  const counts = aspectCounts(aspect.kind, ((lagna ?? 0) + aspect.house) % 12);
  return {
    ...renderChartAspects(houseCells(item.chart.style), aspect.house, counts),
    transform: chartTransform(item.box),
  };
}

export const wbTextSize = (width: number) => 14 + width * 3;

export function itemBounds(item: WbItem): WbBox {
  if (item.kind === 'image') {
    return item.box;
  }
  if (item.kind === 'text') {
    const width = Math.max(item.value.length * item.size * WB_TEXT_WIDTH_RATIO, item.size);
    return { x: item.point.x, y: item.point.y - item.size, width, height: item.size * 1.25 };
  }
  if (item.tool === 'circle') {
    const [centre, edge] = item.points;
    const radius = Math.hypot(edge.x - centre.x, edge.y - centre.y);
    return { x: centre.x - radius, y: centre.y - radius, width: radius * 2, height: radius * 2 };
  }
  const xs = item.points.map((point) => point.x);
  const ys = item.points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function transformItem(
  item: WbItem,
  map: (point: ChartPoint) => ChartPoint,
  scale: number,
): WbItem {
  if (item.kind === 'image') {
    const { x, y } = map(item.box);
    return {
      ...item,
      box: { x, y, width: item.box.width * scale, height: item.box.height * scale },
    };
  }
  if (item.kind === 'text') {
    return { ...item, point: map(item.point), size: item.size * scale };
  }
  return { ...item, points: item.points.map(map) };
}

// Uniform scale from the top-left, driven by the drag projected on the box diagonal.
export function draggedItem(drag: WbDrag, point: ChartPoint): WbItem {
  const dx = point.x - drag.start.x;
  const dy = point.y - drag.start.y;
  if (drag.mode === 'move') {
    return transformItem(drag.original, (p) => ({ x: p.x + dx, y: p.y + dy }), 1);
  }
  const { x, y, width, height } = drag.bounds;
  const span = Math.max(width + height, 1);
  const scale = Math.max((span + dx + dy) / span, WB_MIN_SIZE / Math.max(width, height, 1));
  return transformItem(
    drag.original,
    (p) => ({ x: x + (p.x - x) * scale, y: y + (p.y - y) * scale }),
    scale,
  );
}

export function renderItem(item: WbItem): WbRenderedItem {
  const isShape = item.kind === 'shape';
  return {
    item,
    path: isShape ? shapePath(item.tool, item.points) : '',
    arrowHead: isShape && item.tool === 'arrow' ? arrowHead(item.points) : null,
    isDotted: isShape && DOTTED_TOOLS.includes(item.tool),
    chartAspects: renderWbChartAspects(item),
  };
}

export function fitImage(href: string, width: number, height: number): WbImage {
  const scale = Math.min(1, WB_IMAGE_MAX / Math.max(width, height));
  return { href, width: width * scale, height: height * scale };
}

const svgDataUrl = (markup: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;

function loadImage(href: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = href;
  });
}

export async function readImageFile(file: File): Promise<WbImage> {
  const href = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const image = await loadImage(href);
  return fitImage(href, image.naturalWidth, image.naturalHeight);
}

// Component styles live in the page stylesheet, so copy them onto the clone before it leaves the page.
function inlineStyles(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const sources = [svg, ...Array.from(svg.querySelectorAll('*'))];
  const targets = [clone, ...Array.from(clone.querySelectorAll('*'))];
  sources.forEach((source, index) => {
    const computed = getComputedStyle(source);
    targets[index].setAttribute(
      'style',
      WB_INLINE_STYLES.map((property) => `${property}:${computed.getPropertyValue(property)}`).join(
        ';',
      ),
    );
  });
  return clone;
}

function serialize(svg: SVGSVGElement, width: number, height: number): string {
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  return new XMLSerializer().serializeToString(svg);
}

export function snapshotLayers(layers: SVGSVGElement[], size: number): string {
  const body = layers.map((layer) => serialize(inlineStyles(layer), size, size)).join('');
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`,
  );
}

// North cells run counter-clockwise from the Lagna house, so position p holds rasi (lagna - p).
function signNumbers(style: PgChartStyle, lagnaRasi: number | null): string {
  if (style !== 'north' || lagnaRasi === null) {
    return '';
  }
  const labels = RASI_LABEL_POSITIONS_BY_STYLE.north.map(
    ([x, y], position) =>
      `<text x="${x}" y="${y}">${((lagnaRasi - position + 12) % 12) + 1}</text>`,
  );
  return `<g fill="#777777" font-family="sans-serif" font-size="12" text-anchor="middle">${labels.join('')}</g>`;
}

export function emptyChart(
  style: PgChartStyle,
  size: number,
  lagnaRasi: number | null = null,
): string {
  const cells = REGION_POLYGONS_BY_STYLE[style]
    .map((points) => `<polygon points="${points}" />`)
    .join('');
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 400 400">` +
      `<rect x="1" y="1" width="398" height="398" fill="#ffffff" />` +
      `<g fill="none" stroke="#555555" stroke-width="1.5">${cells}</g>${signNumbers(style, lagnaRasi)}</svg>`,
  );
}

export async function exportPng(
  board: SVGSVGElement,
  width: number,
  height: number,
): Promise<void> {
  const clone = inlineStyles(board);
  clone.querySelectorAll('.wb-ui').forEach((element) => element.remove());
  const image = await loadImage(svgDataUrl(serialize(clone, width, height)));
  const canvas = document.createElement('canvas');
  canvas.width = width * WB_EXPORT_SCALE;
  canvas.height = height * WB_EXPORT_SCALE;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = 'whiteboard.png';
  link.click();
}

export const pgTextSize = (width: number) => 10 + width * 2;

// Chart-section shapes live in sign coordinates; as whiteboard items (chart coordinates) they reuse its bounds and drag maths.
export function pgShapeToItem(cells: PgCell[], shape: PgShape): WbItem {
  const points = shape.points.map((point) => toChartPoint(cells, point));
  if (shape.tool === 'text') {
    const size = pgTextSize(shape.width);
    return {
      id: shape.id,
      kind: 'text',
      point: points[0],
      value: shape.text ?? '',
      color: shape.color,
      size,
    };
  }
  return {
    id: shape.id,
    kind: 'shape',
    tool: shape.tool,
    points,
    color: shape.color,
    width: shape.width,
  };
}

export function itemToPgShape(cells: PgCell[], shape: PgShape, item: WbItem): PgShape {
  if (item.kind === 'text') {
    const width = Math.max(1, Math.round(((item.size - pgTextSize(0)) / 2) * 10) / 10);
    return { ...shape, points: [toSignPoint(cells, item.point)], width };
  }
  return item.kind === 'shape'
    ? { ...shape, points: item.points.map((point) => toSignPoint(cells, point)) }
    : shape;
}
