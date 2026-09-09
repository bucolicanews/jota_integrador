import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { StatusCobranca } from '../dominio/cobranca-honorario';
import {
  CobrancaHonorario,
  CobrancasHonorariosRepositorioPort,
  DadosAtualizacaoPagamento,
  DadosNovaCobranca,
} from '../aplicacao/portas/cobrancas-honorarios-repositorio.port';

interface LinhaCobranca {
  id: string;
  contador_id: string;
  empresa_id: string;
  descricao: string;
  valor: number;
  comissao_pct: number;
  comissao_valor: number;
  stripe_payment_intent_id: string | null;
  status: StatusCobranca;
  criado_em: string;
  pago_em: string | null;
}

const COLUNAS_SELECT =
  'id, contador_id, empresa_id, descricao, valor, comissao_pct, comissao_valor, stripe_payment_intent_id, status, criado_em, pago_em';

@Injectable()
export class CobrancasHonorariosRepositorioSupabase implements CobrancasHonorariosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovaCobranca): Promise<CobrancaHonorario> {
    // comissao_pct/comissao_valor NÃO vão no insert -- o trigger definir_comissao_honorario
    // (SECURITY DEFINER) calcula a partir da config global e sobrescreve qualquer coisa
    // que viesse daqui (docs/SEGURANCA.md §7: comissão nunca aceita do cliente).
    const { data, error } = await this.supabase.admin
      .from('cobrancas_honorarios')
      .insert({
        contador_id: dados.contadorId,
        empresa_id: dados.empresaId,
        descricao: dados.descricao,
        valor: dados.valor,
      })
      .select(COLUNAS_SELECT)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao criar cobrança de honorário: ${error?.message}`);
    }
    return this.mapear(data as LinhaCobranca);
  }

  async buscarPorId(id: string): Promise<CobrancaHonorario | null> {
    const { data, error } = await this.supabase.admin
      .from('cobrancas_honorarios')
      .select(COLUNAS_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar cobrança: ${error.message}`);
    }
    return data ? this.mapear(data as LinhaCobranca) : null;
  }

  async buscarPorStripePaymentIntentId(stripePaymentIntentId: string): Promise<CobrancaHonorario | null> {
    const { data, error } = await this.supabase.admin
      .from('cobrancas_honorarios')
      .select(COLUNAS_SELECT)
      .eq('stripe_payment_intent_id', stripePaymentIntentId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar cobrança por payment intent: ${error.message}`);
    }
    return data ? this.mapear(data as LinhaCobranca) : null;
  }

  async listarPorContador(contadorId: string): Promise<CobrancaHonorario[]> {
    const { data, error } = await this.supabase.admin
      .from('cobrancas_honorarios')
      .select(COLUNAS_SELECT)
      .eq('contador_id', contadorId)
      .order('criado_em', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar cobranças do contador: ${error.message}`);
    }
    return (data as LinhaCobranca[]).map((linha) => this.mapear(linha));
  }

  async listarPorEmpresa(empresaId: string): Promise<CobrancaHonorario[]> {
    const { data, error } = await this.supabase.admin
      .from('cobrancas_honorarios')
      .select(COLUNAS_SELECT)
      .eq('empresa_id', empresaId)
      .order('criado_em', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar cobranças da empresa: ${error.message}`);
    }
    return (data as LinhaCobranca[]).map((linha) => this.mapear(linha));
  }

  async atualizarPagamento(id: string, dados: DadosAtualizacaoPagamento): Promise<void> {
    const { error } = await this.supabase.admin
      .from('cobrancas_honorarios')
      .update({
        status: dados.status,
        stripe_payment_intent_id: dados.stripePaymentIntentId,
        pago_em: dados.pagoEm,
      })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar pagamento da cobrança: ${error.message}`);
    }
  }

  async jaProcessouEventoWebhook(gateway: string, eventoId: string): Promise<boolean> {
    const { data, error } = await this.supabase.admin
      .from('webhook_eventos_processados')
      .select('id')
      .eq('gateway', gateway)
      .eq('evento_id', eventoId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao checar idempotência de webhook: ${error.message}`);
    }
    return data !== null;
  }

  async marcarEventoWebhookProcessado(gateway: string, eventoId: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('webhook_eventos_processados')
      .insert({ gateway, evento_id: eventoId });

    if (error && error.code !== '23505') {
      throw new InternalServerErrorException(`Falha ao marcar webhook processado: ${error.message}`);
    }
  }

  private mapear(linha: LinhaCobranca): CobrancaHonorario {
    return {
      id: linha.id,
      contadorId: linha.contador_id,
      empresaId: linha.empresa_id,
      descricao: linha.descricao,
      valor: Number(linha.valor),
      comissaoPct: Number(linha.comissao_pct),
      comissaoValor: Number(linha.comissao_valor),
      stripePaymentIntentId: linha.stripe_payment_intent_id,
      status: linha.status,
      criadoEm: linha.criado_em,
      pagoEm: linha.pago_em,
    };
  }
}
