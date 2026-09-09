import { StatusProcuracao } from '../../dominio/procuracao';

export interface Procuracao {
  id: string;
  empresaId: string;
  status: StatusProcuracao;
  outorgadaEm: string | null;
  expiraEm: string | null;
  revogadaEm: string | null;
  verificadoEm: string | null;
}

export interface DadosAtualizacaoStatusProcuracao {
  status: StatusProcuracao;
  outorgadaEm?: string | null;
  expiraEm?: string | null;
}

export interface ProcuracoesRepositorioPort {
  buscarPorEmpresa(empresaId: string): Promise<Procuracao | null>;
  /** Cria a linha "pendente" na primeira vez que uma empresa entra em Modo A (idempotente por empresa_id). */
  garantirLinha(empresaId: string): Promise<Procuracao>;
  /** Também grava `verificado_em = now()` (toda atualização manual é, por definição, uma verificação) e `revogada_em` quando o novo status é "revogada". */
  atualizarStatus(id: string, dados: DadosAtualizacaoStatusProcuracao): Promise<Procuracao>;
}

export const PROCURACOES_REPOSITORIO = Symbol('PROCURACOES_REPOSITORIO');
