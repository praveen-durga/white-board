import { Graha } from '../../../services';

export type TextAnchor = 'start' | 'middle' | 'end';

export type MarginAnchor = { x: number; y: number; textAnchor: TextAnchor; stackDirection: 1 | -1 };

export type GrahaLabelPosition = {
  baseText: string;
  isCombust: boolean;
  degreeSuffix: string;
  isOverlay?: boolean;
  graha?: Graha;
  x: number;
  y: number;
};

export type MarginTextLine = {
  x: number;
  y: number;
  text: string;
};

export type RasiHouseRegion = {
  rasi: number;
  rasiLabelX: number;
  rasiLabelY: number;
  grahaTextAnchor: TextAnchor;
  grahaLabels: GrahaLabelPosition[];
  outerTextAnchor: TextAnchor;
  outerLines: MarginTextLine[];
};
