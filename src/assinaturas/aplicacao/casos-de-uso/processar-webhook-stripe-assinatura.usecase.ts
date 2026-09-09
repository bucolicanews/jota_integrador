import { Inject, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { CreditarCreditosUseCase } from '../../../creditos/aplicacao/casos-de-uso/creditar-creditos.usecase';
import { StripeAssinaturasService } from '../../infraestrutura/stripe-assinaturas.service';
import { ASSINATURAS_REPOSITORIO, AssinaturasRepositorioPort } from '../portas/assinaturas-repositorio.port';
import { PLANOS_REPOSITORIO, PlanosRepositorioPort } from '../portas/planos-repositorio.port';

const GATEWAY = 'stripe_assinaturas';

/**
 * Fonte da verdade única pra "pagamento confirmado, liberar crédito": `invoice.paid`,
 * nunca `checkout.session.completed`. O Stripe dispara os dois pra uma assinatura nova
 * (mais ou menos ao mesmo tempo, SEM garantia de ordem) -- se creditasse nos dois, o
 * primeiro período seria creditado em dobro. `checkout.session.completed` nem é
 * escutado aqui por causa disso: `invoice.paid` sozinho já cobre a primeira cobrança E
 * as renovações, e se chegar antes de qualquer outra coisa existir no nosso banco, ele
 * mesmo se vira consultando a subscription na Stripe (auto-suficiente, não depende de
 * ordem de entrega).
 *
 * docs/SEGURANCA.md §7 (mesma regra vale aqui, não só honorários): "verificar
 * stripe-signature sempre, e checar webhook_eventos_processados antes de aplicar
 * qualquer efeito".
 */
@Injectable()
export class ProcessarWebhookStripeAssinaturaUseCase {
  private readonly logger = new Logger(ProcessarWebhookStripeAssinaturaUseCase.name);

  constructor(
    @Inject(ASSINATURAS_REPOSITORIO) private readonly assinaturasRepositorio: AssinaturasRepositorioPort,
    @Inject(PLANOS_REPOSITORIO) private readonly planosRepositorio: PlanosRepositorioPort,
    private readonly stripe: StripeAssinaturasService,
    private readonly creditar: CreditarCreditosUseCase,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** `payloadBruto` precisa ser o body exato recebido (sem reserializar JSON) -- verificação de assinatura falha se um byte mudar. */
  async executar(payloadBruto: Buffer, assinaturaHeader: string): Promise<void> {
    const event = this.stripe.construirEvento(payloadBruto, assinaturaHeader);

    if (await this.assinaturasRepositorio.jaProcessouEventoWebhook(GATEWAY, event.id)) {
      this.logger.log(`Evento ${event.id} (${event.type}) já processado -- ignorando (idempotência).`);
      return;
    }

    switch (event.type) {
      case 'invoice.paid':
        await this.tratarFaturaPaga(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.tratarFaturaFalhou(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.deleted':
        await this.tratarAssinaturaCancelada(event.data.object as Stripe.Subscription);
        break;
      default:
        // Dashboard Stripe manda todos os eventos por padrão quando não se restringe o
        // endpoint a um subconjunto -- ignorar o que não interessa é esperado, não é erro.
        break;
    }

    await this.assinaturasRepositorio.marcarEventoWebhookProcessado(GATEWAY, event.id);
  }

  private async tratarFaturaPaga(invoice: Stripe.Invoice): Promise<void> {
    const stripeSubscriptionId = this.extrairSubscriptionId(invoice);
    if (!stripeSubscriptionId) {
      this.logger.warn(`invoice.paid (${invoice.id}) sem subscription -- ignorando (não é fatura de assinatura).`);
      return;
    }

    // Dedup específico além do genérico por evento -- protege contra o caso raro de o
    // mesmo invoice.id vir associado a dois event.id diferentes (retry do Stripe com
    // payload reconstituído).
    if (invoice.id && (await this.assinaturasRepositorio.buscarFaturaPorStripeInvoiceId(invoice.id))) {
      this.logger.log(`Fatura ${invoice.id} já registrada -- ignorando.`);
      return;
    }

    let assinatura = await this.assinaturasRepositorio.buscarPorStripeSubscriptionId(stripeSubscriptionId);

    if (!assinatura) {
      // invoice.paid chegou antes de sabermos dessa subscription (ordem de webhook não é
      // garantida, ou é a primeira fatura da assinatura recém-criada) -- se vira sozinho
      // lendo a metadata que foi setada na criação da Checkout Session. Se a própria
      // chamada à Stripe falhar (rede, chave inválida), trata como "não consegui
      // resolver" -- não deixa a exceção subir crua até o controller do webhook.
      let metadata: { contadorId: string; planoId: string } | null = null;
      try {
        metadata = await this.stripe.obterMetadataSubscription(stripeSubscriptionId);
      } catch (erro) {
        this.logger.error(`Falha ao consultar subscription ${stripeSubscriptionId} na Stripe: ${(erro as Error).message}`);
      }
      if (!metadata) {
        this.logger.error(
          `invoice.paid (${invoice.id}) pra subscription ${stripeSubscriptionId} sem assinatura local nem metadata -- não dá pra saber de qual contador/plano é. Investigar manualmente.`,
        );
        return;
      }
      assinatura = await this.assinaturasRepositorio.criar({
        contadorId: metadata.contadorId,
        planoId: metadata.planoId,
        stripeSubscriptionId,
      });
    }

    const plano = await this.planosRepositorio.buscarPorId(assinatura.planoId);
    if (!plano) {
      this.logger.error(`Assinatura ${assinatura.id} referencia plano ${assinatura.planoId} que não existe mais.`);
      return;
    }

    const saldoNovo = await this.creditar.executar(
      assinatura.contadorId,
      plano.operacoesIncluidas,
      `Renovação assinatura "${plano.nome}" (fatura Stripe ${invoice.id})`,
      'RENOVACAO_ASSINATURA',
    );

    const linhaPeriodo = invoice.lines?.data?.[0]?.period;
    const fatura = await this.assinaturasRepositorio.criarFatura({
      contadorId: assinatura.contadorId,
      assinaturaId: assinatura.id,
      stripeInvoiceId: invoice.id ?? null,
      valor: invoice.amount_paid / 100,
      competencia: this.timestampParaData(linhaPeriodo?.start ?? invoice.created),
      vencimento: this.timestampParaData(linhaPeriodo?.end ?? invoice.created),
      status: 'paga',
      pagoEm: new Date().toISOString(),
    });

    // Assinatura pode ter voltado de 'inadimplente' (pagamento atrasado que finalmente entrou).
    if (assinatura.status !== 'ativa') {
      await this.assinaturasRepositorio.atualizarStatus(assinatura.id, 'ativa');
    }

    await this.auditoria.registrar({
      usuarioId: null, // webhook nao tem usuario humano por tras -- contadorId abaixo ja identifica o beneficiario
      contadorId: assinatura.contadorId,
      acao: 'assinatura.fatura_paga',
      recurso: 'faturas',
      dadosNovos: { faturaId: fatura.id, valor: fatura.valor, saldoCreditosApos: saldoNovo },
    });
  }

  private async tratarFaturaFalhou(invoice: Stripe.Invoice): Promise<void> {
    const stripeSubscriptionId = this.extrairSubscriptionId(invoice);
    if (!stripeSubscriptionId) return;

    const assinatura = await this.assinaturasRepositorio.buscarPorStripeSubscriptionId(stripeSubscriptionId);
    if (!assinatura) {
      this.logger.warn(`invoice.payment_failed pra subscription ${stripeSubscriptionId} sem assinatura local -- ignorando.`);
      return;
    }

    await this.assinaturasRepositorio.atualizarStatus(assinatura.id, 'inadimplente');

    if (invoice.id && !(await this.assinaturasRepositorio.buscarFaturaPorStripeInvoiceId(invoice.id))) {
      const linhaPeriodo = invoice.lines?.data?.[0]?.period;
      await this.assinaturasRepositorio.criarFatura({
        contadorId: assinatura.contadorId,
        assinaturaId: assinatura.id,
        stripeInvoiceId: invoice.id,
        valor: invoice.amount_due / 100,
        competencia: this.timestampParaData(linhaPeriodo?.start ?? invoice.created),
        vencimento: this.timestampParaData(linhaPeriodo?.end ?? invoice.created),
        status: 'atrasada',
        pagoEm: null,
      });
    }

    await this.auditoria.registrar({
      usuarioId: null, // webhook nao tem usuario humano por tras -- contadorId abaixo ja identifica o beneficiario
      contadorId: assinatura.contadorId,
      acao: 'assinatura.fatura_falhou',
      recurso: 'assinaturas',
      dadosAntigos: { assinaturaId: assinatura.id, status: assinatura.status },
      dadosNovos: { assinaturaId: assinatura.id, status: 'inadimplente' },
    });
  }

  private async tratarAssinaturaCancelada(subscription: Stripe.Subscription): Promise<void> {
    const assinatura = await this.assinaturasRepositorio.buscarPorStripeSubscriptionId(subscription.id);
    if (!assinatura) {
      this.logger.warn(`customer.subscription.deleted pra subscription ${subscription.id} sem assinatura local -- ignorando.`);
      return;
    }

    await this.assinaturasRepositorio.atualizarStatus(assinatura.id, 'cancelada');

    await this.auditoria.registrar({
      usuarioId: null, // webhook nao tem usuario humano por tras -- contadorId abaixo ja identifica o beneficiario
      contadorId: assinatura.contadorId,
      acao: 'assinatura.cancelada',
      recurso: 'assinaturas',
      dadosAntigos: { assinaturaId: assinatura.id, status: assinatura.status },
      dadosNovos: { assinaturaId: assinatura.id, status: 'cancelada' },
    });
  }

  private extrairSubscriptionId(invoice: Stripe.Invoice): string | null {
    // Campo mudou de forma entre versões da API do Stripe -- cobrir os dois formatos
    // (string direta na v. antiga, objeto {subscription: {id}} em parsings mais novos).
    const bruto = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription;
    if (!bruto) return null;
    return typeof bruto === 'string' ? bruto : bruto.id;
  }

  private timestampParaData(unixSeconds: number): string {
    return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
  }
}
