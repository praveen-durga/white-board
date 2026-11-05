import {
  INK_AXIS_DEGREES,
  INK_CIRCLE_ASPECT,
  INK_CLOSED_GAP,
  INK_CORNER_EPSILON,
  INK_LINE_RATIO,
  INK_MIN_POINTS,
  INK_ROUND_SPREAD,
  INK_SNAP_DEGREES,
  MIN_DRAG,
} from '../pg.data';
import { ChartPoint, InkShape, WbStrokeTool } from '../pg.model';
import { shapePoints } from './pg.util';

const distance = (a: ChartPoint, b: ChartPoint) => Math.hypot(b.x - a.x, b.y - a.y);

const degrees = (a: ChartPoint, b: ChartPoint) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

function perpendicular(point: ChartPoint, a: ChartPoint, b: ChartPoint): number {
  const length = distance(a, b);
  if (!length) {
    return distance(point, a);
  }
  return Math.abs((b.x - a.x) * (a.y - point.y) - (a.x - point.x) * (b.y - a.y)) / length;
}

function simplify(points: ChartPoint[], epsilon: number): ChartPoint[] {
  const first = points[0];
  const last = points[points.length - 1];
  let farthest = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const gap = perpendicular(points[i], first, last);
    if (gap > farthest) {
      farthest = gap;
      index = i;
    }
  }
  if (farthest <= epsilon) {
    return [first, last];
  }
  return [...simplify(points.slice(0, index + 1), epsilon).slice(0, -1), ...simplify(points.slice(index), epsilon)];
}

function closedCorners(points: ChartPoint[], epsilon: number): ChartPoint[] {
  const corners = simplify(points, epsilon).slice(0, -1);
  let isChanged = true;
  while (isChanged && corners.length > 2) {
    isChanged = false;
    for (let i = 0; i < corners.length; i++) {
      const previous = corners[(i + corners.length - 1) % corners.length];
      const next = corners[(i + 1) % corners.length];
      if (perpendicular(corners[i], previous, next) < epsilon) {
        corners.splice(i, 1);
        isChanged = true;
        break;
      }
    }
  }
  return corners;
}

function snapLine(start: ChartPoint, end: ChartPoint): ChartPoint[] {
  const angle = degrees(start, end);
  const axis = Math.round(angle / 90) * 90;
  if (Math.abs(angle - axis) > INK_SNAP_DEGREES) {
    return [start, end];
  }
  const length = distance(start, end);
  const radians = (axis * Math.PI) / 180;
  return [start, { x: start.x + length * Math.cos(radians), y: start.y + length * Math.sin(radians) }];
}

function isAxisAligned(corners: ChartPoint[]): boolean {
  return corners.every((corner, i) => {
    const angle = degrees(corner, corners[(i + 1) % corners.length]);
    return Math.abs(angle - Math.round(angle / 90) * 90) <= INK_AXIS_DEGREES;
  });
}

export function recognizeShape(points: ChartPoint[]): InkShape | null {
  if (points.length < INK_MIN_POINTS) {
    return null;
  }
  const start = points[0];
  const end = points[points.length - 1];
  const length = points.slice(1).reduce((sum, point, i) => sum + distance(points[i], point), 0);
  if (distance(start, end) / length >= INK_LINE_RATIO) {
    return { tool: 'line', points: snapLine(start, end) };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const topLeft = { x: Math.min(...xs), y: Math.min(...ys) };
  const bottomRight = { x: Math.max(...xs), y: Math.max(...ys) };
  const width = bottomRight.x - topLeft.x;
  const height = bottomRight.y - topLeft.y;
  const size = Math.max(width, height);
  if (distance(start, end) > size * INK_CLOSED_GAP) {
    return null;
  }

  const corners = closedCorners(points, size * INK_CORNER_EPSILON);
  if (corners.length === 3) {
    return { tool: 'polygon', points: corners };
  }
  if (corners.length === 4) {
    return isAxisAligned(corners)
      ? { tool: 'rect', points: shapePoints('rect', topLeft, bottomRight) }
      : { tool: 'polygon', points: corners };
  }

  const centre = { x: (topLeft.x + bottomRight.x) / 2, y: (topLeft.y + bottomRight.y) / 2 };
  const radii = points.map((point) =>
    Math.hypot((point.x - centre.x) / (width / 2 || 1), (point.y - centre.y) / (height / 2 || 1)),
  );
  const mean = radii.reduce((sum, radius) => sum + radius, 0) / radii.length;
  const spread = Math.sqrt(radii.reduce((sum, radius) => sum + (radius - mean) ** 2, 0) / radii.length) / mean;
  if (spread > INK_ROUND_SPREAD) {
    return null;
  }
  const aspect = Math.max(width, height) / Math.max(Math.min(width, height), 1);
  return aspect <= INK_CIRCLE_ASPECT
    ? { tool: 'circle', points: [centre, { x: centre.x + (width + height) / 4, y: centre.y }] }
    : { tool: 'ellipse', points: [topLeft, bottomRight] };
}

export function finishStroke(tool: WbStrokeTool, points: ChartPoint[], inkToShape: boolean): InkShape | null {
  const start = points[0];
  const end = points[points.length - 1];
  if (tool === 'free') {
    return (inkToShape && recognizeShape(points)) || { tool, points: points.map(({ x, y }) => ({ x, y })) };
  }
  if (distance(start, end) < MIN_DRAG) {
    return null;
  }
  if (tool === 'line' && inkToShape) {
    return { tool, points: snapLine(start, end) };
  }
  return { tool, points: shapePoints(tool, start, end) };
}
