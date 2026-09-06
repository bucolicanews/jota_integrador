-- Assinatura SaaS: contador paga a Jota pelo plano de créditos SERPRO
-- Sem Stripe Connect aqui -- Jota é a única recebedora (docs/BANCO_DE_DADOS.md §3).

create table planos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  operacoes_incluidas integer not null check (operacoes_incluidas >= 0),
  preco numeric(12,2) not null check (preco >= 0),
  periodicidade text not null check (periodicidade in ('mensal', 'anual')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger trg_set_atualizado_em before update on planos
  for each row execute function set_atualizado_em();

create table assinaturas (
  id uuid primary key default gen_random_uuid(),
  contador_id uuid not null references contadores(id),
  plano_id uuid not null references planos(id),
  stripe_subscription_id text,
  status text not null default 'ativa' check (status in ('ativa', 'cancelada', 'inadimplente')),
  inicio_em timestamptz not null default now(),
  fim_em timestamptz,
  renovacao_automatica boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_assinaturas_contador_id on assinaturas(contador_id);

create trigger trg_set_atualizado_em before update on assinaturas
  for each row execute function set_atualizado_em();

create table creditos_saldo (
  contador_id uuid primary key references contadores(id),
  saldo_atual integer not null default 0 check (saldo_atual >= 0),
  atualizado_em timestamptz not null default now()
);

comment on table creditos_saldo is 'Cache mutável do saldo corrente do contador. Fonte da verdade auditável é creditos_movimentos.';

create trigger trg_set_atualizado_em before update on creditos_saldo
  for each row execute function set_atualizado_em();

create table creditos_movimentos (
  id uuid primary key default gen_random_uuid(),
  contador_id uuid not null references contadores(id),
  empresa_id uuid not null references empresas(id),
  tipo_operacao text not null,
  quantidade integer not null,
  saldo_antes integer not null,
  saldo_depois integer not null,
  motivo text,
  criado_em timestamptz not null default now()
);

comment on table creditos_movimentos is 'Ledger IMUTÁVEL de consumo/ajuste de créditos (docs/SEGURANCA.md §6). Nunca UPDATE/DELETE -- só INSERT.';

create index idx_creditos_movimentos_contador_id on creditos_movimentos(contador_id);
create index idx_creditos_movimentos_empresa_id on creditos_movimentos(empresa_id);

create table faturas (
  id uuid primary key default gen_random_uuid(),
  contador_id uuid not null references contadores(id),
  assinatura_id uuid not null references assinaturas(id),
  stripe_invoice_id text,
  valor numeric(12,2) not null check (valor >= 0),
  competencia date not null,
  vencimento date not null,
  status text not null default 'pendente' check (status in ('pendente', 'paga', 'atrasada', 'cancelada')),
  pago_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_faturas_contador_id on faturas(contador_id);

create trigger trg_set_atualizado_em before update on faturas
  for each row execute function set_atualizado_em();

create table webhook_eventos_processados (
  id uuid primary key default gen_random_uuid(),
  gateway text not null,
  evento_id text not null,
  processado_em timestamptz not null default now(),
  unique (gateway, evento_id)
);

comment on table webhook_eventos_processados is 'Idempotência genérica de webhook (Stripe e futuros gateways) -- compartilhada entre assinatura SaaS e honorários (0008). Todo handler checa aqui antes de aplicar efeito.';

-- ============================================================
-- RLS
-- ============================================================

alter table planos enable row level security;
alter table assinaturas enable row level security;
alter table creditos_saldo enable row level security;
alter table creditos_movimentos enable row level security;
alter table faturas enable row level security;
alter table webhook_eventos_processados enable row level security;

-- planos: catálogo público de leitura (qualquer autenticado vê os planos disponíveis),
-- escrita só ADMIN_FINANCEIRO/SUPER_ADMIN.
create policy planos_select on planos for select to authenticated using (true);
create policy planos_insert on planos for insert to authenticated with check (eh_plataforma());
create policy planos_update on planos for update to authenticated using (eh_plataforma()) with check (eh_plataforma());
create policy planos_delete on planos for delete to authenticated using (false); -- usar ativo=false

-- assinaturas: contador vê a própria; escrita só plataforma/backend (via Stripe webhook)
create policy assinaturas_select on assinaturas for select to authenticated using (pode_acessar_contador(contador_id));
create policy assinaturas_insert on assinaturas for insert to authenticated with check (eh_plataforma());
create policy assinaturas_update on assinaturas for update to authenticated using (eh_plataforma()) with check (eh_plataforma());
create policy assinaturas_delete on assinaturas for delete to authenticated using (false);

-- creditos_saldo: contador só LÊ o próprio saldo -- nunca escreve direto (decrementar
-- crédito é sempre uma transação no backend, nunca um UPDATE livre pelo cliente).
create policy creditos_saldo_select on creditos_saldo for select to authenticated using (pode_acessar_contador(contador_id));
create policy creditos_saldo_insert on creditos_saldo for insert to authenticated with check (eh_plataforma());
create policy creditos_saldo_update on creditos_saldo for update to authenticated using (eh_plataforma()) with check (eh_plataforma());
create policy creditos_saldo_delete on creditos_saldo for delete to authenticated using (false);

-- creditos_movimentos: ledger imutável -- contador lê o próprio histórico, só INSERT
-- (nunca UPDATE/DELETE, nem pra plataforma).
create policy creditos_movimentos_select on creditos_movimentos for select to authenticated using (pode_acessar_contador(contador_id));
create policy creditos_movimentos_insert on creditos_movimentos for insert to authenticated with check (eh_plataforma());
create policy creditos_movimentos_update on creditos_movimentos for update to authenticated using (false);
create policy creditos_movimentos_delete on creditos_movimentos for delete to authenticated using (false);

-- faturas: contador lê as próprias; escrita só plataforma/backend (via Stripe webhook)
create policy faturas_select on faturas for select to authenticated using (pode_acessar_contador(contador_id));
create policy faturas_insert on faturas for insert to authenticated with check (eh_plataforma());
create policy faturas_update on faturas for update to authenticated using (eh_plataforma()) with check (eh_plataforma());
create policy faturas_delete on faturas for delete to authenticated using (false);

-- webhook_eventos_processados: uso interno do backend -- nenhuma policy permissiva pra
-- `authenticated` além de leitura de depuração pelo SUPER_ADMIN. Escrita real acontece
-- via service role (que ignora RLS), nunca pelo cliente autenticado comum.
create policy webhook_eventos_processados_select on webhook_eventos_processados for select to authenticated using (eh_super_admin());
