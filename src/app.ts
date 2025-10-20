import { startTracing } from './tracing';
import * as path from 'path';
import * as _ from 'lodash';
import * as fs from 'fs';
import { Browser, computeExecutablePath } from '@puppeteer/browsers';
import { RenderGRPCPluginV2 } from './plugin/v2/grpc_plugin';
import { HttpServer } from './service/http-server';
import { populateServiceConfigFromEnv, ServiceConfig, defaultServiceConfig } from './service/config';
import { populatePluginConfigFromEnv, PluginConfig, defaultPluginConfig } from './plugin/v2/config';
import { ConsoleLogger, PluginLogger } from './logger';
import * as minimist from 'minimist';
import { serve } from './node-plugin';
import { createSanitizer } from './sanitizer/Sanitizer';
import { getConfig } from './config/config';
import { ensureEmbeddedBrowser } from './embedded_browser';

async function main() {
  const argv = minimist(process.argv.slice(2));
  const env = Object.assign({}, process.env);
  const command = argv._[0];

  if (command === undefined) {
    const config = getConfig() as PluginConfig;
    const logger = new PluginLogger();

    if (config.rendering.tracing.url) {
      startTracing(logger);
    }

    // Ensure embedded browser is available when running packaged binary
    await ensureEmbeddedBrowser();

    if (!config.rendering.chromeBin && (process as any).pkg) {
      const execPath = path.dirname(process.execPath);
      const chromeInfoPath = path.resolve(execPath, 'chrome-info.json');
      if (fs.existsSync(chromeInfoPath)) {
        const chromeInfoFile = fs.readFileSync(chromeInfoPath, 'utf8');
        const chromeInfo = JSON.parse(chromeInfoFile);
        if (chromeInfo.executablePath || chromeInfo.executableRel) {
          // Playwright Chromium fallback provides explicit executable path
          config.rendering.chromeBin = chromeInfo.executablePath || path.resolve(execPath, chromeInfo.executableRel);
          logger.debug(`Setting chromeBin from explicit path ${config.rendering.chromeBin}`);
        } else if (chromeInfo.buildId) {
          // Default Chrome for Testing Headless Shell path
          config.rendering.chromeBin = computeExecutablePath({
            cacheDir: path.dirname(process.execPath),
            browser: Browser.CHROMEHEADLESSSHELL,
            buildId: chromeInfo.buildId,
          });
          logger.debug(`Setting chromeBin from buildId to ${config.rendering.chromeBin}`);
        }
      }
    }

    await serve({
      handshakeConfig: {
        protocolVersion: 2,
        magicCookieKey: 'grafana_plugin_type',
        magicCookieValue: 'renderer',
      },
      versionedPlugins: {
        2: {
          renderer: new RenderGRPCPluginV2(config, logger),
        },
      },
      logger: logger,
      grpcHost: config.plugin.grpc.host,
      grpcPort: config.plugin.grpc.port,
    });
  } else if (command === 'server') {
    const config = getConfig() as ServiceConfig;
    const logger = new ConsoleLogger(config.service.logging);

    if (config.rendering.tracing.url) {
      startTracing(logger);
    }

    await ensureEmbeddedBrowser();

    const sanitizer = createSanitizer();
    const server = new HttpServer(config, logger, sanitizer);
    await server.start();
  } else {
    console.log('Unknown command');
  }
}

main().catch((err) => {
  const errorLog = {
    '@level': 'error',
    '@message': 'failed to start grafana-image-renderer',
    error: err.message,
    trace: err.stack,
  };
  console.error(JSON.stringify(errorLog));
  process.exit(1);
});
