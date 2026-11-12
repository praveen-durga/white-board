import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PgAspectMenuComponent } from '../pg-aspect-menu/pg-aspect-menu.component';
import {
  HANDWRITING_LANGUAGES,
  PG_DEFAULT_COLOR,
  PG_DEFAULT_WIDTH,
  PG_WIDTHS,
  WB_HANDLE_SIZE,
  WB_HEIGHT,
  WB_MIN_BOARD,
  WB_SELECTION_PAD,
  WB_SIZE_STEP,
  WB_SNAPSHOT_SIZE,
  WB_TOOLS,
  WB_WIDTH,
} from '../pg.data';
import {
  ChartPoint,
  InkPoint,
  PgAspectKind,
  PgChartStyle,
  WbChartMeta,
  WbChartRenderer,
  WbDrag,
  WbImage,
  WbItem,
  WbRenderedItem,
  WbStrokeTool,
  WbTool,
} from '../pg.model';
import { RASI_NAMES } from '../../../shared/utils';
import { shapePath, shapePoints } from '../utils/pg.util';
import {
  HandwritingBuffer,
  inkBounds,
  isHandwritingSupported,
  recognizeHandwriting,
} from '../utils/pg-handwriting.util';
import { finishStroke } from '../utils/pg-ink.util';
import {
  chartHouseAt,
  draggedItem,
  exportPng,
  itemBounds,
  readImageFile,
  renderItem,
  wbTextSize,
} from '../utils/pg-whiteboard.util';

@Component({
  selector: 'app-pg-whiteboard',
  imports: [FormsModule, PgAspectMenuComponent],
  templateUrl: './pg-whiteboard.component.html',
  styleUrl: './pg-whiteboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:paste)': 'onPaste($event)' },
})
export class PgWhiteboardComponent {
  renderChart = input.required<WbChartRenderer>();

  protected tool = signal<WbTool>('select');
  protected color = signal(PG_DEFAULT_COLOR);
  protected width = signal(PG_DEFAULT_WIDTH);
  protected items = signal<WbItem[]>([]);
  protected undoStack = signal<WbItem[][]>([]);
  protected redoStack = signal<WbItem[][]>([]);
  protected selectedId = signal<number | null>(null);
  protected draft = signal<InkPoint[]>([]);
  protected boardWidth = signal(WB_WIDTH);
  protected boardHeight = signal(WB_HEIGHT);
  protected inkToShape = signal(true);
  protected writeLanguage = signal(HANDWRITING_LANGUAGES[0].value);
  protected northLagna = signal<number | null>(null);
  protected contextMenu = signal<{ at: ChartPoint; id: number; house: number | null } | null>(null);

  private board = viewChild.required<ElementRef<SVGSVGElement>>('board');
  private viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private palette = viewChild.required<ElementRef<HTMLElement>>('palette');

  private nextId = 1;
  private drag: WbDrag | null = null;
  private writing = new HandwritingBuffer((strokes) => this.onWritingDone(strokes));

  protected isWriteSupported = isHandwritingSupported();
  protected tools = WB_TOOLS.filter((item) => item.value !== 'write' || this.isWriteSupported);
  protected languages = HANDWRITING_LANGUAGES;
  protected signOptions = RASI_NAMES.map((name, rasi) => ({ value: rasi, label: name }));
  protected widths = PG_WIDTHS;
  protected minBoard = WB_MIN_BOARD;
  protected sizeStep = WB_SIZE_STEP;
  protected handleSize = WB_HANDLE_SIZE;

  protected canUndo = computed(() => this.undoStack().length > 0);
  protected canRedo = computed(() => this.redoStack().length > 0);
  protected isEraser = computed(() => this.tool() === 'eraser');

  protected renderedItems = computed<WbRenderedItem[]>(() => this.items().map(renderItem));

  protected selection = computed(() => {
    const item = this.items().find(({ id }) => id === this.selectedId());
    if (this.tool() !== 'select' || !item) {
      return null;
    }
    const { x, y, width, height } = itemBounds(item);
    return {
      x: x - WB_SELECTION_PAD,
      y: y - WB_SELECTION_PAD,
      width: width + WB_SELECTION_PAD * 2,
      height: height + WB_SELECTION_PAD * 2,
    };
  });

  protected selectedNorthChart = computed(() => {
    const item = this.items().find(({ id }) => id === this.selectedId());
    return this.tool() === 'select' && item?.kind === 'image' && item.chart?.style === 'north'
      ? item
      : null;
  });

  protected lagnaValue = computed(() => {
    const chart = this.selectedNorthChart()?.chart;
    return chart ? chart.lagnaRasi : this.northLagna();
  });

  protected menuChart = computed(() => {
    const menu = this.contextMenu();
    const item = this.items().find(({ id }) => id === menu?.id);
    return item?.kind === 'image' && item.chart ? { ...item.chart, house: menu!.house } : null;
  });

