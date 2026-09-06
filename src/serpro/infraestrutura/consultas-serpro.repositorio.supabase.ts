import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  ConsultasSerproRepositorioPort,
  DadosNovaConsultaSerpro,
} from '../aplicacao/portas/consultas-serpro-repositorio.port';

@Injectable()
export class ConsultasSerproRepositorioSupabase implements ConsultasSerproRepositorioPort {
  constructor(private readonly supabase: SupabaseService) {}

  async registrar(dados: DadosNovaConsultaSerpro): Promise<void> {
    const { error } = await this.supabase.admin.from('consultas_serpro').insert({
      contador_id: dados.contadorId,
      empresa_id: dados.empresaId,
      id_sistema: dados.idSistema,
      id_servico: dados.idServico,
      sucesso: dados.sucesso,
      codigo_erro: dados.codigoErro,
      creditos_consumidos: dados.creditosConsumidos,
    });

    if (error) {
      throw new InternalServerErrorException(`Falha ao registrar consulta SERPRO: ${error.message}`);
    }
  }
}
