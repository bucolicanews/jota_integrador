import { Controller, ForbiddenException, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma } from '../../auth/dominio/papel';
import {
  EMPRESAS_REPOSITORIO,
  EmpresasRepositorioPort,
} from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { ListarLogsAuditoriaUseCase } from '../aplicacao/casos-de-uso/listar-logs-auditoria.usecase';
import { FiltroLogsAuditoria, ResultadoLogsAuditoria } from '../aplicacao/portas/logs-auditoria-repositorio.port';
import { ListarLogsAuditoriaDto } from './dto/listar-logs-auditoria.dto';

const LIMIT_PADRAO = 50;

@Controller('logs-auditoria')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class AuditoriaController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly listarLogs: ListarLogsAuditoriaUseCase,
  ) {}

  @Get()
  async listar(
    @Query() dto: ListarLogsAuditoriaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ResultadoLogsAuditoria> {
    const filtro = await this.resolverFiltro(dto, usuarioAtual);
    return this.listarLogs.executar(filtro);
  }

  /**
   * Nunca confia no contadorId/empresaId vindo do client pra decidir de QUEM são os
   * logs -- só plataforma pode escolher livremente; contador/empresa comum têm o
   * próprio escopo forçado aqui, ignorando o que veio no DTO pra esses campos (mesma
   * regra de Zero Trust do resto do projeto).
   */
  private async resolverFiltro(
    dto: ListarLogsAuditoriaDto,
    usuarioAtual: UsuarioAutenticado,
  ): Promise<FiltroLogsAuditoria> {
    const base = {
      recurso: dto.recurso,
      acao: dto.acao,
      limit: dto.limit ?? LIMIT_PADRAO,
      offset: dto.offset ?? 0,
    };

    if (ehPapelDePlataforma(usuarioAtual.papel)) {
      return { ...base, contadorId: dto.contadorId, empresaId: dto.empresaId };
    }

    if (usuarioAtual.contadorId) {
      const empresasDaCarteira = await this.empresasRepositorio.listarPorContador(usuarioAtual.contadorId);
      return {
        ...base,
        contadorId: usuarioAtual.contadorId,
        empresaIdsDoContador: empresasDaCarteira.map((empresa) => empresa.id),
        // dto.empresaId só ESTREITA ainda mais o escopo já garantido pelo OR acima
        // (contador_id = o próprio OU empresa_id na carteira) -- nunca amplia, mesmo se
        // o contador passar um empresaId de fora da própria carteira (o OR não bate,
        // vira lista vazia, não vaza nada).
        empresaId: dto.empresaId,
      };
    }

    if (usuarioAtual.empresaId) {
      return { ...base, empresaId: usuarioAtual.empresaId };
    }

    // Não deveria acontecer -- todo papel tem escopo plataforma, contador ou empresa
    // (validarCoerenciaEscopo, auth/dominio/papel.ts). Se chegar aqui, algo está
    // inconsistente no cadastro do usuário -- negar por padrão, nunca vazar tudo.
    throw new ForbiddenException('Não foi possível determinar o escopo de acesso aos logs de auditoria');
  }
}
