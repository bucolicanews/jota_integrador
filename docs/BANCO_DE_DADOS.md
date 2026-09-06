# Banco de Dados — jota_integrador_backend (JOTA FISCAL)

PostgreSQL via Supabase. Complementa `docs/ARQUITETURA.md` (camadas, hierarquia de entidades) e `docs/SEGURANCA.md` (RLS, classificação de dados, isolamento). Nomes de tabela/coluna em português, `snake_case` (convenção SQL padrão, não é jargão técnico a manter em inglês).

**Migrations SQL implementadas** em `supabase/migrations/` (2026-09-06), uma por área, nesta ordem: `0001_extensoes_e_funcoes_auth` (helpers de RLS lendo `app_metadata`) → `0002_identidade_hierarquia` (RBAC, contadores, empresas, usuarios) → `0003_acesso_serpro` → `0004_assinatura_saas` → `0005_fiscal` → `0006_caixa_postal` → `0007_auditoria` → `0008_honorarios_stripe_connect`. Autenticação via **Supabase Auth** (não custom JWT) — `usuarios` é tabela de perfil, sem `senha_hash`/`refresh_tokens` próprios; RLS lê `contador_id`/`empresa_id`/`papel` de `auth.jwt() -> 'app_metadata'` (sincronizado pelo backend via Admin API), nunca por subquery direta em `usuarios` (evita recursão de RLS).

## Convenções gerais

- Toda tabela: `id uuid`, `criado_em timestamptz`, `atualizado_em timestamptz`.
- RLS **obrigatório em 100% das tabelas**, com as 4 políticas (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) explícitas — nunca `RLS OFF`, nem para `DEV_ADMIN`/`SUPER_ADMIN` (acesso dele é uma policy própria, não ausência de RLS).
- Toda tabela de domínio carrega `contador_id`/`empresa_id` (direto ou via join), conforme a cascata de `docs/SEGURANCA.md §4`.
- Decisões já fechadas (2026-09-06): **toda empresa pertence a um contador** (`empresas.contador_id` sempre `NOT NULL`; cliente sem contador humano usa um contador `tipo = 'interno_jota'` como fallback); **crédito é carteira do contador**, não por empresa; **catálogo de papéis é fixo**, definido pela Jota (não customizável por tenant, por ora).

---

## 1. Identidade e hierarquia

### `contadores`
`id, nome, cnpj_cpf, email, telefone, tipo` (`humano`|`interno_jota`), `status, bloqueado, bloqueado_em, bloqueado_motivo, bloqueado_por` (FK `usuarios`), `stripe_customer_id` (assinatura SaaS, §3), `stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted` (Connect/honorários, §7), `criado_em, atualizado_em`

### `empresas`
`id, contador_id` (FK **not null**), `razao_social, nome_fantasia, cnpj, regime_tributario, modo_acesso_serpro` (`procuracao`|`certificado_proprio`), `status, bloqueado, bloqueado_em, bloqueado_motivo, bloqueado_por` (FK `usuarios`), `criado_em, atualizado_em`

### `papeis`
`id, nome` (`SUPER_ADMIN`, `ADMIN_FINANCEIRO`, `ADMIN_SUPORTE`, `CONTADOR_DONO`, `OPERADOR_CONTADOR`, `EMPRESARIO_DONO`, `OPERADOR_EMPRESA`), `escopo` (`plataforma`|`contador`|`empresa`), `descricao`

### `permissoes`
`id, recurso` (ex: `empresa`, `certificado`, `fatura`, `credito`), `acao` (`visualizar`|`criar`|`editar`|`excluir`|`bloquear`), `chave` (`recurso:acao`, gerada de recurso+acao)

### `papel_permissoes`
`papel_id` (FK), `permissao_id` (FK) — matriz N:N, resolvida pelo `ServicoDePermissoes` (`docs/ARQUITETURA.md §Permissões`)

