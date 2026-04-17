import { Component, inject } from '@angular/core';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { dateKey, deploymentsOnDate, standaloneTasksOnDate } from '../core/calendar/calendar.helpers';
import { formatAmountDh } from '../core/calendar/task-card.helpers';
import { monthTaskCardStatusClass } from '../core/calendar/task-status';
import { TasksCalendarStore } from '../core/state/tasks-calendar.store';

export interface MonthDayLine {
  id: string;
  text: string;
  kind: 'deployment' | 'task';
  urgent: boolean;
  nested?: boolean;
  status: string | null;
  isPaid?: boolean;
  adminDeliveryAmount?: string | number | null;
  /** Deployment row only — stable id for gradient tone */
  deploymentId?: number;
  city?: string | null;
  tasksCount?: number;
}

@Component({
  selector: 'app-tasks-month-view',
  standalone: true,
  templateUrl: './tasks-month-view.component.html',
  styleUrl: './tasks-month-view.component.scss',
})
export class TasksMonthViewComponent {
  protected readonly store = inject(TasksCalendarStore);

  readonly weekdayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  gridDays(): Date[] {
    const ref = this.store.anchorDate();
    const monthStart = startOfMonth(ref);
    const monthEnd = endOfMonth(ref);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }

  weekRowCount(): number {
    return this.gridDays().length / 7;
  }

  isInMonth(d: Date): boolean {
    return isSameMonth(d, this.store.anchorDate());
  }

  taskCardClasses(line: MonthDayLine): string {
    return `cal-month__task-card ${monthTaskCardStatusClass(line.status)}`;
  }

  taskAdminDh(line: MonthDayLine): string {
    if (line.kind !== 'task') {
      return '';
    }
    return formatAmountDh(line.adminDeliveryAmount);
  }

  deploymentCardClass(line: MonthDayLine): string {
    const id = line.deploymentId ?? 0;
    return `cal-month__dep cal-month__dep--tone-${Math.abs(id) % 8}`;
  }

  deploymentTitle(line: MonthDayLine): string {
    const city = line.city?.trim();
    const n = line.tasksCount ?? 0;
    const parts = [line.text, city, `${n} tâche${n === 1 ? '' : 's'}`].filter(Boolean);
    return parts.join(' · ');
  }

  linesForDay(d: Date): MonthDayLine[] {
    const payload = this.store.calendarPayload();
    const key = dateKey(d);
    const lines: MonthDayLine[] = [];
    for (const dep of deploymentsOnDate(payload, key)) {
      const title = dep.title?.trim() || 'Déploiement';
      lines.push({
        id: `${key}-dep-${dep.id}`,
        text: title,
        kind: 'deployment',
        urgent: false,
        status: null,
        deploymentId: dep.id,
        city: dep.city_name?.trim() || null,
        tasksCount: dep.tasks_count ?? dep.tasks?.length ?? 0,
      });
    }
    for (const t of standaloneTasksOnDate(payload, key)) {
      const name = t.task_name?.trim() || 'Tâche';
      lines.push({
        id: `${key}-task-${t.id}`,
        text: name,
        kind: 'task',
        urgent: !!t.urgent,
        nested: false,
        status: t.status,
        isPaid: !!t.is_paid,
        adminDeliveryAmount: t.admin_delivery_amount,
      });
    }
    return lines;
  }
}
