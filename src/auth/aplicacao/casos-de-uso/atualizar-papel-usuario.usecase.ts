import { Inject, Injectable } from '@nestjs/common';
import { Papel, validarCoerenciaEscopo } from '../../dominio/papel';
import {
  USUARIOS_REPOSITORIO,
  UsuariosRepositorioPort,
} from '../portas/usuarios-repositorio.port';
import {
  PROVEDOR_IDENTIDADE,
  ProvedorIdentidadePort,
} from '../portas/provedor-identidade.port';

export interface EntradaAtualizarPapel {
  usuarioId: string;
  novoPapel: Papel;
  novoContadorId: string | null;
  novoEmpresaId: string | null;
}

@Injectable()
export class AtualizarPapelUsuarioUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    @Inject(PROVEDOR_IDENTIDADE) private readonly provedorIdentidade: ProvedorIdentidadePort,
  ) {}

  async executar(entrada: EntradaAtualizarPapel): Promise<void> {
    validarCoerenciaEscopo(entrada.novoPapel, entrada.novoContadorId, entrada.novoEmpresaId);

    const papelId = await this.usuariosRepositorio.buscarIdPapelPorNome(entrada.novoPapel);

    // Banco primeiro: se falhar aqui, os claims antigos continuam consistentes com o
    // perfil antigo -- não há intervalo onde o app_metadata mente sobre o perfil real.
    await this.usuariosRepositorio.atualizarPapelEVinculo(
      entrada.usuarioId,
      papelId,
      entrada.novoContadorId,
      entrada.novoEmpresaId,
    );

    // Crítico: sem isso, o RLS continua filtrando pelo papel/vínculo ANTIGO até o
    // usuário forçar um novo login (docs/BANCO_DE_DADOS.md §1).
    await this.provedorIdentidade.sincronizarClaims(entrada.usuarioId, {
      papel: entrada.novoPapel,
      contadorId: entrada.novoContadorId,
      empresaId: entrada.novoEmpresaId,
    });
  }
}
