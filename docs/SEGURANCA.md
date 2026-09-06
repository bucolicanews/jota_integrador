# Política de Segurança — jota_integrador_backend (JOTA FISCAL)

Este documento **herda integralmente** as políticas do ecossistema JHON:

- `may_memory/21-SEGURANCA/POLITICAS.md` — política mestre
- `may_memory/21-SEGURANCA/ARCHITECTURE_SECURITY_RULES 1.md` e `2.md` — 40 regras arquiteturais
- `may_memory/21-SEGURANCA/SECURITY SYSTEM DESIGN.md` — design seguro React+NestJS+Supabase
- `may_memory/21-SEGURANCA/PENTEST_CODE_REVIEW_PROTOCOL.md` — protocolo de auditoria pré-deploy
- `may_memory/23-DECISOES/ADR-002-POLITICA-CREDENCIAIS.md` — regra de credenciais/[MASKED]

Em caso de dúvida ou conflito, a precedência é: `POLITICAS` → `ARCHITECTURE_SECURITY_RULES` → `SECURITY SYSTEM DESIGN` → este documento → módulos → código. Este documento **não substitui** o vault — apenas adiciona as regras específicas do domínio fiscal que os documentos genéricos não cobrem.

---

## 1. Certificados digitais — dois modos de acesso ao SERPRO, ambos suportados

A plataforma suporta **dois modos de acesso** ao SERPRO por empresa cliente, não um só — cada empresa usa um dos dois (`modo_acesso_serpro`: `procuracao` | `certificado_proprio`):

**Modo A — Procuração (via certificado único da Jota):** confirmado com a documentação oficial do Integra Contador (2026-09-06) — autenticação usa `Role-Type: TERCEIROS` com **o certificado e-CNPJ da própria Jota** (o mesmo usado na contratação do produto junto ao SERPRO). A empresa outorga procuração eletrônica à Jota (via e-CAC/gov.br) autorizando a consulta; não entrega certificado nenhum. Ver §2.

**Modo B — Certificado próprio da empresa:** a empresa cadastra e mantém seu próprio certificado digital (A1/A3) no cofre da plataforma, individual por empresa — modelo original do plano de produto, para empresas que preferem não outorgar procuração ou que já têm certificado próprio configurado para outros fins. **Mecânica exata de autenticação nesse modo junto ao SERPRO (se ainda passa pelo `contratante` Jota ou se a empresa precisa de contrato próprio com o SERPRO) ainda precisa ser confirmada com a documentação/suporte SERPRO antes de implementar** — não assumir, validar.

Isso significa **dois ativos críticos coexistindo**, com riscos de naturezas diferentes:
- O certificado da Jota (Modo A) é um single point of failure: comprometê-lo afeta todos os clientes que usam procuração simultaneamente.
- Cada certificado individual (Modo B) tem blast radius menor (uma empresa), mas são N certificados a proteger, não um.

**Obrigatório para os dois modos:**

```
Certificado (Jota, único — ou empresa, individual) → Criptografia (AES-256) → Cofre dedicado, acesso mínimo
        → Serviço de autenticação isolado (SerproAuthService) → SERPRO / Integra Contador
```

- O certificado da Jota (Modo A) não é uma tabela `certificados` genérica — é configuração de infraestrutura crítica da plataforma. Os certificados de empresas (Modo B) sim ficam numa tabela de domínio (`certificados`, com `empresa_id`), isolada do restante do domínio (não é uma tabela genérica de "uploads").
- Isolamento por empresa no Modo B: o certificado de uma empresa nunca é acessível por outra, nem por um contador que não seja o responsável por ela (ver §4 — hierarquia de acesso).
- Criptografia em repouso obrigatória (AES-256) nos dois modos; a chave de criptografia do cofre vive em Secret Manager, nunca junto com o dado cifrado.
- **Nunca** expor certificado (de qualquer modo), sua senha, ou material derivado ao frontend — nem em resposta de API, nem em log, nem em painel administrativo.
- Controle de expiração nos dois modos: Modo A alerta a operação da Jota (60/30/15/7 dias — vencer aqui derruba a plataforma inteira pra quem usa procuração); Modo B alerta contador e empresário daquela empresa específica.
- Toda operação que **use** um certificado (autenticação junto ao SERPRO) gera registro de auditoria: quando, para qual empresa (se Modo B) ou uso da plataforma (se Modo A), resultado — mesmo uso automático/agendado.
- Rotação suportada nos dois modos sem downtime, sem deixar versão antiga acessível após a troca.
- Certificado nunca sai do cofre em texto puro para logs, mensagens de erro, filas (Redis) ou webhooks.

