import { Global, Module } from '@nestjs/common';
import { CofreCertificadosService } from './cofre-certificados.service';
import { CofreCriptografiaService } from './cofre-criptografia.service';

// @Global(): mesmo motivo do SupabaseModule -- CertificadosModule (e futuramente o
// caminho de autenticação Modo B dentro de SerproModule) precisam do cofre sem cada um
// ter que reimportar explicitamente.
@Global()
@Module({
  providers: [CofreCriptografiaService, CofreCertificadosService],
  exports: [CofreCriptografiaService, CofreCertificadosService],
})
export class CofreModule {}
