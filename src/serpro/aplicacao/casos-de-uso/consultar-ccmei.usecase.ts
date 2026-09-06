import { ForbiddenException, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
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
    } finally {
      // Registrar mesmo em falha -- log de auditoria não pode ficar incompleto por
      // causa de exceção (docs/BANCO_DE_DADOS.md §4).
      await this.consultasRepositorio.registrar({
        contadorId: empresa.contadorId,
        empresaId,
        idSistema: ID_SISTEMA_CCMEI,
        idServico: ID_SERVICO_DADOS_CCMEI,
        sucesso,
        codigoErro,
        // TODO: módulo de créditos ainda não existe -- consumo fica em 0 até existir
        // (docs/BANCO_DE_DADOS.md §Pendências).
        creditosConsumidos: 0,
      });
    }

    if (!sucesso) {
      // Nunca vazar payload/erro bruto do SERPRO pro cliente (docs/SEGURANCA.md §3).
      throw new InternalServerErrorException('Não foi possível consultar o SERPRO no momento');
    }

    return corpoResposta;
  }
}
