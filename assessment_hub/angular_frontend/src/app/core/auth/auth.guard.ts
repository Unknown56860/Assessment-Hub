import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';

import { AuthStore } from './auth.store';

export const authReadyGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  if (store.isReady()) return true;
  return toObservable(store.isReady).pipe(filter(Boolean), take(1), map(() => true));
};

export const authGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);
  return store.isAuthenticated() ? true : router.createUrlTree(['/login']);
};

export const roleGuard = (allowed: 'ADMIN' | 'TEACHER'): CanActivateFn => () => {
  const store = inject(AuthStore);
  const router = inject(Router);
  return store.role() === allowed ? true : router.createUrlTree(['/login']);
};

/** Write pages (create/update question set, host, …) — ACTIVE teacher only. */
export const activeProfileGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);
  return store.canWrite() ? true : router.createUrlTree(['/question-sets']);
};
