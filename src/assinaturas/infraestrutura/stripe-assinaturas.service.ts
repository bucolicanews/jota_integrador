import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export interface DadosCheckoutSession {
  customerId: string;
  contadorId: string;
  planoId: string;
  planoNome: string;
  precoReais: number;
  periodicidade: 'mensal' | 'anual';
  successUrl: string;
  cancelUrl: string;
}

/**
 * Assinatura SaaS (contador → Jota): sem Stripe Connect, Jota é a única recebedora
 * (docs/SEGURANCA.md §6). Secret key/webhook secret só em env, nunca em tabela --
 * desvio deliberado do padrão DeliveryHub/GESTAO_PROJETOS_VUE (ADR-002-POLITICA-CREDENCIAIS).
 *
 * Preço vem de `planos.preco` (nossa fonte da verdade, não um Stripe Price pré-criado) --
 * a Checkout Session usa `price_data` inline (recorrente) pra não precisar sincronizar
 * um catálogo de Price no lado Stripe toda vez que um plano muda.
 */
@Injectable()
export class StripeAssinaturasService {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(config: ConfigService) {
    this.stripe = new Stripe(config.getOrThrow<string>('STRIPE_SECRET_KEY'));
    this.webhookSecret = config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET_ASSINATURAS');
  }

  async obterOuCriarCustomer(contadorId: string, email: string, nome: string): Promise<string> {
    const customer = await this.stripe.customers.create({
      email,
      name: nome,
      metadata: { contador_id: contadorId },
    });
    return customer.id;
  }

  async criarCheckoutSession(dados: DadosCheckoutSession): Promise<{ url: string }> {
    const metadata = { contador_id: dados.contadorId, plano_id: dados.planoId };

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: dados.customerId,
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: { name: dados.planoNome },
            unit_amount: Math.round(dados.precoReais * 100),
            recurring: { interval: dados.periodicidade === 'anual' ? 'year' : 'month' },
          },
          quantity: 1,
        },
      ],
      // Metadata duplicada na session E na subscription -- invoice.paid só tem acesso
      // direto à subscription, não à session que a originou.
      metadata,
      subscription_data: { metadata },
      success_url: dados.successUrl,
      cancel_url: dados.cancelUrl,
    });

    if (!session.url) {
      throw new Error('Stripe não retornou URL de checkout');
    }
    return { url: session.url };
  }

  async cancelarNoFimDoPeriodo(stripeSubscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true });
  }

  /** Fallback pra quando invoice.paid chega antes de checkout.session.completed (Stripe não garante ordem) -- lê metadata direto da subscription. */
  async obterMetadataSubscription(stripeSubscriptionId: string): Promise<{ contadorId: string; planoId: string } | null> {
    const subscription = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
    const contadorId = subscription.metadata?.contador_id;
    const planoId = subscription.metadata?.plano_id;
    if (!contadorId || !planoId) return null;
    return { contadorId, planoId };
  }

  /** Lança se a assinatura (`stripe-signature`) não bater -- nunca processar payload sem isso passar. */
  construirEvento(payloadBruto: Buffer, assinaturaHeader: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payloadBruto, assinaturaHeader, this.webhookSecret);
  }
}
