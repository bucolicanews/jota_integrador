# UX/UI — jota_integrador_backend (JOTA FISCAL / JOTA CONTÁBIL)

Herda integralmente `may_memory/26-DESIGNER/DIRETRIZES-UX-UI.md` (HCD/ISO 9241-210, usabilidade ISO 9241-11, 5 Planos de Garrett, heurísticas de Nielsen, acessibilidade WCAG, Lean UX). Antes de considerar qualquer tela "pronta", rodar o checklist completo desse documento. Aqui só entram as adaptações específicas dos dois perfis deste produto.

## Dois perfis, duas experiências

### JOTA FISCAL (empresário/cliente final)

- Linguagem 100% não-técnica. O empresário nunca deve ver "Erro 500", "CFOP inconsistente" cru ou stack trace — traduzir tudo para frases como as do plano original:
  - "Sua empresa está regular?"
  - "Você tem pendências?"
  - "Quanto vendeu neste mês?"
  - "Tem documento fiscal novo?"
- Dashboard com semáforo de status (🟢 Regular / 🟡 Atenção / 🔴 Pendência) como padrão visual único e consistente em toda a aplicação (heurística 4 de Nielsen — consistência).
- Cada alerta gerado pelo motor de inteligência fiscal precisa vir com ação sugerida, não só o aviso (heurística 9 — ajudar a se recuperar do erro): "3 notas com NCM divergente → Revisar agora".
- Onboarding do upload de certificado digital é um ponto de alta ansiedade (o usuário está entregando algo sensível) — usar feedback de status claro em cada etapa (heurística 1 — visibilidade do sistema): recebido → validado → armazenado com segurança → conectado ao SERPRO.

### JOTA CONTÁBIL (contador/escritório)

- Foco em densidade de informação e velocidade de triagem, não em simplicidade — o contador gerencia dezenas/centenas de empresas e precisa escanear rápido:
  ```
  Clientes: 237
  🟢 Regular       198
  🟡 Atenção        31
  🔴 Pendência       8
  ```
- Drill-down sempre em 1 clique: Carteira → Empresa → Situação fiscal completa.
- Ações em lote (ex: reenviar alerta, revisar pendência) para não forçar o contador a repetir a mesma ação empresa por empresa — eficiência e flexibilidade (heurística 7).
- Filtros persistentes (por status, por vencimento, por tipo de pendência) — reconhecimento em vez de memorização (heurística 6).

## Certificado digital e créditos — cuidados de UX específicos

- Nunca pedir confirmação de ação irreversível sobre certificado (substituir/revogar) sem um passo de confirmação explícito e uma explicação do impacto (heurística 5 — prevenção de erros; controle e liberdade, heurística 3).
- Saldo de créditos sempre visível para quem pode gastá-lo, com aviso antecipado de saldo baixo — nunca deixar uma operação falhar "de surpresa" por falta de crédito no meio do fluxo.
- Seguir a recomendação do plano original: não expor o custo em créditos de cada operação individual de forma granular ao usuário final — comunicar como "operações fiscais incluídas no plano", mantendo a lógica de custo por operação apenas internamente.

## Caixa Postal Fiscal

- Notificação proativa (não só passiva) de nova comunicação oficial — é o tipo de informação que gera passivo se ignorada (multa, prazo perdido). Tratar como prioridade de visibilidade do sistema (heurística 1), não como mais um item de lista.

## Acessibilidade (checklist B do vault, obrigatório)

- Navegação por teclado completa em ambos os perfis, especialmente nas tabelas densas do JOTA CONTÁBIL (Tab/Enter, foco visível).
- Contraste mínimo 4.5:1 nos indicadores de status (🟢🟡🔴) — não depender só da cor: acompanhar sempre de texto/ícone (usuários com daltonismo não podem depender do semáforo isolado).
- `alt` descritivo em ícones informativos; `aria-label` em botões de ícone (ex: ações em lote, exportar XML).

## Fluxo de trabalho ao criar/alterar qualquer tela

Seguir os 5 Planos de Garrett do documento do vault: Estratégia (para qual perfil é, que dor resolve) → Escopo → Estrutura (onde entra no sitemap: Dashboard/Documentos/Caixa Postal/Simples Nacional/Consultas/Relatórios/Créditos) → Esqueleto (wireframe antes de codar) → Superfície (aplicar padrão visual já definido, não inventar novo componente por tela).
