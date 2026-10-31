import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app.setup';
import { hoyArgentina, sumarDias } from '../src/common/utils/fecha';

// Corre contra la base de .env (con el seed de impuestos). Usa emails
// aleatorios y borra lo que crea.

interface VencimientoBody {
  id: string;
  clienteId: string;
  fechaVencimiento: string;
  periodo: string;
  estado: string;
  estadoActual: string;
  fechaPresentacion: string | null;
  notas: string | null;
  impuesto: { codigo: string };
  cliente: { id: string; razonSocial: string; cuit: string };
}

interface Pagina {
  data: VencimientoBody[];
  total: number;
  page: number;
  limit: number;
}

describe('Vencimientos (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const usuariosCreados: string[] = [];

  const sufijo = randomUUID().slice(0, 8);
  const PASSWORD = 'claveSegura123';
  const hoy = hoyArgentina();

  let tokenA: string;
  let tokenB: string;
  let tokenCliente1: string;
  let cliente1: string; // de A, con acceso
  let cliente2: string; // de A
  let clienteB: string; // de B
  const impuestos: Record<string, string> = {};

  const http = () => request(app.getHttpServer());

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

  function crearVencimiento(
    token: string,
    body: Record<string, unknown>,
    status = 201,
  ) {
    return http()
      .post('/vencimientos')
      .auth(token, { type: 'bearer' })
      .send(body)
      .expect(status);
  }

  function get(token: string, url: string, status = 200) {
    return http().get(url).auth(token, { type: 'bearer' }).expect(status);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configurarApp(app);
    await app.init();
    dataSource = app.get(DataSource);

    tokenA = await registrarYLoguear(`venc-a-${sufijo}@test.com`);
    tokenB = await registrarYLoguear(`venc-b-${sufijo}@test.com`);

    cliente1 = await crearCliente(tokenA, '20123456786');
    cliente2 = await crearCliente(tokenA, '30712345671');
    clienteB = await crearCliente(tokenB, '20123456786');

    const emailCliente = `venc-cli-${sufijo}@test.com`;
    const acceso = await http()
      .post(`/clientes/${cliente1}/acceso`)
      .auth(tokenA, { type: 'bearer' })
      .send({ email: emailCliente, password: PASSWORD })
      .expect(201);
    usuariosCreados.push((acceso.body as { id: string }).id);
    tokenCliente1 = await login(emailCliente);

    const res = await get(tokenA, '/impuestos');
    for (const i of res.body as { id: string; codigo: string }[]) {
      impuestos[i.codigo] = i.id;
    }
  });

  afterAll(async () => {
    if (usuariosCreados.length > 0) {
      await dataSource.query(
        `DELETE FROM vencimientos WHERE cliente_id IN
           (SELECT id FROM clientes WHERE admin_id = ANY($1))`,
        [usuariosCreados],
      );
      await dataSource.query(
        `DELETE FROM clientes WHERE admin_id = ANY($1) OR usuario_id = ANY($1)`,
        [usuariosCreados],
      );
      await dataSource.query(`DELETE FROM usuarios WHERE id = ANY($1)`, [
        usuariosCreados,
      ]);
    }
    await app.close();
  });

  describe('GET /impuestos', () => {
    it('lista los 6 impuestos del seed para cualquier autenticado', async () => {
      const res = await get(tokenCliente1, '/impuestos');
      expect(Object.keys(impuestos).sort()).toEqual(
        [
          'AUTONOMOS',
          'BIENES_PERSONALES',
          'GANANCIAS',
          'IIBB',
          'IVA',
          'MONOTRIBUTO',
        ].sort(),
      );
      expect(res.body).toHaveLength(6);
    });
  });

  describe('POST /vencimientos', () => {
    it('crea un vencimiento pendiente con impuesto y cliente', async () => {
      const res = await crearVencimiento(tokenA, {
        clienteId: cliente1,
        impuestoId: impuestos.IVA,
        fechaVencimiento: sumarDias(hoy, 10),
        periodo: '2026-01',
        notas: '  primera  ',
      });
      const v = res.body as VencimientoBody;
      expect(v).toMatchObject({
        clienteId: cliente1,
        fechaVencimiento: sumarDias(hoy, 10),
        periodo: '2026-01',
        estado: 'pendiente',
        estadoActual: 'pendiente',
        fechaPresentacion: null,
        notas: 'primera',
        impuesto: { codigo: 'IVA' },
        cliente: { id: cliente1, cuit: '20123456786' },
      });
    });

    it('valida el periodo según la periodicidad del impuesto', async () => {
      await crearVencimiento(
        tokenA,
        {
          clienteId: cliente1,
          impuestoId: impuestos.GANANCIAS,
          fechaVencimiento: hoy,
          periodo: '2026-01',
        },
        400,
      );
      await crearVencimiento(
        tokenA,
        {
          clienteId: cliente1,
          impuestoId: impuestos.IIBB,
          fechaVencimiento: hoy,
          periodo: '2026',
        },
        400,
      );
      await crearVencimiento(
        tokenA,
        {
          clienteId: cliente1,
          impuestoId: impuestos.GANANCIAS,
          fechaVencimiento: hoy,
          periodo: '2025',
        },
        201,
      );
    });

    it('rechaza fechas inválidas y periodos mal formados', async () => {
      const base = {
        clienteId: cliente1,
        impuestoId: impuestos.IVA,
        periodo: '2026-02',
        fechaVencimiento: hoy,
      };
      await crearVencimiento(
        tokenA,
        { ...base, fechaVencimiento: '2026-02-30' },
        400,
      );
      await crearVencimiento(tokenA, { ...base, periodo: '2026-13' }, 400);
      await crearVencimiento(tokenA, { ...base, estado: 'presentado' }, 400);
    });

    it('vencimiento duplicado (cliente, impuesto, periodo) → 409', async () => {
      await crearVencimiento(
        tokenA,
        {
          clienteId: cliente1,
          impuestoId: impuestos.IVA,
          fechaVencimiento: hoy,
          periodo: '2026-01',
        },
        409,
      );
    });

    it('cliente de otro estudio → 404; impuesto inexistente → 404', async () => {
      await crearVencimiento(
        tokenA,
        {
          clienteId: clienteB,
          impuestoId: impuestos.IVA,
          fechaVencimiento: hoy,
          periodo: '2026-01',
        },
        404,
      );
      await crearVencimiento(
        tokenA,
        {
          clienteId: cliente1,
          impuestoId: randomUUID(),
          fechaVencimiento: hoy,
          periodo: '2026-01',
        },
        404,
      );
    });

    it('cliente dado de baja → 409', async () => {
      const inactivo = await crearCliente(tokenA, '27123456780');
      await http()
        .delete(`/clientes/${inactivo}`)
        .auth(tokenA, { type: 'bearer' })
        .expect(204);
      await crearVencimiento(
        tokenA,
        {
          clienteId: inactivo,
          impuestoId: impuestos.IVA,
          fechaVencimiento: hoy,
          periodo: '2026-01',
        },
        409,
      );
    });

    it('un usuario cliente no puede crear → 403', async () => {
      await crearVencimiento(
        tokenCliente1,
        {
          clienteId: cliente1,
          impuestoId: impuestos.IVA,
          fechaVencimiento: hoy,
          periodo: '2026-03',
        },
        403,
      );
    });
  });

  describe('estado vencido, filtros y próximos', () => {
    let vencido: string;
    let enCuarentaDias: string;
    let deHoy: string;
    let deCliente2: string;

    beforeAll(async () => {
      const crear = async (
        clienteId: string,
        codigo: string,
        periodo: string,
        fecha: string,
      ) =>
        (
          (
            await crearVencimiento(tokenA, {
              clienteId,
              impuestoId: impuestos[codigo],
              fechaVencimiento: fecha,
              periodo,
            })
          ).body as VencimientoBody
        ).id;

      vencido = await crear(cliente1, 'IIBB', '2025-12', sumarDias(hoy, -1));
      deHoy = await crear(cliente1, 'AUTONOMOS', '2026-01', hoy);
      enCuarentaDias = await crear(
        cliente1,
        'MONOTRIBUTO',
        '2026-01',
        sumarDias(hoy, 40),
      );
      deCliente2 = await crear(cliente2, 'IVA', '2026-01', sumarDias(hoy, 5));
      await crear(cliente2, 'IIBB', '2026-01', sumarDias(hoy, -3));
    });

    it('un pendiente con fecha pasada se expone como vencido', async () => {
      const res = await get(tokenA, `/vencimientos/${vencido}`);
      expect(res.body).toMatchObject({
        estado: 'pendiente',
        estadoActual: 'vencido',
      });
      const hoyRes = await get(tokenA, `/vencimientos/${deHoy}`);
      expect((hoyRes.body as VencimientoBody).estadoActual).toBe('pendiente');
    });

    it('?estado=vencido se filtra en SQL y pagina bien', async () => {
      const res = await get(tokenA, '/vencimientos?estado=vencido&limit=1');
      const pagina = res.body as Pagina;
      expect(pagina.total).toBe(2);
      expect(pagina.data).toHaveLength(1);
      expect(pagina.data[0].estadoActual).toBe('vencido');

      const pendientes = (
        await get(tokenA, '/vencimientos?estado=pendiente&limit=100')
      ).body as Pagina;
      expect(pendientes.data.every((v) => v.estadoActual === 'pendiente')).toBe(
        true,
      );
      expect(pendientes.data.map((v) => v.id)).not.toContain(vencido);
    });

    it('filtra por clienteId, impuestoId y rango de fechas', async () => {
      const porCliente = (
        await get(tokenA, `/vencimientos?clienteId=${cliente2}`)
      ).body as Pagina;
      expect(porCliente.data.every((v) => v.clienteId === cliente2)).toBe(true);
      expect(porCliente.total).toBe(2);

      const porImpuesto = (
        await get(tokenA, `/vencimientos?impuestoId=${impuestos.MONOTRIBUTO}`)
      ).body as Pagina;
      expect(porImpuesto.data.map((v) => v.id)).toEqual([enCuarentaDias]);

      const rango = (
        await get(
          tokenA,
          `/vencimientos?desde=${hoy}&hasta=${sumarDias(hoy, 5)}`,
        )
      ).body as Pagina;
      expect(
        rango.data.every(
          (v) =>
            v.fechaVencimiento >= hoy &&
            v.fechaVencimiento <= sumarDias(hoy, 5),
        ),
      ).toBe(true);
      expect(rango.data.map((v) => v.id)).toContain(deCliente2);

      await get(
        tokenA,
        `/vencimientos?desde=${hoy}&hasta=${sumarDias(hoy, -1)}`,
        400,
      );
      await get(tokenA, '/vencimientos?estado=otro', 400);
    });

    it('lista ordenada por fecha de vencimiento', async () => {
      const fechas = (
        (await get(tokenA, '/vencimientos?limit=100')).body as Pagina
      ).data.map((v) => v.fechaVencimiento);
      expect(fechas).toEqual([...fechas].sort());
    });

    it('/proximos: pendientes de hoy a hoy+30, ordenados', async () => {
      const pagina = (await get(tokenA, '/vencimientos/proximos'))
        .body as Pagina;
      const ids = pagina.data.map((v) => v.id);
      expect(ids).toContain(deHoy);
      expect(ids).toContain(deCliente2);
      expect(ids).not.toContain(vencido);
      expect(ids).not.toContain(enCuarentaDias);
      expect(pagina.data.every((v) => v.estado === 'pendiente')).toBe(true);
      const fechas = pagina.data.map((v) => v.fechaVencimiento);
      expect(fechas).toEqual([...fechas].sort());
    });

    it('/proximos excluye los presentados', async () => {
      await http()
        .patch(`/vencimientos/${deCliente2}`)
        .auth(tokenA, { type: 'bearer' })
        .send({ estado: 'presentado' })
        .expect(200);
      const ids = (
        (await get(tokenA, '/vencimientos/proximos')).body as Pagina
      ).data.map((v) => v.id);
      expect(ids).not.toContain(deCliente2);
    });

    it('el usuario cliente solo ve los suyos (también en /proximos)', async () => {
      const lista = (await get(tokenCliente1, '/vencimientos?limit=100'))
        .body as Pagina;
      expect(lista.total).toBeGreaterThan(0);
      expect(lista.data.every((v) => v.clienteId === cliente1)).toBe(true);

      const proximos = (await get(tokenCliente1, '/vencimientos/proximos'))
        .body as Pagina;
      expect(proximos.data.every((v) => v.clienteId === cliente1)).toBe(true);

      const ajenos = (
        await get(tokenCliente1, `/vencimientos?clienteId=${cliente2}`)
      ).body as Pagina;
      expect(ajenos.total).toBe(0);

      await get(tokenCliente1, `/vencimientos/${deCliente2}`, 404);
      await get(tokenCliente1, `/vencimientos/${deHoy}`, 200);
    });

    it('admin B no ve, edita ni borra vencimientos de A (404)', async () => {
      const listaB = (await get(tokenB, '/vencimientos?limit=100'))
        .body as Pagina;
      expect(listaB.total).toBe(0);
      await get(tokenB, `/vencimientos/${deHoy}`, 404);
      await http()
        .patch(`/vencimientos/${deHoy}`)
        .auth(tokenB, { type: 'bearer' })
        .send({ notas: 'x' })
        .expect(404);
      await http()
        .delete(`/vencimientos/${deHoy}`)
        .auth(tokenB, { type: 'bearer' })
        .expect(404);
    });
  });

  describe('PATCH / DELETE', () => {
    let id: string;

    beforeAll(async () => {
      const res = await crearVencimiento(tokenA, {
        clienteId: cliente1,
        impuestoId: impuestos.BIENES_PERSONALES,
        fechaVencimiento: sumarDias(hoy, 3),
        periodo: '2025',
      });
      id = (res.body as VencimientoBody).id;
    });

    const patch = (body: object, status = 200, token = tokenA) =>
      http()
        .patch(`/vencimientos/${id}`)
        .auth(token, { type: 'bearer' })
        .send(body)
        .expect(status);

    it('al marcar presentado completa fechaPresentacion con hoy', async () => {
      const res = await patch({ estado: 'presentado' });
      expect(res.body).toMatchObject({
        estado: 'presentado',
        estadoActual: 'presentado',
        fechaPresentacion: hoy,
      });
    });

    it('acepta una fechaPresentacion pasada, rechaza una futura', async () => {
      const ayer = sumarDias(hoy, -1);
      const res = await patch({ fechaPresentacion: ayer });
      expect((res.body as VencimientoBody).fechaPresentacion).toBe(ayer);
      await patch({ fechaPresentacion: sumarDias(hoy, 1) }, 400);
    });

    it('editar solo notas conserva estado y fecha de presentación', async () => {
      const res = await patch({ notas: 'presentado por web' });
      expect(res.body).toMatchObject({
        estado: 'presentado',
        fechaPresentacion: sumarDias(hoy, -1),
        notas: 'presentado por web',
      });
    });

    it('volver a pendiente borra fechaPresentacion', async () => {
      const res = await patch({ estado: 'pendiente', notas: '' });
      expect(res.body).toMatchObject({
        estado: 'pendiente',
        fechaPresentacion: null,
        notas: null,
      });
      await patch({ fechaPresentacion: hoy }, 400);
    });

    it('rechaza campos que no se pueden editar', async () => {
      await patch({ fechaVencimiento: hoy }, 400);
      await patch({ estado: 'vencido' }, 400);
    });

    it('un usuario cliente no puede editar ni borrar → 403', async () => {
      await patch({ notas: 'hack' }, 403, tokenCliente1);
      await http()
        .delete(`/vencimientos/${id}`)
        .auth(tokenCliente1, { type: 'bearer' })
        .expect(403);
    });

    it('elimina → 204 y después 404', async () => {
      await http()
        .delete(`/vencimientos/${id}`)
        .auth(tokenA, { type: 'bearer' })
        .expect(204);
      await get(tokenA, `/vencimientos/${id}`, 404);
      await get(tokenA, '/vencimientos/no-es-uuid', 400);
    });
  });
});
