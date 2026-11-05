import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { D1Chart, Graha } from '../../../shared/services';
import { RasiChartComponent } from '../../../shared/ui';
import { WB_SNAPSHOT_SIZE } from '../pg.data';
import {
  ChartPoint,
  InkPoint,
  PgChartStyle,
  PgDraft,
  PgShape,
  PgShapeTool,
  PgTool,
  RenderedAspect,
  RenderedShape,
} from '../pg.model';
import {
  buildAspectView,
  buildCells,
  renderAspects,
  renderShape,
  shapePath,
  shapePoints,
  toSignPoint,
} from '../utils/pg.util';
import { HandwritingBuffer, inkBounds, recognizeHandwriting } from '../utils/pg-handwriting.util';
import { finishStroke } from '../utils/pg-ink.util';
import { snapshotLayers } from '../utils/pg-whiteboard.util';

@Component({
  selector: 'app-pg-drawing-board',
  imports: [RasiChartComponent],
  templateUrl: './pg-drawing-board.component.html',
  styleUrl: './pg-drawing-board.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PgDrawingBoardComponent {
  chartStyle = input.required<PgChartStyle>();
  chart = input.required<D1Chart>();
  shapes = input.required<PgShape[]>();
  tool = input.required<PgTool>();
  color = input.required<string>();
  width = input.required<number>();
  hoveredGraha = input<Graha | null>(null);
  inkToShape = input(true);
  writeLanguage = input('en');

  shapeAdded = output<PgDraft>();
  shapeErased = output<number>();
  grahaHovered = output<Graha | null>();

  protected draft = signal<InkPoint[]>([]);

  private board = viewChild.required<ElementRef<SVGSVGElement>>('board');
  private wrap = viewChild.required<ElementRef<HTMLElement>>('wrap');

  private writing = new HandwritingBuffer((strokes) => this.onWritingDone(strokes));

  protected cells = computed(() => buildCells(this.chartStyle(), this.chart().ascendantRasi));

  protected renderedShapes = computed<RenderedShape[]>(() =>
    this.shapes().map((shape) => renderShape(this.cells(), shape)),
  );

  protected renderedAspects = computed<RenderedAspect[]>(() => {
    const graha = this.hoveredGraha();
    return graha ? renderAspects(this.cells(), buildAspectView(this.chart(), graha)) : [];
  });

  protected sourceCell = computed(() => {
    const graha = this.hoveredGraha();
    if (!graha) {
      return '';
    }
    const rasi = this.chart().grahas.find((position) => position.graha === graha)!.rasi;
    return this.cells()
      [rasi].polygon.map((point) => `${point.x},${point.y}`)
      .join(' ');
  });

  protected draftPath = computed(() => {
    const points = this.draft();
    const tool = this.tool();
    if (points.length < 2 || tool === 'eraser' || tool === 'text') {
      return '';
    }
    return tool === 'free' || tool === 'write'
      ? shapePath('free', points)
      : shapePath(tool, shapePoints(tool, points[0], points[points.length - 1]));
  });

  protected writingPaths = computed(() => this.writing.strokes().map((points) => shapePath('free', points)));

  protected isEraser = computed(() => this.tool() === 'eraser');

  snapshot(): string {
    return snapshotLayers(Array.from(this.wrap().nativeElement.querySelectorAll('svg')), WB_SNAPSHOT_SIZE);
  }

  protected onPointerDown(event: PointerEvent): void {
    const tool = this.tool();
    if (tool === 'eraser') {
      return;
    }
    const point = this.toChartPoint(event);
    if (tool === 'text') {
      const text = window.prompt('Text')?.trim();
      if (text) {
        this.emitShape(tool, [point], text);
      }
      return;
    }
    this.writing.hold();
    this.board().nativeElement.setPointerCapture(event.pointerId);
    this.draft.set([{ ...point, t: event.timeStamp }]);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.draft().length) {
      this.detectHover(event);
      return;
    }
    const point = { ...this.toChartPoint(event), t: event.timeStamp };
    const isFreehand = this.tool() === 'free' || this.tool() === 'write';
    this.draft.update((points) => (isFreehand ? [...points, point] : [points[0], point]));
  }

  protected onPointerUp(): void {
    const points = this.draft();
    const tool = this.tool();
    this.draft.set([]);
    if (points.length < 2 || tool === 'eraser' || tool === 'text') {
      return;
    }
    if (tool === 'write') {
      this.writing.add(points);
      return;
    }

    const shape = finishStroke(tool, points, this.inkToShape());
    if (shape) {
      this.emitShape(shape.tool, shape.points);
    }
  }

  protected onShapeClick(id: number): void {
    if (this.isEraser()) {
      this.shapeErased.emit(id);
    }
  }

  protected onPointerLeave(): void {
    if (this.hoveredGraha()) {
      this.grahaHovered.emit(null);
    }
  }

  private detectHover(event: PointerEvent): void {
    const label = document
      .elementsFromPoint(event.clientX, event.clientY)
      .find((element) => element.hasAttribute('data-graha'));
    const graha = (label?.getAttribute('data-graha') as Graha | undefined) ?? null;
    if (graha !== this.hoveredGraha()) {
      this.grahaHovered.emit(graha);
    }
  }

  private async onWritingDone(strokes: InkPoint[][]): Promise<void> {
    const text = await recognizeHandwriting(strokes, this.writeLanguage()).catch(() => '');
    if (text) {
      this.emitShape('text', [inkBounds(strokes).bottomLeft], text);
      return;
    }
    strokes.forEach((points) => this.emitShape('free', points));
  }

  private emitShape(tool: PgShapeTool, points: ChartPoint[], text?: string): void {
    this.shapeAdded.emit({
      tool,
      points: points.map((point) => toSignPoint(this.cells(), point)),
      color: this.color(),
      width: this.width(),
      ...(text ? { text } : {}),
    });
  }

  private toChartPoint(event: PointerEvent): ChartPoint {
    const svg = this.board().nativeElement;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: Math.min(400, Math.max(0, point.x)), y: Math.min(400, Math.max(0, point.y)) };
  }
}
