import { Inject, Injectable } from '@nestjs/common';
import {
  CONTADORES_REPOSITORIO,
  ContadoresRepositorioPort,
} from '../portas/contadores-repositorio.port';

@Injectable()
export class BloquearContadorUseCase {
  constructor(
    @Inject(CONTADORES_REPOSITORIO) private readonly contadoresRepositorio: ContadoresRepositorioPort,
  ) {}

  // Bloquear um contador bloqueia, na prática, todas as empresas da carteira dele
  // (docs/BANCO_DE_DADOS.md §Bloqueio) -- por isso só a plataforma pode fazer isso,
  // nunca o próprio contador (ver @Papeis(SUPER_ADMIN) no controller).
  async executar(id: string, motivo: string, executadoPorId: string): Promise<void> {
    await this.contadoresRepositorio.marcarBloqueio(id, true, motivo, executadoPorId);
  }
}
