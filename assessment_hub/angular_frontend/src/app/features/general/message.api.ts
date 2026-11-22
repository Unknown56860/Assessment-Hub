import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface VisitorMessageDto {
  name: string;
  email: string;
  subject: string | null;
  message: string | null;
}

@Injectable({providedIn: 'root'})
export class MessageService {
  private readonly http = inject(HttpClient);
  private readonly messageurl = `${environment.backendUrl}/message`

  sendMessage(data: VisitorMessageDto) {
    return this.http.post(this.messageurl, data, {withCredentials: true});
  }
}
