export interface MovimentoCredito {
  id: string;
  contadorId: string;
  empresaId: string | null;
  tipoOperacao: string;
  quantidade: number; // assinado: negativo = débito, positivo = crédito
  saldoAntes: number;
  saldoDepois: number;
  motivo: string | null;
  criadoEm: string;
}

/** Erro específico pra saldo insuficiente -- controller/use case decide o status HTTP certo (402/403) a partir dele. */
export class SaldoInsuficienteError extends Error {}

export interface CreditosRepositorioPort {
  obterSaldo(contadorId: string): Promise<number>;
  listarMovimentos(contadorId: string): Promise<MovimentoCredito[]>;
  /** Atômico via função Postgres (debitar_creditos) -- nunca implementar isso como UPDATE+INSERT separados. */
  debitar(contadorId: string, empresaId: string, tipoOperacao: string, quantidade: number, motivo: string): Promise<number>;
  /** Atômico via função Postgres (creditar_creditos). tipoOperacao default 'AJUSTE_MANUAL' -- assinaturas/ usa 'RENOVACAO_ASSINATURA'. */
  creditar(contadorId: string, quantidade: number, motivo: string, tipoOperacao?: string): Promise<number>;
}

export const CREDITOS_REPOSITORIO = Symbol('CREDITOS_REPOSITORIO');
