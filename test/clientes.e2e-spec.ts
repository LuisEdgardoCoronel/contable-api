import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app.setup';

// Corre contra la base de .env. Usa emails aleatorios y borra lo que crea.

describe('Clientes (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const usuariosCreados: string[] = [];

  const sufijo = randomUUID().slice(0, 8);
  const PASSWORD = 'claveSegura123';
  let tokenA: string;
  let tokenB: string;

  const http = () => request(app.getHttpServer());

  async function registrarYLoguear(email: string): Promise<string> {
    const reg = await http()
      .post('/auth/register')
      .send({ email, password: PASSWORD, nombre: 'Contador' })
      .expect(201);
    usuariosCreados.push((reg.body as { id: string }).id);
    return login(email);
  }

  async function login(email: string, password = PASSWORD) {
    const res = await http()
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return (res.body as { accessToken: string }).accessToken;
  }

  const clienteBase = {
    razonSocial: 'Panadería La Espiga SRL',
    cuit: '30-71234567-1',
    email: 'Admin@LaEspiga.com',
    condicionIVA: 'responsable_inscripto',
  };

  async function crearCliente(token: string, body: object = clienteBase) {
    const res = await http()
      .post('/clientes')
      .auth(token, { type: 'bearer' })
      .send(body)
      .expect(201);
    return res.body as { id: string; cuit: string; [k: string]: unknown };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configurarApp(app);
    await app.init();
    dataSource = app.get(DataSource);

    tokenA = await registrarYLoguear(`admin-a-${sufijo}@test.com`);
    tokenB = await registrarYLoguear(`admin-b-${sufijo}@test.com`);
  });

  afterAll(async () => {
    if (usuariosCreados.length > 0) {
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

  it('exige autenticación', async () => {
    await http().get('/clientes').expect(401);
  });

  it('crea un cliente normalizando CUIT y email', async () => {
    const cliente = await crearCliente(tokenA);
    expect(cliente).toMatchObject({
      cuit: '30712345671',
      email: 'admin@laespiga.com',
      telefono: null,
      activo: true,
      usuarioId: null,
    });
  });

  it('rechaza CUIT con dígito verificador inválido (400)', async () => {
    await http()
      .post('/clientes')
      .auth(tokenA, { type: 'bearer' })
      .send({ ...clienteBase, cuit: '30712345672' })
      .expect(400);
  });

  it('rechaza campos desconocidos como adminId (400)', async () => {
    await http()
      .post('/clientes')
      .auth(tokenA, { type: 'bearer' })
      .send({ ...clienteBase, cuit: '20123456786', adminId: randomUUID() })
      .expect(400);
  });

  it('CUIT duplicado en el mismo estudio → 409; en otro estudio se permite', async () => {
    await http()
      .post('/clientes')
      .auth(tokenA, { type: 'bearer' })
      .send(clienteBase)
      .expect(409);
    await crearCliente(tokenB);
  });

  it('lista paginado, solo con los clientes del admin, y filtra', async () => {
    await crearCliente(tokenA, {
      ...clienteBase,
      razonSocial: 'Ferretería El Tornillo',
      cuit: '20123456786',
    });

    const todos = await http()
      .get('/clientes?limit=1')
      .auth(tokenA, { type: 'bearer' })
      .expect(200);
    expect(todos.body).toMatchObject({ total: 2, page: 1, limit: 1 });
    expect((todos.body as { data: unknown[] }).data).toHaveLength(1);

    const porNombre = await http()
      .get('/clientes?search=tornillo')
      .auth(tokenA, { type: 'bearer' })
      .expect(200);
    expect(porNombre.body).toMatchObject({
      total: 1,
      data: [{ cuit: '20123456786' }],
    });

    const porCuit = await http()
      .get('/clientes?search=30-7123')
      .auth(tokenA, { type: 'bearer' })
      .expect(200);
    expect(porCuit.body).toMatchObject({
      total: 1,
      data: [{ cuit: '30712345671' }],
    });

    // El % no actúa como comodín.
    const comodin = await http()
      .get('/clientes?search=%25')
      .auth(tokenA, { type: 'bearer' })
      .expect(200);
    expect(comodin.body).toMatchObject({ total: 0 });

    const deB = await http()
      .get('/clientes')
      .auth(tokenB, { type: 'bearer' })
      .expect(200);
    expect(deB.body).toMatchObject({ total: 1 });
  });

  it('valida page y limit', async () => {
    await http()
      .get('/clientes?limit=101')
      .auth(tokenA, { type: 'bearer' })
      .expect(400);
    await http()
      .get('/clientes?page=0')
      .auth(tokenA, { type: 'bearer' })
      .expect(400);
    await http()
      .get('/clientes?activo=si')
      .auth(tokenA, { type: 'bearer' })
      .expect(400);
  });

  describe('aislamiento entre estudios', () => {
    let idDeA: string;

    beforeAll(async () => {
      idDeA = (
        await crearCliente(tokenA, {
          ...clienteBase,
          razonSocial: 'Solo de A',
          cuit: '27123456780',
        })
      ).id;
    });

    it('admin B recibe 404 al ver, editar, borrar o dar acceso', async () => {
      const auth = { type: 'bearer' } as const;
      await http().get(`/clientes/${idDeA}`).auth(tokenB, auth).expect(404);
      await http()
        .put(`/clientes/${idDeA}`)
        .auth(tokenB, auth)
        .send({ ...clienteBase, cuit: '27123456780' })
        .expect(404);
      await http().delete(`/clientes/${idDeA}`).auth(tokenB, auth).expect(404);
      await http()
        .post(`/clientes/${idDeA}/acceso`)
        .auth(tokenB, auth)
        .send({ email: `intruso-${sufijo}@test.com`, password: PASSWORD })
        .expect(404);

      const sigue = await http()
        .get(`/clientes/${idDeA}`)
        .auth(tokenA, auth)
        .expect(200);
      expect(sigue.body).toMatchObject({
        razonSocial: 'Solo de A',
        activo: true,
      });
    });

    it('id inexistente → 404, id mal formado → 400', async () => {
      await http()
        .get(`/clientes/${randomUUID()}`)
        .auth(tokenA, { type: 'bearer' })
        .expect(404);
      await http()
        .get('/clientes/no-es-uuid')
        .auth(tokenA, { type: 'bearer' })
        .expect(400);
    });
  });

  it('PUT reemplaza los datos; CUIT de otro cliente propio → 409', async () => {
    const cliente = await crearCliente(tokenA, {
      ...clienteBase,
      razonSocial: 'Para editar',
      cuit: '20000000036',
      telefono: '1111',
    });

    const editado = await http()
      .put(`/clientes/${cliente.id}`)
      .auth(tokenA, { type: 'bearer' })
      .send({
        ...clienteBase,
        razonSocial: 'Editado SA',
        cuit: '20000000036',
        condicionIVA: 'monotributista',
      })
      .expect(200);
    expect(editado.body).toMatchObject({
      razonSocial: 'Editado SA',
      condicionIVA: 'monotributista',
      telefono: null,
    });

    await http()
      .put(`/clientes/${cliente.id}`)
      .auth(tokenA, { type: 'bearer' })
      .send({ ...clienteBase, cuit: '30712345671' })
      .expect(409);
  });

  describe('acceso del cliente', () => {
    let clienteId: string;
    const emailCliente = `cliente-${sufijo}@test.com`;
    let tokenCliente: string;

    beforeAll(async () => {
      clienteId = (
        await crearCliente(tokenA, {
          ...clienteBase,
          razonSocial: 'Con acceso',
          cuit: '20000000044',
        })
      ).id;
    });

    it('crea el usuario cliente y lo vincula', async () => {
      const res = await http()
        .post(`/clientes/${clienteId}/acceso`)
        .auth(tokenA, { type: 'bearer' })
        .send({ email: emailCliente.toUpperCase(), password: PASSWORD })
        .expect(201);
      const usuario = res.body as Record<string, unknown>;
      usuariosCreados.push(usuario.id as string);
      expect(usuario).toMatchObject({
        email: emailCliente,
        rol: 'cliente',
        nombre: 'Con acceso',
      });
      expect(usuario).not.toHaveProperty('password');

      const cliente = await http()
        .get(`/clientes/${clienteId}`)
        .auth(tokenA, { type: 'bearer' })
        .expect(200);
      expect(cliente.body).toMatchObject({ usuarioId: usuario.id });

      tokenCliente = await login(emailCliente);
      const me = await http()
        .get('/auth/me')
        .auth(tokenCliente, { type: 'bearer' })
        .expect(200);
      expect(me.body).toMatchObject({ cliente: { id: clienteId } });
    });

    it('falla si ya tiene acceso (409)', async () => {
      await http()
        .post(`/clientes/${clienteId}/acceso`)
        .auth(tokenA, { type: 'bearer' })
        .send({ email: `otro-${sufijo}@test.com`, password: PASSWORD })
        .expect(409);
    });

    it('un usuario cliente no puede usar /clientes (403)', async () => {
      await http()
        .get('/clientes')
        .auth(tokenCliente, { type: 'bearer' })
        .expect(403);
      await http()
        .post('/clientes')
        .auth(tokenCliente, { type: 'bearer' })
        .send(clienteBase)
        .expect(403);
    });

    it('la baja lógica corta el login y el token emitido', async () => {
      await http()
        .delete(`/clientes/${clienteId}`)
        .auth(tokenA, { type: 'bearer' })
        .expect(204);

      const cliente = await http()
        .get(`/clientes/${clienteId}`)
        .auth(tokenA, { type: 'bearer' })
        .expect(200);
      expect(cliente.body).toMatchObject({ activo: false });

      await http()
        .post('/auth/login')
        .send({ email: emailCliente, password: PASSWORD })
        .expect(401);
      await http()
        .get('/auth/me')
        .auth(tokenCliente, { type: 'bearer' })
        .expect(401);

      const inactivos = await http()
        .get('/clientes?activo=false')
        .auth(tokenA, { type: 'bearer' })
        .expect(200);
      expect(inactivos.body).toMatchObject({
        total: 1,
        data: [{ id: clienteId }],
      });
    });

    it('no se puede dar acceso a un cliente dado de baja (409)', async () => {
      const otro = await crearCliente(tokenA, {
        ...clienteBase,
        razonSocial: 'Baja sin acceso',
        cuit: '20000000052',
      });
      await http()
        .delete(`/clientes/${otro.id}`)
        .auth(tokenA, { type: 'bearer' })
        .expect(204);
      await http()
        .post(`/clientes/${otro.id}/acceso`)
        .auth(tokenA, { type: 'bearer' })
        .send({ email: `baja-${sufijo}@test.com`, password: PASSWORD })
        .expect(409);
    });
  });
});
