import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  PROVEDOR_IDENTIDADE,
  ProvedorIdentidadePort,
} from '../../aplicacao/portas/provedor-identidade.port';
import { RequisicaoAutenticada } from '../tipos/requisicao-autenticada';

/**
 * Valida o JWT do Supabase Auth em toda rota protegida e popula `req.usuario` com
 * id/papel/contador_id/empresa_id -- lidos direto do app_metadata do token, sem
 * consultar o banco (docs/ARQUITETURA.md, docs/BANCO_DE_DADOS.md §1).
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    @Inject(PROVEDOR_IDENTIDADE) private readonly provedorIdentidade: ProvedorIdentidadePort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requisicao = context.switchToHttp().getRequest<RequisicaoAutenticada>();
    const token = this.extrairToken(requisicao);

    if (!token) {
      throw new UnauthorizedException('Token de autenticação ausente');
    }

    requisicao.usuario = await this.provedorIdentidade.validarToken(token);
    return true;
  }

  private extrairToken(requisicao: RequisicaoAutenticada): string | null {
    const cabecalho = requisicao.headers.authorization;
    if (!cabecalho?.startsWith('Bearer ')) {
      return null;
    }
    return cabecalho.slice('Bearer '.length).trim() || null;
  }
}
