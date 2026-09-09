import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  MENSAGENS_CAIXA_POSTAL_REPOSITORIO,
  MensagensCaixaPostalRepositorioPort,
} from '../portas/mensagens-caixa-postal-repositorio.port';

@Injectable()
export class MarcarComoLidaUseCase {
  constructor(
    @Inject(MENSAGENS_CAIXA_POSTAL_REPOSITORIO)
    private readonly mensagensRepositorio: MensagensCaixaPostalRepositorioPort,
  ) {}

  async executar(mensagemId: string): Promise<void> {
    const mensagem = await this.mensagensRepositorio.buscarPorId(mensagemId);
    if (!mensagem) {
      throw new NotFoundException('Mensagem não encontrada');
    }
    await this.mensagensRepositorio.marcarComoLida(mensagemId);
  }
}
