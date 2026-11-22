import { Routes } from '@angular/router';
import { authReadyGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authReadyGuard],
    children: [
      { path: '', loadComponent: () => import('./features/general/pages/home').then((m) => m.Home), title: 'Home' },

      { path: '', loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES) },
      { path: '', loadChildren: () => import('./features/assessment/assessment.routes').then((m) => m.ASSESSMENT_ROUTES) },
      { path: '', loadChildren: () => import('./features/profile/profile.routes').then((m) => m.PROFILE_ROUTES) },
      { path: '', loadChildren: () => import('./features/question/question-set.routes').then((m) => m.QUESTION_SETS_ROUTES) },
      { path: '', loadChildren: () => import('./features/evaluation/evaluation.routes').then((m) => m.SUBMISSION_ROUTES) },
      { path: '', loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES) },

      { path: 'error', loadComponent: () => import('./features/general/pages/error').then((m) => m.Error), title: 'Error' },
    ],
  },

  { path: '**', redirectTo: 'error' },
];
