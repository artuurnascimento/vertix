/**
 * invite-user
 *
 * Recebe { email, nome, role } de um admin autenticado. Valida o JWT do
 * chamador e que ele é admin (query em profiles via service role, mesmo
 * padrão de create-payment-link), cria o usuário via Auth Admin API com uma
 * senha temporária aleatória forte (retornada UMA vez na resposta) e insere o
 * profile correspondente (id do user criado, nome, role).
 *
 * Erros amigáveis (email já existe, payload inválido, etc). Nunca loga
 * senhas, JWTs ou chaves.
 */

interface RequestBody {
  email?: string
  nome?: string
  role?: string
}

const VALID_ROLES = ['admin', 'colaborador']

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function generateTempPassword(): string {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  const base = Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('')
  // Garante presença de maiúscula, minúscula, número e símbolo.
  return `Vx${base.slice(0, 14)}!9`
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Não autenticado.' }, 401)
  }
  const jwt = authHeader.slice('Bearer '.length)

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'payload_invalido' }, 400)
  }

  const email = body.email?.trim()
  const nome = body.nome?.trim()
  const role = body.role

  if (!email || !isValidEmail(email)) {
    return jsonResponse({ error: 'Email inválido.' }, 400)
  }
  if (!nome) {
    return jsonResponse({ error: 'Nome é obrigatório.' }, 400)
  }
  if (!role || !VALID_ROLES.includes(role)) {
    return jsonResponse({ error: 'Role deve ser "admin" ou "colaborador".' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[invite-user] Env do Supabase ausente.')
    return jsonResponse({ error: 'env_supabase_ausente' }, 500)
  }

  // Valida o JWT e resolve o usuário chamador.
  const callerRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${jwt}`,
    },
  })
  if (!callerRes.ok) {
    return jsonResponse({ error: 'Não autenticado.' }, 401)
  }
  const caller = (await callerRes.json()) as { id?: string }
  if (!caller.id) {
    return jsonResponse({ error: 'Não autenticado.' }, 401)
  }

  // Confirma que o chamador é admin via profiles (service role).
  const callerProfileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${caller.id}&select=id,role`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  )
  if (!callerProfileRes.ok) {
    console.error('[invite-user] Falha ao checar profile do chamador:', callerProfileRes.status)
    return jsonResponse({ error: 'Falha ao validar permissão.' }, 502)
  }
  const callerProfiles = (await callerProfileRes.json()) as Array<{ id: string; role: string }>
  const callerProfile = callerProfiles[0]
  if (!callerProfile || callerProfile.role !== 'admin') {
    return jsonResponse({ error: 'Acesso negado.' }, 403)
  }

  const tempPassword = generateTempPassword()

  // Cria o usuário via Auth Admin API.
  const createUserRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: tempPassword,
      email_confirm: true,
    }),
  })

  const createUserBody = (await createUserRes.json()) as Record<string, unknown>
  if (!createUserRes.ok) {
    const errorCode = createUserBody.error_code ?? createUserBody.code
    const errorMsg = String(createUserBody.msg ?? createUserBody.message ?? '')
    if (
      createUserRes.status === 422 ||
      errorCode === 'email_exists' ||
      errorMsg.toLowerCase().includes('already been registered')
    ) {
      return jsonResponse({ error: 'Este email já está cadastrado.' }, 409)
    }
    console.error('[invite-user] Falha ao criar usuário:', createUserRes.status)
    return jsonResponse({ error: 'Falha ao criar usuário.' }, 502)
  }

  const newUserId = (createUserBody as { id?: string }).id
  if (!newUserId) {
    console.error('[invite-user] Resposta do Auth Admin sem id de usuário.')
    return jsonResponse({ error: 'Resposta inválida ao criar usuário.' }, 502)
  }

  // Insere o profile correspondente.
  const insertProfileRes = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      id: newUserId,
      nome,
      role,
    }),
  })

  if (!insertProfileRes.ok) {
    console.error('[invite-user] Falha ao inserir profile:', insertProfileRes.status)
    // Rollback: remove o usuário Auth criado para não deixar órfão sem profile.
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${newUserId}`, {
      method: 'DELETE',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    })
    return jsonResponse({ error: 'Falha ao criar perfil do usuário.' }, 502)
  }

  return jsonResponse({
    ok: true,
    user_id: newUserId,
    email,
    nome,
    role,
    senha_temporaria: tempPassword,
  })
})
