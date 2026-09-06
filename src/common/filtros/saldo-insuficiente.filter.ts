import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { SaldoInsuficienteError } from '../../creditos/aplicacao/portas/creditos-repositorio.port';

/**
 * `SaldoInsuficienteError` é uma exceção de domínio (não conhece HTTP -- Clean
 * Architecture, docs/ARQUITETURA.md), lançada por qualquer módulo que gaste créditos
 * (hoje só serpro/, mais vão vir). Converte pra 402 Payment Required aqui, um lugar só,
 * em vez de cada caso de uso ter que fazer esse mapeamento.
 */
@Catch(SaldoInsuficienteError)
export class SaldoInsuficienteFilter implements ExceptionFilter {
  catch(excecao: SaldoInsuficienteError, host: ArgumentsHost): void {
    const resposta = host.switchToHttp().getResponse<Response>();
    resposta.status(HttpStatus.PAYMENT_REQUIRED).json({
      statusCode: HttpStatus.PAYMENT_REQUIRED,
      error: 'Payment Required',
      message: excecao.message,
    });
  }
}
