
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { DonutSegment, DonutChart } from '../../../shared/components/donut-chart';
import { AdminService } from '../admin.api';
import { AdminDashboardDto } from '../admin.models';

type TrendPeriod = 'month' | 'quarter' | 'year';

interface TrendDatum {
  date: Date;
  label: string;
  value: number;
}

const PERIODS: TrendPeriod[] = ['month', 'quarter', 'year'];
const PERIOD_CAPTION: Record<TrendPeriod, string> = { month: 'This month', quarter: 'This quarter', year: 'This year' };
const PERIOD_POINTS: Record<TrendPeriod, number> = { month: 30, quarter: 13, year: 12 };

/** Seeded so a given period always renders the same mock series. */
const PERIOD_SEED: Record<TrendPeriod, number> = { month: 11, quarter: 29, year: 47 };
const PERIOD_MIN: Record<TrendPeriod, number> = { month: 2, quarter: 10, year: 12 };
const PERIOD_RANGE: Record<TrendPeriod, number> = { month: 11, quarter: 19, year: 19 };

/** TODO: /admin/stats doesn't expose per-status counts yet — mock until it does. */
const MESSAGE_SEGMENTS: DonutSegment[] = [
  { label: 'Answered', value: 96, color: 'success' },
  { label: 'Read', value: 27, color: 'info' },
  { label: 'Unread', value: 14, color: 'warning' },
];
const PROFILE_SEGMENTS: DonutSegment[] = [
  { label: 'Active', value: 35, color: 'success' },
  { label: 'Pending', value: 5, color: 'warning' },
  { label: 'Restricted', value: 2, color: 'error' },
];

/** Total assessments ever conducted — mock until stats provides it. */
const TOTAL_ASSESSMENTS = 345;
const STORAGE_USED_GB = 3.2;
const STORAGE_TOTAL_GB = 10;

