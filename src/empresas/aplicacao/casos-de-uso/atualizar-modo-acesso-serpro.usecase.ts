import { Inject, Injectable } from '@nestjs/common';
import { ModoAcessoSerpro } from '../../dominio/empresa';
import {
  EMPRESAS_REPOSITORIO,
  EmpresasRepositorioPort,
} from '../portas/empresas-repositorio.port';

@Injectable()
export class AtualizarModoAcessoSerproUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
  ) {}

  // Caso de uso dedicado (não faz parte de AtualizarEmpresaUseCase de propósito) --
  // trocar de Modo A (procuração) pra Modo B (certificado próprio) ou vice-versa é uma
  // decisão que muda todo o fluxo de autenticação com o SERPRO daquela empresa
  // (docs/SEGURANCA.md §1), não é um campo de cadastro qualquer.
  async executar(id: string, modo: ModoAcessoSerpro): Promise<void> {
    await this.empresasRepositorio.atualizarModoAcessoSerpro(id, modo);
  }
}
