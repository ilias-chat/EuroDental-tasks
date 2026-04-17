import { Component, Input, signal } from '@angular/core';
import type { CalendarDeploymentBlock, CalendarTaskRow } from '../models/calendar.types';
import { CalendarTaskCardComponent } from './calendar-task-card.component';

@Component({
  selector: 'app-calendar-deployment-expandable',
  standalone: true,
  imports: [CalendarTaskCardComponent],
  templateUrl: './calendar-deployment-expandable.component.html',
  styleUrl: './calendar-deployment-expandable.component.scss',
})
export class CalendarDeploymentExpandableComponent {
  @Input({ required: true }) deployment!: CalendarDeploymentBlock;
  /** When set (e.g. day view filtered by status), only these tasks are listed and counted. */
  @Input() tasksOverride: CalendarTaskRow[] | null = null;

  readonly expanded = signal(false);

  headerClasses(): string {
    const id = this.deployment.id ?? 0;
    return `cal-dep-exp__header cal-dep-exp__header--tone-${Math.abs(id) % 8}`;
  }

  headerTitle(): string {
    const title = this.deployment.title?.trim() || 'Déploiement';
    const city = this.deployment.city_name?.trim();
    const n = this.tasksToShow().length;
    const parts = [title, city, `${n} tâche${n === 1 ? '' : 's'}`].filter(Boolean);
    return parts.join(' · ');
  }

  tasksToShow(): CalendarTaskRow[] {
    if (this.tasksOverride !== null && this.tasksOverride !== undefined) {
      return this.tasksOverride;
    }
    return this.deployment.tasks ?? [];
  }

  toggle(): void {
    this.expanded.update((v) => !v);
  }

  onHeaderKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      this.toggle();
    }
  }
}
