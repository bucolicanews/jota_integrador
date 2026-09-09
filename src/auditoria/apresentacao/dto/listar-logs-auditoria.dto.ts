import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListarLogsAuditoriaDto {
  // Só plataforma pode filtrar por um contadorId/empresaId arbitrário -- pra contador/
  // empresa comum, o controller ignora estes campos e força o próprio escopo (nunca
  // confia no que vem do client pra decidir de quem são os logs, mesma regra de sempre).
  @IsOptional()
  @IsUUID()
  contadorId?: string;

  @IsOptional()
  @IsUUID()
  empresaId?: string;

  @IsOptional()
  @IsString()
  recurso?: string;

  @IsOptional()
  @IsString()
  acao?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
