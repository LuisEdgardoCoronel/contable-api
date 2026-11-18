import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { crearApp } from './utils/crear-app';

// App propia con el rate limit activo: los contadores viven en memoria de
// esta instancia, así que no interfiere con los demás e2e. No crea datos.
// Fija su propio límite para no depender del LOGIN_RATE_LIMIT del .env.
const LOGIN_INTENTOS = 3;

describe('Rate limit de login (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await crearApp({ rateLimitLogin: LOGIN_INTENTOS });
  });

  afterAll(async () => {
    await app.close();
  });

  it(`después de ${LOGIN_INTENTOS} intentos por minuto responde 429`, async () => {
    const http = () => request(app.getHttpServer());
    const body = {
      email: `nadie-${randomUUID().slice(0, 8)}@test.com`,
      password: 'claveSegura123',
    };

    for (let i = 0; i < LOGIN_INTENTOS; i++) {
      await http().post('/auth/login').send(body).expect(401);
    }
    await http().post('/auth/login').send(body).expect(429);

    // El límite es solo para el login: el registro sigue respondiendo.
    await http()
      .post('/auth/register')
      .send({ email: 'no-es-email', password: 'x' })
      .expect(400);
  });
});
