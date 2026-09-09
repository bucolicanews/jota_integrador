import { Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module';
import { CadastrarOuRotacionarCertificadoUseCase } from './aplicacao/casos-de-uso/cadastrar-ou-rotacionar-certificado.usecase';
import { ListarCertificadosUseCase } from './aplicacao/casos-de-uso/listar-certificados.usecase';
import { RevogarCertificadoUseCase } from './aplicacao/casos-de-uso/revogar-certificado.usecase';
import { CERTIFICADOS_REPOSITORIO } from './aplicacao/portas/certificados-repositorio.port';
import { CertificadosController } from './apresentacao/certificados.controller';
import { CertificadosRepositorioSupabase } from './infraestrutura/certificados.repositorio.supabase';

@Module({
  // EmpresasModule pra checagem de posse (EMPRESAS_REPOSITORIO), mesmo padrão do SerproModule.
  // CofreModule e AuditoriaModule são @Global(), não precisam ser importados aqui.
  imports: [EmpresasModule],
  controllers: [CertificadosController],
  providers: [
    { provide: CERTIFICADOS_REPOSITORIO, useClass: CertificadosRepositorioSupabase },
    CadastrarOuRotacionarCertificadoUseCase,
    ListarCertificadosUseCase,
    RevogarCertificadoUseCase,
  ],
  // Exportado pra quando o caminho de autenticação Modo B do SerproModule for implementado
  // (precisará de buscarRefsAtivoPorEmpresa + CofreCertificadosService.recuperar).
  exports: [CERTIFICADOS_REPOSITORIO],
})
export class CertificadosModule {}
