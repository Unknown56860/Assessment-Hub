/** Browser UTC offset formatted like "+05:30" — what the backend expects in `utc`. */
export function browserUtcOffset(): string {
  const off = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const h = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0');
  const m = String(Math.abs(off) % 60).padStart(2, '0');
  return `${sign}${h}:${m}`;
}

/** Default start: now + 30 min, rounded UP to the next 5-minute mark. */
export function defaultStart(): Date {
  const t = new Date(Date.now() + 30 * 60_000);
  t.setSeconds(0, 0);
  t.setMinutes(Math.ceil(t.getMinutes() / 5) * 5);
  return t;
}

/** Value for <input type="datetime-local"> (local wall clock, minute precision). */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** datetime-local value -> ISO instant for the backend (Z suffix is a valid offset). */
export function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

/** Clock skew: add to Date.now() to get "server now". */
export function serverSkew(serverTs: number): number { return serverTs - Date.now(); }

/** mm:ss or h:mm:ss. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

/** Epoch-ms -> HH:mm[:ss] local, for event timestamps and "last synced". */
export function formatTime(ts: number, withSeconds = false): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', ...(withSeconds ? { second: '2-digit' } : {}),
  });
}

/** Event log timestamp -> "HH:mm — message". */
export function eventLine(ts: number, message: string): string {
  return `${formatTime(ts, true)} — ${message}`;
}
