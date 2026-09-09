import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { validarDadosPlano } from '../../dominio/plano';
import {
  DadosAtualizacaoPlano,
  PLANOS_REPOSITORIO,
  Plano,
  PlanosRepositorioPort,
} from '../portas/planos-repositorio.port';

@Injectable()
export class AtualizarPlanoUseCase {
  constructor(@Inject(PLANOS_REPOSITORIO) private readonly planosRepositorio: PlanosRepositorioPort) {}

  async executar(id: string, dados: DadosAtualizacaoPlano): Promise<Plano> {
    const existente = await this.planosRepositorio.buscarPorId(id);
    if (!existente) {
      throw new NotFoundException('Plano não encontrado');
    }

    try {
      validarDadosPlano(
        dados.operacoesIncluidas ?? existente.operacoesIncluidas,
        dados.preco ?? existente.preco,
      );
    } catch (erro) {
      throw new BadRequestException((erro as Error).message);
    }

    return this.planosRepositorio.atualizar(id, dados);
  }
}
