export type TipoContador = 'humano' | 'interno_jota';
export type StatusContador = 'ativo' | 'inativo';

/** Dígito verificador de CPF -- algoritmo oficial da Receita Federal. */
export function validarCpf(cpf: string): boolean {
  const digitos = cpf.replace(/\D/g, '');

  if (digitos.length !== 11) {
    return false;
  }
  if (/^(\d)\1{10}$/.test(digitos)) {
    return false;
  }

  const calcularDigitoVerificador = (base: string, pesoInicial: number): number => {
    const soma = base
      .split('')
      .reduce((acumulado, digito, indice) => acumulado + Number(digito) * (pesoInicial - indice), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const base = digitos.slice(0, 9);
  const primeiroDigito = calcularDigitoVerificador(base, 10);
  const segundoDigito = calcularDigitoVerificador(base + primeiroDigito, 11);

  return digitos === `${base}${primeiroDigito}${segundoDigito}`;
}

/** Dígito verificador de CNPJ -- mesma regra usada em src/empresas/dominio/empresa.ts. */
export function validarCnpj(cnpj: string): boolean {
  const digitos = cnpj.replace(/\D/g, '');

  if (digitos.length !== 14) {
    return false;
  }
  if (/^(\d)\1{13}$/.test(digitos)) {
    return false;
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

/**
 * `contadores.cnpj_cpf` aceita os dois formatos (contador pode ser um escritório --
 * CNPJ -- ou um profissional autônomo -- CPF). Dispatch pelo tamanho do documento.
 */
export function validarCpfOuCnpj(valor: string): boolean {
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length === 11) {
    return validarCpf(digitos);
  }
  if (digitos.length === 14) {
    return validarCnpj(digitos);
  }
  return false;
}
