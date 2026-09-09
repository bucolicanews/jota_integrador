export interface LogAuditoria {
  id: string;
  usuarioId: string | null;
  contadorId: string | null;
  empresaId: string | null;
  acao: string;
  recurso: string;
  dadosAntigos: unknown;
  dadosNovos: unknown;
  criadoEm: string;
}

export interface FiltroLogsAuditoria {
  /** undefined = sem restrição (só plataforma chega aqui assim -- Application layer decide isso, não o repositório). */
  contadorId?: string;
  empresaId?: string;
  /**
   * Quando setado junto com `contadorId`, filtra por (contador_id = contadorId OU
   * empresa_id IN empresaIdsDoContador) -- replica a regra de acesso de contador da RLS
   * de `logs_auditoria` (migration 0007: contador vê tanto eventos no nível dele quanto
   * eventos de qualquer empresa da própria carteira). Sem isso, um contador não veria
   * auditoria de procuração/certificado das próprias empresas -- esses módulos registram
   * só `empresaId`, nunca `contadorId`, no evento de auditoria.
   */
  empresaIdsDoContador?: string[];
  recurso?: string;
  acao?: string;
  limit: number;
  offset: number;
}

export interface ResultadoLogsAuditoria {
  itens: LogAuditoria[];
  total: number;
}

export interface LogsAuditoriaRepositorioPort {
  listar(filtro: FiltroLogsAuditoria): Promise<ResultadoLogsAuditoria>;
}

export const LOGS_AUDITORIA_REPOSITORIO = Symbol('LOGS_AUDITORIA_REPOSITORIO');
