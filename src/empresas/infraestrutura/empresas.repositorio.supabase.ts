import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { ModoAcessoSerpro, RegimeTributario, StatusEmpresa } from '../dominio/empresa';
import {
  DadosAtualizacaoEmpresa,
  DadosNovaEmpresa,
  Empresa,
  EmpresasRepositorioPort,
} from '../aplicacao/portas/empresas-repositorio.port';

interface LinhaEmpresa {
  id: string;
  contador_id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  regime_tributario: RegimeTributario | null;
  modo_acesso_serpro: ModoAcessoSerpro;
  status: StatusEmpresa;
  bloqueado: boolean;
}

const COLUNAS_SELECT =
  'id, contador_id, razao_social, nome_fantasia, cnpj, regime_tributario, modo_acesso_serpro, status, bloqueado';

@Injectable()
export class EmpresasRepositorioSupabase implements EmpresasRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovaEmpresa): Promise<Empresa> {
    // Nunca `.insert({...body})` -- lista explícita de campos (regra de mass assignment).
    const { data, error } = await this.supabase.admin
      .from('empresas')
      .insert({
        contador_id: dados.contadorId,
        razao_social: dados.razaoSocial,
        nome_fantasia: dados.nomeFantasia,
        cnpj: dados.cnpj,
        regime_tributario: dados.regimeTributario,
        modo_acesso_serpro: dados.modoAcessoSerpro,
      })
      .select(COLUNAS_SELECT)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao criar empresa: ${error?.message}`);
    }

    return this.mapear(data as LinhaEmpresa);
  }

  async buscarPorId(id: string): Promise<Empresa | null> {
    const { data, error } = await this.supabase.admin
      .from('empresas')
      .select(COLUNAS_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar empresa: ${error.message}`);
    }
    return data ? this.mapear(data as LinhaEmpresa) : null;
  }

  async listarPorContador(contadorId: string): Promise<Empresa[]> {
    const { data, error } = await this.supabase.admin
      .from('empresas')
      .select(COLUNAS_SELECT)
      .eq('contador_id', contadorId)
      .order('razao_social', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar empresas: ${error.message}`);
    }
    return (data as LinhaEmpresa[]).map((linha) => this.mapear(linha));
  }

  async pertenceAoContador(empresaId: string, contadorId: string): Promise<boolean> {
    const { data, error } = await this.supabase.admin
      .from('empresas')
      .select('id')
      .eq('id', empresaId)
      .eq('contador_id', contadorId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao checar posse da empresa: ${error.message}`);
    }
    return data !== null;
  }

  async atualizar(id: string, dados: DadosAtualizacaoEmpresa): Promise<void> {
    // Whitelist explícita -- mesmo se `dados` viesse maior por engano, só estes 3 campos
    // são enviados ao banco (nunca contador_id/bloqueado/modo_acesso_serpro por aqui).
    const campos: Record<string, unknown> = {};
    if (dados.razaoSocial !== undefined) campos.razao_social = dados.razaoSocial;
    if (dados.nomeFantasia !== undefined) campos.nome_fantasia = dados.nomeFantasia;
    if (dados.regimeTributario !== undefined) campos.regime_tributario = dados.regimeTributario;

    const { error } = await this.supabase.admin.from('empresas').update(campos).eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar empresa: ${error.message}`);
    }
  }

  async atualizarModoAcessoSerpro(id: string, modo: ModoAcessoSerpro): Promise<void> {
    const { error } = await this.supabase.admin
      .from('empresas')
      .update({ modo_acesso_serpro: modo })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar modo de acesso SERPRO: ${error.message}`);
    }
  }

  async marcarBloqueio(
    id: string,
    bloqueado: boolean,
    motivo: string | null,
    executadoPorId: string,
  ): Promise<void> {
    const { error } = await this.supabase.admin
      .from('empresas')
      .update({
        bloqueado,
        bloqueado_em: bloqueado ? new Date().toISOString() : null,
        bloqueado_motivo: bloqueado ? motivo : null,
        bloqueado_por: bloqueado ? executadoPorId : null,
      })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao alterar bloqueio da empresa: ${error.message}`);
    }
  }

  private mapear(linha: LinhaEmpresa): Empresa {
    return {
      id: linha.id,
      contadorId: linha.contador_id,
      razaoSocial: linha.razao_social,
      nomeFantasia: linha.nome_fantasia,
      cnpj: linha.cnpj,
      regimeTributario: linha.regime_tributario,
      modoAcessoSerpro: linha.modo_acesso_serpro,
      status: linha.status,
      bloqueado: linha.bloqueado,
    };
  }
}
