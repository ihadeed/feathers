// @ts-ignore
import { EventEmitter } from "events";
import Router from 'radix-router';
import { stripSlashes } from '@ihadeed/commons';
import { Application, KeyValue } from '@ihadeed/feathers';

export const ROUTER = Symbol('@ihadeed/transport-commons/router');

declare module '@ihadeed/feathers' {
  interface Application<ServiceTypes extends KeyValue = any> extends EventEmitter {
    lookup (path: string): { [key: string]: string };
  }
}

export const routing = () => (app: Application) => {
  if (typeof app.lookup === 'function') {
    return;
  }

  const router = new Router();

  Object.assign(app, {
    [ROUTER]: router,
    lookup (path: string): { [key: string]: string } {
      if (!path) {
        return null;
      }

      return this[ROUTER].lookup(stripSlashes('' + path) || '/');
    }
  });

  // Add a mixin that registers a service on the router
  app.mixins.push((service, path) => {
    // @ts-ignore
    app[ROUTER].insert({ path, service });
    // @ts-ignore
    app[ROUTER].insert({
      path: `${path}/:__id`,
      service
    });
  });
};
