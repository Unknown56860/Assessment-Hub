import { Injectable, inject, DestroyRef, signal, computed } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { ToastService } from "../../core/services/toast.service";
import { Question, QuestionsJson } from "../question/question-set.models";
import { serverSkew } from "./assessment-time";
import { AssessmentApi } from "./assessment.api";
import { StudentInitDto, OverReason, RemainingDto, SaveAckDto, ViolationKind } from "./assessment.dto";
import { LiveSocket, TransportClose } from "./live-socket";
import { StudentSession, StudentIdentity } from "./student-session";
import { ViolationMonitor } from "./violation-monitor";

export type AnswerValue = string[] | string;
export type SaveState = 'saving' | 'error';

/** mcq/fb: at least one non-empty entry; qa: non-empty text. */
export function isAttempted(answer: AnswerValue | undefined): boolean {
  if (answer == null) return false;
  if (typeof answer === 'string') return answer.trim().length > 0;
  return answer.some((v) => v.trim().length > 0);
}

function normalizeAnswer(value: unknown): AnswerValue {
  if (Array.isArray(value)) return value.map(String);
  return value == null ? '' : String(value);
}

/** Route-scoped state for the student exam page — provided in the page component. */
@Injectable()
export class StudentExamStore {
  private readonly api = inject(AssessmentApi);
  private readonly session = inject(StudentSession);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly monitor = inject(ViolationMonitor);
  private readonly destroyRef = inject(DestroyRef);

  readonly identity = signal<StudentIdentity | null>(null);
  readonly init = signal<StudentInitDto | null>(null);
  readonly questions = signal<Question[]>([]);
  readonly answers = signal<Record<number, AnswerValue>>({});
  readonly saveState = signal<Record<number, SaveState>>({});
  readonly marked = signal<ReadonlySet<number>>(new Set());
  readonly current = signal(0);
  readonly connection = signal<'connecting' | 'online' | 'offline'>('connecting');
  readonly lastSyncedAt = signal<number | null>(null);
  readonly submitting = signal(false);
  readonly now = signal(Date.now());

  readonly endTs = computed(() => this.init()?.endTs ?? 0);
  readonly durationMs = computed(() => (this.init()?.durationMin ?? 0) * 60_000);
  readonly remainingMs = computed(() => Math.max(0, this.endTs() - (this.now() + this.skew())));
  readonly totalQuestions = computed(() => this.questions().length);
  readonly totalMarks = computed(() => this.questions().reduce((sum, q) => sum + (q.marks ?? 0), 0));
  readonly answeredCount = computed(() => {
    const answers = this.answers();
    return this.questions().filter((q) => isAttempted(answers[q.id])).length;
  });

  private skew = signal(0);
  private socket?: LiveSocket;
  private code = '';
  private token = '';
  private identityData?: StudentIdentity;
  private overReason: OverReason | null = null;
  private disposed = false;
  private lastServerReply = Date.now();
  private rejoins = 0;
  private readonly saveTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private heartbeatTimer?: ReturnType<typeof setTimeout> | undefined;
  private closeTimer?: ReturnType<typeof setTimeout>;
  private rejoinTimer?: ReturnType<typeof setTimeout>;

  async start(identity: StudentIdentity): Promise<void> {
    if (this.identityData) return;
    this.identityData = identity;
    this.code = identity.code;
    this.identity.set(identity);
    this.token = this.session.token(identity.code, identity.roll) ?? '';
    this.marked.set(new Set(this.session.markedIds(identity.code, identity.roll)));

    const ticker = setInterval(() => this.now.set(Date.now()), 1000);
    this.heartbeatTimer = setInterval(() => this.beat(), 5000);

    this.destroyRef.onDestroy(() => {
      this.disposeEverything();
      clearInterval(ticker);
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    });

    // Fullscreen + integrity detection. If the browser refuses (no fresh gesture),
    // the page's overlay catches it and requests on click.
    this.monitor.start((kind) => this.onViolation(kind));
    this.connect();
  }

  // ---------- answers ----------

  setMcq(questionId: number, optionIds: string[]): void { this.setAnswer(questionId, [...optionIds]); }
  setFb(questionId: number, values: string[]): void { this.setAnswer(questionId, [...values]); }
  setQa(questionId: number, text: string): void { this.setAnswer(questionId, text); }

