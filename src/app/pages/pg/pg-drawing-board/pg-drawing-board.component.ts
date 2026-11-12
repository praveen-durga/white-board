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
import { RASI_NAMES } from '../../../shared/utils';
import { PgAspectMenuComponent } from '../pg-aspect-menu/pg-aspect-menu.component';
import { WB_HANDLE_SIZE, WB_SELECTION_PAD, WB_SNAPSHOT_SIZE } from '../pg.data';
import {
  ChartPoint,
  InkPoint,
  PgAspectKind,
  PgChartAspect,
  PgChartStyle,
  PgDraft,
  PgShape,
  PgShapeTool,
  PgTool,
  RenderedAspect,
  RenderedShape,
  WbDrag,
} from '../pg.model';
import {
  aspectCounts,
  buildAspectView,
  buildCells,
  renderAspects,
  renderChartAspects,
  renderShape,
  shapePath,
  shapePoints,
  toSignPoint,
} from '../utils/pg.util';
import { HandwritingBuffer, inkBounds, recognizeHandwriting } from '../utils/pg-handwriting.util';
import { finishStroke } from '../utils/pg-ink.util';
import {
  draggedItem,
  itemBounds,
  itemToPgShape,
  pgShapeToItem,
  pgTextSize,
  snapshotLayers,
} from '../utils/pg-whiteboard.util';