  protected menuHeading = computed(() => {
    const chart = this.menuChart();
    if (!chart || chart.house === null) {
      return 'Aspects';
    }
    const lagna = chart.resolvedLagna ?? null;
    const sign = lagna === null ? '' : ` · ${RASI_NAMES[(lagna + chart.house) % 12]}`;
    return `From house ${chart.house + 1}${sign}`;
  });

  protected menuAspectKind = computed(() => {
    const chart = this.menuChart();
    return chart?.aspect && chart.aspect.house === chart.house ? chart.aspect.kind : null;
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

  constructor() {
    afterNextRender(() => {
      const fitHeight = window.innerHeight - this.palette().nativeElement.offsetHeight;
      this.boardWidth.set(
        Math.max(WB_MIN_BOARD, Math.floor(this.viewport().nativeElement.clientWidth)),
      );
      this.boardHeight.set(Math.max(WB_MIN_BOARD, Math.floor(fitHeight)));
    });
  }

  addImage({ href, width, height }: WbImage, at?: ChartPoint, chart?: WbChartMeta): void {
    const centre = at ?? this.visibleCentre();
    const id = this.nextId++;
    const box = { x: centre.x - width / 2, y: centre.y - height / 2, width, height };
    this.commit([...this.items(), { id, kind: 'image', box, href, ...(chart ? { chart } : {}) }]);
    this.tool.set('select');
    this.selectedId.set(id);
  }

  protected onAddChart(style: PgChartStyle): void {
    const meta = { style, lagnaRasi: style === 'north' ? this.northLagna() : null };
    const { href, resolvedLagna } = this.renderChart()(meta);
    const size = WB_SNAPSHOT_SIZE;
    this.addImage({ href, width: size, height: size }, undefined, { ...meta, resolvedLagna });
  }

  // With a North chart selected the picker redraws that chart; otherwise it sets the Lagna for the next one added.
  protected onLagnaChange(lagnaRasi: number | null): void {
    this.northLagna.set(lagnaRasi);
    const selected = this.selectedNorthChart();
    if (!selected?.chart) {
      return;
    }
    const meta = { ...selected.chart, lagnaRasi };
    const { href, resolvedLagna } = this.renderChart()(meta);
    const chart = { ...meta, resolvedLagna };
    this.commit(
      this.items().map((item) => (item.id === selected.id ? { ...selected, href, chart } : item)),
    );
  }

  protected onContextMenu(event: MouseEvent): void {
    const id =
      Number((event.target as Element).closest('[data-item]')?.getAttribute('data-item')) || null;
    const item = this.items().find((entry) => entry.id === id);
    if (item?.kind !== 'image' || item.chart?.style !== 'north') {
      this.contextMenu.set(null);
      return;
    }
    event.preventDefault();
    this.tool.set('select');
    this.selectedId.set(item.id);
    const house = chartHouseAt(item.box, this.toBoardPoint(event));
    this.contextMenu.set({ at: { x: event.clientX, y: event.clientY }, id: item.id, house });
  }

  protected onMenuLagna(lagnaRasi: number | null): void {
    this.contextMenu.set(null);
    this.onLagnaChange(lagnaRasi);
  }

  protected onMenuAspect(kind: PgAspectKind | null): void {
    const menu = this.contextMenu();
    this.contextMenu.set(null);
    const item = this.items().find(({ id }) => id === menu?.id);
    if (!menu || item?.kind !== 'image' || !item.chart || menu.house === null) {
      return;
    }
    const { aspect: _previous, ...rest } = item.chart;
    const chart = kind ? { ...rest, aspect: { kind, house: menu.house } } : rest;
    this.commit(this.items().map((entry) => (entry.id === item.id ? { ...item, chart } : entry)));
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button === 2) {
      return;
    }
    const svg = this.board().nativeElement;
    const tool = this.tool();
    const point = this.toBoardPoint(event);
    const target = event.target as Element;
    const id = Number(target.closest('[data-item]')?.getAttribute('data-item')) || null;
    svg.focus();
    if (tool === 'eraser') {
      if (id) {
        this.commit(this.items().filter((item) => item.id !== id));
      }
      return;
    }
    if (tool === 'select') {
      const isResize = !!target.closest('[data-handle]');
      this.startDrag(event, point, isResize ? this.selectedId() : id, isResize);
      return;
    }
    if (tool === 'text') {
      const value = window.prompt('Text')?.trim();
      if (value) {
        const item: WbItem = {
          id: this.nextId++,
          kind: 'text',
          point,
          value,
          color: this.color(),
          size: wbTextSize(this.width()),
        };
        this.commit([...this.items(), item]);
      }
      return;
    }
    this.writing.hold();
    svg.setPointerCapture(event.pointerId);
    this.draft.set([{ ...point, t: event.timeStamp }]);
  }

  protected onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (drag) {
      const point = this.toBoardPoint(event);
      this.items.update((items) =>
        items.map((item) => (item.id === drag.original.id ? draggedItem(drag, point) : item)),
      );
      return;
    }
    if (this.draft().length) {
      const point = { ...this.toBoardPoint(event), t: event.timeStamp };
      const isFreehand = this.tool() === 'free' || this.tool() === 'write';
      this.draft.update((points) => (isFreehand ? [...points, point] : [points[0], point]));
    }
  }

