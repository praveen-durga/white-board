import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild, viewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BirthDetailsFormComponent } from '../../features/birth-chart';
import { BirthDetails } from '../../shared/models';
import { D1Chart, EphemerisService, Graha } from '../../shared/services';
import { ButtonComponent } from '../../shared/ui';
import { findGraha, GRAHA_ORDER, RASI_NAMES, wallTimeToUtc } from '../../shared/utils';
import { PgDrawingBoardComponent } from './pg-drawing-board/pg-drawing-board.component';
import { PgWhiteboardComponent } from './pg-whiteboard/pg-whiteboard.component';
import { isHandwritingSupported } from './utils/pg-handwriting.util';
import { emptyChart } from './utils/pg-whiteboard.util';
import {
  HANDWRITING_LANGUAGES,
  HOUSE_ORDINALS,
  LAGNA_ACTUAL,
  PG_DEFAULT_COLOR,
  PG_DEFAULT_WIDTH,
  PG_TOOLS,
  PG_WIDTHS,
  WB_SNAPSHOT_SIZE,
} from './pg.data';
import { PgChartStyle, PgDraft, PgShape, PgTool } from './pg.model';
import { buildAspectView, buildDefaultPgDetails } from './utils/pg.util';

@Component({
  selector: 'app-pg',
  imports: [FormsModule, BirthDetailsFormComponent, ButtonComponent, PgDrawingBoardComponent, PgWhiteboardComponent],
  templateUrl: './pg.component.html',
  styleUrl: './pg.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PgComponent {
  private ephemeris = inject(EphemerisService);

  protected chart = signal<D1Chart | null>(null);
  protected formDetails = signal<BirthDetails>(buildDefaultPgDetails(new Date()));
  protected tool = signal<PgTool>('line');
  protected color = signal(PG_DEFAULT_COLOR);
  protected width = signal(PG_DEFAULT_WIDTH);
  protected shapes = signal<PgShape[]>([]);
  protected undoStack = signal<PgShape[][]>([]);
  protected redoStack = signal<PgShape[][]>([]);
  protected hoveredGraha = signal<Graha | null>(null);
  protected showPlanets = signal(true);
  protected lagnaKey = signal(LAGNA_ACTUAL);
  protected inkToShape = signal(true);
  protected writeLanguage = signal(HANDWRITING_LANGUAGES[0].value);

  private pgForm = viewChild.required<BirthDetailsFormComponent>('pgForm');
  private whiteboard = viewChild.required(PgWhiteboardComponent);
  private boards = viewChildren(PgDrawingBoardComponent);

  private nextId = 1;

  protected isWriteSupported = isHandwritingSupported();
  protected tools = PG_TOOLS.filter((item) => item.value !== 'write' || this.isWriteSupported);
  protected languages = HANDWRITING_LANGUAGES;
  protected widths = PG_WIDTHS;
  protected lagnaActual = LAGNA_ACTUAL;
  protected signOptions = RASI_NAMES.map((name, rasi) => ({ value: `rasi-${rasi}`, label: name }));
  protected grahaOptions = GRAHA_ORDER.map((graha) => ({ value: graha, label: `${graha} Lagna` }));

  protected displayChart = computed<D1Chart | null>(() => {
    const chart = this.chart();
    if (!chart) {
      return null;
    }
    const key = this.lagnaKey();
    const ascendantRasi =
      key === LAGNA_ACTUAL
        ? chart.ascendantRasi
        : key.startsWith('rasi-')
          ? Number(key.slice(5))
          : findGraha(chart.grahas, key as Graha).rasi;
    return {
      ...chart,
      ascendantRasi,
      ascendantLongitude: key === LAGNA_ACTUAL ? chart.ascendantLongitude : undefined,
      grahas: this.showPlanets() ? chart.grahas : [],
    };
  });

  protected canUndo = computed(() => this.undoStack().length > 0);
  protected canRedo = computed(() => this.redoStack().length > 0);

  protected aspectSummary = computed(() => {
    const chart = this.chart();
    const graha = this.hoveredGraha();
    if (!chart || !graha) {
      return '';
    }
    const view = buildAspectView(chart, graha);
    const targets = view.aspects.map(
      ({ rasi, aspect, grahas }) =>
        `${RASI_NAMES[rasi]} (${HOUSE_ORDINALS[aspect - 1]})${grahas.length ? ` – ${grahas.join(', ')}` : ''}`,
    );
    return `${graha} in ${RASI_NAMES[view.fromRasi]} aspects ${targets.join('; ')}.`;
  });

  protected onTogglePlanets(isShown: boolean): void {
    this.showPlanets.set(isShown);
    this.hoveredGraha.set(null);
  }

  protected onSnapshotRequested(style: PgChartStyle): void {
    const board = this.boards().find((item) => item.chartStyle() === style);
    this.hoveredGraha.set(null);
    this.whiteboard().addImage({
      href: board ? board.snapshot() : emptyChart(style, WB_SNAPSHOT_SIZE),
      width: WB_SNAPSHOT_SIZE,
      height: WB_SNAPSHOT_SIZE,
    });
  }

  protected onShapeAdded(draft: PgDraft): void {
    this.commit([...this.shapes(), { ...draft, id: this.nextId++ }]);
  }

  protected onShapeErased(id: number): void {
    this.commit(this.shapes().filter((shape) => shape.id !== id));
  }

  protected onClearAll(): void {
    if (this.shapes().length) {
      this.commit([]);
    }
  }

  protected onUndo(): void {
    const previous = this.undoStack().at(-1);
    if (previous) {
      this.redoStack.update((stack) => [...stack, this.shapes()]);
      this.undoStack.update((stack) => stack.slice(0, -1));
      this.shapes.set(previous);
    }
  }

  protected onRedo(): void {
    const next = this.redoStack().at(-1);
    if (next) {
      this.undoStack.update((stack) => [...stack, this.shapes()]);
      this.redoStack.update((stack) => stack.slice(0, -1));
      this.shapes.set(next);
    }
  }

  protected async onShowChart(): Promise<void> {
    const details = this.pgForm().readValidDetails();
    if (!details) {
      return;
    }

    const instant = wallTimeToUtc(details.dob, details.tob, details.timezone);
    this.chart.set(await this.ephemeris.calculateD1Chart(instant, details.lat, details.lng, details.ayanamsa));
  }

  private commit(shapes: PgShape[]): void {
    this.undoStack.update((stack) => [...stack, this.shapes()]);
    this.redoStack.set([]);
    this.shapes.set(shapes);
  }
}
