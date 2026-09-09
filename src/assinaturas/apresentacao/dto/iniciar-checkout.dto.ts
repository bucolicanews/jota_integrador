import { IsUUID, IsUrl } from 'class-validator';

export class IniciarCheckoutDto {
  @IsUUID()
  planoId!: string;

  @IsUrl({ require_tld: false }) // require_tld: false -- permite localhost em dev
  successUrl!: string;

  @IsUrl({ require_tld: false })
  cancelUrl!: string;
}
