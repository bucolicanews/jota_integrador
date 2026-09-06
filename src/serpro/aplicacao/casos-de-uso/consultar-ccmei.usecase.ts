import { ForbiddenException, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { custoDaOperacao } from '../../../creditos/dominio/credito';
import { DebitarCreditosUseCase } from '../../../creditos/aplicacao/casos-de-uso/debitar-creditos.usecase';
import { EstornarCreditosUseCase } from '../../../creditos/aplicacao/casos-de-uso/estornar-creditos.usecase';
import {
  EMPRESAS_REPOSITORIO,
  EmpresasRepositorioPort,
} from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import {
  CONSULTAS_SERPRO_REPOSITORIO,
  ConsultasSerproRepositorioPort,
} from '../portas/consultas-serpro-repositorio.port';
import { SERPRO_GATEWAY, SerproGatewayPort } from '../portas/serpro-gateway.port';
import {
  VERIFICAR_ACESSO_SERPRO,
  VerificarAcessoSerproPort,
} from '../portas/verificar-acesso-serpro.port';

const ID_SISTEMA_CCMEI = 'CCMEI';
const ID_SERVICO_DADOS_CCMEI = 'DADOSCCMEI122';

@Injectable()
export class ConsultarCcmeiUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(VERIFICAR_ACESSO_SERPRO) private readonly verificarAcesso: VerificarAcessoSerproPort,
    @Inject(SERPRO_GATEWAY) private readonly gateway: SerproGatewayPort,
    @Inject(CONSULTAS_SERPRO_REPOSITORIO) private readonly consultasRepositorio: ConsultasSerproRepositorioPort,
    private readonly debitarCreditos: DebitarCreditosUseCase,
    private readonly estornarCreditos: EstornarCreditosUseCase,
  ) {}

  async executar(empresaId: string): Promise<unknown> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new ForbiddenException('Empresa não encontrada');
    }

    // Nunca chamar o SERPRO sem checar procuração/certificado antes -- defesa em
    // profundidade, não confiar só na rejeição do próprio SERPRO (docs/SEGURANCA.md §2).
    const acesso = await this.verificarAcesso.possuiAcessoValido(empresaId);
    if (!acesso.valido) {
      throw new ForbiddenException(acesso.motivo ?? 'Empresa sem acesso válido ao SERPRO');
    }

    // Débito ANTES da chamada -- falha rápido (sem gastar cota do SERPRO) se o
    // contador não tem crédito. SaldoInsuficienteError sobe crua daqui -- convertida
    // pra HTTP 402 pelo filtro global (src/common/filtros/saldo-insuficiente.filter.ts).
    await this.debitarCreditos.executar(
      empresa.contadorId,
      empresaId,
      ID_SISTEMA_CCMEI,
      `Consulta CCMEI -- empresa ${empresaId}`,
    );

    let sucesso = false;
    let codigoErro: string | null = null;
    let corpoResposta: unknown;

    try {
      const resposta = await this.gateway.consultar({
        idSistema: ID_SISTEMA_CCMEI,
        idServico: ID_SERVICO_DADOS_CCMEI,
        contribuinteCnpj: empresa.cnpj,
      });
      sucesso = resposta.sucesso;
      corpoResposta = resposta.corpo;
      if (!sucesso) {
        codigoErro = `HTTP_${resposta.statusHttp}`;
      }
    } catch {
      codigoErro = 'ERRO_COMUNICACAO';
    }

    if (!sucesso) {
      // Compensação (saga, docs/SEGURANCA.md §6): SERPRO falhou depois do débito --
      // devolve o mesmo custo que foi debitado, nunca deixa o contador pagando por
      // uma consulta que não aconteceu.
      await this.estornarCreditos.executar(
        empresa.contadorId,
        custoDaOperacao(ID_SISTEMA_CCMEI),
        `Consulta CCMEI falhou (${codigoErro})`,
      );
    }

    await this.consultasRepositorio.registrar({
      contadorId: empresa.contadorId,
      empresaId,
      idSistema: ID_SISTEMA_CCMEI,
      idServico: ID_SERVICO_DADOS_CCMEI,
      sucesso,
      codigoErro,
      creditosConsumidos: sucesso ? custoDaOperacao(ID_SISTEMA_CCMEI) : 0,
    });

    if (!sucesso) {
      // Nunca vazar payload/erro bruto do SERPRO pro cliente (docs/SEGURANCA.md §3).
      throw new InternalServerErrorException('Não foi possível consultar o SERPRO no momento');
    }

    return corpoResposta;
  }
}
