import { IsNumber, Max, Min } from 'class-validator';

export class AtualizarComissaoDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  comissaoHonorariosPct!: number;
}
