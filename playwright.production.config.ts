import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/production',
  outputDir: './test-results/production',
  use: { viewport: { width: 1280, height: 720 } },
});
