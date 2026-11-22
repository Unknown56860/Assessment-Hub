import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';

import { eventValue } from '../../question/question-json.util';
import { EvaluationRow, quoteList } from '../evaluation.utils';
import { StudentStatus } from '../../assessment/assessment.dto';
import { STUDENT_STATUS_LABEL, STUDENT_STATUS_BADGE } from '../../assessment/components/student-status';

@Component({
  selector: 'app-evaluation-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },   // NEW — Esc closes, matching Cancel semantics
  template: `
    <div class="fixed inset-0 z-[1200] flex animate-fade-in items-center justify-center bg-overlay p-4" (click)="cancel.emit()">
      <div
        class="flex h-(--modal-height-xl) w-full max-w-(--modal-width-xl) animate-fade-in flex-col rounded-sm border border-border bg-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby="eval-title"
        (click)="$event.stopPropagation()"
      >
        <header class="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div class="flex min-w-0 items-center gap-3">
            @if (statusView(); as view) {
              <span [class]="view.badge" [title]="'Session ended: ' + view.label">{{ view.label }}</span>
            }
            <h2 id="eval-title" class="min-w-0 truncate text-lg font-semibold">
              {{ name() }} <span class="font-mono text-sm font-normal text-secondary">({{ roll() }})</span>
            </h2>
          </div>
          <button
            type="button"
            class="grid h-8 w-8 shrink-0 place-items-center rounded-sm text-secondary hover:bg-hover hover:text-text"
            aria-label="Close"
            (click)="cancel.emit()"
          >✕</button>
        </header>

        <div class="border-b border-border px-6 py-3 text-sm">
          Total marks: <span class="font-semibold">{{ total() }}/{{ maxTotal() }}</span>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-2">
          @for (row of rows(); track row.question.id) {
            <article class="border-b border-border py-4 last:border-b-0">
              <div class="flex items-start gap-3">
                <span class="w-8 shrink-0 pt-0.5 text-center text-sm font-medium text-secondary">{{ row.question.id }}.</span>

                <div class="min-w-0 flex-1">
                  @if (row.question.type === 'fb') {
                    <p class="whitespace-pre-wrap text-[17px] font-semibold leading-relaxed">
                      @for (seg of row.fbSegments; track $index) {
                        @if (seg.blank) {
                          <span class="mx-1 inline-block min-w-16 border-b border-border-strong px-1 align-baseline">
                            @if (row.fbResults[seg.blankIndex]; as result) {
                              <span [class]="result.correct ? 'font-semibold text-success-strong' : 'font-semibold text-error-strong'">
                                {{ result.student || '—' }}
                              </span>
                            } @else {
                              &nbsp;
                            }
                          </span>
                        } @else {
                          <span>{{ seg.text }}</span>
                        }
                      }
                    </p>
                  } @else {
                    <p class="whitespace-pre-wrap text-[17px] font-semibold leading-relaxed">{{ row.question.question }}</p>
                  }

                  @if (row.question.type === 'mcq') {
                    <ul class="mt-2 space-y-1 text-base text-secondary">
                      @for (option of row.question.options ?? []; track option.id) {
                        <li class="flex items-baseline gap-2">
                          <span class="w-6 shrink-0 font-medium">{{ option.id }}.</span>
                          <span class="min-w-0 flex-1 whitespace-pre-wrap"
                                [class]="row.optionState[option.id] === 'CORRECT' ? 'font-semibold text-success-strong'
                                       : row.optionState[option.id] === 'WRONG' ? 'font-semibold text-error-strong' : ''">
                            {{ option.text }}
                          </span>
                          @if (row.optionState[option.id] === 'CORRECT') {
                            <span class="shrink-0 text-sm font-semibold text-success-strong" aria-label="correct">✓</span>
                          }
                          @if (row.optionState[option.id] === 'WRONG') {
                            <span class="shrink-0 text-sm font-semibold text-error-strong" aria-label="wrong">✕</span>
                          }
                        </li>
                      }
                    </ul>
                    @if (row.correctOptions.length) {
                      <p class="mt-2 text-sm text-secondary">
                        Correct choices: <span class="font-medium text-success-strong">{{ quote(row.correctOptions) }}</span>
                      </p>
                    }
                  }

                  @if (row.question.type === 'fb' && row.correctAnswers.length) {
                    <p class="mt-2 text-sm text-secondary">
                      Correct answers: <span class="font-medium text-success-strong">{{ quote(row.correctAnswers) }}</span>
                    </p>
                  }

                  @if (row.question.type === 'qa') {
                    <p class="mt-2 whitespace-pre-wrap text-[17px] text-warning-strong">
                      {{ row.studentText || 'No answer provided.' }}
                    </p>
                    <label class="mt-2 flex w-fit items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        class="accent-primary"
                        [checked]="revealed()[row.question.id] === true"
                        (change)="toggleSample(row.question.id)"
                      />
                      Show correct answer
                    </label>
                    @if (revealed()[row.question.id] === true && row.sampleAnswer) {
                      <p class="mt-2 inline-block rounded-sm border border-success/30 bg-success-bg px-2 py-1 text-[17px] font-medium whitespace-pre-wrap text-success-strong">
                        {{ row.sampleAnswer }}
                      </p>
                    }
                  }
                </div>

                <span class="shrink-0 pt-0.5 text-sm text-secondary">
                  {{ row.question.marks }} {{ row.question.marks === 1 ? 'mark' : 'marks' }}
                </span>
              </div>

              <div class="mt-3 flex items-center gap-3 pl-11">
                <span class="shrink-0 text-sm text-secondary">Marks</span>
                <input
                  type="range"
                  class="h-2 min-w-0 flex-1 accent-primary"
                  min="0"
                  [max]="row.question.marks"
                  step="1"
                  [value]="marks()[row.question.id]"
                  (input)="setMark(row.question.id, row.question.marks, $event)"
                  [attr.aria-label]="'Marks slider for question ' + row.question.id"
                />
                <input
                  type="number"
                  class="field w-16 shrink-0 text-center"
                  min="0"
                  [max]="row.question.marks"
                  step="1"
                  [value]="marks()[row.question.id]"
                  (input)="setMark(row.question.id, row.question.marks, $event)"
                  [attr.aria-label]="'Marks for question ' + row.question.id"
                />
                <span class="shrink-0 text-sm text-secondary">/ {{ row.question.marks }}</span>
              </div>
            </article>
          }
        </div>

        <footer class="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button type="button" class="btn btn-success" (click)="onSave()">Save</button>
          <button type="button" class="btn btn-warning" (click)="cancel.emit()">Cancel</button>
        </footer>
      </div>
    </div>
  `,
})
export class EvaluationModal {
  readonly roll = input.required<string>();
  readonly name = input.required<string>();
  readonly status = input<StudentStatus>();
  readonly rows = input.required<EvaluationRow[]>();
  readonly initialMarks = input.required<Record<number, number>>();
  readonly maxTotal = input.required<number>();

