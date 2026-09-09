import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { StatusProcuracao } from '../dominio/procuracao';
import {
  DadosAtualizacaoStatusProcuracao,
  Procuracao,
  ProcuracoesRepositorioPort,
} from '../aplicacao/portas/procuracoes-repositorio.port';

interface LinhaProcuracao {
  id: string;
  empresa_id: string;
  status: StatusProcuracao;
  outorgada_em: string | null;
  expira_em: string | null;
  revogada_em: string | null;
  verificado_em: string | null;
}

const COLUNAS_SELECT = 'id, empresa_id, status, outorgada_em, expira_em, revogada_em, verificado_em';

@Injectable()
export class ProcuracoesRepositorioSupabase implements ProcuracoesRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async buscarPorEmpresa(empresaId: string): Promise<Procuracao | null> {
    const { data, error } = await this.supabase.admin
      .from('procuracoes')
      .select(COLUNAS_SELECT)
      .eq('empresa_id', empresaId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar procuração: ${error.message}`);
    }
    return data ? this.mapear(data as LinhaProcuracao) : null;
  }

  async garantirLinha(empresaId: string): Promise<Procuracao> {
    const existente = await this.buscarPorEmpresa(empresaId);
    if (existente) return existente;

    const { data, error } = await this.supabase.admin
      .from('procuracoes')
      .insert({ empresa_id: empresaId })
      .select(COLUNAS_SELECT)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao criar procuração: ${error?.message}`);
    }
    return this.mapear(data as LinhaProcuracao);
  }

  async atualizarStatus(id: string, dados: DadosAtualizacaoStatusProcuracao): Promise<Procuracao> {
    const agora = new Date().toISOString();
    const campos: Record<string, unknown> = {
      status: dados.status,
      verificado_em: agora,
      revogada_em: dados.status === 'revogada' ? agora : null,
    };
    if (dados.outorgadaEm !== undefined) campos.outorgada_em = dados.outorgadaEm;
    if (dados.expiraEm !== undefined) campos.expira_em = dados.expiraEm;

    const { data, error } = await this.supabase.admin
      .from('procuracoes')
      .update(campos)
      .eq('id', id)
      .select(COLUNAS_SELECT)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao atualizar status da procuração: ${error?.message}`);
    }
    return this.mapear(data as LinhaProcuracao);
  }

  private mapear(linha: LinhaProcuracao): Procuracao {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      status: linha.status,
      outorgadaEm: linha.outorgada_em,
      expiraEm: linha.expira_em,
      revogadaEm: linha.revogada_em,
      verificadoEm: linha.verificado_em,
    };
  }
}