### `usuarios`
Autenticação via **Supabase Auth** (decisão de 2026-09-06, mesmo padrão do DeliveryHub) — `usuarios` é tabela de **perfil**, não de credencial: `id` (PK, = `auth.users.id`, sem default próprio), `nome, email` (espelho de `auth.users.email`, útil pra join/exibição sem round-trip), `papel_id` (FK `papeis`), `contador_id` (FK nullable), `empresa_id` (FK nullable), `mfa_habilitado` (espelha MFA nativo do Supabase Auth, cache pra UI), `status, bloqueado, bloqueado_em, bloqueado_motivo, bloqueado_por` (FK `usuarios`, auto-referência), `ultimo_login_em, criado_em, atualizado_em`.

Sem `senha_hash` (Supabase Auth guarda isso em `auth.users`, nunca duplicar) e sem tabela `refresh_tokens` própria (Supabase Auth já tem a dele em `auth`, não replicar).

O `escopo` do `papel_id` do usuário precisa bater com o vínculo preenchido:

| Escopo do papel | `contador_id` | `empresa_id` | Exemplo |
|---|---|---|---|
| `plataforma` | null | null | equipe da Jota (financeiro, suporte, super admin) |
| `contador` | preenchido | null | equipe do escritório contábil |
| `empresa` | (via join) | preenchido | equipe da empresa cliente |

Validar essa coerência na camada Application (não só confiar em constraint de banco) ao criar/editar usuário.

**Sincronização com `auth.users.app_metadata`** (mesmo padrão do `user_metadata.role` do DeliveryHub): toda vez que `usuarios.papel_id`/`contador_id`/`empresa_id` muda, o backend (via Admin API, service role) atualiza `app_metadata` do usuário no Supabase Auth com `{ papel: 'CONTADOR_DONO', contador_id: '...', empresa_id: null }`. As policies de RLS leem direto de `auth.jwt() -> 'app_metadata'` — nunca fazem subquery em `usuarios` (evita recursão de RLS e reconsulta ao banco a cada policy). Funções auxiliares SQL (`auth_contador_id()`, `auth_empresa_id()`, `auth_papel()`, `eh_super_admin()`) encapsulam essa leitura pra não repetir a expressão JSON em toda política.

---

## 2. Acesso ao SERPRO (dois modos — `docs/SEGURANCA.md §1-2`)

### `procuracoes` (Modo A)
`id, empresa_id` (FK), `status` (`ativa`|`expirada`|`revogada`|`pendente`), `outorgada_em, expira_em, revogada_em, verificado_em` (última sincronização com o serviço `PROCURACOES` do SERPRO), `criado_em, atualizado_em`

### `certificados` (Modo B)
`id, empresa_id` (FK), `tipo` (A1|A3), `arquivo_ref, senha_ref` (referências ao cofre/Secret Manager — nunca o dado em claro na tabela), `validade_inicio, validade_fim, status` (`ativo`|`expirado`|`revogado`|`substituido`), `criado_em, atualizado_em`

Certificado da própria Jota (usado no Modo A) **não é uma linha aqui** — vive só em Secret Manager, é config de infraestrutura da plataforma, não registro de domínio.

---

## 3. Assinatura SaaS — contador paga a Jota (créditos SERPRO)

Sem Stripe Connect aqui — a Jota é a única recebedora, é cobrança direta (Stripe Checkout + Subscriptions, conta única da plataforma). Confirmado (2026-09-06): webhook é real, não lançamento manual — mesmo padrão do Stripe Connect do DeliveryHub (webhook assinado, confia direto).

### `planos`
`id, nome, operacoes_incluidas, preco, periodicidade, ativo`

### `assinaturas`
`id, contador_id` (FK), `plano_id` (FK), `stripe_subscription_id`, `status` (`ativa`|`cancelada`|`inadimplente`), `inicio_em, fim_em, renovacao_automatica`

### `creditos_saldo`
`contador_id` (FK, PK), `saldo_atual, atualizado_em` — cache mutável do saldo corrente

