import { BadRequestException, Controller, Headers, HttpCode, Post, RawBodyRequest, Req } from '@nestjs/common';
import { Request } from 'express';
import { ProcessarWebhookStripeAssinaturaUseCase } from '../aplicacao/casos-de-uso/processar-webhook-stripe-assinatura.usecase';

/**
 * SEM SupabaseAuthGuard -- quem chama é o Stripe, não um usuário logado. A verificação
 * de autenticidade é a assinatura HMAC (`stripe-signature`, checada dentro do use case
 * via `StripeAssinaturasService.construirEvento`), não um JWT. Path separado de
 * `/webhooks/stripe/honorarios` (Stripe Connect, quando implementado) -- segredos e
 * tratamento de evento são completamente diferentes entre os dois.
 */
@Controller('webhooks/stripe')
export class WebhookAssinaturasController {
  constructor(private readonly processarWebhook: ProcessarWebhookStripeAssinaturaUseCase) {}

  @Post('assinaturas')
  @HttpCode(200) // Stripe reenvia (com backoff) qualquer coisa != 2xx -- 200 mesmo pra eventos ignorados de propósito
  async receber(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') assinaturaHeader: string | undefined,
  ): Promise<{ recebido: true }> {
    if (!req.rawBody || !assinaturaHeader) {
      throw new BadRequestException('Requisição sem body bruto ou header stripe-signature');
    }

    try {
      await this.processarWebhook.executar(req.rawBody, assinaturaHeader);
    } catch (erro) {
      // Assinatura inválida ou payload malformado -- nunca vazar detalhe (poderia ajudar
      // um atacante a forjar um evento), mas também nunca silenciar: 400 faz o Stripe
      // logar a falha no dashboard, diferente de mascarar como 200.
      throw new BadRequestException(`Webhook inválido: ${(erro as Error).message}`);
    }

    return { recebido: true };
  }
}
