import { Module } from '@nestjs/common';
import { ContadoresModule } from '../contadores/contadores.module';
import { CreditosModule } from '../creditos/creditos.module';
import { AtualizarPlanoUseCase } from './aplicacao/casos-de-uso/atualizar-plano.usecase';
import { CancelarAssinaturaUseCase } from './aplicacao/casos-de-uso/cancelar-assinatura.usecase';
import { CriarPlanoUseCase } from './aplicacao/casos-de-uso/criar-plano.usecase';
import { IniciarCheckoutAssinaturaUseCase } from './aplicacao/casos-de-uso/iniciar-checkout-assinatura.usecase';
import { ListarFaturasUseCase } from './aplicacao/casos-de-uso/listar-faturas.usecase';
import { ListarPlanosUseCase } from './aplicacao/casos-de-uso/listar-planos.usecase';
import { ObterAssinaturaAtualUseCase } from './aplicacao/casos-de-uso/obter-assinatura-atual.usecase';
import { ProcessarWebhookStripeAssinaturaUseCase } from './aplicacao/casos-de-uso/processar-webhook-stripe-assinatura.usecase';
import { ASSINATURAS_REPOSITORIO } from './aplicacao/portas/assinaturas-repositorio.port';
import { PLANOS_REPOSITORIO } from './aplicacao/portas/planos-repositorio.port';
import { AssinaturasController } from './apresentacao/assinaturas.controller';
import { PlanosController } from './apresentacao/planos.controller';
import { WebhookAssinaturasController } from './apresentacao/webhook-assinaturas.controller';
import { AssinaturasRepositorioSupabase } from './infraestrutura/assinaturas.repositorio.supabase';
import { PlanosRepositorioSupabase } from './infraestrutura/planos.repositorio.supabase';
import { StripeAssinaturasService } from './infraestrutura/stripe-assinaturas.service';

@Module({
  // ContadoresModule (CONTADORES_REPOSITORIO) -- resolver/atualizar stripe_customer_id.
  // CreditosModule (CreditarCreditosUseCase) -- creditar operações na renovação paga.
  imports: [ContadoresModule, CreditosModule],
  controllers: [PlanosController, AssinaturasController, WebhookAssinaturasController],
  providers: [
    { provide: PLANOS_REPOSITORIO, useClass: PlanosRepositorioSupabase },
    { provide: ASSINATURAS_REPOSITORIO, useClass: AssinaturasRepositorioSupabase },
    StripeAssinaturasService,
    CriarPlanoUseCase,
    ListarPlanosUseCase,
    AtualizarPlanoUseCase,
    ObterAssinaturaAtualUseCase,
    IniciarCheckoutAssinaturaUseCase,
    CancelarAssinaturaUseCase,
    ListarFaturasUseCase,
    ProcessarWebhookStripeAssinaturaUseCase,
  ],
})
export class AssinaturasModule {}
