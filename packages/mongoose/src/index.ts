import * as hooks from './hooks';
import { init } from './service';

Object.assign(init, {
  hooks,
  service: init,
});
export default init;

export * from './service';
export * from './transaction-manager';
export * from './hooks';
