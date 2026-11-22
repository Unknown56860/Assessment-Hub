import { Injectable, signal } from '@angular/core';
import { ViolationKind } from './assessment.dto';

/** Client-side dedupe — the server rate-limits per kind too. */
const CLIENT_RATE_LIMIT_MS = 10_000;

/** Fullscreen control + integrity-event detection for the student exam page. */
@Injectable({ providedIn: 'root' })
export class ViolationMonitor {
  readonly isFullscreen = signal(document.fullscreenElement != null);

  private report?: (kind: ViolationKind) => void;
  private readonly lastReport = new Map<ViolationKind, number>();
  private listening = false;

  private wasHidden = false;
  private wasBlurred = false;

  /** Starts listeners, then requests fullscreen (must be called from a user gesture). */
  async start(report: (kind: ViolationKind) => void): Promise<void> {
    this.report = report;
    this.addListeners();
    await this.requestFullscreen();
  }

  async requestFullscreen(): Promise<void> {
    try { await document.documentElement.requestFullscreen(); }
    catch { /* browser refused — the FULLSCREEN_EXIT overlay covers it */ }
  }

  stop(): void {
    this.report = undefined;
    this.lastReport.clear();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    this.removeListeners();
  }

  private addListeners(): void {
    if (this.listening) return;
    this.listening = true;
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('focus', this.onFocus);
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    document.addEventListener('contextmenu', this.onClipboardEvent);
    document.addEventListener('copy', this.onClipboardEvent);
    document.addEventListener('cut', this.onClipboardEvent);
    document.addEventListener('paste', this.onClipboardEvent);
    document.addEventListener('keydown', this.onKeyDown);
  }

  private removeListeners(): void {
    this.listening = false;
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('focus', this.onFocus);
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    document.removeEventListener('contextmenu', this.onClipboardEvent);
    document.removeEventListener('copy', this.onClipboardEvent);
    document.removeEventListener('cut', this.onClipboardEvent);
    document.removeEventListener('paste', this.onClipboardEvent);
    document.removeEventListener('keydown', this.onKeyDown);
  }

  private onVisibility = (): void => {
    if (document.hidden) { this.wasHidden = true; this.emit('TAB_SWITCH'); }
    else if (this.wasHidden) { this.wasHidden = false; this.emit('FOCUS_BACK'); }
  };

  private onBlur = (): void => { this.wasBlurred = true; this.emit('FOCUS_LOST'); };
  private onFocus = (): void => { if (this.wasBlurred) { this.wasBlurred = false; this.emit('FOCUS_BACK'); } };

  private onFullscreenChange = (): void => {
    const fullscreen = document.fullscreenElement != null;
    this.isFullscreen.set(fullscreen);
    if (!fullscreen) this.emit('FULLSCREEN_EXIT');
  };

  private onClipboardEvent = (e: Event): void => { e.preventDefault(); this.emit('COPY_ATTEMPT'); };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    if (key === 'c' || key === 'x' || key === 'v') { e.preventDefault(); this.emit('COPY_ATTEMPT'); }
  };

  private emit(kind: ViolationKind): void {
    const now = Date.now();
    const last = this.lastReport.get(kind);
    if (last != null && now - last < CLIENT_RATE_LIMIT_MS) return;
    this.lastReport.set(kind, now);
    this.report?.(kind);
  }
}
