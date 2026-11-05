import { signal } from '@angular/core';
import { WRITE_PAUSE_MS } from '../pg.data';
import { ChartPoint, HandwritingGlobal, HandwritingNavigator, InkPoint } from '../pg.model';

export const isHandwritingSupported = () => 'createHandwritingRecognizer' in navigator;

export async function recognizeHandwriting(strokes: InkPoint[][], language: string): Promise<string> {
  const recognizer = await (navigator as HandwritingNavigator).createHandwritingRecognizer({ languages: [language] });
  const drawing = recognizer.startDrawing({ recognitionType: 'text', alternatives: 1 });
  strokes.forEach((points) => {
    const stroke = new (globalThis as HandwritingGlobal).HandwritingStroke();
    points.forEach((point) => stroke.addPoint(point));
    drawing.addStroke(stroke);
  });
  const [best] = await drawing.getPrediction();
  recognizer.finish();
  return best?.text.trim() ?? '';
}

export function inkBounds(strokes: ChartPoint[][]): { bottomLeft: ChartPoint; height: number } {
  const points = strokes.flat();
  const ys = points.map((point) => point.y);
  return {
    bottomLeft: { x: Math.min(...points.map((point) => point.x)), y: Math.max(...ys) },
    height: Math.max(...ys) - Math.min(...ys),
  };
}

// Strokes of one word arrive separately; recognise once the pen has rested.
export class HandwritingBuffer {
  readonly strokes = signal<InkPoint[][]>([]);

  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private done: (strokes: InkPoint[][]) => void) {}

  hold(): void {
    clearTimeout(this.timer);
  }

  add(stroke: InkPoint[]): void {
    this.strokes.update((strokes) => [...strokes, stroke]);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const strokes = this.strokes();
      this.strokes.set([]);
      this.done(strokes);
    }, WRITE_PAUSE_MS);
  }
}
