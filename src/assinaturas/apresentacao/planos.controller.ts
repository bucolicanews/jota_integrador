import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Papeis } from '../../auth/apresentacao/decorators/papeis.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma, Papel } from '../../auth/dominio/papel';
import { AtualizarPlanoUseCase } from '../aplicacao/casos-de-uso/atualizar-plano.usecase';
import { CriarPlanoUseCase } from '../aplicacao/casos-de-uso/criar-plano.usecase';
import { ListarPlanosUseCase } from '../aplicacao/casos-de-uso/listar-planos.usecase';
import { Plano } from '../aplicacao/portas/planos-repositorio.port';
import { AtualizarPlanoDto } from './dto/atualizar-plano.dto';
import { CriarPlanoDto } from './dto/criar-plano.dto';

@Controller('planos')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class PlanosController {
  constructor(
    private readonly criarPlano: CriarPlanoUseCase,
    private readonly listarPlanos: ListarPlanosUseCase,
    private readonly atualizarPlano: AtualizarPlanoUseCase,
  ) {}

  /** Catálogo público (qualquer autenticado) -- não-plataforma só vê ativo=true, mesmo pedindo o contrário. */
  @Get()
  async listar(@UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<Plano[]> {
    const somenteAtivos = !ehPapelDePlataforma(usuarioAtual.papel);
    return this.listarPlanos.executar(somenteAtivos);
  }

  @Post()
  @Papeis(Papel.SUPER_ADMIN, Papel.ADMIN_FINANCEIRO)
  async criar(@Body() dto: CriarPlanoDto): Promise<Plano> {
    return this.criarPlano.executar(dto);
  }

  @Patch(':id')
  @Papeis(Papel.SUPER_ADMIN, Papel.ADMIN_FINANCEIRO)
  async atualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarPlanoDto): Promise<Plano> {
    return this.atualizarPlano.executar(id, dto);
  }
}
