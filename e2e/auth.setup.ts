import { test as setup } from '@playwright/test'
import { ADMIN_STATE_PATH, loginAsAdmin } from './helpers'

setup('autentica admin e salva storageState', async ({ page }) => {
  await loginAsAdmin(page)
  await page.context().storageState({ path: ADMIN_STATE_PATH })
})
