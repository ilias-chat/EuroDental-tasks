import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
  durationMs: number;
  leaving?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly items = signal<ToastMessage[]>([]);
  private nextId = 1;

  show(kind: ToastKind, text: string, timeoutMs = 3200): void {
    const t = (text ?? '').trim();
    if (!t) return;
    const id = this.nextId++;
    this.items.update((list) => [...list, { id, kind, text: t, durationMs: timeoutMs }]);
    if (timeoutMs > 0) {
      setTimeout(() => this.dismiss(id), timeoutMs);
    }
  }

  success(text: string, timeoutMs?: number): void {
    this.show('success', text, timeoutMs);
  }

  error(text: string, timeoutMs?: number): void {
    this.show('error', text, timeoutMs ?? 4200);
  }

  info(text: string, timeoutMs?: number): void {
    this.show('info', text, timeoutMs);
  }

  dismiss(id: number): void {
    this.items.update((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      this.items.update((list) => list.filter((t) => t.id !== id));
    }, 180);
  }
}
