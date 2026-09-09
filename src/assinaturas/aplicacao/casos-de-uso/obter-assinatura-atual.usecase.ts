import { Inject, Injectable } from '@nestjs/common';
import {
  ASSINATURAS_REPOSITORIO,
  Assinatura,
  AssinaturasRepositorioPort,
} from '../portas/assinaturas-repositorio.port';

@Injectable()
export class ObterAssinaturaAtualUseCase {
  constructor(
    @Inject(ASSINATURAS_REPOSITORIO) private readonly assinaturasRepositorio: AssinaturasRepositorioPort,
  ) {}

  async executar(contadorId: string): Promise<Assinatura | null> {
    return this.assinaturasRepositorio.buscarAtivaPorContador(contadorId);
  }
}
