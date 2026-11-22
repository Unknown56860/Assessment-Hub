// features/assessment/xsrf.interceptor.ts  (move to wherever you keep shared code)
import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const XSRF_COOKIE = 'XSRF-TOKEN';
const XSRF_HEADER = 'X-XSRF-TOKEN';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Angular's built-in XSRF interceptor only fires for relative URLs, but every
 * request here targets the absolute backend origin. This reads the XSRF-TOKEN
 * cookie (written by CookieCsrfTokenRepository) and echoes it as the
 * X-XSRF-TOKEN header on state-changing calls.
 */
export const xsrfInterceptor: HttpInterceptorFn = (req, next) => {
  const safe = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
  if (safe || !req.url.startsWith(environment.backendUrl)) return next(req);
  const token = readCookie(XSRF_COOKIE);
  return next(token ? req.clone({ setHeaders: { [XSRF_HEADER]: token } }) : req);
};
