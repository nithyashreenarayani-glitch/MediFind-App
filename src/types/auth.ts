export type UserRole = "USER" | "PHARMACY" | "ADMIN";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  isDisabled: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}
