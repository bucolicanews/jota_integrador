import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import {
  CONFIGURACAO_PLATAFORMA_REPOSITORIO,
  ConfiguracaoPlataformaRepositorioPort,
} from '../portas/configuracao-plataforma-repositorio.port';

@Injectable()
export class GerenciarComissaoPlataformaUseCase {
  constructor(
    @Inject(CONFIGURACAO_PLATAFORMA_REPOSITORIO)
    private readonly configuracaoRepositorio: ConfiguracaoPlataformaRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async obter(): Promise<number> {
    return this.configuracaoRepositorio.obterComissaoHonorariosPct();
  }

  /**
   * Existe um trigger no banco (audita_mudanca_comissao_plataforma) que também audita
   * essa mudança, mas ele lê `auth.uid()` -- que é sempre NULL neste projeto porque o
   * backend escreve com service_role, nunca repassando o JWT do usuário pro Supabase
   * (mesmo motivo de qualquer outra tabela aqui). Sem esse registro explícito, a
   * mudança mais importante do módulo financeiro (comissão que afeta toda cobrança
   * nova) ficaria sem "quem" no ledger. O trigger continua rodando (redundante, gera
   * uma segunda linha com usuario_id nulo) -- inofensivo, não vale a pena remover.
   */
  async atualizar(pct: number, executadoPorId: string): Promise<void> {
    if (pct < 0 || pct > 100) {
      throw new BadRequestException('Comissão precisa estar entre 0 e 100');
    }

    const anterior = await this.configuracaoRepositorio.obterComissaoHonorariosPct();
    await this.configuracaoRepositorio.atualizarComissaoHonorariosPct(pct);

    await this.auditoria.registrar({
      usuarioId: executadoPorId,
      acao: 'configuracoes_plataforma.atualizar_comissao_honorarios',
      recurso: 'configuracoes_plataforma',
      dadosAntigos: { comissaoHonorariosPct: anterior },
      dadosNovos: { comissaoHonorariosPct: pct },
    });
  }
}
