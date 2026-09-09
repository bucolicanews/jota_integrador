import { Inject, Injectable } from '@nestjs/common';
import { ASSINATURAS_REPOSITORIO, AssinaturasRepositorioPort, Fatura } from '../portas/assinaturas-repositorio.port';

@Injectable()
export class ListarFaturasUseCase {
  constructor(
    @Inject(ASSINATURAS_REPOSITORIO) private readonly assinaturasRepositorio: AssinaturasRepositorioPort,
  ) {}

  async executar(contadorId: string): Promise<Fatura[]> {
    return this.assinaturasRepositorio.listarFaturasPorContador(contadorId);
  }
}
