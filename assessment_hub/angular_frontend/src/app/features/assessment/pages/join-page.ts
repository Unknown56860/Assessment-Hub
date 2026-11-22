import { Component, ChangeDetectionStrategy, inject, DestroyRef, signal, computed } from "@angular/core";
import { Router } from "@angular/router";
import { ToastService } from "../../../core/services/toast.service";
import { formatCountdown, serverSkew } from "../assessment-time";
import { AssessmentApi, apiError } from "../assessment.api";
import { JoinRequestDto } from "../assessment.dto";
import { StudentSession } from "../student-session";

// const val = (e: Event): string => (e.target as HTMLInputElement).value;

@Component({
  selector: 'app-join-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-container flex min-h-[70vh] items-center justify-center py-10">
      <div class="w-full max-w-md rounded-sm border border-border bg-surface p-6 sm:p-8">
        <h1>Join assessment</h1>
        <p class="mt-1 text-sm text-secondary">Enter the code from your teacher. No account needed.</p>

        <label class="mt-5 block">
          <span class="mb-1 block text-sm font-medium">Assessment code</span>
          <input type="text" class="field font-mono tracking-widest" maxlength="6" autocomplete="off"
                 spellcheck="false" placeholder="abcdef" [value]="code()" (input)="code.set(val($event).trim().toLowerCase())" />
        </label>
        <label class="mt-4 block">
          <span class="mb-1 block text-sm font-medium">Roll number</span>
          <input type="text" class="field font-mono" maxlength="64" autocomplete="off" spellcheck="false"
                 placeholder="23cseds001" [value]="roll()" (input)="roll.set(val($event).trim())" />
        </label>
        <label class="mt-4 block">
          <span class="mb-1 block text-sm font-medium">Full name</span>
          <input type="text" class="field" maxlength="100" autocomplete="name"
                 [value]="name()" (input)="name.set(val($event).trim())" />
        </label>

        <button type="button" class="btn btn-primary mt-6 w-full" [disabled]="busy()" (click)="join()">
          {{ busy() ? 'Joining…' : 'Join assessment' }}
        </button>

        @if (waitRemainingMs() !== null) {
          <p class="mt-3 text-center text-sm text-secondary" role="status">
            @if ((waitRemainingMs() ?? 0) > 0) {
              Starts in <span class="font-mono font-semibold text-text">{{ formatCountdown(waitRemainingMs()!) }}</span>
              — you will join automatically.
            } @else {
              Starting…
            }
          </p>
        }
      </div>
    </div>
  `,
})
export class JoinPage {
  private readonly api = inject(AssessmentApi);
  private readonly session = inject(StudentSession);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly code = signal('');
  protected readonly roll = signal('');
  protected readonly name = signal('');
  protected readonly busy = signal(false);
  protected readonly now = signal(Date.now());

  protected readonly formatCountdown = formatCountdown;

  protected readonly val = (e: Event): string => (e.target as HTMLInputElement).value;

  private readonly waitStartTs = signal<number | null>(null);
  private waitSkew = 0;

  protected readonly waitRemainingMs = computed(() => {
    const startTs = this.waitStartTs();
    return startTs == null ? null : Math.max(0, startTs - (this.now() + this.waitSkew));
  });

  constructor() {
    const ticker = setInterval(() => {
      this.now.set(Date.now());
      // Auto-join when the countdown runs out; a fresh WAIT response simply resets it.
      if (!this.busy() && this.waitStartTs() !== null && (this.waitRemainingMs() ?? 1) <= 0) this.join();
    }, 1000);
    this.destroyRef.onDestroy(() => clearInterval(ticker));
  }

  protected join(): void {
    if (this.busy()) return;
    const problem = this.validate();
    if (problem) { this.toast.show(problem, 'warn'); return; }

    this.busy.set(true);
    const dto: JoinRequestDto = {
      code: this.code().trim().toLowerCase(),
      roll: this.roll().trim(),
      name: this.name().trim(),
    };
    this.api.join(dto).subscribe({
      next: (outcome) => {
        this.busy.set(false);
        if (outcome.kind === 'JOINED') {
          const data = outcome.data;
          this.session.setCurrent({ code: data.code, roll: data.roll, name: data.name });
          this.session.saveToken(data.code, data.roll, data.jwt);
          this.toast.show(data.rejoin ? 'Welcome back — resuming your assessment.' : `Joined as ${data.name}.`, 'success');
          void this.router.navigateByUrl(`/assessment/exam/${data.code}`);
        } else {
          // HTTP 202 — SCHEDULED. Toast + live countdown under the button (spec #06).
          this.waitSkew = serverSkew(outcome.data.serverTs);
          this.waitStartTs.set(outcome.data.startTs);
          this.toast.show('The assessment has not started yet.', 'info');
        }
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.show(apiError(err), 'error');
      },
    });
  }

  private validate(): string | null {
    if (!/^[a-z]{6}$/.test(this.code().trim().toLowerCase())) return 'The assessment code must be exactly 6 letters.';
    const roll = this.roll().trim();
    if (!roll || roll.length > 64 || !/^[A-Za-z0-9._\-]+$/.test(roll)) return 'Enter a valid roll number.';
    const name = this.name().trim();
    if (!name || name.length > 100) return 'Enter your name.';
    return null;
  }
}
