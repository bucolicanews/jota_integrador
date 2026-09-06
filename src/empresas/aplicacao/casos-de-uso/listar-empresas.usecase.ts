import { Inject, Injectable } from '@nestjs/common';
import {
  EMPRESAS_REPOSITORIO,
  Empresa,
  EmpresasRepositorioPort,
} from '../portas/empresas-repositorio.port';

@Injectable()
export class ListarEmpresasUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
  ) {}

  async executar(contadorId: string): Promise<Empresa[]> {
    return this.empresasRepositorio.listarPorContador(contadorId);
  }
}
