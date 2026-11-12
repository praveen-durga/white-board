import { Graha } from '../../shared/services';

export type PgChartStyle = 'north' | 'south';

// lagnaRasi null = use the chart's current Lagna (or no sign numbers when there is no chart).
export type PgAspectKind = 'trines' | 'seventh' | 'mars' | 'saturn' | 'rasi';

// Aspects drawn from one sign of the chart section's boards.
export type PgChartAspect = { kind: PgAspectKind; rasi: number };

// house = 0-based offset from Lagna, so it stays put when the chart's Lagna changes.
export type WbChartAspect = { kind: PgAspectKind; house: number };

// resolvedLagna = the sign actually in the 1st house when rendered (null when unknown, e.g. a blank chart).
export type WbChartMeta = {
  style: PgChartStyle;
  lagnaRasi: number | null;
  resolvedLagna?: number | null;
  aspect?: WbChartAspect;
};

export type WbChartRenderer = (meta: WbChartMeta) => { href: string; resolvedLagna: number | null };

export type RenderedChartAspects = { source: string; lines: RenderedAspect[] };

export type PgTool =
  | 'line'
  | 'free'
  | 'dotted'
  | 'arrow'
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'polygon'
  | 'text'
  | 'write'
  | 'eraser';

export type PgShapeTool = Exclude<PgTool, 'eraser' | 'write'>;

export type ChartPoint = { x: number; y: number };

export type InkPoint = ChartPoint & { t: number };

export type InkShape = { tool: WbStrokeTool; points: ChartPoint[] };

// u/v = offset from the sign cell's centre in half-widths; rasi null = outside every cell, u/v = raw chart x/y.
export type SignPoint = { rasi: number | null; u: number; v: number };

export type PgShape = {
  id: number;
  tool: PgShapeTool;
  points: SignPoint[];
  color: string;
  width: number;
  text?: string;
};

export type PgDraft = Omit<PgShape, 'id'>;

export type RenderedShape = {
  id: number;
  path: string;
  arrowHead: string | null;
  color: string;
  width: number;
  isDotted: boolean;
  text: { x: number; y: number; value: string } | null;
};

export type PgCell = {
  polygon: ChartPoint[];
  centre: ChartPoint;
  halfWidth: number;
  halfHeight: number;
};

export type PgAspect = { rasi: number; aspect: number; grahas: Graha[] };

export type PgAspectView = { graha: Graha; fromRasi: number; aspects: PgAspect[] };

export type RenderedAspect = {
  aspect: number;
  path: string;
  arrowHead: string | null;
  label: ChartPoint;
  cell: string;
};

export type WbTool = 'select' | PgTool;

export type WbStrokeTool = Exclude<PgShapeTool, 'text'>;

export type WbBox = { x: number; y: number; width: number; height: number };

export type WbItem =
  | { id: number; kind: 'image'; box: WbBox; href: string; chart?: WbChartMeta }
  | {
      id: number;
      kind: 'shape';
      tool: WbStrokeTool;
      points: ChartPoint[];
      color: string;
      width: number;
    }
  | { id: number; kind: 'text'; point: ChartPoint; value: string; color: string; size: number };

export type WbRenderedItem = {
  item: WbItem;
  path: string;
  arrowHead: string | null;
  isDotted: boolean;
  chartAspects: (RenderedChartAspects & { transform: string }) | null;
};

export type WbDrag = {
  mode: 'move' | 'resize';
  start: ChartPoint;
  original: WbItem;
  bounds: WbBox;
  before: WbItem[];
};

export type WbImage = { href: string; width: number; height: number };

export type HandwritingStroke = { addPoint(point: InkPoint): void };

export type HandwritingRecognizer = {
  startDrawing(hints: { recognitionType: 'text'; alternatives: number }): {
    addStroke(stroke: HandwritingStroke): void;
    getPrediction(): Promise<{ text: string }[]>;
  };
  finish(): void;
};

export type HandwritingNavigator = Navigator & {
  createHandwritingRecognizer(constraint: { languages: string[] }): Promise<HandwritingRecognizer>;
};

export type HandwritingGlobal = typeof globalThis & {
  HandwritingStroke: new () => HandwritingStroke;
};
