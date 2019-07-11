const primus = require('@ihadeed/primus');
const baseTests = require('@ihadeed/tests/lib/client');

const app = require('../fixture');
const feathers = require('../../');

describe('Primus connector', function () {
  const client = feathers();

  let socket;

  before(function (done) {
    this.server = app(function () {
      this.configure(primus({
        transformer: 'websockets'
      }, function (primus) {
        socket = new primus.Socket('http://localhost:12012');
        client.configure(feathers.primus(socket));
      }));
    }).listen(12012, done);
  });

  after(function () {
    socket.socket.close();
    this.server.close();
  });

  baseTests(client, 'todos');
});
