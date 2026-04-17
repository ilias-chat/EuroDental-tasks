/**
 * Maps Laravel task `status` to CSS variables for calendar strips (`--app-task-strip-*`).
 */
export function taskStatusStripVar(status: string | null | undefined): string {
  switch ((status ?? '').trim()) {
    case 'en attente':
      return 'var(--app-task-strip-attente)';
    case 'en cours':
      return 'var(--app-task-strip-cours)';
    case 'en route':
      return 'var(--app-task-strip-route)';
    case 'en pause':
      return 'var(--app-task-strip-pause)';
    case 'terminée':
      return 'var(--app-task-strip-terminee)';
    case 'annulée':
      return 'var(--app-task-strip-annulee)';
    default:
      return 'var(--app-task-strip-default)';
  }
}

/** Month grid task chips — same status colors as `admin/tasks/_month.blade.php` (Tailwind). */
export function monthTaskCardStatusClass(status: string | null | undefined): string {
  switch ((status ?? '').trim()) {
    case 'en attente':
      return 'cal-month__task-card--attente';
    case 'en cours':
      return 'cal-month__task-card--cours';
    case 'en route':
      return 'cal-month__task-card--route';
    case 'en pause':
      return 'cal-month__task-card--pause';
    case 'terminée':
      return 'cal-month__task-card--terminee';
    case 'annulée':
      return 'cal-month__task-card--annulee';
    default:
      return 'cal-month__task-card--default';
  }
}
