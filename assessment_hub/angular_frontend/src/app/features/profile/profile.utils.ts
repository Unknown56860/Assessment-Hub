import { computed, signal } from '@angular/core';

/**
 * Hides a profile-pic URL that failed to load (→ initials fallback) until the
 * URL itself changes — a new ?v= cache-buster re-enables the load and retries.
 */
/** @param url zero-arg getter for the CURRENT url - dereference signals: () => mySignal() */
export function trackPicFailures(url: () => string | null) {
  const failed = signal<string | null>(null);

  return {
    /** Bind to <img [src]> — null means "render the initials fallback". */
    src: computed(() => {
      const u = url();
      return u !== null && u !== failed() ? u : null;
    }),
    /** Bind to the <img> (error) event. */
    onError(): void {
      failed.set(url());
    },
  };
}

/** Same idea for lists with one avatar per item (Users table), keyed per row. */
export function trackPicFailuresByKey<T>(
  keyOf: (item: T) => string,
  urlOf: (item: T) => string | null,
) {
  const failed = signal<Record<string, string>>({});

  return {
    /** Call per row in the template — null means "render that row's initials". */
    src(item: T): string | null {
      const url = urlOf(item);
      return url !== null && url !== failed()[keyOf(item)] ? url : null;
    },
    /** Bind to that row's <img> (error) event. */
    onError(item: T): void {
      const url = urlOf(item);
      if (url !== null) failed.update((map) => ({ ...map, [keyOf(item)]: url }));
    },
  };
}
