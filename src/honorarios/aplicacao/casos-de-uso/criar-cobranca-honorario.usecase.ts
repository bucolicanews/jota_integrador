import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CONTADORES_REPOSITORIO,
  ContadoresRepositorioPort,
} from '../../../contadores/aplicacao/portas/contadores-repositorio.port';
import {
  EMPRESAS_REPOSITORIO,
  EmpresasRepositorioPort,
} from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { validarValorCobranca } from '../../dominio/cobranca-honorario';
import { StripeHonorariosService } from '../../infraestrutura/stripe-honorarios.service';
import {
  CobrancaHonorario,
  COBRANCAS_HONORARIOS_REPOSITORIO,
  CobrancasHonorariosRepositorioPort,
} from '../portas/cobrancas-honorarios-repositorio.port';

export interface DadosCriarCobranca {
  contadorId: string;
  empresaId: string;
  descricao: string;
  valor: number;
  successUrl: string;
  cancelUrl: string;
}

@Injectable()
export class CriarCobrancaHonorarioUseCase {
  private readonly logger = new Logger(CriarCobrancaHonorarioUseCase.name);

  constructor(
    @Inject(CONTADORES_REPOSITORIO) private readonly contadoresRepositorio: ContadoresRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(COBRANCAS_HONORARIOS_REPOSITORIO)
    private readonly cobrancasRepositorio: CobrancasHonorariosRepositorioPort,
    private readonly stripe: StripeHonorariosService,
  ) {}

  async executar(dados: DadosCriarCobranca): Promise<{ url: string; cobranca: CobrancaHonorario }> {
    try {
      validarValorCobranca(dados.valor);
    } catch (erro) {
      throw new BadRequestException((erro as Error).message);
    }

    const contador = await this.contadoresRepositorio.buscarPorId(dados.contadorId);
    if (!contador) {
      throw new NotFoundException('Contador não encontrado');
    }

    // Isolamento obrigatório antes de qualquer PaymentIntent (docs/SEGURANCA.md §7) --
    // duplicando aqui o que `valida_posse_cobranca_honorario` já garante no banco
    // (defesa em profundidade, mesma regra de Zero Trust do resto do projeto).
    const pertenceACarteira = await this.empresasRepositorio.pertenceAoContador(dados.empresaId, dados.contadorId);
    if (!pertenceACarteira) {
      throw new ForbiddenException('Esta empresa não pertence à carteira deste contador');
    }

    // Nunca mostrar opção de pagamento se a conta do contador não pode receber ainda
    // (docs/SEGURANCA.md §7: gating no backend, não só no frontend).
    if (!contador.stripeChargesEnabled || !contador.stripeAccountId) {
      throw new BadRequestException('Este contador ainda não concluiu o cadastro de recebimento -- cobrança indisponível');
    }

    // Comissão é calculada pelo trigger do banco (definir_comissao_honorario), a partir
    // da config global -- nunca aceita do cliente nem calculada aqui.
    const cobranca = await this.cobrancasRepositorio.criar({
      contadorId: dados.contadorId,
      empresaId: dados.empresaId,
      descricao: dados.descricao,
      valor: dados.valor,
    });

    try {
      const { url } = await this.stripe.criarCheckoutSession({
        contadorStripeAccountId: contador.stripeAccountId,
        cobrancaId: cobranca.id,
        descricao: dados.descricao,
        valorReais: cobranca.valor,
        comissaoValorReais: cobranca.comissaoValor,
        successUrl: dados.successUrl,
        cancelUrl: dados.cancelUrl,
      });
      return { url, cobranca };
    } catch (erro) {
      // Não vaza erro bruto da Stripe (mesma regra de SERPRO/assinaturas) -- a cobrança
      // fica registrada como 'pendente' (não removida) pra não perder o registro; um
      // novo checkout pode ser gerado depois pra essa mesma cobrança se necessário.
      this.logger.error(`Falha ao criar checkout de honorário (cobrança=${cobranca.id}): ${(erro as Error).message}`);
      throw new InternalServerErrorException('Não foi possível iniciar o pagamento -- tente novamente em instantes');
    }
  }
}
