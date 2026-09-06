import { Inject, Injectable } from '@nestjs/common';
import { CREDITOS_REPOSITORIO, CreditosRepositorioPort } from '../portas/creditos-repositorio.port';

/** Ajuste manual (admin) -- não confundir com EstornarCreditosUseCase (compensação automática). */
@Injectable()
export class CreditarCreditosUseCase {
  constructor(
    @Inject(CREDITOS_REPOSITORIO) private readonly creditosRepositorio: CreditosRepositorioPort,
  ) {}

  async executar(contadorId: string, quantidade: number, motivo: string): Promise<number> {
    return this.creditosRepositorio.creditar(contadorId, quantidade, motivo);
  }
}
