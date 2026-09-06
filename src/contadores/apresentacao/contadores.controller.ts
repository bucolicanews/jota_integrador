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
  UseGuards,
} from '@nestjs/common';
import { Papeis } from '../../auth/apresentacao/decorators/papeis.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma, Papel } from '../../auth/dominio/papel';
import { AtualizarContadorUseCase } from '../aplicacao/casos-de-uso/atualizar-contador.usecase';
import { BloquearContadorUseCase } from '../aplicacao/casos-de-uso/bloquear-contador.usecase';
import { CriarContadorUseCase } from '../aplicacao/casos-de-uso/criar-contador.usecase';
import { DesbloquearContadorUseCase } from '../aplicacao/casos-de-uso/desbloquear-contador.usecase';
import { ListarContadoresUseCase } from '../aplicacao/casos-de-uso/listar-contadores.usecase';
import { ObterContadorUseCase } from '../aplicacao/casos-de-uso/obter-contador.usecase';
import { Contador } from '../aplicacao/portas/contadores-repositorio.port';
import { AtualizarContadorDto } from './dto/atualizar-contador.dto';
import { BloquearContadorDto } from './dto/bloquear-contador.dto';
import { CriarContadorDto } from './dto/criar-contador.dto';

@Controller('contadores')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class ContadoresController {
  constructor(
    private readonly criarContador: CriarContadorUseCase,
    private readonly listarContadores: ListarContadoresUseCase,
    private readonly obterContador: ObterContadorUseCase,
    private readonly atualizarContador: AtualizarContadorUseCase,
    private readonly bloquearContador: BloquearContadorUseCase,
    private readonly desbloquearContador: DesbloquearContadorUseCase,
  ) {}

  @Post()
  @Papeis(Papel.SUPER_ADMIN)
  async criar(@Body() dto: CriarContadorDto): Promise<Contador> {
    return this.criarContador.executar({
      nome: dto.nome,
      cnpjCpf: dto.cnpjCpf,
      email: dto.email,
      telefone: dto.telefone ?? null,
    });
  }

  @Get()
  @Papeis(Papel.SUPER_ADMIN, Papel.ADMIN_FINANCEIRO, Papel.ADMIN_SUPORTE)
  async listar(): Promise<Contador[]> {
    return this.listarContadores.executar();
  }

  // Precisa vir antes de `:id` -- senão o NestJS tentaria tratar "me" como um id.
  @Get('me')
  async me(@UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<Contador> {
    if (!usuarioAtual.contadorId) {
      throw new BadRequestException('Usuário atual não está vinculado a um contador');
    }
    return this.obterContador.executar(usuarioAtual.contadorId);
  }

  @Get(':id')
  async obter(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Contador> {
    this.exigirPosse(usuarioAtual, id);
    return this.obterContador.executar(id);
  }

  @Patch(':id')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarContadorDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    this.exigirPosse(usuarioAtual, id);
    await this.atualizarContador.executar(id, dto);
    return { ok: true };
  }

  @Post(':id/bloquear')
  @Papeis(Papel.SUPER_ADMIN)
  async bloquear(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BloquearContadorDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    await this.bloquearContador.executar(id, dto.motivo, usuarioAtual.id);
    return { ok: true };
  }

  @Post(':id/desbloquear')
  @Papeis(Papel.SUPER_ADMIN)
  async desbloquear(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    await this.desbloquearContador.executar(id, usuarioAtual.id);
    return { ok: true };
  }

  /**
   * Qualquer papel de plataforma (SUPER_ADMIN, ADMIN_FINANCEIRO, ADMIN_SUPORTE) ou o
   * próprio contador -- nunca outro contador. `atualizar` (dados básicos) fica mais
   * permissivo de propósito: financeiro/suporte também precisam corrigir cadastro.
   */
  private exigirPosse(usuarioAtual: UsuarioAutenticado, contadorId: string): void {
    if (ehPapelDePlataforma(usuarioAtual.papel)) {
      return;
    }
    if (usuarioAtual.contadorId !== contadorId) {
      throw new ForbiddenException('Sem autoridade sobre este contador');
    }
  }
}
