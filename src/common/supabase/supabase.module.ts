import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

// @Global(): usado por guards compartilhados (SupabaseAuthGuard) fora deste módulo --
// sem @Global(), cada módulo consumidor teria que importar SupabaseModule explicitamente,
// e esquecer um só quebra a resolução de DI em runtime (mesmo gotcha já documentado no
// DeliveryHub: guard/interceptor compartilhado precisa que a dependência seja @Global()).
@Global()
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
