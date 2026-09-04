import { expect, test } from '@playwright/test'
import { ADMIN_EMAIL, loginAsAdmin } from './helpers'

// Este spec valida o fluxo de autenticação — sempre começa deslogado.
// O login mora na raiz "/" (HostRoot renderiza <Login />); "/login" é apenas
// um atalho que redireciona para lá.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Autenticação', () => {
  test('redireciona /admin para a tela de login quando deslogado', async ({
    page,
  }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  })

  test('mostra erro com senha errada e permanece na tela de login', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Senha').fill('senha-completamente-errada')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByRole('alert')).toContainText(
      'Email ou senha inválidos'
    )
    await expect(page).toHaveURL('/')
  })

  test('login admin válido chega no dashboard', async ({ page }) => {
    await loginAsAdmin(page)
    await expect(page).toHaveURL(/\/admin$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Visão geral' })
    ).toBeVisible()
  })

  test('botão Sair volta para a tela de login', async ({ page }) => {
    await loginAsAdmin(page)
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  })
})
