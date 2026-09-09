import { StatusMensagem } from '../../dominio/mensagem-caixa-postal';

export interface MensagemCaixaPostal {
  id: string;
  empresaId: string;
  serproIsn: string;
  orgao: string;
  assunto: string;
  status: StatusMensagem;
  dataRecebimento: string;
  conteudoRef: string | null;
}

export interface DadosNovaMensagem {
  empresaId: string;
  serproIsn: string;
  orgao: string;
  assunto: string;
  dataRecebimento: string;
}

export interface MensagensCaixaPostalRepositorioPort {
  listarPorEmpresa(empresaId: string): Promise<MensagemCaixaPostal[]>;
  buscarPorId(id: string): Promise<MensagemCaixaPostal | null>;
  /** Upsert por (empresa_id, serpro_isn) -- se já existe, NÃO sobrescreve (preserva status local de leitura). Retorna true se inseriu uma linha nova. */
  inserirSeNovo(dados: DadosNovaMensagem): Promise<boolean>;
  marcarComoLida(id: string): Promise<void>;
  atualizarConteudoRef(id: string, conteudoRef: string): Promise<void>;
}

export const MENSAGENS_CAIXA_POSTAL_REPOSITORIO = Symbol('MENSAGENS_CAIXA_POSTAL_REPOSITORIO');
