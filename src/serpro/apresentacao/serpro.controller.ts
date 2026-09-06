import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import {
  EMPRESAS_REPOSITORIO,
  Empresa,
  EmpresasRepositorioPort,
} from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { ConsultarCcmeiUseCase } from '../aplicacao/casos-de-uso/consultar-ccmei.usecase';

@Controller('empresas/:empresaId/serpro')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class SerproController {
  constructor(
    // Injeta a porta (EMPRESAS_REPOSITORIO), não um caso de uso do EmpresasModule --
    // EmpresasModule só exporta o token do repositório, mesmo padrão já usado em
    // AuthController pra checagem de posse (não exportar casos de uso concretos entre
    // módulos, só interfaces/tokens).
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly consultarCcmei: ConsultarCcmeiUseCase,
  ) {}

  @Get('ccmei')
  async ccmei(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<unknown> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }
    this.exigirPosse(usuarioAtual, empresa);

    return this.consultarCcmei.executar(empresaId);
  }

  /** Mesmo padrão de posse de EmpresasController -- contador dono ou usuário da própria empresa. */
  private exigirPosse(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN) {
      return;
    }
    const ehContadorDono = usuarioAtual.contadorId !== null && usuarioAtual.contadorId === empresa.contadorId;
    const ehDaPropriaEmpresa = usuarioAtual.empresaId !== null && usuarioAtual.empresaId === empresa.id;

    if (!ehContadorDono && !ehDaPropriaEmpresa) {
      throw new ForbiddenException('Sem autoridade sobre esta empresa');
    }
  }
}
