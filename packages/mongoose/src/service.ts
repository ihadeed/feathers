import { AdapterService, InternalServiceMethods, select, ServiceOptions } from '@ihadeed/adapter-commons';
import errors from '@ihadeed/errors';
import { FindOneParams, Id, MongoosePopulateParams, Paginated, PaginationParams, Params } from '@ihadeed/feathers';
import _ from 'lodash';
import { UpdateManyOptions } from 'mongodb';
import mongoose from 'mongoose';

import { ERROR, errorHandler } from './error-handler';

export { ERROR } from './error-handler';

export interface MongooseServiceOptions<T extends mongoose.Document = any> extends ServiceOptions {
  Model: mongoose.Model<T>;
  lean?: boolean;
  overwrite?: boolean;
  useEstimatedDocumentCount?: boolean;
  discriminators?: mongoose.Model<T>[];
}

const defaultOptions: Partial<MongooseServiceOptions> = {
  lean: true,
  overwrite: true,
  useEstimatedDocumentCount: false,
  discriminators: [],
};

export type MongooseServiceDiscriminators<T extends mongoose.Document> = {
  [name: string]: mongoose.Model<T, any>;
};

export type MQuery<T extends mongoose.Document> = mongoose.DocumentQuery<T | null, T>;

export type MDoc<T> = mongoose.MongooseDocument & T & mongoose.Document & {
  toObject(options?: mongoose.DocumentToObjectOptions): T;

  populate(path: string): MDoc<T>;
  populate(path: string, names: string): MDoc<T>;
  populate(options: mongoose.ModelPopulateOptions | mongoose.ModelPopulateOptions[]): MDoc<T>;
  populate(options: string | mongoose.ModelPopulateOptions | mongoose.ModelPopulateOptions[]): MDoc<T>;
};

// Create the service.
export class Service<T, DT extends mongoose.Document & T = T & mongoose.Document> extends AdapterService<T> implements InternalServiceMethods<T> {
  discriminatorKey: string;
  discriminators: MongooseServiceDiscriminators<DT> = {};
  options: MongooseServiceOptions<DT>;

  get lean(): boolean {
    return this.options.lean;
  }

  get overwrite(): boolean {
    return this.options.overwrite;
  }

  get useEstimatedDocumentCount(): boolean {
    return this.options.useEstimatedDocumentCount;
  }

  constructor(options: MongooseServiceOptions<DT>) {
    super({
      ...options,
      id: '_id',
      whitelist: ['$and', '$regex'],
      filters: {
        ...options.filters,
        $populate(value) {
          return value;
        },
      },
    } as ServiceOptions);

    if (!options.Model || !options.Model.modelName) {
      throw new Error('You must provide a Mongoose Model');
    }

    options = {
      ...defaultOptions,
      ...options,
    };

    this.discriminatorKey = this.Model.schema.get('discriminatorKey');
    this.discriminators = options.discriminators.reduce((all, d) => {
      if (d.modelName) {
        all[d.modelName] = d;
      }

      return d;
    }, {});
  }

  get Model(): mongoose.Model<DT> {
    return this.options.Model;
  }

  _getOrFind(params: Params<T>);
  _getOrFind(id: string, params?: Params<T>);
  _getOrFind(id?: string | Params<T>, params?: Params<T>) {
    if (typeof id !== 'string') {
      return this._find(params);
    }

    return this._get(id, params);
  }

