import { Inject, Injectable } from '@nestjs/common';
import { CREDITOS_REPOSITORIO, CreditosRepositorioPort } from '../portas/creditos-repositorio.port';

/**
 * Compensação (padrão saga, docs/SEGURANCA.md §6) para quando o débito teve sucesso
 * mas a operação paga (ex: chamada ao SERPRO) falhou depois -- nunca deixar o cliente
 * pagando por algo que não aconteceu. Não existe transação distribuída real entre
 * nosso banco e o SERPRO, então o estorno é a forma de manter os dois sincronizados.
 */
@Injectable()
export class EstornarCreditosUseCase {
  constructor(
    @Inject(CREDITOS_REPOSITORIO) private readonly creditosRepositorio: CreditosRepositorioPort,
  ) {}

  async executar(contadorId: string, quantidade: number, motivo: string): Promise<number> {
    return this.creditosRepositorio.creditar(contadorId, quantidade, `ESTORNO: ${motivo}`);
  }
}
