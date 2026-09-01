/** Roles a user account can have, mirrors the backend `UserRole` enum. */
export type UserRole = 'customer' | 'seller';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}

export interface AuthToken {
  accessToken: string;
  tokenType: string;
  user: User;
}
