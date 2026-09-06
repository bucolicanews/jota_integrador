# Política de Segurança — jota_integrador_backend (JOTA FISCAL)

Este documento **herda integralmente** as políticas do ecossistema JHON:

- `may_memory/21-SEGURANCA/POLITICAS.md` — política mestre
- `may_memory/21-SEGURANCA/ARCHITECTURE_SECURITY_RULES 1.md` e `2.md` — 40 regras arquiteturais
- `may_memory/21-SEGURANCA/SECURITY SYSTEM DESIGN.md` — design seguro React+NestJS+Supabase
- `may_memory/21-SEGURANCA/PENTEST_CODE_REVIEW_PROTOCOL.md` — protocolo de auditoria pré-deploy
- `may_memory/23-DECISOES/ADR-002-POLITICA-CREDENCIAIS.md` — regra de credenciais/[MASKED]

Em caso de dúvida ou conflito, a precedência é: `POLITICAS` → `ARCHITECTURE_SECURITY_RULES` → `SECURITY SYSTEM DESIGN` → este documento → módulos → código. Este documento **não substitui** o vault — apenas adiciona as regras específicas do domínio fiscal que os documentos genéricos não cobrem.

---

## 1. Certificado Digital da Jota — o dado mais crítico do sistema (single point of failure)

Confirmado com a documentação oficial do Integra Contador (2026-09-06): a autenticação no SERPRO usa `Role-Type: TERCEIROS` e exige **o certificado digital e-CNPJ da própria Jota** (o mesmo usado na contratação do produto junto ao SERPRO) — **não** um certificado por empresa-cliente. O acesso aos dados de cada empresa é liberado por **procuração eletrônica** que a empresa outorga à Jota (via e-CAC/gov.br), não por um certificado que a empresa nos entrega.

Isso muda o formato do risco: em vez de N certificados isolados (um por empresa, comprometer um afeta uma empresa), há **um único certificado cuja perda compromete o acesso a todos os clientes da plataforma simultaneamente**. Tratar como o ativo de segurança mais crítico do sistema inteiro — mais do que qualquer dado individual de cliente.

**Obrigatório:**

```
Certificado e-CNPJ da Jota → Criptografia (AES-256) → Cofre dedicado, acesso mínimo
        → Serviço de autenticação isolado (SerproAuthService) → SERPRO / Integra Contador
```

- Certificado único, não uma tabela `certificados` genérica — é configuração de infraestrutura crítica da plataforma, não um registro de domínio por empresa. Acesso de leitura restrito ao serviço de autenticação SERPRO; nenhum outro módulo do sistema toca nele.
- Criptografia em repouso obrigatória (AES-256); a chave de criptografia do cofre vive em Secret Manager, nunca junto com o dado cifrado.
- **Nunca** expor o certificado, sua senha, ou material derivado ao frontend — nem em resposta de API, nem em log, nem em painel administrativo, nem para o Dev Admin via UI (acesso só por operação de infraestrutura, fora da aplicação).
- Controle de expiração: alertar a operação da Jota com bastante antecedência (ex: 60/30/15/7 dias) — se esse certificado vencer, **toda a plataforma** para de conseguir consultar qualquer cliente. É o pior cenário de indisponibilidade do sistema, não uma falha isolada.
- Toda chamada de autenticação ao SERPRO (uso do certificado) gera registro de auditoria: quando, resultado, IP de origem — mesmo sendo uso interno/automático.
- Rotação: suportar substituição sem downtime da plataforma inteira.
- Certificado nunca sai do cofre em texto puro para logs, mensagens de erro, filas (Redis) ou webhooks.

## 2. Procuração eletrônica por empresa — o mecanismo real de isolamento

Como o certificado é único (da Jota), **quem autoriza ou não o acesso a uma empresa é a procuração eletrônica**, não algo que o nosso sistema emite. A Jota não pode consultar `contribuinte` nenhum sem procuração ativa outorgada por aquela empresa.

- Nunca assumir que uma empresa cadastrada no nosso banco tem procuração válida — rastrear o status explicitamente (`ativa`/`expirada`/`revogada`/`pendente`) e revalidar periodicamente (o SERPRO expõe um serviço `PROCURACOES` para consulta programática — usar isso em vez de confiar num campo que nunca é atualizado).
- Bloquear no nosso próprio backend qualquer chamada pra uma empresa sem procuração ativa **antes** de gastar crédito ou fazer a chamada ao SERPRO — não depender só do SERPRO rejeitar a chamada (defesa em profundidade + evita cobrar crédito de uma chamada que ia falhar de qualquer forma).
- Expiração/revogação de procuração é um evento de negócio de primeira classe: alertar contador e empresário, não deixar consultas falharem silenciosamente com erro genérico.
- Toda mudança de status de procuração gera auditoria (é o que efetivamente liga/desliga acesso a dados fiscais de uma empresa).

