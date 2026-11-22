import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { MessageStatus, ProfileStatus } from '../../shared/models/common.types';
import { AdminMessagePageDto, AdminMessageActionDto, AdminUserPageDto, 
  AdminUserActionDto, AdminDashboardDto } from './admin.models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.backendUrl}/admin`;

  /** Backend pages are 0-based; the UI is 1-based, so we convert here. */
  getMessages(uiPage: number, size = 25): Observable<AdminMessagePageDto> {
    const params = new HttpParams().set('page', uiPage - 1).set('size', size);
    return this.http.get<AdminMessagePageDto>(`${this.base}/messages`, { params, withCredentials: true });
  }

  /** POST /admin/message — UPDATE_STATUS */
  updateMessageStatus(id: number, status: MessageStatus): Observable<void> {
    const dto: AdminMessageActionDto = { id, action: 'UPDATE_STATUS', status };
    return this.http.post<void>(`${this.base}/message`, dto, { withCredentials: true });
  }

  /** POST /admin/message — DELETE */
  deleteMessage(id: number): Observable<void> {
    const dto: AdminMessageActionDto = { id, action: 'DELETE' };
    return this.http.post<void>(`${this.base}/message`, dto, { withCredentials: true });
  }

  getUsers(uiPage: number, size = 10): Observable<AdminUserPageDto> {
    const params = new HttpParams().set('page', uiPage - 1).set('size', size);
    return this.http.get<AdminUserPageDto>(`${this.base}/users`, { params, withCredentials: true });
  }

  getProfilePic(email: string): Observable<Blob> {
    const params = new HttpParams().set('user', email);
    return this.http.get(`${environment.backendUrl}/profile/pfp`, {
      params, responseType: 'blob', withCredentials: true,
    });
  }

  /** PUT /admin/user */
  updateUserStatus(email: string, status: ProfileStatus): Observable<void> {
    const dto: AdminUserActionDto = { email, status };
    return this.http.put<void>(`${this.base}/user`, dto, { withCredentials: true });
  }

  getStats(): Observable<AdminDashboardDto> {
    return this.http.get<AdminDashboardDto>(`${this.base}/stats`, { withCredentials: true });
  }
}
