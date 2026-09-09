import { Global, Module } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';

// @Global(): mesmo motivo do SupabaseModule -- vários módulos de domínio (certificados,
// procuracoes, e futuramente qualquer módulo que mute dado sensível) precisam gravar
// auditoria sem cada um reimportar explicitamente.
@Global()
@Module({
  providers: [AuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