## 3. Integração com SERPRO / Integra Contador — fluxo técnico confirmado

Autenticação (`SerproAuthService`, camada Infrastructure):

- `POST https://autenticacao.sapi.serpro.gov.br/authenticate` com `Authorization: Basic base64(consumer_key:consumer_secret)`, header `Role-Type: TERCEIROS`, e o certificado da Jota (mTLS) — nunca sem os três.
- Resposta traz **dois tokens** (`access_token` + `jwt_token`, ~33min de validade) — guardar os dois juntos em cache (Redis), nunca só um.
- Toda chamada ao gateway (`https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/...`) exige **ambos** os headers: `Authorization: Bearer <access_token>` **e** `jwt_token: <jwt_token>` — esquecer o segundo é um bug de integração, não de segurança, mas quebra todas as chamadas.
- Não há endpoint de refresh — ao receber 401, reautenticar do zero. Implementar isso como retry único automático no `SerproAuthService`, não deixar vazar 401 pro chamador.
- Consumer key/secret seguem a mesma regra de `SUPABASE_SERVICE_ROLE_KEY`: só existem no backend, nunca no frontend/bundle. **Nunca colocar em arquivo sem `.gitignore` correspondente** — já aconteceu uma vez neste projeto (`.env_ex` não coberto pelo padrão original, corrigido).
- Envelope de toda chamada de negócio inclui `contratante` (CNPJ da Jota), `autorPedidoDados`, `contribuinte` (CNPJ da empresa cliente — nosso `empresa_id` resolvido pra CNPJ) e `pedidoDados` (`idSistema`/`idServico`/`dados`). Nunca montar `contribuinte` a partir de um CNPJ vindo direto do payload do frontend sem revalidar que aquele `empresa_id` pertence à sessão autenticada (ver §4 — hierarquia de acesso).
- Rate limiting próprio para não estourar a cota contratada — recurso finito compartilhado entre todos os contadores/empresas da plataforma.
- Toda chamada é logada (requisição/resposta sem dado sensível) para auditoria de consumo e troubleshooting.
- Erros da API oficial nunca vazam stack trace/payload bruto para o cliente final — traduzir para mensagem humana (ver `docs/UX-UI.md` — heurística 9 de Nielsen).
- Existe ambiente de demonstração/trial oficial (`integra-contador-trial` em vez de `integra-contador` no path do gateway, CNPJ fixo `00000000000000`, sem certificado/`jwt_token`) — usar em desenvolvimento e testes automatizados, nunca confundir com produção. Ver `docs/TESTES.md`.

## 4. Hierarquia de acesso e isolamento (Dev Admin → Contador → Empresa)

Este é o ponto de maior risco de BOLA/IDOR do sistema — mais crítico que um multi-tenant de 2 níveis comum, porque existem **dois** limites de posse a validar em cascata.

- Toda tabela de domínio (empresas, documentos fiscais, procurações, créditos, consultas) possui `contador_id` (contador) **e** `empresa_id` (empresa), nunca apenas um dos dois.
- Toda query deve derivar `contador_id`/`empresa_id` da sessão autenticada (JWT → usuário → contador/empresa vinculados), **nunca** aceitar esses IDs vindos do payload/query param da requisição sem revalidar posse.
- Um contador só pode listar/acessar empresas da própria carteira — validar isso no service, não confiar em filtro feito só no frontend.
- Uma empresa-cliente (usuário empresário) só acessa os próprios dados — nunca os de outra empresa, mesmo do mesmo contador.
- RLS no Supabase deve expressar essa cascata (política que verifica `empresa_id` pertence a uma empresa cujo `contador_id` = contador da sessão, e/ou `empresa_id` = empresa do usuário logado), não apenas RLS de tenant único.
- Dev/Admin da Jota tem visão global — mas todo acesso desse nível também gera auditoria (é o papel com maior poder de dano, não uma exceção às regras).
- Antes de qualquer deploy: rodar o `PENTEST_CODE_REVIEW_PROTOCOL.md` do vault com foco explícito em "contador A acessa empresa de contador B" e "empresa A acessa dado de empresa B" como cenários de teste obrigatórios.

