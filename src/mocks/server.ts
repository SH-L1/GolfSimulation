// React Native에서는 msw/native를 사용해야 함.
// msw/node는 package.json exports에서 react-native 조건을 null로 막아놓음.
import { setupServer } from 'msw/native';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
