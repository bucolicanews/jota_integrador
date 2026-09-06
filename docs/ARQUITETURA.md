# Arquitetura — jota_integrador (JOTA FISCAL)

Herda `may_memory/22-ENGENHARIA/DIRETRIZES-ENGENHARIA-SOFTWARE.md` (SOLID, Clean Architecture, complexidade ciclomática) e `may_memory/21-SEGURANCA/ARCHITECTURE_SECURITY_RULES 1.md` (multi-tenant, RBAC/ABAC). Este documento aplica esses princípios genéricos à forma específica deste projeto.

## Visão geral

```
                    ┌─────────────────────┐
                    │      FRONTEND        │
                    │      React + Vite    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │       API JOTA        │
                    │     NestJS (REST)     │
                    └──────────┬───────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
       PostgreSQL         Redis/Queue        Cofre de Certificados
       (Supabase)                            (criptografado, isolado)
            │                  │                  │
            └──────────────────┼──────────────────┘
                               ▼
                    ┌─────────────────────┐
                    │  Serviço Integra      │
                    │  Contador / SERPRO    │
                    └──────────┬───────────┘
                               ▼
                    ┌─────────────────────┐
                    │  APIs Governamentais  │
                    └─────────────────────┘
```

O frontend **nunca** fala diretamente com o SERPRO nem com o cofre de certificados — sempre via API Jota (NestJS).

## Hierarquia de entidades

```
Tenant (Jota) — nível plataforma
   └── Accountant (Contador)         — "tenant" operacional
          └── Company (Empresa Cliente) — sub-tenant do contador
                 ├── Users (usuários da empresa)
                 ├── Certificates (cofre, 1:1 ou 1:N por empresa)
                 ├── FiscalDocuments (NF-e, NFC-e, CT-e, NFS-e, XML)
                 ├── CreditLedger (consumo/saldo de créditos)
                 ├── MailboxMessages (Caixa Postal)
                 └── AuditLog
```

Regra fundamental: nenhum registro de domínio existe sem `company_id`, e nenhuma `company` existe sem `accountant_id` (exceto operação feita pelo Dev Admin, que é auditada como tal, nunca como "sem tenant").

## Camadas (Clean Architecture)

Separar sempre:

- **Presentation** — Controllers (NestJS) / Componentes de UI (React). Só recebem requisição, validam formato (DTO), chamam o Application e devolvem resposta. Zero regra de negócio aqui.
- **Application** (Use Cases / Services) — orquestra regra de negócio: "importar NF-e", "consumir crédito e chamar SERPRO", "consultar situação fiscal".
- **Domain** — entidades e regras invariantes do domínio fiscal (ex: como calcular saldo de crédito, o que torna uma empresa "regular"), sem depender de NestJS/Supabase/HTTP.
- **Infrastructure** — acesso a Supabase, Redis, SERPRO, cofre de certificados, gateway de pagamento. Implementa interfaces definidas no Domain/Application (Dependency Inversion).

Nunca misturar regra tributária/fiscal com controller, rota ou query SQL solta.

## Permissões

Nunca usar cadeia de `if/else`/`switch` por papel:

```ts
// Proibido
if (role === "admin") ...
else if (role === "contador") ...
else if (role === "cliente") ...
```

Usar RBAC + matriz de permissões (`resource:action`, ex: `empresa:view`, `certificado:rotate`, `credito:ajustar`) resolvida por um `PermissionService`/policy, coerente com `ARCHITECTURE_SECURITY_RULES 1.md §6-9` (RBAC+ABAC). O atributo ABAC mais importante aqui é **posse** (este contador é dono desta empresa? este usuário pertence a esta empresa?) — ver `docs/SEGURANCA.md §3`.

Papéis mínimos: `DEV_ADMIN`, `CONTADOR`, `OPERADOR_CONTADOR` (funcionário do escritório contábil), `EMPRESARIO` (usuário da empresa cliente).

## Banco de dados

- Toda tabela de domínio: `id`, `company_id`, `accountant_id` (direto ou via join em `companies`), `created_at`, `updated_at`.
- Chaves estrangeiras e integridade referencial obrigatórias — nunca `company_id` solto sem FK para `companies`.
- Índices em `company_id`/`accountant_id` desde o início (são o filtro de toda query do sistema).
- RLS conforme `docs/SEGURANCA.md §3` — validar a cascata contador→empresa, não só um `tenant_id` plano.
- Evitar N+1 ao montar dashboards (situação fiscal agregada de N empresas na carteira de um contador) — usar queries agregadas/views materializadas quando necessário.

## Tratamento de erros

- Nunca deixar exceção da integração SERPRO vazar stack trace/payload cru para o cliente — capturar na camada de Infrastructure, traduzir para erro de domínio (`SerproIndisponivelError`, `CertificadoExpiradoError`) e daí para mensagem humana no Presentation.
- Result Pattern ou exceções customizadas tipadas — nunca `catch` genérico que engole erro sem log.
- Toda falha de integração externa (SERPRO fora do ar, cofre de certificado inacessível) deve isolar o impacto — não pode derrubar o restante da API.

## Limites de complexidade (herdado do vault)

- Complexidade ciclomática ideal ≤ 5, aceitável ≤ 10, acima de 15 dividir obrigatoriamente.
- Guard clauses / early return em vez de `if` aninhado.
- Componentes React até ~300 linhas; lógica complexa vai para hooks/services, não para o componente.
