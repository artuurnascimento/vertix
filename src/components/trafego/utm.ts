/**
 * Helpers puros do rastreador UTM: construtor de URL (placeholders dinâmicos
 * da Meta nunca são URL-encodados — a Meta substitui {{campaign.id}} etc. na
 * entrega do anúncio), snippet de instalação e agregação de atribuição.
 */

export interface UtmParams {
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_content: string
  utm_term: string
}

export const UTM_META_DEFAULTS: UtmParams = {
  utm_source: 'facebook',
  utm_medium: '{{adset.id}}',
  utm_campaign: '{{campaign.id}}',
  utm_content: '{{ad.id}}',
  utm_term: '',
}

const META_PLACEHOLDER_RE = /^\{\{[a-z_.]+\}\}$/

export function isMetaPlaceholder(value: string): boolean {
  return META_PLACEHOLDER_RE.test(value)
}

/** Monta a URL final. Valores vazios são omitidos; placeholders ficam crus. */
export function buildUtmUrl(destino: string, params: UtmParams): string {
  const base = destino.trim()
  if (base === '') return ''

  const pares = (Object.entries(params) as Array<[keyof UtmParams, string]>)
    .map(([chave, valor]) => [chave, valor.trim()] as const)
    .filter(([, valor]) => valor !== '')
    .map(([chave, valor]) =>
      isMetaPlaceholder(valor)
        ? `${chave}=${valor}`
        : `${chave}=${encodeURIComponent(valor)}`
    )

  if (pares.length === 0) return base
  const separador = base.includes('?') ? '&' : '?'
  return `${base}${separador}${pares.join('&')}`
}

/**
 * Snippet de instalação self-contained: identidade por browser em localStorage,
 * sid rotacionado quando chega clique novo com UTM (atribuição last-click),
 * visita enviada 1× por sid, window.vtx.convert() para conversões.
 * Falha sempre silenciosa — tracking nunca quebra o site.
 */
export function makeSnippet(supabaseUrl: string, anonKey: string): string {
  return `<script>
(function(){var U='${supabaseUrl}',K='${anonKey}';
function post(f,b){try{fetch(U+'/rest/v1/rpc/'+f,{method:'POST',headers:{apikey:K,'Content-Type':'application/json'},body:JSON.stringify(b),keepalive:true}).catch(function(){})}catch(e){}}
function novoSid(){try{return crypto.randomUUID()}catch(e){return Date.now()+'-'+Math.random().toString(36).slice(2,12)}}
var q=new URLSearchParams(location.search),temUtm=q.get('utm_source')||q.get('utm_campaign'),sid;
try{sid=localStorage.getItem('vtx_sid')}catch(e){sid=null}
if(!sid||temUtm){sid=novoSid();try{localStorage.setItem('vtx_sid',sid)}catch(e){}}
var enviado;try{enviado=localStorage.getItem('vtx_sent')}catch(e){enviado=null}
if(enviado!==sid){try{localStorage.setItem('vtx_sent',sid)}catch(e){}
post('track_utm_visit',{p_session_key:sid,p_source:q.get('utm_source'),p_medium:q.get('utm_medium'),p_campaign:q.get('utm_campaign'),p_content:q.get('utm_content'),p_term:q.get('utm_term'),p_landing_url:location.href.slice(0,500),p_referrer:document.referrer.slice(0,500)})}
window.vtx={convert:function(o){o=o||{};post('track_utm_conversion',{p_session_key:sid,p_tipo:o.tipo||'lead',p_valor:o.valor||0,p_pedido_ref:o.ref||null})}};
})();
</script>`
}

export interface SessionRow {
  utm_campaign: string | null
  utm_medium?: string | null
  utm_content?: string | null
  utm_conversions: Array<{ tipo: string; valor: number }>
}

export interface CampaignAttribution {
  campanha: string
  sessoes: number
  conversoes: number
  receita: number
}

function groupByKey(
  rows: SessionRow[],
  getKey: (row: SessionRow) => string
): CampaignAttribution[] {
  const mapa = new Map<string, CampaignAttribution>()
  for (const row of rows) {
    const chave = getKey(row)
    const atual = mapa.get(chave) ?? {
      campanha: chave,
      sessoes: 0,
      conversoes: 0,
      receita: 0,
    }
    const receitaRow = row.utm_conversions.reduce(
      (soma, c) => soma + (c.valor ?? 0),
      0
    )
    mapa.set(chave, {
      campanha: chave,
      sessoes: atual.sessoes + 1,
      conversoes: atual.conversoes + row.utm_conversions.length,
      receita: atual.receita + receitaRow,
    })
  }
  return [...mapa.values()].sort(
    (a, b) => b.receita - a.receita || b.sessoes - a.sessoes
  )
}

/** Agrupa sessões por utm_campaign (null/vazio → 'direto'). */
export function groupByCampaign(rows: SessionRow[]): CampaignAttribution[] {
  return groupByKey(rows, (row) => row.utm_campaign?.trim() || 'direto')
}

/**
 * Breakdown de uma campanha por conjunto (utm_medium) ou anúncio
 * (utm_content). 'direto' agrupa sessões sem utm_campaign.
 */
export function breakdownForCampaign(
  rows: SessionRow[],
  campanha: string,
  dimensao: 'utm_medium' | 'utm_content'
): CampaignAttribution[] {
  const daCampanha = rows.filter(
    (row) => (row.utm_campaign?.trim() || 'direto') === campanha
  )
  return groupByKey(
    daCampanha,
    (row) => row[dimensao]?.trim() || 'não informado'
  )
}
