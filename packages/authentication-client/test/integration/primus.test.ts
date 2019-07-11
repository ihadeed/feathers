// @ts-ignore
import Primus from 'primus';
// @ts-ignore
import Emitter from 'primus-emitter';
import feathers, { Application } from '@ihadeed/feathers';
import primusClient from '@ihadeed/primus-client';
import primus from '@ihadeed/primus';

import authClient from '../../src';
import getApp from './fixture';
import commonTests from './commons';

const port = 8998;
const baseURL = `http://localhost:${port}`;
const Socket = Primus.createSocket({
  transformer: 'websockets',
  plugin: {
    emitter: Emitter
  }
});

describe('@ihadeed/authentication-client Primus integration', () => {
  let app: Application;
  let server: any;

  before(() => {
    app = getApp(feathers().configure(primus({
      transformer: 'websockets'
    })));

    server = app.listen(port);
  });

  after(() => server.close());

  commonTests(() => app, () => {
    return feathers()
      .configure(primusClient(new Socket(baseURL), { timeout: 1000 }))
      .configure(authClient());
  }, {
    email: 'primusauth@feathersjs.com',
    password: 'secrets',
    provider: 'primus'
  });
});
