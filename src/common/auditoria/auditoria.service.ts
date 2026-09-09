import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface RegistroAuditoria {
  usuarioId: string;
  contadorId?: string | null;
  empresaId?: string | null;
  acao: string;
  recurso: string;
  dadosAntigos?: unknown;
  dadosNovos?: unknown;
}

/**
 * Escrita em `logs_auditoria` (docs/BANCO_DE_DADOS.md §6, tabela IMUTÁVEL -- só INSERT,
 * reforçado por trigger no banco). Ainda não existe um módulo `auditoria/` com leitura/
 * consulta via API (ver task #6 da lista de trabalho) -- este serviço cobre só o lado de
 * escrita, que é o que os módulos de certificado/procuração precisam agora para cumprir
 * a regra inviolável de auditoria em toda mutação sensível (CLAUDE.md/docs/SEGURANCA.md).
 *
 * `ip`/`user_agent` ficam de fora por ora -- exigiriam threading do request por todas as
 * camadas (Controller → UseCase → aqui) só para isso; melhor adicionar via interceptor
 * global quando o módulo de leitura for construído, não meio-implementado agora.
 *
 * Nunca lança erro de auditoria pro chamador (usa admin client, best-effort com log) --
 * uma falha ao GRAVAR o log não pode impedir a operação de negócio em si acontecer, mas
 * a falha fica visível nos logs da aplicação, não é engolida em silêncio.
 */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async registrar(registro: RegistroAuditoria): Promise<void> {
    const { error } = await this.supabase.admin.from('logs_auditoria').insert({
      usuario_id: registro.usuarioId,
      contador_id: registro.contadorId ?? null,
      empresa_id: registro.empresaId ?? null,
      acao: registro.acao,
      recurso: registro.recurso,
      dados_antigos: registro.dadosAntigos ?? null,
      dados_novos: registro.dadosNovos ?? null,
    });

    if (error) {
      this.logger.error(`Falha ao gravar log de auditoria (ação=${registro.acao}, recurso=${registro.recurso}): ${error.message}`);
      // Não relança erro -- ver nota da classe (best-effort, nunca bloqueia a operação de negócio).
    }
  }
}
