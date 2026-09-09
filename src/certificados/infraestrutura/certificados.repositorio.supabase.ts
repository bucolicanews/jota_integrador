import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { StatusCertificado, TipoCertificado } from '../dominio/certificado';
import {
  CertificadoMetadados,
  CertificadosRepositorioPort,
  DadosNovoCertificado,
} from '../aplicacao/portas/certificados-repositorio.port';

interface LinhaCertificado {
  id: string;
  empresa_id: string;
  tipo: TipoCertificado;
  validade_inicio: string | null;
  validade_fim: string;
  status: StatusCertificado;
  criado_em: string;
}

const COLUNAS_METADADOS = 'id, empresa_id, tipo, validade_inicio, validade_fim, status, criado_em';

@Injectable()
export class CertificadosRepositorioSupabase implements CertificadosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async listarPorEmpresa(empresaId: string): Promise<CertificadoMetadados[]> {
    const { data, error } = await this.supabase.admin
      .from('certificados')
      .select(COLUNAS_METADADOS)
      .eq('empresa_id', empresaId)
      .order('criado_em', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar certificados: ${error.message}`);
    }
    return (data as LinhaCertificado[]).map((linha) => this.mapear(linha));
  }

  async buscarAtivoPorEmpresa(empresaId: string): Promise<CertificadoMetadados | null> {
    const { data, error } = await this.supabase.admin
      .from('certificados')
      .select(COLUNAS_METADADOS)
      .eq('empresa_id', empresaId)
      .eq('status', 'ativo')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar certificado ativo: ${error.message}`);
    }
    return data ? this.mapear(data as LinhaCertificado) : null;
  }

  async buscarRefsAtivoPorEmpresa(
    empresaId: string,
  ): Promise<{ id: string; arquivoRef: string; senhaRef: string } | null> {
    const { data, error } = await this.supabase.admin
      .from('certificados')
      .select('id, arquivo_ref, senha_ref')
      .eq('empresa_id', empresaId)
      .eq('status', 'ativo')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar referências do certificado: ${error.message}`);
    }
    return data ? { id: data.id, arquivoRef: data.arquivo_ref, senhaRef: data.senha_ref } : null;
  }

  async criar(dados: DadosNovoCertificado): Promise<CertificadoMetadados> {
    const { data, error } = await this.supabase.admin
      .from('certificados')
      .insert({
        empresa_id: dados.empresaId,
        tipo: dados.tipo,
        arquivo_ref: dados.arquivoRef,
        senha_ref: dados.senhaRef,
        validade_inicio: dados.validadeInicio,
        validade_fim: dados.validadeFim,
      })
      .select(COLUNAS_METADADOS)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao cadastrar certificado: ${error?.message}`);
    }
    return this.mapear(data as LinhaCertificado);
  }

  async marcarStatus(id: string, status: StatusCertificado): Promise<void> {
    const { error } = await this.supabase.admin.from('certificados').update({ status }).eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar status do certificado: ${error.message}`);
    }
  }

  private mapear(linha: LinhaCertificado): CertificadoMetadados {
    return {
      id: linha.id,
      empresaId: linha.empresa_id,
      tipo: linha.tipo,
      validadeInicio: linha.validade_inicio,
      validadeFim: linha.validade_fim,
      status: linha.status,
      criadoEm: linha.criado_em,
    };
  }
}
