import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { CERTIFICADOS_REPOSITORIO, CertificadosRepositorioPort } from '../portas/certificados-repositorio.port';

@Injectable()
export class RevogarCertificadoUseCase {
  constructor(
    @Inject(CERTIFICADOS_REPOSITORIO) private readonly certificadosRepositorio: CertificadosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(empresaId: string, executadoPorId: string): Promise<void> {
    const ativo = await this.certificadosRepositorio.buscarAtivoPorEmpresa(empresaId);
    if (!ativo) {
      throw new NotFoundException('Empresa não tem certificado ativo para revogar');
    }

    await this.certificadosRepositorio.marcarStatus(ativo.id, 'revogado');

    await this.auditoria.registrar({
      usuarioId: executadoPorId,
      empresaId,
      acao: 'certificado.revogar',
      recurso: 'certificados',
      dadosAntigos: { certificadoId: ativo.id, status: 'ativo' },
      dadosNovos: { certificadoId: ativo.id, status: 'revogado' },
    });
  }
}