@Component({
  selector: 'app-pg-drawing-board',
  imports: [RasiChartComponent, PgAspectMenuComponent],
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
  chartAspect = input<PgChartAspect | null>(null);
  selectedShapeId = input<number | null>(null);

  shapeAdded = output<PgDraft>();
  shapeErased = output<number>();
  grahaHovered = output<Graha | null>();
  chartAspectChange = output<PgChartAspect | null>();
  shapeSelected = output<number | null>();
  shapeChanged = output<PgShape>();

  protected draft = signal<InkPoint[]>([]);
  // Live copy of the shape being moved/resized; emitted once on release so undo gets one step.
  protected dragShape = signal<PgShape | null>(null);
  protected contextMenu = signal<{ at: ChartPoint; rasi: number } | null>(null);

  private board = viewChild.required<ElementRef<SVGSVGElement>>('board');
  private wrap = viewChild.required<ElementRef<HTMLElement>>('wrap');

  private drag: (WbDrag & { shape: PgShape }) | null = null;
  private writing = new HandwritingBuffer((strokes) => this.onWritingDone(strokes));

  protected cells = computed(() => buildCells(this.chartStyle(), this.chart().ascendantRasi));

  protected renderedShapes = computed<RenderedShape[]>(() => {
    const dragged = this.dragShape();
    return this.shapes().map((shape) =>
      renderShape(this.cells(), dragged?.id === shape.id ? dragged : shape),
    );
  });

  protected handleSize = WB_HANDLE_SIZE;
  protected textSize = pgTextSize;

  protected selectionBox = computed(() => {
    const shape = this.dragShape() ?? this.shapes().find(({ id }) => id === this.selectedShapeId());
    if (this.tool() !== 'select' || !shape) {
      return null;
    }
    const { x, y, width, height } = itemBounds(pgShapeToItem(this.cells(), shape));
    return {
      x: x - WB_SELECTION_PAD,
      y: y - WB_SELECTION_PAD,
      width: width + WB_SELECTION_PAD * 2,
      height: height + WB_SELECTION_PAD * 2,
    };
  });

  protected renderedAspects = computed<RenderedAspect[]>(() => {
    const graha = this.hoveredGraha();
    return graha ? renderAspects(this.cells(), buildAspectView(this.chart(), graha)) : [];
  });

  // Cells are indexed by rasi, so counting forward through them walks the zodiac from the clicked sign.
  protected chartAspectView = computed(() => {
    const aspect = this.chartAspect();
    return aspect
      ? renderChartAspects(this.cells(), aspect.rasi, aspectCounts(aspect.kind, aspect.rasi))
      : null;
  });

  protected menuHeading = computed(() => {
    const menu = this.contextMenu();
    return menu ? `From ${menu.rasi + 1}. ${RASI_NAMES[menu.rasi]}` : '';
  });

  protected menuAspectKind = computed(() => {
    const aspect = this.chartAspect();
    return aspect && aspect.rasi === this.contextMenu()?.rasi ? aspect.kind : null;
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
    if (points.length < 2 || tool === 'select' || tool === 'eraser' || tool === 'text') {
      return '';
    }
    return tool === 'free' || tool === 'write'
      ? shapePath('free', points)
      : shapePath(tool, shapePoints(tool, points[0], points[points.length - 1]));
  });

  protected writingPaths = computed(() =>
    this.writing.strokes().map((points) => shapePath('free', points)),
  );

  protected isEraser = computed(() => this.tool() === 'eraser');

  snapshot(): string {
    return snapshotLayers(
      Array.from(this.wrap().nativeElement.querySelectorAll('svg')),
      WB_SNAPSHOT_SIZE,
    );
  }

  protected onContextMenu(event: MouseEvent): void {
    const rasi = toSignPoint(this.cells(), this.toChartPoint(event)).rasi;
    if (rasi === null) {
      this.contextMenu.set(null);
      return;
    }
    event.preventDefault();
    this.contextMenu.set({ at: { x: event.clientX, y: event.clientY }, rasi });
  }

  protected onMenuAspect(kind: PgAspectKind | null): void {
    const menu = this.contextMenu();
    this.contextMenu.set(null);
    if (menu) {
      this.chartAspectChange.emit(kind ? { kind, rasi: menu.rasi } : null);
    }
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button === 2) {
      return;
    }
    const tool = this.tool();
    if (tool === 'eraser') {
      return;
    }
    const point = this.toChartPoint(event);
    if (tool === 'select') {
      this.startDrag(event, point);
      return;
    }
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
    const drag = this.drag;
    if (drag) {
      const item = draggedItem(drag, this.toChartPoint(event));
      this.dragShape.set(itemToPgShape(this.cells(), drag.shape, item));
      return;
    }
    if (!this.draft().length) {
      this.detectHover(event);
      return;
    }
    const point = { ...this.toChartPoint(event), t: event.timeStamp };
    const isFreehand = this.tool() === 'free' || this.tool() === 'write';
    this.draft.update((points) => (isFreehand ? [...points, point] : [points[0], point]));
  }

  protected onPointerUp(): void {
    if (this.drag) {
      const moved = this.dragShape();
      this.drag = null;
      this.dragShape.set(null);
      if (moved) {
        this.shapeChanged.emit(moved);
      }
      return;
    }
    const points = this.draft();
    const tool = this.tool();
    this.draft.set([]);
    if (points.length < 2 || tool === 'select' || tool === 'eraser' || tool === 'text') {
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

  protected onKeyDown(event: KeyboardEvent): void {
    const id = this.selectedShapeId();
    if (this.tool() !== 'select' || id === null) {
      return;
    }
    if (event.key === 'Escape') {
      this.shapeSelected.emit(null);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.shapeErased.emit(id);
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

  // Clicking a drawing selects it and starts a move; the corner handle resizes the selected one.
  private startDrag(event: PointerEvent, point: ChartPoint): void {
    const target = event.target as Element;
    const isResize = !!target.closest('[data-handle]');
    const id = isResize
      ? this.selectedShapeId()
      : Number(target.closest('[data-shape]')?.getAttribute('data-shape')) || null;
    const shape = this.shapes().find((entry) => entry.id === id);
    this.shapeSelected.emit(shape ? shape.id : null);
    if (!shape) {
      return;
    }
    const svg = this.board().nativeElement;
    svg.focus({ preventScroll: true });
    svg.setPointerCapture(event.pointerId);
    const original = pgShapeToItem(this.cells(), shape);
    this.drag = {
      mode: isResize ? 'resize' : 'move',
      start: point,
      original,
      bounds: itemBounds(original),
      before: [],
      shape,
    };
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

  private toChartPoint(event: MouseEvent): ChartPoint {
    const svg = this.board().nativeElement;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      svg.getScreenCTM()!.inverse(),
    );
    return { x: Math.min(400, Math.max(0, point.x)), y: Math.min(400, Math.max(0, point.y)) };
  }
}
