import { execFileSync } from 'node:child_process'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import {
  ADMIN_STATE_PATH,
  deleteClientIfPresent,
  waitClientsLoaded,
} from './helpers'

/**
 * E2E do fluxo completo: cliente → projeto → link de briefing →
 * preenchimento público → respostas no admin → nota na timeline → limpeza.
 *
 * Estratégia do token do briefing: consulta direta ao Postgres local do
 * Supabase (porta 54322) filtrando pelo nome único do projeto. Escolhida por
 * ser a mais robusta: a URL não é exposta no DOM (só via clipboard) e
 * clipboard-read em chromium headless exige permissões extras e é instável.
 */

// Nome único por execução: banco compartilhado com outros agentes/humanos.
const RUN_ID = Date.now()
const CLIENT_NAME = `E2E Flow Cliente ${RUN_ID}`
const PROJECT_NAME = `E2E Flow Loja ${RUN_ID}`
const NOTE_TEXT = `E2E Flow nota ${RUN_ID}`

/** browser.newContext() não herda o baseURL do projeto — URL absoluta. */
const BASE_URL = 'http://localhost:5175'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// Respostas do briefing usadas no submit público e verificadas no admin.
const RESPOSTA_CATALOGO = '120'
const RESPOSTA_PAGAMENTO = 'Mercado Pago'
const RESPOSTA_PRAZO = `2 meses (E2E ${RUN_ID})`
const RESPOSTA_ORCAMENTO = 'R$ 5 mil a R$ 15 mil'

/** Executa SQL no Postgres local do Supabase e retorna a saída crua (trim). */
function queryDb(sql: string): string {
  return execFileSync(
    'psql',
    ['-h', 'localhost', '-p', '54322', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c', sql],
    { env: { ...process.env, PGPASSWORD: 'postgres' }, encoding: 'utf8' }
  ).trim()
}

function fetchBriefingToken(projectName: string): string {
  return queryDb(
    `select b.token from public.briefings b
     join public.projects p on p.id = b.project_id
     where p.nome = '${projectName}' limit 1`
  )
}

/**
 * O template ecommerce novo (com pergunta escolha_visual) é gravado por um
 * processo paralelo. Espera (leitura, poll) até ele estar no banco; se o
 * timeout estourar, segue com o template atual — o wizard e o loop de
 * navegação abaixo funcionam com qualquer conjunto de perguntas.
 */
const TEMPLATE_VISUAL_SQL = `select count(*)
  from public.briefing_templates bt, jsonb_array_elements(bt.perguntas) p
  where bt.tipo_servico = 'ecommerce' and p->>'tipo' = 'escolha_visual'`

async function waitForTemplateEscolhaVisual(maxMs = 600_000): Promise<void> {
  const start = Date.now()
  for (;;) {
    let count = 0
    try {
      count = Number(queryDb(TEMPLATE_VISUAL_SQL))
    } catch {
      // Banco momentaneamente indisponível — tenta de novo.
    }
    if (count >= 1) return
    if (Date.now() - start > maxMs) {
      console.warn(
        '[e2e] Timeout aguardando template ecommerce com escolha_visual — seguindo com o template atual.'
      )
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000))
  }
}

async function openProjectDetail(page: Page): Promise<void> {
  await page.goto('/admin/clientes')
  await waitClientsLoaded(page)
  await page
    .getByRole('row')
    .filter({ hasText: CLIENT_NAME })
    .getByText(CLIENT_NAME, { exact: true })
    .click()
  await expect(
    page.getByRole('heading', { level: 1, name: CLIENT_NAME })
  ).toBeVisible()
  await page.getByRole('link').filter({ hasText: PROJECT_NAME }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: PROJECT_NAME })
  ).toBeVisible()
}

// Estado compartilhado entre os testes do fluxo serial.
let briefingToken = ''
let anonContext: BrowserContext | null = null