### `creditos_movimentos`
`id, contador_id` (FK), `empresa_id` (FK — qual empresa gerou o consumo, para rastreabilidade mesmo o saldo sendo do contador), `tipo_operacao, quantidade, saldo_antes, saldo_depois, motivo, criado_em` — **imutável**, ledger de auditoria (`docs/SEGURANCA.md §6`)

### `faturas`
`id, contador_id` (FK), `assinatura_id` (FK), `stripe_invoice_id`, `valor, competencia, vencimento, status` (`pendente`|`paga`|`atrasada`|`cancelada`), `pago_em, criado_em`

### `webhook_eventos_processados`
`id, gateway` (Stripe, e futuros), `evento_id, processado_em` — idempotência genérica: todo handler de webhook checa aqui antes de aplicar efeito (crédito, mudança de status), evita duplicar em retry do gateway. Compartilhada entre este módulo e o de honorários (§7).

`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` da plataforma ficam em `.env`/Secret Manager — **nunca em tabela**, ao contrário do padrão usado no DeliveryHub/GESTAO_PROJETOS_VUE (`configuracoes_pagamentos` em banco) — aqui seguimos a política mais estrita já adotada neste projeto (`docs/SEGURANCA.md`, `ADR-002`: segredo nunca no banco).

---

## 4. Integração SERPRO e dados fiscais

### `consultas_serpro`
`id, contador_id, empresa_id` (FKs), `id_sistema, id_servico, sucesso, codigo_erro, creditos_consumidos, criado_em` — log de toda chamada (sem payload sensível bruto), liga consumo de crédito ao resultado da chamada

### `documentos_fiscais`
`id, empresa_id` (FK), `tipo` (NFe|NFCe|CTe|NFSe), `numero, chave_acesso, valor_total, data_emissao, situacao, xml_ref, criado_em`

`documentos_fiscais_itens` (NCM/CFOP/CST por produto/linha) fica fora do MVP — normalizar na Fase 2 sem impacto no resto do schema.

### `declaracoes_pgdas` (Fase 3 — Simples Nacional)
`id, empresa_id` (FK), `competencia, receita_bruta, valor_das, status, vencimento, criado_em`

---

## 5. Caixa Postal

### `mensagens_caixa_postal`
`id, empresa_id` (FK), `orgao, assunto, status` (`lida`|`nao_lida`), `data_recebimento, conteudo_ref, criado_em`

---

## 6. Auditoria

### `logs_auditoria`
`id, usuario_id, contador_id, empresa_id` (FKs nullable), `acao, recurso, dados_antigos jsonb, dados_novos jsonb, ip, user_agent, criado_em` — **imutável** (só `INSERT`, nunca `UPDATE`/`DELETE` — `ARCHITECTURE_SECURITY_RULES 2.md §14`)

Toda ação de bloqueio/desbloqueio (`contadores`, `empresas`, `usuarios`) gera entrada aqui — mesmo padrão já usado no `/admin/usuarios` do DeliveryHub.

---

## 7. Honorários — empresa paga o contador, Jota comissiona (Stripe Connect)

Sistema **separado** do §3 — aqui o dinheiro é da empresa para o contador (pagamento de honorários contábeis), a Jota só intermedia e fica com comissão. Replica o padrão já validado em produção no DeliveryHub (Stripe Connect, contas Express, destination charge + `application_fee_amount`) — ver `[[project_deliveryhub]]` na memória para o histórico de implementação (onboarding, gotchas de conta de teste, etc.).

### Onboarding (campos em `contadores`, não tabela nova)
`stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted` — sincronizados via webhook `account.updated` (assinado, confia direto). Contador clica "Conectar com Stripe" → backend cria conta Express (`accounts.create`) + link de onboarding hospedado (`accountLinks.create`) — mesmo fluxo do `/restaurante/config` do DeliveryHub.

