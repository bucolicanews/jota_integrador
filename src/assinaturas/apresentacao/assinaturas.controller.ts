import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma } from '../../auth/dominio/papel';
import { CancelarAssinaturaUseCase } from '../aplicacao/casos-de-uso/cancelar-assinatura.usecase';
import { IniciarCheckoutAssinaturaUseCase } from '../aplicacao/casos-de-uso/iniciar-checkout-assinatura.usecase';
import { ListarFaturasUseCase } from '../aplicacao/casos-de-uso/listar-faturas.usecase';
import { ObterAssinaturaAtualUseCase } from '../aplicacao/casos-de-uso/obter-assinatura-atual.usecase';
import { Assinatura, Fatura } from '../aplicacao/portas/assinaturas-repositorio.port';
import { IniciarCheckoutDto } from './dto/iniciar-checkout.dto';

@Controller('contadores/:contadorId')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class AssinaturasController {
  constructor(
    private readonly obterAssinaturaAtual: ObterAssinaturaAtualUseCase,
    private readonly iniciarCheckout: IniciarCheckoutAssinaturaUseCase,
    private readonly cancelarAssinatura: CancelarAssinaturaUseCase,
    private readonly listarFaturas: ListarFaturasUseCase,
  ) {}

  @Get('assinatura')
  async assinaturaAtual(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Assinatura | null> {
    this.exigirPosse(usuarioAtual, contadorId);
    return this.obterAssinaturaAtual.executar(contadorId);
  }

  @Post('assinatura/checkout')
  async checkout(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @Body() dto: IniciarCheckoutDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ url: string }> {
    this.exigirPosse(usuarioAtual, contadorId);
    return this.iniciarCheckout.executar({
      contadorId,
      planoId: dto.planoId,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
    });
  }

  @Post('assinatura/cancelar')
  async cancelar(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    this.exigirPosse(usuarioAtual, contadorId);
    await this.cancelarAssinatura.executar(contadorId, usuarioAtual.id);
    return { ok: true };
  }

  @Get('faturas')
  async faturas(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Fatura[]> {
    this.exigirPosse(usuarioAtual, contadorId);
    return this.listarFaturas.executar(contadorId);
  }

  /** Plataforma ou o próprio contador -- assinatura/fatura é dado financeiro, mesma regra do CreditosController. */
  private exigirPosse(usuarioAtual: UsuarioAutenticado, contadorId: string): void {
    if (ehPapelDePlataforma(usuarioAtual.papel)) {
      return;
    }
    if (usuarioAtual.contadorId !== contadorId) {
      throw new ForbiddenException('Sem autoridade sobre a assinatura deste contador');
    }
  }
}
