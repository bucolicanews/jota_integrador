-- Identidade e hierarquia: papeis (RBAC), contadores, empresas, usuarios
-- Ver docs/BANCO_DE_DADOS.md §1 e docs/SEGURANCA.md §4.

-- ============================================================
-- RBAC: catálogo fixo de papéis (docs/BANCO_DE_DADOS.md §Papéis do catálogo fixo)
-- ============================================================

create table papeis (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  escopo text not null check (escopo in ('plataforma', 'contador', 'empresa')),
  descricao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table papeis is 'Catálogo fixo de papéis (RBAC) -- não customizável por tenant, decisão de 2026-09-06.';

create trigger trg_set_atualizado_em before update on papeis
  for each row execute function set_atualizado_em();

create table permissoes (
  id uuid primary key default gen_random_uuid(),
  recurso text not null,
  acao text not null check (acao in ('visualizar', 'criar', 'editar', 'excluir', 'bloquear')),
  chave text generated always as (recurso || ':' || acao) stored,
  criado_em timestamptz not null default now(),
  unique (recurso, acao)
);

create table papel_permissoes (
  papel_id uuid not null references papeis(id) on delete cascade,
  permissao_id uuid not null references permissoes(id) on delete cascade,
  primary key (papel_id, permissao_id)
);

insert into papeis (nome, escopo, descricao) values
  ('SUPER_ADMIN', 'plataforma', 'Acesso total, inclusive rotação do certificado da plataforma'),
  ('ADMIN_FINANCEIRO', 'plataforma', 'Gerencia planos, faturas, pagamentos e comissão -- não bloqueia contador/empresa'),
  ('ADMIN_SUPORTE', 'plataforma', 'Visão ampla para atendimento -- não mexe em créditos/financeiro'),
  ('CONTADOR_DONO', 'contador', 'Dono do escritório, gerencia carteira inteira e equipe própria'),
  ('OPERADOR_CONTADOR', 'contador', 'Funcionário do escritório, sem gerenciar equipe/financeiro do contador'),
  ('EMPRESARIO_DONO', 'empresa', 'Dono da empresa cliente, acesso completo aos próprios dados'),
  ('OPERADOR_EMPRESA', 'empresa', 'Funcionário da empresa cliente, acesso restrito (ex: só Caixa Postal/documentos)');

-- ============================================================
-- Contadores
-- ============================================================

create table contadores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj_cpf text not null,
  email text not null,
  telefone text,
  tipo text not null default 'humano' check (tipo in ('humano', 'interno_jota')),
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  bloqueado boolean not null default false,
  bloqueado_em timestamptz,
  bloqueado_motivo text,
  bloqueado_por uuid, -- FK para usuarios, adicionada depois de usuarios existir
  stripe_customer_id text,
  stripe_account_id text,
  stripe_charges_enabled boolean not null default false,
  stripe_payouts_enabled boolean not null default false,
  stripe_details_submitted boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on column contadores.tipo is 'interno_jota = fallback para empresa sem contador humano (toda empresa precisa de um contador -- docs/BANCO_DE_DADOS.md).';

create trigger trg_set_atualizado_em before update on contadores
  for each row execute function set_atualizado_em();

-- ============================================================
-- Empresas
-- ============================================================

create table empresas (
  id uuid primary key default gen_random_uuid(),
  contador_id uuid not null references contadores(id),
  razao_social text not null,
  nome_fantasia text,
  cnpj text not null unique,
  regime_tributario text,
  modo_acesso_serpro text not null check (modo_acesso_serpro in ('procuracao', 'certificado_proprio')),
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  bloqueado boolean not null default false,
  bloqueado_em timestamptz,
  bloqueado_motivo text,
  bloqueado_por uuid, -- FK para usuarios, adicionada depois
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_empresas_contador_id on empresas(contador_id);

create trigger trg_set_atualizado_em before update on empresas
  for each row execute function set_atualizado_em();

-- ============================================================
-- Usuarios (perfil -- credenciais reais em auth.users, Supabase Auth)
-- ============================================================

create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  papel_id uuid not null references papeis(id),
  contador_id uuid references contadores(id),
  empresa_id uuid references empresas(id),
  mfa_habilitado boolean not null default false,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  bloqueado boolean not null default false,
  bloqueado_em timestamptz,
  bloqueado_motivo text,
  bloqueado_por uuid references usuarios(id),
  ultimo_login_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint chk_escopo_papel_vinculo check (
    -- coerência entre escopo do papel e os vínculos preenchidos é validada também
    -- na Application layer (NestJS) -- esta constraint é só uma rede de segurança
    -- básica (não valida o escopo do papel_id em si, isso exigiria trigger).
    not (contador_id is not null and empresa_id is not null)
  )
);

create index idx_usuarios_contador_id on usuarios(contador_id);
create index idx_usuarios_empresa_id on usuarios(empresa_id);
create index idx_usuarios_papel_id on usuarios(papel_id);

create trigger trg_set_atualizado_em before update on usuarios
  for each row execute function set_atualizado_em();

-- FKs adiadas (dependência circular contadores/empresas <-> usuarios)
alter table contadores add constraint fk_contadores_bloqueado_por
  foreign key (bloqueado_por) references usuarios(id);

alter table empresas add constraint fk_empresas_bloqueado_por
  foreign key (bloqueado_por) references usuarios(id);

-- Trigger de proteção: só a plataforma pode alterar campos sensíveis de contadores
-- (bloqueio e configuração Stripe) -- defesa em profundidade além da RLS de UPDATE.
create or replace function protege_campos_sensiveis_contador()
returns trigger
language plpgsql
as $$
begin
  if not eh_plataforma() then
    if new.bloqueado is distinct from old.bloqueado
       or new.tipo is distinct from old.tipo
       or new.stripe_account_id is distinct from old.stripe_account_id
       or new.stripe_charges_enabled is distinct from old.stripe_charges_enabled
       or new.stripe_payouts_enabled is distinct from old.stripe_payouts_enabled
       or new.stripe_details_submitted is distinct from old.stripe_details_submitted
    then
      raise exception 'Apenas a equipe da plataforma pode alterar estes campos de contadores';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_protege_campos_sensiveis_contador
  before update on contadores
  for each row execute function protege_campos_sensiveis_contador();

-- Mesma proteção para empresas: só plataforma ou o contador dono podem bloquear/mudar
-- o modo de acesso SERPRO; ninguém (nem contador) pode mudar contador_id (transferência
-- de carteira é operação de infraestrutura, não CRUD comum).
create or replace function protege_campos_sensiveis_empresa()
returns trigger
language plpgsql
as $$
begin
  if new.contador_id is distinct from old.contador_id and not eh_plataforma() then
    raise exception 'Transferência de empresa entre contadores só pode ser feita pela plataforma';
  end if;
  if not eh_plataforma() and not (auth_contador_id() = old.contador_id) then
    if new.bloqueado is distinct from old.bloqueado
       or new.modo_acesso_serpro is distinct from old.modo_acesso_serpro
    then
      raise exception 'Apenas a plataforma ou o contador dono podem alterar estes campos';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_protege_campos_sensiveis_empresa
  before update on empresas
  for each row execute function protege_campos_sensiveis_empresa();

-- Proteção em usuarios: ninguém além da plataforma ou de quem tem autoridade sobre o
-- usuário (contador dono da carteira, ou o próprio contador sobre um OPERADOR_CONTADOR)
-- pode mudar papel_id/contador_id/empresa_id/bloqueado.
create or replace function protege_campos_sensiveis_usuario()
returns trigger
language plpgsql
as $$
begin
  if new.papel_id is distinct from old.papel_id
     or new.contador_id is distinct from old.contador_id
     or new.empresa_id is distinct from old.empresa_id
     or new.bloqueado is distinct from old.bloqueado
  then
    if not (
      eh_plataforma()
      or (auth_contador_id() is not null and auth_contador_id() = old.contador_id)
      or (auth_contador_id() is not null and old.empresa_id in (select id from empresas where contador_id = auth_contador_id()))
    ) then
      raise exception 'Sem autoridade para alterar papel/vínculo/bloqueio deste usuário';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_protege_campos_sensiveis_usuario
  before update on usuarios
  for each row execute function protege_campos_sensiveis_usuario();

-- Funções de posse reutilizadas pelas migrations seguintes (dependem de `empresas`
-- já existir, por isso ficam aqui e não em 0001).

-- SECURITY DEFINER é obrigatório aqui: esta função é usada dentro da própria policy
-- de SELECT de `empresas` (empresas_select). Sem SECURITY DEFINER, a subquery abaixo
-- reavaliaria empresas_select para a mesma linha, causando recursão infinita de RLS.
-- Rodando como owner (que tem bypassrls sobre suas próprias tabelas), a subquery lê
-- direto, sem reentrar na policy.
create or replace function pode_acessar_empresa(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    eh_plataforma()
    or auth_empresa_id() = p_empresa_id
    or auth_contador_id() = (select contador_id from empresas where id = p_empresa_id)
$$;

create or replace function pode_acessar_contador(p_contador_id uuid)
returns boolean
language sql
stable
as $$
  select eh_plataforma() or auth_contador_id() = p_contador_id
$$;

comment on function pode_acessar_empresa(uuid) is 'True se o usuário autenticado (plataforma, contador dono, ou usuário da própria empresa) pode acessar dados dessa empresa.';
comment on function pode_acessar_contador(uuid) is 'True se o usuário autenticado (plataforma ou o próprio contador/equipe) pode acessar dados desse contador.';

-- ============================================================
-- RLS
-- ============================================================

alter table papeis enable row level security;
alter table permissoes enable row level security;
alter table papel_permissoes enable row level security;
alter table contadores enable row level security;
alter table empresas enable row level security;
alter table usuarios enable row level security;

-- papeis / permissoes / papel_permissoes: catálogo fixo, leitura geral, escrita só SUPER_ADMIN
create policy papeis_select on papeis for select to authenticated using (true);
create policy papeis_insert on papeis for insert to authenticated with check (eh_super_admin());
create policy papeis_update on papeis for update to authenticated using (eh_super_admin()) with check (eh_super_admin());
create policy papeis_delete on papeis for delete to authenticated using (false);

create policy permissoes_select on permissoes for select to authenticated using (true);
create policy permissoes_insert on permissoes for insert to authenticated with check (eh_super_admin());
create policy permissoes_update on permissoes for update to authenticated using (eh_super_admin()) with check (eh_super_admin());
create policy permissoes_delete on permissoes for delete to authenticated using (eh_super_admin());

create policy papel_permissoes_select on papel_permissoes for select to authenticated using (true);
create policy papel_permissoes_insert on papel_permissoes for insert to authenticated with check (eh_super_admin());
create policy papel_permissoes_delete on papel_permissoes for delete to authenticated using (eh_super_admin());

-- contadores
create policy contadores_select on contadores for select to authenticated using (
  eh_plataforma()
  or id = auth_contador_id()
  or id = (select contador_id from empresas where id = auth_empresa_id())
);
create policy contadores_insert on contadores for insert to authenticated with check (eh_plataforma());
create policy contadores_update on contadores for update to authenticated
  using (eh_plataforma() or id = auth_contador_id())
  with check (eh_plataforma() or id = auth_contador_id());
create policy contadores_delete on contadores for delete to authenticated using (false); -- nunca hard delete, usar status='inativo'

-- empresas
create policy empresas_select on empresas for select to authenticated using (pode_acessar_empresa(id));
create policy empresas_insert on empresas for insert to authenticated with check (
  eh_plataforma() or contador_id = auth_contador_id()
);
create policy empresas_update on empresas for update to authenticated
  using (pode_acessar_empresa(id))
  with check (pode_acessar_empresa(id));
create policy empresas_delete on empresas for delete to authenticated using (false); -- nunca hard delete, usar status='inativo'

-- usuarios
create policy usuarios_select on usuarios for select to authenticated using (
  id = auth.uid()
  or eh_plataforma()
  or (auth_contador_id() is not null and contador_id = auth_contador_id())
  or (auth_contador_id() is not null and empresa_id in (select e.id from empresas e where e.contador_id = auth_contador_id()))
  or (auth_empresa_id() is not null and empresa_id = auth_empresa_id())
);
create policy usuarios_insert on usuarios for insert to authenticated with check (
  eh_plataforma()
  or (auth_contador_id() is not null and (contador_id = auth_contador_id() or empresa_id in (select id from empresas where contador_id = auth_contador_id())))
  or (auth_empresa_id() is not null and empresa_id = auth_empresa_id())
);
create policy usuarios_update on usuarios for update to authenticated
  using (
    id = auth.uid()
    or eh_plataforma()
    or (auth_contador_id() is not null and (contador_id = auth_contador_id() or empresa_id in (select id from empresas where contador_id = auth_contador_id())))
  )
  with check (
    id = auth.uid()
    or eh_plataforma()
    or (auth_contador_id() is not null and (contador_id = auth_contador_id() or empresa_id in (select id from empresas where contador_id = auth_contador_id())))
  );
create policy usuarios_delete on usuarios for delete to authenticated using (false); -- nunca hard delete, usar bloqueado/status
