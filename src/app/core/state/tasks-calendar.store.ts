import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { addDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { firstValueFrom } from 'rxjs';
import type { CalendarPayload, CalendarTaskRow, CalendarTaskTypeMeta } from '../../models/calendar.types';
import type {
  DeliveredPaymentRow,
  DeliveredPaymentsPagination,
  TrackingEventRow,
  TrackingUserRow,
  TrackingUserView,
} from '../services/tasks-api.service';
import { TasksApiService } from '../services/tasks-api.service';

export type TasksCalendarView = 'month' | 'week' | 'day';
export type TaskPaidFilter = '' | 'paid' | 'unpaid';

export interface TasksCalendarFilters {
  technicianId: string;
  clientId: string;
  status: string;
  taskType: string;
  paid: TaskPaidFilter;
}

export interface FilterPersonOption {
  id: string;
  name: string;
  image: string | null;
}

/**
 * Calendar data: one month API payload (full month grid incl. leading/trailing spill days)
 * shared by month / week / day views. Switching view does not refetch; only changing the
 * anchor month (or first load) does.
 */
@Injectable({ providedIn: 'root' })
export class TasksCalendarStore {
  private readonly api = inject(TasksApiService);

  readonly calendarPayload = signal<CalendarPayload | null>(null);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Reference date: visible month, week containing this date, or this day. */
  readonly anchorDate = signal<Date>(new Date());

  readonly viewMode = signal<TasksCalendarView>('month');

  /** Right-rail filter control; attach filter UI to this signal when ready. */
  readonly filterPanelOpen = signal(false);

  /** Paiements remis à l'administration (same data as Laravel tasks index modal). */
  private readonly _paymentsDrawerOpen = signal(false);
  readonly deliveredPaymentsLoading = signal(false);
  readonly deliveredPaymentsError = signal<string | null>(null);
  readonly deliveredPaymentsList = signal<DeliveredPaymentRow[]>([]);
  private readonly deliveredPaymentsPageState = signal<DeliveredPaymentsPagination>({
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 0,
  });

  /** Snapshot for templates (`store.deliveredPaymentsPage()`). */
  deliveredPaymentsPage(): DeliveredPaymentsPagination {
    return this.deliveredPaymentsPageState();
  }

  /** Panel ouvert / fermé — utilisé par le rail et la page tâches. */
  paymentsDrawerOpen(): boolean {
    return this._paymentsDrawerOpen();
  }

  private readonly _createTaskDrawerOpen = signal(false);
  private readonly _taskDetailsDrawerOpen = signal(false);
  readonly selectedTaskDetailsId = signal<number | null>(null);

  createTaskDrawerOpen(): boolean {
    return this._createTaskDrawerOpen();
  }

  taskDetailsDrawerOpen(): boolean {
    return this._taskDetailsDrawerOpen();
  }

  private readonly _trackingDrawerOpen = signal(false);
  readonly trackingUsers = signal<TrackingUserView[]>([]);
  readonly trackingUsersLoading = signal(false);
  readonly trackingUsersError = signal<string | null>(null);
  readonly trackingEvents = signal<TrackingEventRow[]>([]);
  readonly trackingEventsLoading = signal(false);
  readonly trackingEventsError = signal<string | null>(null);
  readonly selectedTrackingUserId = signal<number | null>(null);
  readonly trackingDate = signal<string>(format(new Date(), 'yyyy-MM-dd'));

  trackingDrawerOpen(): boolean {
    return this._trackingDrawerOpen();
  }

  readonly filters = signal<TasksCalendarFilters>({
    technicianId: '',
    clientId: '',
    status: '',
    taskType: '',
    paid: '',
  });

  /**
   * Incremented on each “new task” action from the shell rail.
   * Subscribe (e.g. `effect` in tasks page) to open a form or navigate.
   */
  readonly newTaskRequestSeq = signal(0);
  private readonly createTaskModalTicketSignal = signal(0);
  private readonly createTaskModalDateSignal = signal(format(new Date(), 'yyyy-MM-dd'));
  readonly hasActiveFilters = computed(() => {
    const f = this.filters();
    return !!(f.technicianId || f.clientId || f.status || f.taskType || f.paid);
  });

  readonly filterTechnicians = computed<FilterPersonOption[]>(() => {
    const meta = this.calendarPayload()?.meta?.technicians;
    if (meta?.length) {
      return meta
        .map((row) => ({
          id: String(row.id),
          name: row.name?.trim() || 'Utilisateur',
          image: row.image ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }
    const byId = new Map<string, FilterPersonOption>();
    for (const t of this.allTasksFlat()) {
      if (t.technician_id == null) {
        continue;
      }
      const id = String(t.technician_id);
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          name: t.technician_name?.trim() || 'Technicien',
          image: t.technician_image ?? null,
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  });

  readonly filterClients = computed<FilterPersonOption[]>(() => {
    const meta = this.calendarPayload()?.meta?.clients;
    if (meta?.length) {
      return meta
        .map((row) => ({
          id: String(row.id),
          name: row.name?.trim() || 'Client',
          image: row.image ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }
    const byId = new Map<string, FilterPersonOption>();
    for (const t of this.allTasksFlat()) {
      if (t.client_id == null) {
        continue;
      }
      const id = String(t.client_id);
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          name: t.client_name?.trim() || 'Client',
          image: t.client_image ?? null,
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  });

  /** Option value is task_type string as stored on tasks (matches task_types.name). */
  readonly filterTaskTypes = computed<CalendarTaskTypeMeta[]>(() => {
    const meta = this.calendarPayload()?.meta?.task_types;
    if (meta?.length) {
      return [...meta].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }
    const seen = new Set<string>();
    const fromTasks: CalendarTaskTypeMeta[] = [];
    let syntheticId = 0;
    for (const t of this.allTasksFlat()) {
      const v = (t.task_type ?? '').trim();
      if (!v || seen.has(v)) {
        continue;
      }
      seen.add(v);
      fromTasks.push({ id: --syntheticId, name: v });
    }
    return fromTasks.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  });

  readonly filteredPayload = computed<CalendarPayload | null>(() => {
    const payload = this.calendarPayload();
    if (!payload) {
      return null;
    }
    const f = this.filters();
    if (!(f.technicianId || f.clientId || f.status || f.taskType || f.paid)) {
      return payload;
    }
    const byTask = (task: CalendarTaskRow): boolean => {
      if (f.technicianId && String(task.technician_id ?? '') !== f.technicianId) {
        return false;
      }
      if (f.clientId && String(task.client_id ?? '') !== f.clientId) {
        return false;
      }
      if (f.status && task.status !== f.status) {
        return false;
      }
      if (f.taskType && (task.task_type ?? '') !== f.taskType) {
        return false;
      }
      if (f.paid === 'paid' && !task.is_paid) {
        return false;
      }
      if (f.paid === 'unpaid' && !!task.is_paid) {
        return false;
      }
      return true;
    };

    const tasks: Record<string, CalendarTaskRow[]> = {};
    for (const [date, rows] of Object.entries(payload.tasks ?? {})) {
      const keep = (rows ?? []).filter(byTask);
      if (keep.length > 0) {
        tasks[date] = keep;
      }
    }

    const deployments: CalendarPayload['deployments'] = {};
    for (const [date, deps] of Object.entries(payload.deployments ?? {})) {
      deployments[date] = (deps ?? []).map((dep) => {
        const keepTasks = (dep.tasks ?? []).filter(byTask);
        return {
          ...dep,
          tasks: keepTasks,
          tasks_count: keepTasks.length,
        };
      });
    }

    return { tasks, deployments };
  });

  readonly filteredTasksCount = computed(() => {
    const payload = this.filteredPayload();
    if (!payload) {
      return 0;
    }
    let count = 0;
    for (const rows of Object.values(payload.tasks ?? {})) {
      count += (rows ?? []).length;
    }
    for (const deps of Object.values(payload.deployments ?? {})) {
      for (const dep of deps ?? []) {
        count += (dep.tasks ?? []).length;
      }
    }
    return count;
  });

  /** `start|end` yyyy-MM-dd range of the last successful month fetch (grid range). */
  private readonly loadedRangeKey = signal<string | null>(null);

  /** Same visible date span as the month grid (Mon-start weeks), so spill days are included. */
  private apiRangeForAnchor(ref: Date): { start: string; end: string } {
    const monthStart = startOfMonth(ref);
    const monthEnd = endOfMonth(ref);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return {
      start: format(gridStart, 'yyyy-MM-dd'),
      end: format(gridEnd, 'yyyy-MM-dd'),
    };
  }

  private rangeKeyFor(ref: Date): string {
    const { start, end } = this.apiRangeForAnchor(ref);
    return `${start}|${end}`;
  }

  private needsFetch(): boolean {
    const ref = this.anchorDate();
    return this.calendarPayload() === null || this.loadedRangeKey() !== this.rangeKeyFor(ref);
  }

  private allTasksFlat(): CalendarTaskRow[] {
    const payload = this.calendarPayload();
    if (!payload) {
      return [];
    }
    const rows: CalendarTaskRow[] = [];
    for (const list of Object.values(payload.tasks ?? {})) {
      rows.push(...(list ?? []));
    }
    for (const deps of Object.values(payload.deployments ?? {})) {
      for (const dep of deps ?? []) {
        rows.push(...(dep.tasks ?? []));
      }
    }
    return rows;
  }

  /**
   * Load data only if the anchor’s month grid is not already in memory.
   */
  async ensureLoaded(): Promise<void> {
    if (!this.needsFetch()) {
      return;
    }
    await this.refresh();
  }

  /**
   * Force a network reload for the anchor’s current month grid (e.g. retry after error).
   */
  async refresh(): Promise<void> {
    const ref = this.anchorDate();
    const { start, end } = this.apiRangeForAnchor(ref);
    const rangeKey = `${start}|${end}`;

    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await firstValueFrom(this.api.getCalendarMonth(start, end));
      this.calendarPayload.set(data);
      this.loadedRangeKey.set(rangeKey);
    } catch (e: unknown) {
      let message = 'Impossible de charger les tâches.';
      if (e instanceof HttpErrorResponse) {
        const body = e.error;
        if (typeof body === 'object' && body !== null && 'message' in body) {
          const m = (body as { message: unknown }).message;
          if (typeof m === 'string') {
            message = m;
          }
        } else if (e.status === 403) {
          message = 'Accès refusé (permission tâches requise).';
        } else if (e.status === 401) {
          message = 'Session expirée. Reconnectez-vous.';
        }
      } else if (e instanceof Error) {
        message = e.message;
      }
      this.error.set(message);
      this.calendarPayload.set(null);
      this.loadedRangeKey.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  setViewMode(mode: TasksCalendarView): void {
    this.viewMode.set(mode);
    void this.ensureLoaded();
  }

  setAnchorDate(d: Date): void {
    this.anchorDate.set(d);
    void this.ensureLoaded();
  }

  shiftAnchor(unit: 'month' | 'week' | 'day', delta: number): void {
    const ref = this.anchorDate();
    const next = new Date(ref);
    if (unit === 'month') {
      next.setMonth(next.getMonth() + delta);
    } else if (unit === 'week') {
      next.setDate(next.getDate() + delta * 7);
    } else {
      next.setDate(next.getDate() + delta);
    }
    this.setAnchorDate(next);
  }

  toggleFilterPanel(): void {
    this._paymentsDrawerOpen.set(false);
    this._createTaskDrawerOpen.set(false);
    this._taskDetailsDrawerOpen.set(false);
    this.filterPanelOpen.update((open) => !open);
  }

  closeFilterPanel(): void {
    this.filterPanelOpen.set(false);
  }

  toggleDeliveredPaymentsPanel(): void {
    if (this._paymentsDrawerOpen()) {
      this.closeDeliveredPaymentsPanel();
      return;
    }
    this.filterPanelOpen.set(false);
    this._trackingDrawerOpen.set(false);
    this._createTaskDrawerOpen.set(false);
    this._taskDetailsDrawerOpen.set(false);
    this._paymentsDrawerOpen.set(true);
    void this.loadDeliveredPayments(1);
  }

  closeDeliveredPaymentsPanel(): void {
    this._paymentsDrawerOpen.set(false);
  }

  async loadDeliveredPayments(page: number): Promise<void> {
    const perPage = this.deliveredPaymentsPageState().per_page || 10;
    this.deliveredPaymentsLoading.set(true);
    this.deliveredPaymentsError.set(null);
    this.deliveredPaymentsList.set([]);
    try {
      const data = await firstValueFrom(this.api.getDeliveredPayments(page, perPage));
      this.deliveredPaymentsList.set(Array.isArray(data.list) ? data.list : []);
      this.deliveredPaymentsPageState.set(
        data.pagination ?? { current_page: 1, last_page: 1, per_page: perPage, total: 0 },
      );
    } catch (e: unknown) {
      let message = 'Impossible de charger les paiements.';
      if (e instanceof HttpErrorResponse) {
        if (e.status === 403) {
          message = 'Accès refusé.';
        } else if (e.status === 401) {
          message = 'Session expirée. Reconnectez-vous.';
        }
      } else if (e instanceof Error) {
        message = e.message;
      }
      this.deliveredPaymentsError.set(message);
      this.deliveredPaymentsList.set([]);
      this.deliveredPaymentsPageState.set({
        current_page: 1,
        last_page: 1,
        per_page: perPage,
        total: 0,
      });
    } finally {
      this.deliveredPaymentsLoading.set(false);
    }
  }

  toggleTrackingDrawer(): void {
    if (this._trackingDrawerOpen()) {
      this.closeTrackingDrawer();
      return;
    }
    this.filterPanelOpen.set(false);
    this._paymentsDrawerOpen.set(false);
    this._createTaskDrawerOpen.set(false);
    this._taskDetailsDrawerOpen.set(false);
    this._trackingDrawerOpen.set(true);
    if (this.trackingUsers().length === 0) {
      void this.loadTrackingUsers();
    } else {
      this.refreshTrackingUsersAvailability();
    }
    if (this.selectedTrackingUserId() != null) {
      void this.loadTrackingEvents();
    }
  }

  closeTrackingDrawer(): void {
    this._trackingDrawerOpen.set(false);
  }

  private userAvailableOnTrackingDate(user: TrackingUserRow, date: string): boolean {
    for (const leave of user.leave_requests ?? []) {
      if (date >= leave.start_date && date <= leave.end_date) {
        return false;
      }
    }
    return true;
  }

  private mapTrackingUsers(rows: TrackingUserRow[], date: string): TrackingUserView[] {
    return rows.map((u) => ({
      ...u,
      available: this.userAvailableOnTrackingDate(u, date),
    }));
  }

  refreshTrackingUsersAvailability(): void {
    const date = this.trackingDate();
    this.trackingUsers.update((list) =>
      this.mapTrackingUsers(
        list.map(({ available: _a, ...rest }) => rest),
        date,
      ),
    );
  }

  async loadTrackingUsers(): Promise<void> {
    this.trackingUsersLoading.set(true);
    this.trackingUsersError.set(null);
    try {
      const rows = await firstValueFrom(this.api.getTrackingUsers());
      const date = this.trackingDate();
      this.trackingUsers.set(this.mapTrackingUsers(Array.isArray(rows) ? rows : [], date));
    } catch (e: unknown) {
      let message = 'Impossible de charger les utilisateurs.';
      if (e instanceof HttpErrorResponse) {
        if (e.status === 403) {
          message = 'Accès refusé (suivi).';
        } else if (e.status === 401) {
          message = 'Session expirée. Reconnectez-vous.';
        }
      } else if (e instanceof Error) {
        message = e.message;
      }
      this.trackingUsersError.set(message);
      this.trackingUsers.set([]);
    } finally {
      this.trackingUsersLoading.set(false);
    }
  }

  setTrackingDate(date: string): void {
    this.trackingDate.set(date);
    this.trackingUsers.update((list) => {
      const base: TrackingUserRow[] = list.map(({ available: _a, ...rest }) => rest);
      return this.mapTrackingUsers(base, date);
    });
    const sel = this.selectedTrackingUserId();
    if (sel != null) {
      const u = this.trackingUsers().find((x) => x.id === sel);
      if (!u?.available) {
        this.selectedTrackingUserId.set(null);
        this.trackingEvents.set([]);
      } else {
        void this.loadTrackingEvents();
      }
    }
  }

  shiftTrackingWeek(delta: number): void {
    const current = parseISO(this.trackingDate());
    const monday = startOfWeek(current, { weekStartsOn: 1 });
    const newMonday = addDays(monday, delta * 7);
    const offsetFromMonday = current.getDay() === 0 ? 6 : current.getDay() - 1;
    const newDate = addDays(newMonday, offsetFromMonday);
    this.setTrackingDate(format(newDate, 'yyyy-MM-dd'));
  }

  selectTrackingUser(userId: number, available: boolean): void {
    if (!available) {
      return;
    }
    this.selectedTrackingUserId.set(userId);
    void this.loadTrackingEvents();
  }

  async loadTrackingEvents(): Promise<void> {
    const uid = this.selectedTrackingUserId();
    if (uid == null) {
      this.trackingEvents.set([]);
      return;
    }
    const date = this.trackingDate();
    this.trackingEventsLoading.set(true);
    this.trackingEventsError.set(null);
    try {
      const data = await firstValueFrom(this.api.getTrackingEvents(uid, date));
      this.trackingEvents.set(Array.isArray(data.tracking) ? data.tracking : []);
    } catch (e: unknown) {
      let message = 'Impossible de charger le suivi.';
      if (e instanceof HttpErrorResponse) {
        if (e.status === 403) {
          message = 'Accès refusé.';
        } else if (e.status === 401) {
          message = 'Session expirée. Reconnectez-vous.';
        }
      } else if (e instanceof Error) {
        message = e.message;
      }
      this.trackingEventsError.set(message);
      this.trackingEvents.set([]);
    } finally {
      this.trackingEventsLoading.set(false);
    }
  }

  updateFilters(patch: Partial<TasksCalendarFilters>): void {
    this.filters.update((cur) => ({ ...cur, ...patch }));
  }

  clearFilters(): void {
    this.filters.set({
      technicianId: '',
      clientId: '',
      status: '',
      taskType: '',
      paid: '',
    });
  }

  requestNewTask(): void {
    this.newTaskRequestSeq.update((n) => n + 1);
  }

  createTaskModalTicket(): number {
    return this.createTaskModalTicketSignal();
  }

  createTaskModalDate(): string {
    return this.createTaskModalDateSignal();
  }

  openCreateTaskModal(date: string): void {
    this.closeFilterPanel();
    this.closeDeliveredPaymentsPanel();
    this.closeTrackingDrawer();
    this.closeTaskDetailsModal();
    this._createTaskDrawerOpen.set(true);
    this.createTaskModalDateSignal.set(date);
    this.createTaskModalTicketSignal.update((n) => n + 1);
  }

  closeCreateTaskModal(): void {
    this._createTaskDrawerOpen.set(false);
  }

  openTaskDetailsModal(taskId: number): void {
    this.closeFilterPanel();
    this.closeDeliveredPaymentsPanel();
    this.closeTrackingDrawer();
    this.closeCreateTaskModal();
    this.selectedTaskDetailsId.set(taskId);
    this._taskDetailsDrawerOpen.set(true);
  }

  closeTaskDetailsModal(): void {
    this._taskDetailsDrawerOpen.set(false);
    this.selectedTaskDetailsId.set(null);
  }

  /**
   * Insert newly created standalone task into in-memory calendar without full refetch.
   * Only inserts when task date is inside currently loaded month grid range.
   */
  insertCreatedTask(row: CalendarTaskRow): void {
    const payload = this.calendarPayload();
    if (!payload) {
      return;
    }
    if (row.deployment_id != null) {
      return;
    }
    const date = String(row.task_date ?? '').slice(0, 10);
    if (!date || !this.isDateInLoadedRange(date)) {
      return;
    }

    const current = payload.tasks?.[date] ?? [];
    if (current.some((t) => t.id === row.id)) {
      return;
    }

    const nextTasks = { ...(payload.tasks ?? {}) };
    nextTasks[date] = [row, ...current];

    const nextMeta = payload.meta
      ? {
          ...payload.meta,
          technicians: this.upsertMetaPerson(payload.meta.technicians ?? [], row.technician_id, row.technician_name, row.technician_image ?? null),
          clients: this.upsertMetaPerson(payload.meta.clients ?? [], row.client_id, row.client_name, row.client_image ?? null),
          task_types: this.upsertMetaTaskType(payload.meta.task_types ?? [], row.task_type),
        }
      : payload.meta;

    this.calendarPayload.set({
      ...payload,
      tasks: nextTasks,
      meta: nextMeta,
    });
  }

  private isDateInLoadedRange(dateYmd: string): boolean {
    const key = this.loadedRangeKey();
    if (!key) {
      return false;
    }
    const [start, end] = key.split('|');
    if (!start || !end) {
      return false;
    }
    return dateYmd >= start && dateYmd <= end;
  }

  private upsertMetaPerson(
    list: { id: number; name: string; image: string | null }[],
    id: number | null,
    name: string | null,
    image: string | null,
  ): { id: number; name: string; image: string | null }[] {
    if (id == null) {
      return list;
    }
    if (list.some((x) => x.id === id)) {
      return list;
    }
    return [...list, { id, name: name?.trim() || 'Utilisateur', image: image ?? null }].sort((a, b) =>
      a.name.localeCompare(b.name, 'fr'),
    );
  }

  private upsertMetaTaskType(
    list: { id: number; name: string }[],
    taskType: string | null,
  ): { id: number; name: string }[] {
    const name = taskType?.trim();
    if (!name) {
      return list;
    }
    if (list.some((x) => x.name === name)) {
      return list;
    }
    const syntheticId = list.length > 0 ? Math.min(...list.map((x) => x.id)) - 1 : -1;
    return [...list, { id: syntheticId, name }].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }
}
