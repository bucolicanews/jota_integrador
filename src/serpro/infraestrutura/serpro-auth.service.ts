import { readFileSync } from 'node:fs';
import * as https from 'node:https';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AmbienteSerpro } from '../dominio/serpro';

interface TokenSerpro {
  accessToken: string;
  jwtToken: string | null; // null no trial -- não é exigido lá
  expiraEm: number; // epoch ms
}

// Token público de demonstração do próprio SERPRO (documentado nos cenários trial,
// ex: cenarios_trial/cenarios_ccmei/) -- não é segredo nosso, mas fica configurável via
// env caso o SERPRO troque.
const TOKEN_TRIAL_PADRAO = '06aef429-a981-3ec5-a1f8-71d38d86481e';

/**
 * Gerencia autenticação com o SERPRO -- dois caminhos completamente diferentes
 * (docs/SEGURANCA.md §3):
 *
 * - Trial: token público fixo, sem certificado, sem jwt_token. Testado de verdade
 *   contra o gateway real do SERPRO.
 * - Produção (Modo A): POST autenticacao.sapi.serpro.gov.br/authenticate com Basic
 *   auth + Role-Type: TERCEIROS + certificado mTLS (e-CNPJ da Jota) -- implementado
 *   conforme a documentação oficial, mas NUNCA TESTADO contra produção real (não temos
 *   o certificado físico da Jota ainda). Validar com cautela antes de usar de verdade.
 */
@Injectable()
export class SerproAuthService {
  private cache: TokenSerpro | null = null;

  constructor(private readonly config: ConfigService) {}

  async obterToken(ambiente: AmbienteSerpro, forcarRenovacao = false): Promise<TokenSerpro> {
    if (!forcarRenovacao && this.cache && this.cache.expiraEm > Date.now()) {
      return this.cache;
    }

    const token = ambiente === 'trial' ? this.tokenTrial() : await this.autenticarProducao();
    this.cache = token;
    return token;
  }

  /** Invalida o cache -- chamado pelo gateway ao receber 401 (sem endpoint de refresh, ver §3). */
  invalidarCache(): void {
    this.cache = null;
  }

  private tokenTrial(): TokenSerpro {
    return {
      accessToken: this.config.get<string>('SERPRO_TRIAL_TOKEN') ?? TOKEN_TRIAL_PADRAO,
      jwtToken: null,
      expiraEm: Date.now() + 24 * 60 * 60 * 1000, // token público fixo, cache só por não bater na rede à toa
    };
  }

  private async autenticarProducao(): Promise<TokenSerpro> {
    const consumerKey = this.config.get<string>('SERPRO_CONSUMER_KEY');
    const consumerSecret = this.config.get<string>('SERPRO_CONSUMER_SECRET');
    const certificadoPath = this.config.get<string>('SERPRO_CERTIFICADO_PATH');
    const certificadoSenha = this.config.get<string>('SERPRO_CERTIFICADO_SENHA');

    if (!consumerKey || !consumerSecret || !certificadoPath || !certificadoSenha) {
      throw new InternalServerErrorException(
        'Ambiente de produção do SERPRO não configurado (SERPRO_CONSUMER_KEY/SECRET/CERTIFICADO_PATH/SENHA)',
      );
    }

    const credenciais = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const pfx = readFileSync(certificadoPath);

    const corpo = await this.requisicaoHttpsComCertificado({
      hostname: 'autenticacao.sapi.serpro.gov.br',
      path: '/authenticate',
      metodo: 'POST',
      pfx,
      passphrase: certificadoSenha,
      headers: {
        Authorization: `Basic ${credenciais}`,
        'Role-Type': 'TERCEIROS',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      corpoRequisicao: 'grant_type=client_credentials',
    });

    const resposta = JSON.parse(corpo) as {
      access_token?: string;
      jwt_token?: string;
      expires_in?: number;
    };

    if (!resposta.access_token || !resposta.jwt_token) {
      throw new InternalServerErrorException('Resposta de autenticação do SERPRO sem os tokens esperados');
    }

    return {
      accessToken: resposta.access_token,
      jwtToken: resposta.jwt_token,
      // Margem de segurança de 60s antes da expiração real informada (~33min).
      expiraEm: Date.now() + (resposta.expires_in ?? 1800) * 1000 - 60_000,
    };
  }

  /**
   * `fetch` nativo não expõe configuração de certificado cliente (mTLS) sem
   * dependência extra (undici Agent) -- usando `node:https` direto só pra esta
   * chamada, que é a única que precisa de handshake com certificado.
   */
  private requisicaoHttpsComCertificado(opcoes: {
    hostname: string;
    path: string;
    metodo: string;
    pfx: Buffer;
    passphrase: string;
    headers: Record<string, string>;
    corpoRequisicao: string;
  }): Promise<string> {
    return new Promise((resolve, reject) => {
      const requisicao = https.request(
        {
          hostname: opcoes.hostname,
          path: opcoes.path,
          method: opcoes.metodo,
          pfx: opcoes.pfx,
          passphrase: opcoes.passphrase,
          headers: {
            ...opcoes.headers,
            'Content-Length': Buffer.byteLength(opcoes.corpoRequisicao),
          },
        },
        (resposta) => {
          let corpo = '';
          resposta.on('data', (pedaco) => (corpo += pedaco));
          resposta.on('end', () => {
            if (resposta.statusCode && resposta.statusCode >= 200 && resposta.statusCode < 300) {
              resolve(corpo);
            } else {
              reject(new Error(`SERPRO authenticate falhou: HTTP ${resposta.statusCode} -- ${corpo}`));
            }
          });
        },
      );

      requisicao.on('error', reject);
      requisicao.write(opcoes.corpoRequisicao);
      requisicao.end();
    });
  }
}
