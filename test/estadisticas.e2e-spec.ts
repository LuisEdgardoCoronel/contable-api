import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import {
  finDeMes,
  hoyArgentina,
  inicioDeMes,
  sumarDias,
  sumarMeses,
} from '../src/common/utils/fecha';
import { borrarDatosDeUsuarios, crearApp } from './utils/crear-app';

// Corre contra la base de .env (con el seed de impuestos). Usa emails
// aleatorios y borra lo que crea. Las fechas son relativas a hoy (Argentina).

interface Conteos {
  pendientes: number;
  vencidos: number;
  presentados: number;
}

interface Estadisticas {
  hoy: string;
  rango: { desde: string; hasta: string };
  clientes: { activos: number; inactivos: number };
  vencimientos: Conteos & { proximos30Dias: number };
  porMes: (Conteos & { mes: string })[];
  porImpuesto: (Conteos & {
    impuesto: { id: string; codigo: string; nombre: string };
  })[];
}

describe('Estadísticas (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const usuariosCreados: string[] = [];

  const sufijo = randomUUID().slice(0, 8);
  const PASSWORD = 'claveSegura123';
  const hoy = hoyArgentina();

  let tokenA: string;
  let tokenB: string;
  let tokenCliente: string;
  const impuestos: Record<string, string> = {};
  let ordenImpuestos: string[] = [];

  // Rango que cubre todos los vencimientos de A (de hoy - 20 a hoy + 40).
  const rangoCompleto = {
    desde: inicioDeMes(sumarDias(hoy, -20)),
    hasta: finDeMes(sumarDias(hoy, 40)),
  };

  const http = () => request(app.getHttpServer());

  function get(token: string, url: string, status = 200) {
    return http().get(url).auth(token, { type: 'bearer' }).expect(status);
  }

  async function estadisticas(token: string, query = '') {
    return (await get(token, `/estadisticas${query}`)).body as Estadisticas;
  }

  async function login(email: string) {
    const res = await http()
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return (res.body as { accessToken: string }).accessToken;
  }

  async function registrarYLoguear(email: string) {
    const reg = await http()
      .post('/auth/register')
      .send({ email, password: PASSWORD, nombre: 'Contador' })
      .expect(201);
    usuariosCreados.push((reg.body as { id: string }).id);
    return login(email);
  }

  async function crearCliente(token: string, cuit: string) {
    const res = await http()
      .post('/clientes')
      .auth(token, { type: 'bearer' })
      .send({
        razonSocial: `Cliente ${cuit}`,
        cuit,
        email: 'contacto@test.com',
        condicionIVA: 'monotributista',
      })
      .expect(201);
    return (res.body as { id: string }).id;
  }

  async function crearVencimiento(
    token: string,
    clienteId: string,
    codigo: string,
    dias: number,
  ) {
    const res = await http()
      .post('/vencimientos')
      .auth(token, { type: 'bearer' })
      .send({
        clienteId,
        impuestoId: impuestos[codigo],
        fechaVencimiento: sumarDias(hoy, dias),
        periodo: '2026-01',
      })
      .expect(201);
    return (res.body as { id: string }).id;
  }

  beforeAll(async () => {
    app = await crearApp();
    dataSource = app.get(DataSource);

    tokenA = await registrarYLoguear(`est-a-${sufijo}@test.com`);
    tokenB = await registrarYLoguear(`est-b-${sufijo}@test.com`);

    const lista = (await get(tokenA, '/impuestos')).body as {
      id: string;
      codigo: string;
    }[];
    ordenImpuestos = lista.map((i) => i.codigo);
    for (const i of lista) {
      impuestos[i.codigo] = i.id;
    }

    // Admin A: un cliente activo (con acceso) y uno que se da de baja.
    const cliente1 = await crearCliente(tokenA, '20123456786');
    const cliente2 = await crearCliente(tokenA, '30712345671');

    await crearVencimiento(tokenA, cliente1, 'IVA', -10); // vencido
    await crearVencimiento(tokenA, cliente1, 'IIBB', 5); // pendiente, próximo
    await crearVencimiento(tokenA, cliente1, 'AUTONOMOS', 40); // pendiente
    const presentado = await crearVencimiento(
      tokenA,
      cliente1,
      'MONOTRIBUTO',
      -20,
    );
    await http()
      .patch(`/vencimientos/${presentado}`)
      .auth(tokenA, { type: 'bearer' })
      .send({ estado: 'presentado' })
      .expect(200);
    await crearVencimiento(tokenA, cliente2, 'IVA', 3); // pendiente, cliente inactivo
    await crearVencimiento(tokenA, cliente2, 'IIBB', -2); // vencido, cliente inactivo
    await http()
      .delete(`/clientes/${cliente2}`)
      .auth(tokenA, { type: 'bearer' })
      .expect(204);

    const emailCliente = `est-cli-${sufijo}@test.com`;
    const acceso = await http()
      .post(`/clientes/${cliente1}/acceso`)
      .auth(tokenA, { type: 'bearer' })
      .send({ email: emailCliente, password: PASSWORD })
      .expect(201);
    usuariosCreados.push((acceso.body as { id: string }).id);
    tokenCliente = await login(emailCliente);

    // Admin B: mismo CUIT que un cliente de A (permitido en otro estudio).
    const clienteB = await crearCliente(tokenB, '20123456786');
    await crearVencimiento(tokenB, clienteB, 'IVA', 2);
    await crearVencimiento(tokenB, clienteB, 'IIBB', -5);
  });

  afterAll(async () => {
    await borrarDatosDeUsuarios(dataSource, usuariosCreados);
    await app.close();
  });

  it('cuenta solo los datos del propio estudio', async () => {
    const a = await estadisticas(tokenA);
    expect(a.hoy).toBe(hoy);
    expect(a.clientes).toEqual({ activos: 1, inactivos: 1 });
    expect(a.vencimientos).toEqual({
      pendientes: 3,
      vencidos: 2,
      presentados: 1,
      proximos30Dias: 1, // el del cliente inactivo no cuenta
    });

    const b = await estadisticas(tokenB);
    expect(b.clientes).toEqual({ activos: 1, inactivos: 0 });
    expect(b.vencimientos).toEqual({
      pendientes: 1,
      vencidos: 1,
      presentados: 0,
      proximos30Dias: 1,
    });
  });

  it('un usuario cliente recibe 403', async () => {
    await get(tokenCliente, '/estadisticas', 403);
  });

  it('exige autenticación', async () => {
    await http().get('/estadisticas').expect(401);
  });

  it('coincide con los totales de /vencimientos y /vencimientos/proximos', async () => {
    for (const token of [tokenA, tokenB]) {
      const { vencimientos } = await estadisticas(token);
      const total = async (url: string) =>
        ((await get(token, url)).body as { total: number }).total;

      expect(vencimientos.pendientes).toBe(
        await total('/vencimientos?estado=pendiente'),
      );
      expect(vencimientos.vencidos).toBe(
        await total('/vencimientos?estado=vencido'),
      );
      expect(vencimientos.presentados).toBe(
        await total('/vencimientos?estado=presentado'),
      );
      expect(vencimientos.proximos30Dias).toBe(
        await total('/vencimientos/proximos'),
      );
    }
  });

  it('por defecto usa los últimos 6 meses hasta fin del mes actual', async () => {
    const { rango, porMes } = await estadisticas(tokenA);
    expect(rango).toEqual({
      desde: sumarMeses(hoy, -5),
      hasta: finDeMes(hoy),
    });
    expect(porMes).toHaveLength(6);
    expect(porMes[5].mes).toBe(hoy.slice(0, 7));
  });

  it('porMes y porImpuesto suman lo mismo que el listado del rango', async () => {
    const { desde, hasta } = rangoCompleto;
    const est = await estadisticas(tokenA, `?desde=${desde}&hasta=${hasta}`);

    const suma = (filas: Conteos[]) =>
      filas.reduce(
        (acc, f) => ({
          pendientes: acc.pendientes + f.pendientes,
          vencidos: acc.vencidos + f.vencidos,
          presentados: acc.presentados + f.presentados,
        }),
        { pendientes: 0, vencidos: 0, presentados: 0 },
      );
    const esperado = { pendientes: 3, vencidos: 2, presentados: 1 };
    expect(suma(est.porMes)).toEqual(esperado);
    expect(suma(est.porImpuesto)).toEqual(esperado);

    const listado = (
      await get(tokenA, `/vencimientos?desde=${desde}&hasta=${hasta}`)
    ).body as { total: number };
    expect(listado.total).toBe(6);

    const porCodigo = Object.fromEntries(
      est.porImpuesto.map((f) => [f.impuesto.codigo, f]),
    );
    expect(porCodigo.IVA).toMatchObject({ pendientes: 1, vencidos: 1 });
    expect(porCodigo.IIBB).toMatchObject({ pendientes: 1, vencidos: 1 });
    expect(porCodigo.AUTONOMOS).toMatchObject({ pendientes: 1 });
    expect(porCodigo.MONOTRIBUTO).toMatchObject({ presentados: 1 });

    // Solo impuestos con vencimientos, en el mismo orden (por nombre) que /impuestos.
    expect(est.porImpuesto.map((f) => f.impuesto.codigo)).toEqual(
      ordenImpuestos.filter((c) => c in porCodigo),
    );
    expect(est.porImpuesto).toHaveLength(4);
  });

  it('porMes devuelve los meses sin vencimientos en cero', async () => {
    const desde = sumarMeses(hoy, -26);
    const hasta = finDeMes(sumarMeses(hoy, -24));
    const est = await estadisticas(tokenA, `?desde=${desde}&hasta=${hasta}`);

    expect(est.rango).toEqual({ desde, hasta });
    expect(est.porMes).toEqual(
      [desde, sumarMeses(desde, 1), sumarMeses(desde, 2)].map((m) => ({
        mes: m.slice(0, 7),
        pendientes: 0,
        vencidos: 0,
        presentados: 0,
      })),
    );
    expect(est.porImpuesto).toEqual([]);
    // Los totales globales no dependen del rango.
    expect(est.vencimientos.pendientes).toBe(3);
  });

  it('con una sola fecha, el rango es de 6 meses a partir de ella', async () => {
    const { rango } = await estadisticas(tokenA, '?hasta=2025-01-15');
    expect(rango).toEqual({ desde: '2024-08-01', hasta: '2025-01-15' });

    const otro = await estadisticas(tokenA, '?desde=2025-01-15');
    expect(otro.rango).toEqual({ desde: '2025-01-15', hasta: '2025-06-30' });
  });

  it('valida las fechas y el rango (400)', async () => {
    await get(tokenA, '/estadisticas?desde=2026-05-01&hasta=2026-04-30', 400);
    await get(tokenA, '/estadisticas?desde=2026-02-30', 400);
    await get(tokenA, '/estadisticas?hasta=ayer', 400);
    await get(tokenA, '/estadisticas?desde=2020-01-01&hasta=2023-01-01', 400);
    await get(tokenA, '/estadisticas?otro=1', 400);
  });
});
