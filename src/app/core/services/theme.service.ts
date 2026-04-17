import { Injectable, computed, signal } from '@angular/core';

export type AppThemeMode = 'light' | 'dark';

/** Keep in sync with the inline script in `index.html`. */
export const APP_THEME_STORAGE_KEY = 'tasks_app_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** Resolved mode applied to `document.documentElement`. */
  readonly mode = signal<AppThemeMode>('light');

  readonly isDark = computed(() => this.mode() === 'dark');

  /** Call from `APP_INITIALIZER` so the document matches storage before first paint (after index script). */
  init(): void {
    this.apply(this.readStored(), false);
  }

  toggle(): void {
    this.apply(this.mode() === 'light' ? 'dark' : 'light', true);
  }

  private readStored(): AppThemeMode {
    try {
      const v = localStorage.getItem(APP_THEME_STORAGE_KEY);
      return v === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }

  private apply(mode: AppThemeMode, persist: boolean): void {
    this.mode.set(mode);
    document.documentElement.setAttribute('data-theme', mode);
    if (persist) {
      try {
        localStorage.setItem(APP_THEME_STORAGE_KEY, mode);
      } catch {
        /* ignore quota / private mode */
      }
    }
  }
}
