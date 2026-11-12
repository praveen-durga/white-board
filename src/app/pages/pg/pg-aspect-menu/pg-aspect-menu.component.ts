import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { PG_ASPECT_OPTIONS, WB_MENU_EDGE, WB_MENU_HEIGHT, WB_MENU_WIDTH } from '../pg.data';
import { ChartPoint, PgAspectKind } from '../pg.model';

// Right-click menu for a chart house: pick which aspects to draw from it. Extra sections are projected after.
@Component({
  selector: 'app-pg-aspect-menu',
  templateUrl: './pg-aspect-menu.component.html',
  styleUrl: './pg-aspect-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'menu',
    '[style.left.px]': 'left()',
    '[style.top.px]': 'top()',
    '(document:pointerdown)': 'onDocumentPointerDown($event)',
    '(document:keydown.escape)': 'closed.emit()',
    '(window:scroll)': 'closed.emit()',
    '(window:resize)': 'closed.emit()',
  },
})
export class PgAspectMenuComponent {
  at = input.required<ChartPoint>();
  heading = input.required<string>();
  activeKind = input<PgAspectKind | null>(null);
  isRasiDisabled = input(false);

  picked = output<PgAspectKind | null>();
  closed = output<void>();

  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected options = PG_ASPECT_OPTIONS;

  protected left = computed(() =>
    Math.max(WB_MENU_EDGE, Math.min(this.at().x, window.innerWidth - WB_MENU_WIDTH - WB_MENU_EDGE)),
  );
  protected top = computed(() =>
    Math.max(
      WB_MENU_EDGE,
      Math.min(this.at().y, window.innerHeight - WB_MENU_HEIGHT - WB_MENU_EDGE),
    ),
  );

  protected onDocumentPointerDown(event: PointerEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closed.emit();
    }
  }
}
