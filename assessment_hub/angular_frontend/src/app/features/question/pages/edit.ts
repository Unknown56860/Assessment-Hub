import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { ToastService } from '../../../core/services/toast.service';
import { apiErrorMessage } from '../../auth/auth.api';
import { AnswerView } from '../components/answer-view';
import { McqOptions } from '../components/mcq-options';
import { QuestionEditorModal } from '../components/question-editor-modal';
import { QuestionText } from '../components/question-text';
import { draftToAnswer, optionId, eventValue, cloneDraft, EMPTY_QUESTION, 
  validateDraft, buildPayloads, toEditorQuestions } from '../question-json.util';
import { QuestionSetService } from '../question-set.api';
import { EditorQuestion } from '../question-set.models';


@Component({
  selector: 'app-question-set-editor',
  imports: [QuestionEditorModal, QuestionText, McqOptions, AnswerView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-container section">
      <h1>{{ isEdit ? 'Update Question Set' : 'Create Question Set' }}</h1>

      @if (loadError()) {
        <div class="mt-6 rounded-sm border border-error bg-error-bg p-4" role="alert">
          <p><span class="font-semibold">Error</span> - we couldn't load your question set.</p>
          <button type="button" class="btn btn-secondary mt-3" (click)="reload()">Retry</button>
        </div>
      } @else if (loading()) {
        <p class="mt-6 text-secondary">Loading question set…</p>
      } @else {
        <div class="mt-6 max-w-3xl">
          <label class="block">
            <span class="mb-1 block text-sm font-medium">Title</span>
            <input type="text" class="field" maxlength="250" placeholder="e.g. OOP - Unit 4"
                   [value]="title()" (input)="title.set(eventValue($event))" />
          </label>

          <label class="mt-4 block">
            <span class="mb-1 block text-sm font-medium">Description <span class="font-normal text-muted">(optional)</span></span>
            <textarea rows="3" class="field field-area" maxlength="2500"
                      [value]="description()" (input)="description.set(eventValue($event))"></textarea>
          </label>

          <div class="mt-8 flex items-baseline justify-between gap-4">
            <h2 class="text-lg">Questions</h2>
            <p class="text-sm text-secondary" aria-live="polite">
              {{ questions().length }} {{ questions().length === 1 ? 'question' : 'questions' }} ·
              {{ totalMarks() }} {{ totalMarks() === 1 ? 'mark' : 'marks' }}
            </p>
          </div>

          <div class="mt-3 rounded-sm border border-border bg-surface">
            @if (questions().length === 0) {
              <p class="p-4 text-muted">No questions yet! Add the first one below.</p>
            } @else {
              <ol class="divide-y divide-border">
                @for (row of rows(); track $index) {
                  <li class="flex items-stretch">
                    <button
                      type="button"
                      class="flex min-w-0 flex-1 cursor-pointer items-start gap-4 border-0 bg-transparent px-4 py-4 text-left hover:bg-hover"
                      (click)="openEditor($index)"
                    >
                      <span class="w-8 shrink-0 pt-0.5 text-center text-sm font-medium text-secondary">{{ $index + 1 }}.</span>
                      <div class="min-w-0 flex-1">
                        <app-question-text [question]="row.draft.question" [blankAnswers]="row.blankAnswers" />
                        @if (row.draft.type === 'mcq' && row.options.length) {
                          <app-mcq-options class="block" [options]="row.options" [correctIds]="row.correctIds" [revealCorrect]="true" />
                        }
                        @if (row.draft.type === 'qa') {
                          <app-answer-view [type]="row.draft.type" [answer]="row.answer" />
                        }
                      </div>

                      <span class="shrink-0 pt-0.5 text-sm text-secondary">
                        {{ row.draft.marks }} {{ row.draft.marks === 1 ? 'mark' : 'marks' }}
                      </span>
                    </button>
                    <div class="flex flex-col justify-center gap-1 border-l border-border px-1.5 py-2">
                      <button
                        type="button"
                        class="grid h-7 w-7 place-items-center rounded-sm text-secondary hover:bg-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
                        [disabled]="$index === 0"
                        (click)="move($index, -1)"
                        aria-label="Move question up"
                      >↑</button>
                      <button
                        type="button"
                        class="grid h-7 w-7 place-items-center rounded-sm text-secondary hover:bg-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
                        [disabled]="$index === questions().length - 1"
                        (click)="move($index, 1)"
                        aria-label="Move question down"
                      >↓</button>
                    </div>
                  </li>
                }
              </ol>
            }
          </div>

          <div class="mt-4 flex flex-wrap items-center justify-between gap-4">
            <button type="button" class="btn btn-primary" (click)="openNew()">Add Question</button>
            <div class="flex gap-3">
              <button type="button" class="btn btn-success" [disabled]="saving()" (click)="saveSet()">
                {{ saving() ? 'Saving…' : 'Save' }}
              </button>
              <button type="button" class="btn btn-warning" [disabled]="saving()" (click)="cancel()">Cancel</button>
            </div>
          </div>
        </div>
      }
    </div>

    @if (modal(); as m) {
      <app-question-editor-modal
        [mode]="m.index === null ? 'new' : 'edit'"
        [initial]="m.draft"
        [busy]="saving()"
        (save)="onModalSave(m.index, $event)"
        (remove)="onModalDelete(m.index)"
        (cancel)="modal.set(null)"
      />
    }
  `,
})
export class QuestionSetEditor {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(QuestionSetService);
  private readonly toast = inject(ToastService);

  private readonly setId: number | null;
  protected readonly isEdit: boolean;

  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  protected readonly saving = signal(false);

  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly questions = signal<EditorQuestion[]>([]);
  protected readonly modal = signal<{ index: number | null; draft: EditorQuestion } | null>(null);

  protected readonly totalMarks = computed(() => this.questions().reduce((sum, q) => sum + (q.marks || 0), 0));
  protected readonly rows = computed(() => this.questions().map((draft) => ({
    draft,
    answer: draftToAnswer(draft),
    blankAnswers: draft.type === 'fb' ? draft.blanks : null,
    options: draft.type === 'mcq' ? draft.options.map((text, j) => ({ id: optionId(j), text })) : [],
    correctIds: draft.type === 'mcq' ? draft.options.map((_, j) => optionId(j)).filter((_, j) => draft.correct[j]) : [],
  })));


  protected readonly eventValue = eventValue;

  constructor() {
    // /question_sets/new and /question_sets/:id/edit are separate routes, so the
    // component is always fresh — snapshot is safe here.
    const raw = this.route.snapshot.paramMap.get('id');
    const id = raw === null ? Number.NaN : Number(raw);
    this.isEdit = Number.isInteger(id) && id > 0;
    this.setId = this.isEdit ? id : null;
    if (this.isEdit) this.load(id);
  }

  protected openNew(): void {
    if (this.modal()) return;
    this.modal.set({ index: null, draft: cloneDraft(EMPTY_QUESTION) });
  }

  protected openEditor(index: number): void {
    if (this.modal()) return;
    this.modal.set({ index, draft: cloneDraft(this.questions()[index]) });
  }

  protected onModalSave(index: number | null, draft: EditorQuestion): void {
    const problem = validateDraft(draft);
    if (problem) {
      this.toast.show(problem, 'error');
      return;
    }
    if (index === null) {
      this.questions.update((qs) => [...qs, draft]);
    } else {
      this.questions.update((qs) => qs.map((q, i) => (i === index ? draft : q)));
    }
    this.modal.set(null);
  }

  /** Removing a question drops its answer with it and renumbers the rest (ids = index + 1 at save). */
  protected onModalDelete(index: number | null): void {
    if (index === null) return; // delete is disabled for new questions — can't happen
    this.questions.update((qs) => qs.filter((_, i) => i !== index));
    this.modal.set(null);
  }

  protected move(index: number, direction: -1 | 1): void {
    const target = index + direction;
    this.questions.update((qs) => {
      if (target < 0 || target >= qs.length) return qs;
      const next = [...qs];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  protected cancel(): void {
    this.router.navigate(this.isEdit && this.setId !== null ? ['/question-sets', this.setId] : ['/question-sets']);
  }

  protected reload(): void {
    if (this.isEdit && this.setId !== null) this.load(this.setId);
  }

  protected saveSet(): void {
    if (this.saving()) return;
    const title = this.title().trim();
    if (!title) {
      this.toast.show('Give the question set a title.', 'error');
      return;
    }
    if (this.questions().length === 0) {
      this.toast.show('Add at least one question before saving.', 'error');
      return;
    }

    const { questionsJson, answersJson } = buildPayloads(this.setId, this.questions());
    this.saving.set(true);
    const request$ = this.isEdit && this.setId !== null
      ? this.service.update({ questionSetId: this.setId, title, description: this.description().trim() || null, questionsJson, answersJson })
      : this.service.create({ title, description: this.description().trim() || null, questionsJson, answersJson });

    request$
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (saved) => {
          this.toast.show(this.isEdit ? 'Question set updated.' : 'Question set created.', 'success');
          this.router.navigate(['/question-sets', saved.questionSetId]);
        },
        error: (err) => this.toast.show(apiErrorMessage(err, 'Could not save the question set.'), 'error'),
      });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.loadError.set(false);
    forkJoin({
      set: this.service.get(id),
      questions: this.service.questions(id).pipe(catchError(() => of(null))),
      answers: this.service.answers(id).pipe(catchError(() => of(null))),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ set, questions, answers }) => {
          this.title.set(set.title);
          this.description.set(set.description ?? '');
          this.questions.set(toEditorQuestions(questions, answers));
          if (!questions) {
            // Important safety net: saving now would REPLACE the stored JSON — make sure the user knows.
            this.toast.show('Stored questions could not be loaded, saving will replace them.', 'warn');
          }
        },
        error: () => this.loadError.set(true),
      });
  }
}