  private setAnswer(questionId: number, value: AnswerValue): void {
    this.answers.update((cur) => ({ ...cur, [questionId]: value }));
    clearTimeout(this.saveTimers.get(questionId));
    this.saveTimers.set(questionId, setTimeout(() => this.flushSave(questionId), 600));
  }

  private flushSave(questionId: number): void {
    const socket = this.socket;
    if (!socket || socket.state() !== 'OPEN') {
      this.saveState.update((cur) => ({ ...cur, [questionId]: 'error' }));
      return;
    }
    this.saveState.update((cur) => ({ ...cur, [questionId]: 'saving' }));
    socket.publish(`/app/assessment/${this.code}/save`, { questionId, answer: this.answers()[questionId] });
  }

  toggleMark(questionId: number): void {
    this.marked.update((cur) => {
      const next = new Set(cur);
      if (next.has(questionId)) next.delete(questionId); else next.add(questionId);
      return next;
    });
    const id = this.identityData;
    if (id) this.session.saveMarkedIds(id.code, id.roll, [...this.marked()]);
  }

  // ---------- navigation ----------

  goTo(index: number): void {
    if (index >= 0 && index < this.totalQuestions()) this.current.set(index);
  }
  next(): void { this.goTo(this.current() + 1); }
  previous(): void { this.goTo(this.current() - 1); }

  // ---------- submit ----------

  submit(): void {
    if (this.submitting() || this.overReason) return;
    this.submitting.set(true);
    const socket = this.socket;
    if (socket && socket.state() === 'OPEN') {
      socket.publish(`/app/assessment/${this.code}/submit`, {});
    }
    // The server closes our socket with 4003; this is the fallback if the close is missed.
    this.closeTimer = setTimeout(() => this.finish('SUBMITTED'), 2500);
  }

  // ---------- socket plumbing ----------

  private connect(): void {
    if (this.disposed || !this.token) return;
    this.socket?.disconnect();
    this.connection.set('connecting');
    const socket = new LiveSocket('assessment', this.code, this.token, {
      onTransportClose: (close) => this.onClose(close),
      onStompError: (_h, body) => this.toast.show(body || 'Connection error.', 'error'),
    });
    this.socket = socket;
    socket.subscribe(`/app/assessment/${this.code}/init`, (m) => this.onInit(m as StudentInitDto | null));
    socket.subscribe(`/topic/assessment/${this.code}`, (m) => this.onBroadcast(m));
    socket.subscribe(`/user/queue/assessment/${this.code}`, (m) => this.applyRemaining(m as RemainingDto));
    socket.subscribe('/user/queue/assessment/ack', (m) => this.onAck(m as SaveAckDto));
    socket.connect();
  }

  private onInit(payload: StudentInitDto | null): void {
    if (!payload || !payload.questions) {
      this.toast.show('Could not load the assessment.', 'error');
      return;
    }
    this.skew.set(serverSkew(payload.serverTs));
    this.init.set(payload);
    try {
      this.questions.set((JSON.parse(payload.questions) as QuestionsJson).questions ?? []);
    } catch {
      this.toast.show('The assessment questions could not be read.', 'error');
      return;
    }
    // Server-truth restore — covers refresh and post-rejoin recovery.
    const restored: Record<number, AnswerValue> = {};
    for (const [qid, value] of Object.entries(payload.savedAnswers ?? {})) {
      const id = Number(qid);
      if (Number.isFinite(id)) restored[id] = normalizeAnswer(value);
    }
    this.answers.set(restored);
    this.saveState.set({});
    this.current.set(0);
    this.markOnline();
    this.lastSyncedAt.set(Date.now());
  }

  private onBroadcast(message: unknown): void {
    const msg = message as { type?: string } | null;
    if (!msg?.type) return;
    if (msg.type === 'REMAINING') this.applyRemaining(message as RemainingDto);
    if (msg.type === 'ENDED') this.finish('ENDED');
  }

  /** Heartbeat replies and post-extension updates — the clock-sync backbone. */
  private applyRemaining(message: RemainingDto): void {
    if (!message || message.type !== 'REMAINING') return;
    this.skew.set(serverSkew(message.serverTs));
    this.init.update((cur) => (cur ? { ...cur, endTs: message.endTs } : cur));
    this.lastSyncedAt.set(Date.now());
    this.markOnline();
  }

