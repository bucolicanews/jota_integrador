import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AtualizarEmpresaDto {
  @IsOptional()
  @MinLength(2)
  @MaxLength(200)
  razaoSocial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nomeFantasia?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  regimeTributario?: string | null;
}
