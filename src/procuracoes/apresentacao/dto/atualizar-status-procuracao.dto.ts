import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { StatusProcuracao } from '../../dominio/procuracao';

export class AtualizarStatusProcuracaoDto {
  @IsIn(['ativa', 'expirada', 'revogada', 'pendente'])
  status!: StatusProcuracao;

  @IsOptional()
  @IsDateString()
  outorgadaEm?: string;

  @IsOptional()
  @IsDateString()
  expiraEm?: string;
}
