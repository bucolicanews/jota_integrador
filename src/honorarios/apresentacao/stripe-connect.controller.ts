import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma } from '../../auth/dominio/papel';
import {
  CONTADORES_REPOSITORIO,
  ContadoresRepositorioPort,
} from '../../contadores/aplicacao/portas/contadores-repositorio.port';
import { IniciarOnboardingStripeConnectUseCase } from '../aplicacao/casos-de-uso/iniciar-onboarding-stripe-connect.usecase';
import { IniciarOnboardingDto } from './dto/iniciar-onboarding.dto';

@Controller('contadores/:contadorId/stripe-connect')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class StripeConnectController {
  constructor(
    @Inject(CONTADORES_REPOSITORIO) private readonly contadoresRepositorio: ContadoresRepositorioPort,
    private readonly iniciarOnboarding: IniciarOnboardingStripeConnectUseCase,
  ) {}

  @Post('onboarding')
  async onboarding(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @Body() dto: IniciarOnboardingDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ url: string }> {
    this.exigirPosse(usuarioAtual, contadorId);
    return this.iniciarOnboarding.executar(contadorId, dto.refreshUrl, dto.returnUrl);
  }

  /** Frontend usa isso pra decidir se mostra a opção de cobrar honorário (docs/SEGURANCA.md §7 -- gating no backend). */
  @Get('status')
  async status(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean }> {
    this.exigirPosse(usuarioAtual, contadorId);

    const contador = await this.contadoresRepositorio.buscarPorId(contadorId);
    if (!contador) {
      throw new NotFoundException('Contador não encontrado');
    }
    return {
      chargesEnabled: contador.stripeChargesEnabled,
      payoutsEnabled: contador.stripePayoutsEnabled,
      detailsSubmitted: contador.stripeDetailsSubmitted,
    };
  }

  /** Plataforma ou o próprio contador -- mesma regra de CreditosController/AssinaturasController. */
  private exigirPosse(usuarioAtual: UsuarioAutenticado, contadorId: string): void {
    if (ehPapelDePlataforma(usuarioAtual.papel)) {
      return;
    }
    if (usuarioAtual.contadorId !== contadorId) {
      throw new ForbiddenException('Sem autoridade sobre o Stripe Connect deste contador');
    }
  }
}
