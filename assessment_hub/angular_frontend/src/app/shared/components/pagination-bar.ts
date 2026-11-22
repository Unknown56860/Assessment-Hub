import { ChangeDetectionStrategy, Component, computed, effect, input, model, signal } from '@angular/core';

@Component({
  selector: 'app-pagination-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (total() > 0) {
      <div class="flex flex-wrap items-center justify-between gap-4">
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
            <label [for]="inputId" class="text-secondary">Page</label>
            <input
              [id]="inputId"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              class="h-(--button-height) w-16 rounded-sm border border-border-strong bg-bg px-2 text-center text-text disabled:bg-bg-alt disabled:text-text-muted"
              [value]="pageDisplay()"
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
  `,
})
export class PaginationBar {
  /** Current page, 1-based. Bind [page] + (pageChange). */
  readonly page = model.required<number>();
  readonly total = input.required<number>();
  readonly size = input.required<number>();
  readonly loading = input(false);

  private static nextId = 0;
  protected readonly inputId = `page-input-${PaginationBar.nextId++}`;

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));
  protected readonly totalPagesPadded = computed(() => String(this.totalPages()).padStart(2, '0'));
  protected readonly rangeFrom = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.size() + 1));
  protected readonly rangeTo = computed(() => Math.min(this.page() * this.size(), this.total()));
  protected readonly isFirst = computed(() => this.page() <= 1);
  protected readonly isLast = computed(() => this.page() >= this.totalPages());

  /** In-progress text in the jump box; null = display the current page. */
  private readonly typed = signal<string | null>(null);
  protected readonly pageDisplay = computed(() => this.typed() ?? String(this.page()).padStart(2, '0'));

  constructor() {
    // Re-sync the jump box whenever the page changes (prev/next/external reload).
    effect(() => {
      this.page();
      this.typed.set(null);
    });
  }

  protected onPageTyped(event: Event): void {
    this.typed.set((event.target as HTMLInputElement).value);
  }

  protected commitPageInput(): void {
    const raw = this.typed();
    this.typed.set(null);
    if (raw === null) return;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    const target = Math.min(Math.max(1, parsed), this.totalPages());
    if (target !== this.page()) this.page.set(target);
  }

  protected prevPage(): void {
    if (!this.isFirst()) this.page.update((p) => p - 1);
  }

  protected nextPage(): void {
    if (!this.isLast()) this.page.update((p) => p + 1);
  }
}
