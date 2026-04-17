import { Routes } from '@angular/router';
import { LoginPageComponent } from './auth/login-page.component';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { AppShellComponent } from './layout/app-shell.component';
import { TasksPageComponent } from './tasks/tasks-page.component';

export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tasks' },
      {
        path: 'login',
        component: LoginPageComponent,
        canActivate: [guestGuard],
      },
      {
        path: 'tasks',
        component: TasksPageComponent,
        canActivate: [authGuard],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
