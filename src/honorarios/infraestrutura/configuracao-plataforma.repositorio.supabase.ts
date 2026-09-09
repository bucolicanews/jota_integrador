import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { ConfiguracaoPlataformaRepositorioPort } from '../aplicacao/portas/configuracao-plataforma-repositorio.port';

@Injectable()
export class ConfiguracaoPlataformaRepositorioSupabase implements ConfiguracaoPlataformaRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async obterComissaoHonorariosPct(): Promise<number> {
    const { data, error } = await this.supabase.admin
      .from('configuracoes_plataforma')
      .select('comissao_honorarios_pct')
      .eq('id', 1)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao obter comissão da plataforma: ${error?.message}`);
    }
    return Number(data.comissao_honorarios_pct);
  }

  async atualizarComissaoHonorariosPct(pct: number): Promise<void> {
    const { error } = await this.supabase.admin
      .from('configuracoes_plataforma')
      .update({ comissao_honorarios_pct: pct })
      .eq('id', 1);

    if (error) {
      throw new InternalServerErrorException(`Falha ao atualizar comissão da plataforma: ${error.message}`);
    }
  }
}
