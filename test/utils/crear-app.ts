import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configurarApp } from '../../src/app.setup';

/** Levanta la app completa, con la misma configuración global que `main.ts`. */
export async function crearApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

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
