import { expect, test } from '@playwright/test'

/**
 * Link de bio: a página pública e o módulo do painel.
 *
 * A página entra por /bio, que vale em qualquer host — em produção a raiz de
 * bio.vertix.studio cai no mesmo lugar pelo resolvedor de host. A suíte aponta
 * para um endereço local fixo e não teria como resolver o domínio real.
 */

const RUN_ID = Date.now()
const BOTAO_NOME = `E2E Botao ${RUN_ID}`

test.describe('página pública do bio', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('mostra os atalhos e monta o link de conversa', async ({ page }) => {
    await page.goto('/bio')

    await expect(
      page.getByRole('heading', { level: 1, name: /VERTIX/i })
    ).toBeVisible()

    const conversa = page.getByRole('link', { name: /Falar no WhatsApp/i })
    await expect(conversa).toBeVisible()
    await expect(conversa).toHaveAttribute('href', /^https:\/\/wa\.me\/\d{12,13}$/)
    await expect(conversa).toHaveAttribute('rel', /noopener/)

    // Botão de serviço leva à conversa com mensagem pronta.
    const loja = page.getByRole('link', { name: /Loja Shopify/i })
    await expect(loja).toHaveAttribute('href', /wa\.me\/\d+\?text=/)

    // Nenhum botão exibido pode levar a lugar nenhum. A regra de esconder o
    // que está desligado ou sem destino é coberta em bioLinks.test.ts; aqui
    // não se afirma nada sobre um botão específico, que é conteúdo editável.
    const semDestino = await page
      .locator('main a[href=""], main a:not([href])')
      .count()
    expect(semDestino).toBe(0)
  })
})

test.describe.serial('módulo do link de bio (admin)', () => {
  test('cria um botão pelo modal e a lista atualiza sem recarregar', async ({
    page,
  }) => {
    await page.goto('/admin/bio')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Link de bio' })
    ).toBeVisible()

    await page.getByRole('button', { name: 'Novo botão' }).click()
    const dialog = page.getByRole('dialog', { name: 'Novo botão' })
    await expect(dialog).toBeVisible()

    await dialog.getByLabel('Texto do botão *').fill(BOTAO_NOME)
    // Por papel: "Endereço" sozinho casaria também com a opção "Endereço na
    // web" do seletor de tipo de destino.
    await dialog
      .getByRole('textbox', { name: 'Endereço' })
      .fill('https://www.vertix.studio/e2e')
    await dialog.getByRole('button', { name: 'Criar botão' }).click()

    // O modal precisa sumir de verdade: um overlay preso cobriria a tela.
    await expect(dialog).toBeHidden()

    // Escopado na lista de botões: a prévia e o resumo de 30 dias mostram
    // o mesmo nome.
    await expect(
      page.getByRole('list', { name: 'Botões do link de bio' }).getByText(BOTAO_NOME)
    ).toBeVisible()
  })

  test('esconde o botão e ele some da página pública', async ({ page }) => {
    await page.goto('/admin/bio')
    const linha = page
      .getByRole('list', { name: 'Botões do link de bio' })
      .getByRole('listitem')
      .filter({ hasText: BOTAO_NOME })
    await linha.getByRole('button', { name: `Esconder ${BOTAO_NOME}` }).click()
    await expect(
      linha.getByRole('button', { name: `Mostrar ${BOTAO_NOME}` })
    ).toBeVisible()

    await page.goto('/bio')
    await expect(page.getByText(BOTAO_NOME)).toHaveCount(0)
  })

  test('exclui o botão de teste', async ({ page }) => {
    await page.goto('/admin/bio')
    const linha = page
      .getByRole('list', { name: 'Botões do link de bio' })
      .getByRole('listitem')
      .filter({ hasText: BOTAO_NOME })
    await linha.getByRole('button', { name: `Excluir ${BOTAO_NOME}` }).click()
    // Exclusão em dois cliques: o primeiro arma a confirmação.
    await linha.getByRole('button', { name: /Confirmar|Excluir/ }).last().click()
    await expect(
      page.getByRole('list', { name: 'Botões do link de bio' }).getByText(BOTAO_NOME)
    ).toHaveCount(0)
  })
})
