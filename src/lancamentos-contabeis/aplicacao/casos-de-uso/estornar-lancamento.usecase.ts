import { Inject, Injectable } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { LANCAMENTOS_REPOSITORIO, LancamentosRepositorioPort } from '../portas/lancamentos-repositorio.port';

@Injectable()
export class EstornarLancamentoUseCase {
  constructor(
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly repositorio: LancamentosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, motivo: string, executadoPorId: string, empresaId: string): Promise<string> {
    const novoId = await this.repositorio.estornar(id, motivo, executadoPorId);

    await this.auditoria.registrar({
      usuarioId: executadoPorId,
      empresaId,
      acao: 'ESTORNAR_LANCAMENTO_CONTABIL',
      recurso: `lancamentos_contabeis:${id}`,
      dadosNovos: { estornoId: novoId, motivo },
    });

    return novoId;
  }
}