  protected onPointerUp(): void {
    if (this.drag) {
      const { before } = this.drag;
      this.drag = null;
      if (before !== this.items()) {
        this.commit(this.items(), before);
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
      this.commit([...this.items(), this.toShapeItem(shape.tool, shape.points)]);
    }
  }

  protected onKeyDown(event: KeyboardEvent): void {
    const id = this.selectedId();
    if (event.key === 'Escape') {
      this.selectedId.set(null);
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && id !== null) {
      event.preventDefault();
      this.onDeleteSelected();
    }
  }

  protected onDeleteSelected(): void {
    const id = this.selectedId();
    this.selectedId.set(null);
    this.commit(this.items().filter((item) => item.id !== id));
  }

  protected onPaste(event: ClipboardEvent): void {
    if (document.activeElement !== this.board().nativeElement) {
      return;
    }
    const files = this.imageFiles(event.clipboardData);
    if (files.length) {
      event.preventDefault();
      this.addFiles(files);
    }
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.addFiles(this.imageFiles(event.dataTransfer), this.toBoardPoint(event));
  }

  protected onUndo(): void {
    const previous = this.undoStack().at(-1);
    if (previous) {
      this.redoStack.update((stack) => [...stack, this.items()]);
      this.undoStack.update((stack) => stack.slice(0, -1));
      this.items.set(previous);
    }
  }

  protected onRedo(): void {
    const next = this.redoStack().at(-1);
    if (next) {
      this.undoStack.update((stack) => [...stack, this.items()]);
      this.redoStack.update((stack) => stack.slice(0, -1));
      this.items.set(next);
    }
  }

  protected onClearAll(): void {
    if (this.items().length) {
      this.selectedId.set(null);
      this.commit([]);
    }
  }

  protected onExport(): void {
    exportPng(this.board().nativeElement, this.boardWidth(), this.boardHeight());
  }

  protected onBoardSizeChange(event: Event, target: 'width' | 'height'): void {
    const input = event.target as HTMLInputElement;
    const value = Math.max(WB_MIN_BOARD, Math.round(Number(input.value) || 0));
    input.value = String(value);
    (target === 'width' ? this.boardWidth : this.boardHeight).set(value);
  }

  private visibleCentre(): ChartPoint {
    const { left, width, top, bottom } = this.viewport().nativeElement.getBoundingClientRect();
    return this.toBoardPoint({
      clientX: left + width / 2,
      clientY: (Math.max(top, 0) + Math.min(bottom, window.innerHeight)) / 2,
    });
  }

  private async onWritingDone(strokes: InkPoint[][]): Promise<void> {
    const text = await recognizeHandwriting(strokes, this.writeLanguage()).catch(() => '');
    if (!text) {
      const shapes = strokes.map((points) =>
        this.toShapeItem(
          'free',
          points.map(({ x, y }) => ({ x, y })),
        ),
      );
      this.commit([...this.items(), ...shapes]);
      return;
    }
    const { bottomLeft, height } = inkBounds(strokes);
    const item: WbItem = {
      id: this.nextId++,
      kind: 'text',
      point: bottomLeft,
      value: text,
      color: this.color(),
      size: Math.max(height, wbTextSize(this.width())),
    };
    this.commit([...this.items(), item]);
  }

  private toShapeItem(tool: WbStrokeTool, points: ChartPoint[]): WbItem {
    return {
      id: this.nextId++,
      kind: 'shape',
      tool,
      points,
      color: this.color(),
      width: this.width(),
    };
  }

  private startDrag(
    event: PointerEvent,
    point: ChartPoint,
    id: number | null,
    isResize: boolean,
  ): void {
    const original = this.items().find((item) => item.id === id);
    this.selectedId.set(original ? original.id : null);
    if (!original) {
      return;
    }
    this.board().nativeElement.setPointerCapture(event.pointerId);
    this.drag = {
      mode: isResize ? 'resize' : 'move',
      start: point,
      original,
      bounds: itemBounds(original),
      before: this.items(),
    };
  }

  private async addFiles(files: File[], at?: ChartPoint): Promise<void> {
    for (const file of files) {
      this.addImage(await readImageFile(file), at);
    }
  }

  private imageFiles(transfer: DataTransfer | null): File[] {
    return Array.from(transfer?.files ?? []).filter((file) => file.type.startsWith('image/'));
  }

  private commit(items: WbItem[], before = this.items()): void {
    this.undoStack.update((stack) => [...stack, before]);
    this.redoStack.set([]);
    this.items.set(items);
  }

  private toBoardPoint(event: Pick<MouseEvent, 'clientX' | 'clientY'>): ChartPoint {
    const svg = this.board().nativeElement;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      svg.getScreenCTM()!.inverse(),
    );
    return {
      x: Math.min(this.boardWidth(), Math.max(0, point.x)),
      y: Math.min(this.boardHeight(), Math.max(0, point.y)),
    };
  }
}
