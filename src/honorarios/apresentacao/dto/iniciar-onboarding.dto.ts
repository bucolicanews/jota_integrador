import { IsUrl } from 'class-validator';

export class IniciarOnboardingDto {
  @IsUrl({ require_tld: false })
  refreshUrl!: string;

  @IsUrl({ require_tld: false })
  returnUrl!: string;
}
