import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Papeis } from '../../auth/apresentacao/decorators/papeis.decorator';
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
import { CadastrarOuRotacionarCertificadoUseCase } from '../aplicacao/casos-de-uso/cadastrar-ou-rotacionar-certificado.usecase';
import { ListarCertificadosUseCase } from '../aplicacao/casos-de-uso/listar-certificados.usecase';
import { RevogarCertificadoUseCase } from '../aplicacao/casos-de-uso/revogar-certificado.usecase';
import { CertificadoMetadados } from '../aplicacao/portas/certificados-repositorio.port';
import { CadastrarCertificadoDto } from './dto/cadastrar-certificado.dto';

const TAMANHO_MAXIMO_ARQUIVO = 10 * 1024 * 1024; // 10MB -- .pfx/.p12 são pequenos, generoso o suficiente

@Controller('empresas/:empresaId/certificado')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class CertificadosController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly cadastrarOuRotacionar: CadastrarOuRotacionarCertificadoUseCase,
    private readonly listarCertificados: ListarCertificadosUseCase,
    private readonly revogarCertificado: RevogarCertificadoUseCase,
  ) {}

  @Get()
  async listar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<CertificadoMetadados[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);

    // Nunca retorna arquivo_ref/senha_ref -- CertificadoMetadados nem tem esses campos
    // (docs/SEGURANCA.md: "nunca expor certificado... nem em resposta de API").
    return this.listarCertificados.executar(empresaId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('arquivo', {
      storage: memoryStorage(), // nunca toca disco, nem cifrado -- fica só em memória até subir pro cofre
      limits: { fileSize: TAMANHO_MAXIMO_ARQUIVO },
    }),
  )
  async cadastrarOuRotacionarCertificado(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @Body() dto: CadastrarCertificadoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<CertificadoMetadados> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);

    if (!arquivo) {
      throw new BadRequestException('Arquivo do certificado (campo "arquivo") é obrigatório');
    }

    return this.cadastrarOuRotacionar.executar(
      {
        empresaId,
        tipo: dto.tipo,
        arquivo: arquivo.buffer,
        nomeArquivo: arquivo.originalname,
        senha: dto.senha,
        validadeInicio: dto.validadeInicio ?? null,
        validadeFim: dto.validadeFim,
      },
      usuarioAtual.id,
    );
  }

  @Post('revogar')
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async revogar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);

    await this.revogarCertificado.executar(empresaId, usuarioAtual.id);
    return { ok: true };
  }

  private async buscarEmpresaOuFalhar(empresaId: string): Promise<Empresa> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }
    return empresa;
  }

  /** Mesmo padrão de posse de EmpresasController/SerproController -- contador dono ou usuário da própria empresa. */
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
}
