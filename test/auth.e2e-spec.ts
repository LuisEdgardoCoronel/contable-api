import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { borrarDatosDeUsuarios, crearApp } from './utils/crear-app';

// Corre contra la base de .env. Usa emails aleatorios y borra lo que crea.

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const usuariosCreados: string[] = [];

  const sufijo = randomUUID().slice(0, 8);
  const PASSWORD = 'claveSegura123';

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await crearApp();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await borrarDatosDeUsuarios(dataSource, usuariosCreados);
    await app.close();
  });

  it('register ignora un rol enviado en el body y crea un admin', async () => {
    const email = `rol-cliente-${sufijo}@test.com`;
    const reg = await http()
      .post('/auth/register')
      .send({ email, password: PASSWORD, nombre: 'Intruso', rol: 'cliente' })
      .expect(201);
    const usuario = reg.body as Record<string, unknown>;
    usuariosCreados.push(usuario.id as string);
    expect(usuario).toMatchObject({ email, rol: 'admin' });
    expect(usuario).not.toHaveProperty('password');

    const login = await http()
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const token = (login.body as { accessToken: string }).accessToken;

    const me = await http()
      .get('/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(me.body).toMatchObject({ rol: 'admin', cliente: null });

    // Opera como admin: puede usar /clientes (solo admin).
    await http().get('/clientes').auth(token, { type: 'bearer' }).expect(200);
  });

  it('register rechaza otros campos desconocidos (400)', async () => {
    await http()
      .post('/auth/register')
      .send({
        email: `extra-${sufijo}@test.com`,
        password: PASSWORD,
        nombre: 'Contador',
        adminId: randomUUID(),
      })
      .expect(400);
  });
});
