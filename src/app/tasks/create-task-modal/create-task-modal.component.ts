import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import type {
  CreateTaskClientRow,
  CreateTaskPayload,
  CreateTaskTechnicianRow,
  CreateTaskTypeRow,
  CreateTaskUserRow,
} from '../../core/services/tasks-api.service';
import type { CalendarTaskRow } from '../../models/calendar.types';
import { TasksApiService } from '../../core/services/tasks-api.service';
import { TasksCalendarStore } from '../../core/state/tasks-calendar.store';

interface UiPerson {
  id: number;
  name: string;
  image: string | null;
  available: boolean;
}

@Component({
  selector: 'app-create-task-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-task-modal.component.html',
  styleUrl: './create-task-modal.component.scss',
})
export class CreateTaskModalComponent {
  private readonly api = inject(TasksApiService);
  protected readonly store = inject(TasksCalendarStore);

  @ViewChild('descriptionRef') descriptionRef?: ElementRef<HTMLTextAreaElement>;
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly taskTypes = signal<CreateTaskTypeRow[]>([]);
  readonly clients = signal<CreateTaskClientRow[]>([]);
  readonly technicians = signal<UiPerson[]>([]);
  readonly users = signal<UiPerson[]>([]);

  readonly taskName = signal('');
  readonly taskType = signal('');
  readonly taskDate = signal(this.todayYmd());
  readonly urgent = signal(false);
  readonly description = signal('');

  readonly selectedTechnician = signal<UiPerson | null>(null);
  readonly selectedClient = signal<CreateTaskClientRow | null>(null);

  readonly helpingUsers = signal<UiPerson[]>([]);
  readonly selectedHelpingUser = signal<UiPerson | null>(null);

  readonly techSearch = signal('');
  readonly clientSearch = signal('');
  readonly helpingSearch = signal('');

  readonly techDropdownOpen = signal(false);
  readonly clientDropdownOpen = signal(false);
  readonly helpingDropdownOpen = signal(false);
  readonly addHelpingOpen = signal(false);

  readonly loadingTypes = signal(false);
  readonly loadingClients = signal(false);
  readonly loadingTechs = signal(false);
  readonly loadingUsers = signal(false);

  private readonly wasOpen = signal(false);
  private readonly hydratedDate = signal('');

  constructor() {
    effect(() => {
      const open = this.store.createTaskDrawerOpen();
      const date = this.store.createTaskModalDate();
      const prevOpen = this.wasOpen();
      if (open && (!prevOpen || this.hydratedDate() !== date)) {
        void this.prepareForOpen(date);
      }
      if (!open && prevOpen) {
        this.error.set(null);
      }
      this.wasOpen.set(open);
    });
  }

  readonly filteredTechs = () => {
    const q = this.techSearch().trim().toLowerCase();
    const list = this.technicians();
    return q ? list.filter((t) => t.name.toLowerCase().includes(q)) : list;
  };

  readonly filteredClients = () => {
    const q = this.clientSearch().trim().toLowerCase();
    const list = this.clients();
    return q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
  };

  readonly filteredHelpingUsers = () => {
    const q = this.helpingSearch().trim().toLowerCase();
    const selectedIds = new Set(this.helpingUsers().map((u) => u.id));
    const mainId = this.selectedTechnician()?.id;
    const list = this.users().filter((u) => !selectedIds.has(u.id) && u.id !== mainId);
    return q ? list.filter((u) => u.name.toLowerCase().includes(q)) : list;
  };

  private async prepareForOpen(date: string): Promise<void> {
    this.resetState(date);
    this.hydratedDate.set(date);
    await Promise.all([this.loadTaskTypes(), this.loadClients()]);
    await Promise.all([this.loadTechnicians(), this.loadUsers()]);
  }

  close(): void {
    this.store.closeCreateTaskModal();
    this.error.set(null);
  }

