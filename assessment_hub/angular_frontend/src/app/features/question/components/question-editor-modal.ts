import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, linkedSignal, viewChild } from '@angular/core';
import { QuestionType } from '../../../shared/models/common.types';
import { eventValue, optionId, countBlanks, BLANK, removeBlankAt } from '../question-json.util';
import { EditorQuestion } from '../question-set.models';

@Component({
  selector: 'app-question-editor-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-[1200] flex animate-fade-in items-center justify-center bg-overlay p-4" (click)="cancel.emit()">
      <div
        class="w-full max-w-(--modal-width-lg) animate-fade-in rounded-sm border border-border bg-surface p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qem-title"
        (click)="$event.stopPropagation()"
      >
        <div class="relative">
          <h2 id="qem-title" class="text-center text-lg font-semibold">
            {{ mode() === 'new' ? 'New Question' : 'Update Question' }}
          </h2>
          <button
            type="button"
            class="absolute top-0 right-0 grid h-8 w-8 place-items-center rounded-sm text-secondary hover:bg-hover hover:text-text"
            aria-label="Close"
            (click)="cancel.emit()"
          >✕</button>
        </div>

        <div class="mt-5 flex items-end gap-4">
          <label class="min-w-0 flex-1">
            <span class="mb-1 block text-sm font-medium">Question type</span>
            <select class="field" (change)="onTypeChange($event)">
              @for (t of types; track t.value) {
                <option [value]="t.value" [selected]="t.value === type()">{{ t.label }}</option>
              }
            </select>
          </label>
          <label class="w-28 shrink-0">
            <span class="mb-1 block text-sm font-medium">Marks</span>
            <input type="number" min="0" step="1" class="field" [value]="marks()" (input)="marks.set(eventValue($event))" />
          </label>
        </div>

        <label class="mt-4 block">
          <span class="mb-1 block text-sm font-medium">Question</span>
          <textarea #questionArea rows="4" class="field field-area text-base" [value]="text()" (input)="text.set(eventValue($event))"></textarea>
        </label>
        @if (type() === 'fb') {
          <p class="mt-1 text-xs text-muted">
            Four consecutive underscores (____) mark one blank — three or five will not count. A question can have any
            number of blanks; each one needs a matching answer below. ({{ blankCount() }} detected)
          </p>
        }

        @if (type() === 'qa') {
          <label class="mt-4 block">
            <span class="mb-1 block text-sm font-medium">Sample answer</span>
            <textarea rows="4" class="field field-area text-base" [value]="sampleAnswer()" (input)="sampleAnswer.set(eventValue($event))"></textarea>
          </label>
        }

        @if (type() === 'fb') {
          <div class="mt-4 space-y-2">
            @for (blank of blanks(); track $index) {
              <div>
                <span class="mb-1 block text-sm font-medium">Blank {{ $index + 1 }} — correct answer</span>
                <div class="flex items-start gap-2">
                  <textarea rows="1" class="field field-area min-w-0 flex-1" [value]="blank" (input)="setBlank($index, eventValue($event))"></textarea>
                  <button
                    type="button"
                    class="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-secondary hover:bg-hover hover:text-text"
                    [attr.aria-label]="'Remove blank ' + ($index + 1) + ' and its ____ from the question'"
                    (click)="removeBlank($index)"
                  >✕</button>
                </div>
              </div>
            }
          </div>
        }

        @if (type() === 'mcq') {
          <div class="mt-4 space-y-2">
            @for (option of options(); track $index) {
              <div class="flex items-start gap-2">
                <input
                  type="checkbox"
                  class="mt-2 accent-primary"
                  [checked]="correct()[$index]"
                  (change)="toggleCorrect($index)"
                  [attr.aria-label]="'Choice ' + optionId($index) + ' is correct'"
                />
                <span class="mt-1.5 w-6 shrink-0 text-sm font-medium">{{ optionId($index) }}.</span>
                <textarea
                  rows="1"
                  class="field field-area min-w-0 flex-1"
                  [value]="option"
                  [placeholder]="'Choice ' + optionId($index)"
                  (input)="setOption($index, eventValue($event))"
                ></textarea>
                <button
                  type="button"
                  class="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-secondary hover:bg-hover hover:text-text"
                  [attr.aria-label]="'Remove choice ' + optionId($index)"
                  (click)="removeChoice($index)"
                >✕</button>
              </div>
            }
          </div>
        }

        <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            @if (type() === 'fb') {
              <button type="button" class="btn btn-secondary" [disabled]="busy()" (click)="addBlank()">Add Blank</button>
            }
            @if (type() === 'mcq') {
              <button type="button" class="btn btn-secondary" [disabled]="busy()" (click)="addChoice()">Add Choice</button>
            }
          </div>
          <div class="flex gap-3">
            <button type="button" class="btn btn-success" [disabled]="busy()" (click)="saveDraft()">Save</button>
            <button type="button" class="btn btn-warning" [disabled]="busy()" (click)="cancel.emit()">Cancel</button>
            <button type="button" class="btn btn-danger" [disabled]="mode() === 'new' || busy()" (click)="remove.emit()">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class QuestionEditorModal {
  readonly mode = input.required<'new' | 'edit'>();
  readonly initial = input.required<EditorQuestion>();
  readonly busy = input(false);
  readonly save = output<EditorQuestion>();
  readonly remove = output<void>();
  readonly cancel = output<void>();

  protected readonly types: { value: QuestionType; label: string }[] = [
    { value: 'mcq', label: 'Multiple Choice' },
    { value: 'fb', label: 'Fill in the Blanks' },
    { value: 'qa', label: 'Question / Answer' },
  ];

  protected readonly type = linkedSignal<QuestionType>(() => this.initial().type);
  protected readonly marks = linkedSignal(() => String(this.initial().marks));
  protected readonly text = linkedSignal(() => this.initial().question);
  protected readonly options = linkedSignal<string[]>(() => [...this.initial().options]);
  protected readonly correct = linkedSignal<boolean[]>(() => [...this.initial().correct]);
  protected readonly blanks = linkedSignal<string[]>(() => [...this.initial().blanks]);
  protected readonly sampleAnswer = linkedSignal(() => this.initial().sampleAnswer);

  private readonly questionArea = viewChild<ElementRef<HTMLTextAreaElement>>('questionArea');

  protected readonly eventValue = eventValue;
  protected readonly optionId = optionId;
  protected readonly blankCount = computed(() => countBlanks(this.text()));

  protected onTypeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as QuestionType;
    this.type.set(value);
    if (value === 'mcq' && this.options().length === 0) {
      this.options.set(['', '']);
      this.correct.set([false, false]);
    }
    if (value === 'fb' && this.blanks().length === 0 && this.blankCount() > 0) {
      this.blanks.set(Array.from({ length: this.blankCount() }, () => ''));
    }
  }

  /** Inserts ____ at the text cursor, or at the end when the question field isn't focused. */
  protected addBlank(): void {
    const el = this.questionArea()?.nativeElement;
    const value = this.text();
    const hasCursor = el != null && el === document.activeElement && el.selectionStart != null;
    const pos = hasCursor && el ? (el.selectionStart ?? value.length) : value.length;
    const before = pos > 0 ? value.charAt(pos - 1) : '';
    const after = pos < value.length ? value.charAt(pos) : '';
    const insertion = (before === '_' ? ' ' : '') + BLANK + (after === '_' ? ' ' : '');
    this.text.set(value.slice(0, pos) + insertion + value.slice(pos));
    this.blanks.update((b) => [...b, '']);
    const caret = pos + insertion.length;
    queueMicrotask(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  }

  /** Drops the answer row AND the matching ____ occurrence from the question text. */
  protected removeBlank(index: number): void {
    this.text.update((value) => removeBlankAt(value, index));
    this.blanks.update((b) => b.filter((_, i) => i !== index));
  }

  protected addChoice(): void {
    this.options.update((o) => [...o, '']);
    this.correct.update((c) => [...c, false]);
  }

  protected setOption(index: number, value: string): void {
    this.options.update((o) => o.map((v, i) => (i === index ? value : v)));
  }

  protected setBlank(index: number, value: string): void {
    this.blanks.update((b) => b.map((v, i) => (i === index ? value : v)));
  }

  protected toggleCorrect(index: number): void {
    this.correct.update((c) => c.map((v, i) => (i === index ? !v : v)));
  }

  protected removeChoice(index: number): void {
    this.options.update((o) => o.filter((_, i) => i !== index));
    this.correct.update((c) => c.filter((_, i) => i !== index));
  }

  protected saveDraft(): void {
    const text = this.text();
    // Keep blank answers aligned with the ____ count in the question text.
    let blanks = [...this.blanks()];
    if (this.type() === 'fb') {
      const count = this.blankCount();
      blanks = blanks.slice(0, count);
      while (blanks.length < count) blanks.push('');
    }
    this.save.emit({
      type: this.type(),
      marks: Number(this.marks()),
      question: text,
      options: [...this.options()],
      correct: [...this.correct()],
      blanks,
      sampleAnswer: this.sampleAnswer(),
    });
  }
}
