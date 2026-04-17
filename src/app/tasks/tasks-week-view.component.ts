import { Component, inject } from '@angular/core';
import { eachDayOfInterval, endOfWeek, format, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { dateKey, deploymentsOnDate, standaloneTasksOnDate } from '../core/calendar/calendar.helpers';
import { TasksCalendarStore } from '../core/state/tasks-calendar.store';
import type { CalendarDeploymentBlock, CalendarTaskRow } from '../models/calendar.types';
import { CalendarDeploymentExpandableComponent } from './calendar-deployment-expandable.component';
import { CalendarTaskCardComponent } from './calendar-task-card.component';

export type WeekDayCard =
  | {
      kind: 'task';
      trackId: string;
      task: CalendarTaskRow;
      deploymentLabel: string | null;
    }
  | {
      kind: 'deployment';
      trackId: string;
      deployment: CalendarDeploymentBlock;
    };

@Component({
  selector: 'app-tasks-week-view',
  standalone: true,
  imports: [CalendarTaskCardComponent, CalendarDeploymentExpandableComponent],
  templateUrl: './tasks-week-view.component.html',
  styleUrl: './tasks-week-view.component.scss',
})
export class TasksWeekViewComponent {
  protected readonly store = inject(TasksCalendarStore);

  weekDays(): Date[] {
    const ref = this.store.anchorDate();
    const start = startOfWeek(ref, { weekStartsOn: 1 });
    const end = endOfWeek(ref, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }

  dayLabel(d: Date): string {
    return format(d, 'EEE d', { locale: fr });
  }

  cardsForDay(d: Date): WeekDayCard[] {
    const payload = this.store.filteredPayload();
    const key = dateKey(d);
    const out: WeekDayCard[] = [];
    let i = 0;

    for (const dep of deploymentsOnDate(payload, key)) {
      out.push({
        kind: 'deployment',
        trackId: `dep-${dep.id}-${key}-${i++}`,
        deployment: dep,
      });
    }

    for (const t of standaloneTasksOnDate(payload, key)) {
      out.push({
        kind: 'task',
        trackId: `task-${t.id}-${i++}`,
        task: t,
        deploymentLabel: null,
      });
    }

    return out;
  }
}
