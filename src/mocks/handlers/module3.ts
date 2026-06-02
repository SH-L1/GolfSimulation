import { http, HttpResponse } from 'msw';
import { API_BASE } from '../../api/client';
import { MOCK_LANDMARKS } from '../data/module3';

export const module3Handlers = [
  http.get(`${API_BASE}/module3/landmarks/:sessionId`, () =>
    HttpResponse.json(MOCK_LANDMARKS),
  ),

  http.get(`${API_BASE}/module3/pro/:playerId`, () =>
    HttpResponse.json(MOCK_LANDMARKS),
  ),
];
