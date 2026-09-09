import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  FiltroLogsAuditoria,
  LogAuditoria,
  LogsAuditoriaRepositorioPort,
  ResultadoLogsAuditoria,
} from '../aplicacao/portas/logs-auditoria-repositorio.port';

interface LinhaLog {
  id: string;
  usuario_id: string | null;
  contador_id: string | null;
  empresa_id: string | null;
  acao: string;
  recurso: string;
  dados_antigos: unknown;
  dados_novos: unknown;
  criado_em: string;
}

const COLUNAS_SELECT = 'id, usuario_id, contador_id, empresa_id, acao, recurso, dados_antigos, dados_novos, criado_em';

@Injectable()
export class LogsAuditoriaRepositorioSupabase implements LogsAuditoriaRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(filtro: FiltroLogsAuditoria): Promise<ResultadoLogsAuditoria> {
    let query = this.supabase.admin
      .from('logs_auditoria')
      .select(COLUNAS_SELECT, { count: 'exact' })
      .order('criado_em', { ascending: false })
      .range(filtro.offset, filtro.offset + filtro.limit - 1);

    if (filtro.contadorId !== undefined && filtro.empresaIdsDoContador) {
      // OR explícito -- replica a regra de acesso de contador (ver comentário no port).
      // Sintaxe PostgREST: "coluna.eq.valor,coluna.in.(v1,v2)".
      const condicoes = [`contador_id.eq.${filtro.contadorId}`];
      if (filtro.empresaIdsDoContador.length > 0) {
        condicoes.push(`empresa_id.in.(${filtro.empresaIdsDoContador.join(',')})`);
      }
      query = query.or(condicoes.join(','));
    } else if (filtro.contadorId !== undefined) {
      query = query.eq('contador_id', filtro.contadorId);
    }
    if (filtro.empresaId !== undefined) query = query.eq('empresa_id', filtro.empresaId);
    if (filtro.recurso !== undefined) query = query.eq('recurso', filtro.recurso);
    if (filtro.acao !== undefined) query = query.eq('acao', filtro.acao);

    const { data, error, count } = await query;

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar logs de auditoria: ${error.message}`);
    }

    return {
      itens: (data as LinhaLog[]).map((linha) => this.mapear(linha)),
      total: count ?? 0,
    };
  }

  private mapear(linha: LinhaLog): LogAuditoria {
    return {
      id: linha.id,
      usuarioId: linha.usuario_id,
      contadorId: linha.contador_id,
      empresaId: linha.empresa_id,
      acao: linha.acao,
      recurso: linha.recurso,
      dadosAntigos: linha.dados_antigos,
      dadosNovos: linha.dados_novos,
      criadoEm: linha.criado_em,
    };
  }
}
