import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsString, IsUrl, validateSync } from 'class-validator';

// Falha rápido na subida do processo se faltar env var obrigatória -- nunca deixar o
// app subir "quebrado pela metade" (ex: sem SUPABASE_SERVICE_ROLE_KEY) só pra falhar
// depois, na primeira requisição.
class EnvironmentVariables {
  @IsUrl({ require_tld: false })
  SUPABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  SUPABASE_SERVICE_ROLE_KEY!: string;

  @IsString()
  @IsNotEmpty()
  SUPABASE_ANON_KEY!: string;

  @IsString()
  @IsNotEmpty()
  APP_ALLOWED_ORIGINS!: string;

  // Chave mestra do cofre de certificados digitais (Modo B, docs/SEGURANCA.md §1) --
  // 32 bytes em base64 (AES-256). Gerar com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
  // Nunca reaproveitar entre ambientes (dev/produção) nem versionar um valor real.
  @IsString()
  @IsNotEmpty()
  CERTIFICADO_CHAVE_MESTRA!: string;

  // Assinatura SaaS (contador -> Jota), sem Connect -- docs/SEGURANCA.md §6. Segredo só
  // aqui/Secret Manager, nunca em tabela (ADR-002-POLITICA-CREDENCIAIS).
  @IsString()
  @IsNotEmpty()
  STRIPE_SECRET_KEY!: string;

  @IsString()
  @IsNotEmpty()
  STRIPE_WEBHOOK_SECRET_ASSINATURAS!: string;
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Variáveis de ambiente inválidas/ausentes: ${errors.toString()}`);
  }

  return validatedConfig;
}
