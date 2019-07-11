import { HookContext } from '@ihadeed/feathers';
import { stripSlashes } from '@ihadeed/commons';

export const authentication = () => {
  return (context: HookContext) => {
    const { app, params, path, method, app: { authentication: service } } = context;

    if (stripSlashes(service.options.path) === path && method === 'create') {
      return context;
    }

    return Promise.resolve(app.get('authentication')).then(authResult => {
      if (authResult) {
        context.params = Object.assign({}, authResult, params);
      }

      return context;
    });
  };
};
