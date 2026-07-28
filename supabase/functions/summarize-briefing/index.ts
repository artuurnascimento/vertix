/**
 * summarize-briefing
 *
 * Input: { briefing_id }. Lê as respostas do briefing + os rótulos das
 * perguntas do template e produz um resumo executivo estruturado
 * (objetivo, escopo, público, riscos, próximos passos).
 *
 * Se ANTHROPIC_API_KEY existir, usa a API da Anthropic (claude-haiku-4-5 —
 * barato e suficiente para sumarização). Sem a chave, cai num resumo extrativo
 * determinístico. Em ambos os casos, persiste em briefings.resumo/resumo_meta.
 */

interface Pergunta {
  id: string
  label: string
}

interface BriefingRow {
  id: string
  respostas: Record<string, unknown> | null
  projects: { nome: string } | null
  briefing_templates: { perguntas: Pergunta[] } | null
}

interface ResumoMeta {
  objetivo: string
  escopo: string
  publico: string
  riscos: string
  proximos_passos: string
  fonte: 'ia' | 'extrativo'
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Junta respostas com os rótulos das perguntas em pares legíveis. */
function pares(
  respostas: Record<string, unknown>,
  perguntas: Pergunta[]
): { label: string; valor: string }[] {
  const rotulo = new Map(perguntas.map((p) => [p.id, p.label]))
  return Object.entries(respostas)
    .map(([id, valor]) => ({
      label: rotulo.get(id) ?? id,
      valor: String(valor ?? '').trim(),
    }))
    .filter((p) => p.valor.length > 0)
}

function textoResumo(meta: ResumoMeta): string {
  return [
    `Objetivo: ${meta.objetivo}`,
    `Escopo: ${meta.escopo}`,
    `Público: ${meta.publico}`,
    `Riscos e atenção: ${meta.riscos}`,
    `Próximos passos: ${meta.proximos_passos}`,
  ].join('\n\n')
}

/** Fallback sem IA: monta blocos a partir de heurísticas por palavra-chave. */
function resumoExtrativo(
  projetoNome: string,
  p: { label: string; valor: string }[]
): ResumoMeta {
  const achar = (termos: string[]): string | null => {
    const hit = p.find((item) =>
      termos.some((t) => item.label.toLowerCase().includes(t))
    )
    return hit ? hit.valor : null
  }

  const sobre = achar(['empresa', 'negócio', 'vende', 'sobre'])
  const publico = achar(['cliente', 'público', 'publico', 'quem'])
  const prazo = achar(['prazo'])
  const orcamento = achar(['orçamento', 'orcamento', 'investimento'])
  const integracoes = achar(['integração', 'integracoes', 'integr'])
  const referencias = achar(['referência', 'referencias', 'inspiração'])

  const riscos: string[] = []
  if (prazo) riscos.push(`prazo declarado de ${prazo}`)
  if (orcamento) riscos.push(`orçamento na faixa ${orcamento}`)
  if (integracoes) riscos.push(`integrações necessárias: ${integracoes}`)

  return {
    objetivo: sobre
      ? `Projeto ${projetoNome} — ${sobre}`
      : `Projeto ${projetoNome}.`,
    escopo:
      p
        .slice(0, 6)
        .map((item) => `${item.label}: ${item.valor}`)
        .join(' · ') || 'Sem detalhes de escopo informados.',
    publico: publico ?? 'Público-alvo não especificado no briefing.',
    riscos:
      riscos.length > 0
        ? riscos.join('; ') + '.'
        : 'Sem riscos evidentes destacados nas respostas.',
    proximos_passos: referencias
      ? `Validar direção visual (referências: ${referencias}) e confirmar escopo com o cliente.`
      : 'Confirmar escopo e direção visual com o cliente antes de iniciar.',
    fonte: 'extrativo',
  }
}

async function resumoIA(
  apiKey: string,
  projetoNome: string,
  p: { label: string; valor: string }[]
): Promise<ResumoMeta | null> {
  const respostasTexto = p
    .map((item) => `- ${item.label}\n  ${item.valor}`)
    .join('\n')

  const prompt =
    `Você é um gestor de projetos de uma agência de software/e-commerce. ` +
    `Abaixo estão as respostas do briefing do projeto "${projetoNome}". ` +
    `Produza um resumo executivo curto e acionável para a equipe interna.\n\n` +
    `Respostas do briefing:\n${respostasTexto}\n\n` +
    `Responda APENAS com um objeto JSON válido, sem markdown, com exatamente ` +
    `estas chaves (valores em português, cada um com 1-2 frases): ` +
    `objetivo, escopo, publico, riscos, proximos_passos.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    console.error('[summarize-briefing] Anthropic falhou:', res.status)
    return null
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[]
  }
  const texto = data.content?.find((c) => c.type === 'text')?.text ?? ''
  const match = texto.match(/\{[\s\S]*\}/)
  if (!match) return null

  try {
    const parsed = JSON.parse(match[0]) as Partial<ResumoMeta>
    return {
      objetivo: parsed.objetivo ?? '',
      escopo: parsed.escopo ?? '',
      publico: parsed.publico ?? '',
      riscos: parsed.riscos ?? '',
      proximos_passos: parsed.proximos_passos ?? '',
      fonte: 'ia',
    }
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'env_supabase_ausente' }, 500)
  }

  let briefingId: string | undefined
  try {
    const body = (await req.json()) as { briefing_id?: string }
    briefingId = body.briefing_id
  } catch {
    return jsonResponse({ ok: false, error: 'body_invalido' }, 400)
  }
  if (!briefingId) {
    return jsonResponse({ ok: false, error: 'briefing_id_ausente' }, 400)
  }

  const briefingRes = await fetch(
    `${supabaseUrl}/rest/v1/briefings?id=eq.${briefingId}` +
      '&select=id,respostas,projects(nome),briefing_templates(perguntas)',
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  )
  if (!briefingRes.ok) {
    return jsonResponse({ ok: false, error: 'falha_ao_buscar' }, 502)
  }

  const rows = (await briefingRes.json()) as BriefingRow[]
  const briefing = rows[0]
  if (!briefing) {
    return jsonResponse({ ok: false, error: 'briefing_inexistente' }, 404)
  }
  if (!briefing.respostas || Object.keys(briefing.respostas).length === 0) {
    return jsonResponse({ ok: false, error: 'briefing_sem_respostas' }, 422)
  }

  const projetoNome = briefing.projects?.nome ?? 'projeto'
  const perguntas = briefing.briefing_templates?.perguntas ?? []
  const p = pares(briefing.respostas, perguntas)

  let meta: ResumoMeta | null = null
  if (anthropicKey) {
    meta = await resumoIA(anthropicKey, projetoNome, p)
  }
  if (!meta) {
    meta = resumoExtrativo(projetoNome, p)
  }

  const resumo = textoResumo(meta)
  const geradoEm = new Date().toISOString()

  const patchRes = await fetch(
    `${supabaseUrl}/rest/v1/briefings?id=eq.${briefingId}`,
    {
      method: 'PATCH',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        resumo,
        resumo_meta: meta,
        resumo_gerado_em: geradoEm,
      }),
    }
  )
  if (!patchRes.ok) {
    return jsonResponse({ ok: false, error: 'falha_ao_salvar' }, 502)
  }

  return jsonResponse({ ok: true, resumo, resumo_meta: meta, fonte: meta.fonte })
})
