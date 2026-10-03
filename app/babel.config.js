module.exports = function babelConfig(api) {
  api.cache(true);

  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    // Must stay last: it rewrites worklets, including every gesture handler.
    plugins: ['react-native-worklets/plugin'],
  };
};
