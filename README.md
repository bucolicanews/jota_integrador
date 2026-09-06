# JOTA FISCAL — Backend

Backend/API (NestJS) da plataforma JOTA FISCAL — SaaS de gestão e inteligência fiscal da Jota Contabilidade/Jota Empresas. Centraliza informações fiscais de empresas conectando-se às APIs oficiais do governo (**Integra Contador / SERPRO**), sem expor essa complexidade ao cliente final.

Frontend em repositório separado: [`jota_integrador_frontend`](https://github.com/bucolicanews/jota_integrador_frontend).

Dois produtos sobre a mesma base:

- **JOTA FISCAL** — visão do empresário: "minha empresa está regular? tenho pendências?"
- **JOTA CONTÁBIL** — visão do contador: gestão de toda a carteira de empresas-clientes.

## Hierarquia

```
Dev/Admin Jota
   └── Contador (tenant)
          └── Empresa Cliente (sub-tenant do contador)
```

## Stack

- **Frontend:** React + Vite
- **Backend:** NestJS (API REST modular)
- **Banco:** PostgreSQL via Supabase
- **Fila/cache:** Redis
- **Infra:** Docker

O frontend nunca fala diretamente com o SERPRO — todo acesso passa pela API própria (NestJS), que controla autenticação, créditos, permissões, logs e auditoria.

```
Cliente → App Jota (React) → API Jota (NestJS) → SERPRO / Integra Contador
```

## Documentação

Antes de implementar qualquer coisa, ler nesta ordem:

1. [`CLAUDE.md`](CLAUDE.md) — visão geral e regras invioláveis
2. [`docs/SEGURANCA.md`](docs/SEGURANCA.md) — política de segurança (certificado digital da plataforma, procuração eletrônica, SERPRO, isolamento contador/empresa, créditos)
3. [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) — camadas, modelo de dados, permissões
4. [`docs/TESTES.md`](docs/TESTES.md) — estratégia e obrigatoriedade de testes
5. [`docs/UX-UI.md`](docs/UX-UI.md) — diretrizes de design para os dois perfis

Este projeto herda as políticas de segurança, engenharia e design do ecossistema JHON (vault `may_memory`) — os documentos acima linkam de volta para lá.

## Ponto de maior cuidado

O dado mais crítico do sistema é o **certificado digital e-CNPJ da própria Jota** — único na plataforma, não um certificado por empresa cliente. O acesso a cada empresa é liberado por procuração eletrônica, não por certificado próprio dela. Nunca versionar, nunca expor ao frontend, sempre em cofre criptografado isolado. Ver `docs/SEGURANCA.md §1-2`.

## Status

Projeto em fase inicial — regras e arquitetura definidas, implementação ainda não iniciada.
