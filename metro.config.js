const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

// CMake 빌드 임시 폴더를 watch 대상에서 제외 (react-native-worklets Windows 이슈)
const config = {
  watchFolders: [],
  resolver: {
    blockList: [
      /node_modules\/.*\/android\/\.cxx\/.*/,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
