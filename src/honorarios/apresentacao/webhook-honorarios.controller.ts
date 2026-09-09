import { BadRequestException, Controller, Headers, HttpCode, Post, RawBodyRequest, Req } from '@nestjs/common';
import { Request } from 'express';
import { ProcessarWebhookStripeHonorarioUseCase } from '../aplicacao/casos-de-uso/processar-webhook-stripe-honorario.usecase';

/** Sem SupabaseAuthGuard, mesmo padrão de WebhookAssinaturasController -- ver comentário lá. Path separado (`/webhooks/stripe/honorarios`), segredo e eventos diferentes. */
@Controller('webhooks/stripe')
export class WebhookHonorariosController {
  constructor(private readonly processarWebhook: ProcessarWebhookStripeHonorarioUseCase) {}

  @Post('honorarios')
  @HttpCode(200)
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
      throw new BadRequestException(`Webhook inválido: ${(erro as Error).message}`);
    }

    return { recebido: true };
  }
}
