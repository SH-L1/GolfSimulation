import { authHandlers }    from './auth';
import { module1Handlers } from './module1';
import { module2Handlers } from './module2';
import { module3Handlers } from './module3';

export const handlers = [
  ...authHandlers,
  ...module1Handlers,
  ...module2Handlers,
  ...module3Handlers,
];
