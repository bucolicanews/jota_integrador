# Arquitetura — jota_integrador_backend (JOTA FISCAL)

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
       PostgreSQL         Redis/Queue        Cofre do Certificado
       (Supabase)         (cache de tokens)  da Plataforma (único,
            │                  │             e-CNPJ da Jota)
            └──────────────────┼──────────────────┘
                               ▼
                    ┌─────────────────────┐
                    │  SerproAuthService +  │
                    │  SerproClient         │
                    └──────────┬───────────┘
                               ▼
                    ┌─────────────────────┐
                    │  Integra Contador /   │
                    │  SERPRO (trial/prod)  │
                    └─────────────────────┘
```

O frontend **nunca** fala diretamente com o SERPRO nem com o cofre de certificado — sempre via API Jota (NestJS). O certificado é **único na plataforma** (da Jota, não por empresa) — ver `docs/SEGURANCA.md §1`; o acesso por empresa é controlado por procuração eletrônica (`docs/SEGURANCA.md §2`), não por certificado.

## Hierarquia de entidades

Nomenclatura de domínio em português (pastas, módulos, entidades, tabelas) — jargão técnico genérico (Controller, Service, DTO, hook) permanece em inglês, como convenção universal já usada até nos documentos de engenharia do vault.

```
Plataforma (Jota)
   ├── CertificadoPlataforma (único, e-CNPJ da Jota — config de infra, não é entidade de domínio)
   └── Contador                        — "tenant" operacional
          └── Empresa (empresa cliente) — sub-tenant do contador
                 ├── Usuarios (usuários da empresa)
                 ├── Procuracao (status ativa/expirada/revogada/pendente — autoriza consulta ao SERPRO)
                 ├── DocumentosFiscais (NF-e, NFC-e, CT-e, NFS-e, XML)
                 ├── RegistroDeCreditos (consumo/saldo de créditos)
                 ├── MensagensCaixaPostal (Caixa Postal)
                 └── LogAuditoria
```

Regra fundamental: nenhum registro de domínio existe sem `empresa_id`, e nenhuma `empresa` existe sem `contador_id` (exceto operação feita pelo Dev Admin, que é auditada como tal, nunca como "sem tenant").

## Camadas (Clean Architecture)

Separar sempre:

- **Presentation** — Controllers (NestJS) / Componentes de UI (React). Só recebem requisição, validam formato (DTO), chamam o Application e devolvem resposta. Zero regra de negócio aqui.
- **Application** (Use Cases / Services) — orquestra regra de negócio: "importar NF-e", "consumir crédito e chamar SERPRO", "consultar situação fiscal".
- **Domain** — entidades e regras invariantes do domínio fiscal (ex: como calcular saldo de crédito, o que torna uma empresa "regular"), sem depender de NestJS/Supabase/HTTP.
- **Infrastructure** — acesso a Supabase, Redis, SERPRO, cofre do certificado da plataforma, gateway de pagamento. Implementa interfaces definidas no Domain/Application (Dependency Inversion).

Nunca misturar regra tributária/fiscal com controller, rota ou query SQL solta.

## Permissões

Nunca usar cadeia de `if/else`/`switch` por papel:

```ts
// Proibido
if (role === "admin") ...
else if (role === "contador") ...
else if (role === "cliente") ...
```

Usar RBAC + matriz de permissões (`recurso:acao`, ex: `empresa:visualizar`, `procuracao:consultar`, `credito:ajustar`) resolvida por um serviço/policy de permissão (`ServicoDePermissoes`), coerente com `ARCHITECTURE_SECURITY_RULES 1.md §6-9` (RBAC+ABAC). O atributo ABAC mais importante aqui é **posse** (este contador é dono desta empresa? este usuário pertence a esta empresa?) — ver `docs/SEGURANCA.md §4`. Rotação do certificado da plataforma **não** entra nessa matriz — é operação de infraestrutura, restrita a `DEV_ADMIN` fora do fluxo normal de permissões de aplicação.

Papéis mínimos: `DEV_ADMIN`, `CONTADOR`, `OPERADOR_CONTADOR` (funcionário do escritório contábil), `EMPRESARIO` (usuário da empresa cliente).

## Banco de dados

- Toda tabela de domínio: `id`, `empresa_id`, `contador_id` (direto ou via join em `empresas`), `criado_em`, `atualizado_em`.
- Chaves estrangeiras e integridade referencial obrigatórias — nunca `empresa_id` solto sem FK para `empresas`.
- Índices em `empresa_id`/`contador_id` desde o início (são o filtro de toda query do sistema).
- RLS conforme `docs/SEGURANCA.md §4` — validar a cascata contador→empresa, não só um `tenant_id` plano.
- Evitar N+1 ao montar dashboards (situação fiscal agregada de N empresas na carteira de um contador) — usar queries agregadas/views materializadas quando necessário.

## Tratamento de erros

- Nunca deixar exceção da integração SERPRO vazar stack trace/payload cru para o cliente — capturar na camada de Infrastructure, traduzir para erro de domínio (`SerproIndisponivelError`, `CertificadoExpiradoError`) e daí para mensagem humana no Presentation.
- Result Pattern ou exceções customizadas tipadas — nunca `catch` genérico que engole erro sem log.
- Toda falha de integração externa (SERPRO fora do ar, cofre do certificado inacessível) deve isolar o impacto — não pode derrubar o restante da API.

## Limites de complexidade (herdado do vault)

- Complexidade ciclomática ideal ≤ 5, aceitável ≤ 10, acima de 15 dividir obrigatoriamente.
- Guard clauses / early return em vez de `if` aninhado.
- Componentes React até ~300 linhas; lógica complexa vai para hooks/services, não para o componente.
