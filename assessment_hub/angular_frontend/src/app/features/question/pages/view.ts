import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, catchError, filter, finalize, forkJoin, map, of, switchMap } from 'rxjs';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthStore } from '../../../core/auth/auth.store';
import { ToastService } from '../../../core/services/toast.service';
import { TypeConfirmDialog } from '../../../shared/components/type-confirm-dialog';
import { WriteNotice } from '../../../shared/components/write-notice';
import { apiErrorMessage } from '../../auth/auth.api';
import { AnswerView } from '../components/answer-view';
import { McqOptions } from '../components/mcq-options';
import { QuestionText } from '../components/question-text';
import { correctOptionIds, fbAnswers } from '../question-json.util';
import { QuestionSetService } from '../question-set.api';
import { QuestionSetDto, QuestionsJson, AnswersJson } from '../question-set.models';

@Component({
  selector: 'app-question-set-detail',
  imports: [DatePipe, QuestionText, McqOptions, AnswerView, TypeConfirmDialog, WriteNotice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-container section">
      @if (loadError()) {
        <div class="rounded-sm border border-error bg-error-bg p-4" role="alert">
          <p><span class="font-semibold">Error</span> - we couldn't load the question set.</p>
          <button type="button" class="btn btn-secondary mt-3" (click)="reload()">Retry</button>
        </div>
      } @else if (loading() || !set()) {
        <p class="text-secondary">Loading question set…</p>
      } @else if (set(); as s) {
        <div class="flex flex-wrap items-start justify-between gap-6">
          <div class="min-w-0 max-w-2xl">
            <h1 class="text-2xl break-words">{{ s.title }}</h1>
            @if (s.description) {
              <p class="mt-2 whitespace-pre-wrap text-secondary">{{ s.description }}</p>
            }
            <p class="mt-3 text-sm text-secondary">
              {{ questionCount() }} {{ questionCount() === 1 ? 'question' : 'questions' }} ·
              {{ totalMarks() }} {{ totalMarks() === 1 ? 'mark' : 'marks' }}
            </p>
          </div>

          <dl class="w-64 shrink-0 space-y-1.5 text-sm">
              <div class="flex justify-between gap-4"><dt class="text-secondary">Question Set ID</dt><dd class="font-mono">{{ s.questionSetId }}</dd></div>
              <div class="flex justify-between gap-4"><dt class="text-secondary">Total conducted</dt><dd>{{ s.totalConducted }}</dd></div>
            <div class="flex justify-between gap-4"><dt class="text-secondary">Created</dt><dd>{{ s.createdAt | date:'MMM d, y, h:mm a' }}</dd></div>
            <div class="flex justify-between gap-4"><dt class="text-secondary">Last modified</dt><dd>{{ s.updatedAt | date:'MMM d, y, h:mm a' }}</dd></div>
            <div class="flex justify-between gap-4">
              <dt class="text-secondary">Last conducted</dt>
              <dd>@if (s.lastConducted) { {{ s.lastConducted | date:'MMM d, y, h:mm a' }} } @else { Never }</dd>
            </div>
          </dl>
        </div>

        @if (!canWrite()) {
          <app-write-notice class="mt-4 block" [status]="status()" />
        }

        <div class="mt-6 flex flex-wrap items-center justify-between gap-4">
          <button type="button" class="btn btn-secondary" (click)="showAnswers.set(!showAnswers())">
            {{ showAnswers() ? 'Hide Answers' : 'Show Answers' }}
          </button>
          <div class="flex gap-3">
            <button type="button" class="btn btn-primary" [disabled]="!canWrite()" (click)="host()">Host</button>
            <button type="button" class="btn btn-secondary" [disabled]="!canWrite()" (click)="edit()">Update</button>
            <button type="button" class="btn btn-danger" [disabled]="!canWrite()" (click)="confirmingDelete.set(true)">Delete</button>
          </div>
        </div>


        <div class="mt-4 rounded-sm border border-border bg-surface">
          @if (rows().length === 0) {
            <p class="p-4 text-muted">This question set has no questions.</p>
          } @else {
            <ol class="divide-y divide-border">
              @for (row of rows(); track row.question.id) {
                <li class="flex items-start gap-4 px-4 py-4">
                  <span class="w-8 shrink-0 text-center text-sm font-medium text-secondary">{{ $index + 1 }}.</span>
                  <div class="min-w-0 flex-1">
                    <app-question-text
                        [question]="row.question.question"
                        [blankAnswers]="showAnswers() && row.question.type === 'fb' ? row.fbAnswers : null"
                    />
                    @if (row.question.type === 'mcq' && row.options.length) {
                        <app-mcq-options class="block" [options]="row.options" [correctIds]="row.correctIds" [revealCorrect]="showAnswers()" />
                    }
                    @if (showAnswers() && row.question.type === 'qa') {
                        <app-answer-view [type]="row.question.type" [answer]="row.answer" />
                    }
                  </div>
                  <span class="shrink-0 text-sm text-secondary">{{ row.question.marks }} {{ row.question.marks === 1 ? 'mark' : 'marks' }}</span>
                </li>
              }
            </ol>
          }
        </div>
      }
    </div>

    @if (confirmingDelete() && set()) {
      <app-type-confirm-dialog
        title="Delete question set?"
        [message]="'“' + set()!.title + '” and its stored questions and answers will be permanently removed. This cannot be undone.'"
        requiredText="Delete"
        confirmLabel="Delete"
        [busy]="deleting()"
        (confirm)="deleteSet()"
        (cancel)="confirmingDelete.set(false)"
      />
    }
  `,
})
export class QuestionSetDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(QuestionSetService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  protected readonly set = signal<QuestionSetDto | null>(null);
  protected readonly questions = signal<QuestionsJson | null>(null);
  protected readonly answers = signal<AnswersJson | null>(null);
  protected readonly showAnswers = signal(false);
  protected readonly confirmingDelete = signal(false);
  protected readonly deleting = signal(false);

  private readonly auth = inject(AuthStore);
  protected readonly canWrite = this.auth.canWrite;
  protected readonly status = this.auth.status;

  protected create(): void {
    this.router.navigate(['/question-sets/new']);
  }

  protected readonly rows = computed(() => {
    const list = this.questions()?.questions ?? [];
    const byId = new Map((this.answers()?.answers ?? []).map((a) => [a.id, a]));
    return list.map((question) => {
      const answer = byId.get(question.id) ?? null;
      return {
        question,
        answer,
        options: question.options ?? [],
        correctIds: correctOptionIds(answer),
        fbAnswers: fbAnswers(answer),
      };
    });
  });

  protected readonly questionCount = computed(() => this.questions()?.questions.length ?? 0);
  protected readonly totalMarks = computed(() =>
    (this.questions()?.questions ?? []).reduce((sum, q) => sum + (q.marks || 0), 0),
  );

  protected host(): void {
    const s = this.set();
    if (s) this.router.navigate(['/assessment/host'], { queryParams: { id: s.questionSetId } });
  }

  protected edit(): void {
    const s = this.set();
    if (s) this.router.navigate(['/question-sets', s.questionSetId, 'edit']);
  }

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => Number(params.get('id'))),
        filter((id) => Number.isInteger(id) && id > 0),
        switchMap((id) => {
          this.loading.set(true);
          this.loadError.set(false);
          return forkJoin({
            set: this.service.get(id),
            // Missing/tampered JSON files must not kill the whole page — degrade gracefully.
            questions: this.service.questions(id).pipe(catchError(() => of(null))),
            answers: this.service.answers(id).pipe(catchError(() => of(null))),
          }).pipe(
            catchError(() => {
              this.loadError.set(true);
              return EMPTY;
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(({ set, questions, answers }) => {
        this.set.set(set);
        this.questions.set(questions);
        this.answers.set(answers);
      });
  }

  reload(): void {
    const id = this.set()?.questionSetId;
    if (id) this.router.navigate(['.'], { relativeTo: this.route, onSameUrlNavigation: 'reload' });
  }

  protected deleteSet(): void {
    const s = this.set();
    if (!s || this.deleting()) return;
    this.deleting.set(true);
    this.service
      .delete(s.questionSetId)
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe({
        next: () => {
          this.toast.show(`“${s.title}” was deleted.`, 'success');
          this.router.navigate(['/question-sets']);
        },
        error: (err) => this.toast.show(apiErrorMessage(err, 'Could not delete the question set.'), 'error'),
      });
  }
}
