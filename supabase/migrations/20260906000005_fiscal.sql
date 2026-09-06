-- Integração SERPRO e dados fiscais (docs/BANCO_DE_DADOS.md §4)

create table consultas_serpro (
  id uuid primary key default gen_random_uuid(),
  contador_id uuid not null references contadores(id),
  empresa_id uuid not null references empresas(id),
  id_sistema text not null,
  id_servico text not null,
  sucesso boolean not null,
  codigo_erro text,
  creditos_consumidos integer not null default 0 check (creditos_consumidos >= 0),
  criado_em timestamptz not null default now()
);

comment on table consultas_serpro is 'Log de toda chamada ao SERPRO (sem payload sensível bruto) -- liga consumo de crédito ao resultado da chamada.';

create index idx_consultas_serpro_contador_id on consultas_serpro(contador_id);
create index idx_consultas_serpro_empresa_id on consultas_serpro(empresa_id);

create table documentos_fiscais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  tipo text not null check (tipo in ('NFe', 'NFCe', 'CTe', 'NFSe')),
  numero text not null,
  chave_acesso text,
  valor_total numeric(14,2) not null check (valor_total >= 0),
  data_emissao date not null,
  situacao text not null,
  xml_ref text, -- referência ao storage, não o XML inteiro na tabela
  criado_em timestamptz not null default now()
);

comment on table documentos_fiscais is 'documentos_fiscais_itens (NCM/CFOP/CST por linha) fica fora do MVP -- Fase 2 (docs/BANCO_DE_DADOS.md §4).';

create index idx_documentos_fiscais_empresa_id on documentos_fiscais(empresa_id);

create table declaracoes_pgdas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  competencia date not null,
  receita_bruta numeric(14,2) not null check (receita_bruta >= 0),
  valor_das numeric(14,2) not null check (valor_das >= 0),
  status text not null,
  vencimento date not null,
  criado_em timestamptz not null default now()
);

comment on table declaracoes_pgdas is 'Fase 3 (Simples Nacional) -- schema já cabe desde já, sem impacto no resto.';

create index idx_declaracoes_pgdas_empresa_id on declaracoes_pgdas(empresa_id);

-- ============================================================
-- RLS
-- ============================================================

alter table consultas_serpro enable row level security;
alter table documentos_fiscais enable row level security;
alter table declaracoes_pgdas enable row level security;

-- consultas_serpro: log só de leitura pra quem acessa a empresa; escrita só backend/plataforma
create policy consultas_serpro_select on consultas_serpro for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy consultas_serpro_insert on consultas_serpro for insert to authenticated with check (eh_plataforma());
create policy consultas_serpro_update on consultas_serpro for update to authenticated using (false);
create policy consultas_serpro_delete on consultas_serpro for delete to authenticated using (false);

-- documentos_fiscais: importados do SERPRO -- leitura pra quem acessa a empresa,
-- escrita só backend/plataforma (o processo de importação, não o usuário final).
create policy documentos_fiscais_select on documentos_fiscais for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy documentos_fiscais_insert on documentos_fiscais for insert to authenticated with check (eh_plataforma());
create policy documentos_fiscais_update on documentos_fiscais for update to authenticated using (eh_plataforma()) with check (eh_plataforma());
create policy documentos_fiscais_delete on documentos_fiscais for delete to authenticated using (false);

-- declaracoes_pgdas: mesma lógica de documentos_fiscais (sincronizado do SERPRO)
create policy declaracoes_pgdas_select on declaracoes_pgdas for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy declaracoes_pgdas_insert on declaracoes_pgdas for insert to authenticated with check (eh_plataforma());
create policy declaracoes_pgdas_update on declaracoes_pgdas for update to authenticated using (eh_plataforma()) with check (eh_plataforma());
create policy declaracoes_pgdas_delete on declaracoes_pgdas for delete to authenticated using (false);
