import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AssessmentCodeDto, HostRequestDto, HostResponseDto, JoinRequestDto, JoinResponseDto, JoinWaitDto,
} from './assessment.dto';

/** Backend always answers errors as { message }. */
export function apiError(err: unknown): string {
  const e = err as { error?: { message?: string } };
  return e?.error?.message || 'Something went wrong. Please try again.';
}

export type JoinOutcome =
  | { kind: 'JOINED'; data: JoinResponseDto }
  | { kind: 'WAIT'; data: JoinWaitDto };

@Injectable({ providedIn: 'root' })
export class AssessmentApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.backendUrl}/assessment`;

  /** Candidate code for the host form — uniqueness is re-verified atomically on POST. */
  nextCode(): Observable<AssessmentCodeDto> {
    return this.http.get<AssessmentCodeDto>(`${this.base}/code`, { withCredentials: true });
  }

  /** 404 when not actively hosting — callers treat that as "show the empty form". */
  reattach(): Observable<HostResponseDto> {
    return this.http.get<HostResponseDto>(`${this.base}/host`, { withCredentials: true });
  }

  host(dto: HostRequestDto): Observable<HostResponseDto> {
    return this.http.post<HostResponseDto>(`${this.base}/host`, dto, { withCredentials: true });
  }

  /** 202 = SCHEDULED (wait), 200 = admitted. */
  join(dto: JoinRequestDto): Observable<JoinOutcome> {
    return this.http
      .post<JoinResponseDto | JoinWaitDto>(`${this.base}/join`, dto, { observe: 'response', withCredentials: true })
      .pipe(map((res) =>
        res.status === 202
          ? { kind: 'WAIT', data: res.body as JoinWaitDto }
          : { kind: 'JOINED', data: res.body as JoinResponseDto },
      ));
  }
}
