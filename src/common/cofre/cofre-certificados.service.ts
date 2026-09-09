import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { CofreCriptografiaService } from './cofre-criptografia.service';

const BUCKET = 'certificados-privados';

/**
 * Cofre de certificados digitais (Modo B, docs/SEGURANCA.md §1). Cifra o arquivo (.pfx/
 * .p12) e a senha ANTES de subir pro Storage -- o bucket é privado e sem policy pra
 * `authenticated` (migration 20260909000001), mas a cifragem é a camada que importa de
 * verdade: mesmo um vazamento do bucket ou do service_role key sozinho não expõe nada
 * sem a `CERTIFICADO_CHAVE_MESTRA`.
 *
 * `arquivo_ref`/`senha_ref` (tabela `certificados`) guardam só o caminho retornado aqui
 * -- nunca o conteúdo. Nenhum método deste serviço deve ser chamado a partir de um
 * controller que devolve a resposta direto pro cliente (ver CertificadosController --
 * a API nunca retorna esses valores, só metadados).
 */
@Injectable()
export class CofreCertificadosService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly criptografia: CofreCriptografiaService,
  ) {}

  /** Cifra e sobe arquivo+senha, retorna os dois `_ref` (caminhos no bucket) pra persistir em `certificados`. */
  async armazenar(
    empresaId: string,
    arquivo: Buffer,
    senha: string,
  ): Promise<{ arquivoRef: string; senhaRef: string }> {
    const prefixo = `${empresaId}/${randomUUID()}`;
    const arquivoRef = `${prefixo}.arquivo.enc`;
    const senhaRef = `${prefixo}.senha.enc`;

    await this.subir(arquivoRef, this.criptografia.cifrar(arquivo));
    await this.subir(senhaRef, this.criptografia.cifrar(Buffer.from(senha, 'utf8')));

    return { arquivoRef, senhaRef };
  }

  /**
   * Recupera arquivo+senha em claro -- só para uso interno do backend na autenticação
   * junto ao SERPRO (Modo B), nunca para responder uma requisição HTTP. Ainda sem
   * chamador real: a mecânica exata de autenticação do Modo B junto ao SERPRO é uma
   * pendência confirmada (docs/SEGURANCA.md §1/§3) -- método pronto para quando isso for
   * resolvido, não usar antes disso.
   */
  async recuperar(arquivoRef: string, senhaRef: string): Promise<{ arquivo: Buffer; senha: string }> {
    const [arquivoCifrado, senhaCifrada] = await Promise.all([this.baixar(arquivoRef), this.baixar(senhaRef)]);

    return {
      arquivo: this.criptografia.decifrar(arquivoCifrado),
      senha: this.criptografia.decifrar(senhaCifrada).toString('utf8'),
    };
  }

  async remover(refs: string[]): Promise<void> {
    if (refs.length === 0) return;
    const { error } = await this.supabase.admin.storage.from(BUCKET).remove(refs);
    if (error) {
      throw new InternalServerErrorException(`Falha ao remover do cofre: ${error.message}`);
    }
  }

  private async subir(ref: string, envelopeBase64: string): Promise<void> {
    const { error } = await this.supabase.admin.storage
      .from(BUCKET)
      .upload(ref, Buffer.from(envelopeBase64, 'utf8'), { contentType: 'application/octet-stream' });

    if (error) {
      throw new InternalServerErrorException(`Falha ao gravar no cofre: ${error.message}`);
    }
  }

  private async baixar(ref: string): Promise<string> {
    const { data, error } = await this.supabase.admin.storage.from(BUCKET).download(ref);
    if (error || !data) {
      throw new InternalServerErrorException(`Falha ao ler do cofre: ${error?.message}`);
    }
    return Buffer.from(await data.arrayBuffer()).toString('utf8');
  }
}
