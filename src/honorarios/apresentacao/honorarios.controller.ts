import { Body, Controller, ForbiddenException, Get, Inject, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma } from '../../auth/dominio/papel';
import {
  EMPRESAS_REPOSITORIO,
  Empresa,
  EmpresasRepositorioPort,
} from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { CriarCobrancaHonorarioUseCase } from '../aplicacao/casos-de-uso/criar-cobranca-honorario.usecase';
import { ListarCobrancasHonorarioUseCase } from '../aplicacao/casos-de-uso/listar-cobrancas-honorario.usecase';
import { CobrancaHonorario } from '../aplicacao/portas/cobrancas-honorarios-repositorio.port';
import { CriarCobrancaDto } from './dto/criar-cobranca.dto';

@Controller()
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class HonorariosController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly criarCobranca: CriarCobrancaHonorarioUseCase,
    private readonly listarCobrancas: ListarCobrancasHonorarioUseCase,
  ) {}

  /** Lista completa da carteira do contador (todas as empresas). */
  @Get('contadores/:contadorId/honorarios')
  async listarPorContador(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<CobrancaHonorario[]> {
    this.exigirPosseContador(usuarioAtual, contadorId);
    return this.listarCobrancas.porContador(contadorId);
  }

  @Post('contadores/:contadorId/empresas/:empresaId/honorarios')
  async criar(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: CriarCobrancaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ url: string; cobranca: CobrancaHonorario }> {
    this.exigirPosseContador(usuarioAtual, contadorId);
    return this.criarCobranca.executar({
      contadorId,
      empresaId,
      descricao: dto.descricao,
      valor: dto.valor,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
    });
  }

  /** Lado empresa -- ver as cobranças que recebeu, mesmo sem ser "dona" no sentido de contadorId. */
  @Get('empresas/:empresaId/honorarios')
  async listarPorEmpresa(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<CobrancaHonorario[]> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      return [];
    }
    this.exigirPosseEmpresa(usuarioAtual, empresa);
    return this.listarCobrancas.porEmpresa(empresaId);
  }

  private exigirPosseContador(usuarioAtual: UsuarioAutenticado, contadorId: string): void {
    if (ehPapelDePlataforma(usuarioAtual.papel)) return;
    if (usuarioAtual.contadorId !== contadorId) {
      throw new ForbiddenException('Sem autoridade sobre os honorários deste contador');
    }
  }

  private exigirPosseEmpresa(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    if (ehPapelDePlataforma(usuarioAtual.papel)) return;
    const ehContadorDono = usuarioAtual.contadorId !== null && usuarioAtual.contadorId === empresa.contadorId;
    const ehDaPropriaEmpresa = usuarioAtual.empresaId !== null && usuarioAtual.empresaId === empresa.id;
    if (!ehContadorDono && !ehDaPropriaEmpresa) {
      throw new ForbiddenException('Sem autoridade sobre esta empresa');
    }
  }
}
