import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type DonutColor = 'warning' | 'info' | 'success' | 'error';

export interface DonutSegment {
  label: string;
  value: number;
  color: DonutColor;
}

/** Static maps so Tailwind sees the full class names at build time. */
const STROKE: Record<DonutColor, string> = {
  warning: 'stroke-warning', info: 'stroke-info', success: 'stroke-success', error: 'stroke-error',
};
const DOT: Record<DonutColor, string> = {
  warning: 'bg-warning', info: 'bg-info', success: 'bg-success', error: 'bg-error',
};

@Component({
  selector: 'app-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-6">
      <!-- r = 15.9155 → circumference ≈ 100, so dasharray works in percent -->
      <svg viewBox="0 0 42 42" class="h-40 w-40 shrink-0" role="img" [attr.aria-label]="ariaLabel()">
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke-width="5" class="stroke-border" />
        @for (arc of arcs(); track arc.label) {
          <circle
            cx="21" cy="21" r="15.9155" fill="none" stroke-width="5"
            [class]="arc.stroke"
            [attr.stroke-dasharray]="arc.pct + ' ' + (100 - arc.pct)"
            [attr.stroke-dashoffset]="arc.offset"
            transform="rotate(-90 21 21)"
          >
            <title>{{ arc.label }}: {{ arc.value }}</title>
          </circle>
        }
        <text x="21" y="21" dy="-1" text-anchor="middle" font-size="7" font-weight="600" class="fill-text">
          {{ total() }}
        </text>
        <text x="21" y="21" dy="5.5" text-anchor="middle" font-size="3.2" class="fill-text-muted">
          {{ centerLabel() }}
        </text>
      </svg>

      <ul class="grid min-w-0 flex-1 gap-2 text-sm">
        @for (segment of segments(); track segment.label) {
          <li class="flex items-center gap-2">
            <span class="h-3 w-3 shrink-0 rounded-full" [class]="dot(segment.color)" aria-hidden="true"></span>
            <span class="truncate text-secondary">{{ segment.label }}</span>
            <span class="ml-auto font-medium">{{ segment.value }}</span>
          </li>
        }
      </ul>
    </div>
  `,
})
export class DonutChart {
  readonly segments = input.required<DonutSegment[]>();
  /** Word under the total in the middle of the ring, e.g. "messages". */
  readonly centerLabel = input('');

  protected readonly total = computed(() => this.segments().reduce((sum, s) => sum + s.value, 0));

  /** One arc per non-zero segment; offsets accumulate so segments sit end to end from 12 o'clock. */
  protected readonly arcs = computed(() => {
    let cumulative = 0;
    const arcs = this.segments().map((segment) => {
      const pct = this.total() > 0 ? (segment.value / this.total()) * 100 : 0;
      const arc = { label: segment.label, value: segment.value, pct, offset: -cumulative, stroke: STROKE[segment.color] };
      cumulative += pct;
      return arc;
    });
    return arcs.filter((arc) => arc.pct > 0);
  });

  protected readonly ariaLabel = computed(() => {
    const parts = this.segments().map((s) => `${s.value} ${s.label.toLowerCase()}`);
    return `${this.centerLabel() || 'Distribution'}: ${parts.join(', ')}`;
  });

  protected dot(color: DonutColor): string {
    return DOT[color];
  }
}
