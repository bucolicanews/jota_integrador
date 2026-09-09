import { GrupoContaContabil } from '../../dominio/plano-conta';

export interface PlanoConta {
  id: string;
  empresaId: string;
  codigo: string;
  nome: string;
  grupo: GrupoContaContabil;
  sintetica: boolean;
  contaPaiId: string | null;
  contaCaixaBanco: boolean;
  contaAReceber: boolean;
  contaAPagar: boolean;
  ativa: boolean;
}

export interface DadosNovaContaContabil {
  empresaId: string;
  codigo: string;
  nome: string;
  grupo: GrupoContaContabil;
  sintetica: boolean;
  contaPaiId: string | null;
  contaCaixaBanco: boolean;
  contaAReceber: boolean;
  contaAPagar: boolean;
}

export interface DadosAtualizacaoContaContabil {
  nome?: string;
  contaCaixaBanco?: boolean;
  contaAReceber?: boolean;
  contaAPagar?: boolean;
}

export interface PlanoContasRepositorioPort {
  criar(dados: DadosNovaContaContabil): Promise<PlanoConta>;
  buscarPorId(id: string): Promise<PlanoConta | null>;
  listarPorEmpresa(empresaId: string): Promise<PlanoConta[]>;
  atualizar(id: string, dados: DadosAtualizacaoContaContabil): Promise<void>;
  marcarAtiva(id: string, ativa: boolean): Promise<void>;
}

export const PLANO_CONTAS_REPOSITORIO = Symbol('PLANO_CONTAS_REPOSITORIO');
