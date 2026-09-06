/**
 * Checa se uma empresa tem acesso válido ao SERPRO agora -- procuração ativa (Modo A)
 * ou certificado vigente (Modo B), conforme `empresas.modo_acesso_serpro`
 * (docs/SEGURANCA.md §1-2). Chamado ANTES de qualquer consulta, nunca depois.
 */
export interface VerificarAcessoSerproPort {
  possuiAcessoValido(empresaId: string): Promise<{ valido: boolean; motivo: string | null }>;
}

export const VERIFICAR_ACESSO_SERPRO = Symbol('VERIFICAR_ACESSO_SERPRO');
