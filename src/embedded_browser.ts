import * as fs from 'fs';
import * as path from 'path';
import extract from 'extract-zip';

const ensureDir = (p: string) => {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
};

const copyFile = (src: string, dest: string) => {
  ensureDir(path.dirname(dest));
  const data = fs.readFileSync(src);
  fs.writeFileSync(dest, data);
};

const findChromiumExecutable = (rootDir: string): string | undefined => {
  const candidates = [
    path.resolve(rootDir, 'chrome-linux', 'chrome'),
    path.resolve(rootDir, 'chromium-linux-arm64', 'chrome'),
    path.resolve(rootDir, 'chrome-linux-arm64', 'chrome'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // Fallback: scan first-level directories
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      const candidate = path.resolve(rootDir, e.name, 'chrome');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return undefined;
};

export async function ensureEmbeddedBrowser(): Promise<void> {
  // Only relevant when running packaged binary
  if (!(process as any).pkg) return;

  const execDir = path.dirname(process.execPath);
  const chromeInfoPath = path.resolve(execDir, 'chrome-info.json');

  // If chrome-info.json exists and points to a valid file, skip
  if (fs.existsSync(chromeInfoPath)) {
    try {
      const info = JSON.parse(fs.readFileSync(chromeInfoPath, 'utf8'));
      const p = info.executablePath || (info.executableRel && path.resolve(execDir, info.executableRel));
      if (p && fs.existsSync(p)) return;
    } catch {
      // fall through
    }
  }

  // Try reading embedded asset zip (linux arm64 fallback)
  const assetZipPath = path.resolve(__dirname, '../embedded_browser/chromium-linux-arm64.zip');
  if (!fs.existsSync(assetZipPath)) {
    // No embedded asset available; nothing to do.
    return;
  }

  const outZipPath = path.resolve(execDir, 'chromium-linux-arm64.zip');
  if (!fs.existsSync(outZipPath)) {
    copyFile(assetZipPath, outZipPath);
  }

  // Extract zip into execDir
  await extract(outZipPath, { dir: execDir });

  const executable = findChromiumExecutable(execDir);
  if (!executable) {
    throw new Error('Failed to locate Chromium executable after extracting embedded asset');
  }
  const executableRel = path.relative(execDir, executable);
  const chromeInfo = { executableRel, executablePath: executable };
  fs.writeFileSync(chromeInfoPath, JSON.stringify(chromeInfo));
}