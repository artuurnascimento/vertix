import { test, expect } from '@playwright/test'
import { loadEnv } from 'vite'

// Isolated UI fixtures: no request in these tests reaches the live database.
test.use({ storageState: { cookies: [], origins: [] } })
const env = loadEnv('development', process.cwd(), 'VITE_')
const host = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'preview@example.test',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
}
const now = new Date().toISOString()
const projects = [
  {
    id: '00000000-0000-4000-8000-000000000002',
    nome: 'Implementação da loja',
    status: 'briefing_recebido',
    tipo_servico: 'loja',
    created_at: now,
    updated_at: now,
    clients: { id: 'client-1', nome: 'Ana Silva', empresa: 'Studio Norte' },
    proposals: [],
  },
  {
    id: 'project-2',
    nome: 'Nova loja',
    status: 'lead',
    tipo_servico: 'loja',
    created_at: now,
    updated_at: now,
    clients: { id: 'client-2', nome: 'Bruno', empresa: 'Loja Aurora' },
    proposals: [],
  },
]
async function setup(
  page: import('@playwright/test').Page,
  mode: 'data' | 'empty' | 'error' = 'data'
) {
  await page.route('**/auth/v1/**', (route) => route.fulfill({ json: user }))
  await page.route('**/rest/v1/**', (route) => {
    const url = new URL(route.request().url())
    const table = url.pathname.split('/').pop()
    if (table === 'profiles')
      return route.fulfill({
        json: { ...user, nome: 'Artur Nascimento', role: 'admin' },
      })
    if (mode === 'error')
      return route.fulfill({
        status: 500,
        json: { message: 'Falha simulada' },
      })
    const body =
      mode === 'empty'
        ? []
        : table === 'projects'
          ? projects
          : table === 'receivables'
            ? [
                {
                  id: 'payment-1',
                  descricao: 'Plano',
                  valor: 24800,
                  status: 'pago',
                  pago_em: now,
                  vencimento: now.slice(0, 10),
                  project_id: projects[0].id,
                },
              ]
            : table === 'proposals'
              ? [
                  {
                    id: 'proposal-1',
                    status: 'enviada',
                    valor_total: 38400,
                    created_at: now,
                  },
                ]
              : []
    return route.fulfill({ json: body })
  })
  await page.addInitScript(
    ({ host, user }) => {
      const token = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }))}.test`
      localStorage.setItem(
        `sb-${host}-auth-token`,
        JSON.stringify({
          access_token: token,
          refresh_token: 'test',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: 'bearer',
          user,
        })
      )
      sessionStorage.setItem('vx-splash-shown', '1')
    },
    { host, user }
  )
  await page.goto('/admin')
}
for (const width of [320, 390, 768, 1440]) {
  test(`dashboard responsive ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await setup(page)
    await expect(
      page.getByRole('heading', { name: 'Oportunidades', exact: false })
    ).toBeVisible()
    await expect(page.locator('.vx-metrics')).toContainText('24.800')
    await expect(page.locator('.vx-opportunity-list')).toContainText(
      'Studio Norte'
    )
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBeTruthy()
    const overflowing = await page.locator('.vx-main').evaluate((el) =>
      [...el.querySelectorAll('*')]
        .filter((node) => {
          const r = node.getBoundingClientRect()
          return (
            !node.closest('.sr-only') &&
            r.width > 0 &&
            r.right > innerWidth + 1 &&
            getComputedStyle(node).position !== 'absolute'
          )
        })
        .map((n) => n.tagName + '.' + n.className)
        .slice(0, 5)
    )
    expect(overflowing).toEqual([])
    await page.screenshot({
      path: test.info().outputPath(`vertix-${width}.png`),
      fullPage: true,
    })
    if (width < 768) {
      await page
        .getByRole('button', { name: /Studio Norte Briefing recebido/ })
        .click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('dialog')).toContainText('Jornada do cliente')
      await page.screenshot({
        path: test.info().outputPath(`vertix-detail-${width}.png`),
      })
      await page
        .getByRole('button', { name: 'Criar proposta', exact: true })
        .last()
        .click()
      await expect(page.locator('.vx-detail-dialog')).not.toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Nova proposta' })
      ).toBeVisible()
    }
  })
}
test('mobile menu keeps every module reachable and restores focus on Escape', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await page.getByRole('button', { name: 'Mais', exact: true }).click()
  const menu = page.getByRole('dialog')
  await expect(
    menu.getByRole('link', { name: 'Checkouts', exact: true })
  ).toBeVisible()
  await expect(menu.getByRole('link')).toHaveCount(19)
  await page.keyboard.press('Escape')
  await expect(menu).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Mais', exact: true })
  ).toBeFocused()
})
test('empty dashboard offers a real next step', async ({ page }) => {
  await setup(page, 'empty')
  await expect(page.getByText('Espaço para novas oportunidades')).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Abrir projetos', exact: true })
  ).toHaveAttribute('href', '/admin/projetos')
})
test('request failures do not display success or fabricated zero values', async ({
  page,
}) => {
  await setup(page, 'error')
  await expect(page.getByText('Dados indisponíveis').first()).toBeVisible({
    timeout: 15000,
  })
  await expect(
    page.getByText('Não foi possível carregar os alertas.')
  ).toBeVisible()
  await expect(
    page.getByText('Espaço para novas oportunidades')
  ).not.toBeVisible()
})