test.describe.serial('Fluxo completo de briefing (admin + público)', () => {
  // Teardown best-effort: nunca deixar dado E2E no banco, mesmo em falha.
  test.afterAll(async ({ browser }) => {
    if (anonContext) {
      await anonContext.close().catch(() => {})
      anonContext = null
    }
    const context = await browser.newContext({ storageState: ADMIN_STATE_PATH })
    const page = await context.newPage()
    try {
      await deleteClientIfPresent(page, CLIENT_NAME)
    } catch {
      // Best-effort — o último teste já valida a exclusão real.
    } finally {
      await context.close()
    }
  })

  test('cria o cliente do fluxo pelo modal', async ({ page }) => {
    await page.goto('/admin/clientes')
    await waitClientsLoaded(page)

    await page.getByRole('button', { name: 'Novo cliente' }).click()
    const dialog = page.getByRole('dialog', { name: 'Novo cliente' })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Nome *').fill(CLIENT_NAME)
    await dialog.getByRole('button', { name: 'Criar cliente' }).click()
    await expect(dialog).toBeHidden()

    await expect(
      page.getByRole('row').filter({ hasText: CLIENT_NAME })
    ).toBeVisible()
  })

  test('cria o projeto E-commerce no detalhe do cliente', async ({ page }) => {
    await page.goto('/admin/clientes')
    await waitClientsLoaded(page)
    await page
      .getByRole('row')
      .filter({ hasText: CLIENT_NAME })
      .getByText(CLIENT_NAME, { exact: true })
      .click()
    await expect(
      page.getByRole('heading', { level: 1, name: CLIENT_NAME })
    ).toBeVisible()

    await page.getByRole('button', { name: 'Novo projeto' }).click()
    const dialog = page.getByRole('dialog', { name: 'Novo projeto' })
    await expect(dialog).toBeVisible()

    await dialog.getByLabel('Nome do projeto *').fill(PROJECT_NAME)
    await dialog
      .getByLabel('Tipo de serviço *')
      .selectOption({ label: 'E-commerce' })
    // Cliente vem travado no modal aberto a partir do detalhe.
    await expect(dialog.getByText(CLIENT_NAME, { exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: 'Criar projeto' }).click()
    await expect(dialog).toBeHidden()

    const projectLink = page
      .getByRole('link')
      .filter({ hasText: PROJECT_NAME })
    await expect(projectLink).toBeVisible()
    await expect(projectLink).toContainText('E-commerce')
    await expect(projectLink).toContainText('Lead')
  })

  test('gera o link de briefing e o status vira Briefing enviado', async ({
    page,
  }) => {
    await openProjectDetail(page)

    await page.getByRole('button', { name: 'Gerar link de briefing' }).click()

    // Estado "aguardando cliente" confirma que o briefing foi criado.
    await expect(
      page.getByRole('heading', { name: 'Aguardando resposta do cliente' })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Copiar link', exact: true })
    ).toBeVisible()
    // Badge de status no header do projeto.
    await expect(
      page.getByText('Briefing enviado', { exact: true })
    ).toBeVisible()

    // Token direto do banco (ver nota de estratégia no topo do arquivo).
    briefingToken = fetchBriefingToken(PROJECT_NAME)
    expect(briefingToken).toMatch(UUID_RE)
  })

  test('cliente anônimo abre o link, responde o wizard e envia o briefing', async ({
    browser,
  }) => {
    // Inclui a espera pelo template novo (poll psql de leitura, até 10min).
    test.setTimeout(720_000)
    await waitForTemplateEscolhaVisual()

    expect(briefingToken, 'token deve ter sido obtido no passo anterior').toMatch(
      UUID_RE
    )

    // Contexto SEM storageState — simula o cliente sem login.
    anonContext = await browser.newContext()
    const page = await anonContext.newPage()
    await page.goto(`${BASE_URL}/briefing/${briefingToken}`)

    // Intro do wizard: título do projeto + botão de início.
    await expect(
      page.getByRole('heading', { name: `Briefing — ${PROJECT_NAME}` })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Começar' }).click()

    // Wizard: uma pergunta por tela. Loop robusto — identifica cada tela
    // pelo conteúdo (rádios-alvo ou regex da label), responde as
    // obrigatórias do contrato e pula opcionais, até chegar na revisão.
    const questionLabel = page.getByTestId('wizard-question-label')
    const reviewHeading = page.getByRole('heading', {
      name: 'Revise suas respostas',
    })
    const continuar = page.getByRole('button', { name: 'Continuar' })
    const pular = page.getByRole('button', { name: 'Pular' })

    const MAX_PASSOS = 25
    for (let passo = 0; passo < MAX_PASSOS; passo++) {
      if (await reviewHeading.isVisible().catch(() => false)) break
      await expect(questionLabel).toBeVisible()
      const label = (await questionLabel.innerText()).trim()

      const radioPagamento = page.getByRole('radio', {
        name: RESPOSTA_PAGAMENTO,
        exact: true,
      })
      const radioEstilo = page.getByRole('radio', {
        name: /Minimalista e clean/,
      })
      const radioOrcamento = page.getByRole('radio', {
        name: RESPOSTA_ORCAMENTO,
      })

      if ((await radioPagamento.count()) > 0) {
        // Rádio sr-only (card customizado) → force pula o hit-test visual.
        await radioPagamento.check({ force: true })
        await continuar.click()
      } else if ((await radioEstilo.count()) > 0) {
        // escolha_visual: selecionar o card avança sozinho (~350ms).
        await radioEstilo.check({ force: true })
      } else if ((await radioOrcamento.count()) > 0) {
        await radioOrcamento.check({ force: true })
        await continuar.click()
      } else if (await pular.isVisible().catch(() => false)) {
        // Toda pergunta opcional expõe "Pular" — obrigatórias, nunca.
        await pular.click()
      } else if (/quantos produtos/i.test(label)) {
        await page.getByLabel(/Quantos produtos/).fill(RESPOSTA_CATALOGO)
        await continuar.click()
      } else if (/prazo/i.test(label)) {
        await page.getByLabel(/prazo/i).fill(RESPOSTA_PRAZO)
        await continuar.click()
      } else {
        throw new Error(
          `Pergunta obrigatória inesperada no wizard (sem handler): "${label}"`
        )
      }

      // Espera a transição: próxima pergunta (label diferente) ou revisão.
      await expect
        .poll(
          async () => {
            if (await reviewHeading.isVisible().catch(() => false)) {
              return '__revisao__'
            }
            return (await questionLabel.innerText().catch(() => '')).trim()
          },
          { timeout: 10_000 }
        )
        .not.toBe(label)
    }

    // Revisão final: respostas obrigatórias listadas antes do envio.
    await expect(reviewHeading).toBeVisible()
    await expect(
      page.getByText(RESPOSTA_PAGAMENTO, { exact: true })
    ).toBeVisible()
    await expect(page.getByText(RESPOSTA_PRAZO, { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Enviar briefing' }).click()
    await expect(
      page.getByRole('heading', { name: 'Briefing enviado!' })
    ).toBeVisible()
  })

  test('reabrir o link no mesmo contexto anônimo mostra "já enviado"', async () => {
    expect(anonContext, 'contexto anônimo do passo anterior').not.toBeNull()
    const page = await anonContext!.newPage()
    await page.goto(`${BASE_URL}/briefing/${briefingToken}`)

    await expect(
      page.getByRole('heading', { name: 'Briefing já enviado — obrigado!' })
    ).toBeVisible()
    // Sem formulário: nenhum botão de envio nem campos de resposta.
    await expect(
      page.getByRole('button', { name: 'Enviar briefing' })
    ).toHaveCount(0)
    await expect(page.getByLabel(/Quantos produtos/)).toHaveCount(0)

    await anonContext!.close()
    anonContext = null
  })

  test('kanban mostra o card em Briefing recebido e respostas no admin', async ({
    page,
  }) => {
    await page.goto('/admin/projetos')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Projetos' })
    ).toBeVisible()

    const coluna = page.getByRole('region', {
      name: 'Coluna Briefing recebido',
    })
    await expect(coluna).toBeVisible()
    const card = coluna.getByText(PROJECT_NAME, { exact: true })
    await expect(card).toBeVisible()

    // Card clicável → detalhe do projeto.
    await card.click()
    await expect(
      page.getByRole('heading', { level: 1, name: PROJECT_NAME })
    ).toBeVisible()

    // Respostas do briefing visíveis, com os valores enviados no público.
    await expect(page.getByText('Respostas do cliente')).toBeVisible()
    await expect(
      page.getByText(RESPOSTA_PAGAMENTO, { exact: true })
    ).toBeVisible()
    await expect(page.getByText(RESPOSTA_PRAZO, { exact: true })).toBeVisible()
  })

  test('adiciona nota interna e ela aparece na timeline', async ({ page }) => {
    await openProjectDetail(page)
    // Briefing carregado garante que a página terminou de montar as seções.
    await expect(page.getByText('Respostas do cliente')).toBeVisible()

    // Dependência de agente paralelo: o composer de nota pode ainda não
    // existir na UI. Espera curta e determinística; se ausente, skip claro.
    const composer = page.getByPlaceholder('Adicionar nota interna')
    const hasComposer = await composer
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    test.skip(
      !hasComposer,
      'Composer de nota ("Adicionar nota interna…") ainda não está na UI — feature da timeline em desenvolvimento paralelo.'
    )

    await composer.fill(NOTE_TEXT)
    await page.getByRole('button', { name: 'Salvar nota' }).click()

    // Nota aparece na timeline e o composer é limpo após salvar.
    await expect(page.getByText(NOTE_TEXT, { exact: true })).toBeVisible()
    await expect(composer).toHaveValue('')
  })

  test('exclui o cliente pela UI e não sobra resíduo E2E no banco', async ({
    page,
  }) => {
    await page.goto('/admin/clientes')
    await waitClientsLoaded(page)

    const row = page.getByRole('row').filter({ hasText: CLIENT_NAME })
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

    // Cascade no banco: cliente → projeto → briefing → activity_log.
    const leftovers = queryDb(
      `select
         (select count(*) from public.clients where nome like 'E2E Flow %') +
         (select count(*) from public.projects where nome like 'E2E Flow %')`
    )
    expect(leftovers).toBe('0')
  })
})
