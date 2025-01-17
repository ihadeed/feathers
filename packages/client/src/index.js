const feathers = require('@ihadeed/feathers');
const errors = require('@ihadeed/errors');
const authentication = require('@ihadeed/authentication-client');
const rest = require('@ihadeed/rest-client');
const socketio = require('@ihadeed/socketio-client');

Object.assign(feathers, {
  errors,
  socketio,
  rest,
  authentication
});

module.exports = feathers;