### `configuracoes_plataforma`
Singleton (uma linha só): `comissao_honorarios_pct, atualizado_em, atualizado_por` (FK `usuarios`). **Comissão fixa e global da Jota** (decisão de 2026-09-06) — não é por contador nem por plano. Editável só por `SUPER_ADMIN`/`ADMIN_FINANCEIRO`, gera `logs_auditoria` a cada mudança (é parâmetro financeiro, afeta toda cobrança nova a partir da alteração).

### `cobrancas_honorarios`
`id, contador_id` (FK), `empresa_id` (FK), `descricao, valor, comissao_pct, comissao_valor, stripe_payment_intent_id, status` (`pendente`|`pago`|`falhou`|`estornado`), `criado_em, atualizado_em, pago_em`

`comissao_pct` é **congelado por cobrança** no momento da criação, copiado de `configuracoes_plataforma.comissao_honorarios_pct` — nunca recalculado depois. Se a Jota mudar a comissão global amanhã, cobranças já criadas mantêm a taxa antiga; só as novas usam a nova. Nunca fazer `cobrancas_honorarios` referenciar `configuracoes_plataforma` ao vivo (JOIN) para exibir/cobrar — é snapshot histórico, igual a preço de item em pedido já fechado.

PaymentIntent criado como **destination charge**: `amount` = `valor`, `transfer_data.destination` = `contadores.stripe_account_id`, `application_fee_amount` = `comissao_valor` — dinheiro vive na conta da plataforma até o split, comissão retida automaticamente (mesmo mecanismo do DeliveryHub, `comissao_pct`/`comissao_padrao_pct`).

**Isolamento obrigatório:** toda `cobranca_honorario` valida que `empresa_id` pertence à carteira do `contador_id` que está cobrando — nunca permitir contador cobrar (mesmo via conta conectada própria) uma empresa que não é cliente dele (mesma regra de posse de `docs/SEGURANCA.md §4`, aplicada a um novo tipo de recurso).

**Gating de disponibilidade:** empresa só vê opção de pagar honorário via cartão se `contadores.stripe_charges_enabled = true` (mesmo padrão do campo `stripe_disponivel` do catálogo público no DeliveryHub) — nunca mostrar opção de pagamento que não vai processar nada.

Webhooks: `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated` — todos assinados, verificar `stripe-signature` e checar `webhook_eventos_processados` (§3) antes de aplicar efeito.

---

## Papéis do catálogo fixo (v1)

| Papel | Escopo | Uso típico |
|---|---|---|
| `SUPER_ADMIN` | plataforma | acesso total, inclusive rotação do certificado da plataforma |
| `ADMIN_FINANCEIRO` | plataforma | vê/gerencia planos, faturas, pagamentos — não bloqueia contador/empresa |
| `ADMIN_SUPORTE` | plataforma | visão ampla para atendimento — não mexe em créditos/financeiro |
| `CONTADOR_DONO` | contador | dono do escritório, gerencia carteira inteira e equipe própria |
| `OPERADOR_CONTADOR` | contador | funcionário do escritório, sem gerenciar equipe/financeiro do contador |
| `EMPRESARIO_DONO` | empresa | dono da empresa cliente, acesso completo aos próprios dados |
| `OPERADOR_EMPRESA` | empresa | funcionário da empresa cliente, acesso restrito (ex: só Caixa Postal/documentos) |

Catálogo fixo por decisão explícita (2026-09-06) — evoluir para papéis customizáveis por tenant só se aparecer demanda real.

---

## Pendências em aberto

- Mecânica exata de autenticação do Modo B (certificado próprio) junto ao SERPRO — não confirmada, não implementar sem validar antes (`docs/SEGURANCA.md §1`).
- ~~`pagamentos`: webhook real vs. manual~~ — **resolvido (2026-09-06):** webhook real, mesmo padrão do Connect do DeliveryHub (assinado, confia direto).
- `documentos_fiscais_itens` (granularidade de NCM/CFOP por produto) — adiado pra Fase 2.
- ~~`comissao_pct` de honorários: por contador, por plano, ou fixo global?~~ — **resolvido (2026-09-06):** comissão fixa e global da Jota, tabela `configuracoes_plataforma` (§7).
