const childProcess = require('child_process');
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
  darwin: 'macos',
  win32: 'win',
};

const archTransform = {
  ia32: 'x84',
  arm: 'armv6',
  arm64: 'arm64',
};

platform = platformTransform[platform] || platform;
arch = archTransform[arch] || arch;

if(platform === 'macos' && (arch.includes('arm'))) {
  arch = 'arm64'
}

const outputPath = "dist/" + (process.argv[3] || `plugin-${archArg}`);
const outputNodeModules = path.resolve(outputPath, 'node_modules');

const pkgBin = path.resolve('node_modules', '.bin', process.platform === 'win32' ? 'pkg.cmd' : 'pkg');
// Disable bytecode generation to avoid spawning target platform binaries on Windows
// Also mark all packages public to satisfy pkg requirements when using --no-bytecode
const pkgArgs = `-t node20-${platform}-${arch} . --out-path ${outputPath} --no-native-build --no-bytecode --public-packages "*" --public`;
childProcess.execSync(`"${pkgBin}" ${pkgArgs}`, {stdio: 'inherit'});

if (fs.existsSync(outputNodeModules)) {
  const rmDirRecursive = (p) => {
    if (!fs.existsSync(p)) return;
    for (const entry of fs.readdirSync(p)) {
      const full = path.join(p, entry);
      const stat = fs.lstatSync(full);
      if (stat.isDirectory()) rmDirRecursive(full);
      else fs.unlinkSync(full);
    }
    fs.rmdirSync(p);
  };
  rmDirRecursive(outputNodeModules);
}

// Pre-embed browser zip for linux-arm64 to avoid runtime downloads
try {
  const [plat, archStr] = archArg.split('-');
  if (plat === 'linux' && archStr === 'arm64') {
    const embedDir = path.resolve('embedded_browser');
    if (!fs.existsSync(embedDir)) {
      fs.mkdirSync(embedDir, { recursive: true });
    }
    // Download zip into embedded_browser directory
    console.log('Preparing embedded Chromium zip for linux-arm64');
    childProcess.execSync(`node scripts/download_chrome.js ${archArg} embedded_browser`, { stdio: 'inherit' });
  }
} catch (e) {
  console.warn('Failed to prepare embedded browser asset:', e && e.message ? e.message : e);
}
