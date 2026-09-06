import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ESCOPO_POR_PAPEL, Papel } from '../dominio/papel';
import { AtualizarPapelUsuarioUseCase } from '../aplicacao/casos-de-uso/atualizar-papel-usuario.usecase';
import { BloquearUsuarioUseCase } from '../aplicacao/casos-de-uso/bloquear-usuario.usecase';
import { CriarUsuarioUseCase } from '../aplicacao/casos-de-uso/criar-usuario.usecase';
import { DesbloquearUsuarioUseCase } from '../aplicacao/casos-de-uso/desbloquear-usuario.usecase';
import { LogoutGlobalUseCase } from '../aplicacao/casos-de-uso/logout-global.usecase';
import { ObterPerfilUseCase } from '../aplicacao/casos-de-uso/obter-perfil.usecase';
import { Usuario } from '../aplicacao/portas/usuarios-repositorio.port';
import { AtualizarPapelUsuarioDto } from './dto/atualizar-papel-usuario.dto';
import { BloquearUsuarioDto } from './dto/bloquear-usuario.dto';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { Papeis } from './decorators/papeis.decorator';
import { UsuarioAtual } from './decorators/usuario-atual.decorator';
import { PapeisGuard } from './guards/papeis.guard';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { UsuarioAutenticado } from './tipos/requisicao-autenticada';

@Controller('auth')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class AuthController {
  constructor(
    private readonly criarUsuario: CriarUsuarioUseCase,
    private readonly atualizarPapelUsuario: AtualizarPapelUsuarioUseCase,
    private readonly bloquearUsuario: BloquearUsuarioUseCase,
    private readonly desbloquearUsuario: DesbloquearUsuarioUseCase,
    private readonly obterPerfil: ObterPerfilUseCase,
    private readonly logoutGlobal: LogoutGlobalUseCase,
  ) {}

  @Get('me')
  async me(@UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<Usuario> {
    return this.obterPerfil.executar(usuarioAtual.id);
  }

  @Post('logout-global')
  async logout(@UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<{ ok: true }> {
    await this.logoutGlobal.executar(usuarioAtual.id);
    return { ok: true };
  }

  @Post('usuarios')
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async criar(
    @Body() dto: CriarUsuarioDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Usuario> {
    const vinculo = this.resolverVinculoPermitido(usuarioAtual, dto.papel, dto.contadorId ?? null, dto.empresaId ?? null);

    return this.criarUsuario.executar({
      nome: dto.nome,
      email: dto.email,
      papel: dto.papel,
      contadorId: vinculo.contadorId,
      empresaId: vinculo.empresaId,
    });
  }

  @Patch('usuarios/:id/papel')
  @Papeis(Papel.SUPER_ADMIN) // TODO: permitir CONTADOR_DONO gerenciar papel dos próprios OPERADOR_CONTADOR
  async atualizarPapel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarPapelUsuarioDto,
  ): Promise<{ ok: true }> {
    await this.atualizarPapelUsuario.executar({
      usuarioId: id,
      novoPapel: dto.papel,
      novoContadorId: dto.contadorId ?? null,
      novoEmpresaId: dto.empresaId ?? null,
    });
    return { ok: true };
  }

  @Post('usuarios/:id/bloquear')
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async bloquear(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BloquearUsuarioDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const alvo = await this.obterPerfil.executar(id);
    this.exigirAutoridadeSobre(usuarioAtual, alvo);

    await this.bloquearUsuario.executar(id, dto.motivo, usuarioAtual.id);
    return { ok: true };
  }

  @Post('usuarios/:id/desbloquear')
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async desbloquear(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const alvo = await this.obterPerfil.executar(id);
    this.exigirAutoridadeSobre(usuarioAtual, alvo);

    await this.desbloquearUsuario.executar(id, usuarioAtual.id);
    return { ok: true };
  }

  /**
   * Restringe o vínculo (contadorId/empresaId) ao que o usuário atual tem autoridade
   * de criar -- nunca confia no que veio no DTO pra quem não é plataforma (Zero Trust).
   * LIMITAÇÃO CONHECIDA (v1): um CONTADOR_DONO só pode criar usuário de escopo `contador`
   * (pra dentro do próprio escritório) -- criar EMPRESARIO_DONO/OPERADOR_EMPRESA pra uma
   * empresa da carteira exige checar posse da empresa, que depende do módulo `empresas/`
   * (ainda não implementado). Só a plataforma pode fazer isso por enquanto.
   */
  private resolverVinculoPermitido(
    usuarioAtual: UsuarioAutenticado,
    papelNovo: Papel,
    contadorIdSolicitado: string | null,
    empresaIdSolicitado: string | null,
  ): { contadorId: string | null; empresaId: string | null } {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN) {
      return { contadorId: contadorIdSolicitado, empresaId: empresaIdSolicitado };
    }

    const escopoNovo = ESCOPO_POR_PAPEL[papelNovo];

    if (usuarioAtual.papel === Papel.CONTADOR_DONO && escopoNovo === 'contador') {
      return { contadorId: usuarioAtual.contadorId, empresaId: null };
    }
    if (usuarioAtual.papel === Papel.EMPRESARIO_DONO && escopoNovo === 'empresa') {
      return { contadorId: null, empresaId: usuarioAtual.empresaId };
    }

    throw new ForbiddenException('Sem autoridade para criar usuário com este papel/vínculo');
  }

  /** Ninguém além da plataforma age sobre usuário fora do próprio contador/empresa. */
  private exigirAutoridadeSobre(usuarioAtual: UsuarioAutenticado, alvo: Usuario): void {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN) {
      return;
    }
    const mesmoContador = usuarioAtual.contadorId !== null && usuarioAtual.contadorId === alvo.contadorId;
    const mesmaEmpresa = usuarioAtual.empresaId !== null && usuarioAtual.empresaId === alvo.empresaId;

    if (!mesmoContador && !mesmaEmpresa) {
      throw new ForbiddenException('Sem autoridade sobre este usuário');
    }
  }
}
