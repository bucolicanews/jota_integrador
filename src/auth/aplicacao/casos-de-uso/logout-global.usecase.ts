import { Inject, Injectable } from '@nestjs/common';
import {
  PROVEDOR_IDENTIDADE,
  ProvedorIdentidadePort,
} from '../portas/provedor-identidade.port';

@Injectable()
export class LogoutGlobalUseCase {
  constructor(
    @Inject(PROVEDOR_IDENTIDADE) private readonly provedorIdentidade: ProvedorIdentidadePort,
  ) {}

  async executar(usuarioId: string): Promise<void> {
    await this.provedorIdentidade.revogarSessoes(usuarioId);
  }
}
