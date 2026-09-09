import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { validate } from './common/config/env.validation';
import { SupabaseModule } from './common/supabase/supabase.module';
import { AuditoriaModule } from './common/auditoria/auditoria.module';
import { CofreModule } from './common/cofre/cofre.module';
import { AuthModule } from './auth/auth.module';
import { EmpresasModule } from './empresas/empresas.module';
import { ContadoresModule } from './contadores/contadores.module';
import { SerproModule } from './serpro/serpro.module';
import { CreditosModule } from './creditos/creditos.module';
import { ProcuracoesModule } from './procuracoes/procuracoes.module';
import { CertificadosModule } from './certificados/certificados.module';
import { AssinaturasModule } from './assinaturas/assinaturas.module';
import { HonorariosModule } from './honorarios/honorarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      // `.env.local`, não `.env` -- o `.env` da raiz do repo tem notas do SERPRO (não é
      // config da aplicação, quebraria o parser aqui do mesmo jeito que quebrou o
      // Supabase CLI). Ver docs/SEGURANCA.md.
      envFilePath: '.env.local',
    }),
    // Rate limit geral da API -- 100 requisições/minuto (docs/SEGURANCA.md, POLITICAS.md
    // §13). Login em si não passa por aqui (ver nota em docs/SEGURANCA.md §8) -- isso
    // cobre os endpoints que o NestJS realmente expõe.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    SupabaseModule,
    AuditoriaModule,
    CofreModule,
    AuthModule,
    EmpresasModule,
    ContadoresModule,
    CreditosModule,
    SerproModule,
    ProcuracoesModule,
    CertificadosModule,
    AssinaturasModule,
    HonorariosModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
