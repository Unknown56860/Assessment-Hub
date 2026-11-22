import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-[1200] flex animate-fade-in items-center justify-center bg-overlay p-4" (click)="cancel.emit()">
      <div
        class="w-full max-w-(--modal-width) animate-fade-in rounded-sm border border-border bg-surface p-6"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        (click)="$event.stopPropagation()"
      >
        <h2 id="confirm-title" class="text-lg">{{ title() }}</h2>
        <p id="confirm-body" class="mt-2 text-sm text-secondary">{{ message() }}</p>
        <div class="mt-6 flex justify-end gap-3">
          <button type="button" class="btn btn-secondary" (click)="cancel.emit()" [disabled]="busy()">Cancel</button>
          <button type="button" class="btn btn-danger" (click)="confirm.emit()" [disabled]="busy()">
            {{ busy() ? 'Working…' : confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ConfirmDialog {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirm');
  readonly busy = input(false);
  readonly confirm = output<void>();
  readonly cancel = output<void>();
}
