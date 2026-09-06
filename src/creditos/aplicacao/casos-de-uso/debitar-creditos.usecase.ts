import { Inject, Injectable } from '@nestjs/common';
import { custoDaOperacao } from '../../dominio/credito';
import { CREDITOS_REPOSITORIO, CreditosRepositorioPort } from '../portas/creditos-repositorio.port';

/**
 * Caso de uso reutilizável por outros módulos (ex: serpro/) antes de gastar uma
 * operação paga -- nunca reimplementar a lógica de débito em outro lugar, sempre
 * passar por aqui pra garantir que o custo vem do catálogo único (docs/creditos/dominio).
 */
@Injectable()
export class DebitarCreditosUseCase {
  constructor(
    @Inject(CREDITOS_REPOSITORIO) private readonly creditosRepositorio: CreditosRepositorioPort,
  ) {}

  /** Retorna o novo saldo. Lança SaldoInsuficienteError (docs/creditos-repositorio.port) se não houver crédito suficiente. */
  async executar(contadorId: string, empresaId: string, tipoOperacao: string, motivo: string): Promise<number> {
    const quantidade = custoDaOperacao(tipoOperacao);
    return this.creditosRepositorio.debitar(contadorId, empresaId, tipoOperacao, quantidade, motivo);
  }
}
