import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  CreditosRepositorioPort,
  MovimentoCredito,
  SaldoInsuficienteError,
} from '../aplicacao/portas/creditos-repositorio.port';

interface LinhaMovimento {
  id: string;
  contador_id: string;
  empresa_id: string | null;
  tipo_operacao: string;
  quantidade: number;
  saldo_antes: number;
  saldo_depois: number;
  motivo: string | null;
  criado_em: string;
}

@Injectable()
export class CreditosRepositorioSupabase implements CreditosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async obterSaldo(contadorId: string): Promise<number> {
    const { data, error } = await this.supabase.admin
      .from('creditos_saldo')
      .select('saldo_atual')
      .eq('contador_id', contadorId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao obter saldo: ${error.message}`);
    }
    return data?.saldo_atual ?? 0;
  }

  async listarMovimentos(contadorId: string): Promise<MovimentoCredito[]> {
    const { data, error } = await this.supabase.admin
      .from('creditos_movimentos')
      .select('id, contador_id, empresa_id, tipo_operacao, quantidade, saldo_antes, saldo_depois, motivo, criado_em')
      .eq('contador_id', contadorId)
      .order('criado_em', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar movimentos: ${error.message}`);
    }
    return (data as LinhaMovimento[]).map((linha) => this.mapear(linha));
  }

  async debitar(
    contadorId: string,
    empresaId: string,
    tipoOperacao: string,
    quantidade: number,
    motivo: string,
  ): Promise<number> {
    // Nunca implementar isso como UPDATE+INSERT separados -- a função Postgres
    // (migration 0011) garante atomicidade real via lock de linha (docs/SEGURANCA.md §6).
    const { data, error } = await this.supabase.admin.rpc('debitar_creditos', {
      p_contador_id: contadorId,
      p_empresa_id: empresaId,
      p_tipo_operacao: tipoOperacao,
      p_quantidade: quantidade,
      p_motivo: motivo,
    });

    if (error) {
      if (error.message.includes('Saldo insuficiente')) {
        throw new SaldoInsuficienteError(error.message);
      }
      throw new InternalServerErrorException(`Falha ao debitar créditos: ${error.message}`);
    }
    return data as number;
  }

  async creditar(contadorId: string, quantidade: number, motivo: string): Promise<number> {
    const { data, error } = await this.supabase.admin.rpc('creditar_creditos', {
      p_contador_id: contadorId,
      p_quantidade: quantidade,
      p_motivo: motivo,
    });

    if (error) {
      throw new InternalServerErrorException(`Falha ao creditar: ${error.message}`);
    }
    return data as number;
  }

  private mapear(linha: LinhaMovimento): MovimentoCredito {
    return {
      id: linha.id,
      contadorId: linha.contador_id,
      empresaId: linha.empresa_id,
      tipoOperacao: linha.tipo_operacao,
      quantidade: linha.quantidade,
      saldoAntes: linha.saldo_antes,
      saldoDepois: linha.saldo_depois,
      motivo: linha.motivo,
      criadoEm: linha.criado_em,
    };
  }
}
