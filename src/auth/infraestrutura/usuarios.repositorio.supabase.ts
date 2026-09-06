import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { Papel } from '../dominio/papel';
import {
  DadosNovoUsuario,
  Usuario,
  UsuariosRepositorioPort,
} from '../aplicacao/portas/usuarios-repositorio.port';

interface LinhaUsuario {
  id: string;
  nome: string;
  email: string;
  contador_id: string | null;
  empresa_id: string | null;
  mfa_habilitado: boolean;
  status: 'ativo' | 'inativo';
  bloqueado: boolean;
  papeis: { nome: Papel } | { nome: Papel }[] | null;
}

@Injectable()
export class UsuariosRepositorioSupabase implements UsuariosRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async criar(dados: DadosNovoUsuario): Promise<Usuario> {
    // Nunca `.insert({...body})` -- lista explícita de campos (regra de mass assignment,
    // ver PENTEST_CODE_REVIEW_PROTOCOL.md do vault e a auditoria já feita no DeliveryHub).
    const { data, error } = await this.supabase.admin
      .from('usuarios')
      .insert({
        id: dados.id,
        nome: dados.nome,
        email: dados.email,
        papel_id: dados.papelId,
        contador_id: dados.contadorId,
        empresa_id: dados.empresaId,
      })
      .select('id, nome, email, contador_id, empresa_id, mfa_habilitado, status, bloqueado, papeis(nome)')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao criar perfil de usuário: ${error?.message}`);
    }

    return this.mapear(data as unknown as LinhaUsuario);
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    const { data, error } = await this.supabase.admin
      .from('usuarios')
      .select('id, nome, email, contador_id, empresa_id, mfa_habilitado, status, bloqueado, papeis(nome)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Falha ao buscar usuário: ${error.message}`);
    }
    if (!data) {
      return null;
    }

    return this.mapear(data as unknown as LinhaUsuario);
  }

  async atualizarPapelEVinculo(
    id: string,
    papelId: string,
    contadorId: string | null,
    empresaId: string | null,
  ): Promise<void> {
    const { error } = await this.supabase.admin
      .from('usuarios')
      .update({ papel_id: papelId, contador_id: contadorId, empresa_id: empresaId })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar papel/vínculo: ${error.message}`);
    }
  }

  async marcarBloqueio(
    id: string,
    bloqueado: boolean,
    motivo: string | null,
    executadoPorId: string,
  ): Promise<void> {
    const { error } = await this.supabase.admin
      .from('usuarios')
      .update({
        bloqueado,
        bloqueado_em: bloqueado ? new Date().toISOString() : null,
        bloqueado_motivo: bloqueado ? motivo : null,
        bloqueado_por: bloqueado ? executadoPorId : null,
      })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(`Falha ao alterar bloqueio: ${error.message}`);
    }
  }

  async buscarIdPapelPorNome(nomePapel: Papel): Promise<string> {
    const { data, error } = await this.supabase.admin
      .from('papeis')
      .select('id')
      .eq('nome', nomePapel)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Papel ${nomePapel} não encontrado no catálogo`);
    }

    return (data as { id: string }).id;
  }

  private mapear(linha: LinhaUsuario): Usuario {
    const papelRelacionado = Array.isArray(linha.papeis) ? linha.papeis[0] : linha.papeis;
    if (!papelRelacionado) {
      throw new InternalServerErrorException(`Usuário ${linha.id} sem papel associado`);
    }

    return {
      id: linha.id,
      nome: linha.nome,
      email: linha.email,
      papel: papelRelacionado.nome,
      contadorId: linha.contador_id,
      empresaId: linha.empresa_id,
      mfaHabilitado: linha.mfa_habilitado,
      status: linha.status,
      bloqueado: linha.bloqueado,
    };
  }
}
