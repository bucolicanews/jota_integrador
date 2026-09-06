/**
 * Custo em créditos por operação -- catálogo do plano original do produto
 * (`may_memory/28-JotaIntegradorFiscal/primeiroPlano.md`). Nunca exposto ao usuário
 * final de forma granular (docs/UX-UI.md: "operações fiscais incluídas no plano"),
 * só usado internamente pra saber quanto debitar.
 */
export const CUSTO_POR_OPERACAO: Record<string, number> = {
  CONSULTA_CNPJ: 1,
  CONSULTA_SIMPLES: 2,
  PGDAS: 3,
  DAS: 2,
  CAIXA_POSTAL: 2,
  DOCUMENTO_FISCAL: 1,
  BAIXAR_XML: 1,
  RELATORIO: 2,
  CCMEI: 1,
};

export function custoDaOperacao(tipoOperacao: string): number {
  const custo = CUSTO_POR_OPERACAO[tipoOperacao];
  if (custo === undefined) {
    throw new Error(`Operação "${tipoOperacao}" sem custo definido no catálogo de créditos`);
  }
  return custo;
}
