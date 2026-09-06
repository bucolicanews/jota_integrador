# jota_integrador_backend — JOTA FISCAL (backend)

Este repositório (GitHub: `jota_integrador_backend`, pasta local ainda chamada `jota_integrador` por questão de sincronização do OneDrive) é o **backend** (NestJS/API) do JOTA FISCAL. O frontend (React + Vite) vive em repositório separado: [`jota_integrador_frontend`](https://github.com/bucolicanews/jota_integrador_frontend) (`C:\Users\jotac\OneDrive\Documents\DEV\jota_fiscal_frontend`, mesma ressalva de nome de pasta local), que consulta os docs deste repo (`docs/`) para segurança/arquitetura/testes/UX-UI em vez de duplicá-los.

## Nomenclatura

Todo nome de domínio (módulos, entidades, tabelas, variáveis de negócio) é em **português**: `contadores`, `empresas`, `documentos-fiscais`, `RegistroDeCreditos`. Jargão técnico universal (Controller, Service, DTO, guard, tenant/multi-tenant) permanece em inglês — mesma convenção já usada nos documentos de engenharia do vault.

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

Cada empresa acessa o SERPRO por um de dois modos (ver `docs/SEGURANCA.md §1-2`): **Modo A** — procuração eletrônica outorgada à Jota, usando o certificado e-CNPJ único da própria Jota (`Role-Type: TERCEIROS`) para autenticar em nome de todos os clientes nesse modo; **Modo B** — certificado digital próprio, cadastrado individualmente por aquela empresa. O certificado da Jota (Modo A) é o dado mais crítico do sistema — perdê-lo compromete o acesso a todos os clientes desse modo de uma vez, não só um. Cada certificado individual (Modo B) tem o cuidado de sempre: nunca um arquivo comum, sempre cofre isolado por empresa.

---

## Memória — sempre consultar antes de trabalhar

Antes de responder ou implementar qualquer coisa neste projeto, **consulte primeiro a memória persistente** em:

`C:\Users\jotac\.claude\projects\C--Users-jotac-OneDrive-Documents-DEV\memory\MEMORY.md`

E o vault Obsidian `may_memory` (`C:\Users\jotac\OneDrive\Documents\DEV\may_memory`, `INDEX.md` como MOC raiz) — fonte cross-project de mais alta autoridade. Releia antes de:

- Qualquer decisão de **segurança/arquitetura** → `docs/SEGURANCA.md` deste projeto (que herda de `may_memory/21-SEGURANCA/`) — especialmente antes de tocar em certificado digital, credenciais SERPRO, ou qualquer endpoint que cruze contador/empresa.
- Qualquer tarefa de **UX/UI/design** → `docs/UX-UI.md` deste projeto (que herda de `may_memory/26-DESIGNER/DIRETRIZES-UX-UI.md`).
- Qualquer trabalho de **arquitetura/engenharia** (services, controllers, permissões, DDD) → `docs/ARQUITETURA.md` (que herda de `may_memory/22-ENGENHARIA/DIRETRIZES-ENGENHARIA-SOFTWARE.md`).
- Qualquer implementação de **testes** → `docs/TESTES.md`.
- Qualquer trabalho de **schema/tabelas/migration** → `docs/BANCO_DE_DADOS.md`.

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
- Expor qualquer certificado digital (da plataforma ou de empresa), chave privada, ou credencial SERPRO ao frontend/browser.
- Armazenar qualquer certificado digital sem criptografia em repouso + cofre dedicado.
- Assumir que toda empresa usa o mesmo modo de acesso ao SERPRO, ou pular a checagem de procuração (Modo A)/certificado válido (Modo B) antes de consultar.
- Criar endpoint sem autenticação, autorização (RBAC+ABAC) e auditoria.
- Usar `any` em DTO de entrada, SQL concatenado, ou `dangerouslySetInnerHTML` sem sanitização.
- Decrementar crédito de uso sem transação atômica + registro de auditoria.
- Testar contra ambiente de produção do SERPRO — apenas staging/sandbox, com autorização explícita antes de executar.

---

## Documentos deste projeto

- [docs/SEGURANCA.md](docs/SEGURANCA.md) — política de segurança específica do JOTA FISCAL
- [docs/ARQUITETURA.md](docs/ARQUITETURA.md) — camadas, permissões, padrões de código
- [docs/BANCO_DE_DADOS.md](docs/BANCO_DE_DADOS.md) — schema completo das tabelas
- [docs/TESTES.md](docs/TESTES.md) — estratégia e obrigatoriedade de testes
- [docs/UX-UI.md](docs/UX-UI.md) — diretrizes de design aplicadas aos dois perfis (empresário/contador)

## Repositórios do projeto

| Repositório (GitHub) | Papel | Pasta local |
|---|---|---|
| `jota_integrador_backend` (este) | Backend — NestJS/API | `DEV/jota_integrador` |
| `jota_integrador_frontend` | Frontend — React + Vite | `DEV/jota_fiscal_frontend` |

Nomes de pasta local ficaram defasados em relação ao nome do repo no GitHub (renomeado depois de criado, OneDrive bloqueou o rename local) — não afeta o funcionamento, só cuidado ao procurar a pasta pelo nome do repo.

Sem git submodule entre eles (ao contrário do DeliveryHub) — repositórios independentes, comunicação só via API HTTP, para evitar os problemas de sincronização (`.env`, `node_modules`, hash de commit divergente) já documentados na memória do DeliveryHub.