## 2. Procuração eletrônica por empresa (Modo A) — mecanismo de isolamento desse modo

Para empresas no Modo A, **quem autoriza ou não o acesso é a procuração eletrônica**, não algo que o nosso sistema emite. A Jota não pode consultar `contribuinte` nenhum sem procuração ativa outorgada por aquela empresa.

- Nunca assumir que uma empresa em Modo A tem procuração válida — rastrear o status explicitamente (`ativa`/`expirada`/`revogada`/`pendente`) e revalidar periodicamente (o SERPRO expõe um serviço `PROCURACOES` para consulta programática — usar isso em vez de confiar num campo que nunca é atualizado).
- Bloquear no nosso próprio backend qualquer chamada pra uma empresa em Modo A sem procuração ativa **antes** de gastar crédito ou fazer a chamada ao SERPRO — não depender só do SERPRO rejeitar a chamada (defesa em profundidade + evita cobrar crédito de uma chamada que ia falhar de qualquer forma).
- Expiração/revogação de procuração é um evento de negócio de primeira classe: alertar contador e empresário, não deixar consultas falharem silenciosamente com erro genérico.
- Toda mudança de status de procuração gera auditoria (é o que efetivamente liga/desliga acesso a dados fiscais de uma empresa em Modo A).
- Empresas em Modo B (certificado próprio) não passam por essa checagem de procuração — passam pela checagem equivalente de "certificado presente e não expirado" (§1).

## 3. Integração com SERPRO / Integra Contador — fluxo técnico confirmado

Autenticação (`SerproAuthService`, camada Infrastructure) — fluxo abaixo confirmado para o **Modo A (procuração)**; Modo B (certificado próprio da empresa) usa o mesmo desenho de serviço mas ainda precisa ter a mecânica exata de autenticação junto ao SERPRO confirmada (§1) antes de implementar:

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
- Assinatura SaaS (contador → Jota) usa Stripe Checkout + Subscriptions direto, sem Connect — Jota é a única recebedora (`docs/BANCO_DE_DADOS.md §3`).

## 7. Stripe Connect — honorários (empresa paga o contador, Jota comissiona)

Réplica do padrão já em produção no DeliveryHub (Stripe Connect, contas Express, destination charge) — ver `docs/BANCO_DE_DADOS.md §7` para o schema. Aqui, quem recebe **não é a Jota**, é o contador (via conta conectada) — muda o modelo de confiança:

