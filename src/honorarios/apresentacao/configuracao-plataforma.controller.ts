import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Papeis } from '../../auth/apresentacao/decorators/papeis.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { GerenciarComissaoPlataformaUseCase } from '../aplicacao/casos-de-uso/gerenciar-comissao-plataforma.usecase';
import { AtualizarComissaoDto } from './dto/atualizar-comissao.dto';

@Controller('configuracoes-plataforma/comissao-honorarios')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
@Papeis(Papel.SUPER_ADMIN, Papel.ADMIN_FINANCEIRO)
export class ConfiguracaoPlataformaController {
  constructor(private readonly comissao: GerenciarComissaoPlataformaUseCase) {}

  @Get()
  async obter(): Promise<{ comissaoHonorariosPct: number }> {
    return { comissaoHonorariosPct: await this.comissao.obter() };
  }

  @Patch()
  async atualizar(
    @Body() dto: AtualizarComissaoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    await this.comissao.atualizar(dto.comissaoHonorariosPct, usuarioAtual.id);
    return { ok: true };
  }
}
