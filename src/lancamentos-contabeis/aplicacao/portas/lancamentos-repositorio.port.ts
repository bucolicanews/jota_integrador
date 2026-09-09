import { OrigemLancamento, TipoPartida } from '../../dominio/lancamento';

export interface PartidaLancamento {
  id: string;
  contaId: string;
  tipo: TipoPartida;
  valor: number;
}

export interface LancamentoContabil {
  id: string;
  empresaId: string;
  dataCompetencia: string;
  historico: string;
  documentoReferencia: string | null;
  origem: OrigemLancamento;
  estornado: boolean;
  estornoDeId: string | null;
  criadoPor: string;
  criadoEm: string;
  partidas: PartidaLancamento[];
}

export interface DadosNovaPartida {
  contaId: string;
  tipo: TipoPartida;
  valor: number;
}

export interface DadosNovoLancamento {
  empresaId: string;
  dataCompetencia: string;
  historico: string;
  documentoReferencia: string | null;
  origem: OrigemLancamento;
  partidas: DadosNovaPartida[];
  criadoPor: string;
}

export interface FiltroLancamentos {
  dataInicio?: string;
  dataFim?: string;
  contaId?: string;
}

export interface LancamentosRepositorioPort {
  /** Chama `criar_lancamento_contabil` no banco -- valida partida dobrada inteira numa transação só, lança erro se não fechar. */
  criar(dados: DadosNovoLancamento): Promise<string>;
  obterPorId(id: string): Promise<LancamentoContabil | null>;
  listarPorEmpresa(empresaId: string, filtro?: FiltroLancamentos): Promise<LancamentoContabil[]>;
  /** Chama `estornar_lancamento_contabil` -- cria o inverso, nunca edita/apaga o original. Retorna o id do novo lançamento (estorno). */
  estornar(id: string, motivo: string, executadoPorId: string): Promise<string>;
  /** Saldo assinado da conta (positivo = a favor da natureza da conta), somando todas as partidas não estornadas até a data informada (ou até hoje). */
  obterSaldoConta(contaId: string, ateData?: string): Promise<number>;
}

export const LANCAMENTOS_REPOSITORIO = Symbol('LANCAMENTOS_REPOSITORIO');
