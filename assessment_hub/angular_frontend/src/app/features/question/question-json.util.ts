import { QuestionType } from "../../shared/models/common.types";
import { Answer, EditorQuestion, QuestionsJson, AnswersJson, Question } from "./question-set.models";


/** Exactly four underscores — not three, not five — mark one fill-in-the-blank. */
export const BLANK = '____';
const BLANK_PATTERN = /(?<!_)_{4}(?!_)/g;

/** Reads `.value` off any form control event — shared by all signal-bound inputs. */
export function eventValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
}

export function countBlanks(question: string): number {
  return [...question.matchAll(BLANK_PATTERN)].length;
}
export type BlankSegment =
  | { blank: true; blankIndex: number; text: string }
  | { blank: false; blankIndex: null; text: string };

/** Splits a question into plain text and blank segments, blanks numbered in reading order. */
export function splitOnBlanks(question: string): BlankSegment[] {
  const segments: BlankSegment[] = [];
  let last = 0;
  let blankIndex = 0;
  for (const match of question.matchAll(BLANK_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ text: question.slice(last, start), blank: false, blankIndex: null });
    segments.push({ text: '', blank: true, blankIndex: blankIndex++ });
    last = start + match[0].length;
  }
  if (last < question.length) segments.push({ text: question.slice(last), blank: false, blankIndex: null });
  return segments;
}


/** Removes the index-th blank occurrence (plus one neighbouring space) from the text. */
export function removeBlankAt(question: string, index: number): string {
  const match = [...question.matchAll(BLANK_PATTERN)][index];
  if (!match) return question;
  let start = match.index ?? 0;
  let end = start + match[0].length;
  if (question.charAt(end) === ' ') end++;                     // don't leave a double space behind
  else if (start > 0 && question.charAt(start - 1) === ' ') start--;
  return question.slice(0, start) + question.slice(end);
}

/** fb correct answers as string[], one per blank in reading order. */
export function fbAnswers(answer: Answer | null | undefined): string[] {
  const raw = answer?.correct_answer;
  if (raw == null) return [];
  return Array.isArray(raw) ? raw.map(String) : [String(raw)];
}

/** 0 → 'A', 25 → 'Z', 26 → 'AA' … */
export function optionId(index: number): string {
  let id = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    id = String.fromCharCode(65 + rem) + id;
    n = Math.floor((n - 1) / 26);
  }
  return id;
}

export function correctOptionIds(answer: Answer | null | undefined): string[] {
  const raw = answer?.correct_answer;
  if (raw == null) return [];
  return Array.isArray(raw) ? raw.map(String) : [String(raw)];
}

/** One "Answer: …" line for any question type. */
export function formatAnswer(type: QuestionType, answer: Answer | null | undefined): string {
  if (!answer) return '—';
  if (type === 'qa') return answer.sample_answer?.trim() || '—';
  if (type === 'fb') {
    const raw = answer.correct_answer;
    const values = Array.isArray(raw) ? raw : raw != null ? [String(raw)] : [];
    return values.length ? values.join(', ') : '—';
  }
  const ids = correctOptionIds(answer);
  return ids.length ? ids.join(', ') : '—';
}

export const EMPTY_QUESTION: EditorQuestion = {
  type: 'mcq',
  marks: 1,
  question: '',
  options: ['', ''],
  correct: [false, false],
  blanks: [],
  sampleAnswer: '',
};

export function cloneDraft(q: EditorQuestion): EditorQuestion {
  return { ...q, options: [...q.options], correct: [...q.correct], blanks: [...q.blanks] };
}

/** Merges the two stored JSON files into editor drafts, aligned by id. */
export function toEditorQuestions(
  questions: QuestionsJson | null,
  answers: AnswersJson | null,
): EditorQuestion[] {
  const byId = new Map((answers?.answers ?? []).map((a) => [a.id, a]));
  return (questions?.questions ?? []).map((q) => {
    const answer = byId.get(q.id);
    const base = {
      type: q.type,
      marks: q.marks ?? 0,
      question: q.question ?? '',
      options: [] as string[],
      correct: [] as boolean[],
      blanks: [] as string[],
      sampleAnswer: '',
    };
    if (q.type === 'mcq') {
      const options = q.options ?? [];
      const correct = new Set(correctOptionIds(answer));
      return { ...base, options: options.map((o) => o.text), correct: options.map((o) => correct.has(o.id)) };
    }
    if (q.type === 'fb') {
      const raw = answer?.correct_answer;
      const values = Array.isArray(raw) ? raw : raw != null ? [String(raw)] : [];
      return { ...base, blanks: values.map((v) => String(v)) };
    }
    return { ...base, sampleAnswer: answer?.sample_answer ?? '' };
  });
}

/** An Answer object for previewing a draft row (ids unused in previews). */
export function draftToAnswer(d: EditorQuestion): Answer {
  if (d.type === 'mcq') {
    const ids = d.options.map((_, j) => optionId(j)).filter((_, j) => d.correct[j]);
    return { id: 0, correct_answer: ids.length === 1 ? ids[0] : ids };
  }
  if (d.type === 'fb') return { id: 0, correct_answer: d.blanks };
  return { id: 0, sample_answer: d.sampleAnswer };
}

/** Serializes drafts into the two SeaweedFS payloads; ids are renumbered 1..n. */
export function buildPayloads(
  questionSetId: number | null,
  drafts: EditorQuestion[],
): { questionsJson: string; answersJson: string } {
  const questions: Question[] = drafts.map((d, i) => {
    const q: Question = { id: i + 1, marks: d.marks, type: d.type, question: d.question };
    if (d.type === 'mcq') q.options = d.options.map((text, j) => ({ id: optionId(j), text }));
    return q;
  });
  const answers: Answer[] = drafts.map((d, i) => {
    const id = i + 1;
    if (d.type === 'mcq') {
      const correct = d.options.map((_, j) => optionId(j)).filter((_, j) => d.correct[j]);
      return { id, correct_answer: correct.length === 1 ? correct[0] : correct };
    }
    if (d.type === 'fb') return { id, correct_answer: d.blanks.map((b) => b.trim()) };
    return { id, sample_answer: d.sampleAnswer.trim() };
  });
  return {
    questionsJson: JSON.stringify({ question_set_id: questionSetId, questions } satisfies QuestionsJson),
    answersJson: JSON.stringify({ question_set_id: questionSetId, answers } satisfies AnswersJson),
  };
}

/** Returns the first validation problem, or null when the draft is fine. */
export function validateDraft(d: EditorQuestion): string | null {
  if (!Number.isInteger(d.marks) || d.marks < 0) return 'Marks must be a whole number of zero or more.';
  if (!d.question.trim()) return 'The question text cannot be empty.';
  if (d.type === 'mcq') {
    if (d.options.length < 2) return 'Add at least two choices.';
    if (d.options.some((o) => !o.trim())) return 'Every choice needs text.';
    if (!d.correct.some(Boolean)) return 'Select at least one correct choice.';
  } else if (d.type === 'fb') {
    const blanks = countBlanks(d.question);
    if (blanks === 0) return 'Fill-in-the-blank questions need at least one blank (____).';
    if (d.blanks.length !== blanks) return 'Every blank needs its own answer row.';
    if (d.blanks.some((b) => !b.trim())) return 'Every blank needs a correct answer.';
  } else if (!d.sampleAnswer.trim()) {
    return 'Provide a sample answer.';
  }
  return null;
}
