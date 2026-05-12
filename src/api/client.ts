import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigationRef } from '../navigation/navigationRef';

// ── Base URL ──────────────────────────────────────────────────────
export const API_BASE = 'http://10.0.2.2:8000/api'; // Android 에뮬레이터 → localhost

// ── Token Storage ─────────────────────────────────────────────────
const TOKEN_KEY = 'handy_access_token';

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// ── Error Types ───────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = '인증이 필요합니다.') {
    super(401, 'UNAUTHORIZED', message);
    this.name = 'UnauthorizedError';
  }
}

// ── Base Fetch ────────────────────────────────────────────────────
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    await clearToken();
    if (navigationRef.isReady()) { navigationRef.navigate('Login'); }
    throw new UnauthorizedError();
  }

  if (res.status === 204) {
    return undefined as T;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { code?: string; message?: string };
    throw new ApiError(
      res.status,
      body.code ?? 'UNKNOWN',
      body.message ?? res.statusText,
    );
  }

  return res.json() as Promise<T>;
}

// multipart/form-data (파일 업로드)
export async function apiFetchMultipart<T>(
  path: string,
  body: FormData,
  method: string = 'POST',
): Promise<T> {
  const token = await getToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { method, headers, body });

  if (res.status === 401) {
    await clearToken();
    if (navigationRef.isReady()) { navigationRef.navigate('Login'); }
    throw new UnauthorizedError();
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as { code?: string; message?: string };
    throw new ApiError(
      res.status,
      errBody.code ?? 'UNKNOWN',
      errBody.message ?? res.statusText,
    );
  }

  return res.json() as Promise<T>;
}

// ── Endpoints ─────────────────────────────────────────────────────
export const ENDPOINTS = {
  auth: {
    login:       '/auth/login',
    loginKakao:  '/auth/login/kakao',
    loginGoogle: '/auth/login/google',
    me:          '/auth/me',
    verify:      '/auth/verify',
  },
  module1: {
    analyze:  '/module1/analyze',
    status:   (jobId: string)     => `/module1/status/${jobId}`,
    result:   (sessionId: string) => `/module1/result/${sessionId}`,
    sessions: '/module1/sessions',
    session:  (sessionId: string) => `/module1/sessions/${sessionId}`,
  },
  module2: {
    stream:  '/module2/chat/stream',
    history: (sessionId: string) => `/module2/history/${sessionId}`,
  },
  module3: {
    landmarks: (sessionId: string) => `/module3/landmarks/${sessionId}`,
    pro:       (playerId: string)  => `/module3/pro/${playerId}`,
  },
} as const;
