import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequisicaoAutenticada, UsuarioAutenticado } from '../tipos/requisicao-autenticada';

export const UsuarioAtual = createParamDecorator(
  (_dados: unknown, context: ExecutionContext): UsuarioAutenticado => {
    const requisicao = context.switchToHttp().getRequest<RequisicaoAutenticada>();
    return requisicao.usuario;
  },
);
