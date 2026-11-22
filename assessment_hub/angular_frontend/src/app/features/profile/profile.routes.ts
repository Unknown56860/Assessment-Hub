import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';

export const PROFILE_ROUTES: Routes = [
  {
    path: 'profile',
    canActivate: [authGuard],
    children: [
      { path: '', loadComponent: () => import('./pages/profile').then((m) => m.Profile), title: 'Profile' },
      { path: 'logs', loadComponent: () => import('./pages/activity-logs').then((m) => m.Logs), title: 'Activity Logs' },
    ],
  },
];
