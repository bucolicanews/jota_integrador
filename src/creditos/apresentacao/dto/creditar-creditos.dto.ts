import { IsInt, IsPositive, MaxLength, MinLength } from 'class-validator';

export class CreditarCreditosDto {
  @IsInt()
  @IsPositive()
  quantidade!: number;

  @MinLength(3)
  @MaxLength(500)
  motivo!: string;
}
