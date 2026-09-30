import { defineConfig, devices } from '@playwright/test'

// Test end-to-end berjalan di dev server dengan penyimpanan terpisah (.data-e2e), jadi data lokal tidak tersentuh.
const PORT = 5174

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node -e "require('fs').rmSync('.data-e2e',{recursive:true,force:true})" && npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/api/state`,
    env: { JARKOMAN_DEV_STORE: '.data-e2e', ADMIN_PASSWORD: 'admin' },
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
