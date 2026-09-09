import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service';

const BUCKET = 'mensagens-caixa-postal';

/**
 * Conteúdo de mensagem do Caixa Postal (docs/SEGURANCA.md §5: classificação "Restrito",
 * não "Crítico" -- diferente do cofre de certificados, NÃO cifra o conteúdo. Bucket
 * privado (sem policy pra authenticated/anon, migration 20260909000003) já é a proteção
 * adequada pra esse nível: controle de acesso, não segredo criptográfico.
 */
@Injectable()
export class StorageMensagensCaixaPostalService {
  constructor(private readonly supabase: SupabaseService) {}

  async armazenar(empresaId: string, conteudoHtml: string): Promise<string> {
    const ref = `${empresaId}/${randomUUID()}.html`;
    const { error } = await this.supabase.admin.storage
      .from(BUCKET)
      .upload(ref, Buffer.from(conteudoHtml, 'utf8'), { contentType: 'text/html' });

    if (error) {
      throw new InternalServerErrorException(`Falha ao gravar conteúdo da mensagem: ${error.message}`);
    }
    return ref;
  }

  async recuperar(ref: string): Promise<string> {
    const { data, error } = await this.supabase.admin.storage.from(BUCKET).download(ref);
    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao ler conteúdo da mensagem: ${error?.message}`);
    }
    return Buffer.from(await data.arrayBuffer()).toString('utf8');
  }
}
