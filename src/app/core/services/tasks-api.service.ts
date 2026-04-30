import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { CalendarPayload } from '../../models/calendar.types';

export interface DeliveredPaymentRow {
  id: number;
  delivered_by: string | null;
  received_by: string | null;
  client_name: string | null;
  amount: number | null;
  date_received: string | null;
  date_collected_from_client: string | null;
}

export interface DeliveredPaymentsPagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface DeliveredPaymentsResponse {
  list: DeliveredPaymentRow[];
  pagination: DeliveredPaymentsPagination;
}

/** Réponse de Mobile\TaskController::usersWithTasks */
export interface TrackingUserRow {
  id: number;
  name: string;
  image: string | null;
  profile: string;
  profile_id: number | null;
  tasks_count: number;
  last_event_status: string;
  leave_requests: { start_date: string; end_date: string }[];
}

/** Élément de Mobile\TaskController::tracking */
export interface TrackingEventRow {
  id: string;
  event_type: string;
  time: string;
  formatted_time: string;
  timestamp: number;
  task_name: string | null;
  task_type: string | null;
  status: string | null;
  original_status: string | null;
  client_name: string | null;
  client_city: string | null;
  client_image: string | null;
  has_ongoing_visit: boolean;
  user_id: number;
  user_name: string | null;
  user_image: string | null;
  city_name: string | null;
}

export type TrackingUserView = TrackingUserRow & { available: boolean };

export interface CreateTaskTypeRow {
  id: number;
  name: string;
}

export interface CreateTaskUserRow {
  id: number;
  first_name: string;
  last_name: string;
  image: { image_name: string } | null;
  available: boolean;
  leave_requests: { start_date: string; end_date: string }[];
}

export interface CreateTaskTechnicianRow {
  id: number;
  name: string;
  image: string | null;
  available: boolean;
}

export interface CreateTaskClientRow {
  id: number;
  name: string;
  image: string | null;
  city: string | null;
}

export interface CreateTaskPayload {
  task_name: string;
  task_type: string;
  description: string;
  urgent: boolean;
  task_date: string;
  technician_id: number | null;
  client_id: number | null;
  helping_user_ids: number[];
}

export interface TaskDetailsEventRow {
  id: number;
  event_type: string;
  event_time: string | null;
  event_time_label: string | null;
  latitude: number | null;
  longitude: number | null;
  user_id: number | null;
  user_name: string | null;
  user_image: string | null;
}

export interface TaskDetailsServiceRow {
  id: number;
  name: string;
  description: string | null;
  price: number | null;
}

export interface ServiceCatalogRow {
  id: number;
  name: string;
  description: string | null;
  price: number | null;
}

export interface TaskDetailsServicePropositionRow {
  id: number;
  name: string;
  status: string;
  proposed_by: number | null;
  proposed_by_name: string | null;
  created_at: string | null;
}

export interface TaskDetailsWarrantyRow {
  id: number;
  product_name: string;
  category: string | null;
  purchase_date: string | null;
  warranty_expiry: string | null;
  warranty_status: string | null;
  days_left_in_warranty: string;
  serial_number: string | null;
}

export interface TaskDetailsRow {
  id: number;
  client_id: number | null;
  task_name: string;
  task_type: string | null;
  description: string | null;
  status: string;
  current_visit_status: string | null;
  has_ongoing_visit: boolean;
  urgent: boolean;
  task_date: string | null;
  started_at: string | null;
  finished_at: string | null;
  is_paid: boolean;
  amount_paid: number | null;
  admin_delivery_amount: number | null;
  admin_delivery_task_id: number | null;
  admin_delivery_received_by_user_id: number | null;
  admin_delivery_received_by_user_name: string | null;
  hourly_rate: number | null;
  technician_id: number | null;
  technician_name: string | null;
  technician_image: string | null;
  technician: { id: number; name: string; image: string | null } | null;
  current_user_id: number | null;
  is_main_technician: boolean;
  can_manage_task: boolean;
  user_last_event: string | null;
  helping_users: Array<{ id: number; name: string; image: string | null }>;
  client_name: string | null;
  client_city: string | null;
  client_image: string | null;
  services: TaskDetailsServiceRow[];
  service_propositions: TaskDetailsServicePropositionRow[];
  task_products: Array<{ id: number; product_name: string; quantity: number }>;
  events: TaskDetailsEventRow[];
}

