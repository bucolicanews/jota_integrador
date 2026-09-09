import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { validarCnpj, ModoAcessoSerpro, RegimeTributario } from '../../dominio/empresa';
import {
  EMPRESAS_REPOSITORIO,
  Empresa,
  EmpresasRepositorioPort,
} from '../portas/empresas-repositorio.port';

export interface EntradaCriarEmpresa {
  contadorId: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  regimeTributario: RegimeTributario | null;
  modoAcessoSerpro: ModoAcessoSerpro;
}

@Injectable()
export class CriarEmpresaUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
  ) {}

  async executar(entrada: EntradaCriarEmpresa): Promise<Empresa> {
    if (!validarCnpj(entrada.cnpj)) {
      throw new BadRequestException('CNPJ inválido');
    }

    return this.empresasRepositorio.criar(entrada);
  }
}
