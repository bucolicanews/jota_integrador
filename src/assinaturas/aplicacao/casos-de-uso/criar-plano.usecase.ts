import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { validarDadosPlano } from '../../dominio/plano';
import { DadosNovoPlano, PLANOS_REPOSITORIO, Plano, PlanosRepositorioPort } from '../portas/planos-repositorio.port';

@Injectable()
export class CriarPlanoUseCase {
  constructor(@Inject(PLANOS_REPOSITORIO) private readonly planosRepositorio: PlanosRepositorioPort) {}

  async executar(dados: DadosNovoPlano): Promise<Plano> {
    try {
      validarDadosPlano(dados.operacoesIncluidas, dados.preco);
    } catch (erro) {
      throw new BadRequestException((erro as Error).message);
    }
    return this.planosRepositorio.criar(dados);
  }
}
