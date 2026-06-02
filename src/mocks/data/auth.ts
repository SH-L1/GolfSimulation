import type { AuthUser, AuthResponse } from '../../types/auth';

export const MOCK_USER: AuthUser = {
  id:               'mock-user-001',
  name:             '김핸디',
  email:            'test@handy.golf',
  handicap:         12,
  experience_level: 'experienced',
  avatar_url:       null,
};

export const MOCK_AUTH_RESPONSE: AuthResponse = {
  access_token: 'mock-access-token-dev',
  token_type:   'Bearer',
  user:         MOCK_USER,
};