  async _find(params?: FindOneParams<T>): Promise<T>;
  async _find(params?: Params<T>): Promise<T[]>;
  async _find(params?: PaginationParams<T>): Promise<Paginated<T>>;
  async _find(params?: Params<T> | PaginationParams<T>): Promise<T | T[] | Paginated<T>> {
    params = params || {};
    params.query = params.query || {};

    const { filters, query, paginate } = this.filterQuery(params);
    const discriminator = params.query[this.discriminatorKey] || this.discriminatorKey;
    const model: mongoose.Model<DT> = this.discriminators[discriminator] || this.Model;
    const q: MQuery<DT> = model.find(query).lean(this.lean);

    // $select uses a specific find syntax, so it has to come first.
    if (Array.isArray(filters.$select)) {
      q.select(filters.$select.reduce((res, key) => Object.assign(res, {
        [key]: 1,
      }), {}));
    } else if (typeof filters.$select === 'string' || typeof filters.$select === 'object') {
      q.select(filters.$select);
    }

    // Handle $sort
    if (filters.$sort) {
      q.sort(filters.$sort);
    }

    // Handle collation
    if (params.collation) {
      q.collation(params.collation);
    }

    // Handle $limit
    if (typeof filters.$limit !== 'undefined') {
      q.limit(filters.$limit);
    }

    // Handle $skip
    if (filters.$skip) {
      q.skip(filters.$skip);
    }

    // Handle $populate
    if (filters.$populate) {
      q.populate(filters.$populate);
    }

    const executeQuery = async (total?: number) => {
      if (filters.$limit === 0) {
        return {
          total,
          limit: filters.$limit,
          skip: filters.$skip || 0,
          data: [],
        };
      }

      const data = await q.session(params.mongoose && params.mongoose.session).exec();

      return {
        total,
        limit: filters.$limit,
        skip: filters.$skip || 0,
        data,
      };
    };

    if (paginate && paginate.default) {
      const mQuery: MQuery<DT> = model.where(query);
      const mQueryCount = this.useEstimatedDocumentCount ? mQuery.estimatedDocumentCount() : mQuery.countDocuments();
      try {
        const count = await mQueryCount.session(params.mongoose && params.mongoose.session).exec();
        return await executeQuery(count) as Paginated<T>;
      } catch (err) {
        throw errorHandler(err);
      }
    }

    try {
      const { data } = await executeQuery();
      return data as T[];
    } catch (err) {
      throw errorHandler(err);
    }
  }
  async _get(id: Id, params: Params<T> = {}): Promise<T> {
    const { query, filters } = this.filterQuery(params);
    query.$and = [
      ...query.$and || [],
      {
        [this.id]: id,
      },
    ];

    const discriminator: string = query[this.discriminatorKey] || this.discriminatorKey;
    const model: mongoose.Model<DT> = this.discriminators[discriminator] || this.Model;
    let modelQuery: MQuery<DT> = model.findOne(query);

    // Handle $populate
    if (filters.$populate) {
      modelQuery = modelQuery.populate(filters.$populate);
    }

    // Handle $select
    if (filters.$select && filters.$select.length) {
      let fields = { [this.id]: 1 };

      for (let key of filters.$select) {
        fields[key] = 1;
      }

      modelQuery.select(fields);
    } else if (filters.$select && typeof filters.$select === 'object') {
      modelQuery.select(filters.$select);
    }

    let data;

    try {
      data = await modelQuery.session(params.mongoose && params.mongoose.session).lean(this.lean).exec();
    } catch (e) {
      throw errorHandler(e);
    }

    if (!data) {
      throw new errors.NotFound(`No record found for id '${id}'`);
    }

    return data;
  }

  async _create(_data: T, params?: Params<T>): Promise<T>
  async _create(_data: T[], params?: Params<T>): Promise<T[]>
  async _create(_data: T | T[], params: Params<T> = {}): Promise<T | T[]> {
    console.log('Create got called');
    params = params || {};
    params.query = params.query || {};

    const discriminatorKey: string = params.query[this.discriminatorKey] || this.discriminatorKey;
    const model: mongoose.Model<DT> = this.discriminators[discriminatorKey] || this.Model;

    const $populate: MongoosePopulateParams = params.query.$populate ? params.query.$populate : undefined;
    const data: T[] = Array.isArray(_data) ? _data : [_data];

    console.log('Done doing stuff');
    try {
      const r: MDoc<T> | MDoc<T>[] = await model.create(data, params.mongoose);

      console.log('Created! ');

      let results: MDoc<T>[] = Array.isArray(r) ? r : [r];

      if ($populate) {
        results = await Promise.all(
          results.map((r: MDoc<T>) =>
            r.populate($populate).execPopulate(),
          ),
        );
      }

      if (this.lean) {
        results = results.map(r => r.toObject());
      }

      results = select(params, this.id)(results);

      if (Array.isArray(_data)) {
        return results;
      }

      return results[0];
    } catch (err) {
      console.log('err');
      throw errorHandler(err);
    }
  }

