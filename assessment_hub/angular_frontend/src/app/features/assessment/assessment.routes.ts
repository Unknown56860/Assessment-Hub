import { CanActivateFn, Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { StudentSession } from './student-session';
import { authGuard, roleGuard } from '../../core/auth/auth.guard';

/** Student must hold an identity + token for this exam code, else back to join. */
export const studentExamGuard: CanActivateFn = (route) => {
  const session = inject(StudentSession);
  const router = inject(Router);
  const student = session.current();
  const code = route.paramMap.get('code');
  if (!student || !code || code !== student.code) return router.createUrlTree(['/assessment/join']);
  return session.token(student.code, student.roll) ? true : router.createUrlTree(['/assessment/join']);
};

export const ASSESSMENT_ROUTES: Routes = [
  // ... keep whatever already exists here (e.g. /assessments history page)

  { path: 'assessment/host', loadComponent: () => import('./pages/host-page').then((m) => m.HostPage),
    title: 'Assessment Live Hosting', canActivate: [authGuard, roleGuard('TEACHER')] },

  { path: 'assessment/live/:code', loadComponent: () => import('./pages/teacher-live-page').then((m) => m.TeacherLivePage),
    title: 'Live Assessment', canActivate: [authGuard, roleGuard('TEACHER')] },

  { path: 'assessment/join', loadComponent: () => import('./pages/join-page').then((m) => m.JoinPage),
    title: 'Join Assessment' },

  { path: 'assessment/exam/:code', loadComponent: () => import('./pages/student-exam-page').then((m) => m.StudentExamPage),
    title: 'Live Assessment', canActivate: [studentExamGuard], data: { testMode: true } },

  { path: 'assessment/over', loadComponent: () => import('./pages/over-page').then((m) => m.OverPage),
    title: 'Assessment Over', data: { testMode: true } },
];
