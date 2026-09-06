import { Inject, Injectable } from '@nestjs/common';
import {
  CONTADORES_REPOSITORIO,
  Contador,
  ContadoresRepositorioPort,
} from '../portas/contadores-repositorio.port';

@Injectable()
export class ListarContadoresUseCase {
  constructor(
    @Inject(CONTADORES_REPOSITORIO) private readonly contadoresRepositorio: ContadoresRepositorioPort,
  ) {}

  // Sem filtro por dono -- só a plataforma chama isso (@Papeis no controller), então
  // "listar todos" é exatamente o esperado aqui, ao contrário de ListarEmpresasUseCase.
  async executar(): Promise<Contador[]> {
    return this.contadoresRepositorio.listar();
  }
}
