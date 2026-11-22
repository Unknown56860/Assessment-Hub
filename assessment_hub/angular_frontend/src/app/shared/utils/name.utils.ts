/** First letter of the name, uppercase — 'U' fallback when blank. */
export function nameInitial(name: string | null | undefined): string {
  return name?.trim().charAt(0).toUpperCase() || 'U';
}

/** First letters of the first two words (monogram) — '?' fallback when blank. */
export function nameMonogram(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';
}
