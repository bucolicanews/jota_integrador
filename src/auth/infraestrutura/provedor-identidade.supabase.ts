import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  ClaimsIdentidade,
  IdentidadeValidada,
  ProvedorIdentidadePort,
} from '../aplicacao/portas/provedor-identidade.port';
import { Papel } from '../dominio/papel';

// "876000h" (~100 anos) -- mesmo valor usado no ban nativo do DeliveryHub
// (/admin/usuarios), efetivamente permanente até alguém desbloquear explicitamente.
const DURACAO_BLOQUEIO_PERMANENTE = '876000h';
const DURACAO_SEM_BLOQUEIO = 'none';

@Injectable()
export class ProvedorIdentidadeSupabase implements ProvedorIdentidadePort {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  async criarUsuarioComConvite(email: string): Promise<string> {
    const { data, error } = await this.supabase.admin.auth.admin.inviteUserByEmail(email);

    if (error || !data.user) {
      throw new InternalServerErrorException(`Falha ao convidar usuário: ${error?.message}`);
    }

    return data.user.id;
  }

  async sincronizarClaims(id: string, claims: ClaimsIdentidade): Promise<void> {
    const { error } = await this.supabase.admin.auth.admin.updateUserById(id, {
      app_metadata: {
        papel: claims.papel,
        contador_id: claims.contadorId,
        empresa_id: claims.empresaId,
      },
    });

    if (error) {
      throw new InternalServerErrorException(`Falha ao sincronizar claims: ${error.message}`);
    }
  }

  async bloquearAcesso(id: string): Promise<void> {
    const { error } = await this.supabase.admin.auth.admin.updateUserById(id, {
      ban_duration: DURACAO_BLOQUEIO_PERMANENTE,
    });
    if (error) {
      throw new InternalServerErrorException(`Falha ao bloquear acesso: ${error.message}`);
    }
  }

  async desbloquearAcesso(id: string): Promise<void> {
    const { error } = await this.supabase.admin.auth.admin.updateUserById(id, {
      ban_duration: DURACAO_SEM_BLOQUEIO,
    });
    if (error) {
      throw new InternalServerErrorException(`Falha ao desbloquear acesso: ${error.message}`);
    }
  }

  async revogarSessoes(id: string): Promise<void> {
    // NOTA: `@supabase/supabase-js` não expõe um método de conveniência pra "logout
    // global por id de usuário" (o `auth.admin.signOut` da SDK opera sobre um JWT
    // específico, não um id) -- chamando o endpoint GoTrue direto. Verificar contra a
    // versão do Supabase em uso antes de depender disso em produção (endpoint pode
    // mudar entre versões do GoTrue).
    const resposta = await fetch(
      `${this.config.getOrThrow<string>('SUPABASE_URL')}/auth/v1/admin/users/${id}/logout`,
      {
        method: 'POST',
        headers: {
          apikey: this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
          Authorization: `Bearer ${this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
      },
    );

    if (!resposta.ok) {
      throw new InternalServerErrorException(
        `Falha ao revogar sessões (status ${resposta.status}): ${await resposta.text()}`,
      );
    }
  }

  async validarToken(token: string): Promise<IdentidadeValidada> {
    const { data, error } = await this.supabase.client.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    const metadata = data.user.app_metadata as {
      papel?: Papel;
      contador_id?: string | null;
      empresa_id?: string | null;
    };

    if (!metadata.papel) {
      // Usuário existe no Auth mas nunca teve claims sincronizados (ex: convite aceito
      // mas CriarUsuarioUseCase falhou no meio) -- não deixar passar sem papel definido,
      // nenhuma policy de RLS reconheceria esse usuário como pertencente a nada.
      throw new UnauthorizedException('Usuário sem papel definido -- contate o suporte');
    }

    return {
      id: data.user.id,
      papel: metadata.papel,
      contadorId: metadata.contador_id ?? null,
      empresaId: metadata.empresa_id ?? null,
    };
  }
}
