import assert from 'assert';
import { select } from '../src';

describe('@ihadeed/adapter-commons', () => {
  describe('select', () => {
    it('select', () => {
      const selector = select({
        query: { $select: ['name', 'age'] }
      });

      return Promise.resolve({
        name: 'David',
        age: 3,
        test: 'me'
      }).then(selector).then(result => assert.deepStrictEqual(result, {
        name: 'David',
        age: 3
      }));
    });

    it('select with arrays', () => {
      const selector = select({
        query: { $select: ['name', 'age'] }
      });

      return Promise.resolve([{
        name: 'David',
        age: 3,
        test: 'me'
      }, {
        name: 'D',
        age: 4,
        test: 'you'
      }]).then(selector).then(result => assert.deepStrictEqual(result, [{
        name: 'David',
        age: 3
      }, {
        name: 'D',
        age: 4
      }]));
    });

    it('select with no query', () => {
      const selector = select({});
      const data = {
        name: 'David'
      };

      return Promise.resolve(data).then(selector).then(result =>
        assert.deepStrictEqual(result, data)
      );
    });

    it('select with other fields', () => {
      const selector = select({
        query: { $select: [ 'name' ] }
      }, 'id');
      const data = {
        id: 'me',
        name: 'David',
        age: 10
      };

      return Promise.resolve(data)
        .then(selector)
        .then(result => assert.deepStrictEqual(result, {
          id: 'me',
          name: 'David'
        }));
    });
  });
});