  private resetState(date: string): void {
    this.error.set(null);
    this.taskName.set('');
    this.taskType.set('');
    this.taskDate.set(date || this.todayYmd());
    this.urgent.set(false);
    this.description.set('');
    this.selectedTechnician.set(null);
    this.selectedClient.set(null);
    this.helpingUsers.set([]);
    this.selectedHelpingUser.set(null);
    this.techSearch.set('');
    this.clientSearch.set('');
    this.helpingSearch.set('');
    this.techDropdownOpen.set(false);
    this.clientDropdownOpen.set(false);
    this.helpingDropdownOpen.set(false);
    this.addHelpingOpen.set(false);
  }

  private todayYmd(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async onDateChange(date: string): Promise<void> {
    this.taskDate.set(date);
    this.selectedTechnician.set(null);
    this.helpingUsers.set([]);
    await Promise.all([this.loadTechnicians(), this.loadUsers()]);
  }

  async loadTaskTypes(): Promise<void> {
    if (this.taskTypes().length > 0) {
      return;
    }
    this.loadingTypes.set(true);
    try {
      const data = await firstValueFrom(this.api.getCreateTaskTypes());
      this.taskTypes.set(Array.isArray(data.types) ? data.types : []);
    } finally {
      this.loadingTypes.set(false);
    }
  }

  async loadClients(): Promise<void> {
    if (this.clients().length > 0) {
      return;
    }
    this.loadingClients.set(true);
    try {
      const data = await firstValueFrom(this.api.getCreateTaskClients());
      this.clients.set(Array.isArray(data.clients) ? data.clients : []);
    } finally {
      this.loadingClients.set(false);
    }
  }

  async loadTechnicians(): Promise<void> {
    this.loadingTechs.set(true);
    try {
      const rows = await firstValueFrom(this.api.getCreateTaskTechnicians(this.taskDate()));
      this.technicians.set((rows ?? []).map((r: CreateTaskTechnicianRow) => ({ ...r, available: !!r.available })));
    } finally {
      this.loadingTechs.set(false);
    }
  }

  async loadUsers(): Promise<void> {
    this.loadingUsers.set(true);
    try {
      const data = await firstValueFrom(this.api.getCreateTaskUsers(this.taskDate()));
      const users = (data.users ?? []).map((u: CreateTaskUserRow) => ({
        id: u.id,
        name: `${u.first_name} ${u.last_name}`.trim(),
        image: u.image?.image_name ? `/storage/${u.image.image_name}` : null,
        available: !!u.available,
      }));
      this.users.set(users);
    } finally {
      this.loadingUsers.set(false);
    }
  }

  selectTechnician(row: UiPerson): void {
    if (!row.available) return;
    this.selectedTechnician.set(row);
    this.techDropdownOpen.set(false);
    this.helpingUsers.update((list) => list.filter((u) => u.id !== row.id));
  }

  selectClient(row: CreateTaskClientRow): void {
    this.selectedClient.set(row);
    this.clientDropdownOpen.set(false);
  }

  addHelpingUser(): void {
    const user = this.selectedHelpingUser();
    if (!user || !user.available) return;
    if (this.helpingUsers().some((u) => u.id === user.id)) return;
    this.helpingUsers.update((list) => [...list, user]);
    this.selectedHelpingUser.set(null);
    this.helpingDropdownOpen.set(false);
    this.helpingSearch.set('');
  }

  removeHelpingUser(userId: number): void {
    this.helpingUsers.update((list) => list.filter((u) => u.id !== userId));
  }

  cancelHelpingAdd(): void {
    this.addHelpingOpen.set(false);
    this.selectedHelpingUser.set(null);
    this.helpingDropdownOpen.set(false);
    this.helpingSearch.set('');
  }

  wrapDescription(before: string, after: string): void {
    const textarea = this.descriptionRef?.nativeElement;
    if (!textarea) return;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const value = textarea.value;
    const selectedText = value.substring(start, end);

    let wrappedText: string;
    let newStart: number;
    let newEnd: number;

    if (before === '- ' && after === '') {
      if (selectedText.trim()) {
        wrappedText = selectedText
          .split('\n')
          .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return line;
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return line;
            return '- ' + trimmed;
          })
          .join('\n');
        newStart = start + wrappedText.length;
        newEnd = newStart;
      } else {
        wrappedText = '- ';
        newStart = start + wrappedText.length;
        newEnd = newStart;
      }
    } else {
      wrappedText = before + selectedText + after;
      newStart = start + before.length;
      newEnd = start + before.length + selectedText.length;
    }

