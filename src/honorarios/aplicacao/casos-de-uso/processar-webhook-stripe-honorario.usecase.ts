import { Inject, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import {
  CONTADORES_REPOSITORIO,
  ContadoresRepositorioPort,
} from '../../../contadores/aplicacao/portas/contadores-repositorio.port';
import { StripeHonorariosService } from '../../infraestrutura/stripe-honorarios.service';
import { COBRANCAS_HONORARIOS_REPOSITORIO, CobrancasHonorariosRepositorioPort } from '../portas/cobrancas-honorarios-repositorio.port';

const GATEWAY = 'stripe_honorarios';

/**
 * Eventos escutados: `account.updated` (sincroniza charges_enabled/payouts_enabled/
 * details_submitted -- ÚNICA forma permitida de mudar esses campos, docs/SEGURANCA.md
 * §7), `payment_intent.succeeded`/`payment_intent.payment_failed` (confirma/reprova
 * uma cobrança). Diferente de assinaturas/, aqui não existe risco de "creditar duas
 * vezes" (cada cobrança é um pagamento único, não recorrente) -- ainda assim só um
 * evento por desfecho é tratado, pra manter o mesmo padrão de fonte única de verdade.
 */
@Injectable()
export class ProcessarWebhookStripeHonorarioUseCase {
  private readonly logger = new Logger(ProcessarWebhookStripeHonorarioUseCase.name);

  constructor(
    @Inject(COBRANCAS_HONORARIOS_REPOSITORIO)
    private readonly cobrancasRepositorio: CobrancasHonorariosRepositorioPort,
    @Inject(CONTADORES_REPOSITORIO) private readonly contadoresRepositorio: ContadoresRepositorioPort,
    private readonly stripe: StripeHonorariosService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(payloadBruto: Buffer, assinaturaHeader: string): Promise<void> {
    const event = this.stripe.construirEvento(payloadBruto, assinaturaHeader);

    if (await this.cobrancasRepositorio.jaProcessouEventoWebhook(GATEWAY, event.id)) {
      this.logger.log(`Evento ${event.id} (${event.type}) já processado -- ignorando (idempotência).`);
      return;
    }

    switch (event.type) {
      case 'account.updated':
        await this.tratarContaAtualizada(event.data.object as Stripe.Account);
        break;
      case 'payment_intent.succeeded':
        await this.tratarPagamentoSucedido(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.tratarPagamentoFalhou(event.data.object as Stripe.PaymentIntent);
        break;
      default:
        break;
    }

    await this.cobrancasRepositorio.marcarEventoWebhookProcessado(GATEWAY, event.id);
  }

  private async tratarContaAtualizada(account: Stripe.Account): Promise<void> {
    const contadorId = account.metadata?.contador_id;
    if (!contadorId) {
      this.logger.warn(`account.updated (${account.id}) sem metadata.contador_id -- ignorando.`);
      return;
    }

    await this.contadoresRepositorio.atualizarStatusStripeConnect(contadorId, {
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      detailsSubmitted: account.details_submitted ?? false,
    });

    await this.auditoria.registrar({
      usuarioId: null,
      contadorId,
      acao: 'contador.stripe_connect_atualizado',
      recurso: 'contadores',
      dadosNovos: {
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
      },
    });
  }

  private async tratarPagamentoSucedido(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const cobrancaId = paymentIntent.metadata?.cobranca_id;
    if (!cobrancaId) {
      this.logger.warn(`payment_intent.succeeded (${paymentIntent.id}) sem metadata.cobranca_id -- ignorando.`);
      return;
    }

    const cobranca = await this.cobrancasRepositorio.buscarPorId(cobrancaId);
    if (!cobranca) {
      this.logger.error(`payment_intent.succeeded (${paymentIntent.id}) referencia cobrança ${cobrancaId} inexistente.`);
      return;
    }
    if (cobranca.status === 'pago') {
      this.logger.log(`Cobrança ${cobranca.id} já estava paga -- ignorando (idempotência).`);
      return;
    }

    await this.cobrancasRepositorio.atualizarPagamento(cobranca.id, {
      status: 'pago',
      stripePaymentIntentId: paymentIntent.id,
      pagoEm: new Date().toISOString(),
    });

    await this.auditoria.registrar({
      usuarioId: null,
      contadorId: cobranca.contadorId,
      empresaId: cobranca.empresaId,
      acao: 'honorario.pago',
      recurso: 'cobrancas_honorarios',
      dadosNovos: { cobrancaId: cobranca.id, valor: cobranca.valor, comissaoValor: cobranca.comissaoValor },
    });
  }

  private async tratarPagamentoFalhou(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const cobrancaId = paymentIntent.metadata?.cobranca_id;
    if (!cobrancaId) return;

    const cobranca = await this.cobrancasRepositorio.buscarPorId(cobrancaId);
    if (!cobranca || cobranca.status === 'pago') return;

    await this.cobrancasRepositorio.atualizarPagamento(cobranca.id, {
      status: 'falhou',
      stripePaymentIntentId: paymentIntent.id,
      pagoEm: null,
    });

    await this.auditoria.registrar({
      usuarioId: null,
      contadorId: cobranca.contadorId,
      empresaId: cobranca.empresaId,
      acao: 'honorario.falhou',
      recurso: 'cobrancas_honorarios',
      dadosAntigos: { cobrancaId: cobranca.id, status: cobranca.status },
      dadosNovos: { cobrancaId: cobranca.id, status: 'falhou' },
    });
  }
}
