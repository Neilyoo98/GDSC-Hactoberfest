// OWNER: P3
import { defineConfig } from '@playwright/test';
const externalServer = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: externalServer ?? 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
  },
  webServer: externalServer
    ? undefined
    : {
        command:
          'npm run build && npm run start -- --hostname 127.0.0.1 --port 3100',
        url: 'http://127.0.0.1:3100',
        reuseExistingServer: false,
      },
});
