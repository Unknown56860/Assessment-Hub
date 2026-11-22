import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { formatCountdown } from '../assessment-time';
import { LiveEventFeed } from '../components/live-event-feed';
import { StudentEnquiryDialog } from '../components/student-enquiry-dialog';
import { STUDENT_STATUS_LABEL, STUDENT_STATUS_TEXT } from '../components/student-status';
import { TeacherLiveStore } from '../teacher-live.store';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog';

// const val = (e: Event): string => (e.target as HTMLInputElement).value;

@Component({
  selector: 'app-teacher-live-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TeacherLiveStore],
  imports: [ConfirmDialog, LiveEventFeed, StudentEnquiryDialog],
  template: `
    <div class="page-container py-8">
      @if (!store.meta()) {
        <p class="text-sm text-secondary">Loading live assessment…</p>
      } @else {
        <!-- Header: title + question set (left), end button (right) -->
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <h1 class="truncate">{{ store.meta()!.title }}</h1>
            <p class="mt-1 truncate text-sm text-secondary">
              Question set:
              <span class="font-medium text-text">{{ store.questionSetTitle() ?? ('#' + store.meta()!.questionSetId) }}</span>
            </p>
          </div>
          <button type="button" class="btn btn-danger shrink-0" (click)="confirmingEnd.set(true)">End assessment</button>
        </div>

        <p class="mt-2 text-sm text-secondary">
          Total questions: {{ store.questionTotals()?.questions ?? '—' }} ·
          Total marks: {{ store.questionTotals()?.marks ?? '—' }}
        </p>

        @if (store.reconnecting()) {
          <div class="mt-4 rounded-sm border border-warning bg-warning-bg p-3 text-sm" role="status">
            Connection lost — reconnecting…
          </div>
        }

        <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div class="flex min-w-0 flex-col gap-5">
            <!-- Big assessment code -->
            <div class="rounded-sm border border-border bg-surface p-5 text-center">
              <p class="text-xs font-medium tracking-wide text-secondary uppercase">Assessment code</p>
              <button type="button" class="mt-1 font-mono text-3xl font-bold tracking-widest hover:text-primary"
                      title="Click to copy" (click)="store.copyCode()">{{ store.code() }}</button>
            </div>

            <div class="grid gap-5 sm:grid-cols-2">
              <div class="rounded-sm border border-border bg-surface p-4">
                <p class="text-xs font-medium tracking-wide text-secondary uppercase">Duration</p>
                <p class="mt-1 font-semibold">{{ store.meta()!.durationMin }} minutes</p>
              </div>
              <div class="rounded-sm border border-border bg-surface p-4">
                <p class="text-xs font-medium tracking-wide text-secondary uppercase">Schedule</p>
                <p class="mt-1 font-semibold" [class]="timerClass()">{{ timerText() }}</p>
              </div>
            </div>

            <!-- Time extension -->
            <section class="rounded-sm border border-border bg-surface p-5">
              <h2 class="text-lg">Time extension</h2>
              <div class="mt-3 flex gap-2">
                <input type="number" min="1" max="180" class="field" aria-label="Minutes to extend"
                       [value]="extendMinutes()" (input)="extendMinutes.set(val($event))" />
                <button type="button" class="btn btn-success shrink-0" (click)="submitExtend()">Extend</button>
              </div>
              <p class="mt-1 text-xs text-muted">Added to the current end time. Default 10 minutes, maximum 180.</p>
            </section>

            <!-- Live stats -->
            <section class="rounded-sm border border-border bg-surface p-5">
              <h2 class="text-lg">Live stats</h2>
              <ul class="mt-3 space-y-1 text-sm">
                <li>Assessment completed: <span class="font-semibold">{{ store.completedCount() }}</span></li>
                <li>Students attempting:
                  <span class="font-semibold">{{ store.counts().connected }}/{{ store.counts().total }}</span>
                </li>
                <li>Total students:
                  <span class="font-semibold">{{ store.counts().total }}/{{ store.cap() }}</span>
                </li>
              </ul>
            </section>

            <!-- Enquiry -->
            <section class="rounded-sm border border-border bg-surface p-5">
              <h2 class="text-lg">Student enquiry</h2>
              <div class="mt-3 flex gap-2">
                <input type="text" class="field font-mono" placeholder="Roll number" autocomplete="off" spellcheck="false"
                       [value]="enquiryRoll()" (input)="enquiryRoll.set(val($event))" (keydown.enter)="enquire()" />
                <button type="button" class="btn btn-primary shrink-0" (click)="enquire()">Enquire</button>
              </div>
            </section>
          </div>

          <!-- Live events (YouTube-chat style) -->
          <app-live-event-feed class="block h-96 lg:h-full" [events]="store.events()" />
        </div>

        <!-- Students: free-floating chips, 1..n per row -->
        <section class="mt-6 rounded-sm border border-border bg-surface p-5">
          <div class="flex items-center justify-between gap-4">
            <h2 class="text-lg">Students</h2>
            <span class="text-sm text-secondary">{{ store.counts().total }} joined</span>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            @for (student of store.students(); track student.roll) {
              <button type="button"
                      class="rounded-sm border border-border bg-surface px-3 py-2 text-sm transition-colors hover:bg-hover"
                      (click)="store.enquiryRoll.set(student.roll)"
                      [attr.aria-label]="student.roll + ' — ' + STUDENT_STATUS_LABEL[student.status]">
                <span class="text-muted">{{ $index + 1 }}.</span>
                <span class="ml-1 font-mono font-medium" [class]="STUDENT_STATUS_TEXT[student.status]">{{ student.roll }}</span>
                <span class="ml-2 font-medium" [class]="STUDENT_STATUS_TEXT[student.status]">{{ student.name }}</span>
                <span class="sr-only"> — {{ STUDENT_STATUS_LABEL[student.status] }}</span>
              </button>
            } @empty {
              <p class="text-sm text-secondary">No students have joined yet.</p>
            }
          </div>
        </section>
      }
    </div>

    @if (confirmingEnd()) {
      <app-confirm-dialog title="End assessment?" [message]="endMessage()" confirmLabel="End now"
                          (confirm)="endConfirmed()" (cancel)="confirmingEnd.set(false)" />
    }

    @if (store.enquiryStudent(); as student) {
      <app-student-enquiry-dialog [student]="student" [busy]="store.busyRoll() === student.roll"
                                  (kick)="store.kick($event)" (unkick)="store.unkick($event)"
                                  (close)="store.closeEnquiry()" />
    }
  `,
})
export class TeacherLivePage {
  protected readonly store = inject(TeacherLiveStore);
  private readonly route = inject(ActivatedRoute);

