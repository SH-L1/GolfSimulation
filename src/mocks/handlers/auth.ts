import { http, HttpResponse } from 'msw';
import { API_BASE } from '../../api/client';
import { MOCK_AUTH_RESPONSE, MOCK_USER } from '../data/auth';

export const authHandlers = [
  http.post(`${API_BASE}/auth/login`, () =>
    HttpResponse.json(MOCK_AUTH_RESPONSE),
  ),

  http.post(`${API_BASE}/auth/login/kakao`, () =>
    HttpResponse.json(MOCK_AUTH_RESPONSE),
  ),

  http.post(`${API_BASE}/auth/login/google`, () =>
    HttpResponse.json(MOCK_AUTH_RESPONSE),
  ),

  http.get(`${API_BASE}/auth/me`, () =>
    HttpResponse.json(MOCK_USER),
  ),

  http.get(`${API_BASE}/auth/verify`, () =>
    HttpResponse.json({ valid: true }),
  ),
];
