# Política de Segurança — jota_integrador (JOTA FISCAL)

Este documento **herda integralmente** as políticas do ecossistema JHON:

- `may_memory/21-SEGURANCA/POLITICAS.md` — política mestre
- `may_memory/21-SEGURANCA/ARCHITECTURE_SECURITY_RULES 1.md` e `2.md` — 40 regras arquiteturais
- `may_memory/21-SEGURANCA/SECURITY SYSTEM DESIGN.md` — design seguro React+NestJS+Supabase
- `may_memory/21-SEGURANCA/PENTEST_CODE_REVIEW_PROTOCOL.md` — protocolo de auditoria pré-deploy
- `may_memory/23-DECISOES/ADR-002-POLITICA-CREDENCIAIS.md` — regra de credenciais/[MASKED]

Em caso de dúvida ou conflito, a precedência é: `POLITICAS` → `ARCHITECTURE_SECURITY_RULES` → `SECURITY SYSTEM DESIGN` → este documento → módulos → código. Este documento **não substitui** o vault — apenas adiciona as regras específicas do domínio fiscal que os documentos genéricos não cobrem.

---

## 1. Certificado Digital (A1/A3) — o dado mais crítico do sistema

O certificado digital permite assinar digitalmente em nome da empresa perante a Receita Federal. Comprometê-lo é equivalente a comprometer a identidade fiscal do cliente.

**Obrigatório:**

```
Cliente → Upload do certificado → Criptografia (AES-256) → Cofre dedicado
        → Serviço de autenticação isolado → SERPRO / Integra Contador
```

- Nunca persistir o certificado como arquivo comum em disco, bucket público ou coluna sem criptografia. Usar um serviço/tabela dedicado, isolado do restante do domínio (`certificados` não pode ser uma tabela genérica de "uploads").
- Criptografia em repouso obrigatória (AES-256); a chave de criptografia do cofre vive em Secret Manager, nunca no banco junto com o dado cifrado.
- **Nunca** expor o certificado, sua senha, ou material derivado (chave privada extraída) ao frontend — nem em resposta de API, nem em log, nem em painel administrativo.
- Isolamento por empresa: o certificado de uma empresa nunca é acessível por outra, nem por um contador que não seja o responsável por ela (ver §3 — hierarquia de acesso).
- Controle de expiração: alertar contador e empresário com antecedência (ex: 30/15/7 dias) antes do vencimento — certificado vencido não deve falhar silenciosamente em produção.
- Toda operação que **use** o certificado (assinatura, autenticação junto ao SERPRO) gera registro de auditoria: quem disparou, quando, para qual empresa, com qual resultado — mesmo que o uso seja automático/agendado.
- Rotação: suportar substituição de certificado sem downtime e sem deixar versões antigas acessíveis após a troca.
- Certificado nunca sai do cofre em texto puro para logs, mensagens de erro, filas (Redis) ou webhooks.

## 2. Integração com SERPRO / Integra Contador

- Credenciais de acesso à API do SERPRO (client id/secret, certificado da própria Jota se aplicável) seguem a mesma regra de `SUPABASE_SERVICE_ROLE_KEY`: **só existem no backend NestJS**, nunca no frontend, nunca em variável exposta ao bundle.
- Rate limiting específico para não estourar a cota contratada com o SERPRO — trate isso como recurso finito e compartilhado entre todos os tenants, não apenas como proteção contra abuso.
- Toda chamada ao SERPRO é logada (requisição/resposta sem dado sensível) para permitir auditoria de consumo e troubleshooting sem precisar reproduzir contra a API oficial.
- Erros da API oficial nunca vazam stack trace/payload bruto para o cliente final — traduzir para mensagem humana (ver `docs/UX-UI.md` — heurística 9 de Nielsen).
- Ambiente de desenvolvimento/teste **nunca** aponta para o SERPRO de produção — usar sandbox oficial ou mocks. Ver `docs/TESTES.md`.

## 3. Hierarquia de acesso e isolamento (Dev Admin → Contador → Empresa)

Este é o ponto de maior risco de BOLA/IDOR do sistema — mais crítico que um multi-tenant de 2 níveis comum, porque existem **dois** limites de posse a validar em cascata.

