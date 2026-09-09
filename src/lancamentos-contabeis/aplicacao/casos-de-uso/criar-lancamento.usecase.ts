import { Inject, Injectable } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import {
  DadosNovoLancamento,
  LANCAMENTOS_REPOSITORIO,
  LancamentosRepositorioPort,
} from '../portas/lancamentos-repositorio.port';

@Injectable()
export class CriarLancamentoUseCase {
  constructor(
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly repositorio: LancamentosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosNovoLancamento): Promise<string> {
    // Validação de partida dobrada (débito=crédito, contas analíticas da mesma
    // empresa) acontece no banco (criar_lancamento_contabil, SECURITY DEFINER) -- não
    // duplicar a regra aqui, só propagar o erro se o banco rejeitar.
    const id = await this.repositorio.criar(dados);

    await this.auditoria.registrar({
      usuarioId: dados.criadoPor,
      empresaId: dados.empresaId,
      acao: 'CRIAR_LANCAMENTO_CONTABIL',
      recurso: `lancamentos_contabeis:${id}`,
      dadosNovos: dados,
    });

    return id;
  }
}
