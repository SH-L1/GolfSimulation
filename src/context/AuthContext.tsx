import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  signUp as apiSignUp,
  loginEmail,
  loginKakao,
  loginGoogle,
  getMe,
  logout as apiLogout,
  type AuthUser,
} from '../api/auth';
import { getToken } from '../api/client';
import type { ExperienceLevel } from '../utils/experienceMapper';

export const STORAGE_KEY_SETUP_DONE       = 'handy_setup_done';
export const STORAGE_KEY_EXPERIENCE_LEVEL = 'handy_experience_level';

export interface User {
  id:               string;
  name:             string;
  email:            string | null;
  handicap:         number;
  experience_level: ExperienceLevel;
  avatarUrl?:       string;
}

interface AuthContextValue {
  user:                  User | null;
  loading:               boolean;
  isLoggedIn:            boolean;
  signUp:                (name: string, email: string, password: string) => Promise<void>;
  login:                 (email: string, password: string) => Promise<void>;
  loginWithKakao:        (oauthToken: string) => Promise<void>;
  loginWithGoogle:       (oauthToken: string) => Promise<void>;
  logout:                () => Promise<void>;
  updateExperienceLevel: (level: ExperienceLevel) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
        // 토큰 만료 or 네트워크 없음
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signUp = async (name: string, email: string, password: string) => {
    setLoading(true);
    try {
      const apiUser = await apiSignUp(name, email, password);
      const level   = await getStoredLevel();
      setUser(toUiUser(apiUser, level));
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const apiUser = await loginEmail(email, password);
      const level   = await getStoredLevel();
      setUser(toUiUser(apiUser, level));
    } finally {
      setLoading(false);
    }
  };

  const loginWithKakao = async (oauthToken: string) => {
    setLoading(true);
    try {
      const apiUser = await loginKakao(oauthToken);
      const level   = await getStoredLevel();
      setUser(toUiUser(apiUser, level));
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (oauthToken: string) => {
    setLoading(true);
    try {
      const apiUser = await loginGoogle(oauthToken);
      const level   = await getStoredLevel();
      setUser(toUiUser(apiUser, level));
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  const updateExperienceLevel = async (level: ExperienceLevel) => {
    await AsyncStorage.setItem(STORAGE_KEY_EXPERIENCE_LEVEL, level);
    if (user) {
      setUser({ ...user, experience_level: level });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isLoggedIn: !!user,
        signUp,
        login,
        loginWithKakao,
        loginWithGoogle,
        logout,
        updateExperienceLevel,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) { throw new Error('useAuth must be used within AuthProvider'); }
  return ctx;
}
