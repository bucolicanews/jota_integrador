import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Papeis } from '../../auth/apresentacao/decorators/papeis.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import {
  EMPRESAS_REPOSITORIO,
  Empresa,
  EmpresasRepositorioPort,
} from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { AtualizarStatusProcuracaoUseCase } from '../aplicacao/casos-de-uso/atualizar-status-procuracao.usecase';
import { ObterProcuracaoUseCase } from '../aplicacao/casos-de-uso/obter-procuracao.usecase';
import { Procuracao } from '../aplicacao/portas/procuracoes-repositorio.port';
import { AtualizarStatusProcuracaoDto } from './dto/atualizar-status-procuracao.dto';

@Controller('empresas/:empresaId/procuracao')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class ProcuracoesController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly obterProcuracao: ObterProcuracaoUseCase,
    private readonly atualizarStatusProcuracao: AtualizarStatusProcuracaoUseCase,
  ) {}

  @Get()
  async obter(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Procuracao> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);

    return this.obterProcuracao.executar(empresaId);
  }

  /** Plataforma-only (RLS `procuracoes_insert`/`_update` já exige `eh_plataforma()`) -- sincronização manual do status vindo do e-CAC/gov.br. */
  @Patch()
  @Papeis(Papel.SUPER_ADMIN, Papel.ADMIN_SUPORTE)
  async atualizarStatus(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: AtualizarStatusProcuracaoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Procuracao> {
    await this.buscarEmpresaOuFalhar(empresaId);

    return this.atualizarStatusProcuracao.executar(
      empresaId,
      { status: dto.status, outorgadaEm: dto.outorgadaEm, expiraEm: dto.expiraEm },
      usuarioAtual.id,
    );
  }

  private async buscarEmpresaOuFalhar(empresaId: string): Promise<Empresa> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }
    return empresa;
  }

  /** Mesmo padrão de posse de EmpresasController/SerproController -- contador dono ou usuário da própria empresa. */
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
