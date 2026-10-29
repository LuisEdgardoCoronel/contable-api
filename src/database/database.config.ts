import { DataSourceOptions } from 'typeorm';
import { EnvironmentVariables } from '../config/env.validation';
import { Cliente } from '../clientes/cliente.entity';
import { Impuesto } from '../impuestos/impuesto.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { Vencimiento } from '../vencimientos/vencimiento.entity';
import { SnakeNamingStrategy } from './snake-naming.strategy';

export const ENTITIES = [Usuario, Cliente, Impuesto, Vencimiento];

/** Opciones compartidas entre la app (TypeOrmModule) y el CLI (data-source.ts). */
export function buildDataSourceOptions(
  env: Pick<
    EnvironmentVariables,
    'DB_HOST' | 'DB_PORT' | 'DB_USER' | 'DB_PASSWORD' | 'DB_NAME'
  >,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    entities: ENTITIES,
    namingStrategy: new SnakeNamingStrategy(),
    // gen_random_uuid() es nativo desde Postgres 13: no requiere uuid-ossp.
    uuidExtension: 'pgcrypto',
    synchronize: false,
  };
}
