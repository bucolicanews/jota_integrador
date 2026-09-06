import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  EMPRESAS_REPOSITORIO,
  Empresa,
  EmpresasRepositorioPort,
} from '../portas/empresas-repositorio.port';

@Injectable()
export class ObterEmpresaUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
  ) {}

  async executar(id: string): Promise<Empresa> {
    const empresa = await this.empresasRepositorio.buscarPorId(id);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }
    return empresa;
  }
}
