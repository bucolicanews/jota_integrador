# Estratégia de Testes — jota_integrador_backend (JOTA FISCAL)

Complementa `docs/ARQUITETURA.md` (testabilidade nasce da separação em camadas) e `docs/SEGURANCA.md` (o pentest/code review do vault é parte obrigatória do fluxo de release, não um extra).

## Pirâmide de testes

1. **Unitários** — Domain e Application (use cases). Cobrem regra de negócio pura: cálculo de saldo de crédito, regras de "empresa regular vs. com pendência", parsing/validação de XML de NF-e, matriz de permissões. Sem tocar banco/rede — mockar Infrastructure.
2. **Integração** — Controllers + banco real (ambiente de teste) + RLS. Validam que a camada HTTP + Supabase se comportam juntas, inclusive políticas de RLS.
3. **E2E** — fluxos completos ponta a ponta nos cenários críticos abaixo.

## Fluxos E2E obrigatórios

- Login e onboarding de contador → cadastro de empresa cliente → configuração do modo de acesso ao SERPRO (procuração eletrônica **ou** upload de certificado próprio, ver `docs/SEGURANCA.md §1`).
- Consulta de situação fiscal de uma empresa (CNPJ, Simples Nacional) consumindo crédito corretamente.
- Importação de NF-e/CT-e e exibição no módulo de documentos fiscais.
- Consulta e leitura de mensagem na Caixa Postal, com atualização de status (lida/não lida).
- Contador acessando o dashboard da carteira (múltiplas empresas agregadas).
- Certificado da plataforma expirando → alerta disparado para operação da Jota. Procuração de uma empresa expirando/revogada → alerta disparado para contador e empresário.

## Testes de segurança multi-tenant (obrigatórios, não opcionais)

Todo endpoint que recebe `empresa_id`/`contador_id` (via path, query ou body) precisa de teste automatizado que prove o isolamento, não apenas revisão manual:

- Contador A autenticado tentando acessar/listar/alterar empresa que pertence ao Contador B → deve falhar (403/404), nunca vazar dado.
- Usuário empresário da Empresa X tentando acessar dado da Empresa Y (mesmo contador ou não) → deve falhar.
- IDs sequenciais/previsíveis trocados manualmente na URL (`/empresas/:id/documentos`) → deve validar posse, não só existência do recurso.
- RLS desligado acidentalmente (ex: migration nova sem policy) → pipeline deve ter um teste que falha se qualquer tabela de domínio estiver com RLS `OFF` ou sem as 4 policies (SELECT/INSERT/UPDATE/DELETE).

Antes de merge para `main`/deploy: rodar o `PENTEST_CODE_REVIEW_PROTOCOL.md` do vault (`may_memory/21-SEGURANCA/`) com o formato de saída obrigatório dele (tabela de risco → detalhamento → patch → script de teste). Severidade Crítica (BOLA/IDOR entre contadores/empresas, RCE, SQLi) bloqueia o deploy.

## Certificado digital e procuração (dois modos)

Testar os dois modos de acesso separadamente (`docs/SEGURANCA.md §1`), nunca assumir que só um existe:

- Testar que nenhum certificado (plataforma ou de empresa) aparece em texto puro em resposta de API, log, ou payload de fila — incluir asserção negativa (`expect(response.body).not.toContain(...)`) no teste de integração do `SerproAuthService`.
- Testar rotação de certificado nos dois modos: versão antiga fica inacessível após substituição, sem downtime.
- Testar alerta de expiração: certificado da plataforma (Modo A, 60/30/15/7 dias — pior cenário, derruba acesso de todo mundo em Modo A) e certificado de empresa (Modo B, mesmos limiares, mas afeta só aquela empresa).
- Testar bloqueio de chamada quando a **procuração** de uma empresa em Modo A não está ativa, e quando o **certificado** de uma empresa em Modo B está ausente/expirado — os dois casos devem barrar antes de gastar crédito e antes de chamar o SERPRO (`docs/SEGURANCA.md §2`), com mensagem clara pro contador/empresário, não erro genérico.
- Testar que uma empresa em Modo B nunca acidentalmente tenta usar o certificado da plataforma (ou vice-versa) — o `SerproAuthService` deve escolher o fluxo certo a partir de `modo_acesso_serpro`, com teste que cobre os dois ramos.

## Integração com SERPRO

Confirmado (2026-09-06): o Integra Contador tem um **ambiente de demonstração/trial real e separado** da produção — não é preciso mock puro para a maior parte dos testes de integração:

- **Trial:** `https://gateway.apiserpro.serpro.gov.br/integra-contador-trial/v1/` — usa CNPJ fixo `00000000000000` em `contratante`/`autorPedidoDados`/`contribuinte`, só `Authorization: Bearer <token de demonstração>` (sem certificado, sem `jwt_token`), cada serviço (`idSistema`/`idServico`) tem cenário documentado com payload e resposta esperada em `.../cenarios_trial/cenarios_<servico>/`. Usar essa URL (configurável via env, nunca hardcoded) como alvo dos testes de integração automatizados do `SerproClient` — cobre o "caminho feliz" de cada serviço real, sem custo e sem risco de dado de produção.
- **Produção:** `https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/` — **nunca** usada em testes automatizados/CI. Só em uso real (via certificado + procuração ativa de um cliente de verdade). Qualquer teste manual exploratório contra produção exige autorização explícita e nunca deve rodar em CI.
- **Mock/stub** ainda é necessário para cenários que o trial não reproduz sob demanda: timeout, 500, cota excedida, 401 forçado (pra testar o retry de reautenticação do `SerproAuthService`). Usar mock nesses casos, trial nos demais.
- Testar o comportamento do sistema quando o SERPRO está indisponível (timeout, 500, cota estourada) — deve degradar graciosamente, nunca vazar stack trace pro usuário nem travar consumo de crédito de forma inconsistente (ver próximo item).
- Testar explicitamente que "chamada ao SERPRO falhou" e "crédito debitado" nunca ficam dessincronizados (a atomicidade exigida em `docs/SEGURANCA.md §5` precisa de teste que force a falha no meio da operação).
- Testar que uma resposta do **trial** nunca é confundida com dado real em nenhum ambiente que não seja teste — o CNPJ fixo `00000000000000` não deve poder aparecer associado a uma empresa real no banco.

## Sistema de créditos

- Teste de concorrência: duas requisições simultâneas da mesma empresa não podem consumir crédito além do saldo disponível (race condition).
- Teste de auditoria: toda alteração de saldo gera exatamente um registro imutável, com saldo antes/depois coerente.

## Cobertura e critério de qualidade

- Lógica de domínio fiscal e de créditos: alvo de cobertura alto (linha e branch) — é onde bug vira prejuízo financeiro ou fiscal para o cliente.
- Controllers/DTOs finos: cobertura via teste de integração é suficiente, não precisam de unitário próprio se não têm lógica.
- Pipeline CI (DevSecOps, herdado do vault): lint → testes (unit+integration) → SAST → dependency scan → secret scan → build. Falha crítica em qualquer etapa bloqueia o deploy.
