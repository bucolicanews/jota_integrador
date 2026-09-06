import { MaxLength, MinLength } from 'class-validator';

export class BloquearEmpresaDto {
  @MinLength(3)
  @MaxLength(500)
  motivo!: string;
}