  private onAck(ack: SaveAckDto): void {
    this.markOnline();
    if (!ack || typeof ack.questionId !== 'number') return;
    if (ack.saved) {
      this.lastSyncedAt.set(ack.serverTs);
      this.saveState.update((cur) => {
        const next = { ...cur };
        delete next[ack.questionId];
        return next;
      });
      this.toast.show('Saved', 'success'); // per-save feedback per spec — drop this line to quiet it down
    } else {
      this.saveState.update((cur) => ({ ...cur, [ack.questionId]: 'error' }));
      this.toast.show('Your answer could not be saved — the assessment may be over.', 'error');
    }
  }

  private beat(): void {
    const socket = this.socket;
    if (!socket || socket.state() !== 'OPEN') return;
    socket.publish(`/app/assessment/${this.code}/heartbeat`, {});
    // No reply for ~2 beats -> network problem warning (spec #03). Teacher-side visibility
    // comes free: SessionTracker logs DISCONNECTED on socket loss.
    if (this.connection() === 'online' && Date.now() - this.lastServerReply > 12_000) {
      this.markOffline();
    }
  }

  private markOffline(): void {
    if (this.connection() === 'offline') return;
    this.connection.set('offline');
    this.toast.show('You appear to be offline — your answers may not be saved.', 'warn');
  }

  private markOnline(): void {
    this.lastServerReply = Date.now();
    if (this.connection() !== 'online') {
      this.connection.set('online');
      this.toast.show('Back online.', 'success');
    }
  }

  private onViolation(kind: ViolationKind): void {
    const socket = this.socket;
    if (socket && socket.state() === 'OPEN') {
      socket.publish(`/app/assessment/${this.code}/violation`, { kind });
    }
    if (kind === 'FOCUS_BACK') return; // benign — logged server-side for the teacher, no student toast

    const text: Record<ViolationKind, string> = {
      TAB_SWITCH: 'Please stay on the assessment tab.',
      FOCUS_LOST: 'Please keep this window focused.',
      FOCUS_BACK: 'Please do not change window during assessment.',
      FULLSCREEN_EXIT: 'Return to full screen to continue.',
      COPY_ATTEMPT: 'Copy and paste are disabled during the assessment.',
    };
    this.toast.show(text[kind], 'warn');
  }

  private onClose(close: TransportClose): void {
    if (this.disposed) return;
    clearTimeout(this.closeTimer);
    switch (close.code) {
      case 4003: return this.finish('SUBMITTED');
      case 4002: return this.finish('TIME_OVER');
      case 4001: return this.finish('KICKED');
      case 1000: return this.finish('ENDED');
      default: return this.scheduleRejoin();
    }
  }

  /** Drop -> warn -> rejoin loop. The rejoin mints a NEW token (server pins tokenIat),
   *  so every reconnect happens with a fresh JWT from POST /assessment/join. */
  private scheduleRejoin(): void {
    if (this.disposed || this.overReason) return;
    this.markOffline();
    if (!this.endTs()) return this.finish('DISCONNECTED'); // dropped before init — nothing to count down
    if (this.remainingMs() <= 0) return this.finish('TIME_OVER');
    if (this.rejoins >= 20) return this.finish('DISCONNECTED');
    clearTimeout(this.rejoinTimer);
    this.rejoinTimer = setTimeout(() => void this.rejoin(), Math.min(5000 * (this.rejoins + 1), 15_000));
  }

  private async rejoin(): Promise<void> {
    if (this.disposed || this.overReason) return;
    const id = this.identityData;
    if (!id) return;
    this.rejoins += 1;
    try {
      const outcome = await firstValueFrom(this.api.join({ code: id.code, roll: id.roll, name: id.name }));
      if (outcome.kind !== 'JOINED') return this.scheduleRejoin();
      this.token = outcome.data.jwt;
      this.session.saveToken(id.code, id.roll, this.token);
      this.rejoins = 0;
      this.connect(); // onInit restores server-truth answers
    } catch {
      this.scheduleRejoin();
    }
  }

  private finish(reason: OverReason): void {
    if (this.overReason || this.disposed) return;
    this.overReason = reason;
    const id = this.identityData;
    if (id) this.session.saveOverReason(id.code, id.roll, reason);
    this.disposeEverything();
    void this.router.navigateByUrl('/assessment/over');
  }

  private disposeEverything(): void {
    this.disposed = true;
    clearTimeout(this.closeTimer);
    clearTimeout(this.rejoinTimer);
    for (const t of this.saveTimers.values()) clearTimeout(t);
    this.saveTimers.clear();
    this.monitor.stop();
    this.socket?.disconnect();
    this.socket = undefined;
  }
}
