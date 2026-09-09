import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TipoCertificado } from '../../dominio/certificado';

export class CadastrarCertificadoDto {
  @IsIn(['A1', 'A3'])
  tipo!: TipoCertificado;

  // Nunca logada nem retornada -- só passa por aqui a caminho do CofreCriptografiaService.
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  senha!: string;

  @IsOptional()
  @IsDateString()
  validadeInicio?: string;

  @IsDateString()
  validadeFim!: string;
}