  readonly save = output<Record<number, number>>();
  readonly cancel = output<void>();

  protected readonly marks = linkedSignal<Record<number, number>>(() => ({ ...this.initialMarks() }));
  protected readonly revealed = signal<Record<number, boolean>>({});   // now protected, matching marks

  protected readonly eventValue = eventValue;
  protected readonly quote = quoteList;

  /** Status chip data — null when the stored file predates the status field or holds an unknown value. */
  protected readonly statusView = computed(() => {
    const st = this.status();
    if (!st) return null;
    return {
      label: STUDENT_STATUS_LABEL[st] ?? st,
      badge: STUDENT_STATUS_BADGE[st] ?? 'badge border border-border bg-bg-alt text-text-secondary',
    };
  });

  /** CHANGED — counts only the questions actually shown, so the modal total always matches the list tile total. */
  protected readonly total = computed(() =>
    this.rows().reduce((sum, row) => sum + (this.marks()[row.question.id] ?? 0), 0));

  protected setMark(questionId: number, max: number, event: Event): void {
    const parsed = Math.round(Number(eventValue(event)));
    const value = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), Math.max(max, 0)) : 0;
    this.marks.update((m) => ({ ...m, [questionId]: value }));
  }

  protected toggleSample(questionId: number): void {
    this.revealed.update((r) => ({ ...r, [questionId]: !r[questionId] }));
  }

  protected onEscape(): void {
    this.cancel.emit();
  }

  /** CHANGED — drops marks for question ids that no longer exist in the loaded question set. */
  protected onSave(): void {
    const visible = new Set(this.rows().map((row) => row.question.id));
    const cleaned = Object.fromEntries(
      Object.entries(this.marks()).filter(([id]) => visible.has(Number(id))),
    ) as Record<number, number>;
    this.save.emit(cleaned);
  }
}