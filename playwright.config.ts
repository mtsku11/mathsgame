import { defineConfig } from '@playwright/test';

const hostedURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests/browser',
  outputDir: './test-results/e2e',
  use: { baseURL: hostedURL ? `${hostedURL.replace(/\/$/, '')}/` : 'http://127.0.0.1:4173/', viewport: { width: 1280, height: 800 } },
  // The tablet relay runs locally in workerd for tablets.spec.ts, on a port other projects here do not use.
  webServer: hostedURL ? undefined : [
    { command: 'npm run dev -- --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
    { command: 'npx wrangler dev --config relay/wrangler.jsonc --ip 127.0.0.1 --port 8791 --inspector-port 9239', url: 'http://127.0.0.1:8791', reuseExistingServer: !process.env.CI },
  ],
});
