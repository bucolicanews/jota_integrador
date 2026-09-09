-- Bucket privado para os blobs cifrados do cofre de certificados digitais (Modo B,
-- docs/SEGURANCA.md §1). O arquivo do certificado e a senha são cifrados (AES-256-GCM,
-- CofreCriptografiaService) ANTES de subir aqui -- o bucket em si nunca guarda dado em
-- claro, é uma segunda camada, não a única.
--
-- Propositalmente sem NENHUMA storage policy para `authenticated`/`anon`: só a service
-- role (que ignora RLS/storage policies) acessa este bucket, sempre via backend
-- (CofreCertificadosService). O frontend nunca fala direto com Storage aqui -- mesma
-- regra de ouro do resto do projeto ("frontend nunca fala direto com o SERPRO nem com
-- nenhum cofre de certificado", docs/ARQUITETURA.md).
insert into storage.buckets (id, name, public)
values ('certificados-privados', 'certificados-privados', false)
on conflict (id) do nothing;
