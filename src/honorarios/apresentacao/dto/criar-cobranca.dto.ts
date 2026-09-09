import { IsNumber, IsString, IsUrl, MaxLength, Min, MinLength } from 'class-validator';

export class CriarCobrancaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  descricao!: string;

  @IsNumber()
  @Min(0.01)
  valor!: number;

  @IsUrl({ require_tld: false })
  successUrl!: string;

  @IsUrl({ require_tld: false })
  cancelUrl!: string;
}
