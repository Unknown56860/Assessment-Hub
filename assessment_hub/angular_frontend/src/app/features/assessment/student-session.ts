import { Injectable } from '@angular/core';
import { OverReason } from './assessment.dto';

export interface StudentIdentity { code: string; roll: string; name: string; }

const CURRENT_KEY = 'ah.exam.current';
const tokenKey = (code: string, roll: string) => `ah.exam.${code}.${roll}.jwt`;
const overKey = (code: string, roll: string) => `ah.exam.${code}.${roll}.over`;
const markedKey = (code: string, roll: string) => `ah.exam.${code}.${roll}.marked`;

/** sessionStorage-backed: exam JWTs must not outlive the tab (security note from the plan). */
@Injectable({ providedIn: 'root' })
export class StudentSession {
  current(): StudentIdentity | null {
    try { return JSON.parse(sessionStorage.getItem(CURRENT_KEY) ?? 'null'); }
    catch { return null; }
  }

  setCurrent(student: StudentIdentity): void {
    sessionStorage.setItem(CURRENT_KEY, JSON.stringify(student));
  }

  clearCurrent(): void { sessionStorage.removeItem(CURRENT_KEY); }

  token(code: string, roll: string): string | null { return sessionStorage.getItem(tokenKey(code, roll)); }
  saveToken(code: string, roll: string, jwt: string): void { sessionStorage.setItem(tokenKey(code, roll), jwt); }
  clearToken(code: string, roll: string): void { sessionStorage.removeItem(tokenKey(code, roll)); }

  overReason(code: string, roll: string): OverReason | null {
    return sessionStorage.getItem(overKey(code, roll)) as OverReason | null;
  }

  saveOverReason(code: string, roll: string, reason: OverReason): void {
    sessionStorage.setItem(overKey(code, roll), reason);
  }

  /** Marked-for-review is client-side only (no backend field) — kept in localStorage
   *  so a mid-exam refresh keeps the flags. */
  markedIds(code: string, roll: string): number[] {
    try { return JSON.parse(localStorage.getItem(markedKey(code, roll)) ?? '[]') as number[]; }
    catch { return []; }
  }

  saveMarkedIds(code: string, roll: string, ids: number[]): void {
    localStorage.setItem(markedKey(code, roll), JSON.stringify(ids));
  }
}
