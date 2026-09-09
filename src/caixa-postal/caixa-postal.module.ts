import { Module } from '@nestjs/common';
import { CreditosModule } from '../creditos/creditos.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { SerproModule } from '../serpro/serpro.module';
import { ListarMensagensUseCase } from './aplicacao/casos-de-uso/listar-mensagens.usecase';
import { MarcarComoLidaUseCase } from './aplicacao/casos-de-uso/marcar-como-lida.usecase';
import { ObterDetalheMensagemUseCase } from './aplicacao/casos-de-uso/obter-detalhe-mensagem.usecase';
import { SincronizarMensagensUseCase } from './aplicacao/casos-de-uso/sincronizar-mensagens.usecase';
import { MENSAGENS_CAIXA_POSTAL_REPOSITORIO } from './aplicacao/portas/mensagens-caixa-postal-repositorio.port';
import { CaixaPostalController } from './apresentacao/caixa-postal.controller';
import { MensagensCaixaPostalRepositorioSupabase } from './infraestrutura/mensagens-caixa-postal.repositorio.supabase';
import { StorageMensagensCaixaPostalService } from './infraestrutura/storage-mensagens-caixa-postal.service';

@Module({
  // EmpresasModule -- posse. CreditosModule -- débito/estorno por consulta ao SERPRO.
  // SerproModule -- gateway HTTP, checagem de acesso (procuração/certificado) e log de
  // consultas, todos exportados de lá pra reusar aqui (mesma infra do módulo CCMEI).
  imports: [EmpresasModule, CreditosModule, SerproModule],
  controllers: [CaixaPostalController],
  providers: [
    { provide: MENSAGENS_CAIXA_POSTAL_REPOSITORIO, useClass: MensagensCaixaPostalRepositorioSupabase },
    StorageMensagensCaixaPostalService,
    SincronizarMensagensUseCase,
    ListarMensagensUseCase,
    ObterDetalheMensagemUseCase,
    MarcarComoLidaUseCase,
  ],
})
export class CaixaPostalModule {}
