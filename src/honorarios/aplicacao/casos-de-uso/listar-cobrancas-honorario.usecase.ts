import { Inject, Injectable } from '@nestjs/common';
import {
  CobrancaHonorario,
  COBRANCAS_HONORARIOS_REPOSITORIO,
  CobrancasHonorariosRepositorioPort,
} from '../portas/cobrancas-honorarios-repositorio.port';

@Injectable()
export class ListarCobrancasHonorarioUseCase {
  constructor(
    @Inject(COBRANCAS_HONORARIOS_REPOSITORIO)
    private readonly cobrancasRepositorio: CobrancasHonorariosRepositorioPort,
  ) {}

  async porContador(contadorId: string): Promise<CobrancaHonorario[]> {
    return this.cobrancasRepositorio.listarPorContador(contadorId);
  }

  async porEmpresa(empresaId: string): Promise<CobrancaHonorario[]> {
    return this.cobrancasRepositorio.listarPorEmpresa(empresaId);
  }
}
