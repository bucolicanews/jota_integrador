import { Inject, Injectable } from '@nestjs/common';
import {
  PROCURACOES_REPOSITORIO,
  Procuracao,
  ProcuracoesRepositorioPort,
} from '../portas/procuracoes-repositorio.port';

@Injectable()
export class ObterProcuracaoUseCase {
  constructor(
    @Inject(PROCURACOES_REPOSITORIO) private readonly procuracoesRepositorio: ProcuracoesRepositorioPort,
  ) {}

  /** Garante a linha "pendente" na primeira consulta -- evita a UI ter que tratar "sem procuração nenhuma" como um caso à parte de "pendente". */
  async executar(empresaId: string): Promise<Procuracao> {
    return this.procuracoesRepositorio.garantirLinha(empresaId);
  }
}
