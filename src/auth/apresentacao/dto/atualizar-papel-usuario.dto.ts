import { IsEnum, IsOptional, IsUUID, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { ESCOPO_POR_PAPEL, Papel } from '../../dominio/papel';

@ValidatorConstraint({ name: 'coerenciaEscopoPapelAtualizacao', async: false })
class CoerenciaEscopoPapelConstraint implements ValidatorConstraintInterface {
  validate(papel: Papel, args: ValidationArguments): boolean {
    const dto = args.object as AtualizarPapelUsuarioDto;
    const escopo = ESCOPO_POR_PAPEL[papel];

    if (escopo === 'plataforma') {
      return !dto.contadorId && !dto.empresaId;
    }
    if (escopo === 'contador') {
      return Boolean(dto.contadorId) && !dto.empresaId;
    }
    return Boolean(dto.empresaId) && !dto.contadorId;
  }

  defaultMessage(): string {
    return 'contadorId/empresaId precisam bater com o escopo do papel informado (ver docs/BANCO_DE_DADOS.md §1)';
  }
}

export class AtualizarPapelUsuarioDto {
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
