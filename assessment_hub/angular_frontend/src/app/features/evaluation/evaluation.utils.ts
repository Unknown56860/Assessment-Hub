import { StudentStatus } from "../assessment/assessment.dto";
import { splitOnBlanks, correctOptionIds, fbAnswers } from "../question/question-json.util";
import { Question, Answer, AnswersJson } from "../question/question-set.models";
import { RollSubmissions, StudentSubmission, RollEvaluations, EvaluationsJson } from "./evaluation.models";

/* ---------- Normalizers for the array-of-single-key-objects JSON shape ---------- */

/** [ { "23cseds001": {...} } ] → Map preserving file order. */
export function toStudentMap(list: RollSubmissions[] | null | undefined): Map<string, StudentSubmission> {
  const map = new Map<string, StudentSubmission>();
  for (const entry of list ?? []) {
    for (const [roll, submission] of Object.entries(entry)) map.set(roll, submission);
  }
  return map;
}

/** [ { "23cseds001": { marks: [...] } } ] → editable Record<roll, Record<questionId, marks>>. */
export function initMarkRecord(list: RollEvaluations[] | null | undefined): Record<string, Record<number, number>> {
  const out: Record<string, Record<number, number>> = {};
  for (const entry of list ?? []) {
    for (const [roll, evaluation] of Object.entries(entry)) {
      out[roll] = Object.fromEntries((evaluation?.marks ?? []).map((m) => [m.question_id, m.marks]));
    }
  }
  return out;
}

/** Rebuilds the stored JSON shape from the live edit state; rolls with no marks are omitted. */
export function buildEvaluationJson(
  assessmentId: number,
  marks: Record<string, Record<number, number>>,
  maximumMarks: number,
): string {
  const evaluations: RollEvaluations[] = [];
  for (const [roll, byQuestion] of Object.entries(marks)) {
    const list = Object.entries(byQuestion)
      .filter(([, value]) => typeof value === 'number')
      .map(([questionId, value]) => ({ question_id: Number(questionId), marks: value as number }));
    if (list.length > 0) evaluations.push({ [roll]: { marks: list } });
  }
  return JSON.stringify({ assessment_id: assessmentId, maximum_marks: maximumMarks, evaluations } satisfies EvaluationsJson);
}

/* ---------- Student rows (list tiles) ---------- */

export type StudentEvaluationState = 'EVALUATED' | 'PARTIAL' | 'NOT_EVALUATED';

export interface StudentRow {
  serial: number;
  roll: string;
  name: string;
  status: StudentStatus;
  state: StudentEvaluationState;
  total: number | null;
}

export const EVALUATION_STATE_LABEL: Record<StudentEvaluationState, string> = {
  EVALUATED: 'Evaluated',
  PARTIAL: 'Partially evaluated',
  NOT_EVALUATED: 'Not evaluated',
};

export function buildStudentRows(
  students: Map<string, StudentSubmission>,
  marks: Record<string, Record<number, number>>,
  questions: Question[],
): StudentRow[] {
  return [...students.entries()].map(([roll, submission], i) => {
    const byQuestion = marks[roll] ?? {};
    const assigned = questions.filter((q) => typeof byQuestion[q.id] === 'number');
    const total = assigned.reduce((sum, q) => sum + (byQuestion[q.id] ?? 0), 0);
    const state: StudentEvaluationState =
      assigned.length === 0 ? 'NOT_EVALUATED'
      : assigned.length < questions.length ? 'PARTIAL'
      : 'EVALUATED';
    return {
      serial: i + 1,
      roll,
      name: submission?.name?.trim() || 'Unknown',
      status: submission?.status ?? null,                           // NEW
      state,
      total: state === 'NOT_EVALUATED' ? null : total,
    };
  });
}

/* ---------- Evaluation modal rows ---------- */

export type OptionVerdict = 'CORRECT' | 'WRONG' | 'UNSELECTED';

export interface EvaluationRow {
  serial: number;
  question: Question;
  answer: Answer | null;
  /** mcq — verdict per option id. */
  optionState: Record<string, OptionVerdict>;
  correctOptions: string[];
  /** fb — question split on ____ + per-blank verdicts in reading order. */
  fbSegments: ReturnType<typeof splitOnBlanks>;
  fbResults: { student: string; correct: boolean }[];
  correctAnswers: string[];
  /** qa */
  studentText: string;
  sampleAnswer: string;
}

export function buildEvaluationRows(
  questions: Question[],
  answers: AnswersJson | null,
  student: StudentSubmission | null,
): EvaluationRow[] {
  const keyById = new Map((answers?.answers ?? []).map((a) => [a.id, a]));
  const answerByQuestion = new Map((student?.answers ?? []).map((a) => [a.question_id, a.answer]));

  return questions.map((question, index) => {
    const answer = keyById.get(question.id) ?? null;
    const raw = answerByQuestion.get(question.id);
    const base = { serial: index + 1, question, answer };

    if (question.type === 'mcq') {
      const chosen = new Set(asStringArray(raw));
      const correct = correctOptionIds(answer);
      const correctSet = new Set(correct);
      const optionState: Record<string, OptionVerdict> = {};
      for (const option of question.options ?? []) {
        optionState[option.id] = chosen.has(option.id)
          ? (correctSet.has(option.id) ? 'CORRECT' : 'WRONG')
          : 'UNSELECTED';
      }
      return { ...base, optionState, correctOptions: correct, fbSegments: [], fbResults: [], correctAnswers: [], studentText: '', sampleAnswer: '' };
    }

    if (question.type === 'fb') {
      const values = asStringArray(raw);
      const correct = fbAnswers(answer);
      const fbResults = correct.map((expected, i) => {
        const studentValue = (values[i] ?? '').trim();
        return { student: studentValue, correct: sameAnswer(studentValue, expected) };
      });
      return { ...base, optionState: {}, correctOptions: [], fbSegments: splitOnBlanks(question.question), fbResults, correctAnswers: correct, studentText: '', sampleAnswer: '' };
    }

    return {
      ...base,
      optionState: {}, correctOptions: [], fbSegments: [], fbResults: [], correctAnswers: [],
      studentText: typeof raw === 'string' ? raw : asStringArray(raw).join(', '),
      sampleAnswer: answer?.sample_answer ?? '',
    };
  });
}

export function asStringArray(value: string | string[] | null | undefined): string[] {
  if (value == null) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

/** "apple", "mango" → `"apple", "mango"` — the quoted lists shown under mcq/fb answers. */
export function quoteList(values: string[]): string {
  return values.map((v) => `"${v}"`).join(', ');
}

/** Trimmed, lower-cased, whitespace-collapsed comparison for fill-in-the-blank. */
function sameAnswer(a: string, b: string): boolean {
  const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');
  return norm(a) === norm(b);
}
