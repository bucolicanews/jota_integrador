import {
  BadRequestException,
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
import { StripeAssinaturasService } from '../../infraestrutura/stripe-assinaturas.service';
import { ASSINATURAS_REPOSITORIO, AssinaturasRepositorioPort } from '../portas/assinaturas-repositorio.port';
import { PLANOS_REPOSITORIO, PlanosRepositorioPort } from '../portas/planos-repositorio.port';

export interface DadosCheckout {
  contadorId: string;
  planoId: string;
  successUrl: string;
  cancelUrl: string;
}

@Injectable()
export class IniciarCheckoutAssinaturaUseCase {
  private readonly logger = new Logger(IniciarCheckoutAssinaturaUseCase.name);

  constructor(
    @Inject(CONTADORES_REPOSITORIO) private readonly contadoresRepositorio: ContadoresRepositorioPort,
    @Inject(PLANOS_REPOSITORIO) private readonly planosRepositorio: PlanosRepositorioPort,
    @Inject(ASSINATURAS_REPOSITORIO) private readonly assinaturasRepositorio: AssinaturasRepositorioPort,
    private readonly stripe: StripeAssinaturasService,
  ) {}

  async executar(dados: DadosCheckout): Promise<{ url: string }> {
    const contador = await this.contadoresRepositorio.buscarPorId(dados.contadorId);
    if (!contador) {
      throw new NotFoundException('Contador não encontrado');
    }

    const plano = await this.planosRepositorio.buscarPorId(dados.planoId);
    if (!plano || !plano.ativo) {
      throw new NotFoundException('Plano não encontrado ou não está mais disponível');
    }

    // v1 não suporta troca direta de plano nem múltiplas assinaturas simultâneas --
    // quem já tem assinatura ativa precisa cancelar antes de assinar outra (upgrade/
    // downgrade com proração fica pra quando houver demanda real).
    const assinaturaAtiva = await this.assinaturasRepositorio.buscarAtivaPorContador(dados.contadorId);
    if (assinaturaAtiva) {
      throw new BadRequestException('Contador já tem uma assinatura ativa -- cancele antes de assinar outro plano');
    }

    try {
      let stripeCustomerId = contador.stripeCustomerId;
      if (!stripeCustomerId) {
        stripeCustomerId = await this.stripe.obterOuCriarCustomer(contador.id, contador.email, contador.nome);
        await this.contadoresRepositorio.atualizarStripeCustomerId(contador.id, stripeCustomerId);
      }

      return await this.stripe.criarCheckoutSession({
        customerId: stripeCustomerId,
        contadorId: contador.id,
        planoId: plano.id,
        planoNome: plano.nome,
        precoReais: plano.preco,
        periodicidade: plano.periodicidade,
        successUrl: dados.successUrl,
        cancelUrl: dados.cancelUrl,
      });
    } catch (erro) {
      // Nunca vazar erro bruto da Stripe pro cliente (mesma regra de docs/SEGURANCA.md
      // §3 pro SERPRO) -- log completo aqui, mensagem genérica na resposta.
      this.logger.error(`Falha ao iniciar checkout Stripe (contador=${contador.id}, plano=${plano.id}): ${(erro as Error).message}`);
      throw new InternalServerErrorException('Não foi possível iniciar o checkout de pagamento -- tente novamente em instantes');
    }
  }
}
