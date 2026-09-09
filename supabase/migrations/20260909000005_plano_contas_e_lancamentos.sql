-- Módulo contábil (plano de contas + lançamentos em partida dobrada), primeiro módulo
-- minerado a partir do jotaCaixa (projeto legado, só leitura -- ver memória do usuário)
-- redesenhado pra corrigir a falha estrutural real que aquele projeto já sofreu na
-- prática: lançamentos lá eram linhas soltas (1 conta + tipo Entrada/Saida por linha,
-- correlacionadas só por um campo texto "documento"), sem nada no banco garantindo que
-- débito = crédito -- e houve um incidente real de saldo/balanço quebrado, restaurado
-- na mão (ver `jotaCaixa/INSTRUCOES_RESTAURACAO.md`). Aqui a escrita só acontece via
-- função SECURITY DEFINER que valida a partida dobrada inteira numa transação só --
-- nenhuma tabela aceita INSERT direto de `authenticated` (mesmo princípio de
-- `debitar_creditos`/`creditar_creditos`, migration 0011).

-- ============================================================
-- plano_contas
-- ============================================================

create table plano_contas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  codigo text not null,
  nome text not null,
  -- Classificação pelo grupo (equivalente ao 1º dígito do código no jotaCaixa) --
  -- guardada explícita em vez de derivada do código, pra não depender de convenção de
  -- string. Natureza de saldo (devedora/credora) é 100% derivada do grupo -- nunca
  -- campo próprio editável, é regra contábil fixa, não dado (mesmo princípio de nunca
  -- deixar o client definir o que é deriável, já usado em `comissao_pct` de honorários).
  grupo text not null check (grupo in ('ativo', 'passivo', 'patrimonio_liquido', 'receita', 'custo', 'despesa')),
  -- Sintética = agrupador (soma dos filhos), não aceita lançamento direto.
  -- Analítica = ponta da árvore, é nela que lançamentos apontam.
  sintetica boolean not null default false,
  conta_pai_id uuid references plano_contas(id),
  -- Flags de propósito especial -- usadas por conciliação bancária (#11) e contas a
  -- pagar/receber (futuro) pra saber em qual conta lançar automaticamente.
  conta_caixa_banco boolean not null default false,
  conta_a_receber boolean not null default false,
  conta_a_pagar boolean not null default false,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, codigo)
);

create index idx_plano_contas_empresa on plano_contas(empresa_id);
create index idx_plano_contas_pai on plano_contas(conta_pai_id);

create trigger trg_plano_contas_atualizado_em
  before update on plano_contas
  for each row execute function set_atualizado_em();

alter table plano_contas enable row level security;

create policy plano_contas_select on plano_contas for select to authenticated
  using (pode_acessar_empresa(empresa_id));

-- Só contador dono da empresa (ou plataforma) mexe no plano de contas -- é trabalho de
-- escritório contábil, não do empresário-cliente (mesmo padrão de
-- `exigirPosseDeContador` em empresas.controller: bloqueio de empresa também não é
-- self-service). Nunca DELETE -- desativar via `ativa = false` (update), preserva
-- histórico de lançamentos que já apontam pra essa conta.
create policy plano_contas_insert on plano_contas for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy plano_contas_update on plano_contas for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy plano_contas_delete on plano_contas for delete to authenticated using (false);

comment on table plano_contas is 'Plano de contas hierárquico por empresa. Natureza de saldo (devedora/credora) é derivada de `grupo` na aplicação, nunca armazenada.';
comment on column plano_contas.sintetica is 'true = conta agrupadora (não aceita lançamento direto); false = analítica (aceita).';

-- ============================================================
-- lancamentos_contabeis (cabeçalho) + lancamentos_partidas (linhas da partida dobrada)
-- ============================================================

