import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { validarTransicaoStatusProcuracao } from '../../dominio/procuracao';
import {
  DadosAtualizacaoStatusProcuracao,
  PROCURACOES_REPOSITORIO,
  Procuracao,
  ProcuracoesRepositorioPort,
} from '../portas/procuracoes-repositorio.port';

/**
 * Só chamado por papel de plataforma (RBAC no controller + RLS `procuracoes_insert`/
 * `_update` exigindo `eh_plataforma()`, docs/BANCO_DE_DADOS.md §2) -- é a plataforma que
 * sincroniza manualmente o status vindo do e-CAC/gov.br. Sync automático via o serviço
 * `PROCURACOES` do SERPRO (docs/SEGURANCA.md §2) fica de fora deste corte: o contrato
 * exato desse endpoint ainda não foi confirmado contra a doc oficial (mesma cautela já
 * aplicada ao Modo B -- "não assumir, validar") -- pendência explícita, não um esquecimento.
 */
@Injectable()
export class AtualizarStatusProcuracaoUseCase {
  constructor(
    @Inject(PROCURACOES_REPOSITORIO) private readonly procuracoesRepositorio: ProcuracoesRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(
    empresaId: string,
    dados: DadosAtualizacaoStatusProcuracao,
    executadoPorId: string,
  ): Promise<Procuracao> {
    const atual = await this.procuracoesRepositorio.garantirLinha(empresaId);
    try {
      validarTransicaoStatusProcuracao(atual.status, dados.status);
    } catch (erro) {
      throw new BadRequestException((erro as Error).message);
    }

    const atualizada = await this.procuracoesRepositorio.atualizarStatus(atual.id, dados);

    await this.auditoria.registrar({
      usuarioId: executadoPorId,
      empresaId,
      acao: 'procuracao.atualizar_status',
      recurso: 'procuracoes',
      dadosAntigos: { status: atual.status },
      dadosNovos: { status: atualizada.status },
    });

    return atualizada;
  }
}
