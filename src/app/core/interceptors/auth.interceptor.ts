import { HttpInterceptorFn } from '@angular/common/http';

export const TASKS_APP_TOKEN_STORAGE_KEY = 'tasks_app_token';

export function readStoredToken(): string | null {
  return localStorage.getItem(TASKS_APP_TOKEN_STORAGE_KEY);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = readStoredToken();
  if (!token) {
    return next(req);
  }
  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
