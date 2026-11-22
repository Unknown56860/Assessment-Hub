import { Component, ChangeDetectionStrategy, inject, signal, computed } from "@angular/core";
import { Router } from "@angular/router";
import { ToastService } from "../../../core/services/toast.service";
import { OverReason } from "../assessment.dto";
import { StudentSession, StudentIdentity } from "../student-session";

type OverCopy = { title: string; message: string; tone: 'success' | 'info' | 'warning' | 'error'; allowRejoin: boolean };

const OVER_COPY: Record<OverReason, OverCopy> = {
  SUBMITTED: {
    title: 'Assessment submitted',
    message: 'Your answers were submitted successfully. You can safely close this page.',
    tone: 'success', allowRejoin: false,
  },
  ENDED: {
    title: 'Assessment ended',
    message: 'The assessment was ended by your teacher and your answers were saved. You can close this page.',
    tone: 'info', allowRejoin: false,
  },
  TIME_OVER: {
    title: 'Time is over',
    message: 'The time for this assessment ran out and your answers were submitted automatically. You can close this page.',
    tone: 'info', allowRejoin: false,
  },
  KICKED: {
    title: 'Removed from the assessment',
    message: 'You were removed from this assessment by the teacher. If this was a mistake, ask your teacher to readmit you — or join again below.',
    tone: 'error', allowRejoin: true,
  },
  DISCONNECTED: {
    title: 'Disconnected',
    message: 'You lost connection and could not rejoin in time. Your saved answers have been recorded. You can try rejoining, or contact your teacher if this was unexpected.',
    tone: 'warning', allowRejoin: true,
  },
};

@Component({
  selector: 'app-over-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-container flex min-h-dvh items-center justify-center py-10">
      @if (identity(); as student) {
        <div class="w-full max-w-md rounded-sm border border-border bg-surface p-8 text-center">
          @if (copy(); as c) {
            <div class="mx-auto grid h-12 w-12 place-items-center rounded-full text-xl font-bold" [class]="iconClass()">
              {{ c.tone === 'success' ? '✓' : c.tone === 'error' ? '✕' : c.tone === 'warning' ? '!' : 'i' }}
            </div>
            <h1 class="mt-4">{{ c.title }}</h1>
            <p class="mt-2 text-sm text-secondary">{{ c.message }}</p>
            @if (c.allowRejoin) {
              <button type="button" class="btn btn-primary mt-6" (click)="rejoin()">
                {{ c.tone === 'error' ? 'Join again' : 'Try rejoining' }}
              </button>
            }
          } @else {
            <h1>Assessment over</h1>
            <p class="mt-2 text-sm text-secondary">You are not part of an active assessment.</p>
            <button type="button" class="btn btn-primary mt-6" (click)="goJoin()">Go to join page</button>
          }
          <p class="mt-6 font-mono text-xs text-muted">{{ student.roll }} · {{ student.name }}</p>
        </div>
      }
    </div>
  `,
})
export class OverPage {
  private readonly session = inject(StudentSession);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly identity = signal<StudentIdentity | null>(null);
  protected readonly reason = signal<OverReason | null>(null);

  protected readonly copy = computed(() => {
    const reason = this.reason();
    return reason ? OVER_COPY[reason] : null;
  });

  constructor() {
    const identity = this.session.current();
    if (!identity) {
      void this.router.navigateByUrl('/assessment/join');
      return;
    }
    this.identity.set(identity);
    this.reason.set(this.session.overReason(identity.code, identity.roll));
  }

  protected iconClass(): string {
    const tone = this.copy()?.tone;
    return tone === 'success' ? 'bg-success-bg text-success-strong'
      : tone === 'error' ? 'bg-error-bg text-error-strong'
      : tone === 'warning' ? 'bg-warning-bg text-warning-strong'
      : 'bg-info-bg text-info-strong';
  }

  /** KICKED: drop the token so the next join counts as a new device (backend rule).
   *  DISCONNECTED: keep the token — a matching token resumes the roll. */
  protected rejoin(): void {
    const student = this.identity();
    const reason = this.reason();
    if (!student) return;
    if (reason === 'KICKED') this.session.clearToken(student.code, student.roll);
    void this.router.navigateByUrl('/assessment/join');
  }

  protected goJoin(): void { void this.router.navigateByUrl('/assessment/join'); }
}
