import { Graha } from '../../shared/services';
import { PgAspectKind, PgShapeTool, PgTool, WbTool } from './pg.model';

// icon = SVG path data on a 24x24 stroked grid; shown instead of the label on phones.
export const PG_TOOLS: { value: PgTool; label: string; icon: string }[] = [
  { value: 'select', label: 'Select', icon: 'M6 3l13 8 -6 1.5 -3.5 6.5z' },
  { value: 'line', label: 'Line', icon: 'M5 19L19 5' },
  { value: 'free', label: 'Free line', icon: 'M3 16c2-7 5-7 6.5-1s4.5 6 6.5 0 3-5 5-5' },
  { value: 'dotted', label: 'Dotted line', icon: 'M5 19l1 -1M9 15l1 -1M13 11l1 -1M17 7l1 -1' },
  { value: 'arrow', label: 'Arrow', icon: 'M5 19L19 5M10 5h9v9' },
  { value: 'rect', label: 'Rectangle', icon: 'M4 6h16v12H4z' },
  { value: 'circle', label: 'Circle', icon: 'M4 12a8 8 0 1 0 16 0a8 8 0 1 0 -16 0z' },
  { value: 'text', label: 'Text', icon: 'M5 7V5h14v2M12 5v14M9 19h6' },
  { value: 'write', label: 'Write', icon: 'M4 20l4.5 -1L19 8.5 15.5 5 5 15.5zM13.5 7l3.5 3.5' },
  { value: 'eraser', label: 'Eraser', icon: 'M8 20h12M4 15l9.5 -9.5 6 6L12 19H8zM9 10l6 6' },
];

// Toolbar control icons (24x24 stroked grid), shown in place of labels on phones.
export const PG_ICONS = {
  undo: 'M9 14L4 9l5 -5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'M15 14l5 -5 -5 -5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  delete: 'M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12M9 7V4h6v3',
  clear: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1 -14M10 10l4 4M14 10l-4 4',
  export: 'M12 4v11M7 10l5 5 5 -5M5 20h14',
  reset: 'M4 4v6h6M4.5 15a8 8 0 1 0 2 -8.5L4 10',
  inkToShape: 'M3 17c1.5 -5 3 -5 4.5 0M12 7h9v10h-9z',
  planets: 'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0 -10zM2.5 16c1.5 2 17 -5 19 -9',
  language: 'M4 5h8M8 3v2M5 11c3 -1 5 -3 6 -6M6 7c1 2 3 4 5 4M13 21l4 -10 4 10M14.5 17h5',
};

export const LAGNA_ACTUAL = 'asc';

export const PG_WIDTHS = [1, 2, 3, 5, 8];

export const PG_DEFAULT_COLOR = '#d9480f';

export const PG_DEFAULT_WIDTH = 2;

export const PULL_IN_STEPS = 12;

export const MIN_DRAG = 2;

export const INK_MIN_POINTS = 5;

export const INK_LINE_RATIO = 0.9;

export const INK_CLOSED_GAP = 0.25;

export const INK_CORNER_EPSILON = 0.1;

export const INK_ROUND_SPREAD = 0.1;

export const INK_CIRCLE_ASPECT = 1.2;

export const INK_SNAP_DEGREES = 8;

export const INK_AXIS_DEGREES = 15;

export const WRITE_PAUSE_MS = 1000;

export const HANDWRITING_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'sa', label: 'Sanskrit' },
  { value: 'te', label: 'Telugu' },
  { value: 'kn', label: 'Kannada' },
];

export const ARROW_HEAD_LENGTH = 10;

export const DOTTED_TOOLS: PgShapeTool[] = ['dotted'];

export const PG_ASPECTS: Record<Graha, number[]> = {
  Sun: [7],
  Moon: [7],
  Mars: [4, 7, 8],
  Mercury: [7],
  Jupiter: [5, 7, 9],
  Venus: [7],
  Saturn: [3, 7, 10],
  Rahu: [5, 7, 9],
  Ketu: [5, 7, 9],
};

export const PG_ASPECT_OPTIONS: { value: PgAspectKind; label: string }[] = [
  { value: 'trines', label: 'Show trines' },
  { value: 'seventh', label: '7th aspect' },
  { value: 'mars', label: 'Mars aspect' },
  { value: 'saturn', label: 'Saturn aspect' },
  { value: 'rasi', label: 'Rasi aspects' },
];

export const PG_ASPECT_COUNTS: Record<Exclude<PgAspectKind, 'rasi'>, number[]> = {
  trines: [5, 9],
  seventh: [7],
  mars: [4, 7, 8],
  saturn: [3, 7, 10],
};

// Indexed by sign % 3. Movable signs aspect the fixed signs except the next one; fixed signs aspect the movable
// signs except the previous one; dual signs aspect the other dual signs.
export const RASI_ASPECT_COUNTS = [
  [5, 8, 11],
  [3, 6, 9],
  [4, 7, 10],
];

export const ASPECT_ARROW_GAP = 14;

export const ASPECT_LABEL_AT = 0.55;

export const WB_TOOLS: { value: WbTool; label: string; icon: string }[] = PG_TOOLS;

export const WB_WIDTH = 1200;

export const WB_HEIGHT = 800;

export const WB_MIN_BOARD = 400;

export const WB_SIZE_STEP = 100;

export const WB_IMAGE_MAX = 400;

export const WB_SNAPSHOT_SIZE = 400;

export const WB_MIN_SIZE = 12;

export const WB_HANDLE_SIZE = 12;

export const WB_SELECTION_PAD = 6;

export const WB_MENU_WIDTH = 180;

export const WB_MENU_HEIGHT = 420;

export const WB_MENU_EDGE = 8;

export const WB_TEXT_WIDTH_RATIO = 0.6;

export const WB_EXPORT_SCALE = 2;

export const WB_INLINE_STYLES = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'paint-order',
];

export const PG_DEFAULT_CITY = 'Bengaluru';

export const HOUSE_ORDINALS = [
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th',
  '10th',
  '11th',
  '12th',
];
