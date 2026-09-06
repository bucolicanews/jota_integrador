-- Acesso ao SERPRO -- dois modos (docs/SEGURANCA.md §1-2, docs/BANCO_DE_DADOS.md §2)

-- ============================================================
-- Modo A: procuração eletrônica
-- ============================================================

create table procuracoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  status text not null default 'pendente' check (status in ('ativa', 'expirada', 'revogada', 'pendente')),
  outorgada_em timestamptz,
  expira_em timestamptz,
  revogada_em timestamptz,
  verificado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table procuracoes is 'Status da procuração eletrônica outorgada pela empresa à Jota (e-CAC/gov.br). Sincronizado a partir do serviço PROCURACOES do SERPRO -- não é algo que o usuário declara diretamente.';

create index idx_procuracoes_empresa_id on procuracoes(empresa_id);

create trigger trg_set_atualizado_em before update on procuracoes
  for each row execute function set_atualizado_em();

-- ============================================================
-- Modo B: certificado digital próprio da empresa
-- ============================================================

create table certificados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  tipo text not null check (tipo in ('A1', 'A3')),
  arquivo_ref text not null, -- referência ao cofre/Secret Manager, nunca o dado em claro
  senha_ref text not null,   -- idem
  validade_inicio date,
  validade_fim date not null,
  status text not null default 'ativo' check (status in ('ativo', 'expirado', 'revogado', 'substituido')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table certificados is 'Certificado digital PRÓPRIO da empresa (Modo B). O certificado único da plataforma (Modo A, e-CNPJ da Jota) NÃO fica aqui -- vive só em Secret Manager (docs/SEGURANCA.md §1).';
comment on column certificados.arquivo_ref is 'Ponteiro para o cofre/Secret Manager -- nunca o certificado em si.';
comment on column certificados.senha_ref is 'Ponteiro para o cofre/Secret Manager -- nunca a senha em claro.';

create index idx_certificados_empresa_id on certificados(empresa_id);

create trigger trg_set_atualizado_em before update on certificados
  for each row execute function set_atualizado_em();

-- ============================================================
-- RLS
-- ============================================================

alter table procuracoes enable row level security;
alter table certificados enable row level security;

-- procuracoes: status vem de sincronização com o SERPRO -- leitura ampla (quem acessa a
-- empresa), escrita só pela plataforma (isto é, pelo processo de sincronização do
-- backend, que roda com privilégio elevado; RLS aqui é defesa em profundidade).
create policy procuracoes_select on procuracoes for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy procuracoes_insert on procuracoes for insert to authenticated with check (eh_plataforma());
create policy procuracoes_update on procuracoes for update to authenticated using (eh_plataforma()) with check (eh_plataforma());
create policy procuracoes_delete on procuracoes for delete to authenticated using (false);

-- certificados: quem administra o SERPRO da empresa (contador dono ou usuário da própria
-- empresa) pode cadastrar/rotacionar; nunca outra empresa/contador.
create policy certificados_select on certificados for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy certificados_insert on certificados for insert to authenticated with check (pode_acessar_empresa(empresa_id));
create policy certificados_update on certificados for update to authenticated
  using (pode_acessar_empresa(empresa_id))
  with check (pode_acessar_empresa(empresa_id));
create policy certificados_delete on certificados for delete to authenticated using (false); -- nunca hard delete, usar status='substituido'/'revogado'
