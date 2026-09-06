# jota_integrador — JOTA FISCAL

## Sobre o projeto

Plataforma SaaS de gestão e inteligência fiscal para a Jota Contabilidade/Jota Empresas. Centraliza informações fiscais de empresas conectando-se às APIs oficiais do governo (**Integra Contador / SERPRO**), sem expor a complexidade dessas APIs ao cliente final.

Hierarquia de acesso (3 níveis — não é multi-tenant simples):

```
Dev/Admin Jota
   └── Contador (tenant)
          └── Empresa Cliente (sub-tenant do contador)
```

Um contador administra uma carteira de várias empresas-clientes; uma empresa-cliente só enxerga os próprios dados. Dois produtos sobre a mesma base: **JOTA FISCAL** (visão do empresário — simples, "minha empresa está regular?") e **JOTA CONTÁBIL** (visão do contador — gestão da carteira inteira).

Ver plano de produto original: `may_memory/28-JotaIntegradorFiscal/primeiroPlano.md`.

O dado mais crítico do sistema é o **certificado digital** (A1/A3) de cada empresa — permite assinar digitalmente em nome dela perante o Fisco. Trate-o com o nível de cuidado de uma chave privada de produção, não como um arquivo comum.

---

## Memória — sempre consultar antes de trabalhar

Antes de responder ou implementar qualquer coisa neste projeto, **consulte primeiro a memória persistente** em:

`C:\Users\jotac\.claude\projects\C--Users-jotac-OneDrive-Documents-DEV\memory\MEMORY.md`

E o vault Obsidian `may_memory` (`C:\Users\jotac\OneDrive\Documents\DEV\may_memory`, `INDEX.md` como MOC raiz) — fonte cross-project de mais alta autoridade. Releia antes de:

- Qualquer decisão de **segurança/arquitetura** → `docs/SEGURANCA.md` deste projeto (que herda de `may_memory/21-SEGURANCA/`) — especialmente antes de tocar em certificado digital, credenciais SERPRO, ou qualquer endpoint que cruze contador/empresa.
- Qualquer tarefa de **UX/UI/design** → `docs/UX-UI.md` deste projeto (que herda de `may_memory/26-DESIGNER/DIRETRIZES-UX-UI.md`).
- Qualquer trabalho de **arquitetura/engenharia** (services, controllers, permissões, DDD) → `docs/ARQUITETURA.md` (que herda de `may_memory/22-ENGENHARIA/DIRETRIZES-ENGENHARIA-SOFTWARE.md`).
- Qualquer implementação de **testes** → `docs/TESTES.md`.

Se uma memória ou documento do vault citar um arquivo/função específico, confirme que ainda existe antes de agir sobre ela — memórias são fotografias no tempo, não estado ao vivo.

---

## Stack

- **Frontend:** React + Vite
- **Backend:** NestJS (API REST, modular por domínio)
- **Banco:** PostgreSQL via Supabase
- **Fila/cache:** Redis
- **Infra:** Docker

> Nota: o `ADR-001-STACK-OFICIAL.md` do vault (2026-05-14) registra Vue/Nuxt como stack oficial do ecossistema, mas a prática real migrou para React (DeliveryHub, e o plano original deste projeto) — seguimos React aqui. Se isso for formalizado, atualizar o ADR no vault.

Regra de ouro da arquitetura: **o frontend nunca fala diretamente com o SERPRO**. Todo acesso passa por uma API própria da Jota (NestJS), que controla autenticação, créditos, permissões, logs e auditoria.

```
Cliente → App Jota (React) → API Jota (NestJS) → SERPRO / Integra Contador
```

---

## Regras invioláveis (resumo — detalhe completo em docs/SEGURANCA.md)

A IA nunca deve, neste projeto:

- Desativar RLS ou criar tabela sem política de tenant.
- Deixar um contador acessar/listar empresa fora da própria carteira, ou uma empresa acessar dado de outra.
- Expor certificado digital, chave privada, ou credencial SERPRO ao frontend/browser.
- Armazenar certificado digital sem criptografia em repouso + cofre dedicado.
- Criar endpoint sem autenticação, autorização (RBAC+ABAC) e auditoria.
- Usar `any` em DTO de entrada, SQL concatenado, ou `dangerouslySetInnerHTML` sem sanitização.
- Decrementar crédito de uso sem transação atômica + registro de auditoria.
- Testar contra ambiente de produção do SERPRO — apenas staging/sandbox, com autorização explícita antes de executar.

---

## Documentos deste projeto

- [docs/SEGURANCA.md](docs/SEGURANCA.md) — política de segurança específica do JOTA FISCAL
- [docs/ARQUITETURA.md](docs/ARQUITETURA.md) — modelo de dados, camadas, padrões de código
- [docs/TESTES.md](docs/TESTES.md) — estratégia e obrigatoriedade de testes
- [docs/UX-UI.md](docs/UX-UI.md) — diretrizes de design aplicadas aos dois perfis (empresário/contador)
