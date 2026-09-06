-- Funções de débito/crédito atômico (docs/SEGURANCA.md §6): "consumo de crédito e a
-- chamada que ele paga devem ser atômicos" -- fazer isso com duas chamadas separadas
-- do client JS (UPDATE creditos_saldo + INSERT creditos_movimentos) NÃO é atômico; se a
-- segunda falhar, sobra saldo alterado sem auditoria. Uma função Postgres com lock de
-- linha (FOR UPDATE) resolve isso de verdade, numa transação só.

-- Ajustes/créditos manuais (recarga de plano, correção administrativa) não estão
-- ligados a uma empresa específica -- diferente de débito por consumo, que sempre é.
alter table creditos_movimentos alter column empresa_id drop not null;

comment on column creditos_movimentos.empresa_id is 'Null para créditos/ajustes no nível do contador (recarga de plano, correção manual) -- sempre preenchido em débitos por consumo de uma empresa específica.';

comment on column creditos_movimentos.quantidade is 'Assinado: negativo = débito/consumo, positivo = crédito/ajuste.';

-- SECURITY DEFINER: a função implementa a regra de negócio (não pode ficar negativo,
-- sempre gera auditoria) e precisa funcionar independente de quem chama (authenticated
-- via backend, ou service_role) -- não deve ficar sujeita a RLS arbitrário de quem
-- invoca. Nenhuma tabela é acessível diretamente por fora dessas funções pra escrita.
create or replace function debitar_creditos(
  p_contador_id uuid,
  p_empresa_id uuid,
  p_tipo_operacao text,
  p_quantidade integer,
  p_motivo text
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
    raise exception 'Quantidade a debitar deve ser positiva (recebido: %)', p_quantidade;
  end if;
  if p_empresa_id is null then
    raise exception 'Débito de consumo sempre precisa de empresa_id';
  end if;

  -- Lock da linha -- concorrência (duas requisições simultâneas tentando debitar o
  -- mesmo contador) serializa aqui, nunca deixa o saldo ficar inconsistente
  -- (docs/SEGURANCA.md §6: "proteger contra fraude de consumo... race condition").
  select saldo_atual into v_saldo_atual
  from creditos_saldo
  where contador_id = p_contador_id
  for update;

  if v_saldo_atual is null then
    raise exception 'Contador % não possui registro de saldo de créditos (sem plano ativo?)', p_contador_id;
  end if;
  if v_saldo_atual < p_quantidade then
    raise exception 'Saldo insuficiente: disponível %, necessário %', v_saldo_atual, p_quantidade;
  end if;

  v_saldo_novo := v_saldo_atual - p_quantidade;

  update creditos_saldo set saldo_atual = v_saldo_novo, atualizado_em = now()
  where contador_id = p_contador_id;

  insert into creditos_movimentos (contador_id, empresa_id, tipo_operacao, quantidade, saldo_antes, saldo_depois, motivo)
  values (p_contador_id, p_empresa_id, p_tipo_operacao, -p_quantidade, v_saldo_atual, v_saldo_novo, p_motivo);

  return v_saldo_novo;
end;
$$;

create or replace function creditar_creditos(
  p_contador_id uuid,
  p_quantidade integer,
  p_motivo text
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
    -- Primeira concessão de créditos pro contador -- cria o registro em vez de exigir
    -- um passo de "provisionar saldo" separado antes da primeira recarga.
    insert into creditos_saldo (contador_id, saldo_atual) values (p_contador_id, 0);
    v_saldo_atual := 0;
  end if;

  v_saldo_novo := v_saldo_atual + p_quantidade;

  update creditos_saldo set saldo_atual = v_saldo_novo, atualizado_em = now()
  where contador_id = p_contador_id;

  insert into creditos_movimentos (contador_id, empresa_id, tipo_operacao, quantidade, saldo_antes, saldo_depois, motivo)
  values (p_contador_id, null, 'AJUSTE_MANUAL', p_quantidade, v_saldo_atual, v_saldo_novo, p_motivo);

  return v_saldo_novo;
end;
$$;

comment on function debitar_creditos(uuid, uuid, text, integer, text) is 'Débito atômico (lock + checagem de saldo + auditoria numa transação só). Lança exceção se saldo insuficiente -- nunca deixa ficar negativo.';
comment on function creditar_creditos(uuid, integer, text) is 'Crédito/ajuste atômico -- cria o registro de saldo na primeira concessão se ainda não existir.';
