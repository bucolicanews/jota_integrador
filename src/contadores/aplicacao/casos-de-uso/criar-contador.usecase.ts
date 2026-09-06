import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { validarCpfOuCnpj } from '../../dominio/contador';
import {
  CONTADORES_REPOSITORIO,
  Contador,
  ContadoresRepositorioPort,
  DadosNovoContador,
} from '../portas/contadores-repositorio.port';

@Injectable()
export class CriarContadorUseCase {
  constructor(
    @Inject(CONTADORES_REPOSITORIO) private readonly contadoresRepositorio: ContadoresRepositorioPort,
  ) {}

  // `tipo='interno_jota'` (fallback pra empresa sem contador humano) não passa por
  // aqui -- é infraestrutura de seed, não um fluxo de criação via API
  // (docs/BANCO_DE_DADOS.md §1). Todo contador criado por este caso de uso é `humano`.
  async executar(entrada: DadosNovoContador): Promise<Contador> {
    if (!validarCpfOuCnpj(entrada.cnpjCpf)) {
      throw new BadRequestException('CPF/CNPJ inválido');
    }

    return this.contadoresRepositorio.criar(entrada);
  }
}
