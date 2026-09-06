-- Extensões e funções auxiliares de RLS
-- Autenticação via Supabase Auth (docs/BANCO_DE_DADOS.md §1). O backend sincroniza
-- papel/contador_id/empresa_id no app_metadata do usuário (Admin API) sempre que
-- usuarios.papel_id/contador_id/empresa_id muda -- mesmo padrão do user_metadata.role
-- já usado no DeliveryHub. Toda política de RLS lê essas funções em vez de fazer
-- subquery em `usuarios` (evita recursão de RLS e round-trip extra ao banco).

create extension if not exists "pgcrypto";

-- Trigger genérico: mantém atualizado_em em dia em qualquer UPDATE.
create or replace function set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

comment on function set_atualizado_em() is 'Atualiza atualizado_em = now() em todo UPDATE. Anexar como BEFORE UPDATE trigger em toda tabela que tenha essa coluna.';

-- contador_id do usuário autenticado (null se o papel não tiver escopo contador/empresa-de-um-contador)
create or replace function auth_contador_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'contador_id', '')::uuid
$$;

-- empresa_id do usuário autenticado (null se o papel não tiver escopo empresa)
create or replace function auth_empresa_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'empresa_id', '')::uuid
$$;

-- nome do papel do usuário autenticado (ex: 'SUPER_ADMIN', 'CONTADOR_DONO', 'EMPRESARIO_DONO')
create or replace function auth_papel()
returns text
language sql
stable
as $$
  select auth.jwt() -> 'app_metadata' ->> 'papel'
$$;

-- true se o usuário tem o maior nível de acesso da plataforma
create or replace function eh_super_admin()
returns boolean
language sql
stable
as $$
  select auth_papel() = 'SUPER_ADMIN'
$$;

-- true se o usuário é da equipe da Jota (qualquer papel de escopo "plataforma")
create or replace function eh_plataforma()
returns boolean
language sql
stable
as $$
  select auth_papel() in ('SUPER_ADMIN', 'ADMIN_FINANCEIRO', 'ADMIN_SUPORTE')
$$;

comment on function auth_contador_id() is 'contador_id do JWT (app_metadata) do usuário autenticado, via Supabase Auth.';
comment on function auth_empresa_id() is 'empresa_id do JWT (app_metadata) do usuário autenticado, via Supabase Auth.';
comment on function auth_papel() is 'Nome do papel (papeis.nome) do usuário autenticado, via Supabase Auth.';
comment on function eh_super_admin() is 'True se o usuário autenticado é SUPER_ADMIN.';
comment on function eh_plataforma() is 'True se o usuário autenticado é da equipe da Jota (qualquer papel de escopo plataforma).';
