const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const projectRoot = __dirname;
const parentDir = path.resolve(projectRoot, '..');

// CMake 빌드 임시 폴더 및 부모 디렉토리 node_modules를 watch/resolve 대상에서 제외
const config = {
  projectRoot,
  watchFolders: [],
  resolver: {
    blockList: [
      /node_modules\/.*\/android\/\.cxx\/.*/,
      new RegExp(`^${parentDir.replace(/\\/g, '\\\\')}[/\\\\]node_modules[/\\\\].*`),
    ],
    nodeModulesPaths: [path.resolve(projectRoot, 'node_modules')],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
