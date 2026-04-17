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
}
