import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  DadosNovaContaContabil,
  PLANO_CONTAS_REPOSITORIO,
  PlanoConta,
  PlanoContasRepositorioPort,
} from '../portas/plano-contas-repositorio.port';

@Injectable()
export class CriarContaContabilUseCase {
  constructor(
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly repositorio: PlanoContasRepositorioPort,
  ) {}

  async executar(dados: DadosNovaContaContabil): Promise<PlanoConta> {
    if (dados.contaPaiId) {
      const contaPai = await this.repositorio.buscarPorId(dados.contaPaiId);
      if (!contaPai || contaPai.empresaId !== dados.empresaId) {
        throw new BadRequestException('Conta pai não encontrada nesta empresa');
      }
      if (!contaPai.sintetica) {
        throw new BadRequestException('Conta pai precisa ser sintética (agrupadora) -- só ela pode ter contas filhas');
      }
    }

    return this.repositorio.criar(dados);
  }
}
