import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import {
  EMPRESAS_REPOSITORIO,
  Empresa,
  EmpresasRepositorioPort,
} from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { CriarLancamentoUseCase } from '../aplicacao/casos-de-uso/criar-lancamento.usecase';
import { EstornarLancamentoUseCase } from '../aplicacao/casos-de-uso/estornar-lancamento.usecase';
import { ListarLancamentosUseCase } from '../aplicacao/casos-de-uso/listar-lancamentos.usecase';
import { ObterLancamentoUseCase } from '../aplicacao/casos-de-uso/obter-lancamento.usecase';
import { ObterSaldoContaUseCase } from '../aplicacao/casos-de-uso/obter-saldo-conta.usecase';
import { LancamentoContabil } from '../aplicacao/portas/lancamentos-repositorio.port';
import { CriarLancamentoDto } from './dto/criar-lancamento.dto';
import { EstornarLancamentoDto } from './dto/estornar-lancamento.dto';

@Controller('empresas/:empresaId/lancamentos-contabeis')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class LancamentosController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly criarLancamento: CriarLancamentoUseCase,
    private readonly listarLancamentos: ListarLancamentosUseCase,
    private readonly obterLancamento: ObterLancamentoUseCase,
    private readonly estornarLancamento: EstornarLancamentoUseCase,
    private readonly obterSaldoConta: ObterSaldoContaUseCase,
  ) {}

  @Get()
  async listar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('dataInicio') dataInicio: string | undefined,
    @Query('dataFim') dataFim: string | undefined,
    @Query('contaId') contaId: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<LancamentoContabil[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);

    return this.listarLancamentos.executar(empresaId, { dataInicio, dataFim, contaId });
  }

  @Get('saldo/:contaId')
  async obterSaldo(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('contaId', ParseUUIDPipe) contaId: string,
    @Query('ateData') ateData: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ saldo: number }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);

    const saldo = await this.obterSaldoConta.executar(contaId, ateData);
    return { saldo };
  }

  @Get(':id')
  async obter(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<LancamentoContabil> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);

    return this.obterLancamento.executar(id);
  }

  @Post()
  async criar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: CriarLancamentoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ id: string }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);

    const id = await this.criarLancamento.executar({
      empresaId,
      dataCompetencia: dto.dataCompetencia,
      historico: dto.historico,
      documentoReferencia: dto.documentoReferencia ?? null,
      origem: dto.origem,
      partidas: dto.partidas,
      criadoPor: usuarioAtual.id,
    });
    return { id };
  }

  @Post(':id/estornar')
  async estornar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EstornarLancamentoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ id: string }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);

    const novoId = await this.estornarLancamento.executar(id, dto.motivo, usuarioAtual.id, empresaId);
    return { id: novoId };
  }

  private async buscarEmpresaOuFalhar(empresaId: string): Promise<Empresa> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }
    return empresa;
  }

  /** Leitura: contador dono, usuário da própria empresa, ou plataforma. */
  private exigirPosse(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN) {
      return;
    }
    const ehContadorDono = usuarioAtual.contadorId !== null && usuarioAtual.contadorId === empresa.contadorId;
    const ehDaPropriaEmpresa = usuarioAtual.empresaId !== null && usuarioAtual.empresaId === empresa.id;

    if (!ehContadorDono && !ehDaPropriaEmpresa) {
      throw new ForbiddenException('Sem autoridade sobre esta empresa');
    }
  }

  /** Escrita (criar/estornar lançamento): só contador dono ou plataforma -- mesmo critério de plano_contas. */
  private exigirPosseDeContador(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN) {
      return;
    }
    if (usuarioAtual.contadorId !== empresa.contadorId) {
      throw new ForbiddenException('Sem autoridade sobre esta empresa');
    }
  }
}
