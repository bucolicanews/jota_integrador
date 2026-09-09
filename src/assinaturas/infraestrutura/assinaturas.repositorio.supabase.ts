import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { StatusAssinatura, StatusFatura } from '../dominio/assinatura';
import {
  Assinatura,
  AssinaturasRepositorioPort,
  DadosNovaAssinatura,
  DadosNovaFatura,
  Fatura,
} from '../aplicacao/portas/assinaturas-repositorio.port';

interface LinhaAssinatura {
  id: string;
  contador_id: string;
  plano_id: string;
  stripe_subscription_id: string | null;
  status: StatusAssinatura;
  inicio_em: string;
  fim_em: string | null;
  renovacao_automatica: boolean;
}

interface LinhaFatura {
  id: string;
  contador_id: string;
  assinatura_id: string;
  stripe_invoice_id: string | null;
  valor: number;
  competencia: string;
  vencimento: string;
  status: StatusFatura;
  pago_em: string | null;
}

const COLUNAS_ASSINATURA =
  'id, contador_id, plano_id, stripe_subscription_id, status, inicio_em, fim_em, renovacao_automatica';
const COLUNAS_FATURA = 'id, contador_id, assinatura_id, stripe_invoice_id, valor, competencia, vencimento, status, pago_em';

@Injectable()
export class AssinaturasRepositorioSupabase implements AssinaturasRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async buscarAtivaPorContador(contadorId: string): Promise<Assinatura | null> {
    const { data, error } = await this.supabase.admin
      .from('assinaturas')
      .select(COLUNAS_ASSINATURA)
      .eq('contador_id', contadorId)
      .eq('status', 'ativa')
      .order('inicio_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar assinatura ativa: ${error.message}`);
    }
    return data ? this.mapearAssinatura(data as LinhaAssinatura) : null;
  }

  async buscarPorStripeSubscriptionId(stripeSubscriptionId: string): Promise<Assinatura | null> {
    const { data, error } = await this.supabase.admin
      .from('assinaturas')
      .select(COLUNAS_ASSINATURA)
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar assinatura por subscription: ${error.message}`);
    }
    return data ? this.mapearAssinatura(data as LinhaAssinatura) : null;
  }

  async criar(dados: DadosNovaAssinatura): Promise<Assinatura> {
    const { data, error } = await this.supabase.admin
      .from('assinaturas')
      .insert({
        contador_id: dados.contadorId,
        plano_id: dados.planoId,
        stripe_subscription_id: dados.stripeSubscriptionId,
      })
      .select(COLUNAS_ASSINATURA)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao criar assinatura: ${error?.message}`);
    }
    return this.mapearAssinatura(data as LinhaAssinatura);
  }

  async atualizarStatus(id: string, status: StatusAssinatura): Promise<void> {
    const campos: Record<string, unknown> = { status };
    if (status === 'cancelada') campos.fim_em = new Date().toISOString();

    const { error } = await this.supabase.admin.from('assinaturas').update(campos).eq('id', id);
    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar status da assinatura: ${error.message}`);
    }
  }

  async atualizarRenovacaoAutomatica(id: string, renovacaoAutomatica: boolean): Promise<void> {
    const { error } = await this.supabase.admin
      .from('assinaturas')
      .update({ renovacao_automatica: renovacaoAutomatica })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar renovação automática: ${error.message}`);
    }
  }

  async criarFatura(dados: DadosNovaFatura): Promise<Fatura> {
    const { data, error } = await this.supabase.admin
      .from('faturas')
      .insert({
        contador_id: dados.contadorId,
        assinatura_id: dados.assinaturaId,
        stripe_invoice_id: dados.stripeInvoiceId,
        valor: dados.valor,
        competencia: dados.competencia,
        vencimento: dados.vencimento,
        status: dados.status,
        pago_em: dados.pagoEm,
      })
      .select(COLUNAS_FATURA)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao criar fatura: ${error?.message}`);
    }
    return this.mapearFatura(data as LinhaFatura);
  }

  async buscarFaturaPorStripeInvoiceId(stripeInvoiceId: string): Promise<Fatura | null> {
    const { data, error } = await this.supabase.admin
      .from('faturas')
      .select(COLUNAS_FATURA)
      .eq('stripe_invoice_id', stripeInvoiceId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar fatura: ${error.message}`);
    }
    return data ? this.mapearFatura(data as LinhaFatura) : null;
  }

  async listarFaturasPorContador(contadorId: string): Promise<Fatura[]> {
    const { data, error } = await this.supabase.admin
      .from('faturas')
      .select(COLUNAS_FATURA)
      .eq('contador_id', contadorId)
      .order('competencia', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar faturas: ${error.message}`);
    }
    return (data as LinhaFatura[]).map((linha) => this.mapearFatura(linha));
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
    // unique (gateway, evento_id) -- conflito aqui significa corrida entre duas entregas
    // do mesmo evento processadas quase simultaneamente; ignorar é seguro (idempotência).
    const { error } = await this.supabase.admin
      .from('webhook_eventos_processados')
      .insert({ gateway, evento_id: eventoId });

    if (error && error.code !== '23505') {
      throw new InternalServerErrorException(`Falha ao marcar webhook processado: ${error.message}`);
    }
  }

  private mapearAssinatura(linha: LinhaAssinatura): Assinatura {
    return {
      id: linha.id,
      contadorId: linha.contador_id,
      planoId: linha.plano_id,
      stripeSubscriptionId: linha.stripe_subscription_id,
      status: linha.status,
      inicioEm: linha.inicio_em,
      fimEm: linha.fim_em,
      renovacaoAutomatica: linha.renovacao_automatica,
    };
  }

  private mapearFatura(linha: LinhaFatura): Fatura {
    return {
      id: linha.id,
      contadorId: linha.contador_id,
      assinaturaId: linha.assinatura_id,
      stripeInvoiceId: linha.stripe_invoice_id,
      valor: Number(linha.valor),
      competencia: linha.competencia,
      vencimento: linha.vencimento,
      status: linha.status,
      pagoEm: linha.pago_em,
    };
  }
}
