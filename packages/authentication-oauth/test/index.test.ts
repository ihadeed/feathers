import { strict as assert } from 'assert';
import feathers from '@ihadeed/feathers';
import { setup, express, OauthSetupSettings } from '../src';
import { AuthenticationService } from '@ihadeed/authentication/lib';

describe('@ihadeed/authentication-oauth', () => {
  describe('setup', () => {
    it('errors when service does not exist', () => {
      const app = feathers();

      try {
        app.configure(setup({ authService: 'something' } as OauthSetupSettings));
        assert.fail('Should never get here');
      } catch (error) {
        assert.equal(error.message,
          `'something' authentication service must exist before registering @ihadeed/authentication-oauth`
        );
      }
    });

    it('errors when service does not exist', () => {
      const app = feathers();

      app.use('/authentication', new AuthenticationService(app));

      app.configure(express());
    });
  });
});
