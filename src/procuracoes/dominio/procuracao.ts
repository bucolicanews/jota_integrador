export type StatusProcuracao = 'ativa' | 'expirada' | 'revogada' | 'pendente';

const TRANSICOES_VALIDAS: Record<StatusProcuracao, StatusProcuracao[]> = {
  pendente: ['ativa', 'revogada'],
  ativa: ['expirada', 'revogada'],
  expirada: ['ativa', 'revogada'], // renovação no gov.br volta pra ativa
  revogada: [], // estado terminal -- nova procuração é uma linha nova, não reabre esta
};

/**
 * Regra de negócio pura (docs/SEGURANCA.md §2): status de procuração é um espelho do que
 * o SERPRO/e-CAC diz, mas mesmo assim não aceitamos qualquer transição -- "revogada" é
 * terminal, por exemplo. Validado aqui além da checagem de RBAC/RLS (defesa em
 * profundidade, mesma filosofia do resto do projeto).
 */
export function validarTransicaoStatusProcuracao(atual: StatusProcuracao, novo: StatusProcuracao): void {
  if (atual === novo) return;
  if (!TRANSICOES_VALIDAS[atual].includes(novo)) {
    throw new Error(`Transição de status inválida: "${atual}" → "${novo}"`);
  }
}
