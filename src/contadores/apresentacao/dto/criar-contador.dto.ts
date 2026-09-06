import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CriarContadorDto {
  @MinLength(2)
  @MaxLength(200)
  nome!: string;

  // Formato (11 ou 14 dígitos) e dígito verificador validados no Domain
  // (validarCpfOuCnpj) -- não duplicar a regra de checksum aqui.
  @IsString()
  @MinLength(11)
  @MaxLength(18) // aceita com máscara
  cnpjCpf!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string | null;
}