    const next = value.substring(0, start) + wrappedText + value.substring(end);
    this.description.set(next);
    queueMicrotask(() => {
      textarea.focus();
      textarea.setSelectionRange(newStart, newEnd);
    });
  }

  avatarFallback(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`;
  }

  async submit(): Promise<void> {
    if (!this.taskName().trim()) {
      this.error.set('Le nom de la t?che est requis.');
      return;
    }
    if (!this.taskDate()) {
      this.error.set('La date est requise.');
      return;
    }
    if (!this.taskType()) {
      this.error.set('Veuillez s?lectionner un type de t?che.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    const payload: CreateTaskPayload = {
      task_name: this.taskName().trim(),
      task_type: this.taskType(),
      description: this.description(),
      urgent: this.urgent(),
      task_date: this.taskDate(),
      technician_id: this.selectedTechnician()?.id ?? null,
      client_id: this.selectedClient()?.id ?? null,
      helping_user_ids: this.helpingUsers().map((u) => u.id),
    };

    try {
      const data = await firstValueFrom(this.api.createTask(payload));
      if (!data.success || !data.task) {
        throw new Error(data.message || 'Erreur lors de la cration de la tche.');
      }
      const task = this.mapCreatedTask(data.task);
      this.store.insertCreatedTask(task);
      this.close();
    } catch (e: unknown) {
      let message = 'Erreur lors de la cration de la tche.';
      if (e instanceof HttpErrorResponse) {
        if (typeof e.error === 'object' && e.error && 'message' in e.error) {
          const m = (e.error as { message?: unknown }).message;
          if (typeof m === 'string' && m.trim()) {
            message = m;
          }
        } else if (e.status === 403) {
          message = 'Accs refus (permission tches).';
        }
      } else if (e instanceof Error && e.message) {
        message = e.message;
      }
      this.error.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  private mapCreatedTask(raw: any): CalendarTaskRow {
    const taskDate = String(raw.task_date ?? this.taskDate()).slice(0, 10);
    const techName = this.selectedTechnician()?.name ?? null;
    const client = this.selectedClient();
    return {
      id: Number(raw.id),
      task_name: raw.task_name ?? this.taskName(),
      task_type: raw.task_type ?? this.taskType(),
      description: raw.description ?? this.description(),
      status: raw.status ?? 'en attente',
      urgent: !!(raw.urgent ?? this.urgent()),
      task_date: taskDate,
      technician_id: raw.technician_id ?? this.selectedTechnician()?.id ?? null,
      technician_name: raw.technician_name ?? raw.technician ? `${raw.technician.first_name ?? ''} ${raw.technician.last_name ?? ''}`.trim() : techName,
      technician_image:
        raw.technician_image ??
        (raw.technician?.image?.image_name ? `/storage/${raw.technician.image.image_name}` : this.selectedTechnician()?.image ?? null),
      client_id: raw.client_id ?? client?.id ?? null,
      client_name:
        raw.client_name ??
        (raw.client ? `${raw.client.first_name ?? ''} ${raw.client.last_name ?? ''}`.trim() : client?.name ?? null),
      client_city: raw.client_city ?? raw.client?.city?.name ?? client?.city ?? null,
      client_image:
        raw.client_image ??
        (raw.client?.image?.image_name ? `/storage/${raw.client.image.image_name}` : client?.image ?? null),
      deployment_id: raw.deployment_id ?? null,
      is_paid: !!raw.is_paid,
      amount_paid: raw.amount_paid ?? null,
      admin_delivery_amount: raw.admin_delivery_amount ?? null,
      has_ongoing_visit: !!raw.has_ongoing_visit,
      helping_user_ids: Array.isArray(raw.helping_user_ids) ? raw.helping_user_ids : this.helpingUsers().map((u) => u.id),
    };
  }
}
