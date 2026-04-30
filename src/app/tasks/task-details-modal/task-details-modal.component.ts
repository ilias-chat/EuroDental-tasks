import { CommonModule } from '@angular/common';
import { Component, computed, effect, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { monthTaskCardStatusClass } from '../../core/calendar/task-status';
import { ToastService } from '../../core/services/toast.service';
import type {
  ServiceCatalogRow,
  TaskDetailsRow,
  TaskDetailsWarrantyRow,
  TaskProgressActionResponse,
} from '../../core/services/tasks-api.service';
import { TasksApiService } from '../../core/services/tasks-api.service';
import { TasksCalendarStore } from '../../core/state/tasks-calendar.store';

type DetailsTab = 'main' | 'progress' | 'payment' | 'services' | 'warranty';

@Component({
  selector: 'app-task-details-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-details-modal.component.html',
  styleUrl: './task-details-modal.component.scss',
})
export class TaskDetailsModalComponent {
  private readonly api = inject(TasksApiService);
  protected readonly store = inject(TasksCalendarStore);
  private readonly toast = inject(ToastService);
  @ViewChild('descriptionEditorRef') descriptionEditorRef?: ElementRef<HTMLTextAreaElement>;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly details = signal<TaskDetailsRow | null>(null);
  readonly warrantyLoading = signal(false);
  readonly warrantyRows = signal<TaskDetailsWarrantyRow[]>([]);
  readonly activeTab = signal<DetailsTab>('main');
  readonly editingDescription = signal(false);
  readonly descriptionDraft = signal('');
  readonly savingDescription = signal(false);
  readonly descriptionSaveError = signal<string | null>(null);
  readonly editingPayment = signal(false);
  readonly paymentAmountDraft = signal('');
  readonly savingPayment = signal(false);
  readonly paymentSaveError = signal<string | null>(null);
  readonly editingAdminDelivery = signal(false);
  readonly adminDeliveryAmountDraft = signal('');
  readonly adminDeliveryDateDraft = signal('');
  readonly savingAdminDelivery = signal(false);
  readonly adminDeliverySaveError = signal<string | null>(null);
  readonly editingServices = signal(false);
  readonly savingServices = signal(false);
  readonly loadingServiceCatalog = signal(false);
  readonly serviceCatalog = signal<ServiceCatalogRow[]>([]);
  readonly serviceSearch = signal('');
  readonly selectedServiceIds = signal<number[]>([]);
  readonly removingServiceId = signal<number | null>(null);
  readonly proposingService = signal(false);
  readonly proposedServiceName = signal('');
  readonly editingServiceProposal = signal(false);
  readonly loadingProgressAction = signal<
    'start_route' | 'end_route' | 'start_visit' | 'pause_visit' | 'resume_visit' | 'finish_visit' | 'finish_task' | null
  >(null);
  /** Progress tab: filter timeline events by `user_id`; `null` = all members. */
  readonly progressEventUserFilterId = signal<number | null>(null);

  constructor() {
    effect(() => {
      const open = this.store.taskDetailsDrawerOpen();
      const id = this.store.selectedTaskDetailsId();
      if (open && id != null) {
        void this.loadDetails(id);
      }
      if (!open) {
        this.activeTab.set('main');
        this.error.set(null);
        this.progressEventUserFilterId.set(null);
        this.editingDescription.set(false);
        this.descriptionDraft.set('');
        this.descriptionSaveError.set(null);
        this.editingPayment.set(false);
        this.paymentAmountDraft.set('');
        this.paymentSaveError.set(null);
        this.editingAdminDelivery.set(false);
        this.adminDeliveryAmountDraft.set('');
        this.adminDeliveryDateDraft.set('');
        this.adminDeliverySaveError.set(null);
        this.editingServices.set(false);
        this.savingServices.set(false);
        this.loadingServiceCatalog.set(false);
        this.serviceCatalog.set([]);
        this.serviceSearch.set('');
        this.selectedServiceIds.set([]);
        this.removingServiceId.set(null);
        this.proposingService.set(false);
        this.proposedServiceName.set('');
        this.editingServiceProposal.set(false);
        this.loadingProgressAction.set(null);
      }
    });
  }

  readonly title = computed(() => 'Détails de la tâche');
  /** Same order as Laravel `Task::events()` — `event_time` ascending. */
  readonly progressEvents = computed(() => {
    const evs = [...(this.details()?.events ?? [])];
    return evs.sort((a, b) => {
      const ta = new Date(a.event_time ?? 0).getTime();
      const tb = new Date(b.event_time ?? 0).getTime();
      if (ta !== tb) {
        return ta - tb;
      }
      return (a.id ?? 0) - (b.id ?? 0);
    });
  });

  readonly filteredProgressEvents = computed(() => {
    const all = this.progressEvents();
    const uid = this.progressEventUserFilterId();
    if (uid == null) {
      return all;
    }
    return all.filter((e) => e.user_id != null && Number(e.user_id) === Number(uid));
  });

  /** Technicien + aides, unique ids — for progression filter strip. */
  readonly progressTeamMembers = computed(() => {
    const d = this.details();
    if (!d) {
      return [] as Array<{ id: number; name: string; image: string | null }>;
    }
    const out: Array<{ id: number; name: string; image: string | null }> = [];
    if (d.technician_id != null) {
      out.push({
        id: d.technician_id,
        name: (d.technician_name ?? '').trim() || 'Technicien',
        image: d.technician_image ?? null,
      });
    }
    for (const u of d.helping_users ?? []) {
      if (!out.some((x) => x.id === u.id)) {
        out.push({
          id: u.id,
          name: (u.name ?? '').trim() || 'Membre',
          image: u.image ?? null,
        });
      }
    }
    return out;
  });
  readonly services = computed(() => this.details()?.services ?? []);
  readonly servicePropositions = computed(() => this.details()?.service_propositions ?? []);
  readonly helpingUsers = computed(() => this.details()?.helping_users ?? []);
  readonly isPaymentDeliveryAutoTask = computed(() => {
    const raw = this.details()?.task_name ?? '';
    const name = raw.trim().toLowerCase();
    return name.startsWith("remise paiement à l'administration");
  });
  readonly filteredServiceCatalog = computed(() => {
    const q = this.serviceSearch().trim().toLowerCase();
    const rows = this.serviceCatalog();
    if (!q) {
      return rows;
    }
    return rows.filter(
      (s) =>
        (s.name ?? '').toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q),
    );
  });
  readonly progressCanManageTask = computed(() => {
    const row = this.details();
    if (!row) return false;
    if (row.can_manage_task) return true;
    const uid = row.current_user_id;
    if (!uid) return false;
    if (row.is_main_technician) return true;
    if (row.technician_id != null && Number(row.technician_id) === Number(uid)) return true;
    return (row.helping_users ?? []).some((u) => Number(u.id) === Number(uid));
  });
  readonly progressUserLastEvent = computed(() => this.details()?.user_last_event ?? null);

  close(): void {
    this.store.closeTaskDetailsModal();
  }

  selectTab(tab: DetailsTab): void {
    if (tab !== 'services' && this.editingServices()) {
      this.closeServicesPicker();
    }
    if (
      this.isPaymentDeliveryAutoTask() &&
      tab !== 'main' &&
      tab !== 'progress'
    ) {
      this.activeTab.set('main');
      return;
    }
    this.activeTab.set(tab);
  }

  statusClass(status: string | null | undefined): string {
    const s = (status ?? '').trim();
    const normalized =
      s === 'terminee' ? 'terminée' : s === 'annulee' ? 'annulée' : s;
    return `task-details__status ${monthTaskCardStatusClass(normalized)}`;
  }

  /** Matches Laravel `getEventLabel` in `admin/tasks/index.blade.php`. */
  eventLabel(eventType: string): string {
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

  /** Laravel `formatDateForDisplay` — long French date for scheduled step. */
  formatDateForDisplay(dateString: string | null | undefined): string {
    if (!dateString?.trim()) {
      return '';
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateString.trim());
    const d = m
      ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
      : new Date(dateString);
    if (Number.isNaN(d.getTime())) {
      return dateString;
    }
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /** Dot colors match Laravel timeline `:class` on `event.type`. */
  progressEventDotClass(eventType: string | null | undefined): string {
    const t = eventType ?? '';
    const base = 'task-details__progress-dot';
    if (t === 'start_deployment' || t === 'finish_deployment' || t === 'finish_task') {
      return `${base} ${base}--blue`;
    }
    if (t === 'start_visit' || t === 'resume_visit') {
      return `${base} ${base}--yellow`;
    }
    if (t === 'start_route') {
      return `${base} ${base}--orange`;
    }
    if (t === 'end_route') {
      return `${base} ${base}--gray`;
    }
    if (t === 'pause_visit' || t === 'finish_visit') {
      return `${base} ${base}--green`;
    }
    if (t === 'cancel_task') {
      return `${base} ${base}--purple`;
    }
    return `${base} ${base}--gray`;
  }

  eventUserAvatarSrc(userImage: string | null | undefined, userName: string | null | undefined): string {
    if (userImage?.trim()) {
      return userImage;
    }
    const name = userName?.trim() || 'Utilisateur';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff`;
  }

  formatAmountDh(v: number | null | undefined): string {
    if (v == null || Number.isNaN(v)) return '0.00 DH';
    return `${Number(v).toFixed(2)} DH`;
  }

  avatarFallback(name: string | null | undefined): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name?.trim() || 'Utilisateur')}`;
  }

  /**
   * Border class for one team member: last event **for that user on this task** maps to the same
   * status/colors as Laravel `getUserStatusBorderClasses` / `Mobile\TaskController` (working→yellow, …).
   */
  trackingBorderClassForUser(userId: number | null | undefined): string {
    if (userId == null) {
      return 'task-details__tracking-border--default';
    }
    const status = this.userTrackingStatusFromLastTaskEvent(userId);
    if (status == null) {
      return 'task-details__tracking-border--default';
    }
    switch (status) {
      case 'working':
        return 'task-details__tracking-border--working';
      case 'paused':
        return 'task-details__tracking-border--paused';
      case 'route':
        return 'task-details__tracking-border--route';
      case 'waiting':
        return 'task-details__tracking-border--waiting';
    }
  }

  helperAvatarClass(userId: number): string {
    return `task-details__helper-avatar ${this.trackingBorderClassForUser(userId)}`;
  }

  /** Smaller avatars in progression team strip (same border logic as main tab). */
  stripMemberAvatarClass(userId: number): string {
    return `task-details__strip-avatar ${this.trackingBorderClassForUser(userId)}`;
  }

  onProgressTeamMemberClick(userId: number): void {
    this.progressEventUserFilterId.update((cur) => (cur === userId ? null : userId));
  }

  clearProgressEventFilter(): void {
    this.progressEventUserFilterId.set(null);
  }

  openPaymentEdit(): void {
    const row = this.details();
    this.paymentSaveError.set(null);
    this.paymentAmountDraft.set(row?.amount_paid != null ? String(row.amount_paid) : '');
    this.editingPayment.set(true);
  }

  cancelPaymentEdit(): void {
    this.editingPayment.set(false);
    this.paymentSaveError.set(null);
  }

  async savePayment(): Promise<void> {
    const row = this.details();
    if (!row?.id || this.savingPayment()) return;
    const amount = this.parseAmountInput(this.paymentAmountDraft());
    if (!Number.isFinite(amount) || amount < 0) {
      this.paymentSaveError.set('Montant invalide.');
      return;
    }

    this.savingPayment.set(true);
    this.paymentSaveError.set(null);
    try {
      const resp = await firstValueFrom(this.api.updateTaskPayment(row.id, amount));
      if (!resp?.success || !resp.task) throw new Error('payment_failed');
      this.details.update((cur) =>
        cur
          ? {
              ...cur,
              is_paid: !!resp.task?.is_paid,
              amount_paid: resp.task?.amount_paid ?? null,
            }
          : cur,
      );
      this.editingPayment.set(false);
      this.toast.success(resp.message || 'Paiement enregistré avec succès');
    } catch (e) {
      const msg = this.extractApiErrorMessage(e) ?? "Impossible d'enregistrer le paiement.";
      this.paymentSaveError.set(msg);
      this.toast.error(msg);
    } finally {
      this.savingPayment.set(false);
    }
  }

  openAdminDeliveryEdit(): void {
    const row = this.details();
    this.adminDeliverySaveError.set(null);
    this.adminDeliveryAmountDraft.set(
      row?.admin_delivery_amount != null ? String(row.admin_delivery_amount) : '',
    );
    this.adminDeliveryDateDraft.set('');
    this.editingAdminDelivery.set(true);
  }

  cancelAdminDeliveryEdit(): void {
    this.editingAdminDelivery.set(false);
    this.adminDeliverySaveError.set(null);
  }

  async saveAdminDelivery(): Promise<void> {
    const row = this.details();
    if (!row?.id || this.savingAdminDelivery()) return;
    const amount = this.parseAmountInput(this.adminDeliveryAmountDraft());
    if (!Number.isFinite(amount) || amount < 0) {
      this.adminDeliverySaveError.set('Montant invalide.');
      return;
    }

    this.savingAdminDelivery.set(true);
    this.adminDeliverySaveError.set(null);
    try {
      const resp = await firstValueFrom(
        this.api.updateTaskAdminDeliveryPayment(
          row.id,
          amount,
          this.adminDeliveryDateDraft().trim() || undefined,
        ),
      );
      if (!resp?.success || !resp.task) throw new Error('admin_delivery_failed');
      this.details.update((cur) =>
        cur
          ? {
              ...cur,
              admin_delivery_amount: resp.task?.admin_delivery_amount ?? null,
              admin_delivery_task_id: resp.task?.admin_delivery_task_id ?? null,
            }
          : cur,
      );
      const deliveryTaskId = resp.delivery_task_id ?? resp.task?.admin_delivery_task_id;
      const base = (resp.message || 'Paiement à remettre enregistré et tâche de livraison créée.').trim();
      // Keep calendar views in sync: the backend creates a linked delivery task.
      void this.store.refresh();
      this.editingAdminDelivery.set(false);
      this.toast.success(deliveryTaskId ? `${base} (Tâche #${deliveryTaskId})` : base);
    } catch (e) {
      const msg =
        this.extractApiErrorMessage(e) ?? "Impossible d'enregistrer le paiement à remettre.";
      this.adminDeliverySaveError.set(msg);
      this.toast.error(msg);
    } finally {
      this.savingAdminDelivery.set(false);
    }
  }

  private extractApiErrorMessage(err: unknown): string | null {
    if (err instanceof HttpErrorResponse) {
      const m = (err.error && (err.error.message as string | undefined)) || err.message;
      return typeof m === 'string' && m.trim() ? m : null;
    }
    return null;
  }

  private parseAmountInput(v: unknown): number {
    if (typeof v === 'number') {
      return v;
    }
    if (typeof v === 'string') {
      return Number(v.replace(',', '.').trim());
    }
    return Number(v);
  }

  mainTechAvatarClass(technicianId: number | null | undefined): string {
    return `task-details__avatar-main ${this.trackingBorderClassForUser(technicianId)}`;
  }

  /**
   * Latest event for this user on the loaded task (same idea as Laravel last event for tracking).
   */
  private userTrackingStatusFromLastTaskEvent(userId: number): 'working' | 'paused' | 'route' | 'waiting' | null {
    const evs = (this.details()?.events ?? []).filter(
      (e) => e.user_id != null && Number(e.user_id) === Number(userId),
    );
    if (evs.length === 0) {
      return null;
    }
    const sorted = [...evs].sort((a, b) => {
      const tb = new Date(b.event_time ?? 0).getTime();
      const ta = new Date(a.event_time ?? 0).getTime();
      if (tb !== ta) {
        return tb - ta;
      }
      return (b.id ?? 0) - (a.id ?? 0);
    });
    return this.eventTypeToTrackingStatus(sorted[0]?.event_type);
  }

  /** Mirrors `App\Http\Controllers\Mobile\TaskController` last-event → status switch. */
  private eventTypeToTrackingStatus(
    eventType: string | undefined,
  ): 'working' | 'paused' | 'route' | 'waiting' {
    switch (eventType) {
      case 'start_visit':
      case 'resume_visit':
        return 'working';
      case 'pause_visit':
        return 'paused';
      case 'start_route':
        return 'route';
      default:
        return 'waiting';
    }
  }

  renderDescription(text: string | null | undefined): string {
    const src = (text ?? '').trim();
    if (!src) {
      return '<span class="task-details__muted">Aucune description</span>';
    }
    const escaped = src
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const withBold = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const withItalic = withBold.replace(/\*(.+?)\*/g, '<em>$1</em>');
    const withLists = withItalic.replace(/(?:^|\n)-\s(.+?)(?=\n|$)/g, '<li>$1</li>');
    const wrappedLists = withLists.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
    return wrappedLists.replace(/\n/g, '<br>');
  }

  startDescriptionEdit(): void {
    const row = this.details();
    this.descriptionSaveError.set(null);
    this.descriptionDraft.set(row?.description ?? '');
    this.editingDescription.set(true);
  }

  cancelDescriptionEdit(): void {
    this.editingDescription.set(false);
    this.descriptionSaveError.set(null);
    this.descriptionDraft.set(this.details()?.description ?? '');
  }

  async saveDescription(): Promise<void> {
    const row = this.details();
    if (!row?.id || this.savingDescription()) {
      return;
    }

    this.savingDescription.set(true);
    this.descriptionSaveError.set(null);
    try {
      const resp = await firstValueFrom(
        this.api.updateTaskDescription(row.id, this.descriptionDraft().trim()),
      );
      if (!resp?.success) {
        throw new Error('save_failed');
      }
      this.details.update((cur) => (cur ? { ...cur, description: resp.description ?? '' } : cur));
      this.editingDescription.set(false);
      this.toast.success(resp.message || 'Description mise à jour avec succès');
    } catch (e) {
      const msg = this.extractApiErrorMessage(e) ?? 'Impossible de sauvegarder la description.';
      this.descriptionSaveError.set(msg);
      this.toast.error(msg);
    } finally {
      this.savingDescription.set(false);
    }
  }

  wrapDescriptionEdit(before: string, after: string): void {
    const textarea = this.descriptionEditorRef?.nativeElement;
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
        newStart = start + 2;
        newEnd = newStart;
      }
    } else if (selectedText) {
      wrappedText = `${before}${selectedText}${after}`;
      newStart = start + before.length;
      newEnd = newStart + selectedText.length;
    } else {
      wrappedText = `${before}${after}`;
      newStart = start + before.length;
      newEnd = newStart;
    }

    const next = `${value.substring(0, start)}${wrappedText}${value.substring(end)}`;
    this.descriptionDraft.set(next);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newStart, newEnd);
    });
  }

  openInvoice(): void {
    const row = this.details();
    if (!row?.id) return;
    window.open(`/admin/tasks/${row.id}/invoice`, '_blank', 'noopener,noreferrer');
  }

  async openServicesPicker(): Promise<void> {
    const row = this.details();
    if (!row?.id || this.loadingServiceCatalog()) return;
    this.loadingServiceCatalog.set(true);
    this.editingServices.set(true);
    this.serviceSearch.set('');
    this.selectedServiceIds.set((row.services ?? []).map((s) => s.id));
    try {
      const resp = await firstValueFrom(this.api.getAllServices());
      this.serviceCatalog.set(Array.isArray(resp.services) ? resp.services : []);
    } catch {
      this.toast.error('Erreur lors du chargement des services');
      this.editingServices.set(false);
    } finally {
      this.loadingServiceCatalog.set(false);
    }
  }

  closeServicesPicker(): void {
    this.editingServices.set(false);
    this.serviceSearch.set('');
    this.selectedServiceIds.set([]);
  }

  openServiceProposalEdit(): void {
    this.editingServiceProposal.set(true);
    this.proposedServiceName.set('');
  }

  cancelServiceProposalEdit(): void {
    this.editingServiceProposal.set(false);
    this.proposedServiceName.set('');
  }

  toggleServiceSelection(serviceId: number, checked: boolean): void {
    this.selectedServiceIds.update((current) => {
      if (checked) {
        if (current.includes(serviceId)) return current;
        return [...current, serviceId];
      }
      return current.filter((id) => id !== serviceId);
    });
  }

  async saveServicesSelection(): Promise<void> {
    const row = this.details();
    if (!row?.id || this.savingServices()) return;
    await this.persistServices(this.selectedServiceIds(), 'Services mis à jour avec succès');
  }

  async removeService(serviceId: number): Promise<void> {
    const row = this.details();
    if (!row?.id || this.savingServices() || this.removingServiceId() != null) return;
    const nextIds = (row.services ?? []).map((s) => s.id).filter((id) => id !== serviceId);
    this.removingServiceId.set(serviceId);
    try {
      await this.persistServices(nextIds, 'Service retiré avec succès');
    } finally {
      this.removingServiceId.set(null);
    }
  }

  private async persistServices(serviceIds: number[], successMessage: string): Promise<void> {
    const row = this.details();
    if (!row?.id) return;
    this.savingServices.set(true);
    try {
      const resp = await firstValueFrom(this.api.updateTaskServices(row.id, serviceIds));
      if (!resp?.success) {
        throw new Error('services_update_failed');
      }
      this.details.update((cur) =>
        cur
          ? {
              ...cur,
              services: Array.isArray(resp.services) ? resp.services : [],
            }
          : cur,
      );
      this.selectedServiceIds.set((Array.isArray(resp.services) ? resp.services : []).map((s) => s.id));
      this.editingServices.set(false);
      this.toast.success(resp.message || successMessage);
    } catch (e) {
      const msg = this.extractApiErrorMessage(e) ?? 'Erreur lors de la sauvegarde des services';
      this.toast.error(msg);
    } finally {
      this.savingServices.set(false);
    }
  }

  async submitServiceProposal(): Promise<void> {
    const row = this.details();
    const name = this.proposedServiceName().trim();
    if (!row?.id || this.proposingService()) return;
    if (!name) {
      this.toast.info('Veuillez saisir un nom de service.');
      return;
    }
    this.proposingService.set(true);
    try {
      const resp = await firstValueFrom(this.api.proposeTaskService(row.id, name));
      if (!resp?.success) {
        throw new Error('service_proposal_failed');
      }
      this.proposedServiceName.set('');
      this.editingServiceProposal.set(false);
      this.toast.success(resp.message || 'Proposition envoyée avec succès');
      await this.loadDetails(row.id);
      this.activeTab.set('services');
    } catch (e) {
      const msg = this.extractApiErrorMessage(e) ?? "Erreur lors de l'envoi de la proposition";
      this.toast.error(msg);
    } finally {
      this.proposingService.set(false);
    }
  }

  canShowProgressAction(action: 'start_route' | 'end_route' | 'start_visit' | 'pause_visit' | 'resume_visit' | 'finish_visit' | 'finish_task'): boolean {
    const row = this.details();
    const last = this.progressUserLastEvent();
    if (!row || !this.progressCanManageTask()) return false;
    if (row.status === 'terminée' || row.status === 'annulée') return false;
    switch (action) {
      case 'start_route':
        return last == null || last === 'end_route' || last === 'finish_visit';
      case 'end_route':
      case 'start_visit':
        return last === 'start_route';
      case 'pause_visit':
        return last === 'start_visit' || last === 'resume_visit';
      case 'resume_visit':
        return last === 'pause_visit';
      case 'finish_visit':
        return last === 'start_visit' || last === 'pause_visit' || last === 'resume_visit';
      case 'finish_task':
        return last === 'finish_visit' && !!row.is_main_technician;
    }
  }

  private applyProgressActionResult(
    resp: TaskProgressActionResponse,
    action: 'start_route' | 'end_route' | 'start_visit' | 'pause_visit' | 'resume_visit' | 'finish_visit' | 'finish_task',
  ): void {
    this.details.update((cur) =>
      cur
        ? {
            ...cur,
            status: resp.task_status ?? cur.status,
            current_visit_status: resp.current_visit_status ?? cur.current_visit_status,
            has_ongoing_visit: resp.has_ongoing_visit ?? cur.has_ongoing_visit,
            user_last_event: resp.user_last_event ?? action,
            events:
              resp.event && resp.event.event_type
                ? [
                    ...cur.events,
                    {
                      id: Number(resp.event.id ?? Date.now()),
                      event_type: resp.event.event_type,
                      event_time: resp.event.event_time ?? resp.event.created_at ?? new Date().toISOString(),
                      event_time_label: this.formatProgressEventDateLabel(
                        resp.event.event_time ?? resp.event.created_at ?? null,
                      ),
                      latitude: null,
                      longitude: null,
                      user_id: resp.event.user_id ?? cur.current_user_id ?? null,
                      user_name: this.connectedUserNameForTask(cur, resp.event.user_id ?? cur.current_user_id ?? null),
                      user_image: null,
                    },
                  ]
                : cur.events,
          }
        : cur,
    );
  }

  private formatProgressEventDateLabel(v: string | null | undefined): string | null {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  }

  private connectedUserNameForTask(task: TaskDetailsRow, userId: number | null): string {
    if (userId == null) return 'Vous';
    if (task.technician_id != null && Number(task.technician_id) === Number(userId)) {
      return task.technician_name?.trim() || 'Vous';
    }
    const helper = (task.helping_users ?? []).find((u) => Number(u.id) === Number(userId));
    if (helper?.name?.trim()) return helper.name.trim();
    return 'Vous';
  }

  async runProgressAction(
    action: 'start_route' | 'end_route' | 'start_visit' | 'pause_visit' | 'resume_visit' | 'finish_visit' | 'finish_task',
  ): Promise<void> {
    const row = this.details();
    if (!row?.id || this.loadingProgressAction()) return;
    this.loadingProgressAction.set(action);
    try {
      let resp: TaskProgressActionResponse;
      switch (action) {
        case 'start_route':
          resp = await firstValueFrom(this.api.startTaskRoute(row.id));
          break;
        case 'end_route':
          resp = await firstValueFrom(this.api.endTaskRoute(row.id));
          break;
        case 'start_visit':
          resp = await firstValueFrom(this.api.startTaskVisit(row.id));
          break;
        case 'pause_visit':
          resp = await firstValueFrom(this.api.pauseTaskVisit(row.id));
          break;
        case 'resume_visit':
          resp = await firstValueFrom(this.api.resumeTaskVisit(row.id));
          break;
        case 'finish_visit':
          resp = await firstValueFrom(this.api.finishTaskVisit(row.id));
          break;
        case 'finish_task':
          resp = await firstValueFrom(this.api.finishTask(row.id));
          break;
      }
      if (!resp?.success) throw new Error('progress_action_failed');
      this.applyProgressActionResult(resp, action);
      this.activeTab.set('progress');
      void this.store.refresh();
      this.toast.success(resp.message || 'Action effectuée avec succès');
    } catch (e) {
      const msg = this.extractApiErrorMessage(e) ?? "Impossible d'effectuer cette action.";
      this.toast.error(msg);
    } finally {
      this.loadingProgressAction.set(null);
    }
  }

  warrantyBadgeClass(daysLeft: string | number | null | undefined): string {
    const n = Number(daysLeft ?? 0);
    if (n <= 0) return 'task-details__warranty-pill task-details__warranty-pill--expired';
    if (n <= 30) return 'task-details__warranty-pill task-details__warranty-pill--warn';
    return 'task-details__warranty-pill task-details__warranty-pill--ok';
  }

  private async loadDetails(taskId: number): Promise<void> {
    this.progressEventUserFilterId.set(null);
    this.editingDescription.set(false);
    this.descriptionSaveError.set(null);
    this.editingPayment.set(false);
    this.paymentSaveError.set(null);
    this.editingAdminDelivery.set(false);
    this.adminDeliverySaveError.set(null);
    this.editingServices.set(false);
    this.savingServices.set(false);
    this.loadingServiceCatalog.set(false);
    this.serviceCatalog.set([]);
    this.serviceSearch.set('');
    this.selectedServiceIds.set([]);
    this.removingServiceId.set(null);
    this.proposingService.set(false);
    this.proposedServiceName.set('');
    this.editingServiceProposal.set(false);
    this.loadingProgressAction.set(null);
    this.loading.set(true);
    this.error.set(null);
    this.details.set(null);
    this.warrantyRows.set([]);
    try {
      const data = await firstValueFrom(this.api.getTaskDetails(taskId));
      if (!data.success || !data.task) {
        throw new Error('Impossible de charger les details de la tache.');
      }
      this.details.set(data.task);
      this.descriptionDraft.set(data.task.description ?? '');
      if (
        this.isPaymentDeliveryAutoTask() &&
        this.activeTab() !== 'main' &&
        this.activeTab() !== 'progress'
      ) {
        this.activeTab.set('main');
      }
      if (data.task.client_id) {
        void this.loadWarranty(data.task.client_id);
      }
    } catch {
      this.error.set('Impossible de charger les details de la tache.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadWarranty(clientId: number): Promise<void> {
    this.warrantyLoading.set(true);
    this.warrantyRows.set([]);
    try {
      const data = await firstValueFrom(this.api.getClientWarrantyProducts(clientId, 1, 100));
      this.warrantyRows.set(Array.isArray(data.products) ? data.products : []);
    } catch {
      this.warrantyRows.set([]);
    } finally {
      this.warrantyLoading.set(false);
    }
  }

}

