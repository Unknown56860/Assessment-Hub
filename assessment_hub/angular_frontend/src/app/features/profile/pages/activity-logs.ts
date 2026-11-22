import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { finalize } from 'rxjs';

import { ProfileService } from '../profile.api';
import { ActivityLogDto } from '../profile.models';

const PAGE_SIZE = 50; // backend cap is 100

@Component({
  selector: 'app-logs',
  imports: [DatePipe],
  host: {
    '(document:keydown.escape)': 'closeDetails()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page-container section">
      <div class="mb-2 flex flex-wrap items-center gap-3">
        <h1>Activity logs</h1>
      </div>

      @if (loadError()) {
        <div class="mt-6 rounded-sm border border-error bg-error-bg p-4" role="alert">
          <p><span class="font-semibold">Error</span> - we couldn't load your activity logs.</p>
          <button
            type="button"
            class="btn mt-3 bg-bg text-text border-border-strong hover:bg-bg-alt"
            (click)="reload()"
          >
            Retry
          </button>
        </div>
      } @else {
        <!-- Pagination controls -->
        @if (hasLogs()) {
          <div class="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p class="text-sm text-secondary" aria-live="polite">
              @if (loading()) {
                Loading…
              } @else {
                Showing
                <span class="font-medium text-primary">{{ rangeFrom() }}</span> - <span class="font-medium text-primary">{{ rangeTo() }}</span>
                of
                <span class="font-medium text-primary">{{ total() }}</span>
              }
            </p>

            <div class="flex items-center gap-3">
              <button
                type="button"
                class="btn bg-pager-prev text-inverse hover:bg-pager-prev-hover active:bg-pager-prev-active"
                (click)="prevPage()"
                [disabled]="loading() || isFirst()"
              >
                Previous
              </button>
              <span class="flex items-center gap-2 text-sm">
                <label for="page-input" class="text-secondary">Page</label>
                <input
                  id="page-input"
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  class="h-(--button-height) w-16 rounded-sm border border-border-strong bg-bg px-2 text-center text-text disabled:bg-bg-alt disabled:text-text-muted"
                  [value]="pageInput()"
                  (input)="onPageTyped($event)"
                  (blur)="commitPageInput()"
                  (keydown.enter)="commitPageInput(); $event.preventDefault()"
                  [disabled]="loading()"
                  aria-label="Current page, type a number to jump"
                />
                of {{ totalPagesPadded() }}
              </span>
              <button
                type="button"
                class="btn bg-pager-next text-inverse hover:bg-pager-next-hover active:bg-pager-next-active"
                (click)="nextPage()"
                [disabled]="loading() || isLast()"
              >
                Next
              </button>
            </div>
          </div>
        }

        <!-- Log list -->
        <div class="mt-4 overflow-x-auto rounded-sm border border-border bg-surface">
          @if (loading()) {
            <p class="p-4 text-secondary">Loading activity…</p>
          } @else if (!hasLogs()) {
            <p class="p-4 text-muted">No activity yet.</p>
          } @else {
            <table class="w-full table-fixed text-left">
              <thead>
                <tr class="border-b border-border bg-bg-alt text-sm">
                  <th scope="col" class="w-16 px-3 py-3 text-center font-medium">No.</th>
                  <th scope="col" class="w-80 px-4 py-3 font-medium">Activity</th>
                  <th scope="col" class="px-4 py-3 font-medium">Description</th>
                  <th scope="col" class="w-56 px-4 py-3 text-right font-medium">Date &amp; time</th>
                </tr>
              </thead>
              <tbody>
                @for (row of numberedLogs(); track row.index) {
                  <tr
                    class="log-row cursor-pointer border-b border-border last:border-b-0 hover:bg-hover"
                    tabindex="0"
                    (click)="openDetails(row.log)"
                    (keydown.enter)="openDetails(row.log)"
                  >
                    <td class="px-3 py-3 text-center">
                      {{ row.index }}.
                    </td>
                    <td class="px-4 py-3">
                      <p class="truncate font-medium" [title]="row.log.action">{{ row.log.action }}</p>
                    </td>
                    <td class="px-4 py-3">
                      @if (row.log.description) {
                        <p class="truncate text-sm text-secondary" [title]="row.log.description">{{ row.log.description }}</p>
                      } @else {
                        <span class="text-sm text-muted">---</span>
                      }
                    </td>
                    <td class="px-4 py-3 text-right text-sm whitespace-nowrap text-secondary">
                      {{ row.log.time | date: 'MMM d, y, h:mm a' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      }

      <!-- Detail modal -->
      @if (selected(); as log) {
        <div class="fixed inset-0 flex animate-fade-in items-center justify-center bg-overlay p-4" (click)="closeDetails()">
          <div
            #logDialog
            class="w-full max-w-(--modal-width) animate-fade-in rounded-sm border border-border bg-surface p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="log-detail-title"
            tabindex="-1"
            (click)="$event.stopPropagation()"
          >
            <div class="flex items-center justify-between gap-3 border-b border-border pb-4">
              <h2 id="log-detail-title">Activity details</h2>
              <button
                type="button"
                class="btn bg-bg text-text border-border-strong hover:bg-bg-alt"
                (click)="closeDetails()"
                aria-label="Close details"
              >
                ✕
              </button>
            </div>
            <div class="grid gap-5 py-5">
              <div>
                <p class="text-xs font-medium text-secondary">Activity</p>
                <p class="break-words">{{ log.action }}</p>
              </div>
              <div>
                <p class="text-xs font-medium text-secondary">Date &amp; time</p>
                <p>{{ log.time | date: 'EEE, MMM d, y, h:mm a' }}</p>
              </div>
              <div>
                <p class="text-xs font-medium text-secondary">Description</p>
                @if (log.description) {
                  <p
                    class="modal-description mt-2 max-h-(--modal-description-max-height) overflow-y-auto break-words whitespace-pre-wrap leading-relaxed"
                    tabindex="0"
                  >{{ log.description }}</p>
                } @else {
                  <p class="mt-2 text-muted">—</p>
                }
              </div>
            </div>
          </div>
        </div>
      }
    </main>
  `,
  styles: `
    /* Shared button base; colors come from Tailwind utilities in the template */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      height: var(--button-height);
      padding-inline: var(--space-4);
      border: var(--border-width) solid transparent;
      border-radius: var(--radius-sm);
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
      transition:
        background-color 0.15s ease,
        color 0.15s ease,
        border-color 0.15s ease;
    }
    .btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    /* Focus rings for the two elements the global base layer doesn't cover */
    .log-row:focus-visible {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: calc(-1 * var(--focus-ring-offset));
    }
    .modal-description:focus-visible {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }
  `,
})
export class Logs {
  private readonly api = inject(ProfileService);

  readonly pageSize = PAGE_SIZE;

  readonly total = signal(0);
  readonly page = signal(0); // 0-based, what the backend expects
  readonly logs = signal<ActivityLogDto[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly pageInput = signal('1');
  readonly selected = signal<ActivityLogDto | null>(null);

  readonly hasLogs = computed(() => this.total() > 0);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  readonly totalPagesPadded = computed(() => this.pad(this.totalPages()));
  readonly rangeFrom = computed(() => (this.total() === 0 ? 0 : this.page() * PAGE_SIZE + 1));
  readonly rangeTo = computed(() => Math.min(this.total(), (this.page() + 1) * PAGE_SIZE));
  readonly isFirst = computed(() => this.page() <= 0);
  readonly isLast = computed(() => this.page() >= this.totalPages() - 1);

  /** Global row number: continues across pages (page 2 starts at 51). Newest log = #1. */
  readonly numberedLogs = computed(() => {
    const offset = this.page() * this.pageSize;
    return this.logs().map((log, index) => ({ log, index: offset + index + 1 }));
  });

  private readonly dialog = viewChild<ElementRef<HTMLDivElement>>('logDialog');

  constructor() {
    this.load();
    // Move focus into the dialog once it renders (a11y).
    effect(() => {
      const dialog = this.dialog();
      if (dialog) {
        requestAnimationFrame(() => dialog.nativeElement.focus());
      }
    });
  }

  openDetails(log: ActivityLogDto): void {
    this.selected.set(log);
  }

  closeDetails(): void {
    this.selected.set(null);
  }

  reload(): void {
    this.page.set(0);
    this.load();
  }

  nextPage(): void {
    this.goTo(this.page() + 1);
  }

  prevPage(): void {
    this.goTo(this.page() - 1);
  }

  onPageTyped(event: Event): void {
    // digits only; the real clamping happens on commit
    const raw = (event.target as HTMLInputElement).value.replace(/\D/g, '');
    this.pageInput.set(raw.slice(0, 4));
  }

  /** Commits the typed page on blur / Enter — clamps 1..totalPages and jumps. */
  commitPageInput(): void {
    const typed = Number.parseInt(this.pageInput(), 10);
    if (Number.isNaN(typed)) {
      this.syncPageInput();
      return;
    }
    this.goTo(typed - 1); // display is 1-based, backend is 0-based
  }

  private goTo(page0: number): void {
    const clamped = Math.min(Math.max(page0, 0), this.totalPages() - 1);
    if (clamped === this.page()) {
      this.syncPageInput();
      return;
    }
    this.page.set(clamped);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api
      .getLogs(this.page(), PAGE_SIZE)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          this.total.set(result.total);
          // Snap back if the page we asked for no longer exists (e.g. logs deleted).
          if (result.total > 0 && this.page() >= this.totalPages()) {
            this.page.set(this.totalPages() - 1);
            this.load();
            return;
          }
          this.logs.set(result.logs);
          this.syncPageInput();
        },
        error: () => this.loadError.set(true),
      });
  }

  private syncPageInput(): void {
    this.pageInput.set(String(this.page() + 1));
  }

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }
}
