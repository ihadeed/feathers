import assert from 'assert';
import { omit } from 'lodash';
import { LocalStrategy } from '../src';
// @ts-ignore
import createApplication from './fixture';
import { Application } from '@ihadeed/feathers';

describe('@ihadeed/authentication-local/strategy', () => {
  const password = 'localsecret';
  const email = 'localtester@feathersjs.com';

  let app: Application;
  let user: any;

  beforeEach(async () => {
    app = createApplication();
    user = await app.service('users').create({ email, password });
  });

  it('throw error when configuration is not set', () => {
    const auth = app.service('authentication');

    try {
      auth.register('something', new LocalStrategy());
      assert.fail('Should never get here');
    } catch (error) {
      assert.strictEqual(error.message,
        `'something' authentication strategy requires a 'usernameField' setting`
      );
    }
  });

  it('fails when entity not found', async () => {
    const authService = app.service('authentication');

    try {
      await authService.create({
        strategy: 'local',
        email: 'not in database',
        password
      });
      assert.fail('Should never get here');
    } catch (error) {
      assert.strictEqual(error.name, 'NotAuthenticated');
      assert.strictEqual(error.message, 'Invalid login');
    }
  });

  it('getEntity', async () => {
    const [ strategy ] = app.service('authentication').getStrategies('local');
    let entity = await strategy.getEntity(user, {});

    assert.deepStrictEqual(entity, user);

    entity = await strategy.getEntity(user, {
      provider: 'testing'
    });

    assert.deepStrictEqual(entity, {
      ...omit(user, 'password'),
      fromGet: true
    });

    try {
      await strategy.getEntity({}, {});
      assert.fail('Should never get here');
    } catch (error) {
      assert.strictEqual(error.message, 'Could not get local entity');
    }
  });

  it('strategy fails when strategy is different', async () => {
    const [ local ] = app.service('authentication').getStrategies('local');

    try {
      await local.authenticate({
        strategy: 'not-me',
        password: 'dummy',
        email
      });
      assert.fail('Should never get here');
    } catch (error) {
      assert.strictEqual(error.name, 'NotAuthenticated');
      assert.strictEqual(error.message, 'Invalid login');
    }
  });

  it('fails when password is wrong', async () => {
    const authService = app.service('authentication');
    try {
      await authService.create({
        strategy: 'local',
        email,
        password: 'dummy'
      });
      assert.fail('Should never get here');
    } catch (error) {
      assert.strictEqual(error.name, 'NotAuthenticated');
      assert.strictEqual(error.message, 'Invalid login');
    }
  });

  it('fails when password field is not available', async () => {
    const userEmail = 'someuser@localtest.com';
    const authService = app.service('authentication');

    try {
      await app.service('users').create({
        email: userEmail
      });
      await authService.create({
        strategy: 'local',
        password: 'dummy',
        email: userEmail
      });
      assert.fail('Should never get here');
    } catch (error) {
      assert.strictEqual(error.name, 'NotAuthenticated');
      assert.strictEqual(error.message, 'Invalid login');
    }
  });

  it('authenticates an existing user', async () => {
    const authService = app.service('authentication');
    const authResult = await authService.create({
      strategy: 'local',
      email,
      password
    });
    const { accessToken } = authResult;

    assert.ok(accessToken);
    assert.strictEqual(authResult.user.email, email);

    const decoded = await authService.verifyAccessToken(accessToken);

    assert.strictEqual(decoded.sub, `${user.id}`);
  });

  it('returns safe result when params.provider is set, works without pagination', async () => {
    const authService = app.service('authentication');
    const authResult = await authService.create({
      strategy: 'local',
      email,
      password
    }, {
      provider: 'rest',
      paginate: false
    });
    const { accessToken } = authResult;

    assert.ok(accessToken);
    assert.strictEqual(authResult.user.email, email);
    assert.strictEqual(authResult.user.passsword, undefined);
    assert.ok(authResult.user.fromGet);

    const decoded = await authService.verifyAccessToken(accessToken);

    assert.strictEqual(decoded.sub, `${user.id}`);
  });
});
