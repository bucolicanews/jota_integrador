import { Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module';
import { AtualizarStatusProcuracaoUseCase } from './aplicacao/casos-de-uso/atualizar-status-procuracao.usecase';
import { ObterProcuracaoUseCase } from './aplicacao/casos-de-uso/obter-procuracao.usecase';
import { PROCURACOES_REPOSITORIO } from './aplicacao/portas/procuracoes-repositorio.port';
import { ProcuracoesController } from './apresentacao/procuracoes.controller';
import { ProcuracoesRepositorioSupabase } from './infraestrutura/procuracoes.repositorio.supabase';

@Module({
  // EmpresasModule pra checagem de posse (EMPRESAS_REPOSITORIO), mesmo padrão do SerproModule.
  imports: [EmpresasModule],
  controllers: [ProcuracoesController],
  providers: [
    { provide: PROCURACOES_REPOSITORIO, useClass: ProcuracoesRepositorioSupabase },
    ObterProcuracaoUseCase,
    AtualizarStatusProcuracaoUseCase,
  ],
})
export class ProcuracoesModule {}
