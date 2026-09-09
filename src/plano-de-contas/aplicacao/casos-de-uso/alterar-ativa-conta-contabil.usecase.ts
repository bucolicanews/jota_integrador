import { Inject, Injectable } from '@nestjs/common';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../portas/plano-contas-repositorio.port';

/**
 * Nunca DELETE de conta contábil -- só desativar/reativar (`ativa`). Lançamentos
 * antigos continuam apontando pra ela normalmente; desativar só impede uso em
 * lançamentos NOVOS (checado em criar_lancamento_contabil no banco).
 */
@Injectable()
export class AlterarAtivaContaContabilUseCase {
  constructor(
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly repositorio: PlanoContasRepositorioPort,
  ) {}

  async executar(id: string, ativa: boolean): Promise<void> {
    await this.repositorio.marcarAtiva(id, ativa);
  }
}
