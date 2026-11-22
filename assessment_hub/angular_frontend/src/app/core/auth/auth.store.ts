import { Injectable, computed, inject, signal } from '@angular/core';
import { finalize, tap } from 'rxjs';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../features/auth/auth.api';
import { UserDto, LoginRequestDto, RegisterRequestDto } from './auth.model';


export function toAbsoluteUrl(path: string): string {
  return /^https?:\/\//i.test(path) ? path : `${environment.backendUrl}${path}`;
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly auth = inject(AuthService);

  private readonly user = signal<UserDto | null>(null);
  private readonly restored = signal(false);

  readonly currentUser = this.user.asReadonly();
  readonly isReady = this.restored.asReadonly();
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly role = computed(() => this.user()?.role ?? null);

  /** Direct backend URL for the avatar <img> - null when the user has no picture. */
  readonly profilePicUrl = computed(() => {
    const pic = this.user()?.profilePic;
    return pic ? toAbsoluteUrl(pic) : null;
  });

  readonly status = computed(() => this.user()?.status ?? null);
  /** Every write operation app-wide requires an ACTIVE profile (backend enforces this too). */
  readonly canWrite = computed(() => this.status() === 'ACTIVE');

  constructor() {
    this.auth
      .me()
      .pipe(finalize(() => this.restored.set(true)))
      .subscribe({
        next: (user) => this.user.set(user),
        error: () => {}, // 401 → not signed in
      });
  }

  login(dto: LoginRequestDto): Observable<UserDto> {
    return this.auth.login(dto).pipe(tap((user) => this.user.set(user)));
  }

  register(dto: RegisterRequestDto, profilePic?: File | null): Observable<UserDto> {
    return this.auth.register(dto, profilePic);
  }

  logout(): Observable<void> {
    return this.auth.logout().pipe(tap(() => this.user.set(null)));
  }

  /** Re-syncs the session user after profile edits — new pic key (URL) included. */
  refresh(): Observable<UserDto | null> {
    return this.auth.me().pipe(tap({ next: (user) => { if (user) this.user.set(user); } }));
  }

  /** Clears local state without calling the backend (session already invalidated server-side). */
  forceSignOut(): void {
    this.user.set(null);
  }
}
