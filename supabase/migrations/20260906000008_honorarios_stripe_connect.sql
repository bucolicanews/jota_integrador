-- Honorários -- empresa paga o contador, Jota comissiona (Stripe Connect)
-- docs/BANCO_DE_DADOS.md §7, docs/SEGURANCA.md §7.
-- Colunas Stripe Connect de `contadores` (stripe_account_id, stripe_charges_enabled,
-- stripe_payouts_enabled, stripe_details_submitted) já foram criadas em 0002.

-- ============================================================
-- Configuração global (comissão fixa da Jota)
-- ============================================================

create table configuracoes_plataforma (
  id integer primary key default 1 check (id = 1), -- singleton: uma linha só
  comissao_honorarios_pct numeric(5,2) not null check (comissao_honorarios_pct >= 0 and comissao_honorarios_pct <= 100),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references usuarios(id)
);

comment on table configuracoes_plataforma is 'Singleton -- comissão fixa e global de honorários (decisão de 2026-09-06). Editável só por SUPER_ADMIN/ADMIN_FINANCEIRO.';

insert into configuracoes_plataforma (id, comissao_honorarios_pct) values (1, 5.00);

create or replace function set_atualizado_por()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_por = auth.uid();
  return new;
end;
$$;

create trigger trg_set_atualizado_por before update on configuracoes_plataforma
  for each row execute function set_atualizado_por();

create trigger trg_set_atualizado_em before update on configuracoes_plataforma
  for each row execute function set_atualizado_em();

-- Toda mudança de comissão gera auditoria automaticamente (parâmetro financeiro
-- que afeta toda cobrança nova a partir da alteração -- docs/SEGURANCA.md §7).
create or replace function audita_mudanca_comissao_plataforma()
returns trigger
language plpgsql
as $$
begin
  insert into logs_auditoria (usuario_id, acao, recurso, dados_antigos, dados_novos)
  values (
    auth.uid(),
    'atualizar',
    'configuracoes_plataforma',
    jsonb_build_object('comissao_honorarios_pct', old.comissao_honorarios_pct),
    jsonb_build_object('comissao_honorarios_pct', new.comissao_honorarios_pct)
  );
  return new;
end;
$$;

create trigger trg_audita_mudanca_comissao_plataforma
  after update on configuracoes_plataforma
  for each row
  when (old.comissao_honorarios_pct is distinct from new.comissao_honorarios_pct)
  execute function audita_mudanca_comissao_plataforma();

-- ============================================================
-- Cobranças de honorário (destination charge)
-- ============================================================

create table cobrancas_honorarios (
  id uuid primary key default gen_random_uuid(),
  contador_id uuid not null references contadores(id),
  empresa_id uuid not null references empresas(id),
  descricao text not null,
  valor numeric(12,2) not null check (valor > 0),
  comissao_pct numeric(5,2) not null,
  comissao_valor numeric(12,2) not null,
  stripe_payment_intent_id text,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'falhou', 'estornado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  pago_em timestamptz
);

comment on column cobrancas_honorarios.comissao_pct is 'Congelado no momento da criação (trigger definir_comissao_honorario) -- nunca recalculado se a comissão global mudar depois.';

create index idx_cobrancas_honorarios_contador_id on cobrancas_honorarios(contador_id);
create index idx_cobrancas_honorarios_empresa_id on cobrancas_honorarios(empresa_id);

create trigger trg_set_atualizado_em before update on cobrancas_honorarios
  for each row execute function set_atualizado_em();

-- Isolamento: a empresa cobrada precisa pertencer à carteira do contador que está
-- cobrando (docs/SEGURANCA.md §7) -- checado antes de qualquer outra coisa.
create or replace function valida_posse_cobranca_honorario()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from empresas where id = new.empresa_id and contador_id = new.contador_id
  ) then
    raise exception 'A empresa informada não pertence à carteira deste contador';
  end if;
  return new;
end;
$$;

create trigger trg_valida_posse_cobranca_honorario
  before insert on cobrancas_honorarios
  for each row execute function valida_posse_cobranca_honorario();

-- Comissão nunca vem do cliente -- sempre recalculada a partir da config global no
-- momento da criação, e congelada dali em diante (docs/SEGURANCA.md §7).
-- SECURITY DEFINER é obrigatório: configuracoes_plataforma só é visível via RLS pra
-- eh_plataforma(), mas um CONTADOR também pode disparar a criação de uma cobrança
-- (cobrancas_honorarios_insert permite contador_id = auth_contador_id()). Sem
-- SECURITY DEFINER, a leitura abaixo retornaria NULL pra esse caller e quebraria a
-- constraint NOT NULL de comissao_pct.
create or replace function definir_comissao_honorario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comissao_pct numeric(5,2);
begin
  select comissao_honorarios_pct into v_comissao_pct from configuracoes_plataforma where id = 1;
  new.comissao_pct := v_comissao_pct;
  new.comissao_valor := round(new.valor * v_comissao_pct / 100.0, 2);
  return new;
end;
$$;

create trigger trg_definir_comissao_honorario
  before insert on cobrancas_honorarios
  for each row execute function definir_comissao_honorario();

-- Depois de criada, só o backend/plataforma (via webhook Stripe) pode mudar status/
-- stripe_payment_intent_id/pago_em -- contador não pode se "auto-marcar" como pago.
create or replace function protege_campos_cobranca_honorario()
returns trigger
language plpgsql
as $$
begin
  if not eh_plataforma() then
    if new.status is distinct from old.status
       or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
       or new.pago_em is distinct from old.pago_em
       or new.comissao_pct is distinct from old.comissao_pct
       or new.comissao_valor is distinct from old.comissao_valor
    then
      raise exception 'Apenas a plataforma (via webhook Stripe) pode alterar status/comissão de uma cobrança';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_protege_campos_cobranca_honorario
  before update on cobrancas_honorarios
  for each row execute function protege_campos_cobranca_honorario();

-- ============================================================
-- RLS
-- ============================================================

alter table configuracoes_plataforma enable row level security;
alter table cobrancas_honorarios enable row level security;

-- configuracoes_plataforma: só a plataforma vê/edita (margem interna, não é dado do
-- contador/empresa).
create policy configuracoes_plataforma_select on configuracoes_plataforma for select to authenticated using (eh_plataforma());
create policy configuracoes_plataforma_update on configuracoes_plataforma for update to authenticated
  using (eh_super_admin() or auth_papel() = 'ADMIN_FINANCEIRO')
  with check (eh_super_admin() or auth_papel() = 'ADMIN_FINANCEIRO');
create policy configuracoes_plataforma_insert on configuracoes_plataforma for insert to authenticated with check (false); -- singleton, só via seed/migration
create policy configuracoes_plataforma_delete on configuracoes_plataforma for delete to authenticated using (false);

-- cobrancas_honorarios: os dois lados (contador que cobra, empresa que paga) enxergam;
-- só o contador dono cria; só a plataforma muda status depois de criada.
create policy cobrancas_honorarios_select on cobrancas_honorarios for select to authenticated using (
  pode_acessar_contador(contador_id) or pode_acessar_empresa(empresa_id)
);
create policy cobrancas_honorarios_insert on cobrancas_honorarios for insert to authenticated with check (
  eh_plataforma() or contador_id = auth_contador_id()
);
create policy cobrancas_honorarios_update on cobrancas_honorarios for update to authenticated
  using (eh_plataforma() or contador_id = auth_contador_id())
  with check (eh_plataforma() or contador_id = auth_contador_id());
create policy cobrancas_honorarios_delete on cobrancas_honorarios for delete to authenticated using (false); -- nunca hard delete, usar status='estornado'
