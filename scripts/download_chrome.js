const { BrowserPlatform, Browser, install, resolveBuildId } = require('@puppeteer/browsers');
const fs = require('fs');
const path = require('path');
const https = require('https');
const extract = require('extract-zip');

const archArg = process.argv[2];
let [
    // Should be one of linux, mac, win32, win64 as per options in BrowserFetcher but we reuse the same arch string
    // as for grpc download (ie darwin-x64-unknown) so we need to transform it a bit
    platform,
    arch,
] = archArg.split('-');

if (platform === 'win32' && arch === 'x64') {
    platform = BrowserPlatform.WIN64;
}

if (platform === 'darwin') {
    if (arch === 'arm64') {
        platform = BrowserPlatform.MAC_ARM;
    } else {
        platform = BrowserPlatform.MAC;
    }
}

const outArg = process.argv[3];
let outputPath;
if (outArg) {
  // If a raw path is provided, use it directly; else default to dist path
  const isRawPath = outArg.includes(path.sep) || outArg.startsWith('.') || outArg === 'embedded_browser';
  outputPath = isRawPath ? path.resolve(process.cwd(), outArg) : path.resolve(process.cwd(), 'dist', outArg);
} else {
  outputPath = path.resolve(process.cwd(), 'dist', `plugin-${archArg}`);
}
const embedZipOnly = path.basename(outputPath) === 'embedded_browser';

const browserVersion = Browser.CHROMEHEADLESSSHELL;

async function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        const request = https.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                // Handle redirect
                https.get(response.headers.location, (redirectResponse) => {
                    if (redirectResponse.statusCode !== 200) {
                        return reject(new Error(`Failed to download (redirect), status ${redirectResponse.statusCode}`));
                    }
                    redirectResponse.pipe(file);
                }).on('error', reject);
            } else if (response.statusCode !== 200) {
                return reject(new Error(`Failed to download, status ${response.statusCode}`));
            } else {
                response.pipe(file);
            }
        });
        request.on('error', reject);
        file.on('finish', () => file.close(resolve));
    });
}

async function downloadPlaywrightChromiumArm64() {
    const buildId = process.env.PLAYWRIGHT_CHROMIUM_BUILDID || '1084';
    const url = `https://playwright.azureedge.net/builds/chromium/${buildId}/chromium-linux-arm64.zip`;
    const zipPath = path.resolve(outputPath, 'chromium-linux-arm64.zip');
    console.log(`Downloading Playwright Chromium (linux-arm64 build ${buildId}) from ${url}`);
    await downloadFile(url, zipPath);
    if (embedZipOnly) {
      console.log(`Embedded mode: keeping zip at ${zipPath}`);
      // In embedded mode we only ship the zip; runtime will extract it.
      return { buildId: `playwright-${buildId}` };
    }
    console.log(`Extracting ${zipPath} into ${outputPath}`);
    await extract(zipPath, { dir: outputPath });

    // Try to locate the chromium executable within extracted contents
    const candidateDirs = ['chrome-linux', 'chromium-linux-arm64', 'chrome-linux-arm64'];
    let executablePath = '';
    for (const dir of candidateDirs) {
        const candidate = path.resolve(outputPath, dir, 'chrome');
        if (fs.existsSync(candidate)) {
            executablePath = candidate;
            break;
        }
    }
    if (!executablePath) {
        // Fallback: search for 'chrome' binary within top-level subdirectories
        const entries = fs.readdirSync(outputPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const candidate = path.resolve(outputPath, entry.name, 'chrome');
                if (fs.existsSync(candidate)) {
                    executablePath = candidate;
                    break;
                }
            }
        }
    }
    if (!executablePath) {
        throw new Error('Failed to locate chromium executable after extraction');
    }
    const executableRel = path.relative(outputPath, executablePath);
    const chromeInfo = { executablePath, executableRel };
    fs.writeFileSync(path.resolve(outputPath, 'chrome-info.json'), JSON.stringify(chromeInfo));
    return { buildId: `playwright-${buildId}` };
}

async function download() {
    // Fallback for linux-arm64: Chrome Headless Shell is not officially provided, use Playwright Chromium.
    if (platform === 'linux' && arch === 'arm64') {
        console.warn('linux-arm64 detected: falling back to Playwright Chromium build');
        return downloadPlaywrightChromiumArm64();
    }

    const buildId = await resolveBuildId(browserVersion, platform, 'latest');
    console.log(`Installing ${browserVersion} into ${outputPath}`);
    return install({
        baseUrl: 'https://storage.googleapis.com/chrome-for-testing-public',
        cacheDir: outputPath,
        browser: browserVersion,
        platform,
        buildId,
    });
}

download()
    .then((browser) => {
        console.log(`${browserVersion} downloaded into:`, outputPath);
        // When using Playwright fallback, chrome-info.json is already written with executablePath.
        if (browser && browser.buildId) {
            const chromeInfo = { buildId: browser.buildId };
            fs.writeFileSync(path.resolve(outputPath, 'chrome-info.json'), JSON.stringify(chromeInfo));
        }
    })
    .catch((err) => {
        // If we are in embedded mode for linux-arm64 and the zip exists, do not fail hard.
        try {
          if (platform === 'linux' && arch === 'arm64' && embedZipOnly) {
            const zipPath = path.resolve(outputPath, 'chromium-linux-arm64.zip');
            if (fs.existsSync(zipPath)) {
              console.warn('Download error ignored in embedded mode; zip is present at', zipPath);
              process.exit(0);
              return;
            }
          }
        } catch (_) {}
        console.error('Failed to download browser:', err && err.message ? err.message : err);
        process.exit(1);
    });
