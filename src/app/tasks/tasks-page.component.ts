import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { addDays, endOfWeek, format, getDay, parseISO, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { TrackingEventRow, TrackingUserView } from '../core/services/tasks-api.service';
import { TasksCalendarStore } from '../core/state/tasks-calendar.store';
import { TasksDayViewComponent } from './tasks-day-view.component';
import { TasksMonthViewComponent } from './tasks-month-view.component';
import { TasksWeekViewComponent } from './tasks-week-view.component';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [TasksMonthViewComponent, TasksWeekViewComponent, TasksDayViewComponent],
  templateUrl: './tasks-page.component.html',
  styleUrl: './tasks-page.component.scss',
})
export class TasksPageComponent implements OnInit {
  protected readonly store = inject(TasksCalendarStore);
  readonly techFilterSearch = signal('');
  readonly clientFilterSearch = signal('');
  readonly techFilterDropdownOpen = signal(false);
  readonly clientFilterDropdownOpen = signal(false);

  readonly periodLabel = computed(() => {
    const ref = this.store.anchorDate();
    const mode = this.store.viewMode();
    if (mode === 'month') {
      return format(ref, 'MMMM yyyy', { locale: fr });
    }
    if (mode === 'week') {
      const ws = startOfWeek(ref, { weekStartsOn: 1 });
      const we = endOfWeek(ref, { weekStartsOn: 1 });
      return `${format(ws, 'd MMM', { locale: fr })} – ${format(we, 'd MMM yyyy', { locale: fr })}`;
    }
    return format(ref, 'EEEE d MMMM yyyy', { locale: fr });
  });

  readonly filteredTechnicians = computed(() => {
    const q = this.techFilterSearch().trim().toLowerCase();
    if (!q) {
      return this.store.filterTechnicians();
    }
    return this.store.filterTechnicians().filter((u) => u.name.toLowerCase().includes(q));
  });

  readonly filteredClients = computed(() => {
    const q = this.clientFilterSearch().trim().toLowerCase();
    if (!q) {
      return this.store.filterClients();
    }
    return this.store.filterClients().filter((c) => c.name.toLowerCase().includes(q));
  });

  readonly selectedTechFilterUser = computed(() => {
    const id = this.store.filters().technicianId;
    if (!id) {
      return null;
    }
    return this.store.filterTechnicians().find((u) => u.id === id) ?? null;
  });

  readonly selectedClientFilterClient = computed(() => {
    const id = this.store.filters().clientId;
    if (!id) {
      return null;
    }
    return this.store.filterClients().find((c) => c.id === id) ?? null;
  });

  readonly deliveredPaymentsRangeLabel = computed(() => {
    const p = this.store.deliveredPaymentsPage();
    const from = (p.current_page - 1) * p.per_page + 1;
    const to = Math.min(p.current_page * p.per_page, p.total);
    return `${from}–${to} sur ${p.total}`;
  });

