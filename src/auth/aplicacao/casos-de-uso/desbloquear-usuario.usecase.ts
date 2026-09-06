import { Inject, Injectable } from '@nestjs/common';
import {
  USUARIOS_REPOSITORIO,
  UsuariosRepositorioPort,
} from '../portas/usuarios-repositorio.port';
import {
  PROVEDOR_IDENTIDADE,
  ProvedorIdentidadePort,
} from '../portas/provedor-identidade.port';

@Injectable()
export class DesbloquearUsuarioUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    @Inject(PROVEDOR_IDENTIDADE) private readonly provedorIdentidade: ProvedorIdentidadePort,
  ) {}

  async executar(usuarioId: string, executadoPorId: string): Promise<void> {
    await this.usuariosRepositorio.marcarBloqueio(usuarioId, false, null, executadoPorId);
    await this.provedorIdentidade.desbloquearAcesso(usuarioId);
  }
}
