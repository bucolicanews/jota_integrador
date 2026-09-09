export type Periodicidade = 'mensal' | 'anual';

/** Regra de negócio pura -- mesmo que o CHECK do banco já garanta, revalidar aqui (Zero Trust, docs/SEGURANCA.md). */
export function validarDadosPlano(operacoesIncluidas: number, preco: number): void {
  if (!Number.isInteger(operacoesIncluidas) || operacoesIncluidas < 0) {
    throw new Error('operacoesIncluidas precisa ser um inteiro >= 0');
  }
  if (preco < 0) {
    throw new Error('preco não pode ser negativo');
  }
}