create table lancamentos_contabeis (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  data_competencia date not null,
  historico text not null,
  -- Link opcional pra origem (ex: id de uma parcela de contas a pagar/receber, id de um
  -- contrato assinado) -- rastreabilidade, não FK tipada porque a origem varia por tipo.
  documento_referencia text,
  origem text not null check (origem in ('manual', 'contas_a_pagar', 'contas_a_receber', 'contrato', 'conciliacao_bancaria', 'estorno')),
  estornado boolean not null default false,
  -- Preenchido só quando ESTE lançamento é o estorno de outro -- nunca aponta pra si
  -- mesmo, nunca editado depois de criado.
  estorno_de_id uuid references lancamentos_contabeis(id),
  criado_por uuid not null references usuarios(id),
  criado_em timestamptz not null default now()
);

create table lancamentos_partidas (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid not null references lancamentos_contabeis(id),
  conta_id uuid not null references plano_contas(id),
  tipo text not null check (tipo in ('debito', 'credito')),
  valor numeric(14, 2) not null check (valor > 0)
);

create index idx_lancamentos_empresa on lancamentos_contabeis(empresa_id, data_competencia);
create index idx_lancamentos_documento on lancamentos_contabeis(documento_referencia);
create index idx_lancamentos_partidas_lancamento on lancamentos_partidas(lancamento_id);
create index idx_lancamentos_partidas_conta on lancamentos_partidas(conta_id);

alter table lancamentos_contabeis enable row level security;
alter table lancamentos_partidas enable row level security;

create policy lancamentos_contabeis_select on lancamentos_contabeis for select to authenticated
  using (pode_acessar_empresa(empresa_id));
-- Nenhum INSERT/UPDATE/DELETE direto para `authenticated` -- a única forma de criar um
-- lançamento é `criar_lancamento_contabil()` (valida débito=crédito numa transação só);
-- a única forma de desfazer é `estornar_lancamento_contabil()` (nunca UPDATE/DELETE em
-- lançamento já criado -- é isso que faltava no jotaCaixa e causou o incidente de
-- saldo). Ambas as funções são SECURITY DEFINER, bypassam RLS ao escrever.
create policy lancamentos_contabeis_insert on lancamentos_contabeis for insert to authenticated with check (false);
create policy lancamentos_contabeis_update on lancamentos_contabeis for update to authenticated using (false);
create policy lancamentos_contabeis_delete on lancamentos_contabeis for delete to authenticated using (false);

create policy lancamentos_partidas_select on lancamentos_partidas for select to authenticated
  using (pode_acessar_empresa((select empresa_id from lancamentos_contabeis where id = lancamento_id)));
create policy lancamentos_partidas_insert on lancamentos_partidas for insert to authenticated with check (false);
create policy lancamentos_partidas_update on lancamentos_partidas for update to authenticated using (false);
create policy lancamentos_partidas_delete on lancamentos_partidas for delete to authenticated using (false);

comment on table lancamentos_contabeis is 'Cabeçalho do lançamento contábil. Imutável após criado -- corrigir é sempre um estorno (novo lançamento), nunca UPDATE/DELETE.';
comment on table lancamentos_partidas is 'Linhas de débito/crédito de um lançamento -- sempre em conjunto, nunca uma linha solta (ver criar_lancamento_contabil).';

-- ============================================================
-- criar_lancamento_contabil: única porta de escrita, valida partida dobrada completa
-- ============================================================

