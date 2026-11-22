
export interface ProfileUpdateDto {
  name: string;
  mobileNo: string | null;
  designation: string | null;
}

export interface PasswordChangeDto {
  currentPassword: string;
  newPassword: string;
}

export interface DeleteAccountDto {
  password: string;
  confirmation: string;
}

export interface ActivityLogDto {
  action: string;
  description: string | null;
  time: string;
}

/** GET /profile/logs?page=&size= */
export interface PagedLogsDto {
  total: number;
  logs: ActivityLogDto[];
}
