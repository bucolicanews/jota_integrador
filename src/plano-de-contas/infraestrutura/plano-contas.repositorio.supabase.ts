import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { GrupoContaContabil } from '../dominio/plano-conta';
import {
  DadosAtualizacaoContaContabil,
  DadosNovaContaContabil,
  PlanoConta,
  PlanoContasRepositorioPort,
} from '../aplicacao/portas/plano-contas-repositorio.port';

interface LinhaPlanoConta {
  id: string;
  empresa_id: string;
  codigo: string;
  nome: string;
  grupo: GrupoContaContabil;
  sintetica: boolean;
  conta_pai_id: string | null;
  conta_caixa_banco: boolean;
  conta_a_receber: boolean;
  conta_a_pagar: boolean;
  ativa: boolean;
}

const COLUNAS_SELECT =
  'id, empresa_id, codigo, nome, grupo, sintetica, conta_pai_id, conta_caixa_banco, conta_a_receber, conta_a_pagar, ativa';

@Injectable()
export class PlanoContasRepositorioSupabase implements PlanoContasRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovaContaContabil): Promise<PlanoConta> {
    const { data, error } = await this.supabase.admin
      .from('plano_contas')
      .insert({
        empresa_id: dados.empresaId,
        codigo: dados.codigo,
        nome: dados.nome,
        grupo: dados.grupo,
        sintetica: dados.sintetica,
        conta_pai_id: dados.contaPaiId,
        conta_caixa_banco: dados.contaCaixaBanco,
        conta_a_receber: dados.contaAReceber,
        conta_a_pagar: dados.contaAPagar,
      })
      .select(COLUNAS_SELECT)
      .single();

    if (error || !data) {
      if (error?.code === '23505') {
        throw new InternalServerErrorException(`Já existe uma conta com este código nesta empresa`);
      }
      throw new InternalServerErrorException(`Falha ao criar conta contábil: ${error?.message}`);
    }

    return this.mapear(data as LinhaPlanoConta);
  }

  async buscarPorId(id: string): Promise<PlanoConta | null> {
    const { data, error } = await this.supabase.admin
      .from('plano_contas')
      .select(COLUNAS_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar conta contábil: ${error.message}`);
    }
    return data ? this.mapear(data as LinhaPlanoConta) : null;
  }

  async listarPorEmpresa(empresaId: string): Promise<PlanoConta[]> {
    const { data, error } = await this.supabase.admin
      .from('plano_contas')
      .select(COLUNAS_SELECT)
      .eq('empresa_id', empresaId)
      .order('codigo', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar plano de contas: ${error.message}`);
    }
    return (data as LinhaPlanoConta[]).map((linha) => this.mapear(linha));
  }

  async atualizar(id: string, dados: DadosAtualizacaoContaContabil): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.nome !== undefined) campos.nome = dados.nome;
    if (dados.contaCaixaBanco !== undefined) campos.conta_caixa_banco = dados.contaCaixaBanco;
    if (dados.contaAReceber !== undefined) campos.conta_a_receber = dados.contaAReceber;
    if (dados.contaAPagar !== undefined) campos.conta_a_pagar = dados.contaAPagar;

    const { error } = await this.supabase.admin.from('plano_contas').update(campos).eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar conta contábil: ${error.message}`);
    }
  }

  async marcarAtiva(id: string, ativa: boolean): Promise<void> {
    const { error } = await this.supabase.admin.from('plano_contas').update({ ativa }).eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao alterar status da conta contábil: ${error.message}`);
    }
  }

  private mapear(linha: LinhaPlanoConta): PlanoConta {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      codigo: linha.codigo,
      nome: linha.nome,
      grupo: linha.grupo,
      sintetica: linha.sintetica,
      contaPaiId: linha.conta_pai_id,
      contaCaixaBanco: linha.conta_caixa_banco,
      contaAReceber: linha.conta_a_receber,
      contaAPagar: linha.conta_a_pagar,
      ativa: linha.ativa,
    };
  }
}
