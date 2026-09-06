import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Papel } from '../../dominio/papel';
import { CHAVE_PAPEIS } from '../decorators/papeis.decorator';
import { RequisicaoAutenticada } from '../tipos/requisicao-autenticada';

/** Roda depois do SupabaseAuthGuard (precisa de `req.usuario` já populado). */
@Injectable()
export class PapeisGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const papeisPermitidos = this.reflector.getAllAndOverride<Papel[] | undefined>(CHAVE_PAPEIS, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!papeisPermitidos || papeisPermitidos.length === 0) {
      return true; // rota sem @Papeis(...) -- só exige autenticação, não papel específico
    }

    const requisicao = context.switchToHttp().getRequest<RequisicaoAutenticada>();
    if (!papeisPermitidos.includes(requisicao.usuario.papel)) {
      throw new ForbiddenException('Sem permissão para este recurso');
    }

    return true;
  }
}
