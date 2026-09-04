import { defineConfig, devices } from '@playwright/test'

/**
 * E2E contra o dev server já em execução (http://localhost:5175).
 * Banco compartilhado → execução serial (1 worker, sem fullyParallel).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    // E2E_BASE_URL permite apontar para outra porta sem editar o config
    // (útil quando a 5175 já está ocupada por outra sessão de trabalho).
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5175',
    // E2E_CHANNEL=chrome usa o Chrome da máquina, para quem não baixou os
    // navegadores do Playwright (npx playwright install). Vale para todos os
    // projetos, inclusive o de setup.
    ...(process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {}),
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
  ],
})
