import { Module } from '@nestjs/common';
import { AtualizarEmpresaUseCase } from './aplicacao/casos-de-uso/atualizar-empresa.usecase';
import { AtualizarModoAcessoSerproUseCase } from './aplicacao/casos-de-uso/atualizar-modo-acesso-serpro.usecase';
import { BloquearEmpresaUseCase } from './aplicacao/casos-de-uso/bloquear-empresa.usecase';
import { CriarEmpresaUseCase } from './aplicacao/casos-de-uso/criar-empresa.usecase';
import { DesbloquearEmpresaUseCase } from './aplicacao/casos-de-uso/desbloquear-empresa.usecase';
import { ListarEmpresasUseCase } from './aplicacao/casos-de-uso/listar-empresas.usecase';
import { ObterEmpresaUseCase } from './aplicacao/casos-de-uso/obter-empresa.usecase';
import { EMPRESAS_REPOSITORIO } from './aplicacao/portas/empresas-repositorio.port';
import { EmpresasController } from './apresentacao/empresas.controller';
import { EmpresasRepositorioSupabase } from './infraestrutura/empresas.repositorio.supabase';

@Module({
  controllers: [EmpresasController],
  providers: [
    { provide: EMPRESAS_REPOSITORIO, useClass: EmpresasRepositorioSupabase },
    CriarEmpresaUseCase,
    ListarEmpresasUseCase,
    ObterEmpresaUseCase,
    AtualizarEmpresaUseCase,
    AtualizarModoAcessoSerproUseCase,
    BloquearEmpresaUseCase,
    DesbloquearEmpresaUseCase,
  ],
  // Exportado pra AuthModule resolver a checagem de posse ao criar EMPRESARIO_DONO/
  // OPERADOR_EMPRESA pra uma empresa da carteira do contador (limitação v1 documentada
  // em AuthController -- ver commit do módulo de autenticação).
  exports: [EMPRESAS_REPOSITORIO],
})
export class EmpresasModule {}
