import { Component, inject, Input } from '@angular/core';
import {
  formatAmountDh,
  plainDescriptionPreview,
  technicianAvatarSrc,
} from '../core/calendar/task-card.helpers';
import { monthTaskCardStatusClass, taskStatusStripVar } from '../core/calendar/task-status';
import type { CalendarTaskRow } from '../models/calendar.types';
import { TasksCalendarStore } from '../core/state/tasks-calendar.store';

@Component({
  selector: 'app-calendar-task-card',
  standalone: true,
  templateUrl: './calendar-task-card.component.html',
  styleUrl: './calendar-task-card.component.scss',
})
export class CalendarTaskCardComponent {
  private readonly tasksStore = inject(TasksCalendarStore);
  @Input({ required: true }) task!: CalendarTaskRow;
  @Input() deploymentLabel: string | null = null;

  readonly taskStatusStripVar = taskStatusStripVar;
  readonly plainDescriptionPreview = plainDescriptionPreview;
  readonly formatAmountDh = formatAmountDh;
  readonly monthTaskCardStatusClass = monthTaskCardStatusClass;
  readonly technicianAvatarSrc = technicianAvatarSrc;

  taskTitle(): string {
    const name = this.task.task_name?.trim() || 'Tâche';
    return this.task.urgent ? `⚠ ${name}` : name;
  }

  isPaid(): boolean {
    return !!this.task.is_paid;
  }

  isAdminDeliveryTask(): boolean {
    const name = this.task.task_name?.trim() ?? '';
    return name.startsWith("Remise paiement à l'administration");
  }

  openDetails(): void {
    if (this.task?.id != null) {
      this.tasksStore.openTaskDetailsModal(this.task.id);
    }
  }
}
