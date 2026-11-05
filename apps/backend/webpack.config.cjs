const path = require('node:path');

module.exports = (options) => {
  const entry = path.relative('src', options.output.filename);
  return {
    ...options,
    output: {
      ...options.output,
      path: path.resolve(__dirname, 'dist', path.dirname(entry)),
      filename: path.basename(entry),
      clean: true,
    },
  };
};
