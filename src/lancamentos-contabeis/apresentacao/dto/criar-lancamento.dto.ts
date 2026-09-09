import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { ORIGENS_LANCAMENTO, OrigemLancamento } from '../../dominio/lancamento';
import { PartidaLancamentoDto } from './partida-lancamento.dto';

export class CriarLancamentoDto {
  @IsDateString()
  dataCompetencia!: string;

  @MinLength(2)
  @MaxLength(500)
  historico!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  documentoReferencia?: string | null;

  @IsIn(ORIGENS_LANCAMENTO)
  origem!: OrigemLancamento;

  // Validação de "débito soma igual a crédito" acontece no banco (criar_lancamento_contabil)
  // -- aqui só a forma dos dados (mín. 2 partidas, cada uma com conta/tipo/valor válidos).
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => PartidaLancamentoDto)
  partidas!: PartidaLancamentoDto[];
}
