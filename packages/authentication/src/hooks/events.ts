import Debug from 'debug';
import { HookContext } from '@ihadeed/feathers';

const debug = Debug('@ihadeed/authentication/hooks/connection');
const EVENTS: { [key: string]: string } = {
  create: 'login',
  remove: 'logout'
};

export default () => (context: HookContext) => {
  const { method, app, result, params } = context;
  const event = EVENTS[method];

  if (event && params.provider && result) {
    debug(`Sending authentication event '${event}'`);
    app.emit(event, result, params, context);
  }

  return context;
};
