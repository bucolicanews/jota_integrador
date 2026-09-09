import { StatusAssinatura, StatusFatura } from '../../dominio/assinatura';

export interface Assinatura {
  id: string;
  contadorId: string;
  planoId: string;
  stripeSubscriptionId: string | null;
  status: StatusAssinatura;
  inicioEm: string;
  fimEm: string | null;
  renovacaoAutomatica: boolean;
}

export interface Fatura {
  id: string;
  contadorId: string;
  assinaturaId: string;
  stripeInvoiceId: string | null;
  valor: number;
  competencia: string;
  vencimento: string;
  status: StatusFatura;
  pagoEm: string | null;
}

export interface DadosNovaAssinatura {
  contadorId: string;
  planoId: string;
  stripeSubscriptionId: string;
}

export interface DadosNovaFatura {
  contadorId: string;
  assinaturaId: string;
  stripeInvoiceId: string | null;
  valor: number;
  competencia: string;
  vencimento: string;
  status: StatusFatura;
  pagoEm: string | null;
}

export interface AssinaturasRepositorioPort {
  buscarAtivaPorContador(contadorId: string): Promise<Assinatura | null>;
  buscarPorStripeSubscriptionId(stripeSubscriptionId: string): Promise<Assinatura | null>;
  criar(dados: DadosNovaAssinatura): Promise<Assinatura>;
  atualizarStatus(id: string, status: StatusAssinatura): Promise<void>;
  atualizarRenovacaoAutomatica(id: string, renovacaoAutomatica: boolean): Promise<void>;

  criarFatura(dados: DadosNovaFatura): Promise<Fatura>;
  /** Idempotência de webhook -- evita duplicar fatura se o Stripe reenviar o mesmo invoice.paid. */
  buscarFaturaPorStripeInvoiceId(stripeInvoiceId: string): Promise<Fatura | null>;
  listarFaturasPorContador(contadorId: string): Promise<Fatura[]>;

  /** true se já processado (idempotência genérica de webhook, tabela webhook_eventos_processados). */
  jaProcessouEventoWebhook(gateway: string, eventoId: string): Promise<boolean>;
  marcarEventoWebhookProcessado(gateway: string, eventoId: string): Promise<void>;
}

export const ASSINATURAS_REPOSITORIO = Symbol('ASSINATURAS_REPOSITORIO');
