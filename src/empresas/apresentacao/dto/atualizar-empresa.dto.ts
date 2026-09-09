import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { REGIMES_TRIBUTARIOS, RegimeTributario } from '../../dominio/empresa';

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
  @IsIn(REGIMES_TRIBUTARIOS)
  regimeTributario?: RegimeTributario | null;
}
