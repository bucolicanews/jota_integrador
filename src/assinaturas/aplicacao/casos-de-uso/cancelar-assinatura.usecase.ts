import { Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { StripeAssinaturasService } from '../../infraestrutura/stripe-assinaturas.service';
import { ASSINATURAS_REPOSITORIO, AssinaturasRepositorioPort } from '../portas/assinaturas-repositorio.port';

/**
 * Cancela a RENOVAÇÃO, não a assinatura em si -- o contador continua com acesso até o
 * fim do período já pago (`cancel_at_period_end`, padrão Stripe). O status só vira
 * "cancelada" de fato quando o Stripe manda `customer.subscription.deleted` no fim do
 * período (ver ProcessarWebhookStripeAssinaturaUseCase).
 */
@Injectable()
export class CancelarAssinaturaUseCase {
  private readonly logger = new Logger(CancelarAssinaturaUseCase.name);

  constructor(
    @Inject(ASSINATURAS_REPOSITORIO) private readonly assinaturasRepositorio: AssinaturasRepositorioPort,
    private readonly stripe: StripeAssinaturasService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(contadorId: string, executadoPorId: string): Promise<void> {
    const assinatura = await this.assinaturasRepositorio.buscarAtivaPorContador(contadorId);
    if (!assinatura || !assinatura.stripeSubscriptionId) {
      throw new NotFoundException('Contador não tem assinatura ativa para cancelar');
    }

    try {
      await this.stripe.cancelarNoFimDoPeriodo(assinatura.stripeSubscriptionId);
    } catch (erro) {
      this.logger.error(`Falha ao cancelar assinatura Stripe (assinatura=${assinatura.id}): ${(erro as Error).message}`);
      throw new InternalServerErrorException('Não foi possível cancelar a assinatura -- tente novamente em instantes');
    }
    await this.assinaturasRepositorio.atualizarRenovacaoAutomatica(assinatura.id, false);

    await this.auditoria.registrar({
      usuarioId: executadoPorId,
      contadorId,
      acao: 'assinatura.cancelar_renovacao',
      recurso: 'assinaturas',
      dadosAntigos: { assinaturaId: assinatura.id, renovacaoAutomatica: true },
      dadosNovos: { assinaturaId: assinatura.id, renovacaoAutomatica: false },
    });
  }
}
