const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add wasm to assetExts for expo-sqlite web support
config.resolver.assetExts.push('wasm');

// Force Metro to resolve tslib to its ES6 version to fix:
// "Cannot destructure property '__extends' of 'tslib.default' as it is undefined"
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'tslib' ||
    moduleName === 'tslib/modules/index.js' ||
    moduleName === 'tslib/modules'
  ) {
    return {
      filePath: path.resolve(__dirname, 'node_modules/tslib/tslib.es6.js'),
      type: 'sourceFile',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

