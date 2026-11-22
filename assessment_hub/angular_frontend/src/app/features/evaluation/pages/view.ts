import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, catchError, filter, finalize, forkJoin, map, of, switchMap} from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import { QuestionsJson, AnswersJson } from '../../question/question-set.models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WriteNotice } from '../../../shared/components/write-notice';
import { apiErrorMessage } from '../../auth/auth.api';
import { SubmissionService } from '../evaluation.api';
import { SubmissionDto, RollSubmissions } from '../evaluation.models';
import { ToastService } from '../../../core/services/toast.service';
import { toStudentMap, buildStudentRows, EVALUATION_STATE_LABEL, buildEvaluationRows, initMarkRecord, buildEvaluationJson } from '../evaluation.utils';
import { EvaluationModal } from './evaluate';
import { QuestionSetService } from '../../question/question-set.api';

@Component({
  selector: 'app-assessment-detail',
  imports: [DatePipe, WriteNotice, EvaluationModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-container section">
      @if (loadError()) {
        <div class="rounded-sm border border-error bg-error-bg p-4" role="alert">
          <p><span class="font-semibold">Error</span> — we couldn't load the assessment.</p>
          <button type="button" class="btn btn-secondary mt-3" (click)="reload()">Retry</button>
        </div>
      } @else if (loading() || !submission()) {
        <p class="text-secondary">Loading assessment…</p>
      } @else if (submission(); as s) {
        <div class="flex flex-wrap items-end justify-between gap-6">
          <div class="min-w-0 max-w-2xl">
            <h1 class="text-2xl break-words">{{ s.assessmentTitle }}</h1>
            @if (s.assessmentDescription) {
              <p class="mt-2 whitespace-pre-wrap text-secondary">{{ s.assessmentDescription }}</p>
            }
            <p class="mt-3 text-sm text-secondary">
              {{ questionCount() }} {{ questionCount() === 1 ? 'question' : 'questions' }} ·
              @if (maxMarks() !== null) {
                {{ maxMarks() }} {{ maxMarks() === 1 ? 'mark' : 'marks' }}
              } @else {
                marks unavailable
              }
            </p>
          </div>

          <div class="flex shrink-0 flex-col items-end gap-3 text-sm">
            <dl class="space-y-1.5">
              <div class="flex justify-between gap-6">
                <dt class="text-secondary">Conducted at</dt>
                <dd>@if (s.conductedAt) { {{ s.conductedAt | date:'MMM d, y, h:mm a' }} } @else { — }</dd>
              </div>
              <div class="flex justify-between gap-6">
                <dt class="text-secondary">Last evaluated</dt>
                <dd>@if (s.evaluatedAt) { {{ s.evaluatedAt | date:'MMM d, y, h:mm a' }} } @else { Never }</dd>
              </div>
            </dl>
            <div class="flex gap-3">
              <button type="button" class="btn btn-success" [disabled]="!canWrite() || saving() || !canEvaluate()"
                      (click)="saveEvaluation()">
                {{ saving() ? 'Saving…' : 'Save' }}
              </button>
              <button type="button" class="btn btn-warning" (click)="cancel()">Cancel</button>
            </div>
          </div>
        </div>

        @if (!canWrite()) {
          <app-write-notice class="mt-4 block" [status]="status()" />
        }

        <div class="mt-6 rounded-sm border border-border bg-surface">
          <div class="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
            <h2 class="text-lg">Students</h2>
            <p class="text-sm text-secondary" aria-live="polite">
              Students evaluated: {{ evaluatedCount() }}/{{ students().length }}
            </p>
          </div>

          @if (!questions()) {
            <p class="p-4 text-muted">The question set could not be loaded — evaluation is unavailable for this assessment.</p>
          } @else if (!studentsJson()) {
            <p class="p-4 text-muted">Student responses could not be loaded for this assessment.</p>
          } @else if (students().length === 0) {
            <p class="p-4 text-muted">No students are recorded in this assessment.</p>
          } @else {
            <div class="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              @for (student of students(); track student.roll) {
                <button
                  type="button"
                  class="flex h-11 items-center gap-2 rounded-sm border border-border bg-surface px-3 text-left hover:bg-hover"
                  (click)="openRoll.set(student.roll)"
                >
                  <span class="w-7 shrink-0 text-right text-sm text-secondary">{{ student.serial }}.</span>
                  <span class="min-w-0 shrink truncate font-mono text-sm" [title]="student.roll">{{ student.roll }}</span>
                  <span class="min-w-0 flex-1 truncate text-sm" [title]="student.name">{{ student.name }}</span>
                  @if (student.state === 'NOT_EVALUATED') {
                    <span class="shrink-0 text-sm font-medium text-warning" [title]="EVALUATION_STATE_LABEL[student.state]">N/A</span>
                  } @else {
                    <span
                      class="shrink-0 text-sm font-medium"
                      [class]="student.state === 'EVALUATED' ? 'text-success-strong' : 'text-warning'"
                      [title]="EVALUATION_STATE_LABEL[student.state]"
                    >
                      {{ student.total }}/{{ maxMarks() }}
                    </span>
                  }
                </button>
              }
            </div>
          }
        </div>
      }
    </div>

    @if (modal(); as m) {
      <app-evaluation-modal
        [roll]="m.roll"
        [name]="m.name"
        [status]="m.status"
        [rows]="m.rows"
        [initialMarks]="m.initialMarks"
        [maxTotal]="m.maxTotal"
        (save)="onStudentSave(m.roll, $event)"
        (cancel)="openRoll.set(null)"
      />
    }
  `,
})
export class AssessmentDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(SubmissionService);
  private readonly questionSets = inject(QuestionSetService);
  private readonly toast = inject(ToastService);

  private readonly auth = inject(AuthStore); // adjust path
  protected readonly canWrite = this.auth.canWrite;
  protected readonly status = this.auth.status;

  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  protected readonly saving = signal(false);

  protected readonly submission = signal<SubmissionDto | null>(null);
  protected readonly questions = signal<QuestionsJson | null>(null);   // import type
  protected readonly answers = signal<AnswersJson | null>(null);       // import type
  protected readonly studentsJson = signal<RollSubmissions[] | null>(null);

  /** Live edit state — Record<roll, Record<questionId, marks>>; initialized from the stored evaluation. */
  protected readonly markMap = signal<Record<string, Record<number, number>>>({});
  protected readonly openRoll = signal<string | null>(null);

  private readonly studentMap = computed(() => toStudentMap(this.studentsJson()));

  protected readonly students = computed(() =>
    buildStudentRows(this.studentMap(), this.markMap(), this.questions()?.questions ?? []));

  protected readonly evaluatedCount = computed(
    () => this.students().filter((s) => s.state === 'EVALUATED').length);

  protected readonly questionCount = computed(() => this.questions()?.questions.length ?? 0);
  protected readonly maxMarks = computed<number | null>(() => {
    const list = this.questions()?.questions;
    return list ? list.reduce((sum, q) => sum + (q.marks || 0), 0) : null;
  });

  protected readonly canEvaluate = computed(() =>
    this.questions() !== null && this.studentsJson() !== null && this.students().length > 0);

  protected readonly EVALUATION_STATE_LABEL = EVALUATION_STATE_LABEL;

  protected readonly modal = computed(() => {
    const roll = this.openRoll();
    const questions = this.questions();
    if (roll === null || !questions) return null;
    const student = this.studentMap().get(roll) ?? null;
    return {
      roll,
      name: student?.name?.trim() || 'Unknown',
      status: student?.status,
      rows: buildEvaluationRows(questions.questions, this.answers(), student),
      initialMarks: { ...(this.markMap()[roll] ?? {}) },
      maxTotal: this.maxMarks() ?? 0,
    };
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => Number(params.get('id'))),
        filter((id) => Number.isInteger(id) && id > 0),
        switchMap((id) => {
          this.loading.set(true);
          this.loadError.set(false);
          // Metadata first — the JSON file urls depend on its questionSetId.
          return this.service.get(id).pipe(
            switchMap((s) =>
              forkJoin({
                students: this.service.submissionJson(id).pipe(catchError(() => of(null))),
                evaluation: this.service.evaluationJson(id).pipe(catchError(() => of(null))),
                questions: this.questionSets.questions(s.questionSetId).pipe(catchError(() => of(null))),
                answers: this.questionSets.answers(s.questionSetId).pipe(catchError(() => of(null))),
              }).pipe(map((payload) => ({ s, ...payload })))),
            catchError(() => {
              this.loadError.set(true);
              return EMPTY;
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(({ s, students, evaluation, questions, answers }) => {
        this.submission.set(s);
        this.studentsJson.set(students?.submissions ?? null);
        this.questions.set(questions);
        this.answers.set(answers);
        this.markMap.set(initMarkRecord(evaluation?.evaluations));
        if (!questions) {
          this.toast.show('Stored questions could not be loaded — evaluation is unavailable.', 'warn');
        }
      });
  }

  reload(): void {
    const id = this.submission()?.assessmentId;
    if (id) this.router.navigate(['.'], { relativeTo: this.route, onSameUrlNavigation: 'reload' });
  }

  protected onStudentSave(roll: string, marks: Record<number, number>): void {
    this.markMap.update((all) => ({ ...all, [roll]: marks }));
    this.openRoll.set(null);
  }

  protected saveEvaluation(): void {
    const s = this.submission();
    const max = this.maxMarks();
    if (!s || max === null || this.saving() || !this.canEvaluate()) return;

    this.saving.set(true);
    this.service
      .updateEvaluation({
        assessmentId: s.assessmentId,
        evaluationJson: buildEvaluationJson(s.assessmentId, this.markMap(), max),
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.submission.set(updated); // refreshes Last evaluated + status from the response
          this.toast.show('Evaluation saved.', 'success');
        },
        error: (err) => this.toast.show(apiErrorMessage(err, 'Could not save the evaluation.'), 'error'),
      });
  }

  protected cancel(): void {
    this.router.navigate(['/assessments']);
  }
}
