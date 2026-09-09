import { MaxLength, MinLength } from 'class-validator';

export class EstornarLancamentoDto {
  @MinLength(3)
  @MaxLength(500)
  motivo!: string;
}
