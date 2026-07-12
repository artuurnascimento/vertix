#!/usr/bin/env bash
# =============================================================================
# Seed idempotente dos usuários de desenvolvimento (Fase 2 — Auth & Roles).
#
# Cria/atualiza no Supabase LOCAL:
#   admin@vertix.local (vertix123!) -> profile "Admin Vertix", role admin
#   time@vertix.local  (vertix123!) -> profile "Time Vertix",  role colaborador
#
# Seguro re-rodar quantas vezes quiser (inclusive após `supabase db reset`).
# As chaves são lidas DINAMICAMENTE de `supabase status -o env` — nenhum
# secret fica gravado em arquivo do projeto.
# =============================================================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

if ! command -v supabase >/dev/null 2>&1; then
  echo "ERRO: CLI do Supabase não encontrada no PATH." >&2
  exit 1
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "ERRO: psql não encontrado no PATH." >&2
  exit 1
fi

STATUS_ENV="$(supabase status -o env 2>/dev/null)" || {
  echo "ERRO: 'supabase status' falhou — o Supabase local está rodando?" >&2
  exit 1
}

get_var() {
  printf '%s\n' "$STATUS_ENV" | sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}$/\1/p" | head -1
}

API_URL="$(get_var API_URL)"
DB_URL="$(get_var DB_URL)"
SERVICE_KEY="$(get_var SERVICE_ROLE_KEY)"
# Fallback para CLIs mais novas que renomeiam a chave.
if [ -z "$SERVICE_KEY" ]; then
  SERVICE_KEY="$(get_var SECRET_KEY)"
fi

if [ -z "$API_URL" ] || [ -z "$DB_URL" ] || [ -z "$SERVICE_KEY" ]; then
  echo "ERRO: não consegui extrair API_URL/DB_URL/SERVICE_ROLE_KEY do supabase status." >&2
  exit 1
fi

seed_user() {
  local email="$1" password="$2" nome="$3" role="$4"
  local user_id

  user_id="$(psql "$DB_URL" -Atc "select id from auth.users where email = '$email'")"

  if [ -z "$user_id" ]; then
    curl -sS -f -X POST "$API_URL/auth/v1/admin/users" \
      -H "apikey: $SERVICE_KEY" \
      -H "Authorization: Bearer $SERVICE_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$email\",\"password\":\"$password\",\"email_confirm\":true}" \
      >/dev/null
    user_id="$(psql "$DB_URL" -Atc "select id from auth.users where email = '$email'")"
  else
    # Usuário já existe: garante a senha esperada (idempotência total).
    curl -sS -f -X PUT "$API_URL/auth/v1/admin/users/$user_id" \
      -H "apikey: $SERVICE_KEY" \
      -H "Authorization: Bearer $SERVICE_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"password\":\"$password\",\"email_confirm\":true}" \
      >/dev/null
  fi

  if [ -z "$user_id" ]; then
    echo "ERRO: usuário $email não foi criado." >&2
    exit 1
  fi

  psql "$DB_URL" -Atc \
    "insert into public.profiles (id, nome, role)
     values ('$user_id', '$nome', '$role')
     on conflict (id) do update set nome = excluded.nome, role = excluded.role" \
    >/dev/null

  echo "OK: $email (role=$role, id=${user_id:0:8}…)"
}

echo "Seed de usuários dev no Supabase local ($API_URL)…"
seed_user "admin@vertix.local" "vertix123!" "Admin Vertix" "admin"
seed_user "time@vertix.local" "vertix123!" "Time Vertix" "colaborador"
echo "Concluído."
