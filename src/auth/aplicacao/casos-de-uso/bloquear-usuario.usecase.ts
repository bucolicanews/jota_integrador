import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  USUARIOS_REPOSITORIO,
  UsuariosRepositorioPort,
} from '../portas/usuarios-repositorio.port';
import {
  PROVEDOR_IDENTIDADE,
  ProvedorIdentidadePort,
} from '../portas/provedor-identidade.port';

@Injectable()
export class BloquearUsuarioUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    @Inject(PROVEDOR_IDENTIDADE) private readonly provedorIdentidade: ProvedorIdentidadePort,
  ) {}

  async executar(usuarioId: string, motivo: string, executadoPorId: string): Promise<void> {
    if (usuarioId === executadoPorId) {
      // Mesma regra já aplicada no /admin/usuarios do DeliveryHub: ninguém bloqueia a
      // própria conta (evitaria lockout acidental de um admin único).
      throw new BadRequestException('Não é possível bloquear a própria conta');
    }

    await this.usuariosRepositorio.marcarBloqueio(usuarioId, true, motivo, executadoPorId);
    // Ban nativo do provedor -- impede login imediatamente. Sessão já ativa (access
    // token de curta duração, 15min) continua válida até expirar, mesmo trade-off já
    // aceito no DeliveryHub pra não ter que consultar o banco em toda request autenticada.
    await this.provedorIdentidade.bloquearAcesso(usuarioId);
  }
}
