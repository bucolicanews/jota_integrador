import { ForbiddenException, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { DebitarCreditosUseCase } from '../../../creditos/aplicacao/casos-de-uso/debitar-creditos.usecase';
import { EstornarCreditosUseCase } from '../../../creditos/aplicacao/casos-de-uso/estornar-creditos.usecase';
import { custoDaOperacao } from '../../../creditos/dominio/credito';
import {
  EMPRESAS_REPOSITORIO,
  EmpresasRepositorioPort,
} from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import {
  CONSULTAS_SERPRO_REPOSITORIO,
  ConsultasSerproRepositorioPort,
} from '../../../serpro/aplicacao/portas/consultas-serpro-repositorio.port';
import { SERPRO_GATEWAY, SerproGatewayPort } from '../../../serpro/aplicacao/portas/serpro-gateway.port';
import {
  VERIFICAR_ACESSO_SERPRO,
  VerificarAcessoSerproPort,
} from '../../../serpro/aplicacao/portas/verificar-acesso-serpro.port';
import { converterDataHoraSerpro } from '../../dominio/mensagem-caixa-postal';
import {
  MENSAGENS_CAIXA_POSTAL_REPOSITORIO,
  MensagensCaixaPostalRepositorioPort,
} from '../portas/mensagens-caixa-postal-repositorio.port';

const ID_SISTEMA_CAIXA_POSTAL = 'CAIXAPOSTAL';
const ID_SERVICO_LISTA_MENSAGENS = 'MSGCONTRIBUINTE61';
const CUSTO_OPERACAO = 'CAIXA_POSTAL';

interface MensagemSerpro {
  isn: string;
  assuntoModelo: string;
  descricaoOrigem?: string;
  dataEnvio: string;
  horaEnvio: string;
}

/**
 * Busca só a página mais recente por sincronização (sem paginação automática) -- cada
 * chamada ao SERPRO custa crédito do contador; paginar sozinho multiplicaria o custo
 * silenciosamente. Se a caixa tiver mais mensagens do que cabe numa página, ficam de
 * fora até uma sincronização futura pegar (SERPRO devolve as mais recentes primeiro,
 * confirmado testando contra o trial) -- limitação conhecida do v1, não um bug.
 */
@Injectable()
export class SincronizarMensagensUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(VERIFICAR_ACESSO_SERPRO) private readonly verificarAcesso: VerificarAcessoSerproPort,
    @Inject(SERPRO_GATEWAY) private readonly gateway: SerproGatewayPort,
    @Inject(CONSULTAS_SERPRO_REPOSITORIO) private readonly consultasRepositorio: ConsultasSerproRepositorioPort,
    @Inject(MENSAGENS_CAIXA_POSTAL_REPOSITORIO)
    private readonly mensagensRepositorio: MensagensCaixaPostalRepositorioPort,
    private readonly debitarCreditos: DebitarCreditosUseCase,
    private readonly estornarCreditos: EstornarCreditosUseCase,
  ) {}

  async executar(empresaId: string): Promise<{ sincronizadas: number }> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new ForbiddenException('Empresa não encontrada');
    }

    const acesso = await this.verificarAcesso.possuiAcessoValido(empresaId);
    if (!acesso.valido) {
      throw new ForbiddenException(acesso.motivo ?? 'Empresa sem acesso válido ao SERPRO');
    }

    await this.debitarCreditos.executar(
      empresa.contadorId,
      empresaId,
      CUSTO_OPERACAO,
      `Sincronizar Caixa Postal -- empresa ${empresaId}`,
    );

    let sucesso = false;
    let codigoErro: string | null = null;
    let mensagens: MensagemSerpro[] = [];

    try {
      const resposta = await this.gateway.consultar({
        idSistema: ID_SISTEMA_CAIXA_POSTAL,
        idServico: ID_SERVICO_LISTA_MENSAGENS,
        contribuinteCnpj: empresa.cnpj,
        dados: JSON.stringify({ statusLeitura: '0', indicadorPagina: '0', ponteiroPagina: '00000000000000' }),
        // Só tem efeito em ambiente trial -- esse cenário de demonstração específico do
        // SERPRO exige 99999999999999, diferente do padrão (dominio/serpro.ts explica o porquê).
        documentoTrial: '99999999999999',
      });
      sucesso = resposta.sucesso;
      if (sucesso) {
        mensagens = this.extrairListaMensagens(resposta.corpo);
      } else {
        codigoErro = `HTTP_${resposta.statusHttp}`;
      }
    } catch {
      codigoErro = 'ERRO_COMUNICACAO';
    }

    if (!sucesso) {
      await this.estornarCreditos.executar(
        empresa.contadorId,
        custoDaOperacao(CUSTO_OPERACAO),
        `Sincronizar Caixa Postal falhou (${codigoErro})`,
      );
    }

    await this.consultasRepositorio.registrar({
      contadorId: empresa.contadorId,
      empresaId,
      idSistema: ID_SISTEMA_CAIXA_POSTAL,
      idServico: ID_SERVICO_LISTA_MENSAGENS,
      sucesso,
      codigoErro,
      creditosConsumidos: sucesso ? custoDaOperacao(CUSTO_OPERACAO) : 0,
    });

    if (!sucesso) {
      throw new InternalServerErrorException('Não foi possível sincronizar o Caixa Postal no momento');
    }

    let sincronizadas = 0;
    for (const mensagem of mensagens) {
      const inserida = await this.mensagensRepositorio.inserirSeNovo({
        empresaId,
        serproIsn: mensagem.isn,
        orgao: mensagem.descricaoOrigem?.trim() || 'RECEITA FEDERAL DO BRASIL',
        assunto: mensagem.assuntoModelo,
        dataRecebimento: converterDataHoraSerpro(mensagem.dataEnvio, mensagem.horaEnvio),
      });
      if (inserida) sincronizadas++;
    }

    return { sincronizadas };
  }

  /**
   * `corpo.dados` é uma STRING contendo JSON aninhado (confirmado testando contra o
   * trial: `{"dados":"{\"codigo\":\"00\",\"conteudo\":[{...,\"listaMensagens\":[...]}]}"}`)
   * -- não é um objeto direto, precisa de um segundo JSON.parse.
   */
  private extrairListaMensagens(corpo: unknown): MensagemSerpro[] {
    try {
      const corpoObj = corpo as { dados?: string };
      if (!corpoObj?.dados) return [];
      const parsed = JSON.parse(corpoObj.dados) as { conteudo?: Array<{ listaMensagens?: MensagemSerpro[] }> };
      return parsed.conteudo?.[0]?.listaMensagens ?? [];
    } catch {
      return [];
    }
  }
}
