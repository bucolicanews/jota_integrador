import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AmbienteSerpro, EnvelopeSerpro, montarEnvelope } from '../dominio/serpro';
import {
  ParametrosConsultaSerpro,
  RespostaSerpro,
  SerproGatewayPort,
} from '../aplicacao/portas/serpro-gateway.port';
import { SerproAuthService } from './serpro-auth.service';

const URL_BASE_TRIAL = 'https://gateway.apiserpro.serpro.gov.br/integra-contador-trial/v1';
const URL_BASE_PRODUCAO = 'https://gateway.apiserpro.serpro.gov.br/integra-contador/v1';

// CNPJ genérico usado quando SERPRO_CONTRATANTE_CNPJ não está configurado (só faz
// sentido em ambiente trial, onde o valor é ignorado/sobrescrito pelo domínio mesmo).
const CONTRATANTE_NAO_CONFIGURADO = '00000000000000';

@Injectable()
export class SerproGatewayHttp implements SerproGatewayPort {
  private readonly logger = new Logger(SerproGatewayHttp.name);

  constructor(
    private readonly authService: SerproAuthService,
    private readonly config: ConfigService,
  ) {}

  async consultar(params: ParametrosConsultaSerpro): Promise<RespostaSerpro> {
    const ambiente = this.ambienteConfigurado();
    const envelope = montarEnvelope({
      ambiente,
      contratanteCnpj: this.contratanteCnpj(ambiente),
      autorPedidoDocumento: { numero: this.contratanteCnpj(ambiente), tipo: 2 },
      contribuinteCnpj: params.contribuinteCnpj,
      idSistema: params.idSistema,
      idServico: params.idServico,
      dados: params.dados,
      documentoTrial: params.documentoTrial,
    });

    return this.executarComRetryDeAuth(envelope, ambiente);
  }

  private ambienteConfigurado(): AmbienteSerpro {
    return this.config.get<string>('SERPRO_AMBIENTE') === 'producao' ? 'producao' : 'trial';
  }

  private contratanteCnpj(ambiente: AmbienteSerpro): string {
    if (ambiente === 'trial') {
      return CONTRATANTE_NAO_CONFIGURADO; // ignorado por montarEnvelope no modo trial
    }
    const cnpj = this.config.get<string>('SERPRO_CONTRATANTE_CNPJ');
    if (!cnpj) {
      throw new Error('SERPRO_CONTRATANTE_CNPJ não configurado para ambiente de produção');
    }
    return cnpj;
  }

  /**
   * Sem endpoint de refresh no SERPRO -- ao tomar 401, reautenticar do zero e tentar
   * de novo UMA vez (docs/SEGURANCA.md §3). Nunca deixar 401 vazar pro chamador sem
   * pelo menos essa tentativa.
   */
  private async executarComRetryDeAuth(
    envelope: EnvelopeSerpro,
    ambiente: AmbienteSerpro,
    jaTentouRenovar = false,
  ): Promise<RespostaSerpro> {
    const token = await this.authService.obterToken(ambiente);
    const urlBase = ambiente === 'trial' ? URL_BASE_TRIAL : URL_BASE_PRODUCAO;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': 'application/json',
    };
    if (token.jwtToken) {
      headers.jwt_token = token.jwtToken;
    }

    const resposta = await fetch(`${urlBase}/Consultar`, {
      method: 'POST',
      headers,
      body: JSON.stringify(envelope),
    });

    if (resposta.status === 401 && !jaTentouRenovar) {
      this.logger.warn('SERPRO retornou 401 -- reautenticando e tentando novamente uma vez');
      this.authService.invalidarCache();
      return this.executarComRetryDeAuth(envelope, ambiente, true);
    }

    // Nunca logar o corpo bruto aqui (pode conter dado fiscal sensível) -- só status.
    this.logger.log(
      `SERPRO ${envelope.pedidoDados.idSistema}/${envelope.pedidoDados.idServico} -> HTTP ${resposta.status}`,
    );

    let corpo: unknown;
    try {
      corpo = await resposta.json();
    } catch {
      corpo = null;
    }

    return {
      // HTTP 200 sozinho NÃO significa sucesso -- o SERPRO embrulha erro de negócio
      // (ex: payload de `dados` inválido) dentro de um HTTP 200 com um `status` interno
      // diferente de 200 (confirmado testando de verdade: CAIXAPOSTAL devolveu HTTP 200
      // + `"status":400` pra um `dados` malformado). O campo vem ora como número, ora
      // como string ("200") dependendo do serviço -- por isso o Number() antes de comparar.
      // Serviços que não populam esse campo mantêm o comportamento antigo (só HTTP).
      sucesso: resposta.ok && this.statusInternoIndicaSucesso(corpo),
      statusHttp: resposta.status,
      corpo,
    };
  }

  private statusInternoIndicaSucesso(corpo: unknown): boolean {
    const statusInterno = (corpo as { status?: unknown } | null)?.status;
    if (statusInterno === undefined || statusInterno === null) return true;
    const numero = Number(statusInterno);
    return !Number.isNaN(numero) && numero >= 200 && numero < 300;
  }
}
