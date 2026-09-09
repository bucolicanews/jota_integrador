import { Inject, Injectable } from '@nestjs/common';
import {
  MensagemCaixaPostal,
  MENSAGENS_CAIXA_POSTAL_REPOSITORIO,
  MensagensCaixaPostalRepositorioPort,
} from '../portas/mensagens-caixa-postal-repositorio.port';

@Injectable()
export class ListarMensagensUseCase {
  constructor(
    @Inject(MENSAGENS_CAIXA_POSTAL_REPOSITORIO)
    private readonly mensagensRepositorio: MensagensCaixaPostalRepositorioPort,
  ) {}

  async executar(empresaId: string): Promise<MensagemCaixaPostal[]> {
    return this.mensagensRepositorio.listarPorEmpresa(empresaId);
  }
}
