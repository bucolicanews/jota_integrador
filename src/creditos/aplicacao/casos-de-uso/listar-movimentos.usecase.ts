import { Inject, Injectable } from '@nestjs/common';
import {
  CREDITOS_REPOSITORIO,
  CreditosRepositorioPort,
  MovimentoCredito,
} from '../portas/creditos-repositorio.port';

@Injectable()
export class ListarMovimentosUseCase {
  constructor(
    @Inject(CREDITOS_REPOSITORIO) private readonly creditosRepositorio: CreditosRepositorioPort,
  ) {}

  async executar(contadorId: string): Promise<MovimentoCredito[]> {
    return this.creditosRepositorio.listarMovimentos(contadorId);
  }
}
