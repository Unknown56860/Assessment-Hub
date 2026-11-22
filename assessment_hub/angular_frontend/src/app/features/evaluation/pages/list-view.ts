import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription, finalize } from 'rxjs';

import { StatusDot } from '../../../shared/components/status-dot';
import { PaginationBar } from '../../../shared/components/pagination-bar';
import { SubmissionService } from '../evaluation.api';
import { SubmissionDto } from '../evaluation.models';

@Component({
  selector: 'app-assessments-list',
  imports: [RouterLink, PaginationBar, DatePipe, StatusDot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-container section">
      <h1>Assessments</h1>

      @if (loadError()) {
        <div class="mt-6 rounded-sm border border-error bg-error-bg p-4" role="alert">
          <p><span class="font-semibold">Error!</span> Couldn't load the assessments.</p>
          <button type="button" class="btn btn-secondary mt-3" (click)="reload()">Retry</button>
        </div>
      } @else {
        <app-pagination-bar
          class="mt-6 block"
          [page]="page()"
          (pageChange)="onPageChange($event)"
          [total]="total()"
          [size]="pageSize"
          [loading]="loading()"
        />

        <div class="mt-4 overflow-x-auto rounded-sm border border-border bg-surface">
          @if (loading()) {
            <p class="p-4 text-secondary">Loading assessments…</p>
          } @else if (!hasItems()) {
            <p class="p-4 text-muted">No conducted assessments yet.</p>
          } @else {
            <ul class="divide-y divide-border">
              @for (row of numberedItems(); track row.item.assessmentId) {
                <li>
                  <a [routerLink]="['/assessments', row.item.assessmentId]" class="flex items-center gap-4 px-4 py-3 hover:bg-hover">
                    <span class="w-10 shrink-0 text-center text-sm text-secondary">{{ row.index }}.</span>
                    <app-status-dot class="shrink-0"
                                    [status]="row.item.status === 'EVALUATED' ? 'EVALUATED' : 'NOT_EVALUATED'" />
                    <div class="min-w-0 flex-1">
                      <p class="truncate font-medium" [title]="row.item.assessmentTitle">{{ row.item.assessmentTitle }}</p>
                      <p class="mt-0.5 truncate text-sm text-secondary" [title]="row.item.assessmentDescription ?? ''">
                        {{ row.item.assessmentDescription || '—' }}
                      </p>
                    </div>
                    <div class="shrink-0 text-right text-sm text-secondary">
                      <p>Conducted {{ row.item.conductedAt | date:'MMM d, y, h:mm a' }}</p>
                      <p class="mt-0.5">
                        @if (row.item.evaluatedAt) {
                          Evaluated {{ row.item.evaluatedAt | date:'MMM d, y, h:mm a' }}
                        } @else {
                          Not evaluated
                        }
                      </p>
                    </div>
                  </a>
                </li>
              }
            </ul>
          }
        </div>
      }
    </div>
  `,
})
export class AssessmentsList {
  private readonly service = inject(SubmissionService);

  protected readonly pageSize = 10;

  readonly page = signal(1);
  readonly loading = signal(false);
  readonly loadError = signal(false);

  private readonly items = signal<SubmissionDto[]>([]);
  readonly total = signal(0);

  protected readonly hasItems = computed(() => this.items().length > 0);
  protected readonly numberedItems = computed(() =>
    this.items().map((item, i) => ({ index: (this.page() - 1) * this.pageSize + i + 1, item })),
  );

  private currentLoad?: Subscription;

  constructor() {
    this.load();
  }

  reload(): void {
    this.load();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  private load(): void {
    const requestedPage = this.page();
    this.loading.set(true);
    this.loadError.set(false);
    this.currentLoad?.unsubscribe(); // rapid paging — drop the stale request
    this.currentLoad = this.service
      .list(requestedPage, this.pageSize)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          if (requestedPage !== this.page()) return;
          if (res.content.length === 0 && requestedPage > 1) {
            this.page.update((p) => p - 1);
            this.load();
            return;
          }
          this.items.set(res.content);
          this.total.set(res.totalElements);
        },
        error: () => {
          if (requestedPage !== this.page()) return;
          this.loadError.set(true);
        },
      });
  }
}
