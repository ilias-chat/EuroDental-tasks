import type { CalendarTaskRow } from '../../models/calendar.types';

const AVATAR_PLACEHOLDER = 'https://ui-avatars.com/api/?background=f5f4ef&color=6b6860&size=64&name=';

export function avatarFallbackUrl(name: string | null | undefined): string {
  const n = (name ?? '—').trim() || '—';
  return `${AVATAR_PLACEHOLDER}${encodeURIComponent(n)}`;
}

export function clientAvatarSrc(task: CalendarTaskRow): string {
  if (task.client_image) {
    return task.client_image;
  }
  return avatarFallbackUrl(task.client_name?.trim() || 'Client');
}

export function technicianAvatarSrc(task: CalendarTaskRow): string {
  if (task.technician_image) {
    return task.technician_image;
  }
  return avatarFallbackUrl(task.technician_name?.trim() || 'Tech');
}

/** Safe one-line / card preview: no HTML. */
export function plainDescriptionPreview(raw: string | null | undefined, maxLines = 3): string {
  if (!raw?.trim()) {
    return '';
  }
  let t = raw
    .replace(/<[^>]*>/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^[\-\*]\s+/gm, '• ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > 220) {
    t = `${t.slice(0, 217)}…`;
  }
  return t;
}

export function formatAmountDh(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) {
    return '';
  }
  return `${n.toFixed(2)} DH`;
}

export function taskStatusBadgeModifier(status: string | null | undefined): string {
  switch ((status ?? '').trim()) {
    case 'en attente':
      return 'cal-task-card__badge--attente';
    case 'en cours':
      return 'cal-task-card__badge--cours';
    case 'en route':
      return 'cal-task-card__badge--route';
    case 'en pause':
      return 'cal-task-card__badge--pause';
    case 'terminée':
      return 'cal-task-card__badge--terminee';
    case 'annulée':
      return 'cal-task-card__badge--annulee';
    default:
      return 'cal-task-card__badge--default';
  }
}

export function taskStatusBadgeClasses(status: string | null | undefined): string {
  return `cal-task-card__badge ${taskStatusBadgeModifier(status)}`;
}
