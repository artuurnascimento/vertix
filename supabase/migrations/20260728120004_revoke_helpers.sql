-- =============================================================================
-- Tira os helpers de requisição da superfície pública de RPC
-- =============================================================================
--
-- request_client_ip() e request_user_agent() ficaram chamáveis via PostgREST
-- (`/rest/v1/rpc/request_client_ip`). Não vazam dado de terceiro — devolvem
-- apenas o IP/user-agent de quem chamou, que o próprio já conhece — mas são
-- helpers internos e não têm por que aparecer na API pública.
--
-- As funções que os usam (sign_contract, respond_proposal, create_lead) são
-- SECURITY DEFINER e executam como owner, então continuam funcionando.
-- =============================================================================

revoke execute on function public.request_client_ip() from public, anon, authenticated;
revoke execute on function public.request_user_agent() from public, anon, authenticated;
