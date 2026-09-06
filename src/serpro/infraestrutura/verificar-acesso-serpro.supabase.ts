import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { VerificarAcessoSerproPort } from '../aplicacao/portas/verificar-acesso-serpro.port';

/**
 * Lê `empresas.modo_acesso_serpro` e checa a tabela correspondente:
 * `procuracoes` (Modo A) ou `certificados` (Modo B) -- docs/SEGURANCA.md §1-2.
 */
@Injectable()
export class VerificarAcessoSerproSupabase implements VerificarAcessoSerproPort {
  constructor(private readonly supabase: SupabaseService) {}

  async possuiAcessoValido(empresaId: string): Promise<{ valido: boolean; motivo: string | null }> {
    const { data: empresa, error: erroEmpresa } = await this.supabase.admin
      .from('empresas')
      .select('modo_acesso_serpro')
      .eq('id', empresaId)
      .maybeSingle();

    if (erroEmpresa) {
      throw new InternalServerErrorException(`Falha ao verificar modo de acesso: ${erroEmpresa.message}`);
    }
    if (!empresa) {
      return { valido: false, motivo: 'Empresa não encontrada' };
    }

    if (empresa.modo_acesso_serpro === 'procuracao') {
      return this.checarProcuracao(empresaId);
    }
    return this.checarCertificado(empresaId);
  }

  private async checarProcuracao(empresaId: string): Promise<{ valido: boolean; motivo: string | null }> {
    const { data, error } = await this.supabase.admin
      .from('procuracoes')
      .select('status, expira_em')
      .eq('empresa_id', empresaId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao verificar procuração: ${error.message}`);
    }
    if (!data) {
      return { valido: false, motivo: 'Empresa ainda não outorgou procuração eletrônica' };
    }
    if (data.status !== 'ativa') {
      return { valido: false, motivo: `Procuração com status "${data.status}" -- renove no gov.br para continuar` };
    }
    if (data.expira_em && new Date(data.expira_em) < new Date()) {
      return { valido: false, motivo: 'Procuração expirada -- renove no gov.br para continuar' };
    }
    return { valido: true, motivo: null };
  }

  private async checarCertificado(empresaId: string): Promise<{ valido: boolean; motivo: string | null }> {
    const { data, error } = await this.supabase.admin
      .from('certificados')
      .select('status, validade_fim')
      .eq('empresa_id', empresaId)
      .eq('status', 'ativo')
      .order('validade_fim', { ascending: false })
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao verificar certificado: ${error.message}`);
    }
    if (!data) {
      return { valido: false, motivo: 'Empresa sem certificado digital ativo cadastrado' };
    }
    if (new Date(data.validade_fim) < new Date()) {
      return { valido: false, motivo: 'Certificado digital expirado -- cadastre um novo' };
    }
    return { valido: true, motivo: null };
  }
}
