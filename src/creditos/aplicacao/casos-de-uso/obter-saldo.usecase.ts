import { Inject, Injectable } from '@nestjs/common';
import { CREDITOS_REPOSITORIO, CreditosRepositorioPort } from '../portas/creditos-repositorio.port';

@Injectable()
export class ObterSaldoUseCase {
  constructor(
    @Inject(CREDITOS_REPOSITORIO) private readonly creditosRepositorio: CreditosRepositorioPort,
  ) {}

  async executar(contadorId: string): Promise<number> {
    return this.creditosRepositorio.obterSaldo(contadorId);
  }
}
