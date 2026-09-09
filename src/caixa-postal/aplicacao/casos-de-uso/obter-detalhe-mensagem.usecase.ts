import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
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
import { substituirVariaveisCorpo } from '../../dominio/mensagem-caixa-postal';
import { StorageMensagensCaixaPostalService } from '../../infraestrutura/storage-mensagens-caixa-postal.service';
import {
  MENSAGENS_CAIXA_POSTAL_REPOSITORIO,
  MensagensCaixaPostalRepositorioPort,
} from '../portas/mensagens-caixa-postal-repositorio.port';

const ID_SISTEMA_CAIXA_POSTAL = 'CAIXAPOSTAL';
const ID_SERVICO_DETALHE = 'MSGDETALHAMENTO62';
const CUSTO_OPERACAO = 'CAIXA_POSTAL';

/** Busca lazy e cacheada: só chama o SERPRO (e debita crédito) na primeira vez que alguém abre a mensagem -- releituras vêm do storage, de graça. */
@Injectable()
export class ObterDetalheMensagemUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(VERIFICAR_ACESSO_SERPRO) private readonly verificarAcesso: VerificarAcessoSerproPort,
    @Inject(SERPRO_GATEWAY) private readonly gateway: SerproGatewayPort,
    @Inject(CONSULTAS_SERPRO_REPOSITORIO) private readonly consultasRepositorio: ConsultasSerproRepositorioPort,
    @Inject(MENSAGENS_CAIXA_POSTAL_REPOSITORIO)
    private readonly mensagensRepositorio: MensagensCaixaPostalRepositorioPort,
    private readonly storage: StorageMensagensCaixaPostalService,
    private readonly debitarCreditos: DebitarCreditosUseCase,
    private readonly estornarCreditos: EstornarCreditosUseCase,
  ) {}

  async executar(mensagemId: string): Promise<string> {
    const mensagem = await this.mensagensRepositorio.buscarPorId(mensagemId);
    if (!mensagem) {
      throw new NotFoundException('Mensagem não encontrada');
    }

    if (mensagem.conteudoRef) {
      return this.storage.recuperar(mensagem.conteudoRef);
    }

    const empresa = await this.empresasRepositorio.buscarPorId(mensagem.empresaId);
    if (!empresa) {
      throw new ForbiddenException('Empresa não encontrada');
    }

    const acesso = await this.verificarAcesso.possuiAcessoValido(mensagem.empresaId);
    if (!acesso.valido) {
      throw new ForbiddenException(acesso.motivo ?? 'Empresa sem acesso válido ao SERPRO');
    }

    await this.debitarCreditos.executar(
      empresa.contadorId,
      mensagem.empresaId,
      CUSTO_OPERACAO,
      `Detalhe de mensagem Caixa Postal ${mensagem.id}`,
    );

    let sucesso = false;
    let codigoErro: string | null = null;
    let conteudo = '';

    try {
      const resposta = await this.gateway.consultar({
        idSistema: ID_SISTEMA_CAIXA_POSTAL,
        idServico: ID_SERVICO_DETALHE,
        contribuinteCnpj: empresa.cnpj,
        dados: JSON.stringify({ isn: mensagem.serproIsn }),
      });
      sucesso = resposta.sucesso;
      if (sucesso) {
        conteudo = this.extrairConteudo(resposta.corpo);
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
        `Detalhe de mensagem Caixa Postal falhou (${codigoErro})`,
      );
    }

    await this.consultasRepositorio.registrar({
      contadorId: empresa.contadorId,
      empresaId: mensagem.empresaId,
      idSistema: ID_SISTEMA_CAIXA_POSTAL,
      idServico: ID_SERVICO_DETALHE,
      sucesso,
      codigoErro,
      creditosConsumidos: sucesso ? custoDaOperacao(CUSTO_OPERACAO) : 0,
    });

    if (!sucesso) {
      throw new InternalServerErrorException('Não foi possível obter o conteúdo da mensagem no momento');
    }

    const ref = await this.storage.armazenar(mensagem.empresaId, conteudo);
    await this.mensagensRepositorio.atualizarConteudoRef(mensagem.id, ref);

    return conteudo;
  }

  /**
   * `corpo.dados` também é string com JSON aninhado (mesmo formato de
   * SincronizarMensagensUseCase) -- `corpoModelo` tem placeholders `++N++` substituídos
   * por `variaveis[]` (confirmado testando contra o trial).
   */
  private extrairConteudo(corpo: unknown): string {
    const corpoObj = corpo as { dados?: string };
    if (!corpoObj?.dados) return '';
    const parsed = JSON.parse(corpoObj.dados) as {
      conteudo?: Array<{ corpoModelo?: string; variaveis?: string[] }>;
    };
    const item = parsed.conteudo?.[0];
    if (!item?.corpoModelo) return '';
    return substituirVariaveisCorpo(item.corpoModelo, item.variaveis ?? []);
  }
}
