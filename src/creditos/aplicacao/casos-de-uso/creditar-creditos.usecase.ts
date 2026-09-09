import { Inject, Injectable } from '@nestjs/common';
import { CREDITOS_REPOSITORIO, CreditosRepositorioPort } from '../portas/creditos-repositorio.port';

/**
 * Ajuste manual (admin) por padrão -- não confundir com EstornarCreditosUseCase
 * (compensação automática). `tipoOperacao` também é reaproveitado por assinaturas/ pra
 * creditar automaticamente na renovação (`RENOVACAO_ASSINATURA`, distinto de
 * `AJUSTE_MANUAL` no ledger -- docs/SEGURANCA.md §6).
 */
@Injectable()
export class CreditarCreditosUseCase {
  constructor(
    @Inject(CREDITOS_REPOSITORIO) private readonly creditosRepositorio: CreditosRepositorioPort,
  ) {}

  async executar(contadorId: string, quantidade: number, motivo: string, tipoOperacao?: string): Promise<number> {
    return this.creditosRepositorio.creditar(contadorId, quantidade, motivo, tipoOperacao);
  }
}
