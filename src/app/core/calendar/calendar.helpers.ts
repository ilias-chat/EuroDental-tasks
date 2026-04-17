import { format } from 'date-fns';
import type { CalendarDeploymentBlock, CalendarPayload, CalendarTaskRow } from '../../models/calendar.types';

export function deploymentsOnDate(payload: CalendarPayload | null, dateKey: string): CalendarDeploymentBlock[] {
  if (!payload?.deployments) {
    return [];
  }
  const v = payload.deployments[dateKey];
  return Array.isArray(v) ? v : [];
}

export function standaloneTasksOnDate(payload: CalendarPayload | null, dateKey: string): CalendarTaskRow[] {
  if (!payload?.tasks) {
    return [];
  }
  const v = payload.tasks[dateKey];
  return Array.isArray(v) ? v : [];
}

export function dateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}
