export interface CalendarTaskRow {
  id: number;
  task_name: string | null;
  task_type: string | null;
  description: string | null;
  status: string;
  urgent: boolean;
  task_date: string | null;
  technician_id: number | null;
  technician_name: string | null;
  technician_image?: string | null;
  client_id: number | null;
  client_name: string | null;
  client_city: string | null;
  client_image?: string | null;
  deployment_id: number | null;
  is_paid?: boolean;
  amount_paid?: string | number | null;
  admin_delivery_amount?: string | number | null;
  has_ongoing_visit?: boolean;
  helping_user_ids?: number[];
}

export interface CalendarDeploymentBlock {
  id: number;
  title: string | null;
  deployment_date: string | null;
  city_name: string | null;
  tasks: CalendarTaskRow[];
  tasks_count: number;
}

/** Filter dropdown rows from API meta (DB-backed lists). */
export interface CalendarFilterPersonMeta {
  id: number;
  name: string;
  image: string | null;
}

export interface CalendarTaskTypeMeta {
  id: number;
  name: string;
}

export interface CalendarPayloadMeta {
  technicians: CalendarFilterPersonMeta[];
  clients: CalendarFilterPersonMeta[];
  task_types: CalendarTaskTypeMeta[];
}

export interface CalendarPayload {
  deployments: Record<string, CalendarDeploymentBlock[]>;
  tasks: Record<string, CalendarTaskRow[]>;
  meta?: CalendarPayloadMeta;
}
