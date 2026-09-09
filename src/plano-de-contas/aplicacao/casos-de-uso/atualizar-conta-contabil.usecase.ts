import { Inject, Injectable } from '@nestjs/common';
import {
  DadosAtualizacaoContaContabil,
  PLANO_CONTAS_REPOSITORIO,
  PlanoContasRepositorioPort,
} from '../portas/plano-contas-repositorio.port';

@Injectable()
export class AtualizarContaContabilUseCase {
  constructor(
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly repositorio: PlanoContasRepositorioPort,
  ) {}

  async executar(id: string, dados: DadosAtualizacaoContaContabil): Promise<void> {
    await this.repositorio.atualizar(id, dados);
  }
}
