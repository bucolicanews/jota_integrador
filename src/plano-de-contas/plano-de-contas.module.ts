import { Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module';
import { AlterarAtivaContaContabilUseCase } from './aplicacao/casos-de-uso/alterar-ativa-conta-contabil.usecase';
import { AtualizarContaContabilUseCase } from './aplicacao/casos-de-uso/atualizar-conta-contabil.usecase';
import { CriarContaContabilUseCase } from './aplicacao/casos-de-uso/criar-conta-contabil.usecase';
import { ListarContasContabeisUseCase } from './aplicacao/casos-de-uso/listar-contas-contabeis.usecase';
import { PLANO_CONTAS_REPOSITORIO } from './aplicacao/portas/plano-contas-repositorio.port';
import { PlanoContasController } from './apresentacao/plano-contas.controller';
import { PlanoContasRepositorioSupabase } from './infraestrutura/plano-contas.repositorio.supabase';

@Module({
  imports: [EmpresasModule],
  controllers: [PlanoContasController],
  providers: [
    { provide: PLANO_CONTAS_REPOSITORIO, useClass: PlanoContasRepositorioSupabase },
    CriarContaContabilUseCase,
    ListarContasContabeisUseCase,
    AtualizarContaContabilUseCase,
    AlterarAtivaContaContabilUseCase,
  ],
  exports: [PLANO_CONTAS_REPOSITORIO],
})
export class PlanoDeContasModule {}
