import { Papel } from '../../dominio/papel';

export interface ClaimsIdentidade {
  papel: Papel;
  contadorId: string | null;
  empresaId: string | null;
}

export interface IdentidadeValidada extends ClaimsIdentidade {
  id: string;
}

/**
 * Abstração sobre o provedor de autenticação (Supabase Auth). Separado do repositório
 * de `usuarios` (docs/BANCO_DE_DADOS.md §1) porque são sistemas diferentes: aqui é
 * identidade/sessão (auth.users), lá é perfil de domínio (usuarios).
 */
export interface ProvedorIdentidadePort {
  /** Cria a identidade (auth.users) e envia convite por e-mail -- retorna o id (= usuarios.id). */
  criarUsuarioComConvite(email: string): Promise<string>;

  /**
   * Sincroniza papel/contador_id/empresa_id no app_metadata do usuário no provedor.
   * Crítico: é isso que o RLS lê (auth.jwt() -> app_metadata) -- esquecer de chamar
   * depois de mudar papel/vínculo deixa o RLS desatualizado (docs/BANCO_DE_DADOS.md §1).
   */
  sincronizarClaims(id: string, claims: ClaimsIdentidade): Promise<void>;

  /** Ban nativo do provedor -- impede login imediatamente, não só marca flag no banco. */
  bloquearAcesso(id: string): Promise<void>;
  desbloquearAcesso(id: string): Promise<void>;

  /** Revoga todas as sessões ativas do usuário (logout global). */
  revogarSessoes(id: string): Promise<void>;

  /**
   * Valida um JWT emitido pelo provedor e retorna id + claims (papel/contador_id/
   * empresa_id) direto do app_metadata do token -- sem round-trip ao banco a cada
   * requisição (esse é o motivo de sincronizar claims no JWT em primeiro lugar).
   */
  validarToken(token: string): Promise<IdentidadeValidada>;
}

export const PROVEDOR_IDENTIDADE = Symbol('PROVEDOR_IDENTIDADE');
