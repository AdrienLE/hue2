// babel.config.js (Expo managed)
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // React Native Reanimated requires its Babel plugin to run worklets in production builds.
    plugins: ['react-native-reanimated/plugin'],
  };
};
