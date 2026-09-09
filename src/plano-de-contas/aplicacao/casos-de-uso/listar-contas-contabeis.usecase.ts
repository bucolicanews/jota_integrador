import { Inject, Injectable } from '@nestjs/common';
import {
  PLANO_CONTAS_REPOSITORIO,
  PlanoConta,
  PlanoContasRepositorioPort,
} from '../portas/plano-contas-repositorio.port';

@Injectable()
export class ListarContasContabeisUseCase {
  constructor(
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly repositorio: PlanoContasRepositorioPort,
  ) {}

  async executar(empresaId: string): Promise<PlanoConta[]> {
    return this.repositorio.listarPorEmpresa(empresaId);
  }
}
