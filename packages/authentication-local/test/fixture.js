const feathers = require('@ihadeed/feathers');
const memory = require('@ihadeed/memory');
const { AuthenticationService, JWTStrategy } = require('@ihadeed/authentication');

const { LocalStrategy, hooks } = require('../lib');
const { hashPassword, protect } = hooks;

module.exports = (app = feathers()) => {
  const authentication = new AuthenticationService(app);

  app.set('authentication', {
    entity: 'user',
    service: 'users',
    secret: 'supersecret',
    authStrategies: [ 'local', 'jwt' ],
    local: {
      usernameField: 'email',
      passwordField: 'password'
    }
  });

  authentication.register('jwt', new JWTStrategy());
  authentication.register('local', new LocalStrategy());

  app.use('/authentication', authentication);
  app.use('/users', memory({
    paginate: {
      default: 10,
      max: 20
    }
  }));

  app.service('users').hooks({
    before: {
      create: hashPassword('password')
    },
    after: {
      all: protect('password'),
      get: [context => {
        if (context.params.provider) {
          context.result.fromGet = true;
        }

        return context;
      }]
    }
  });

  return app;
};