  private readonly trackingWeekDayShort = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] as const;

  readonly trackingWeekDays = computed(() => {
    const d = parseISO(this.store.trackingDate());
    const monday = startOfWeek(d, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(monday, i);
      return {
        date: format(day, 'yyyy-MM-dd'),
        dayName: this.trackingWeekDayShort[getDay(day)],
        dayNumber: day.getDate(),
      };
    });
  });

  readonly trackingLongDateLabel = computed(() => {
    const d = parseISO(this.store.trackingDate());
    return format(d, 'EEEE d MMMM yyyy', { locale: fr });
  });

  readonly userSearchFilter = signal('');
  readonly userProfileFilter = signal<string[]>([]);
  readonly userStatusFilter = signal<string[]>([]);
  readonly trackingFilterSheetOpen = signal(false);

  readonly filteredTrackingUsers = computed(() => {
    let filtered = this.store.trackingUsers();
    const q = this.userSearchFilter().trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((u) => u.name.toLowerCase().includes(q));
    }
    const pf = this.userProfileFilter();
    if (pf.length > 0) {
      filtered = filtered.filter((u) => u.profile_id != null && pf.includes(String(u.profile_id)));
    }
    const sf = this.userStatusFilter();
    if (sf.length > 0) {
      filtered = filtered.filter((u) => sf.includes(u.last_event_status));
    }
    return filtered;
  });

  readonly trackingProfileOptions = computed(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const u of this.store.trackingUsers()) {
      if (u.profile_id != null) {
        map.set(String(u.profile_id), { id: String(u.profile_id), name: u.profile });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  });

  ngOnInit(): void {
    void this.store.ensureLoaded();
  }

  closeFiltersPanel(): void {
    this.store.closeFilterPanel();
  }

  closeDeliveredPaymentsPanel(): void {
    this.store.closeDeliveredPaymentsPanel();
  }

  closeTrackingPanel(): void {
    this.trackingFilterSheetOpen.set(false);
    this.store.closeTrackingDrawer();
  }

  trackingPrevWeek(): void {
    this.store.shiftTrackingWeek(-1);
  }

  trackingNextWeek(): void {
    this.store.shiftTrackingWeek(1);
  }

  selectTrackingDay(date: string): void {
    this.store.setTrackingDate(date);
  }

  selectTrackingUserCard(user: TrackingUserView): void {
    this.store.selectTrackingUser(user.id, user.available);
  }

  toggleTrackingFilterSheet(): void {
    this.trackingFilterSheetOpen.update((v) => !v);
  }

  closeTrackingFilterSheet(): void {
    this.trackingFilterSheetOpen.set(false);
  }

  setUserSearchFilter(v: string): void {
    this.userSearchFilter.set(v);
  }

  toggleTrackingProfileFilter(profileId: string, checked: boolean): void {
    this.userProfileFilter.update((cur) => {
      const next = new Set(cur);
      if (checked) {
        next.add(profileId);
      } else {
        next.delete(profileId);
      }
      return [...next];
    });
  }

  toggleTrackingStatusFilter(status: string, checked: boolean): void {
    this.userStatusFilter.update((cur) => {
      const next = new Set(cur);
      if (checked) {
        next.add(status);
      } else {
        next.delete(status);
      }
      return [...next];
    });
  }

  resetTrackingFilters(): void {
    this.userSearchFilter.set('');
    this.userProfileFilter.set([]);
    this.userStatusFilter.set([]);
  }

  profileFilterChecked(id: string): boolean {
    return this.userProfileFilter().includes(id);
  }

  statusFilterChecked(status: string): boolean {
    return this.userStatusFilter().includes(status);
  }

  trackingEventLabel(eventType: string): string {
    const labels: Record<string, string> = {
      start_deployment: 'Déplacement',
      finish_deployment: 'Retour',
      start_visit: 'Début visite',
      start_route: 'En route',
      end_route: 'Annulation trajet',
      pause_visit: 'En pause',
      resume_visit: 'Reprise visite',
      finish_visit: 'Fin visite',
      finish_task: 'Tâche terminée',
      cancel_task: 'Tâche annulée',
    };
    return labels[eventType] ?? eventType;
  }

  trackingTimelineDotClass(ev: TrackingEventRow): string {
    const t = ev.event_type;
    if (t === 'start_deployment' || t === 'finish_deployment' || t === 'finish_task') {
      return 'tasks-page__tracking-dot--blue';
    }
    if (t === 'start_visit' || t === 'resume_visit') {
      return 'tasks-page__tracking-dot--yellow';
    }
    if (t === 'start_route') {
      return 'tasks-page__tracking-dot--orange';
    }
    if (t === 'end_route') {
      return 'tasks-page__tracking-dot--gray';
    }
    if (t === 'pause_visit' || t === 'finish_visit') {
      return 'tasks-page__tracking-dot--green';
    }
    if (t === 'cancel_task') {
      return 'tasks-page__tracking-dot--purple';
    }
    return 'tasks-page__tracking-dot--blue';
  }

  trackingPillClass(ev: TrackingEventRow): string {
    const t = ev.event_type;
    if (t === 'start_deployment' || t === 'finish_deployment' || t === 'finish_task') {
      return 'tasks-page__tracking-pill--blue';
    }
    if (t === 'start_visit' || t === 'resume_visit') {
      return 'tasks-page__tracking-pill--yellow';
    }
    if (t === 'start_route') {
      return 'tasks-page__tracking-pill--orange';
    }
    if (t === 'end_route') {
      return 'tasks-page__tracking-pill--gray';
    }
    if (t === 'pause_visit' || t === 'finish_visit') {
      return 'tasks-page__tracking-pill--green';
    }
    if (t === 'cancel_task') {
      return 'tasks-page__tracking-pill--purple';
    }
    return 'tasks-page__tracking-pill--blue';
  }

  showTrackingClientBlock(ev: TrackingEventRow): boolean {
    return !!ev.client_name;
  }

  formatDeliveredAmount(amount: number | null): string {
    if (amount == null || Number.isNaN(Number(amount))) {
      return '—';
    }
    return `${Number(amount).toFixed(2)} DH`;
  }

  goDeliveredPaymentsPage(page: number): void {
    void this.store.loadDeliveredPayments(page);
  }

  clearFilters(): void {
    this.store.clearFilters();
    this.techFilterSearch.set('');
    this.clientFilterSearch.set('');
    this.techFilterDropdownOpen.set(false);
    this.clientFilterDropdownOpen.set(false);
  }

  setTechFilter(id: string): void {
    this.store.updateFilters({ technicianId: id });
    this.techFilterDropdownOpen.set(false);
  }

  setClientFilter(id: string): void {
    this.store.updateFilters({ clientId: id });
    this.clientFilterDropdownOpen.set(false);
  }

  setStatusFilter(v: string): void {
    this.store.updateFilters({ status: v });
  }

  setTypeFilter(v: string): void {
    this.store.updateFilters({ taskType: v });
  }

  setPaidFilter(v: '' | 'paid' | 'unpaid'): void {
    this.store.updateFilters({ paid: v });
  }

  avatarFallback(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`;
  }

  goPrev(): void {
    const mode = this.store.viewMode();
    if (mode === 'month') {
      this.store.shiftAnchor('month', -1);
    } else if (mode === 'week') {
      this.store.shiftAnchor('week', -1);
    } else {
      this.store.shiftAnchor('day', -1);
    }
  }

  goNext(): void {
    const mode = this.store.viewMode();
    if (mode === 'month') {
      this.store.shiftAnchor('month', 1);
    } else if (mode === 'week') {
      this.store.shiftAnchor('week', 1);
    } else {
      this.store.shiftAnchor('day', 1);
    }
  }

  goToday(): void {
    this.store.setAnchorDate(new Date());
  }
}
