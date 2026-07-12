import { expect, test } from '@playwright/test'
import { ADMIN_EMAIL, loginAsAdmin } from './helpers'

// Este spec valida o fluxo de autenticação — sempre começa deslogado.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Autenticação', () => {
  test('redireciona /admin para /login quando deslogado', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  })

  test('mostra erro com senha errada e permanece em /login', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Senha').fill('senha-completamente-errada')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByRole('alert')).toContainText(
      'Email ou senha inválidos'
    )
    await expect(page).toHaveURL(/\/login$/)
  })

  test('login admin válido chega em /admin/clientes', async ({ page }) => {
    await loginAsAdmin(page)
    await expect(page).toHaveURL(/\/admin\/clientes$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Clientes' })
    ).toBeVisible()
  })

  test('botão Sair volta para /login', async ({ page }) => {
    await loginAsAdmin(page)
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  })
})