  async _update(id: string, data: T | mongoose.Document, params: Params<T> = {}) {
    if (id === null) {
      throw new errors.BadRequest('Not replacing multiple records. Did you mean `patch`?');
    }

    // Handle case where data might be a mongoose document
    if (data instanceof mongoose.MongooseDocument) {
      data = data.toObject();
    }

    const { query, filters } = this.filterQuery(params);
    const options = Object.assign({
      new: true,
      overwrite: this.overwrite,
      runValidators: true,
      context: 'query',
      setDefaultsOnInsert: true,
    }, params.mongoose);

    query.$and = (query.$and || []).concat({ [this.id]: id });

    if (this.id === '_id') {
      // We can not update default mongo ids
      delete data['_id'];
    } else {
      // If not using the default Mongo _id field set the id to its
      // previous value. This prevents orphaned documents.
      data[this.id] = id;
    }

    const discriminator = query[this.discriminatorKey] || this.discriminatorKey;
    const model = this.discriminators[discriminator] || this.Model;
    let modelQuery: MQuery<DT> = model.findOneAndUpdate(query, data, options);

    if (filters.$populate) {
      modelQuery = modelQuery.populate(filters.$populate);
    }

    modelQuery.lean(this.lean);

    let result: MDoc<DT>;

    try {
      result = await modelQuery.exec();
    } catch (err) {
      throw errorHandler(err);
    }

    if (result === null) {
      throw new errors.NotFound(`No record found for id '${id}'`);
    }

    return select(params, this.id)(result);
  }

  async _patch(id: string, data: Partial<T>, params: Params<T> = {}) {
    const { query } = this.filterQuery(params);
    const mapIds = data => data.map(current => current[this.id]);

    // By default we will just query for the one id. For multi patch
    // we create a list of the ids of all items that will be changed
    // to re-query them after the update
    let ids: string[];

    if (id === null) {
      const docs: T[] = await this._find({
        ...params,
        paginate: false,
      });

      ids = docs.map(doc => doc[this.id] as string);
    } else {
      ids = [id];
    }

    // Handle case where data might be a mongoose model
    if (data instanceof mongoose.MongooseDocument) {
      data = data.toObject();
    }

    // ensure we are working on a copy
    data = _.cloneDeep(data);

    // If we are updating multiple records
    const options: UpdateManyOptions & { writeResult: boolean; } = {
      multi: id === null,
      runValidators: true,
      context: 'query',
      ...params.mongoose,
    };

    if (id !== null) {
      query.$and = [
        ...query.$and || [],
        {
          [this.id]: id,
        },
      ];
    }

    if (this.id === '_id') {
      // We can not update default mongo ids
      delete data[this.id];
    } else if (id !== null) {
      // If not using the default Mongo _id field set the id to its
      // previous value. This prevents orphaned documents.
      data[this.id] = id;
    }

    // NOTE (EK): We need this shitty hack because update doesn't
    // return a promise properly when runValidators is true. WTF!
    try {
      params.query = params.query || {};
      const $populate = params.query.$populate ? params.query.$populate : undefined;

      // Create a new query that re-queries all ids that
      // were originally changed
      const updatedQuery = (ids.length && id === null) ? { [this.id]: { $in: ids } } : params.query;
      const findParams: Params<T> = {
        ...params,
        paginate: false,
        // @ts-ignore
        query: $populate ? { ...updatedQuery, $populate } : updatedQuery,
      };

      // If params.query.$populate was provided, remove it
      // from the query sent to mongoose.
      const discriminator: string = query[this.discriminatorKey] || this.discriminatorKey;
      const model: mongoose.Model<DT> = this.discriminators[discriminator] || this.Model;

      const writeResult = await model.updateMany(query, data, options)
        .lean(this.lean)
        .exec();

      if (options.writeResult) {
        return select(params, this.id)(writeResult);
      }

      return this._getOrFind(id, findParams);
    } catch (e) {
      throw errorHandler(e);
    }
  }

  async _remove(id: string, params: Params<T> = {}) {
    const { query } = this.filterQuery(params);

    if (params.collation) {
      query.collation = params.collation;
    }

    if (id !== null) {
      query.$and = [
        ...query.$and || [],
        {
          [this.id]: id,
        },
      ];

      let result;

      try {
        result = await this.Model.findOneAndDelete(query, params.mongoose).lean(this.lean).exec();
      } catch (err) {
        throw errorHandler(err);
      }

      if (result === null) {
        throw new errors.NotFound(`No record found for id '${id}'`, query);
      }

      return result;
    }

    const findParams: Params<T> = {
      ...params,
      paginate: false,
      query,
    };

    try {
      const data = await this._getOrFind(id, findParams);
      await this.Model.deleteMany(query, params.mongoose).lean(this.lean).exec();
      return select(params, this.id)(data);
    } catch (err) {
      throw errorHandler(err);
    }
  }
}

export function init<T, DT extends mongoose.Document & T = mongoose.Document & T>(options: MongooseServiceOptions<DT>) {
  return new Service<T, DT>(options);
}

init.Service = Service;
init.default = init;
init.ERROR = ERROR;
