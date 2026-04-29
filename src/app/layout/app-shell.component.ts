import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { ThemeService } from '../core/services/theme.service';
import { TasksCalendarStore } from '../core/state/tasks-calendar.store';
import { CreateTaskModalComponent } from '../tasks/create-task-modal/create-task-modal.component';
import { TaskDetailsModalComponent } from '../tasks/task-details-modal/task-details-modal.component';
import { ToastContainerComponent } from '../shared/toast-container.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CreateTaskModalComponent, TaskDetailsModalComponent, ToastContainerComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly tasksStore = inject(TasksCalendarStore);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  readonly sidebarCollapsed = signal(true);

  /** Matches API middleware `CheckPermission:tasks_tracking` for `/tasks/tracking/*`. */
  readonly canUseTaskTracking = computed(() =>
    (this.auth.user()?.permissions ?? []).includes('tasks_tracking'),
  );

  ngOnInit(): void {
    this.auth.syncUserFromMe();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  onRailNewTask(): void {
    const date = new Date().toISOString().slice(0, 10);
    this.tasksStore.openCreateTaskModal(date);
  }

  onRailToggleFilter(): void {
    this.tasksStore.toggleFilterPanel();
  }

  onRailToggleDeliveredPayments(): void {
    this.tasksStore.toggleDeliveredPaymentsPanel();
  }

  onRailToggleTracking(): void {
    this.tasksStore.toggleTrackingDrawer();
  }

  onToggleTheme(): void {
    this.theme.toggle();
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }

  userInitial(): string {
    const name = this.auth.user()?.name?.trim();
    if (!name) {
      return '?';
    }
    return name.charAt(0).toUpperCase();
  }

  /** Full name for display (uppercase in template via CSS or here). */
  fullNameUpper(): string {
    const n = this.auth.user()?.name?.trim();
    return n ? n.toUpperCase() : 'UTILISATEUR';
  }

  profileLabel(): string {
    return this.auth.user()?.profile?.trim() || '—';
  }
}
