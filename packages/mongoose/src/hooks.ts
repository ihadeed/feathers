import { HookContext } from '@ihadeed/feathers';

export const toObject = (options = {}, dataField = 'data') => {
  return (ctx: HookContext) => {
    // Only perform this if it's used as an after hook.
    if (ctx.result) {
      let data = ctx.result[dataField] || ctx.result;
      let res;

      // Handle multiple mongoose models
      if (Array.isArray(data)) {
        res = data.map((obj) => {
          if (typeof obj.toObject === 'function') {
            return obj.toObject(options);
          }

          return obj;
        });
      } else if (typeof data.toObject === 'function') { // Handle single mongoose models
        res = data.toObject(options);
      }
      // If our data is transformed set it to appropriate location on the hook
      if (res) {
        if (ctx.result[dataField]) {
          ctx.result[dataField] = res;
        } else {
          ctx.result = res;
        }
      }
    }
  };
};
