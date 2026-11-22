import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  text: string;
  type: 'success' | 'info' | 'warn' | 'error';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toastSignal = signal<ToastMessage | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  readonly currentToast = this.toastSignal.asReadonly();

  show(text: string, type: ToastMessage['type'] = 'info'): void {
    clearTimeout(this.timer);
    this.toastSignal.set({ text, type });
    this.timer = setTimeout(() => this.clear(), 4000);
  }

  clear(): void {
    clearTimeout(this.timer);
    this.toastSignal.set(null);
  }
}
