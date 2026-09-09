-- creditar_creditos() gravava sempre 'AJUSTE_MANUAL' em creditos_movimentos.tipo_operacao,
-- mesmo quando o crédito vem de renovação automática de assinatura (Stripe) -- ledger
-- financeiro precisa distinguir "plataforma corrigiu manualmente" de "assinatura pagou e
-- creditou sozinha" (docs/SEGURANCA.md §6, dado financeiro auditável).
--
-- CREATE OR REPLACE com novo parâmetro no FINAL e com DEFAULT -- chamadas existentes
-- (sem o 4º argumento) continuam funcionando exatamente como antes, comportamento
-- backward-compatible.
create or replace function creditar_creditos(
  p_contador_id uuid,
  p_quantidade integer,
  p_motivo text,
  p_tipo_operacao text default 'AJUSTE_MANUAL'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo_atual integer;
  v_saldo_novo integer;
begin
  if p_quantidade <= 0 then
    raise exception 'Quantidade a creditar deve ser positiva (recebido: %)', p_quantidade;
  end if;

  select saldo_atual into v_saldo_atual
  from creditos_saldo
  where contador_id = p_contador_id
  for update;

  if v_saldo_atual is null then
    insert into creditos_saldo (contador_id, saldo_atual) values (p_contador_id, 0);
    v_saldo_atual := 0;
  end if;

  v_saldo_novo := v_saldo_atual + p_quantidade;

  update creditos_saldo set saldo_atual = v_saldo_novo, atualizado_em = now()
  where contador_id = p_contador_id;

  insert into creditos_movimentos (contador_id, empresa_id, tipo_operacao, quantidade, saldo_antes, saldo_depois, motivo)
  values (p_contador_id, null, p_tipo_operacao, p_quantidade, v_saldo_atual, v_saldo_novo, p_motivo);

  return v_saldo_novo;
end;
$$;

comment on function creditar_creditos(uuid, integer, text, text) is 'Crédito/ajuste atômico -- cria o registro de saldo na primeira concessão se ainda não existir. tipo_operacao default AJUSTE_MANUAL (admin); assinaturas/ usa RENOVACAO_ASSINATURA.';
