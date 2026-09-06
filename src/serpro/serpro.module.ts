import { Module } from '@nestjs/common';
import { CreditosModule } from '../creditos/creditos.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { ConsultarCcmeiUseCase } from './aplicacao/casos-de-uso/consultar-ccmei.usecase';
import { CONSULTAS_SERPRO_REPOSITORIO } from './aplicacao/portas/consultas-serpro-repositorio.port';
import { SERPRO_GATEWAY } from './aplicacao/portas/serpro-gateway.port';
import { VERIFICAR_ACESSO_SERPRO } from './aplicacao/portas/verificar-acesso-serpro.port';
import { SerproController } from './apresentacao/serpro.controller';
import { ConsultasSerproRepositorioSupabase } from './infraestrutura/consultas-serpro.repositorio.supabase';
import { SerproAuthService } from './infraestrutura/serpro-auth.service';
import { SerproGatewayHttp } from './infraestrutura/serpro-gateway.http';
import { VerificarAcessoSerproSupabase } from './infraestrutura/verificar-acesso-serpro.supabase';

@Module({
  imports: [
    EmpresasModule, // EMPRESAS_REPOSITORIO -- resolver CNPJ/contadorId da empresa consultada
    CreditosModule, // DebitarCreditosUseCase/EstornarCreditosUseCase -- pagar pela consulta
  ],
  controllers: [SerproController],
  providers: [
    SerproAuthService,
    { provide: SERPRO_GATEWAY, useClass: SerproGatewayHttp },
    { provide: VERIFICAR_ACESSO_SERPRO, useClass: VerificarAcessoSerproSupabase },
    { provide: CONSULTAS_SERPRO_REPOSITORIO, useClass: ConsultasSerproRepositorioSupabase },
    ConsultarCcmeiUseCase,
  ],
})
export class SerproModule {}
