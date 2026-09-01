import { apiClient } from '@/lib/api-client';
import type { AuthToken, LoginCredentials, RegisterPayload, User } from '../types';

/** Raw shapes returned by the backend, using its snake_case fields. */
interface RawUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

interface RawTokenResponse {
  access_token: string;
  token_type: string;
  user: RawUser;
}

const toUser = (raw: RawUser): User => ({
  id: raw.id,
  email: raw.email,
  name: raw.name,
  role: raw.role as User['role'],
});

const toAuthToken = (raw: RawTokenResponse): AuthToken => ({
  accessToken: raw.access_token,
  tokenType: raw.token_type,
  user: toUser(raw.user),
});

export const loginUser = async (credentials: LoginCredentials): Promise<AuthToken> => {
  const raw = await apiClient.post<RawTokenResponse>('/auth/login', credentials);
  return toAuthToken(raw);
};

export const registerUser = async (payload: RegisterPayload): Promise<User> => {
  const raw = await apiClient.post<RawUser>('/auth/register', payload);
  return toUser(raw);
};

export const getCurrentUser = async (): Promise<User> => {
  const raw = await apiClient.get<RawUser>('/auth/me');
  return toUser(raw);
};
