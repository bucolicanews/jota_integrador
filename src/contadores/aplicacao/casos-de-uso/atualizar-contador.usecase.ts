import { Inject, Injectable } from '@nestjs/common';
import {
  CONTADORES_REPOSITORIO,
  ContadoresRepositorioPort,
  DadosAtualizacaoContador,
} from '../portas/contadores-repositorio.port';

@Injectable()
export class AtualizarContadorUseCase {
  constructor(
    @Inject(CONTADORES_REPOSITORIO) private readonly contadoresRepositorio: ContadoresRepositorioPort,
  ) {}

  // Só campos não-sensíveis -- tipo/bloqueado/stripe_* nunca passam por aqui (têm caso
  // de uso ou trigger próprio, docs/BANCO_DE_DADOS.md).
  async executar(id: string, dados: DadosAtualizacaoContador): Promise<void> {
    await this.contadoresRepositorio.atualizar(id, dados);
  }
}
