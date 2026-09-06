import { MaxLength, MinLength } from 'class-validator';

export class BloquearContadorDto {
  @MinLength(3)
  @MaxLength(500)
  motivo!: string;
}
