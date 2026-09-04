import { expect, type Page } from '@playwright/test'

export const ADMIN_EMAIL = 'admin@vertix.local'
export const ADMIN_PASSWORD = 'vertix123!'
export const ADMIN_STATE_PATH = 'e2e/.auth/admin.json'

/** Faz login pela UI e espera aterrissar no dashboard (home do admin). */
export async function loginAsAdmin(page: Page): Promise<void> {
  // A tela de login é a raiz "/" — "/login" só redireciona para cá.
  await page.goto('/')
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Senha').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Visão geral' })
  ).toBeVisible()
}

/** Espera a página /admin/clientes sair do estado de loading. */
export async function waitClientsLoaded(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { level: 1, name: 'Clientes' })
  ).toBeVisible()
  await expect(
    page.getByRole('table').or(page.getByText('Nenhum cliente ainda'))
  ).toBeVisible()
}

/**
 * Best-effort: remove pela UI o cliente com esse nome, se existir.
 * Usado no teardown para nunca deixar dado E2E no banco.
 */
export async function deleteClientIfPresent(
  page: Page,
  clientName: string
): Promise<void> {
  await page.goto('/admin/clientes')
  await waitClientsLoaded(page)
  const row = page.getByRole('row').filter({ hasText: clientName })
  if ((await row.count()) === 0) return
  await row.hover()
  await row.getByRole('button', { name: `Excluir ${clientName}` }).click()
  const confirmDialog = page.getByRole('alertdialog', {
    name: 'Excluir cliente',
  })
  await expect(confirmDialog).toBeVisible()
  await confirmDialog.getByRole('button', { name: 'Excluir' }).click()
  await expect(row).toHaveCount(0)
}
