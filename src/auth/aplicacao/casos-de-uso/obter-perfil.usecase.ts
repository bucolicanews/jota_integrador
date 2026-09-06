import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  USUARIOS_REPOSITORIO,
  Usuario,
  UsuariosRepositorioPort,
} from '../portas/usuarios-repositorio.port';

@Injectable()
export class ObterPerfilUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
  ) {}

  async executar(usuarioId: string): Promise<Usuario> {
    const usuario = await this.usuariosRepositorio.buscarPorId(usuarioId);
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return usuario;
  }
}
