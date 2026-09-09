-- ---------------------------------------------------------------------------
-- get_checkout_prefill — dados do comprador para o checkout já nascer cheio
-- ---------------------------------------------------------------------------
--
-- Quem compra o Plano de Correção JÁ deu nome, e-mail e WhatsApp no portão da
-- análise profunda do Scan. Chegar no checkout e ter que digitar tudo de novo
-- é atrito puro — e atrito em formulário de pagamento é venda perdida. Estes
-- três campos voltam aqui para a página preencher sozinha; do comprador sobra
-- o CPF e o cartão.
--
-- POR QUE PELO payment_token, E NÃO PELO analysis_id
--
-- O checkout recebe os dois na URL. Seria mais curto ler pelo analysis_id, mas
-- esse id também está no link do relatório (scan.vertix.studio/analise/<id>) —
-- link que o lojista manda para sócio, agência e grupo de WhatsApp. Quem
-- recebesse o relatório encaminhado passaria a poder ler o e-mail e o telefone
-- de quem pediu a análise.
--
-- O payment_token não: ele nasce na scan-comprar, vai só para a URL de
-- pagamento daquele comprador, e já é hoje a chave de public.get_payment_info
-- — que devolve nome e e-mail do cliente para anon exatamente assim. Ou seja,
-- esta função não abre porta nova: usa a que já existe, acrescentando o
-- telefone, e mantém a exposição presa a quem tem o link de pagamento.
--
-- Sem linha, devolve NULL em vez de levantar exceção (ao contrário da
-- get_payment_info): preencher é conveniência. Token velho, errado ou compra
-- apagada tem que resultar em formulário vazio, nunca em checkout quebrado.
-- ---------------------------------------------------------------------------

create or replace function public.get_checkout_prefill(p_token uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'nome', c.nome,
    'email', c.email,
    -- E.164 como o Scan gravou (+5562999999999); quem formata é a tela.
    'whatsapp', c.telefone
  )
  from public.receivables r
  join public.clients c on c.id = r.client_id
  where r.payment_token = p_token
  limit 1;
$$;

comment on function public.get_checkout_prefill(uuid) is
  'Nome, e-mail e telefone do comprador de uma cobrança, para o checkout público preencher o formulário. Chave é o payment_token (mesma de get_payment_info), nunca o analysis_id. Devolve NULL quando o token não casa.';

grant execute on function public.get_checkout_prefill(uuid) to anon, authenticated;