/** Tiny deterministic PRNG so mock data doesn't change on every render. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

@Component({
  selector: 'app-dashboard',
  imports: [DonutChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-container section">
    @if (loadError()) {
        <div class="mb-6 rounded-sm border border-error bg-error-bg p-4" role="alert">
        <p><span class="font-semibold">Error</span> — we couldn't load the system stats.</p>
        <button type="button" class="btn btn-secondary mt-3" (click)="reload()">Retry</button>
        </div>
    }

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <!-- Left column -->
        <div class="grid min-w-0 content-start gap-6">
        <!-- Assessment trend -->
        <section class="rounded-sm border border-border bg-surface p-6">
            <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
                <h2>Assessment trend</h2>
                <p class="mt-1 text-sm text-secondary">
                {{ trendCaption() }}: <span class="font-medium text-primary">{{ trendSum() }}</span> of
                {{ totalAssessments }} assessments
                </p>
            </div>

            <!-- Period selector -->
            <div class="flex rounded-sm border border-border p-1" role="group" aria-label="Trend period">
                @for (option of periods; track option) {
                <button
                    type="button"
                    class="h-8 rounded-sm px-3 text-sm font-medium capitalize transition-colors"
                    [class]="period() === option ? 'bg-primary text-inverse' : 'text-secondary hover:bg-hover'"
                    [attr.aria-pressed]="period() === option"
                    (click)="period.set(option)"
                >
                    {{ option }}
                </button>
                }
            </div>
            </div>

            <!-- Vertical bar chart (pure CSS, no chart library) -->
            <div class="relative mt-6 h-56" role="img" [attr.aria-label]="chartAria()">
            <div class="absolute inset-x-0 top-0 border-t border-border" aria-hidden="true"></div>
            <div class="absolute inset-x-0 top-1/4 border-t border-border" aria-hidden="true"></div>
            <div class="absolute inset-x-0 top-1/2 border-t border-border" aria-hidden="true"></div>
            <div class="absolute inset-x-0 top-3/4 border-t border-border" aria-hidden="true"></div>
            <div class="absolute inset-x-0 bottom-0 border-t border-border-strong" aria-hidden="true"></div>

            <div class="absolute inset-0 flex items-end gap-1">
                @for (point of trend(); track $index) {
                <div class="flex h-full min-w-0 flex-1 items-end" [title]="point.label + ' — ' + point.value + ' assessments'">
                    <div
                    class="w-full rounded-t-sm bg-primary transition-colors hover:bg-primary-hover"
                    [style.height.%]="barHeight(point.value)"
                    ></div>
                </div>
                }
            </div>
            </div>

            <div class="mt-2 flex gap-1" aria-hidden="true">
            @for (point of trend(); track $index; let i = $index) {
                <span class="min-w-0 flex-1 overflow-hidden text-center text-xs whitespace-nowrap text-muted">
                @if (i % labelStep() === 0) {
                    {{ point.label }}
                }
                </span>
            }
            </div>
        </section>

        <!-- Donuts -->
        <div class="grid gap-6 md:grid-cols-2">
            <section class="rounded-sm border border-border bg-surface p-6">
            <h3>Visitor messages</h3>
            <div class="mt-5">
                <app-donut-chart [segments]="messageSegments" centerLabel="messages" />
            </div>
            </section>

            <section class="rounded-sm border border-border bg-surface p-6">
            <h3>User profiles</h3>
            <div class="mt-5">
                <app-donut-chart [segments]="profileSegments" centerLabel="users" />
            </div>
            </section>
        </div>
        </div>

        <!-- Right column: vital system stats -->
        <aside class="grid content-start gap-6" aria-label="System statistics">
        <section class="rounded-sm border border-border bg-surface p-6">
            <h3>At a glance</h3>
            <dl class="mt-4 grid gap-4">
            <div class="flex items-baseline justify-between gap-4">
                <dt class="text-sm text-secondary">Total users</dt>
                <dd class="text-2xl font-semibold">{{ stats()?.total_users ?? '—' }}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-4">
                <dt class="text-sm text-secondary">Visitor messages</dt>
                <dd class="text-2xl font-semibold">{{ stats()?.total_messages ?? '—' }}</dd>
            </div>
            </dl>
        </section>

        <section class="rounded-sm border border-border bg-surface p-6">
            <h3>System health</h3>
            <ul class="mt-4 grid gap-5">
            <li class="grid gap-2">
                <div class="flex items-center justify-between gap-3">
                <p class="font-medium">PostgreSQL</p>
                @if (loading()) {
                    <span class="text-sm text-muted">Checking…</span>
                } @else if (dbBadge(); as badge) {
                    <span class="badge" [class]="badge.cls">{{ badge.label }}</span>
                }
                </div>
                <!-- TODO: mock metrics — replace once monitoring is wired up -->
                <p class="text-sm text-secondary">12 active connections · 1.8 GB on disk</p>
            </li>

            <li class="grid gap-2">
                <div class="flex items-center justify-between gap-3">
                <p class="font-medium">SeaweedFS</p>
                @if (loading()) {
                    <span class="text-sm text-muted">Checking…</span>
                } @else if (storageBadge(); as badge) {
                    <span class="badge" [class]="badge.cls">{{ badge.label }}</span>
                }
                </div>
                <p class="flex items-baseline justify-between text-sm">
                <span class="text-secondary">Volume usage</span>
                <span>
                    <span class="font-medium">{{ storageUsedGb }} GB</span>
                    <span class="text-muted"> of {{ storageTotalGb }} GB</span>
                </span>
                </p>
                <div
                class="h-1.5 w-full overflow-hidden rounded-full bg-bg-alt"
                role="progressbar"
                aria-label="SeaweedFS storage used"
                [attr.aria-valuenow]="storageUsedPct"
                aria-valuemin="0"
                aria-valuemax="100"
                >
                <div class="h-full rounded-full bg-info" [style.width.%]="storageUsedPct"></div>
                </div>
                <p class="text-xs text-muted">Mock metrics — replace once real monitoring is wired up.</p>
            </li>
            </ul>
        </section>
        </aside>
    </div>
    </div>
  `,
})
export class Dashboard {
  private readonly api = inject(AdminService);

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly stats = signal<AdminDashboardDto | null>(null);

  readonly period = signal<TrendPeriod>('month');

  protected readonly periods = PERIODS;
  protected readonly messageSegments = MESSAGE_SEGMENTS;
  protected readonly profileSegments = PROFILE_SEGMENTS;
  protected readonly totalAssessments = TOTAL_ASSESSMENTS;
  protected readonly storageUsedGb = STORAGE_USED_GB;
  protected readonly storageTotalGb = STORAGE_TOTAL_GB;
  protected readonly storageUsedPct = Math.round((STORAGE_USED_GB / STORAGE_TOTAL_GB) * 100);

  protected readonly trend = computed(() => this.buildTrend(this.period()));
  protected readonly trendSum = computed(() => this.trend().reduce((sum, p) => sum + p.value, 0));
  protected readonly trendMax = computed(() => Math.max(...this.trend().map((p) => p.value), 1));
  protected readonly trendCaption = computed(() => PERIOD_CAPTION[this.period()]);
  /** Show at most ~6 x-axis labels regardless of bar count. */
  protected readonly labelStep = computed(() => Math.ceil(this.trend().length / 6));

  protected readonly chartAria = computed(
    () => `${PERIOD_CAPTION[this.period()]}: ${this.trendSum()} assessments across ${this.trend().length} bars`,
  );

  protected readonly dbBadge = computed(() => this.badgeFor(this.stats()?.db_status));
  protected readonly storageBadge = computed(() => this.badgeFor(this.stats()?.storage_status));

  constructor() {
    this.load();
  }

  reload(): void {
    this.load();
  }

  protected barHeight(value: number): number {
    return Math.max(2, Math.round((value / this.trendMax()) * 100));
  }

  private badgeFor(status?: string): { label: string; cls: string } | null {
    if (!status) return null;
    const up = status.toUpperCase() === 'UP';
    return { label: status.toUpperCase(), cls: up ? 'badge badge-success' : 'badge badge-error' };
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api
      .getStats()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => this.stats.set(res),
        error: () => this.loadError.set(true),
      });
  }

  /** TODO: replace with real series from /admin/stats per period. */
  private buildTrend(period: TrendPeriod): TrendDatum[] {
    const count = PERIOD_POINTS[period];
    const rand = mulberry32(PERIOD_SEED[period]);
    const today = new Date();
    const points: TrendDatum[] = [];

    for (let i = count - 1; i >= 0; i--) {
      const value = PERIOD_MIN[period] + Math.floor(rand() * PERIOD_RANGE[period]);
      let date: Date;
      let label: string;

      if (period === 'year') {
        date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        label = date.toLocaleDateString('en-US', { month: 'short' });
      } else {
        const daysBack = period === 'month' ? i : i * 7;
        date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysBack);
        label =
          period === 'month'
            ? String(date.getDate()) // day number only — fits the narrow bars
            : date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      }

      points.push({ date, label, value });
    }
    return points;
  }
}
