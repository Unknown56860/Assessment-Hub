import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AssessmentsJson, EvaluationsJson, EvaluationUpdateDto, SubmissionDto, SubmissionPageDto } from './evaluation.models';

@Injectable({ providedIn: 'root' })
export class SubmissionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.backendUrl}/submission`;

  /** Spring pages are 0-based; the UI pages are 1-based — converted here, once. */
  list(page1Based: number, size: number): Observable<SubmissionPageDto> {
    const params = new HttpParams().set('page', page1Based - 1).set('size', size);
    return this.http.get<SubmissionPageDto>(`${this.baseUrl}/all`, { params, withCredentials: true });
  }

  get(id: number): Observable<SubmissionDto> {
    return this.http.get<SubmissionDto>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }

  /** Student responses JSON. */
  submissionJson(id: number): Observable<AssessmentsJson> {
    return this.http.get<AssessmentsJson>(`${this.baseUrl}/${id}/submission`, { withCredentials: true });
  }

  /** Teacher's evaluation JSON — 404 when the assessment isn't evaluated yet. */
  evaluationJson(id: number): Observable<EvaluationsJson> {
    return this.http.get<EvaluationsJson>(`${this.baseUrl}/${id}/evaluation`, { withCredentials: true });
  }

  updateEvaluation(dto: EvaluationUpdateDto): Observable<SubmissionDto> {
    return this.http.put<SubmissionDto>(this.baseUrl, dto, { withCredentials: true });
  }
}
