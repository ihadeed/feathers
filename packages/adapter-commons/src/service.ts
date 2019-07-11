import { BadRequest, MethodNotAllowed, NotImplemented } from '@ihadeed/errors';
import { FindOneParams, Id, NullableId, Paginated, PaginationParams, Params, ServiceMethods } from '@ihadeed/feathers';
import filterQuery from './filter-query';

const callMethod = (self: any, name: any, ...args: any[]) => {
  if (typeof self[name] !== 'function') {
    return Promise.reject(new NotImplemented(`Method ${name} not available`));
  }

  return self[name](...args);
};

const alwaysMulti: { [key: string]: boolean } = {
  find: true,
  get: false,
  update: false,
};

export interface ServiceOptions {
  events: string[];
  multi: boolean | string[];
  id: string;
  paginate: any;
  whitelist: string[];
  filters: string[];
}

export interface InternalServiceMethods<T = any> {
  _find(params?: FindOneParams<T>): Promise<T>;

  _find(params?: PaginationParams<T>): Promise<Paginated<T>>;

  _find(params?: Params<T>): Promise<T[]>;

  _find(params?: Params<T>): Promise<T> | Promise<T[]> | Promise<Paginated<T>>;

  _get(id: Id, params?: Params<T>): Promise<T>;

  _create(data: Partial<T>, params?: Params<T>): Promise<T>;

  _create(data: Partial<T>[], params?: Params<T>): Promise<T[]>;

  _create(data: Partial<T> | Array<Partial<T>>, params?: Params<T>): Promise<T | T[]>;

  _update(id: NullableId, data: T, params?: Params<T>): Promise<T>;

  _patch(id: NullableId, data: Partial<T>, params?: Params<T>): Promise<T>;

  _remove(id: NullableId, params?: Params<T>): Promise<T>;
}

export class AdapterService<T = any> implements ServiceMethods<T> {
  options: ServiceOptions;

  constructor(options: Partial<ServiceOptions>) {
    this.options = Object.assign({
      id: 'id',
      events: [],
      paginate: false,
      multi: false,
      filters: [],
      whitelist: [],
    }, options);
  }

  get id() {
    return this.options.id;
  }

  get events() {
    return this.options.events;
  }

  filterQuery(params?: Params<T>, opts?: any) {
    params = params || {};
    opts = opts || {};
    params.query = params.query || {};

    const paginate = typeof params.paginate !== 'undefined' ? params.paginate : this.options.paginate;
    const options = {
      operators: this.options.whitelist || [],
      filters: this.options.filters,
      paginate,
      ...opts,
    };

    const result = filterQuery(params.query, options);

    return {
      ...result,
      paginate,
    };
  }

  allowsMulti(method: string) {
    const always = alwaysMulti[method];

    if (typeof always !== 'undefined') {
      return always;
    }

    const option = this.options.multi;

    if (option === true || option === false) {
      return option;
    } else {
      return option.includes(method);
    }
  }

  async find(params?: FindOneParams<T>): Promise<T>;
  async find(params?: PaginationParams<T>): Promise<Paginated<T>>;
  async find(params?: Params<T>): Promise<T[]>;
  async find(params?: Params<T>) {
    return callMethod(this, '_find', params);
  }

  async get(id: Id, params?: Params<T>): Promise<T> {
    return callMethod(this, '_get', id, params);
  }

  async create(data: Partial<T>, params?: Params<T>): Promise<T>;
  async create(data: Partial<T>[], params?: Params<T>): Promise<T[]>;
  async create(data: Partial<T> | Array<Partial<T>>, params?: Params<T>) {
    if (Array.isArray(data) && !this.allowsMulti('create')) {
      throw new MethodNotAllowed(`Can not create multiple entries`);
    }

    return callMethod(this, '_create', data, params);
  }

  async update(id: NullableId, data: T, params?: Params<T>): Promise<T> {
    if (id === null || Array.isArray(data)) {
      return Promise.reject(new BadRequest(
        `You can not replace multiple instances. Did you mean 'patch'?`,
      ));
    }

    return callMethod(this, '_update', id, data, params);
  }

  async patch(id: NullableId, data: Partial<T>, params?: Params<T>): Promise<T> {
    if (id === null && !this.allowsMulti('patch')) {
      throw new MethodNotAllowed(`Can not patch multiple entries`);
    }

    return callMethod(this, '_patch', id, data, params);
  }

  async remove(id: NullableId, params?: Params<T>): Promise<T> {
    if (id === null && !this.allowsMulti('remove')) {
      throw new MethodNotAllowed(`Can not remove multiple entries`);
    }

    return callMethod(this, '_remove', id, params);
  }
}
