import { Inject, Injectable } from '@nestjs/common';
import {
  FiltroLancamentos,
  LANCAMENTOS_REPOSITORIO,
  LancamentoContabil,
  LancamentosRepositorioPort,
} from '../portas/lancamentos-repositorio.port';

@Injectable()
export class ListarLancamentosUseCase {
  constructor(
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly repositorio: LancamentosRepositorioPort,
  ) {}

  async executar(empresaId: string, filtro?: FiltroLancamentos): Promise<LancamentoContabil[]> {
    return this.repositorio.listarPorEmpresa(empresaId, filtro);
  }
}
