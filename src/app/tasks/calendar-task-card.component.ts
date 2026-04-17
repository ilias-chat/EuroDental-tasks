import { Component, Input } from '@angular/core';
import {
  formatAmountDh,
  plainDescriptionPreview,
  technicianAvatarSrc,
} from '../core/calendar/task-card.helpers';
import { taskStatusStripVar } from '../core/calendar/task-status';
import type { CalendarTaskRow } from '../models/calendar.types';

@Component({
  selector: 'app-calendar-task-card',
  standalone: true,
  templateUrl: './calendar-task-card.component.html',
  styleUrl: './calendar-task-card.component.scss',
})
export class CalendarTaskCardComponent {
  @Input({ required: true }) task!: CalendarTaskRow;
  @Input() deploymentLabel: string | null = null;

  readonly taskStatusStripVar = taskStatusStripVar;
  readonly plainDescriptionPreview = plainDescriptionPreview;
  readonly formatAmountDh = formatAmountDh;
  readonly technicianAvatarSrc = technicianAvatarSrc;

  taskTitle(): string {
    const name = this.task.task_name?.trim() || 'Tâche';
    return this.task.urgent ? `⚠ ${name}` : name;
  }

  isPaid(): boolean {
    return !!this.task.is_paid;
  }
}
