import assert from 'assert';

describe('@ihadeed/transport-commons', () => {
  it('re-exports commons', () => {
    const commons = require('../lib');

    assert.ok(commons.socket);
    assert.ok(commons.routing);
    assert.ok(commons.channels);
  });
});
