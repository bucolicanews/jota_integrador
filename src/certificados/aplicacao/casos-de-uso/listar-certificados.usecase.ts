import { Inject, Injectable } from '@nestjs/common';
import {
  CERTIFICADOS_REPOSITORIO,
  CertificadoMetadados,
  CertificadosRepositorioPort,
} from '../portas/certificados-repositorio.port';

@Injectable()
export class ListarCertificadosUseCase {
  constructor(
    @Inject(CERTIFICADOS_REPOSITORIO) private readonly certificadosRepositorio: CertificadosRepositorioPort,
  ) {}

  async executar(empresaId: string): Promise<CertificadoMetadados[]> {
    return this.certificadosRepositorio.listarPorEmpresa(empresaId);
  }
}
