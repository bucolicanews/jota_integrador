import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { CofreCertificadosService } from '../../../common/cofre/cofre-certificados.service';
import { TipoCertificado, validarArquivoObrigatorio, validarVigencia } from '../../dominio/certificado';
import {
  CERTIFICADOS_REPOSITORIO,
  CertificadoMetadados,
  CertificadosRepositorioPort,
} from '../portas/certificados-repositorio.port';

export interface DadosCadastroCertificado {
  empresaId: string;
  tipo: TipoCertificado;
  arquivo: Buffer;
  nomeArquivo: string;
  senha: string;
  validadeInicio: string | null;
  validadeFim: string;
}

/**
 * Um único fluxo cobre cadastro inicial e rotação -- do ponto de vista de negócio é a
 * mesma ação ("aqui está o certificado vigente agora"). Se já existe um ativo, ele vira
 * "substituido" (nunca apagado -- rastreabilidade/auditoria) e o novo nasce "ativo".
 * Rotação sem downtime (docs/SEGURANCA.md §1): a troca de status é a última coisa que
 * acontece, depois do novo já estar persistido e cifrado no cofre.
 *
 * Arquivos antigos no Storage NÃO são apagados na rotação (só ficam inacessíveis pela
 * aplicação, já que só se busca `status = 'ativo'`) -- decisão deliberada: preferir manter
 * um blob cifrado órfão a fazer uma exclusão irreversível de material que pode importar
 * pra auditoria depois.
 */
@Injectable()
export class CadastrarOuRotacionarCertificadoUseCase {
  constructor(
    @Inject(CERTIFICADOS_REPOSITORIO) private readonly certificadosRepositorio: CertificadosRepositorioPort,
    private readonly cofre: CofreCertificadosService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosCadastroCertificado, executadoPorId: string): Promise<CertificadoMetadados> {
    try {
      validarArquivoObrigatorio(dados.tipo, dados.nomeArquivo);
      validarVigencia(dados.validadeInicio, dados.validadeFim);
    } catch (erro) {
      throw new BadRequestException((erro as Error).message);
    }

    const ativoAnterior = await this.certificadosRepositorio.buscarAtivoPorEmpresa(dados.empresaId);

    const { arquivoRef, senhaRef } = await this.cofre.armazenar(dados.empresaId, dados.arquivo, dados.senha);

    const novo = await this.certificadosRepositorio.criar({
      empresaId: dados.empresaId,
      tipo: dados.tipo,
      arquivoRef,
      senhaRef,
      validadeInicio: dados.validadeInicio,
      validadeFim: dados.validadeFim,
    });

    if (ativoAnterior) {
      await this.certificadosRepositorio.marcarStatus(ativoAnterior.id, 'substituido');
    }

    await this.auditoria.registrar({
      usuarioId: executadoPorId,
      empresaId: dados.empresaId,
      acao: ativoAnterior ? 'certificado.rotacionar' : 'certificado.cadastrar',
      recurso: 'certificados',
      dadosAntigos: ativoAnterior ? { certificadoId: ativoAnterior.id } : null,
      dadosNovos: { certificadoId: novo.id, tipo: novo.tipo, validadeFim: novo.validadeFim },
    });

    return novo;
  }
}
