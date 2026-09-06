import { Papel } from '../../dominio/papel';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  contadorId: string | null;
  empresaId: string | null;
  mfaHabilitado: boolean;
  status: 'ativo' | 'inativo';
  bloqueado: boolean;
}

export interface DadosNovoUsuario {
  id: string; // já criado no provedor de identidade -- este port só persiste o perfil
  nome: string;
  email: string;
  papelId: string;
  contadorId: string | null;
  empresaId: string | null;
}

/** Abstração sobre a tabela `usuarios` (perfil) -- nunca acoplar Application a Supabase direto. */
export interface UsuariosRepositorioPort {
  criar(dados: DadosNovoUsuario): Promise<Usuario>;
  buscarPorId(id: string): Promise<Usuario | null>;
  atualizarPapelEVinculo(
    id: string,
    papelId: string,
    contadorId: string | null,
    empresaId: string | null,
  ): Promise<void>;
  marcarBloqueio(id: string, bloqueado: boolean, motivo: string | null, executadoPorId: string): Promise<void>;
  buscarIdPapelPorNome(nomePapel: Papel): Promise<string>;
}

export const USUARIOS_REPOSITORIO = Symbol('USUARIOS_REPOSITORIO');
