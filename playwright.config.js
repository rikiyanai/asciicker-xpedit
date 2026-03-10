// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/playwright',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: [
    ['html'],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:5071',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: false, // Show browser for visibility
  },
  webServer: {
    url: 'http://localhost:5071',
    reuseExistingServer: true,
    timeout: 30000,
  },
  timeout: 90000,
});
