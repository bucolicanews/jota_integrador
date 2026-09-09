import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  LANCAMENTOS_REPOSITORIO,
  LancamentoContabil,
  LancamentosRepositorioPort,
} from '../portas/lancamentos-repositorio.port';

@Injectable()
export class ObterLancamentoUseCase {
  constructor(
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly repositorio: LancamentosRepositorioPort,
  ) {}

  async executar(id: string): Promise<LancamentoContabil> {
    const lancamento = await this.repositorio.obterPorId(id);
    if (!lancamento) {
      throw new NotFoundException('Lançamento contábil não encontrado');
    }
    return lancamento;
  }
}
