import { Global, Module } from '@nestjs/common';
import { AtualizarPapelUsuarioUseCase } from './aplicacao/casos-de-uso/atualizar-papel-usuario.usecase';
import { BloquearUsuarioUseCase } from './aplicacao/casos-de-uso/bloquear-usuario.usecase';
import { CriarUsuarioUseCase } from './aplicacao/casos-de-uso/criar-usuario.usecase';
import { DesbloquearUsuarioUseCase } from './aplicacao/casos-de-uso/desbloquear-usuario.usecase';
import { LogoutGlobalUseCase } from './aplicacao/casos-de-uso/logout-global.usecase';
import { ObterPerfilUseCase } from './aplicacao/casos-de-uso/obter-perfil.usecase';
import { PROVEDOR_IDENTIDADE } from './aplicacao/portas/provedor-identidade.port';
import { USUARIOS_REPOSITORIO } from './aplicacao/portas/usuarios-repositorio.port';
import { AuthController } from './apresentacao/auth.controller';
import { PapeisGuard } from './apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from './apresentacao/guards/supabase-auth.guard';
import { ProvedorIdentidadeSupabase } from './infraestrutura/provedor-identidade.supabase';
import { UsuariosRepositorioSupabase } from './infraestrutura/usuarios.repositorio.supabase';

// @Global(): SupabaseAuthGuard/PapeisGuard vão proteger rotas de outros módulos
// (empresas, certificados, etc. -- ainda não existem, mas vão existir). Sem @Global(),
// cada módulo novo precisaria importar AuthModule explicitamente, e esquecer um só
// quebra a resolução de DI em runtime (mesmo gotcha já documentado no DeliveryHub para
// guard/interceptor compartilhado -- ver [[project_deliveryhub]] na memória).
@Global()
@Module({
  controllers: [AuthController],
  providers: [
    { provide: USUARIOS_REPOSITORIO, useClass: UsuariosRepositorioSupabase },
    { provide: PROVEDOR_IDENTIDADE, useClass: ProvedorIdentidadeSupabase },
    CriarUsuarioUseCase,
    AtualizarPapelUsuarioUseCase,
    BloquearUsuarioUseCase,
    DesbloquearUsuarioUseCase,
    ObterPerfilUseCase,
    LogoutGlobalUseCase,
    SupabaseAuthGuard,
    PapeisGuard,
  ],
  exports: [SupabaseAuthGuard, PapeisGuard, PROVEDOR_IDENTIDADE, USUARIOS_REPOSITORIO],
})
export class AuthModule {}
