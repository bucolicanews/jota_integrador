# Banco de Dados — jota_integrador_backend (JOTA FISCAL)

PostgreSQL via Supabase. Complementa `docs/ARQUITETURA.md` (camadas, hierarquia de entidades) e `docs/SEGURANCA.md` (RLS, classificação de dados, isolamento). Nomes de tabela/coluna em português, `snake_case` (convenção SQL padrão, não é jargão técnico a manter em inglês).

## Convenções gerais

- Toda tabela: `id uuid`, `criado_em timestamptz`, `atualizado_em timestamptz`.
- RLS **obrigatório em 100% das tabelas**, com as 4 políticas (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) explícitas — nunca `RLS OFF`, nem para `DEV_ADMIN`/`SUPER_ADMIN` (acesso dele é uma policy própria, não ausência de RLS).
- Toda tabela de domínio carrega `contador_id`/`empresa_id` (direto ou via join), conforme a cascata de `docs/SEGURANCA.md §4`.
- Decisões já fechadas (2026-09-06): **toda empresa pertence a um contador** (`empresas.contador_id` sempre `NOT NULL`; cliente sem contador humano usa um contador `tipo = 'interno_jota'` como fallback); **crédito é carteira do contador**, não por empresa; **catálogo de papéis é fixo**, definido pela Jota (não customizável por tenant, por ora).

---

## 1. Identidade e hierarquia

### `contadores`
`id, nome, cnpj_cpf, email, telefone, tipo` (`humano`|`interno_jota`), `status, bloqueado, bloqueado_em, bloqueado_motivo, bloqueado_por` (FK `usuarios`), `criado_em, atualizado_em`

### `empresas`
`id, contador_id` (FK **not null**), `razao_social, nome_fantasia, cnpj, regime_tributario, modo_acesso_serpro` (`procuracao`|`certificado_proprio`), `status, bloqueado, bloqueado_em, bloqueado_motivo, bloqueado_por` (FK `usuarios`), `criado_em, atualizado_em`

### `papeis`
`id, nome` (`SUPER_ADMIN`, `ADMIN_FINANCEIRO`, `ADMIN_SUPORTE`, `CONTADOR_DONO`, `OPERADOR_CONTADOR`, `EMPRESARIO_DONO`, `OPERADOR_EMPRESA`), `escopo` (`plataforma`|`contador`|`empresa`), `descricao`

### `permissoes`
`id, recurso` (ex: `empresa`, `certificado`, `fatura`, `credito`), `acao` (`visualizar`|`criar`|`editar`|`excluir`|`bloquear`), `chave` (`recurso:acao`, gerada de recurso+acao)

### `papel_permissoes`
`papel_id` (FK), `permissao_id` (FK) — matriz N:N, resolvida pelo `ServicoDePermissoes` (`docs/ARQUITETURA.md §Permissões`)

### `usuarios`
`id, nome, email, senha_hash, papel_id` (FK `papeis`), `contador_id` (FK nullable), `empresa_id` (FK nullable), `mfa_habilitado, mfa_secret_ref, status, bloqueado, bloqueado_em, bloqueado_motivo, bloqueado_por` (FK `usuarios`, auto-referência), `ultimo_login_em, criado_em, atualizado_em`

O `escopo` do `papel_id` do usuário precisa bater com o vínculo preenchido:

| Escopo do papel | `contador_id` | `empresa_id` | Exemplo |
|---|---|---|---|
| `plataforma` | null | null | equipe da Jota (financeiro, suporte, super admin) |
| `contador` | preenchido | null | equipe do escritório contábil |
| `empresa` | (via join) | preenchido | equipe da empresa cliente |

Validar essa coerência na camada Application (não só confiar em constraint de banco) ao criar/editar usuário.

### `refresh_tokens`
`id, usuario_id` (FK), `token_hash, expira_em, revogado, ip, user_agent, criado_em`

---

## 2. Acesso ao SERPRO (dois modos — `docs/SEGURANCA.md §1-2`)

### `procuracoes` (Modo A)
`id, empresa_id` (FK), `status` (`ativa`|`expirada`|`revogada`|`pendente`), `outorgada_em, expira_em, revogada_em, verificado_em` (última sincronização com o serviço `PROCURACOES` do SERPRO), `criado_em, atualizado_em`

### `certificados` (Modo B)
`id, empresa_id` (FK), `tipo` (A1|A3), `arquivo_ref, senha_ref` (referências ao cofre/Secret Manager — nunca o dado em claro na tabela), `validade_inicio, validade_fim, status` (`ativo`|`expirado`|`revogado`|`substituido`), `criado_em, atualizado_em`

Certificado da própria Jota (usado no Modo A) **não é uma linha aqui** — vive só em Secret Manager, é config de infraestrutura da plataforma, não registro de domínio.

---

## 3. Financeiro e créditos (carteira do contador)

### `planos`
`id, nome, operacoes_incluidas, preco, periodicidade, ativo`

### `assinaturas`
`id, contador_id` (FK), `plano_id` (FK), `status` (`ativa`|`cancelada`|`inadimplente`), `inicio_em, fim_em, renovacao_automatica`

### `creditos_saldo`
`contador_id` (FK, PK), `saldo_atual, atualizado_em` — cache mutável do saldo corrente

### `creditos_movimentos`
`id, contador_id` (FK), `empresa_id` (FK — qual empresa gerou o consumo, para rastreabilidade mesmo o saldo sendo do contador), `tipo_operacao, quantidade, saldo_antes, saldo_depois, motivo, criado_em` — **imutável**, ledger de auditoria (`docs/SEGURANCA.md §6`)

### `faturas`
`id, contador_id` (FK), `assinatura_id` (FK), `valor, competencia, vencimento, status` (`pendente`|`paga`|`atrasada`|`cancelada`), `pago_em, criado_em`

### `pagamentos`
`id, fatura_id` (FK), `gateway` (Stripe|PagBank|MercadoPago|Asaas), `gateway_transacao_id, valor, metodo` (pix|cartao|boleto), `status, criado_em` — nunca cartão/CVV em claro, só referência tokenizada do gateway

**Pendente de confirmação:** se `pagamentos` recebe webhook real de gateway (cobrança processada por este sistema) ou se é preenchido manualmente pelo admin (Jota já fatura por fora) — não decidido ainda, afeta se precisamos de `webhook signature validation` aqui (`docs/SEGURANCA.md §3`, regra geral de webhook já existe, só falta confirmar se se aplica a este módulo).

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
- `pagamentos`: webhook de gateway real vs. lançamento manual pelo admin — a confirmar.
- `documentos_fiscais_itens` (granularidade de NCM/CFOP por produto) — adiado pra Fase 2.
