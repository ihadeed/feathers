import { strict as assert } from 'assert';
import { getDefaultSettings } from '../src/utils';
import { app } from './fixture';

describe('@ihadeed/authentication-oauth/utils', () => {
  it('getDefaultSettings', () => {
    const settings = getDefaultSettings(app);

    assert.equal(settings.authService, 'authentication');
    assert.equal(settings.linkStrategy, 'jwt');
  });
});
