import { ModoAcessoSerpro, RegimeTributario, StatusEmpresa } from '../../dominio/empresa';

export interface Empresa {
  id: string;
  contadorId: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  regimeTributario: RegimeTributario | null;
  modoAcessoSerpro: ModoAcessoSerpro;
  status: StatusEmpresa;
  bloqueado: boolean;
}

export interface DadosNovaEmpresa {
  contadorId: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  regimeTributario: RegimeTributario | null;
  modoAcessoSerpro: ModoAcessoSerpro;
}

export interface DadosAtualizacaoEmpresa {
  razaoSocial?: string;
  nomeFantasia?: string | null;
  regimeTributario?: RegimeTributario | null;
}

export interface EmpresasRepositorioPort {
  criar(dados: DadosNovaEmpresa): Promise<Empresa>;
  buscarPorId(id: string): Promise<Empresa | null>;
  listarPorContador(contadorId: string): Promise<Empresa[]>;
  /** Usado por outros módulos (ex: auth) pra checar posse sem expor o repositório inteiro. */
  pertenceAoContador(empresaId: string, contadorId: string): Promise<boolean>;
  atualizar(id: string, dados: DadosAtualizacaoEmpresa): Promise<void>;
  atualizarModoAcessoSerpro(id: string, modo: ModoAcessoSerpro): Promise<void>;
  marcarBloqueio(id: string, bloqueado: boolean, motivo: string | null, executadoPorId: string): Promise<void>;
}

export const EMPRESAS_REPOSITORIO = Symbol('EMPRESAS_REPOSITORIO');
