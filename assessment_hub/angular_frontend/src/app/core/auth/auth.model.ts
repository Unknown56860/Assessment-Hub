import { UserRole, ProfileStatus } from "../../shared/models/common.types";

/** POST /auth/login */
export interface LoginRequestDto {
  email: string;
  password: string;
}

/** JSON part of POST /auth/register */
export interface RegisterRequestDto {
  name: string;
  email: string;
  password: string;
  mobileNo: string | null;
  designation: string | null;
}

export interface UserDto {
  name: string;
  email: string;
  role: UserRole;
  mobileNo: string | null;
  designation: string | null;
  profilePic: string | null; // backend-built URL under /profile/pfp
  status: ProfileStatus;
  createdAt: string;
  updatedAt: string;
}

