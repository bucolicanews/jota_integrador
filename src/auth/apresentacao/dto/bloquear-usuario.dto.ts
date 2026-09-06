import { MaxLength, MinLength } from 'class-validator';

export class BloquearUsuarioDto {
  @MinLength(3)
  @MaxLength(500)
  motivo!: string;
}
