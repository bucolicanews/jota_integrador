import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Papeis } from '../../auth/apresentacao/decorators/papeis.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma, Papel } from '../../auth/dominio/papel';
import { CreditarCreditosUseCase } from '../aplicacao/casos-de-uso/creditar-creditos.usecase';
import { ListarMovimentosUseCase } from '../aplicacao/casos-de-uso/listar-movimentos.usecase';
import { ObterSaldoUseCase } from '../aplicacao/casos-de-uso/obter-saldo.usecase';
import { MovimentoCredito } from '../aplicacao/portas/creditos-repositorio.port';
import { CreditarCreditosDto } from './dto/creditar-creditos.dto';

@Controller('contadores/:contadorId/creditos')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class CreditosController {
  constructor(
    private readonly obterSaldo: ObterSaldoUseCase,
    private readonly listarMovimentos: ListarMovimentosUseCase,
    private readonly creditarCreditos: CreditarCreditosUseCase,
  ) {}

  @Get('saldo')
  async saldo(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ saldo: number }> {
    this.exigirPosse(usuarioAtual, contadorId);
    return { saldo: await this.obterSaldo.executar(contadorId) };
  }

  @Get('movimentos')
  async movimentos(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<MovimentoCredito[]> {
    this.exigirPosse(usuarioAtual, contadorId);
    return this.listarMovimentos.executar(contadorId);
  }

  @Post('creditar')
  @Papeis(Papel.SUPER_ADMIN, Papel.ADMIN_FINANCEIRO)
  async creditar(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @Body() dto: CreditarCreditosDto,
  ): Promise<{ saldo: number }> {
    return { saldo: await this.creditarCreditos.executar(contadorId, dto.quantidade, dto.motivo) };
  }

  /** Plataforma ou o próprio contador -- créditos são dado financeiro, ninguém mais vê. */
  private exigirPosse(usuarioAtual: UsuarioAutenticado, contadorId: string): void {
    if (ehPapelDePlataforma(usuarioAtual.papel)) {
      return;
    }
    if (usuarioAtual.contadorId !== contadorId) {
      throw new ForbiddenException('Sem autoridade sobre os créditos deste contador');
    }
  }
}
