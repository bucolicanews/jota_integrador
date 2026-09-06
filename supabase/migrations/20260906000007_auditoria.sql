-- Auditoria (docs/BANCO_DE_DADOS.md §6, ARCHITECTURE_SECURITY_RULES 2.md §14)

create table logs_auditoria (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id),
  contador_id uuid references contadores(id),
  empresa_id uuid references empresas(id),
  acao text not null,
  recurso text not null,
  dados_antigos jsonb,
  dados_novos jsonb,
  ip text,
  user_agent text,
  criado_em timestamptz not null default now()
);

comment on table logs_auditoria is 'IMUTÁVEL -- só INSERT. Bloqueio de UPDATE/DELETE reforçado por trigger, não só por RLS (mesmo pra service role/superuser, ver função abaixo).';

create index idx_logs_auditoria_contador_id on logs_auditoria(contador_id);
create index idx_logs_auditoria_empresa_id on logs_auditoria(empresa_id);
create index idx_logs_auditoria_usuario_id on logs_auditoria(usuario_id);

-- Trigger a nível de banco (não só RLS) impedindo UPDATE/DELETE em qualquer circunstância,
-- inclusive contra uso acidental da service role (que ignora RLS mas não ignora triggers).
create or replace function impedir_alteracao_log_auditoria()
returns trigger
language plpgsql
as $$
begin
  raise exception 'logs_auditoria é imutável -- UPDATE/DELETE não são permitidos, nem para service role';
end;
$$;

create trigger trg_impedir_update_log_auditoria
  before update on logs_auditoria
  for each row execute function impedir_alteracao_log_auditoria();

create trigger trg_impedir_delete_log_auditoria
  before delete on logs_auditoria
  for each row execute function impedir_alteracao_log_auditoria();

-- ============================================================
-- RLS
-- ============================================================

alter table logs_auditoria enable row level security;

-- Leitura: plataforma vê tudo; contador/empresa vêem só entradas do próprio escopo
-- (transparência) -- entradas com contador_id/empresa_id nulos (ações de sistema/Dev
-- Admin) só a plataforma vê.
create policy logs_auditoria_select on logs_auditoria for select to authenticated using (
  eh_plataforma()
  or (contador_id is not null and pode_acessar_contador(contador_id))
  or (empresa_id is not null and pode_acessar_empresa(empresa_id))
);

-- INSERT: um usuário autenticado só pode logar ação em nome de si mesmo (nunca se passar
-- por outro usuario_id) e só referenciando contador/empresa que ele próprio acessa --
-- nunca UPDATE/DELETE (bloqueado por trigger em qualquer circunstância, nem precisa de
-- policy negativa aqui). Ações de sistema/automação usam service role, que ignora RLS.
create policy logs_auditoria_insert on logs_auditoria for insert to authenticated with check (
  usuario_id = auth.uid()
  and (contador_id is null or pode_acessar_contador(contador_id))
  and (empresa_id is null or pode_acessar_empresa(empresa_id))
);
