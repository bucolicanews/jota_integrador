-- Concede privilégio de tabela ao role `service_role` -- pego em teste manual real
-- (2026-09-06, módulo empresas): mesmo com BYPASSRLS, service_role sem GRANT explícito
-- dava "permission denied for table empresas". BYPASSRLS só ignora as POLICIES de RLS;
-- o GRANT de SELECT/INSERT/UPDATE/DELETE é uma camada de permissão SQL separada e
-- continua valendo mesmo pra quem ignora RLS. A migration 0009 corrigiu isso só pra
-- `authenticated`, faltou `service_role` (usado pelo backend via SUPABASE_SERVICE_ROLE_KEY).

grant select, insert, update, delete on all tables in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
