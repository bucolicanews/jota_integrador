import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AtualizarContadorDto {
  @IsOptional()
  @MinLength(2)
  @MaxLength(200)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string;
}