- Toda tabela de domínio (empresas, documentos fiscais, certificados, créditos, consultas) possui `contador_id` (contador) **e** `empresa_id` (empresa), nunca apenas um dos dois.
- Toda query deve derivar `contador_id`/`empresa_id` da sessão autenticada (JWT → usuário → contador/empresa vinculados), **nunca** aceitar esses IDs vindos do payload/query param da requisição sem revalidar posse.
- Um contador só pode listar/acessar empresas da própria carteira — validar isso no service, não confiar em filtro feito só no frontend.
- Uma empresa-cliente (usuário empresário) só acessa os próprios dados — nunca os de outra empresa, mesmo do mesmo contador.
- RLS no Supabase deve expressar essa cascata (política que verifica `empresa_id` pertence a uma empresa cujo `contador_id` = contador da sessão, e/ou `empresa_id` = empresa do usuário logado), não apenas RLS de tenant único.
- Dev/Admin da Jota tem visão global — mas todo acesso desse nível também gera auditoria (é o papel com maior poder de dano, não uma exceção às regras).
- Antes de qualquer deploy: rodar o `PENTEST_CODE_REVIEW_PROTOCOL.md` do vault com foco explícito em "contador A acessa empresa de contador B" e "empresa A acessa dado de empresa B" como cenários de teste obrigatórios.

## 4. Dados fiscais e classificação (LGPD)

Seguindo a classificação de `ARCHITECTURE_SECURITY_RULES 2.md §Classificação de Dados`:

| Classificação | Exemplos neste projeto |
|---|---|
| Crítico | Certificado digital, chave privada, credenciais SERPRO, JWT/refresh token |
| Restrito (LGPD) | CNPJ, CPF, faturamento, XML de NF-e/CT-e, dados bancários, DAS/PGDAS |
| Interno | Documentos fiscais processados, relatórios, histórico de consultas, consumo de créditos |
| Público | Nada neste sistema deve ser público por padrão |

- CPF/CNPJ completo nunca aparece em log ou mensagem de erro — mascarar (`***.***.***-**`) fora de telas autorizadas.
- Exportação/exclusão/anonimização de dados fiscais do cliente deve ser suportada (LGPD) — mas atenção: dados fiscais têm prazo legal de retenção (Receita Federal/legislação tributária) que pode **conflitar** com "direito ao esquecimento". Nunca excluir dado fiscal sob obrigação legal de retenção sem validar o prazo aplicável — na dúvida, anonimizar o que for possível e reter o mínimo exigido por lei, documentando a decisão.

## 5. Sistema de créditos e billing

- Consumo de crédito (`CONSULTA_CNPJ`, `PGDAS`, `BAIXAR_XML`, etc.) e a chamada que ele paga devem ser atômicos — nunca decrementar crédito e falhar a operação (ou vice-versa) sem compensação. Usar transação de banco ou padrão saga/outbox, não duas escritas independentes.
- Toda alteração de saldo de crédito gera registro de auditoria imutável (quem, quanto, motivo, saldo antes/depois) — é dado financeiro.
- Proteger contra fraude de consumo: um usuário não pode disparar a mesma operação em paralelo para "gastar" créditos que não tem (race condition em decremento) — lock otimista/pessimista ou constraint de saldo não-negativo no banco.
- Dados de pagamento (se houver cobrança direta): nunca armazenar cartão/CVV — usar tokenização via gateway (Stripe/PagBank/Mercado Pago/Asaas), conforme `SECURITY SYSTEM DESIGN.md §24`.

## 6. Regras herdadas do vault que se aplicam sem alteração

Aplicar integralmente, sem adaptação adicional, tudo que já está em `POLITICAS.md` e `ARCHITECTURE_SECURITY_RULES 1/2.md`: RLS em 100% das tabelas, RBAC+ABAC, MFA obrigatório para ADMIN/SUPER_ADMIN (aqui: Dev Admin e Contador com poderes administrativos sobre a carteira), Argon2/bcrypt para senha, JWT curto + refresh rotativo, helmet/CORS restrito/CSRF, rate limiting, headers de segurança, validação de upload (MIME+assinatura binária+antivírus), webhook signature/timestamp/nonce, backups diários com teste de restauração, observabilidade (Sentry/OpenTelemetry/Prometheus/Grafana/Loki), pipeline DevSecOps (lint→testes→SAST→dependency scan→secret scan) bloqueando deploy em falha crítica.

## 7. Regra absoluta para IA neste projeto

A IA nunca deve, no contexto do jota_integrador:

- Gerar ou sugerir certificado/chave/credencial real, nem mesmo como exemplo — usar sempre `[MASKED]` ou dado fictício claramente identificável como tal.
- Desativar RLS, ignorar `contador_id`/`empresa_id`, ou "simplificar temporariamente" a checagem de hierarquia contador→empresa para destravar uma feature.
- Escrever código que envie certificado digital, sua senha, ou credencial SERPRO para o frontend, log, fila ou terceiro não autorizado.
- Rodar ou sugerir rodar teste/script contra o SERPRO de produção.
- Tratar o módulo de créditos/billing como "detalhe menor" — é dado financeiro e auditável como qualquer pagamento.
