import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Software GL so the three.js canvas can create a WebGL context on headless runners.
        launchOptions: {
          args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
        },
      },
    },
  ],
  // Starts the API (3001) and Vite (5173) together via the repo's own dev script.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
