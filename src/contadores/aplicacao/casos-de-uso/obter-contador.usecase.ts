import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CONTADORES_REPOSITORIO,
  Contador,
  ContadoresRepositorioPort,
} from '../portas/contadores-repositorio.port';

@Injectable()
export class ObterContadorUseCase {
  constructor(
    @Inject(CONTADORES_REPOSITORIO) private readonly contadoresRepositorio: ContadoresRepositorioPort,
  ) {}

  async executar(id: string): Promise<Contador> {
    const contador = await this.contadoresRepositorio.buscarPorId(id);
    if (!contador) {
      throw new NotFoundException('Contador não encontrado');
    }
    return contador;
  }
}
