import { Graha } from '../../shared/services';
import { PgAspectKind, PgShapeTool, PgTool, WbTool } from './pg.model';

export const PG_TOOLS: { value: PgTool; label: string }[] = [
  { value: 'line', label: 'Line' },
  { value: 'free', label: 'Free line' },
  { value: 'dotted', label: 'Dotted line' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'rect', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'text', label: 'Text' },
  { value: 'write', label: 'Write' },
  { value: 'eraser', label: 'Eraser' },
];

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

export const WB_TOOLS: { value: WbTool; label: string }[] = [
  { value: 'select', label: 'Select' },
  ...PG_TOOLS,
];

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
