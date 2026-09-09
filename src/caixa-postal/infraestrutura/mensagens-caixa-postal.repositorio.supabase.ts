import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { StatusMensagem } from '../dominio/mensagem-caixa-postal';
import {
  DadosNovaMensagem,
  MensagemCaixaPostal,
  MensagensCaixaPostalRepositorioPort,
} from '../aplicacao/portas/mensagens-caixa-postal-repositorio.port';

interface LinhaMensagem {
  id: string;
  empresa_id: string;
  serpro_isn: string;
  orgao: string;
  assunto: string;
  status: StatusMensagem;
  data_recebimento: string;
  conteudo_ref: string | null;
}

const COLUNAS_SELECT = 'id, empresa_id, serpro_isn, orgao, assunto, status, data_recebimento, conteudo_ref';

@Injectable()
export class MensagensCaixaPostalRepositorioSupabase implements MensagensCaixaPostalRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async listarPorEmpresa(empresaId: string): Promise<MensagemCaixaPostal[]> {
    const { data, error } = await this.supabase.admin
      .from('mensagens_caixa_postal')
      .select(COLUNAS_SELECT)
      .eq('empresa_id', empresaId)
      .order('data_recebimento', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar mensagens: ${error.message}`);
    }
    return (data as LinhaMensagem[]).map((linha) => this.mapear(linha));
  }

  async buscarPorId(id: string): Promise<MensagemCaixaPostal | null> {
    const { data, error } = await this.supabase.admin
      .from('mensagens_caixa_postal')
      .select(COLUNAS_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar mensagem: ${error.message}`);
    }
    return data ? this.mapear(data as LinhaMensagem) : null;
  }

  async inserirSeNovo(dados: DadosNovaMensagem): Promise<boolean> {
    const { error } = await this.supabase.admin.from('mensagens_caixa_postal').insert({
      empresa_id: dados.empresaId,
      serpro_isn: dados.serproIsn,
      orgao: dados.orgao,
      assunto: dados.assunto,
      data_recebimento: dados.dataRecebimento,
    });

    if (!error) return true;
    if (error.code === '23505') return false; // já existe (empresa_id, serpro_isn) -- idempotente, não é falha
    throw new InternalServerErrorException(`Falha ao inserir mensagem: ${error.message}`);
  }

  async marcarComoLida(id: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('mensagens_caixa_postal')
      .update({ status: 'lida' })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao marcar mensagem como lida: ${error.message}`);
    }
  }

  async atualizarConteudoRef(id: string, conteudoRef: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('mensagens_caixa_postal')
      .update({ conteudo_ref: conteudoRef })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar conteúdo da mensagem: ${error.message}`);
    }
  }

  private mapear(linha: LinhaMensagem): MensagemCaixaPostal {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      serproIsn: linha.serpro_isn,
      orgao: linha.orgao,
      assunto: linha.assunto,
      status: linha.status,
      dataRecebimento: linha.data_recebimento,
      conteudoRef: linha.conteudo_ref,
    };
  }
}
