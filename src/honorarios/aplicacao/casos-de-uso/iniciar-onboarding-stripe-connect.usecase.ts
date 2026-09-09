import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CONTADORES_REPOSITORIO,
  ContadoresRepositorioPort,
} from '../../../contadores/aplicacao/portas/contadores-repositorio.port';
import { StripeHonorariosService } from '../../infraestrutura/stripe-honorarios.service';

@Injectable()
export class IniciarOnboardingStripeConnectUseCase {
  private readonly logger = new Logger(IniciarOnboardingStripeConnectUseCase.name);

  constructor(
    @Inject(CONTADORES_REPOSITORIO) private readonly contadoresRepositorio: ContadoresRepositorioPort,
    private readonly stripe: StripeHonorariosService,
  ) {}

  async executar(contadorId: string, refreshUrl: string, returnUrl: string): Promise<{ url: string }> {
    const contador = await this.contadoresRepositorio.buscarPorId(contadorId);
    if (!contador) {
      throw new NotFoundException('Contador não encontrado');
    }

    try {
      let stripeAccountId = contador.stripeAccountId;
      if (!stripeAccountId) {
        stripeAccountId = await this.stripe.criarContaExpress(contador.id, contador.email);
        await this.contadoresRepositorio.atualizarStripeAccountId(contador.id, stripeAccountId);
      }

      const url = await this.stripe.criarLinkOnboarding(stripeAccountId, refreshUrl, returnUrl);
      return { url };
    } catch (erro) {
      this.logger.error(`Falha ao iniciar onboarding Stripe Connect (contador=${contador.id}): ${(erro as Error).message}`);
      throw new InternalServerErrorException('Não foi possível iniciar o cadastro de recebimento -- tente novamente em instantes');
    }
  }
}
