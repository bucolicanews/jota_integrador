import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ModoAcessoSerpro, REGIMES_TRIBUTARIOS, RegimeTributario } from '../../dominio/empresa';

export class CriarEmpresaDto {
  // Só usado/aceito quando quem chama é SUPER_ADMIN -- para qualquer outro papel o
  // controller ignora este campo e usa o contadorId do próprio usuário autenticado
  // (nunca confia no que vem do client pra definir de quem é a empresa).
  @IsOptional()
  @IsUUID()
  contadorId?: string;

  @MinLength(2)
  @MaxLength(200)
  razaoSocial!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nomeFantasia?: string | null;

  // Formato validado aqui (14 dígitos); dígito verificador é checado no Domain
  // (validarCnpj) -- não duplicar a regra de checksum na camada de apresentação.
  @IsString()
  @MinLength(14)
  @MaxLength(18) // aceita com máscara (00.000.000/0000-00), normalizado depois
  cnpj!: string;

  @IsOptional()
  @IsIn(REGIMES_TRIBUTARIOS)
  regimeTributario?: RegimeTributario | null;

  @IsIn(['procuracao', 'certificado_proprio'])
  modoAcessoSerpro!: ModoAcessoSerpro;
}
