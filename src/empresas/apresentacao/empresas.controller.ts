import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Papeis } from '../../auth/apresentacao/decorators/papeis.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { AtualizarEmpresaUseCase } from '../aplicacao/casos-de-uso/atualizar-empresa.usecase';
import { AtualizarModoAcessoSerproUseCase } from '../aplicacao/casos-de-uso/atualizar-modo-acesso-serpro.usecase';
import { BloquearEmpresaUseCase } from '../aplicacao/casos-de-uso/bloquear-empresa.usecase';
import { CriarEmpresaUseCase } from '../aplicacao/casos-de-uso/criar-empresa.usecase';
import { DesbloquearEmpresaUseCase } from '../aplicacao/casos-de-uso/desbloquear-empresa.usecase';
import { ListarEmpresasUseCase } from '../aplicacao/casos-de-uso/listar-empresas.usecase';
import { ObterEmpresaUseCase } from '../aplicacao/casos-de-uso/obter-empresa.usecase';
import { Empresa } from '../aplicacao/portas/empresas-repositorio.port';
import { AtualizarEmpresaDto } from './dto/atualizar-empresa.dto';
import { AtualizarModoAcessoSerproDto } from './dto/atualizar-modo-acesso-serpro.dto';
import { BloquearEmpresaDto } from './dto/bloquear-empresa.dto';
import { CriarEmpresaDto } from './dto/criar-empresa.dto';

@Controller('empresas')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class EmpresasController {
  constructor(
    private readonly criarEmpresa: CriarEmpresaUseCase,
    private readonly listarEmpresas: ListarEmpresasUseCase,
    private readonly obterEmpresa: ObterEmpresaUseCase,
    private readonly atualizarEmpresa: AtualizarEmpresaUseCase,
    private readonly atualizarModoAcessoSerpro: AtualizarModoAcessoSerproUseCase,
    private readonly bloquearEmpresa: BloquearEmpresaUseCase,
    private readonly desbloquearEmpresa: DesbloquearEmpresaUseCase,
  ) {}

  @Post()
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO)
  async criar(
    @Body() dto: CriarEmpresaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Empresa> {
    const contadorId = usuarioAtual.papel === Papel.SUPER_ADMIN ? dto.contadorId : usuarioAtual.contadorId;

    if (!contadorId) {
      throw new BadRequestException('contadorId é obrigatório');
    }

    return this.criarEmpresa.executar({
      contadorId,
      razaoSocial: dto.razaoSocial,
      nomeFantasia: dto.nomeFantasia ?? null,
      cnpj: dto.cnpj,
      regimeTributario: dto.regimeTributario ?? null,
      modoAcessoSerpro: dto.modoAcessoSerpro,
    });
  }

  @Get()
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.OPERADOR_CONTADOR)
  async listar(
    @Query('contadorId') contadorIdConsulta: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Empresa[]> {
    const contadorId = usuarioAtual.papel === Papel.SUPER_ADMIN ? contadorIdConsulta : usuarioAtual.contadorId;

    if (!contadorId) {
      throw new BadRequestException('contadorId é obrigatório (via query, quando plataforma)');
    }

    return this.listarEmpresas.executar(contadorId);
  }

  @Get(':id')
  async obter(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Empresa> {
    const empresa = await this.obterEmpresa.executar(id);
    this.exigirPosse(usuarioAtual, empresa);
    return empresa;
  }

  @Patch(':id')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarEmpresaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.obterEmpresa.executar(id);
    this.exigirPosse(usuarioAtual, empresa);

    await this.atualizarEmpresa.executar(id, {
      razaoSocial: dto.razaoSocial,
      nomeFantasia: dto.nomeFantasia,
      regimeTributario: dto.regimeTributario,
    });
    return { ok: true };
  }

  @Patch(':id/modo-acesso-serpro')
  async atualizarModoAcesso(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarModoAcessoSerproDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.obterEmpresa.executar(id);
    this.exigirPosse(usuarioAtual, empresa);

    await this.atualizarModoAcessoSerpro.executar(id, dto.modoAcessoSerpro);
    return { ok: true };
  }

  @Post(':id/bloquear')
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO)
  async bloquear(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BloquearEmpresaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.obterEmpresa.executar(id);
    this.exigirPosseDeContador(usuarioAtual, empresa);

    await this.bloquearEmpresa.executar(id, dto.motivo, usuarioAtual.id);
    return { ok: true };
  }

  @Post(':id/desbloquear')
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO)
  async desbloquear(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.obterEmpresa.executar(id);
    this.exigirPosseDeContador(usuarioAtual, empresa);

    await this.desbloquearEmpresa.executar(id, usuarioAtual.id);
    return { ok: true };
  }

  /** Contador dono ou usuário da própria empresa (ou plataforma) -- leitura/edição básica. */
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

  /**
   * Bloqueio/desbloqueio: só o contador dono ou a plataforma -- nunca o próprio
   * empresário (não faz sentido a empresa se autobloquear, ver docs/BANCO_DE_DADOS.md §7).
   */
  private exigirPosseDeContador(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN) {
      return;
    }
    if (usuarioAtual.contadorId !== empresa.contadorId) {
      throw new ForbiddenException('Sem autoridade sobre esta empresa');
    }
  }
}
