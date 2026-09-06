-- Concede privilégio de tabela ao role `authenticated` -- RLS restringe LINHAS, mas o
-- Postgres exige GRANT de tabela antes disso mesmo ser avaliado. Faltou nas migrations
-- 0002-0008 (só criavam as policies, nunca o GRANT base) -- pego em teste manual local
-- (2026-09-06): SELECT em `empresas` como `authenticated` retornava
-- "permission denied for table empresas" antes mesmo de RLS entrar em jogo.
--
-- O GRANT aqui é amplo (SELECT/INSERT/UPDATE/DELETE) de propósito -- é a policy de RLS
-- de cada tabela que decide o que realmente é permitido linha a linha (ex: várias
-- tabelas têm "for update using (false)"/"for delete using (false)", então o GRANT de
-- UPDATE/DELETE nelas é inofensivo, nunca passa da policy).

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;

-- Garante que toda tabela criada em migrations futuras já nasça com esse grant,
-- sem depender de lembrar de repetir isso manualmente.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