- `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` da plataforma: `.env`/Secret Manager, **nunca em tabela** — desvio deliberado do padrão usado no DeliveryHub/GESTAO_PROJETOS_VUE (que guardam em `configuracoes_pagamentos`/`/admin/configuracoes` no banco); aqui seguimos a regra mais estrita já vigente neste projeto (`ADR-002-POLITICA-CREDENCIAIS`: segredo nunca no banco).
- `stripe_account_id` de um contador não é segredo (é usado no lado cliente do Stripe.js em alguns fluxos) — mas `stripe_charges_enabled`/`payouts_enabled`/`details_submitted` só devem ser atualizados via webhook assinado (`account.updated`), nunca por escrita direta de endpoint que o frontend chama.
- **Isolamento obrigatório antes de criar qualquer PaymentIntent:** validar que `empresa_id` pertence à carteira do `contador_id` que está cobrando — nunca aceitar essa combinação vinda do payload sem revalidar posse (mesma regra de `docs/SEGURANCA.md §4`, aplicada a um recurso financeiro novo). Cobrar honorário de empresa fora da carteira do contador é tão grave quanto vazar dado fiscal entre carteiras.
- `application_fee_amount` (comissão da Jota) é calculado no backend a partir de `comissao_pct`, nunca aceito do frontend — cliente jamais decide quanto a plataforma cobra de comissão.
- Comissão é fixa e global (`configuracoes_plataforma.comissao_honorarios_pct`, `docs/BANCO_DE_DADOS.md §7`), editável só por `SUPER_ADMIN`/`ADMIN_FINANCEIRO`, com auditoria a cada mudança. Cada cobrança congela o percentual vigente no momento da criação — nunca recalcular `comissao_pct` de uma cobrança já criada a partir do valor global atual.
- Webhooks (`payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`) são assinados pelo Stripe — verificar `stripe-signature` sempre, e checar `webhook_eventos_processados` antes de aplicar qualquer efeito (idempotência — retry do gateway não pode creditar/pagar duas vezes).
- Nunca mostrar ao empresário uma opção de pagamento por cartão se `contadores.stripe_charges_enabled = false` — gating no backend (endpoint que expõe métodos de pagamento disponíveis), não só no frontend.
- Estorno/chargeback: quem assume o risco (Stripe vs. plataforma) é definido no "platform profile" do dashboard Stripe da Jota, decisão de negócio/jurídica do usuário — não é algo que a IA decide ou assume implicitamente no código.

## 8. Regras herdadas do vault que se aplicam sem alteração

Aplicar integralmente, sem adaptação adicional, tudo que já está em `POLITICAS.md` e `ARCHITECTURE_SECURITY_RULES 1/2.md`: RLS em 100% das tabelas, RBAC+ABAC, MFA obrigatório para ADMIN/SUPER_ADMIN (aqui: Dev Admin e Contador com poderes administrativos sobre a carteira), Argon2/bcrypt para senha, JWT curto + refresh rotativo, helmet/CORS restrito/CSRF, rate limiting, headers de segurança, validação de upload (MIME+assinatura binária+antivírus), webhook signature/timestamp/nonce, backups diários com teste de restauração, observabilidade (Sentry/OpenTelemetry/Prometheus/Grafana/Loki), pipeline DevSecOps (lint→testes→SAST→dependency scan→secret scan) bloqueando deploy em falha crítica.

## 9. Regra absoluta para IA neste projeto

A IA nunca deve, no contexto do jota_integrador_backend:

- Gerar ou sugerir certificado/chave/credencial real, nem mesmo como exemplo — usar sempre `[MASKED]` ou dado fictício claramente identificável como tal.
- Desativar RLS, ignorar `contador_id`/`empresa_id`, ou "simplificar temporariamente" a checagem de hierarquia contador→empresa para destravar uma feature.
- Escrever código que envie certificado digital, sua senha, ou credencial SERPRO para o frontend, log, fila ou terceiro não autorizado.
- Rodar ou sugerir rodar teste/script contra o gateway de **produção** do SERPRO (`integra-contador`, sem `-trial`) — usar sempre o ambiente `integra-contador-trial` em desenvolvimento/CI (ver `docs/TESTES.md`).
- Assumir que uma empresa em Modo A tem procuração ativa sem checar, ou que uma empresa em Modo B tem certificado válido sem checar — nunca implementar chamada ao SERPRO pra um `contribuinte` sem validar antes o mecanismo de acesso correspondente ao modo daquela empresa.
- Assumir que todas as empresas usam o mesmo modo de acesso (procuração **ou** certificado próprio) — os dois coexistem, verificar `modo_acesso_serpro` da empresa antes de decidir qual fluxo de autenticação usar.
- Tratar o módulo de créditos/billing como "detalhe menor" — é dado financeiro e auditável como qualquer pagamento.
- Criar PaymentIntent de honorário (§7) sem validar antes que a empresa pertence à carteira do contador que está cobrando.
- Aceitar `application_fee_amount`/percentual de comissão vindo do frontend — sempre calculado no backend.
- Guardar `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` em tabela do banco — só `.env`/Secret Manager, mesmo que o padrão de outro projeto do ecossistema faça diferente.
