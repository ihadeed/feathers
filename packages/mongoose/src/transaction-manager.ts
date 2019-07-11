/**
 * To start a new session and initiate transaction on the session and set
 * mongoose-session in context-params to all consecutive service call if the
 * boolean
 *
 * @param {object} context                            context and all params
 * @param {[string]} skipPath      list of paths to exclude from transaction
 *                                                     -  Example: ['login']
 * @return {object} context                 context with db-session appended
 */
import { Hook, HookContext } from '@ihadeed/feathers';
import { TransactionOptions } from 'mongodb';
import mongoose from 'mongoose';

export const beginTransaction = <T = any>(options?: TransactionOptions): Hook => {
  return async (context: HookContext<T>, skipPath?: string[]) => {
    skipPath = skipPath || [];
    const client: mongoose.Mongoose = context.app.get('mongoDbClient') || context.service.Model.db;

    if (skipPath.indexOf(context.path) !== -1) {
      context.enableTransaction = false;
      return context;
    }

    try {
      // if the current path is not added to skipPath-list
      // if there is no open-transaction appended already
      if (context.params && !context.params.transactionOpen) {
        const session: mongoose.ClientSession = await client.startSession();
        await session.startTransaction(options);
        context.params.transactionOpen = true;
        context.params.mongoose = { session };
      }
      context.enableTransaction = true; // true if transaction is enabled
      return context;
    } catch (err) {
      throw new Error(`Error while starting session ${err}`);
    }
  };
};

/**
 * To commit a mongo-transaction after save methods of mongo service
 *
 * @param {object} context           context with params, result and DB-session
 * @return {object} context          context with params, result and DB-session
 */
export const commitTransaction = async (context: HookContext) => {
  if (!context.enableTransaction) {
    return context;
  }

  context.params = context.params || {};
  context.params.mongoose = context.params.mongoose || {};

  if (!context.params.mongoose.session) {
    return context;
  }

  try {
    await context.params.mongoose.session.commitTransaction();
    context.params.mongoose = null;
    context.params.transactionOpen = false; // reset transaction-open
    context.enableTransaction = false;

    return context;
  } catch (err) {
    throw new Error(`Error while commiting transaction ${err}`);
  }
};

/**
 * To rollback a mongo-transaction for any error thrown in service calls
 *
 * @param {object} context            context with params and DB-session
 * @return {object} context           context with params and DB-session
 */
export const rollbackTransaction = async context => {
  if (!context.enableTransaction) {
    return context;
  }

  context.params = context.params || {};
  context.params.mongoose = context.params.mongoose || {};

  if (!context.params.mongoose.session) {
    return context;
  }

  try {
    await context.params.mongoose.session.abortTransaction();
    context.params.mongoose = null;
    context.transactionOpen = false; // reset transaction-open
    context.enableTransaction = false;

    return context;
  } catch (err) {
    throw new Error(`Error while rolling-back transaction ${err}`);
  }
};
