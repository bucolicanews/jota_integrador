import { StatusCertificado, TipoCertificado } from '../../dominio/certificado';

/** Metadados apenas -- nunca inclui arquivoRef/senhaRef (esses ficam só na infraestrutura, nunca sobem até Application/Presentation). */
export interface CertificadoMetadados {
  id: string;
  empresaId: string;
  tipo: TipoCertificado;
  validadeInicio: string | null;
  validadeFim: string;
  status: StatusCertificado;
  criadoEm: string;
}

export interface DadosNovoCertificado {
  empresaId: string;
  tipo: TipoCertificado;
  arquivoRef: string;
  senhaRef: string;
  validadeInicio: string | null;
  validadeFim: string;
}

export interface CertificadosRepositorioPort {
  listarPorEmpresa(empresaId: string): Promise<CertificadoMetadados[]>;
  buscarAtivoPorEmpresa(empresaId: string): Promise<CertificadoMetadados | null>;
  /** Único ponto que teria acesso aos `_ref` -- usado só pela recuperação interna (autenticação Modo B), nunca por um controller. */
  buscarRefsAtivoPorEmpresa(empresaId: string): Promise<{ id: string; arquivoRef: string; senhaRef: string } | null>;
  criar(dados: DadosNovoCertificado): Promise<CertificadoMetadados>;
  marcarStatus(id: string, status: StatusCertificado): Promise<void>;
}

export const CERTIFICADOS_REPOSITORIO = Symbol('CERTIFICADOS_REPOSITORIO');
