const fs = require('fs');
const path = require('path');

const archArg = process.argv[2];

let [
  // linux, darwin, win32
  platform,
  // ia32, x64, arm, arm64
  arch,
] = archArg.split('-');

const platformTransform = {
  win32: 'windows',
  alpine: 'linux',
};

const archTransform = {
  x64: 'amd64',
  ia32: '386'
};

let ext = platform === 'win32' ? '.exe' : '';
const outputPath = path.resolve('dist', (process.argv[3] || `plugin-${archArg}`));

const execFileName = `plugin_start_${platformTransform[platform] || platform}_${archTransform[arch] || arch}${ext}`;
const src = path.resolve(outputPath, `renderer${ext}`);
const dest = path.resolve(outputPath, execFileName);
fs.renameSync(src, dest);

