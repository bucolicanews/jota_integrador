import { StatusCobranca } from '../../dominio/cobranca-honorario';

export interface CobrancaHonorario {
  id: string;
  contadorId: string;
  empresaId: string;
  descricao: string;
  valor: number;
  comissaoPct: number;
  comissaoValor: number;
  stripePaymentIntentId: string | null;
  status: StatusCobranca;
  criadoEm: string;
  pagoEm: string | null;
}

export interface DadosNovaCobranca {
  contadorId: string;
  empresaId: string;
  descricao: string;
  valor: number;
}

export interface DadosAtualizacaoPagamento {
  status: StatusCobranca;
  stripePaymentIntentId: string | null;
  pagoEm: string | null;
}

export interface CobrancasHonorariosRepositorioPort {
  /** comissaoPct/comissaoValor vêm computados pelo trigger do banco (definir_comissao_honorario) -- nunca calculados aqui. */
  criar(dados: DadosNovaCobranca): Promise<CobrancaHonorario>;
  buscarPorId(id: string): Promise<CobrancaHonorario | null>;
  buscarPorStripePaymentIntentId(stripePaymentIntentId: string): Promise<CobrancaHonorario | null>;
  listarPorContador(contadorId: string): Promise<CobrancaHonorario[]>;
  listarPorEmpresa(empresaId: string): Promise<CobrancaHonorario[]>;
  /** Só chamado pelo webhook -- trigger `protege_campos_cobranca_honorario` no banco bloqueia isso vindo de contador comum. */
  atualizarPagamento(id: string, dados: DadosAtualizacaoPagamento): Promise<void>;

  // Idempotência de webhook (mesma tabela genérica `webhook_eventos_processados` já
  // usada por assinaturas/, mesmo padrão duplicado aqui em vez de acoplar os dois
  // módulos por causa de duas funções puras -- ver AssinaturasRepositorioPort).
  jaProcessouEventoWebhook(gateway: string, eventoId: string): Promise<boolean>;
  marcarEventoWebhookProcessado(gateway: string, eventoId: string): Promise<void>;
}

export const COBRANCAS_HONORARIOS_REPOSITORIO = Symbol('COBRANCAS_HONORARIOS_REPOSITORIO');
