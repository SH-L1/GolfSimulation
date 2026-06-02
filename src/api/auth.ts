import { apiFetch, setToken, clearToken, ENDPOINTS } from './client';
import type { AuthUser, AuthResponse } from '../types/auth';

export type { AuthUser } from '../types/auth';

export async function signUp(name: string, email: string, password: string): Promise<AuthUser> {
  const data = await apiFetch<AuthResponse>(ENDPOINTS.auth.signup, {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  await setToken(data.access_token);
  return data.user;
}

export async function loginEmail(email: string, password: string): Promise<AuthUser> {
  const data = await apiFetch<AuthResponse>(ENDPOINTS.auth.login, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await setToken(data.access_token);
  return data.user;
}

export async function loginKakao(oauthToken: string): Promise<AuthUser> {
  const data = await apiFetch<AuthResponse>(ENDPOINTS.auth.loginKakao, {
    method: 'POST',
    body: JSON.stringify({ oauth_token: oauthToken }),
  });
  await setToken(data.access_token);
  return data.user;
}

export async function loginGoogle(oauthToken: string): Promise<AuthUser> {
  const data = await apiFetch<AuthResponse>(ENDPOINTS.auth.loginGoogle, {
    method: 'POST',
    body: JSON.stringify({ oauth_token: oauthToken }),
  });
  await setToken(data.access_token);
  return data.user;
}

export async function getMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>(ENDPOINTS.auth.me);
}

export async function verifyToken(): Promise<boolean> {
  const data = await apiFetch<{ valid: boolean }>(ENDPOINTS.auth.verify)
    .catch(() => ({ valid: false }));
  return data.valid;
}

export async function logout(): Promise<void> {
  await clearToken();
}