export interface UpdateTaskDescriptionResponse {
  success: boolean;
  message: string;
  description: string | null;
}

export interface UpdateTaskPaymentResponse {
  success: boolean;
  message: string;
  task?: {
    id: number;
    is_paid: boolean;
    amount_paid: number | null;
  };
}

export interface UpdateTaskAdminDeliveryPaymentResponse {
  success: boolean;
  message: string;
  task?: {
    id: number;
    admin_delivery_amount: number | null;
    admin_delivery_task_id: number | null;
  };
  delivery_task_id?: number;
}

export interface UpdateTaskServicesResponse {
  success: boolean;
  message: string;
  services: TaskDetailsServiceRow[];
  total_services_price?: number;
}

export interface ProposeTaskServiceResponse {
  success: boolean;
  message: string;
  proposition?: {
    id: number;
    name: string;
    status: string;
  };
}

export interface TaskProgressActionResponse {
  success: boolean;
  message?: string;
  event?: {
    id?: number;
    event_type?: string;
    event_time?: string | null;
    created_at?: string | null;
    user_id?: number | null;
  };
  task_status?: string;
  current_visit_status?: string | null;
  has_ongoing_visit?: boolean;
  user_last_event?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TasksApiService {
  private readonly http = inject(HttpClient);

  getCalendarMonth(start: string, end: string): Observable<CalendarPayload> {
    return this.http.get<CalendarPayload>(`${environment.apiBaseUrl}/tasks/calendar/month`, {
      params: { start, end },
    });
  }

  getDeliveredPayments(page: number, perPage: number): Observable<DeliveredPaymentsResponse> {
    return this.http.get<DeliveredPaymentsResponse>(`${environment.apiBaseUrl}/tasks/delivered-payments`, {
      params: { page: String(page), per_page: String(perPage) },
    });
  }

  getTrackingUsers(): Observable<TrackingUserRow[]> {
    return this.http.get<TrackingUserRow[]>(`${environment.apiBaseUrl}/tasks/tracking/users`);
  }

  getTrackingEvents(userId: number, date: string): Observable<{ success: boolean; tracking: TrackingEventRow[] }> {
    return this.http.get<{ success: boolean; tracking: TrackingEventRow[] }>(
      `${environment.apiBaseUrl}/tasks/tracking/${userId}`,
      { params: { date } },
    );
  }

  getCreateTaskTypes(): Observable<{ types: CreateTaskTypeRow[] }> {
    return this.http.get<{ types: CreateTaskTypeRow[] }>(`${environment.apiBaseUrl}/tasks/create/task-types`);
  }

  getCreateTaskClients(): Observable<{ clients: CreateTaskClientRow[] }> {
    return this.http.get<{ clients: CreateTaskClientRow[] }>(`${environment.apiBaseUrl}/tasks/create/clients`);
  }

  getCreateTaskTechnicians(taskDate: string): Observable<CreateTaskTechnicianRow[]> {
    return this.http.get<CreateTaskTechnicianRow[]>(`${environment.apiBaseUrl}/tasks/create/technicians`, {
      params: { task_date: taskDate },
    });
  }

  getCreateTaskUsers(taskDate: string): Observable<{ success: boolean; users: CreateTaskUserRow[] }> {
    return this.http.get<{ success: boolean; users: CreateTaskUserRow[] }>(`${environment.apiBaseUrl}/tasks/create/users`, {
      params: { task_date: taskDate },
    });
  }

  createTask(payload: CreateTaskPayload): Observable<{ success: boolean; message: string; task: any }> {
    return this.http.post<{ success: boolean; message: string; task: any }>(`${environment.apiBaseUrl}/tasks`, payload);
  }

  getTaskDetails(taskId: number): Observable<{ success: boolean; task: TaskDetailsRow }> {
    return this.http.get<{ success: boolean; task: TaskDetailsRow }>(`${environment.apiBaseUrl}/tasks/${taskId}`);
  }

  updateTaskDescription(taskId: number, description: string): Observable<UpdateTaskDescriptionResponse> {
    return this.http.post<UpdateTaskDescriptionResponse>(`${environment.apiBaseUrl}/tasks/${taskId}/update-description`, {
      description,
    });
  }

  updateTaskPayment(taskId: number, amountPaid: number): Observable<UpdateTaskPaymentResponse> {
    return this.http.post<UpdateTaskPaymentResponse>(`${environment.apiBaseUrl}/tasks/${taskId}/payment`, {
      amount_paid: amountPaid,
    });
  }

  updateTaskAdminDeliveryPayment(
    taskId: number,
    amount: number,
    deliveryDate?: string | null,
  ): Observable<UpdateTaskAdminDeliveryPaymentResponse> {
    return this.http.post<UpdateTaskAdminDeliveryPaymentResponse>(
      `${environment.apiBaseUrl}/tasks/${taskId}/admin-delivery-payment`,
      {
        amount,
        delivery_date: deliveryDate || undefined,
      },
    );
  }

  getAllServices(): Observable<{ success: boolean; services: ServiceCatalogRow[] }> {
    return this.http.get<{ success: boolean; services: ServiceCatalogRow[] }>(
      `${environment.apiBaseUrl}/services/all`,
    );
  }

  updateTaskServices(taskId: number, serviceIds: number[]): Observable<UpdateTaskServicesResponse> {
    return this.http.post<UpdateTaskServicesResponse>(`${environment.apiBaseUrl}/tasks/${taskId}/services`, {
      service_ids: serviceIds,
    });
  }

  proposeTaskService(taskId: number, name: string): Observable<ProposeTaskServiceResponse> {
    return this.http.post<ProposeTaskServiceResponse>(
      `${environment.apiBaseUrl}/tasks/${taskId}/propose-service`,
      { name },
    );
  }

  startTaskRoute(taskId: number): Observable<TaskProgressActionResponse> {
    return this.http.post<TaskProgressActionResponse>(`${environment.apiBaseUrl}/tasks/${taskId}/start-route`, {});
  }

  endTaskRoute(taskId: number): Observable<TaskProgressActionResponse> {
    return this.http.post<TaskProgressActionResponse>(`${environment.apiBaseUrl}/tasks/${taskId}/end-route`, {});
  }

  startTaskVisit(taskId: number): Observable<TaskProgressActionResponse> {
    return this.http.post<TaskProgressActionResponse>(`${environment.apiBaseUrl}/tasks/${taskId}/start-visit`, {});
  }

  pauseTaskVisit(taskId: number): Observable<TaskProgressActionResponse> {
    return this.http.post<TaskProgressActionResponse>(`${environment.apiBaseUrl}/tasks/${taskId}/pause-visit`, {});
  }

  resumeTaskVisit(taskId: number): Observable<TaskProgressActionResponse> {
    return this.http.post<TaskProgressActionResponse>(`${environment.apiBaseUrl}/tasks/${taskId}/resume-visit`, {});
  }

  finishTaskVisit(taskId: number): Observable<TaskProgressActionResponse> {
    return this.http.post<TaskProgressActionResponse>(`${environment.apiBaseUrl}/tasks/${taskId}/finish-visit`, {});
  }

  finishTask(taskId: number): Observable<TaskProgressActionResponse> {
    return this.http.post<TaskProgressActionResponse>(`${environment.apiBaseUrl}/tasks/${taskId}/finish`, {});
  }

  getClientWarrantyProducts(
    clientId: number,
    page = 1,
    limit = 100,
  ): Observable<{ success: boolean; products: TaskDetailsWarrantyRow[] }> {
    return this.http.get<{ success: boolean; products: TaskDetailsWarrantyRow[] }>(
      `${environment.apiBaseUrl}/clients/${clientId}/products`,
      { params: { page: String(page), limit: String(limit) } },
    );
  }
}
