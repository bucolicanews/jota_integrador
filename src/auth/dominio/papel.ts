// Catálogo fixo de papéis (docs/BANCO_DE_DADOS.md §Papéis do catálogo fixo) --
// não customizável por tenant, decisão de 2026-09-06.
export enum Papel {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN_FINANCEIRO = 'ADMIN_FINANCEIRO',
  ADMIN_SUPORTE = 'ADMIN_SUPORTE',
  CONTADOR_DONO = 'CONTADOR_DONO',
  OPERADOR_CONTADOR = 'OPERADOR_CONTADOR',
  EMPRESARIO_DONO = 'EMPRESARIO_DONO',
  OPERADOR_EMPRESA = 'OPERADOR_EMPRESA',
}

export type EscopoPapel = 'plataforma' | 'contador' | 'empresa';

export const ESCOPO_POR_PAPEL: Record<Papel, EscopoPapel> = {
  [Papel.SUPER_ADMIN]: 'plataforma',
  [Papel.ADMIN_FINANCEIRO]: 'plataforma',
  [Papel.ADMIN_SUPORTE]: 'plataforma',
  [Papel.CONTADOR_DONO]: 'contador',
  [Papel.OPERADOR_CONTADOR]: 'contador',
  [Papel.EMPRESARIO_DONO]: 'empresa',
  [Papel.OPERADOR_EMPRESA]: 'empresa',
};

export const PAPEIS_PLATAFORMA: readonly Papel[] = [
  Papel.SUPER_ADMIN,
  Papel.ADMIN_FINANCEIRO,
  Papel.ADMIN_SUPORTE,
];

export function ehPapelDePlataforma(papel: Papel): boolean {
  return PAPEIS_PLATAFORMA.includes(papel);
}

/**
 * Regra de negócio pura (docs/BANCO_DE_DADOS.md §1, tabela de coerência escopo/vínculo):
 * o vínculo (contadorId/empresaId) precisa bater com o escopo do papel. Mesma regra já
 * expressa como CHECK/trigger no banco (0002_identidade_hierarquia.sql) -- validada aqui
 * também, na Application layer, porque toda camada deve revalidar (Zero Trust,
 * docs/SEGURANCA.md), não só confiar que a constraint do banco vai pegar o erro depois.
 */
export function validarCoerenciaEscopo(
  papel: Papel,
  contadorId: string | null,
  empresaId: string | null,
): void {
  const escopo = ESCOPO_POR_PAPEL[papel];

  if (escopo === 'plataforma' && (contadorId !== null || empresaId !== null)) {
    throw new Error(`Papel ${papel} é de escopo plataforma e não pode ter contador_id/empresa_id vinculado`);
  }
  if (escopo === 'contador' && contadorId === null) {
    throw new Error(`Papel ${papel} exige contador_id`);
  }
  if (escopo === 'empresa' && empresaId === null) {
    throw new Error(`Papel ${papel} exige empresa_id`);
  }
  if (contadorId !== null && empresaId !== null) {
    throw new Error('Usuário não pode ter contador_id e empresa_id preenchidos ao mesmo tempo');
  }
}

/** MFA obrigatório para papéis de plataforma (docs/SEGURANCA.md/POLITICAS.md: admin/financeiro/operações críticas). */
export function exigeMfa(papel: Papel): boolean {
  return ehPapelDePlataforma(papel);
}
