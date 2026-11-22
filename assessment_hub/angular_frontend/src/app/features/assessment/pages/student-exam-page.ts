import { Component, ChangeDetectionStrategy, inject, signal, computed } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { ConfirmDialog } from "../../../shared/components/confirm-dialog";
import { countBlanks, splitOnBlanks } from "../../question/question-json.util";
import { Question } from "../../question/question-set.models";
import { formatTime, formatCountdown } from "../assessment-time";
import { StudentExamStore, isAttempted } from "../student-exam.store";
import { StudentSession } from "../student-session";
import { ViolationMonitor } from "../violation-monitor";

// const val = (e: Event): string => (e.target as HTMLInputElement | HTMLTextAreaElement).value;

@Component({
  selector: 'app-student-exam-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [StudentExamStore],
  imports: [ConfirmDialog],
  template: `
    <div class="flex h-dvh flex-col overflow-hidden">
      <!-- Top bar: answered/marks | timer | submit + last synced -->
      <header class="grid grid-cols-[1fr_auto_1fr] items-center gap-4 bg-bg-dark px-4 py-3 text-text-inverse sm:px-6">
        <div class="min-w-0">
          <p class="text-sm font-semibold">
            Answered {{ store.answeredCount() }}/{{ store.totalQuestions() }}
          </p>
          <p class="text-xs text-text-muted">Total marks: {{ store.totalMarks() }}</p>
        </div>
        <div class="min-w-0 text-center">
          <p class="font-mono text-2xl font-bold sm:text-3xl" [class]="timerClass()">{{ timerText() }}</p>
          <p class="truncate text-xs text-text-muted">{{ store.init()?.title }}</p>
        </div>
        <div class="flex flex-col items-end gap-1">
          <button type="button" class="btn btn-primary" [disabled]="store.submitting()" (click)="confirmingSubmit.set(true)">
            Submit
          </button>
          <p class="text-xs text-text-muted">
            {{ store.lastSyncedAt() ? 'Last synced ' + formatTime(store.lastSyncedAt()!, true) : 'Not synced yet' }}
          </p>
        </div>
      </header>

      @if (store.connection() === 'offline') {
        <div class="bg-warning-strong px-4 py-2 text-center text-sm font-medium text-text-inverse" role="alert">
          You are offline — answers are not being saved. Trying to reconnect…
        </div>
      }

      <main class="flex min-h-0 flex-1">
        <!-- Question list (slightly grayish) -->
        <aside class="flex w-64 shrink-0 flex-col border-r border-border bg-bg-alt md:w-80">
          <div class="min-h-0 flex-1 overflow-y-auto">
            <ul class="divide-y divide-border">
              @for (q of store.questions(); track q.id; let i = $index) {
                <li>
                  <button type="button" [class]="rowClass(q, i)" (click)="store.goTo(i)">
                    <span class="w-8 shrink-0 font-mono text-xs text-secondary">{{ i + 1 }}</span>
                    <span class="min-w-0 flex-1 truncate">{{ q.question }}</span>
                    <span class="shrink-0 text-xs text-muted">{{ q.marks }}m</span>
                  </button>
                </li>
              } @empty {
                <li class="px-4 py-3 text-sm text-secondary">No questions.</li>
              }
            </ul>
          </div>
        </aside>

        <!-- Answer area (pale tint) -->
        <section class="flex min-w-0 flex-1 flex-col bg-tint-pale">
          @if (currentQuestion(); as q) {
            <div class="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8">
              <div class="mx-auto max-w-3xl">
                <div class="flex items-center justify-between gap-4">
                  <p class="text-sm font-medium text-secondary">
                    Question {{ store.current() + 1 }} of {{ store.totalQuestions() }} · {{ q.marks }} marks
                  </p>
                  <span class="badge" [class]="badgeFor(q)">{{ stateLabel(q) }}</span>
                </div>

                @if (q.type === 'fb') {
                  <p class="mt-4 text-[17px] font-semibold leading-relaxed">
                    @for (seg of splitOnBlanks(q.question); track $index) {
                      @if (seg.blank) {
                        <input type="text" class="mx-1 inline-block w-40 border-b border-border-strong bg-surface px-2 py-0.5 text-base font-normal"
                               [attr.aria-label]="'Blank ' + (seg.blankIndex + 1)"
                               [value]="fbValues()[seg.blankIndex]"
                               (input)="onFbInput(seg.blankIndex, val($event))" />
                      } @else {
                        <span class="whitespace-pre-wrap">{{ seg.text }}</span>
                      }
                    }
                  </p>
                } @else {
                  <p class="mt-4 whitespace-pre-wrap text-[17px] font-semibold leading-relaxed">{{ q.question }}</p>
                }

                @if (q.type === 'mcq') {
                  <ul class="mt-5 space-y-2">
                    @for (option of q.options ?? []; track option.id) {
                      <li>
                        <label class="flex cursor-pointer items-start gap-3 rounded-sm border border-border bg-surface p-3 hover:bg-hover">
                          <input type="checkbox" class="mt-1 accent-primary"
                                 [checked]="mcqSelected(q, option.id)"
                                 (change)="toggleMcq(q, option.id, $any($event.target).checked)" />
                          <span class="w-6 shrink-0 font-medium">{{ option.id }}.</span>
                          <span class="min-w-0 flex-1 whitespace-pre-wrap">{{ option.text }}</span>
                        </label>
                      </li>
                    }
                  </ul>
                }

                @if (q.type === 'qa') {
                  <label class="mt-5 block">
                    <span class="mb-1 block text-sm font-medium">Your answer</span>
                    <textarea rows="8" class="field field-area text-base" [value]="qaValue()" (input)="store.setQa(q.id, val($event))"></textarea>
                  </label>
                }

                @if (store.saveState()[q.id] === 'error') {
                  <p class="mt-3 text-sm text-error" role="alert">Not saved — check your connection.</p>
                }
              </div>
            </div>

            <div class="border-t border-border p-4">
              <div class="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
                <button type="button" class="btn btn-secondary" (click)="store.toggleMark(q.id)">
                  {{ store.marked().has(q.id) ? 'Unmark question' : 'Mark this question' }}
                </button>
                <div class="flex gap-3">
                  <button type="button" class="btn btn-warning" [disabled]="store.current() === 0" (click)="store.previous()">Previous</button>
                  <button type="button" class="btn btn-success" [disabled]="store.current() >= store.totalQuestions() - 1" (click)="store.next()">Next</button>
                </div>
              </div>
            </div>
          } @else {
            <p class="m-auto text-sm text-secondary">
              {{ store.connection() === 'offline' ? 'Reconnecting…' : 'Loading assessment…' }}
            </p>
          }
        </section>
      </main>
    </div>

    <!-- Fullscreen gate / recovery overlay -->
    @if (!monitor.isFullscreen()) {
      <div class="fixed inset-0 z-[1100] flex items-center justify-center bg-overlay p-6">
        <div class="w-full max-w-md rounded-sm border border-border bg-surface p-6 text-center">
          <h2 class="text-lg">Full screen required</h2>
          <p class="mt-2 text-sm text-secondary">
            The assessment runs in full screen. Leaving full screen is recorded as an integrity event.
          </p>
          <button type="button" class="btn btn-primary mt-4" (click)="monitor.requestFullscreen()">
            Return to full screen
          </button>
        </div>
      </div>
    }

    @if (confirmingSubmit()) {
      <app-confirm-dialog title="Submit assessment?"
                          message="Your answers will be finalized and you cannot rejoin afterwards."
                          confirmLabel="Submit" (confirm)="doSubmit()" (cancel)="confirmingSubmit.set(false)" />
    }
  `,
})
export class StudentExamPage {
  protected readonly store = inject(StudentExamStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(StudentSession);
  protected readonly monitor = inject(ViolationMonitor);
  protected readonly confirmingSubmit = signal(false);

  protected readonly formatTime = formatTime;
  protected readonly splitOnBlanks = splitOnBlanks;

  protected readonly val = (e: Event): string => (e.target as HTMLInputElement | HTMLTextAreaElement).value;

  protected readonly currentQuestion = computed<Question | null>(
    () => this.store.questions()[this.store.current()] ?? null,
  );

  /** fb answers for the CURRENT question, aligned with its ____ count. */
  protected readonly fbValues = computed<string[]>(() => {
    const q = this.currentQuestion();
    const raw = q ? this.store.answers()[q.id] : undefined;
    const arr = Array.isArray(raw) ? raw.map(String) : [];
    return Array.from({ length: q ? countBlanks(q.question) : 0 }, (_, i) => arr[i] ?? '');
  });

  protected readonly timerText = computed(() => {
    if (this.store.submitting()) return 'Submitting…';
    const remaining = this.store.remainingMs();
    if (remaining <= 0 && this.store.endTs()) return "Time's up — submitting…";
    return formatCountdown(remaining);
  });

  protected readonly timerClass = computed(() => {
    const remaining = this.store.remainingMs();
    const total = this.store.durationMs();
    if (remaining <= 0) return 'text-live-critical';
    if (!total) return 'text-live-ok';
    const fraction = remaining / total;
    return fraction > 0.6 ? 'text-live-ok' : fraction > 0.2 ? 'text-live-warn' : 'text-live-critical';
  });

  constructor() {
    const identity = this.session.current();
    const code = this.route.snapshot.paramMap.get('code') ?? '';
    if (!identity || identity.code !== code) {
      void this.router.navigateByUrl('/assessment/join');
      return;
    }
    void this.store.start(identity);
  }

  protected onFbInput(blankIndex: number, value: string): void {
    const q = this.currentQuestion();
    if (!q) return;
    const values = [...this.fbValues()];
    values[blankIndex] = value;
    this.store.setFb(q.id, values);
  }

  protected mcqSelected(q: Question, optionId: string): boolean {
    const a = this.store.answers()[q.id];
    return Array.isArray(a) && a.includes(optionId);
  }

  protected toggleMcq(q: Question, optionId: string, checked: boolean): void {
    const current = Array.isArray(this.store.answers()[q.id]) ? [...(this.store.answers()[q.id] as string[])] : [];
    const idx = current.indexOf(optionId);
    if (checked && idx === -1) current.push(optionId);
    if (!checked && idx !== -1) current.splice(idx, 1);
    // persist in display order
    this.store.setMcq(q.id, (q.options ?? []).map((o) => o.id).filter((id) => current.includes(id)));
  }

  protected qaValue(): string {
    const q = this.currentQuestion();
    const a = q ? this.store.answers()[q.id] : undefined;
    return typeof a === 'string' ? a : '';
  }

  protected rowClass(q: Question, index: number): string {
    const state = this.store.marked().has(q.id)
      ? ' bg-warning-bg'
      : isAttempted(this.store.answers()[q.id])
        ? ' bg-success-bg'
        : '';
    const active = index === this.store.current()
      ? ' border-l-2 border-l-primary font-medium'
      : ' border-l-2 border-l-transparent';
    return 'flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-hover' + state + active;
  }

  protected badgeFor(q: Question): string {
    if (this.store.marked().has(q.id)) return 'badge bg-warning-bg text-warning-strong';
    if (isAttempted(this.store.answers()[q.id])) return 'badge badge-success';
    return 'badge border border-border bg-bg-alt text-text-secondary';
  }

  protected stateLabel(q: Question): string {
    if (this.store.marked().has(q.id)) return 'Marked';
    if (isAttempted(this.store.answers()[q.id])) return 'Answered';
    return 'Not answered';
  }

  protected doSubmit(): void {
    this.confirmingSubmit.set(false);
    this.store.submit();
  }
}
