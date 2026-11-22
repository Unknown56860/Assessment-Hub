import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { UserDto } from '../../core/auth/auth.model';
import { ProfileUpdateDto, PasswordChangeDto, DeleteAccountDto, PagedLogsDto } from './profile.models';


@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.backendUrl}/profile`;

  getProfile(): Observable<UserDto> {
    return this.http.get<UserDto>(this.url, { withCredentials: true });
  }

  updateProfile(dto: ProfileUpdateDto): Observable<UserDto> {
    return this.http.put<UserDto>(this.url, dto, { withCredentials: true });
  }

  changePassword(dto: PasswordChangeDto): Observable<void> {
    return this.http.put<void>(`${this.url}/password`, dto, { withCredentials: true });
  }

  /** A file replaces the image; null posts an empty multipart body and removes it. */
  updateProfilePic(file: File | null): Observable<UserDto> {
    const form = new FormData();
    if (file) form.append('profile_pic', file, file.name);
    return this.http.post<UserDto>(`${this.url}/pfp`, form, { withCredentials: true });
  }

  deleteProfile(dto: DeleteAccountDto): Observable<void> {
    return this.http.delete<void>(this.url, { body: dto, withCredentials: true });
  }

  getLogs(page: number, size: number): Observable<PagedLogsDto> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PagedLogsDto>(`${this.url}/logs`, { withCredentials: true, params });
  }
}
