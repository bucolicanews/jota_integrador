export type ModoAcessoSerpro = 'procuracao' | 'certificado_proprio';
export type StatusEmpresa = 'ativo' | 'inativo';

// Nomenclatura de regime tributário alinhada com os serviços do SERPRO/Integra Contador
// (MEI tem serviços próprios -- CCMEI/PGMEI -- separados do Simples Nacional "regular" --
// PGDAS-D/DEFIS -- por isso não é só um sub-caso do mesmo valor).
export type RegimeTributario = 'simples_nacional' | 'mei' | 'lucro_presumido' | 'lucro_real' | 'lucro_arbitrado';
export const REGIMES_TRIBUTARIOS: RegimeTributario[] = [
  'simples_nacional',
  'mei',
  'lucro_presumido',
  'lucro_real',
  'lucro_arbitrado',
];

/**
 * Validação de CNPJ (dígitos verificadores, algoritmo oficial da Receita Federal) --
 * regra de negócio pura, sem depender de banco/framework. Nunca confiar em CNPJ vindo
 * do frontend sem essa checagem (Zero Trust, docs/SEGURANCA.md).
 */
export function validarCnpj(cnpj: string): boolean {
  const digitos = cnpj.replace(/\D/g, '');

  if (digitos.length !== 14) {
    return false;
  }
  if (/^(\d)\1{13}$/.test(digitos)) {
    return false; // todos os dígitos iguais -- nunca um CNPJ válido, embora passe no checksum
  }

  const calcularDigitoVerificador = (base: string, pesos: number[]): number => {
    const soma = base
      .split('')
      .reduce((acumulado, digito, indice) => acumulado + Number(digito) * pesos[indice], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesosPrimeiroDigito = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesosSegundoDigito = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const base = digitos.slice(0, 12);
  const primeiroDigito = calcularDigitoVerificador(base, pesosPrimeiroDigito);
  const segundoDigito = calcularDigitoVerificador(base + primeiroDigito, pesosSegundoDigito);

  return digitos === `${base}${primeiroDigito}${segundoDigito}`;
}
