import { SetMetadata } from '@nestjs/common';
import { Papel } from '../../dominio/papel';

export const CHAVE_PAPEIS = 'papeis';

/**
 * RBAC a nível de rota -- defesa em profundidade além do RLS do banco
 * (docs/SEGURANCA.md: nunca confiar só numa camada). Uso: `@Papeis(Papel.SUPER_ADMIN)`.
 */
export const Papeis = (...papeis: Papel[]) => SetMetadata(CHAVE_PAPEIS, papeis);
