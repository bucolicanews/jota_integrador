import { Inject, Injectable } from '@nestjs/common';
import {
  FiltroLogsAuditoria,
  LOGS_AUDITORIA_REPOSITORIO,
  LogsAuditoriaRepositorioPort,
  ResultadoLogsAuditoria,
} from '../portas/logs-auditoria-repositorio.port';

/** Escopo de acesso (plataforma vê tudo, contador/empresa só o próprio) já resolvido pelo controller antes de chegar aqui -- mesmo padrão de exigirPosse usado no resto do projeto. */
@Injectable()
export class ListarLogsAuditoriaUseCase {
  constructor(
    @Inject(LOGS_AUDITORIA_REPOSITORIO) private readonly logsRepositorio: LogsAuditoriaRepositorioPort,
  ) {}

  async executar(filtro: FiltroLogsAuditoria): Promise<ResultadoLogsAuditoria> {
    return this.logsRepositorio.listar(filtro);
  }
}
