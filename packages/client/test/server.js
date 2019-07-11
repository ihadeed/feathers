const socketio = require('@ihadeed/socketio');
const createApp = require('./fixture');
const app = createApp(function () {
  this.configure(socketio());
});

module.exports = app.listen(3000);
