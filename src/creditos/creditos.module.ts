import { Module } from '@nestjs/common';
import { CreditarCreditosUseCase } from './aplicacao/casos-de-uso/creditar-creditos.usecase';
import { DebitarCreditosUseCase } from './aplicacao/casos-de-uso/debitar-creditos.usecase';
import { EstornarCreditosUseCase } from './aplicacao/casos-de-uso/estornar-creditos.usecase';
import { ListarMovimentosUseCase } from './aplicacao/casos-de-uso/listar-movimentos.usecase';
import { ObterSaldoUseCase } from './aplicacao/casos-de-uso/obter-saldo.usecase';
import { CREDITOS_REPOSITORIO } from './aplicacao/portas/creditos-repositorio.port';
import { CreditosController } from './apresentacao/creditos.controller';
import { CreditosRepositorioSupabase } from './infraestrutura/creditos.repositorio.supabase';

@Module({
  controllers: [CreditosController],
  providers: [
    { provide: CREDITOS_REPOSITORIO, useClass: CreditosRepositorioSupabase },
    ObterSaldoUseCase,
    ListarMovimentosUseCase,
    DebitarCreditosUseCase,
    CreditarCreditosUseCase,
    EstornarCreditosUseCase,
  ],
  // DebitarCreditosUseCase/EstornarCreditosUseCase são consumidos por outros módulos
  // (ex: serpro/, ao pagar por uma consulta real) -- exportar os casos de uso aqui
  // (não só o token do repositório) porque eles carregam a regra de custo por operação
  // (docs/creditos/dominio/credito.ts), não é só um CRUD que outro módulo reimplementaria.
  // CreditarCreditosUseCase também exportado -- assinaturas/ usa pra creditar
  // automaticamente na renovação (webhook Stripe), mesmo caso de uso do ajuste manual.
  exports: [CREDITOS_REPOSITORIO, DebitarCreditosUseCase, EstornarCreditosUseCase, CreditarCreditosUseCase],
})
export class CreditosModule {}
