module.exports = {
  'roots': [
    '<rootDir>/src',
  ],
  'transform': {
    '^.+\\.tsx?$': 'ts-jest',
  },
  'testEnvironment': 'node',
  'globals': {
    'ts-jest': {
      'tsConfig': '<rootDir>/tsconfig.test.json',
    },
  },
};
