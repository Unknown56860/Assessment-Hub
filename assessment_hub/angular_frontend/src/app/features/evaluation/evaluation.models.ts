import { AssessmentStatus, StudentStatus } from "../assessment/assessment.dto";

/* ---------- Backend DTOs (camelCase) ---------- */
export interface SubmissionDto {
  assessmentId: number;
  assessmentTitle: string;
  assessmentDescription: string | null;
  status: AssessmentStatus;
  questionSetId: number;
  conductedAt: string | null;
  evaluatedAt: string | null;
}

export interface SubmissionPageDto {
  totalElements: number;
  content: SubmissionDto[];
}

export interface EvaluationUpdateDto {
  assessmentId: number;
  evaluationJson: string;
}

/* ---------- Shapes of the JSON stored in SeaweedFS (snake_case by design) ---------- */

export interface StudentAnswerEntry {
  question_id: number;
  /** mcq/fb → one id/value per blank or choice; qa → free text. */
  answer: string | string[];
}

export interface StudentSubmission {
  name: string;
  status: StudentStatus;
  answers: StudentAnswerEntry[];
}

/** One object per student, keyed by roll number — { "23cseds001": {...} } */
export interface RollSubmissions {
  [roll: string]: StudentSubmission;
}

export interface AssessmentsJson {
  assessment_id: number;
  submissions: RollSubmissions[];
}

export interface QuestionMark {
  question_id: number;
  marks: number;
}

export interface StudentEvaluation {
  marks: QuestionMark[];
}

export interface RollEvaluations {
  [roll: string]: StudentEvaluation;
}

export interface EvaluationsJson {
  assessment_id: number;
  maximum_marks: number;
  evaluations: RollEvaluations[];
}
