import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  DB_HOST!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT!: number;

  @IsString()
  @IsNotEmpty()
  DB_USER!: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME!: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  // Formato de jsonwebtoken: segundos ("3600") o número + unidad ("1d", "12h").
  @IsString()
  @Matches(/^\d+\s*(ms|s|m|h|d|w|y)?$/i, {
    message: 'JWT_EXPIRES_IN debe ser segundos o algo como 1d, 12h, 30m',
  })
  JWT_EXPIRES_IN!: string;
}

/**
 * Valida las variables de entorno al arrancar. Si falta alguna o es
 * inválida, lanza un error y la app (o el CLI) no arranca.
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(env, { skipMissingProperties: false });

  if (errors.length > 0) {
    const detalle = errors
      .map((e) => `  - ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${detalle}`);
  }
  return env;
}
