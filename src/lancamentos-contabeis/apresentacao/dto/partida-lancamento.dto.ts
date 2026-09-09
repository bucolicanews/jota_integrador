import { IsIn, IsNumber, IsPositive, IsUUID } from 'class-validator';
import { TIPOS_PARTIDA, TipoPartida } from '../../dominio/lancamento';

export class PartidaLancamentoDto {
  @IsUUID()
  contaId!: string;

  @IsIn(TIPOS_PARTIDA)
  tipo!: TipoPartida;

  @IsNumber()
  @IsPositive()
  valor!: number;
}
