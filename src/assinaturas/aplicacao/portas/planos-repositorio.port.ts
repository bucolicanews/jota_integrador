import { Periodicidade } from '../../dominio/plano';

export interface Plano {
  id: string;
  nome: string;
  operacoesIncluidas: number;
  preco: number;
  periodicidade: Periodicidade;
  ativo: boolean;
}

export interface DadosNovoPlano {
  nome: string;
  operacoesIncluidas: number;
  preco: number;
  periodicidade: Periodicidade;
}

export interface DadosAtualizacaoPlano {
  nome?: string;
  operacoesIncluidas?: number;
  preco?: number;
  ativo?: boolean;
}

export interface PlanosRepositorioPort {
  criar(dados: DadosNovoPlano): Promise<Plano>;
  buscarPorId(id: string): Promise<Plano | null>;
  /** `somenteAtivos=true` pro catálogo público -- contador não deve conseguir assinar um plano descontinuado. */
  listar(somenteAtivos: boolean): Promise<Plano[]>;
  atualizar(id: string, dados: DadosAtualizacaoPlano): Promise<Plano>;
}

export const PLANOS_REPOSITORIO = Symbol('PLANOS_REPOSITORIO');
