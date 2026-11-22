import { UserDto } from "../../core/auth/auth.model";
import { AdminAction, MessageStatus, ProfileStatus } from "../../shared/models/common.types";

/** GET /admin/messages → list item */
export interface AdminMessageDto {
  message_id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  created_at: string;
  status: MessageStatus;
}

export interface AdminMessagePageDto {
  total_read: number;
  total_unread: number;
  total_answered: number;
  messages: AdminMessageDto[];
}

export interface AdminMessageActionDto {
  id: number;
  action: AdminAction;
  /** Required when action = UPDATE_STATUS. */
  status?: MessageStatus;
}

export interface AdminUserPageDto {
  total_pending: number;
  total_active: number;
  total_restricted: number;
  users: UserDto[];
}

export interface AdminUserActionDto {
  email: string;
  status: ProfileStatus;
}

/** GET /admin/stats (snake_case mirrors the backend record as-is) */
export interface AdminDashboardDto {
  db_status: string;
  storage_status: string;
  total_users: number;
  total_messages: number;
  assessment_trend: { date: string; assessments: number }[];
}
