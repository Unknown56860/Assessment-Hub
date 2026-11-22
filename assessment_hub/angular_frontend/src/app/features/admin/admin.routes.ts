import { Routes } from '@angular/router';
import { authGuard, roleGuard } from '../../core/auth/auth.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: 'admin',
    // roleGuard also covers signed-out users (role is null → redirect to /login).
    canActivate: [authGuard, roleGuard('ADMIN')],
    children: [
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard').then((m) => m.Dashboard), title: 'Admin Dashboard' },
      { path: 'users', loadComponent: () => import('./pages/users').then((m) => m.Users), title: 'Admin Users' },
      { path: 'messages', loadComponent: () => import('./pages/messages').then((m) => m.Messages), title: 'Admin Messages' },
    ],
  },
];
