export type StatusCobranca = 'pendente' | 'pago' | 'falhou' | 'estornado';

/**
 * Comissão/posse já são garantidas pelo banco (triggers `definir_comissao_honorario`/
 * `valida_posse_cobranca_honorario`, migration 0008) -- aqui só a validação de forma
 * que faz sentido revalidar na Application antes de gastar uma chamada ao banco.
 */
export function validarValorCobranca(valor: number): void {
  if (!(valor > 0)) {
    throw new Error('valor da cobrança precisa ser maior que zero');
  }
}
