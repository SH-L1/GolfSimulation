import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loginEmail,
  loginKakao,
  loginGoogle,
  getMe,
  logout as apiLogout,
  type AuthUser,
} from '../api/auth';
import { getToken } from '../api/client';
import type { ExperienceLevel } from '../utils/experienceMapper';

// 하위 호환 re-export (기존 화면에서 이 경로로 임포트)
export type { ExperienceLevel, ApiExperienceLevel } from '../utils/experienceMapper';
export { toApiLevel } from '../utils/experienceMapper';

export const STORAGE_KEY_SETUP_DONE       = 'handy_setup_done';
export const STORAGE_KEY_EXPERIENCE_LEVEL = 'handy_experience_level';

// ── UI User Type ──────────────────────────────────────────────────
export interface User {
  id:               string;
  name:             string;
  email:            string;
  handicap:         number;
  experience_level: ExperienceLevel;
  avatarUrl?:       string;
}

function toUiUser(api: AuthUser, uiLevel: ExperienceLevel): User {
  return {
    id:               api.id,
    name:             api.name,
    email:            api.email,
    handicap:         api.handicap,
    experience_level: uiLevel,
    avatarUrl:        api.avatar_url ?? undefined,
  };
}

async function getStoredLevel(): Promise<ExperienceLevel> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY_EXPERIENCE_LEVEL);
  return (stored as ExperienceLevel | null) ?? 'beginner';
}

// ── Hook ──────────────────────────────────────────────────────────
export function useAuth() {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // true 동안 앱 스플래시 유지

  // 앱 시작 시 저장된 JWT로 세션 복원
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const apiUser = await getMe();
          const level   = await getStoredLevel();
          setUser(toUiUser(apiUser, level));
        }
      } catch {
        // 토큰 만료 or 네트워크 없음 — 로그인 화면으로
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    try {
      const apiUser = await loginEmail(email, password);
      const level   = await getStoredLevel();
      setUser(toUiUser(apiUser, level));
    } finally {
      setLoading(false);
    }
  };

  const loginWithKakao = async (oauthToken: string): Promise<void> => {
    setLoading(true);
    try {
      const apiUser = await loginKakao(oauthToken);
      const level   = await getStoredLevel();
      setUser(toUiUser(apiUser, level));
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (oauthToken: string): Promise<void> => {
    setLoading(true);
    try {
      const apiUser = await loginGoogle(oauthToken);
      const level   = await getStoredLevel();
      setUser(toUiUser(apiUser, level));
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    await apiLogout();
    setUser(null);
  };

  const updateExperienceLevel = async (level: ExperienceLevel): Promise<void> => {
    await AsyncStorage.setItem(STORAGE_KEY_EXPERIENCE_LEVEL, level);
    if (user) { setUser({ ...user, experience_level: level }); }
  };

  return {
    user,
    loading,
    login,
    loginWithKakao,
    loginWithGoogle,
    logout,
    updateExperienceLevel,
    isLoggedIn: !!user,
  };
}
