import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export interface DadosCheckoutHonorario {
  contadorStripeAccountId: string;
  cobrancaId: string;
  descricao: string;
  valorReais: number;
  comissaoValorReais: number;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Honorários (empresa paga o contador, Jota comissiona) -- Stripe Connect, réplica do
 * padrão já em produção no DeliveryHub (docs/SEGURANCA.md §7): contas Express,
 * destination charge (`transfer_data.destination` + `application_fee_amount`), onboarding
 * hospedado (Account Link). Instância Stripe própria (não reaproveita
 * StripeAssinaturasService) porque usa a MESMA secret key da plataforma mas um webhook
 * secret diferente (`STRIPE_WEBHOOK_SECRET_HONORARIOS`) -- eventos/assinatura são de
 * endpoints diferentes no dashboard Stripe.
 */
@Injectable()
export class StripeHonorariosService {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(config: ConfigService) {
    this.stripe = new Stripe(config.getOrThrow<string>('STRIPE_SECRET_KEY'));
    this.webhookSecret = config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET_HONORARIOS');
  }

  async criarContaExpress(contadorId: string, email: string): Promise<string> {
    const account = await this.stripe.accounts.create({
      type: 'express',
      email,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { contador_id: contadorId },
    });
    return account.id;
  }

  async criarLinkOnboarding(stripeAccountId: string, refreshUrl: string, returnUrl: string): Promise<string> {
    const link = await this.stripe.accountLinks.create({
      account: stripeAccountId,
      type: 'account_onboarding',
      refresh_url: refreshUrl,
      return_url: returnUrl,
    });
    return link.url;
  }

  /** Fallback de self-healing -- mesmo padrão de StripeAssinaturasService.obterMetadataSubscription, pra sincronizar status sob demanda se algum webhook de account.updated se perder. */
  async obterStatusConta(
    stripeAccountId: string,
  ): Promise<{ chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean }> {
    const account = await this.stripe.accounts.retrieve(stripeAccountId);
    return {
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      detailsSubmitted: account.details_submitted ?? false,
    };
  }

  async criarCheckoutSession(dados: DadosCheckoutHonorario): Promise<{ url: string }> {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: { name: dados.descricao },
            unit_amount: Math.round(dados.valorReais * 100),
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: Math.round(dados.comissaoValorReais * 100),
        transfer_data: { destination: dados.contadorStripeAccountId },
        metadata: { cobranca_id: dados.cobrancaId },
      },
      metadata: { cobranca_id: dados.cobrancaId },
      success_url: dados.successUrl,
      cancel_url: dados.cancelUrl,
    });

    if (!session.url) {
      throw new Error('Stripe não retornou URL de checkout');
    }
    return { url: session.url };
  }

  construirEvento(payloadBruto: Buffer, assinaturaHeader: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payloadBruto, assinaturaHeader, this.webhookSecret);
  }
}
