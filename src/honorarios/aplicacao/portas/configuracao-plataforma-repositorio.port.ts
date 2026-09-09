export interface ConfiguracaoPlataformaRepositorioPort {
  obterComissaoHonorariosPct(): Promise<number>;
  /** Auditoria da mudança é automática via trigger do banco (audita_mudanca_comissao_plataforma) -- não precisa de AuditoriaService aqui. */
  atualizarComissaoHonorariosPct(pct: number): Promise<void>;
}

export const CONFIGURACAO_PLATAFORMA_REPOSITORIO = Symbol('CONFIGURACAO_PLATAFORMA_REPOSITORIO');
