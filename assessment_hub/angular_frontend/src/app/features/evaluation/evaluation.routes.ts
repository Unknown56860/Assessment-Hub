import { Routes } from '@angular/router';
import { authGuard, roleGuard } from '../../core/auth/auth.guard';

export const SUBMISSION_ROUTES: Routes = [
  {
    path: 'assessments',
    canActivate: [authGuard, roleGuard('TEACHER')],
    children: [
      { path: '', loadComponent: () => import('./pages/list-view').then((m) => m.AssessmentsList), title: 'Assessments' },
      { path: ':id', loadComponent: () => import('./pages/view').then((m) => m.AssessmentDetail), title: 'Assessment' },
    ],
  },
];
