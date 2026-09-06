import { IsIn } from 'class-validator';
import { ModoAcessoSerpro } from '../../dominio/empresa';

export class AtualizarModoAcessoSerproDto {
  @IsIn(['procuracao', 'certificado_proprio'])
  modoAcessoSerpro!: ModoAcessoSerpro;
}
