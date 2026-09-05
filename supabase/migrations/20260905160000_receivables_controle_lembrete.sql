-- ============================================================================
-- Lembretes de cobrança: controle de reenvio
-- ============================================================================
-- A edge function payment-reminders buscava `status = pendente` com
-- `vencimento < hoje` e mandava e-mail. Como nada registrava o envio, toda
-- cobrança vencida era relembrada TODO DIA, para sempre — um cliente recebeu
-- dois e-mails por dia durante oito dias.
--
-- Com estas colunas a função passa a: avisar 3 dias antes (uma vez), e depois
-- do vencimento no máximo a cada 7 dias, parando em 4 lembretes.
-- ============================================================================

alter table public.receivables add column ultimo_lembrete_em timestamptz;
alter table public.receivables add column lembretes_enviados integer not null default 0;

comment on column public.receivables.ultimo_lembrete_em is
  'Último lembrete enviado ao cliente; base do intervalo mínimo entre reenvios.';
comment on column public.receivables.lembretes_enviados is
  'Quantos lembretes já saíram para esta cobrança (teto evita perseguição).';

-- As cobranças que já foram lembradas à exaustão entram com o contador cheio,
-- para não dispararem de novo assim que a correção subir.
update public.receivables
   set ultimo_lembrete_em = now(),
       lembretes_enviados = 4
 where status = 'pendente'
   and vencimento < current_date;
