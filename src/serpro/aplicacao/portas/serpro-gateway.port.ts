export interface RespostaSerpro {
  sucesso: boolean;
  statusHttp: number;
  corpo: unknown;
}

export interface ParametrosConsultaSerpro {
  idSistema: string;
  idServico: string;
  contribuinteCnpj: string;
  dados?: string;
  /** Só tem efeito em ambiente trial -- ver comentário de `montarEnvelope` (dominio/serpro.ts) sobre por que os cenários de demonstração exigem CNPJs fixos diferentes entre si. */
  documentoTrial?: string;
}

/**
 * Abstração sobre o gateway HTTP do SERPRO -- ambiente (trial/produção), contratante e
 * formato exato do envelope são detalhes de infraestrutura, resolvidos na implementação
 * (a Application layer só sabe "quero consultar X pra este contribuinte", nunca monta
 * o envelope ela mesma). Ver docs/SEGURANCA.md §3.
 */
export interface SerproGatewayPort {
  consultar(params: ParametrosConsultaSerpro): Promise<RespostaSerpro>;
}

export const SERPRO_GATEWAY = Symbol('SERPRO_GATEWAY');
