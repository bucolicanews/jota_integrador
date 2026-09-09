import { IsIn, IsInt, IsNumber, IsString, Min, MinLength } from 'class-validator';
import { Periodicidade } from '../../dominio/plano';

export class CriarPlanoDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsInt()
  @Min(0)
  operacoesIncluidas!: number;

  @IsNumber()
  @Min(0)
  preco!: number;

  @IsIn(['mensal', 'anual'])
  periodicidade!: Periodicidade;
}
