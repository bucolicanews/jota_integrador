import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsUUID,
  MaxLength,
  MinLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ESCOPO_POR_PAPEL, Papel } from '../../dominio/papel';

@ValidatorConstraint({ name: 'coerenciaEscopoPapel', async: false })
class CoerenciaEscopoPapelConstraint implements ValidatorConstraintInterface {
  validate(papel: Papel, args: ValidationArguments): boolean {
    const dto = args.object as CriarUsuarioDto;
    const escopo = ESCOPO_POR_PAPEL[papel];

    if (escopo === 'plataforma') {
      return !dto.contadorId && !dto.empresaId;
    }
    if (escopo === 'contador') {
      return Boolean(dto.contadorId) && !dto.empresaId;
    }
    return Boolean(dto.empresaId) && !dto.contadorId; // escopo === 'empresa'
  }

  defaultMessage(): string {
    return 'contadorId/empresaId precisam bater com o escopo do papel informado (ver docs/BANCO_DE_DADOS.md §1)';
  }
}

// DTO com whitelist explícita de campos -- nunca aceitar o body inteiro (regra de mass
// assignment já documentada no PENTEST_CODE_REVIEW_PROTOCOL.md do vault).
export class CriarUsuarioDto {
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @IsEmail()
  email!: string;

  @IsEnum(Papel)
  @Validate(CoerenciaEscopoPapelConstraint)
  papel!: Papel;

  @IsOptional()
  @IsUUID()
  contadorId?: string | null;

  @IsOptional()
  @IsUUID()
  empresaId?: string | null;
}
