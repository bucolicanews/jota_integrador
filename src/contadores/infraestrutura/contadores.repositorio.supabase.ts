import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { StatusContador, TipoContador } from '../dominio/contador';
import {
  Contador,
  ContadoresRepositorioPort,
  DadosAtualizacaoContador,
  DadosNovoContador,
} from '../aplicacao/portas/contadores-repositorio.port';

interface LinhaContador {
  id: string;
  nome: string;
  cnpj_cpf: string;
  email: string;
  telefone: string | null;
  tipo: TipoContador;
  status: StatusContador;
  bloqueado: boolean;
}

const COLUNAS_SELECT = 'id, nome, cnpj_cpf, email, telefone, tipo, status, bloqueado';

@Injectable()
export class ContadoresRepositorioSupabase implements ContadoresRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovoContador): Promise<Contador> {
    // Nunca `.insert({...body})` -- lista explícita de campos. `tipo` sempre 'humano'
    // aqui (default da coluna) -- 'interno_jota' não é criado via este caminho.
    const { data, error } = await this.supabase.admin
      .from('contadores')
      .insert({
        nome: dados.nome,
        cnpj_cpf: dados.cnpjCpf,
        email: dados.email,
        telefone: dados.telefone,
      })
      .select(COLUNAS_SELECT)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao criar contador: ${error?.message}`);
    }

    return this.mapear(data as LinhaContador);
  }

  async buscarPorId(id: string): Promise<Contador | null> {
    const { data, error } = await this.supabase.admin
      .from('contadores')
      .select(COLUNAS_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar contador: ${error.message}`);
    }
    return data ? this.mapear(data as LinhaContador) : null;
  }

  async listar(): Promise<Contador[]> {
    const { data, error } = await this.supabase.admin
      .from('contadores')
      .select(COLUNAS_SELECT)
      .order('nome', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(`Falha ao listar contadores: ${error.message}`);
    }
    return (data as LinhaContador[]).map((linha) => this.mapear(linha));
  }

  async atualizar(id: string, dados: DadosAtualizacaoContador): Promise<void> {
    const campos: Record<string, unknown> = {};
    if (dados.nome !== undefined) campos.nome = dados.nome;
    if (dados.telefone !== undefined) campos.telefone = dados.telefone;
    if (dados.email !== undefined) campos.email = dados.email;

    const { error } = await this.supabase.admin.from('contadores').update(campos).eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar contador: ${error.message}`);
    }
  }

  async marcarBloqueio(
    id: string,
    bloqueado: boolean,
    motivo: string | null,
    executadoPorId: string,
  ): Promise<void> {
    const { error } = await this.supabase.admin
      .from('contadores')
      .update({
        bloqueado,
        bloqueado_em: bloqueado ? new Date().toISOString() : null,
        bloqueado_motivo: bloqueado ? motivo : null,
        bloqueado_por: bloqueado ? executadoPorId : null,
      })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao alterar bloqueio do contador: ${error.message}`);
    }
  }

  private mapear(linha: LinhaContador): Contador {
    return {
      id: linha.id,
      nome: linha.nome,
      cnpjCpf: linha.cnpj_cpf,
      email: linha.email,
      telefone: linha.telefone,
      tipo: linha.tipo,
      status: linha.status,
      bloqueado: linha.bloqueado,
    };
  }
}
