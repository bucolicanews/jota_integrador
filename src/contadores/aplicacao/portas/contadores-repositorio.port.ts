import { StatusContador, TipoContador } from '../../dominio/contador';

export interface Contador {
  id: string;
  nome: string;
  cnpjCpf: string;
  email: string;
  telefone: string | null;
  tipo: TipoContador;
  status: StatusContador;
  bloqueado: boolean;
}

export interface DadosNovoContador {
  nome: string;
  cnpjCpf: string;
  email: string;
  telefone: string | null;
}

export interface DadosAtualizacaoContador {
  nome?: string;
  telefone?: string | null;
  email?: string;
}

export interface ContadoresRepositorioPort {
  criar(dados: DadosNovoContador): Promise<Contador>;
  buscarPorId(id: string): Promise<Contador | null>;
  listar(): Promise<Contador[]>;
  atualizar(id: string, dados: DadosAtualizacaoContador): Promise<void>;
  marcarBloqueio(id: string, bloqueado: boolean, motivo: string | null, executadoPorId: string): Promise<void>;
}

export const CONTADORES_REPOSITORIO = Symbol('CONTADORES_REPOSITORIO');
