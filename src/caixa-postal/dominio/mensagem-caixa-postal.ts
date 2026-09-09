export type StatusMensagem = 'lida' | 'nao_lida';

/**
 * Dados brutos como o SERPRO devolve (docs oficiais + testado de verdade contra o
 * ambiente trial, serviço CAIXAPOSTAL/MSGCONTRIBUINTE61+MSGDETALHAMENTO62) -- datas em
 * "YYYYMMDD"/"HHMMSS" separados, não ISO.
 */
export function converterDataHoraSerpro(dataAAAAMMDD: string, horaHHMMSS?: string): string {
  const ano = dataAAAAMMDD.slice(0, 4);
  const mes = dataAAAAMMDD.slice(4, 6);
  const dia = dataAAAAMMDD.slice(6, 8);
  const hora = (horaHHMMSS || '000000').padEnd(6, '0');
  const h = hora.slice(0, 2);
  const m = hora.slice(2, 4);
  const s = hora.slice(4, 6);
  return `${ano}-${mes}-${dia}T${h}:${m}:${s}Z`;
}

/**
 * O corpo da mensagem (`corpoModelo`) vem com placeholders `++1++`, `++2++`... que são
 * substituídos pelos valores de `variaveis[]` (índice 0 = ++1++) -- confirmado testando
 * de verdade contra o trial (MSGDETALHAMENTO62): sem essa substituição o texto fica
 * ilegível ("Número: ++4++" em vez do número de verdade).
 */
export function substituirVariaveisCorpo(corpoModelo: string, variaveis: string[]): string {
  return corpoModelo.replace(/\+\+(\d+)\+\+/g, (match, indice) => {
    const valor = variaveis[Number(indice) - 1];
    return valor !== undefined ? valor : match;
  });
}
