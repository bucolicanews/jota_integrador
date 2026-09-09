import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITMO = 'aes-256-gcm';
const TAMANHO_IV = 12; // recomendado pelo NIST para GCM
const TAMANHO_TAG = 16;

/**
 * Primitiva de criptografia simétrica (AES-256-GCM) usada pelo cofre de certificados
 * (docs/SEGURANCA.md §1) -- e por qualquer outro dado que precise do mesmo nível de
 * proteção em repouso no futuro. Não conhece Supabase/Storage, só cifra/decifra bytes.
 *
 * A chave mestra vive só em env/Secret Manager (CERTIFICADO_CHAVE_MESTRA), nunca no
 * banco -- decifrar sem a chave certa é inviável, mesmo com acesso total ao Postgres/
 * Storage (defesa em profundidade: comprometer o banco sozinho não expõe o certificado).
 */
@Injectable()
export class CofreCriptografiaService {
  private readonly chave: Buffer;

  constructor(config: ConfigService) {
    const chaveBase64 = config.getOrThrow<string>('CERTIFICADO_CHAVE_MESTRA');
    this.chave = Buffer.from(chaveBase64, 'base64');

    if (this.chave.length !== 32) {
      throw new InternalServerErrorException(
        'CERTIFICADO_CHAVE_MESTRA precisa ser uma chave AES-256 de 32 bytes em base64',
      );
    }
  }

  /** Retorna um envelope opaco (iv + tag + ciphertext, base64) -- guardar como está, nunca tentar interpretar. */
  cifrar(dados: Buffer): string {
    const iv = randomBytes(TAMANHO_IV);
    const cipher = createCipheriv(ALGORITMO, this.chave, iv);
    const ciphertext = Buffer.concat([cipher.update(dados), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, tag, ciphertext]).toString('base64');
  }

  decifrar(envelope: string): Buffer {
    const bruto = Buffer.from(envelope, 'base64');
    const iv = bruto.subarray(0, TAMANHO_IV);
    const tag = bruto.subarray(TAMANHO_IV, TAMANHO_IV + TAMANHO_TAG);
    const ciphertext = bruto.subarray(TAMANHO_IV + TAMANHO_TAG);

    const decipher = createDecipheriv(ALGORITMO, this.chave, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }
}
