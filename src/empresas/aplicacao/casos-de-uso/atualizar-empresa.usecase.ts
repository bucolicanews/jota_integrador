import { Inject, Injectable } from '@nestjs/common';
import {
  DadosAtualizacaoEmpresa,
  EMPRESAS_REPOSITORIO,
  EmpresasRepositorioPort,
} from '../portas/empresas-repositorio.port';

@Injectable()
export class AtualizarEmpresaUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
  ) {}

  // Só campos não-sensíveis (docs/BANCO_DE_DADOS.md) -- contador_id, bloqueado e
  // modo_acesso_serpro têm casos de uso/trigger próprios, nunca passam por aqui.
  async executar(id: string, dados: DadosAtualizacaoEmpresa): Promise<void> {
    await this.empresasRepositorio.atualizar(id, dados);
  }
}
