import { Conflict } from '@ihadeed/errors';
import feathers, { Application, Service as FeathersService } from '@ihadeed/feathers';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Service as MongooseService } from './service';
import { beginTransaction, commitTransaction, rollbackTransaction } from './transaction-manager';

interface TestModel {
  _id?: string;
  name: string;
  password: string;
}

interface TestAppModels {
  test: TestModel;
}

type ModelsToServices<T> = {
  [K in keyof T]: FeathersService<T[K]>;
}

describe('Mongoose Service', () => {
  let replicaSet: MongoMemoryReplSet, connStr: string;

  let mService: MongooseService<TestModel>,
    fService: FeathersService<TestModel>,
    app: Application<ModelsToServices<TestAppModels>>,
    mSchema: mongoose.Schema<TestModel>,
    mDoc: mongoose.Document & TestModel,
    mModel: mongoose.Model<mongoose.Document & TestModel>;

  let result: TestModel,
    results: TestModel[],
    obj: TestModel = {
      name: 'Hello',
      password: 'world',
    };

  beforeAll(async () => {
    replicaSet = new MongoMemoryReplSet({
      replSet: {
        count: 2,
        storageEngine: 'wiredTiger',
        dbName: 'test-db',
        args: ['--setParameter', 'maxTransactionLockRequestTimeoutMillis=1000'],
        debug: true,
      } as any,
    });

    await replicaSet.waitUntilRunning();
    await new Promise(resolve => setTimeout(() => resolve(), 1000));
    const str = await replicaSet.getConnectionString();
    const { replSet } = replicaSet.getInstanceOpts();
    connStr = str + '?replicaSet=' + replSet;
    await mongoose.connect(connStr);
  }, 10 * 1000);

  beforeAll(async () => {
    app = feathers<ModelsToServices<TestAppModels>>();
    mSchema = new mongoose.Schema<TestModel>({
      name: {
        type: String,
        unique: true,
        index: true,
      },
      password: String,
    });
    mModel = mongoose.model<TestModel & mongoose.Document>('test', mSchema);
    mService = new MongooseService<TestModel>({ Model: mModel });
    app.use('test', mService);
    fService = app.service('test');

    await mModel.ensureIndexes();
  });

  it('created app', () => {
    expect(app).toBeDefined();
  });

  it('created mongoose schema', () => {
    expect(mSchema).toBeDefined();
    expect(mSchema instanceof mongoose.Schema).toBeTruthy();
  });

  it('created mongoose model', () => {
    expect(mModel).toBeDefined();
    expect(mModel instanceof Function).toBeTruthy();
  });

  it('created mongoose service', () => {
    expect(mService).toBeDefined();
    expect(mService instanceof MongooseService).toBeTruthy();
  });

  it('created feathers service', () => {
    expect(fService).toBeDefined();
    expect(fService instanceof Object).toBeTruthy();
  });

  describe('CRUD', () => {
    beforeAll(async () => {
      result = await fService.create({
        ...obj,
      });
    });

    it('creates document', () => {
      expect(result).toBeDefined();
      expect(result.name).toEqual(obj.name);
      expect(result.password).toEqual(obj.password);
      expect(result._id).toBeDefined();
    });

    it('throws conflict error', async () => {
      await expect(fService.create(obj)).rejects.toThrowError(Conflict);
    });

    it('patches document', async () => {
      const result2 = await fService.patch(result._id, { name: 'hello2' });
      expect(result2).toBeDefined();
      expect(result2._id).toEqual(result._id);
      expect(result2.name).not.toEqual(result.name);
      expect(result2.password).toEqual(result.password);
      result = result2;
    });

    it('patches document', async () => {
      const result2 = await fService.update(result._id, {
        name: 'hello3',
        password: 'world2',
      });
      expect(result2).toBeDefined();
      expect(result2._id).toEqual(result._id);
      expect(result2.name).not.toEqual(result.name);
      expect(result2.password).not.toEqual(result.password);
      result = result2;
    });

    it('finds documents', async () => {
      const docs = await fService.find({ paginate: false });
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBeTruthy();
      expect(docs.length).toBeGreaterThan(0);
      expect(docs[0]._id).toEqual(result._id);
      expect(docs[0].name).toEqual(result.name);
      expect(docs[0].password).toEqual(result.password);
    });

    it('gets document', async () => {
      const doc = await fService.get(result._id);
      expect(doc).toBeDefined();
      expect(doc._id).toEqual(result._id);
      expect(doc.name).toEqual(result.name);
      expect(doc.password).toEqual(result.password);
    });

    it('deletes document', async () => {
      const res = await fService.remove(result._id);
      expect(res).toBeDefined();
    });
  });

  describe('Transactions', () => {
    beforeAll(() => {
      fService.hooks({
        before: {
          create: beginTransaction(),
        },
        after: {
          create: commitTransaction,
        },
        error: {
          create: rollbackTransaction,
        }
      });
    });

    beforeAll(async () => {
      result = await fService.create(obj);
    });

    it('creates document in tx', () => {
      expect(result).toBeDefined();
      expect(result.name).toEqual(obj.name);
      expect(result.password).toEqual(obj.password);
      expect(result._id).toBeDefined();
    });
  });
});
