import { Component, computed, inject, signal } from '@angular/core';
import { format } from 'date-fns';
import { avatarFallbackUrl } from '../core/calendar/task-card.helpers';
import { deploymentsOnDate, standaloneTasksOnDate } from '../core/calendar/calendar.helpers';
import type { CalendarDeploymentBlock, CalendarTaskRow } from '../models/calendar.types';
import { TasksCalendarStore } from '../core/state/tasks-calendar.store';
import { CalendarDeploymentExpandableComponent } from './calendar-deployment-expandable.component';
import { CalendarTaskCardComponent } from './calendar-task-card.component';

export type DayViewLayout = 'technician' | 'status';

export interface DayTaskEntry {
  task: CalendarTaskRow;
  deploymentLabel: string | null;
}

export type DayTechnicianSegment =
  | { kind: 'standalone'; entry: DayTaskEntry }
  | { kind: 'deployment'; deployment: CalendarDeploymentBlock; tasks: CalendarTaskRow[] };

function buildTechnicianSegments(
  entries: DayTaskEntry[],
  deployments: CalendarDeploymentBlock[],
): DayTechnicianSegment[] {
  const depById = new Map(deployments.map((d) => [d.id, d]));
  const sorted = [...entries].sort((a, b) => a.task.id - b.task.id);
  const out: DayTechnicianSegment[] = [];
  let i = 0;
  while (i < sorted.length) {
    const e = sorted[i];
    const depId = e.task.deployment_id;
    if (depId == null) {
      out.push({ kind: 'standalone', entry: e });
      i++;
      continue;
    }
    const chunkEntries: DayTaskEntry[] = [];
    while (i < sorted.length && sorted[i].task.deployment_id === depId) {
      chunkEntries.push(sorted[i]);
      i++;
    }
    const dep = depById.get(depId);
    if (dep) {
      out.push({ kind: 'deployment', deployment: dep, tasks: chunkEntries.map((c) => c.task) });
    } else {
      for (const ent of chunkEntries) {
        out.push({ kind: 'standalone', entry: ent });
      }
    }
  }
  return out;
}

/** One week-style column: header + scrollable task cards for that technician. */
export interface DayTechnicianColumn {
  key: string;
  name: string;
  image: string | null;
  count: number;
  entries: DayTaskEntry[];
  segments: DayTechnicianSegment[];
}

export interface DeploymentTasksSlice {
  deployment: CalendarDeploymentBlock;
  tasks: CalendarTaskRow[];
}

@Component({
  selector: 'app-tasks-day-view',
  standalone: true,
  imports: [CalendarTaskCardComponent, CalendarDeploymentExpandableComponent],
  templateUrl: './tasks-day-view.component.html',
  styleUrl: './tasks-day-view.component.scss',
})
export class TasksDayViewComponent {
  protected readonly store = inject(TasksCalendarStore);

  readonly dayLayout = signal<DayViewLayout>('technician');

  readonly statusColumns = [
    { status: 'en attente', label: 'En attente' },
    { status: 'en cours', label: 'En cours' },
    { status: 'terminée', label: 'Terminée' },
  ] as const;

  dayKey(): string {
    return format(this.store.anchorDate(), 'yyyy-MM-dd');
  }

  deploymentsForDay(): CalendarDeploymentBlock[] {
    return deploymentsOnDate(this.store.filteredPayload(), this.dayKey());
  }

  standaloneForDay(): CalendarTaskRow[] {
    return standaloneTasksOnDate(this.store.filteredPayload(), this.dayKey());
  }

  readonly flatEntries = computed((): DayTaskEntry[] => {
    const out: DayTaskEntry[] = [];
    for (const dep of this.deploymentsForDay()) {
      const label = dep.title?.trim() || 'Déploiement';
      for (const t of dep.tasks) {
        out.push({ task: t, deploymentLabel: label });
      }
    }
    for (const t of this.standaloneForDay()) {
      out.push({ task: t, deploymentLabel: null });
    }
    return out;
  });

  readonly technicianColumns = computed((): DayTechnicianColumn[] => {
    const byId = new Map<string, { name: string; image: string | null; entries: DayTaskEntry[] }>();

    for (const e of this.flatEntries()) {
      const tid = e.task.technician_id;
      const key = tid == null ? 'unassigned' : String(tid);
      const name =
        tid == null ? 'Non assigné' : e.task.technician_name?.trim() || 'Technicien';
      const image = e.task.technician_image ?? null;
      let g = byId.get(key);
      if (!g) {
        g = { name, image, entries: [] };
        byId.set(key, g);
      }
      g.entries.push(e);
    }

    for (const g of byId.values()) {
      g.entries.sort((a, b) => a.task.id - b.task.id);
    }

    const deployments = this.deploymentsForDay();
    return [...byId.entries()]
      .map(([key, v]) => ({
        key,
        name: v.name,
        image: v.image,
        count: v.entries.length,
        entries: v.entries,
        segments: buildTechnicianSegments(v.entries, deployments),
      }))
      .sort((a, b) => {
        if (a.key === 'unassigned') {
          return 1;
        }
        if (b.key === 'unassigned') {
          return -1;
        }
        return a.name.localeCompare(b.name, 'fr');
      });
  });

  columnAvatarSrc(col: DayTechnicianColumn): string {
    if (col.image) {
      return col.image;
    }
    return avatarFallbackUrl(col.name);
  }

  setDayLayout(mode: DayViewLayout): void {
    this.dayLayout.set(mode);
  }

  segmentTrack(seg: DayTechnicianSegment): string {
    if (seg.kind === 'deployment') {
      return `dep-${seg.deployment.id}`;
    }
    return `task-${seg.entry.task.id}`;
  }

  deploymentsForStatus(status: string): DeploymentTasksSlice[] {
    return this.deploymentsForDay()
      .map((deployment) => ({
        deployment,
        tasks: deployment.tasks.filter((t) => t.status === status),
      }))
      .filter((slice) => slice.tasks.length > 0);
  }

  standaloneForStatus(status: string): CalendarTaskRow[] {
    return this.standaloneForDay()
      .filter((t) => t.status === status)
      .sort((a, b) => a.id - b.id);
  }

  totalTasksForStatus(status: string): number {
    let n = this.standaloneForStatus(status).length;
    for (const slice of this.deploymentsForStatus(status)) {
      n += slice.tasks.length;
    }
    return n;
  }

  hasAnyTasksForDay(): boolean {
    return this.flatEntries().length > 0;
  }
}