## 5. Dados fiscais e classificação (LGPD)

Seguindo a classificação de `ARCHITECTURE_SECURITY_RULES 2.md §Classificação de Dados`:

| Classificação | Exemplos neste projeto |
|---|---|
| Crítico | Certificado digital da plataforma (único, e-CNPJ da Jota), consumer key/secret SERPRO, credenciais SERPRO, JWT/refresh token |
| Restrito (LGPD) | CNPJ, CPF, faturamento, XML de NF-e/CT-e, dados bancários, DAS/PGDAS, status de procuração |
| Interno | Documentos fiscais processados, relatórios, histórico de consultas, consumo de créditos |
| Público | Nada neste sistema deve ser público por padrão |

- CPF/CNPJ completo nunca aparece em log ou mensagem de erro — mascarar (`***.***.***-**`) fora de telas autorizadas.
- Exportação/exclusão/anonimização de dados fiscais do cliente deve ser suportada (LGPD) — mas atenção: dados fiscais têm prazo legal de retenção (Receita Federal/legislação tributária) que pode **conflitar** com "direito ao esquecimento". Nunca excluir dado fiscal sob obrigação legal de retenção sem validar o prazo aplicável — na dúvida, anonimizar o que for possível e reter o mínimo exigido por lei, documentando a decisão.

## 6. Sistema de créditos e billing

- Consumo de crédito (`CONSULTA_CNPJ`, `PGDAS`, `BAIXAR_XML`, etc.) e a chamada que ele paga devem ser atômicos — nunca decrementar crédito e falhar a operação (ou vice-versa) sem compensação. Usar transação de banco ou padrão saga/outbox, não duas escritas independentes.
- Toda alteração de saldo de crédito gera registro de auditoria imutável (quem, quanto, motivo, saldo antes/depois) — é dado financeiro.
- Proteger contra fraude de consumo: um usuário não pode disparar a mesma operação em paralelo para "gastar" créditos que não tem (race condition em decremento) — lock otimista/pessimista ou constraint de saldo não-negativo no banco.
- Dados de pagamento (se houver cobrança direta): nunca armazenar cartão/CVV — usar tokenização via gateway (Stripe/PagBank/Mercado Pago/Asaas), conforme `SECURITY SYSTEM DESIGN.md §24`.

## 7. Regras herdadas do vault que se aplicam sem alteração

Aplicar integralmente, sem adaptação adicional, tudo que já está em `POLITICAS.md` e `ARCHITECTURE_SECURITY_RULES 1/2.md`: RLS em 100% das tabelas, RBAC+ABAC, MFA obrigatório para ADMIN/SUPER_ADMIN (aqui: Dev Admin e Contador com poderes administrativos sobre a carteira), Argon2/bcrypt para senha, JWT curto + refresh rotativo, helmet/CORS restrito/CSRF, rate limiting, headers de segurança, validação de upload (MIME+assinatura binária+antivírus), webhook signature/timestamp/nonce, backups diários com teste de restauração, observabilidade (Sentry/OpenTelemetry/Prometheus/Grafana/Loki), pipeline DevSecOps (lint→testes→SAST→dependency scan→secret scan) bloqueando deploy em falha crítica.

## 8. Regra absoluta para IA neste projeto

A IA nunca deve, no contexto do jota_integrador_backend:

- Gerar ou sugerir certificado/chave/credencial real, nem mesmo como exemplo — usar sempre `[MASKED]` ou dado fictício claramente identificável como tal.
- Desativar RLS, ignorar `contador_id`/`empresa_id`, ou "simplificar temporariamente" a checagem de hierarquia contador→empresa para destravar uma feature.
- Escrever código que envie certificado digital, sua senha, ou credencial SERPRO para o frontend, log, fila ou terceiro não autorizado.
- Rodar ou sugerir rodar teste/script contra o gateway de **produção** do SERPRO (`integra-contador`, sem `-trial`) — usar sempre o ambiente `integra-contador-trial` em desenvolvimento/CI (ver `docs/TESTES.md`).
- Assumir que uma empresa tem procuração ativa sem checar — nunca implementar chamada ao SERPRO pra um `contribuinte` sem antes validar status de procuração.
- Tratar o módulo de créditos/billing como "detalhe menor" — é dado financeiro e auditável como qualquer pagamento.
