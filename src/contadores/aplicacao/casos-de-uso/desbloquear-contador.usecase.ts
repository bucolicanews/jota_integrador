import { Inject, Injectable } from '@nestjs/common';
import {
  CONTADORES_REPOSITORIO,
  ContadoresRepositorioPort,
} from '../portas/contadores-repositorio.port';

@Injectable()
export class DesbloquearContadorUseCase {
  constructor(
    @Inject(CONTADORES_REPOSITORIO) private readonly contadoresRepositorio: ContadoresRepositorioPort,
  ) {}

  async executar(id: string, executadoPorId: string): Promise<void> {
    await this.contadoresRepositorio.marcarBloqueio(id, false, null, executadoPorId);
  }
}
