import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiError, AssessmentApi } from './assessment.api';  
import {
  AssessmentStatus, EventLogDto, HostResponseDto, RemainingDto,
  StudentListDto, StudentRowDto, TeacherEventDto, TeacherSnapshotDto,
} from './assessment.dto';
import { LiveSocket, TransportClose } from './live-socket';
import { serverSkew } from './assessment-time';
import { ToastService } from '../../core/services/toast.service';
import { QuestionSetService } from '../question/question-set.api';

const EVENT_LOG_CAP = 250; // mirrors Constants.EVENT_LOG_CAP

/** Route-scoped state for the teacher live page — provided in the page component. */
@Injectable()
export class TeacherLiveStore {
  private readonly api = inject(AssessmentApi);
  private readonly questionSets = inject(QuestionSetService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly meta = signal<HostResponseDto | null>(null);
  readonly status = signal<AssessmentStatus | null>(null);
  readonly endTs = signal(0);
  readonly skew = signal(0);          // serverNow - clientNow (set from snapshot / remaining pushes)
  readonly now = signal(Date.now());  // 1s tick
  readonly students = signal<StudentRowDto[]>([]);
  readonly counts = signal({ connected: 0, submitted: 0, kicked: 0, total: 0 });
  readonly events = signal<EventLogDto[]>([]);
  readonly enquiryRoll = signal<string | null>(null);
  readonly busyRoll = signal<string | null>(null);
  readonly reconnecting = signal(false);
  readonly questionSetTitle = signal<string | null>(null);
  readonly questionTotals = signal<{ questions: number; marks: number } | null>(null);

  readonly code = computed(() => this.meta()?.code ?? '');
  readonly cap = computed(() => this.meta()?.maxStudents ?? 0);
  readonly enquiryStudent = computed(() => {
    const roll = this.enquiryRoll();
    return roll ? this.students().find((s) => s.roll === roll) ?? null : null;
  });
  /** Spec: completed = submitted OR timer ran out for them. */
  readonly completedCount = computed(() => {
    const timeOver = this.students().filter((s) => s.status === 'TIME_OVER').length;
    return this.counts().submitted + timeOver;
  });
  readonly phase = computed<'SCHEDULED' | 'LIVE' | 'ENDED'>(() => {
    const s = this.status();
    if (s === 'LIVE') return 'LIVE';
    if (s === 'SCHEDULED') return 'SCHEDULED';
    return 'ENDED'; // null / ENDED / FLUSHING / FAILED all read as "over"
  });
  readonly serverNow = computed(() => this.now() + this.skew());
  readonly endsInMs = computed(() => this.endTs() - this.serverNow());
  readonly startsInMs = computed(() => (this.meta()?.startTs ?? 0) - this.serverNow());

  private socket?: LiveSocket;
  private readonly seenEvents = new Set<string>();
  private disposed = false;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private homeTimer?: ReturnType<typeof setTimeout>;
  private watchdog?: ReturnType<typeof setTimeout>;

  private loadInFlight = false;
  private urlCode = '';

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => {
      this.disposed = true;
      clearInterval(timer);
      clearTimeout(this.reconnectTimer);
      clearTimeout(this.homeTimer);
      clearTimeout(this.watchdog);
      this.socket?.disconnect();
    });
  }

  async load(urlCode: string): Promise<void> {
    if (this.meta() || this.loadInFlight) return;
    this.loadInFlight = true;
    this.urlCode = urlCode;
    try {
      const host = await firstValueFrom(this.api.reattach());
      if (this.disposed) return;
      if (host.code !== urlCode) {
        // URL says one code, Redis says another — follow the truth (cannot loop).
        void this.router.navigateByUrl(`/assessment/live/${host.code}`, { replaceUrl: true });
        return;
      }
      this.meta.set(host);
      this.endTs.set(host.endTs);
      this.connect();
      this.loadQuestionSet(host.questionSetId);
    } catch (err) {
      // 404 = no longer hosting — the ONE safe bounce (host page will then show the form).
      if ((err as HttpErrorResponse).status === 404) return this.goHome();
      // Transient failure: stay on the page and retry — bouncing would loop right back here.
      this.toast.show(apiError(err), 'error');
      this.scheduleReattachRetry();
    } finally {
      this.loadInFlight = false;
    }
  }

  /** Shared retry path for dropped sockets, failed reattach, and the init watchdog. */
  private scheduleReattachRetry(): void {
  if (this.disposed) return;
    this.reconnecting.set(true);
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => void this.reattachAndReconnect(), 3000);
  }

  private async reattachAndReconnect(): Promise<void> {
  if (this.disposed) return;
  try {
    const host = await firstValueFrom(this.api.reattach());
    if (this.disposed) return;
      this.meta.set(host);
      this.endTs.set(host.endTs);
      this.reconnecting.set(false);
      this.connect();
    } catch (err) {
      if ((err as HttpErrorResponse).status === 404) return this.goHome();
      this.scheduleReattachRetry();
    }
  }

  private onClose(close: TransportClose): void {
    if (this.disposed) return;
    // Server closes teacher sockets with 1000 "ENDED" only after the flush commits
    // (purge runs first, so reattach is already 404 by then). `status()` may still be
    // null before the first snapshot — that must NOT read as "ended".
    if (close.code === 1000 || this.status() === 'ENDED') return this.goHome();
    this.scheduleReattachRetry();
  }

  // ---------- commands ----------

  kick(roll: string): void { this.command('kick', { roll }, roll); }
  unkick(roll: string): void { this.command('unkick', { roll }, roll); }
  endNow(): void { this.command('end', {}); }

  extend(minutes: number): void {
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
      this.toast.show('Extension must be between 1 and 180 minutes.', 'warn');
      return;
    }
    this.command('extend', { minutes });
  }

  enquire(roll: string): void {
    const trimmed = roll.trim();
    const found = this.students().find((s) => s.roll.toLowerCase() === trimmed.toLowerCase());
    if (found) this.enquiryRoll.set(found.roll);
    else this.toast.show(`No student with roll “${trimmed}”.`, 'warn');
  }

  closeEnquiry(): void { this.enquiryRoll.set(null); }

  copyCode(): void {
    const code = this.code();
    if (!code) return;
    navigator.clipboard?.writeText(code).then(
      () => this.toast.show('Assessment code copied.', 'success'),
      () => this.toast.show('Could not copy the code.', 'error'),
    );
  }

  // ---------- socket plumbing ----------

  private command(suffix: string, body: unknown, busyRoll?: string): void {
    const socket = this.socket;
    if (!socket || socket.state() !== 'OPEN') {
      this.toast.show('Not connected to the live session — retrying shortly.', 'warn');
      return;
    }
    if (busyRoll) this.busyRoll.set(busyRoll);
    socket.publish(`/app/live/${this.code()}/${suffix}`, body);
  }

  private loadQuestionSet(questionSetId: number): void {
    this.questionSets.get(questionSetId).subscribe({
      next: (dto) => this.questionSetTitle.set(dto.title),
      error: () => this.questionSetTitle.set(null),
    });
    this.questionSets.questions(questionSetId).subscribe({
      next: (json) => {
        const qs = json.questions ?? [];
        this.questionTotals.set({ questions: qs.length, marks: qs.reduce((sum, q) => sum + (q.marks ?? 0), 0) });
      },
      error: () => this.questionTotals.set(null),
    });
  }

  private connect(): void {
    const meta = this.meta();
    if (!meta || this.disposed) return;
    this.socket?.disconnect();
    const socket = new LiveSocket('live', meta.code, meta.hostJwt, {
      onTransportClose: (close) => this.onClose(close),
      onStompError: (_headers, body) => this.toast.show(body || 'Live connection error.', 'error'),
    });
    this.socket = socket;
    socket.subscribe(`/app/live/${meta.code}/init`, (m) => this.onSnapshot(m as TeacherSnapshotDto | null));
    socket.subscribe(`/topic/live/${meta.code}`, (m) => this.onTopic(m));
    // Receives the fresh endTs after the host extends time (backend addition this batch).
    socket.subscribe(`/user/queue/live/${meta.code}`, (m) => this.onRemaining(m as RemainingDto));
    socket.connect();

    clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => {
        if (this.disposed || this.status() !== null) return;
        this.toast.show('Live connection could not be established — retrying…', 'warn');
        this.scheduleReattachRetry();
    }, 6000);
  }

  private onSnapshot(snapshot: TeacherSnapshotDto | null): void {
    if (!snapshot || !Array.isArray(snapshot.students)) return;
      this.skew.set(serverSkew(snapshot.serverTs));
      this.status.set(snapshot.status);
      this.endTs.set(snapshot.endTs);
      this.students.set(snapshot.students);
      this.counts.set({
        connected: snapshot.connected, submitted: snapshot.submitted,
        kicked: snapshot.kicked, total: snapshot.total,
      });
      this.seenEvents.clear();
      this.events.set(snapshot.events);
      for (const e of snapshot.events) this.seenEvents.add(this.eventKey(e));
  }

  private onTopic(message: unknown): void {
    if (!message || typeof message !== 'object') return;
    if ((message as StudentListDto).type === 'STUDENTS') {
      const list = message as StudentListDto;
      this.students.set(list.students);
      this.counts.set({
        connected: list.connected, submitted: list.submitted, kicked: list.kicked, total: list.total,
      });
      this.busyRoll.set(null);
      return;
    }
    const event = message as TeacherEventDto;
    this.appendEvent({ ts: event.ts, type: event.type, message: event.message, roll: event.roll });
    if (event.type === 'ERROR') this.busyRoll.set(null);
    switch (event.type) {
      case 'STARTED':
        this.status.set('LIVE');
        this.toast.show('Assessment started.', 'success');
        break;
      case 'EXTENDED':
        this.toast.show(event.message + '.', 'info');
        break;
      case 'ENDED':
        this.status.set('ENDED');
        this.toast.show('Assessment ended. Redirecting…', 'info');
        this.scheduleHome(4000); // close(1000) usually arrives first — this is the fallback
        break;
      case 'ERROR':
        this.toast.show(event.message, 'error');
        break;
    }
  }

  private onRemaining(message: RemainingDto): void {
    if (!message || message.type !== 'REMAINING') return;
    this.endTs.set(message.endTs);
    this.skew.set(serverSkew(message.serverTs));
  }

  private appendEvent(event: EventLogDto): void {
    const key = this.eventKey(event);
    if (this.seenEvents.has(key)) return;
    this.seenEvents.add(key);
    this.events.update((cur) => [...cur, event].slice(-EVENT_LOG_CAP));
  }

  private eventKey(event: { ts: number; type: string; message: string }): string {
    return `${event.ts}|${event.type}|${event.message}`;
  }

  private scheduleHome(delayMs: number): void {
    clearTimeout(this.homeTimer);
    this.homeTimer = setTimeout(() => this.goHome(), delayMs);
  }

  private goHome(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.socket?.disconnect();
    void this.router.navigateByUrl('/assessment/host');
  }
}
