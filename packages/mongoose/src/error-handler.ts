import errors from '@ihadeed/errors';
export const ERROR = Symbol('@ihadeed/mongoose/error');

const wrap = (error: Error & any, original: Error & any) => Object.assign(error, { [ERROR]: original });

export async function errorHandler(error: Error & any) {
  console.log('Handling err');
  if (error.code === 11000 || error.code === 11001) {
    // NOTE (EK): Error parsing as discussed in this github thread
    // https://github.com/Automattic/mongoose/issues/2129
    const match1 = error.message.match(/_?([a-zA-Z]*)_?\d?\s*dup key/i);
    const match2 = error.message.match(/\s*dup key:\s*\{\s*:\s*"?(.*?)"?\s*\}/i);

    const key = match1 ? match1[1] : 'path';
    let value = match2 ? match2[1] : 'value';

    if (value === 'null') {
      value = null;
    } else if (value === 'undefined') {
      value = undefined;
    }

    error.message = `${key}: ${value} already exists.`;
    error.errors = {
      [key]: value,
    };

    return wrap(new errors.Conflict(error), error);
  }

  if (error.name) {
    switch (error.name) {
      case 'ValidationError':
      case 'ValidatorError':
      case 'CastError':
      case 'VersionError':
        return wrap(new errors.BadRequest(error), error);
      case 'OverwriteModelError':
        return wrap(new errors.Conflict(error), error);
      case 'MissingSchemaError':
      case 'DivergentArrayError':
        return wrap(new errors.GeneralError(error), error);
      case 'MongoError':
        return wrap(new errors.GeneralError(error), error);
    }
  }

  return error;
}
