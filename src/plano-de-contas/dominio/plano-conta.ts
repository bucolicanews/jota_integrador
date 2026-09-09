export type GrupoContaContabil = 'ativo' | 'passivo' | 'patrimonio_liquido' | 'receita' | 'custo' | 'despesa';
export type NaturezaSaldo = 'devedora' | 'credora';

export const GRUPOS_CONTA_CONTABIL: GrupoContaContabil[] = [
  'ativo',
  'passivo',
  'patrimonio_liquido',
  'receita',
  'custo',
  'despesa',
];

/**
 * Natureza de saldo é 100% derivada do grupo -- nunca campo próprio editável (regra
 * contábil fixa, não dado de negócio que o usuário possa digitar errado). Ativo/Custo
 * são devedoras; Passivo/Patrimônio Líquido/Receita/Despesa são credoras.
 */
export function naturezaDoGrupo(grupo: GrupoContaContabil): NaturezaSaldo {
  return grupo === 'ativo' || grupo === 'custo' ? 'devedora' : 'credora';
}
