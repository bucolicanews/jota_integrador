import { Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module';
import { ListarLogsAuditoriaUseCase } from './aplicacao/casos-de-uso/listar-logs-auditoria.usecase';
import { LOGS_AUDITORIA_REPOSITORIO } from './aplicacao/portas/logs-auditoria-repositorio.port';
import { AuditoriaController } from './apresentacao/auditoria.controller';
import { LogsAuditoriaRepositorioSupabase } from './infraestrutura/logs-auditoria.repositorio.supabase';

// Nome diferente de common/auditoria/ (AuditoriaModule, @Global(), só escrita via
// AuditoriaService) de propósito -- este é o lado de LEITURA, feature slice completa
// (controller + use case + repositório), não infra cross-cutting. Os dois nomes
// coincidirem seria confuso; renomeado para AuditoriaLogsModule no import do AppModule.
@Module({
  imports: [EmpresasModule], // EMPRESAS_REPOSITORIO -- resolver empresas da carteira do contador (escopo de acesso)
  controllers: [AuditoriaController],
  providers: [
    { provide: LOGS_AUDITORIA_REPOSITORIO, useClass: LogsAuditoriaRepositorioSupabase },
    ListarLogsAuditoriaUseCase,
  ],
})
export class AuditoriaLogsModule {}
