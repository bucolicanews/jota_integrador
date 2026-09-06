import { Inject, Injectable } from '@nestjs/common';
import { Papel, validarCoerenciaEscopo } from '../../dominio/papel';
import {
  USUARIOS_REPOSITORIO,
  Usuario,
  UsuariosRepositorioPort,
} from '../portas/usuarios-repositorio.port';
import {
  PROVEDOR_IDENTIDADE,
  ProvedorIdentidadePort,
} from '../portas/provedor-identidade.port';

export interface EntradaCriarUsuario {
  nome: string;
  email: string;
  papel: Papel;
  contadorId: string | null;
  empresaId: string | null;
}

@Injectable()
export class CriarUsuarioUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    @Inject(PROVEDOR_IDENTIDADE) private readonly provedorIdentidade: ProvedorIdentidadePort,
  ) {}

  async executar(entrada: EntradaCriarUsuario): Promise<Usuario> {
    validarCoerenciaEscopo(entrada.papel, entrada.contadorId, entrada.empresaId);

    // 1. Identidade primeiro (provedor de auth) -- o id gerado lá é o mesmo usado no perfil.
    const id = await this.provedorIdentidade.criarUsuarioComConvite(entrada.email);

    // 2. Sincroniza claims ANTES do perfil existir -- se falhar aqui, não sobra usuário
    //    "manco" (perfil sem claims, que quebraria RLS pra ele depois).
    await this.provedorIdentidade.sincronizarClaims(id, {
      papel: entrada.papel,
      contadorId: entrada.contadorId,
      empresaId: entrada.empresaId,
    });

    // 3. Perfil de domínio.
    const papelId = await this.usuariosRepositorio.buscarIdPapelPorNome(entrada.papel);
    return this.usuariosRepositorio.criar({
      id,
      nome: entrada.nome,
      email: entrada.email,
      papelId,
      contadorId: entrada.contadorId,
      empresaId: entrada.empresaId,
    });
  }
}
