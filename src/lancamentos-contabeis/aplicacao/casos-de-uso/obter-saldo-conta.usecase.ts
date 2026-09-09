import { Inject, Injectable } from '@nestjs/common';
import { LANCAMENTOS_REPOSITORIO, LancamentosRepositorioPort } from '../portas/lancamentos-repositorio.port';

@Injectable()
export class ObterSaldoContaUseCase {
  constructor(
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly repositorio: LancamentosRepositorioPort,
  ) {}

  async executar(contaId: string, ateData?: string): Promise<number> {
    return this.repositorio.obterSaldoConta(contaId, ateData);
  }
}
