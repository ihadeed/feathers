import io from 'socket.io-client';
import feathers, { Application } from '@ihadeed/feathers';
import socketio from '@ihadeed/socketio';
import socketioClient from '@ihadeed/socketio-client';

import authClient from '../../src';
import getApp from './fixture';
import commonTests from './commons';

describe('@ihadeed/authentication-client Socket.io integration', () => {
  let app: Application;

  before(() => {
    app = getApp(feathers().configure(socketio()));

    app.listen(9777);
  });

  after(done => app.io.close(() => done()));

  commonTests(() => app, () => {
    return feathers()
      .configure(socketioClient(io('http://localhost:9777')))
      .configure(authClient());
  }, {
    email: 'socketioauth@feathersjs.com',
    password: 'secretive',
    provider: 'socketio'
  });
});
