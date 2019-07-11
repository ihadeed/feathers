import { convert, Timeout } from '@ihadeed/errors';
import { BaseQuery, FindOneParams, FindOneQuery, Paginated, Params } from '@ihadeed/feathers';
import Debug from 'debug';
import { Query } from '../../feathers';

const debug = Debug('@ihadeed/transport-commons/client');

const namespacedEmitterMethods = [
  'addListener',
  'emit',
  'listenerCount',
  'listeners',
  'on',
  'once',
  'prependListener',
  'prependOnceListener',
  'removeAllListeners',
  'removeListener',
];
const otherEmitterMethods = [
  'eventNames',
  'getMaxListeners',
  'setMaxListeners',
];

const addEmitterMethods = <T = any>(service: Service<T>) => {
  otherEmitterMethods.forEach(method => {
    service[method] = function (...args: any[]) {
      if (typeof this.connection[method] !== 'function') {
        throw new Error(`Can not call '${method}' on the client service connection`);
      }

      return this.connection[method](...args);
    };
  });

  // Methods that should add the namespace (service path)
  namespacedEmitterMethods.forEach(method => {
    service[method] = function (name: string, ...args: any[]) {
      if (typeof this.connection[method] !== 'function') {
        throw new Error(`Can not call '${method}' on the client service connection`);
      }

      const eventName = `${this.path} ${name}`;

      debug(`Calling emitter method ${method} with ` +
        `namespaced event '${eventName}'`);

      const result = this.connection[method](eventName, ...args);

      return result === this.connection ? this : result;
    };
  });
};

interface ServiceOptions {
  name: string;
  connection: any;
  method: string;
  events?: string[];
  timeout?: number;
}

export class Service<T = any> {
  events: string[];
  path: string;
  connection: any;
  method: string;
  timeout: number;

  constructor({ events, name, connection, method, timeout }: ServiceOptions) {
    this.events = events;
    this.path = name;
    this.connection = connection;
    this.method = method;
    this.timeout = timeout || 5000;

    addEmitterMethods(this);
  }

  send(method: 'find', query?: FindOneQuery<T>): Promise<T>
  send(method: 'find', query?: Query<T>): Promise<T[] | Paginated<T[]>>
  send(method: 'get' | 'update' | 'patch' | 'remove', ...args: any[]): Promise<T>
  send(method: 'create', data: Partial<T> | T, params?: Params<T>): Promise<T>
  send(method: 'create', data: Partial<T[]> | T, params?: Params<T>): Promise<T[]>
  send(method: string, ...args: any[]) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(
        new Timeout(`Timeout of ${this.timeout}ms exceeded calling ${method} on ${this.path}`, {
          timeout: this.timeout,
          method,
          path: this.path,
        }),
      ), this.timeout);

      args.unshift(method, this.path);
      args.push(function (error: any, data: any) {
        error = convert(error);
        clearTimeout(timeoutId);

        error ? reject(error) : resolve(data);
      });

      debug(`Sending socket.${this.method}`, args);

      this.connection[this.method](...args);
    });
  }

  // @ts-ignore
  find(params?: FindOneParams<T>): Promise<T>
  find(params?: Params<T>): Promise<T[] | Paginated<T[]>>
  find(params?: Params<T> | FindOneParams<T>) {
    params = params || {};
    return this.send('find', params.query || {});
  }

  get(id: number | string, params: Params<T> = {}): Promise<T> {
    return this.send('get', id, params.query || {});
  }

  create(data: any, params: Params<T> = {}) {
    return this.send('create', data, params.query || {});
  }

  update(id: number | string, data: any, params: Params<T> = {}) {
    return this.send('update', id, data, params.query || {});
  }

  patch(id: number | string, data: any, params: Params<T> = {}) {
    return this.send('patch', id, data, params.query || {});
  }

  remove(id: number | string, params: Params<T> = {}) {
    return this.send('remove', id, params.query || {});
  }

  // `off` is actually not part of the Node event emitter spec
  // but we are adding it since everybody is expecting it because
  // of the emitter-component Socket.io is using
  off(name: string, ...args: any[]) {
    if (typeof this.connection.off === 'function') {
      return this.connection.off(`${this.path} ${name}`, ...args);
    } else if (args.length === 0) {
      // @ts-ignore
      return this.removeAllListeners(name);
    }

    // @ts-ignore
    return this.removeListener(name, ...args);
  }
}
