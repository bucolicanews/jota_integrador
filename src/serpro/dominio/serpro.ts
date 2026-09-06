// Tipos e regras puras da integração SERPRO/Integra Contador (docs/SEGURANCA.md §3).

export type AmbienteSerpro = 'trial' | 'producao';

/** 1 = CPF, 2 = CNPJ -- convenção do próprio SERPRO (confirmado nos payloads de exemplo). */
export type TipoPessoa = 1 | 2;

export interface DocumentoSerpro {
  numero: string;
  tipo: TipoPessoa;
}

export interface PedidoDadosSerpro {
  idSistema: string;
  idServico: string;
  versaoSistema: string;
  dados: string;
}

export interface EnvelopeSerpro {
  contratante: DocumentoSerpro;
  autorPedidoDados: DocumentoSerpro;
  contribuinte: DocumentoSerpro;
  pedidoDados: PedidoDadosSerpro;
}

export const CNPJ_TRIAL = '00000000000000';

/**
 * Monta o envelope padrão de toda chamada ao SERPRO (docs/SEGURANCA.md §3). Em ambiente
 * trial, contratante/autorPedidoDados/contribuinte são sempre o CNPJ fixo de
 * demonstração -- nunca usar CNPJ real nesse ambiente (confirmado nos cenários de teste
 * oficiais do SERPRO).
 */
export function montarEnvelope(params: {
  ambiente: AmbienteSerpro;
  contratanteCnpj: string;
  autorPedidoDocumento: DocumentoSerpro;
  contribuinteCnpj: string;
  idSistema: string;
  idServico: string;
  dados?: string;
}): EnvelopeSerpro {
  if (params.ambiente === 'trial') {
    const documentoTrial: DocumentoSerpro = { numero: CNPJ_TRIAL, tipo: 2 };
    return {
      contratante: documentoTrial,
      autorPedidoDados: documentoTrial,
      contribuinte: documentoTrial,
      pedidoDados: {
        idSistema: params.idSistema,
        idServico: params.idServico,
        versaoSistema: '1.0',
        dados: params.dados ?? '',
      },
    };
  }

  return {
    contratante: { numero: params.contratanteCnpj, tipo: 2 },
    autorPedidoDados: params.autorPedidoDocumento,
    contribuinte: { numero: params.contribuinteCnpj, tipo: 2 },
    pedidoDados: {
      idSistema: params.idSistema,
      idServico: params.idServico,
      versaoSistema: '1.0',
      dados: params.dados ?? '',
    },
  };
}
