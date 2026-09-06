# Estratégia de Testes — jota_integrador (JOTA FISCAL)

Complementa `docs/ARQUITETURA.md` (testabilidade nasce da separação em camadas) e `docs/SEGURANCA.md` (o pentest/code review do vault é parte obrigatória do fluxo de release, não um extra).

## Pirâmide de testes

1. **Unitários** — Domain e Application (use cases). Cobrem regra de negócio pura: cálculo de saldo de crédito, regras de "empresa regular vs. com pendência", parsing/validação de XML de NF-e, matriz de permissões. Sem tocar banco/rede — mockar Infrastructure.
2. **Integração** — Controllers + banco real (ambiente de teste) + RLS. Validam que a camada HTTP + Supabase se comportam juntas, inclusive políticas de RLS.
3. **E2E** — fluxos completos ponta a ponta nos cenários críticos abaixo.

## Fluxos E2E obrigatórios

- Login e onboarding de contador → cadastro de empresa cliente → upload de certificado.
- Consulta de situação fiscal de uma empresa (CNPJ, Simples Nacional) consumindo crédito corretamente.
- Importação de NF-e/CT-e e exibição no módulo de documentos fiscais.
- Consulta e leitura de mensagem na Caixa Postal, com atualização de status (lida/não lida).
- Contador acessando o dashboard da carteira (múltiplas empresas agregadas).
- Certificado expirando → alerta disparado para contador e empresário.

## Testes de segurança multi-tenant (obrigatórios, não opcionais)

Todo endpoint que recebe `empresa_id`/`contador_id` (via path, query ou body) precisa de teste automatizado que prove o isolamento, não apenas revisão manual:

- Contador A autenticado tentando acessar/listar/alterar empresa que pertence ao Contador B → deve falhar (403/404), nunca vazar dado.
- Usuário empresário da Empresa X tentando acessar dado da Empresa Y (mesmo contador ou não) → deve falhar.
- IDs sequenciais/previsíveis trocados manualmente na URL (`/empresas/:id/documentos`) → deve validar posse, não só existência do recurso.
- RLS desligado acidentalmente (ex: migration nova sem policy) → pipeline deve ter um teste que falha se qualquer tabela de domínio estiver com RLS `OFF` ou sem as 4 policies (SELECT/INSERT/UPDATE/DELETE).

Antes de merge para `main`/deploy: rodar o `PENTEST_CODE_REVIEW_PROTOCOL.md` do vault (`may_memory/21-SEGURANCA/`) com o formato de saída obrigatório dele (tabela de risco → detalhamento → patch → script de teste). Severidade Crítica (BOLA/IDOR entre contadores/empresas, RCE, SQLi) bloqueia o deploy.

## Certificado digital e criptografia

- Testar que o certificado nunca aparece em texto puro em resposta de API, log, ou payload de fila — incluir asserção negativa (`expect(response.body).not.toContain(...)`) em testes de integração do módulo de certificados.
- Testar rotação de certificado: versão antiga fica inacessível após substituição.
- Testar alerta de expiração nos limiares definidos (30/15/7 dias).

## Integração com SERPRO

- **Nunca** rodar suíte de testes automatizada contra o SERPRO de produção. Usar sandbox oficial do Integra Contador ou um mock/stub que simule as respostas (sucesso, erro, timeout, cota excedida).
- Testar o comportamento do sistema quando o SERPRO está indisponível (timeout, 500, cota estourada) — deve degradar graciosamente, nunca vazar stack trace pro usuário nem travar consumo de crédito de forma inconsistente (ver próximo item).
- Testar explicitamente que "chamada ao SERPRO falhou" e "crédito debitado" nunca ficam dessincronizados (a atomicidade exigida em `docs/SEGURANCA.md §5` precisa de teste que force a falha no meio da operação).

## Sistema de créditos

- Teste de concorrência: duas requisições simultâneas da mesma empresa não podem consumir crédito além do saldo disponível (race condition).
- Teste de auditoria: toda alteração de saldo gera exatamente um registro imutável, com saldo antes/depois coerente.

## Cobertura e critério de qualidade

- Lógica de domínio fiscal e de créditos: alvo de cobertura alto (linha e branch) — é onde bug vira prejuízo financeiro ou fiscal para o cliente.
- Controllers/DTOs finos: cobertura via teste de integração é suficiente, não precisam de unitário próprio se não têm lógica.
- Pipeline CI (DevSecOps, herdado do vault): lint → testes (unit+integration) → SAST → dependency scan → secret scan → build. Falha crítica em qualquer etapa bloqueia o deploy.
