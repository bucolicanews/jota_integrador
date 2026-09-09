import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { OrigemLancamento, TipoPartida } from '../dominio/lancamento';
import {
  DadosNovoLancamento,
  FiltroLancamentos,
  LancamentoContabil,
  LancamentosRepositorioPort,
  PartidaLancamento,
} from '../aplicacao/portas/lancamentos-repositorio.port';

interface LinhaLancamento {
  id: string;
  empresa_id: string;
  data_competencia: string;
  historico: string;
  documento_referencia: string | null;
  origem: OrigemLancamento;
  estornado: boolean;
  estorno_de_id: string | null;
  criado_por: string;
  criado_em: string;
}

interface LinhaPartida {
  id: string;
  lancamento_id: string;
  conta_id: string;
  tipo: TipoPartida;
  valor: number;
}

const COLUNAS_LANCAMENTO =
  'id, empresa_id, data_competencia, historico, documento_referencia, origem, estornado, estorno_de_id, criado_por, criado_em';

@Injectable()
export class LancamentosRepositorioSupabase implements LancamentosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovoLancamento): Promise<string> {
    const { data, error } = await this.supabase.admin.rpc('criar_lancamento_contabil', {
      p_empresa_id: dados.empresaId,
      p_data_competencia: dados.dataCompetencia,
      p_historico: dados.historico,
      p_documento_referencia: dados.documentoReferencia,
      p_origem: dados.origem,
      p_partidas: dados.partidas.map((partida) => ({
        conta_id: partida.contaId,
        tipo: partida.tipo,
        valor: partida.valor,
      })),
      p_criado_por: dados.criadoPor,
    });

    if (error) {
      // Toda exceção levantada dentro de criar_lancamento_contabil é regra de negócio
      // (partida não fecha, menos de 2 partidas, conta inválida/sintética/de outra
      // empresa) -- nunca um erro real de infraestrutura, então sempre 400, não 500.
      throw new BadRequestException(error.message);
    }
    return data as string;
  }

  async obterPorId(id: string): Promise<LancamentoContabil | null> {
    const { data, error } = await this.supabase.admin
      .from('lancamentos_contabeis')
      .select(COLUNAS_LANCAMENTO)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar lançamento contábil: ${error.message}`);
    }
    if (!data) return null;

    const partidas = await this.buscarPartidas(id);
    return this.mapear(data as LinhaLancamento, partidas);
  }

  async listarPorEmpresa(empresaId: string, filtro?: FiltroLancamentos): Promise<LancamentoContabil[]> {
    let query = this.supabase.admin
      .from('lancamentos_contabeis')
      .select(COLUNAS_LANCAMENTO)
      .eq('empresa_id', empresaId)
      .order('data_competencia', { ascending: false })
      .order('criado_em', { ascending: false });

    if (filtro?.dataInicio) query = query.gte('data_competencia', filtro.dataInicio);
    if (filtro?.dataFim) query = query.lte('data_competencia', filtro.dataFim);

    const { data, error } = await query;
    if (error) {
      throw new InternalServerErrorException(`Falha ao listar lançamentos contábeis: ${error.message}`);
    }

    const linhas = data as LinhaLancamento[];
    const ids = linhas.map((linha) => linha.id);
    const todasPartidas = await this.buscarPartidasDeVarios(ids);

    let lancamentos = linhas.map((linha) => this.mapear(linha, todasPartidas.get(linha.id) ?? []));

    // Filtro por conta acontece depois de montar as partidas -- não dá pra filtrar só
    // com `.eq()` na tabela de cabeçalho, já que a conta mora na tabela de partidas.
    if (filtro?.contaId) {
      lancamentos = lancamentos.filter((lancamento) =>
        lancamento.partidas.some((partida) => partida.contaId === filtro.contaId),
      );
    }

    return lancamentos;
  }

  async estornar(id: string, motivo: string, executadoPorId: string): Promise<string> {
    const { data, error } = await this.supabase.admin.rpc('estornar_lancamento_contabil', {
      p_lancamento_id: id,
      p_motivo: motivo,
      p_executado_por: executadoPorId,
    });

    if (error) {
      if (error.message.includes('não encontrado')) {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException(error.message);
    }
    return data as string;
  }

  async obterSaldoConta(contaId: string, ateData?: string): Promise<number> {
    const { data, error } = await this.supabase.admin.rpc('saldo_conta_contabil', {
      p_conta_id: contaId,
      p_ate_data: ateData ?? null,
    });

    if (error) {
      throw new InternalServerErrorException(`Falha ao calcular saldo da conta: ${error.message}`);
    }
    return Number(data);
  }

  private async buscarPartidas(lancamentoId: string): Promise<PartidaLancamento[]> {
    const mapa = await this.buscarPartidasDeVarios([lancamentoId]);
    return mapa.get(lancamentoId) ?? [];
  }

  private async buscarPartidasDeVarios(lancamentoIds: string[]): Promise<Map<string, PartidaLancamento[]>> {
    const mapa = new Map<string, PartidaLancamento[]>();
    if (lancamentoIds.length === 0) return mapa;

    const { data, error } = await this.supabase.admin
      .from('lancamentos_partidas')
      .select('id, lancamento_id, conta_id, tipo, valor')
      .in('lancamento_id', lancamentoIds);

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar partidas dos lançamentos: ${error.message}`);
    }

    for (const linha of data as LinhaPartida[]) {
      const partida: PartidaLancamento = { id: linha.id, contaId: linha.conta_id, tipo: linha.tipo, valor: linha.valor };
      const lista = mapa.get(linha.lancamento_id) ?? [];
      lista.push(partida);
      mapa.set(linha.lancamento_id, lista);
    }
    return mapa;
  }

  private mapear(linha: LinhaLancamento, partidas: PartidaLancamento[]): LancamentoContabil {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      dataCompetencia: linha.data_competencia,
      historico: linha.historico,
      documentoReferencia: linha.documento_referencia,
      origem: linha.origem,
      estornado: linha.estornado,
      estornoDeId: linha.estorno_de_id,
      criadoPor: linha.criado_por,
      criadoEm: linha.criado_em,
      partidas,
    };
  }
}
