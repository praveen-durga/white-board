import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ChartStyle } from '../../../models';
import { ChartStyleService, D1Chart, Graha, GrahaPosition } from '../../../services';
import { formatDegreeInRasi, GRAHA_ABBREVIATIONS } from '../../../utils';
import {
  GRAHA_LABEL_POSITIONS_BY_STYLE,
  MARGIN_GRAHA_POSITIONS_BY_STYLE,
  MARGIN_LINE_STEP,
  RASI_LABEL_POSITIONS_BY_STYLE,
  REGION_POLYGONS_BY_STYLE,
} from './rasi-chart-coordinates';
import { GrahaLabelPosition, RasiHouseRegion } from './rasi-chart.model';

// Re-exported here (rather than from a barrel entry of its own) since
// ashtakavarga-chart.component.ts is the one external consumer of the north
// coordinates, importing them via shared/ui's existing re-export of this file.
export * from './rasi-chart-coordinates';

// North Indian rotates rasi positions around the Ascendant; South Indian's
// rasi cells are fixed regardless of Ascendant, per the classical convention.
const IS_FIXED_RASI_STYLE: Record<ChartStyle, boolean> = {
  north: false,
  south: true,
  east: false,
};

type PendingLabel = { baseText: string; isCombust: boolean; degreeSuffix: string; isOverlay?: boolean; graha?: Graha };

@Component({
  selector: 'app-rasi-chart',
  templateUrl: './rasi-chart.component.html',
  styleUrl: './rasi-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RasiChartComponent {
  private chartStyleService = inject(ChartStyleService);

  chartData = input.required<D1Chart>();
  outerGrahas = input<GrahaPosition[] | null>(null);
  overlayGrahas = input<GrahaPosition[]>([]);
  dagdhaRasis = input<number[]>([]);
  munthaRasi = input<number | null>(null);
  showDegrees = input<boolean>(true);
  extraLabels = input<{ rasi: number; text: string }[]>([]);
  styleOverride = input<ChartStyle | null>(null);

  protected chartStyle = computed(() => this.styleOverride() ?? this.chartStyleService.style());
  protected hasOuterChart = computed(() => this.outerGrahas() !== null);

  protected regions = computed<RasiHouseRegion[]>(() => {
    const { ascendantRasi, ascendantLongitude, grahas } = this.chartData();
    const outerGrahas = this.outerGrahas() ?? [];
    const overlayGrahas = this.overlayGrahas();
    const dagdhaRasis = this.dagdhaRasis();
    const munthaRasi = this.munthaRasi();
    const showDegrees = this.showDegrees();
    const extraLabels = this.extraLabels();
    const chartStyle = this.chartStyle();
    const isFixedRasi = IS_FIXED_RASI_STYLE[chartStyle];
    const regionPolygons = REGION_POLYGONS_BY_STYLE[chartStyle];
    const rasiLabelPositions = RASI_LABEL_POSITIONS_BY_STYLE[chartStyle];
    const grahaLabelPositions = GRAHA_LABEL_POSITIONS_BY_STYLE[chartStyle];
    const marginGrahaPositions = MARGIN_GRAHA_POSITIONS_BY_STYLE[chartStyle];

    return regionPolygons.map((_, position) => {
      // North Indian rotates: array position 0 is always the Ascendant's
      // house, and rasi walks backward from it. South Indian is fixed: array
      // position IS the rasi directly (position 0 = Aries), never rotated.
      const rasi = isFixedRasi ? position : (((ascendantRasi - position) % 12) + 12) % 12;
      const [rasiX, rasiY] = rasiLabelPositions[position];
      const [grahaX, grahaY, stackDirection, grahaTextAnchor] = grahaLabelPositions[position];
      const marginAnchor = marginGrahaPositions[position];

      const labels: PendingLabel[] = [
        ...grahas
          .filter((g) => g.rasi === rasi)
          .map((g) => ({ ...this.buildGrahaLabel(g, showDegrees), graha: g.graha })),
        ...overlayGrahas
          .filter((g) => g.rasi === rasi)
          .map((g) => ({ ...this.buildGrahaLabel(g, false), isOverlay: true })),
        ...extraLabels
          .filter((label) => label.rasi === rasi)
          .map((label) => ({ baseText: label.text, isCombust: false, degreeSuffix: '' })),
      ];

      if (dagdhaRasis.includes(rasi)) {
        labels.unshift({ baseText: '🔥', isCombust: false, degreeSuffix: '' });
      }

      if (munthaRasi === rasi) {
        labels.unshift({ baseText: 'Mu', isCombust: false, degreeSuffix: '' });
      }

      // North: the Ascendant's house is always array position 0 (by
      // construction of the rotation above). South: rasi cells are fixed, so
      // the Ascendant marker goes wherever its own rasi's cell is.
      const isAscendantHouse = isFixedRasi ? rasi === ascendantRasi : position === 0;
      if (isAscendantHouse) {
        const degreeSuffix =
          showDegrees && ascendantLongitude !== undefined ? ` ${formatDegreeInRasi(ascendantLongitude)}` : '';
        labels.unshift({ baseText: 'Asc', isCombust: false, degreeSuffix });
      }

      const grahaLabels: GrahaLabelPosition[] = labels.map((label, i) => ({
        ...label,
        x: grahaX,
        y: grahaY + stackDirection * i * 15,
      }));

      // Each transiting planet in this house gets its own line, stacked
      // further out (away from the chart) rather than joined onto one line
      // that could run past a neighboring house's margin space.
      const outerLines = outerGrahas
        .filter((g) => g.rasi === rasi)
        .map((g) => this.buildOuterGrahaText(g))
        .map((text, i) => ({
          text,
          x: marginAnchor.x,
          y: marginAnchor.y + marginAnchor.stackDirection * i * MARGIN_LINE_STEP,
        }));

      return {
        rasi: rasi + 1,
        rasiLabelX: rasiX,
        rasiLabelY: rasiY,
        grahaTextAnchor,
        grahaLabels,
        outerTextAnchor: marginAnchor.textAnchor,
        outerLines,
      };
    });
  });

  private buildGrahaLabel(graha: GrahaPosition, showDegrees: boolean): PendingLabel {
    const abbreviation = GRAHA_ABBREVIATIONS[graha.graha];
    const baseText = graha.isRetrograde ? `(${abbreviation})` : abbreviation;
    const degreeSuffix = showDegrees ? ` ${formatDegreeInRasi(graha.longitude)}` : '';

    return { baseText, isCombust: graha.isCombust, degreeSuffix };
  }

  private buildOuterGrahaText(graha: GrahaPosition): string {
    const abbreviation = GRAHA_ABBREVIATIONS[graha.graha];
    const baseText = graha.isRetrograde ? `(${abbreviation})` : abbreviation;
    const withCombust = graha.isCombust ? `${baseText}*` : baseText;
    return `${withCombust} ${formatDegreeInRasi(graha.longitude)}`;
  }
}
