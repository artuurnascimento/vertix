import { expect, test, type Page } from '@playwright/test'
import {
  ADMIN_STATE_PATH,
  deleteClientIfPresent,
  waitClientsLoaded,
} from './helpers'

// Nome único por execução: banco compartilhado com outros agentes/humanos.
const RUN_ID = Date.now()
const CLIENT_NAME = `E2E Cliente ${RUN_ID}`
const CLIENT_EMPRESA = `E2E Empresa ${RUN_ID}`
const CLIENT_EMAIL = `e2e.cliente.${RUN_ID}@teste.local`
const CLIENT_ORIGEM = 'Indicação'
const CLIENT_TELEFONE = '(11) 98888-7777'

function clientRow(page: Page) {
  return page.getByRole('row').filter({ hasText: CLIENT_NAME })
}

async function openClientDetail(page: Page): Promise<void> {
  await page.goto('/admin/clientes')
  await waitClientsLoaded(page)
  await clientRow(page).getByText(CLIENT_NAME, { exact: true }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: CLIENT_NAME })
  ).toBeVisible()
}

test.describe.serial('CRUD de cliente (admin)', () => {
  // Teardown best-effort: nunca deixar dado E2E no banco, mesmo em falha.
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: ADMIN_STATE_PATH,
    })
    const page = await context.newPage()
    try {
      await deleteClientIfPresent(page, CLIENT_NAME)
    } catch {
      // Cleanup best-effort — o último teste já valida a exclusão real.
    } finally {
      await context.close()
    }
  })

  test('cria cliente pelo modal e vê a row sem reload', async ({ page }) => {
    await page.goto('/admin/clientes')
    await waitClientsLoaded(page)

    await page.getByRole('button', { name: 'Novo cliente' }).click()
    const dialog = page.getByRole('dialog', { name: 'Novo cliente' })
    await expect(dialog).toBeVisible()

    await dialog.getByLabel('Nome *').fill(CLIENT_NAME)
    await dialog.getByLabel('Empresa').fill(CLIENT_EMPRESA)
    await dialog.getByLabel('Email').fill(CLIENT_EMAIL)
    await dialog.getByLabel('Origem').selectOption(CLIENT_ORIGEM)
    await dialog.getByRole('button', { name: 'Criar cliente' }).click()

    await expect(dialog).toBeHidden()

    // Row aparece sem reload (invalidateQueries do TanStack Query).
    const row = clientRow(page)
    await expect(row).toBeVisible()
    await expect(row).toContainText(CLIENT_EMPRESA)
    await expect(row).toContainText(CLIENT_EMAIL)
    await expect(row).toContainText(CLIENT_ORIGEM)
  })

  test('abre o detalhe e vê heading com o nome do cliente', async ({
    page,
  }) => {
    await openClientDetail(page)
    await expect(page.getByText(CLIENT_EMAIL)).toBeVisible()
    await expect(page.getByText(/Cliente desde/)).toBeVisible()
  })

  test('edita o telefone e persiste ao reabrir o modal', async ({ page }) => {
    await openClientDetail(page)

    await page.getByRole('button', { name: 'Editar' }).click()
    const dialog = page.getByRole('dialog', { name: 'Editar cliente' })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Telefone').fill(CLIENT_TELEFONE)
    await dialog.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(dialog).toBeHidden()

    // Card de contato do detalhe reflete o novo telefone.
    await expect(page.getByText(CLIENT_TELEFONE)).toBeVisible()

    // Reabre o modal: valor persistido veio do banco.
    await page.getByRole('button', { name: 'Editar' }).click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Telefone')).toHaveValue(CLIENT_TELEFONE)
    await expect(dialog.getByLabel('Nome *')).toHaveValue(CLIENT_NAME)
    await dialog.getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialog).toBeHidden()
  })

  test('exclui o cliente pelo ícone com confirmação no modal', async ({
    page,
  }) => {
    await page.goto('/admin/clientes')
    await waitClientsLoaded(page)

    const row = clientRow(page)
    await expect(row).toBeVisible()
    await row.hover()
    await row.getByRole('button', { name: `Excluir ${CLIENT_NAME}` }).click()

    const confirmDialog = page.getByRole('alertdialog', {
      name: 'Excluir cliente',
    })
    await expect(confirmDialog).toBeVisible()
    await expect(confirmDialog).toContainText(CLIENT_NAME)
    await confirmDialog.getByRole('button', { name: 'Excluir' }).click()

    await expect(confirmDialog).toBeHidden()
    await expect(row).toHaveCount(0)
  })
})
