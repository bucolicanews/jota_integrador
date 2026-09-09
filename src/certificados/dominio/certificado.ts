export type TipoCertificado = 'A1' | 'A3';
export type StatusCertificado = 'ativo' | 'expirado' | 'revogado' | 'substituido';

const EXTENSOES_A1 = ['.pfx', '.p12'];

/**
 * A1 é arquivo (pfx/p12) -- cadastro via upload, coberto por este módulo. A3 é hardware
 * (token/smartcard): não tem arquivo pra cifrar/guardar no cofre da mesma forma, e
 * `certificados.arquivo_ref`/`senha_ref` são NOT NULL (migration 20260906000003) -- não
 * dá pra representar A3 corretamente sem decidir o desenho de integração com hardware
 * (driver/middleware do token), que não está especificado em nenhum doc do projeto ainda.
 * Rejeitar explicitamente em vez de gravar dado inventado/incoerente -- mesma cautela já
 * aplicada à mecânica de auth do Modo B em si (docs/SEGURANCA.md §1, "não assumir, validar").
 */
export function validarArquivoObrigatorio(tipo: TipoCertificado, nomeArquivo: string | null): void {
  if (tipo === 'A3') {
    throw new Error(
      'Cadastro de certificado A3 (hardware/token) ainda não é suportado -- desenho de integração pendente. Use A1.',
    );
  }
  if (!nomeArquivo) {
    throw new Error('Certificado A1 exige upload do arquivo (.pfx/.p12)');
  }
  const temExtensaoValida = EXTENSOES_A1.some((ext) => nomeArquivo.toLowerCase().endsWith(ext));
  if (!temExtensaoValida) {
    throw new Error(`Certificado A1 precisa ser .pfx ou .p12 (recebido: ${nomeArquivo})`);
  }
}

export function validarVigencia(validadeInicio: string | null, validadeFim: string): void {
  const fim = new Date(validadeFim);
  if (Number.isNaN(fim.getTime())) {
    throw new Error('validadeFim inválida');
  }
  if (validadeInicio) {
    const inicio = new Date(validadeInicio);
    if (!Number.isNaN(inicio.getTime()) && inicio > fim) {
      throw new Error('validadeInicio não pode ser depois de validadeFim');
    }
  }
  if (fim < new Date()) {
    throw new Error('Certificado já vencido -- validadeFim precisa ser uma data futura');
  }
}
