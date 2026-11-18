import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getOptionsToken, ThrottlerGuard } from '@nestjs/throttler';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { opcionesRateLimitLogin } from '../../src/auth/auth.module';
import { configurarApp } from '../../src/app.setup';

/**
 * Levanta la app completa, con la misma configuración global que `main.ts`.
 *
 * El rate limit del login queda desactivado por defecto: todos los requests de
 * los e2e salen de la misma IP y varios tests se loguean más de 5 veces por
 * minuto. Se prueba aparte con `{ rateLimitLogin: N }`, que lo activa con N
 * intentos por minuto, sin importar el `LOGIN_RATE_LIMIT` del `.env`.
 */
export async function crearApp({
  rateLimitLogin,
}: { rateLimitLogin?: number } = {}): Promise<INestApplication<App>> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (rateLimitLogin === undefined) {
    builder.overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true });
  } else {
    builder
      .overrideProvider(getOptionsToken())
      .useValue(opcionesRateLimitLogin(rateLimitLogin));
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configurarApp(app);
  await app.init();
  return app;
}

/**
 * Borra lo que creó un e2e a partir de los usuarios registrados: los
 * vencimientos y clientes de esos admins, y los usuarios (admins y clientes).
 */
export async function borrarDatosDeUsuarios(
  dataSource: DataSource,
  usuarios: string[],
): Promise<void> {
  if (usuarios.length === 0) {
    return;
  }
  await dataSource.query(
    `DELETE FROM vencimientos WHERE cliente_id IN
       (SELECT id FROM clientes WHERE admin_id = ANY($1))`,
    [usuarios],
  );
  await dataSource.query(
    `DELETE FROM clientes WHERE admin_id = ANY($1) OR usuario_id = ANY($1)`,
    [usuarios],
  );
  await dataSource.query(`DELETE FROM usuarios WHERE id = ANY($1)`, [usuarios]);
}
