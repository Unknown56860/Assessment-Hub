import { QuestionType } from "../../shared/models/common.types";

export interface QuestionSetDto {
  questionSetId: number;
  title: string;
  description: string | null;
  totalConducted: number;
  lastConducted: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionSetPageDto {
  totalElements: number;
  content: QuestionSetDto[];
}

export interface QuestionSetSaveDto {
  title: string;
  description: string | null;
  questionsJson: string;
  answersJson: string;
}

export interface QuestionSetUpdateDto extends QuestionSetSaveDto {
  questionSetId: number;
}

/* ---------- Shapes of the JSON stored in SeaweedFS (snake_case by design) ---------- */

export interface McqOption {
  id: string;
  text: string;
}

export interface Question {
  id: number;
  marks: number;
  type: QuestionType;
  question: string;
  options?: McqOption[];
}

export interface QuestionsJson {
  /** Redundant on purpose — identifies the parent if the linkage is lost. null until created. */
  question_set_id: number | null;
  questions: Question[];
}

export interface Answer {
  id: number;
  /** mcq → one option id or several; fb → one entry per blank, in order. */
  correct_answer?: string | string[];
  /** qa → model answer. */
  sample_answer?: string;
}

export interface AnswersJson {
  question_set_id: number | null;
  answers: Answer[];
}

/* ---------- Editor draft (parallel questions/answers; ids are always index + 1) ---------- */

export interface EditorQuestion {
  type: QuestionType;
  marks: number;
  question: string;
  /** mcq choice texts; correctness is the parallel `correct` array. */
  options: string[];
  correct: boolean[];
  /** fb — one entry per blank, in order. */
  blanks: string[];
  /** qa */
  sampleAnswer: string;
}
