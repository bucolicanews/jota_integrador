import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import { ListarMensagensUseCase } from '../aplicacao/casos-de-uso/listar-mensagens.usecase';
import { MarcarComoLidaUseCase } from '../aplicacao/casos-de-uso/marcar-como-lida.usecase';
import { ObterDetalheMensagemUseCase } from '../aplicacao/casos-de-uso/obter-detalhe-mensagem.usecase';
import { SincronizarMensagensUseCase } from '../aplicacao/casos-de-uso/sincronizar-mensagens.usecase';
import { MensagemCaixaPostal } from '../aplicacao/portas/mensagens-caixa-postal-repositorio.port';

@Controller('empresas/:empresaId/caixa-postal')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class CaixaPostalController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly sincronizarMensagens: SincronizarMensagensUseCase,
    private readonly listarMensagens: ListarMensagensUseCase,
    private readonly obterDetalhe: ObterDetalheMensagemUseCase,
    private readonly marcarComoLida: MarcarComoLidaUseCase,
  ) {}

  @Get()
  async listar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<MensagemCaixaPostal[]> {
    await this.exigirPosse(empresaId, usuarioAtual);
    return this.listarMensagens.executar(empresaId);
  }

  @Post('sincronizar')
  async sincronizar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ sincronizadas: number }> {
    await this.exigirPosse(empresaId, usuarioAtual);
    return this.sincronizarMensagens.executar(empresaId);
  }

  @Get('mensagens/:mensagemId')
  async detalhe(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('mensagemId', ParseUUIDPipe) mensagemId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ conteudo: string }> {
    await this.exigirPosse(empresaId, usuarioAtual);
    const conteudo = await this.obterDetalhe.executar(mensagemId);
    return { conteudo };
  }

  @Post('mensagens/:mensagemId/marcar-lida')
  async marcarLida(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('mensagemId', ParseUUIDPipe) mensagemId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    await this.exigirPosse(empresaId, usuarioAtual);
    await this.marcarComoLida.executar(mensagemId);
    return { ok: true };
  }

  private async exigirPosse(empresaId: string, usuarioAtual: UsuarioAutenticado): Promise<void> {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN) return;

    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }
    this.checarPosse(usuarioAtual, empresa);
  }

  /** Mesmo padrão de posse de SerproController/ProcuracoesController -- contador dono ou usuário da própria empresa. */
  private checarPosse(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    const ehContadorDono = usuarioAtual.contadorId !== null && usuarioAtual.contadorId === empresa.contadorId;
    const ehDaPropriaEmpresa = usuarioAtual.empresaId !== null && usuarioAtual.empresaId === empresa.id;
    if (!ehContadorDono && !ehDaPropriaEmpresa) {
      throw new ForbiddenException('Sem autoridade sobre esta empresa');
    }
  }
}
