import { Request } from 'express';
import { IdentidadeValidada } from '../../aplicacao/portas/provedor-identidade.port';

// Presentation depende de Application (não o contrário) -- reaproveita o mesmo formato
// de claims já validado pelo provedor de identidade, não redefine um tipo paralelo.
export type UsuarioAutenticado = IdentidadeValidada;

export interface RequisicaoAutenticada extends Request {
  usuario: UsuarioAutenticado;
}
