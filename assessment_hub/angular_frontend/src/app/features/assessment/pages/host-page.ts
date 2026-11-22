import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { apiError, AssessmentApi } from '../assessment.api';
import { HostRequestDto } from '../assessment.dto';
import { browserUtcOffset, defaultStart, fromLocalInput, toLocalInput } from '../assessment-time';
import { AuthStore } from '../../../core/auth/auth.store';
import { ToastService } from '../../../core/services/toast.service';
import { WriteNotice } from '../../../shared/components/write-notice';
import { QuestionSetService } from '../../question/question-set.api';
import { QuestionSetDto } from '../../question/question-set.models';

// const val = (e: Event): string => (e.target as HTMLInputElement | HTMLTextAreaElement).value;

@Component({
  selector: 'app-host-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WriteNotice],
  template: `
    <div class="page-container py-8">
      <div class="flex items-center justify-between gap-4">
        <h1>Assessment live hosting</h1>
        <button type="button" class="btn btn-primary shrink-0" [disabled]="hosting() || !canWrite()" (click)="host()">
          {{ hosting() ? 'Hosting…' : 'Host' }}
        </button>
      </div>

      @if (profileStatus() && profileStatus() !== 'ACTIVE') {
        <app-write-notice class="mt-4 block" [status]="profileStatus()" />
      }

      @if (!checked()) {
        <p class="mt-6 text-sm text-secondary">Checking for an active assessment…</p>
      } @else {
        <!-- Basics -->
        <div class="mt-6 grid gap-6 lg:grid-cols-2">
          <section class="rounded-sm border border-border bg-surface p-5">
            <label class="block">
              <span class="mb-1 block text-sm font-medium">Assessment title <span class="text-error">*</span></span>
              <input type="text" class="field" maxlength="250" autocomplete="off" placeholder="e.g. Java Fundamentals — Unit Test 3"
                     [value]="title()" (input)="title.set(val($event))" />
            </label>
            <label class="mt-4 block">
              <span class="mb-1 block text-sm font-medium">Description</span>
              <textarea rows="3" class="field field-area" maxlength="2500" placeholder="Optional instructions shown to students"
                        [value]="description()" (input)="description.set(val($event))"></textarea>
            </label>
          </section>

          <section class="rounded-sm border border-border bg-surface p-5">
            <label class="block">
              <span class="mb-1 block text-sm font-medium">Assessment code <span class="text-error">*</span></span>
              <div class="flex gap-2">
                <input type="text" class="field font-mono tracking-widest" maxlength="6" autocomplete="off" spellcheck="false"
                       [value]="code()" (input)="onCode($event)" />
                <button type="button" class="btn btn-secondary shrink-0" [disabled]="regenerating()" (click)="refreshCode()">
                  Regenerate
                </button>
              </div>
            </label>
            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="mb-1 block text-sm font-medium">Duration (minutes) <span class="text-error">*</span></span>
                <input type="number" min="5" max="720" class="field" [value]="duration()" (input)="onDuration($event)" />
              </label>
              <label class="block">
                <span class="mb-1 block text-sm font-medium">Max students</span>
                <input type="number" min="1" max="10000" class="field" [value]="maxStudents()" (input)="maxStudents.set(val($event))" />
                <span class="mt-1 block text-xs text-muted">Blank = default cap of 100.</span>
              </label>
              <label class="block">
                <span class="mb-1 block text-sm font-medium">Start time <span class="text-error">*</span></span>
                <input type="datetime-local" class="field" [value]="startAt()" (input)="onStart($event)" />
              </label>
              <label class="block">
                <span class="mb-1 block text-sm font-medium">End time <span class="text-error">*</span></span>
                <input type="datetime-local" class="field" [value]="endAt()" (input)="onEnd($event)" />
              </label>
            </div>
          </section>
        </div>

        <!-- Question set picker -->
        <div class="mt-6 grid gap-6 lg:grid-cols-2">
          <section class="rounded-sm border border-border bg-surface p-5">
            <h2 class="text-lg">Question sets</h2>
            <div class="mt-3 h-72 overflow-y-auto rounded-sm border border-border bg-bg-alt" (scroll)="onListScroll($event)">
              <ul class="divide-y divide-border">
                @for (set of sets(); track set.questionSetId) {
                  <li>
                    <button type="button"
                            class="block w-full px-4 py-2 text-left"
                            [class]="selectedId() === set.questionSetId
                              ? 'bg-primary-subtle' : 'hover:bg-hover'"
                            (click)="selectSet(set)">
                      <span class="block truncate text-sm font-medium">{{ set.title }}</span>
                      <span class="block text-xs text-muted">Created {{ formatDate(set.createdAt) }}</span>
                    </button>
                  </li>
                } @empty {
                  <li class="px-4 py-3 text-sm text-secondary">No question sets yet.</li>
                }
              </ul>
              @if (loadingSets()) {
                <div class="px-4 py-2 text-xs text-muted">Loading…</div>
              }
            </div>
            <p class="mt-2 text-xs text-muted">{{ sets().length }} of {{ setsTotal() }} shown — scroll for more.</p>
          </section>

          <section class="rounded-sm border border-border bg-surface p-5">
            <label class="block">
              <span class="mb-1 block text-sm font-medium">Question set id</span>
              <div class="flex gap-2">
                <input type="number" min="1" class="field font-mono" autocomplete="off"
                       [value]="manualId()" (input)="manualId.set(val($event))"
                       (keydown.enter)="submitManualId()" />
                <button type="button" class="btn btn-secondary shrink-0" (click)="submitManualId()">Use</button>
              </div>
            </label>

            @if (selected(); as set) {
              <h3 class="mt-4 text-lg">{{ set.title }}</h3>
              @if (set.description) {
                <p class="mt-1 text-sm whitespace-pre-wrap text-secondary">{{ set.description }}</p>
              }
              <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt class="text-secondary">Total questions</dt>
                <dd class="font-medium">{{ selectedTotals()?.questions ?? '—' }}</dd>
                <dt class="text-secondary">Total marks</dt>
                <dd class="font-medium">{{ selectedTotals()?.marks ?? '—' }}</dd>
                <dt class="text-secondary">Created at</dt>
                <dd>{{ formatDate(set.createdAt) }}</dd>
              </dl>
            } @else {
              <p class="mt-4 text-sm text-secondary">Pick a set from the list, or enter its id and press Use.</p>
            }
          </section>
        </div>
      }
    </div>
  `,
})
export class HostPage {
  private readonly api = inject(AssessmentApi);
  private readonly questionSets = inject(QuestionSetService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly canWrite = this.auth.canWrite;
  protected readonly profileStatus = this.auth.status;

  protected readonly checked = signal(false);
  protected readonly hosting = signal(false);
  protected readonly regenerating = signal(false);

  // form fields
  protected readonly code = signal('');
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly duration = signal('180');
  protected readonly startAt = signal('');
  protected readonly endAt = signal('');
  protected readonly maxStudents = signal('100');
  private endDirty = false;

  // question set picker
  protected readonly sets = signal<QuestionSetDto[]>([]);
  protected readonly setsTotal = signal(0);
  protected readonly loadingSets = signal(false);
  protected readonly selectedId = signal<number | null>(null);
  protected readonly selected = signal<QuestionSetDto | null>(null);
  protected readonly selectedTotals = signal<{ questions: number; marks: number } | null>(null);
  protected readonly manualId = signal('');
  private page = 1;
  private readonly pageSize = 20;

  protected readonly val = (e: Event): string => (e.target as HTMLInputElement | HTMLTextAreaElement).value;

  constructor() {
    // Already hosting? -> straight to the live page (spec).
    this.api.reattach().pipe(takeUntilDestroyed()).subscribe({
      next: (host) => void this.router.navigateByUrl(`/assessment/live/${host.code}`, {replaceUrl: true}),
      error: () => this.checked.set(true), // 404 / offline -> show the form
    });

    this.startAt.set(toLocalInput(defaultStart()));
    this.syncEnd();
    this.refreshCode();
    this.loadSets();
  }

  // ---------- code / form ----------

  protected onCode(e: Event): void { this.code.set(this.val(e).trim().toLowerCase()); }

  protected onDuration(e: Event): void { this.duration.set(this.val(e)); this.syncEnd(); }
  protected onStart(e: Event): void { this.startAt.set(this.val(e)); this.syncEnd(); }
  protected onEnd(e: Event): void { this.endDirty = true; this.endAt.set(this.val(e)); }

  /** End time follows start + duration until the teacher edits it manually. */
  private syncEnd(): void {
    if (this.endDirty || !this.startAt()) return;
    const start = new Date(this.startAt()).getTime();
    const dur = Number(this.duration());
    if (!Number.isFinite(start) || !Number.isFinite(dur)) return;
    this.endAt.set(toLocalInput(new Date(start + dur * 60_000)));
  }

  protected refreshCode(): void {
    this.regenerating.set(true);
    this.api.nextCode().subscribe({
      next: (c) => { this.code.set(c.code); this.regenerating.set(false); },
      error: (err) => { this.regenerating.set(false); this.toast.show(apiError(err), 'error'); },
    });
  }

  // ---------- question sets ----------

  private loadSets(): void {
    if (this.loadingSets()) return;
    this.loadingSets.set(true);
    this.questionSets.list(this.page, this.pageSize).subscribe({
      next: (page) => {
        this.sets.update((cur) => (this.page === 1 ? page.content : [...cur, ...page.content]));
        this.setsTotal.set(page.totalElements);
        this.loadingSets.set(false);
        this.page += 1;
      },
      error: (err) => { this.loadingSets.set(false); this.toast.show(apiError(err), 'error'); },
    });
  }

  protected onListScroll(e: Event): void {
    const el = e.target as HTMLElement;
    if (el.scrollTop + el.clientHeight < el.scrollHeight - 64) return;
    if (this.sets().length < this.setsTotal() && !this.loadingSets()) this.loadSets();
  }

  protected selectSet(set: QuestionSetDto): void {
    this.selectedId.set(set.questionSetId);
    this.manualId.set(String(set.questionSetId));
    this.loadDetails(set.questionSetId);
  }

  protected submitManualId(): void {
    const raw = this.manualId().trim();
    const id = Number(raw);
    if (!raw || !Number.isInteger(id) || id < 1) {
      this.toast.show('Enter a numeric question set id.', 'warn');
      return;
    }
    this.selectedId.set(id);
    this.loadDetails(id);
  }

  private loadDetails(id: number): void {
    this.questionSets.get(id).subscribe({
      next: (dto) => { if (this.selectedId() === id) this.selected.set(dto); },
      error: (err) => {
        if (this.selectedId() === id) {
          this.selected.set(null);
          this.selectedTotals.set(null);
          this.toast.show(apiError(err), 'error');
        }
      },
    });
    this.questionSets.questions(id).subscribe({
      next: (json) => {
        if (this.selectedId() !== id) return;
        const qs = json.questions ?? [];
        this.selectedTotals.set({ questions: qs.length, marks: qs.reduce((sum, q) => sum + (q.marks ?? 0), 0) });
      },
      error: (err) => {
        if (this.selectedId() === id) {
          this.selectedTotals.set(null);
          this.toast.show(apiError(err), 'error');
        }
      },
    });
  }

  // ---------- host ----------

  protected host(): void {
    const problem = this.validate();
    if (problem) { this.toast.show(problem, 'warn'); return; }

    this.hosting.set(true);
    const dto: HostRequestDto = {
      assessmentCode: this.code(),
      questionSetId: this.selectedId()!,
      title: this.title().trim(),
      description: this.description().trim() || null,
      maxStudents: this.maxStudents().trim() === '' ? null : Number(this.maxStudents()),
      durationMin: Number(this.duration()),
      startAt: fromLocalInput(this.startAt()),
      endAt: fromLocalInput(this.endAt()),
      utc: browserUtcOffset(),
    };

    this.api.host(dto).subscribe({
      next: (res) => {
        this.toast.show(`Assessment hosted — code ${res.code}`, 'success');
        void this.router.navigateByUrl(`/assessment/live/${res.code}`, {replaceUrl: true});
      },
      error: (err) => {
        this.hosting.set(false);
        // A 409 usually means "already hosting" — reattach proves it either way.
        this.api.reattach().subscribe({
          next: (res2) => void this.router.navigateByUrl(`/assessment/live/${res2.code}`, {replaceUrl: true}),
          error: () => this.toast.show(apiError(err), 'error'),
        });
      },
    });
  }

  private validate(): string | null {
    if (!/^[a-z]{6}$/.test(this.code())) return 'The assessment code must be exactly 6 lowercase letters.';
    if (this.selectedId() == null) return 'Choose a question set for the assessment.';
    if (!this.title().trim()) return 'The assessment title is required.';
    const dur = Number(this.duration());
    if (!Number.isInteger(dur) || dur < 5 || dur > 720) return 'Duration must be between 5 and 720 minutes.';
    const cap = this.maxStudents().trim();
    if (cap !== '') {
      const n = Number(cap);
      if (!Number.isInteger(n) || n < 1 || n > 10000) return 'Max students must be between 1 and 10000.';
    }
    const start = new Date(this.startAt()).getTime();
    const end = new Date(this.endAt()).getTime();
    if (!Number.isFinite(start)) return 'Pick a start time.';
    if (start < Date.now() - 2000) return 'Start time cannot be in the past.';
    if (!Number.isFinite(end)) return 'Pick an end time.';
    if (end - start < dur * 60_000) return `End time must be at least ${dur} minutes after the start time.`;
    return null;
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }
}
