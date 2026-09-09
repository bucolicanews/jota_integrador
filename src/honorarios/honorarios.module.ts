import { Module } from '@nestjs/common';
import { ContadoresModule } from '../contadores/contadores.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { CriarCobrancaHonorarioUseCase } from './aplicacao/casos-de-uso/criar-cobranca-honorario.usecase';
import { GerenciarComissaoPlataformaUseCase } from './aplicacao/casos-de-uso/gerenciar-comissao-plataforma.usecase';
import { IniciarOnboardingStripeConnectUseCase } from './aplicacao/casos-de-uso/iniciar-onboarding-stripe-connect.usecase';
import { ListarCobrancasHonorarioUseCase } from './aplicacao/casos-de-uso/listar-cobrancas-honorario.usecase';
import { ProcessarWebhookStripeHonorarioUseCase } from './aplicacao/casos-de-uso/processar-webhook-stripe-honorario.usecase';
import { COBRANCAS_HONORARIOS_REPOSITORIO } from './aplicacao/portas/cobrancas-honorarios-repositorio.port';
import { CONFIGURACAO_PLATAFORMA_REPOSITORIO } from './aplicacao/portas/configuracao-plataforma-repositorio.port';
import { ConfiguracaoPlataformaController } from './apresentacao/configuracao-plataforma.controller';
import { HonorariosController } from './apresentacao/honorarios.controller';
import { StripeConnectController } from './apresentacao/stripe-connect.controller';
import { WebhookHonorariosController } from './apresentacao/webhook-honorarios.controller';
import { CobrancasHonorariosRepositorioSupabase } from './infraestrutura/cobrancas-honorarios.repositorio.supabase';
import { ConfiguracaoPlataformaRepositorioSupabase } from './infraestrutura/configuracao-plataforma.repositorio.supabase';
import { StripeHonorariosService } from './infraestrutura/stripe-honorarios.service';

@Module({
  // ContadoresModule (CONTADORES_REPOSITORIO) -- onboarding Connect, gating de charges_enabled.
  // EmpresasModule (EMPRESAS_REPOSITORIO) -- checagem de posse (empresa pertence à carteira).
  imports: [ContadoresModule, EmpresasModule],
  controllers: [
    StripeConnectController,
    HonorariosController,
    ConfiguracaoPlataformaController,
    WebhookHonorariosController,
  ],
  providers: [
    { provide: COBRANCAS_HONORARIOS_REPOSITORIO, useClass: CobrancasHonorariosRepositorioSupabase },
    { provide: CONFIGURACAO_PLATAFORMA_REPOSITORIO, useClass: ConfiguracaoPlataformaRepositorioSupabase },
    StripeHonorariosService,
    IniciarOnboardingStripeConnectUseCase,
    CriarCobrancaHonorarioUseCase,
    ListarCobrancasHonorarioUseCase,
    GerenciarComissaoPlataformaUseCase,
    ProcessarWebhookStripeHonorarioUseCase,
  ],
})
export class HonorariosModule {}
