import { ChangeDetectionStrategy, Component } from '@angular/core';

const template_light = `
  <footer class="border-t border-border-strong bg-bg-alt">
    <div
      class="page-container flex flex-col items-center gap-6 py-6 sm:flex-row sm:justify-between"
    >
      <div class="flex flex-col items-center gap-1 text-center sm:items-start sm:text-left">
        <span class="text-base font-semibold text-text">Assessment Hub</span>
        <span class="text-xs text-secondary">© 2026 Assessment Hub. All rights reserved.</span>
      </div>

      <button
        type="button"
        class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm border border-border bg-surface px-3 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-primary"
        (click)="scrollToTop()"
      >
        <span aria-hidden="true">↑</span>
        Back to top
      </button>
    </div>
  </footer>
`

const template_dark = `
  <footer class="bg-bg-dark">
    <div
      class="page-container flex flex-col items-center gap-6 py-6 sm:flex-row sm:justify-between"
    >
      <div class="flex flex-col items-center gap-1 text-center sm:items-start sm:text-left">
        <span class="text-base font-semibold text-text-inverse">Assessment Hub</span>
        <span class="text-xs text-text-muted">© 2026 Assessment Hub. All rights reserved.</span>
      </div>
      <button
        type="button"
        class="inline-flex h-8 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 transition-colors hover:text-primary-hover hover:underline"
        (click)="scrollToTop()"
      >
        <span aria-hidden="true">↑</span>
        Back to top
      </button>

    </div>
  </footer>
`

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: template_dark,
})
export class Footer {
  protected scrollToTop(): void {
    window.scrollTo({ top: 0 });
  }
}
