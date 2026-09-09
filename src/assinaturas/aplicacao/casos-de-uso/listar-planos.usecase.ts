import { Inject, Injectable } from '@nestjs/common';
import { PLANOS_REPOSITORIO, Plano, PlanosRepositorioPort } from '../portas/planos-repositorio.port';

@Injectable()
export class ListarPlanosUseCase {
  constructor(@Inject(PLANOS_REPOSITORIO) private readonly planosRepositorio: PlanosRepositorioPort) {}

  async executar(somenteAtivos: boolean): Promise<Plano[]> {
    return this.planosRepositorio.listar(somenteAtivos);
  }
}
