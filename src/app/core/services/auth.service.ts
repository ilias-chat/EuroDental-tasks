import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { readStoredToken, TASKS_APP_TOKEN_STORAGE_KEY } from '../interceptors/auth.interceptor';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  image: string | null;
  /** Laravel profile name (e.g. technicien). */
  profile: string | null;
  permissions: string[];
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

interface MeResponse {
  id: number;
  name: string;
  email: string;
  image: string | null;
  profile: string | null;
  permissions: string[];
}

const USER_STORAGE_KEY = 'tasks_app_user';

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const u = JSON.parse(raw) as Partial<AuthUser>;
    if (typeof u.id !== 'number' || typeof u.name !== 'string') {
      return null;
    }
    return {
      id: u.id,
      name: u.name,
      email: typeof u.email === 'string' ? u.email : '',
      image: u.image ?? null,
      profile: u.profile ?? null,
      permissions: Array.isArray(u.permissions) ? u.permissions : [],
    };
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly tokenSignal = signal<string | null>(readStoredToken());
  private readonly userSignal = signal<AuthUser | null>(readStoredUser());

  readonly token = this.tokenSignal.asReadonly();
  readonly user = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.tokenSignal());

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiBaseUrl}/login`, { email, password }).pipe(
      tap((res) => {
        localStorage.setItem(TASKS_APP_TOKEN_STORAGE_KEY, res.token);
        this.tokenSignal.set(res.token);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
        this.userSignal.set(res.user);
      }),
    );
  }

  /**
   * Refreshes the current user from `GET /api/me` (profile name, image, etc.).
   * Always runs when the shell loads so profile is never stuck from stale cache.
   */
  syncUserFromMe(): void {
    if (!this.tokenSignal()) {
      return;
    }
    this.http.get<MeResponse>(`${environment.apiBaseUrl}/me`).subscribe({
      next: (me) => {
        const u: AuthUser = {
          id: me.id,
          name: me.name,
          email: me.email,
          image: me.image ?? null,
          profile: me.profile ?? null,
          permissions: me.permissions ?? [],
        };
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(u));
        this.userSignal.set(u);
      },
      error: () => {
        /* invalid token — guard will redirect on next protected route */
      },
    });
  }

  logout(): void {
    localStorage.removeItem(TASKS_APP_TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    this.tokenSignal.set(null);
    this.userSignal.set(null);
  }
}
