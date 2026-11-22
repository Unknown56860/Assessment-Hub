import { StudentStatus } from '../assessment.dto';

/** One status → one label/color pair (design §11: never color alone — chips carry sr-only labels). */
export const STUDENT_STATUS_LABEL: Record<StudentStatus, string> = {
  CONNECTED: 'Live',
  DISCONNECTED: 'Disconnected',
  KICKED: 'Kicked',
  SUBMITTED: 'Submitted',
  TIME_OVER: 'Time up',
};

export const STUDENT_STATUS_TEXT: Record<StudentStatus, string> = {
  CONNECTED: 'text-success-strong',
  DISCONNECTED: 'text-secondary',
  KICKED: 'text-error-strong',
  SUBMITTED: 'text-info-strong',
  TIME_OVER: 'text-warning-strong',
};

export const STUDENT_STATUS_BADGE: Record<StudentStatus, string> = {
  CONNECTED: 'badge badge-success',
  DISCONNECTED: 'badge border border-border bg-bg-alt text-text-secondary',
  KICKED: 'badge badge-error',
  SUBMITTED: 'badge bg-info-bg text-info-strong',
  TIME_OVER: 'badge bg-warning-bg text-warning-strong',
};

export const STUDENT_STATUS_INFO_BG: Record<StudentStatus, string> = {
  CONNECTED: 'bg-success-bg',
  DISCONNECTED: 'bg-bg-alt',
  KICKED: 'bg-error-bg',
  SUBMITTED: 'bg-info-bg',
  TIME_OVER: 'bg-warning-bg',
};
