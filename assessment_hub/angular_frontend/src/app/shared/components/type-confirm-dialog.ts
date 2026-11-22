import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { eventValue } from '../../features/question/question-json.util';

@Component({
  selector: 'app-type-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-[1200] flex animate-fade-in items-center justify-center bg-overlay p-4" (click)="cancel.emit()">
      <div
        class="w-full max-w-(--modal-width) animate-fade-in rounded-sm border border-border bg-surface p-6"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="tcd-title"
        aria-describedby="tcd-body"
        (click)="$event.stopPropagation()"
      >
        <h2 id="tcd-title" class="text-lg">{{ title() }}</h2>
        <p id="tcd-body" class="mt-2 text-sm text-secondary">{{ message() }}</p>
        <label class="mt-4 block">
          <span class="mb-1 block text-sm font-medium">Type “{{ requiredText() }}” to confirm</span>
          <input
            type="text"
            autocomplete="off"
            spellcheck="false"
            class="field"
            [value]="typed()"
            (input)="typed.set(eventValue($event))"
          />
        </label>
        <div class="mt-6 flex justify-end gap-3">
          <button type="button" class="btn btn-secondary" (click)="cancel.emit()" [disabled]="busy()">Cancel</button>
          <button type="button" class="btn btn-danger" [disabled]="!matches() || busy()" (click)="confirm.emit()">
            {{ busy() ? 'Working…' : confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class TypeConfirmDialog {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly requiredText = input.required<string>();
  readonly confirmLabel = input('Confirm');
  readonly busy = input(false);
  readonly confirm = output<void>();
  readonly cancel = output<void>();

  protected readonly typed = signal('');
  protected readonly matches = computed(() => this.typed() === this.requiredText());
  protected readonly eventValue = eventValue;
}
