import { useState } from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
  handicap: number;
  avatarUrl?: string;
}

const MOCK_USER: User = {
  id: 'user-001',
  name: '김골프',
  email: 'golf@example.com',
  handicap: 12,
  avatarUrl: undefined,
};

// Mock hook — 인증 로직 연동 전 목업 데이터로 동작
export function useAuth() {
  const [user, setUser] = useState<User | null>(MOCK_USER);
  const [loading, setLoading] = useState(false);

  const login = async (email: string, _password: string) => {
    setLoading(true);
    await new Promise(res => setTimeout(res, 800));
    setUser({ ...MOCK_USER, email });
    setLoading(false);
  };

  const logout = () => setUser(null);

  return { user, loading, login, logout, isLoggedIn: !!user };
}
