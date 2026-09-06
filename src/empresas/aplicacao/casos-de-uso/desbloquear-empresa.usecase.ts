import { Inject, Injectable } from '@nestjs/common';
import {
  EMPRESAS_REPOSITORIO,
  EmpresasRepositorioPort,
} from '../portas/empresas-repositorio.port';

@Injectable()
export class DesbloquearEmpresaUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
  ) {}

  async executar(id: string, executadoPorId: string): Promise<void> {
    await this.empresasRepositorio.marcarBloqueio(id, false, null, executadoPorId);
  }
}
