import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Dois clientes, propósitos diferentes -- nunca confundir:
// - `admin`: usa SUPABASE_SERVICE_ROLE_KEY, ignora RLS, só existe no backend (docs/SEGURANCA.md §3).
//   Único que pode chamar Admin API (criar usuário, atualizar app_metadata, ban/unban).
// - `client`: usa SUPABASE_ANON_KEY, respeita RLS -- usado só pra validar o JWT de um
//   usuário (`auth.getUser(token)`), nunca pra escrever dado de domínio no lugar do admin.
@Injectable()
export class SupabaseService {
  public readonly admin: SupabaseClient;
  public readonly client: SupabaseClient;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('SUPABASE_URL');

    this.admin = createClient(url, config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    this.client = createClient(url, config.getOrThrow<string>('SUPABASE_ANON_KEY'), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
}
