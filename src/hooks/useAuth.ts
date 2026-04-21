import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// UI에서 사용하는 3단계 레벨 (LevelSetting 화면)
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

// 아키텍처 8.3절 — API 파라미터는 2단계로 전달
export type ApiExperienceLevel = 'beginner' | 'experienced';

/** UI 3단계 → API 2단계 변환: intermediate/advanced → 'experienced' */
export function toApiLevel(level: ExperienceLevel): ApiExperienceLevel {
  return level === 'beginner' ? 'beginner' : 'experienced';
}

export const STORAGE_KEY_SETUP_DONE      = 'handy_setup_done';
export const STORAGE_KEY_EXPERIENCE_LEVEL = 'handy_experience_level';

export interface User {
  id: string;
  name: string;
  email: string;
  handicap: number;
  experience_level: ExperienceLevel;
  avatarUrl?: string;
}

const MOCK_USER: User = {
  id: 'user-001',
  name: '김골프',
  email: 'golf@example.com',
  handicap: 12,
  experience_level: 'beginner',
  avatarUrl: undefined,
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(MOCK_USER);
  const [loading, setLoading] = useState(false);

  const login = async (email: string, _password: string) => {
    setLoading(true);
    await new Promise<void>(res => setTimeout(() => res(), 800));
    const stored = await AsyncStorage.getItem(STORAGE_KEY_EXPERIENCE_LEVEL);
    const level = (stored as ExperienceLevel | null) ?? 'beginner';
    setUser({ ...MOCK_USER, email, experience_level: level });
    setLoading(false);
  };

  const logout = () => setUser(null);

  const updateExperienceLevel = async (level: ExperienceLevel) => {
    await AsyncStorage.setItem(STORAGE_KEY_EXPERIENCE_LEVEL, level);
    if (user) setUser({ ...user, experience_level: level });
  };

  return { user, loading, login, logout, updateExperienceLevel, isLoggedIn: !!user };
}
