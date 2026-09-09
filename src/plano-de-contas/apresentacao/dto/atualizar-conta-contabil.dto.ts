import { IsBoolean, IsOptional, MaxLength, MinLength } from 'class-validator';

export class AtualizarContaContabilDto {
  @IsOptional()
  @MinLength(2)
  @MaxLength(200)
  nome?: string;

  @IsOptional()
  @IsBoolean()
  contaCaixaBanco?: boolean;

  @IsOptional()
  @IsBoolean()
  contaAReceber?: boolean;

  @IsOptional()
  @IsBoolean()
  contaAPagar?: boolean;
}
