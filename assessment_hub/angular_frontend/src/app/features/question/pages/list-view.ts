import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { finalize } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import { PaginationBar } from '../../../shared/components/pagination-bar';
import { WriteNotice } from '../../../shared/components/write-notice';
import { QuestionSetService } from '../question-set.api';
import { QuestionSetDto } from '../question-set.models';


@Component({
  selector: 'app-question-sets-list',
  imports: [RouterLink, PaginationBar, DatePipe, WriteNotice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-container section">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h1>Question Sets</h1>
        <button type="button" class="btn btn-primary" [disabled]="!canWrite()" (click)="create()">New Question Set</button>
      </div>

      @if (!canWrite()) {
        <app-write-notice class="mt-4 block" [status]="status()" />
      }

      @if (loadError()) {
        <div class="mt-6 rounded-sm border border-error bg-error-bg p-4" role="alert">
          <p><span class="font-semibold">Error</span> — we couldn't load the question sets.</p>
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
            <p class="p-4 text-secondary">Loading question sets…</p>
          } @else if (!hasItems()) {
            <p class="p-4 text-muted">No question sets yet.</p>
          } @else {
            <ul class="divide-y divide-border">
              @for (row of numberedItems(); track row.item.questionSetId) {
                <li>
                  <a [routerLink]="['/question-sets', row.item.questionSetId]" class="flex items-center gap-4 px-4 py-3 hover:bg-hover">
                    <span class="w-10 shrink-0 text-center text-sm text-secondary">{{ row.index }}.</span>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-baseline justify-between gap-4">
                        <p class="truncate font-medium" [title]="row.item.title">{{ row.item.title }}</p>
                        <p class="shrink-0 text-sm whitespace-nowrap text-secondary">
                          {{ row.item.createdAt | date:'MMM d, y, h:mm a' }}
                        </p>
                      </div>
                      <div class="mt-0.5 flex items-baseline justify-between gap-4 text-sm">
                        <p class="truncate text-secondary" [title]="row.item.description ?? ''">
                          {{ row.item.description || '—' }}
                        </p>
                        <p class="shrink-0 whitespace-nowrap text-secondary">Conducted {{ row.item.totalConducted }}×</p>
                      </div>
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
export class QuestionSetsList {
  private readonly service = inject(QuestionSetService);

  protected readonly pageSize = 10;

  readonly page = signal(1);
  readonly loading = signal(false);
  readonly loadError = signal(false);

  private readonly items = signal<QuestionSetDto[]>([]);
  readonly total = signal(0);

  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  protected readonly canWrite = this.auth.canWrite;
  protected readonly status = this.auth.status;

  protected create(): void {
    this.router.navigate(['/question-sets/new']);
  }

  readonly hasItems = computed(() => this.items().length > 0);
  readonly numberedItems = computed(() =>
    this.items().map((item, i) => ({ index: (this.page() - 1) * this.pageSize + i + 1, item })),
  );

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
    this.service
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
