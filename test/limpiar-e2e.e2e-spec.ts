import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { hoyArgentina } from '../src/common/utils/fecha';
import { limpiarE2e } from '../src/database/scripts/limpiar-e2e';
import { borrarDatosDeUsuarios, crearApp } from './utils/crear-app';

// Corre contra la base de .env. Usa un prefijo propio (`e2e-limpieza-<sufijo>-`)
// para no borrar los usuarios e2e de otros proyectos (p. ej. contable-dashboard).

describe('limpiar:e2e (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const usuariosCreados: string[] = [];

  const sufijo = randomUUID().slice(0, 8);
  const prefijo = `e2e-limpieza-${sufijo}-`;
  const PASSWORD = 'claveSegura123';

  const emailAdmin = `${prefijo}admin@example.com`;
  const emailOtroDominio = `${prefijo}admin@test.com`;
  const emailCliente = `${prefijo}cliente@example.com`;

  const http = () => request(app.getHttpServer());

  async function registrarYLoguear(email: string) {
    const reg = await http()
      .post('/auth/register')
      .send({ email, password: PASSWORD, nombre: 'Contador' })
      .expect(201);
    usuariosCreados.push((reg.body as { id: string }).id);
    const res = await http()
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return (res.body as { accessToken: string }).accessToken;
  }

  async function crearCliente(token: string) {
    const res = await http()
      .post('/clientes')
      .auth(token, { type: 'bearer' })
      .send({
        razonSocial: 'Cliente a limpiar',
        cuit: '20123456786',
        email: 'contacto@test.com',
        condicionIVA: 'monotributista',
      })
      .expect(201);
    return (res.body as { id: string }).id;
  }

  async function contarUsuarios(emails: string[]): Promise<number> {
    const [{ total }]: { total: number }[] = await dataSource.query(
      `SELECT count(*)::int AS total FROM usuarios WHERE email = ANY($1)`,
      [emails],
    );
    return total;
  }

  beforeAll(async () => {
    app = await crearApp();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await borrarDatosDeUsuarios(dataSource, usuariosCreados);
    await app.close();
  });

  it('borra el admin con sus clientes, acceso y vencimientos, y nada más', async () => {
    const token = await registrarYLoguear(emailAdmin);
    const clienteId = await crearCliente(token);

    const acceso = await http()
      .post(`/clientes/${clienteId}/acceso`)
      .auth(token, { type: 'bearer' })
      .send({ email: emailCliente, password: PASSWORD })
      .expect(201);
    usuariosCreados.push((acceso.body as { id: string }).id);

    const impuestos = await http()
      .get('/impuestos')
      .auth(token, { type: 'bearer' })
      .expect(200);
    const iva = (impuestos.body as { id: string; codigo: string }[]).find(
      (i) => i.codigo === 'IVA',
    )!;
    await http()
      .post('/vencimientos')
      .auth(token, { type: 'bearer' })
      .send({
        clienteId,
        impuestoId: iva.id,
        fechaVencimiento: hoyArgentina(),
        periodo: '2026-01',
      })
      .expect(201);

    // Mismo prefijo, otro dominio: no coincide con el patrón.
    const tokenOtro = await registrarYLoguear(emailOtroDominio);
    await crearCliente(tokenOtro);

    await expect(limpiarE2e(dataSource, prefijo)).resolves.toEqual({
      admins: 1,
      clientes: 1,
      usuariosCliente: 1,
      vencimientos: 1,
    });

    expect(await contarUsuarios([emailAdmin, emailCliente])).toBe(0);
    expect(await contarUsuarios([emailOtroDominio])).toBe(1);
    await http()
      .get('/clientes')
      .auth(tokenOtro, { type: 'bearer' })
      .expect(200)
      .expect((res) => expect((res.body as { total: number }).total).toBe(1));

    // Ya no queda nada que coincida.
    await expect(limpiarE2e(dataSource, prefijo)).resolves.toEqual({
      admins: 0,
      clientes: 0,
      usuariosCliente: 0,
      vencimientos: 0,
    });
  });

  it('rechaza un prefijo que no empiece con "e2e-"', async () => {
    await expect(limpiarE2e(dataSource, 'demo')).rejects.toThrow('e2e-');
  });
});
