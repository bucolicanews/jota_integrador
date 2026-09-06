-- Caixa Postal (docs/BANCO_DE_DADOS.md §5)

create table mensagens_caixa_postal (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  orgao text not null,
  assunto text not null,
  status text not null default 'nao_lida' check (status in ('lida', 'nao_lida')),
  data_recebimento timestamptz not null,
  conteudo_ref text, -- referência ao storage, não o conteúdo inteiro na tabela
  criado_em timestamptz not null default now()
);

create index idx_mensagens_caixa_postal_empresa_id on mensagens_caixa_postal(empresa_id);

-- Só o campo `status` pode ser alterado por quem acessa a empresa (marcar como lida) --
-- o resto da mensagem é sincronizado do SERPRO, não editável pelo usuário final.
create or replace function protege_campos_mensagem_caixa_postal()
returns trigger
language plpgsql
as $$
begin
  if not eh_plataforma() then
    if new.orgao is distinct from old.orgao
       or new.assunto is distinct from old.assunto
       or new.data_recebimento is distinct from old.data_recebimento
       or new.conteudo_ref is distinct from old.conteudo_ref
       or new.empresa_id is distinct from old.empresa_id
    then
      raise exception 'Só o status (lida/não lida) pode ser alterado pelo usuário final';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_protege_campos_mensagem_caixa_postal
  before update on mensagens_caixa_postal
  for each row execute function protege_campos_mensagem_caixa_postal();

-- ============================================================
-- RLS
-- ============================================================

alter table mensagens_caixa_postal enable row level security;

create policy mensagens_caixa_postal_select on mensagens_caixa_postal for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy mensagens_caixa_postal_insert on mensagens_caixa_postal for insert to authenticated with check (eh_plataforma());
create policy mensagens_caixa_postal_update on mensagens_caixa_postal for update to authenticated
  using (pode_acessar_empresa(empresa_id))
  with check (pode_acessar_empresa(empresa_id));
create policy mensagens_caixa_postal_delete on mensagens_caixa_postal for delete to authenticated using (false);
