import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LoginRequestDto, UserDto, RegisterRequestDto } from '../../core/auth/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authUrl = `${environment.backendUrl}/auth`;

  login(dto: LoginRequestDto): Observable<UserDto> {
    return this.http.post<UserDto>(`${this.authUrl}/login`, dto, { withCredentials: true });
  }

  register(dto: RegisterRequestDto, profilePic?: File | null): Observable<UserDto> {
    const form = new FormData();
    form.append('user', new Blob([JSON.stringify(dto)], { type: 'application/json' }));
    if (profilePic) form.append('profile_pic', profilePic, profilePic.name);
    return this.http.post<UserDto>(`${this.authUrl}/register`, form, { withCredentials: true });
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.authUrl}/logout`, {}, { withCredentials: true });
  }

  /** Session resume after a refresh — 401 when not signed in. */
  me(): Observable<UserDto> {
    return this.http.get<UserDto>(`${this.authUrl}/me`, { withCredentials: true });
  }
}

/** Pulls a readable message out of an error body ({ message } or Problem Detail { detail }). */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { error?: { message?: string; detail?: string } };
  return e?.error?.message ?? e?.error?.detail ?? fallback;
}