create or replace function criar_lancamento_contabil(
  p_empresa_id uuid,
  p_data_competencia date,
  p_historico text,
  p_documento_referencia text,
  p_origem text,
  p_partidas jsonb, -- [{"conta_id": "...", "tipo": "debito"|"credito", "valor": 123.45}, ...]
  p_criado_por uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lancamento_id uuid;
  v_total_debito numeric(14, 2);
  v_total_credito numeric(14, 2);
  v_qtd_partidas integer;
  v_contas_invalidas integer;
  v_partida jsonb;
begin
  v_qtd_partidas := jsonb_array_length(p_partidas);
  if v_qtd_partidas < 2 then
    raise exception 'Lançamento precisa de ao menos 2 partidas (recebido: %)', v_qtd_partidas;
  end if;

  select
    coalesce(sum((p ->> 'valor')::numeric) filter (where p ->> 'tipo' = 'debito'), 0),
    coalesce(sum((p ->> 'valor')::numeric) filter (where p ->> 'tipo' = 'credito'), 0)
  into v_total_debito, v_total_credito
  from jsonb_array_elements(p_partidas) as p;

  if v_total_debito <> v_total_credito then
    raise exception 'Lançamento não fecha: débito % <> crédito %', v_total_debito, v_total_credito;
  end if;
  if v_total_debito <= 0 then
    raise exception 'Valor total do lançamento precisa ser maior que zero';
  end if;

  -- Toda conta citada precisa existir, pertencer à MESMA empresa do lançamento, estar
  -- ativa e ser analítica (sintética é só agrupador, não recebe lançamento direto).
  select count(*) into v_contas_invalidas
  from jsonb_array_elements(p_partidas) as p
  left join plano_contas pc on pc.id = (p ->> 'conta_id')::uuid
    and pc.empresa_id = p_empresa_id and pc.ativa and not pc.sintetica
  where pc.id is null;

  if v_contas_invalidas > 0 then
    raise exception 'Uma ou mais contas da partida são inválidas (não existem, não são desta empresa, estão inativas ou são sintéticas)';
  end if;

  insert into lancamentos_contabeis (empresa_id, data_competencia, historico, documento_referencia, origem, criado_por)
  values (p_empresa_id, p_data_competencia, p_historico, p_documento_referencia, p_origem, p_criado_por)
  returning id into v_lancamento_id;

  for v_partida in select * from jsonb_array_elements(p_partidas)
  loop
    insert into lancamentos_partidas (lancamento_id, conta_id, tipo, valor)
    values (v_lancamento_id, (v_partida ->> 'conta_id')::uuid, v_partida ->> 'tipo', (v_partida ->> 'valor')::numeric);
  end loop;

  return v_lancamento_id;
end;
$$;

comment on function criar_lancamento_contabil(uuid, date, text, text, text, jsonb, uuid) is 'Única forma de criar um lançamento -- valida partida dobrada (débito=crédito, contas analíticas da mesma empresa) numa transação só antes de gravar.';

-- ============================================================
-- estornar_lancamento_contabil: nunca edita/apaga o original, cria o inverso
-- ============================================================

create or replace function estornar_lancamento_contabil(
  p_lancamento_id uuid,
  p_motivo text,
  p_executado_por uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original record;
  v_novo_id uuid;
begin
  select * into v_original from lancamentos_contabeis where id = p_lancamento_id;

  if v_original is null then
    raise exception 'Lançamento % não encontrado', p_lancamento_id;
  end if;
  if v_original.estornado then
    raise exception 'Lançamento já foi estornado anteriormente';
  end if;

  insert into lancamentos_contabeis (empresa_id, data_competencia, historico, documento_referencia, origem, estorno_de_id, criado_por)
  values (v_original.empresa_id, current_date, 'Estorno: ' || v_original.historico || ' -- ' || p_motivo, v_original.documento_referencia, 'estorno', p_lancamento_id, p_executado_por)
  returning id into v_novo_id;

  -- Inverte débito<->credito de cada partida original, mesmo valor/conta.
  insert into lancamentos_partidas (lancamento_id, conta_id, tipo, valor)
  select v_novo_id, conta_id, case when tipo = 'debito' then 'credito' else 'debito' end, valor
  from lancamentos_partidas
  where lancamento_id = p_lancamento_id;

  update lancamentos_contabeis set estornado = true where id = p_lancamento_id;

  return v_novo_id;
end;
$$;

comment on function estornar_lancamento_contabil(uuid, text, uuid) is 'Cria um lançamento inverso (débito<->crédito trocados) e marca o original como estornado. Nunca edita/apaga o lançamento original -- rastro contábil completo preservado.';
