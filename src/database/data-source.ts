import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { validateEnv } from '../config/env.validation';
import { buildDataSourceOptions } from './database.config';

// El CLI de TypeORM no pasa por Nest, así que cargamos el .env acá.
// En Railway no hay .env: se usan las variables del entorno.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const env = validateEnv(process.env);

export default new DataSource({
  ...buildDataSourceOptions(env),
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
});
