import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { ThemeService } from '../core/services/theme.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeService);

  email = '';
  password = '';
  readonly loginError = signal<string | null>(null);
  readonly loginPending = signal(false);

  async doLogin(): Promise<void> {
    this.loginError.set(null);
    this.loginPending.set(true);
    try {
      await firstValueFrom(this.auth.login(this.email, this.password));
      await this.router.navigateByUrl('/tasks');
    } catch (e: unknown) {
      if (e instanceof HttpErrorResponse) {
        const msg =
          e.error && typeof e.error === 'object' && 'message' in e.error && typeof (e.error as { message: unknown }).message === 'string'
            ? (e.error as { message: string }).message
            : 'Identifiants invalides.';
        this.loginError.set(msg);
      } else {
        this.loginError.set('Erreur de connexion.');
      }
    } finally {
      this.loginPending.set(false);
    }
  }

  toggleTheme(): void {
    this.theme.toggle();
  }
}