  protected readonly confirmingEnd = signal(false);
  protected readonly extendMinutes = signal('10');
  protected readonly enquiryRoll = signal('');

  protected readonly STUDENT_STATUS_LABEL = STUDENT_STATUS_LABEL;
  protected readonly STUDENT_STATUS_TEXT = STUDENT_STATUS_TEXT;

  protected readonly val = (e: Event): string => (e.target as HTMLInputElement).value;

  protected readonly timerText = computed(() => {
    switch (this.store.phase()) {
      case 'SCHEDULED': return `Starting in ${formatCountdown(this.store.startsInMs())}`;
      case 'LIVE': return `Ending in ${formatCountdown(this.store.endsInMs())}`;
      default: return 'Ended';
    }
  });

  protected readonly timerClass = computed(() =>
    this.store.phase() === 'SCHEDULED' ? 'text-success-strong' : 'text-error-strong');

  protected readonly endMessage = computed(() =>
    this.store.phase() === 'SCHEDULED'
      ? 'The assessment has not started yet — this will cancel it. Students will not be able to join afterwards.'
      : 'This ends the assessment immediately. Connected students are finalized and the results are archived.');

  constructor() {
    void this.store.load(this.route.snapshot.paramMap.get('code') ?? '');
  }

  protected submitExtend(): void { this.store.extend(Number(this.extendMinutes())); }

  protected enquire(): void { this.store.enquire(this.enquiryRoll()); }

  protected endConfirmed(): void {
    this.confirmingEnd.set(false);
    this.store.endNow();
  }
}
