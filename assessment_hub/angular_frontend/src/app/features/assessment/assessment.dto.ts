/** Mirrors backend AssessmentStatus — replaces the stale 4-value type (delete the old one). */
export type AssessmentStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'EVALUATED' | 'FLUSHING' | 'FAILED';

export type StudentStatus = 'CONNECTED' | 'DISCONNECTED' | 'KICKED' | 'SUBMITTED' | 'TIME_OVER';

export type ViolationKind = 'TAB_SWITCH' | 'FOCUS_LOST' | 'FOCUS_BACK' | 'FULLSCREEN_EXIT' | 'COPY_ATTEMPT';

/** Terminal exam-page outcomes (drives the over page copy). */
export type OverReason = 'SUBMITTED' | 'TIME_OVER' | 'KICKED' | 'ENDED' | 'DISCONNECTED';

/* ---------- host ---------- */

export interface AssessmentCodeDto { code: string; }

export interface HostRequestDto {
  assessmentCode: string;
  questionSetId: number;
  title: string;
  description: string | null;
  maxStudents: number | null;   // null -> backend default 100
  durationMin: number;
  startAt: string;              // ISO with offset (Z is fine)
  endAt: string;
  utc: string;                  // browser offset, e.g. "+05:30"
}

export interface HostResponseDto {
  assessmentId: number;
  code: string;
  title: string;
  description: string | null;
  questionSetId: number;
  maxStudents: number;
  durationMin: number;
  startTs: number;
  endTs: number;
  hostUtc: string;
  hostJwt: string;
}

/* ---------- join ---------- */

export interface JoinRequestDto { code: string; roll: string; name: string; token?: string | null; }

export interface JoinResponseDto {
  jwt: string; code: string; roll: string; name: string;
  joinedAt: number; rejoin: boolean; endTs: number; serverTs: number; hostUtc: string;
}

/** HTTP 202 — assessment is SCHEDULED; carries the countdown target. */
export interface JoinWaitDto { status: 'SCHEDULED'; startTs: number; serverTs: number; hostUtc: string; }

/* ---------- student socket payloads ---------- */

export interface RemainingDto { type: 'REMAINING'; endTs: number; serverTs: number; }

export interface SaveCommandDto { questionId: number; answer: unknown; }
export interface SaveAckDto { questionId: number; saved: boolean; serverTs: number; }

export interface StudentInitDto {
  title: string;
  questionSetId: number;
  /** Raw QuestionsJson string from Redis — parse client-side. */
  questions: string;
  savedAnswers: Record<string, unknown>;
  joinedAt: number;
  durationMin: number;
  endTs: number;
  serverTs: number;
  hostUtc: string;
}

/* ---------- teacher socket payloads ---------- */

export interface StudentRowDto { roll: string; name: string; status: StudentStatus; joinedAt: number; lastSeen: number; }

export interface StudentListDto {
  type: 'STUDENTS';
  students: StudentRowDto[];
  connected: number; submitted: number; kicked: number; total: number;
}

export interface EventLogDto { ts: number; type: string; message: string; roll: string | null; }

export interface TeacherEventDto { type: string; message: string; roll: string | null; ts: number; }

export interface TeacherSnapshotDto {
  status: AssessmentStatus;
  endTs: number;
  serverTs: number;
  students: StudentRowDto[];
  events: EventLogDto[];
  connected: number; submitted: number; kicked: number; total: number;
}

/* shared question-set JSON shapes come from ../question/question-set.models (QuestionsJson) */
