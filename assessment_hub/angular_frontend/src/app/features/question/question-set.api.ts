import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AnswersJson, QuestionSetDto, QuestionSetPageDto, QuestionSetSaveDto, QuestionSetUpdateDto, QuestionsJson,
} from '../../features/question/question-set.models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class QuestionSetService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.backendUrl}/question-set`;

  /** Spring pages are 0-based; the UI pages are 1-based — converted here, once. */
  list(page1Based: number, size: number): Observable<QuestionSetPageDto> {
    const params = new HttpParams().set('page', page1Based - 1).set('size', size);
    return this.http.get<QuestionSetPageDto>(`${this.baseUrl}/all`, { params, withCredentials: true });
  }

  get(id: number): Observable<QuestionSetDto> {
    return this.http.get<QuestionSetDto>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }

  create(dto: QuestionSetSaveDto): Observable<QuestionSetDto> {
    return this.http.post<QuestionSetDto>(this.baseUrl, dto, { withCredentials: true });
  }

  update(dto: QuestionSetUpdateDto): Observable<QuestionSetDto> {
    return this.http.put<QuestionSetDto>(this.baseUrl, dto, { withCredentials: true });
  }

  /** Backend requires the exact keyword "Delete" alongside the id. */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(this.baseUrl, {
      body: { questionSetId: id, confirm: 'Delete' },
      withCredentials: true,
    });
  }

  questions(id: number): Observable<QuestionsJson> {
    return this.http.get<QuestionsJson>(`${this.baseUrl}/${id}/questions`, { withCredentials: true });
  }

  answers(id: number): Observable<AnswersJson> {
    return this.http.get<AnswersJson>(`${this.baseUrl}/${id}/answers`, { withCredentials: true });
  }
}
