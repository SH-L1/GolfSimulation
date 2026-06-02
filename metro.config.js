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
    // .mjs 파일을 소스로 인식
    sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json', 'mjs'],
  },
  transformer: {
    // @mswjs/interceptors 가 static class block 등 최신 문법을 사용하므로 Babel 변환 대상에 포함
    transformIgnorePatterns: [
      'node_modules/(?!(@mswjs)/)',
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
